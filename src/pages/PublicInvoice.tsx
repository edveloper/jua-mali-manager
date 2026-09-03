import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceDocument } from '@/components/InvoiceDocument';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { InvoiceDocument as Doc, InvoiceLine, InvoiceStatus } from '@/types/invoice';

/**
 * What the customer opens.
 *
 * The only unauthenticated page in the app. It never queries a table: it calls
 * one function with the token from the URL, which returns a single assembled
 * invoice or nothing at all. There is no id to change and no list to walk, so a
 * wrong token is simply a dead end.
 *
 * No sign-in, no account, no app. A distributor should be able to read what they
 * owe from a WhatsApp message on a borrowed phone.
 */
export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) {
        setState('missing');
        return;
      }

      const { data, error } = await supabase.rpc('get_public_invoice', { p_token: token });
      if (cancelled) return;

      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setState('missing');
        return;
      }

      setDoc({
        number: row.number,
        issuedOn: row.issued_on,
        dueOn: row.due_on,
        deliveredOn: row.delivered_on,
        notes: row.notes,
        issuer: (row.issuer ?? {}) as unknown as Doc['issuer'],
        billTo: (row.bill_to ?? {}) as unknown as Doc['billTo'],
        lines: (Array.isArray(row.lines) ? row.lines : []) as unknown as InvoiceLine[],
        subtotal: Number(row.subtotal || 0),
        vatAmount: Number(row.vat_amount || 0),
        total: Number(row.total || 0),
        // The function already folds the counter payment into amount_paid.
        paidAtSale: 0,
        amountPaid: Number(row.amount_paid || 0),
        status: row.status as InvoiceStatus,
      });
      setState('ready');
    };

    load();
    return () => { cancelled = true; };
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Logo size="md" wordmark={false} className="animate-pulse" />
      </div>
    );
  }

  if (state === 'missing' || !doc) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="sheet max-w-sm text-center py-8">
          <p className="font-semibold">This invoice is not here</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            The link may be incomplete, or it may have been cancelled. Ask whoever sent
            it to you for a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-3 py-6 sm:py-10 space-y-4">
        <div className="rounded-lg overflow-hidden shadow-sm border border-border/60">
          <InvoiceDocument doc={doc} />
        </div>

        {/* Hidden on paper: the invoice should not print its own toolbar. */}
        <div className="no-print flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Sent with DukaKonnect
          </p>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Save as PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
