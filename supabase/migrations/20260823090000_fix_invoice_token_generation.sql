-- Invoice tokens without pgcrypto.
--
-- raise_invoice_atomic built its token with gen_random_bytes(), which comes from
-- pgcrypto. On Supabase pgcrypto is installed into the `extensions` schema, and
-- the function sets `search_path = public`, so the call could not resolve and
-- every attempt to raise an invoice failed with "function gen_random_bytes
-- (integer) does not exist".
--
-- Qualifying it as extensions.gen_random_bytes() would work, but it ties this
-- function to where an extension happens to be installed. gen_random_uuid() is
-- core Postgres, is already the default on every primary key in this schema, and
-- needs no extension at all. Two of them concatenated give 64 hex characters,
-- which is more than enough to make a link unguessable.
--
-- Reproduced in full rather than patched: plpgsql cannot replace part of a body,
-- and a retyped near-copy is how details quietly go missing.

DROP FUNCTION IF EXISTS public.raise_invoice_atomic(UUID, UUID, INTEGER, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.raise_invoice_atomic(
  p_shop_id UUID,
  p_receipt_id UUID,
  p_terms_days INTEGER DEFAULT NULL,
  p_delivered_on DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  out_invoice_id UUID,
  out_number TEXT,
  out_token TEXT,
  out_total NUMERIC,
  out_due_on DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop RECORD;
  v_credit RECORD;
  v_customer RECORD;
  v_year INTEGER;
  v_seq INTEGER;
  v_number TEXT;
  v_token TEXT;
  v_terms INTEGER;
  v_due DATE;
  v_lines JSONB;
  v_subtotal NUMERIC := 0;
  v_vat NUMERIC := 0;
  v_issuer JSONB;
  v_bill_to JSONB;
  v_id UUID;
  v_line_count INTEGER;
BEGIN
  -- Owner only. The document carries the business's own tax identity, which is
  -- not a staff decision to publish.
  IF NOT public.is_shop_owner(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Only the owner can raise an invoice';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE shop_id = p_shop_id AND receipt_id = p_receipt_id AND voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This sale already has an invoice';
  END IF;

  -- The lines are the sale itself. Built here rather than accepted from the
  -- caller so an invoice can never claim goods that were not sold.
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'description', s.product_name,
        'quantity', s.quantity,
        'unit_price', COALESCE(s.unit_price, 0),
        'amount', s.total_amount
      )
      ORDER BY s.created_at
    ),
    COALESCE(SUM(s.total_amount), 0),
    COUNT(*)
  INTO v_lines, v_subtotal, v_line_count
  FROM public.sales AS s
  WHERE s.shop_id = p_shop_id
    AND s.receipt_id = p_receipt_id
    AND s.voided_at IS NULL;

  IF COALESCE(v_line_count, 0) = 0 THEN
    RAISE EXCEPTION 'That sale has nothing on it to invoice';
  END IF;

  SELECT * INTO v_credit
  FROM public.credit_sales
  WHERE shop_id = p_shop_id AND receipt_id = p_receipt_id
  LIMIT 1;

  -- Unconditional on purpose. A plpgsql RECORD that has never had a SELECT INTO
  -- run against it is "not assigned yet", and reading a field of it raises
  -- rather than returning null. Running the query even when customer_id is null
  -- leaves the record assigned to all-nulls, which is what the check below
  -- expects.
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = v_credit.customer_id AND shop_id = p_shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'An invoice needs a customer. Put the sale on deni against a customer first.';
  END IF;

  v_terms := COALESCE(p_terms_days, v_shop.default_terms_days, 30);
  IF v_terms < 0 OR v_terms > 365 THEN
    RAISE EXCEPTION 'Payment terms must be between 0 and 365 days';
  END IF;
  v_due := CURRENT_DATE + v_terms;

  -- VAT is shown only when the shop is registered AND has typed its number in.
  -- Kenyan shelf prices include VAT, so this is the portion already inside the
  -- total, not something added on top. The total does not change.
  IF v_shop.vat_registered AND NULLIF(trim(COALESCE(v_shop.vat_number, '')), '') IS NOT NULL THEN
    v_vat := round(v_subtotal - (v_subtotal / 1.16), 2);
  END IF;

  v_issuer := jsonb_build_object(
    'name', v_shop.name,
    'branch_label', v_shop.branch_label,
    'address', v_shop.address,
    'phone', v_shop.phone,
    'email', v_shop.email,
    'kra_pin', v_shop.kra_pin,
    'logo_url', v_shop.logo_url,
    'vat_registered', v_shop.vat_registered,
    'vat_number', v_shop.vat_number,
    'mpesa_paybill', v_shop.mpesa_paybill,
    'mpesa_account', v_shop.mpesa_account,
    'cheque_payee', v_shop.cheque_payee,
    'bank_name', v_shop.bank_name,
    'bank_branch', v_shop.bank_branch,
    'bank_account', v_shop.bank_account
  );

  v_bill_to := jsonb_build_object(
    'name', v_customer.name,
    'address', v_customer.address,
    'phone', v_customer.phone,
    'email', v_customer.email,
    'kra_pin', v_customer.kra_pin
  );

  -- Atomic allocation. INSERT ... ON CONFLICT DO UPDATE increments under the
  -- row lock Postgres takes anyway, so two tills raising an invoice at the same
  -- moment cannot be handed the same number.
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  INSERT INTO public.invoice_counters AS c (shop_id, year, next_seq)
  VALUES (p_shop_id, v_year, 1)
  ON CONFLICT (shop_id, year) DO UPDATE SET next_seq = c.next_seq + 1
  RETURNING c.next_seq INTO v_seq;

  v_number := 'INV-' || v_year::TEXT || '-' || lpad(v_seq::TEXT, 4, '0');
  -- Two UUIDs with the dashes taken out: 64 hex characters, and no dependency
  -- on where pgcrypto happens to live.
  v_token := replace(gen_random_uuid()::TEXT, '-', '')
          || replace(gen_random_uuid()::TEXT, '-', '');

  INSERT INTO public.invoices (
    shop_id, receipt_id, credit_sale_id, customer_id,
    number, seq, year, token,
    issued_on, due_on, terms_days, delivered_on, notes,
    issuer, bill_to, lines,
    subtotal, vat_amount, total, created_by
  )
  VALUES (
    p_shop_id, p_receipt_id, v_credit.id, v_customer.id,
    v_number, v_seq, v_year, v_token,
    CURRENT_DATE, v_due, v_terms, p_delivered_on,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_issuer, v_bill_to, v_lines,
    v_subtotal, v_vat, v_subtotal, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_number, v_token, v_subtotal, v_due;
END;
$$;

GRANT EXECUTE ON FUNCTION public.raise_invoice_atomic(UUID, UUID, INTEGER, DATE, TEXT) TO authenticated;
