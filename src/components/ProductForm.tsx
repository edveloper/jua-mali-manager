import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Product } from '@/types/inventory';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ProductFormProps {
  product?: Product | null;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
  offeringMode?: 'products' | 'services' | 'mixed' | string;
}

export function ProductForm({ product, onSave, onClose, offeringMode = 'products' }: ProductFormProps) {
  const itemLabel = offeringMode === 'services' ? 'Service' : offeringMode === 'mixed' ? 'Item' : 'Product';
  const costLabel = offeringMode === 'services' ? 'Direct Cost (KSh)' : 'Cost Price (KSh)';
  const sellLabel = offeringMode === 'services' ? 'Service Price (KSh)' : 'Selling Price (KSh)';
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
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-card p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {product ? `Edit ${itemLabel}` : `Add ${itemLabel}`}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{itemLabel} Name *</Label>
            <Input
              id="name"
              placeholder={offeringMode === 'services' ? 'e.g., Haircut + Wash' : 'e.g., Unga wa Ngano (2kg)'}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="costPrice">{costLabel} *</Label>
              <Input
                id="costPrice"
                type="number"
                placeholder="0"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                required
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellingPrice">{sellLabel} *</Label>
              <Input
                id="sellingPrice"
                type="number"
                placeholder="0"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                required
                min="0"
              />
            </div>
          </div>

          {offeringMode !== 'services' && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <Label>Negotiable price range (Optional)</Label>
              <p className="text-xs text-muted-foreground">
                If staff are allowed to agree a price with the customer, set how low and
                how high they may go. Leave blank to keep the price fixed.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Lowest"
                  value={formData.minPrice}
                  onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="Highest"
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
                Profit per item: KSh {profit.toLocaleString()}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">{offeringMode === 'services' ? 'Daily Slots / Units *' : 'Quantity *'}</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lowStockThreshold">{offeringMode === 'services' ? 'Low Availability Alert' : 'Low Stock Alert'}</Label>
              <Input
                id="lowStockThreshold"
                type="number"
                placeholder="5"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                min="0"
              />
            </div>
          </div>

          {offeringMode === 'services' && (
            <div className="space-y-2">
              <Label htmlFor="durationMinutes">Duration (minutes)</Label>
              <Input
                id="durationMinutes"
                type="number"
                min="0"
                placeholder="30"
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="category">Category (Optional)</Label>
            <Input
              id="category"
              placeholder={offeringMode === 'services' ? 'e.g., Grooming, Printing, Transport' : 'e.g., Food, Dairy, Electronics'}
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={bandInverted}>
              {product ? `Update ${itemLabel}` : `Add ${itemLabel}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
