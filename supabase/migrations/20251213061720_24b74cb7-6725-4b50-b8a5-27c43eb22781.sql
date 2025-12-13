-- Drop the existing insert policy
DROP POLICY IF EXISTS "Authenticated users can create shops" ON public.shops;

-- Create a simpler policy that works reliably
CREATE POLICY "Authenticated users can create shops" 
ON public.shops 
FOR INSERT 
WITH CHECK (true);