import { Package, AlertTriangle, TrendingUp, Wallet, CreditCard, DollarSign, Receipt, Coins } from 'lucide-react';
import { DashboardStats } from '@/types/inventory';

interface OwnerDashboardProps {
  stats: DashboardStats & { netProfit?: number; totalExpenses?: number }; // Added the new fields
  dateLabel?: string;
}

export function OwnerDashboard({ stats, dateLabel = "Today's" }: OwnerDashboardProps) {
  const formatCurrency = (amount: number) => {
    return `KSh ${amount.toLocaleString()}`;
  };

  const netProfit = stats.netProfit ?? 0;
  const isLoss = netProfit < 0;

  return (
    <div className="space-y-4 animate-slide-up">
      <h2 className="text-lg font-semibold text-foreground">Business Overview</h2>
      
      {/* PRIMARY STATS: Revenue & Net Profit */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="metric-value text-primary">{formatCurrency(stats.todaySales)}</p>
          <p className="metric-label">{dateLabel} Revenue</p>
        </div>

        <div className={`stat-card border-success/30 ${isLoss ? 'bg-destructive/5 border-destructive/30' : 'bg-success/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${isLoss ? 'bg-destructive/10' : 'bg-success/10'}`}>
              <Coins className={`h-4 w-4 ${isLoss ? 'text-destructive' : 'text-success'}`} />
            </div>
          </div>
          <p className={`metric-value ${isLoss ? 'text-destructive' : 'text-success'}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className="metric-label">{dateLabel} Net Profit</p>
        </div>
      </div>

      {/* SECONDARY STATS: Gross Profit & Expenses */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-muted text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-bold">{formatCurrency(stats.todayProfit)}</p>
          <p className="metric-label text-[10px]">Gross Profit (Markup)</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-destructive">
            {formatCurrency(stats.totalExpenses ?? 0)}
          </p>
          <p className="metric-label text-[10px]">{dateLabel} Expenses</p>
        </div>
      </div>

      {/* INVENTORY & ASSETS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">Stock Value</p>
              <p className="text-base font-bold text-foreground mt-1">
                {formatCurrency(stats.totalStockValue)}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-blue-50">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">Low Stock</p>
              <p className={`text-base font-bold mt-1 ${stats.lowStockCount > 0 ? 'text-warning' : ''}`}>
                {stats.lowStockCount} Items
              </p>
            </div>
            <div className={`p-2 rounded-xl ${stats.lowStockCount > 0 ? 'bg-warning/20' : 'bg-muted'}`}>
              <AlertTriangle className={`h-4 w-4 ${stats.lowStockCount > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* CREDIT MONITORING */}
      {stats.totalCreditOwed !== undefined && stats.totalCreditOwed > 0 && (
        <div className="stat-card bg-warning/5 border-warning/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-warning/20">
                <CreditCard className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs font-medium text-warning-foreground uppercase tracking-wider">Total Credit Owed to You</p>
                <p className="text-xl font-black text-warning">
                  {formatCurrency(stats.totalCreditOwed)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}