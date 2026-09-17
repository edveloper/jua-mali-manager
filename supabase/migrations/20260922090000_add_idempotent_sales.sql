-- Recording a sale that was made while the phone had no signal.
--
-- The queue lives on the phone and drains when the network comes back. That
-- means the same sale can arrive twice: the request succeeded, the reply never
-- made it back, and the phone quite reasonably tries again. Without something
-- to catch that, a shop's takings quietly inflate and their stock quietly
-- drains, and nobody finds out until a stock count.
--
-- The phone therefore names each sale before it sends it, once, and keeps that
-- name for every retry. The second arrival is recognised and answered with what
-- happened the first time.

CREATE TABLE IF NOT EXISTS public.client_operations (
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  -- Generated on the phone before the first attempt and reused for every
  -- retry. This is the whole mechanism.
  client_op_id UUID NOT NULL,
  receipt_id UUID,
  line_count INTEGER,
  basket_total NUMERIC,
  paid_now NUMERIC,
  credit_amount NUMERIC,
  credit_sale_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, client_op_id)
);

ALTER TABLE public.client_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_operations FROM anon, authenticated;

/*
 * A wrapper, deliberately, rather than a change to the sale itself.
 *
 * record_basket_sale_atomic is two hundred lines that have been through split
 * payments, free giveaways, deni and voiding. Reopening it to add a
 * de-duplication check would put all of that at risk for a concern that sits
 * entirely outside it. This calls it, unchanged, and remembers what it did.
 */
CREATE OR REPLACE FUNCTION public.record_sale_once(
  p_shop_id UUID,
  p_client_op_id UUID,
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
  v_prior public.client_operations%ROWTYPE;
  v_result RECORD;
BEGIN
  IF p_client_op_id IS NULL THEN
    RAISE EXCEPTION 'Every sale must be named before it is sent';
  END IF;

  /*
   * Claim the name first, and let the unique index do the hard part.
   *
   * Two retries arriving together is not hypothetical: a phone regaining signal
   * can fire a queue twice. Inserting the key before doing any work makes
   * Postgres serialise them. The second one blocks on the duplicate key until
   * the first either commits, in which case it raises here and reads the
   * finished answer, or rolls back, in which case it takes over and does the
   * work itself. Checking with a SELECT first would leave a gap between the
   * look and the leap, and that gap is a double sale.
   */
  BEGIN
    INSERT INTO public.client_operations (shop_id, client_op_id)
    VALUES (p_shop_id, p_client_op_id);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_prior
    FROM public.client_operations
    WHERE shop_id = p_shop_id AND client_op_id = p_client_op_id;

    RETURN QUERY SELECT
      v_prior.receipt_id, v_prior.line_count, v_prior.basket_total,
      v_prior.paid_now, v_prior.credit_amount, v_prior.credit_sale_id;
    RETURN;
  END;

  SELECT * INTO v_result
  FROM public.record_basket_sale_atomic(
    p_shop_id, p_lines, p_payments, p_customer_id, p_credit_amount
  );

  UPDATE public.client_operations
  SET receipt_id = v_result.out_receipt_id,
      line_count = v_result.out_line_count,
      basket_total = v_result.out_basket_total,
      paid_now = v_result.out_paid_now,
      credit_amount = v_result.out_credit_amount,
      credit_sale_id = v_result.out_credit_sale_id
  WHERE shop_id = p_shop_id AND client_op_id = p_client_op_id;

  RETURN QUERY SELECT
    v_result.out_receipt_id, v_result.out_line_count, v_result.out_basket_total,
    v_result.out_paid_now, v_result.out_credit_amount, v_result.out_credit_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_sale_once(UUID, UUID, JSONB, JSONB, UUID, NUMERIC) TO authenticated;

/*
 * Stock is allowed to go negative, on purpose.
 *
 * Two phones offline, both sell the last crate. When they reconnect the goods
 * have physically left the shop twice, and refusing the second sale would mean
 * the app deleting something a shopkeeper watched themselves do. A negative
 * stock level is an honest record of what happened, and it surfaces at the next
 * count as shrinkage, which is exactly what it is.
 *
 * Recorded here as a note rather than a constraint, because the constraint we
 * want is the absence of one.
 */
COMMENT ON TABLE public.client_operations IS
  'Names sales made offline so a replayed queue cannot record them twice. Stock may go negative when two phones sell the same last item; that is deliberate.';
