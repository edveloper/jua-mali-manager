-- Invoices that know what was already paid at the counter.
--
-- raise_invoice_atomic bills every line on the receipt, which is right: the
-- customer should see everything they took. What it missed is that some of it
-- may already have been paid for. That money sits in sale_payments, which this
-- function never looked at, so a basket settled 20,000 in cash and 78,000 on
-- deni produced an invoice demanding the full 98,000.
--
-- The fix is the honest shape for a document like this: bill the whole basket,
-- show what was paid at the time as a deduction, leave the balance. That is also
-- what the customer expects, because it is what they remember happening.
--
-- Reproduced in full rather than patched: plpgsql cannot replace part of a body.

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
  v_paid_at_sale NUMERIC := 0;
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

  -- Money handed over at the counter for this same receipt. A basket settled
  -- partly in cash and partly on deni has both, and an invoice that ignored the
  -- cash would bill the customer for money they have already paid.
  SELECT COALESCE(SUM(sp.amount), 0) INTO v_paid_at_sale
  FROM public.sale_payments AS sp
  WHERE sp.shop_id = p_shop_id AND sp.receipt_id = p_receipt_id;

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
    subtotal, vat_amount, total, paid_at_sale, created_by
  )
  VALUES (
    p_shop_id, p_receipt_id, v_credit.id, v_customer.id,
    v_number, v_seq, v_year, v_token,
    CURRENT_DATE, v_due, v_terms, p_delivered_on,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    v_issuer, v_bill_to, v_lines,
    v_subtotal, v_vat, v_subtotal, v_paid_at_sale, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_number, v_token, v_subtotal, v_due;
END;
$$;

GRANT EXECUTE ON FUNCTION public.raise_invoice_atomic(UUID, UUID, INTEGER, DATE, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.get_public_invoice(TEXT);

CREATE OR REPLACE FUNCTION public.get_public_invoice(p_token TEXT)
RETURNS TABLE (
  number TEXT,
  issued_on DATE,
  due_on DATE,
  delivered_on DATE,
  notes TEXT,
  issuer JSONB,
  bill_to JSONB,
  lines JSONB,
  subtotal NUMERIC,
  vat_amount NUMERIC,
  total NUMERIC,
  amount_paid NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_paid NUMERIC := 0;
  v_status TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN;
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_invoice.credit_sale_id IS NOT NULL THEN
    SELECT COALESCE(cs.amount_paid, 0) INTO v_paid
    FROM public.credit_sales AS cs
    WHERE cs.id = v_invoice.credit_sale_id;

    -- Plus whatever was handed over at the counter when the goods went out.
    -- Read from the invoice rather than summed live: it is part of what the
    -- document said when it was sent.
    v_paid := COALESCE(v_paid, 0) + COALESCE(v_invoice.paid_at_sale, 0);
  ELSE
    -- No credit record means it was settled in full at the till.
    v_paid := v_invoice.total;
  END IF;

  -- Derived, so it can never disagree with the credit book.
  v_status := CASE
    WHEN v_invoice.voided_at IS NOT NULL THEN 'cancelled'
    WHEN COALESCE(v_paid, 0) >= v_invoice.total THEN 'paid'
    WHEN v_invoice.due_on < CURRENT_DATE THEN 'overdue'
    WHEN COALESCE(v_paid, 0) > 0 THEN 'part_paid'
    ELSE 'sent'
  END;

  RETURN QUERY SELECT
    v_invoice.number, v_invoice.issued_on, v_invoice.due_on, v_invoice.delivered_on,
    v_invoice.notes, v_invoice.issuer, v_invoice.bill_to, v_invoice.lines,
    v_invoice.subtotal, v_invoice.vat_amount, v_invoice.total,
    COALESCE(v_paid, 0), v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_invoice(TEXT) TO anon, authenticated;
