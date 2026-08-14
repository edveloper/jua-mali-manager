import { useState } from 'react';
import { X, Minus, Plus, ShoppingCart, CreditCard, Wallet } from 'lucide-react';
import { Product, Customer } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SellDialogProps {
  product: Product;
  customers: Customer[];
  /** Return false to keep the dialog open (e.g. the sale could not be saved). */
  onSell: (
    productId: string,
    quantity: number,
    options?: {
      isCredit?: boolean;
      customerId?: string;
      /** Typed in on the spot rather than picked from the credit book. */
      newCustomer?: { name: string; phone: string };
      meta?: { staffName?: string; sessionTime?: string; notes?: string; status?: 'completed' | 'scheduled' | 'cancelled' };
      unitPrice?: number;
    }
  ) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
  isOwner?: boolean;
  offeringMode?: 'products' | 'services' | 'mixed' | string;
  allowCredit?: boolean;
  /** Whether this user may charge something other than the catalog price. */
  canOverridePrice?: boolean;
}

export function SellDialog({ product, customers, onSell, onClose, isOwner = true, offeringMode = 'products', allowCredit = true, canOverridePrice = false }: SellDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [isCredit, setIsCredit] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [notes, setNotes] = useState('');
  const [sessionStatus, setSessionStatus] = useState<'completed' | 'scheduled' | 'cancelled'>('completed');
  // Free text, not a number, so the field can be cleared and retyped on a phone
  // without fighting a forced 0.
  const [priceInput, setPriceInput] = useState(String(product.sellingPrice ?? 0));
  const actionLabel = offeringMode === 'services' ? 'Record Service' : 'Record Sale';

  const isPriceable = offeringMode !== 'services' && canOverridePrice;
  const basePrice = Number(product.sellingPrice || 0);
  const minPrice = product.minPrice ?? null;
  const maxPrice = product.maxPrice ?? null;

  const parsedPrice = Number(priceInput);
  const priceIsNumber = priceInput.trim() !== '' && Number.isFinite(parsedPrice);
  const effectivePrice = isPriceable && priceIsNumber ? parsedPrice : basePrice;

  let priceError = '';
  if (isPriceable) {
    if (!priceIsNumber) priceError = 'Enter a price';
    else if (parsedPrice < 0) priceError = 'Price cannot be negative';
    else if (minPrice !== null && parsedPrice < minPrice) priceError = `Lowest allowed is KSh ${minPrice.toLocaleString()}`;
    else if (maxPrice !== null && parsedPrice > maxPrice) priceError = `Highest allowed is KSh ${maxPrice.toLocaleString()}`;
  }

  const priceChanged = isPriceable && priceIsNumber && parsedPrice !== basePrice;
  const bandLabel = minPrice !== null && maxPrice !== null
    ? `Allowed: KSh ${minPrice.toLocaleString()} – ${maxPrice.toLocaleString()}`
    : minPrice !== null
      ? `Lowest allowed: KSh ${minPrice.toLocaleString()}`
      : maxPrice !== null
        ? `Highest allowed: KSh ${maxPrice.toLocaleString()}`
        : '';

  // Customer can be picked from the credit book or typed in from scratch.
  const trimmedQuery = customerQuery.trim();
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  const customerMatches = trimmedQuery
    ? customers
        .filter((c) =>
          c.name.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
          (c.phone || '').includes(trimmedQuery)
        )
        .slice(0, 4)
    : [];

  // Typing an existing name exactly resolves to that customer rather than
  // silently creating a second one with the same name.
  const exactMatch = customers.find(
    (c) => c.name.trim().toLowerCase() === trimmedQuery.toLowerCase()
  );
  const resolvedCustomer = selectedCustomer || (trimmedQuery ? exactMatch : null) || null;
  const isNewCustomer = Boolean(trimmedQuery) && !resolvedCustomer;
  const hasCustomer = Boolean(resolvedCustomer) || isNewCustomer;

  const canSubmit =
    !isSubmitting &&
    quantity > 0 &&
    quantity <= product.quantity &&
    !priceError &&
    !(allowCredit && isCredit && !hasCustomer);

  const handleSell = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    const result = offeringMode === 'services'
      ? await onSell(product.id, quantity, {
          meta: {
            staffName: staffName.trim(),
            sessionTime: sessionTime || undefined,
            notes: notes.trim(),
            status: sessionStatus,
          },
        })
      : await onSell(product.id, quantity, {
          isCredit: allowCredit ? isCredit : false,
          customerId: (allowCredit && isCredit && resolvedCustomer) ? resolvedCustomer.id : undefined,
          newCustomer: (allowCredit && isCredit && isNewCustomer)
            ? { name: trimmedQuery, phone: newCustomerPhone.trim() }
            : undefined,
          unitPrice: isPriceable ? effectivePrice : undefined,
        });

    setIsSubmitting(false);
    // Stay open on failure so nothing typed is lost.
    if (result === false) return;
    onClose();
  };

  const total = effectivePrice * quantity;
  const profit = (effectivePrice - product.costPrice) * quantity;

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl animate-slide-up">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">{actionLabel}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="bg-muted rounded-xl p-4">
            <h3 className="font-semibold text-foreground">{product.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isPriceable ? 'Usual price' : 'Price'}: KSh {basePrice.toLocaleString()} | Stock: {product.quantity}
            </p>
          </div>

          {isPriceable && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="sell-price" className="text-sm font-medium text-foreground">
                  Price per {product.quantity === 1 ? 'unit' : 'unit'}
                </label>
                {priceChanged && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setPriceInput(String(basePrice))}
                  >
                    Back to KSh {basePrice.toLocaleString()}
                  </button>
                )}
              </div>
              <Input
                id="sell-price"
                type="number"
                inputMode="decimal"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="text-lg font-semibold"
                min={minPrice ?? 0}
                max={maxPrice ?? undefined}
              />
              {priceError ? (
                <p className="text-xs text-destructive">{priceError}</p>
              ) : bandLabel ? (
                <p className="text-xs text-muted-foreground">{bandLabel}</p>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Quantity</label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.min(product.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                className="text-center text-lg font-semibold"
                min={1}
                max={product.quantity}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))}
                disabled={quantity >= product.quantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {allowCredit && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Payment Type</label>
              <div className="flex gap-2">
                <Button
                  variant={!isCredit ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setIsCredit(false)}
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Cash
                </Button>
                <Button
                  variant={isCredit ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setIsCredit(true)}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Credit
                </Button>
              </div>
            </div>
          )}

          {offeringMode === 'services' && (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <p className="text-sm font-medium text-foreground">Service Session Details</p>
              <Input
                placeholder="Staff name (optional)"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
              />
              <Input
                type="datetime-local"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={sessionStatus}
                onChange={(e) => setSessionStatus(e.target.value as 'completed' | 'scheduled' | 'cancelled')}
              >
                <option value="completed">Completed</option>
                <option value="scheduled">Scheduled</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}

          {/* Customer for a credit sale: search the credit book, or just type a
              new name. No need to leave the sale to add someone first. */}
          {allowCredit && isCredit && (
            <div className="space-y-2">
              <label htmlFor="credit-customer" className="text-sm font-medium text-foreground">
                Who is taking it on credit?
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
                    id="credit-customer"
                    placeholder="Customer name"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    autoComplete="off"
                  />

                  {customerMatches.length > 0 && (
                    <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                      {customerMatches.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => setSelectedCustomerId(customer.id)}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                        >
                          <span className="text-sm font-medium">{customer.name}</span>
                          {customer.phone && (
                            <span className="text-xs text-muted-foreground ml-2">{customer.phone}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {isNewCustomer && (
                    <div className="space-y-2">
                      <Input
                        placeholder="Phone number (optional)"
                        type="tel"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        New customer. {trimmedQuery} will be added to your credit book.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="bg-muted rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-bold text-lg">KSh {total.toLocaleString()}</span>
            </div>
            {priceChanged && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{parsedPrice > basePrice ? 'Above usual price' : 'Below usual price'}</span>
                <span className={parsedPrice > basePrice ? 'text-success' : 'text-warning'}>
                  {parsedPrice > basePrice ? '+' : '−'}KSh {(Math.abs(parsedPrice - basePrice) * quantity).toLocaleString()}
                </span>
              </div>
            )}
            {/* Only show profit to owners */}
            {isOwner && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profit</span>
                <span className="font-semibold text-success">KSh {profit.toLocaleString()}</span>
              </div>
            )}
          {allowCredit && isCredit && (
            <div className="flex justify-between text-warning pt-2 border-t border-border">
              <span>Payment Type</span>
              <span className="font-semibold">Credit Sale</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSell}
              disabled={!canSubmit}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isSubmitting
                ? 'Saving...'
                : isCredit ? 'Credit Sale' : (offeringMode === 'services' ? 'Complete Service' : 'Complete Sale')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
