-- Recording a giveaway.
--
-- A shop hands something over for nothing: a sample, a replacement for a bad
-- tin, something for a regular. They still want it in the books, because the
-- stock has left the shelf and the cost is real even though the price is not.
--
-- The sale could not be recorded at all before this. Three things stopped it,
-- and all three were right in general and wrong in this one case:
--
--   the price band refused anything under an item's minimum
--   a payment row cannot be zero, so an unpaid receipt looked unsettled
--   the form refused to submit a basket totalling nothing
--
-- The fix is not to loosen those. It is to say plainly that this is a giveaway:
-- price_source becomes 'free', which skips the band, records no payment, and
-- leaves a mark reports can read. Profit on the line is the cost of the goods,
-- negative, which is exactly what giving something away does to a day.

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_price_source_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_price_source_check
  CHECK (price_source IN ('list', 'override', 'free'));

-- Reproduced in full rather than patched: plpgsql cannot replace part of a
-- body, and a retyped near-copy is how details quietly go missing.

CREATE OR REPLACE FUNCTION public.record_basket_sale_atomic(
  p_shop_id UUID,
  p_lines JSONB,
  p_payments JSONB DEFAULT '[]'::JSONB,
  p_customer_id UUID DEFAULT NULL,
  p_credit_amount NUMERIC DEFAULT 0
)
RETURNS TABLE (
  out_receipt_id UUID,
  out_line_count INTEGER,
  out_basket_total NUMERIC,
  out_paid_now NUMERIC,
  out_credit_amount NUMERIC,
  out_credit_sale_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt UUID := gen_random_uuid();
  v_item RECORD;
  v_pay RECORD;
  v_product RECORD;
  v_list_price NUMERIC;
  v_unit_price NUMERIC;
  v_source TEXT;
  v_total NUMERIC := 0;
  v_paid NUMERIC := 0;
  v_credit NUMERIC := COALESCE(p_credit_amount, 0);
  v_lines INTEGER := 0;
  v_first_sale UUID;
  v_new_sale UUID;
  v_first_name TEXT;
  v_label TEXT;
  v_units INTEGER := 0;
  v_credit_id UUID;
  v_can_override BOOLEAN;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Not authorized for this shop';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'A sale needs at least one item';
  END IF;

  IF v_credit < 0 THEN
    RAISE EXCEPTION 'The deni amount cannot be negative';
  END IF;

  -- Resolved once rather than per line: it is the same answer every time, and
  -- the loop below can be long.
  v_can_override := public.member_can(auth.uid(), p_shop_id, 'override_price');

  -- Ordered by product so two tills ringing up the same two items in opposite
  -- order take their row locks in the same sequence and cannot deadlock.
  FOR v_item IN
    SELECT
      (elem->>'product_id')::UUID AS product_id,
      (elem->>'quantity')::INTEGER AS quantity,
      NULLIF(elem->>'unit_price', '')::NUMERIC AS unit_price
    FROM jsonb_array_elements(p_lines) AS elem
    ORDER BY 1
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    SELECT p.* INTO v_product
    FROM public.products AS p
    WHERE p.id = v_item.product_id AND p.shop_id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    IF COALESCE(v_product.stock_level, 0) < v_item.quantity THEN
      RAISE EXCEPTION 'Not enough % left. Only % in stock.', v_product.name, COALESCE(v_product.stock_level, 0);
    END IF;

    v_list_price := COALESCE(v_product.price, 0);

    IF v_item.unit_price IS NULL OR v_item.unit_price = v_list_price THEN
      v_unit_price := v_list_price;
      v_source := 'list';
    ELSIF v_item.unit_price = 0 THEN
      -- Given away.
      --
      -- Deliberately not measured against the negotiating band. A giveaway is
      -- not a very low price, it is a different act: a shop with a floor of 300
      -- on an item can still hand one to a regular, and refusing that would just
      -- push the shopkeeper into not recording it at all, which is worse. Stock
      -- still leaves and the cost still lands, so the day shows the loss.
      --
      -- It stays behind the same permission as any other price change, and it is
      -- marked 'free' rather than 'override' so a gift can be told from a
      -- mistake later.
      IF NOT v_can_override THEN
        RAISE EXCEPTION 'You are not allowed to give items away';
      END IF;
      v_unit_price := 0;
      v_source := 'free';
    ELSE
      IF v_item.unit_price < 0 THEN
        RAISE EXCEPTION 'Price cannot be negative';
      END IF;
      IF NOT v_can_override THEN
        RAISE EXCEPTION 'You are not allowed to change the price on a sale';
      END IF;
      IF v_product.min_price IS NOT NULL AND v_item.unit_price < v_product.min_price THEN
        RAISE EXCEPTION 'Price % is below the minimum of % for %',
          v_item.unit_price, v_product.min_price, v_product.name;
      END IF;
      IF v_product.max_price IS NOT NULL AND v_item.unit_price > v_product.max_price THEN
        RAISE EXCEPTION 'Price % is above the maximum of % for %',
          v_item.unit_price, v_product.max_price, v_product.name;
      END IF;
      v_unit_price := v_item.unit_price;
      v_source := 'override';
    END IF;

    INSERT INTO public.sales (
      shop_id, receipt_id, product_id, product_name, quantity, total_amount,
      cost_price_at_sale, unit_price, list_price_at_sale, price_source, sold_by
    )
    VALUES (
      p_shop_id, v_receipt, v_item.product_id, v_product.name, v_item.quantity,
      v_unit_price * v_item.quantity, COALESCE(v_product.cost_price, 0),
      v_unit_price, v_list_price, v_source, auth.uid()
    )
    RETURNING id INTO v_new_sale;

    UPDATE public.products AS p
    SET stock_level = COALESCE(p.stock_level, 0) - v_item.quantity
    WHERE p.id = v_item.product_id;

    v_total := v_total + (v_unit_price * v_item.quantity);
    v_units := v_units + v_item.quantity;
    v_lines := v_lines + 1;

    -- Held for credit_sales.sale_id, which predates receipts and still expects
    -- to point at a single row.
    IF v_first_sale IS NULL THEN
      v_first_sale := v_new_sale;
      v_first_name := v_product.name;
    END IF;
  END LOOP;

  -- Payments
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' THEN
    FOR v_pay IN
      SELECT
        NULLIF(trim(COALESCE(elem->>'method', '')), '') AS method,
        (elem->>'amount')::NUMERIC AS amount,
        NULLIF(trim(COALESCE(elem->>'reference', '')), '') AS reference
      FROM jsonb_array_elements(p_payments) AS elem
    LOOP
      IF v_pay.amount IS NULL OR v_pay.amount <= 0 THEN
        RAISE EXCEPTION 'Every payment must be more than zero';
      END IF;
      IF v_pay.method IS NULL OR v_pay.method NOT IN ('cash', 'mpesa', 'airtel', 'other') THEN
        RAISE EXCEPTION 'Unknown payment method: %', COALESCE(v_pay.method, 'none given');
      END IF;

      INSERT INTO public.sale_payments (
        shop_id, receipt_id, amount, payment_method, payment_reference, recorded_by
      )
      VALUES (p_shop_id, v_receipt, v_pay.amount, v_pay.method, v_pay.reference, auth.uid());

      v_paid := v_paid + v_pay.amount;
    END LOOP;
  END IF;

  -- The invariant that keeps a half-recorded sale out of the books. Rounded to
  -- cents because the client works in floating point and 300.00000000000006 is
  -- not a real disagreement.
  IF round(v_paid + v_credit, 2) <> round(v_total, 2) THEN
    RAISE EXCEPTION 'The payments come to % and the deni to %, but the items come to %',
      round(v_paid, 2), round(v_credit, 2), round(v_total, 2);
  END IF;

  IF v_credit > 0 THEN
    IF p_customer_id IS NULL THEN
      RAISE EXCEPTION 'Say who is taking the balance on deni';
    END IF;

    PERFORM 1 FROM public.customers AS c
    WHERE c.id = p_customer_id AND c.shop_id = p_shop_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer not found';
    END IF;

    -- One debt for the whole basket, which is how a shopkeeper remembers it:
    -- "Mama Njeri owes 450 from Tuesday", not a debt per tin of tomatoes.
    v_label := CASE
      WHEN v_lines = 1 THEN v_first_name
      ELSE v_first_name || ' and ' || (v_lines - 1) || ' more'
    END;

    INSERT INTO public.credit_sales (
      shop_id, customer_id, sale_id, receipt_id, product_name, quantity, amount, status
    )
    VALUES (
      p_shop_id, p_customer_id, v_first_sale, v_receipt, v_label, v_units, v_credit, 'pending'
    )
    RETURNING id INTO v_credit_id;
  END IF;

  RETURN QUERY SELECT v_receipt, v_lines, v_total, v_paid, v_credit, v_credit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_basket_sale_atomic(UUID, JSONB, JSONB, UUID, NUMERIC) TO authenticated;
