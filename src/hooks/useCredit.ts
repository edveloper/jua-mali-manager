import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CreditPayment, CreditSale, Customer } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';

export const useCredit = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { shop } = useAuth();
  const { toast } = useToast();

  const fetchData = async () => {
    if (!shop?.id) {
      setCustomers([]);
      setCreditSales([]);
      setPayments([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data: custData } = await supabase.from('customers').select('*').eq('shop_id', shop.id);
      const { data: creditData } = await supabase.from('credit_sales').select('*').eq('shop_id', shop.id).order('created_at', { ascending: false });
      const { data: paymentData } = await supabase.from('credit_payments').select('*').eq('shop_id', shop.id).order('paid_at', { ascending: false });

      setPayments((paymentData || []).map((p: any) => ({
        id: p.id,
        creditSaleId: p.credit_sale_id,
        customerId: p.customer_id,
        amount: Number(p.amount || 0),
        paidAt: p.paid_at,
        notes: p.notes || '',
        createdAt: p.created_at,
      })));

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
    const { data, error } = await supabase.from('customers').insert([{
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

    const { error } = await supabase.from('credit_sales').insert([{
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

  // Goes through the RPC so the balance is read and written under a row lock,
  // and so every payment leaves a dated record reports can use.
  const recordPayment = async (creditId: string, paymentAmount: number) => {
    if (!shop?.id) return;

    const { error } = await supabase.rpc('record_credit_payment_atomic', {
      p_shop_id: shop.id,
      p_credit_sale_id: creditId,
      p_amount: paymentAmount,
    });

    if (error) {
      toast({ title: "Payment failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: `Recorded payment of KSh ${paymentAmount.toLocaleString()}` });
    fetchData();
  };

  const paymentsBetween = (start: Date | string, end: Date | string) => {
    const from = new Date(typeof start === 'string' ? `${start}T00:00:00` : start).getTime();
    const to = new Date(typeof end === 'string' ? `${end}T23:59:59` : end).getTime();
    return payments.filter((p) => {
      const at = new Date(p.paidAt).getTime();
      return at >= from && at <= to;
    });
  };

  return {
    customers,
    creditSales,
    payments,
    isLoading,
    addCustomer,
    addCreditSale,
    recordPayment,
    paymentsBetween,
    getPaymentsTotalForRange: (start: Date | string, end: Date | string) =>
      paymentsBetween(start, end).reduce((sum, p) => sum + p.amount, 0),
    getPaymentsForCredit: (creditSaleId: string) =>
      payments
        .filter((p) => p.creditSaleId === creditSaleId)
        .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()),
    getTotalOwed: () =>
      creditSales.filter(cs => cs.status !== 'paid')
        .reduce((sum, cs) => sum + cs.balance, 0),
    getCustomerTotalOwed: (customerId: string) =>
      creditSales.filter(cs => cs.customerId === customerId && cs.status !== 'paid')
        .reduce((sum, cs) => sum + cs.balance, 0)
  };
};
