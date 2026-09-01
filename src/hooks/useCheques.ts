import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type ChequeStatus = 'held' | 'cleared' | 'bounced';

export interface Cheque {
  id: string;
  creditSaleId: string;
  customerId?: string | null;
  chequeNumber: string;
  bank?: string | null;
  amount: number;
  receivedOn: string;
  expectedClearOn?: string | null;
  status: ChequeStatus;
  clearedOn?: string | null;
  bouncedReason?: string | null;
}

/**
 * Cheques a shop is holding.
 *
 * A held cheque reduces nothing. The debt stays exactly as it was until the
 * money actually lands, which is the only honest position: a cheque that has not
 * cleared is a promise, and a shop that writes the debt off on the strength of
 * one has no record left to chase when it bounces.
 */
export const useCheques = () => {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { shop } = useAuth();
  const { toast } = useToast();

  const fetchCheques = useCallback(async () => {
    if (!shop?.id) {
      setCheques([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cheques')
        .select('*')
        .eq('shop_id', shop.id)
        .order('received_on', { ascending: false });

      if (error) throw error;

      setCheques(
        (data || []).map((row: any) => ({
          id: row.id,
          creditSaleId: row.credit_sale_id,
          customerId: row.customer_id,
          chequeNumber: row.cheque_number,
          bank: row.bank,
          amount: Number(row.amount || 0),
          receivedOn: row.received_on,
          expectedClearOn: row.expected_clear_on,
          status: row.status as ChequeStatus,
          clearedOn: row.cleared_on,
          bouncedReason: row.bounced_reason,
        }))
      );
    } catch (error: any) {
      console.error('Cheques error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [shop?.id]);

  useEffect(() => {
    fetchCheques();
  }, [fetchCheques]);

  const recordCheque = async (
    creditSaleId: string,
    amount: number,
    chequeNumber: string,
    options?: { bank?: string; receivedOn?: string; expectedClearOn?: string }
  ) => {
    if (!shop?.id) return false;

    const { error } = await supabase.rpc('record_cheque_atomic', {
      p_shop_id: shop.id,
      p_credit_sale_id: creditSaleId,
      p_amount: amount,
      p_cheque_number: chequeNumber,
      p_bank: options?.bank ?? null,
      p_received_on: options?.receivedOn ?? null,
      p_expected_clear_on: options?.expectedClearOn ?? null,
    });

    if (error) {
      toast({ title: 'Could not record the cheque', description: error.message, variant: 'destructive' });
      return false;
    }

    await fetchCheques();
    toast({
      title: 'Cheque held',
      description: 'The debt stays open until it clears. Mark it cleared when the money lands.',
    });
    return true;
  };

  const clearCheque = async (chequeId: string, clearedOn?: string) => {
    if (!shop?.id) return false;

    const { error } = await supabase.rpc('clear_cheque_atomic', {
      p_shop_id: shop.id,
      p_cheque_id: chequeId,
      p_cleared_on: clearedOn ?? null,
    });

    if (error) {
      toast({ title: 'Could not clear it', description: error.message, variant: 'destructive' });
      return false;
    }

    await fetchCheques();
    toast({ title: 'Cheque cleared', description: 'It now counts as a payment against the debt.' });
    return true;
  };

  const bounceCheque = async (chequeId: string, reason?: string) => {
    if (!shop?.id) return false;

    const { error } = await supabase.rpc('bounce_cheque_atomic', {
      p_shop_id: shop.id,
      p_cheque_id: chequeId,
      p_reason: reason ?? null,
    });

    if (error) {
      toast({ title: 'Could not mark it bounced', description: error.message, variant: 'destructive' });
      return false;
    }

    await fetchCheques();
    toast({
      title: 'Marked bounced',
      description: 'Nothing changes on the books. The debt was never reduced, so it still stands.',
    });
    return true;
  };

  const held = cheques.filter((c) => c.status === 'held');

  return {
    cheques,
    held,
    isLoading,
    recordCheque,
    clearCheque,
    bounceCheque,
    refresh: fetchCheques,
    /** Promises already sitting against a debt, so it cannot be covered twice. */
    heldAgainst: (creditSaleId: string) =>
      held
        .filter((c) => c.creditSaleId === creditSaleId)
        .reduce((sum, c) => sum + c.amount, 0),
  };
};
