import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Wallet, CreditCard, Calendar as CalendarIcon, ArrowRight, Download, Sparkles, FileText, Landmark, Banknote } from 'lucide-react';
import { Sale, CreditSale, Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import { aiClient } from '@/lib/aiClient';
import { Input } from '@/components/ui/input';

interface SalesReportsProps {
  sales: Sale[];
  creditSales: CreditSale[];
  offeringMode?: 'products' | 'services' | 'mixed' | string;
  businessCategory?: string;
  singleOffering?: boolean;
  lowStockProducts?: Product[];
}

type RangeType = '7d' | '30d' | 'thisMonth' | 'custom';

const formatCurrency = (amount: number) => `KSh ${amount.toLocaleString()}`;
const csvEscape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const isTimeoutError = (message: string) => message.toLowerCase().includes('timeout');

export function SalesReports({
  sales,
  creditSales = [],
  offeringMode = 'products',
  businessCategory = 'retail',
  singleOffering = false,
  lowStockProducts = []
}: SalesReportsProps) {
  const [rangeType, setRangeType] = useState<RangeType>('7d');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');

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

  const stats = useMemo(() => {
    const totalRevenue = filteredData.fSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalProfit = filteredData.fSales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const creditIssued = filteredData.fCredits.reduce((sum, c) => sum + (c.amount || 0), 0);
    const cashRevenue = totalRevenue - creditIssued;
    const estimatedTOT = totalRevenue * 0.03;
    const avgTicket = filteredData.fSales.length ? totalRevenue / filteredData.fSales.length : 0;

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
      totalRevenue, totalProfit, cashRevenue, creditIssued, estimatedTOT, avgTicket, topItems, trendData, consistencyScore
    };
  }, [filteredData]);

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
      `Gross profit: ${formatCurrency(stats.totalProfit)}`,
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

  const runAiSummary = async () => {
    setAiLoading(true);
    setAiText('');
    try {
      const result = await aiClient.insights({
        metrics: {
          todaySales: stats.totalRevenue,
          todayProfit: stats.totalProfit,
          totalStockValue: 0,
          lowStockCount: lowStockProducts.length,
          totalCreditOwed: filteredData.fCredits.reduce((s, c) => s + Number(c.balance || 0), 0),
          totalExpenses: 0,
        },
        businessProfile: {
          category: businessCategory,
          offeringMode,
          singleOffering,
        },
        lowStockProducts: lowStockProducts.map((p) => ({
          name: p.name,
          quantity: p.quantity,
          threshold: p.lowStockThreshold,
          category: p.category || 'General',
        })),
        topProducts: stats.topItems.map((t) => ({ name: t.name, quantity: t.qty, threshold: 0, category: 'Top' })),
      });
      if (!result.ok) throw new Error(result.error || 'AI request failed');
      setAiText(result.answer || 'No AI summary returned.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate AI summary.';
      if (isTimeoutError(msg)) {
        const fallback = await aiClient.query({
          question: 'Give a short business summary and 3 actions from this report data.',
          context: {
            totals: { revenue: stats.totalRevenue, profit: stats.totalProfit, credit: stats.creditIssued },
            topItems: stats.topItems.slice(0, 3),
          },
        });
        if (fallback.ok && fallback.answer) {
          setAiText(`${fallback.answer}\n\n(Generated via fallback due to model timeout.)`);
        } else {
          setAiText(`${msg}. Try again or reduce report range to 7D.`);
        }
      } else {
        setAiText(msg);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const runAiReorderPlan = async () => {
    setAiLoading(true);
    setAiText('');
    try {
      const result = await aiClient.reorder({
        businessProfile: { category: businessCategory, offeringMode, singleOffering },
        lowStockProducts: lowStockProducts.map((p) => ({
          name: p.name,
          quantity: p.quantity,
          threshold: p.lowStockThreshold,
          category: p.category || 'General',
        })),
        topProducts: stats.topItems.map((t) => ({ name: t.name, quantity: t.qty, threshold: 0, category: 'Top' })),
      });
      if (!result.ok) throw new Error(result.error || 'AI request failed');
      setAiText(result.answer || 'No AI plan returned.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate AI plan.';
      if (isTimeoutError(msg)) {
        const fallback = await aiClient.query({
          question: 'Create a short 7-day priority restock/resource plan from this context.',
          context: {
            lowStock: lowStockProducts.slice(0, 10).map((p) => ({ name: p.name, qty: p.quantity, th: p.lowStockThreshold })),
            topItems: stats.topItems.slice(0, 5),
            business: { offeringMode, businessCategory, singleOffering },
          },
        });
        if (fallback.ok && fallback.answer) {
          setAiText(`${fallback.answer}\n\n(Generated via fallback due to model timeout.)`);
        } else {
          setAiText(`${msg}. Try again or reduce report range to 7D.`);
        }
      } else {
        setAiText(msg);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const runAiQuestion = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiText('');
    try {
      const result = await aiClient.query({
        question: aiQuestion.trim(),
        context: {
          businessCategory, offeringMode, singleOffering,
          period: `${format(filteredData.start, 'yyyy-MM-dd')} to ${format(filteredData.end, 'yyyy-MM-dd')}`,
          totals: {
            revenue: stats.totalRevenue,
            profit: stats.totalProfit,
            creditIssued: stats.creditIssued,
            consistencyScore: stats.consistencyScore,
          },
          topItems: stats.topItems,
        }
      });
      if (!result.ok) throw new Error(result.error || 'AI query failed');
      setAiText(result.answer || 'No AI answer returned.');
    } catch (err: unknown) {
      setAiText(err instanceof Error ? err.message : 'Failed to run AI query.');
    } finally {
      setAiLoading(false);
    }
  };

  const COLORS = ['#10b981', '#f59e0b'];

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

      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
          <TabsTrigger value="tax" className="flex-1">Tax</TabsTrigger>
          <TabsTrigger value="loan" className="flex-1">Loan</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1">AI</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-2">
          <div className="bg-card rounded-2xl p-4 border border-border">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Revenue Split
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Cash', value: stats.cashRevenue },
                      { name: 'Credit', value: stats.creditIssued }
                    ]}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 border border-border">
            <h3 className="font-semibold mb-3">Sales Trend</h3>
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

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={exportSalesCsv}>
              <Download className="h-4 w-4 mr-2" /> Export Sales CSV
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
              <Banknote className="h-4 w-4 text-success" /> Loan Readiness Score
            </h4>
            <p className="text-2xl font-bold text-success">{stats.consistencyScore}/100</p>
            <p className="text-xs text-muted-foreground mt-1">
              Higher consistency in daily turnover can improve credit confidence.
            </p>
          </div>
          <div className="stat-card">
            <p className="metric-label">Average Ticket Size</p>
            <p className="text-xl font-bold">{formatCurrency(stats.avgTicket)}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={exportLoanSummaryTxt}>
            <FileText className="h-4 w-4 mr-2" /> Export Loan Readiness Summary
          </Button>
        </TabsContent>

        <TabsContent value="ai" className="pt-2 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={runAiSummary} disabled={aiLoading}>
              <Sparkles className="h-4 w-4 mr-2" /> AI Summary
            </Button>
            <Button variant="outline" onClick={runAiReorderPlan} disabled={aiLoading}>
              <Landmark className="h-4 w-4 mr-2" /> AI Plan
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Ask AI about your current report..."
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
            />
            <Button onClick={runAiQuestion} disabled={aiLoading || !aiQuestion.trim()}>
              Ask
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-sm whitespace-pre-wrap min-h-[140px]">
            {aiLoading ? 'Generating AI output...' : (aiText || 'Run an AI action to generate insights here.')}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
