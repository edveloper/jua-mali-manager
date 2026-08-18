import { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, Search, X, Split } from 'lucide-react';
import { Product, Customer } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/Modal';
import { BasketLine, BasketPayment } from '@/hooks/useInventory';
import { PAYMENT_METHODS, PaymentMethod, lastUsedMethod, rememberMethod, takesReference } from '@/lib/payment';

interface SaleDialogProps {
  products: Product[];
  customers: Customer[];
  /** The item tapped to open this, if any. The basket starts with it. */
  initialProduct?: Product | null;
  onSubmit: (
    lines: BasketLine[],
    payments: BasketPayment[],
    credit?: { customerId?: string; newCustomer?: { name: string; phone: string }; amount: number }
  ) => Promise<boolean>;
  onClose: () => void;
  isOwner?: boolean;
  canOverridePrice?: boolean;
}

interface Line {
  productId: string;
  name: string;
  quantity: number;
  /** Free text so the field can be cleared and retyped without fighting a 0. */
  priceInput: string;
  listPrice: number;
  minPrice: number | null;
  maxPrice: number | null;
  costPrice: number;
  stock: number;
}

interface Part {
  method: PaymentMethod;
  amount: string;
  reference: string;
}

const money = (n: number) => n.toLocaleString('en-KE', { maximumFractionDigits: 2 });
const num = (s: string) => {
  const parsed = Number(s);
  return s.trim() !== '' && Number.isFinite(parsed) ? parsed : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

const toLine = (p: Product): Line => ({
  productId: p.id,
  name: p.name,
  quantity: 1,
  priceInput: String(p.sellingPrice ?? 0),
  listPrice: Number(p.sellingPrice || 0),
  minPrice: p.minPrice ?? null,
  maxPrice: p.maxPrice ?? null,
  costPrice: Number(p.costPrice || 0),
  stock: Number(p.quantity || 0),
});

/**
 * One sale, however many items and however many ways it was paid for.
 *
 * Two things a counter actually does that the old one-item-one-method dialog
 * could not express: a customer buying several things in one go, and a customer
 * paying part in cash, part by M-Pesa and taking the rest on deni.
 *
 * The design tries hard not to make the common case pay for the rare one. A
 * single item paid one way needs no more taps than before -- the split controls
 * stay folded away until somebody asks for them.
 */
export function SaleDialog({
  products, customers, initialProduct, onSubmit, onClose,
  isOwner = true, canOverridePrice = false,
}: SaleDialogProps) {
  const [lines, setLines] = useState<Line[]>(initialProduct ? [toLine(initialProduct)] : []);
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(!initialProduct);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment. Simple mode is one method for the whole sale; split mode lets the
  // amounts be stated one by one.
  const [splitMode, setSplitMode] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | 'deni'>(lastUsedMethod);
  const [reference, setReference] = useState('');
  const [parts, setParts] = useState<Part[]>([{ method: lastUsedMethod, amount: '', reference: '' }]);
  const [deniInput, setDeniInput] = useState('');

  // Customer, needed only when something is going on deni.
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const basketTotal = useMemo(
    () => round2(lines.reduce((sum, l) => sum + num(l.priceInput) * l.quantity, 0)),
    [lines]
  );
  const basketProfit = useMemo(
    () => lines.reduce((sum, l) => sum + (num(l.priceInput) - l.costPrice) * l.quantity, 0),
    [lines]
  );

  const lineError = (l: Line): string => {
    if (l.quantity > l.stock) return `Only ${l.stock} in stock`;
    if (!canOverridePrice) return '';
    if (l.priceInput.trim() === '' || !Number.isFinite(Number(l.priceInput))) return 'Enter a price';
    const price = num(l.priceInput);
    if (price < 0) return 'Price cannot be negative';
    if (l.minPrice !== null && price < l.minPrice) return `Lowest is KSh ${money(l.minPrice)}`;
    if (l.maxPrice !== null && price > l.maxPrice) return `Highest is KSh ${money(l.maxPrice)}`;
    return '';
  };
  const anyLineError = lines.some((l) => lineError(l) !== '');

  // What is still unaccounted for. Zero is the only value that may be submitted
  // in split mode, and it is shown at all times so nobody has to work it out.
  const deniAmount = splitMode ? round2(num(deniInput)) : (method === 'deni' ? basketTotal : 0);
  const allocated = splitMode
    ? round2(parts.reduce((sum, p) => sum + num(p.amount), 0) + num(deniInput))
    : basketTotal;
  const remaining = round2(basketTotal - allocated);

  const trimmedCustomer = customerQuery.trim();
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
  const customerMatches = trimmedCustomer
    ? customers
        .filter((c) =>
          c.name.toLowerCase().includes(trimmedCustomer.toLowerCase()) ||
          (c.phone || '').includes(trimmedCustomer)
        )
        .slice(0, 4)
    : [];
  const exactMatch = customers.find(
    (c) => c.name.trim().toLowerCase() === trimmedCustomer.toLowerCase()
  );
  const resolvedCustomer = selectedCustomer || (trimmedCustomer ? exactMatch : null) || null;
  const isNewCustomer = Boolean(trimmedCustomer) && !resolvedCustomer;
  const hasCustomer = Boolean(resolvedCustomer) || isNewCustomer;

  const matches = query.trim()
    ? products
        .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()) && p.quantity > 0)
        .slice(0, 6)
    : products.filter((p) => p.quantity > 0).slice(0, 6);

  const addProduct = (p: Product) => {
    setLines((current) => {
      const existing = current.findIndex((l) => l.productId === p.id);
      if (existing >= 0) {
        const next = [...current];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 };
        return next;
      }
      return [...current, toLine(p)];
    });
    setQuery('');
    setPicking(false);
  };

  const patchLine = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const canSubmit =
    !isSubmitting &&
    lines.length > 0 &&
    basketTotal > 0 &&
    !anyLineError &&
    (splitMode ? remaining === 0 : true) &&
    !(deniAmount > 0 && !hasCustomer);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const payload: BasketLine[] = lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: canOverridePrice ? num(l.priceInput) : undefined,
    }));

    const payments: BasketPayment[] = splitMode
      ? parts
          .filter((p) => num(p.amount) > 0)
          .map((p) => ({
            method: p.method,
            amount: round2(num(p.amount)),
            reference: p.reference.trim() || undefined,
          }))
      : method === 'deni'
        ? []
        : [{ method, amount: basketTotal, reference: reference.trim() || undefined }];

    setIsSubmitting(true);
    const ok = await onSubmit(
      payload,
      payments,
      deniAmount > 0
        ? {
            customerId: resolvedCustomer?.id,
            newCustomer: isNewCustomer
              ? { name: trimmedCustomer, phone: newCustomerPhone.trim() }
              : undefined,
            amount: deniAmount,
          }
        : undefined
    );
    setIsSubmitting(false);

    // Stay open on failure so nothing typed is lost.
    if (!ok) return;
    if (payments.length > 0) rememberMethod(payments[0].method as PaymentMethod);
    onClose();
  };

  return (
    <Modal
      title={lines.length > 1 ? `Sale · ${lines.length} items` : 'Record a sale'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!canSubmit}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            {isSubmitting
              ? 'Saving...'
              : deniAmount > 0 && deniAmount === basketTotal ? 'Record on deni' : 'Complete sale'}
          </Button>
        </>
      }
    >
      {/* Items */}
      {lines.map((line, index) => {
        const error = lineError(line);
        return (
          <div key={line.productId} className="rounded-xl border border-border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{line.name}</p>
                <p className="text-xs text-muted-foreground">
                  {line.stock} in stock · usual KSh {money(line.listPrice)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setLines((c) => c.filter((_, i) => i !== index))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => patchLine(index, { quantity: Math.max(1, line.quantity - 1) })}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center font-semibold num">{line.quantity}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => patchLine(index, { quantity: Math.min(line.stock, line.quantity + 1) })}
              >
                <Plus className="h-4 w-4" />
              </Button>

              {canOverridePrice ? (
                <Input
                  type="number"
                  inputMode="decimal"
                  value={line.priceInput}
                  onChange={(e) => patchLine(index, { priceInput: e.target.value })}
                  className="flex-1 num"
                  aria-label={`Price for ${line.name}`}
                />
              ) : (
                <span className="flex-1 text-right text-muted-foreground text-sm">
                  @ {money(line.listPrice)}
                </span>
              )}

              <span className="w-20 text-right amount">
                {money(round2(num(line.priceInput) * line.quantity))}
              </span>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );
      })}

      {/* Picker */}
      {picking ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search your items"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors flex items-center justify-between gap-2"
              >
                <span className="text-sm font-medium truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {p.quantity} left · {money(p.sellingPrice)}
                </span>
              </button>
            ))}
            {matches.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted-foreground">Nothing in stock matches that.</p>
            )}
          </div>
          {lines.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setPicking(false)}>
              Done adding
            </Button>
          )}
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setPicking(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add another item
        </Button>
      )}

      {lines.length > 0 && (
        <>
          <div className="ledger-total flex items-baseline justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-xl amount">KSh {money(basketTotal)}</span>
          </div>

          {/* Payment */}
          {!splitMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">How are they paying?</label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={() => {
                    setSplitMode(true);
                    setParts([{ method: method === 'deni' ? lastUsedMethod : method, amount: '', reference: '' }]);
                    setDeniInput('');
                  }}
                >
                  <Split className="h-3 w-3" /> More than one way
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <Button
                    key={m.value}
                    variant={method === m.value ? 'default' : 'outline'}
                    size="sm"
                    className="px-1 text-xs"
                    onClick={() => setMethod(m.value)}
                  >
                    {m.short}
                  </Button>
                ))}
                <Button
                  variant={method === 'deni' ? 'default' : 'outline'}
                  size="sm"
                  className="px-1 text-xs"
                  onClick={() => setMethod('deni')}
                >
                  Deni
                </Button>
              </div>
              {method !== 'deni' && takesReference(method) && (
                <Input
                  placeholder="Transaction code (optional)"
                  value={reference}
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  className="num"
                />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Split the payment</label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setSplitMode(false)}
                >
                  One way only
                </button>
              </div>

              {parts.map((part, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <select
                      className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                      value={part.method}
                      onChange={(e) =>
                        setParts((c) => c.map((p, i) => (i === index ? { ...p, method: e.target.value as PaymentMethod } : p)))
                      }
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{m.short}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="Amount"
                      value={part.amount}
                      onChange={(e) =>
                        setParts((c) => c.map((p, i) => (i === index ? { ...p, amount: e.target.value } : p)))
                      }
                      className="flex-1 num"
                    />
                    {parts.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setParts((c) => c.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {takesReference(part.method) && num(part.amount) > 0 && (
                    <Input
                      placeholder="Transaction code (optional)"
                      value={part.reference}
                      onChange={(e) =>
                        setParts((c) => c.map((p, i) => (i === index ? { ...p, reference: e.target.value.toUpperCase() } : p)))
                      }
                      autoCapitalize="characters"
                      className="num text-sm"
                    />
                  )}
                </div>
              ))}

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() =>
                  setParts((c) => [
                    ...c,
                    { method: 'cash', amount: remaining > 0 ? String(remaining) : '', reference: '' },
                  ])
                }
              >
                <Plus className="h-3 w-3 mr-1" /> Another payment
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground flex-1">On deni</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={deniInput}
                  onChange={(e) => setDeniInput(e.target.value)}
                  className="w-28 num"
                />
              </div>

              {/* The whole point of split mode: what is still unaccounted for. */}
              <div
                className={`ledger-line ledger-rule ${remaining === 0 ? 'text-success' : 'text-warning'}`}
              >
                <span className="text-sm">
                  {remaining === 0 ? 'Everything accounted for' : remaining > 0 ? 'Still to account for' : 'Over by'}
                </span>
                <span className="amount">{money(Math.abs(remaining))}</span>
              </div>
            </div>
          )}

          {/* Customer, only when something is going on deni */}
          {deniAmount > 0 && (
            <div className="space-y-2">
              <label htmlFor="deni-customer" className="text-sm font-medium">
                Who is taking KSh {money(deniAmount)} on deni?
              </label>

              {resolvedCustomer ? (
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{resolvedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {resolvedCustomer.phone || 'No phone number'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCustomerId('');
                      setCustomerQuery('');
                      setNewCustomerPhone('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    id="deni-customer"
                    placeholder="Customer name"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {customerMatches.length > 0 && (
                    <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                      {customerMatches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCustomerId(c.id)}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                        >
                          <span className="text-sm font-medium">{c.name}</span>
                          {c.phone && (
                            <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {isNewCustomer && (
                    <Input
                      placeholder="Phone number (optional)"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      inputMode="tel"
                    />
                  )}
                </>
              )}
            </div>
          )}

          {isOwner && basketProfit !== 0 && (
            <div className="ledger-line text-sm">
              <span className="text-muted-foreground">Profit on this sale</span>
              <span className="num font-semibold text-success">KSh {money(round2(basketProfit))}</span>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
