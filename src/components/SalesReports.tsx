import { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { Share2 } from 'lucide-react';
import { Sale, CreditSale, StockMovement, Expense, SalePayment } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { methodLabel } from '@/lib/payment';
import { money } from '@/lib/money';
import {
  format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths,
  isWithinInterval, differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval,
  isSameDay, isSameMonth, min as earliest,
} from 'date-fns';

interface SalesReportsProps {
  sales: Sale[];
  creditSales: CreditSale[];
  getCreditPaymentsTotalForRange?: (start: Date | string, end: Date | string) => number;
  getExpenseTotalForRange: (
    start: Date | string,
    end: Date | string,
    basis?: 'cash' | 'accrual',
    options?: { includeInventoryPurchases?: boolean }
  ) => number;
  expenses?: Expense[];
  salePayments?: SalePayment[];
  stockPurchases?: StockMovement[];
  businessCategory?: string;
  /** Sends the owner to Money -> Export, where every downloadable file lives. */
  onGoToExport: () => void;
}

type RangeType = 'today' | 'week' | 'month' | 'lastMonth' | 'custom';

const isRestockExpense = (expense: Expense) => expense.source === 'restock';

/*
 * Kenyan thresholds, as bands rather than a single rate.
 *
 * The old card showed 3% of sales to everybody, which is wrong in both
 * directions: a shop turning over 700k a year owes no turnover tax at all and
 * was being told to set aside money it does not owe, and a shop past the ceiling
 * has left the regime entirely. Which side of a line you are on is the useful
 * fact, and it is arithmetic rather than advice.
 */
const TURNOVER_TAX_FLOOR = 1_000_000;
const TURNOVER_TAX_CEILING = 25_000_000;
const TURNOVER_TAX_RATE = 0.03;
const VAT_LINE = 5_000_000;
/** Below this many days of records, a yearly figure is a guess, not a projection. */
const ENOUGH_DAYS = 30;

const download = (filename: string, contents: string, mime = 'text/csv;charset=utf-8;') => {
  // Excel assumes Windows-1252 for CSV unless a byte-order mark says
  // otherwise, which turns every non-ASCII character into mojibake --
  // dashes, and any customer or product name with an accent in it.
  const blob = new Blob(['﻿' + contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export function SalesReports({
  sales,
  creditSales = [],
  getCreditPaymentsTotalForRange,
  getExpenseTotalForRange,
  expenses = [],
  salePayments = [],
  stockPurchases = [],
  onGoToExport,
}: SalesReportsProps) {
  // The question somebody opens Reports to answer is almost always about
  // today. A month is a review, and reviews get chosen.
  const [rangeType, setRangeType] = useState<RangeType>('today');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { start, end, label } = useMemo(() => {
    const now = new Date();
    if (rangeType === 'today') {
      return { start: startOfDay(now), end: endOfDay(now), label: 'Today' };
    }
    if (rangeType === 'week') {
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now), label: 'Last 7 days' };
    }
    if (rangeType === 'month') {
      return { start: startOfMonth(now), end: endOfDay(now), label: format(now, 'MMMM') };
    }
    if (rangeType === 'lastMonth') {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev), label: format(prev, 'MMMM') };
    }
    return {
      start: startOfDay(new Date(customStart)),
      end: endOfDay(new Date(customEnd)),
      label: 'Chosen dates',
    };
  }, [rangeType, customStart, customEnd]);

  const report = useMemo(() => {
    const now = new Date();
    const inRange = (d: string | Date) => isWithinInterval(new Date(d), { start, end });

    const periodSales = sales.filter((s) => inRange(s.createdAt));
    const periodCredits = creditSales.filter((c) => inRange(c.createdAt));
    const periodExpenses = expenses.filter((e) => inRange(e.date));
    const periodPurchases = stockPurchases.filter((p) => inRange(p.happenedAt));

    const totalSales = periodSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const grossProfit = periodSales.reduce((sum, s) => sum + Number(s.profit || 0), 0);
    const onDeni = periodCredits.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const deniPaidBack = getCreditPaymentsTotalForRange
      ? getCreditPaymentsTotalForRange(start, end)
      : 0;
    const runningCosts = getExpenseTotalForRange(start, end, 'accrual', {
      includeInventoryPurchases: false,
    });

    const byItem = new Map<string, { qty: number; revenue: number; profit: number }>();
    for (const s of periodSales) {
      const key = s.productName || 'Unknown';
      const row = byItem.get(key) || { qty: 0, revenue: 0, profit: 0 };
      row.qty += Number(s.quantity || 0);
      row.revenue += Number(s.totalAmount || 0);
      row.profit += Number(s.profit || 0);
      byItem.set(key, row);
    }
    const topItems = [...byItem.entries()]
      .map(([name, row]) => ({ name, ...row }))
      .sort((a, b) => b.revenue - a.revenue);

    // Restock spend is excluded here: its cost is already taken off inside gross
    // profit, so listing it as a running cost would count the same money twice.
    const byCategory = new Map<string, number>();
    for (const e of periodExpenses) {
      if (isRestockExpense(e)) continue;
      const key = e.category || 'Other';
      byCategory.set(key, (byCategory.get(key) || 0) + Number(e.amount || 0));
    }
    const categorySpend = [...byCategory.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Read from the payment rows, not the sales. A receipt settled partly in cash
    // and partly by M-Pesa contributes to both, which a single column on the sale
    // could never express.
    const periodPayments = salePayments.filter((p) => inRange(p.createdAt));
    const byMethod = new Map<string, number>();
    for (const p of periodPayments) {
      byMethod.set(p.method, (byMethod.get(p.method) || 0) + p.amount);
    }

    // Whatever the payment rows and the deni do not account for is takings from
    // before methods were recorded. Shown as its own line rather than folded
    // into cash, because we genuinely do not know how it arrived.
    const paidNow = periodPayments.reduce((sum, p) => sum + p.amount, 0);
    const unrecorded = Math.max(0, totalSales - onDeni - paidNow);
    if (unrecorded > 0) byMethod.set('unknown', unrecorded);

    const methodSplit = [...byMethod.entries()]
      .map(([method, amount]) => ({
        method,
        label: method === 'unknown' ? 'Not recorded' : methodLabel(method),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    /*
     * Sales by day.
     *
     * This was built by walking the sales and dropping each day into a Map as it
     * appeared. Two things were wrong with that, and both misread the shop.
     *
     * A Map iterates in insertion order, and the sales come back from Postgres
     * in no particular order, so the bars came out in whatever sequence the rows
     * happened to arrive: 18, 19, 14, 17, 25. Not a trend, an accident.
     *
     * Worse, a day with no sales was simply absent. The chart then closed the
     * gap and drew six trading days as six neighbouring bars, so a week with the
     * shutters down looked identical to a week of steady trading. A quiet day is
     * a fact about the business and has to be drawn as a fact: zero.
     *
     * So every day in the period is generated first and the takings dropped onto
     * it. Long ranges from Pick dates would give hundreds of bars nobody can
     * read, so past roughly two months it groups by month instead.
     */
    const upTo = earliest([end, now]);
    const spanDays = Math.max(0, differenceInCalendarDays(upTo, start)) + 1;
    const byMonth = spanDays > 62;

    const buckets = byMonth
      ? eachMonthOfInterval({ start, end: upTo }).map((d) => ({
          at: d,
          day: format(d, 'MMM yy'),
          amount: 0,
        }))
      : eachDayOfInterval({ start, end: upTo }).map((d) => ({
          at: d,
          day: format(d, 'd MMM'),
          amount: 0,
        }));

    for (const sale of periodSales) {
      const at = new Date(sale.createdAt);
      const bucket = byMonth
        ? buckets.find((b) => isSameMonth(b.at, at))
        : buckets.find((b) => isSameDay(b.at, at));
      if (bucket) bucket.amount += Number(sale.totalAmount || 0);
    }

    const trend = buckets.map(({ day, amount }) => ({ day, amount }));

    const tradingDays = new Set(
      periodSales.map((s) => format(new Date(s.createdAt), 'yyyy-MM-dd'))
    ).size;

    return {
      totalSales, grossProfit, onDeni, deniPaidBack, runningCosts,
      takeHome: grossProfit - runningCosts,
      topItems, categorySpend, methodSplit, trend, trendByMonth: byMonth, tradingDays,
      averageDay: tradingDays ? totalSales / tradingDays : 0,
      restockSpend: periodPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0),
      estimatedTax: totalSales * TURNOVER_TAX_RATE,
    };
  }, [sales, creditSales, expenses, salePayments, stockPurchases, start, end, getExpenseTotalForRange, getCreditPaymentsTotalForRange]);

  /**
   * Which side of the tax lines this shop sits on.
   *
   * Deliberately measured over the whole trading history rather than the report
   * period: the thresholds are annual, so a figure taken from the last seven days
   * would move a shop in and out of turnover tax week by week. Annualised from
   * calendar days, not trading days -- a shop closed on Sundays does not turn over
   * a seventh more than it did.
   */
  const taxBand = useMemo(() => {
    const live = sales.filter((s) => !s.voidedAt);
    if (live.length === 0) return null;

    const now = new Date();
    const earliest = live.reduce(
      (min, s) => (new Date(s.createdAt) < min ? new Date(s.createdAt) : min),
      new Date(live[0].createdAt)
    );

    const yearAgo = subDays(now, 364);
    const windowStart = startOfDay(earliest > yearAgo ? earliest : yearAgo);
    const days = Math.max(1, differenceInCalendarDays(now, windowStart) + 1);

    const turnover = live
      .filter((s) => new Date(s.createdAt) >= windowStart)
      .reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

    // Too little history to project a year from honestly. Say so rather than
    // multiply four days of trading by ninety and call it a liability.
    if (days < ENOUGH_DAYS) return null;

    const fullYear = days >= 365;
    const annualised = fullYear ? turnover : (turnover / days) * 365;

    const band =
      annualised < TURNOVER_TAX_FLOOR ? 'below'
      : annualised > TURNOVER_TAX_CEILING ? 'above'
      : 'turnover';

    return {
      days,
      fullYear,
      annualised,
      band,
      // Flagged early rather than on the day it is crossed: registering for VAT
      // changes how the shop operates, and it is not a same-week job.
      nearVat: annualised >= VAT_LINE * 0.8,
    };
  }, [sales]);

  /** Short enough to paste into WhatsApp, which is how this will actually travel. */
  const shareSummary = async () => {
    const text = [
      `${label}: ${format(start, 'd MMM')} to ${format(end, 'd MMM')}`,
      '',
      `Sales: KSh ${money(report.totalSales)}`,
      `Gross profit: KSh ${money(report.grossProfit)}`,
      `Running costs: KSh ${money(report.runningCosts)}`,
      `Take-home: KSh ${money(report.takeHome)}`,
      '',
      `Best seller: ${report.topItems[0]?.name ?? '-'}`,
      `Average day: KSh ${money(report.averageDay)}`,
    ].join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Cancelled, or blocked in this context. Fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      download('summary.txt', text, 'text/plain;charset=utf-8;');
    }
  };

  const RANGES: { value: RangeType; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: '7 days' },
    { value: 'month', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: 'custom', label: 'Pick dates' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {RANGES.map((r) => (
          <Button
            key={r.value}
            variant={rangeType === r.value ? 'default' : 'outline'}
            size="sm"
            className="px-1 text-xs"
            onClick={() => setRangeType(r.value)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {rangeType === 'custom' && (
        <div className="sheet flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-transparent text-sm num flex-1 focus:outline-none"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-transparent text-sm num flex-1 focus:outline-none"
          />
        </div>
      )}

      {/* Deliberately the same shape as the daily sheet on Home, so that a month
          reads exactly like a day and nobody has to learn a second layout. */}
      <div className="sheet">
        <p className="sheet-heading">
          {label} · {format(start, 'd MMM')} to {format(end, 'd MMM')}
        </p>

        <div className="ledger-line ledger-rule">
          <span className="font-medium">Sales</span>
          <span className="amount">{money(report.totalSales)}</span>
        </div>
        {report.onDeni > 0 && (
          <div className="ledger-sub">
            <span>taken on deni</span>
            <span className="num">{money(report.onDeni)}</span>
          </div>
        )}
        {report.deniPaidBack > 0 && (
          <div className="ledger-line">
            <span className="text-muted-foreground">Deni paid back</span>
            <span className="amount text-success">{money(report.deniPaidBack)}</span>
          </div>
        )}

        <div className="ledger-line ledger-rule">
          <span className="text-muted-foreground">Gross profit</span>
          <span className="amount">{money(report.grossProfit)}</span>
        </div>
        <div className="ledger-line">
          <span className="text-muted-foreground">Running costs</span>
          <span className="amount text-destructive">− {money(report.runningCosts)}</span>
        </div>
        <div className="ledger-line ledger-total">
          <span className="font-semibold">Take-home</span>
          <span className={`text-2xl amount ${report.takeHome < 0 ? 'text-destructive' : 'text-success'}`}>
            {money(report.takeHome)}
          </span>
        </div>

        {report.tradingDays > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            {report.tradingDays} {report.tradingDays === 1 ? 'day' : 'days'} with sales, averaging
            KSh {money(report.averageDay)} a day
          </p>
        )}
      </div>

      {report.totalSales === 0 ? (
        <div className="sheet">
          <p className="text-sm text-muted-foreground">No sales recorded in this period.</p>
        </div>
      ) : (
        <>
          {report.trend.length > 1 && (
            <div className="sheet">
              <p className="sheet-heading">{report.trendByMonth ? 'Sales by month' : 'Sales by day'}</p>
              <p className="text-xs text-muted-foreground mb-3">
                Every {report.trendByMonth ? 'month' : 'day'} in the period. A flat bar means
                nothing was sold.
              </p>
              <div className="h-40 -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.trend}>
                    {/* Roughly six labels, whatever the length, so a month of
                        bars does not become a smear of overlapping dates. */}
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      interval={Math.max(0, Math.ceil(report.trend.length / 6) - 1)}
                    />
                    <Tooltip
                      formatter={(v) => `KSh ${money(v as number)}`}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="sheet">
            <p className="sheet-heading">What sold best</p>
            <div className="mt-2 divide-y divide-border/70">
              {report.topItems.slice(0, 8).map((item) => (
                <div key={item.name} className="flex items-baseline gap-3 py-2">
                  <span className="flex-1 min-w-0 truncate text-sm">{item.name}</span>
                  <span className="text-xs text-muted-foreground num shrink-0">{item.qty} sold</span>
                  <span className="amount text-sm shrink-0 w-20 text-right">{money(item.revenue)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sheet">
            <p className="sheet-heading">How customers paid</p>
            <div className="mt-1">
              {report.methodSplit.map((m) => (
                <div key={m.method} className="ledger-line">
                  <span className={m.method === 'unknown' ? 'text-muted-foreground' : ''}>{m.label}</span>
                  <span className="num">{money(m.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {(report.categorySpend.length > 0 || report.restockSpend > 0) && (
        <div className="sheet">
          <p className="sheet-heading">Where the money went</p>
          <div className="mt-1">
            {report.categorySpend.map((c) => (
              <div key={c.name} className="ledger-line">
                <span>{c.name}</span>
                <span className="num">{money(c.amount)}</span>
              </div>
            ))}
            {report.restockSpend > 0 && (
              <div className="ledger-line ledger-rule">
                <span className="text-muted-foreground">Stock bought</span>
                <span className="num">{money(report.restockSpend)}</span>
              </div>
            )}
          </div>
          {report.restockSpend > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Stock sits apart because its cost is already taken off in gross profit.
              Counting it again would understate what you made.
            </p>
          )}
        </div>
      )}

      <div className="sheet">
        <p className="sheet-heading">Tax</p>

        {!taxBand ? (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Record about a month of sales and this will show you which tax you fall under.
          </p>
        ) : (
          <>
            <div className="ledger-line ledger-rule">
              <span className="text-muted-foreground">Your sales in a year</span>
              <span className="amount">{money(taxBand.annualised)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {taxBand.fullYear
                ? 'Your last 12 months.'
                : `Based on ${taxBand.days} days of records, not a full year.`}
            </p>

            {taxBand.band === 'below' && (
              <div className="mt-3">
                <p className="text-sm font-medium">You do not pay turnover tax</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Turnover tax starts at {money(TURNOVER_TAX_FLOOR)} a year. You are about{' '}
                  {money(TURNOVER_TAX_FLOOR - taxBand.annualised)} below that. Under the line,
                  you pay tax on your profit, not on your sales.
                </p>
              </div>
            )}

            {taxBand.band === 'turnover' && (
              <div className="mt-3">
                <p className="text-sm font-medium">You pay turnover tax</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Shops selling between {money(TURNOVER_TAX_FLOOR)} and{' '}
                  {money(TURNOVER_TAX_CEILING)} a year pay {TURNOVER_TAX_RATE * 100}% of sales.
                  You file it every month, by the 20th.
                </p>
                <div className="ledger-line ledger-rule mt-2">
                  <span className="text-muted-foreground">
                    {TURNOVER_TAX_RATE * 100}% of {money(report.totalSales)}
                  </span>
                  <span className="text-lg amount">{money(report.estimatedTax)}</span>
                </div>
              </div>
            )}

            {taxBand.band === 'above' && (
              <div className="mt-3">
                <p className="text-sm font-medium">Your sales are above turnover tax</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Turnover tax stops at {money(TURNOVER_TAX_CEILING)} a year. Past that, tax is
                  on profit. Get an accountant to handle it.
                </p>
              </div>
            )}

            {taxBand.nearVat && (
              <div className="mt-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
                <p className="text-sm font-medium">
                  {taxBand.annualised >= VAT_LINE ? 'You have passed the VAT line' : 'The VAT line is near'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Once your sales pass {money(VAT_LINE)} in any 12 months you have to register
                  for VAT. After you register you stop paying turnover tax. Get advice before
                  you reach it, not after.
                </p>
              </div>
            )}
          </>
        )}

        {/* The charge a duka actually feels, and the one a KRA-shaped card would
            never mention: it is a county levy, not a national tax. */}
        <div className="ledger-rule mt-3 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">The county permit is separate.</span>{' '}
            Your single business permit is paid to the county once a year, not to KRA. Record it
            under Licences in Spending so it shows up in your costs and does not catch you out.
          </p>
        </div>

        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          These figures come from what you have recorded. This is not tax advice. The limits
          change with each Finance Act, so check with KRA before you file.
        </p>
      </div>

      {/* Spreadsheets used to live here too, which meant exports existed in two
          places and neither was complete. They are all in Export now; this stays
          because sharing a few figures on WhatsApp is a different act from
          downloading a file. */}
      <div className="sheet space-y-2">
        <p className="sheet-heading">Take it with you</p>
        <Button variant="outline" className="w-full justify-start" onClick={shareSummary}>
          <Share2 className="h-4 w-4 mr-2" /> Share these figures
        </Button>
        <button
          type="button"
          onClick={onGoToExport}
          className="w-full text-left text-xs text-muted-foreground leading-relaxed hover:text-foreground transition-colors"
        >
          Need a spreadsheet, or a statement for the bank? Those are in{' '}
          <span className="text-primary font-medium">Export</span>.
        </button>
      </div>
    </div>
  );
}
