import { Package, AlertTriangle, ShoppingCart, Users } from 'lucide-react';
import { DashboardStats } from '@/types/inventory';
import { useAuth } from '@/contexts/AuthContext';

interface EmployeeDashboardProps {
  stats: DashboardStats;
  todaySalesCount: number;
  offeringMode?: 'products' | 'services' | 'mixed' | string;
}

export function EmployeeDashboard({ stats, todaySalesCount, offeringMode = 'products' }: EmployeeDashboardProps) {
  const { user, shop } = useAuth();
  const catalogLabel = offeringMode === 'services' ? 'Services' : offeringMode === 'mixed' ? 'Items' : 'Products';
  const lowLabel = offeringMode === 'services' ? 'Almost full' : 'Running low';
  const salesLabel = offeringMode === 'services' ? 'Services today' : 'Sales today';

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="stat-card bg-primary/5 border-primary/20">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="font-semibold text-foreground">{user?.user_metadata?.full_name || 'Employee'}</p>
            <p className="text-xs text-muted-foreground">{shop?.name}</p>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-foreground">Today</h2>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="metric-value">{stats.totalProducts}</p>
          <p className="metric-label">{catalogLabel}</p>
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
          <p className="metric-label">{lowLabel}</p>
        </div>

        <div className="stat-card col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">{salesLabel}</p>
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
          You can record sales and see what is in stock. Ask the owner to add new
          items or change stock levels.
        </p>
      </div>
    </div>
  );
}
