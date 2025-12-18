import { useState } from 'react';
import { Users, Plus, CreditCard, Phone, ChevronRight, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Customer, CreditSale } from '@/types/inventory';
import { cn } from '@/lib/utils';

interface CreditManagerProps {
  customers: Customer[];
  creditSales: CreditSale[];
  totalOwed: number;
  onAddCustomer: (name: string, phone?: string) => Promise<Customer | any>;
  onRecordPayment: (creditSaleId: string, amount: number) => void;
  getCustomerTotalOwed: (customerId: string) => number;
}

export function CreditManager({
  customers,
  creditSales,
  totalOwed,
  onAddCustomer,
  onRecordPayment,
  getCustomerTotalOwed,
}: CreditManagerProps) {
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<CreditSale | null>(null);

  const formatCurrency = (amount: number) => `KSh ${amount.toLocaleString()}`;

  const handleAddCustomer = () => {
    if (!newCustomerName.trim()) return;
    onAddCustomer(newCustomerName.trim(), newCustomerPhone.trim() || undefined);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setShowAddCustomer(false);
  };

  const handlePayment = () => {
    if (!selectedCredit || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (amount > 0 && amount <= selectedCredit.balance) {
      onRecordPayment(selectedCredit.id, amount);
      setPaymentAmount('');
      setSelectedCredit(null);
    }
  };

  const customerCredits = selectedCustomer
    ? creditSales.filter(cs => cs.customerId === selectedCustomer.id && cs.status !== 'paid')
    : [];

  if (selectedCredit) {
    return (
      <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
        <button
          onClick={() => setSelectedCredit(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          <span>Back to {selectedCustomer?.name}</span>
        </button>

        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <h3 className="font-semibold text-lg">{selectedCredit.productName}</h3>
          <p className="text-muted-foreground text-sm">{selectedCredit.quantity} units</p>
          
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-xl">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Sale</p>
              <p className="text-xl font-bold">{formatCurrency(selectedCredit.amount)}</p>
            </div>
            <div className="p-3 bg-warning/10 rounded-xl border border-warning/20">
              <p className="text-xs text-warning uppercase font-bold tracking-wider">Balance Due</p>
              <p className="text-xl font-bold text-warning">{formatCurrency(selectedCredit.balance)}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount Received</label>
              <Input
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="text-lg h-12"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPaymentAmount(selectedCredit.balance.toString())}
              >
                Pay Full
              </Button>
              <Button className="flex-1" onClick={handlePayment} disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}>
                Update Deni
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedCustomer) {
    const customerOwed = getCustomerTotalOwed(selectedCustomer.id);
    return (
      <div className="space-y-4 animate-in fade-in">
        <button onClick={() => setSelectedCustomer(null)} className="flex items-center gap-2 text-muted-foreground">
          <ChevronRight className="h-4 w-4 rotate-180" />
          <span>All Customers</span>
        </button>

        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-full">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{selectedCustomer.name}</h3>
              {selectedCustomer.phone && <p className="text-muted-foreground text-sm">{selectedCustomer.phone}</p>}
            </div>
          </div>
          <div className="mt-4 p-3 bg-warning/5 rounded-xl border border-warning/10">
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-2xl font-bold text-warning">{formatCurrency(customerOwed)}</p>
          </div>
        </div>

        <h3 className="font-semibold mt-6">Active Debts</h3>
        <div className="space-y-2">
          {customerCredits.map(credit => (
            <button
              key={credit.id}
              onClick={() => setSelectedCredit(credit)}
              className="w-full bg-card rounded-xl p-4 border border-border flex items-center justify-between hover:border-primary/50 transition-all"
            >
              <div className="text-left">
                <p className="font-medium">{credit.productName}</p>
                <p className="text-xs text-muted-foreground">{new Date(credit.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right flex items-center gap-3">
                <div>
                  <p className="font-bold text-warning">{formatCurrency(credit.balance)}</p>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">{credit.status}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <div>
            <p className="text-white/80 text-sm font-medium">Total Shop Debt (Deni)</p>
            <p className="text-3xl font-bold">{formatCurrency(totalOwed)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <h3 className="font-bold text-lg">Customers</h3>
        <Button size="sm" onClick={() => setShowAddCustomer(true)} className="rounded-full">
          <Plus className="h-4 w-4 mr-1" /> Add New
        </Button>
      </div>

      {showAddCustomer && (
        <div className="bg-card rounded-2xl p-4 border-2 border-primary/20 space-y-3 shadow-xl">
          <Input placeholder="Customer name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
          <Input placeholder="Phone number" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleAddCustomer}>Save Customer</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {customers.map(customer => {
          const owed = getCustomerTotalOwed(customer.id);
          return (
            <button
              key={customer.id}
              onClick={() => setSelectedCustomer(customer)}
              className="w-full bg-card rounded-xl p-4 border border-border flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center font-bold text-secondary">
                  {customer.name.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">{customer.phone || 'No phone'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {owed > 0 && <span className="text-warning font-bold">{formatCurrency(owed)}</span>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}