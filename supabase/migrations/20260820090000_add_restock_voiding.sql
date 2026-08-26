-- Undoing a restock.
--
-- A mistaken sale could always be cancelled. A mistaken restock could not, and
-- it is the more damaging of the two: it adds stock that is not on the shelf, it
-- writes an expense or a supplier debt, and it moves the item's cost price,
-- which quietly bends every margin figure for that item until the next delivery.
-- A typo of 500 instead of 50 was permanent.
--
-- Reversing the stock and the money is easy. Reversing the cost price is not,
-- because it is a weighted average and the inputs are gone:
--
--   new_cost = (old_stock * old_cost + qty * unit_cost) / (old_stock + qty)
--
-- Inverting that needs old_stock as it was at the time, which was never stored.
-- So it is stored from now on, and rows that predate this are handled honestly:
-- the stock and the money come back, the cost price is left alone, and the
-- caller is told so rather than being given a number nobody can stand behind.

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS previous_cost_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS previous_stock_level INTEGER,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE INDEX IF NOT EXISTS stock_movements_live_idx
  ON public.stock_movements (shop_id, product_id, happened_at)
  WHERE voided_at IS NULL;

-- ---------------------------------------------------------------------------
-- Restocking now records what it displaced
-- ---------------------------------------------------------------------------
-- Reproduced in full rather than patched: plpgsql cannot replace part of a
-- body, and a retyped near-copy is how details quietly go missing.
CREATE OR REPLACE FUNCTION public.record_product_restock_atomic(
  p_shop_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_cost NUMERIC,
  p_happened_at TIMESTAMPTZ DEFAULT now(),
  p_notes TEXT DEFAULT NULL,
  p_allocation_mode TEXT DEFAULT 'cash',
  p_paid_now BOOLEAN DEFAULT true,
  p_supplier_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_due_date DATE DEFAULT NULL
)
RETURNS TABLE (
  movement_id UUID,
  product_id UUID,
  new_stock_level INTEGER,
  new_cost_price NUMERIC,
  total_cost NUMERIC,
  expense_id UUID,
  debt_id UUID,
  happened_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_old_stock INTEGER;
  v_old_cost NUMERIC;
  v_new_stock INTEGER;
  v_new_cost NUMERIC;
  v_total_cost NUMERIC;
  v_expense_id UUID;
  v_movement_id UUID;
  v_debt_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost must be zero or greater';
  END IF;

  -- Owners always. Staff only with the permission, and only when the stock is
  -- being paid for now: taking it on credit commits the owner to a debt, which
  -- is a financing decision and not a shopkeeping one.
  IF NOT public.is_shop_owner(auth.uid(), p_shop_id) THEN
    IF NOT public.member_can(auth.uid(), p_shop_id, 'restock_stock') THEN
      RAISE EXCEPTION 'You are not allowed to add stock';
    END IF;
    IF NOT p_paid_now THEN
      RAISE EXCEPTION 'Only the owner can take stock on credit. Ask them to record it.';
    END IF;
  END IF;

  IF NOT p_paid_now AND p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Say who the stock was taken from';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  v_old_stock := COALESCE(v_product.stock_level, 0);
  v_old_cost := COALESCE(v_product.cost_price, 0);
  v_new_stock := v_old_stock + p_quantity;
  v_total_cost := p_quantity * p_unit_cost;

  IF v_new_stock > 0 THEN
    v_new_cost := ((v_old_stock * v_old_cost) + v_total_cost) / v_new_stock;
  ELSE
    v_new_cost := p_unit_cost;
  END IF;

  UPDATE public.products
  SET stock_level = v_new_stock, cost_price = v_new_cost
  WHERE id = p_product_id;

  IF p_paid_now THEN
    INSERT INTO public.expenses (
      shop_id, category, description, amount, date,
      expense_type, recurrence_unit, allocation_mode, source, payment_method
    ) VALUES (
      p_shop_id, 'Stock Purchase',
      CONCAT('Restock: ', v_product.name, ' (', p_quantity, ' units)'),
      v_total_cost, (COALESCE(p_happened_at, now()))::date,
      'variable', 'none', COALESCE(p_allocation_mode, 'cash'), 'restock',
      NULLIF(trim(COALESCE(p_payment_method, '')), '')
    )
    RETURNING id INTO v_expense_id;
  END IF;

  -- previous_* is what makes this reversible later.
  INSERT INTO public.stock_movements (
    shop_id, product_id, product_name, movement_type, reason,
    quantity, unit_cost, total_cost, notes, happened_at, created_by, expense_id,
    previous_cost_price, previous_stock_level
  ) VALUES (
    p_shop_id, p_product_id, v_product.name, 'in', 'restock',
    p_quantity, p_unit_cost, v_total_cost, p_notes,
    COALESCE(p_happened_at, now()), auth.uid(), v_expense_id,
    v_old_cost, v_old_stock
  )
  RETURNING id INTO v_movement_id;

  IF NOT p_paid_now THEN
    INSERT INTO public.supplier_debts (
      shop_id, supplier_id, stock_movement_id, description, amount,
      incurred_on, due_date
    ) VALUES (
      p_shop_id, p_supplier_id, v_movement_id,
      CONCAT(v_product.name, ' (', p_quantity, ' units)'),
      v_total_cost, (COALESCE(p_happened_at, now()))::date, p_due_date
    )
    RETURNING id INTO v_debt_id;
  END IF;

  RETURN QUERY
  SELECT v_movement_id, p_product_id, v_new_stock, v_new_cost,
         v_total_cost, v_expense_id, v_debt_id, COALESCE(p_happened_at, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_product_restock_atomic(UUID, UUID, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN, UUID, TEXT, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cancelling a restock
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.void_restock_atomic(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.void_restock_atomic(
  p_shop_id UUID,
  p_movement_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  voided_movement_id UUID,
  restored_stock INTEGER,
  restored_cost NUMERIC,
  removed_amount NUMERIC,
  cost_restored BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_move RECORD;
  v_product RECORD;
  v_debt RECORD;
  v_new_stock INTEGER;
  v_cost_restored BOOLEAN := false;
  v_is_owner BOOLEAN;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  SELECT * INTO v_move
  FROM public.stock_movements
  WHERE id = p_movement_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That stock entry was not found';
  END IF;

  IF v_move.reason <> 'restock' OR v_move.movement_type <> 'in' THEN
    RAISE EXCEPTION 'Only a restock can be cancelled here';
  END IF;

  IF v_move.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'This restock was already cancelled';
  END IF;

  v_is_owner := public.is_shop_owner(auth.uid(), p_shop_id);

  -- Same shape as cancelling a sale: staff undo their own recent mistakes, the
  -- owner can reach further back.
  IF NOT v_is_owner THEN
    IF v_move.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'You can only cancel a restock you recorded yourself';
    END IF;
    IF v_move.created_at < now() - interval '12 hours' THEN
      RAISE EXCEPTION 'Too late to cancel this one. Ask the owner.';
    END IF;
  END IF;

  -- A later delivery has already folded itself into the average cost, so undoing
  -- this one cannot put the cost price back without discarding that one too.
  IF EXISTS (
    SELECT 1 FROM public.stock_movements AS later
    WHERE later.shop_id = p_shop_id
      AND later.product_id = v_move.product_id
      AND later.reason = 'restock'
      AND later.voided_at IS NULL
      AND later.id <> v_move.id
      AND later.happened_at > v_move.happened_at
  ) THEN
    RAISE EXCEPTION 'This item has been restocked again since. Cancel the newer one first.';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = v_move.product_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF COALESCE(v_product.stock_level, 0) < v_move.quantity THEN
    RAISE EXCEPTION 'Only % left on the shelf, so % cannot be taken back off. Adjust with a stock count instead.',
      COALESCE(v_product.stock_level, 0), v_move.quantity;
  END IF;

  -- Money owed can be cancelled; money already handed over cannot be unpaid.
  SELECT * INTO v_debt
  FROM public.supplier_debts
  WHERE stock_movement_id = v_move.id AND shop_id = p_shop_id
  LIMIT 1;

  IF FOUND AND COALESCE(v_debt.amount_paid, 0) > 0 THEN
    RAISE EXCEPTION 'You have already paid part of this delivery. Settle it in what you owe instead.';
  END IF;

  v_new_stock := COALESCE(v_product.stock_level, 0) - v_move.quantity;

  IF v_move.previous_cost_price IS NOT NULL THEN
    UPDATE public.products
    SET stock_level = v_new_stock, cost_price = v_move.previous_cost_price
    WHERE id = v_move.product_id;
    v_cost_restored := true;
  ELSE
    -- Recorded before the previous cost was kept. The stock and the money are
    -- still put right; the cost price is left alone rather than guessed at, and
    -- the caller is told so it can say as much.
    UPDATE public.products
    SET stock_level = v_new_stock
    WHERE id = v_move.product_id;
  END IF;

  IF v_debt.id IS NOT NULL THEN
    DELETE FROM public.supplier_debts WHERE id = v_debt.id;
  END IF;

  IF v_move.expense_id IS NOT NULL THEN
    DELETE FROM public.expenses WHERE id = v_move.expense_id AND shop_id = p_shop_id;
  END IF;

  UPDATE public.stock_movements
  SET voided_at = now(),
      voided_by = auth.uid(),
      void_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
      expense_id = NULL
  WHERE id = v_move.id;

  RETURN QUERY
  SELECT v_move.id, v_new_stock,
         COALESCE(v_move.previous_cost_price, v_product.cost_price),
         COALESCE(v_move.total_cost, 0), v_cost_restored;
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_restock_atomic(UUID, UUID, TEXT) TO authenticated;
