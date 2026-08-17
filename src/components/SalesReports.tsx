import { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { Download } from 'lucide-react';
import { Sale, CreditSale, StockMovement, Expense } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { methodLabel } from '@/lib/payment';
import {
  format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, isWithinInterval,
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
  stockPurchases?: StockMovement[];
  businessCategory?: string;
}

type RangeType = 'week' | 'month' | 'lastMonth' | 'custom';

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });
const csvEscape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const isRestockExpense = (expense: Expense) => expense.source === 'restock';

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
  stockPurchases = [],
}: SalesReportsProps) {
  const [rangeType, setRangeType] = useState<RangeType>('month');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { start, end, label } = useMemo(() => {
    const now = new Date();
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

    // NULL gets its own row rather than being folded into cash -- those sales
    // predate payment tracking and we genuinely do not know how they were paid.
    const byMethod = new Map<string, number>();
    for (const s of periodSales) {
      const key = s.paymentMethod || 'unknown';
      byMethod.set(key, (byMethod.get(key) || 0) + Number(s.totalAmount || 0));
    }
    const methodSplit = [...byMethod.entries()]
      .map(([method, amount]) => ({
        method,
        label: method === 'unknown' ? 'Not recorded' : methodLabel(method),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    const byDay = new Map<string, number>();
    for (const s of periodSales) {
      const key = format(new Date(s.createdAt), 'dd MMM');
      byDay.set(key, (byDay.get(key) || 0) + Number(s.totalAmount || 0));
    }
    const trend = [...byDay.entries()].map(([day, amount]) => ({ day, amount }));

    const tradingDays = new Set(
      periodSales.map((s) => format(new Date(s.createdAt), 'yyyy-MM-dd'))
    ).size;

    return {
      periodSales, periodExpenses,
      totalSales, grossProfit, onDeni, deniPaidBack, runningCosts,
      takeHome: grossProfit - runningCosts,
      topItems, categorySpend, methodSplit, trend, tradingDays,
      averageDay: tradingDays ? totalSales / tradingDays : 0,
      restockSpend: periodPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0),
      estimatedTax: totalSales * 0.03,
    };
  }, [sales, creditSales, expenses, stockPurchases, start, end, getExpenseTotalForRange, getCreditPaymentsTotalForRange]);

  const exportSales = () => {
    const headers = ['date', 'item', 'quantity', 'unit_price', 'total', 'profit', 'paid_by'];
    const rows = report.periodSales.map((s) => [
      csvEscape(format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm')),
      csvEscape(s.productName),
      csvEscape(s.quantity),
      csvEscape(s.unitPrice ?? ''),
      csvEscape(Number(s.totalAmount || 0)),
      csvEscape(Number(s.profit || 0)),
      csvEscape(s.paymentMethod || 'not recorded'),
    ].join(','));
    download(
      `sales-${format(start, 'yyyy-MM-dd')}-to-${format(end, 'yyyy-MM-dd')}.csv`,
      [headers.join(','), ...rows].join('\n')
    );
  };

  const exportExpenses = () => {
    const headers = ['date', 'category', 'description', 'amount', 'type'];
    const rows = report.periodExpenses.map((e) => [
      csvEscape(format(new Date(e.date), 'yyyy-MM-dd')),
      csvEscape(e.category || ''),
      csvEscape(e.description || ''),
      csvEscape(Number(e.amount || 0)),
      csvEscape(e.expenseType || ''),
    ].join(','));
    download(
      `spending-${format(start, 'yyyy-MM-dd')}-to-${format(end, 'yyyy-MM-dd')}.csv`,
      [headers.join(','), ...rows].join('\n')
    );
  };

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
    { value: 'week', label: '7 days' },
    { value: 'month', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: 'custom', label: 'Pick dates' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
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
              <p className="sheet-heading mb-3">Sales by day</p>
              <div className="h-40 -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.trend}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
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
        <p className="sheet-heading">Turnover tax</p>
        <div className="ledger-line">
          <span className="text-muted-foreground">3% of {money(report.totalSales)}</span>
          <span className="text-lg amount">{money(report.estimatedTax)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          A rough guide from your recorded sales, not advice. Confirm with KRA before filing.
        </p>
      </div>

      <div className="sheet space-y-2">
        <p className="sheet-heading">Take it with you</p>
        <Button variant="outline" className="w-full justify-start" onClick={shareSummary}>
          Share a summary
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={exportSales}
          disabled={report.periodSales.length === 0}
        >
          <Download className="h-4 w-4 mr-2" /> Sales as a spreadsheet
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={exportExpenses}
          disabled={report.periodExpenses.length === 0}
        >
          <Download className="h-4 w-4 mr-2" /> Spending as a spreadsheet
        </Button>
      </div>
    </div>
  );
}
