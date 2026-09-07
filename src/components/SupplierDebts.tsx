import { useState } from 'react';
import { ArrowLeft, Plus, ChevronRight, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Supplier, SupplierDebt, SupplierPayment } from '@/hooks/useSuppliers';
import { StockMovement } from '@/types/inventory';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PAYMENT_METHODS, PaymentMethod, lastUsedMethod, rememberMethod, takesReference, methodLabel } from '@/lib/payment';
import { money } from '@/lib/money';

interface SupplierDebtsProps {
  suppliers: Supplier[];
  totalOwed: number;
  debtsFor: (supplierId: string) => SupplierDebt[];
  owedTo: (supplierId: string) => number;
  paymentsFor: (debtId: string) => SupplierPayment[];
  supplierName: (id: string) => string;
  onAddSupplier: (name: string, phone?: string) => Promise<any>;
  onAddDebt: (supplierId: string, description: string, amount: number, dueDate?: string) => Promise<boolean>;
  onPay: (debtId: string, amount: number, method?: string, reference?: string) => Promise<boolean>;
  /*
   * Stock taken on credit writes a debt and deliberately no expense, so it
   * never appears on the spending screen where deliveries are normally
   * cancelled. Without these it could be recorded wrongly and never undone.
   */
  stockMovements?: StockMovement[];
  onVoidRestock?: (movementId: string) => Promise<boolean>;
}

const shortDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });

