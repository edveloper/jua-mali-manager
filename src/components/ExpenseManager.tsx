import { useState } from 'react';
import { Plus, Receipt, Zap, Smartphone, Bike, Landmark, History, Trash2 } from 'lucide-react';
import { Expense } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

interface ExpenseManagerProps {
  expenses: Expense[];
  onAddExpense: (expense: any) => Promise<void>;
  onQuickAddTOT: () => void;
  monthlySales: number;
}

export function ExpenseManager({ expenses, onAddExpense, onQuickAddTOT, monthlySales }: ExpenseManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('Other');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    
    await onAddExpense({
      category,
      description,
      amount: Number(amount),
      date: new Date().toISOString().split('T')[0]
    });
    
    setDescription('');
    setAmount('');
    setShowAddForm(false);
  };

  const formatCurrency = (amt: number) => `KSh ${amt.toLocaleString()}`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Quick Action Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          className="h-20 flex flex-col gap-1 border-primary/20 bg-primary/5 hover:bg-primary/10"
          onClick={onQuickAddTOT}
        >
          <Landmark className="h-5 w-5 text-primary" />
          <span className="text-xs font-bold">Pay TOT (3%)</span>
          <span className="text-[10px] text-muted-foreground">{formatCurrency(monthlySales * 0.03)}</span>
        </Button>

        <Button 
          variant="outline" 
          className="h-20 flex flex-col gap-1 border-blue-200 bg-blue-50 hover:bg-blue-100"
          onClick={() => onAddExpense({ category: 'Utilities', description: 'Data/Airtime Bundle', amount: 50, date: new Date().toISOString().split('T')[0] })}
        >
          <Smartphone className="h-5 w-5 text-blue-600" />
          <span className="text-xs font-bold text-blue-700">Data/Airtime</span>
          <span className="text-[10px] text-blue-600/70">Quick KSh 50</span>
        </Button>

        <Button 
          variant="outline" 
          className="h-20 flex flex-col gap-1 border-orange-200 bg-orange-50 hover:bg-orange-100"
          onClick={() => onAddExpense({ category: 'Transport', description: 'Boda Delivery', amount: 100, date: new Date().toISOString().split('T')[0] })}
        >
          <Bike className="h-5 w-5 text-orange-600" />
          <span className="text-xs font-bold text-orange-700">Boda/Delivery</span>
          <span className="text-[10px] text-orange-600/70">Quick KSh 100</span>
        </Button>

        <Button 
          variant="outline" 
          className="h-20 flex flex-col gap-1 border-green-200 bg-green-50 hover:bg-green-100"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-5 w-5 text-green-600" />
          <span className="text-xs font-bold text-green-700">Custom Cost</span>
          <span className="text-[10px] text-green-600/70">Rent, Stock, etc.</span>
        </Button>
      </div>

      {showAddForm && (
        <Card className="p-4 border-2 border-primary animate-in zoom-in-95">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm">Record New Expense</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
            <Input 
              placeholder="Description (e.g. Monthly Rent)" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <Input 
                type="number" 
                placeholder="Amount (KSh)" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
              >
                <option value="Rent">Rent</option>
                <option value="Salary">Salary</option>
                <option value="Utilities">Utilities</option>
                <option value="Transport">Transport</option>
                <option value="Tax">Tax/Fees</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <Button type="submit" className="w-full">Save Expense</Button>
          </form>
        </Card>
      )}

      {/* Expense List */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <History className="h-4 w-4" />
          <h3 className="text-sm font-medium uppercase tracking-wider">Recent Spending</h3>
        </div>
        {expenses.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-2xl text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No expenses recorded yet.</p>
          </div>
        ) : (
          expenses.map((expense) => (
            <div key={expense.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                  {expense.category === 'Tax' && <Landmark className="h-4 w-4" />}
                  {expense.category === 'Transport' && <Bike className="h-4 w-4" />}
                  {expense.category === 'Utilities' && <Zap className="h-4 w-4" />}
                  {expense.category !== 'Tax' && expense.category !== 'Transport' && expense.category !== 'Utilities' && <Receipt className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">{expense.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(expense.date), 'MMM do, yyyy')}</p>
                </div>
              </div>
              <p className="font-bold text-destructive">-{formatCurrency(expense.amount)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}