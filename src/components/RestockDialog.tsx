import { useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { Product, RestockInput } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PAYMENT_METHODS, PaymentMethod, lastUsedMethod, rememberMethod } from '@/lib/payment';
import { todayKey } from '@/lib/dates';
import { money } from '@/lib/money';

interface RestockDialogProps {
  product: Product;
  onRestock: (input: RestockInput) => Promise<void>;
  onClose: () => void;
  /** Taking stock on credit is a debt the owner takes on, so staff cannot. */
  canTakeOnCredit?: boolean;
  /** Cost drives every margin figure, so only the owner sets it. */
  canSetCost?: boolean;
  suppliers: { id: string; name: string }[];
  onAddSupplier: (name: string) => Promise<{ id: string } | null>;
}


const num = (s: string) => {
  const parsed = Number(s);
  return s.trim() !== '' && Number.isFinite(parsed) ? parsed : 0;
};

export function RestockDialog({
  product, onRestock, onClose, suppliers, onAddSupplier,
  canTakeOnCredit = true, canSetCost = true,
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
  /*
   * Buying by the crate and selling by the bottle.
   *
   * Opens in whichever mode the product is set up for, because a bar that buys
   * beer in crates buys it in crates every time. The two modes are separate
   * descriptions of one delivery, never mixed: what goes to the database is a
   * pack count and a pack price, or a unit count and a unit price.
   */
  const [byPack, setByPack] = useState(Boolean(product.unitsPerPack));
  const [packCountInput, setPackCountInput] = useState('');
  const [unitsPerPackInput, setUnitsPerPackInput] = useState(
    product.unitsPerPack ? String(product.unitsPerPack) : ''
  );
  const [packCostInput, setPackCostInput] = useState('');

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
  const [confirming, setConfirming] = useState(false);

  const packLabel = (product.packLabel || 'pack').trim();

  const packCount = Math.max(0, Math.floor(num(packCountInput)));
  const unitsPerPack = Math.max(0, Math.floor(num(unitsPerPackInput)));
  const packCost = num(packCostInput);

  const singles = Math.max(0, Math.floor(num(quantityInput)));
  const singleCost = canSetCost ? num(unitCostInput) : product.costPrice;

  const quantity = byPack ? packCount * unitsPerPack : singles;
  /*
   * The total is what was actually handed over, so it is the figure everything
   * else is derived from. Going the other way, rounding a pack price down to a
   * unit price and multiplying back up, turns 2,500 for a carton of 24 into
   * 2,500.08. The database does the same division again for the same reason;
   * this one only exists so the shopkeeper can see it before confirming.
   */
  const totalCost = byPack
    ? (canSetCost ? packCount * packCost : quantity * product.costPrice)
    : singles * singleCost;
  const unitCost = quantity > 0 ? totalCost / quantity : 0;

  // Nothing typed yet is not an error, it is just the starting state.
  const quantityError = byPack
    ? (packCountInput.trim() === '' ? '' : packCount < 1 ? 'At least 1' : '')
    : (quantityInput.trim() === '' ? '' : singles < 1 ? 'At least 1' : '');
  const unitsError =
    byPack && unitsPerPackInput.trim() !== '' && unitsPerPack < 2 ? 'At least 2' : '';
  const costError = (byPack ? packCost : singleCost) < 0 ? 'Cost cannot be negative' : '';

  const handleConfirm = async () => {
    if (quantity < 1 || totalCost < 0) return;
    setConfirming(false);

    let resolvedSupplier = supplierId;
    if (!paidNow && !resolvedSupplier && newSupplier.trim()) {
      const created = await onAddSupplier(newSupplier.trim());
      if (!created) return;
      resolvedSupplier = created.id;
    }
    if (!paidNow && !resolvedSupplier) return;

    setIsSaving(true);
    await onRestock({
      productId: product.id,
      happenedAt,
      allocationMode,
      notes: notes.trim() || undefined,
      paidNow,
      supplierId: paidNow ? undefined : resolvedSupplier,
      paymentMethod: paidNow ? paymentMethod : undefined,
      ...(byPack
        ? {
            packCount,
            unitsPerPack,
            // Staff cannot set cost, and the database ignores whatever arrives
            // from them anyway. Sending the item's own cost keeps the payload
            // honest rather than sending a zero that would read as free.
            packCost: canSetCost ? packCost : product.costPrice * unitsPerPack,
          }
        : { quantity: singles, unitCost: singleCost }),
    });
    setIsSaving(false);
    if (paidNow) rememberMethod(paymentMethod);
    onClose();
  };

  const canSave =
    quantity >= 1 &&
    (!byPack || unitsPerPack >= 2) &&
    !costError &&
    (paidNow || Boolean(supplierId) || Boolean(newSupplier.trim()));

  if (confirming) {
    return (
      <ConfirmDialog
        title="Add this stock?"
        message={
          <>
            Adding stock changes what this item costs you, which changes every
            profit figure for it. Worth a second look before it goes in.
          </>
        }
        details={[
          { label: 'Item', value: product.name },
          {
            label: 'Coming In',
            value: byPack
              ? `${packCount} x ${packLabel} of ${unitsPerPack} = ${quantity}`
              : `${quantity}`,
          },
          { label: 'Cost for One', value: `KSh ${money(unitCost)}` },
          { label: paidNow ? 'Paying now' : 'Going on credit', value: `KSh ${money(totalCost)}` },
          { label: 'Stock After', value: `${product.quantity + quantity}` },
        ]}
        confirmLabel="Yes, Add It"
        cancelLabel="Let Me Check"
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
      />
    );
  }

  return (
    <Modal
      title="Add Stock"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={() => setConfirming(true)} disabled={isSaving || !canSave}>
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

      {/*
        * Asked before the numbers, because it changes what the numbers mean.
        * A bar buying five crates and typing 5 into "how many came in" ends up
        * with five bottles on the shelf and a cost basis of three thousand a
        * bottle, and every margin figure for that product is wrong from then on.
        */}
      <div className="space-y-1.5">
        <Label>How did it come?</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={byPack ? 'outline' : 'default'}
            onClick={() => setByPack(false)}
          >
            Singles
          </Button>
          <Button
            type="button"
            variant={byPack ? 'default' : 'outline'}
            onClick={() => setByPack(true)}
          >
            By the {packLabel}
          </Button>
        </div>
      </div>

      {byPack ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="restock-packs">How many {packLabel}s?</Label>
              <Input
                id="restock-packs"
                type="number"
                inputMode="numeric"
                min={1}
                step="1"
                placeholder="e.g. 5"
                value={packCountInput}
                onChange={(e) => setPackCountInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="num"
              />
              {quantityError && <p className="text-xs text-destructive">{quantityError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="restock-per-pack">How many in each?</Label>
              <Input
                id="restock-per-pack"
                type="number"
                inputMode="numeric"
                min={2}
                step="1"
                placeholder="e.g. 24"
                value={unitsPerPackInput}
                onChange={(e) => setUnitsPerPackInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="num"
              />
              {unitsError && <p className="text-xs text-destructive">{unitsError}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="restock-pack-cost">Cost of one {packLabel}</Label>
            {canSetCost ? (
              <>
                <Input
                  id="restock-pack-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={packCostInput}
                  onChange={(e) => setPackCostInput(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="num"
                />
                {costError && <p className="text-xs text-destructive">{costError}</p>}
              </>
            ) : (
            <>
              {/* Shown, not editable. Cost drives the weighted average and so
                  every margin figure for this item, which is not the counter's
                  to change. The database refuses it either way. */}
              <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 num text-sm">
                {money(product.costPrice)}
              </div>
              <p className="text-xs text-muted-foreground">
                Set by the owner. If the price has changed, tell them.
              </p>
            </>
            )}
          </div>

          {/* The arithmetic, shown before it is committed. This is the number
              that becomes the cost basis, and it is the one worth checking. */}
          {quantity > 0 && (
            <div className="sheet">
              <div className="ledger-line">
                <span className="text-muted-foreground">That is</span>
                <span className="num">{quantity} units</span>
              </div>
              <div className="ledger-line">
                <span className="text-muted-foreground">Each one costs</span>
                <span className="amount">{money(unitCost)}</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="restock-qty">How many came in?</Label>
            <Input
              id="restock-qty"
              type="number"
              inputMode="numeric"
              min={1}
              step="1"
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
            {canSetCost ? (
              <>
                <Input
                  id="restock-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={unitCostInput}
                  onChange={(e) => setUnitCostInput(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="num"
                />
                {costError && <p className="text-xs text-destructive">{costError}</p>}
              </>
            ) : (
            <>
              {/* Shown, not editable. Cost drives the weighted average and so
                  every margin figure for this item, which is not the counter's
                  to change. The database refuses it either way. */}
              <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 num text-sm">
                {money(product.costPrice)}
              </div>
              <p className="text-xs text-muted-foreground">
                Set by the owner. If the price has changed, tell them.
              </p>
            </>
            )}
          </div>
        </div>
      )}

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
