import { LayoutDashboard, Package, AlertTriangle, BarChart3, Banknote, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Added 'contact' to the TabType union to match Index.tsx
export type TabType = 'dashboard' | 'products' | 'alerts' | 'sales' | 'credit' | 'reports' | 'settings' | 'expenses' | 'help' | 'privacy' | 'contact';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  alertCount: number;
  isOwner?: boolean;
}

interface NavItem {
  id: TabType;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function Navigation({ activeTab, onTabChange, alertCount, isOwner = true }: NavigationProps) {
  
  const ownerTabs: NavItem[] = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'expenses', label: 'Expenses', icon: Banknote },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  const employeeTabs: NavItem[] = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: alertCount },
  ];

  const tabs = isOwner ? ownerTabs : employeeTabs;

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
                {tab.badge !== undefined && tab.badge > 0 && (
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