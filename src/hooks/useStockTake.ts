import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface StockTakeSummary {
  id: string;
  countedAt: string;
  itemsCounted: number;
  itemsShort: number;
  itemsOver: number;
  shrinkageValue: number;
}

export const useStockTake = () => {
  const [takes, setTakes] = useState<StockTakeSummary[]>([]);
  const { shop, isOwner } = useAuth();
  const { toast } = useToast();

  const fetchTakes = useCallback(async () => {
    if (!shop?.id || !isOwner) {
      setTakes([]);
      return;
    }
    const { data, error } = await supabase
      .from('stock_takes')
      .select('id, counted_at, items_counted, items_short, items_over, shrinkage_value')
      .eq('shop_id', shop.id)
      .order('counted_at', { ascending: false })
      .limit(12);

    if (error) {
      console.error('Stock takes error:', error);
      return;
    }
    setTakes(
      (data || []).map((row) => ({
        id: row.id,
        countedAt: row.counted_at,
        itemsCounted: row.items_counted,
        itemsShort: row.items_short,
        itemsOver: row.items_over,
        shrinkageValue: Number(row.shrinkage_value || 0),
      }))
    );
  }, [shop?.id, isOwner]);

  useEffect(() => { fetchTakes(); }, [fetchTakes]);

  const recordCount = async (
    lines: { product_id: string; counted_qty: number }[],
    notes?: string
  ) => {
    if (!shop?.id || lines.length === 0) return null;

    const { data, error } = await supabase.rpc('record_stock_take_atomic', {
      p_shop_id: shop.id,
      p_lines: lines,
      p_notes: notes ?? null,
    });

    if (error) {
      toast({ title: 'Could not save the count', description: error.message, variant: 'destructive' });
      return null;
    }

    const result = Array.isArray(data) ? data[0] : data;
    await fetchTakes();
    return result ?? null;
  };

  return { takes, recordCount, refreshTakes: fetchTakes };
};
