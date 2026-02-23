-- Harden shops INSERT policy. Keep creation limited to authenticated users.
DROP POLICY IF EXISTS "Authenticated users can create shops" ON public.shops;

CREATE POLICY "Authenticated users can create shops"
ON public.shops
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
