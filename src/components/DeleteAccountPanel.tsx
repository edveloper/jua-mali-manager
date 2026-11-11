import { useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useOnline } from '@/hooks/useOnline';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cacheForgetEverything } from '@/lib/localCache';

interface DeleteAccountPanelProps {
  /** Only offered when the shop on screen is one this person can export. */
  onExport?: () => void;
}

// Same rule as the server: capitals and stray spaces are not differences.
const normalise = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

const shopLabel = (name: string, branch: string | null) => (branch ? `${name} (${branch})` : name);

/**
 * Deletes the account for good. There is no undo, so the screen spells out what
 * goes, offers the export first, and asks for the shop's name and the password.
 * The name stops a slip of the thumb. The password stops whoever else is holding
 * an unlocked phone, since the name is right there on the screen.
 */
export function DeleteAccountPanel({ onExport }: DeleteAccountPanelProps) {
  const { shop, shops, signOut, refreshShopData } = useAuth();
  const { toast } = useToast();
  const online = useOnline();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const owned = shops.filter((s) => s.role === 'owner');
  const worksIn = shops.filter((s) => s.role !== 'owner');

  // Staff have no shop of their own to name, so they type a word instead.
  const word = owned.find((s) => s.id === shop?.id)?.name ?? owned[0]?.name ?? 'DELETE';
  const matches = normalise(typed) === normalise(word);

  const handleDelete = async () => {
    if (!matches || !password || isDeleting) return;
    setIsDeleting(true);

    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { confirm: typed, password },
    });

    if (error || !data?.deleted) {
      // A non-2xx answer keeps its message in the response body.
      let message = data?.error as string | undefined;
      const response = (error as { context?: Response } | null)?.context;
      if (!message && response?.json) {
        message = await response.json().then((b) => b?.error).catch(() => undefined);
      }
      toast({
        title: 'Could Not Delete Your Account',
        description: message || 'Check your connection and try again.',
        variant: 'destructive',
      });
      // With several shops, the one just typed may be gone already. Reloading
      // the list puts a name that still exists in front of them for the retry.
      if (owned.length > 1) {
        await refreshShopData();
        setTyped('');
      }
      setIsDeleting(false);
      return;
    }

    // The account is gone, so nothing on this phone is waiting to be saved.
    await cacheForgetEverything();
    await signOut();
    window.location.replace('/delete-account?deleted=1');
  };

  return (
    <div className="space-y-3">
      <div className="sheet space-y-2">
        <p className="font-semibold">This Cannot Be Undone</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your login and your details are deleted straight away and for good. We cannot get
          any of it back for you afterwards, even if you ask.
        </p>
      </div>

      {owned.length > 0 && (
        <div className="sheet space-y-2">
          <p className="font-semibold">{owned.length === 1 ? 'Your Shop Goes Too' : 'Your Shops Go Too'}</p>
          <ul className="text-sm font-medium space-y-1">
            {owned.map((s) => (
              <li key={s.id}>{shopLabel(s.name, s.branchLabel)}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            That means every sale, product, credit record, expense, invoice and customer in it. Invoice
            links you have sent stop working. Your staff lose their logins as well, unless they also
            work in another shop.
          </p>
        </div>
      )}

      {worksIn.length > 0 && (
        <div className="sheet space-y-2">
          <p className="font-semibold">Where You Work</p>
          <ul className="text-sm font-medium space-y-1">
            {worksIn.map((s) => (
              <li key={s.id}>{shopLabel(s.name, s.branchLabel)}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You are removed from {worksIn.length === 1 ? 'this shop' : 'these shops'}. The owner keeps
            the records, including the sales you made, but your name no longer appears on them.
          </p>
        </div>
      )}

      {owned.length > 0 && (
        <div className="sheet space-y-2">
          <p className="font-semibold">Keep a Copy First</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your records may still matter to you, for tax or for a lender.
            {owned.length > 1 && ' Exports are per shop, so switch to each one and export it.'}
          </p>
          {onExport && (
            <Button variant="outline" className="w-full" onClick={onExport} disabled={isDeleting}>
              <Download className="h-4 w-4 mr-2" />
              Export My Records
            </Button>
          )}
        </div>
      )}

      <div className="sheet space-y-2">
        <label htmlFor="delete-confirm" className="font-semibold block">
          Type <span className="text-destructive">{word}</span> to Confirm
        </label>
        <Input
          id="delete-confirm"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={isDeleting}
        />
        <label htmlFor="delete-password" className="font-semibold block pt-1">
          Your Password
        </label>
        <Input
          id="delete-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          disabled={isDeleting}
        />
        <p className="text-xs text-muted-foreground">
          Forgotten it? Log out and reset it from the sign-in screen, then come back.
        </p>
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleDelete}
          disabled={!matches || !password || isDeleting || !online}
        >
          {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
          {isDeleting ? 'Deleting...' : 'Delete My Account'}
        </Button>
        {!online && (
          <p className="text-xs text-muted-foreground">You need a connection to do this.</p>
        )}
      </div>
    </div>
  );
}
