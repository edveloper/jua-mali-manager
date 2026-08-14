-- Two policies inherited from the dashboard-era schema, fixed here.

-- ---------------------------------------------------------------------------
-- 1. Expenses become owner-only
-- ---------------------------------------------------------------------------
-- The old policy was FOR ALL to any shop member, so an employee could read,
-- write or delete the entire expense book -- wages, rent, margins -- straight
-- through the API. Only the UI kept them out. The app has always treated the
-- Expenses tab as owner-only, so this aligns the database with that intent.
--
-- Safe for the client: useExpenses() runs for every signed-in user, but an
-- employee simply receives an empty set (RLS filters rather than errors), and
-- the figures derived from it are only rendered on the owner dashboard.
--
-- record_product_restock_atomic is SECURITY DEFINER and already requires an
-- owner, so restock-generated expenses are unaffected.
DROP POLICY IF EXISTS "Users can manage their own shop expenses" ON public.expenses;

DROP POLICY IF EXISTS "Owners can manage expenses" ON public.expenses;
CREATE POLICY "Owners can manage expenses"
ON public.expenses
FOR ALL
USING (public.is_shop_owner(auth.uid(), shop_id))
WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

-- ---------------------------------------------------------------------------
-- 2. Remove the 'attendant' product policies
-- ---------------------------------------------------------------------------
-- "Attendants can update product stock" granted UPDATE on every column of
-- products -- price, cost_price, min_price, max_price included -- to any member
-- whose role was 'owner' or 'attendant'. Anyone given the attendant role could
-- therefore rewrite prices directly and bypass the negotiated-price band
-- enforced by record_product_sale_atomic.
--
-- Nothing in the application ever assigns 'attendant' (createEmployee writes
-- 'employee'), so this is dormant rather than actively exploited, and dropping
-- it cannot lock anyone out. Legitimate stock changes go through the restock and
-- sale RPCs, which are SECURITY DEFINER and unaffected by product policies.
DROP POLICY IF EXISTS "Attendants can update product stock" ON public.products;

-- Exact duplicate of "Users can view products in their shop".
DROP POLICY IF EXISTS "Attendants can view products" ON public.products;
