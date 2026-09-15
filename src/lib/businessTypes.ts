/**
 * What kind of business this is.
 *
 * The original list had nine entries and was written before anybody had met the
 * users. It offered "Transport / Matatu", which sells nothing and has no stock,
 * while a pharmacy, a hardware, a kinyozi and a mboga kiosk all had to call
 * themselves "Retail shop". That was fine when the answer only picked an expense
 * list. It stopped being fine once the answer decides which of five hundred
 * catalogue entries to put in front of somebody, because a hardware offered
 * sukuma wiki is worse than no suggestion at all.
 *
 * Slugs here are the same strings as `canonical_products.business_types`. The
 * two lists must not drift, so both are generated from this vocabulary.
 */

export interface BusinessType {
  value: string;
  label: string;
  group: string;
}

export const BUSINESS_TYPES: BusinessType[] = [
  { value: 'duka', label: 'Shop / Duka', group: 'Shops' },
  { value: 'mini_supermarket', label: 'Mini Supermarket', group: 'Shops' },
  { value: 'grocery_kiosk', label: 'Vegetables / Mboga Kiosk', group: 'Shops' },
  { value: 'fruit_kiosk', label: 'Fruit Kiosk', group: 'Shops' },
  { value: 'grains_store', label: 'Grains Store', group: 'Shops' },
  { value: 'household_goods', label: 'Household Goods', group: 'Shops' },
  { value: 'boutique', label: 'Clothes / Boutique / Mitumba', group: 'Shops' },
  { value: 'shoe_shop', label: 'Shoe Shop', group: 'Shops' },
  { value: 'bookshop', label: 'Bookshop / Stationery', group: 'Shops' },
  { value: 'electronics', label: 'Electronics / Phone Shop', group: 'Shops' },
  { value: 'plant_shop', label: 'Plants / Garden Shop', group: 'Shops' },
  { value: 'street_vendor', label: 'Street Vendor / Hawker', group: 'Shops' },

  { value: 'restaurant', label: 'Restaurant / Hotel', group: 'Food and drink' },
  { value: 'bakery', label: 'Bakery', group: 'Food and drink' },
  { value: 'butchery', label: 'Butchery', group: 'Food and drink' },
  { value: 'nyama_choma', label: 'Nyama Choma / Smokies', group: 'Food and drink' },
  { value: 'bar_liquor', label: 'Bar / Liquor Store', group: 'Food and drink' },
  { value: 'water_refill', label: 'Water Refill / Distribution', group: 'Food and drink' },
  { value: 'poultry_dairy', label: 'Poultry / Dairy', group: 'Food and drink' },

  { value: 'salon', label: 'Salon', group: 'Beauty' },
  { value: 'kinyozi', label: 'Kinyozi / Barbershop', group: 'Beauty' },
  { value: 'nail_shop', label: 'Nail Shop', group: 'Beauty' },
  { value: 'beauty_shop', label: 'Beauty / Cosmetics Shop', group: 'Beauty' },

  { value: 'hardware', label: 'Hardware', group: 'Trade and building' },
  { value: 'furniture_hardware', label: 'Furniture / Fittings', group: 'Trade and building' },
  { value: 'agrovet', label: 'Agrovet', group: 'Trade and building' },
  { value: 'gas_distribution', label: 'Cooking Gas', group: 'Trade and building' },

  { value: 'cyber', label: 'Cyber / Computer Centre', group: 'Services' },
  { value: 'mpesa_agent', label: 'M-Pesa / Mobile Money Agent', group: 'Services' },
  { value: 'phone_repair', label: 'Phone Repair', group: 'Services' },
  { value: 'tailoring', label: 'Tailoring', group: 'Services' },
  { value: 'laundry', label: 'Laundry / Dry Cleaning', group: 'Services' },
  { value: 'car_wash', label: 'Car Wash', group: 'Services' },
  { value: 'posho_mill', label: 'Posho Mill', group: 'Services' },
  { value: 'pharmacy', label: 'Pharmacy / Chemist', group: 'Services' },

  { value: 'other', label: 'Something Else', group: 'Other' },
];

/**
 * The nine original slugs, pointed at their nearest replacement.
 *
 * Kept rather than dropped because shops in the database still carry them, and
 * a row whose category no longer exists would fall out of every dropdown and
 * silently reset itself the next time somebody saved the form. Where the old
 * label genuinely covered several trades, it lands on the broadest one and the
 * owner can narrow it themselves.
 */
export const LEGACY_BUSINESS_TYPES: Record<string, string> = {
  retail: 'duka',
  barbershop_salon: 'salon',
  computer_center: 'cyber',
  food_hospitality: 'restaurant',
  health_beauty: 'beauty_shop',
  repair_services: 'phone_repair',
  transport: 'other',
  education_training: 'other',
  other_services: 'other',
};

export const resolveBusinessType = (value?: string | null): string => {
  if (!value) return 'duka';
  if (LEGACY_BUSINESS_TYPES[value]) return LEGACY_BUSINESS_TYPES[value];
  return BUSINESS_TYPES.some((t) => t.value === value) ? value : 'other';
};

export const businessTypeLabel = (value?: string | null): string => {
  const resolved = resolveBusinessType(value);
  return BUSINESS_TYPES.find((t) => t.value === resolved)?.label ?? 'Something Else';
};

/** Grouped for a <select>, so thirty-six options stay navigable. */
export const groupedBusinessTypes = (): { group: string; types: BusinessType[] }[] => {
  const groups: { group: string; types: BusinessType[] }[] = [];
  for (const type of BUSINESS_TYPES) {
    const existing = groups.find((g) => g.group === type.group);
    if (existing) existing.types.push(type);
    else groups.push({ group: type.group, types: [type] });
  }
  return groups;
};