/** The mirror of the credit book. Same shapes, pointing the other way. */
export function SupplierDebts({
  suppliers, totalOwed, debtsFor, owedTo, paymentsFor, supplierName,
  onAddSupplier, onAddDebt, onPay, stockMovements = [], onVoidRestock,
}: SupplierDebtsProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<SupplierDebt | null>(null);
  const [cancellingDelivery, setCancellingDelivery] = useState<StockMovement | null>(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(lastUsedMethod);
  const [reference, setReference] = useState('');

  // ----------------------------------------------------------- one debt
  if (selectedDebt) {
    const history = paymentsFor(selectedDebt.id);
    const overpaying = payAmount !== '' && parseFloat(payAmount) > selectedDebt.balance;

    const handlePay = async () => {
      const value = parseFloat(payAmount);
      if (!(value > 0) || overpaying) return;
      const ok = await onPay(selectedDebt.id, value, method, reference.trim() || undefined);
      if (!ok) return;
      rememberMethod(method);
      setPayAmount('');
      setReference('');
      setSelectedDebt(null);
    };

    return (
      <div className="space-y-3">
        <button onClick={() => setSelectedDebt(null)} className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          {selectedSupplier?.name}
        </button>

        <div className="sheet">
          <p className="font-medium">{selectedDebt.description}</p>
          <p className="text-xs text-muted-foreground">Taken {shortDate(selectedDebt.incurredOn)}</p>
          <div className="ledger-line ledger-rule">
            <span className="text-muted-foreground">Total</span>
            <span className="amount">{money(selectedDebt.amount)}</span>
          </div>
          <div className="ledger-line">
            <span className="text-muted-foreground">Paid so far</span>
            <span className="amount text-success">{money(selectedDebt.amountPaid)}</span>
          </div>
          <div className="ledger-line ledger-total">
            <span className="font-semibold">Still owed</span>
            <span className="text-xl amount text-destructive">{money(selectedDebt.balance)}</span>
          </div>
        </div>

        <div className="sheet space-y-3">
          <Label htmlFor="pay-supplier">How much did you pay?</Label>
          <Input
            id="pay-supplier"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            className="text-lg h-12 num"
          />
          {overpaying && (
            <p className="text-xs text-destructive">
              That is more than the {money(selectedDebt.balance)} you owe.
            </p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">How did you pay?</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <Button
                  key={m.value}
                  variant={method === m.value ? 'default' : 'outline'}
                  size="sm"
                  className="px-1 text-xs"
                  onClick={() => setMethod(m.value)}
                >
                  {m.short}
                </Button>
              ))}
            </div>
            {takesReference(method) && (
              <Input
                placeholder="Transaction code (optional)"
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
                className="num"
              />
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPayAmount(String(selectedDebt.balance))}>
              Paid it all
            </Button>
            <Button className="flex-1" onClick={handlePay} disabled={!payAmount || parseFloat(payAmount) <= 0 || overpaying}>
              Record
            </Button>
          </div>
        </div>

        {(() => {
          const delivery = selectedDebt.stockMovementId
            ? stockMovements.find((m) => m.id === selectedDebt.stockMovementId)
            : undefined;
          if (!delivery || !onVoidRestock) return null;

          // The same refusal the database makes, said before the tap rather
          // than after it. Once money has changed hands the delivery is part of
          // a settled account and unpicking it would leave a payment with
          // nothing to point at.
          if (selectedDebt.amountPaid > 0) {
            return (
              <div className="sheet">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Part of this has been paid, so the delivery can no longer be cancelled.
                  Settle the rest, or put the stock right with a count.
                </p>
              </div>
            );
          }

          return (
            <button
              type="button"
              onClick={() => setCancellingDelivery(delivery)}
              className="sheet w-full flex items-center gap-3 text-left pressable"
            >
              <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <Undo2 className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Cancel this delivery</p>
                <p className="text-xs text-muted-foreground">
                  Takes the stock back off and clears what you owe
                </p>
              </div>
            </button>
          );
        })()}

        {cancellingDelivery && (
          <ConfirmDialog
            title="Cancel this delivery?"
            message="The stock comes back off the shelf, the cost price goes back to what it was, and what you owe this supplier is cleared."
            details={[
              { label: 'Item', value: cancellingDelivery.productName },
              { label: 'Coming off', value: `${cancellingDelivery.quantity}` },
              { label: 'You will no longer owe', value: `KSh ${money(selectedDebt.balance)}` },
            ]}
            destructive
            confirmLabel="Cancel it"
            cancelLabel="Leave it"
            onConfirm={async () => {
              const ok = await onVoidRestock?.(cancellingDelivery.id);
              setCancellingDelivery(null);
              // The debt row it was showing is gone, so standing on its screen
              // would mean reading a record that no longer exists.
              if (ok) setSelectedDebt(null);
            }}
            onCancel={() => setCancellingDelivery(null)}
          />
        )}

        {history.length > 0 && (
          <div className="sheet">
            <p className="sheet-heading">Payments so far</p>
            <div className="mt-2 divide-y divide-border/70">
              {history.map((p) => (
                <div key={p.id} className="flex items-baseline justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">
                    {shortDate(p.paidAt)}
                    {p.paymentMethod && <span className="ml-2 text-xs">{methodLabel(p.paymentMethod)}</span>}
                  </span>
                  <span className="amount text-success">{money(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------- one supplier
  if (selectedSupplier) {
    const open = debtsFor(selectedSupplier.id);

    const handleAddDebt = async () => {
      const value = parseFloat(amount);
      if (!description.trim() || !(value > 0)) return;
      const ok = await onAddDebt(selectedSupplier.id, description, value);
      if (!ok) return;
      setDescription('');
      setAmount('');
      setShowAddDebt(false);
    };

    return (
      <div className="space-y-3">
        <button onClick={() => setSelectedSupplier(null)} className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Everyone
        </button>

        <div className="sheet">
          <p className="font-semibold">{selectedSupplier.name}</p>
          {selectedSupplier.phone && (
            <a href={`tel:${selectedSupplier.phone}`} className="text-sm text-primary">{selectedSupplier.phone}</a>
          )}
          <div className="ledger-line ledger-total">
            <span className="font-medium">You owe</span>
            <span className="text-2xl amount text-destructive">{money(owedTo(selectedSupplier.id))}</span>
          </div>
        </div>

        {showAddDebt ? (
          <div className="sheet space-y-2">
            <Label htmlFor="debt-desc">What did you take?</Label>
            <Input id="debt-desc" placeholder="e.g. 20 crates" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Label htmlFor="debt-amount">How much do you owe?</Label>
            <Input id="debt-amount" type="number" inputMode="decimal" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="num" />
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowAddDebt(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddDebt} disabled={!description.trim() || !amount}>Save</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setShowAddDebt(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add something owed
          </Button>
        )}

        {open.length === 0 ? (
          <div className="sheet"><p className="text-sm text-muted-foreground">Nothing outstanding.</p></div>
        ) : (
          <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
            {open.map((debt) => (
              <button
                key={debt.id}
                onClick={() => setSelectedDebt(debt)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{debt.description}</p>
                  <p className="text-xs text-muted-foreground">{shortDate(debt.incurredOn)}</p>
                </div>
                <span className="amount text-destructive shrink-0">{money(debt.balance)}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------- everyone
  const handleAddSupplier = async () => {
    if (!name.trim()) return;
    await onAddSupplier(name, phone);
    setName('');
    setPhone('');
    setShowAddSupplier(false);
  };

  const ranked = suppliers
    .map((s) => ({ supplier: s, owed: owedTo(s.id) }))
    .sort((a, b) => b.owed - a.owed);

  return (
    <div className="space-y-3">
      <div className="sheet">
        <div className="flex items-baseline justify-between">
          <span className="sheet-heading">You owe</span>
          <span className="text-2xl amount text-destructive">{money(totalOwed)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Suppliers</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAddSupplier(!showAddSupplier)}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {showAddSupplier && (
        <div className="sheet space-y-2">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowAddSupplier(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleAddSupplier} disabled={!name.trim()}>Save</Button>
          </div>
        </div>
      )}

      {ranked.length === 0 ? (
        <div className="sheet">
          <p className="text-sm text-muted-foreground">
            Nobody added yet. Suppliers appear here when you take stock on credit, or you
            can add one now.
          </p>
        </div>
      ) : (
        <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
          {ranked.map(({ supplier, owed }) => (
            <button
              key={supplier.id}
              onClick={() => setSelectedSupplier(supplier)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{supplier.name}</p>
                <p className="text-xs text-muted-foreground truncate">{supplier.phone || 'No number'}</p>
              </div>
              {owed > 0 ? (
                <span className="amount text-destructive shrink-0">{money(owed)}</span>
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
