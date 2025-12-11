import { LogOut, Store, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { EmployeeManager } from './EmployeeManager';

export function SettingsPanel() {
  const { user, shop, signOut, isOwner } = useAuth();

  return (
    <div className="space-y-6 animate-slide-up">
      <h2 className="text-lg font-semibold text-foreground">Settings</h2>

      {/* Account Info */}
      <div className="stat-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">
              {user?.user_metadata?.full_name || 'User'}
            </p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10">
            <Shield className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary">
              {isOwner ? 'Owner' : 'Employee'}
            </span>
          </div>
        </div>
      </div>

      {/* Shop Info */}
      {shop && (
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-secondary/10">
              <Store className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{shop.name}</p>
              <p className="text-sm text-muted-foreground">Your Shop</p>
            </div>
          </div>
        </div>
      )}

      {/* Employee Management - Only for owners */}
      {isOwner && <EmployeeManager />}

      {/* Sign Out */}
      <Button
        variant="outline"
        className="w-full"
        onClick={signOut}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
