import { useMemo, useState } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip 
} from 'recharts';
import { Wallet, CreditCard, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { Sale, CreditSale } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';

interface SalesReportsProps {
  sales: Sale[];
  creditSales: CreditSale[];
}

type RangeType = '7d' | '30d' | 'thisMonth' | 'custom';

export function SalesReports({ sales, creditSales = [] }: SalesReportsProps) {
  const [rangeType, setRangeType] = useState<RangeType>('7d');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const formatCurrency = (amount: number) => `KSh ${amount.toLocaleString()}`;

  const filteredData = useMemo(() => {
    let start = startOfDay(new Date());
    let end = endOfDay(new Date());

    if (rangeType === '7d') {
      start = startOfDay(subDays(new Date(), 7));
    } else if (rangeType === '30d') {
      start = startOfDay(subDays(new Date(), 30));
    } else if (rangeType === 'thisMonth') {
      start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    } else if (rangeType === 'custom') {
      start = startOfDay(new Date(customStart));
      end = endOfDay(new Date(customEnd));
    }

    const fSales = sales.filter(s => {
      const date = new Date(s.createdAt);
      return isWithinInterval(date, { start, end });
    });

    const fCredits = creditSales.filter(c => {
      const date = new Date(c.createdAt);
      return isWithinInterval(date, { start, end });
    });

    return { fSales, fCredits, start, end };
  }, [sales, creditSales, rangeType, customStart, customEnd]);

  const stats = useMemo(() => {
    const totalRevenue = filteredData.fSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalProfit = filteredData.fSales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const creditIssued = filteredData.fCredits.reduce((sum, c) => sum + (c.amount || 0), 0);
    const cashRevenue = totalRevenue - creditIssued;
    
    // For Tax Purposes (Example: 3% Turnover Tax)
    const estimatedTax = totalRevenue * 0.03;

    return { totalRevenue, totalProfit, cashRevenue, creditIssued, estimatedTax };
  }, [filteredData]);

  const COLORS = ['#10b981', '#f59e0b'];

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* Date Range Selector */}
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
          <TabsTrigger value="overview" className="flex-1">Financials</TabsTrigger>
          <TabsTrigger value="tax" className="flex-1">Tax/Compliance</TabsTrigger>
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
            <div className="flex justify-between mt-2 px-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Cash Sales</p>
                <p className="font-semibold text-success">{formatCurrency(stats.cashRevenue)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Credit Issued</p>
                <p className="font-semibold text-warning">{formatCurrency(stats.creditIssued)}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tax" className="pt-2 space-y-4">
          <div className="stat-card bg-primary/5 border-primary/20">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-primary">Turnover Tax Estimate (3%)</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(stats.estimatedTax)}</p>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  *Based on total sales of {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
              <CalendarIcon className="h-6 w-6 text-primary/40" />
            </div>
          </div>
          
          <div className="p-4 bg-muted/50 rounded-xl border border-dashed border-muted-foreground/30">
            <h4 className="text-sm font-bold mb-2">Loan Eligibility Tip</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Banks look for consistent monthly turnover. By tracking all sales digitally, you have proof of income that can be used to apply for micro-loans or stock financing.
            </p>
            <Button variant="outline" size="sm" className="w-full mt-3 text-xs h-8">
              Export Statement for Bank (PDF)
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}