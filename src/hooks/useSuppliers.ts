import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
}

export interface SupplierDebt {
  id: string;
  supplierId: string;
  description: string;
  amount: number;
  amountPaid: number;
  balance: number;
  status: string;
  incurredOn: string;
  dueDate: string | null;
}

export interface SupplierPayment {
  id: string;
  supplierDebtId: string;
  amount: number;
  paidAt: string;
  paymentMethod: string | null;
}

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [debts, setDebts] = useState<SupplierDebt[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const { shop, isOwner } = useAuth();
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    if (!shop?.id || !isOwner) {
      setSuppliers([]);
      setDebts([]);
      setPayments([]);
      return;
    }

    const [supplierRes, debtRes, paymentRes] = await Promise.all([
      supabase.from('suppliers').select('id, name, phone').eq('shop_id', shop.id).order('name'),
      supabase
        .from('supplier_debts')
        .select('id, supplier_id, description, amount, amount_paid, status, incurred_on, due_date')
        .eq('shop_id', shop.id)
        .order('incurred_on', { ascending: false }),
      supabase
        .from('supplier_payments')
        .select('id, supplier_debt_id, amount, paid_at, payment_method')
        .eq('shop_id', shop.id)
        .order('paid_at', { ascending: false }),
    ]);

    if (supplierRes.data) {
      setSuppliers(supplierRes.data.map((s) => ({ id: s.id, name: s.name, phone: s.phone })));
    }
    if (debtRes.data) {
      setDebts(
        debtRes.data.map((d) => {
          const amount = Number(d.amount || 0);
          const paid = Number(d.amount_paid || 0);
          return {
            id: d.id,
            supplierId: d.supplier_id,
            description: d.description,
            amount,
            amountPaid: paid,
            balance: Math.max(0, amount - paid),
            status: d.status,
            incurredOn: d.incurred_on,
            dueDate: d.due_date,
          };
        })
      );
    }
    if (paymentRes.data) {
      setPayments(
        paymentRes.data.map((p) => ({
          id: p.id,
          supplierDebtId: p.supplier_debt_id,
          amount: Number(p.amount || 0),
          paidAt: p.paid_at,
          paymentMethod: p.payment_method,
        }))
      );
    }
  }, [shop?.id, isOwner]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addSupplier = async (name: string, phone?: string) => {
    if (!shop?.id) return null;
    const { data, error } = await supabase
      .from('suppliers')
      .insert([{ shop_id: shop.id, name: name.trim(), phone: phone?.trim() || null }])
      .select()
      .single();

    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchAll();
    return data;
  };

  const addDebt = async (
    supplierId: string,
    description: string,
    amount: number,
    dueDate?: string
  ) => {
    if (!shop?.id) return false;
    const { error } = await supabase.from('supplier_debts').insert([
      {
        shop_id: shop.id,
        supplier_id: supplierId,
        description: description.trim(),
        amount,
        due_date: dueDate || null,
      },
    ]);

    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Recorded' });
    await fetchAll();
    return true;
  };

  const payDebt = async (
    debtId: string,
    amount: number,
    paymentMethod?: string,
    paymentReference?: string
  ) => {
    if (!shop?.id) return false;
    const { error } = await supabase.rpc('record_supplier_payment_atomic', {
      p_shop_id: shop.id,
      p_debt_id: debtId,
      p_amount: amount,
      p_payment_method: paymentMethod ?? null,
      p_payment_reference: paymentReference ?? null,
    });

    if (error) {
      toast({ title: 'Payment failed', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: `Paid ${amount.toLocaleString('en-KE')}` });
    await fetchAll();
    return true;
  };

  const totalOwed = debts
    .filter((d) => d.status !== 'paid')
    .reduce((sum, d) => sum + d.balance, 0);

  return {
    suppliers,
    debts,
    payments,
    totalOwed,
    addSupplier,
    addDebt,
    payDebt,
    supplierName: (id: string) => suppliers.find((s) => s.id === id)?.name ?? 'Supplier',
    debtsFor: (supplierId: string) =>
      debts.filter((d) => d.supplierId === supplierId && d.status !== 'paid'),
    owedTo: (supplierId: string) =>
      debts
        .filter((d) => d.supplierId === supplierId && d.status !== 'paid')
        .reduce((sum, d) => sum + d.balance, 0),
    paymentsFor: (debtId: string) =>
      payments.filter((p) => p.supplierDebtId === debtId),
    refresh: fetchAll,
  };
};
