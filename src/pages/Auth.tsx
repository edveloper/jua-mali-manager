import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AtSign, Lock, User, Building2, Eye, EyeOff, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';
import { toAuthEmail, canReceiveEmail, identifierKind, prettyPhone } from '@/lib/identity';

type AuthMode = 'signin' | 'signup';

const CATEGORIES = [
  { value: 'retail', label: 'Retail shop / Duka' },
  { value: 'barbershop_salon', label: 'Barbershop / Salon' },
  { value: 'computer_center', label: 'Computer centre / Cyber' },
  { value: 'transport', label: 'Transport / Matatu' },
  { value: 'food_hospitality', label: 'Food / Hospitality' },
  { value: 'repair_services', label: 'Repair services' },
  { value: 'health_beauty', label: 'Health / Beauty' },
  { value: 'education_training', label: 'Education / Training' },
  { value: 'other_services', label: 'Other service business' },
];

/**
 * One form, one identity box.
 *
 * This used to open on a pair of tabs, Mobile Number and Email Address, which
 * asked people to classify themselves before they had typed anything. The tabs
 * were only ever cosmetic: `toAuthEmail` has always accepted either and mapped a
 * phone number onto a synthetic address. So the choice bought nothing and cost
 * a decision, plus a cleared field every time somebody guessed wrong.
 *
 * Now the box works it out while you type, shows which one it thinks you meant,
 * and reads back the number it will actually store. The tab strip is gone.
 */
export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('retail');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { signIn, signUp, user, shopMember, loading: isLoading, sendPasswordReset } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wasRemoved = searchParams.get('removed') === '1';

  const kind = useMemo(() => identifierKind(identifier), [identifier]);
  const isSignUp = mode === 'signup';

  // Waits for the membership, not just the user. During sign-up the auth user
  // exists for a moment before create_shop_with_owner has run; redirecting on
  // `user` alone sent people to a shopless dashboard, which then bounced them
  // straight back here with "You no longer have access to this shop".
  useEffect(() => {
    if (user && shopMember && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [user, shopMember, isLoading, navigate]);

  const handleForgotPassword = async () => {
    const value = identifier.trim();

    if (!value) {
      toast({ title: 'Type your phone number or email first', variant: 'destructive' });
      return;
    }

    // A phone login has no inbox to send to, because the address is synthetic.
    // Saying "check your email" there would strand people.
    if (!canReceiveEmail(value)) {
      toast({
        title: 'We cannot email a phone login',
        description: 'If you are staff, ask the shop owner to set you a new password. Owners, use Contact us.',
        variant: 'destructive',
      });
      return;
    }

    setIsResetting(true);
    const { error } = await sendPasswordReset(value);
    setIsResetting(false);

    if (error) {
      toast({ title: 'Could not send it', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Check your email',
      description: 'We sent a link to set a new password. It may take a minute.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (kind === 'unknown') {
      toast({
        title: 'Check that phone number or email',
        description: 'A Kenyan number like 0712 345 678, or an address with an @ in it.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const emailToUse = toAuthEmail(identifier);

    try {
      if (!isSignUp) {
        const { error } = await signIn(emailToUse, password);
        if (error) {
          toast({ title: 'Could not sign you in', description: 'Check your details and try again.', variant: 'destructive' });
        } else {
          toast({ title: 'Karibu tena' });
          navigate('/');
        }
      } else {
        if (!fullName.trim() || !shopName.trim()) {
          toast({ title: 'Something is missing', description: 'Fill in your name and your shop name.', variant: 'destructive' });
          setIsSubmitting(false);
          return;
        }
        const { error } = await signUp(emailToUse, password, fullName, shopName, { businessCategory });
        if (error) {
          toast({ title: 'Could not create your shop', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Your shop is ready', description: 'Karibu DukaKonnect.' });
          navigate('/');
        }
      }
    } catch {
      toast({ title: 'Something went wrong', description: 'Try again in a moment.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Logo size="md" wordmark={false} className="animate-pulse" />
      </div>
    );
  }

  const IdentityIcon = kind === 'phone' ? Phone : AtSign;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <Logo size="lg" wordmark={false} />
            <div>
              <p className="text-2xl font-bold tracking-tight">
                Duka<span className="text-primary">Konnect</span>
              </p>
              <p className="text-sm text-muted-foreground">biashara yako, siku kwa siku</p>
            </div>
          </div>

          {wasRemoved && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-center">
              <p className="text-sm font-semibold">You no longer have access to this shop</p>
              <p className="text-xs text-muted-foreground mt-1">
                The owner has removed your account. Talk to them if you think this is a mistake.
              </p>
            </div>
          )}

          <div className="sheet p-5 space-y-4">
            <div>
              <h1 className="text-lg font-semibold">
                {isSignUp ? 'Create your shop' : 'Sign in'}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSignUp
                  ? 'Takes a minute. You can add staff afterwards.'
                  : 'Use the phone number or email you signed up with.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-name">Your name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="auth-name"
                        className="pl-10"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Jane Wanjiku"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="auth-shop">Shop name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="auth-shop"
                        className="pl-10"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="e.g. Best Price Duka"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="auth-category">What kind of business?</Label>
                    <select
                      id="auth-category"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={businessCategory}
                      onChange={(e) => setBusinessCategory(e.target.value)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* One box for both. The icon and the hint below it are the only
                  things that change, and they change as you type. */}
              <div className="space-y-1.5">
                <Label htmlFor="auth-identity">Phone number or email</Label>
                <div className="relative">
                  <IdentityIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-identity"
                    type="text"
                    inputMode={kind === 'email' ? 'email' : 'text'}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    className="pl-10"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="0712 345 678 or you@example.com"
                    required
                  />
                </div>
                {kind === 'phone' && (
                  <p className="text-xs text-muted-foreground">
                    Signing {isSignUp ? 'up' : 'in'} as{' '}
                    <span className="num text-foreground">{prettyPhone(identifier)}</span>
                  </p>
                )}
                {kind === 'unknown' && identifier.trim().length > 3 && (
                  <p className="text-xs text-warning">
                    That does not look like a Kenyan number or an email yet.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    className="pl-10 pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-0 h-10 w-11 flex items-center justify-center text-muted-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Please wait...'
                  : isSignUp ? 'Create my shop' : 'Sign in'}
              </Button>

              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResetting}
                  className="w-full text-center text-sm text-primary hover:underline"
                >
                  {isResetting ? 'Sending...' : 'Forgot your password?'}
                </button>
              )}
            </form>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? 'Already have a shop?' : 'New to DukaKonnect?'}{' '}
            <button
              type="button"
              onClick={() => setMode(isSignUp ? 'signin' : 'signup')}
              className="text-primary font-medium hover:underline"
            >
              {isSignUp ? 'Sign in' : 'Create your shop'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
