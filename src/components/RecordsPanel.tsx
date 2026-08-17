import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, isWithinInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Sale, Expense, CreditSale, CreditPayment, Product } from '@/types/inventory';
import { SupplierDebt, Supplier } from '@/hooks/useSuppliers';
import { methodLabel } from '@/lib/payment';

interface RecordsPanelProps {
  shopName: string;
  sales: Sale[];
  expenses: Expense[];
  creditSales: CreditSale[];
  creditPayments: CreditPayment[];
  supplierDebts: SupplierDebt[];
  suppliers: Supplier[];
  products: Product[];
  customerName: (id: string) => string;
  sellerName: (id?: string | null) => string;
}

type RangeKey = 'month' | 'lastMonth' | 'year';

const csv = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });
const fixed = (n: number) => n.toFixed(2);

const download = (filename: string, contents: string) => {
  // Excel assumes Windows-1252 for CSV unless a byte-order mark says
  // otherwise, which turns every non-ASCII character into mojibake --
  // dashes, and any customer or product name with an accent in it.
  const blob = new Blob(['﻿' + contents], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Records to hand to somebody else.
 *
 * The first version of this was a flat log of every transaction, which was the
 * wrong instinct: an accountant posts from totals and only reaches for detail
 * when a total looks wrong. So the summary is the headline export and the
 * line-by-line file is the backup behind it.
 */
export function RecordsPanel({
  shopName, sales, expenses, creditSales, creditPayments, supplierDebts,
  suppliers, products, customerName, sellerName,
}: RecordsPanelProps) {
  const [rangeKey, setRangeKey] = useState<RangeKey>('lastMonth');

  const { start, end, label } = useMemo(() => {
    const now = new Date();
    if (rangeKey === 'lastMonth') {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev), label: format(prev, 'MMMM yyyy') };
    }
    if (rangeKey === 'year') {
      return { start: startOfYear(now), end: now, label: format(now, 'yyyy') };
    }
    return { start: startOfMonth(now), end: now, label: format(now, 'MMMM yyyy') };
  }, [rangeKey]);

  const inRange = (d: string | Date) => isWithinInterval(new Date(d), { start, end });
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? 'Supplier';

  const figures = useMemo(() => {
    const liveSales = sales.filter((s) => !s.voidedAt && inRange(s.createdAt));
    const periodExpenses = expenses.filter((e) => inRange(e.date));

    const revenue = liveSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const cogs = liveSales.reduce((sum, s) => sum + (s.costPrice ?? 0) * s.quantity, 0);

    const running = new Map<string, number>();
    let stockBought = 0;
    for (const e of periodExpenses) {
      const amount = Number(e.amount || 0);
      if (e.source === 'restock') {
        stockBought += amount;
        continue;
      }
      running.set(e.category || 'Other', (running.get(e.category || 'Other') || 0) + amount);
    }
    const runningTotal = [...running.values()].reduce((a, b) => a + b, 0);

    return {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      running: [...running.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
      runningTotal,
      netProfit: revenue - cogs - runningTotal,
      stockBought,
      salesCount: liveSales.length,
      stockAtCost: products.reduce((sum, p) => sum + p.costPrice * p.quantity, 0),
      owedToYou: creditSales.filter((c) => c.status !== 'paid').reduce((sum, c) => sum + c.balance, 0),
      youOwe: supplierDebts.filter((d) => d.status !== 'paid').reduce((sum, d) => sum + d.balance, 0),
    };
  }, [sales, expenses, products, creditSales, supplierDebts, start, end]);

  const exportSummary = () => {
    const rows: string[] = [
      [csv(shopName || 'Tarihi'), csv(''), csv('')].join(','),
      [csv('Summary of trading'), csv(''), csv('')].join(','),
      [csv('Period'), csv(`${format(start, 'd MMM yyyy')} to ${format(end, 'd MMM yyyy')}`), csv('')].join(','),
      [csv('Prepared'), csv(format(new Date(), 'd MMM yyyy')), csv('')].join(','),
      '',
      [csv('TRADING'), csv('Amount'), csv('Note')].join(','),
      [csv('Sales'), csv(fixed(figures.revenue)), csv(`${figures.salesCount} sales, cancelled ones excluded`)].join(','),
      [csv('Cost of goods sold'), csv(fixed(-figures.cogs)), csv('What those goods cost to buy')].join(','),
      [csv('Gross profit'), csv(fixed(figures.grossProfit)), csv('')].join(','),
      '',
      [csv('RUNNING COSTS'), csv('Amount'), csv('')].join(','),
      ...figures.running.map((r) => [csv(r.name), csv(fixed(-r.amount)), csv('')].join(',')),
      [csv('Total running costs'), csv(fixed(-figures.runningTotal)), csv('')].join(','),
      '',
      [csv('NET PROFIT'), csv(fixed(figures.netProfit)), csv('Gross profit less running costs')].join(','),
      '',
      [csv('POSITION AT END OF PERIOD'), csv('Amount'), csv('Note')].join(','),
      [csv('Stock on hand, at cost'), csv(fixed(figures.stockAtCost)), csv('Current stock, not period end')].join(','),
      [csv('Owed to the business'), csv(fixed(figures.owedToYou)), csv('Unpaid customer deni')].join(','),
      [csv('Owed by the business'), csv(fixed(-figures.youOwe)), csv('Unpaid supplier debt')].join(','),
      '',
      [csv('ALSO WORTH KNOWING'), csv('Amount'), csv('')].join(','),
      [csv('Stock bought in the period'), csv(fixed(figures.stockBought)), csv('Cash paid for stock, not a running cost')].join(','),
      '',
      [csv('Records kept by the owner in Tarihi. Not audited.'), csv(''), csv('')].join(','),
      [csv('No cash, bank or M-Pesa balance is included.'), csv(''), csv('')].join(','),
    ];

    download(`tarihi-summary-${format(start, 'yyyy-MM')}.csv`, rows.join('\n'));
  };

  const exportTransactions = () => {
    const headers = [
      'date', 'time', 'type', 'description', 'party', 'category',
      'quantity', 'money_in', 'money_out', 'cost_of_goods',
      'moves_cash', 'payment_method', 'reference', 'recorded_by',
    ];

    const creditSaleIds = new Set(creditSales.map((c) => c.saleId));
    const entries: { at: Date; cells: string[] }[] = [];

    for (const s of sales) {
      if (!inRange(s.createdAt)) continue;
      const at = new Date(s.createdAt);
      const onDeni = creditSaleIds.has(s.id);
      const voided = Boolean(s.voidedAt);
      entries.push({
        at,
        cells: [
          format(at, 'yyyy-MM-dd'), format(at, 'HH:mm'),
          voided ? 'sale cancelled' : 'sale',
          s.productName, onDeni ? 'on deni' : '', 'Sales',
          String(s.quantity),
          voided || onDeni ? '' : fixed(Number(s.totalAmount || 0)),
          '',
          voided ? '' : fixed((s.costPrice ?? 0) * s.quantity),
          voided || onDeni ? 'no' : 'yes',
          s.paymentMethod ? methodLabel(s.paymentMethod) : '',
          s.paymentReference ?? '',
          sellerName(s.soldBy),
        ],
      });
    }

    for (const p of creditPayments) {
      if (!inRange(p.paidAt)) continue;
      const at = new Date(p.paidAt);
      entries.push({
        at,
        cells: [
          format(at, 'yyyy-MM-dd'), format(at, 'HH:mm'),
          'deni repaid', 'Customer paid a debt', customerName(p.customerId), 'Sales',
          '', fixed(p.amount), '', '', 'yes',
          p.paymentMethod ? methodLabel(p.paymentMethod) : '', '', '',
        ],
      });
    }

    for (const e of expenses) {
      if (!inRange(e.date)) continue;
      const at = new Date(e.date);
      entries.push({
        at,
        cells: [
          format(at, 'yyyy-MM-dd'), '',
          e.source === 'restock' ? 'stock bought' : 'running cost',
          e.description || e.category, '', e.category,
          '', '', fixed(Number(e.amount || 0)), '', 'yes',
          e.paymentMethod ? methodLabel(e.paymentMethod) : '', '', '',
        ],
      });
    }

    // No money moves when stock is taken on credit. The payment shows up later
    // as its own row, so putting an amount here as well would double count.
    for (const d of supplierDebts) {
      if (!inRange(d.incurredOn)) continue;
      const at = new Date(d.incurredOn);
      entries.push({
        at,
        cells: [
          format(at, 'yyyy-MM-dd'), '',
          'stock taken on credit', d.description, supplierName(d.supplierId), 'Owed to supplier',
          '', '', '', '', 'no', '', '', '',
        ],
      });
    }

    entries.sort((a, b) => a.at.getTime() - b.at.getTime());

    download(
      `tarihi-transactions-${format(start, 'yyyy-MM')}.csv`,
      [headers.join(','), ...entries.map((e) => e.cells.map(csv).join(','))].join('\n')
    );
  };

  const RANGES: { key: RangeKey; label: string }[] = [
    { key: 'lastMonth', label: 'Last month' },
    { key: 'month', label: 'This month' },
    { key: 'year', label: 'This year' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {RANGES.map((r) => (
          <Button
            key={r.key}
            variant={rangeKey === r.key ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setRangeKey(r.key)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* Shown on screen as well as exported, so the owner can sanity-check the
          figures before sending them to anyone. */}
      <div className="sheet">
        <p className="sheet-heading">{label}</p>
        <div className="ledger-line ledger-rule">
          <span className="text-muted-foreground">Sales</span>
          <span className="amount">{money(figures.revenue)}</span>
        </div>
        <div className="ledger-line">
          <span className="text-muted-foreground">Cost of those goods</span>
          <span className="amount">− {money(figures.cogs)}</span>
        </div>
        <div className="ledger-line ledger-rule">
          <span className="font-medium">Gross profit</span>
          <span className="amount">{money(figures.grossProfit)}</span>
        </div>
        <div className="ledger-line">
          <span className="text-muted-foreground">Running costs</span>
          <span className="amount">− {money(figures.runningTotal)}</span>
        </div>
        <div className="ledger-line ledger-total">
          <span className="font-semibold">Net profit</span>
          <span className={`text-xl amount ${figures.netProfit < 0 ? 'text-destructive' : 'text-success'}`}>
            {money(figures.netProfit)}
          </span>
        </div>
      </div>

      <div className="sheet">
        <p className="sheet-heading">Where you stand today</p>
        <div className="ledger-line ledger-rule">
          <span className="text-muted-foreground">Stock on hand, at cost</span>
          <span className="num">{money(figures.stockAtCost)}</span>
        </div>
        <div className="ledger-line">
          <span className="text-muted-foreground">Owed to you</span>
          <span className="num">{money(figures.owedToYou)}</span>
        </div>
        <div className="ledger-line">
          <span className="text-muted-foreground">You owe suppliers</span>
          <span className="num">− {money(figures.youOwe)}</span>
        </div>
      </div>

      <Button className="w-full" onClick={exportSummary}>
        <Download className="h-4 w-4 mr-2" /> Summary spreadsheet
      </Button>

      <div className="sheet space-y-2">
        <span className="font-medium text-sm">Every line, if they ask</span>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The same period, one row per transaction. Most people only need this when a
          figure in the summary looks wrong and they want to see where it came from.
        </p>
        <Button variant="outline" className="w-full" onClick={exportTransactions}>
          <Download className="h-4 w-4 mr-2" /> Line-by-line spreadsheet
        </Button>
      </div>

      <div className="sheet">
        <p className="text-xs text-muted-foreground leading-relaxed">
          These are records you kept yourself. They are not audited, and they contain no
          cash, bank or M-Pesa balance — so they show how the shop traded, not everything
          it is worth.
        </p>
      </div>
    </div>
  );
}
