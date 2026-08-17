import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Expense, ExpenseDraft } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  isLeapYear,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay
} from 'date-fns';

type ExpenseBasis = 'cash' | 'accrual';
type RecurrenceUnit = 'daily' | 'weekly' | 'monthly' | 'annual';
type ExpenseComputeOptions = {
  includeInventoryPurchases?: boolean;
};

const toDateOnly = (value: Date | string) => {
  if (typeof value === 'string') return value.split('T')[0];
  return value.toISOString().split('T')[0];
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  return startOfDay(new Date(`${value}T00:00:00`));
};

// Only restock-generated expenses are already represented as COGS. An expense
// typed in by hand is real money out even if it is named "Stock Purchase", and
// excluding it used to make that spend vanish from net profit entirely.
const isInventoryPurchaseExpense = (expense: Expense) => expense.source === 'restock';

const isWithinEffectiveWindow = (target: Date, expense: Expense) => {
  const effectiveStart = parseDate(expense.effectiveFrom) || parseDate(expense.date);
  const effectiveEnd = parseDate(expense.effectiveTo);

  if (!effectiveStart) return false;
  if (isBefore(target, effectiveStart)) return false;
  if (effectiveEnd && isAfter(target, effectiveEnd)) return false;
  return true;
};

const occursOnDay = (expense: Expense, day: Date) => {
  const baseDate = parseDate(expense.date);
  if (!baseDate) return false;

  if (expense.expenseType !== 'recurring' || expense.recurrenceUnit === 'none') {
    return isSameDay(baseDate, day);
  }

  if (!isWithinEffectiveWindow(day, expense)) return false;

  const diffDays = differenceInCalendarDays(day, baseDate);
  if (diffDays < 0) return false;

  switch (expense.recurrenceUnit) {
    case 'daily':
      return true;
    case 'weekly':
      return diffDays % 7 === 0;
    case 'monthly': {
      const targetDay = Math.min(baseDate.getDate(), endOfMonth(day).getDate());
      return day.getDate() === targetDay;
    }
    case 'annual': {
      const isLeapBase = baseDate.getMonth() === 1 && baseDate.getDate() === 29;
      const annualDay = isLeapBase && !isLeapYear(day) ? 28 : baseDate.getDate();
      return day.getMonth() === baseDate.getMonth() && day.getDate() === annualDay;
    }
    default:
      return false;
  }
};

const getAccruedDailyAmount = (expense: Expense, day: Date) => {
  if (expense.expenseType !== 'recurring') {
    return occursOnDay(expense, day) ? expense.amount : 0;
  }

  if (!isWithinEffectiveWindow(day, expense)) return 0;

  const recurrenceUnit = expense.recurrenceUnit as RecurrenceUnit | 'none';
  switch (recurrenceUnit) {
    case 'daily':
      return expense.amount;
    case 'weekly':
      return expense.amount / 7;
    case 'monthly': {
      const monthEnd = endOfMonth(day);
      const daysInMonth = monthEnd.getDate();
      return expense.amount / daysInMonth;
    }
    case 'annual': {
      const daysInYear = isLeapYear(day) ? 366 : 365;
      return expense.amount / daysInYear;
    }
    default:
      return occursOnDay(expense, day) ? expense.amount : 0;
  }
};

