import { useMemo, useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCanonicalProducts } from '@/hooks/useCanonicalProducts';
import { CanonicalProduct, matchCatalog } from '@/lib/catalog';
import { resolveBusinessType } from '@/lib/businessTypes';

interface CatalogMatchPanelProps {
  products: Product[];
  onLink: (pairs: { productId: string; canonicalId: string }[]) => Promise<number>;
}

interface Proposal {
  product: Product;
  entry: CanonicalProduct;
  score: number;
}

/*
 * Two bars, and the gap between them is the point.
 *
 * Above the strong one the match is as good as one somebody tapped themselves,
 * so it is ticked already. Between the two it is a reasonable guess worth a
 * glance, so it is shown unticked. Below the lower bar nothing is proposed at
 * all, because a list padded with rubbish makes people stop reading and accept
 * everything, which is worse than proposing nothing.
 */
const STRONG = 0.92;
const WORTH_ASKING = 0.62;

/**
 * Pointing products that already exist at the shared catalogue.
 *
 * Everything typed in before the catalogue existed is unlinked: it contributes
 * nothing to any comparison and gains nothing from one. Matching is proposed
 * rather than applied, because the near-misses are exactly the rows where a
 * person's judgement beats the scorer, and those are the ones worth their time.
 */
export function CatalogMatchPanel({ products, onLink }: CatalogMatchPanelProps) {
  const { shop, isOwner } = useAuth();
  const catalog = useCanonicalProducts();
  const businessType = resolveBusinessType(shop?.business_category);

  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState(false);

  const proposals = useMemo<Proposal[]>(() => {
    if (catalog.length === 0) return [];

    const rows: Proposal[] = [];
    for (const product of products) {
      if (product.canonicalId) continue;
      const [best] = matchCatalog(product.name, catalog, {
        businessType,
        limit: 1,
        threshold: WORTH_ASKING,
      });
      if (best) rows.push({ product, entry: best.entry, score: best.score });
    }
    return rows.sort((a, b) => b.score - a.score);
  }, [products, catalog, businessType]);

  // Seeded once the catalogue has arrived, not on every render, so ticking and
  // unticking a row actually sticks.
  if (!seeded && proposals.length > 0) {
    setSeeded(true);
    setChosen(
      Object.fromEntries(
        proposals.filter((row) => row.score >= STRONG).map((row) => [row.product.id, row.entry.id])
      )
    );
  }

  const unlinked = products.filter((p) => !p.canonicalId).length;
  const picked = Object.keys(chosen).length;

  if (!isOwner || unlinked === 0 || proposals.length === 0) return null;

  const apply = async () => {
    setBusy(true);
    await onLink(
      Object.entries(chosen).map(([productId, canonicalId]) => ({ productId, canonicalId }))
    );
    setBusy(false);
    setChosen({});
    setSeeded(false);
  };

  return (
    <div className="sheet space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">Match Your Products</p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            {unlinked} of your products are not on the shared list yet. Matching them
            lets reports name the same thing the same way, and lets you compare your
            prices with shops nearby later on.
          </p>
        </div>
      </div>

      <div className="sheet p-0 overflow-hidden divide-y divide-border/70 max-h-80 overflow-y-auto">
        {proposals.map(({ product, entry, score }) => {
          const on = chosen[product.id] === entry.id;
          return (
            <button
              key={product.id}
              type="button"
              onClick={() =>
                setChosen((prev) => {
                  const next = { ...prev };
                  if (on) delete next[product.id];
                  else next[product.id] = entry.id;
                  return next;
                })
              }
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-muted transition-colors"
            >
              <div
                className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                  on ? 'bg-primary border-primary' : 'border-input'
                }`}
              >
                {on && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {entry.name}
                  {score < STRONG && <span className="text-warning"> · worth a look</span>}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Button className="w-full" onClick={apply} disabled={busy || picked === 0}>
        {busy ? 'Matching...' : `Match ${picked} ${picked === 1 ? 'Product' : 'Products'}`}
      </Button>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Nothing is renamed and no price changes. This only records which item on the
        shared list each of yours is, and any of them can be changed later.
      </p>
    </div>
  );
}
