-- Baskets and split payments.
--
-- Two real problems, one shape.
--
-- A customer buying three things meant three trips through the sell dialog, each
-- its own sale with its own payment. And a sale could only be paid one way,
-- because "how it was paid" was a single column -- so "300 by M-Pesa, 150 cash,
-- 200 on deni", which is an ordinary afternoon in a Kenyan shop, could not be
-- written down at all. Staff were rounding it into whichever method was biggest.
--
-- The fix for both is to stop treating a sale as one line paid one way:
--
--   receipt_id groups the lines a customer bought in one go
--   sale_payments holds the ways that receipt was settled, one row each
--   whatever is left unpaid is the deni, and it belongs to the receipt
--
-- A single-item cash sale is just the degenerate case: one line, one payment.
-- That keeps one code path rather than a simple one and a special one.

-- ---------------------------------------------------------------------------
-- Grouping
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS receipt_id UUID;

ALTER TABLE public.credit_sales
  ADD COLUMN IF NOT EXISTS receipt_id UUID;

-- Every sale ever recorded was its own receipt, so it can be its own id. After
-- this, receipt_id is never null and readers need no fallback.
UPDATE public.sales SET receipt_id = id WHERE receipt_id IS NULL;

UPDATE public.credit_sales AS cs
SET receipt_id = s.receipt_id
FROM public.sales AS s
WHERE cs.sale_id = s.id AND cs.receipt_id IS NULL;

ALTER TABLE public.sales
  ALTER COLUMN receipt_id SET DEFAULT gen_random_uuid();

ALTER TABLE public.sales
  ALTER COLUMN receipt_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS sales_receipt_idx ON public.sales (shop_id, receipt_id);
CREATE INDEX IF NOT EXISTS credit_sales_receipt_idx ON public.credit_sales (shop_id, receipt_id);

-- ---------------------------------------------------------------------------
-- How a receipt was settled
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_payments
  DROP CONSTRAINT IF EXISTS sale_payments_method_check;
ALTER TABLE public.sale_payments
  ADD CONSTRAINT sale_payments_method_check
  CHECK (payment_method IN ('cash', 'mpesa', 'airtel', 'other'));

CREATE INDEX IF NOT EXISTS sale_payments_receipt_idx
  ON public.sale_payments (shop_id, receipt_id);
CREATE INDEX IF NOT EXISTS sale_payments_method_idx
  ON public.sale_payments (shop_id, payment_method);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

-- Readable by the shop, written only by the RPC below. A client that could
-- insert here could claim money arrived that never did.
DROP POLICY IF EXISTS "Members can view sale payments" ON public.sale_payments;
CREATE POLICY "Members can view sale payments"
ON public.sale_payments
FOR SELECT
USING (public.is_shop_member(auth.uid(), shop_id));

-- Backfill: a paid sale already carries its own single payment. Sales on deni
-- have no method recorded, and neither do sales taken before payment methods
-- existed -- both are correctly left with no payment row, because in the second
-- case we genuinely do not know. Cancelled sales are skipped: this table is
-- money that actually arrived.
INSERT INTO public.sale_payments (shop_id, receipt_id, amount, payment_method, payment_reference, recorded_by, created_at)
SELECT s.shop_id, s.receipt_id, s.total_amount, s.payment_method, s.payment_reference, s.sold_by, s.created_at
FROM public.sales AS s
WHERE s.payment_method IS NOT NULL
  AND s.voided_at IS NULL
  AND s.total_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.sale_payments AS sp WHERE sp.receipt_id = s.receipt_id
  );

-- ---------------------------------------------------------------------------
-- Recording a basket
-- ---------------------------------------------------------------------------
-- p_lines     [{"product_id": uuid, "quantity": int, "unit_price": numeric|null}]
-- p_payments  [{"method": text, "amount": numeric, "reference": text|null}]
--
-- The caller states the deni portion rather than letting the function infer it
-- from a shortfall. A typo in an amount should be refused, not quietly turned
-- into a debt somebody has to chase.
DROP FUNCTION IF EXISTS public.record_basket_sale_atomic(UUID, JSONB, JSONB, UUID, NUMERIC);

