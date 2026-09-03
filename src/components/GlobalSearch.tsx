import { useMemo, useState } from 'react';
import { Search, Package, User } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/ui/input';
import { Product, Customer } from '@/types/inventory';
import { money } from '@/lib/money';

interface GlobalSearchProps {
  products: Product[];
  customers: Customer[];
  onClose: () => void;
  onPickProduct: (product: Product) => void;
  onPickCustomer: () => void;
}

const LIMIT = 6;

/**
 * Finding a thing without knowing which screen it lives on.
 *
 * Until now the only way to reach a product was to scroll the Sell list and the
 * only way to reach a customer was to scroll Deni, which is fine at forty items
 * and useless at four hundred. The header is the one place on screen from every
 * tab, so the search belongs there.
 *
 * Matching is on what people actually half-remember: any word of a name, in any
 * order, and a phone number for a customer. Both lists are capped, because a
 * search that returns ninety rows has not answered anything.
 */
export function GlobalSearch({ products, customers, onClose, onPickProduct, onPickCustomer }: GlobalSearchProps) {
  const [term, setTerm] = useState('');

  const query = term.trim().toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);

  const matches = (haystack: string) => {
    const hay = haystack.toLowerCase();
    return words.every((word) => hay.includes(word));
  };

  const foundProducts = useMemo(
    () => (words.length === 0 ? [] : products.filter((p) => matches(`${p.name} ${p.category ?? ''}`)).slice(0, LIMIT)),
    [products, query]
  );

  const foundCustomers = useMemo(
    () => (words.length === 0 ? [] : customers.filter((c) => matches(`${c.name} ${c.phone ?? ''}`)).slice(0, LIMIT)),
    [customers, query]
  );

  const nothing = words.length > 0 && foundProducts.length === 0 && foundCustomers.length === 0;

  return (
    <Modal title="Search" onClose={onClose}>
      <div className="relative">
        <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="An item or a customer"
          aria-label="Search for an item or a customer"
          className="pl-9"
        />
      </div>

      {foundProducts.length > 0 && (
        <div className="space-y-1.5">
          <p className="sheet-heading px-1">Items</p>
          <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
            {foundProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => { onClose(); onPickProduct(product); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-muted transition-colors"
              >
                <Package className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.quantity} left
                  </p>
                </div>
                <span className="amount text-sm shrink-0">{money(product.sellingPrice)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {foundCustomers.length > 0 && (
        <div className="space-y-1.5">
          <p className="sheet-heading px-1">Customers</p>
          <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
            {foundCustomers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => { onClose(); onPickCustomer(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-muted transition-colors"
              >
                <User className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{customer.name}</p>
                  {customer.phone && (
                    <p className="text-xs text-muted-foreground num truncate">{customer.phone}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {nothing && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nothing matches "{term.trim()}".
        </p>
      )}

      {words.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 leading-relaxed">
          Type part of an item name or a customer's name.
          <br />
          Tap an item to sell it.
        </p>
      )}
    </Modal>
  );
}
