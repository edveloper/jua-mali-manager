-- Expenses were classified as "inventory purchase" by matching the category
-- string for 'stock purchase'. That is fragile, and it silently swallowed money:
-- stock logged by hand in the Expenses tab raised no stock level, produced no
-- COGS, AND was filtered out of net profit, so the spend disappeared entirely.
--
-- Replace the string match with an explicit source flag. Only expenses the
-- restock flow created are excluded from operating expenses (their cost is
-- already carried as COGS). Anything typed by hand now counts, as it should.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_source_check;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_source_check
  CHECK (source IN ('manual', 'restock'));

-- Backfill: an expense is restock-generated exactly when a stock movement
-- points at it. Everything else stays 'manual'.
UPDATE public.expenses e
SET source = 'restock'
WHERE EXISTS (
  SELECT 1 FROM public.stock_movements sm WHERE sm.expense_id = e.id
);

CREATE INDEX IF NOT EXISTS expenses_shop_source_idx ON public.expenses (shop_id, source);

-- ---------------------------------------------------------------------------
-- Restock RPC now tags what it creates.
-- ---------------------------------------------------------------------------
-- Signature is unchanged, so CREATE OR REPLACE genuinely replaces here.
CREATE OR REPLACE FUNCTION public.record_product_restock_atomic(
  p_shop_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_cost NUMERIC,
  p_happened_at TIMESTAMPTZ DEFAULT now(),
  p_notes TEXT DEFAULT NULL,
  p_allocation_mode TEXT DEFAULT 'cash'
)
RETURNS TABLE (
  movement_id UUID,
  product_id UUID,
  new_stock_level INTEGER,
  new_cost_price NUMERIC,
  total_cost NUMERIC,
  expense_id UUID,
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
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost must be zero or greater';
  END IF;

  IF p_allocation_mode NOT IN ('cash', 'accrual') THEN
    RAISE EXCEPTION 'Allocation mode must be cash or accrual';
  END IF;

  IF NOT public.is_shop_owner(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Only owners can restock inventory';
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND shop_id = p_shop_id
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
  SET
    stock_level = v_new_stock,
    cost_price = v_new_cost
  WHERE id = p_product_id;

  INSERT INTO public.expenses (
    shop_id,
    category,
    description,
    amount,
    date,
    expense_type,
    recurrence_unit,
    allocation_mode,
    source
  ) VALUES (
    p_shop_id,
    'Stock Purchase',
    CONCAT('Restock: ', v_product.name, ' (', p_quantity, ' units)'),
    v_total_cost,
    (COALESCE(p_happened_at, now()))::date,
    'variable',
    'none',
    p_allocation_mode,
    'restock'
  )
  RETURNING id INTO v_expense_id;

  INSERT INTO public.stock_movements (
    shop_id,
    product_id,
    product_name,
    movement_type,
    reason,
    quantity,
    unit_cost,
    total_cost,
    notes,
    happened_at,
    created_by,
    expense_id
  ) VALUES (
    p_shop_id,
    p_product_id,
    v_product.name,
    'in',
    'restock',
    p_quantity,
    p_unit_cost,
    v_total_cost,
    p_notes,
    COALESCE(p_happened_at, now()),
    auth.uid(),
    v_expense_id
  )
  RETURNING id INTO v_movement_id;

  RETURN QUERY
  SELECT
    v_movement_id,
    p_product_id,
    v_new_stock,
    v_new_cost,
    v_total_cost,
    v_expense_id,
    COALESCE(p_happened_at, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_product_restock_atomic(UUID, UUID, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
