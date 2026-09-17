import { Product, Sale } from '@/types/inventory';

/**
 * When each item runs out, based on how fast it actually sells.
 *
 * The low stock alert this sits beside asks a simpler question: is there less
 * than N left? That number is set once per product and is wrong for almost all
 * of them. Five bottles of milk is this afternoon. Five bottles of an expensive
 * spirit is next quarter. Same figure, two completely different decisions.
 *
 * Velocity answers the question somebody actually has, which is not "how many
 * are left" but "do I need to buy this before Thursday".
 */

export interface RunOut {
  product: Product;
  /** Units sold per trading day. */
  perDay: number;
  /** Trading days of stock left. Infinity when nothing is selling. */
  daysLeft: number;
  runsOutOn: Date | null;
  /*
   * Whether this is worth saying out loud.
   *
   * Two sales in a fortnight gives a number, and the number is meaningless. A
   * prediction presented with the same confidence as a real one is worse than
   * silence, because somebody buys stock against it.
   */
  confident: boolean;
}

export interface ForecastOptions {
  /** How far back to look. Four weeks smooths out a good Saturday. */
  windowDays?: number;
  /** Below this many sales, say nothing. */
  minSales?: number;
  /** Below this many days of trading, say nothing. */
  minTradingDays?: number;
}

const DAY = 24 * 60 * 60 * 1000;

export const forecastRunOut = (
  products: Product[],
  sales: Sale[],
  options: ForecastOptions = {}
): RunOut[] => {
  const { windowDays = 28, minSales = 3, minTradingDays = 7 } = options;

  const now = Date.now();
  const since = now - windowDays * DAY;

  const recent = sales.filter((s) => !s.voidedAt && new Date(s.createdAt).getTime() >= since);

  /*
   * Divide by days the shop actually traded, not by the window.
   *
   * A shop open ten of the last twenty-eight days that sold sixty crates is
   * selling six a day, not two. Dividing by the calendar would understate every
   * velocity by the proportion of days it was shut, and understating velocity
   * means running out earlier than predicted, which is the failure that costs
   * a sale.
   */
  const tradingDays = new Set(
    recent.map((s) => new Date(s.createdAt).toDateString())
  ).size;

  const sold = new Map<string, { units: number; count: number }>();
  for (const sale of recent) {
    if (!sale.productId) continue;
    const entry = sold.get(sale.productId) ?? { units: 0, count: 0 };
    entry.units += Number(sale.quantity || 0);
    entry.count += 1;
    sold.set(sale.productId, entry);
  }

  return products
    .map((product) => {
      const entry = sold.get(product.id);
      const units = entry?.units ?? 0;
      const perDay = tradingDays > 0 ? units / tradingDays : 0;

      const daysLeft = perDay > 0 ? product.quantity / perDay : Infinity;
      const runsOutOn =
        Number.isFinite(daysLeft) ? new Date(now + daysLeft * DAY) : null;

      return {
        product,
        perDay,
        daysLeft,
        runsOutOn,
        confident:
          tradingDays >= minTradingDays &&
          (entry?.count ?? 0) >= minSales &&
          perDay > 0,
      };
    })
    // Soonest first, which is also most urgent. Anything not selling sorts to
    // the end on its own, because Infinity is larger than every real answer.
    .sort((a, b) => a.daysLeft - b.daysLeft);
};

/** The ones worth acting on: confidently selling, and about to run out. */
export const runningOutWithin = (forecast: RunOut[], days: number): RunOut[] =>
  forecast.filter((row) => row.confident && row.daysLeft <= days);

/**
 * How to say it.
 *
 * A date is easier to act on than a count of days, because reordering happens
 * against the week rather than against a number. "Today" and "tomorrow" are
 * said as words, since reading "in 0 days" takes a beat to parse.
 */
export const describeRunOut = (row: RunOut): string => {
  if (row.product.quantity <= 0) return 'Out now';
  if (!Number.isFinite(row.daysLeft)) return 'Not selling';

  const days = Math.floor(row.daysLeft);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 6 && row.runsOutOn) {
    return row.runsOutOn.toLocaleDateString('en-KE', { weekday: 'long' });
  }
  if (days <= 13) return 'Next week';
  return `About ${Math.round(days / 7)} weeks`;
};

/**
 * What actually needs buying, by either measure.
 *
 * Threshold alone misses the case that costs a sale: twenty bottles of milk
 * with a warn-at of five is comfortably above the line and gone by Thursday.
 * Velocity alone misses the slow item that is genuinely down to its last two.
 * Both belong, ordered by how soon each one bites.
 */
export const needsReordering = (
  products: Product[],
  sales: Sale[],
  horizonDays = 14
): RunOut[] =>
  forecastRunOut(products, sales).filter(
    (row) =>
      row.product.quantity <= row.product.lowStockThreshold ||
      (row.confident && row.daysLeft <= horizonDays)
  );
