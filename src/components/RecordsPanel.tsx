import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, subMonths, startOfYear, startOfDay, endOfDay, subDays,
  isWithinInterval,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Sale, Expense, CreditSale, CreditPayment, Product, SalePayment } from '@/types/inventory';
import { SupplierDebt, Supplier } from '@/hooks/useSuppliers';
import { MpesaEntry } from '@/hooks/useMpesa';
import { BankStatement } from '@/components/BankStatement';
import { methodLabel } from '@/lib/payment';

interface RecordsPanelProps {
  shopName: string;
  ownerName: string;
  mpesaEntries: MpesaEntry[];
  getExpenseTotalForRange: (
    start: Date | string,
    end: Date | string,
    basis?: 'cash' | 'accrual',
    options?: { includeInventoryPurchases?: boolean }
  ) => number;
  sales: Sale[];
  salePayments: SalePayment[];
  expenses: Expense[];
  creditSales: CreditSale[];
  creditPayments: CreditPayment[];
  supplierDebts: SupplierDebt[];
  suppliers: Supplier[];
  products: Product[];
  customerName: (id: string) => string;
  sellerName: (id?: string | null) => string;
}

type RangeKey = 'month' | 'lastMonth' | 'year' | 'custom';

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
  shopName, ownerName, mpesaEntries, getExpenseTotalForRange,
  sales, salePayments, expenses, creditSales, creditPayments, supplierDebts,
  suppliers, products, customerName, sellerName,
}: RecordsPanelProps) {
  const [rangeKey, setRangeKey] = useState<RangeKey>('lastMonth');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { start, end, label } = useMemo(() => {
    const now = new Date();
    if (rangeKey === 'lastMonth') {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev), label: format(prev, 'MMMM yyyy') };
    }
    if (rangeKey === 'year') {
      return { start: startOfYear(now), end: now, label: format(now, 'yyyy') };
    }
    if (rangeKey === 'custom') {
      const from = startOfDay(new Date(customStart));
      const to = endOfDay(new Date(customEnd));
      return { start: from, end: to, label: `${format(from, 'd MMM')} to ${format(to, 'd MMM yyyy')}` };
    }
    return { start: startOfMonth(now), end: now, label: format(now, 'MMMM yyyy') };
  }, [rangeKey, customStart, customEnd]);

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
      [csv(shopName || 'DukaKonnect'), csv(''), csv('')].join(','),
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
      [csv('Records kept by the owner in DukaKonnect. Not audited.'), csv(''), csv('')].join(','),
      [csv('No cash, bank or M-Pesa balance is included.'), csv(''), csv('')].join(','),
    ];

    download(`dukakonnect-summary-${format(start, 'yyyy-MM')}.csv`, rows.join('\n'));
  };

  const exportTransactions = () => {
    const headers = [
      'date', 'time', 'type', 'description', 'party', 'category',
      'quantity', 'money_in', 'money_out', 'cost_of_goods',
      'moves_cash', 'payment_method', 'reference', 'recorded_by',
    ];

    const entries: { at: Date; cells: string[] }[] = [];

    // Grouped by receipt, because one customer's purchase may be several lines
    // settled several ways, and the file has to let both totals be checked.
    const byReceipt = new Map<string, Sale[]>();
    for (const s of sales) {
      if (!inRange(s.createdAt)) continue;
      const group = byReceipt.get(s.receiptId);
      if (group) group.push(s);
      else byReceipt.set(s.receiptId, [s]);
    }

    for (const [receiptId, lines] of byReceipt) {
      const at = new Date(lines[0].createdAt);
      const voided = lines.every((l) => Boolean(l.voidedAt));
      const payments = salePayments.filter((p) => p.receiptId === receiptId);
      const debt = creditSales.find(
        (c) => c.receiptId === receiptId || c.saleId === lines[0].id
      );
      const total = lines.reduce((sum, l) => sum + Number(l.totalAmount || 0), 0);

      // The ordinary case -- one item, paid once, in full -- stays exactly one
      // row, the way it has always read. Splitting every sale in two to serve
      // the rare basket would make the common file harder, not easier.
      const isSimple =
        lines.length === 1 &&
        !debt &&
        payments.length <= 1 &&
        (payments.length === 0 || Math.abs(payments[0].amount - total) < 0.01);

      if (isSimple) {
        const line = lines[0];
        const paid = payments[0];
        entries.push({
          at,
          cells: [
            format(at, 'yyyy-MM-dd'), format(at, 'HH:mm'),
            voided ? 'sale cancelled' : total === 0 ? 'giveaway' : 'sale',
            line.productName, '', 'Sales',
            String(line.quantity),
            voided ? '' : fixed(total),
            '',
            voided ? '' : fixed((line.costPrice ?? 0) * line.quantity),
            voided ? 'no' : 'yes',
            paid ? methodLabel(paid.method) : (line.paymentMethod ? methodLabel(line.paymentMethod) : ''),
            paid?.reference ?? line.paymentReference ?? '',
            sellerName(line.soldBy),
          ],
        });
        continue;
      }

      // Otherwise the two questions are answered separately: what was sold, and
      // how it was settled. money_in stays on the payment rows only, so summing
      // the column still gives money that actually arrived.
      for (const line of lines) {
        entries.push({
          at: new Date(line.createdAt),
          cells: [
            format(at, 'yyyy-MM-dd'), format(at, 'HH:mm'),
            voided ? 'sale cancelled' : 'sale item',
            line.productName,
            debt ? 'part on deni' : '', 'Sales',
            String(line.quantity),
            '',
            '',
            voided ? '' : fixed((line.costPrice ?? 0) * line.quantity),
            'no',
            '', '',
            sellerName(line.soldBy),
          ],
        });
      }

      if (!voided) {
        for (const paid of payments) {
          entries.push({
            at: new Date(paid.createdAt),
            cells: [
              format(at, 'yyyy-MM-dd'), format(at, 'HH:mm'),
              'sale payment',
              `Paid for ${lines[0].productName}${lines.length > 1 ? ` and ${lines.length - 1} more` : ''}`,
              '', 'Sales',
              '',
              fixed(paid.amount),
              '',
              '',
              'yes',
              methodLabel(paid.method),
              paid.reference ?? '',
              sellerName(lines[0].soldBy),
            ],
          });
        }
      }
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
      `dukakonnect-transactions-${format(start, 'yyyy-MM')}.csv`,
      [headers.join(','), ...entries.map((e) => e.cells.map(csv).join(','))].join('\n')
    );
  };

  const RANGES: { key: RangeKey; label: string }[] = [
    { key: 'lastMonth', label: 'Last month' },
    { key: 'month', label: 'This month' },
    { key: 'year', label: 'This year' },
    { key: 'custom', label: 'Pick dates' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
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

      {rangeKey === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      )}

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

      <div className="sheet space-y-2">
        <span className="font-medium text-sm">For a bank or lender</span>
        <p className="text-xs text-muted-foreground leading-relaxed">
          A one-page statement of the last six months, on paper. Your phone will offer to
          save it as a PDF instead of printing.
        </p>
        <Button variant="outline" className="w-full" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print statement
        </Button>
      </div>

      {/* Only visible on paper. Kept mounted so printing needs no new window,
          which mobile browsers handle badly. */}
      <div className="print-only">
        <BankStatement
          shopName={shopName}
          salePayments={salePayments}
          ownerName={ownerName}
          sales={sales}
          creditSales={creditSales}
          supplierDebts={supplierDebts}
          products={products}
          mpesaEntries={mpesaEntries}
          getExpenseTotalForRange={getExpenseTotalForRange}
        />
      </div>

      <div className="sheet">
        <p className="text-xs text-muted-foreground leading-relaxed">
          These are records you kept yourself. They are not audited, and they contain no
          cash, bank or M-Pesa balance, so they show how the shop traded, not everything
          it is worth.
        </p>
      </div>
    </div>
  );
}
