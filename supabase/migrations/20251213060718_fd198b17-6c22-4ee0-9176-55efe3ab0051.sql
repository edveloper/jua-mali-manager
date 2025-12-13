-- Drop problematic policies
DROP POLICY IF EXISTS "Owners can insert shop members" ON public.shop_members;
DROP POLICY IF EXISTS "Members can view shop members" ON public.shop_members;

-- Create a helper function to check if a shop has any members (for first-time shop creation)
CREATE OR REPLACE FUNCTION public.shop_has_no_members(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_id = p_shop_id
  )
$$;

-- Create a helper function to check if user is member of a shop
CREATE OR REPLACE FUNCTION public.is_shop_member(p_user_id uuid, p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE user_id = p_user_id AND shop_id = p_shop_id
  )
$$;

-- Allow users to insert shop members if:
-- 1. They are the shop owner, OR
-- 2. The shop has no members yet (first-time shop creation)
CREATE POLICY "Owners can insert shop members" 
ON public.shop_members 
FOR INSERT 
WITH CHECK (
  is_shop_owner(auth.uid(), shop_id) 
  OR (auth.uid() = user_id AND shop_has_no_members(shop_id))
);

-- Use security definer function to check membership
CREATE POLICY "Members can view shop members" 
ON public.shop_members 
FOR SELECT 
USING (is_shop_member(auth.uid(), shop_id));