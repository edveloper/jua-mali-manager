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
  onAddCustomer: (name: string, phone?: string) => Customer | null;
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
    if (amount > 0) {
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
      <div className="space-y-4 animate-slide-up">
        <button
          onClick={() => setSelectedCredit(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          <span>Back to Credits</span>
        </button>

        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="font-semibold text-lg">{selectedCredit.productName}</h3>
          <p className="text-muted-foreground text-sm">{selectedCredit.quantity} items</p>
          
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="stat-card">
              <p className="metric-label">Total</p>
              <p className="text-lg font-semibold">{formatCurrency(selectedCredit.totalAmount)}</p>
            </div>
            <div className="stat-card">
              <p className="metric-label">Balance</p>
              <p className="text-lg font-semibold text-warning">{formatCurrency(selectedCredit.balance)}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Input
              type="number"
              placeholder="Payment amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              min={0}
              max={selectedCredit.balance}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPaymentAmount(selectedCredit.balance.toString())}
              >
                Pay Full
              </Button>
              <Button className="flex-1" onClick={handlePayment} disabled={!paymentAmount}>
                Record Payment
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
      <div className="space-y-4 animate-slide-up">
        <button
          onClick={() => setSelectedCustomer(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          <span>Back to Customers</span>
        </button>

        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-secondary/10 rounded-full">
              <Users className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{selectedCustomer.name}</h3>
              {selectedCustomer.phone && (
                <p className="text-muted-foreground text-sm flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {selectedCustomer.phone}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 stat-card">
            <p className="metric-label">Total Owed</p>
            <p className="metric-value text-warning">{formatCurrency(customerOwed)}</p>
          </div>
        </div>

        <h3 className="font-semibold">Outstanding Credits</h3>
        
        {customerCredits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No outstanding credits
          </div>
        ) : (
          <div className="space-y-2">
            {customerCredits.map(credit => (
              <button
                key={credit.id}
                onClick={() => setSelectedCredit(credit)}
                className="w-full bg-card rounded-xl p-3 border border-border/50 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="text-left">
                  <p className="font-medium">{credit.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {credit.quantity}x • {new Date(credit.createdAt).toLocaleDateString('en-KE')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-semibold text-warning">{formatCurrency(credit.balance)}</p>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      credit.status === 'partial' ? "bg-secondary/10 text-secondary" : "bg-warning/10 text-warning"
                    )}>
                      {credit.status === 'partial' ? 'Partial' : 'Pending'}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="stat-card bg-gradient-warm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-background/20 rounded-full">
            <Wallet className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm text-primary-foreground/80">Total Credit Owed</p>
            <p className="text-2xl font-bold text-primary-foreground">{formatCurrency(totalOwed)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Customers</h3>
        <Button size="sm" onClick={() => setShowAddCustomer(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Customer
        </Button>
      </div>

      {showAddCustomer && (
        <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
          <h4 className="font-medium">New Customer</h4>
          <Input
            placeholder="Customer name"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
          />
          <Input
            placeholder="Phone number (optional)"
            value={newCustomerPhone}
            onChange={(e) => setNewCustomerPhone(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAddCustomer(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleAddCustomer} disabled={!newCustomerName.trim()}>
              Add
            </Button>
          </div>
        </div>
      )}

      {customers.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-muted rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground">No Customers Yet</h3>
          <p className="text-muted-foreground mt-1">Add customers to track credit sales</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map(customer => {
            const owed = getCustomerTotalOwed(customer.id);
            return (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="w-full bg-card rounded-xl p-3 border border-border/50 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-full">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{customer.name}</p>
                    {customer.phone && (
                      <p className="text-sm text-muted-foreground">{customer.phone}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {owed > 0 && (
                    <span className="text-warning font-semibold">{formatCurrency(owed)}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
