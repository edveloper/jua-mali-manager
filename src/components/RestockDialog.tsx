import { useState } from 'react';
import { X, PackagePlus } from 'lucide-react';
import { Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface RestockDialogProps {
  product: Product;
  onRestock: (
    productId: string,
    quantity: number,
    unitCost: number,
    happenedAt: string,
    allocationMode: 'cash' | 'accrual',
    notes?: string
  ) => Promise<void>;
  onClose: () => void;
}

export function RestockDialog({ product, onRestock, onClose }: RestockDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(product.costPrice || 0);
  const [happenedAt, setHappenedAt] = useState(new Date().toISOString().split('T')[0]);
  const [allocationMode, setAllocationMode] = useState<'cash' | 'accrual'>('cash');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const totalCost = quantity * unitCost;

  const handleConfirm = async () => {
    if (quantity <= 0 || unitCost < 0) return;
    setIsSaving(true);
    await onRestock(product.id, quantity, unitCost, happenedAt, allocationMode, notes.trim() || undefined);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-lg animate-slide-up">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Restock Product</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
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

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-sm text-muted-foreground">Estimated purchase value</p>
            <p className="text-lg font-bold text-primary">KSh {totalCost.toLocaleString()}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={isSaving}>
              <PackagePlus className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Confirm Restock'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
