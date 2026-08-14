-- Products are archived rather than deleted.
--
-- stock_movements.product_id is ON DELETE CASCADE, so removing a product also
-- erased every restock record attached to it. Restock spend in the Ops report
-- would silently shrink for past periods, and the expense rows those movements
-- paid for were left dangling. Services already archive via is_active; products
-- now match.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS products_shop_active_idx
  ON public.products (shop_id, is_active);
