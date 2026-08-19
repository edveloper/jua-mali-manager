import { useMemo } from 'react';
import { format, startOfMonth, subMonths, isWithinInterval, endOfMonth } from 'date-fns';
import { Sale, CreditSale, Product, SalePayment } from '@/types/inventory';
import { SupplierDebt } from '@/hooks/useSuppliers';
import { MpesaEntry } from '@/hooks/useMpesa';

interface BankStatementProps {
  shopName: string;
  ownerName: string;
  sales: Sale[];
  salePayments: SalePayment[];
  creditSales: CreditSale[];
  supplierDebts: SupplierDebt[];
  products: Product[];
  mpesaEntries: MpesaEntry[];
  getExpenseTotalForRange: (
    start: Date | string,
    end: Date | string,
    basis?: 'cash' | 'accrual',
    options?: { includeInventoryPurchases?: boolean }
  ) => number;
  months?: number;
}

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });

/**
 * A statement a shopkeeper can print and hand to a lender.
 *
 * Deliberately restrained about what it claims. A bank officer knows an app can
 * only report what the owner typed in, and a document that pretends otherwise
 * damages the person carrying it. The one figure here that is not self-reported
 * is the share of turnover matched to M-Pesa records -- which is the whole
 * argument for having built reconciliation before this.
 */
export function BankStatement({
  shopName, ownerName, sales, salePayments, creditSales, supplierDebts, products,
  mpesaEntries, getExpenseTotalForRange, months = 6,
}: BankStatementProps) {
  const report = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(subMonths(now, months - 1));

    const inPeriod = sales.filter(
      (s) => !s.voidedAt && isWithinInterval(new Date(s.createdAt), { start, end: now })
    );

    const turnover = inPeriod.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const cogs = inPeriod.reduce((sum, s) => sum + (s.costPrice ?? 0) * s.quantity, 0);
    const runningCosts = getExpenseTotalForRange(start, now, 'accrual', {
      includeInventoryPurchases: false,
    });

    // The one figure here that is not self-reported: money whose transaction code
    // was found in the shop's own M-Pesa messages. Summed from payments rather
    // than sales, so a receipt half paid by M-Pesa contributes only that half.
    const matchedCodes = new Set(
      mpesaEntries.filter((e) => e.matchedSaleId).map((e) => e.code.toUpperCase())
    );
    const liveReceipts = new Set(inPeriod.map((s) => s.receiptId));
    const verified = salePayments
      .filter(
        (p) =>
          liveReceipts.has(p.receiptId) &&
          p.reference &&
          matchedCodes.has(p.reference.toUpperCase())
      )
      .reduce((sum, p) => sum + p.amount, 0);

    const byMonth: { label: string; turnover: number; sales: number }[] = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(monthStart);
      const monthSales = inPeriod.filter((s) =>
        isWithinInterval(new Date(s.createdAt), { start: monthStart, end: monthEnd })
      );
      byMonth.push({
        label: format(monthStart, 'MMM yyyy'),
        turnover: monthSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0),
        sales: monthSales.length,
      });
    }

    const trading = byMonth.filter((m) => m.turnover > 0);

    return {
      start,
      end: now,
      turnover,
      cogs,
      grossProfit: turnover - cogs,
      runningCosts,
      netProfit: turnover - cogs - runningCosts,
      verified,
      byMonth,
      monthlyAverage: trading.length > 0 ? turnover / trading.length : 0,
      stockAtCost: products.reduce((sum, p) => sum + p.costPrice * p.quantity, 0),
      owedToBusiness: creditSales
        .filter((c) => c.status !== 'paid')
        .reduce((sum, c) => sum + c.balance, 0),
      owedByBusiness: supplierDebts
        .filter((d) => d.status !== 'paid')
        .reduce((sum, d) => sum + d.balance, 0),
    };
  }, [sales, salePayments, creditSales, supplierDebts, products, mpesaEntries, getExpenseTotalForRange, months]);

  const Row = ({ label, value, note, heavy }: { label: string; value: string; note?: string; heavy?: boolean }) => (
    <div className={`flex items-baseline justify-between gap-6 py-1.5 ${heavy ? 'print-heavy border-t-2 border-foreground/30 mt-1 pt-2 font-semibold' : ''}`}>
      <span>
        {label}
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </span>
      <span className="num whitespace-nowrap">{value}</span>
    </div>
  );

  return (
    <div className="print-document text-sm">
      <div className="pb-3 mb-3 border-b-2 border-foreground/30 print-heavy">
        <p className="text-lg font-bold">{shopName || 'This business'}</p>
        <p className="text-xs text-muted-foreground">Statement of trading</p>
        <p className="text-xs text-muted-foreground mt-1">
          {format(report.start, 'd MMMM yyyy')} to {format(report.end, 'd MMMM yyyy')}
          {ownerName && ` · ${ownerName}`}
        </p>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide mb-1">Turnover</p>
      <Row label="Total sales" value={money(report.turnover)} />
      <Row label="Average month" value={money(report.monthlyAverage)} note="Months with trading only" />
      {report.verified > 0 && (
        <Row
          label="Matched to M-Pesa records"
          value={money(report.verified)}
          note={`${Math.round((report.verified / Math.max(1, report.turnover)) * 100)}% of turnover confirmed against transaction messages`}
        />
      )}

      <p className="text-xs font-semibold uppercase tracking-wide mt-4 mb-1">Month by month</p>
      {report.byMonth.map((m) => (
        <div key={m.label} className="flex items-baseline justify-between gap-6 py-1">
          <span>{m.label}</span>
          <span className="num">{money(m.turnover)}</span>
        </div>
      ))}

      <p className="text-xs font-semibold uppercase tracking-wide mt-4 mb-1">Trading result</p>
      <Row label="Sales" value={money(report.turnover)} />
      <Row label="Cost of goods sold" value={`(${money(report.cogs)})`} />
      <Row label="Gross profit" value={money(report.grossProfit)} />
      <Row label="Running costs" value={`(${money(report.runningCosts)})`} note="Rent, wages, transport and the like" />
      <Row label="Net profit" value={money(report.netProfit)} heavy />

      <p className="text-xs font-semibold uppercase tracking-wide mt-4 mb-1">Position today</p>
      <Row label="Stock held, at cost" value={money(report.stockAtCost)} />
      <Row label="Owed to the business" value={money(report.owedToBusiness)} note="Customer credit outstanding" />
      <Row label="Owed by the business" value={`(${money(report.owedByBusiness)})`} note="Supplier credit outstanding" />

      <div className="mt-5 pt-3 border-t border-foreground/20 print-rule text-xs text-muted-foreground leading-relaxed">
        <p>
          Prepared on {format(new Date(), 'd MMMM yyyy')} from records kept by the business
          owner in DukaKonnect. These records are not audited.
        </p>
        <p className="mt-1">
          No bank, cash or M-Pesa account balance is included. Where a figure is shown as
          matched to M-Pesa records, it has been checked against transaction messages
          received by the business.
        </p>
      </div>
    </div>
  );
}
