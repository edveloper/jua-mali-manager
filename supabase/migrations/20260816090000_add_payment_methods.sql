-- How money actually arrived.
--
-- The app previously offered "Cash" or "Credit", which answered two different
-- questions with one control: whether a sale was paid, and how. Anything paid by
-- M-Pesa was therefore recorded as cash, and the till could never be balanced.
--
-- NULL means "not recorded" -- every sale taken before today. Reports must say
-- so rather than quietly counting it as cash.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

ALTER TABLE public.credit_payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales', 'credit_payments', 'expenses'] LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_payment_method_check');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (payment_method IS NULL OR payment_method IN (''cash'', ''mpesa'', ''airtel'', ''other''))',
      t, t || '_payment_method_check'
    );
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS sales_shop_payment_method_idx
  ON public.sales (shop_id, payment_method);

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------
-- Dropped first: adding defaulted parameters to a plpgsql function creates an
-- overload rather than replacing it, and PostgREST then cannot choose.
DROP FUNCTION IF EXISTS public.record_product_sale_atomic(UUID, UUID, INTEGER, NUMERIC);

CREATE OR REPLACE FUNCTION public.record_product_sale_atomic(
  p_shop_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_price NUMERIC DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  product_name TEXT,
  quantity INTEGER,
  total_amount NUMERIC,
  cost_price_at_sale NUMERIC,
  unit_price NUMERIC,
  list_price_at_sale NUMERIC,
  price_source TEXT,
  payment_method TEXT,
  sold_by UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_sale RECORD;
  v_list_price NUMERIC;
  v_unit_price NUMERIC;
  v_source TEXT;
  v_method TEXT;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  v_method := NULLIF(trim(COALESCE(p_payment_method, '')), '');
  IF v_method IS NOT NULL AND v_method NOT IN ('cash', 'mpesa', 'airtel', 'other') THEN
    RAISE EXCEPTION 'Unknown payment method: %', v_method;
  END IF;

  SELECT p.*
  INTO v_product
  FROM public.products AS p
  WHERE p.id = p_product_id AND p.shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF COALESCE(v_product.stock_level, 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  v_list_price := COALESCE(v_product.price, 0);

  IF p_unit_price IS NULL OR p_unit_price = v_list_price THEN
    v_unit_price := v_list_price;
    v_source := 'list';
  ELSE
    IF p_unit_price < 0 THEN
      RAISE EXCEPTION 'Price cannot be negative';
    END IF;

    IF NOT public.member_can(auth.uid(), p_shop_id, 'override_price') THEN
      RAISE EXCEPTION 'You are not allowed to change the price on a sale';
    END IF;

    IF v_product.min_price IS NOT NULL AND p_unit_price < v_product.min_price THEN
      RAISE EXCEPTION 'Price % is below the minimum of % for this item',
        p_unit_price, v_product.min_price;
    END IF;

    IF v_product.max_price IS NOT NULL AND p_unit_price > v_product.max_price THEN
      RAISE EXCEPTION 'Price % is above the maximum of % for this item',
        p_unit_price, v_product.max_price;
    END IF;

    v_unit_price := p_unit_price;
    v_source := 'override';
  END IF;

  INSERT INTO public.sales (
    shop_id, product_id, product_name, quantity, total_amount,
    cost_price_at_sale, unit_price, list_price_at_sale, price_source,
    payment_method, payment_reference, sold_by
  )
  VALUES (
    p_shop_id, p_product_id, v_product.name, p_quantity, v_unit_price * p_quantity,
    COALESCE(v_product.cost_price, 0), v_unit_price, v_list_price, v_source,
    v_method, NULLIF(trim(COALESCE(p_payment_reference, '')), ''), auth.uid()
  )
  RETURNING *
  INTO v_sale;

  UPDATE public.products AS p
  SET stock_level = COALESCE(p.stock_level, 0) - p_quantity
  WHERE p.id = p_product_id;

  RETURN QUERY
  SELECT
    v_sale.id, v_sale.product_id, v_sale.product_name, v_sale.quantity,
    v_sale.total_amount, v_sale.cost_price_at_sale, v_sale.unit_price,
    v_sale.list_price_at_sale, v_sale.price_source, v_sale.payment_method,
    v_sale.sold_by, v_sale.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_product_sale_atomic(UUID, UUID, INTEGER, NUMERIC, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Credit repayments
-- ---------------------------------------------------------------------------
-- A debt settled by M-Pesa is not cash in the till either.
DROP FUNCTION IF EXISTS public.record_credit_payment_atomic(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.record_credit_payment_atomic(
  p_shop_id UUID,
  p_credit_sale_id UUID,
  p_amount NUMERIC,
  p_paid_at TIMESTAMPTZ DEFAULT now(),
  p_notes TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  credit_sale_id UUID,
  customer_id UUID,
  amount NUMERIC,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  new_amount_paid NUMERIC,
  new_balance NUMERIC,
  new_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit RECORD;
  v_payment RECORD;
  v_already_paid NUMERIC;
  v_balance NUMERIC;
  v_new_paid NUMERIC;
  v_new_status TEXT;
  v_method TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment must be greater than zero';
  END IF;

  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  v_method := NULLIF(trim(COALESCE(p_payment_method, '')), '');
  IF v_method IS NOT NULL AND v_method NOT IN ('cash', 'mpesa', 'airtel', 'other') THEN
    RAISE EXCEPTION 'Unknown payment method: %', v_method;
  END IF;

  SELECT cs.*
  INTO v_credit
  FROM public.credit_sales AS cs
  WHERE cs.id = p_credit_sale_id AND cs.shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit record not found';
  END IF;

  v_already_paid := COALESCE(v_credit.amount_paid, 0);
  v_balance := COALESCE(v_credit.amount, 0) - v_already_paid;

  IF v_balance <= 0 THEN
    RAISE EXCEPTION 'This debt is already cleared';
  END IF;

  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Payment of % is more than the % still owed', p_amount, v_balance;
  END IF;

  v_new_paid := v_already_paid + p_amount;
  v_new_status := CASE
    WHEN v_new_paid >= COALESCE(v_credit.amount, 0) THEN 'paid'
    ELSE 'partially_paid'
  END;

  UPDATE public.credit_sales AS cs
  SET amount_paid = v_new_paid, status = v_new_status
  WHERE cs.id = p_credit_sale_id;

  INSERT INTO public.credit_payments (
    shop_id, credit_sale_id, customer_id, amount, paid_at,
    notes, payment_method, payment_reference, recorded_by
  )
  VALUES (
    p_shop_id, p_credit_sale_id, v_credit.customer_id, p_amount,
    COALESCE(p_paid_at, now()), NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_method, NULLIF(trim(COALESCE(p_payment_reference, '')), ''), auth.uid()
  )
  RETURNING *
  INTO v_payment;

  RETURN QUERY
  SELECT
    v_payment.id, v_payment.credit_sale_id, v_payment.customer_id,
    v_payment.amount, v_payment.paid_at, v_payment.payment_method,
    v_new_paid, COALESCE(v_credit.amount, 0) - v_new_paid, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_credit_payment_atomic(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;
