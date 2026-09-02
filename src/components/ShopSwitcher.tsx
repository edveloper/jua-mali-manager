import { useState } from 'react';
import { Check, Plus, Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ShopSwitcherProps {
  onClose: () => void;
}

/**
 * Choosing which shop you are looking at, and adding another.
 *
 * Branches are grouped under the business they belong to; a shop with no
 * business stands on its own. That distinction exists only here and in
 * reporting later, because at every other level a branch is simply a shop with
 * its own stock, staff and till.
 */
export function ShopSwitcher({ onClose }: ShopSwitcherProps) {
  const { shop, shops, switchShop, refreshShopData } = useAuth();
  const { toast } = useToast();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [branchOf, setBranchOf] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const ownedShops = shops.filter((s) => s.role === 'owner');

  // Branches together, standalone shops on their own. Sorting by business keeps
  // the two branches of one business next to each other in the list.
  const grouped = shops.reduce<{ key: string; shops: typeof shops }[]>((acc, s) => {
    const key = s.businessId ?? `solo:${s.id}`;
    const existing = acc.find((g) => g.key === key);
    if (existing) existing.shops.push(s);
    else acc.push({ key, shops: [s] });
    return acc;
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsSaving(true);

    const { data, error } = await supabase.rpc('create_shop_with_owner', {
      p_name: name.trim(),
      p_business_category: 'retail',
      p_branch_of: branchOf || null,
    });

    setIsSaving(false);

    if (error) {
      toast({ title: 'Could not create it', description: error.message, variant: 'destructive' });
      return;
    }

    await refreshShopData();
    const created = data as { id?: string } | null;
    if (created?.id) switchShop(created.id);

    toast({
      title: `${name.trim()} is ready`,
      description: 'You are now looking at the new shop. Everything starts empty.',
    });
    onClose();
  };

  if (adding) {
    return (
      <Modal
        title="Add a shop"
        onClose={() => setAdding(false)}
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={() => setAdding(false)}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleCreate} disabled={isSaving || !name.trim()}>
              {isSaving ? 'Creating...' : 'Create it'}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="new-shop-name">What is it called?</Label>
          <Input
            id="new-shop-name"
            placeholder="e.g. Eddie's Liquor, Mariakani"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {ownedShops.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="branch-of">Is it part of a business you already have?</Label>
            <select
              id="branch-of"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={branchOf}
              onChange={(e) => setBranchOf(e.target.value)}
            >
              <option value="">No, it is a separate business</option>
              {ownedShops.map((s) => (
                <option key={s.id} value={s.id}>
                  A branch of {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Branches are listed together and can be reported on as one business later.
              They still keep their own stock, staff and till.
            </p>
          </div>
        )}

        <div className="sheet">
          <p className="text-xs text-muted-foreground leading-relaxed">
            The new shop starts completely empty: no products, no staff, no records. Nothing
            moves across from this one.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Your shops"
      onClose={onClose}
      footer={
        // Only somebody who already owns a shop. A member of staff switching
        // between two employers has no business creating a third from here, and
        // an "add a shop" button in their face invites exactly that.
        ownedShops.length > 0 ? (
          <Button className="flex-1" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add a shop
          </Button>
        ) : (
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Done
          </Button>
        )
      }
    >
      {grouped.map((group) => (
        <div key={group.key} className="sheet p-0 overflow-hidden divide-y divide-border/70">
          {group.shops.map((s) => {
            const active = s.id === shop?.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { switchShop(s.id); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-muted transition-colors"
              >
                <div
                  className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    active ? 'bg-primary/15' : 'bg-muted'
                  }`}
                >
                  <Store className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {s.name}
                    {s.branchLabel ? ` · ${s.branchLabel}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.role === 'owner' ? 'Owner' : 'Staff'}
                    {group.shops.length > 1 ? ' · branch' : ''}
                  </p>
                </div>
                {active && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      ))}
    </Modal>
  );
}
