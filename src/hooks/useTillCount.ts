import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface TillCount {
  countedFor: string;
  expectedCash: number;
  countedCash: number;
  difference: number;
}

export const useTillCount = () => {
  const [counts, setCounts] = useState<TillCount[]>([]);
  const { shop, isOwner } = useAuth();
  const { toast } = useToast();

  const fetchCounts = useCallback(async () => {
    if (!shop?.id || !isOwner) {
      setCounts([]);
      return;
    }
    const { data, error } = await supabase
      .from('till_counts')
      .select('counted_for, expected_cash, counted_cash, difference')
      .eq('shop_id', shop.id)
      .order('counted_for', { ascending: false })
      .limit(60);

    if (error) {
      console.error('Till counts error:', error);
      return;
    }
    setCounts(
      (data || []).map((row) => ({
        countedFor: row.counted_for,
        expectedCash: Number(row.expected_cash || 0),
        countedCash: Number(row.counted_cash || 0),
        difference: Number(row.difference || 0),
      }))
    );
  }, [shop?.id, isOwner]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const countFor = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    return counts.find((c) => c.countedFor === key) ?? null;
  };

  const saveCount = async (date: Date, countedCash: number, expectedCash: number) => {
    if (!shop?.id) return false;

    // Upsert on (shop_id, counted_for): recounting corrects the day rather than
    // adding a second opinion about it.
    const { error } = await supabase
      .from('till_counts')
      .upsert(
        {
          shop_id: shop.id,
          counted_for: format(date, 'yyyy-MM-dd'),
          expected_cash: expectedCash,
          counted_cash: countedCash,
          difference: countedCash - expectedCash,
          counted_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        },
        { onConflict: 'shop_id,counted_for' }
      );

    if (error) {
      toast({ title: 'Could not save the count', description: error.message, variant: 'destructive' });
      return false;
    }

    const diff = countedCash - expectedCash;
    toast({
      title: diff === 0 ? 'Till matches' : diff > 0 ? 'Saved — more than expected' : 'Saved — till is short',
    });
    await fetchCounts();
    return true;
  };

  return { counts, countFor, saveCount };
};
