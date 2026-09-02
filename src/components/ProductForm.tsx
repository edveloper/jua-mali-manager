import { useState, useEffect } from 'react';
import { Product } from '@/types/inventory';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/Modal';
import { ksh } from '@/lib/money';

interface ProductFormProps {
  product?: Product | null;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

export function ProductForm({ product, onSave, onClose }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    costPrice: '',
    sellingPrice: '',
    minPrice: '',
    maxPrice: '',
    quantity: '',
    lowStockThreshold: '5',
    durationMinutes: '0',
    category: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        costPrice: product.costPrice.toString(),
        sellingPrice: product.sellingPrice.toString(),
        minPrice: product.minPrice === null || product.minPrice === undefined ? '' : String(product.minPrice),
        maxPrice: product.maxPrice === null || product.maxPrice === undefined ? '' : String(product.maxPrice),
        quantity: product.quantity.toString(),
        lowStockThreshold: product.lowStockThreshold.toString(),
        durationMinutes: String(product.durationMinutes || 0),
        category: product.category || '',
      });
    }
  }, [product]);

  // Blank means "no limit on this side", which is why these aren't parseFloat|0.
  const optionalNumber = (value: string) => {
    if (value.trim() === '') return null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const minPriceValue = optionalNumber(formData.minPrice);
  const maxPriceValue = optionalNumber(formData.maxPrice);
  const bandInverted =
    minPriceValue !== null && maxPriceValue !== null && minPriceValue > maxPriceValue;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bandInverted) return;

    onSave({
      name: formData.name,
      costPrice: parseFloat(formData.costPrice) || 0,
      sellingPrice: parseFloat(formData.sellingPrice) || 0,
      minPrice: minPriceValue,
      maxPrice: maxPriceValue,
      quantity: parseInt(formData.quantity) || 0,
      lowStockThreshold: parseInt(formData.lowStockThreshold) || 5,
      durationMinutes: parseInt(formData.durationMinutes) || 0,
      category: formData.category || undefined,
    });
  };

  const profit = (parseFloat(formData.sellingPrice) || 0) - (parseFloat(formData.costPrice) || 0);

  return (
    <Modal
      title={product ? 'Edit product' : 'Add product'}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={bandInverted}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="name">Product name *</Label>
        <Input
          id="name"
          placeholder="e.g. Unga wa Ngano (2kg)"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="costPrice">What it costs you *</Label>
          <Input
            id="costPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0"
            value={formData.costPrice}
            onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
            required
            min="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sellingPrice">What you sell it for *</Label>
          <Input
            id="sellingPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0"
            value={formData.sellingPrice}
            onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
            required
            min="0"
          />
        </div>
      </div>

      {(
        <div className="space-y-2 rounded-xl border border-border p-3">
          <Label>Negotiable price range (Optional)</Label>
          <p className="text-xs text-muted-foreground">
            If staff are allowed to agree a price with the customer, set how low and
            how high they may go. Leave blank to keep the price fixed.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="Lowest"
              aria-label="Lowest price staff may agree"
              value={formData.minPrice}
              onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
              min="0"
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="Highest"
              aria-label="Highest price staff may agree"
              value={formData.maxPrice}
              onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
              min="0"
            />
          </div>
          {bandInverted && (
            <p className="text-xs text-destructive">
              The lowest price cannot be higher than the highest.
            </p>
          )}
        </div>
      )}

      {profit !== 0 && (
        <div className={`p-3 rounded-lg ${profit > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          <p className="text-sm font-medium">
            Profit per item: {ksh(profit)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="quantity">How many you have *</Label>
          <Input
            id="quantity"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="0"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            required
            min="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lowStockThreshold">Warn me at</Label>
          <Input
            id="lowStockThreshold"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="5"
            value={formData.lowStockThreshold}
            onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
            min="0"
          />
        </div>
      </div>


      <div className="space-y-2">
        <Label htmlFor="category">Category (Optional)</Label>
        <Input
          id="category"
          placeholder="e.g. Food, Dairy, Soap"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        />
      </div>

    </Modal>
  );
}
