import { Home, Package, Users, Wallet, MoreHorizontal, LucideIcon, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabType =
  | 'dashboard'
  | 'products'
  | 'credit'
  | 'money'
  | 'more'
  | 'alerts'
  | 'settings'
  | 'staff'
  | 'help'
  | 'privacy'
  | 'contact'
  | 'about'
  | 'stock'
  | 'spending'
  | 'business'
  | 'activity';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isOwner?: boolean;
  deniCount?: number;
  canManageDeni?: boolean;
  canRecordExpenses?: boolean;
}

interface NavItem {
  id: TabType;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Other tabs that should light this one up, so deep screens keep their place. */
  covers?: TabType[];
}

export function Navigation({ activeTab, onTabChange, isOwner = true, deniCount = 0, canManageDeni = false, canRecordExpenses = false }: NavigationProps) {
  const ownerTabs: NavItem[] = [
    { id: 'dashboard', label: 'Home', icon: Home, covers: ['alerts', 'stock'] },
    { id: 'products', label: 'Sell', icon: Package },
    { id: 'credit', label: 'Deni', icon: Users, badge: deniCount },
    { id: 'money', label: 'Money', icon: Wallet },
    { id: 'spending', label: 'Spending', icon: Receipt },
    { id: 'more', label: 'More', icon: MoreHorizontal, covers: ['settings', 'staff', 'activity', 'business', 'help', 'privacy', 'contact', 'about'] },
  ];

  // Staff see only what the owner has opened up, so nothing on screen implies a
  // door they cannot walk through.
  const employeeTabs: NavItem[] = [
    { id: 'dashboard', label: 'Home', icon: Home, covers: ['alerts', 'stock'] },
    { id: 'products', label: 'Sell', icon: Package },
    ...(canManageDeni ? [{ id: 'credit' as TabType, label: 'Deni', icon: Users, badge: deniCount }] : []),
    ...(canRecordExpenses ? [{ id: 'spending' as TabType, label: 'Spending', icon: Receipt }] : []),
    { id: 'more', label: 'More', icon: MoreHorizontal, covers: ['settings', 'help', 'privacy', 'contact', 'about'] },
  ];

  const tabs = isOwner ? ownerTabs : employeeTabs;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-nav safe-area-pb z-40"
      style={{ boxShadow: 'var(--shadow-nav)' }}
    >
      <div className="flex items-stretch justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.covers ?? []).includes(activeTab);

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 pt-2.5 pb-2 relative transition-colors',
                isActive ? 'text-nav-active' : 'text-nav-foreground'
              )}
            >
              {/* A rule above the active tab rather than a pill behind it --
                  quieter, and consistent with the ruled sheets everywhere else. */}
              <span
                className={cn(
                  'absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full transition-colors',
                  isActive ? 'bg-nav-active' : 'bg-transparent'
                )}
              />
              <div className="relative">
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-warning text-warning-foreground text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center num">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={cn('text-[11px]', isActive && 'font-semibold')}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
