-- Who recorded a piece of spending.
--
-- Every other money-moving table already says who did it -- sales have sold_by,
-- credit and supplier payments have recorded_by, counts have counted_by. Only
-- expenses did not, which stopped mattering the moment staff were given
-- permission to record spending: the one entry a member of staff can make on
-- their own was the one entry with no name against it.
--
-- The default does the work. Expenses are inserted straight from the client and
-- also from inside record_product_restock_atomic and
-- record_supplier_payment_atomic; auth.uid() reads the caller's token, and a
-- SECURITY DEFINER function does not change who the caller is, so all three
-- paths fill it in without being touched.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS recorded_by UUID DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS expenses_recorded_by_idx
  ON public.expenses (shop_id, recorded_by);

-- Deliberately not backfilled. Everything recorded before now has no honest
-- answer, and guessing "the owner" would put a name against entries nobody can
-- vouch for. The activity log shows these as an unknown hand.
