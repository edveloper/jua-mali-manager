import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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
}

const CATEGORIES = [
  ['retail', 'Shop / duka'],
  ['food_hospitality', 'Food, drinks, hotel'],
  ['transport', 'Transport'],
  ['computer_center', 'Cyber / printing'],
  ['barbershop_salon', 'Barber / salon'],
  ['repair_services', 'Repairs'],
  ['health_beauty', 'Health / beauty'],
  ['education_training', 'Teaching / training'],
  ['other_services', 'Something else'],
] as const;

/**
 * Shop details only. Who you are and signing out live in More, and staff have
 * their own screen -- this used to carry all three at once.
 */
export function SettingsPanel({ onImportProducts }: SettingsPanelProps) {
  const { shop, isOwner, updateShopProfile } = useAuth();
  const { toast } = useToast();
  const [shopName, setShopName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('retail');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!shop) return;
    setShopName(shop.name || '');
    setBusinessCategory(shop.business_category || 'retail');
  }, [shop]);

  const dirty =
    shopName.trim() !== (shop?.name || '') ||
    businessCategory !== (shop?.business_category || 'retail');

  const handleSave = async () => {
    if (!shopName.trim()) {
      toast({ title: 'Your shop needs a name', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const { error } = await updateShopProfile({
      name: shopName.trim(),
      business_category: businessCategory,
      currency: 'KES',
    });
    setIsSaving(false);

    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved' });
  };

  if (!isOwner) {
    return (
      <div className="sheet">
        <p className="text-sm text-muted-foreground">Only the owner can change shop details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="sheet space-y-4">
        <div className="space-y-2">
          <Label htmlFor="shop-name">Shop name</Label>
          <Input id="shop-name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          <p className="text-xs text-muted-foreground">What your staff see when they sign in.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="business-category">What kind of business?</Label>
          <select
            id="business-category"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={businessCategory}
            onChange={(e) => setBusinessCategory(e.target.value)}
          >
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Only used to suggest the right expense types.</p>
        </div>

        <Button onClick={handleSave} disabled={isSaving || !dirty} className="w-full">
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>

      {onImportProducts && <CatalogImportPanel onImportProducts={onImportProducts} />}
    </div>
  );
}
