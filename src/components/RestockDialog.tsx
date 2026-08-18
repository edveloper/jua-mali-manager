import { useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/Modal';
import { PAYMENT_METHODS, PaymentMethod, lastUsedMethod, rememberMethod } from '@/lib/payment';

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
  suppliers: { id: string; name: string }[];
  onAddSupplier: (name: string) => Promise<{ id: string } | null>;
}

export function RestockDialog({ product, onRestock, onClose, suppliers, onAddSupplier }: RestockDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(product.costPrice || 0);
  const [happenedAt, setHappenedAt] = useState(new Date().toISOString().split('T')[0]);
  const [allocationMode, setAllocationMode] = useState<'cash' | 'accrual'>('cash');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [paidNow, setPaidNow] = useState(true);
  const [supplierId, setSupplierId] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(lastUsedMethod);

  const totalCost = quantity * unitCost;

  const handleConfirm = async () => {
    if (quantity <= 0 || unitCost < 0) return;

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

  const canSave = quantity > 0 && (paidNow || Boolean(supplierId) || Boolean(newSupplier.trim()));

  return (
    <Modal
      title="Restock product"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={isSaving || !canSave}>
            <PackagePlus className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Confirm restock'}
          </Button>
        </>
      }
    >
      <div className="bg-muted rounded-xl p-4">
        <p className="font-semibold text-foreground">{product.name}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Current stock: {product.quantity} | Current cost: KSh {product.costPrice.toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))}
          placeholder="Qty added"
        />
        <Input
          type="number"
          min={0}
          value={unitCost}
          onChange={(e) => setUnitCost(Math.max(0, Number(e.target.value || 0)))}
          placeholder="Unit cost"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          type="date"
          value={happenedAt}
          onChange={(e) => setHappenedAt(e.target.value)}
        />
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={allocationMode}
          onChange={(e) => setAllocationMode(e.target.value as 'cash' | 'accrual')}
        >
          <option value="cash">Cash basis</option>
          <option value="accrual">Accrual basis</option>
        </select>
      </div>

      <Input
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {/* Stock arriving and money leaving are separate events. On credit the
          cash has not moved, so no spending is recorded until you pay. */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Did you pay for it?</label>
        <div className="flex gap-2">
          <Button variant={paidNow ? 'default' : 'outline'} className="flex-1" onClick={() => setPaidNow(true)}>
            Paid now
          </Button>
          <Button variant={!paidNow ? 'default' : 'outline'} className="flex-1" onClick={() => setPaidNow(false)}>
            On credit
          </Button>
        </div>
      </div>

      {paidNow ? (
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
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium">Who did you take it from?</label>
          {suppliers.length > 0 && (
            <select
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
            />
          )}
          <p className="text-xs text-muted-foreground">
            This goes to what you owe. No spending is recorded until you pay them.
          </p>
        </div>
      )}

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
        <p className="text-sm text-muted-foreground">{paidNow ? 'You are paying' : 'You will owe'}</p>
        <p className="text-lg font-bold text-primary">KSh {totalCost.toLocaleString()}</p>
      </div>
    </Modal>
  );
}
