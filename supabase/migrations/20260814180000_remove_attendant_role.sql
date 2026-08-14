-- Removes the vestigial 'attendant' value from shop_role. It overlapped with
-- 'employee', was added outside migration history, and the only policies using
-- it were dropped in 20260814170000.
--
-- Worth removing rather than ignoring: EmployeeManager lists staff with
-- .eq('role', 'employee'), so a member set to 'attendant' would hold full shop
-- access while being invisible in the Employees list and unremovable from the UI.
--
-- Postgres cannot drop a single enum value, so the type is rebuilt. The whole
-- thing is guarded and fail-safe: it no-ops if 'attendant' is already absent,
-- and aborts without changing anything if any row still uses it.
--
-- Requires 20260814175000_clean_orphan_memberships.sql to have run first.

DO $$
DECLARE
  v_rows INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'shop_role'
      AND e.enumlabel = 'attendant'
  ) THEN
    RAISE NOTICE 'shop_role has no attendant value. Nothing to do.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_rows
  FROM public.shop_members
  WHERE role::text = 'attendant';

  IF v_rows > 0 THEN
    RAISE EXCEPTION
      'Cannot remove attendant: % shop_members row(s) still use it. Reassign them to owner or employee first.', v_rows;
  END IF;

  -- Postgres refuses to retype a column that a policy depends on. Two objects
  -- pin shop_members.role:
  --
  --   1. get_user_shop_role() -- its return type is shop_role.
  --   2. shops.owners_can_update_shops -- a dashboard-era policy that inlines
  --      "AND role = 'owner'::shop_role" instead of calling is_shop_owner().
  --
  -- Both are dropped here. The policy is a duplicate of "Owners can update their
  -- shop" from the original migration, which expresses the same rule through the
  -- helper, so dropping it removes no access. The helper's body is stored as
  -- text and re-parsed at call time, so policies built on it carry no hard
  -- dependency on the enum and this class of failure cannot recur.
  EXECUTE 'DROP FUNCTION IF EXISTS public.get_user_shop_role(uuid, uuid)';
  EXECUTE 'DROP POLICY IF EXISTS owners_can_update_shops ON public.shops';

  -- Recreated before the swap so shops is never left without an UPDATE policy,
  -- even briefly.
  EXECUTE 'DROP POLICY IF EXISTS "Owners can update their shop" ON public.shops';
  EXECUTE 'CREATE POLICY "Owners can update their shop" ON public.shops '
       || 'FOR UPDATE USING (public.is_shop_owner(auth.uid(), id))';

  EXECUTE 'ALTER TYPE public.shop_role RENAME TO shop_role_legacy';
  EXECUTE 'CREATE TYPE public.shop_role AS ENUM (''owner'', ''employee'')';

  EXECUTE 'ALTER TABLE public.shop_members ALTER COLUMN role DROP DEFAULT';
  EXECUTE 'ALTER TABLE public.shop_members ALTER COLUMN role TYPE public.shop_role USING role::text::public.shop_role';
  EXECUTE 'ALTER TABLE public.shop_members ALTER COLUMN role SET DEFAULT ''employee''::public.shop_role';

  EXECUTE 'DROP TYPE public.shop_role_legacy';

  RAISE NOTICE 'shop_role rebuilt as (owner, employee).';
END $$;

-- Recreated against whichever shop_role now exists. is_shop_owner and
-- is_shop_member are unaffected: their bodies are stored as text and re-parsed
-- at call time, so they carry no hard dependency on the type.
CREATE OR REPLACE FUNCTION public.get_user_shop_role(p_user_id UUID, p_shop_id UUID)
RETURNS public.shop_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.shop_members
  WHERE user_id = p_user_id AND shop_id = p_shop_id
  LIMIT 1
$$;
