-- A day is not a time.
--
-- A date column holds no clock, so casting one to a timestamptz silently means
-- midnight UTC. Read back in Nairobi that is 03:00, and every cheque cleared
-- through this function claimed to have cleared at three in the morning. The
-- same mistake on the client, sending "T12:00:00" with no offset, made every
-- restock claim 15:00.
--
-- Where the day is today the real moment is both true and more useful, so use
-- it. Where it is backdated there is no honest answer, so use midday, which is
-- far enough from either boundary that no timezone can drag it onto the wrong
-- date.

CREATE OR REPLACE FUNCTION public.instant_for_day(p_day DATE)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $fn$
  SELECT CASE
    WHEN p_day IS NULL OR p_day = CURRENT_DATE THEN now()
    ELSE (p_day + TIME '12:00')::TIMESTAMPTZ
  END;
$fn$;

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
    public.instant_for_day(p_cleared_on),
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
