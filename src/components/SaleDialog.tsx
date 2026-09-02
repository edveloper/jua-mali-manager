import { useMemo, useState } from 'react';
import { Check, Minus, Plus, ShoppingCart, Search, X, Split } from 'lucide-react';
import { Product, Customer } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/Modal';
import { BasketLine, BasketPayment } from '@/hooks/useInventory';
import { PAYMENT_METHODS, PaymentMethod, lastUsedMethod, rememberMethod, takesReference } from '@/lib/payment';
import { money } from '@/lib/money';

interface SaleDialogProps {
  products: Product[];
  customers: Customer[];
  /** The item tapped to open this, if any. The basket starts with it. */
  initialProduct?: Product | null;
  onSubmit: (
    lines: BasketLine[],
    payments: BasketPayment[],
    credit?: { customerId?: string; newCustomer?: { name: string; phone: string }; amount: number },
    options?: { invoice?: boolean }
  ) => Promise<boolean>;
  onClose: () => void;
  isOwner?: boolean;
  canOverridePrice?: boolean;
  /** Owners only: raising an invoice publishes the shop's own tax details. */
  canInvoice?: boolean;
}

interface Line {
  productId: string;
  name: string;
  /** Free text so both fields can be cleared and retyped without fighting a 0. */
  quantityInput: string;
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

const num = (s: string) => {
  const parsed = Number(s);
  return s.trim() !== '' && Number.isFinite(parsed) ? parsed : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Whole units only, and never negative. A shop cannot sell 2.5 tins or minus one. */
const qtyOf = (line: Line) => Math.max(0, Math.floor(num(line.quantityInput)));

const toLine = (p: Product): Line => ({
  productId: p.id,
  name: p.name,
  quantityInput: '1',
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
  isOwner = true, canOverridePrice = false, canInvoice = false,
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
  const [parts, setParts] = useState<Part[]>(() => [{ method: lastUsedMethod(), amount: '', reference: '' }]);
  const [deniInput, setDeniInput] = useState('');

  // Customer, needed only when something is going on deni.
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [wantsInvoice, setWantsInvoice] = useState(false);

  const basketTotal = useMemo(
    () => round2(lines.reduce((sum, l) => sum + num(l.priceInput) * qtyOf(l), 0)),
    [lines]
  );
  const basketProfit = useMemo(
    () => lines.reduce((sum, l) => sum + (num(l.priceInput) - l.costPrice) * qtyOf(l), 0),
    [lines]
  );

  const lineError = (l: Line): string => {
    const qty = qtyOf(l);
    if (l.quantityInput.trim() === '') return 'Enter how many';
    if (qty < 1) return 'At least 1';
    if (qty > l.stock) return `Only ${l.stock} in stock`;
    if (!canOverridePrice) return '';
    if (l.priceInput.trim() === '' || !Number.isFinite(Number(l.priceInput))) return 'Enter a price';
    const price = num(l.priceInput);
    if (price < 0) return 'Price cannot be negative';
    // Zero means giving it away, which is a decision rather than a low price,
    // so it is not measured against the negotiating band.
    if (price === 0) return '';
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
  const exactMatch = trimmedCustomer
    ? customers.find((c) => c.name.trim().toLowerCase() === trimmedCustomer.toLowerCase())
    : undefined;

  /*
   * Only an explicit tap collapses the box.
   *
   * An exact name match used to count as "chosen", which meant that the instant
   * somebody finished typing "Ann" the field turned into a card and there was no
   * way to carry on and type "Ann 2" or "Ann Voi". A shop with two customers
   * sharing a first name could not record the second one at all.
   *
   * The match still does its original job at submit time, so typing an existing
   * name exactly still goes to that customer rather than quietly creating a
   * second one. It is just reported underneath rather than acted on mid-word.
   */
  const resolvedCustomer = selectedCustomer;
  const isNewCustomer = Boolean(trimmedCustomer) && !selectedCustomer && !exactMatch;
  const customerToUse = selectedCustomer ?? exactMatch ?? null;
  const hasCustomer = Boolean(customerToUse) || isNewCustomer;

  const matches = query.trim()
    ? products
        .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()) && p.quantity > 0)
        .slice(0, 6)
    : products.filter((p) => p.quantity > 0).slice(0, 6);

  const addProduct = (p: Product) => {
    setLines((current) => {
      const existing = current.findIndex((l) => l.productId === p.id);
      if (existing >= 0) {
        // Tapping an item already in the basket adds one more rather than
        // starting a second line for the same thing.
        const next = [...current];
        next[existing] = {
          ...next[existing],
          quantityInput: String(Math.min(next[existing].stock, qtyOf(next[existing]) + 1)),
        };
        return next;
      }
      return [...current, toLine(p)];
    });
    setQuery('');
    setPicking(false);
  };

  const patchLine = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  // A basket totalling nothing is allowed: everything in it was given away.
  const isGiveaway = lines.length > 0 && basketTotal === 0;

  const canSubmit =
    !isSubmitting &&
    lines.length > 0 &&
    !anyLineError &&
    (splitMode ? remaining === 0 : true) &&
    !(deniAmount > 0 && !hasCustomer);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const payload: BasketLine[] = lines.map((l) => ({
      productId: l.productId,
      quantity: qtyOf(l),
      unitPrice: canOverridePrice ? num(l.priceInput) : undefined,
    }));

    const payments: BasketPayment[] = isGiveaway
      ? []
      : splitMode
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
            customerId: customerToUse?.id,
            newCustomer: isNewCustomer
              ? { name: trimmedCustomer, phone: newCustomerPhone.trim() }
              : undefined,
            amount: deniAmount,
          }
        : undefined,
      { invoice: wantsInvoice && deniAmount > 0 }
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
              : isGiveaway ? 'Record giveaway'
              : deniAmount > 0 && deniAmount === basketTotal
                ? (wantsInvoice ? 'Record and invoice' : 'Record on deni')
                : (wantsInvoice ? 'Complete and invoice' : 'Complete sale')}
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

