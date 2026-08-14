-- Clears orphaned shop_members rows and stops them recurring.
--
-- shop_members.user_id had no foreign key to auth.users, so deleting a user left
-- their membership row behind indefinitely. Three such rows existed on
-- "Ochieng's Stall", all role 'attendant', dating from the December 2025
-- test-account cleanup.
--
-- They are inert -- with no auth user there is nobody to sign in as -- but they
-- blocked removing the 'attendant' enum value, and more would accumulate every
-- time an account was deleted.
--
-- Run this BEFORE 20260814180000_remove_attendant_role.sql.

-- Any row here is unusable by definition: no auth user means no possible login.
DELETE FROM public.shop_members sm
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = sm.user_id
);

-- Make the database enforce it from now on.
ALTER TABLE public.shop_members
  DROP CONSTRAINT IF EXISTS shop_members_user_id_fkey;

ALTER TABLE public.shop_members
  ADD CONSTRAINT shop_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- NOTE: deliberately NOT adding the equivalent constraint to public.profiles.
-- Profiles are kept on purpose after an account is deleted, so that sales still
-- resolve to a name via sales.sold_by. A cascade there would erase exactly the
-- history the remove-employee function was written to preserve.
