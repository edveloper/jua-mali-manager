-- Buying by the crate and selling by the bottle.
--
-- A bar buys five crates at 3,000 and sells single bottles. Until now the app
-- had one quantity and one cost, so the shopkeeper had to do the division
-- themselves and type 120 and 125. Most will type 5 and 3000, and then the
-- stock level says five, the cost basis says three thousand a bottle, and every
-- margin figure for that product is wrong from then on.
--
-- The important part is which number is the truth. What was actually paid is
-- the total: 2,500 for a carton of 24 is 104.1666... per unit, and a client
-- that rounds that to 104.17 and sends it back as a unit cost records an
-- expense of 2,500.08. So the totals come in and the unit cost is derived here
-- at full numeric precision, never the reverse.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS units_per_pack INTEGER,
  ADD COLUMN IF NOT EXISTS pack_label TEXT;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_units_per_pack_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_units_per_pack_check
  CHECK (units_per_pack IS NULL OR units_per_pack > 1);

-- Snapshot on the movement, not just the product's current setting. If the
-- crate size changes from 24 to 12 next year, last year's delivery must still
-- read as what it was.
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS pack_count INTEGER,
  ADD COLUMN IF NOT EXISTS units_per_pack INTEGER;

-- A defaulted parameter added to an existing function creates an overload
-- rather than replacing it, and then which one runs depends on how the client
-- happens to spell the call. Drop first, always.
DROP FUNCTION IF EXISTS public.record_product_restock_atomic(UUID, UUID, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN, UUID, TEXT, DATE);

CREATE OR REPLACE FUNCTION public.record_product_restock_atomic(
  p_shop_id UUID,
  p_product_id UUID,
  p_quantity INTEGER DEFAULT NULL,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_happened_at TIMESTAMPTZ DEFAULT now(),
  p_notes TEXT DEFAULT NULL,
  p_allocation_mode TEXT DEFAULT 'cash',
  p_paid_now BOOLEAN DEFAULT true,
  p_supplier_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  -- Packs. Given together or not at all; they are the other way of saying the
  -- same delivery, never a modifier on the first way.
  p_pack_count INTEGER DEFAULT NULL,
  p_units_per_pack INTEGER DEFAULT NULL,
  p_pack_cost NUMERIC DEFAULT NULL
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
  v_quantity INTEGER;
  v_total_cost NUMERIC;
  v_expense_id UUID;
  v_movement_id UUID;
  v_debt_id UUID;
  v_is_owner BOOLEAN;
  v_unit_cost NUMERIC;
  v_by_pack BOOLEAN;
  v_what TEXT;
BEGIN
  v_by_pack := p_pack_count IS NOT NULL;

  IF v_by_pack THEN
    IF p_units_per_pack IS NULL OR p_units_per_pack <= 1 THEN
      RAISE EXCEPTION 'Say how many are in each one';
    END IF;
    IF p_pack_count <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;
    IF p_pack_cost IS NULL OR p_pack_cost < 0 THEN
      RAISE EXCEPTION 'Cost must be zero or greater';
    END IF;
    v_quantity := p_pack_count * p_units_per_pack;
    v_total_cost := p_pack_count * p_pack_cost;
  ELSE
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;
    IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
      RAISE EXCEPTION 'Unit cost must be zero or greater';
    END IF;
    v_quantity := p_quantity;
    v_total_cost := p_quantity * p_unit_cost;
  END IF;

  -- Owners always. Staff only with the permission, and only when the stock is
  -- being paid for now: taking it on credit commits the owner to a debt, which
  -- is a financing decision and not a shopkeeping one.
  v_is_owner := public.is_shop_owner(auth.uid(), p_shop_id);

  IF NOT v_is_owner THEN
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

  -- What the goods cost is the owner's figure, not the counter's.
  --
  -- Restocking already shows staff the unit cost, which is a boundary the owner
  -- opts into per person. Letting them change it is a different thing entirely:
  -- cost drives the weighted average, which drives every margin and every profit
  -- figure for that item. A staff member could quietly make the shop look more
  -- or less profitable than it is. So their entry is ignored and the item's
  -- current cost is used, however they counted the delivery.
  IF NOT v_is_owner THEN
    v_total_cost := v_quantity * v_old_cost;
  END IF;

  -- Derived from the total, never the other way round. This is the line that
  -- keeps a carton of 24 at 2,500 from becoming an expense of 2,500.08.
  IF v_quantity > 0 THEN
    v_unit_cost := v_total_cost / v_quantity;
  ELSE
    v_unit_cost := v_old_cost;
  END IF;

  v_new_stock := v_old_stock + v_quantity;

  IF v_new_stock > 0 THEN
    v_new_cost := ((v_old_stock * v_old_cost) + v_total_cost) / v_new_stock;
  ELSE
    v_new_cost := v_unit_cost;
  END IF;

  UPDATE public.products
  SET stock_level = v_new_stock, cost_price = v_new_cost
  WHERE id = p_product_id;

  -- Say it the way it was counted. "5 crates (120 units)" is what the owner
  -- will be looking for when they check the delivery against the invoice.
  IF v_by_pack THEN
    v_what := CONCAT(
      p_pack_count, ' x ',
      COALESCE(NULLIF(trim(COALESCE(v_product.pack_label, '')), ''), 'pack'),
      ' of ', p_units_per_pack, ' (', v_quantity, ' units)'
    );
  ELSE
    v_what := CONCAT(v_quantity, ' units');
  END IF;

  IF p_paid_now THEN
    INSERT INTO public.expenses (
      shop_id, category, description, amount, date,
      expense_type, recurrence_unit, allocation_mode, source, payment_method
    ) VALUES (
      p_shop_id, 'Stock Purchase',
      CONCAT('Restock: ', v_product.name, ' (', v_what, ')'),
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
    previous_cost_price, previous_stock_level, pack_count, units_per_pack
  ) VALUES (
    p_shop_id, p_product_id, v_product.name, 'in', 'restock',
    v_quantity, v_unit_cost, v_total_cost, p_notes,
    COALESCE(p_happened_at, now()), auth.uid(), v_expense_id,
    v_old_cost, v_old_stock,
    CASE WHEN v_by_pack THEN p_pack_count END,
    CASE WHEN v_by_pack THEN p_units_per_pack END
  )
  RETURNING id INTO v_movement_id;

  IF NOT p_paid_now THEN
    INSERT INTO public.supplier_debts (
      shop_id, supplier_id, stock_movement_id, description, amount,
      incurred_on, due_date
    ) VALUES (
      p_shop_id, p_supplier_id, v_movement_id,
      CONCAT(v_product.name, ' (', v_what, ')'),
      v_total_cost, (COALESCE(p_happened_at, now()))::date, p_due_date
    )
    RETURNING id INTO v_debt_id;
  END IF;

  -- Remembered for next time, because the crate size is a fact about the
  -- product rather than about this delivery. Only when the owner said it: a
  -- staff member counting crates must not redefine what a crate is.
  IF v_by_pack AND v_is_owner
     AND COALESCE(v_product.units_per_pack, 0) <> p_units_per_pack THEN
    UPDATE public.products SET units_per_pack = p_units_per_pack
    WHERE id = p_product_id;
  END IF;

  RETURN QUERY
  SELECT v_movement_id, p_product_id, v_new_stock, v_new_cost,
         v_total_cost, v_expense_id, v_debt_id, COALESCE(p_happened_at, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_product_restock_atomic(UUID, UUID, INTEGER, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN, UUID, TEXT, DATE, INTEGER, INTEGER, NUMERIC) TO authenticated;
