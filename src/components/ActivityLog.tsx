import { useMemo, useState } from 'react';
import { format, isSameDay, subDays, startOfDay } from 'date-fns';
import { Sale, SalePayment, CreditSale, CreditPayment, Expense, StockMovement } from '@/types/inventory';
import { SupplierPayment, SupplierDebt } from '@/hooks/useSuppliers';
import { StockTakeSummary } from '@/hooks/useStockTake';
import { TillCount } from '@/hooks/useTillCount';
import { Button } from '@/components/ui/button';
import { methodLabel } from '@/lib/payment';

interface ActivityLogProps {
  sales: Sale[];
  salePayments: SalePayment[];
  creditSales: CreditSale[];
  creditPayments: CreditPayment[];
  expenses: Expense[];
  stockMovements: StockMovement[];
  supplierDebts: SupplierDebt[];
  supplierPayments: SupplierPayment[];
  stockTakes: StockTakeSummary[];
  tillCounts: TillCount[];
  nameFor: (userId?: string | null) => string;
  customerName: (id: string) => string;
  supplierName: (id: string) => string;
}

type Lens = 'all' | 'in' | 'out' | 'stock' | 'checks';

interface Entry {
  key: string;
  at: Date;
  lens: Exclude<Lens, 'all'>;
  title: string;
  detail?: string;
  amount?: number;
  /** Which way the money went, for the sign and colour. */
  flow?: 'in' | 'out';
  actor?: string | null;
  muted?: boolean;
}

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });

const LENSES: { key: Lens; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'in', label: 'Money in' },
  { key: 'out', label: 'Money out' },
  { key: 'stock', label: 'Stock' },
  { key: 'checks', label: 'Counts' },
];

/**
 * Everything that happened in the shop, newest first, with a name against it.
 *
 * Built entirely from records that already exist rather than from a log table
 * written alongside them. The point of this screen is to be trusted, and a
 * separate log can disagree with the thing it claims to describe -- it can be
 * written when the real change failed, or missed when the real change succeeded.
 * Derived from the records themselves, it cannot drift, because it *is* them.
 *
 * The honest limit of that choice: it can only show what leaves a row behind. A
 * price edited, a product renamed, a permission granted -- none of those are
 * recorded anywhere, so none of them appear here. Showing them would mean a real
 * audit table with triggers, which is a different and larger piece of work.
 */
