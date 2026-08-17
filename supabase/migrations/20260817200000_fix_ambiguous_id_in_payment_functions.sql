-- Fix: "column reference \"id\" is ambiguous" when paying a supplier.
--
-- record_supplier_payment_atomic declares an OUT parameter called `id`, and the
-- body then ran `RETURNING id INTO v_expense_id`. Postgres cannot tell whether
-- that `id` is the expenses column or the output parameter, so the whole call
-- fails and rolls back -- which is why no payment was ever recorded.
--
-- Same trap as the 2026-02-23 ambiguous-id fix on the sale function. The durable
-- answer is to stop naming output parameters after columns, so both functions
-- below are renamed rather than merely qualified. Nothing reads these return
-- values, so the rename is safe.

DROP FUNCTION IF EXISTS public.record_supplier_payment_atomic(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.record_supplier_payment_atomic(
  p_shop_id UUID,
  p_debt_id UUID,
  p_amount NUMERIC,
  p_paid_at TIMESTAMPTZ DEFAULT now(),
  p_payment_method TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS TABLE (
  payment_id UUID,
  debt_id UUID,
  paid_amount NUMERIC,
  new_amount_paid NUMERIC,
  new_balance NUMERIC,
  new_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debt RECORD;
  v_supplier RECORD;
  v_balance NUMERIC;
  v_new_paid NUMERIC;
  v_new_status TEXT;
  v_method TEXT;
  v_expense_id UUID;
  v_payment_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment must be greater than zero';
  END IF;

  IF NOT public.is_shop_owner(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Only owners can pay suppliers';
  END IF;

  v_method := NULLIF(trim(COALESCE(p_payment_method, '')), '');
  IF v_method IS NOT NULL AND v_method NOT IN ('cash', 'mpesa', 'airtel', 'other') THEN
    RAISE EXCEPTION 'Unknown payment method: %', v_method;
  END IF;

  SELECT sd.* INTO v_debt
  FROM public.supplier_debts AS sd
  WHERE sd.id = p_debt_id AND sd.shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That debt was not found';
  END IF;

  v_balance := v_debt.amount - COALESCE(v_debt.amount_paid, 0);

  IF v_balance <= 0 THEN
    RAISE EXCEPTION 'This one is already settled';
  END IF;

  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Payment of % is more than the % still owed', p_amount, v_balance;
  END IF;

  SELECT s.* INTO v_supplier FROM public.suppliers AS s WHERE s.id = v_debt.supplier_id;

  v_new_paid := COALESCE(v_debt.amount_paid, 0) + p_amount;
  v_new_status := CASE WHEN v_new_paid >= v_debt.amount THEN 'paid' ELSE 'partially_paid' END;

  UPDATE public.supplier_debts AS sd
  SET amount_paid = v_new_paid, status = v_new_status
  WHERE sd.id = p_debt_id;

  -- Source 'restock' keeps this out of operating expenses, where it would
  -- double-count against COGS. It is stock money, just paid later.
  INSERT INTO public.expenses AS e (
    shop_id, category, description, amount, date,
    expense_type, recurrence_unit, allocation_mode, source, payment_method
  ) VALUES (
    p_shop_id, 'Stock Purchase',
    CONCAT('Paid ', COALESCE(v_supplier.name, 'supplier'), ': ', v_debt.description),
    p_amount, (COALESCE(p_paid_at, now()))::date,
    'variable', 'none', 'cash', 'restock', v_method
  )
  RETURNING e.id INTO v_expense_id;

  INSERT INTO public.supplier_payments AS sp (
    shop_id, supplier_debt_id, supplier_id, amount, paid_at,
    payment_method, payment_reference, expense_id, recorded_by
  ) VALUES (
    p_shop_id, p_debt_id, v_debt.supplier_id, p_amount, COALESCE(p_paid_at, now()),
    v_method, NULLIF(trim(COALESCE(p_payment_reference, '')), ''), v_expense_id, auth.uid()
  )
  RETURNING sp.id INTO v_payment_id;

  RETURN QUERY
  SELECT v_payment_id, p_debt_id, p_amount,
         v_new_paid, v_debt.amount - v_new_paid, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_supplier_payment_atomic(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- The same latent trap in void_sale_atomic
-- ---------------------------------------------------------------------------
-- Its OUT parameter is also called `id`, and the body deletes a credit record
-- with an unqualified `WHERE id = ...`. That path only runs when the cancelled
-- sale was on deni, which is presumably why it has not been hit yet.
DROP FUNCTION IF EXISTS public.void_sale_atomic(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.void_sale_atomic(
  p_shop_id UUID,
  p_sale_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  voided_sale_id UUID,
  voided_product_id UUID,
  voided_quantity INTEGER,
  restored_stock INTEGER,
  voided_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_credit RECORD;
  v_new_stock INTEGER;
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
  WHERE cs.sale_id = p_sale_id
  LIMIT 1;

  IF FOUND THEN
    IF COALESCE(v_credit.amount_paid, 0) > 0 THEN
      RAISE EXCEPTION 'This sale is on deni and has already been part paid. Settle it in the credit book instead.';
    END IF;
    DELETE FROM public.credit_sales AS cs WHERE cs.id = v_credit.id;
  END IF;

  IF v_sale.product_id IS NOT NULL THEN
    UPDATE public.products AS p
    SET stock_level = COALESCE(p.stock_level, 0) + v_sale.quantity
    WHERE p.id = v_sale.product_id
    RETURNING p.stock_level INTO v_new_stock;
  END IF;

  UPDATE public.sales AS s
  SET voided_at = now(),
      voided_by = auth.uid(),
      void_reason = NULLIF(trim(COALESCE(p_reason, '')), '')
  WHERE s.id = p_sale_id;

  RETURN QUERY
  SELECT v_sale.id, v_sale.product_id, v_sale.quantity, COALESCE(v_new_stock, 0), now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_sale_atomic(UUID, UUID, TEXT) TO authenticated;
