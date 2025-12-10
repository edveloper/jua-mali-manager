import { LayoutDashboard, Package, AlertTriangle, Receipt, Users, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabType = 'dashboard' | 'products' | 'alerts' | 'sales' | 'credit' | 'reports';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  alertCount: number;
  creditCount?: number;
}

export function Navigation({ activeTab, onTabChange, alertCount, creditCount = 0 }: NavigationProps) {
  const tabs = [
    { id: 'dashboard' as TabType, label: 'Home', icon: LayoutDashboard },
    { id: 'products' as TabType, label: 'Products', icon: Package },
    { id: 'credit' as TabType, label: 'Credit', icon: Users, badge: creditCount },
    { id: 'reports' as TabType, label: 'Reports', icon: BarChart3 },
    { id: 'alerts' as TabType, label: 'Alerts', icon: AlertTriangle, badge: alertCount },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-pb z-40">
      <div className="flex items-center justify-around py-2 px-1 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-2 rounded-xl transition-all duration-200 relative min-w-0",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-warning text-warning-foreground text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