            {/* The steppers are for nudging one or two. The field between them is
                typed into, because a distributor selling 500 crates is not going
                to tap a plus button 500 times. */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor={`qty-${line.productId}`} className="text-xs text-muted-foreground">
                  How many
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label={`One less ${line.name}`}
                    onClick={() =>
                      patchLine(index, { quantityInput: String(Math.max(1, qtyOf(line) - 1)) })
                    }
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id={`qty-${line.productId}`}
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min={1}
                    max={line.stock}
                    value={line.quantityInput}
                    onChange={(e) => patchLine(index, { quantityInput: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    className="text-center num px-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label={`One more ${line.name}`}
                    onClick={() =>
                      patchLine(index, {
                        quantityInput: String(Math.min(line.stock, qtyOf(line) + 1)),
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor={`price-${line.productId}`} className="text-xs text-muted-foreground">
                  Price each
                </label>
                {canOverridePrice ? (
                  <Input
                    id={`price-${line.productId}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={line.priceInput}
                    onChange={(e) => patchLine(index, { priceInput: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    className="num"
                  />
                ) : (
                  <div className="flex h-10 items-center num text-sm">
                    KSh {money(line.listPrice)}
                  </div>
                )}
              </div>
            </div>

            <div className="ledger-line ledger-rule text-sm">
              <span className="text-muted-foreground">
                {qtyOf(line) > 0 ? `${qtyOf(line)} × ${money(num(line.priceInput))}` : 'Line total'}
              </span>
              <span className="amount">{money(round2(num(line.priceInput) * qtyOf(line)))}</span>
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
            <span className="text-xl amount">
              {isGiveaway ? 'Free' : `KSh ${money(basketTotal)}`}
            </span>
          </div>

          {/* Nothing is being paid, so there is nothing to ask about. Saying so
              is better than showing payment buttons that cannot mean anything. */}
          {isGiveaway ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm font-medium">Going out for free</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                No money is being collected. The stock still leaves your shelf and what it
                cost you still counts, so today will show the loss.
              </p>
            </div>
          ) : !splitMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">How are they paying?</label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={() => {
                    setSplitMode(true);
                    setParts([{ method: method === 'deni' ? lastUsedMethod() : method, amount: '', reference: '' }]);
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

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-24">Paid by</span>
                <span className="flex-1">How much</span>
              </div>

              {parts.map((part, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <select
                      className="h-10 w-24 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
                      aria-label="Payment method"
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
                      step="0.01"
                      placeholder="0"
                      aria-label="Amount paid this way"
                      value={part.amount}
                      onChange={(e) =>
                        setParts((c) => c.map((p, i) => (i === index ? { ...p, amount: e.target.value } : p)))
                      }
                      onFocus={(e) => e.target.select()}
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
                <span className="w-24 shrink-0 text-sm text-muted-foreground">On deni</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0"
                  aria-label="Amount taken on deni"
                  value={deniInput}
                  onChange={(e) => setDeniInput(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 num"
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
                  {exactMatch && !selectedCustomer && (
                    <p className="text-xs text-muted-foreground">
                      Goes to your existing{' '}
                      <span className="text-foreground font-medium">{exactMatch.name}</span>.
                      Add something to the name if this is somebody else.
                    </p>
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

              {/* Right under the name, because that is where somebody decides
                  this is a customer who gets billed rather than one who owes.
                  Further down the sheet it was one more scroll away, and a
                  control you have to go looking for does not get used. */}
              {canInvoice && hasCustomer && (
                <button
                  type="button"
                  onClick={() => setWantsInvoice((v) => !v)}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    wantsInvoice ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                      wantsInvoice ? 'bg-primary border-primary' : 'border-input'
                    }`}
                    aria-hidden="true"
                  >
                    {wantsInvoice && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Send an invoice for this</span>
                    <span className="block text-xs text-muted-foreground">
                      You choose WhatsApp or email once the sale is saved.
                    </span>
                  </span>
                </button>
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