export const useExpenses = (currentPeriodSales: number = 0) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { shop } = useAuth();
  const { toast } = useToast();

  const fetchExpenses = async () => {
    if (!shop?.id) {
      setExpenses([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from('expenses')
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
        expenseType: e.expense_type || 'one_off',
        recurrenceUnit: e.recurrence_unit || 'none',
        allocationMode: e.allocation_mode || 'cash',
        source: e.source === 'restock' ? 'restock' : 'manual',
        paymentMethod: e.payment_method || null,
        effectiveFrom: e.effective_from || null,
        effectiveTo: e.effective_to || null,
        createdAt: e.created_at
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const addExpense = async (expense: ExpenseDraft) => {
    if (!shop?.id) return;
    const { error } = await supabase.from('expenses').insert([{
      shop_id: shop.id,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      expense_type: expense.expenseType,
      recurrence_unit: expense.recurrenceUnit,
      allocation_mode: expense.allocationMode,
      payment_method: expense.paymentMethod ?? null,
      effective_from: expense.effectiveFrom || null,
      effective_to: expense.effectiveTo || null,
    }]);

    if (!error) {
      toast({ title: "Expense recorded" });
      fetchExpenses();
    }
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from('expenses')
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
    const taxAmount = currentPeriodSales * 0.03;
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
      date: toDateOnly(new Date()),
      expenseType: 'one_off',
      recurrenceUnit: 'none',
      allocationMode: 'cash',
      effectiveFrom: null,
      effectiveTo: null,
    });
  };

  const getCashExpensesForDate = (date: Date | string, options: ExpenseComputeOptions = {}) => {
    const includeInventoryPurchases = options.includeInventoryPurchases ?? true;
    const day = startOfDay(new Date(typeof date === 'string' ? `${date}T00:00:00` : date));
    return expenses.reduce((sum, expense) => {
      if (!includeInventoryPurchases && isInventoryPurchaseExpense(expense)) return sum;
      return occursOnDay(expense, day) ? sum + expense.amount : sum;
    }, 0);
  };

  const getAccruedExpensesForDate = (date: Date | string, options: ExpenseComputeOptions = {}) => {
    const includeInventoryPurchases = options.includeInventoryPurchases ?? true;
    const day = startOfDay(new Date(typeof date === 'string' ? `${date}T00:00:00` : date));
    return expenses.reduce((sum, expense) => {
      if (!includeInventoryPurchases && isInventoryPurchaseExpense(expense)) return sum;
      // A recurring bill is spread across the days it covers, so rent day does
      // not read as a disaster and every other day as a windfall. Everything
      // else lands on the date it was paid. The user is no longer asked to
      // choose an accounting basis per entry -- the type decides it.
      if (expense.expenseType === 'recurring') {
        return sum + getAccruedDailyAmount(expense, day);
      }
      return occursOnDay(expense, day) ? sum + expense.amount : sum;
    }, 0);
  };

  /**
   * What physically left the drawer on a day. Cash basis on purpose -- spreading
   * a monthly bill across the month is the right way to read profit and the
   * wrong way to count a till. Expenses with no method recorded are counted as
   * cash, which understates the drawer rather than overstating it.
   */
  const getCashSpentForDate = (date: Date | string) => {
    const day = startOfDay(new Date(typeof date === 'string' ? `${date}T00:00:00` : date));
    return expenses.reduce((sum, expense) => {
      // Stock spend is NOT skipped here, unlike everywhere else. Excluding it is
      // right for profit -- its cost already lands via COGS when the goods sell.
      // A till holds notes: paying a supplier in cash empties the drawer whatever
      // the accounting says about it.
      if (expense.paymentMethod && expense.paymentMethod !== 'cash') return sum;
      return occursOnDay(expense, day) ? sum + expense.amount : sum;
    }, 0);
  };

  const getExpenseTotalForRange = (
    start: Date | string,
    end: Date | string,
    basis: ExpenseBasis = 'cash',
    options: ExpenseComputeOptions = {}
  ) => {
    const rangeStart = startOfDay(new Date(typeof start === 'string' ? `${start}T00:00:00` : start));
    const rangeEnd = endOfDay(new Date(typeof end === 'string' ? `${end}T00:00:00` : end));
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    if (basis === 'cash') {
      return days.reduce((sum, day) => sum + getCashExpensesForDate(day, options), 0);
    }

    return days.reduce((sum, day) => sum + getAccruedExpensesForDate(day, options), 0);
  };

  return { 
    expenses, 
    isLoading, 
    addExpense, 
    deleteExpense,
    quickAddTOT, 
    getTotalExpenses: () => expenses.reduce((sum, e) => sum + e.amount, 0),
    getCashExpensesForDate,
    getCashSpentForDate,
    getAccruedExpensesForDate,
    getExpenseTotalForRange,
  };
};
