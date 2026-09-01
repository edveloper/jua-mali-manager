-- Cheques.
--
-- A cheque is a promise, not money. That single fact is what this table exists
-- to keep straight.
--
-- Recording one as an ordinary payment on the day it arrives overstates the day
-- twice over: the takings count money that is not there yet, and the customer's
-- debt is written off before they have actually settled it. If the cheque then
-- bounces there is nothing on the record saying it ever existed, and the debt
-- has to be recreated from memory.
--
-- So a cheque is held. It sits against the debt, visible, reducing nothing.
-- Clearing it is what turns it into a payment, at which point it becomes an
-- ordinary credit_payment with method 'cheque' and every existing report picks
-- it up without knowing anything about cheques at all.
--
-- Deliberately not a sale payment method. A cheque handed over at the counter is
-- a sale on deni that happens to come with a promise attached, which is what it
-- actually is, and modelling it that way keeps sale_payments meaning "money that
-- arrived" rather than "money that might".

-- ---------------------------------------------------------------------------
-- 'cheque' becomes a payment method everywhere a payment is recorded
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales', 'credit_payments', 'expenses'] LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_payment_method_check');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (payment_method IS NULL OR payment_method IN (''cash'', ''mpesa'', ''airtel'', ''cheque'', ''other''))',
      t, t || '_payment_method_check'
    );
  END LOOP;
END $$;

ALTER TABLE public.supplier_payments
  DROP CONSTRAINT IF EXISTS supplier_payments_payment_method_check;
ALTER TABLE public.supplier_payments
  ADD CONSTRAINT supplier_payments_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('cash', 'mpesa', 'airtel', 'cheque', 'other'));

-- sale_payments stays as it was, on purpose. Money that arrived at the till is
-- cash, phone money or something else immediate. A cheque is never that.

