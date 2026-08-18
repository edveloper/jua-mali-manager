-- Checking recorded sales against what M-Pesa actually received.
--
-- No Safaricom integration here on purpose. Daraja needs a Paybill or Till and
-- their Go Live approval, which most shops on personal M-Pesa will never have.
-- This works from the messages already on the owner's phone, matched against the
-- transaction codes staff have been typing in at the till.

CREATE TABLE IF NOT EXISTS public.mpesa_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by UUID,
  entries_seen INTEGER NOT NULL DEFAULT 0,
  entries_new INTEGER NOT NULL DEFAULT 0,
  matched INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mpesa_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  import_id UUID REFERENCES public.mpesa_imports(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  paid_at TIMESTAMPTZ,
  counterparty TEXT,
  direction TEXT NOT NULL DEFAULT 'in',
  raw_text TEXT,
  matched_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  matched_credit_payment_id UUID REFERENCES public.credit_payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The same statement pasted twice must not create a second copy of every
  -- transaction. The M-Pesa code is the natural key.
  UNIQUE (shop_id, code)
);

ALTER TABLE public.mpesa_entries DROP CONSTRAINT IF EXISTS mpesa_entries_direction_check;
ALTER TABLE public.mpesa_entries ADD CONSTRAINT mpesa_entries_direction_check
  CHECK (direction IN ('in', 'out'));

CREATE INDEX IF NOT EXISTS mpesa_entries_shop_paid_idx
  ON public.mpesa_entries (shop_id, paid_at DESC);

ALTER TABLE public.mpesa_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_entries ENABLE ROW LEVEL SECURITY;

-- Owner-only. The point of this screen is finding money that reached the phone
-- without reaching the records, which is not a check staff should administer.
DROP POLICY IF EXISTS "Owners can view mpesa imports" ON public.mpesa_imports;
CREATE POLICY "Owners can view mpesa imports"
ON public.mpesa_imports FOR SELECT
USING (public.is_shop_owner(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Owners can view mpesa entries" ON public.mpesa_entries;
CREATE POLICY "Owners can view mpesa entries"
ON public.mpesa_entries FOR SELECT
USING (public.is_shop_owner(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Owners can forget mpesa entries" ON public.mpesa_entries;
CREATE POLICY "Owners can forget mpesa entries"
ON public.mpesa_entries FOR DELETE
USING (public.is_shop_owner(auth.uid(), shop_id));

-- ---------------------------------------------------------------------------
-- Import and match
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_mpesa_entries_atomic(
  p_shop_id UUID,
  p_entries JSONB
)
RETURNS TABLE (
  import_id UUID,
  entries_seen INTEGER,
  entries_new INTEGER,
  matched INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_import_id UUID;
  v_entry JSONB;
  v_code TEXT;
  v_amount NUMERIC;
  v_paid_at TIMESTAMPTZ;
  v_direction TEXT;
  v_sale_id UUID;
  v_payment_id UUID;
  v_entry_id UUID;
  v_seen INTEGER := 0;
  v_new INTEGER := 0;
  v_matched INTEGER := 0;
  v_was_new BOOLEAN;
BEGIN
  IF NOT public.is_shop_owner(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'Only the shop owner can check M-Pesa records';
  END IF;

  IF p_entries IS NULL OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'Nothing to check';
  END IF;

  INSERT INTO public.mpesa_imports (shop_id, imported_by)
  VALUES (p_shop_id, auth.uid())
  RETURNING mpesa_imports.id INTO v_import_id;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_code := upper(trim(v_entry ->> 'code'));
    CONTINUE WHEN v_code IS NULL OR v_code = '';

    v_seen := v_seen + 1;
    v_amount := COALESCE((v_entry ->> 'amount')::NUMERIC, 0);
    v_paid_at := NULLIF(v_entry ->> 'paid_at', '')::TIMESTAMPTZ;
    v_direction := COALESCE(NULLIF(v_entry ->> 'direction', ''), 'in');

    v_sale_id := NULL;
    v_payment_id := NULL;

    -- Match on the code staff typed at the till. Cancelled sales are skipped:
    -- the money may well have arrived, but there is no live sale behind it.
    IF v_direction = 'in' THEN
      SELECT s.id INTO v_sale_id
      FROM public.sales AS s
      WHERE s.shop_id = p_shop_id
        AND s.voided_at IS NULL
        AND upper(s.payment_reference) = v_code
      LIMIT 1;

      IF v_sale_id IS NULL THEN
        SELECT cp.id INTO v_payment_id
        FROM public.credit_payments AS cp
        WHERE cp.shop_id = p_shop_id
          AND upper(cp.payment_reference) = v_code
        LIMIT 1;
      END IF;
    END IF;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.mpesa_entries AS me
      WHERE me.shop_id = p_shop_id AND me.code = v_code
    ) INTO v_was_new;

    INSERT INTO public.mpesa_entries AS me (
      shop_id, import_id, code, amount, paid_at, counterparty,
      direction, raw_text, matched_sale_id, matched_credit_payment_id
    ) VALUES (
      p_shop_id, v_import_id, v_code, v_amount, v_paid_at,
      NULLIF(trim(v_entry ->> 'counterparty'), ''),
      v_direction, NULLIF(trim(v_entry ->> 'raw_text'), ''),
      v_sale_id, v_payment_id
    )
    ON CONFLICT (shop_id, code) DO UPDATE
      SET matched_sale_id = EXCLUDED.matched_sale_id,
          matched_credit_payment_id = EXCLUDED.matched_credit_payment_id,
          amount = EXCLUDED.amount,
          paid_at = COALESCE(EXCLUDED.paid_at, me.paid_at)
    RETURNING me.id INTO v_entry_id;

    IF v_was_new THEN
      v_new := v_new + 1;
    END IF;
    IF v_sale_id IS NOT NULL OR v_payment_id IS NOT NULL THEN
      v_matched := v_matched + 1;
    END IF;
  END LOOP;

  UPDATE public.mpesa_imports AS mi
  SET entries_seen = v_seen, entries_new = v_new, matched = v_matched
  WHERE mi.id = v_import_id;

  RETURN QUERY SELECT v_import_id, v_seen, v_new, v_matched;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_mpesa_entries_atomic(UUID, JSONB) TO authenticated;
