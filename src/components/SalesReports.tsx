import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend
} from 'recharts';
import { CreditCard, Calendar as CalendarIcon, ArrowRight, Download, FileText, Banknote } from 'lucide-react';
import { Sale, CreditSale, StockMovement, ServiceSale, Expense } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';

interface SalesReportsProps {
  sales: Sale[];
  creditSales: CreditSale[];
  /** Repayments against earlier credit sales, by date received. */
  getCreditPaymentsTotalForRange?: (start: Date | string, end: Date | string) => number;
  getExpenseTotalForRange: (
    start: Date | string,
    end: Date | string,
    basis?: 'cash' | 'accrual',
    options?: { includeInventoryPurchases?: boolean }
   ) => number;
  expenses?: Expense[];
  stockPurchases?: StockMovement[];
  serviceSessions?: ServiceSale[];
  offeringMode?: 'products' | 'services' | 'mixed' | string;
  businessCategory?: string;
  singleOffering?: boolean;
}

type RangeType = '7d' | '30d' | 'thisMonth' | 'custom';

const formatCurrency = (amount: number) => `KSh ${amount.toLocaleString()}`;
const csvEscape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
// Matches useExpenses: only restock-generated expenses are already counted as
// COGS. Anything entered by hand is a genuine operating outflow.
const isRestockExpense = (expense: Expense) => expense.source === 'restock';

