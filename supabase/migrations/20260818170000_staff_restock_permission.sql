-- Letting staff restock.
--
-- Two separate decisions, kept apart on purpose.
--
-- Paying a supplier out of the drawer is a cash movement staff already handle
-- elsewhere. Taking stock *on credit* commits the owner to a debt, and it would
-- also open the supplier records to staff -- those are owner-only because what a
-- business owes is a solvency signal. So the permission covers paid-now only,
-- and the on-credit path stays with the owner. Widening it later should mean a
-- second permission, not a looser first one.
--
-- Worth stating plainly, because it cannot be designed around: restocking means
-- entering unit cost, so anyone holding this permission can work out the margin
-- on everything they restock. That boundary is held everywhere else in the app.
-- This is the owner choosing to drop it, per member of staff, deliberately.
--
-- Everything below is the existing function unchanged apart from that gate. It
-- is reproduced in full rather than patched because plpgsql has no way to
-- replace part of a body, and a near-copy is how the expense category and the
-- debt's link back to its stock movement would quietly go missing.

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

  INSERT INTO public.stock_movements (
    shop_id, product_id, product_name, movement_type, reason,
    quantity, unit_cost, total_cost, notes, happened_at, created_by, expense_id
  ) VALUES (
    p_shop_id, p_product_id, v_product.name, 'in', 'restock',
    p_quantity, p_unit_cost, v_total_cost, p_notes,
    COALESCE(p_happened_at, now()), auth.uid(), v_expense_id
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
