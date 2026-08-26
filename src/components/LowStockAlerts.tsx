import { useMemo, useState } from 'react';
import { AlertTriangle, Package, Search } from 'lucide-react';
import { Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LowStockAlertsProps {
  products: Product[];
  onRestock?: (product: Product) => void;
}

export function LowStockAlerts({ products, onRestock }: LowStockAlertsProps) {
  const [query, setQuery] = useState('');

  // A shop with a long catalogue can have dozens of things to reorder at once,
  // and scrolling a reorder list looking for one name is how items get missed.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  const heading = 'Nothing is running out';
  const subheading = 'Every product is above the level you set';
  const alertTitle = `${products.length} to reorder`;
  const thresholdLabel = 'Warn at';
  const restockAction = 'Restock';
  const remainingLabel = 'left';

  if (products.length === 0) {
    return (
      <div className="text-center py-12 animate-slide-up">
        <div className="bg-success/10 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Package className="h-8 w-8 text-success" />
        </div>
        <h3 className="font-semibold text-foreground">{heading}</h3>
        <p className="text-muted-foreground mt-1">{subheading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center gap-2 text-warning">
        <AlertTriangle className="h-5 w-5" />
        <h2 className="font-semibold">{alertTitle}</h2>
      </div>

      {products.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Find an item"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            aria-label="Search items to reorder"
          />
        </div>
      )}

      {shown.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nothing here matches that.
        </p>
      )}

      <div className="space-y-2">
        {shown.map((product) => (
          <div
            key={product.id}
            className="bg-card rounded-xl p-4 border border-warning/30 bg-warning/5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {thresholdLabel}: {product.lowStockThreshold}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-warning">{product.quantity}</p>
                <p className="text-xs text-muted-foreground">{remainingLabel}</p>
              </div>
            </div>
            {onRestock && (
              <Button
                variant="warning"
                size="sm"
                className="w-full mt-3"
                onClick={() => onRestock(product)}
              >
                {restockAction}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
