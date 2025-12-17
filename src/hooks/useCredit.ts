import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CreditSale, Customer } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';

export const useCredit = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { shop } = useAuth();
  const { toast } = useToast();

  const fetchData = async () => {
    if (!shop?.id) return;
    try {
      setIsLoading(true);

      // Fetch Customers
      const { data: custData } = await (supabase.from('customers') as any)
        .select('*').eq('shop_id', shop.id);

      // Fetch Credit Sales
      const { data: creditData } = await (supabase.from('credit_sales') as any)
        .select('*').eq('shop_id', shop.id);

      if (custData) setCustomers(custData.map((c: any) => ({
        id: c.id, name: c.name, phone: c.phone, email: c.email, createdAt: c.created_at
      })));

      if (creditData) setCreditSales(creditData.map((cs: any) => ({
        id: cs.id,
        customerId: cs.customer_id,
        saleId: cs.sale_id,
        productName: cs.product_name,
        quantity: cs.quantity,
        amount: Number(cs.amount),
        balance: Number(cs.amount), // Initially, balance equals amount
        status: cs.status,
        createdAt: cs.created_at
      })));

    } catch (error: any) {
      console.error("Credit fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [shop?.id]);

  const addCustomer = async (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    if (!shop?.id) return;
    const { data, error } = await (supabase.from('customers') as any).insert([{
      shop_id: shop.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email
    }]).select().single();

    if (!error) {
      toast({ title: "Customer added" });
      fetchData();
    }
    return data;
  };

  const addCreditSale = async (customerId: string, saleId: string, productName: string, quantity: number, amount: number) => {
    if (!shop?.id) return;
    const { error } = await (supabase.from('credit_sales') as any).insert([{
      shop_id: shop.id,
      customer_id: customerId,
      sale_id: saleId,
      product_name: productName,
      quantity: quantity,
      amount: amount,
      status: 'pending'
    }]);

    if (!error) {
      fetchData();
    } else {
      toast({ title: "Error saving credit", variant: "destructive" });
    }
  };

  const updateCreditStatus = async (creditId: string, status: CreditSale['status']) => {
    const { error } = await (supabase.from('credit_sales') as any)
      .update({ status })
      .eq('id', creditId);

    if (!error) {
      toast({ title: `Status updated to ${status}` });
      fetchData();
    }
  };

  return {
    customers,
    creditSales,
    isLoading,
    // Aligning the names to match what Index.tsx expects:
    addCustomer,
    addCreditSale,
    // Map updateCreditStatus to recordPayment
    recordPayment: (creditId: string) => updateCreditStatus(creditId, 'paid'),
    // Map getTotalDebt to getTotalOwed
    getTotalOwed: () =>
      creditSales.filter(cs => cs.status !== 'paid')
        .reduce((sum, cs) => sum + cs.amount, 0),
    // Map getCustomerTotalDebt to getCustomerTotalOwed
    getCustomerTotalOwed: (customerId: string) =>
      creditSales.filter(cs => cs.customerId === customerId && cs.status !== 'paid')
        .reduce((sum, cs) => sum + cs.amount, 0)
  };
};