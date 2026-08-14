-- BASELINE. Captures the five tables that were created by hand in the Supabase
-- dashboard and never existed in any migration: products, sales, customers,
-- credit_sales, expenses. Without this the repo could only rebuild part of the
-- schema, so a lost project could not be recreated from source.
--
-- Reconstructed on 2026-08-14 from live catalog introspection. Dated to run
-- after 20251213060718 for two reasons: every table here references shops(id),
-- and the policies call public.is_shop_member(), which that migration defines.
-- Moving this file any earlier breaks a from-scratch replay.
--
-- Columns include everything later migrations added, so those migrations become
-- no-ops on a fresh replay (they all use ADD COLUMN IF NOT EXISTS). Every
-- statement is idempotent: running this against the existing database changes
-- nothing except adding the shop_id indexes noted at the bottom.

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members can manage customers" ON public.customers;
CREATE POLICY "Shop members can manage customers"
ON public.customers
FOR ALL
USING (public.is_shop_member(auth.uid(), shop_id));

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  min_price NUMERIC(12,2),
  max_price NUMERIC(12,2),
  stock_level INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 5,
  unit TEXT DEFAULT 'pcs'::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_price_band_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_price_band_check
  CHECK (min_price IS NULL OR max_price IS NULL OR min_price <= max_price);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view products in their shop" ON public.products;
CREATE POLICY "Users can view products in their shop"
ON public.products
FOR SELECT
USING (public.is_shop_member(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Owners can manage products" ON public.products;
CREATE POLICY "Owners can manage products"
ON public.products
FOR ALL
USING (public.is_shop_owner(auth.uid(), shop_id))
WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

-- Two legacy policies are deliberately NOT recreated here:
--   "Attendants can view products"        -- exact duplicate of the SELECT above
--   "Attendants can update product stock" -- despite the name, granted UPDATE on
--     every column (price, min_price, max_price included) to an 'attendant' role
--     that no migration ever created. See the companion hardening migration.

-- ---------------------------------------------------------------------------
-- sales
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  cost_price_at_sale NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(12,2),
  list_price_at_sale NUMERIC(12,2),
  price_source TEXT NOT NULL DEFAULT 'list'::text,
  sold_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_price_source_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_price_source_check
  CHECK (price_source IN ('list', 'override'));

CREATE INDEX IF NOT EXISTS sales_sold_by_idx ON public.sales (shop_id, sold_by);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- No UPDATE or DELETE policy on purpose: sales are append-only from the client.
DROP POLICY IF EXISTS "Users can view shop sales" ON public.sales;
CREATE POLICY "Users can view shop sales"
ON public.sales
FOR SELECT
USING (public.is_shop_member(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Members can insert sales" ON public.sales;
CREATE POLICY "Members can insert sales"
ON public.sales
FOR INSERT
WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

-- ---------------------------------------------------------------------------
-- credit_sales
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.credit_sales
  DROP CONSTRAINT IF EXISTS credit_sales_status_check;
ALTER TABLE public.credit_sales
  ADD CONSTRAINT credit_sales_status_check
  CHECK (status IN ('pending', 'partially_paid', 'paid'));

ALTER TABLE public.credit_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members can manage credit sales" ON public.credit_sales;
CREATE POLICY "Shop members can manage credit sales"
ON public.credit_sales
FOR ALL
USING (public.is_shop_member(auth.uid(), shop_id));

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
-- shop_id is nullable here because that is how it exists today. A NULL shop_id
-- row is unreachable through RLS, so it is inert rather than dangerous, but see
-- the hardening migration for tightening it.
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  expense_type TEXT NOT NULL DEFAULT 'one_off'::text,
  recurrence_unit TEXT NOT NULL DEFAULT 'none'::text,
  allocation_mode TEXT NOT NULL DEFAULT 'cash'::text,
  source TEXT NOT NULL DEFAULT 'manual'::text,
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_expense_type_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_expense_type_check
  CHECK (expense_type IN ('one_off', 'variable', 'recurring'));

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_recurrence_unit_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_recurrence_unit_check
  CHECK (recurrence_unit IN ('none', 'daily', 'weekly', 'monthly', 'annual'));

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_allocation_mode_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_allocation_mode_check
  CHECK (allocation_mode IN ('cash', 'accrual'));

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_source_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_source_check
  CHECK (source IN ('manual', 'restock'));

CREATE INDEX IF NOT EXISTS expenses_shop_source_idx ON public.expenses (shop_id, source);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Reproduces the policy as it exists today. The hardening migration narrows it
-- to owners, which is what the UI has always assumed.
DROP POLICY IF EXISTS "Users can manage their own shop expenses" ON public.expenses;
CREATE POLICY "Users can manage their own shop expenses"
ON public.expenses
FOR ALL
USING (public.is_shop_member(auth.uid(), shop_id));

-- ---------------------------------------------------------------------------
-- Missing lookup indexes
-- ---------------------------------------------------------------------------
-- Every one of these tables is queried by shop_id on load and none of them had
-- an index for it. Only sales was covered, incidentally, by sales_sold_by_idx.
CREATE INDEX IF NOT EXISTS products_shop_id_idx ON public.products (shop_id);
CREATE INDEX IF NOT EXISTS customers_shop_id_idx ON public.customers (shop_id);
CREATE INDEX IF NOT EXISTS credit_sales_shop_id_idx ON public.credit_sales (shop_id);
CREATE INDEX IF NOT EXISTS credit_sales_customer_id_idx ON public.credit_sales (customer_id);
CREATE INDEX IF NOT EXISTS expenses_shop_id_idx ON public.expenses (shop_id);
