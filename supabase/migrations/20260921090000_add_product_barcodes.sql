-- The number on the packet.
--
-- A liquor store carries a shelf of bottles whose names differ by one word and
-- whose labels differ by a colour. Finding "4TH STREET" among three hundred
-- products by typing is slower than reading the barcode aloud, and picking the
-- wrong one is a price and a stock level both wrong at once.
--
-- This is the half that needs no camera: a field to keep the number in, and a
-- search that matches it. Scanning with the camera can come later and will find
-- the same column waiting for it.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode TEXT;

/*
 * One barcode, one product, per shop.
 *
 * The entire value of scanning is that the answer is unambiguous. Two products
 * sharing a number turns a scan into a question, which is worse than no scan at
 * all because it looks like it worked. Partial, so the many products that never
 * get a barcode do not all collide on NULL.
 *
 * Shop-scoped rather than global: the same bottle genuinely exists in two shops,
 * as two separate product rows with their own stock and their own price.
 */
CREATE UNIQUE INDEX IF NOT EXISTS products_shop_barcode_key
  ON public.products (shop_id, barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

-- Looked up on every scan, and a scan happens mid-sale with a customer waiting.
CREATE INDEX IF NOT EXISTS products_barcode_idx
  ON public.products (barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';
