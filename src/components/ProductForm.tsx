import { useState, useEffect } from 'react';
import { X, Barcode } from 'lucide-react';
import { Product } from '@/types/inventory';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ProductFormProps {
  product?: Product | null;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

export function ProductForm({ product, onSave, onClose }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    costPrice: '',
    sellingPrice: '',
    quantity: '',
    lowStockThreshold: '5',
    category: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        barcode: product.barcode || '',
        costPrice: product.costPrice.toString(),
        sellingPrice: product.sellingPrice.toString(),
        quantity: product.quantity.toString(),
        lowStockThreshold: product.lowStockThreshold.toString(),
        category: product.category || '',
      });
    }
  }, [product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSave({
      name: formData.name,
      barcode: formData.barcode || undefined,
      costPrice: parseFloat(formData.costPrice) || 0,
      sellingPrice: parseFloat(formData.sellingPrice) || 0,
      quantity: parseInt(formData.quantity) || 0,
      lowStockThreshold: parseInt(formData.lowStockThreshold) || 5,
      category: formData.category || undefined,
    });
  };

  const profit = (parseFloat(formData.sellingPrice) || 0) - (parseFloat(formData.costPrice) || 0);

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-card p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {product ? 'Edit Product' : 'Add Product'}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Unga wa Ngano (2kg)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode (Optional)</Label>
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="barcode"
                placeholder="Scan or enter barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="costPrice">Cost Price (KSh) *</Label>
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
              <Label htmlFor="sellingPrice">Selling Price (KSh) *</Label>
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

          {profit !== 0 && (
            <div className={`p-3 rounded-lg ${profit > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
              <p className="text-sm font-medium">
                Profit per item: KSh {profit.toLocaleString()}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
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
              <Label htmlFor="lowStockThreshold">Low Stock Alert</Label>
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

          <div className="space-y-2">
            <Label htmlFor="category">Category (Optional)</Label>
            <Input
              id="category"
              placeholder="e.g., Food, Dairy, Electronics"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {product ? 'Update' : 'Add Product'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
