import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Expense } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';

export const useExpenses = (currentMonthlySales: number = 0) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { shop } = useAuth();
  const { toast } = useToast();

  const fetchExpenses = async () => {
    if (!shop?.id) return;
    try {
      setIsLoading(true);
      const { data, error } = await (supabase.from('expenses') as any)
        .select('*')
        .eq('shop_id', shop.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenses(data.map((e: any) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        date: e.date,
        createdAt: e.created_at
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    if (!shop?.id) return;
    const { error } = await (supabase.from('expenses') as any).insert([{
      shop_id: shop.id,
      ...expense
    }]);

    if (!error) {
      toast({ title: "Expense recorded" });
      fetchExpenses();
    }
  };

  const deleteExpense = async (id: string) => {
    const { error } = await (supabase.from('expenses') as any)
      .delete()
      .eq('id', id);

    if (!error) {
      toast({ title: "Expense deleted" });
      setExpenses(prev => prev.filter(e => e.id !== id));
    } else {
      toast({ title: "Error", description: "Could not delete expense", variant: "destructive" });
    }
  };

  useEffect(() => { fetchExpenses(); }, [shop?.id]);

  const quickAddTOT = () => {
    const taxAmount = currentMonthlySales * 0.03;
    if (taxAmount <= 0) {
      toast({ 
        title: "No sales yet", 
        description: "TOT is calculated as 3% of your recorded sales.",
        variant: "destructive" 
      });
      return;
    }
    addExpense({
      category: 'Tax',
      description: `Turnover Tax (3%)`,
      amount: taxAmount,
      date: new Date().toISOString().split('T')[0]
    });
  };

  return { 
    expenses, 
    isLoading, 
    addExpense, 
    deleteExpense,
    quickAddTOT, 
    getTotalExpenses: () => expenses.reduce((sum, e) => sum + e.amount, 0)
  };
};