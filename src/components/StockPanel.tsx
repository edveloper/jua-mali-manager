import { useMemo, useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { Product, Sale } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StockTakeSummary } from '@/hooks/useStockTake';

interface StockPanelProps {
  products: Product[];
  sales: Sale[];
  takes: StockTakeSummary[];
  onRecordCount: (
    lines: { product_id: string; counted_qty: number }[]
  ) => Promise<{ items_counted: number; items_short: number; items_over: number; shrinkage_value: number } | null>;
}

type Mode = 'snapshot' | 'counting' | 'result';
type SortKey = 'value' | 'quantity' | 'name';

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 0 });
const DEAD_AFTER_DAYS = 30;

export function StockPanel({ products, sales, takes, onRecordCount }: StockPanelProps) {
  const [mode, setMode] = useState<Mode>('snapshot');
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<
    { items_counted: number; items_short: number; items_over: number; shrinkage_value: number } | null
  >(null);

  const lastSold = useMemo(() => {
    const map = new Map<string, Date>();
    for (const sale of sales) {
      if (!sale.productId) continue;
      const at = new Date(sale.createdAt);
      const current = map.get(sale.productId);
      if (!current || at > current) map.set(sale.productId, at);
    }
    return map;
  }, [sales]);

  const totals = useMemo(() => {
    const units = products.reduce((sum, p) => sum + p.quantity, 0);
    const atCost = products.reduce((sum, p) => sum + p.costPrice * p.quantity, 0);
    const atRetail = products.reduce((sum, p) => sum + p.sellingPrice * p.quantity, 0);
    return { units, atCost, atRetail };
  }, [products]);

  // Money sitting on the shelf that has not moved. Nobody asks for this, which
  // is exactly why it is worth showing.
  const deadStock = useMemo(() => {
    const now = new Date();
    return products
      .filter((p) => p.quantity > 0)
      .map((p) => {
        const last = lastSold.get(p.id);
        const days = last ? differenceInDays(now, last) : null;
        return { product: p, days, value: p.costPrice * p.quantity };
      })
      .filter((row) => row.days === null || row.days >= DEAD_AFTER_DAYS)
      .sort((a, b) => b.value - a.value);
  }, [products, lastSold]);

  const deadValue = deadStock.reduce((sum, row) => sum + row.value, 0);

  const sorted = useMemo(() => {
    const list = [...products];
    if (sortKey === 'value') return list.sort((a, b) => b.costPrice * b.quantity - a.costPrice * a.quantity);
    if (sortKey === 'quantity') return list.sort((a, b) => b.quantity - a.quantity);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, sortKey]);

  const enteredLines = Object.entries(counts)
    .filter(([, value]) => value.trim() !== '' && Number.isFinite(Number(value)))
    .map(([productId, value]) => ({ product_id: productId, counted_qty: Math.max(0, Math.floor(Number(value))) }));

  const handleSave = async () => {
    if (enteredLines.length === 0) return;
    setIsSaving(true);
    const outcome = await onRecordCount(enteredLines);
    setIsSaving(false);
    if (!outcome) return;
    setResult(outcome);
    setCounts({});
    setMode('result');
  };

  const lastTake = takes[0];

  // ------------------------------------------------------------------ result
  if (mode === 'result' && result) {
    return (
      <div className="space-y-3">
        <div className="sheet">
          <p className="sheet-heading">Count finished</p>
          <div className="ledger-line ledger-rule">
            <span className="text-muted-foreground">Items counted</span>
            <span className="num">{result.items_counted}</span>
          </div>
          <div className="ledger-line">
            <span className="text-muted-foreground">Fewer than expected</span>
            <span className="num">{result.items_short}</span>
          </div>
          <div className="ledger-line">
            <span className="text-muted-foreground">More than expected</span>
            <span className="num">{result.items_over}</span>
          </div>
          <div className="ledger-line ledger-total">
            <span className="font-semibold">Missing stock is worth</span>
            <span className={`text-2xl amount ${result.shrinkage_value > 0 ? 'text-destructive' : 'text-success'}`}>
              {money(result.shrinkage_value)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Your stock figures now match what you counted. The corrections are kept in
            your stock history.
          </p>
        </div>
        <Button className="w-full" onClick={() => { setResult(null); setMode('snapshot'); }}>
          Done
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------- counting
  if (mode === 'counting') {
    return (
      <div className="space-y-3">
        <div className="sheet">
          <p className="font-semibold">Count the shelf</p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Type what you actually have. You do not have to do everything — count what
            you can and save. The most valuable items are first.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            What the app expects is hidden on purpose, so the count is honest.
          </p>
        </div>

        <div className="sheet p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/40">
            <span className="sheet-heading flex-1">Item</span>
            <span className="sheet-heading shrink-0 w-20 text-center">You counted</span>
          </div>
          <div className="divide-y divide-border/70">
          {sorted.map((product) => (
            <div key={product.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 min-w-0 truncate text-sm">{product.name}</span>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="—"
                value={counts[product.id] ?? ''}
                onChange={(e) => setCounts((prev) => ({ ...prev, [product.id]: e.target.value }))}
                className="w-20 h-9 text-center num shrink-0"
              />
            </div>
          ))}
          </div>
        </div>

        <div className="sticky bottom-24 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { setCounts({}); setMode('snapshot'); }}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={isSaving || enteredLines.length === 0}>
            {isSaving ? 'Saving...' : `Save ${enteredLines.length || ''}`}
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- snapshot
  return (
    <div className="space-y-3">
      <div className="sheet">
        <div className="ledger-line">
          <span className="text-muted-foreground">On the shelf</span>
          <span className="num">{products.length} items · {totals.units} units</span>
        </div>
        <div className="ledger-line ledger-rule">
          <span className="text-muted-foreground">Cost you</span>
          <span className="amount">{money(totals.atCost)}</span>
        </div>
        <div className="ledger-line">
          <span className="text-muted-foreground">If it all sells</span>
          <span className="amount">{money(totals.atRetail)}</span>
        </div>
        <div className="ledger-line ledger-total">
          <span className="font-semibold">Profit waiting in it</span>
          <span className="text-xl amount text-success">{money(totals.atRetail - totals.atCost)}</span>
        </div>
      </div>

      <Button className="w-full" onClick={() => setMode('counting')} disabled={products.length === 0}>
        Count the shelf
      </Button>

      {lastTake && (
        <div className="sheet">
          <p className="sheet-heading">Last count</p>
          <p className="text-sm mt-1">
            {format(new Date(lastTake.countedAt), 'd MMM')} · {lastTake.itemsCounted} items
          </p>
          <p className={`text-sm mt-0.5 ${lastTake.shrinkageValue > 0 ? 'text-destructive' : 'text-success'}`}>
            {lastTake.shrinkageValue > 0
              ? `${money(lastTake.shrinkageValue)} was missing`
              : 'Everything matched'}
          </p>
        </div>
      )}

      {deadValue > 0 && (
        <div className="sheet">
          <div className="flex items-baseline justify-between gap-4">
            <span className="sheet-heading">Not sold in a month</span>
            <span className="amount text-warning">{money(deadValue)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            Money sitting still. Worth a discount or not reordering.
          </p>
          <div className="divide-y divide-border/70">
            {deadStock.slice(0, 5).map((row) => (
              <div key={row.product.id} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="flex-1 min-w-0 truncate text-sm">{row.product.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {row.days === null ? 'never sold' : `${row.days} days`}
                </span>
                <span className="num text-sm shrink-0">{money(row.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {([['value', 'By cost value'], ['quantity', 'By how many'], ['name', 'A–Z']] as const).map(([key, label]) => (
          <Button
            key={key}
            variant={sortKey === key ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setSortKey(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="sheet p-0 overflow-hidden">
        {/* An unlabelled column of numbers in a money app is a guess. */}
        <div className="flex items-baseline gap-3 px-4 py-2 border-b border-border bg-muted/40">
          <span className="sheet-heading flex-1">Item</span>
          <span className="sheet-heading shrink-0 w-12 text-right">Have</span>
          <span className="sheet-heading shrink-0 w-20 text-right">Cost value</span>
        </div>
        <div className="divide-y divide-border/70">
          {sorted.map((product) => {
            const low = product.quantity <= product.lowStockThreshold;
            return (
              <div key={product.id} className="flex items-baseline gap-3 px-4 py-2.5">
                <span className="flex-1 min-w-0 truncate text-sm">{product.name}</span>
                <span className={`num text-sm shrink-0 w-12 text-right ${low ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                  {product.quantity}
                </span>
                <span className="amount text-sm shrink-0 w-20 text-right">
                  {money(product.costPrice * product.quantity)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground px-4 py-2.5 border-t border-border/70">
          Cost value is what that much stock cost you, not what it sells for.
        </p>
      </div>
    </div>
  );
}
