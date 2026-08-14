import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Phone, Lock, User, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';
import { toAuthEmail } from '@/lib/identity';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthMode = 'signin' | 'signup';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [identifier, setIdentifier] = useState(''); 
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('retail');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signIn, signUp, user, shopMember, loading: isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wasRemoved = searchParams.get('removed') === '1';

  // Waits for the membership, not just the user. During sign-up the auth user
  // exists for a moment before create_shop_with_owner has run; redirecting on
  // `user` alone sent people to a shopless dashboard, which then bounced them
  // straight back here with "You no longer have access to this shop".
  useEffect(() => {
    if (user && shopMember && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [user, shopMember, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const emailToUse = toAuthEmail(identifier);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(emailToUse, password);
        if (error) {
          toast({ title: 'Sign In Failed', description: 'Check your details and try again.', variant: 'destructive' });
        } else {
          toast({ title: 'Karibu tena' });
          navigate('/');
        }
      } else {
        if (!fullName.trim() || !shopName.trim()) {
          toast({ title: 'Missing Info', description: 'Fill in all fields.', variant: 'destructive' });
          setIsSubmitting(false);
          return;
        }
        const { error } = await signUp(emailToUse, password, fullName, shopName, {
          businessCategory,
        });
        if (error) {
          toast({ title: 'Sign Up Failed', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Your shop is ready', description: 'Karibu Tarihi.' });
          navigate('/');
        }
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center animate-pulse">Loading...</div>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-6 flex justify-center">
        <Logo size="md" />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">{mode === 'signin' ? 'Welcome Back' : 'Create Your Shop'}</h2>
            <p className="text-muted-foreground text-sm">Biashara yako, siku kwa siku</p>
          </div>

          {wasRemoved && (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 text-center">
              <p className="text-sm font-semibold">You no longer have access to this shop</p>
              <p className="text-xs text-muted-foreground mt-1">
                The owner has removed your account. Talk to them if you think this is a mistake.
              </p>
            </div>
          )}

          <Tabs defaultValue="phone" onValueChange={(v) => {
            setAuthMethod(v as 'phone' | 'email');
            setIdentifier(''); // Clear when switching
          }}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="phone">Mobile Number</TabsTrigger>
              <TabsTrigger value="email">Email Address</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div className="space-y-2">
                    <Label>Owner Full Name</Label>
                    <div className="relative">
                       <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                       <Input className="pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Jane Doe" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Duka Name</Label>
                    <div className="relative">
                       <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                       <Input className="pl-10" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Best Price Duka" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Business Category</Label>
                    <select
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
                </>
              )}

              <div className="space-y-2">
                <Label>{authMethod === 'phone' ? 'Phone Number' : 'Email Address'}</Label>
                <div className="relative">
                  {authMethod === 'phone' ? (
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  )}
                  <Input 
                    type={authMethod === 'phone' ? 'tel' : 'email'}
                    className="pl-10"
                    value={identifier} 
                    onChange={(e) => setIdentifier(e.target.value)} 
                    placeholder={authMethod === 'phone' ? '0712 345 678' : 'you@example.com'}
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="password" 
                    className="pl-10"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Min 6 characters" 
                    minLength={6} 
                    required 
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create My Duka'}
              </Button>
            </form>
          </Tabs>

          <div className="text-center">
            <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="text-sm text-primary hover:underline">
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
