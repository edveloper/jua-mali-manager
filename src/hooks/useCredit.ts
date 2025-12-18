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
      const { data: custData } = await (supabase.from('customers') as any).select('*').eq('shop_id', shop.id);
      const { data: creditData } = await (supabase.from('credit_sales') as any).select('*').eq('shop_id', shop.id).order('created_at', { ascending: false });

      if (custData) setCustomers(custData.map((c: any) => ({
        id: c.id, name: c.name, phone: c.phone, email: c.email, createdAt: c.created_at
      })));

      if (creditData) setCreditSales(creditData.map((cs: any) => {
        const totalAmount = Number(cs.amount || 0);
        const paid = Number(cs.amount_paid || 0); 
        return {
          id: cs.id,
          customerId: cs.customer_id,
          saleId: cs.sale_id,
          productName: cs.product_name, // Mapping from DB snake_case to UI camelCase
          quantity: cs.quantity,
          amount: totalAmount,
          balance: Math.max(0, totalAmount - paid),
          status: cs.status,
          createdAt: cs.created_at
        };
      }));
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
    if (!error) { toast({ title: "Customer added" }); fetchData(); }
    return data;
  };

  const addCreditSale = async (customerId: string, saleId: string, productName: string, quantity: number, amount: number) => {
    if (!shop?.id) return;
    
    // DEBUG: Check what is being sent
    console.log("Sending to Supabase:", { customerId, saleId, productName, amount });

    const { error } = await (supabase.from('credit_sales') as any).insert([{
      shop_id: shop.id,
      customer_id: customerId,
      sale_id: saleId,
      product_name: productName, // Ensure this matches DB column exactly
      quantity: quantity,
      amount: amount,
      amount_paid: 0,
      status: 'pending'
    }]);

    if (!error) {
      fetchData();
    } else {
      console.error("Supabase Credit Error:", error);
      toast({ 
        title: "Error saving credit", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const recordPayment = async (creditId: string, paymentAmount: number) => {
    const sale = creditSales.find(s => s.id === creditId);
    if (!sale) return;

    // Correct Math: total amount paid so far = (Total - Current Balance) + New Payment
    const alreadyPaid = sale.amount - sale.balance;
    const newTotalPaid = alreadyPaid + paymentAmount;
    const newStatus = newTotalPaid >= sale.amount ? 'paid' : 'partially_paid';

    const { error } = await (supabase.from('credit_sales') as any)
      .update({ 
        amount_paid: newTotalPaid,
        status: newStatus 
      })
      .eq('id', creditId);

    if (!error) {
      toast({ title: `Recorded payment of KSh ${paymentAmount}` });
      fetchData();
    } else {
      toast({ title: "Payment failed", description: error.message, variant: "destructive" });
    }
  };

  return {
    customers,
    creditSales,
    isLoading,
    addCustomer,
    addCreditSale,
    recordPayment,
    getTotalOwed: () =>
      creditSales.filter(cs => cs.status !== 'paid')
        .reduce((sum, cs) => sum + cs.balance, 0),
    getCustomerTotalOwed: (customerId: string) =>
      creditSales.filter(cs => cs.customerId === customerId && cs.status !== 'paid')
        .reduce((sum, cs) => sum + cs.balance, 0)
  };
};