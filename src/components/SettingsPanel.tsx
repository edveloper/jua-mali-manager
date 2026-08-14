import { useEffect, useState } from 'react';
import { LogOut, Store, User, Shield, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { EmployeeManager } from './EmployeeManager';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { toDisplayIdentity } from '@/lib/identity';
import { CatalogImportPanel } from './CatalogImportPanel';

interface SettingsPanelProps {
  onImportProducts?: (rows: Array<{
    name: string;
    category?: string;
    costPrice: number;
    sellingPrice: number;
    quantity: number;
    lowStockThreshold: number;
    durationMinutes?: number;
  }>) => Promise<{ inserted: number; error: any }>;
  onImportServices?: (rows: Array<{
    name: string;
    category?: string;
    costPrice: number;
    sellingPrice: number;
    quantity: number;
    lowStockThreshold: number;
    durationMinutes?: number;
  }>) => Promise<{ inserted: number; error: any }>;
}

export function SettingsPanel({ onImportProducts, onImportServices }: SettingsPanelProps) {
  const { user, shop, signOut, isOwner, updateShopProfile } = useAuth();
  const { toast } = useToast();
  const [shopName, setShopName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('retail');
  const [offeringMode, setOfferingMode] = useState('products');
  const [singleOffering, setSingleOffering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!shop) return;
    setShopName(shop.name || '');
    setBusinessCategory(shop.business_category || 'retail');
    setOfferingMode(shop.offering_mode || 'products');
    setSingleOffering(Boolean(shop.single_offering));
  }, [shop]);

  const handleSaveBusinessProfile = async () => {
    if (!shopName.trim()) {
      toast({ title: 'Shop name required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const { error } = await updateShopProfile({
      name: shopName.trim(),
      business_category: businessCategory,
      offering_mode: offeringMode,
      single_offering: singleOffering,
      currency: 'KES',
    });
    setIsSaving(false);

    if (error) {
      toast({ title: 'Could not save settings', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Business profile updated' });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="panel-glass p-5">
        <h2 className="text-2xl font-black">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Your business details, your staff, and your stock list.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <p className="section-kicker">You sell</p>
          <p className="text-sm font-bold mt-1 capitalize">{offeringMode.replace('_', ' ')}</p>
        </div>
        <div className="stat-card">
          <p className="section-kicker">Range</p>
          <p className="text-sm font-bold mt-1">{singleOffering ? 'One main line' : 'Several lines'}</p>
        </div>
      </div>

      <div className="panel-glass p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 shrink-0">
            <User className="h-6 w-6 text-primary" />
          </div>
          {/* min-w-0 is load-bearing: without it a long identity string cannot
              shrink and pushes the role badge past the edge of the screen. */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{user?.user_metadata?.full_name || 'User'}</p>
            <p className="text-sm text-muted-foreground truncate">{toDisplayIdentity(user?.email)}</p>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 shrink-0">
            <Shield className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary">{isOwner ? 'Owner' : 'Employee'}</span>
          </div>
        </div>
      </div>

      {shop && (
        <div className="panel-glass p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-secondary/10">
              <Store className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{shop.name}</p>
              <p className="text-sm text-muted-foreground">Your shop</p>
            </div>
          </div>
        </div>
      )}

      {shop && isOwner && (
        <div className="panel-glass p-4 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> About your business
          </h3>

          <div className="space-y-2">
            <Label htmlFor="shop-name">Shop name</Label>
            <Input id="shop-name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-category">What kind of business?</Label>
            <select
              id="business-category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={businessCategory}
              onChange={(e) => setBusinessCategory(e.target.value)}
            >
              <option value="retail">Retail Shop / Duka</option>
              <option value="barbershop_salon">Barbershop / Salon</option>
              <option value="computer_center">Computer Center / Cyber</option>
              <option value="transport">Transport / Matatu</option>
              <option value="food_hospitality">Food / Hospitality</option>
              <option value="repair_services">Repair Services</option>
              <option value="health_beauty">Health / Beauty Services</option>
              <option value="education_training">Education / Training</option>
              <option value="other_services">Other Service Business</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offering-mode">What do you sell?</Label>
            <select
              id="offering-mode"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={offeringMode}
              onChange={(e) => setOfferingMode(e.target.value)}
            >
              <option value="products">Goods</option>
              <option value="services">Services</option>
              <option value="mixed">Both</option>
            </select>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm">I mainly sell one thing</span>
            <input
              type="checkbox"
              checked={singleOffering}
              onChange={(e) => setSingleOffering(e.target.checked)}
            />
          </label>

          <Button onClick={handleSaveBusinessProfile} disabled={isSaving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}

      {isOwner && onImportProducts && onImportServices && (
        <CatalogImportPanel
          offeringMode={(offeringMode as 'products' | 'services' | 'mixed')}
          onImportProducts={onImportProducts}
          onImportServices={onImportServices}
        />
      )}

      {isOwner && <EmployeeManager />}

      <Button variant="outline" className="w-full rounded-xl" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
