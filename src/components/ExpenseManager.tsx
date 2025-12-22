import { useState } from 'react';
import { Plus, Receipt, Zap, Landmark, History, Trash2 } from 'lucide-react';
import { Expense } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

interface ExpenseManagerProps {
  expenses: Expense[];
  onAddExpense: (expense: any) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onQuickAddTOT: () => void;
  monthlySales: number;
}

export function ExpenseManager({ expenses, onAddExpense, onDeleteExpense, onQuickAddTOT, monthlySales }: ExpenseManagerProps) {
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
      {/* Action Grid: Balanced 2-Button Layout */}
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
          <span className="text-sm font-bold">Custom Cost</span>
          <span className="text-[10px] text-muted-foreground">Rent, Stock, etc.</span>
        </Button>
      </div>

      {showAddForm && (
        <Card className="p-4 border-2 border-primary animate-in zoom-in-95">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm">New Custom Expense</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
            <Input 
              placeholder="What did you pay for?" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <div className="flex gap-2">
              <Input 
                type="number" 
                placeholder="Amount" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
              >
                <option value="Other">Category</option>
                <option value="Rent">Rent</option>
                <option value="Salary">Salary</option>
                <option value="Utilities">Utilities</option>
                <option value="Transport">Transport</option>
                <option value="Tax">Tax/Fees</option>
              </select>
            </div>
            <Button type="submit" className="w-full">Save Expense</Button>
          </form>
        </Card>
      )}

      {/* History List with Delete Option */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1 px-1">
          <History className="h-4 w-4" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Spending History</h3>
        </div>
        
        {expenses.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-3xl text-muted-foreground/40">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No costs recorded</p>
          </div>
        ) : (
          expenses.map((expense) => (
            <div key={expense.id} className="group relative flex items-center justify-between p-4 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-muted rounded-xl text-muted-foreground">
                  {expense.category === 'Tax' ? <Landmark className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{expense.description}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{format(new Date(expense.date), 'MMM d, yyyy')}</p>
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