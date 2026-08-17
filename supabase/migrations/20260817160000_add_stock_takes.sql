-- Counting the shelf, the way cash-up counts the drawer.
--
-- Stock levels drift: breakage, things given away, sales rung up wrong, and
-- theft. A stock figure nobody has ever checked is decoration. This records what
-- was actually on the shelf, what the app expected, and what the gap is worth.

CREATE TABLE IF NOT EXISTS public.stock_takes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  counted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  counted_by UUID,
  items_counted INTEGER NOT NULL DEFAULT 0,
  items_short INTEGER NOT NULL DEFAULT 0,
  items_over INTEGER NOT NULL DEFAULT 0,
  -- Priced at cost. "Eleven units missing" means nothing; "KSh 3,400 missing"
  -- is a number an owner can act on.
  shrinkage_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_takes_shop_date_idx
  ON public.stock_takes (shop_id, counted_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_take_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_take_id UUID NOT NULL REFERENCES public.stock_takes(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  expected_qty INTEGER NOT NULL,
  counted_qty INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  value_difference NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stock_take_id, product_id)
);

CREATE INDEX IF NOT EXISTS stock_take_lines_take_idx
  ON public.stock_take_lines (stock_take_id);

ALTER TABLE public.stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_take_lines ENABLE ROW LEVEL SECURITY;

-- Owner-only, like the till count. The discrepancy is a number that may point at
-- whoever did the counting, so it is not theirs to read or revise. Staff-run
-- counts would need the value hidden from them, which is a later problem.
DROP POLICY IF EXISTS "Owners can view stock takes" ON public.stock_takes;
CREATE POLICY "Owners can view stock takes"
ON public.stock_takes FOR SELECT
USING (public.is_shop_owner(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Owners can view stock take lines" ON public.stock_take_lines;
CREATE POLICY "Owners can view stock take lines"
ON public.stock_take_lines FOR SELECT
USING (public.is_shop_owner(auth.uid(), shop_id));

-- No INSERT policies: counts are written only by the function below, so a count
-- can never be recorded without the stock adjustments that go with it.

-- ---------------------------------------------------------------------------
-- Apply a count
-- ---------------------------------------------------------------------------
-- The whole count lands or none of it does. A half-applied stock take would
-- leave some products corrected and others not, with no way to tell which.
CREATE OR REPLACE FUNCTION public.record_stock_take_atomic(
  p_shop_id UUID,
  p_lines JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  items_counted INTEGER,
  items_short INTEGER,
  items_over INTEGER,
  shrinkage_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_take_id UUID;
  v_line JSONB;
  v_product RECORD;
  v_counted INTEGER;
  v_expected INTEGER;
  v_difference INTEGER;
  v_unit_cost NUMERIC;
  v_value NUMERIC;
  v_items INTEGER := 0;
  v_short INTEGER := 0;
  v_over INTEGER := 0;
  v_shrinkage NUMERIC := 0;
BEGIN
  IF NOT public.is_shop_owner(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Only the shop owner can record a stock count';
  END IF;

  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Nothing was counted';
  END IF;

  INSERT INTO public.stock_takes (shop_id, counted_by, notes)
  VALUES (p_shop_id, auth.uid(), NULLIF(trim(COALESCE(p_notes, '')), ''))
  RETURNING stock_takes.id INTO v_take_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_counted := (v_line ->> 'counted_qty')::INTEGER;

    IF v_counted IS NULL OR v_counted < 0 THEN
      RAISE EXCEPTION 'A count cannot be negative';
    END IF;

    SELECT p.*
    INTO v_product
    FROM public.products AS p
    WHERE p.id = (v_line ->> 'product_id')::UUID
      AND p.shop_id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'One of the products is no longer in your shop';
    END IF;

    v_expected := COALESCE(v_product.stock_level, 0);
    v_difference := v_counted - v_expected;
    v_unit_cost := COALESCE(v_product.cost_price, 0);
    v_value := v_difference * v_unit_cost;

    INSERT INTO public.stock_take_lines (
      stock_take_id, shop_id, product_id, product_name,
      expected_qty, counted_qty, difference, unit_cost, value_difference
    ) VALUES (
      v_take_id, p_shop_id, v_product.id, v_product.name,
      v_expected, v_counted, v_difference, v_unit_cost, v_value
    );

    v_items := v_items + 1;

    IF v_difference <> 0 THEN
      IF v_difference < 0 THEN
        v_short := v_short + 1;
        v_shrinkage := v_shrinkage + abs(v_value);
      ELSE
        v_over := v_over + 1;
      END IF;

      -- The count becomes the truth, and the correction is left on the record
      -- rather than the stock level simply changing with no explanation.
      INSERT INTO public.stock_movements (
        shop_id, product_id, product_name, movement_type, reason,
        quantity, unit_cost, total_cost, notes, happened_at, created_by
      ) VALUES (
        p_shop_id, v_product.id, v_product.name,
        'adjustment', 'manual_adjustment',
        abs(v_difference), v_unit_cost, abs(v_value),
        CONCAT('Stock count: expected ', v_expected, ', found ', v_counted),
        now(), auth.uid()
      );

      UPDATE public.products AS p
      SET stock_level = v_counted
      WHERE p.id = v_product.id;
    END IF;
  END LOOP;

  UPDATE public.stock_takes AS st
  SET items_counted = v_items,
      items_short = v_short,
      items_over = v_over,
      shrinkage_value = v_shrinkage
  WHERE st.id = v_take_id;

  RETURN QUERY
  SELECT v_take_id, v_items, v_short, v_over, v_shrinkage;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_stock_take_atomic(UUID, JSONB, TEXT) TO authenticated;
