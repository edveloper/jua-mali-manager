-- Closing the till.
--
-- Knowing what should be in the drawer is arithmetic; writing down what actually
-- was there is a control. With staff recording their own sales and agreeing
-- their own prices, the difference between the two is the number worth keeping.

CREATE TABLE IF NOT EXISTS public.till_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  counted_for DATE NOT NULL,
  expected_cash NUMERIC(12,2) NOT NULL,
  counted_cash NUMERIC(12,2) NOT NULL,
  difference NUMERIC(12,2) NOT NULL,
  notes TEXT,
  counted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One count per day. Recounting corrects the day rather than adding a second
  -- opinion about it.
  UNIQUE (shop_id, counted_for)
);

CREATE INDEX IF NOT EXISTS till_counts_shop_date_idx
  ON public.till_counts (shop_id, counted_for DESC);

ALTER TABLE public.till_counts ENABLE ROW LEVEL SECURITY;

-- Owner-only: the count is partly a check on staff, so staff should not be able
-- to write or rewrite it.
DROP POLICY IF EXISTS "Owners can view till counts" ON public.till_counts;
CREATE POLICY "Owners can view till counts"
ON public.till_counts
FOR SELECT
USING (public.is_shop_owner(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Owners can record till counts" ON public.till_counts;
CREATE POLICY "Owners can record till counts"
ON public.till_counts
FOR INSERT
WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Owners can correct till counts" ON public.till_counts;
CREATE POLICY "Owners can correct till counts"
ON public.till_counts
FOR UPDATE
USING (public.is_shop_owner(auth.uid(), shop_id))
WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));
