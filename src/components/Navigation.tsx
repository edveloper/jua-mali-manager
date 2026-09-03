import { Home, Package, Users, Wallet, Plus, LucideIcon, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabType =
  | 'dashboard'
  | 'products'
  | 'credit'
  | 'money'
  | 'more'
  | 'alerts'
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
  /** The raised button in the middle. Opens the list of things you can record. */
  onPrimaryAction: () => void;
}

interface NavItem {
  id: TabType;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Other tabs that should light this one up, so deep screens keep their place. */
  covers?: TabType[];
}

/**
 * Four places and one action.
 *
 * It was six tabs, and the labels had stopped fitting. The cut came from a
 * distinction the bar was not making: recording a sale is the most frequent
 * thing anybody does here, and it is an action, not a destination. Giving it the
 * raised button in the middle takes it off the tab list and makes it reachable
 * from wherever you happen to be standing.
 *
 * More left the bar too, and lives behind the account button in the header. Both
 * moves buy the same thing: everything in the app is now within two taps.
 */
export function Navigation({
  activeTab,
  onTabChange,
  isOwner = true,
  deniCount = 0,
  canManageDeni = false,
  canRecordExpenses = false,
  onPrimaryAction,
}: NavigationProps) {
  const ownerTabs: NavItem[] = [
    { id: 'dashboard', label: 'Home', icon: Home, covers: ['alerts'] },
    { id: 'products', label: 'Sell', icon: Package, covers: ['stock'] },
    { id: 'credit', label: 'Deni', icon: Users, badge: deniCount },
    { id: 'money', label: 'Money', icon: Wallet, covers: ['spending'] },
  ];

  // Staff see only what the owner has opened up, so nothing on screen implies a
  // door they cannot walk through.
  const employeeTabs: NavItem[] = [
    { id: 'dashboard', label: 'Home', icon: Home, covers: ['alerts'] },
    { id: 'products', label: 'Sell', icon: Package, covers: ['stock'] },
    ...(canManageDeni ? [{ id: 'credit' as TabType, label: 'Deni', icon: Users, badge: deniCount }] : []),
    ...(canRecordExpenses ? [{ id: 'spending' as TabType, label: 'Spending', icon: Receipt }] : []),
  ];

  const tabs = isOwner ? ownerTabs : employeeTabs;

  // Split around the button rather than putting it at one end. A member of staff
  // with no extra permissions has two tabs, an owner has four, and both stay
  // even either side of it.
  const mid = Math.ceil(tabs.length / 2);
  const left = tabs.slice(0, mid);
  const right = tabs.slice(mid);

  const renderTab = (tab: NavItem) => {
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
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-nav safe-area-pb z-40"
      style={{ boxShadow: 'var(--shadow-nav)' }}
    >
      <div className="flex items-stretch justify-around max-w-md mx-auto">
        {left.map(renderTab)}

        <div className="flex-1 flex justify-center relative">
          <button
            type="button"
            onClick={onPrimaryAction}
            aria-label="Record something"
            className="absolute -top-5 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center pressable active:brightness-95 transition"
            style={{ boxShadow: '0 4px 14px hsl(var(--primary) / 0.4)' }}
          >
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </button>
        </div>

        {right.map(renderTab)}
      </div>
    </nav>
  );
}
