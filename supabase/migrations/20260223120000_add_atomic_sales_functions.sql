-- Atomic product sale transaction: inserts sale and decrements stock in one DB transaction.
CREATE OR REPLACE FUNCTION public.record_product_sale_atomic(
  p_shop_id UUID,
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  product_name TEXT,
  quantity INTEGER,
  total_amount NUMERIC,
  cost_price_at_sale NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_sale RECORD;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_product_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF COALESCE(v_product.stock_level, 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  INSERT INTO public.sales (
    shop_id,
    product_id,
    product_name,
    quantity,
    total_amount,
    cost_price_at_sale
  )
  VALUES (
    p_shop_id,
    p_product_id,
    v_product.name,
    p_quantity,
    COALESCE(v_product.price, 0) * p_quantity,
    COALESCE(v_product.cost_price, 0)
  )
  RETURNING *
  INTO v_sale;

  UPDATE public.products
  SET stock_level = COALESCE(stock_level, 0) - p_quantity
  WHERE id = p_product_id;

  RETURN QUERY
  SELECT
    v_sale.id,
    v_sale.product_id,
    v_sale.product_name,
    v_sale.quantity,
    v_sale.total_amount,
    v_sale.cost_price_at_sale,
    v_sale.created_at;
END;
$$;

-- Atomic service sale transaction: inserts service sale and decrements capacity atomically.
CREATE OR REPLACE FUNCTION public.record_service_sale_atomic(
  p_shop_id UUID,
  p_service_id UUID,
  p_quantity INTEGER
)
RETURNS TABLE (
  id UUID,
  service_id UUID,
  service_name TEXT,
  quantity INTEGER,
  total_amount NUMERIC,
  cost_at_sale NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service RECORD;
  v_sale RECORD;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  SELECT *
  INTO v_service
  FROM public.services
  WHERE id = p_service_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found';
  END IF;

  IF COALESCE(v_service.capacity, 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient capacity';
  END IF;

  INSERT INTO public.service_sales (
    shop_id,
    service_id,
    service_name,
    quantity,
    total_amount,
    cost_at_sale
  )
  VALUES (
    p_shop_id,
    p_service_id,
    v_service.name,
    p_quantity,
    COALESCE(v_service.price, 0) * p_quantity,
    COALESCE(v_service.cost_per_service, 0)
  )
  RETURNING *
  INTO v_sale;

  UPDATE public.services
  SET capacity = COALESCE(capacity, 0) - p_quantity
  WHERE id = p_service_id;

  RETURN QUERY
  SELECT
    v_sale.id,
    v_sale.service_id,
    v_sale.service_name,
    v_sale.quantity,
    v_sale.total_amount,
    v_sale.cost_at_sale,
    v_sale.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_product_sale_atomic(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_service_sale_atomic(UUID, UUID, INTEGER) TO authenticated;