CREATE OR REPLACE FUNCTION public.record_basket_sale_atomic(
  p_shop_id UUID,
  p_lines JSONB,
  p_payments JSONB DEFAULT '[]'::JSONB,
  p_customer_id UUID DEFAULT NULL,
  p_credit_amount NUMERIC DEFAULT 0
)
RETURNS TABLE (
  out_receipt_id UUID,
  out_line_count INTEGER,
  out_basket_total NUMERIC,
  out_paid_now NUMERIC,
  out_credit_amount NUMERIC,
  out_credit_sale_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt UUID := gen_random_uuid();
  v_item RECORD;
  v_pay RECORD;
  v_product RECORD;
  v_list_price NUMERIC;
  v_unit_price NUMERIC;
  v_source TEXT;
  v_total NUMERIC := 0;
  v_paid NUMERIC := 0;
  v_credit NUMERIC := COALESCE(p_credit_amount, 0);
  v_lines INTEGER := 0;
  v_first_sale UUID;
  v_new_sale UUID;
  v_first_name TEXT;
  v_label TEXT;
  v_units INTEGER := 0;
  v_credit_id UUID;
  v_can_override BOOLEAN;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'A sale needs at least one item';
  END IF;

  IF v_credit < 0 THEN
    RAISE EXCEPTION 'The deni amount cannot be negative';
  END IF;

  -- Resolved once rather than per line: it is the same answer every time, and
  -- the loop below can be long.
  v_can_override := public.member_can(auth.uid(), p_shop_id, 'override_price');

  -- Ordered by product so two tills ringing up the same two items in opposite
  -- order take their row locks in the same sequence and cannot deadlock.
  FOR v_item IN
    SELECT
      (elem->>'product_id')::UUID AS product_id,
      (elem->>'quantity')::INTEGER AS quantity,
      NULLIF(elem->>'unit_price', '')::NUMERIC AS unit_price
    FROM jsonb_array_elements(p_lines) AS elem
    ORDER BY 1
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    SELECT p.* INTO v_product
    FROM public.products AS p
    WHERE p.id = v_item.product_id AND p.shop_id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    IF COALESCE(v_product.stock_level, 0) < v_item.quantity THEN
      RAISE EXCEPTION 'Not enough % left. Only % in stock.', v_product.name, COALESCE(v_product.stock_level, 0);
    END IF;

    v_list_price := COALESCE(v_product.price, 0);

    IF v_item.unit_price IS NULL OR v_item.unit_price = v_list_price THEN
      v_unit_price := v_list_price;
      v_source := 'list';
    ELSE
      IF v_item.unit_price < 0 THEN
        RAISE EXCEPTION 'Price cannot be negative';
      END IF;
      IF NOT v_can_override THEN
        RAISE EXCEPTION 'You are not allowed to change the price on a sale';
      END IF;
      IF v_product.min_price IS NOT NULL AND v_item.unit_price < v_product.min_price THEN
        RAISE EXCEPTION 'Price % is below the minimum of % for %',
          v_item.unit_price, v_product.min_price, v_product.name;
      END IF;
      IF v_product.max_price IS NOT NULL AND v_item.unit_price > v_product.max_price THEN
        RAISE EXCEPTION 'Price % is above the maximum of % for %',
          v_item.unit_price, v_product.max_price, v_product.name;
      END IF;
      v_unit_price := v_item.unit_price;
      v_source := 'override';
    END IF;

    INSERT INTO public.sales (
      shop_id, receipt_id, product_id, product_name, quantity, total_amount,
      cost_price_at_sale, unit_price, list_price_at_sale, price_source, sold_by
    )
    VALUES (
      p_shop_id, v_receipt, v_item.product_id, v_product.name, v_item.quantity,
      v_unit_price * v_item.quantity, COALESCE(v_product.cost_price, 0),
      v_unit_price, v_list_price, v_source, auth.uid()
    )
    RETURNING id INTO v_new_sale;

    UPDATE public.products AS p
    SET stock_level = COALESCE(p.stock_level, 0) - v_item.quantity
    WHERE p.id = v_item.product_id;

    v_total := v_total + (v_unit_price * v_item.quantity);
    v_units := v_units + v_item.quantity;
    v_lines := v_lines + 1;

    -- Held for credit_sales.sale_id, which predates receipts and still expects
    -- to point at a single row.
    IF v_first_sale IS NULL THEN
      v_first_sale := v_new_sale;
      v_first_name := v_product.name;
    END IF;
  END LOOP;

  -- Payments
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' THEN
    FOR v_pay IN
      SELECT
        NULLIF(trim(COALESCE(elem->>'method', '')), '') AS method,
        (elem->>'amount')::NUMERIC AS amount,
        NULLIF(trim(COALESCE(elem->>'reference', '')), '') AS reference
      FROM jsonb_array_elements(p_payments) AS elem
    LOOP
      IF v_pay.amount IS NULL OR v_pay.amount <= 0 THEN
        RAISE EXCEPTION 'Every payment must be more than zero';
      END IF;
      IF v_pay.method IS NULL OR v_pay.method NOT IN ('cash', 'mpesa', 'airtel', 'other') THEN
        RAISE EXCEPTION 'Unknown payment method: %', COALESCE(v_pay.method, 'none given');
      END IF;

      INSERT INTO public.sale_payments (
        shop_id, receipt_id, amount, payment_method, payment_reference, recorded_by
      )
      VALUES (p_shop_id, v_receipt, v_pay.amount, v_pay.method, v_pay.reference, auth.uid());

      v_paid := v_paid + v_pay.amount;
    END LOOP;
  END IF;

  -- The invariant that keeps a half-recorded sale out of the books. Rounded to
  -- cents because the client works in floating point and 300.00000000000006 is
  -- not a real disagreement.
  IF round(v_paid + v_credit, 2) <> round(v_total, 2) THEN
    RAISE EXCEPTION 'The payments come to % and the deni to %, but the items come to %',
      round(v_paid, 2), round(v_credit, 2), round(v_total, 2);
  END IF;

  IF v_credit > 0 THEN
    IF p_customer_id IS NULL THEN
      RAISE EXCEPTION 'Say who is taking the balance on deni';
    END IF;

    PERFORM 1 FROM public.customers AS c
    WHERE c.id = p_customer_id AND c.shop_id = p_shop_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer not found';
    END IF;

    -- One debt for the whole basket, which is how a shopkeeper remembers it:
    -- "Mama Njeri owes 450 from Tuesday", not a debt per tin of tomatoes.
    v_label := CASE
      WHEN v_lines = 1 THEN v_first_name
      ELSE v_first_name || ' and ' || (v_lines - 1) || ' more'
    END;

    INSERT INTO public.credit_sales (
      shop_id, customer_id, sale_id, receipt_id, product_name, quantity, amount, status
    )
    VALUES (
      p_shop_id, p_customer_id, v_first_sale, v_receipt, v_label, v_units, v_credit, 'pending'
    )
    RETURNING id INTO v_credit_id;
  END IF;

  RETURN QUERY SELECT v_receipt, v_lines, v_total, v_paid, v_credit, v_credit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_basket_sale_atomic(UUID, JSONB, JSONB, UUID, NUMERIC) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cancelling
-- ---------------------------------------------------------------------------
-- Cancelling now works on the whole receipt. Undoing one line of a basket would
-- leave the payments describing a total that no longer exists, and there is no
-- honest way to decide which part of a single M-Pesa payment to reverse.
DROP FUNCTION IF EXISTS public.void_sale_atomic(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.void_sale_atomic(
  p_shop_id UUID,
  p_sale_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  voided_receipt_id UUID,
  voided_lines INTEGER,
  voided_amount NUMERIC,
  voided_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_line RECORD;
  v_credit RECORD;
  v_receipt UUID;
  v_lines INTEGER := 0;
  v_amount NUMERIC := 0;
  v_is_owner BOOLEAN;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  SELECT s.* INTO v_sale
  FROM public.sales AS s
  WHERE s.id = p_sale_id AND s.shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  IF v_sale.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'This sale was already cancelled';
  END IF;

  v_receipt := v_sale.receipt_id;
  v_is_owner := public.is_shop_owner(auth.uid(), p_shop_id);

  IF NOT v_is_owner THEN
    IF v_sale.sold_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'You can only cancel a sale you recorded yourself';
    END IF;
    IF v_sale.created_at < now() - interval '12 hours' THEN
      RAISE EXCEPTION 'Too late to cancel this one. Ask the owner.';
    END IF;
  END IF;

  SELECT cs.* INTO v_credit
  FROM public.credit_sales AS cs
  WHERE cs.shop_id = p_shop_id
    AND (cs.receipt_id = v_receipt OR cs.sale_id = p_sale_id)
  LIMIT 1;

  IF FOUND THEN
    IF COALESCE(v_credit.amount_paid, 0) > 0 THEN
      RAISE EXCEPTION 'This sale is on deni and has already been part paid. Settle it in the credit book instead.';
    END IF;
    DELETE FROM public.credit_sales AS cs WHERE cs.id = v_credit.id;
  END IF;

  FOR v_line IN
    SELECT s.id, s.product_id, s.quantity, s.total_amount
    FROM public.sales AS s
    WHERE s.shop_id = p_shop_id AND s.receipt_id = v_receipt AND s.voided_at IS NULL
    ORDER BY s.product_id
    FOR UPDATE
  LOOP
    IF v_line.product_id IS NOT NULL THEN
      UPDATE public.products AS p
      SET stock_level = COALESCE(p.stock_level, 0) + v_line.quantity
      WHERE p.id = v_line.product_id;
    END IF;

    v_lines := v_lines + 1;
    v_amount := v_amount + COALESCE(v_line.total_amount, 0);
  END LOOP;

  UPDATE public.sales AS s
  SET voided_at = now(),
      voided_by = auth.uid(),
      void_reason = NULLIF(trim(COALESCE(p_reason, '')), '')
  WHERE s.shop_id = p_shop_id AND s.receipt_id = v_receipt AND s.voided_at IS NULL;

  -- sale_payments is money that actually arrived, so a cancelled receipt has
  -- none. Deleting keeps every reader from having to filter for voided sales.
  DELETE FROM public.sale_payments AS sp
  WHERE sp.shop_id = p_shop_id AND sp.receipt_id = v_receipt;

  RETURN QUERY SELECT v_receipt, v_lines, v_amount, now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_sale_atomic(UUID, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- M-Pesa matching follows the codes
-- ---------------------------------------------------------------------------
-- Transaction codes used to live on the sale. They now live on the payment,
-- because a receipt settled by two M-Pesa transfers has two codes and a column
-- can hold one. The old column is still checked so that everything recorded
-- before today keeps reconciling.
CREATE OR REPLACE FUNCTION public.import_mpesa_entries_atomic(
  p_shop_id UUID,
  p_entries JSONB
)
RETURNS TABLE (
  import_id UUID,
  entries_seen INTEGER,
  entries_new INTEGER,
  matched INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_import_id UUID;
  v_entry JSONB;
  v_code TEXT;
  v_amount NUMERIC;
  v_paid_at TIMESTAMPTZ;
  v_direction TEXT;
  v_sale_id UUID;
  v_payment_id UUID;
  v_seen INTEGER := 0;
  v_new INTEGER := 0;
  v_matched INTEGER := 0;
  v_was_new BOOLEAN;
BEGIN
  IF NOT public.is_shop_owner(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Only the shop owner can check M-Pesa records';
  END IF;

  IF p_entries IS NULL OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'Nothing to check';
  END IF;

  INSERT INTO public.mpesa_imports (shop_id, imported_by)
  VALUES (p_shop_id, auth.uid())
  RETURNING mpesa_imports.id INTO v_import_id;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_code := upper(trim(v_entry ->> 'code'));
    CONTINUE WHEN v_code IS NULL OR v_code = '';

    v_seen := v_seen + 1;
    v_amount := COALESCE((v_entry ->> 'amount')::NUMERIC, 0);
    v_paid_at := NULLIF(v_entry ->> 'paid_at', '')::TIMESTAMPTZ;
    v_direction := COALESCE(NULLIF(v_entry ->> 'direction', ''), 'in');

    v_sale_id := NULL;
    v_payment_id := NULL;

    IF v_direction = 'in' THEN
      -- A payment row carries a receipt, so resolve back to one of its sales:
      -- mpesa_entries points at a sale, and every reader expects that.
      SELECT s.id INTO v_sale_id
      FROM public.sale_payments AS sp
      JOIN public.sales AS s
        ON s.receipt_id = sp.receipt_id AND s.shop_id = sp.shop_id
      WHERE sp.shop_id = p_shop_id
        AND upper(sp.payment_reference) = v_code
        AND s.voided_at IS NULL
      LIMIT 1;

      IF v_sale_id IS NULL THEN
        SELECT s.id INTO v_sale_id
        FROM public.sales AS s
        WHERE s.shop_id = p_shop_id
          AND s.voided_at IS NULL
          AND upper(s.payment_reference) = v_code
        LIMIT 1;
      END IF;

      IF v_sale_id IS NULL THEN
        SELECT cp.id INTO v_payment_id
        FROM public.credit_payments AS cp
        WHERE cp.shop_id = p_shop_id
          AND upper(cp.payment_reference) = v_code
        LIMIT 1;
      END IF;
    END IF;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.mpesa_entries AS me
      WHERE me.shop_id = p_shop_id AND me.code = v_code
    ) INTO v_was_new;

    INSERT INTO public.mpesa_entries AS me (
      shop_id, import_id, code, amount, paid_at, counterparty,
      direction, raw_text, matched_sale_id, matched_credit_payment_id
    ) VALUES (
      p_shop_id, v_import_id, v_code, v_amount, v_paid_at,
      NULLIF(trim(v_entry ->> 'counterparty'), ''),
      v_direction, NULLIF(trim(v_entry ->> 'raw_text'), ''),
      v_sale_id, v_payment_id
    )
    ON CONFLICT (shop_id, code) DO UPDATE
    SET amount = EXCLUDED.amount,
        paid_at = COALESCE(EXCLUDED.paid_at, me.paid_at),
        counterparty = COALESCE(EXCLUDED.counterparty, me.counterparty),
        matched_sale_id = COALESCE(EXCLUDED.matched_sale_id, me.matched_sale_id),
        matched_credit_payment_id = COALESCE(EXCLUDED.matched_credit_payment_id, me.matched_credit_payment_id);

    IF v_was_new THEN
      v_new := v_new + 1;
    END IF;
    IF v_sale_id IS NOT NULL OR v_payment_id IS NOT NULL THEN
      v_matched := v_matched + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_import_id, v_seen, v_new, v_matched;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_mpesa_entries_atomic(UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- The single-item path is gone
-- ---------------------------------------------------------------------------
-- record_basket_sale_atomic covers a one-item sale as its smallest case, and the
-- app no longer calls this. Left in place it would stay callable over PostgREST
-- and could write a sale with no matching payment row -- takings that reports
-- would then have to describe as "not recorded".
DROP FUNCTION IF EXISTS public.record_product_sale_atomic(UUID, UUID, INTEGER, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.record_product_sale_atomic(UUID, UUID, INTEGER, NUMERIC);
