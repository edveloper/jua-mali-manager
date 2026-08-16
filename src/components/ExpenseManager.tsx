import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Expense, ExpenseDraft } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PAYMENT_METHODS, PaymentMethod, lastUsedMethod, methodLabel } from '@/lib/payment';
import { format, startOfMonth, subDays, subMonths, startOfDay, endOfMonth } from 'date-fns';

interface ExpenseManagerProps {
  expenses: Expense[];
  onAddExpense: (expense: ExpenseDraft) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onQuickAddTOT: () => void;
  monthlySales: number;
  businessCategory?: string;
}

type RangeType = 'month' | 'lastMonth' | '30d' | 'all';

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });

const categoriesFor = (businessCategory: string): string[] => {
  const common = ['Rent', 'Wages', 'Transport', 'Utilities', 'Airtime', 'Tax', 'Licences', 'Other'];
  if (businessCategory === 'transport') return ['Fuel', 'Vehicle repair', 'Parking', 'Insurance', ...common];
  if (businessCategory === 'computer_center') return ['Internet', 'Paper and ink', 'Power backup', 'Repairs', ...common];
  if (businessCategory === 'barbershop_salon') return ['Supplies', 'Commission', 'Cleaning', 'Equipment', ...common];
  // 'Stock' is deliberately absent: buying stock goes through Sell > Restock so
  // that stock levels and unit costs move together with the money.
  return ['Packaging', 'Marketing', ...common];
};

const TYPE_LABEL: Record<Expense['expenseType'], string> = {
  one_off: 'One-off',
  variable: 'Changes each time',
  recurring: 'Same bill every time',
};

