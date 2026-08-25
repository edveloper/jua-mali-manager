import { useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/Modal';
import { PAYMENT_METHODS, PaymentMethod, lastUsedMethod, rememberMethod } from '@/lib/payment';
import { todayKey } from '@/lib/dates';

interface RestockDialogProps {
  product: Product;
  onRestock: (
    productId: string,
    quantity: number,
    unitCost: number,
    happenedAt: string,
    allocationMode: 'cash' | 'accrual',
    notes: string | undefined,
    paidNow: boolean,
    supplierId?: string,
    paymentMethod?: string
  ) => Promise<void>;
  onClose: () => void;
  /** Taking stock on credit is a debt the owner takes on, so staff cannot. */
  canTakeOnCredit?: boolean;
  suppliers: { id: string; name: string }[];
  onAddSupplier: (name: string) => Promise<{ id: string } | null>;
}

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 2 });

const num = (s: string) => {
  const parsed = Number(s);
  return s.trim() !== '' && Number.isFinite(parsed) ? parsed : 0;
};

export function RestockDialog({
  product, onRestock, onClose, suppliers, onAddSupplier, canTakeOnCredit = true,
}: RestockDialogProps) {
  /*
   * Both figures are free text rather than numbers.
   *
   * They used to be clamped on every keystroke, Math.max(1, parseInt(...)), so
   * the field could never be empty and never hold a half-typed number. Typing 50
   * over a 1 gave you 150, and there was no way back to an empty box. Held as
   * text, the field does what the person typing expects, and the value is only
   * interpreted where it is actually used.
   *
   * Quantity starts empty because there is no sensible guess. Cost is prefilled
   * with what this item cost last time, which usually is the answer, and selects
   * itself on focus so replacing it is one tap rather than a row of backspaces.
   */
  const [quantityInput, setQuantityInput] = useState('');
  const [unitCostInput, setUnitCostInput] = useState(
    product.costPrice ? String(product.costPrice) : ''
  );
  const [happenedAt, setHappenedAt] = useState(todayKey());
  const [allocationMode, setAllocationMode] = useState<'cash' | 'accrual'>('cash');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [paidNow, setPaidNow] = useState(true);
  const [supplierId, setSupplierId] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(lastUsedMethod);

  const quantity = Math.max(0, Math.floor(num(quantityInput)));
  const unitCost = num(unitCostInput);
  const totalCost = quantity * unitCost;

  // Nothing typed yet is not an error, it is just the starting state.
  const quantityError = quantityInput.trim() === '' ? '' : quantity < 1 ? 'At least 1' : '';
  const costError = unitCost < 0 ? 'Cost cannot be negative' : '';

  const handleConfirm = async () => {
    if (quantity < 1 || unitCost < 0) return;

    let resolvedSupplier = supplierId;
    if (!paidNow && !resolvedSupplier && newSupplier.trim()) {
      const created = await onAddSupplier(newSupplier.trim());
      if (!created) return;
      resolvedSupplier = created.id;
    }
    if (!paidNow && !resolvedSupplier) return;

    setIsSaving(true);
    await onRestock(
      product.id, quantity, unitCost, happenedAt, allocationMode,
      notes.trim() || undefined, paidNow,
      paidNow ? undefined : resolvedSupplier,
      paidNow ? paymentMethod : undefined
    );
    setIsSaving(false);
    if (paidNow) rememberMethod(paymentMethod);
    onClose();
  };

  const canSave =
    quantity >= 1 &&
    !costError &&
    (paidNow || Boolean(supplierId) || Boolean(newSupplier.trim()));

  return (
    <Modal
      title="Add stock"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={isSaving || !canSave}>
            <PackagePlus className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="bg-muted rounded-lg p-4">
        <p className="font-semibold text-foreground">{product.name}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {product.quantity} in stock now · last cost KSh {money(product.costPrice)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="restock-qty">How many came in?</Label>
          <Input
            id="restock-qty"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="e.g. 50"
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="num"
          />
          {quantityError && <p className="text-xs text-destructive">{quantityError}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="restock-cost">Cost for one</Label>
          <Input
            id="restock-cost"
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="0"
            value={unitCostInput}
            onChange={(e) => setUnitCostInput(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="num"
          />
          {costError && <p className="text-xs text-destructive">{costError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="restock-date">When did it arrive?</Label>
          <Input
            id="restock-date"
            type="date"
            value={happenedAt}
            onChange={(e) => setHappenedAt(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="restock-basis">Count the cost</Label>
          <select
            id="restock-basis"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={allocationMode}
            onChange={(e) => setAllocationMode(e.target.value as 'cash' | 'accrual')}
          >
            <option value="cash">On the day paid</option>
            <option value="accrual">Spread over time</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="restock-notes">Notes</Label>
        <Input
          id="restock-notes"
          placeholder="Anything worth remembering. Optional."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Stock arriving and money leaving are separate events. On credit the
          cash has not moved, so no spending is recorded until you pay. */}
      {canTakeOnCredit ? (
        <div className="space-y-1.5">
          <Label>Did you pay for it?</Label>
          <div className="flex gap-2">
            <Button variant={paidNow ? 'default' : 'outline'} className="flex-1" onClick={() => setPaidNow(true)}>
              Paid now
            </Button>
            <Button variant={!paidNow ? 'default' : 'outline'} className="flex-1" onClick={() => setPaidNow(false)}>
              On credit
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          For stock that has already been paid for. If it was taken on credit, ask the
          owner to record it.
        </p>
      )}

      {paidNow ? (
        <div className="space-y-1.5">
          <Label>How did you pay?</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <Button
                key={m.value}
                variant={paymentMethod === m.value ? 'default' : 'outline'}
                size="sm"
                className="px-1 text-xs"
                onClick={() => setPaymentMethod(m.value)}
              >
                {m.short}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="restock-supplier">Who did you take it from?</Label>
          {suppliers.length > 0 && (
            <select
              id="restock-supplier"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Someone new...</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {!supplierId && (
            <Input
              placeholder="Supplier name"
              value={newSupplier}
              onChange={(e) => setNewSupplier(e.target.value)}
              aria-label="Supplier name"
            />
          )}
          <p className="text-xs text-muted-foreground">
            This goes to what you owe. No spending is recorded until you pay them.
          </p>
        </div>
      )}

      <div className="ledger-total flex items-baseline justify-between">
        <span className="font-semibold">{paidNow ? 'You are paying' : 'You will owe'}</span>
        <span className="text-xl amount">
          {quantity >= 1 ? `KSh ${money(totalCost)}` : 'KSh 0'}
        </span>
      </div>
      {quantity >= 1 && unitCost > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {quantity} × {money(unitCost)}
        </p>
      )}
    </Modal>
  );
}
