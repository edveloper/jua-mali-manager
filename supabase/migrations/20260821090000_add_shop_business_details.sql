-- The details a shop needs before it can put its name on a document.
--
-- Everything here is optional at the database level on purpose. It is gathered
-- when the first invoice is raised, not at sign-up: somebody who has not yet
-- recorded a sale has no reason to hand over a KRA PIN, and every extra field on
-- a sign-up form is a field somebody abandons.
--
-- Deliberately no CHECK tying vat_number to vat_registered. The settings form
-- saves as it goes, so a half-filled pair is a normal intermediate state rather
-- than an error. The invoice decides what to print: a VAT line appears only when
-- the shop is registered AND has a number, and never otherwise.

ALTER TABLE public.shops
  -- Identity, printed top left
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS kra_pin TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,

  -- Distinguishes two sheets from the same business
  ADD COLUMN IF NOT EXISTS branch_label TEXT,

  -- VAT. Two columns rather than one, because "not registered" and "registered
  -- but the number is not typed in yet" are different states and only the second
  -- should ever produce a VAT line.
  ADD COLUMN IF NOT EXISTS vat_registered BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,

  -- How to pay. This is the part that turns a document into money.
  ADD COLUMN IF NOT EXISTS mpesa_paybill TEXT,
  ADD COLUMN IF NOT EXISTS mpesa_account TEXT,
  ADD COLUMN IF NOT EXISTS cheque_payee TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT,

  -- Days from issue to due. 0 means payable on delivery.
  ADD COLUMN IF NOT EXISTS default_terms_days INTEGER NOT NULL DEFAULT 30;

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_default_terms_days_check;
ALTER TABLE public.shops
  ADD CONSTRAINT shops_default_terms_days_check
  CHECK (default_terms_days >= 0 AND default_terms_days <= 365);

-- ---------------------------------------------------------------------------
-- Tighten the update policy while we are here
-- ---------------------------------------------------------------------------
-- The existing policy has USING but no WITH CHECK, so it tests the row being
-- updated and not the row being written. Nothing exploitable has come of it, but
-- an UPDATE policy without WITH CHECK is the shape that lets a row be edited out
-- of the owner's own scope, and this table is about to hold more of value.
DROP POLICY IF EXISTS "Owners can update their shop" ON public.shops;
CREATE POLICY "Owners can update their shop"
ON public.shops
FOR UPDATE
USING (public.is_shop_owner(auth.uid(), id))
WITH CHECK (public.is_shop_owner(auth.uid(), id));

-- ---------------------------------------------------------------------------
-- Somewhere to keep a logo
-- ---------------------------------------------------------------------------
-- Public read is deliberate and required: the logo appears on an invoice served
-- at an unauthenticated link, so the customer's browser fetches it with no
-- session. Nothing private goes in this bucket, only a mark a business already
-- prints on its own paper.
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-logos', 'shop-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Files live at <shop_id>/logo.<ext>, so the first path segment is the shop and
-- can be checked against ownership. The regex guard matters: without it a file
-- uploaded to a non-uuid folder makes the cast raise instead of simply denying.
CREATE OR REPLACE FUNCTION public.owns_logo_path(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder TEXT;
BEGIN
  v_folder := split_part(p_name, '/', 1);

  IF v_folder !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN false;
  END IF;

  RETURN public.is_shop_owner(auth.uid(), v_folder::uuid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owns_logo_path(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Shop logos are publicly readable" ON storage.objects;
CREATE POLICY "Shop logos are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'shop-logos');

DROP POLICY IF EXISTS "Owners can upload their shop logo" ON storage.objects;
CREATE POLICY "Owners can upload their shop logo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shop-logos' AND public.owns_logo_path(name));

DROP POLICY IF EXISTS "Owners can replace their shop logo" ON storage.objects;
CREATE POLICY "Owners can replace their shop logo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'shop-logos' AND public.owns_logo_path(name))
WITH CHECK (bucket_id = 'shop-logos' AND public.owns_logo_path(name));

DROP POLICY IF EXISTS "Owners can remove their shop logo" ON storage.objects;
CREATE POLICY "Owners can remove their shop logo"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'shop-logos' AND public.owns_logo_path(name));
