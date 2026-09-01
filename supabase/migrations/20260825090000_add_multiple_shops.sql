-- More than one shop per account.
--
-- The data model already allowed this. Every table carries shop_id and every
-- policy asks is_shop_member(auth.uid(), shop_id), so a person belonging to two
-- shops has always been correctly scoped at the database level. What stopped it
-- was one guard in create_shop_with_owner, put there because the client used
-- .maybeSingle() and would break on a second row.
--
-- That is worth stating plainly: the guard was hiding a client bug, not
-- enforcing a rule. Anyone added as staff to a second shop would have been
-- locked out of their account entirely, not merely shown the wrong shop.
--
-- Two shops can be separate businesses or two branches of one. The difference is
-- a single optional link: shops sharing a business_id are branches, a shop with
-- none stands alone. That is enough to group them in the switcher and to add
-- combined reporting later without moving anything.

-- ---------------------------------------------------------------------------
-- Businesses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shops_business_idx ON public.shops (business_id);

-- Existing shops stay standalone. A business is only created when somebody
-- actually says two shops are the same one.

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read their business" ON public.businesses;
CREATE POLICY "Members can read their business"
ON public.businesses
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.shops AS s
    WHERE s.business_id = businesses.id
      AND public.is_shop_member(auth.uid(), s.id)
  )
);

-- No client INSERT or UPDATE: businesses are created by the function below, as
-- a side effect of saying one shop is a branch of another.

-- ---------------------------------------------------------------------------
-- A trap, removed
-- ---------------------------------------------------------------------------
-- get_user_shop_id() returned "a shop this user belongs to" with LIMIT 1 and an
-- arbitrary order. Nothing calls it, which is the only reason multi-shop is
-- safe to turn on. Dropped rather than left lying around: it is exactly the
-- helper somebody reaches for inside a policy, and the day that happens half of
-- a person's shops quietly stop being visible.
DROP FUNCTION IF EXISTS public.get_user_shop_id(UUID);

-- ---------------------------------------------------------------------------
-- Creating one
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_shop_with_owner(TEXT, TEXT, TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.create_shop_with_owner(TEXT, TEXT, TEXT, BOOLEAN, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.create_shop_with_owner(
  p_name TEXT,
  p_business_category TEXT DEFAULT 'retail',
  p_offering_mode TEXT DEFAULT 'products',
  p_single_offering BOOLEAN DEFAULT false,
  p_currency TEXT DEFAULT 'KES',
  -- An existing shop this new one is a branch of. Null means a separate
  -- business, which is the ordinary case.
  p_branch_of UUID DEFAULT NULL
)
RETURNS public.shops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop public.shops;
  v_sibling public.shops;
  v_business_id UUID;
  v_owned INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a shop';
  END IF;

  IF COALESCE(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Shop name is required';
  END IF;

  -- A sanity bound, not a plan limit. Nobody runs twenty shops from one phone,
  -- and a runaway client should not be able to fill the table. The paid-plan
  -- check belongs here when pricing is settled.
  SELECT COUNT(*) INTO v_owned
  FROM public.shop_members
  WHERE user_id = auth.uid() AND role = 'owner';

  IF v_owned >= 20 THEN
    RAISE EXCEPTION 'That is a lot of shops. Get in touch and we will sort it out.';
  END IF;

  IF p_branch_of IS NOT NULL THEN
    SELECT * INTO v_sibling FROM public.shops WHERE id = p_branch_of;

    IF NOT FOUND OR NOT public.is_shop_owner(auth.uid(), p_branch_of) THEN
      RAISE EXCEPTION 'You can only add a branch to a shop you own';
    END IF;

    -- The first branch is what turns a shop into a business. Until somebody
    -- says two shops are the same one, there is nothing to group.
    IF v_sibling.business_id IS NULL THEN
      INSERT INTO public.businesses (name, created_by)
      VALUES (v_sibling.name, auth.uid())
      RETURNING id INTO v_business_id;

      UPDATE public.shops SET business_id = v_business_id WHERE id = v_sibling.id;
    ELSE
      v_business_id := v_sibling.business_id;
    END IF;
  END IF;

  INSERT INTO public.shops (
    name, business_category, offering_mode, single_offering, currency, business_id
  )
  VALUES (
    trim(p_name),
    COALESCE(p_business_category, 'retail'),
    COALESCE(p_offering_mode, 'products'),
    COALESCE(p_single_offering, false),
    COALESCE(p_currency, 'KES'),
    v_business_id
  )
  RETURNING * INTO v_shop;

  INSERT INTO public.shop_members (shop_id, user_id, role)
  VALUES (v_shop.id, auth.uid(), 'owner');

  RETURN v_shop;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_shop_with_owner(TEXT, TEXT, TEXT, BOOLEAN, TEXT, UUID) TO authenticated;
