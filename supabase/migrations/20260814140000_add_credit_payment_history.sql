-- Credit repayments were only ever a running total on credit_sales.amount_paid,
-- so there was no record of WHEN money came in and no report could show it.
-- "Who paid me today" was unanswerable. This gives repayments a dated history.

CREATE TABLE IF NOT EXISTS public.credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  credit_sale_id UUID NOT NULL REFERENCES public.credit_sales(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_payments_shop_paid_at_idx
  ON public.credit_payments (shop_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS credit_payments_credit_sale_idx
  ON public.credit_payments (credit_sale_id);

ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

-- Read-only to clients on purpose. There is deliberately no INSERT/UPDATE/DELETE
-- policy: every write goes through record_credit_payment_atomic below, so the
-- payment history and credit_sales.amount_paid can never drift apart.
DROP POLICY IF EXISTS "Members can view credit payments" ON public.credit_payments;
CREATE POLICY "Members can view credit payments"
ON public.credit_payments
FOR SELECT
USING (public.is_shop_member(auth.uid(), shop_id));

-- ---------------------------------------------------------------------------
-- Backfill, so sum(payments) reconciles with amount_paid from day one.
-- ---------------------------------------------------------------------------
-- The true payment dates are unrecoverable. Dating these to the credit sale
-- itself keeps totals correct and avoids inventing a spike of income on the day
-- this migration runs -- but it does mean old repayments appear on the sale date.
INSERT INTO public.credit_payments (shop_id, credit_sale_id, customer_id, amount, paid_at, notes)
SELECT
  cs.shop_id,
  cs.id,
  cs.customer_id,
  cs.amount_paid,
  cs.created_at,
  'Backfilled: recorded before payment history existed; exact date unknown'
FROM public.credit_sales cs
WHERE COALESCE(cs.amount_paid, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.credit_payments cp WHERE cp.credit_sale_id = cs.id
  );

-- ---------------------------------------------------------------------------
-- Atomic repayment
-- ---------------------------------------------------------------------------
-- Also fixes two bugs in the old client-side version: it read the balance from
-- React state, so two devices collecting at once would overwrite each other, and
-- it never checked that the payment was not larger than the debt.
CREATE OR REPLACE FUNCTION public.record_credit_payment_atomic(
  p_shop_id UUID,
  p_credit_sale_id UUID,
  p_amount NUMERIC,
  p_paid_at TIMESTAMPTZ DEFAULT now(),
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  credit_sale_id UUID,
  customer_id UUID,
  amount NUMERIC,
  paid_at TIMESTAMPTZ,
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
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment must be greater than zero';
  END IF;

  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  SELECT cs.*
  INTO v_credit
  FROM public.credit_sales AS cs
  WHERE cs.id = p_credit_sale_id
    AND cs.shop_id = p_shop_id
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
  SET amount_paid = v_new_paid,
      status = v_new_status
  WHERE cs.id = p_credit_sale_id;

  INSERT INTO public.credit_payments (
    shop_id,
    credit_sale_id,
    customer_id,
    amount,
    paid_at,
    notes,
    recorded_by
  )
  VALUES (
    p_shop_id,
    p_credit_sale_id,
    v_credit.customer_id,
    p_amount,
    COALESCE(p_paid_at, now()),
    NULLIF(trim(p_notes), ''),
    auth.uid()
  )
  RETURNING *
  INTO v_payment;

  RETURN QUERY
  SELECT
    v_payment.id,
    v_payment.credit_sale_id,
    v_payment.customer_id,
    v_payment.amount,
    v_payment.paid_at,
    v_new_paid,
    COALESCE(v_credit.amount, 0) - v_new_paid,
    v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_credit_payment_atomic(UUID, UUID, NUMERIC, TIMESTAMPTZ, TEXT) TO authenticated;
