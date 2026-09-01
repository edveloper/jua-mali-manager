import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Invoice, InvoiceStatus } from '@/types/invoice';

/**
 * Status is worked out here rather than stored, exactly as the database does it
 * for the public link. Two places compute it, from the same two facts, so they
 * cannot drift; storing it would create a third copy that can.
 */
const statusOf = (total: number, paid: number, dueOn: string, voidedAt?: string | null): InvoiceStatus => {
  if (voidedAt) return 'cancelled';
  if (paid >= total) return 'paid';
  // Compared as calendar days, not instants: an invoice due today is not late.
  if (new Date(`${dueOn}T23:59:59`) < new Date()) return 'overdue';
  if (paid > 0) return 'part_paid';
  return 'sent';
};

export const useInvoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { shop, isOwner } = useAuth();
  const { toast } = useToast();

  const fetchInvoices = useCallback(async () => {
    if (!shop?.id || !isOwner) {
      setInvoices([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('shop_id', shop.id)
        .order('issued_on', { ascending: false })
        .order('seq', { ascending: false });

      if (error) throw error;

      // The balance lives on the credit sale and is read separately rather than
      // embedded. An embedded select here sends PostgREST's generated types into
      // an infinite instantiation, and the snapshot on the invoice deliberately
      // freezes what was printed rather than what is still owed.
      const creditIds = (data || [])
        .map((row: any) => row.credit_sale_id)
        .filter(Boolean) as string[];

      const paidByCredit = new Map<string, number>();
      if (creditIds.length > 0) {
        const { data: credits } = await supabase
          .from('credit_sales')
          .select('id, amount_paid')
          .in('id', creditIds);
        for (const c of credits || []) {
          paidByCredit.set(c.id, Number(c.amount_paid || 0));
        }
      }

      setInvoices(
        (data || []).map((row: any) => {
          const total = Number(row.total || 0);
          // No credit record means it was settled at the till.
          const paid = row.credit_sale_id
            ? (paidByCredit.get(row.credit_sale_id) ?? 0)
            : total;

          return {
            id: row.id,
            receiptId: row.receipt_id,
            creditSaleId: row.credit_sale_id,
            customerId: row.customer_id,
            token: row.token,
            termsDays: row.terms_days,
            number: row.number,
            issuedOn: row.issued_on,
            dueOn: row.due_on,
            deliveredOn: row.delivered_on,
            notes: row.notes,
            issuer: row.issuer || {},
            billTo: row.bill_to || {},
            lines: Array.isArray(row.lines) ? row.lines : [],
            subtotal: Number(row.subtotal || 0),
            vatAmount: Number(row.vat_amount || 0),
            total,
            amountPaid: paid,
            voidedAt: row.voided_at,
            status: statusOf(total, paid, row.due_on, row.voided_at),
          };
        })
      );
    } catch (error: any) {
      console.error('Invoices error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [shop?.id, isOwner]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const raiseInvoice = async (
    receiptId: string,
    options?: { termsDays?: number; deliveredOn?: string; notes?: string }
  ) => {
    if (!shop?.id) return null;

    const { data, error } = await supabase.rpc('raise_invoice_atomic', {
      p_shop_id: shop.id,
      p_receipt_id: receiptId,
      p_terms_days: options?.termsDays ?? null,
      p_delivered_on: options?.deliveredOn ?? null,
      p_notes: options?.notes ?? null,
    });

    if (error) {
      toast({ title: 'Could not raise the invoice', description: error.message, variant: 'destructive' });
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    await fetchInvoices();
    toast({ title: `${row?.out_number} ready`, description: 'Copy the link and send it over.' });
    return row;
  };

  const voidInvoice = async (invoiceId: string, reason?: string) => {
    if (!shop?.id) return false;

    const { error } = await supabase.rpc('void_invoice_atomic', {
      p_shop_id: shop.id,
      p_invoice_id: invoiceId,
      p_reason: reason ?? null,
    });

    if (error) {
      toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' });
      return false;
    }

    await fetchInvoices();
    toast({
      title: 'Invoice cancelled',
      description: 'The number stays used. A gap in the run is normal, two documents sharing a number is not.',
    });
    return true;
  };

  /** Absolute, because it is going into somebody else's phone. */
  const linkFor = (invoice: Invoice) =>
    `${window.location.origin}/i/${invoice.token}`;

  return {
    invoices,
    isLoading,
    raiseInvoice,
    voidInvoice,
    linkFor,
    refresh: fetchInvoices,
    invoiceForReceipt: (receiptId: string) =>
      invoices.find((i) => i.receiptId === receiptId && !i.voidedAt) ?? null,
  };
};
