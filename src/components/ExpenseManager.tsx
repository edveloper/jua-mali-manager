import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Undo2 } from 'lucide-react';
import { Expense, ExpenseDraft, StockMovement } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PAYMENT_METHODS, PaymentMethod, lastUsedMethod, methodLabel } from '@/lib/payment';
import { money } from '@/lib/money';
import { format, startOfMonth, subDays, subMonths, startOfDay, endOfDay, endOfMonth } from 'date-fns';

interface ExpenseManagerProps {
  expenses: Expense[];
  onAddExpense: (expense: ExpenseDraft) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  /** Restock spend is owned by a stock record, so cancelling goes through it. */
  stockMovements?: StockMovement[];
  onVoidRestock?: (movementId: string) => Promise<boolean>;
  onQuickAddTOT: () => void;
  monthlySales: number;
  businessCategory?: string;
  /** Owners see what the shop spent in total. Staff only see what they added. */
  showSummary?: boolean;
  /*
   * Bumped by the button in the middle of the nav to open the form from
   * anywhere. A counter rather than a boolean, so asking again while already on
   * this screen still opens it.
   */
  openFormSignal?: number;
}

type RangeType = 'today' | 'month' | 'lastMonth' | '30d' | 'all';


const categoriesFor = (businessCategory: string): string[] => {
  const common = ['Rent', 'Wages', 'Transport', 'Utilities', 'Airtime', 'Tax', 'Licences', 'Other'];
  if (businessCategory === 'transport') return ['Fuel', 'Vehicle repair', 'Parking', 'Insurance', ...common];
  if (businessCategory === 'computer_center') return ['Internet', 'Paper and ink', 'Power backup', 'Repairs', ...common];
  if (businessCategory === 'barbershop_salon') return ['Supplies', 'Commission', 'Cleaning', 'Equipment', ...common];
  // 'Stock' is deliberately absent: buying stock goes through Sell > Restock so
  // that stock levels and unit costs move together with the money.
  return ['Packaging', 'Marketing', ...common];
};

/*
 * Guessing the category from what the owner typed.
 *
 * The form used to ask twice: "what was it for?" and then, separately, which
 * cost it was. Somebody types "September rent" and is then made to choose Rent
 * from a list, which reads as the app not having listened. The description is
 * what people read later and the category is what reports add up, so both are
 * needed -- but only one of them needs asking for.
 *
 * Swahili and everyday words are in here because that is what gets typed at a
 * counter: kodi, mshahara, boda, nauli, maji, umeme.
 */
const CATEGORY_HINTS: { category: string; words: string[] }[] = [
  { category: 'Fuel', words: ['fuel', 'petrol', 'diesel', 'mafuta'] },
  { category: 'Internet', words: ['internet', 'wifi', 'fibre', 'fiber', 'router'] },
  { category: 'Parking', words: ['parking', 'park fee'] },
  { category: 'Insurance', words: ['insurance', 'bima'] },
  { category: 'Vehicle repair', words: ['vehicle', 'tyre', 'tire', 'garage'] },
  { category: 'Rent', words: ['rent', 'kodi', 'landlord'] },
  { category: 'Wages', words: ['wage', 'salary', 'salaries', 'mshahara', 'casual', 'staff pay'] },
  { category: 'Transport', words: ['transport', 'fare', 'nauli', 'boda', 'matatu', 'tuktuk', 'delivery', 'carriage', 'fuel', 'petrol', 'diesel'] },
  { category: 'Utilities', words: ['power', 'electricity', 'umeme', 'kplc', 'token', 'water', 'maji', 'garbage'] },
  { category: 'Airtime', words: ['airtime', 'bundle', 'bundles', 'data', 'safaricom', 'credo'] },
  { category: 'Tax', words: ['tax', 'kra', 'vat', 'turnover'] },
  { category: 'Licences', words: ['permit', 'licence', 'license', 'county', 'cess'] },
  { category: 'Packaging', words: ['packaging', 'paper bag', 'bags', 'wrapping', 'carrier'] },
  { category: 'Marketing', words: ['marketing', 'advert', 'poster', 'banner', 'promotion', 'flyer'] },
  { category: 'Cleaning', words: ['cleaning', 'detergent', 'mop', 'disinfectant'] },
  { category: 'Repairs', words: ['repair', 'fundi', 'service', 'fix'] },
  { category: 'Paper and ink', words: ['paper', 'ink', 'toner', 'cartridge'] },
  { category: 'Commission', words: ['commission'] },
  { category: 'Supplies', words: ['supplies', 'supply'] },
];

