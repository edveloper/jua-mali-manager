import { Package, AlertTriangle, TrendingUp, Wallet } from 'lucide-react';
import { DashboardStats } from '@/types/inventory';

interface DashboardProps {
  stats: DashboardStats;
}

export function Dashboard({ stats }: DashboardProps) {
  const formatCurrency = (amount: number) => {
    return `KSh ${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <h2 className="text-lg font-semibold text-foreground">Today's Overview</h2>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="metric-value">{stats.totalProducts}</p>
          <p className="metric-label">Products</p>
        </div>

        <div className={`stat-card ${stats.lowStockCount > 0 ? 'border-warning/50 bg-warning/5' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${stats.lowStockCount > 0 ? 'bg-warning/20' : 'bg-muted'}`}>
              <AlertTriangle className={`h-4 w-4 ${stats.lowStockCount > 0 ? 'text-warning animate-pulse-warning' : 'text-muted-foreground'}`} />
            </div>
          </div>
          <p className={`metric-value ${stats.lowStockCount > 0 ? 'text-warning' : ''}`}>
            {stats.lowStockCount}
          </p>
          <p className="metric-label">Low Stock</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-secondary/10">
              <Wallet className="h-4 w-4 text-secondary" />
            </div>
          </div>
          <p className="metric-value text-secondary">{formatCurrency(stats.todaySales)}</p>
          <p className="metric-label">Today's Sales</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-success/10">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </div>
          <p className="metric-value text-success">{formatCurrency(stats.todayProfit)}</p>
          <p className="metric-label">Today's Profit</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="metric-label">Total Stock Value</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {formatCurrency(stats.totalStockValue)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}
