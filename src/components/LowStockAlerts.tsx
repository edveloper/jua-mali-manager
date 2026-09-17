import { useMemo, useState } from 'react';
import { AlertTriangle, Package, Search } from 'lucide-react';
import { Product, Sale } from '@/types/inventory';
import { needsReordering, describeRunOut } from '@/lib/restockTiming';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LowStockAlertsProps {
  /** Every product, not a pre-filtered list: the screen decides what qualifies. */
  products: Product[];
  sales: Sale[];
  onRestock?: (product: Product) => void;
}

export function LowStockAlerts({ products, sales, onRestock }: LowStockAlertsProps) {
  const [query, setQuery] = useState('');

  // Already ordered by how soon each one runs out, so the top of the list is
  // the thing to buy first rather than the thing furthest below its threshold.
  const needed = useMemo(() => needsReordering(products, sales), [products, sales]);

  // A shop with a long catalogue can have dozens of things to reorder at once,
  // and scrolling a reorder list looking for one name is how items get missed.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return needed;
    return needed.filter((row) => row.product.name.toLowerCase().includes(q));
  }, [needed, query]);

  const heading = 'Nothing is running out';
  const subheading = 'Nothing is low, and nothing is selling fast enough to worry about';
  const alertTitle = `${needed.length} to reorder`;
  const thresholdLabel = 'Warn at';
  const restockAction = 'Restock';
  const remainingLabel = 'left';

  if (needed.length === 0) {
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
        {shown.map((row) => {
          const product = row.product;
          return (
            <div
              key={product.id}
              className="bg-card rounded-xl p-4 border border-warning/30 bg-warning/5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                  {/*
                    * How soon it goes, where we can say it honestly. "Warn at 5"
                    * is a number the owner set once and has probably forgotten;
                    * "Saturday" is a decision about this week.
                    */}
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {row.confident
                      ? `Runs out ${describeRunOut(row).toLowerCase()} · about ${
                          row.perDay >= 1 ? Math.round(row.perDay) : row.perDay.toFixed(1)
                        } a day`
                      : `${thresholdLabel}: ${product.lowStockThreshold}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-bold text-warning num">{product.quantity}</p>
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
          );
        })}
      </div>
    </div>
  );
}
