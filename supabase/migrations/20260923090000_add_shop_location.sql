-- Where a shop actually is, in a form that can be counted.
--
-- `address` has always been free text, which is right for printing on an
-- invoice and useless for everything else. "Next to the Total petrol station"
-- cannot be grouped, compared or aggregated, and the whole point of asking is
-- so that a shopkeeper can one day be told what their neighbours charge.
--
-- Two fields rather than one. County is a closed list of forty-seven and can be
-- relied on. Ward is typed, because Kenya has around fourteen hundred of them
-- and a dropdown that long is worse than a text box; it can be normalised later
-- against what people actually enter, which is the same approach the product
-- catalogue takes.
--
-- Nothing here is required. A shop that would rather not say keeps working
-- exactly as before, and location is only ever published coarsened and only
-- from shops that opted into sharing.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS county TEXT,
  ADD COLUMN IF NOT EXISTS ward TEXT;

CREATE INDEX IF NOT EXISTS shops_county_idx ON public.shops (county) WHERE county IS NOT NULL;

/*
 * Area replaces the exact address in what leaves.
 *
 * A precise address plus a timestamp identifies a single shop on its own, which
 * is the thing the consent copy promises never to share. County and ward are
 * coarse enough to aggregate and still fine enough to be worth something to
 * whoever is comparing prices.
 */
DROP VIEW IF EXISTS public.shared_sales_contributions;
CREATE VIEW public.shared_sales_contributions
WITH (security_invoker = true) AS
SELECT
  sh.data_sharing_token                                   AS contributor,
  sh.business_category                                    AS trade,
  sh.county,
  sh.ward,
  cp.id                                                   AS canonical_id,
  cp.product_type,
  cp.brand,
  cp.size_value,
  cp.size_unit,
  sa.quantity,
  sa.unit_price,
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
