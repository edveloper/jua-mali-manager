import { useState } from 'react';
import { X, Minus, Plus, ShoppingCart } from 'lucide-react';
import { Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SellDialogProps {
  product: Product;
  onSell: (productId: string, quantity: number) => void;
  onClose: () => void;
}

export function SellDialog({ product, onSell, onClose }: SellDialogProps) {
  const [quantity, setQuantity] = useState(1);

  const handleSell = () => {
    if (quantity > 0 && quantity <= product.quantity) {
      onSell(product.id, quantity);
      onClose();
    }
  };

  const total = product.sellingPrice * quantity;
  const profit = (product.sellingPrice - product.costPrice) * quantity;

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl animate-slide-up">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Record Sale</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="bg-muted rounded-xl p-4">
            <h3 className="font-semibold text-foreground">{product.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Price: KSh {product.sellingPrice.toLocaleString()} | Stock: {product.quantity}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Quantity</label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.min(product.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                className="text-center text-lg font-semibold"
                min={1}
                max={product.quantity}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))}
                disabled={quantity >= product.quantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="bg-muted rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-bold text-lg">KSh {total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Profit</span>
              <span className="font-semibold text-success">KSh {profit.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSell}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Complete Sale
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
