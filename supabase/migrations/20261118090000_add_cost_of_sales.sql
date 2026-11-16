-- Telling the cost of making the thing from the cost of keeping the doors open.
--
-- A duka's cost of sales looks after itself: it is recorded on the sale as
-- cost_price_at_sale, because the thing sold is the thing bought. A restaurant
-- buys rice and sells pilau, so there is no per-plate cost to record and the
-- ingredient spend lands in running costs instead.
--
-- Net profit is right either way, and that is worth being clear about: nothing
-- here changes what a shop takes home. What it changes is the shape of the
-- answer. Today a restaurant's gross profit equals its sales, which claims a
-- hundred per cent margin, and the one number a restaurant actually manages --
-- what share of takings goes on food -- cannot be worked out at all.
--
-- A flag, not a recipe. Recipes go stale, ingredient prices move weekly, and a
-- stale recipe reports a wrong margin invisibly.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_cost_of_sales BOOLEAN NOT NULL DEFAULT false;

/*
 * Stock purchases can never carry it.
 *
 * An expense written by a restock is already represented in cost of sales
 * through cost_price_at_sale on each sale. Counting it here as well would
 * subtract the same shillings twice and under-report profit, which is a worse
 * failure than the one being fixed: a shop that believes it is losing money
 * stops trading.
 */
UPDATE public.expenses SET is_cost_of_sales = false WHERE source = 'restock';

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_cost_of_sales_not_restock;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_cost_of_sales_not_restock
  CHECK (NOT (is_cost_of_sales AND source = 'restock'));

-- Read on every report, always alongside the shop and the date.
CREATE INDEX IF NOT EXISTS expenses_cost_of_sales_idx
  ON public.expenses (shop_id, date)
  WHERE is_cost_of_sales;