const guessCategory = (description: string, available: string[]): string | null => {
  const text = description.toLowerCase();
  if (text.trim() === '') return null;
  for (const hint of CATEGORY_HINTS) {
    if (!available.includes(hint.category)) continue;
    if (hint.words.some((w) => text.includes(w))) return hint.category;
  }
  return null;
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
  stockMovements = [],
  onVoidRestock,
  onQuickAddTOT,
  monthlySales,
  businessCategory = 'retail',
  showSummary = true,
  openFormSignal = 0,
}: ExpenseManagerProps) {
  const [showForm, setShowForm] = useState(false);
  // What did I spend today. Looking back over the month is the deliberate
  // act, not the default one.
  const [range, setRange] = useState<RangeType>('today');

  // Zero is the initial value, not a request, so the form does not spring open
  // every time somebody merely visits this screen.
  useEffect(() => {
    if (openFormSignal > 0) setShowForm(true);
  }, [openFormSignal]);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  // Once the owner picks for themselves, stop second-guessing them.
  const [categoryPicked, setCategoryPicked] = useState(false);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expenseType, setExpenseType] = useState<Expense['expenseType']>('one_off');
  const [recurrenceUnit, setRecurrenceUnit] = useState<Expense['recurrenceUnit']>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(lastUsedMethod);
  const [isSaving, setIsSaving] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [cancellingRestock, setCancellingRestock] = useState<StockMovement | null>(null);

  const categories = useMemo(() => categoriesFor(businessCategory), [businessCategory]);

  useEffect(() => {
    if (categoryPicked) return;
    const guess = guessCategory(description, categories);
    setCategory(guess ?? 'Other');
  }, [description, categoryPicked, categories]);

  const { shown, total, byCategory, rangeLabel } = useMemo(() => {
    const now = new Date();
    let from = startOfMonth(now);
    let to: Date | null = null;
    let label = format(now, 'MMMM');

    if (range === 'today') {
      from = startOfDay(now);
      to = endOfDay(now);
      label = 'Today';
    } else if (range === 'lastMonth') {
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
    setCategory('Other');
    setCategoryPicked(false);
    setPickingCategory(false);
    setShowForm(false);
  };

  /*
   * Spending created by a restock cannot simply be deleted: the stock record
   * that made it would still claim the goods arrived. Cancelling the delivery
   * instead puts the shelf, the cost price and the money back together.
   */
  const restockFor = (expenseId: string) =>
    stockMovements.find((m) => m.expenseId === expenseId && !m.voidedAt);

  const estimatedTax = monthlySales * 0.03;

  const RANGES: { value: RangeType; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'month', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: '30d', label: '30 days' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-3">
      {showSummary && (
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
      )}

      <div className="grid grid-cols-3 gap-1.5">
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
        <div className={showSummary ? 'grid grid-cols-2 gap-2' : ''}>
          <Button className={showSummary ? '' : 'w-full'} onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add expense
          </Button>
          {showSummary && (
            <Button variant="outline" onClick={onQuickAddTOT} disabled={estimatedTax <= 0}>
              Tax · {money(estimatedTax)}
            </Button>
          )}
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

            {/* Sits under the description because that is what it was worked out
                from. One line when the guess is right, which it usually is. */}
            {pickingCategory ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {categories.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant={category === c ? 'default' : 'outline'}
                    size="sm"
                    className="px-2 text-xs"
                    onClick={() => {
                      setCategory(c);
                      setCategoryPicked(true);
                      setPickingCategory(false);
                    }}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPickingCategory(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Counted as <span className="font-medium text-foreground">{category}</span> in your
                reports. <span className="text-primary">Change</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="exp-amount">How much?</Label>
              <Input
                id="exp-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
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
              {expense.source !== 'restock' ? (
                <button
                  type="button"
                  onClick={() => setDeleting(expense)}
                  className="text-muted-foreground active:text-destructive shrink-0"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                onVoidRestock && restockFor(expense.id) && (
                  <button
                    type="button"
                    onClick={() => setCancellingRestock(restockFor(expense.id) ?? null)}
                    className="text-muted-foreground active:text-destructive shrink-0"
                    aria-label="Cancel this delivery"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {cancellingRestock && (
        <ConfirmDialog
          title="Cancel this delivery?"
          message="The stock comes back off the shelf, the cost price goes back to what it was, and the spending is removed."
          details={[
            { label: 'Item', value: cancellingRestock.productName },
            { label: 'Coming off', value: `${cancellingRestock.quantity}` },
            { label: 'Spending removed', value: `KSh ${money(cancellingRestock.totalCost)}` },
          ]}
          destructive
          confirmLabel="Cancel it"
          cancelLabel="Leave it"
          onConfirm={async () => {
            await onVoidRestock?.(cancellingRestock.id);
            setCancellingRestock(null);
          }}
          onCancel={() => setCancellingRestock(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Remove this spending?"
          message="It goes off the record completely. Nothing here keeps a copy of it."
          details={[
            { label: 'What', value: deleting.description || deleting.category },
            { label: 'Amount', value: `KSh ${money(deleting.amount)}` },
            { label: 'Date', value: format(new Date(deleting.date), 'd MMM yyyy') },
          ]}
          destructive
          confirmLabel="Remove it"
          cancelLabel="Keep it"
          onConfirm={async () => {
            await onDeleteExpense(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
