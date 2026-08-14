import { useEffect, useState } from 'react';
import { Search, Plus, Package, AlertTriangle, Edit2, Trash2, PackagePlus } from 'lucide-react';
import { Product } from '@/types/inventory';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ProductListProps {
  products: Product[];
  onSearch: (query: string) => Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onSell: (product: Product) => void;
  onRestock?: (product: Product) => void;
  isOwner?: boolean;
  offeringMode?: 'products' | 'services' | 'mixed' | string;
}

const PAGE_SIZE = 15;

export function ProductList({ products, onSearch, onEdit, onDelete, onAdd, onSell, onRestock, isOwner = true, offeringMode = 'products' }: ProductListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const displayProducts = searchQuery ? onSearch(searchQuery) : products;

  // A new search is a new list, so start from the top again.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery]);

  const visibleProducts = displayProducts.slice(0, visibleCount);
  const remainingCount = displayProducts.length - visibleProducts.length;
  const itemLabel = offeringMode === 'services' ? 'service' : offeringMode === 'mixed' ? 'item' : 'product';
  const itemLabelPlural = offeringMode === 'services' ? 'services' : offeringMode === 'mixed' ? 'items' : 'products';
  const sellAction = offeringMode === 'services' ? 'Record Service' : 'Sell';
  
  const formatCurrency = (amount: number) => `KSh ${amount.toLocaleString()}`;

  const isLowStock = (product: Product) => product.quantity <= product.lowStockThreshold;

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={offeringMode === 'services' ? 'Search services...' : `Search ${itemLabelPlural} or scan barcode...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {isOwner && (
          <Button onClick={onAdd} size="icon">
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {displayProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No {itemLabelPlural} found</p>
            {isOwner && (
              <Button variant="outline" className="mt-4" onClick={onAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add First {itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)}
              </Button>
            )}
          </div>
        ) : (
          visibleProducts.map((product) => (
            <div
              key={product.id}
              className={`bg-card rounded-xl p-4 border transition-all duration-200 hover:shadow-md ${
                isLowStock(product) ? 'border-warning/50 bg-warning/5' : 'border-border/50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                    {isLowStock(product) && (
                      <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                    )}
                  </div>
                  {product.barcode && (
                    <p className="text-xs text-muted-foreground mt-0.5">{product.barcode}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    {/* Only show cost price to owners */}
                    {isOwner && (
                      <span className="text-sm text-muted-foreground">
                        Cost: {formatCurrency(product.costPrice)}
                      </span>
                    )}
                    <span className="text-sm font-medium text-secondary">
                      Sell: {formatCurrency(product.sellingPrice)}
                    </span>
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-bold ${isLowStock(product) ? 'text-warning' : 'text-foreground'}`}>
                    {product.quantity}
                  </p>
                  <p className="text-xs text-muted-foreground">{offeringMode === 'services' ? 'available' : 'in stock'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <Button
                  variant="success"
                  size="sm"
                  className="flex-1"
                  onClick={() => onSell(product)}
                  disabled={product.quantity === 0}
                >
                  {sellAction}
                </Button>
                {isOwner && (
                  <>
                    {offeringMode !== 'services' && onRestock && (
                      <Button variant="ghost" size="icon-sm" onClick={() => onRestock(product)} title="Restock">
                        <PackagePlus className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-sm" onClick={() => onEdit(product)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onDelete(product.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {remainingCount > 0 && (
          <div className="pt-2 space-y-2">
            <Button variant="outline" className="w-full" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              Show {Math.min(remainingCount, PAGE_SIZE)} more
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Showing {visibleProducts.length} of {displayProducts.length}. Search to jump
              straight to {offeringMode === 'services' ? 'a service' : 'an item'}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
