-- Drop the restrictive policy
DROP POLICY IF EXISTS "Authenticated users can create shops" ON public.shops;

-- Recreate as a permissive policy (default)
CREATE POLICY "Authenticated users can create shops" 
ON public.shops 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);