export function ActivityLog({
  sales, salePayments, creditSales, creditPayments, expenses, stockMovements,
  supplierDebts, supplierPayments, stockTakes, tillCounts,
  nameFor, customerName, supplierName,
}: ActivityLogProps) {
  const [lens, setLens] = useState<Lens>('all');
  const [days, setDays] = useState(7);

  const entries = useMemo(() => {
    const since = startOfDay(subDays(new Date(), days - 1));
    const recent = (d: string | Date) => new Date(d) >= since;
    const out: Entry[] = [];

    // --- Sales, one entry per receipt rather than per line ------------------
    const receipts = new Map<string, Sale[]>();
    for (const sale of sales) {
      if (!recent(sale.createdAt)) continue;
      const group = receipts.get(sale.receiptId);
      if (group) group.push(sale);
      else receipts.set(sale.receiptId, [sale]);
    }

    for (const [receiptId, lines] of receipts) {
      const at = new Date(lines[0].createdAt);
      const total = lines.reduce((sum, l) => sum + Number(l.totalAmount || 0), 0);
      const voided = lines.every((l) => Boolean(l.voidedAt));
      const paid = salePayments.filter((p) => p.receiptId === receiptId);
      const debt = creditSales.find((c) => c.receiptId === receiptId || c.saleId === lines[0].id);

      const what = lines.length > 1
        ? `${lines[0].productName} and ${lines.length - 1} more`
        : `${lines[0].productName}${lines[0].quantity > 1 ? ` ×${lines[0].quantity}` : ''}`;

      if (voided) {
        out.push({
          key: `void-${receiptId}`,
          at: new Date(lines[0].voidedAt || at),
          lens: 'in',
          title: 'Sale cancelled',
          detail: what,
          amount: total,
          actor: nameFor(lines[0].voidedBy || lines[0].soldBy),
          muted: true,
        });
        continue;
      }

      // How it was settled, spelled out -- this is the line that makes a split
      // visible at a glance instead of buried in a total.
      const how = [
        ...paid.map((p) => `${methodLabel(p.method)} ${money(p.amount)}`),
        ...(debt ? [`deni ${money(debt.amount)} · ${customerName(debt.customerId)}`] : []),
      ].join(' · ');

      out.push({
        key: `sale-${receiptId}`,
        at,
        lens: 'in',
        title: what,
        detail: how || (total === 0 ? 'Given away, no charge' : 'Payment not recorded'),
        amount: total,
        flow: 'in',
        actor: nameFor(lines[0].soldBy),
      });
    }

    // --- Deni repaid -------------------------------------------------------
    for (const p of creditPayments) {
      if (!recent(p.paidAt)) continue;
      out.push({
        key: `credit-${p.id}`,
        at: new Date(p.paidAt),
        lens: 'in',
        title: 'Deni repaid',
        detail: `${customerName(p.customerId)}${p.paymentMethod ? ` · ${methodLabel(p.paymentMethod)}` : ''}`,
        amount: p.amount,
        flow: 'in',
        actor: nameFor(p.recordedBy),
      });
    }

    // --- Spending ----------------------------------------------------------
    // Restock-sourced expenses are skipped: the restock and the supplier payment
    // below already report those, and listing all three tells the owner the same
    // money left three times.
    for (const e of expenses) {
      if (e.source === 'restock' || !recent(e.date)) continue;
      out.push({
        key: `expense-${e.id}`,
        at: new Date(e.date),
        lens: 'out',
        title: e.description || e.category || 'Spending',
        detail: `${e.category}${e.paymentMethod ? ` · ${methodLabel(e.paymentMethod)}` : ''}`,
        amount: e.amount,
        flow: 'out',
        actor: nameFor(e.recordedBy),
      });
    }

    // --- Stock in ----------------------------------------------------------
    // An expense is linked only when the stock was paid for on the spot, so its
    // absence is what tells us the stock came in on credit.
    for (const m of stockMovements) {
      if (m.reason !== 'restock' || m.movementType !== 'in' || !recent(m.happenedAt)) continue;
      const onCredit = !m.expenseId;
      out.push({
        key: `restock-${m.id}`,
        at: new Date(m.happenedAt),
        lens: 'stock',
        title: `Restocked ${m.productName}`,
        detail: `${m.quantity} in · ${onCredit ? 'on credit' : 'paid'}`,
        amount: m.totalCost,
        flow: onCredit ? undefined : 'out',
        actor: nameFor(m.createdBy),
      });
    }

    // --- Paying suppliers --------------------------------------------------
    const debtSupplier = new Map(supplierDebts.map((d) => [d.id, d.supplierId]));
    for (const p of supplierPayments) {
      if (!recent(p.paidAt)) continue;
      const supplier = debtSupplier.get(p.supplierDebtId);
      out.push({
        key: `supplier-${p.id}`,
        at: new Date(p.paidAt),
        lens: 'out',
        title: `Paid ${supplier ? supplierName(supplier) : 'a supplier'}`,
        detail: p.paymentMethod ? methodLabel(p.paymentMethod) : undefined,
        amount: p.amount,
        flow: 'out',
        actor: nameFor(p.recordedBy),
      });
    }

    // --- The checks --------------------------------------------------------
    for (const t of stockTakes) {
      if (!recent(t.countedAt)) continue;
      out.push({
        key: `take-${t.id}`,
        at: new Date(t.countedAt),
        lens: 'checks',
        title: 'Stock counted',
        detail: t.shrinkageValue > 0
          ? `${t.itemsCounted} items · ${money(t.shrinkageValue)} missing`
          : `${t.itemsCounted} items · nothing missing`,
        muted: t.shrinkageValue === 0,
      });
    }

    for (const c of tillCounts) {
      if (!recent(c.countedFor)) continue;
      const off = Math.abs(c.difference) >= 1;
      out.push({
        key: `till-${c.countedFor}`,
        at: new Date(c.countedFor),
        lens: 'checks',
        title: 'Till counted',
        detail: off
          ? `${money(Math.abs(c.difference))} ${c.difference < 0 ? 'short' : 'over'}`
          : 'Balanced',
        muted: !off,
      });
    }

    return out.sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [
    sales, salePayments, creditSales, creditPayments, expenses, stockMovements,
    supplierDebts, supplierPayments, stockTakes, tillCounts,
    nameFor, customerName, supplierName, days,
  ]);

  const shown = lens === 'all' ? entries : entries.filter((e) => e.lens === lens);

  // Grouped by day so the list reads as a diary rather than a wall of rows.
  const byDay = useMemo(() => {
    const groups: { day: Date; items: Entry[] }[] = [];
    for (const entry of shown) {
      const last = groups[groups.length - 1];
      if (last && isSameDay(last.day, entry.at)) last.items.push(entry);
      else groups.push({ day: entry.at, items: [entry] });
    }
    return groups;
  }, [shown]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-1">
        {LENSES.map((l) => (
          <Button
            key={l.key}
            variant={lens === l.key ? 'default' : 'outline'}
            size="sm"
            className="px-1 text-xs"
            onClick={() => setLens(l.key)}
          >
            {l.label}
          </Button>
        ))}
      </div>

      {byDay.length === 0 ? (
        <div className="sheet text-center py-10">
          <p className="text-sm text-muted-foreground">
            Nothing recorded in the last {days} days.
          </p>
        </div>
      ) : (
        byDay.map((group) => (
          <div key={group.day.toISOString()} className="sheet">
            <p className="sheet-heading">
              {isSameDay(group.day, new Date()) ? 'Today' : format(group.day, 'EEEE d MMMM')}
            </p>
            <div className="mt-1 divide-y divide-border/70">
              {group.items.map((entry) => (
                <div key={entry.key} className={`py-2 ${entry.muted ? 'opacity-60' : ''}`}>
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs text-muted-foreground num shrink-0 w-11">
                      {format(entry.at, 'HH:mm')}
                    </span>
                    <span className={`flex-1 min-w-0 truncate text-sm ${entry.muted ? 'line-through' : ''}`}>
                      {entry.title}
                    </span>
                    {entry.amount !== undefined && (
                      <span
                        className={`amount text-sm shrink-0 ${
                          entry.flow === 'out' ? 'text-warning' : entry.flow === 'in' ? '' : 'text-muted-foreground'
                        }`}
                      >
                        {entry.flow === 'out' ? '−' : ''}{money(entry.amount)}
                      </span>
                    )}
                  </div>
                  {(entry.detail || entry.actor) && (
                    <div className="flex items-baseline gap-2 pl-14 mt-0.5">
                      {entry.detail && (
                        <span className="text-xs text-muted-foreground truncate">{entry.detail}</span>
                      )}
                      {entry.actor && (
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {entry.actor}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <Button
            key={d}
            variant={days === d ? 'default' : 'outline'}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setDays(d)}
          >
            {d} days
          </Button>
        ))}
      </div>

      <div className="sheet">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Built from your records themselves, so it cannot disagree with them. It shows
          money and stock moving. It does not yet show a price being edited or a
          permission being changed, because those are not recorded anywhere.
        </p>
      </div>
    </div>
  );
}
