import {
  Users, FileText, History, HelpCircle, MessageSquare, ShieldAlert,
  LogOut, Download, ChevronRight, Info, Store, LucideIcon,
} from 'lucide-react';
import { TabType } from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { toDisplayIdentity } from '@/lib/identity';

interface MoreMenuProps {
  onNavigate: (tab: TabType) => void;
  staffCount: number;
  canInstall: boolean;
  onInstall: () => void;
  onOpenShops: () => void;
}

interface Row {
  label: string;
  hint?: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface Group {
  title: string;
  rows: Row[];
}

/**
 * A screen, not a dropdown.
 *
 * It used to be nine identical rows in one undifferentiated list: no weight on
 * the labels, icons drained to muted, and nothing distinguishing "change how
 * customers pay you" from "read the privacy note". In an app that everywhere
 * else has terracotta, ruled sheets and a real type scale, this one screen read
 * as unfinished.
 *
 * So it is grouped by what each thing is for, and the icons carry the accent.
 * Two groups rather than four: more headings than rows is its own clutter.
 */
export function MoreMenu({ onNavigate, staffCount, canInstall, onInstall, onOpenShops }: MoreMenuProps) {
  const { user, shop, shops, isOwner, signOut } = useAuth();

  const name = user?.user_metadata?.full_name || 'You';

  const ownerGroup: Group = {
    title: 'Running the shop',
    rows: [
      {
        label: 'Business details',
        hint: 'Name, logo, and how customers pay you',
        icon: FileText,
        onClick: () => onNavigate('business'),
      },
      {
        label: 'Your shops',
        hint: shops.length > 1
          ? `${shops.length} shops. Switch or add another`
          : 'Add a branch or a second business',
        icon: Store,
        onClick: onOpenShops,
      },
      {
        label: 'Staff',
        hint: staffCount === 0
          ? 'Nobody added yet'
          : `${staffCount} ${staffCount === 1 ? 'person' : 'people'}`,
        icon: Users,
        onClick: () => onNavigate('staff'),
      },
      {
        label: 'Activity',
        hint: 'Everything that happened, and who did it',
        icon: History,
        onClick: () => onNavigate('activity'),
      },
    ],
  };

  const commonGroup: Group = {
    title: 'DukaKonnect',
    rows: [
      { label: 'How this works', icon: HelpCircle, onClick: () => onNavigate('help') },
      {
        label: 'Contact us',
        hint: 'Something broken, or an idea',
        icon: MessageSquare,
        onClick: () => onNavigate('contact'),
      },
      {
        label: 'Your data',
        hint: 'What we keep, and who can see it',
        icon: ShieldAlert,
        onClick: () => onNavigate('privacy'),
      },
      { label: 'About', icon: Info, onClick: () => onNavigate('about') },
    ],
  };

  const groups = isOwner ? [ownerGroup, commonGroup] : [commonGroup];

  return (
    <div className="space-y-4">
      {/* Who you are and where. Given the weight of a heading rather than the
          same small grey as everything under it. */}
      <div className="sheet flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-primary">
            {name.trim().charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {isOwner ? 'Owner' : 'Staff'} at {shop?.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {toDisplayIdentity(user?.email)}
          </p>
        </div>
      </div>

      {canInstall && (
        <button
          type="button"
          onClick={onInstall}
          className="sheet w-full flex items-center gap-3 text-left pressable border-primary/40 bg-primary/5"
        >
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Download className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-primary">Put DukaKonnect on your home screen</p>
            <p className="text-xs text-muted-foreground">Opens like an app, works offline</p>
          </div>
        </button>
      )}

      {groups.map((group) => (
        <div key={group.title} className="space-y-1.5">
          <p className="sheet-heading px-1">{group.title}</p>
          <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
            {group.rows.map((row) => {
              const Icon = row.icon;
              return (
                <button
                  key={row.label}
                  type="button"
                  onClick={row.onClick}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-muted transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{row.label}</p>
                    {row.hint && (
                      <p className="text-xs text-muted-foreground truncate">{row.hint}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Set apart. Signing out does not belong in the same list as the about
          page, and a destructive action next to a chevron invites a mis-tap. */}
      <button
        type="button"
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium text-destructive active:bg-destructive/5 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>

      <div className="flex flex-col items-center gap-2 pt-1 pb-2 opacity-60">
        <Logo size="sm" wordmark={false} />
        <p className="text-xs text-muted-foreground">biashara yako, siku kwa siku</p>
      </div>
    </div>
  );
}
