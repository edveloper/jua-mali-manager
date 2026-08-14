-- Per-sale price overrides, bounded by an owner-set band, gated by a per-employee
-- permission. The price is continuous within the band (315, 327, anything) --
-- deliberately not a tier list or a set of presets.

-- ---------------------------------------------------------------------------
-- 1. Per-member permissions
-- ---------------------------------------------------------------------------
-- JSONB rather than a column per permission, so adding the next one (record
-- expenses, sell on credit, view reports) needs no migration.
ALTER TABLE public.shop_members
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Owners implicitly hold every permission. Reads defensively: a missing key, or
-- a value that isn't exactly 'true', means no.
CREATE OR REPLACE FUNCTION public.member_can(
  p_user_id UUID,
  p_shop_id UUID,
  p_permission TEXT
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT sm.role = 'owner'
             OR COALESCE(sm.permissions ->> p_permission, 'false') = 'true'
        FROM public.shop_members sm
       WHERE sm.user_id = p_user_id
         AND sm.shop_id = p_shop_id
       LIMIT 1
    ),
    false
  )
$$;

GRANT EXECUTE ON FUNCTION public.member_can(UUID, UUID, TEXT) TO authenticated;

-- shop_members had SELECT/INSERT/DELETE policies but no UPDATE policy, so
-- without this an owner cannot actually save a permission change.
DROP POLICY IF EXISTS "Owners can update shop members" ON public.shop_members;
CREATE POLICY "Owners can update shop members"
ON public.shop_members
FOR UPDATE
USING (public.is_shop_owner(auth.uid(), shop_id))
WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

-- ---------------------------------------------------------------------------
-- 2. Owner-set price band per product
-- ---------------------------------------------------------------------------
-- NULL means unbounded on that side, so existing products keep behaving exactly
-- as they do today until the owner opts in by setting a band.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS min_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS max_price NUMERIC(12,2);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_price_band_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_price_band_check
  CHECK (
    min_price IS NULL
    OR max_price IS NULL
    OR min_price <= max_price
  );

-- ---------------------------------------------------------------------------
-- 3. Record what price was actually charged, and by whom
-- ---------------------------------------------------------------------------
-- Storing the list price alongside the charged price is what makes "how much
-- above base did we sell this month" answerable later.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS unit_price         NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS list_price_at_sale NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS price_source       TEXT NOT NULL DEFAULT 'list',
  ADD COLUMN IF NOT EXISTS sold_by            UUID;

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_price_source_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_price_source_check
  CHECK (price_source IN ('list', 'override'));

-- Backfill history so reports don't have to special-case NULLs.
UPDATE public.sales
SET
  unit_price = CASE WHEN quantity > 0 THEN total_amount / quantity ELSE 0 END,
  list_price_at_sale = CASE WHEN quantity > 0 THEN total_amount / quantity ELSE 0 END
WHERE unit_price IS NULL;

CREATE INDEX IF NOT EXISTS sales_sold_by_idx ON public.sales (shop_id, sold_by);

-- ---------------------------------------------------------------------------
-- 4. Sale RPC, now price-aware
-- ---------------------------------------------------------------------------
-- Must DROP first: adding a parameter to a plpgsql function via CREATE OR
-- REPLACE creates an overload rather than replacing it, and PostgREST then
-- fails on an ambiguous call. (Same class of problem as the 2026-02-23
-- ambiguous-id fix.)
--
-- p_unit_price defaults to NULL, so a client still calling with three arguments
-- resolves to this function unchanged -- migration and frontend deploy do not
-- have to be simultaneous.
DROP FUNCTION IF EXISTS public.record_product_sale_atomic(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.record_product_sale_atomic(
  p_shop_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_price NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  product_name TEXT,
  quantity INTEGER,
  total_amount NUMERIC,
  cost_price_at_sale NUMERIC,
  unit_price NUMERIC,
  list_price_at_sale NUMERIC,
  price_source TEXT,
  sold_by UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_sale RECORD;
  v_list_price NUMERIC;
  v_unit_price NUMERIC;
  v_source TEXT;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  SELECT p.*
  INTO v_product
  FROM public.products AS p
  WHERE p.id = p_product_id AND p.shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF COALESCE(v_product.stock_level, 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  v_list_price := COALESCE(v_product.price, 0);

  IF p_unit_price IS NULL THEN
    -- No price supplied: behave exactly as before.
    v_unit_price := v_list_price;
    v_source := 'list';
  ELSIF p_unit_price = v_list_price THEN
    -- Sent the list price back unchanged. Not an override, so no permission
    -- needed -- this lets the client always send a price.
    v_unit_price := v_list_price;
    v_source := 'list';
  ELSE
    IF p_unit_price < 0 THEN
      RAISE EXCEPTION 'Price cannot be negative';
    END IF;

    IF NOT public.member_can(auth.uid(), p_shop_id, 'override_price') THEN
      RAISE EXCEPTION 'You are not allowed to change the price on a sale';
    END IF;

    IF v_product.min_price IS NOT NULL AND p_unit_price < v_product.min_price THEN
      RAISE EXCEPTION 'Price % is below the minimum of % for this item',
        p_unit_price, v_product.min_price;
    END IF;

    IF v_product.max_price IS NOT NULL AND p_unit_price > v_product.max_price THEN
      RAISE EXCEPTION 'Price % is above the maximum of % for this item',
        p_unit_price, v_product.max_price;
    END IF;

    v_unit_price := p_unit_price;
    v_source := 'override';
  END IF;

  INSERT INTO public.sales (
    shop_id,
    product_id,
    product_name,
    quantity,
    total_amount,
    cost_price_at_sale,
    unit_price,
    list_price_at_sale,
    price_source,
    sold_by
  )
  VALUES (
    p_shop_id,
    p_product_id,
    v_product.name,
    p_quantity,
    v_unit_price * p_quantity,
    COALESCE(v_product.cost_price, 0),
    v_unit_price,
    v_list_price,
    v_source,
    auth.uid()
  )
  RETURNING *
  INTO v_sale;

  UPDATE public.products AS p
  SET stock_level = COALESCE(p.stock_level, 0) - p_quantity
  WHERE p.id = p_product_id;

  RETURN QUERY
  SELECT
    v_sale.id,
    v_sale.product_id,
    v_sale.product_name,
    v_sale.quantity,
    v_sale.total_amount,
    v_sale.cost_price_at_sale,
    v_sale.unit_price,
    v_sale.list_price_at_sale,
    v_sale.price_source,
    v_sale.sold_by,
    v_sale.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_product_sale_atomic(UUID, UUID, INTEGER, NUMERIC) TO authenticated;
