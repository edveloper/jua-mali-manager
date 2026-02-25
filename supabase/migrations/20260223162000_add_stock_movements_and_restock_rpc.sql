CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  reason TEXT NOT NULL CHECK (reason IN ('restock', 'sale', 'damage', 'return', 'manual_adjustment')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2),
  total_cost NUMERIC(12,2),
  notes TEXT,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view stock movements" ON public.stock_movements;
CREATE POLICY "Members can view stock movements"
ON public.stock_movements
FOR SELECT
USING (public.is_shop_member(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Owners can manage stock movements" ON public.stock_movements;
CREATE POLICY "Owners can manage stock movements"
ON public.stock_movements
FOR ALL
USING (public.is_shop_owner(auth.uid(), shop_id))
WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

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
    allocation_mode
  ) VALUES (
    p_shop_id,
    'Stock Purchase',
    CONCAT('Restock: ', v_product.name, ' (', p_quantity, ' units)'),
    v_total_cost,
    (COALESCE(p_happened_at, now()))::date,
    'variable',
    'none',
    p_allocation_mode
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
