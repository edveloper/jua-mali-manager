-- Services catalog for service-first and mixed businesses
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  cost_per_service NUMERIC(12,2) NOT NULL DEFAULT 0,
  price NUMERIC(12,2) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 0,
  min_capacity_level INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  service_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  cost_at_sale NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view services" ON public.services;
CREATE POLICY "Members can view services"
ON public.services
FOR SELECT
USING (public.is_shop_member(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Owners can manage services" ON public.services;
CREATE POLICY "Owners can manage services"
ON public.services
FOR ALL
USING (public.is_shop_owner(auth.uid(), shop_id))
WITH CHECK (public.is_shop_owner(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Members can view service sales" ON public.service_sales;
CREATE POLICY "Members can view service sales"
ON public.service_sales
FOR SELECT
USING (public.is_shop_member(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Members can insert service sales" ON public.service_sales;
CREATE POLICY "Members can insert service sales"
ON public.service_sales
FOR INSERT
WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
