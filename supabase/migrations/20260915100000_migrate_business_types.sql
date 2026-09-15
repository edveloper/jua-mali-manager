-- Point existing shops at the trade vocabulary the catalogue uses.
--
-- The nine original categories were written before anybody had met a user. They
-- offered "Transport / Matatu", which sells nothing and holds no stock, while a
-- pharmacy, a hardware, a kinyozi and a mboga kiosk all had to call themselves
-- "Retail shop". That was harmless while the answer only chose an expense list.
-- It stops being harmless now the answer decides which of five hundred
-- catalogue entries to suggest, because a hardware offered sukuma wiki is worse
-- than no suggestion at all.
--
-- Mapped rather than cleared: a shop whose category no longer exists would fall
-- out of every dropdown and silently reset itself the next time somebody saved
-- the form. Where an old label genuinely covered several trades it lands on the
-- broadest of them, and the owner can narrow it themselves in one tap.

-- The constraint has to go first. It was written in February and pins the old
-- nine, so every row the UPDATE below touches would be rejected the moment it
-- was written, before anything had a chance to be mapped.
ALTER TABLE public.shops
DROP CONSTRAINT IF EXISTS shops_business_category_check;

UPDATE public.shops SET business_category = CASE business_category
  WHEN 'retail'             THEN 'duka'
  WHEN 'barbershop_salon'   THEN 'salon'
  WHEN 'computer_center'    THEN 'cyber'
  WHEN 'food_hospitality'   THEN 'restaurant'
  WHEN 'health_beauty'      THEN 'beauty_shop'
  WHEN 'repair_services'    THEN 'phone_repair'
  WHEN 'transport'          THEN 'other'
  WHEN 'education_training' THEN 'other'
  WHEN 'other_services'     THEN 'other'
  ELSE business_category
END;

-- Anything still unrecognised becomes 'other' rather than blocking the new
-- constraint. A row can hold an unexpected value for reasons that are nobody's
-- fault: a half-applied earlier attempt, or a client deployed ahead of its
-- migration. Refusing to proceed over one of those helps no one, and 'other'
-- costs the owner a single tap to correct.
UPDATE public.shops
SET business_category = 'other'
WHERE business_category IS NULL
   OR business_category NOT IN (
    'duka',
    'mini_supermarket',
    'grocery_kiosk',
    'fruit_kiosk',
    'grains_store',
    'household_goods',
    'boutique',
    'shoe_shop',
    'bookshop',
    'electronics',
    'plant_shop',
    'street_vendor',
    'restaurant',
    'bakery',
    'butchery',
    'nyama_choma',
    'bar_liquor',
    'water_refill',
    'poultry_dairy',
    'salon',
    'kinyozi',
    'nail_shop',
    'beauty_shop',
    'hardware',
    'furniture_hardware',
    'agrovet',
    'gas_distribution',
    'cyber',
    'mpesa_agent',
    'phone_repair',
    'tailoring',
    'laundry',
    'car_wash',
    'posho_mill',
    'pharmacy',
    'other'
);

ALTER TABLE public.shops
ADD CONSTRAINT shops_business_category_check
CHECK (
  business_category IN (
    'duka',
    'mini_supermarket',
    'grocery_kiosk',
    'fruit_kiosk',
    'grains_store',
    'household_goods',
    'boutique',
    'shoe_shop',
    'bookshop',
    'electronics',
    'plant_shop',
    'street_vendor',
    'restaurant',
    'bakery',
    'butchery',
    'nyama_choma',
    'bar_liquor',
    'water_refill',
    'poultry_dairy',
    'salon',
    'kinyozi',
    'nail_shop',
    'beauty_shop',
    'hardware',
    'furniture_hardware',
    'agrovet',
    'gas_distribution',
    'cyber',
    'mpesa_agent',
    'phone_repair',
    'tailoring',
    'laundry',
    'car_wash',
    'posho_mill',
    'pharmacy',
    'other'
  )
);

-- New shops default to a duka, which is what most of them are.
ALTER TABLE public.shops ALTER COLUMN business_category SET DEFAULT 'duka';
