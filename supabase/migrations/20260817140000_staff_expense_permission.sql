-- Let trusted staff record spending.
--
-- 20260814170000 made expenses owner-only, which was right at the time: the old
-- policy let ANY member read and write the whole expense book. This narrows that
-- differently rather than reverting it -- staff get in only if the owner has
-- switched the permission on for them, and only to look and to add.
--
-- Deni needs no change here: customers, credit_sales and credit_payments are
-- already scoped to shop members, so that is purely a UI gate.

DROP POLICY IF EXISTS "Owners can manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Owners and permitted staff can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Owners and permitted staff can add expenses" ON public.expenses;
DROP POLICY IF EXISTS "Owners can change expenses" ON public.expenses;
DROP POLICY IF EXISTS "Owners can remove expenses" ON public.expenses;

-- member_can() is already true for owners regardless of the permissions object,
-- so these cover the owner as well.
CREATE POLICY "Owners and permitted staff can view expenses"
ON public.expenses
FOR SELECT
USING (public.member_can(auth.uid(), shop_id, 'record_expenses'));

CREATE POLICY "Owners and permitted staff can add expenses"
ON public.expenses
FOR INSERT
WITH CHECK (public.member_can(auth.uid(), shop_id, 'record_expenses'));

-- Deliberately owner-only. Someone recording the day's transport money is
-- ordinary; someone quietly removing yesterday's records is not, and a shop
-- where staff can delete spending has no record worth trusting.
CREATE POLICY "Owners can change expenses"
ON public.expenses
FOR UPDATE
USING (public.is_shop_owner(auth.uid(), shop_id))
WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

CREATE POLICY "Owners can remove expenses"
ON public.expenses
FOR DELETE
USING (public.is_shop_owner(auth.uid(), shop_id));
