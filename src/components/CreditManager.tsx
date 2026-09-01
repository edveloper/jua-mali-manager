import { useState } from 'react';
import { ArrowLeft, Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Customer, CreditSale, CreditPayment } from '@/types/inventory';
import { PAYMENT_METHODS, PaymentMethod, lastUsedMethod, rememberMethod, takesReference, methodLabel } from '@/lib/payment';
import { money } from '@/lib/money';

interface CreditManagerProps {
  customers: Customer[];
  creditSales: CreditSale[];
  totalOwed: number;
  onAddCustomer: (name: string, phone?: string) => Promise<Customer | any>;
  onRecordPayment: (creditSaleId: string, amount: number, method?: string, reference?: string) => void;
  getCustomerTotalOwed: (customerId: string) => number;
  getPaymentsForCredit?: (creditSaleId: string) => CreditPayment[];
}

const shortDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });

export function CreditManager({
  customers,
  creditSales,
  totalOwed,
  onAddCustomer,
  onRecordPayment,
  getCustomerTotalOwed,
  getPaymentsForCredit,
}: CreditManagerProps) {
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(lastUsedMethod);
  const [paymentReference, setPaymentReference] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<CreditSale | null>(null);

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
      onRecordPayment(selectedCredit.id, amount, paymentMethod, paymentReference.trim() || undefined);
      rememberMethod(paymentMethod);
      setPaymentAmount('');
      setPaymentReference('');
      setSelectedCredit(null);
    }
  };

  const customerCredits = selectedCustomer
    ? creditSales.filter((cs) => cs.customerId === selectedCustomer.id && cs.status !== 'paid')
    : [];

  // ----------------------------------------------------------- one debt
  if (selectedCredit) {
    const payments = getPaymentsForCredit ? getPaymentsForCredit(selectedCredit.id) : [];
    const overpaying = paymentAmount !== '' && parseFloat(paymentAmount) > selectedCredit.balance;

    return (
      <div className="space-y-3">
        <button
          onClick={() => setSelectedCredit(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {selectedCustomer?.name}
        </button>

        <div className="sheet">
          <p className="font-medium">{selectedCredit.productName}</p>
          <p className="text-xs text-muted-foreground">
            {selectedCredit.quantity} × &middot; {shortDate(selectedCredit.createdAt)}
          </p>

          <div className="ledger-line ledger-rule">
            <span className="text-muted-foreground">Total</span>
            <span className="amount">{money(selectedCredit.amount)}</span>
          </div>
          <div className="ledger-line">
            <span className="text-muted-foreground">Paid so far</span>
            <span className="amount text-success">{money(selectedCredit.amount - selectedCredit.balance)}</span>
          </div>
          <div className="ledger-line ledger-total">
            <span className="font-semibold">Still owed</span>
            <span className="text-xl amount text-warning">{money(selectedCredit.balance)}</span>
          </div>
        </div>

        <div className="sheet space-y-3">
          <label htmlFor="pay" className="text-sm font-medium">How much did they pay?</label>
          <Input
            id="pay"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            className="text-lg h-12 num"
          />
          {overpaying && (
            <p className="text-xs text-destructive">
              That is more than the {money(selectedCredit.balance)} still owed.
            </p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">How did they pay?</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_METHODS.map((method) => (
                <Button
                  key={method.value}
                  variant={paymentMethod === method.value ? 'default' : 'outline'}
                  size="sm"
                  className="px-1 text-xs"
                  onClick={() => setPaymentMethod(method.value)}
                >
                  {method.short}
                </Button>
              ))}
            </div>
            {takesReference(paymentMethod) && (
              <Input
                placeholder="Transaction code (optional)"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value.toUpperCase())}
                className="num"
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setPaymentAmount(String(selectedCredit.balance))}
            >
              Paid it all
            </Button>
            <Button
              className="flex-1"
              onClick={handlePayment}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || overpaying}
            >
              Record
            </Button>
          </div>
        </div>

        {payments.length > 0 && (
          <div className="sheet">
            <p className="sheet-heading">Payments so far</p>
            <div className="mt-2 divide-y divide-border/70">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-baseline justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">
                    {shortDate(payment.paidAt)}
                    {payment.paymentMethod && (
                      <span className="ml-2 text-xs">{methodLabel(payment.paymentMethod)}</span>
                    )}
                  </span>
                  <span className="amount text-success">{money(payment.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------- one customer
  if (selectedCustomer) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setSelectedCustomer(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Everyone
        </button>

        <div className="sheet">
          <p className="font-semibold">{selectedCustomer.name}</p>
          {selectedCustomer.phone && (
            <a href={`tel:${selectedCustomer.phone}`} className="text-sm text-primary">
              {selectedCustomer.phone}
            </a>
          )}
          <div className="ledger-line ledger-total">
            <span className="font-medium">Owes you</span>
            <span className="text-2xl amount text-warning">
              {money(getCustomerTotalOwed(selectedCustomer.id))}
            </span>
          </div>
        </div>

        {customerCredits.length === 0 ? (
          <div className="sheet">
            <p className="text-sm text-muted-foreground">Nothing outstanding. All settled.</p>
          </div>
        ) : (
          <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
            {customerCredits.map((credit) => (
              <button
                key={credit.id}
                onClick={() => setSelectedCredit(credit)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{credit.productName}</p>
                  <p className="text-xs text-muted-foreground">{shortDate(credit.createdAt)}</p>
                </div>
                <span className="amount text-warning shrink-0">{money(credit.balance)}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------- everyone
  const owing = customers
    .map((c) => ({ customer: c, owed: getCustomerTotalOwed(c.id) }))
    .sort((a, b) => b.owed - a.owed);

  return (
    <div className="space-y-3">
      <div className="sheet">
        <div className="flex items-baseline justify-between">
          <span className="sheet-heading">Owed to you</span>
          <span className="text-2xl amount text-warning">{money(totalOwed)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Customers</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAddCustomer(!showAddCustomer)}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {showAddCustomer && (
        <div className="sheet space-y-2">
          <Input placeholder="Name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
          <Input placeholder="Phone number" type="tel" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleAddCustomer} disabled={!newCustomerName.trim()}>Save</Button>
          </div>
        </div>
      )}

      {owing.length === 0 ? (
        <div className="sheet">
          <p className="text-sm text-muted-foreground">
            No customers yet. They get added automatically the first time you sell on deni.
          </p>
        </div>
      ) : (
        <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
          {owing.map(({ customer, owed }) => (
            <button
              key={customer.id}
              onClick={() => setSelectedCustomer(customer)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{customer.name}</p>
                <p className="text-xs text-muted-foreground truncate">{customer.phone || 'No number'}</p>
              </div>
              {owed > 0 ? (
                <span className="amount text-warning shrink-0">{money(owed)}</span>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">settled</span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