export function ExpenseManager({
  expenses,
  onAddExpense,
  onDeleteExpense,
  onQuickAddTOT,
  monthlySales,
  businessCategory = 'retail',
}: ExpenseManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [range, setRange] = useState<RangeType>('month');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Rent');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expenseType, setExpenseType] = useState<Expense['expenseType']>('one_off');
  const [recurrenceUnit, setRecurrenceUnit] = useState<Expense['recurrenceUnit']>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(lastUsedMethod);
  const [isSaving, setIsSaving] = useState(false);

  const categories = useMemo(() => categoriesFor(businessCategory), [businessCategory]);

  const { shown, total, byCategory, rangeLabel } = useMemo(() => {
    const now = new Date();
    let from = startOfMonth(now);
    let to: Date | null = null;
    let label = format(now, 'MMMM');

    if (range === 'lastMonth') {
      const prev = subMonths(now, 1);
      from = startOfMonth(prev);
      to = endOfMonth(prev);
      label = format(prev, 'MMMM');
    } else if (range === '30d') {
      from = startOfDay(subDays(now, 30));
      label = 'Last 30 days';
    } else if (range === 'all') {
      from = new Date(0);
      label = 'Everything';
    }

    const filtered = expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d >= from && (!to || d <= to);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const grouped = new Map<string, number>();
    for (const e of filtered) {
      grouped.set(e.category, (grouped.get(e.category) || 0) + e.amount);
    }

    return {
      shown: filtered,
      total: filtered.reduce((sum, e) => sum + e.amount, 0),
      byCategory: [...grouped.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      rangeLabel: label,
    };
  }, [expenses, range]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description.trim()) return;

    setIsSaving(true);
    await onAddExpense({
      category,
      description: description.trim(),
      amount: Number(amount),
      date,
      expenseType,
      recurrenceUnit: expenseType === 'recurring' ? recurrenceUnit : 'none',
      allocationMode: 'cash',
      paymentMethod,
      effectiveFrom: expenseType === 'recurring' ? date : null,
      effectiveTo: null,
    });
    setIsSaving(false);

    setDescription('');
    setAmount('');
    setExpenseType('one_off');
    setShowForm(false);
  };

  const estimatedTax = monthlySales * 0.03;

  const RANGES: { value: RangeType; label: string }[] = [
    { value: 'month', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: '30d', label: '30 days' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-3">
      <div className="sheet">
        <div className="flex items-baseline justify-between gap-4">
          <span className="sheet-heading">{rangeLabel}</span>
          <span className="text-2xl amount text-destructive">{money(total)}</span>
        </div>
        {byCategory.length > 0 && (
          <div className="mt-2">
            {byCategory.slice(0, 5).map((c) => (
              <div key={c.name} className="ledger-sub">
                <span>{c.name}</span>
                <span className="num">{money(c.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {RANGES.map((r) => (
          <Button
            key={r.value}
            variant={range === r.value ? 'default' : 'outline'}
            size="sm"
            className="px-1 text-xs"
            onClick={() => setRange(r.value)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {!showForm && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add expense
          </Button>
          <Button variant="outline" onClick={onQuickAddTOT} disabled={estimatedTax <= 0}>
            Tax · {money(estimatedTax)}
          </Button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="sheet space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">New expense</p>
            <button type="button" onClick={() => setShowForm(false)} className="text-xs text-muted-foreground">
              Cancel
            </button>
          </div>

          <p className="text-xs text-muted-foreground rounded-md bg-muted p-2">
            Buying stock? Record it under <span className="font-medium text-foreground">Sell &rarr; Restock</span> instead,
            so your stock levels and unit costs move with the money.
          </p>

          <div className="space-y-2">
            <Label htmlFor="exp-desc">What was it for?</Label>
            <Input
              id="exp-desc"
              placeholder="e.g. September rent"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="exp-amount">How much?</Label>
              <Input
                id="exp-amount"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="num"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-date">When?</Label>
              <Input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exp-category">Kind of cost</Label>
            <select
              id="exp-category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label>How did you pay?</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <Button
                  key={m.value}
                  type="button"
                  variant={paymentMethod === m.value ? 'default' : 'outline'}
                  size="sm"
                  className="px-1 text-xs"
                  onClick={() => setPaymentMethod(m.value)}
                >
                  {m.short}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Only cash comes out of the till when you close up.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exp-type">Does it come again?</Label>
            <select
              id="exp-type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={expenseType}
              onChange={(e) => setExpenseType(e.target.value as Expense['expenseType'])}
            >
              <option value="one_off">No, just this once</option>
              <option value="variable">Now and then, different amounts</option>
              <option value="recurring">Yes, the same bill every time</option>
            </select>
          </div>

          {expenseType === 'recurring' && (
            <div className="space-y-2">
              <Label htmlFor="exp-recurrence">How often?</Label>
              <select
                id="exp-recurrence"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={recurrenceUnit}
                onChange={(e) => setRecurrenceUnit(e.target.value as Expense['recurrenceUnit'])}
              >
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
                <option value="annual">Every year</option>
              </select>
              <p className="text-xs text-muted-foreground">
                A bill like rent is spread across the days it covers, so one day does not
                look ruinous and the rest better than they were.
              </p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSaving || !amount || !description.trim()}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </form>
      )}

      {shown.length === 0 ? (
        <div className="sheet">
          <p className="text-sm text-muted-foreground">Nothing recorded for this period.</p>
        </div>
      ) : (
        <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
          {shown.map((expense) => (
            <div key={expense.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{expense.description || expense.category}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {expense.category} · {format(new Date(expense.date), 'd MMM')}
                  {expense.expenseType !== 'one_off' && ` · ${TYPE_LABEL[expense.expenseType]}`}
                  {expense.paymentMethod && ` · ${methodLabel(expense.paymentMethod)}`}
                </p>
              </div>
              <span className="amount text-sm shrink-0">{money(expense.amount)}</span>
              {/* Restock spend is owned by the stock record that created it, so it
                  cannot be deleted from here without the two disagreeing. */}
              {expense.source !== 'restock' && (
                <button
                  type="button"
                  onClick={() => onDeleteExpense(expense.id)}
                  className="text-muted-foreground active:text-destructive shrink-0"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
