ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS business_category TEXT NOT NULL DEFAULT 'retail',
ADD COLUMN IF NOT EXISTS offering_mode TEXT NOT NULL DEFAULT 'products',
ADD COLUMN IF NOT EXISTS single_offering BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KES';

ALTER TABLE public.shops
DROP CONSTRAINT IF EXISTS shops_business_category_check;

ALTER TABLE public.shops
ADD CONSTRAINT shops_business_category_check
CHECK (
  business_category IN (
    'retail',
    'barbershop_salon',
    'computer_center',
    'transport',
    'food_hospitality',
    'repair_services',
    'health_beauty',
    'education_training',
    'other_services'
  )
);

ALTER TABLE public.shops
DROP CONSTRAINT IF EXISTS shops_offering_mode_check;

ALTER TABLE public.shops
ADD CONSTRAINT shops_offering_mode_check
CHECK (offering_mode IN ('products', 'services', 'mixed'));
