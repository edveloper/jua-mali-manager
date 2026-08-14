import { useEffect, useState } from 'react';
import { Search, Plus, AlertTriangle, Pencil, PackagePlus, Trash2, MoreHorizontal } from 'lucide-react';
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
}

const PAGE_SIZE = 15;
const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });

export function ProductList({
  products, onSearch, onEdit, onDelete, onAdd, onSell, onRestock, isOwner = true,
}: ProductListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);

  const displayProducts = searchQuery ? onSearch(searchQuery) : products;

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchQuery]);

  const visibleProducts = displayProducts.slice(0, visibleCount);
  const remainingCount = displayProducts.length - visibleProducts.length;

  const isLow = (p: Product) => p.quantity <= p.lowStockThreshold;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {isOwner && (
          <Button onClick={onAdd} size="icon" aria-label="Add product">
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>

      {displayProducts.length === 0 ? (
        <div className="sheet text-center py-10">
          <p className="text-muted-foreground text-sm">
            {searchQuery ? 'Nothing matches that.' : 'No products yet.'}
          </p>
          {isOwner && !searchQuery && (
            <Button variant="outline" className="mt-4" onClick={onAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add your first product
            </Button>
          )}
        </div>
      ) : (
        <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
          {visibleProducts.map((product) => {
            const low = isLow(product);
            const open = openId === product.id;

            return (
              <div key={product.id}>
                {/* The whole row sells. Owner tools sit behind a deliberate tap so
                    the everyday action is never a mis-tap away from a delete. */}
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => onSell(product)}
                    disabled={product.quantity === 0}
                    className="flex-1 min-w-0 text-left px-4 py-3 active:bg-muted transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="flex-1 min-w-0 truncate font-medium">{product.name}</span>
                      <span className="amount shrink-0">{money(product.sellingPrice)}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className={`text-xs num ${low ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                        {product.quantity === 0 ? 'Out of stock' : `${product.quantity} left`}
                      </span>
                      {low && product.quantity > 0 && <AlertTriangle className="h-3 w-3 text-warning" />}
                      {isOwner && product.costPrice > 0 && (
                        <span className="text-xs text-muted-foreground num ml-auto">
                          cost {money(product.costPrice)}
                        </span>
                      )}
                    </div>
                  </button>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : product.id)}
                      className="px-3 text-muted-foreground active:bg-muted transition-colors border-l border-border/70"
                      aria-label={`Options for ${product.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {isOwner && open && (
                  <div className="flex items-center gap-2 px-4 pb-3 pt-1 bg-muted/40">
                    {onRestock && (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => { onRestock(product); setOpenId(null); }}>
                        <PackagePlus className="h-4 w-4 mr-1.5" /> Restock
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { onEdit(product); setOpenId(null); }}>
                      <Pencil className="h-4 w-4 mr-1.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { onDelete(product.id); setOpenId(null); }}
                      aria-label="Remove product"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {remainingCount > 0 && (
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            Show {Math.min(remainingCount, PAGE_SIZE)} more
          </Button>
          <p className="text-xs text-muted-foreground text-center num">
            {visibleProducts.length} of {displayProducts.length}
          </p>
        </div>
      )}
    </div>
  );
}