export function SalesReports({
  sales,
  creditSales = [],
  getCreditPaymentsTotalForRange,
  getExpenseTotalForRange,
  expenses = [],
  stockPurchases = [],
  serviceSessions = [],
  offeringMode = 'products',
  businessCategory = 'retail',
  singleOffering = false
}: SalesReportsProps) {
  const [rangeType, setRangeType] = useState<RangeType>('7d');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expenseBasis, setExpenseBasis] = useState<'cash' | 'accrual'>('accrual');
  const [docTab, setDocTab] = useState<'all' | 'loan' | 'visa'>('all');

  const filteredData = useMemo(() => {
    let start = startOfDay(new Date());
    let end = endOfDay(new Date());

    if (rangeType === '7d') start = startOfDay(subDays(new Date(), 7));
    else if (rangeType === '30d') start = startOfDay(subDays(new Date(), 30));
    else if (rangeType === 'thisMonth') start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    else if (rangeType === 'custom') {
      start = startOfDay(new Date(customStart));
      end = endOfDay(new Date(customEnd));
    }

    const fSales = sales.filter((s) => isWithinInterval(new Date(s.createdAt), { start, end }));
    const fCredits = creditSales.filter((c) => isWithinInterval(new Date(c.createdAt), { start, end }));

    return { fSales, fCredits, start, end };
  }, [sales, creditSales, rangeType, customStart, customEnd]);

  const filteredStockPurchases = useMemo(
    () => stockPurchases.filter((m) => isWithinInterval(new Date(m.happenedAt), { start: filteredData.start, end: filteredData.end })),
    [stockPurchases, filteredData.start, filteredData.end]
  );

  const filteredServiceSessions = useMemo(
    () => serviceSessions.filter((s) => isWithinInterval(new Date(s.createdAt), { start: filteredData.start, end: filteredData.end })),
    [serviceSessions, filteredData.start, filteredData.end]
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => isWithinInterval(new Date(e.date), { start: filteredData.start, end: filteredData.end })),
    [expenses, filteredData.start, filteredData.end]
  );

  const stats = useMemo(() => {
    const totalRevenue = filteredData.fSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalProfit = filteredData.fSales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const creditIssued = filteredData.fCredits.reduce((sum, c) => sum + (c.amount || 0), 0);
    // Sales that were paid for on the spot.
    const cashRevenue = totalRevenue - creditIssued;
    // Money in against debts from earlier periods. Not revenue -- that was
    // already counted when the sale happened -- but it is cash through the door.
    const creditCollected = getCreditPaymentsTotalForRange
      ? getCreditPaymentsTotalForRange(filteredData.start, filteredData.end)
      : 0;
    const cashCollected = cashRevenue + creditCollected;
    const estimatedTOT = totalRevenue * 0.03;
    const avgTicket = filteredData.fSales.length ? totalRevenue / filteredData.fSales.length : 0;
    const avgDailySales = filteredData.fSales.length
      ? totalRevenue / Math.max(1, new Set(filteredData.fSales.map((s) => format(new Date(s.createdAt), 'yyyy-MM-dd'))).size)
      : 0;
    const totalExpenses = getExpenseTotalForRange(
      filteredData.start,
      filteredData.end,
      expenseBasis,
      { includeInventoryPurchases: false }
    );
    const netAfterExpenses = totalProfit - totalExpenses;
    const operatingMargin = totalRevenue > 0 ? (netAfterExpenses / totalRevenue) * 100 : 0;

    const byProduct = new Map<string, { qty: number; revenue: number; profit: number }>();
    for (const s of filteredData.fSales) {
      const key = s.productName || 'Unknown';
      const row = byProduct.get(key) || { qty: 0, revenue: 0, profit: 0 };
      row.qty += Number(s.quantity || 0);
      row.revenue += Number(s.totalAmount || 0);
      row.profit += Number(s.profit || 0);
      byProduct.set(key, row);
    }
    const topItems = [...byProduct.entries()]
      .map(([name, row]) => ({ name, ...row }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const dayMap = new Map<string, number>();
    for (const s of filteredData.fSales) {
      const d = format(new Date(s.createdAt), 'MM-dd');
      dayMap.set(d, (dayMap.get(d) || 0) + Number(s.totalAmount || 0));
    }
    const trendData = [...dayMap.entries()].map(([day, revenue]) => ({ day, revenue }));

    const values = trendData.map((d) => d.revenue);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const variance = values.length ? values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length : 0;
    const stdDev = Math.sqrt(variance);
    const consistencyScore = avg > 0 ? Math.max(0, Math.min(100, Math.round(100 - (stdDev / avg) * 100))) : 0;

    return {
      totalRevenue, totalProfit, cashRevenue, creditIssued, creditCollected, cashCollected, estimatedTOT, avgTicket, avgDailySales, topItems, trendData, consistencyScore, totalExpenses, netAfterExpenses, operatingMargin
    };
  }, [filteredData, getExpenseTotalForRange, getCreditPaymentsTotalForRange, expenseBasis]);

  const expenseStats = useMemo(() => {
    const operatingByCategory = new Map<string, number>();
    let operatingExpenseTotal = 0;
    let inventoryAsExpenseTotal = 0;

    for (const e of filteredExpenses) {
      const amount = Number(e.amount || 0);
      const key = e.category || 'Other';
      if (isRestockExpense(e)) {
        inventoryAsExpenseTotal += amount;
        continue;
      }
      operatingExpenseTotal += amount;
      operatingByCategory.set(key, (operatingByCategory.get(key) || 0) + amount);
    }

    const operatingCategorySpend = [...operatingByCategory.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    const purchasesTotal = filteredStockPurchases.reduce((sum, row) => sum + Number(row.totalCost || 0), 0);
    const purchasesCombinedTotal = purchasesTotal + inventoryAsExpenseTotal;
    const totalOutflow = operatingExpenseTotal + purchasesCombinedTotal;
    const outflowBreakdown = [
      { name: 'Operating expenses', amount: operatingExpenseTotal },
      { name: 'Purchases/restock', amount: purchasesCombinedTotal },
    ];

    const dayMap = new Map<string, { operating: number; purchases: number }>();
    for (const e of filteredExpenses) {
      const day = format(new Date(e.date), 'MM-dd');
      const row = dayMap.get(day) || { operating: 0, purchases: 0 };
      if (isRestockExpense(e)) {
        row.purchases += Number(e.amount || 0);
      } else {
        row.operating += Number(e.amount || 0);
      }
      dayMap.set(day, row);
    }
    for (const p of filteredStockPurchases) {
      const day = format(new Date(p.happenedAt), 'MM-dd');
      const row = dayMap.get(day) || { operating: 0, purchases: 0 };
      row.purchases += Number(p.totalCost || 0);
      dayMap.set(day, row);
    }
    const outflowTrend = [...dayMap.entries()].map(([day, values]) => ({
      day,
      operating: values.operating,
      purchases: values.purchases,
      total: values.operating + values.purchases,
    }));

    return {
      operatingCategorySpend,
      operatingExpenseTotal,
      purchasesCombinedTotal,
      totalOutflow,
      outflowBreakdown,
      outflowTrend,
    };
  }, [filteredExpenses, filteredStockPurchases]);

  const operationsStats = useMemo(() => {
    const totalRestockSpend = filteredStockPurchases.reduce((sum, row) => sum + Number(row.totalCost || 0), 0);
    const totalRestockUnits = filteredStockPurchases.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const purchasedSkuCount = new Set(filteredStockPurchases.map((row) => row.productId)).size;
    const avgUnitCost = totalRestockUnits > 0 ? totalRestockSpend / totalRestockUnits : 0;

    const byProduct = new Map<string, { qty: number; spend: number }>();
    for (const row of filteredStockPurchases) {
      const key = row.productName || 'Unknown';
      const current = byProduct.get(key) || { qty: 0, spend: 0 };
      current.qty += Number(row.quantity || 0);
      current.spend += Number(row.totalCost || 0);
      byProduct.set(key, current);
    }
    const topPurchased = [...byProduct.entries()]
      .map(([name, row]) => ({ name, qty: row.qty, spend: row.spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    const spendByDay = new Map<string, number>();
    for (const row of filteredStockPurchases) {
      const day = format(new Date(row.happenedAt), 'MM-dd');
      spendByDay.set(day, (spendByDay.get(day) || 0) + Number(row.totalCost || 0));
    }
    const spendTrend = [...spendByDay.entries()].map(([day, spend]) => ({ day, spend }));

    const totalServiceRevenue = filteredServiceSessions.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
    const completedSessions = filteredServiceSessions.filter((row) => row.status === 'completed').length;
    const scheduledSessions = filteredServiceSessions.filter((row) => row.status === 'scheduled').length;

    return {
      totalRestockSpend,
      totalRestockUnits,
      purchasedSkuCount,
      avgUnitCost,
      topPurchased,
      spendTrend,
      totalServiceRevenue,
      completedSessions,
      scheduledSessions,
    };
  }, [filteredStockPurchases, filteredServiceSessions]);

  const exportSalesCsv = () => {
    const headers = ['date', 'item', 'quantity', 'total_amount', 'profit'];
    const rows = filteredData.fSales.map((s) => [
      csvEscape(format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm')),
      csvEscape(s.productName),
      csvEscape(Number(s.quantity || 0)),
      csvEscape(Number(s.totalAmount || 0)),
      csvEscape(Number(s.profit || 0)),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportLoanSummaryTxt = () => {
    const lines = [
      `Duka Manager Loan Readiness Summary`,
      `Period: ${format(filteredData.start, 'MMM d, yyyy')} - ${format(filteredData.end, 'MMM d, yyyy')}`,
      `Business mode: ${offeringMode}`,
      `Business category: ${businessCategory}`,
      `Single offering: ${singleOffering ? 'Yes' : 'No'}`,
      `Total turnover: ${formatCurrency(stats.totalRevenue)}`,
      `Operating expenses (${expenseBasis} basis): ${formatCurrency(stats.totalExpenses)}`,
      `Gross profit: ${formatCurrency(stats.totalProfit)}`,
      `Net after expenses: ${formatCurrency(stats.netAfterExpenses)}`,
      `Average ticket: ${formatCurrency(stats.avgTicket)}`,
      `Consistency score: ${stats.consistencyScore}/100`,
      `Estimated TOT (3%): ${formatCurrency(stats.estimatedTOT)}`
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-readiness-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportStockPurchasesCsv = () => {
    const headers = ['date', 'product', 'quantity', 'unit_cost', 'total_cost', 'notes'];
    const rows = filteredStockPurchases.map((p) => [
      csvEscape(format(new Date(p.happenedAt), 'yyyy-MM-dd HH:mm')),
      csvEscape(p.productName),
      csvEscape(p.quantity),
      csvEscape(p.unitCost),
      csvEscape(p.totalCost),
      csvEscape(p.notes || ''),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-purchases-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportStockPurchasesExcel = () => {
    const headers = ['Date', 'Product', 'Quantity', 'Unit Cost', 'Total Cost', 'Notes'];
    const rows = filteredStockPurchases.map((p) => [
      format(new Date(p.happenedAt), 'yyyy-MM-dd HH:mm'),
      p.productName,
      String(p.quantity),
      String(p.unitCost),
      String(p.totalCost),
      p.notes || '',
    ].join('\t'));
    const content = [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-purchases-${format(new Date(), 'yyyy-MM-dd')}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportServiceSessionsCsv = () => {
    const headers = ['date', 'service', 'quantity', 'amount', 'profit', 'staff', 'status', 'notes'];
    const rows = filteredServiceSessions.map((s) => [
      csvEscape(format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm')),
      csvEscape(s.serviceName),
      csvEscape(s.quantity),
      csvEscape(s.totalAmount),
      csvEscape(s.profit),
      csvEscape(s.staffName || ''),
      csvEscape(s.status || ''),
      csvEscape(s.notes || ''),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-sessions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportServiceSessionsExcel = () => {
    const headers = ['Date', 'Service', 'Quantity', 'Amount', 'Profit', 'Staff', 'Status', 'Notes'];
    const rows = filteredServiceSessions.map((s) => [
      format(new Date(s.createdAt), 'yyyy-MM-dd HH:mm'),
      s.serviceName,
      String(s.quantity),
      String(s.totalAmount),
      String(s.profit),
      s.staffName || '',
      s.status || '',
      s.notes || '',
    ].join('\t'));
    const content = [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-sessions-${format(new Date(), 'yyyy-MM-dd')}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportExpensesCsv = () => {
    const headers = ['date', 'category', 'description', 'amount', 'type', 'allocation_mode'];
    const rows = filteredExpenses.map((e) => [
      csvEscape(format(new Date(e.date), 'yyyy-MM-dd')),
      csvEscape(e.category || ''),
      csvEscape(e.description || ''),
      csvEscape(Number(e.amount || 0)),
      csvEscape(e.expenseType || 'one_off'),
      csvEscape(e.allocationMode || 'cash'),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportExpensesExcel = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Type', 'Allocation Mode'];
    const rows = filteredExpenses.map((e) => [
      format(new Date(e.date), 'yyyy-MM-dd'),
      e.category || '',
      e.description || '',
      String(Number(e.amount || 0)),
      e.expenseType || 'one_off',
      e.allocationMode || 'cash',
    ].join('\t'));
    const content = [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const buildStyledDocument = (title: string, subtitle: string, body: string) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#1f2937;background:#fff}
    .header{border-bottom:2px solid #e5e7eb;padding-bottom:12px;margin-bottom:16px}
    .title{font-size:22px;font-weight:700;color:#111827}
    .sub{font-size:12px;color:#6b7280;margin-top:4px}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}
    .card{border:1px solid #e5e7eb;border-radius:10px;padding:10px}
    .label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}
    .value{font-size:18px;font-weight:700;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th,td{border:1px solid #e5e7eb;padding:8px;font-size:12px;text-align:left}
    th{background:#f9fafb}
    h3{margin:16px 0 8px;font-size:14px}
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${title}</div>
    <div class="sub">${subtitle}</div>
  </div>
  ${body}
</body>
</html>`;

  const downloadHtmlDoc = (fileName: string, html: string) => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportLoanPackHtml = () => {
    const body = `
      <div class="grid">
        <div class="card"><div class="label">Turnover</div><div class="value">${formatCurrency(stats.totalRevenue)}</div></div>
        <div class="card"><div class="label">Gross Profit</div><div class="value">${formatCurrency(stats.totalProfit)}</div></div>
        <div class="card"><div class="label">Operating Expenses</div><div class="value">${formatCurrency(stats.totalExpenses)}</div></div>
        <div class="card"><div class="label">Net After Expenses</div><div class="value">${formatCurrency(stats.netAfterExpenses)}</div></div>
      </div>
      <h3>Top Selling Items</h3>
      <table><thead><tr><th>Item</th><th>Revenue</th><th>Qty</th></tr></thead><tbody>
      ${stats.topItems.map((t) => `<tr><td>${t.name}</td><td>${formatCurrency(t.revenue)}</td><td>${t.qty}</td></tr>`).join('')}
      </tbody></table>
      <h3>Operational Snapshot</h3>
      <table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
      <tr><td>Consistency Score</td><td>${stats.consistencyScore}/100</td></tr>
      <tr><td>Average Ticket</td><td>${formatCurrency(stats.avgTicket)}</td></tr>
      <tr><td>Average Daily Sales</td><td>${formatCurrency(stats.avgDailySales)}</td></tr>
      <tr><td>Restock Spend</td><td>${formatCurrency(operationsStats.totalRestockSpend)}</td></tr>
      </tbody></table>`;
    const html = buildStyledDocument(
      'Duka Manager Loan Application Pack',
      `Period: ${format(filteredData.start, 'MMM d, yyyy')} - ${format(filteredData.end, 'MMM d, yyyy')}`,
      body
    );
    downloadHtmlDoc(`loan-pack-${format(new Date(), 'yyyy-MM-dd')}.html`, html);
  };

  const exportVisaPackHtml = () => {
    const body = `
      <div class="grid">
        <div class="card"><div class="label">Total Sales</div><div class="value">${formatCurrency(stats.totalRevenue)}</div></div>
        <div class="card"><div class="label">Operating Margin</div><div class="value">${stats.operatingMargin.toFixed(1)}%</div></div>
        <div class="card"><div class="label">Business Type</div><div class="value">${String(offeringMode).toUpperCase()}</div></div>
        <div class="card"><div class="label">Estimated Tax (TOT)</div><div class="value">${formatCurrency(stats.estimatedTOT)}</div></div>
      </div>
      <h3>Sales List</h3>
      <table><thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>
      ${filteredData.fSales.map((s) => `<tr><td>${format(new Date(s.createdAt), 'yyyy-MM-dd')}</td><td>${s.productName}</td><td>${s.quantity}</td><td>${formatCurrency(Number(s.totalAmount || 0))}</td></tr>`).join('')}
      </tbody></table>`;
    const html = buildStyledDocument(
      'Duka Manager Visa Financial Summary',
      `Period: ${format(filteredData.start, 'MMM d, yyyy')} - ${format(filteredData.end, 'MMM d, yyyy')}`,
      body
    );
    downloadHtmlDoc(`visa-financial-summary-${format(new Date(), 'yyyy-MM-dd')}.html`, html);
  };

  const exportFullDossierHtml = () => {
    const body = `
      <div class="grid">
        <div class="card"><div class="label">Turnover</div><div class="value">${formatCurrency(stats.totalRevenue)}</div></div>
        <div class="card"><div class="label">Gross Profit</div><div class="value">${formatCurrency(stats.totalProfit)}</div></div>
        <div class="card"><div class="label">Operating Expenses</div><div class="value">${formatCurrency(stats.totalExpenses)}</div></div>
        <div class="card"><div class="label">Net After Expenses</div><div class="value">${formatCurrency(stats.netAfterExpenses)}</div></div>
      </div>
      <h3>Operating Expense Categories</h3>
      <table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>
      ${expenseStats.operatingCategorySpend.map((e) => `<tr><td>${e.name}</td><td>${formatCurrency(e.amount)}</td></tr>`).join('')}
      </tbody></table>
      <h3>Purchases</h3>
      <table><thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Total Cost</th></tr></thead><tbody>
      ${filteredStockPurchases.map((p) => `<tr><td>${format(new Date(p.happenedAt), 'yyyy-MM-dd')}</td><td>${p.productName}</td><td>${p.quantity}</td><td>${formatCurrency(Number(p.totalCost || 0))}</td></tr>`).join('')}
      </tbody></table>
      <h3>Sales</h3>
      <table><thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>
      ${filteredData.fSales.map((s) => `<tr><td>${format(new Date(s.createdAt), 'yyyy-MM-dd')}</td><td>${s.productName}</td><td>${s.quantity}</td><td>${formatCurrency(Number(s.totalAmount || 0))}</td></tr>`).join('')}
      </tbody></table>`;
    const html = buildStyledDocument(
      'Duka Manager Complete Business Dossier',
      `Period: ${format(filteredData.start, 'MMM d, yyyy')} - ${format(filteredData.end, 'MMM d, yyyy')}`,
      body
    );
    downloadHtmlDoc(`duka-dossier-${format(new Date(), 'yyyy-MM-dd')}.html`, html);
  };

  const exportOperationsSummaryTxt = () => {
    const lines = [
      'Duka Manager Operations Summary',
      `Period: ${format(filteredData.start, 'MMM d, yyyy')} - ${format(filteredData.end, 'MMM d, yyyy')}`,
      `Business mode: ${offeringMode}`,
      '',
      'Inventory Operations',
      `Restock spend: ${formatCurrency(operationsStats.totalRestockSpend)}`,
      `Units purchased: ${operationsStats.totalRestockUnits}`,
      `Purchased SKUs: ${operationsStats.purchasedSkuCount}`,
      `Average unit cost: ${formatCurrency(operationsStats.avgUnitCost)}`,
      '',
      'Service Operations',
      `Sessions: ${filteredServiceSessions.length}`,
      `Completed sessions: ${operationsStats.completedSessions}`,
      `Scheduled sessions: ${operationsStats.scheduledSessions}`,
      `Service revenue: ${formatCurrency(operationsStats.totalServiceRevenue)}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operations-summary-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      <div className="space-y-3">
        <div className="flex gap-2 bg-muted p-1 rounded-lg">
          {(['7d', '30d', 'thisMonth', 'custom'] as RangeType[]).map((r) => (
            <Button
              key={r}
              variant={rangeType === r ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setRangeType(r)}
              className="flex-1 shadow-none text-xs"
            >
              {r === 'thisMonth' ? 'MONTH' : r.toUpperCase()}
            </Button>
          ))}
        </div>

        {rangeType === 'custom' && (
          <div className="flex items-center gap-2 bg-card p-3 rounded-xl border border-border animate-in fade-in zoom-in-95">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-transparent text-sm font-medium focus:outline-none w-full"
            />
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-transparent text-sm font-medium focus:outline-none w-full"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <p className="metric-label">Total Revenue</p>
          <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {format(filteredData.start, 'MMM d')} - {format(filteredData.end, 'MMM d')}
          </p>
        </div>
        <div className="stat-card border-success/30">
          <p className="metric-label">Gross Profit</p>
          <p className="text-xl font-bold text-success">{formatCurrency(stats.totalProfit)}</p>
          <p className="text-[10px] text-success/70 mt-1">
            Margin: {stats.totalRevenue > 0 ? ((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <p className="metric-label">Operating Expenses</p>
          <p className="text-lg font-bold text-destructive">{formatCurrency(stats.totalExpenses)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{expenseBasis} basis</p>
        </div>
        <div className={`stat-card ${stats.netAfterExpenses < 0 ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success/5'}`}>
          <p className="metric-label">Net After Expenses</p>
          <p className={`text-lg font-bold ${stats.netAfterExpenses < 0 ? 'text-destructive' : 'text-success'}`}>
            {formatCurrency(stats.netAfterExpenses)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Gross profit - expenses</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full h-auto grid grid-cols-3 sm:grid-cols-5 gap-1 p-1">
          <TabsTrigger value="overview" className="min-w-0 px-2 text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="operations" className="min-w-0 px-2 text-xs sm:text-sm">Ops</TabsTrigger>
          <TabsTrigger value="docs" className="min-w-0 px-2 text-xs sm:text-sm">Docs</TabsTrigger>
          <TabsTrigger value="tax" className="min-w-0 px-2 text-xs sm:text-sm">Tax</TabsTrigger>
          <TabsTrigger value="loan" className="min-w-0 px-2 text-xs sm:text-sm">Loan</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-2">
          <div className="flex gap-2 bg-muted p-1 rounded-lg">
            <Button
              variant={expenseBasis === 'accrual' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setExpenseBasis('accrual')}
              className="flex-1 text-xs"
            >
              Expenses: Accrual
            </Button>
            <Button
              variant={expenseBasis === 'cash' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setExpenseBasis('cash')}
              className="flex-1 text-xs"
            >
              Expenses: Cash
            </Button>
          </div>
          <div className="bg-card rounded-2xl p-4 border border-border">
            <h3 className="font-semibold mb-3">1. Sales Momentum</h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card">
              <p className="metric-label">2. Profitability</p>
              <p className="text-lg font-bold">{formatCurrency(stats.totalProfit)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Gross profit in range</p>
            </div>
            <div className={`stat-card ${stats.netAfterExpenses < 0 ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success/5'}`}>
              <p className="metric-label">Net After Ops Costs</p>
              <p className={`text-lg font-bold ${stats.netAfterExpenses < 0 ? 'text-destructive' : 'text-success'}`}>
                {formatCurrency(stats.netAfterExpenses)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">After operating expenses only</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 border border-border">
            <h3 className="font-semibold mb-3">3. Cost Structure (Purchases vs Expenses)</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Operating Expenses</p>
                <p className="text-base font-bold text-destructive mt-1">{formatCurrency(expenseStats.operatingExpenseTotal)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Purchases / Restock</p>
                <p className="text-base font-bold text-amber-600 mt-1">{formatCurrency(expenseStats.purchasesCombinedTotal)}</p>
              </div>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseStats.outflowBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Bar dataKey="amount" fill="#ea580c" name="Amount" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 border border-border">
            <h3 className="font-semibold mb-3">4. Operating Expense Categories</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseStats.operatingCategorySpend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Legend />
                  <Bar dataKey="amount" fill="#dc2626" name="Operating expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card">
              <p className="metric-label">Sold on deni</p>
              <p className="text-lg font-bold">{formatCurrency(stats.creditIssued)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Not yet paid for</p>
            </div>
            <div className="stat-card">
              <p className="metric-label">Paid on the spot</p>
              <p className="text-lg font-bold">{formatCurrency(stats.cashRevenue)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Sales not on deni</p>
            </div>
            <div className="stat-card">
              <p className="metric-label">Deni paid back</p>
              <p className="text-lg font-bold text-success">{formatCurrency(stats.creditCollected)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Older debts settled</p>
            </div>
            <div className="stat-card border-primary/20 bg-primary/5">
              <p className="metric-label">Money in</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(stats.cashCollected)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Both of the above added up</p>
            </div>
            <div className="stat-card">
              <p className="metric-label">Average day</p>
              <p className="text-lg font-bold">{formatCurrency(stats.avgDailySales)}</p>
            </div>
            <div className="stat-card">
              <p className="metric-label">Kept per 100 shillings</p>
              <p className="text-lg font-bold">{stats.operatingMargin.toFixed(1)}%</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 border border-border">
            <h3 className="font-semibold mb-2">Top Items</h3>
            <div className="space-y-2">
              {stats.topItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sales in selected range.</p>
              ) : stats.topItems.map((t) => (
                <div key={t.name} className="flex justify-between text-sm">
                  <span className="truncate pr-2">{t.name}</span>
                  <span className="font-semibold">{formatCurrency(t.revenue)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 border border-border">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Outflow Trend
            </h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={expenseStats.outflowTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Legend />
                  <Line type="monotone" dataKey="operating" stroke="#dc2626" strokeWidth={2} dot={false} name="Operating" />
                  <Line type="monotone" dataKey="purchases" stroke="#d97706" strokeWidth={2} dot={false} name="Purchases" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={exportSalesCsv}>
              <Download className="h-4 w-4 mr-2" /> Export Sales CSV
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card">
              <p className="metric-label">Restock Spend</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(operationsStats.totalRestockSpend)}</p>
            </div>
            <div className="stat-card">
              <p className="metric-label">Units Purchased</p>
              <p className="text-lg font-bold">{operationsStats.totalRestockUnits}</p>
            </div>
            <div className="stat-card">
              <p className="metric-label">Purchased SKUs</p>
              <p className="text-lg font-bold">{operationsStats.purchasedSkuCount}</p>
            </div>
            <div className="stat-card">
              <p className="metric-label">Avg Unit Cost</p>
              <p className="text-lg font-bold">{formatCurrency(operationsStats.avgUnitCost)}</p>
            </div>
          </div>

          {offeringMode !== 'services' && (
            <>
              <div className="bg-card rounded-2xl p-4 border border-border">
                <h3 className="font-semibold mb-3">Restock Spend Trend</h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={operationsStats.spendTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => formatCurrency(v as number)} />
                      <Line type="monotone" dataKey="spend" stroke="#dc2626" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card rounded-2xl p-4 border border-border">
                <h3 className="font-semibold mb-2">Top Purchased Items</h3>
                <div className="space-y-2">
                  {operationsStats.topPurchased.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No stock purchases in selected range.</p>
                  ) : operationsStats.topPurchased.map((row) => (
                    <div key={row.name} className="flex justify-between text-sm">
                      <span className="truncate pr-2">{row.name} ({row.qty})</span>
                      <span className="font-semibold">{formatCurrency(row.spend)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Stock Purchase Exports</h3>
                  <p className="text-xs text-muted-foreground">{filteredStockPurchases.length} entries</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportStockPurchasesCsv} disabled={filteredStockPurchases.length === 0}>
                    <Download className="h-4 w-4 mr-2 shrink-0" /> Purchases CSV
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportStockPurchasesExcel} disabled={filteredStockPurchases.length === 0}>
                    <Download className="h-4 w-4 mr-2 shrink-0" /> Purchases Excel
                  </Button>
                </div>
              </div>
            </>
          )}

          {offeringMode !== 'products' && (
            <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Service Session Exports</h3>
                <p className="text-xs text-muted-foreground">
                  {filteredServiceSessions.length} sessions | {formatCurrency(operationsStats.totalServiceRevenue)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Completed: {operationsStats.completedSessions} | Scheduled: {operationsStats.scheduledSessions}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportServiceSessionsCsv} disabled={filteredServiceSessions.length === 0}>
                  <Download className="h-4 w-4 mr-2 shrink-0" /> Sessions CSV
                </Button>
                <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportServiceSessionsExcel} disabled={filteredServiceSessions.length === 0}>
                  <Download className="h-4 w-4 mr-2 shrink-0" /> Sessions Excel
                </Button>
              </div>
            </div>
          )}

          <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportOperationsSummaryTxt}>
            <FileText className="h-4 w-4 mr-2 shrink-0" /> Export Operations Summary
          </Button>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4 pt-2">
          <div className="flex gap-2 bg-muted p-1 rounded-lg">
            <Button variant={docTab === 'all' ? 'secondary' : 'ghost'} size="sm" className="flex-1 text-xs" onClick={() => setDocTab('all')}>All</Button>
            <Button variant={docTab === 'loan' ? 'secondary' : 'ghost'} size="sm" className="flex-1 text-xs" onClick={() => setDocTab('loan')}>Loan</Button>
            <Button variant={docTab === 'visa' ? 'secondary' : 'ghost'} size="sm" className="flex-1 text-xs" onClick={() => setDocTab('visa')}>Visa</Button>
          </div>

          {(docTab === 'all' || docTab === 'loan') && (
            <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
              <h3 className="font-semibold">Loan Application Documents</h3>
              <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportLoanPackHtml}>
                <FileText className="h-4 w-4 mr-2 shrink-0" /> Download Loan Pack (HTML)
              </Button>
              <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportLoanSummaryTxt}>
                <FileText className="h-4 w-4 mr-2 shrink-0" /> Download Loan Summary (TXT)
              </Button>
            </div>
          )}

          {(docTab === 'all' || docTab === 'visa') && (
            <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
              <h3 className="font-semibold">Visa Financial Documents</h3>
              <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportVisaPackHtml}>
                <FileText className="h-4 w-4 mr-2 shrink-0" /> Download Visa Financial Summary (HTML)
              </Button>
            </div>
          )}

          <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
            <h3 className="font-semibold">Period Lists & Dossier</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportSalesCsv}><Download className="h-4 w-4 mr-2 shrink-0" /> Sales CSV</Button>
              <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportExpensesCsv}><Download className="h-4 w-4 mr-2 shrink-0" /> Expenses CSV</Button>
              <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportStockPurchasesCsv} disabled={filteredStockPurchases.length === 0}><Download className="h-4 w-4 mr-2 shrink-0" /> Purchases CSV</Button>
              <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportStockPurchasesExcel} disabled={filteredStockPurchases.length === 0}><Download className="h-4 w-4 mr-2 shrink-0" /> Purchases XLS</Button>
              <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportExpensesExcel}><Download className="h-4 w-4 mr-2 shrink-0" /> Expenses XLS</Button>
              <Button variant="outline" className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportServiceSessionsCsv} disabled={filteredServiceSessions.length === 0}><Download className="h-4 w-4 mr-2 shrink-0" /> Sessions CSV</Button>
            </div>
            <Button className="w-full justify-start text-left h-auto py-2 whitespace-normal break-words" onClick={exportFullDossierHtml}>
              <FileText className="h-4 w-4 mr-2 shrink-0" /> Download Complete Business Dossier (HTML)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="tax" className="pt-2 space-y-4">
          <div className="stat-card bg-primary/5 border-primary/20">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-primary">Turnover Tax Estimate (3%)</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(stats.estimatedTOT)}</p>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Based on turnover of {formatCurrency(stats.totalRevenue)} in this period.
                </p>
              </div>
              <CalendarIcon className="h-6 w-6 text-primary/40" />
            </div>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl border border-dashed border-muted-foreground/30 text-xs text-muted-foreground">
            Keep digital records for KRA compliance: sales exports, expense exports, and tax snapshots per filing period.
          </div>
        </TabsContent>

        <TabsContent value="loan" className="pt-2 space-y-4">
          <div className="stat-card bg-success/5 border-success/20">
            <h4 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Banknote className="h-4 w-4 text-success" /> How steady your sales are
            </h4>
            <p className="text-2xl font-bold text-success">{stats.consistencyScore}/100</p>
            <p className="text-xs text-muted-foreground mt-1">
              Lenders like takings that do not swing much from day to day. The closer to 100, the steadier yours are.
            </p>
          </div>
          <div className="stat-card">
            <p className="metric-label">Average sale</p>
            <p className="text-xl font-bold">{formatCurrency(stats.avgTicket)}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={exportLoanSummaryTxt}>
            <FileText className="h-4 w-4 mr-2" /> Export Loan Readiness Summary
          </Button>
        </TabsContent>

      </Tabs>
    </div>
  );
}




