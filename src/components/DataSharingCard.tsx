import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

/**
 * Asking, in the shop's own words, before anything is collected.
 *
 * Two things this has to get right to be worth having.
 *
 * It says exactly what leaves and exactly what does not, in specifics rather
 * than in the language of a policy. "Aggregated and anonymised" means nothing to
 * somebody deciding whether their supplier will find out what they charge.
 *
 * And turning it off is easier than turning it on. Switching on asks for a
 * confirmation, because agreeing to share is a decision worth a second look.
 * Switching off happens immediately, with nothing to talk anybody out of it.
 * Making withdrawal the harder path is the oldest trick in the book and it is
 * also the one thing the law is least forgiving about.
 */

const SHARED = [
  'Which items sell, at what price, and how many',
  'The kind of business you run, and the general area',
  'Always counted together with other shops, never on its own',
];

const NEVER = [
  'Customer names or phone numbers',
  'Who owes you money, or how much',
  'Your takings, your spending, or your profit',
  'Your shop name, your exact location, or anything that points to you',
];

export function DataSharingCard() {
  const { shop, isOwner, updateShopProfile, refreshShopData } = useAuth();
  const { toast } = useToast();
  const [asking, setAsking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Staff have no say in this, and showing them a control they cannot use
  // implies the shop's records are theirs to give away.
  if (!isOwner) return null;

  const sharing = Boolean(shop?.data_sharing_consent);
  const decidedAt = shop?.data_sharing_decided_at;

  const set = async (next: boolean) => {
    setIsSaving(true);
    const { error } = await updateShopProfile({ data_sharing_consent: next });
    setIsSaving(false);
    setAsking(false);

    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }

    await refreshShopData();
    toast(
      next
        ? { title: 'Thank you', description: 'Your shop now helps build the price picture.' }
        : { title: 'Stopped', description: 'Nothing more will be shared from this shop.' }
    );
  };

  return (
    <>
      <div className="sheet">
        <p className="sheet-heading">Helping build the bigger picture</p>
        <p className="text-sm mt-2 leading-relaxed">
          We are putting together a picture of what things actually cost across the
          country, built from what shops like yours really sell. If you take part,
          you will be able to see how your prices compare with other shops near you.
        </p>

        <div className="mt-3 space-y-1.5">
          {SHARED.map((line) => (
            <div key={line} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <span className="text-sm">{line}</span>
            </div>
          ))}
        </div>

        <p className="sheet-heading mt-4">Never, whatever you choose</p>
        <div className="mt-2 space-y-1.5">
          {NEVER.map((line) => (
            <div key={line} className="flex items-start gap-2">
              <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span className="text-sm">{line}</span>
            </div>
          ))}
        </div>

        <div className="ledger-line ledger-total mt-4">
          <span className="font-semibold">{sharing ? 'You are taking part' : 'You are not taking part'}</span>
          {sharing && decidedAt && (
            <span className="text-xs text-muted-foreground">
              since {format(new Date(decidedAt), 'd MMM yyyy')}
            </span>
          )}
        </div>

        {sharing ? (
          <Button
            variant="outline"
            className="w-full mt-3"
            disabled={isSaving}
            onClick={() => set(false)}
          >
            Stop sharing
          </Button>
        ) : (
          <Button className="w-full mt-3" disabled={isSaving} onClick={() => setAsking(true)}>
            Take part
          </Button>
        )}

        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          Nothing in the app depends on this. Everything works the same either way,
          and you can change your mind whenever you like.
        </p>
      </div>

      {asking && (
        <ConfirmDialog
          title="Share what sells, and for how much?"
          message="Your prices and quantities get counted together with other shops. Your name, your customers and your takings stay here."
          details={[
            { label: 'Shop', value: shop?.name ?? '' },
            { label: 'Shared', value: 'Items, prices, quantities' },
            { label: 'Not Shared', value: 'Customers, deni, takings' },
          ]}
          confirmLabel="Yes, Count Me In"
          cancelLabel="Not Now"
          onConfirm={() => set(true)}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  );
}
