-- Listening to what shops actually type.
--
-- The catalogue was seeded from what I guessed shops sell. The honest way to
-- grow it is the opposite: watch what people really enter, and promote what
-- recurs. Every product a shop adds that the matcher could not place is already
-- sitting in `products` with a null canonical_id, so nothing new needs
-- capturing. What was missing was a way to look.
--
-- This is an operator's query, not a feature. It crosses shops, so it is
-- service-role only, exactly like the sharing view. It reads product names and
-- nothing else: no prices, no quantities, no customers, no shop names.
--
-- Worth being clear about what this is for. Improving the shared vocabulary is
-- ordinary operational use of data the app already holds. It is not the data
-- business, it is not published, and it is not gated on consent for that reason
-- -- but neither is it a licence to go looking at anything else.

CREATE OR REPLACE VIEW public.unmatched_product_names AS
SELECT
  -- Grouped case-insensitively and with whitespace collapsed, so "Fresh Fri"
  -- and "fresh  fri" count as one voice rather than two.
  lower(regexp_replace(trim(p.name), '\s+', ' ', 'g'))    AS typed_name,
  s.business_category                                      AS trade,
  COUNT(DISTINCT p.shop_id)                                AS shops,
  COUNT(*)                                                 AS times,
  MIN(p.created_at)                                        AS first_seen,
  MAX(p.created_at)                                        AS last_seen
FROM public.products AS p
JOIN public.shops AS s ON s.id = p.shop_id
WHERE p.canonical_id IS NULL
  AND p.is_active
  AND trim(COALESCE(p.name, '')) <> ''
GROUP BY 1, 2
ORDER BY COUNT(DISTINCT p.shop_id) DESC, COUNT(*) DESC;

REVOKE ALL ON public.unmatched_product_names FROM anon, authenticated;

COMMENT ON VIEW public.unmatched_product_names IS
  'Product names no catalogue entry matched, most widely typed first. Promote what several shops enter; ignore what one shop typed once.';
