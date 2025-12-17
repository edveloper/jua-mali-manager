import { useMemo, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line 
} from 'recharts';
import { TrendingUp, Package, Calendar } from 'lucide-react'; // Icons come from here
import { Sale } from '@/types/inventory';
import { Button } from '@/components/ui/button';

interface SalesReportsProps {
  sales: Sale[];
}

type TimeRange = '7d' | '30d' | 'all';

export function SalesReports({ sales }: SalesReportsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  
  const formatCurrency = (amount: number) => `KSh ${amount.toLocaleString()}`;

  const filteredSales = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    if (timeRange === '7d') cutoff.setDate(now.getDate() - 7);
    else if (timeRange === '30d') cutoff.setDate(now.getDate() - 30);
    else cutoff.setFullYear(2000);
    return sales.filter(s => new Date(s.createdAt) >= cutoff);
  }, [sales, timeRange]);

  const totals = useMemo(() => {
    return filteredSales.reduce(
      (acc, sale) => ({
        revenue: acc.revenue + (Number(sale.totalAmount) || 0),
        profit: acc.profit + (Number(sale.profit) || 0),
        items: acc.items + (Number(sale.quantity) || 0),
      }),
      { revenue: 0, profit: 0, items: 0 }
    );
  }, [filteredSales]);

  const dailySalesData = useMemo(() => {
    const grouped: Record<string, { date: string; sales: number; profit: number }> = {};
    filteredSales.forEach(sale => {
      const date = new Date(sale.createdAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
      if (!grouped[date]) grouped[date] = { date, sales: 0, profit: 0 };
      grouped[date].sales += (Number(sale.totalAmount) || 0);
      grouped[date].profit += (Number(sale.profit) || 0);
    });
    return Object.values(grouped).slice(-7);
  }, [filteredSales]);

  const topProducts = useMemo(() => {
    const grouped: Record<string, { name: string; quantity: number; revenue: number }> = {};
    filteredSales.forEach(sale => {
      if (!grouped[sale.productId]) grouped[sale.productId] = { name: sale.productName, quantity: 0, revenue: 0 };
      grouped[sale.productId].quantity += sale.quantity;
      grouped[sale.productId].revenue += sale.totalAmount;
    });
    return Object.values(grouped).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [filteredSales]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--muted))'];

  if (sales.length === 0) {
    return (
      <div className="text-center py-12 animate-slide-up">
        <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold text-foreground">No Sales Data Yet</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex gap-2">
        {(['7d', '30d', 'all'] as TimeRange[]).map((range) => (
          <Button key={range} variant={timeRange === range ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange(range)} className="flex-1">
            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card"><p className="metric-label">Revenue</p><p className="text-lg font-bold text-secondary">{formatCurrency(totals.revenue)}</p></div>
        <div className="stat-card"><p className="metric-label">Profit</p><p className="text-lg font-bold text-success">{formatCurrency(totals.profit)}</p></div>
        <div className="stat-card"><p className="metric-label">Items</p><p className="text-lg font-bold">{totals.items}</p></div>
      </div>

      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-4"><Calendar className="h-5 w-5 text-primary" /><h3 className="font-semibold">Daily Sales</h3></div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailySalesData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
              <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-4"><Package className="h-5 w-5 text-secondary" /><h3 className="font-semibold">Top Sellers</h3></div>
        <div className="space-y-3">
          {topProducts.map((product, index) => (
            <div key={product.name} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground" style={{ backgroundColor: COLORS[index % COLORS.length] }}>{index + 1}</div>
              <div className="flex-1 min-w-0"><p className="font-medium truncate">{product.name}</p><p className="text-sm text-muted-foreground">{product.quantity} sold</p></div>
              <p className="font-semibold text-success">{formatCurrency(product.revenue)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}