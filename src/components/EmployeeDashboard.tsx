import { Package, AlertTriangle, ShoppingCart, Users } from 'lucide-react';
import { DashboardStats } from '@/types/inventory';
import { useAuth } from '@/contexts/AuthContext';

interface EmployeeDashboardProps {
  stats: DashboardStats;
  todaySalesCount: number;
}

export function EmployeeDashboard({ stats, todaySalesCount }: EmployeeDashboardProps) {
  const { user, shop } = useAuth();

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="stat-card bg-primary/5 border-primary/20">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Logged in as</p>
            <p className="font-semibold text-foreground">{user?.user_metadata?.full_name || 'Employee'}</p>
            <p className="text-xs text-muted-foreground">{shop?.name}</p>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-foreground">Quick Overview</h2>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="metric-value">{stats.totalProducts}</p>
          <p className="metric-label">Products Available</p>
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
          <p className="metric-label">Low Stock Items</p>
        </div>

        <div className="stat-card col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">Sales Made Today</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {todaySalesCount}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/10">
              <ShoppingCart className="h-6 w-6 text-secondary" />
            </div>
          </div>
        </div>
      </div>

      <div className="stat-card bg-muted/50">
        <p className="text-sm text-muted-foreground text-center">
          As an employee, you can record sales and view products. 
          Contact the shop owner for inventory changes.
        </p>
      </div>
    </div>
  );
}
