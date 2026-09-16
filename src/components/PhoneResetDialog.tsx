import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { prettyPhone } from '@/lib/identity';

interface PhoneResetDialogProps {
  /** Whatever they typed into the sign-in box, phone in any shape. */
  phone: string;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Getting back in when the password is gone and there is no inbox.
 *
 * Staff have had a way back since August: the owner sets them a temporary
 * password. An owner has nobody above them, and their address is synthetic, so
 * until now the honest answer was "contact us". This is the replacement.
 *
 * Two steps rather than one screen, because asking for a code and a new password
 * together invites typing the new password before the code has arrived and then
 * losing it when the code turns out to be wrong.
 */
export function PhoneResetDialog({ phone, onClose, onDone }: PhoneResetDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'sending' | 'code'>('sending');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const request = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke('request-password-otp', {
      body: { phone },
    });
    setBusy(false);

    if (error) {
      toast({ title: 'Could not send the code', description: 'Check your connection and try again.', variant: 'destructive' });
      return;
    }
    setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('verify-password-otp', {
      body: { phone, code, newPassword },
    });
    setBusy(false);

    // A refused code comes back as a non-2xx, which shows up here as an error
    // rather than in data. Both paths have to be read or a wrong code looks
    // like a success.
    const message = (data as { error?: string } | null)?.error;
    if (error || message || !(data as { ok?: boolean } | null)?.ok) {
      toast({
        title: 'That did not work',
        description: message ?? 'That code is wrong or has expired. Ask for a new one.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Password changed', description: 'Sign in with your new one.' });
    onDone();
  };

  if (step === 'sending') {
    return (
      <Modal
        title="Send Me a Code"
        onClose={onClose}
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={request} disabled={busy}>
              {busy ? 'Sending...' : 'Send It'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed">
          We will text a six digit code to <span className="font-semibold num">{prettyPhone(phone)}</span>.
          It works for ten minutes.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Nobody from DukaKonnect will ever ask you for this code. If someone does,
          they are not us.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Enter Your Code"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            onClick={verify}
            disabled={busy || code.replace(/\D/g, '').length !== 6 || newPassword.length < 6}
          >
            {busy ? 'Checking...' : 'Change It'}
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="otp-code">The code we sent you</Label>
        <Input
          id="otp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="num text-center text-lg tracking-widest"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="otp-password">Your new password</Label>
        <Input
          id="otp-password"
          type="password"
          placeholder="At least 6 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>

      <button type="button" onClick={request} disabled={busy} className="text-sm text-primary underline">
        Send another code
      </button>

      {/*
        * A way out of the one dead end this flow has.
        *
        * A refused message still tells the caller a code is on its way, because
        * saying otherwise would reveal whether a number has an account. That is
        * the right call, but it leaves somebody whose network has blocked the
        * message waiting for something that is never going to arrive. This
        * gives them somewhere to go without saying anything the flow is meant
        * to keep quiet.
        */}
      <div className="sheet">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Nothing after a minute? Some networks block messages like these.
          {' '}
          <a
            href="https://wa.me/254702931920"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Message us on WhatsApp
          </a>
          {' '}and we will get you back in.
        </p>
      </div>
    </Modal>
  );
}
