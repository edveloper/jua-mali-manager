import { useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { isPhoneAccount } from '@/lib/identity';

/**
 * Somewhere to send a code when the phone cannot receive one.
 *
 * Kenya's do-not-disturb register blocks bulk SMS from an unregistered sender,
 * and two separate test numbers both came back UserInBlacklist. A registered
 * sender ID fixes that and wants company documents, which is the same thing
 * gating the Paybill and the Play Store listing. So SMS recovery is built,
 * correct, and cannot deliver yet.
 *
 * An address fixes it today. It is not better than SMS -- it needs somebody to
 * have an inbox and to have thought ahead -- but almost everybody running a duka
 * has a Gmail even when they would rather sign in with their phone, and this
 * takes five seconds to fill in while somebody is sitting with them.
 *
 * Only shown to phone logins. An email account can already be reset the
 * ordinary way, and offering this there would just be a second address to keep
 * in step with the first.
 */
export function RecoveryEmailCard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const saved = (user?.user_metadata?.recovery_email as string | undefined) ?? '';
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);

  if (!isPhoneAccount(user?.email)) return null;

  const clean = value.trim().toLowerCase();
  const looksLikeEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean);
  const changed = clean !== saved.toLowerCase();

  const save = async () => {
    setBusy(true);
    // Spread the existing metadata rather than sending the one key. Writing a
    // lone field here has erased somebody's name before.
    const { error } = await supabase.auth.updateUser({
      data: { ...(user?.user_metadata ?? {}), recovery_email: clean || null },
    });
    setBusy(false);

    if (error) {
      toast({ title: 'Could not save it', description: error.message, variant: 'destructive' });
      return;
    }

    toast(
      clean
        ? { title: 'Saved', description: 'We will send your code here if you forget your password.' }
        : { title: 'Removed', description: 'No address on file.' }
    );
  };

  return (
    <div className="sheet space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Mail className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">Where to Reach You</p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            You sign in with your phone number, which has no inbox. Add an email
            and we can send you a code if you ever forget your password.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recovery-email">Your email</Label>
        <Input
          id="recovery-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {clean !== '' && !looksLikeEmail && (
          <p className="text-xs text-destructive">That does not look like an email address.</p>
        )}
      </div>

      <Button
        className="w-full"
        onClick={save}
        disabled={busy || !changed || (clean !== '' && !looksLikeEmail)}
      >
        {busy ? 'Saving...' : saved ? 'Update It' : 'Save It'}
      </Button>

      {saved && (
        <div className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            You can get back in if you forget your password. We only use this for
            that, and never to sign you in.
          </p>
        </div>
      )}
    </div>
  );
}
