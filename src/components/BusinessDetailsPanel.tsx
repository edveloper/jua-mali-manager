import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, ShopProfileUpdate } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Two megabytes is generous for a shop mark and mean enough to catch a photo. */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

const CATEGORIES: [string, string][] = [
  ['retail', 'Retail shop / Duka'],
  ['barbershop_salon', 'Barbershop / Salon'],
  ['computer_center', 'Computer centre / Cyber'],
  ['transport', 'Transport / Matatu'],
  ['food_hospitality', 'Food / Hospitality'],
  ['repair_services', 'Repair services'],
  ['health_beauty', 'Health / Beauty'],
  ['education_training', 'Education / Training'],
  ['other_services', 'Other service business'],
];

const TERMS = [
  { days: 0, label: 'On delivery' },
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

/**
 * The details that end up on an invoice.
 *
 * Kept out of sign-up on purpose. Somebody creating an account has not decided
 * they trust us with a KRA PIN and has no document to put one on; asked here,
 * every field has an obvious reason to exist. The invoice screen sends people
 * to this panel when something it needs is missing.
 */
export function BusinessDetailsPanel() {
  const { shop, isOwner, updateShopProfile, refreshShopData } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ShopProfileUpdate>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!shop) return;
    setForm({
      name: shop.name ?? '',
      business_category: shop.business_category ?? 'retail',
      address: shop.address ?? '',
      phone: shop.phone ?? '',
      email: shop.email ?? '',
      kra_pin: shop.kra_pin ?? '',
      branch_label: shop.branch_label ?? '',
      vat_registered: Boolean(shop.vat_registered),
      vat_number: shop.vat_number ?? '',
      mpesa_paybill: shop.mpesa_paybill ?? '',
      mpesa_account: shop.mpesa_account ?? '',
      cheque_payee: shop.cheque_payee ?? '',
      bank_name: shop.bank_name ?? '',
      bank_branch: shop.bank_branch ?? '',
      bank_account: shop.bank_account ?? '',
      default_terms_days: shop.default_terms_days ?? 30,
    });
  }, [shop]);

  const set = (patch: ShopProfileUpdate) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    setIsSaving(true);
    // Empty boxes are stored as null rather than '', so the invoice can ask
    // "is this missing" without also having to ask "is it blank".
    const cleaned: ShopProfileUpdate = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [
        k,
        // A shop with no name would appear as a blank heading on every document,
        // so it is the one field that cannot be cleared.
        k !== 'name' && typeof v === 'string' && v.trim() === '' ? null : v,
      ])
    );

    if (!String(cleaned.name ?? '').trim()) {
      setIsSaving(false);
      toast({ title: 'Your shop needs a name', variant: 'destructive' });
      return;
    }
    const { error } = await updateShopProfile(cleaned);
    setIsSaving(false);

    toast(
      error
        ? { title: 'Could not save', description: error.message, variant: 'destructive' }
        : { title: 'Saved', description: 'Your invoices will use these details.' }
    );
  };

  const handleLogo = async (file: File) => {
    if (!shop?.id) return;

    if (!LOGO_TYPES.includes(file.type)) {
      toast({ title: 'Use a PNG, JPG, WEBP or SVG', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast({
        title: 'That file is too big',
        description: 'Keep it under 2MB. A logo does not need to be a photograph.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    // Fixed path per shop, so replacing a logo does not leave the old one
    // behind. upsert overwrites it in place.
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${shop.id}/logo.${ext}`;

    const { error } = await supabase.storage
      .from('shop-logos')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) {
      setIsUploading(false);
      toast({ title: 'Could not upload', description: error.message, variant: 'destructive' });
      return;
    }

    const { data } = supabase.storage.from('shop-logos').getPublicUrl(path);
    // The cache buster matters: the path never changes, so without it a replaced
    // logo keeps showing the old image until the browser gives up on its cache.
    const url = `${data.publicUrl}?v=${Date.now()}`;

    await updateShopProfile({ logo_url: url });
    await refreshShopData();
    setIsUploading(false);
    toast({ title: 'Logo saved' });
  };

  const removeLogo = async () => {
    await updateShopProfile({ logo_url: null });
    await refreshShopData();
    toast({ title: 'Logo removed' });
  };

  if (!isOwner) {
    return (
      <div className="sheet">
        <p className="text-sm text-muted-foreground">
          Only the owner can change how the business appears on documents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="sheet space-y-3">
        <p className="sheet-heading">Your shop</p>

        <div className="space-y-1.5">
          <Label htmlFor="biz-name">Shop name</Label>
          <Input
            id="biz-name"
            value={form.name ?? ''}
            onChange={(e) => set({ name: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            What your staff see when they sign in, and what heads your invoices.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="biz-category">What kind of business?</Label>
          <select
            id="biz-category"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.business_category ?? 'retail'}
            onChange={(e) => set({ business_category: e.target.value })}
          >
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Only used to suggest the right kinds of spending.
          </p>
        </div>
      </div>

      <div className="sheet space-y-3">
        <div>
          <p className="sheet-heading">On your invoices</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            This is what a customer sees at the top of the page. Everything except the
            shop name is optional.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {shop?.logo_url ? (
            <img
              src={shop.logo_url}
              alt="Your logo"
              className="h-14 w-14 rounded-lg object-contain bg-muted"
            />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Logo</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP or SVG. Under 2MB.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={LOGO_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogo(file);
              e.target.value = '';
            }}
          />
          <Button variant="outline" size="sm" disabled={isUploading} onClick={() => fileRef.current?.click()}>
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : shop?.logo_url ? 'Change' : 'Add'}
          </Button>
          {shop?.logo_url && (
            <Button variant="ghost" size="icon-sm" aria-label="Remove logo" onClick={removeLogo}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="biz-address">Where you are</Label>
          <Input
            id="biz-address"
            placeholder="e.g. Biashara Street, Voi"
            value={form.address ?? ''}
            onChange={(e) => set({ address: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="biz-phone">Phone</Label>
            <Input
              id="biz-phone"
              inputMode="tel"
              placeholder="0712 345 678"
              value={form.phone ?? ''}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-email">Email</Label>
            <Input
              id="biz-email"
              inputMode="email"
              autoCapitalize="none"
              placeholder="shop@example.com"
              value={form.email ?? ''}
              onChange={(e) => set({ email: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="biz-pin">KRA PIN</Label>
            <Input
              id="biz-pin"
              placeholder="A012345678X"
              autoCapitalize="characters"
              className="num"
              value={form.kra_pin ?? ''}
              onChange={(e) => set({ kra_pin: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-branch">Branch name</Label>
            <Input
              id="biz-branch"
              placeholder="e.g. Voi"
              value={form.branch_label ?? ''}
              onChange={(e) => set({ branch_label: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* VAT is two questions, not one. "Not registered" and "registered but the
          number is not typed yet" must not produce the same document. */}
      <div className="sheet space-y-3">
        <div>
          <p className="sheet-heading">VAT</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Only turn this on if you are actually registered. If it is off, no VAT line
            appears on anything you send.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={form.vat_registered ? 'outline' : 'default'}
            className="flex-1"
            onClick={() => set({ vat_registered: false })}
          >
            Not registered
          </Button>
          <Button
            variant={form.vat_registered ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => set({ vat_registered: true })}
          >
            Registered
          </Button>
        </div>

        {form.vat_registered && (
          <div className="space-y-1.5">
            <Label htmlFor="biz-vat">VAT number</Label>
            <Input
              id="biz-vat"
              className="num"
              autoCapitalize="characters"
              value={form.vat_number ?? ''}
              onChange={(e) => set({ vat_number: e.target.value.toUpperCase() })}
            />
            <p className="text-xs text-muted-foreground">
              Until this is filled in, invoices are sent without a VAT line.
            </p>
          </div>
        )}
      </div>

      <div className="sheet space-y-3">
        <div>
          <p className="sheet-heading">How they pay you</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            The part that turns a document into money. Whatever you fill in appears at the
            bottom of the invoice.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="biz-paybill">M-Pesa Paybill or Till</Label>
            <Input
              id="biz-paybill"
              inputMode="numeric"
              className="num"
              placeholder="400200"
              value={form.mpesa_paybill ?? ''}
              onChange={(e) => set({ mpesa_paybill: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-paybill-acc">Account name</Label>
            <Input
              id="biz-paybill-acc"
              placeholder="e.g. EDDIES"
              value={form.mpesa_account ?? ''}
              onChange={(e) => set({ mpesa_account: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="biz-cheque">Cheques payable to</Label>
          <Input
            id="biz-cheque"
            placeholder="Exactly as it should be written"
            value={form.cheque_payee ?? ''}
            onChange={(e) => set({ cheque_payee: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="biz-bank">Bank</Label>
            <Input
              id="biz-bank"
              placeholder="e.g. KCB"
              value={form.bank_name ?? ''}
              onChange={(e) => set({ bank_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biz-branchname">Branch</Label>
            <Input
              id="biz-branchname"
              placeholder="e.g. Voi"
              value={form.bank_branch ?? ''}
              onChange={(e) => set({ bank_branch: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="biz-acc">Account number</Label>
          <Input
            id="biz-acc"
            inputMode="numeric"
            className="num"
            value={form.bank_account ?? ''}
            onChange={(e) => set({ bank_account: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>When payment is due</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {TERMS.map((t) => (
              <Button
                key={t.days}
                variant={form.default_terms_days === t.days ? 'default' : 'outline'}
                size="sm"
                className="px-1 text-xs"
                onClick={() => set({ default_terms_days: t.days })}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            The starting point for a new invoice. You can change it on any one of them.
          </p>
        </div>
      </div>

      <Button className="w-full" onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save details'}
      </Button>
    </div>
  );
}
