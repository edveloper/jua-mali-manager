/**
 * Which kinds of spending are the cost of making the thing.
 *
 * For a duka this question never arises: the thing sold is the thing bought, so
 * its cost rides along on the sale. It arises for everybody whose output is not
 * their input. A restaurant buys rice and sells pilau. A salon buys a bottle of
 * relaxer that does fifteen heads. A car wash buys soap and sells a clean car.
 *
 * These are defaults, not rules. The expense form shows the answer and lets it
 * be changed, because only the owner knows whether the gas cylinder is for the
 * kitchen or the office.
 */

const COST_OF_SALES_CATEGORIES = new Set([
  'Ingredients',
  'Supplies',
  'Detergents',
  'Treatment',
  'Bottles',
  'Paper and ink',
  'Packaging',
  'Gas and fuel',
  'Water',
]);

/**
 * Whether a category is cost of sales by default.
 *
 * Water is the awkward one and shows why these are only defaults: for a car
 * wash or a refill station it is the product, and for a duka it is a utility
 * bill. The trade decides, and where the trade cannot, the owner does.
 */
export const defaultsToCostOfSales = (category: string, businessType: string): boolean => {
  if (category === 'Water') {
    return ['car_wash', 'laundry', 'water_refill', 'restaurant'].includes(businessType);
  }
  return COST_OF_SALES_CATEGORIES.has(category);
};

/** Trades where the question is worth asking at all. */
export const SPLITS_COST_OF_SALES = new Set([
  'restaurant', 'bakery', 'nyama_choma', 'butchery',
  'salon', 'kinyozi', 'nail_shop', 'beauty_shop',
  'car_wash', 'laundry', 'water_refill', 'posho_mill',
  'cyber', 'tailoring', 'phone_repair',
]);
