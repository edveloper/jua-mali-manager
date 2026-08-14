import { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';

const MIN_LENGTH = 6;

/**
 * Shown to an employee who is still using the password their owner typed when
 * creating the account. Blocks the app until they pick their own, so the owner
 * stops being able to sign in as them -- which is what makes sold_by on a sale
 * mean anything.
 */
export function PasswordSetupGate() {
  const { user, completePasswordSetup, signOut } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const firstName = String(user?.user_metadata?.full_name || '').trim().split(' ')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    setIsSaving(true);
    const { error: saveError } = await completePasswordSetup(password);
    setIsSaving(false);

    if (saveError) {
      // Supabase rejects reusing the current password, which is exactly the
      // case worth catching here.
      const message = String(saveError.message || '');
      setError(
        /different from the old password/i.test(message)
          ? 'Choose a password different from the one you were given.'
          : message || 'Could not save your password. Try again.'
      );
      return;
    }

    toast({ title: 'Password saved', description: 'Use this new password from now on.' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-6 flex justify-center">
        <Logo size="md" />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">
              {firstName ? `Karibu, ${firstName}` : 'Karibu'}
            </h2>
            <p className="text-muted-foreground text-sm">
              Your manager gave you a password to get started. Choose your own now, so
              only you can sign in to your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type="password"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`At least ${MIN_LENGTH} characters`}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Type It Again</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  className="pl-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Same password again"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save My Password'}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={signOut}
              className="text-sm text-muted-foreground hover:underline"
            >
              Not your account? Sign out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
