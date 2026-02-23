import { AlertTriangle, Package } from 'lucide-react';
import { Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';

interface LowStockAlertsProps {
  products: Product[];
  onRestock?: (product: Product) => void;
  offeringMode?: 'products' | 'services' | 'mixed' | string;
}

export function LowStockAlerts({ products, onRestock, offeringMode = 'products' }: LowStockAlertsProps) {
  const nounPlural = offeringMode === 'services' ? 'services' : offeringMode === 'mixed' ? 'items' : 'products';
  const heading = offeringMode === 'services' ? 'Availability Looks Good!' : 'All Stocked Up!';
  const subheading = offeringMode === 'services' ? 'No services are running low on capacity' : `No ${nounPlural} are running low`;
  const alertTitle = offeringMode === 'services' ? `${products.length} Services Need Capacity Update` : `${products.length} Items Need Restocking`;
  const thresholdLabel = offeringMode === 'services' ? 'Min capacity' : 'Threshold';
  const restockAction = offeringMode === 'services' ? 'Update Capacity' : 'Update Stock';
  const remainingLabel = offeringMode === 'services' ? 'slots left' : 'remaining';

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
      
      <div className="space-y-2">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-card rounded-xl p-4 border border-warning/30 bg-warning/5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {thresholdLabel}: {product.lowStockThreshold} {offeringMode === 'services' ? 'slots' : 'units'}
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
