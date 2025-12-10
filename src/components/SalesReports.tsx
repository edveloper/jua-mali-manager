import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Package, Calendar } from 'lucide-react';
import { Sale } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    
    if (timeRange === '7d') {
      cutoff.setDate(now.getDate() - 7);
    } else if (timeRange === '30d') {
      cutoff.setDate(now.getDate() - 30);
    } else {
      cutoff.setFullYear(2000);
    }

    return sales.filter(s => new Date(s.createdAt) >= cutoff);
  }, [sales, timeRange]);

  const dailySalesData = useMemo(() => {
    const grouped: Record<string, { date: string; sales: number; profit: number }> = {};
    
    filteredSales.forEach(sale => {
      const date = new Date(sale.createdAt).toLocaleDateString('en-KE', { 
        day: '2-digit', 
        month: 'short' 
      });
      
      if (!grouped[date]) {
        grouped[date] = { date, sales: 0, profit: 0 };
      }
      grouped[date].sales += sale.totalAmount;
      grouped[date].profit += sale.profit;
    });

    return Object.values(grouped).slice(-7);
  }, [filteredSales]);

  const topProducts = useMemo(() => {
    const grouped: Record<string, { name: string; quantity: number; revenue: number }> = {};
    
    filteredSales.forEach(sale => {
      if (!grouped[sale.productId]) {
        grouped[sale.productId] = { name: sale.productName, quantity: 0, revenue: 0 };
      }
      grouped[sale.productId].quantity += sale.quantity;
      grouped[sale.productId].revenue += sale.totalAmount;
    });

    return Object.values(grouped)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredSales]);

  const totals = useMemo(() => {
    return filteredSales.reduce(
      (acc, sale) => ({
        revenue: acc.revenue + sale.totalAmount,
        profit: acc.profit + sale.profit,
        items: acc.items + sale.quantity,
      }),
      { revenue: 0, profit: 0, items: 0 }
    );
  }, [filteredSales]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--muted))'];

  if (sales.length === 0) {
    return (
      <div className="text-center py-12 animate-slide-up">
        <div className="bg-muted rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground">No Sales Data Yet</h3>
        <p className="text-muted-foreground mt-1">Make some sales to see reports</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Time Range Selector */}
      <div className="flex gap-2">
        {(['7d', '30d', 'all'] as TimeRange[]).map((range) => (
          <Button
            key={range}
            variant={timeRange === range ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(range)}
            className="flex-1"
          >
            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
          </Button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <p className="metric-label">Revenue</p>
          <p className="text-lg font-bold text-secondary">{formatCurrency(totals.revenue)}</p>
        </div>
        <div className="stat-card">
          <p className="metric-label">Profit</p>
          <p className="text-lg font-bold text-success">{formatCurrency(totals.profit)}</p>
        </div>
        <div className="stat-card">
          <p className="metric-label">Items</p>
          <p className="text-lg font-bold">{totals.items}</p>
        </div>
      </div>

      {/* Daily Sales Chart */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Daily Sales</h3>
        </div>
        
        {dailySalesData.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySalesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }} 
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), '']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Sales" />
                <Bar dataKey="profit" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No data for this period</p>
        )}
      </div>

      {/* Profit Trend */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-success" />
          <h3 className="font-semibold">Profit Trend</h3>
        </div>
        
        {dailySalesData.length > 1 ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySalesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Profit']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Need more data for trend</p>
        )}
      </div>

      {/* Top Selling Products */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-secondary" />
          <h3 className="font-semibold">Top Sellers</h3>
        </div>
        
        {topProducts.length > 0 ? (
          <div className="space-y-3">
            {topProducts.map((product, index) => (
              <div key={product.name} className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{product.quantity} sold</p>
                </div>
                <p className="font-semibold text-success">{formatCurrency(product.revenue)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">No products sold yet</p>
        )}
      </div>
    </div>
  );
}
