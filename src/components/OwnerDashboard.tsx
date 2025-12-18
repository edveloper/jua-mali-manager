import { Package, AlertTriangle, TrendingUp, Wallet, CreditCard, DollarSign } from 'lucide-react';
import { DashboardStats } from '@/types/inventory';

interface OwnerDashboardProps {
  stats: DashboardStats;
  dateLabel?: string; // New optional prop
}

export function OwnerDashboard({ stats, dateLabel = "Today's" }: OwnerDashboardProps) {
  const formatCurrency = (amount: number) => {
    return `KSh ${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <h2 className="text-lg font-semibold text-foreground">Owner Dashboard</h2>
      
      <div className="grid grid-cols-2 gap-3">
        {/* PRODUCTS (Always Current) */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="metric-value">{stats.totalProducts}</p>
          <p className="metric-label">Products</p>
        </div>

        {/* LOW STOCK (Always Current) */}
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

        {/* SALES (Time Travel Enabled) */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-secondary/10">
              <Wallet className="h-4 w-4 text-secondary" />
            </div>
          </div>
          <p className="metric-value text-secondary">{formatCurrency(stats.todaySales)}</p>
          <p className="metric-label">{dateLabel} Sales</p>
        </div>

        {/* PROFIT (Time Travel Enabled) */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-success/10">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </div>
          <p className="metric-value text-success">{formatCurrency(stats.todayProfit)}</p>
          <p className="metric-label">{dateLabel} Profit</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">Total Stock Value</p>
              <p className="text-lg font-bold text-foreground mt-1">
                {formatCurrency(stats.totalStockValue)}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        {stats.totalCreditOwed !== undefined && (
          <div className="stat-card border-warning/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Credit Owed</p>
                <p className="text-lg font-bold text-warning mt-1">
                  {formatCurrency(stats.totalCreditOwed)}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-warning/10">
                <CreditCard className="h-5 w-5 text-warning" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}