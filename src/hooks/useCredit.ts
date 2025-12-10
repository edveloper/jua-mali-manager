import { useState, useEffect, useCallback } from 'react';
import { Customer, CreditSale, CreditPayment } from '@/types/inventory';

const CUSTOMERS_KEY = 'duka_customers';
const CREDIT_SALES_KEY = 'duka_credit_sales';
const CREDIT_PAYMENTS_KEY = 'duka_credit_payments';

export function useCredit() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = () => {
      try {
        const storedCustomers = localStorage.getItem(CUSTOMERS_KEY);
        const storedCreditSales = localStorage.getItem(CREDIT_SALES_KEY);
        const storedPayments = localStorage.getItem(CREDIT_PAYMENTS_KEY);

        if (storedCustomers) {
          const parsed = JSON.parse(storedCustomers);
          setCustomers(parsed.map((c: Customer) => ({
            ...c,
            createdAt: new Date(c.createdAt),
          })));
        }

        if (storedCreditSales) {
          const parsed = JSON.parse(storedCreditSales);
          setCreditSales(parsed.map((cs: CreditSale) => ({
            ...cs,
            createdAt: new Date(cs.createdAt),
            dueDate: cs.dueDate ? new Date(cs.dueDate) : undefined,
          })));
        }

        if (storedPayments) {
          const parsed = JSON.parse(storedPayments);
          setCreditPayments(parsed.map((p: CreditPayment) => ({
            ...p,
            createdAt: new Date(p.createdAt),
          })));
        }
      } catch (error) {
        console.error('Error loading credit data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const saveCustomers = useCallback((newCustomers: Customer[]) => {
    setCustomers(newCustomers);
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(newCustomers));
  }, []);

  const saveCreditSales = useCallback((newCreditSales: CreditSale[]) => {
    setCreditSales(newCreditSales);
    localStorage.setItem(CREDIT_SALES_KEY, JSON.stringify(newCreditSales));
  }, []);

  const savePayments = useCallback((newPayments: CreditPayment[]) => {
    setCreditPayments(newPayments);
    localStorage.setItem(CREDIT_PAYMENTS_KEY, JSON.stringify(newPayments));
  }, []);

  const addCustomer = useCallback((name: string, phone?: string) => {
    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      name,
      phone,
      createdAt: new Date(),
    };
    saveCustomers([...customers, newCustomer]);
    return newCustomer;
  }, [customers, saveCustomers]);

  const addCreditSale = useCallback((
    customerId: string,
    saleId: string,
    productName: string,
    quantity: number,
    totalAmount: number
  ) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return null;

    const creditSale: CreditSale = {
      id: crypto.randomUUID(),
      customerId,
      customerName: customer.name,
      saleId,
      productName,
      quantity,
      totalAmount,
      amountPaid: 0,
      balance: totalAmount,
      status: 'pending',
      createdAt: new Date(),
    };

    saveCreditSales([...creditSales, creditSale]);
    return creditSale;
  }, [customers, creditSales, saveCreditSales]);

  const recordPayment = useCallback((creditSaleId: string, amount: number) => {
    const creditSale = creditSales.find(cs => cs.id === creditSaleId);
    if (!creditSale || amount <= 0) return null;

    const payment: CreditPayment = {
      id: crypto.randomUUID(),
      creditSaleId,
      customerId: creditSale.customerId,
      amount: Math.min(amount, creditSale.balance),
      createdAt: new Date(),
    };

    savePayments([...creditPayments, payment]);

    const newAmountPaid = creditSale.amountPaid + payment.amount;
    const newBalance = creditSale.totalAmount - newAmountPaid;
    const newStatus = newBalance <= 0 ? 'paid' : newBalance < creditSale.totalAmount ? 'partial' : 'pending';

    const updatedCreditSales = creditSales.map(cs =>
      cs.id === creditSaleId
        ? { ...cs, amountPaid: newAmountPaid, balance: Math.max(0, newBalance), status: newStatus as CreditSale['status'] }
        : cs
    );

    saveCreditSales(updatedCreditSales);
    return payment;
  }, [creditSales, creditPayments, saveCreditSales, savePayments]);

  const getCustomerCredits = useCallback((customerId: string) => {
    return creditSales.filter(cs => cs.customerId === customerId && cs.status !== 'paid');
  }, [creditSales]);

  const getTotalOwed = useCallback(() => {
    return creditSales
      .filter(cs => cs.status !== 'paid')
      .reduce((sum, cs) => sum + cs.balance, 0);
  }, [creditSales]);

  const getCustomerTotalOwed = useCallback((customerId: string) => {
    return creditSales
      .filter(cs => cs.customerId === customerId && cs.status !== 'paid')
      .reduce((sum, cs) => sum + cs.balance, 0);
  }, [creditSales]);

  return {
    customers,
    creditSales,
    creditPayments,
    isLoading,
    addCustomer,
    addCreditSale,
    recordPayment,
    getCustomerCredits,
    getTotalOwed,
    getCustomerTotalOwed,
  };
}
