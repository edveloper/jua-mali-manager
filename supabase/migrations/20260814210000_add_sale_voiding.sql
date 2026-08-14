-- Lets a mistaken sale be reversed.
--
-- Until now a mis-tap was permanent: stock stayed wrong and the takings stayed
-- wrong, forever. Sales are never deleted -- they are marked void, so the
-- correction is visible rather than silent.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE INDEX IF NOT EXISTS sales_shop_voided_idx ON public.sales (shop_id, voided_at);

-- Voiding needs to UPDATE sales, and there is deliberately no UPDATE policy on
-- that table. Keeping it that way: the RPC below is SECURITY DEFINER and is the
-- only route in, so sales stay append-only from the client's point of view.
CREATE OR REPLACE FUNCTION public.void_sale_atomic(
  p_shop_id UUID,
  p_sale_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  quantity INTEGER,
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

  SELECT s.*
  INTO v_sale
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

  -- Staff may undo their own recent mistakes; only the owner can reach further
  -- back, so history cannot be quietly rewritten at the end of a shift.
  IF NOT v_is_owner THEN
    IF v_sale.sold_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'You can only cancel a sale you recorded yourself';
    END IF;
    IF v_sale.created_at < now() - interval '12 hours' THEN
      RAISE EXCEPTION 'Too late to cancel this one. Ask the owner.';
    END IF;
  END IF;

  -- A debt that has been partly paid cannot be unwound cleanly, so refuse
  -- rather than guess what should happen to the money already collected.
  SELECT cs.*
  INTO v_credit
  FROM public.credit_sales AS cs
  WHERE cs.sale_id = p_sale_id
  LIMIT 1;

  IF FOUND THEN
    IF COALESCE(v_credit.amount_paid, 0) > 0 THEN
      RAISE EXCEPTION 'This sale is on deni and has already been part paid. Settle it in the credit book instead.';
    END IF;
    DELETE FROM public.credit_sales WHERE id = v_credit.id;
  END IF;

  -- Put the stock back, if the product still exists.
  IF v_sale.product_id IS NOT NULL THEN
    UPDATE public.products AS p
    SET stock_level = COALESCE(p.stock_level, 0) + v_sale.quantity
    WHERE p.id = v_sale.product_id
    RETURNING p.stock_level INTO v_new_stock;
  END IF;

  UPDATE public.sales AS s
  SET voided_at = now(),
      voided_by = auth.uid(),
      void_reason = NULLIF(trim(p_reason), '')
  WHERE s.id = p_sale_id;

  RETURN QUERY
  SELECT
    v_sale.id,
    v_sale.product_id,
    v_sale.quantity,
    COALESCE(v_new_stock, 0),
    now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_sale_atomic(UUID, UUID, TEXT) TO authenticated;
