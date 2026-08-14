-- SECURITY FIX: cross-tenant shop takeover.
--
-- Two inherited policies combined into a full breach:
--
--   shops."Allow authenticated read"                  USING (true)
--   shop_members."Enable insert for users based on user_id"
--                                                     WITH CHECK (auth.uid() = user_id)
--
-- The first let any signed-in user enumerate every shop_id in the database. The
-- second checked only WHO was inserting, never WHICH shop or WHAT role -- so any
-- authenticated user could insert {shop_id: <anyone's>, user_id: <self>,
-- role: 'owner'} and take ownership of another business. Every downstream table
-- then granted access via is_shop_member/is_shop_owner.
--
-- Separately, shops."anyone_can_insert_shops" WITH CHECK (true) applied to the
-- public role, allowing anonymous shop creation. It is the policy that
-- 20260223090000 intended to replace, surviving under a different name.
--
-- Approach: membership is no longer writable from the client at all. Shop
-- creation moves into a SECURITY DEFINER function that creates the shop and its
-- owner row together, and employee creation already goes through the
-- create-employee Edge Function. That leaves no client-side path to grant
-- oneself access to anything.

-- ---------------------------------------------------------------------------
-- 1. shops: one scoped read policy, no client INSERT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated read" ON public.shops;
DROP POLICY IF EXISTS "anyone_can_insert_shops" ON public.shops;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can create shops" ON public.shops;
DROP POLICY IF EXISTS "members_can_read_shops" ON public.shops;

CREATE POLICY "Members can read their shop"
ON public.shops
FOR SELECT
USING (public.is_shop_member(auth.uid(), id));

-- No INSERT policy: shops are created only via create_shop_with_owner() below.
-- "Owners can update their shop" (20260814180000) is left in place.

-- ---------------------------------------------------------------------------
-- 2. shop_members: readable by shop mates, writable by nobody client-side
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public.shop_members;
DROP POLICY IF EXISTS "Allow individual read" ON public.shop_members;
DROP POLICY IF EXISTS "shop_members_select_policy" ON public.shop_members;
DROP POLICY IF EXISTS "Members can view shop members" ON public.shop_members;
DROP POLICY IF EXISTS "Owners can insert shop members" ON public.shop_members;

CREATE POLICY "Members can view shop members"
ON public.shop_members
FOR SELECT
USING (public.is_shop_member(auth.uid(), shop_id));

-- No INSERT or DELETE policy on purpose. Rows are created by
-- create_shop_with_owner() and the create-employee Edge Function, and removed by
-- the remove-employee Edge Function -- all of which run with elevated rights.
-- "Owners can update shop members" (20260814090000) stays, for permissions.

-- ---------------------------------------------------------------------------
-- 3. profiles: let shop mates see each other
-- ---------------------------------------------------------------------------
-- The only SELECT policy was auth.uid() = id, so an owner could not read their
-- own employees' profiles -- which is why the Employees list falls back to
-- "New Staff" and "Invited User" instead of showing real names.
--
-- SECURITY DEFINER so the lookup does not re-enter shop_members' own RLS.
CREATE OR REPLACE FUNCTION public.shares_shop_with(p_viewer UUID, p_target UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shop_members a
    JOIN public.shop_members b ON b.shop_id = a.shop_id
    WHERE a.user_id = p_viewer
      AND b.user_id = p_target
  )
$$;

GRANT EXECUTE ON FUNCTION public.shares_shop_with(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view profiles in their shop"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR public.shares_shop_with(auth.uid(), id)
);

-- ---------------------------------------------------------------------------
-- 4. Shop creation, atomically with its owner
-- ---------------------------------------------------------------------------
-- Replaces the old signup sequence of "insert shop, read it back, insert
-- membership", which needed a permissive read policy for the RETURNING clause
-- and left an orphan shop behind if the membership insert failed.
CREATE OR REPLACE FUNCTION public.create_shop_with_owner(
  p_name TEXT,
  p_business_category TEXT DEFAULT 'retail',
  p_offering_mode TEXT DEFAULT 'products',
  p_single_offering BOOLEAN DEFAULT false,
  p_currency TEXT DEFAULT 'KES'
)
RETURNS public.shops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop public.shops;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a shop';
  END IF;

  IF COALESCE(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Shop name is required';
  END IF;

  -- The app assumes one shop per user (AuthContext uses maybeSingle()).
  IF EXISTS (SELECT 1 FROM public.shop_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'This account already belongs to a shop';
  END IF;

  INSERT INTO public.shops (name, business_category, offering_mode, single_offering, currency)
  VALUES (
    trim(p_name),
    COALESCE(p_business_category, 'retail'),
    COALESCE(p_offering_mode, 'products'),
    COALESCE(p_single_offering, false),
    COALESCE(p_currency, 'KES')
  )
  RETURNING * INTO v_shop;

  INSERT INTO public.shop_members (shop_id, user_id, role)
  VALUES (v_shop.id, auth.uid(), 'owner');

  RETURN v_shop;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_shop_with_owner(TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;
