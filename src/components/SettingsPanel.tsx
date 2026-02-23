import { useEffect, useState } from 'react';
import { LogOut, Store, User, Shield, Save, Sparkles, Activity, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { EmployeeManager } from './EmployeeManager';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { aiClient } from '@/lib/aiClient';

export function SettingsPanel() {
  const { user, shop, signOut, isOwner, updateShopProfile } = useAuth();
  const { toast } = useToast();
  const [shopName, setShopName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('retail');
  const [offeringMode, setOfferingMode] = useState('products');
  const [singleOffering, setSingleOffering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiHealthState, setAiHealthState] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [aiHealthDetails, setAiHealthDetails] = useState('');

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

  const checkAiHealth = async () => {
    setAiHealthState('checking');
    setAiHealthDetails('');
    try {
      const result = await aiClient.health();
      if (result?.ok) {
        setAiHealthState('online');
        setAiHealthDetails(`Online: ${result.provider} / ${result.model}`);
      } else {
        setAiHealthState('offline');
        setAiHealthDetails('AI server responded but not healthy.');
      }
    } catch {
      setAiHealthState('offline');
      setAiHealthDetails('Cannot reach AI server. Ensure `npm run ai:dev` is running.');
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="panel-glass p-5">
        <p className="section-kicker">Configuration</p>
        <h2 className="text-2xl font-black mt-1">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage business profile, AI connectivity, and team access.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <p className="section-kicker">Current Mode</p>
          <p className="text-sm font-bold mt-1 capitalize">{offeringMode.replace('_', ' ')}</p>
        </div>
        <div className="stat-card">
          <p className="section-kicker">Profile Type</p>
          <p className="text-sm font-bold mt-1">{singleOffering ? 'Single Offering' : 'Multi Offering'}</p>
        </div>
      </div>

      <div className="panel-glass p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">{user?.user_metadata?.full_name || 'User'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10">
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
              <p className="text-sm text-muted-foreground">Active Business Workspace</p>
            </div>
          </div>
        </div>
      )}

      {shop && isOwner && (
        <div className="panel-glass p-4 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Business Profile
          </h3>

          <div className="space-y-2">
            <Label htmlFor="shop-name">Business Name</Label>
            <Input id="shop-name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-category">Business Category</Label>
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
            <Label htmlFor="offering-mode">Offering Mode</Label>
            <select
              id="offering-mode"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={offeringMode}
              onChange={(e) => setOfferingMode(e.target.value)}
            >
              <option value="products">Products Only</option>
              <option value="services">Services Only</option>
              <option value="mixed">Products + Services</option>
            </select>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm">Single main product/service business</span>
            <input
              type="checkbox"
              checked={singleOffering}
              onChange={(e) => setSingleOffering(e.target.checked)}
            />
          </label>

          <Button onClick={handleSaveBusinessProfile} disabled={isSaving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Business Profile'}
          </Button>
        </div>
      )}

      {isOwner && (
        <div className="panel-glass p-4 space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> AI Server
          </h3>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Status: {aiHealthState === 'idle' ? 'Not checked' : aiHealthState}
              </p>
              {aiHealthDetails && (
                <p className="text-xs text-muted-foreground truncate">{aiHealthDetails}</p>
              )}
            </div>
            <Button variant="outline" onClick={checkAiHealth} disabled={aiHealthState === 'checking'}>
              {aiHealthState === 'checking' ? 'Checking...' : 'Check AI Server'}
            </Button>
          </div>
          {aiHealthState === 'online' && (
            <p className="text-xs text-success flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> AI features ready in Reports tab.
            </p>
          )}
        </div>
      )}

      {isOwner && <EmployeeManager />}

      <Button variant="outline" className="w-full rounded-xl" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
