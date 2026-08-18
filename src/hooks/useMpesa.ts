import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ParsedMpesaEntry } from '@/lib/mpesa';

export interface MpesaEntry {
  id: string;
  code: string;
  amount: number;
  paidAt: string | null;
  counterparty: string | null;
  direction: 'in' | 'out';
  matchedSaleId: string | null;
  matchedCreditPaymentId: string | null;
}

export const useMpesa = () => {
  const [entries, setEntries] = useState<MpesaEntry[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const { shop, isOwner } = useAuth();
  const { toast } = useToast();

  const fetchEntries = useCallback(async () => {
    if (!shop?.id || !isOwner) {
      setEntries([]);
      return;
    }
    const { data, error } = await supabase
      .from('mpesa_entries')
      .select('id, code, amount, paid_at, counterparty, direction, matched_sale_id, matched_credit_payment_id')
      .eq('shop_id', shop.id)
      .order('paid_at', { ascending: false, nullsFirst: false })
      .limit(500);

    if (error) {
      console.error('M-Pesa entries error:', error);
      return;
    }
    setEntries(
      (data || []).map((row) => ({
        id: row.id,
        code: row.code,
        amount: Number(row.amount || 0),
        paidAt: row.paid_at,
        counterparty: row.counterparty,
        direction: row.direction === 'out' ? 'out' : 'in',
        matchedSaleId: row.matched_sale_id,
        matchedCreditPaymentId: row.matched_credit_payment_id,
      }))
    );
  }, [shop?.id, isOwner]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const importEntries = async (parsed: ParsedMpesaEntry[]) => {
    if (!shop?.id || parsed.length === 0) return null;

    setIsImporting(true);
    const { data, error } = await supabase.rpc('import_mpesa_entries_atomic', {
      p_shop_id: shop.id,
      p_entries: parsed,
    });
    setIsImporting(false);

    if (error) {
      toast({ title: 'Could not check them', description: error.message, variant: 'destructive' });
      return null;
    }

    await fetchEntries();
    return Array.isArray(data) ? data[0] : data;
  };

  const forget = async (entryId: string) => {
    const { error } = await supabase.from('mpesa_entries').delete().eq('id', entryId);
    if (error) {
      toast({ title: 'Could not remove it', variant: 'destructive' });
      return;
    }
    await fetchEntries();
  };

  return { entries, isImporting, importEntries, forget, refresh: fetchEntries };
};
