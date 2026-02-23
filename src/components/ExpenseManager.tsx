import { useMemo, useState } from 'react';
import { Plus, Receipt, Landmark, History, Trash2, Filter, CalendarRange, WalletCards } from 'lucide-react';
import { Expense } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { format, startOfMonth, subDays } from 'date-fns';

interface ExpenseManagerProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onQuickAddTOT: () => void;
  monthlySales: number;
  offeringMode?: 'products' | 'services' | 'mixed' | string;
  businessCategory?: string;
  singleOffering?: boolean;
}

type RangeType = '7d' | '30d' | 'month' | 'all';

const categoryByBusiness = (businessCategory: string, offeringMode: string): string[] => {
  const common = ['Tax', 'Rent', 'Utilities', 'Transport', 'Salary', 'Licenses', 'Other'];
  if (offeringMode === 'services') {
    return ['Wages', 'Consumables', 'Commission', 'Maintenance', 'Marketing', ...common];
  }
  if (businessCategory === 'transport') {
    return ['Fuel', 'Route Fees', 'Vehicle Maintenance', 'Parking', 'Insurance', ...common];
  }
  if (businessCategory === 'computer_center') {
    return ['Internet', 'Printing Supplies', 'Power Backup', 'Repairs', 'Software', ...common];
  }
  if (businessCategory === 'barbershop_salon') {
    return ['Beauty Supplies', 'Commission', 'Wages', 'Sanitation', 'Equipment Service', ...common];
  }
  return ['Stock Purchase', 'Wages', 'Packaging', 'Marketing', ...common];
};