-- ---------------------------------------------------------------------------
-- The cheques themselves
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cheques (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  credit_sale_id UUID NOT NULL REFERENCES public.credit_sales(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,

  cheque_number TEXT NOT NULL,
  bank TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),

  received_on DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_clear_on DATE,

  status TEXT NOT NULL DEFAULT 'held',
  cleared_on DATE,
  bounced_reason TEXT,

  -- Set when it clears. The link is what stops a cleared cheque being counted
  -- once as a cheque and again as the payment it became.
  credit_payment_id UUID REFERENCES public.credit_payments(id) ON DELETE SET NULL,

  recorded_by UUID,
  settled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cheques DROP CONSTRAINT IF EXISTS cheques_status_check;
ALTER TABLE public.cheques
  ADD CONSTRAINT cheques_status_check
  CHECK (status IN ('held', 'cleared', 'bounced'));

CREATE INDEX IF NOT EXISTS cheques_shop_idx ON public.cheques (shop_id, status, expected_clear_on);
CREATE INDEX IF NOT EXISTS cheques_credit_idx ON public.cheques (credit_sale_id);

ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view cheques" ON public.cheques;
CREATE POLICY "Members can view cheques"
ON public.cheques
FOR SELECT
USING (public.is_shop_member(auth.uid(), shop_id));

-- Written only by the functions below: clearing one has to create a payment in
-- the same transaction, and a client that could update this table directly
-- could mark a cheque cleared without the money ever being recorded.

-- ---------------------------------------------------------------------------
-- Taking one in
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_cheque_atomic(UUID, UUID, NUMERIC, TEXT, TEXT, DATE, DATE);

CREATE OR REPLACE FUNCTION public.record_cheque_atomic(
  p_shop_id UUID,
  p_credit_sale_id UUID,
  p_amount NUMERIC,
  p_cheque_number TEXT,
  p_bank TEXT DEFAULT NULL,
  p_received_on DATE DEFAULT CURRENT_DATE,
  p_expected_clear_on DATE DEFAULT NULL
)
RETURNS TABLE (
  out_cheque_id UUID,
  out_amount NUMERIC,
  out_still_owed NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit RECORD;
  v_balance NUMERIC;
  v_held NUMERIC;
  v_id UUID;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'A cheque must be for more than zero';
  END IF;

  IF NULLIF(trim(COALESCE(p_cheque_number, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Write down the cheque number. Without it there is nothing to chase.';
  END IF;

  SELECT * INTO v_credit
  FROM public.credit_sales
  WHERE id = p_credit_sale_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit record not found';
  END IF;

  v_balance := COALESCE(v_credit.amount, 0) - COALESCE(v_credit.amount_paid, 0);

  -- Cheques already sitting against this debt count towards it, or the same
  -- debt could be covered twice over by promises.
  SELECT COALESCE(SUM(amount), 0) INTO v_held
  FROM public.cheques
  WHERE credit_sale_id = p_credit_sale_id AND status = 'held';

  IF p_amount > (v_balance - v_held) THEN
    RAISE EXCEPTION 'That is more than the % still owed once cheques already held are counted',
      round(v_balance - v_held, 2);
  END IF;

  INSERT INTO public.cheques (
    shop_id, credit_sale_id, customer_id, cheque_number, bank, amount,
    received_on, expected_clear_on, recorded_by
  )
  VALUES (
    p_shop_id, p_credit_sale_id, v_credit.customer_id,
    trim(p_cheque_number), NULLIF(trim(COALESCE(p_bank, '')), ''), p_amount,
    COALESCE(p_received_on, CURRENT_DATE), p_expected_clear_on, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, p_amount, v_balance - v_held - p_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_cheque_atomic(UUID, UUID, NUMERIC, TEXT, TEXT, DATE, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- Clearing one
-- ---------------------------------------------------------------------------
-- This is the moment the promise becomes money. The payment and the status
-- change are written together so a cheque can never be marked cleared without
-- the money appearing, or the money appear twice from one cheque.
DROP FUNCTION IF EXISTS public.clear_cheque_atomic(UUID, UUID, DATE);

CREATE OR REPLACE FUNCTION public.clear_cheque_atomic(
  p_shop_id UUID,
  p_cheque_id UUID,
  p_cleared_on DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  out_cheque_id UUID,
  out_payment_id UUID,
  out_new_balance NUMERIC,
  out_new_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cheque RECORD;
  v_credit RECORD;
  v_new_paid NUMERIC;
  v_new_status TEXT;
  v_payment_id UUID;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  SELECT * INTO v_cheque
  FROM public.cheques
  WHERE id = p_cheque_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found';
  END IF;

  IF v_cheque.status <> 'held' THEN
    RAISE EXCEPTION 'This cheque has already been marked %', v_cheque.status;
  END IF;

  SELECT * INTO v_credit
  FROM public.credit_sales
  WHERE id = v_cheque.credit_sale_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit record not found';
  END IF;

  v_new_paid := COALESCE(v_credit.amount_paid, 0) + v_cheque.amount;

  IF v_new_paid > COALESCE(v_credit.amount, 0) + 0.01 THEN
    RAISE EXCEPTION 'Clearing this would pay more than the % owed', COALESCE(v_credit.amount, 0);
  END IF;

  v_new_status := CASE
    WHEN v_new_paid >= COALESCE(v_credit.amount, 0) THEN 'paid'
    ELSE 'partially_paid'
  END;

  UPDATE public.credit_sales
  SET amount_paid = v_new_paid, status = v_new_status
  WHERE id = v_credit.id;

  -- An ordinary payment from here on. Every existing report picks it up without
  -- needing to know a cheque was involved.
  INSERT INTO public.credit_payments (
    shop_id, credit_sale_id, customer_id, amount, paid_at,
    notes, payment_method, payment_reference, recorded_by
  )
  VALUES (
    p_shop_id, v_credit.id, v_credit.customer_id, v_cheque.amount,
    COALESCE(p_cleared_on, CURRENT_DATE)::TIMESTAMPTZ,
    'Cheque ' || v_cheque.cheque_number || ' cleared',
    'cheque', v_cheque.cheque_number, auth.uid()
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.cheques
  SET status = 'cleared',
      cleared_on = COALESCE(p_cleared_on, CURRENT_DATE),
      credit_payment_id = v_payment_id,
      settled_by = auth.uid()
  WHERE id = v_cheque.id;

  RETURN QUERY SELECT v_cheque.id, v_payment_id,
                      COALESCE(v_credit.amount, 0) - v_new_paid, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_cheque_atomic(UUID, UUID, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- When it bounces
-- ---------------------------------------------------------------------------
-- Nothing financial changes, because nothing financial ever happened. The debt
-- was never reduced, so it is still there and still correct. What changes is the
-- record: the shop now knows this customer's cheque did not clear, which is
-- worth more than the money on it.
DROP FUNCTION IF EXISTS public.bounce_cheque_atomic(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.bounce_cheque_atomic(
  p_shop_id UUID,
  p_cheque_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (out_cheque_id UUID, out_amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cheque RECORD;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  SELECT * INTO v_cheque
  FROM public.cheques
  WHERE id = p_cheque_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cheque not found';
  END IF;

  IF v_cheque.status = 'cleared' THEN
    RAISE EXCEPTION 'This cheque already cleared. Record the money coming back out as spending instead.';
  END IF;

  IF v_cheque.status = 'bounced' THEN
    RAISE EXCEPTION 'This cheque is already marked bounced';
  END IF;

  UPDATE public.cheques
  SET status = 'bounced',
      bounced_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
      settled_by = auth.uid()
  WHERE id = v_cheque.id;

  RETURN QUERY SELECT v_cheque.id, v_cheque.amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bounce_cheque_atomic(UUID, UUID, TEXT) TO authenticated;
