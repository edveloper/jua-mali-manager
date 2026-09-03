-- Three corrections.
--
-- 1. Paybill and Till are not the same thing. A Paybill has a business number
--    AND an account, a Buy Goods Till has only a number. Asking for "M-Pesa
--    Paybill or Till" and then an account name produced invoices telling a
--    customer to enter an account into a till that has no account field.
--
-- 2. An invoice raised from a part-paid sale billed the whole basket. Money
--    handed over at the counter lives in sale_payments, which the invoice never
--    looked at, so a customer who paid 20,000 cash and took 78,000 on deni was
--    invoiced for the full 98,000.
--
-- 3. Staff could type a new unit cost when restocking. See the note in the
--    function below.

-- ---------------------------------------------------------------------------
-- 1. Which kind of M-Pesa number
-- ---------------------------------------------------------------------------
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS mpesa_kind TEXT NOT NULL DEFAULT 'paybill';

ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_mpesa_kind_check;
ALTER TABLE public.shops
  ADD CONSTRAINT shops_mpesa_kind_check CHECK (mpesa_kind IN ('paybill', 'till'));

-- Anyone who already filled in an account was describing a Paybill, which is
-- the default, so nothing needs backfilling.

-- ---------------------------------------------------------------------------
-- 2. What was already paid at the counter
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_at_sale NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Existing invoices predate split payments being visible here. Filling it in
-- from sale_payments is safe and makes old documents read correctly too.
UPDATE public.invoices AS i
SET paid_at_sale = COALESCE((
  SELECT SUM(sp.amount)
  FROM public.sale_payments AS sp
  WHERE sp.receipt_id = i.receipt_id AND sp.shop_id = i.shop_id
), 0)
WHERE i.paid_at_sale = 0;

-- ---------------------------------------------------------------------------
-- 3. Restocking, with the cost fixed for staff
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
  v_is_owner BOOLEAN;
  v_unit_cost NUMERIC;
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
  -- current cost is used, which is also what the dialog shows them.
  IF v_is_owner THEN
    v_unit_cost := p_unit_cost;
  ELSE
    v_unit_cost := v_old_cost;
  END IF;

  v_new_stock := v_old_stock + p_quantity;
  v_total_cost := p_quantity * v_unit_cost;

  IF v_new_stock > 0 THEN
    v_new_cost := ((v_old_stock * v_old_cost) + v_total_cost) / v_new_stock;
  ELSE
    v_new_cost := v_unit_cost;
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
    p_quantity, v_unit_cost, v_total_cost, p_notes,
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
