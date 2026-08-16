import {
  Users, Store, Upload, HelpCircle, MessageSquare, ShieldAlert,
  LogOut, Download, ChevronRight, Info, LucideIcon,
} from 'lucide-react';
import { TabType } from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { toDisplayIdentity } from '@/lib/identity';

interface MoreMenuProps {
  onNavigate: (tab: TabType) => void;
  staffCount: number;
  canInstall: boolean;
  onInstall: () => void;
}

interface Row {
  label: string;
  hint?: string;
  icon: LucideIcon;
  onClick: () => void;
}

/**
 * A screen rather than a dropdown. Staff management used to sit three taps deep
 * inside Settings; here it is the first thing on the list.
 */
export function MoreMenu({ onNavigate, staffCount, canInstall, onInstall }: MoreMenuProps) {
  const { user, shop, isOwner, signOut } = useAuth();

  const ownerRows: Row[] = [
    {
      label: 'Staff',
      hint: staffCount === 0 ? 'Nobody added yet' : `${staffCount} ${staffCount === 1 ? 'person' : 'people'}`,
      icon: Users,
      onClick: () => onNavigate('staff'),
    },
    { label: 'Shop details', hint: shop?.name, icon: Store, onClick: () => onNavigate('settings') },
    { label: 'Import stock from a file', icon: Upload, onClick: () => onNavigate('settings') },
  ];

  const commonRows: Row[] = [
    { label: 'How this works', icon: HelpCircle, onClick: () => onNavigate('help') },
    { label: 'Contact us', icon: MessageSquare, onClick: () => onNavigate('contact') },
    { label: 'Your data', icon: ShieldAlert, onClick: () => onNavigate('privacy') },
    { label: 'About Tarihi', icon: Info, onClick: () => onNavigate('about') },
  ];

  const rows = isOwner ? [...ownerRows, ...commonRows] : commonRows;

  return (
    <div className="space-y-4">
      <div className="sheet">
        <p className="font-semibold truncate">{user?.user_metadata?.full_name || 'You'}</p>
        <p className="text-sm text-muted-foreground truncate">{toDisplayIdentity(user?.email)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {isOwner ? 'Owner' : 'Staff'} at {shop?.name}
        </p>
      </div>

      {canInstall && (
        <button
          type="button"
          onClick={onInstall}
          className="sheet w-full flex items-center gap-3 text-left pressable border-primary/40 bg-primary/5"
        >
          <Download className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-primary">Install on this phone</p>
            <p className="text-xs text-muted-foreground">Opens like an app, works offline</p>
          </div>
        </button>
      )}

      <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={row.label}
              type="button"
              onClick={row.onClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted transition-colors"
            >
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">{row.label}</p>
                {row.hint && <p className="text-xs text-muted-foreground truncate">{row.hint}</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={signOut}
        className="sheet w-full flex items-center gap-3 text-left pressable text-destructive"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">Log out</span>
      </button>
    </div>
  );
}
