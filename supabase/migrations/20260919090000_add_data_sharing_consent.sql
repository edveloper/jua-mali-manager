-- Asking before collecting, rather than after.
--
-- The point of doing this now, while there is almost no data and almost no
-- users, is that consent obtained late is not consent. Retrofitting it onto
-- records already gathered means going back to every shop and asking, and some
-- will say no purely because they were asked second.
--
-- Three rules this encodes:
--
--   Off unless somebody said yes. A default of true is not a decision, and
--   under the Data Protection Act 2019 consent has to be freely given,
--   specific, informed and unambiguous. A checkbox nobody saw is none of those.
--
--   Per shop, not per person. The records belong to the business. An owner with
--   three shops may reasonably answer differently for each, and staff must not
--   be able to answer at all.
--
--   Every change is kept, not just the current state. A boolean alone cannot
--   answer "was this shop sharing on the third of September", which is exactly
--   the question that gets asked when it matters.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS data_sharing_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_sharing_decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_sharing_decided_by UUID;

-- A stable name for the shop that is not the shop's id.
--
-- Anything published has to be countable by contributor, so you can refuse to
-- report a figure drawn from too few shops. Doing that with the shop id would
-- put the identifier in the export; hashing the id would too, since whoever
-- holds the list of ids can reverse it. A random token, generated once, can be
-- counted and cannot be walked back.
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS data_sharing_token UUID;

CREATE TABLE IF NOT EXISTS public.data_sharing_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  consented BOOLEAN NOT NULL,
  decided_by UUID,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_sharing_consent_log_shop_idx
  ON public.data_sharing_consent_log (shop_id, decided_at DESC);

ALTER TABLE public.data_sharing_consent_log ENABLE ROW LEVEL SECURITY;

-- Owners may read their own history and nobody writes it from a client: the
-- trigger below is the only author, so the record cannot be edited into
-- agreeing with whatever the current setting happens to be.
DROP POLICY IF EXISTS "Owners read their own consent history" ON public.data_sharing_consent_log;
CREATE POLICY "Owners read their own consent history"
  ON public.data_sharing_consent_log FOR SELECT
  TO authenticated
  USING (public.is_shop_owner(auth.uid(), shop_id));

CREATE OR REPLACE FUNCTION public.log_data_sharing_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.data_sharing_consent IS DISTINCT FROM OLD.data_sharing_consent THEN
    NEW.data_sharing_decided_at := now();
    NEW.data_sharing_decided_by := auth.uid();

    -- Issued on the first yes and then left alone. Regenerating it on every
    -- change would break the thread between a shop's contributions over time,
    -- which is what makes counting contributors mean anything.
    IF NEW.data_sharing_consent AND NEW.data_sharing_token IS NULL THEN
      NEW.data_sharing_token := gen_random_uuid();
    END IF;

    INSERT INTO public.data_sharing_consent_log (shop_id, consented, decided_by)
    VALUES (NEW.id, NEW.data_sharing_consent, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_log_data_sharing_consent ON public.shops;
CREATE TRIGGER shops_log_data_sharing_consent
  BEFORE UPDATE ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.log_data_sharing_consent();

-- What may leave, expressed as a view rather than as a promise in a document.
--
-- A written assurance that customer names are never shared is worth exactly as
-- much as the care taken by whoever writes the next export query. A view is the
-- single place the data comes from, and it simply has no column to leak: no
-- customer, no phone, no deni, no totals, no takings, no profit, no shop name.
--
-- Only rows from shops that said yes, and only products matched to the shared
-- catalogue, because an unmatched name is somebody's own wording and can carry
-- anything in it.
--
-- security_invoker matters: without it a view runs with its owner's rights and
-- would hand every shop's sales to any signed-in user who queried it. With it,
-- row level security still applies and only the service role sees across shops.
DROP VIEW IF EXISTS public.shared_sales_contributions;
CREATE VIEW public.shared_sales_contributions
WITH (security_invoker = true) AS
SELECT
  sh.data_sharing_token                                   AS contributor,
  sh.business_category                                    AS trade,
  cp.id                                                   AS canonical_id,
  cp.product_type,
  cp.brand,
  cp.size_value,
  cp.size_unit,
  sa.quantity,
  sa.unit_price,
  -- The day, never the timestamp. A precise time alongside a location
  -- identifies a single shop on its own.
  (sa.created_at AT TIME ZONE 'Africa/Nairobi')::date     AS sold_on
FROM public.sales AS sa
JOIN public.shops AS sh ON sh.id = sa.shop_id
JOIN public.products AS p ON p.id = sa.product_id
JOIN public.canonical_products AS cp ON cp.id = p.canonical_id
WHERE sh.data_sharing_consent = true
  AND sa.unit_price IS NOT NULL;

REVOKE ALL ON public.shared_sales_contributions FROM anon, authenticated;

COMMENT ON VIEW public.shared_sales_contributions IS
  'Rows a consenting shop contributes. Never publish a figure drawn from fewer than five distinct contributors, and never at finer than ward level.';