const formatCurrency = (amt: number) => `KSh ${amt.toLocaleString()}`;
const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export function ExpenseManager({
  expenses,
  onAddExpense,
  onDeleteExpense,
  onQuickAddTOT,
  monthlySales,
  offeringMode = 'products',
  businessCategory = 'retail',
  singleOffering = false
}: ExpenseManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Other');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [range, setRange] = useState<RangeType>('month');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const categories = useMemo(
    () => categoryByBusiness(businessCategory, offeringMode),
    [businessCategory, offeringMode]
  );

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const startMonth = startOfMonth(now);
    const start7 = subDays(now, 7);
    const start30 = subDays(now, 30);

    return expenses.filter((e) => {
      const d = new Date(e.date);
      const inRange =
        range === 'all' ||
        (range === 'month' && d >= startMonth) ||
        (range === '7d' && d >= start7) ||
        (range === '30d' && d >= start30);
      const byCategory = categoryFilter === 'all' || e.category === categoryFilter;
      const q = search.trim().toLowerCase();
      const bySearch = !q || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
      return inRange && byCategory && bySearch;
    });
  }, [expenses, range, categoryFilter, search]);

  const totals = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const tax = filteredExpenses.filter((e) => e.category.toLowerCase().includes('tax')).reduce((sum, e) => sum + e.amount, 0);
    const byCategory = new Map<string, number>();
    for (const e of filteredExpenses) {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
    }
    const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      total,
      tax,
      count: filteredExpenses.length,
      topCategory: topCategory ? `${topCategory[0]} (${formatCurrency(topCategory[1])})` : 'N/A',
      netAfterTax: monthlySales - total,
    };
  }, [filteredExpenses, monthlySales]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    await onAddExpense({
      category: category || 'Other',
      description,
      amount: Number(amount),
      date,
    });
    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setShowAddForm(false);
  };

  const quickTemplates = useMemo(() => {
    if (offeringMode === 'services') {
      return [
        { description: 'Daily consumables', category: 'Consumables' },
        { description: 'Staff wages / commission', category: 'Wages' },
      ];
    }
    if (businessCategory === 'transport') {
      return [
        { description: 'Fuel top-up', category: 'Fuel' },
        { description: 'Vehicle maintenance', category: 'Vehicle Maintenance' },
      ];
    }
    return [
      { description: 'Stock top-up', category: 'Stock Purchase' },
      { description: 'Shop utilities', category: 'Utilities' },
    ];
  }, [offeringMode, businessCategory]);

  const handleExportCsv = () => {
    const headers = ['date', 'category', 'description', 'amount'];
    const lines = filteredExpenses.map((e) => [
      csvEscape(e.date),
      csvEscape(e.category),
      csvEscape(e.description),
      csvEscape(e.amount),
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `expenses-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-24 flex flex-col gap-1 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all"
          onClick={onQuickAddTOT}
        >
          <Landmark className="h-6 w-6 text-primary mb-1" />
          <span className="text-sm font-bold text-primary">Pay TOT (3%)</span>
          <span className="text-[10px] text-muted-foreground">Est: {formatCurrency(monthlySales * 0.03)}</span>
        </Button>

        <Button
          variant="outline"
          className="h-24 flex flex-col gap-1 border-dashed border-muted-foreground/30 hover:bg-muted/50 transition-all"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-6 w-6 text-muted-foreground mb-1" />
          <span className="text-sm font-bold">Add Expense</span>
          <span className="text-[10px] text-muted-foreground">{singleOffering ? 'Single-offering cost focus' : 'Detailed business expense'}</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <p className="metric-label">Filtered Total</p>
          <p className="text-lg font-bold text-destructive">-{formatCurrency(totals.total)}</p>
        </div>
        <div className="stat-card">
          <p className="metric-label">Tax Spend</p>
          <p className="text-lg font-bold">{formatCurrency(totals.tax)}</p>
        </div>
        <div className="stat-card">
          <p className="metric-label">Top Category</p>
          <p className="text-xs font-semibold">{totals.topCategory}</p>
        </div>
        <div className="stat-card">
          <p className="metric-label">Net vs Sales</p>
          <p className={`text-sm font-bold ${totals.netAfterTax < 0 ? 'text-destructive' : 'text-success'}`}>
            {formatCurrency(totals.netAfterTax)}
          </p>
        </div>
      </div>

      {showAddForm && (
        <Card className="p-4 border-2 border-primary animate-in zoom-in-95">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm">New Expense Entry</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {quickTemplates.map((t) => (
                <Button
                  key={`${t.description}-${t.category}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setDescription(t.description);
                    setCategory(t.category);
                  }}
                >
                  <WalletCards className="h-3.5 w-3.5 mr-2" />
                  {t.description}
                </Button>
              ))}
            </div>

            <Input
              placeholder="What did you pay for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Input
                type="number"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full">Save Expense</Button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1 px-1">
          <Filter className="h-4 w-4" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Filters</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant={range === '7d' ? 'secondary' : 'outline'} size="sm" onClick={() => setRange('7d')}>7 Days</Button>
          <Button variant={range === '30d' ? 'secondary' : 'outline'} size="sm" onClick={() => setRange('30d')}>30 Days</Button>
          <Button variant={range === 'month' ? 'secondary' : 'outline'} size="sm" onClick={() => setRange('month')}>This Month</Button>
          <Button variant={range === 'all' ? 'secondary' : 'outline'} size="sm" onClick={() => setRange('all')}>All</Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Input
            placeholder="Search expense..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {[...new Set(expenses.map((e) => e.category))].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="flex items-center justify-center rounded-md border border-input px-3 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5 mr-1.5" />
            {totals.count} entries
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filteredExpenses.length === 0}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1 px-1">
          <History className="h-4 w-4" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Spending History</h3>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-3xl text-muted-foreground/40">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No costs for this filter</p>
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <div key={expense.id} className="group relative flex items-center justify-between p-4 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-muted rounded-xl text-muted-foreground">
                  {expense.category.toLowerCase().includes('tax') ? <Landmark className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{expense.description}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {expense.category} • {format(new Date(expense.date), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <p className="font-bold text-destructive">-{formatCurrency(expense.amount)}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => onDeleteExpense(expense.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
