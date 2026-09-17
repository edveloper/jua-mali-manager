import { useState, useEffect, useMemo } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Product } from '@/types/inventory';
import { useAuth } from '@/contexts/AuthContext';
import { useCanonicalProducts } from '@/hooks/useCanonicalProducts';
import { matchCatalog } from '@/lib/catalog';
import { resolveBusinessType } from '@/lib/businessTypes';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/Modal';
import { ksh } from '@/lib/money';

interface ProductFormProps {
  product?: Product | null;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

export function ProductForm({ product, onSave, onClose }: ProductFormProps) {
  const { shop } = useAuth();
  const catalog = useCanonicalProducts();
  const businessType = resolveBusinessType(shop?.business_category);

  /*
   * The catalogue entry this product is a copy of.
   *
   * Only ever set by an explicit tap. An exact spelling match is deliberately
   * not treated as a choice: the customer name field made that mistake once and
   * somebody typing "Ann 2" could never get past "Ann", because the app kept
   * deciding it already knew what they meant.
   */
  const [canonicalId, setCanonicalId] = useState<string | null>(null);
  const [chosenName, setChosenName] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    costPrice: '',
    sellingPrice: '',
    minPrice: '',
    maxPrice: '',
    quantity: '',
    lowStockThreshold: '5',
    durationMinutes: '0',
    category: '',
    unitsPerPack: '',
    packLabel: '',
    barcode: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        costPrice: product.costPrice.toString(),
        sellingPrice: product.sellingPrice.toString(),
        minPrice: product.minPrice === null || product.minPrice === undefined ? '' : String(product.minPrice),
        maxPrice: product.maxPrice === null || product.maxPrice === undefined ? '' : String(product.maxPrice),
        quantity: product.quantity.toString(),
        lowStockThreshold: product.lowStockThreshold.toString(),
        durationMinutes: String(product.durationMinutes || 0),
        category: product.category || '',
        unitsPerPack: product.unitsPerPack ? String(product.unitsPerPack) : '',
        packLabel: product.packLabel || '',
        barcode: product.barcode || '',
      });
      setCanonicalId(product.canonicalId ?? null);
      setChosenName(product.canonicalId ? product.name : null);
    }
  }, [product]);

  /*
   * Suggestions stop the moment the name matches what was tapped, and come back
   * the moment it stops matching. So editing a chosen name is never blocked, and
   * the list is not hanging around under a field somebody has finished with.
   */
  const suggestions = useMemo(() => {
    if (chosenName !== null && formData.name === chosenName) return [];
    return matchCatalog(formData.name, catalog, { businessType });
  }, [formData.name, catalog, businessType, chosenName]);

  // Blank means "no limit on this side", which is why these aren't parseFloat|0.
  const optionalNumber = (value: string) => {
    if (value.trim() === '') return null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const minPriceValue = optionalNumber(formData.minPrice);
  const maxPriceValue = optionalNumber(formData.maxPrice);
  const bandInverted =
    minPriceValue !== null && maxPriceValue !== null && minPriceValue > maxPriceValue;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bandInverted) return;

    onSave({
      name: formData.name,
      costPrice: parseFloat(formData.costPrice) || 0,
      sellingPrice: parseFloat(formData.sellingPrice) || 0,
      minPrice: minPriceValue,
      maxPrice: maxPriceValue,
      quantity: parseInt(formData.quantity) || 0,
      lowStockThreshold: parseInt(formData.lowStockThreshold) || 5,
      durationMinutes: parseInt(formData.durationMinutes) || 0,
      category: formData.category || undefined,
      // The link survives only while the name still is the one that was tapped.
      // Renaming it to something else makes the old link a lie.
      canonicalId: chosenName !== null && formData.name === chosenName ? canonicalId : null,
      canonicalSource: chosenName !== null && formData.name === chosenName ? 'chosen' : null,
      // Below two is not a pack, it is just a number somebody typed, and the
      // database refuses it anyway.
      unitsPerPack: parseInt(formData.unitsPerPack) > 1 ? parseInt(formData.unitsPerPack) : null,
      packLabel: formData.packLabel.trim() || null,
      barcode: formData.barcode.trim() || null,
    });
  };

  const profit = (parseFloat(formData.sellingPrice) || 0) - (parseFloat(formData.costPrice) || 0);

  return (
    <Modal
      title={product ? 'Edit product' : 'Add product'}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={bandInverted}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="name">Product name *</Label>
        <Input
          id="name"
          placeholder="e.g. Unga wa Ngano (2kg)"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />

        {/*
          * Typing two hundred products by hand is the real reason somebody gives
          * up ten minutes into their first day. Swahili, English and the usual
          * misspellings all lead to the same entry, so "maziwa lita moja" finds
          * Fresh Milk 1L without anybody being taught the app's vocabulary.
          */}
        {suggestions.length > 0 && (
          <div className="sheet p-0 overflow-hidden divide-y divide-border/70">
            <p className="sheet-heading px-3 pt-2 pb-1 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Did you mean
            </p>
            {suggestions.map(({ entry }) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    name: entry.name,
                    category: prev.category || entry.category,
                  }));
                  setCanonicalId(entry.id);
                  setChosenName(entry.name);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left active:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{entry.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {/* For a branded row the name already says the brand and
                        the size, so repeating the category under it tells you
                        nothing. What it is underneath does. */}
                    {entry.brand ? entry.productType : entry.category}
                    {entry.soldBy === 'weight' ? ' · sold by weight' : ''}
                    {entry.soldBy === 'length' ? ' · sold by the metre' : ''}
                    {entry.kind === 'service' ? ' · service' : ''}
                  </p>
                </div>
                {canonicalId === entry.id && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {chosenName !== null && formData.name === chosenName && (
          <p className="text-xs text-muted-foreground">
            Matched to the shared list. Your reports can compare this with other shops.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="costPrice">What it costs you *</Label>
          <Input
            id="costPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0"
            value={formData.costPrice}
            onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
            required
            min="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sellingPrice">What you sell it for *</Label>
          <Input
            id="sellingPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0"
            value={formData.sellingPrice}
            onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
            required
            min="0"
          />
        </div>
      </div>

      {(
        <div className="space-y-2 rounded-xl border border-border p-3">
          <Label>Negotiable price range (Optional)</Label>
          <p className="text-xs text-muted-foreground">
            If staff are allowed to agree a price with the customer, set how low and
            how high they may go. Leave blank to keep the price fixed.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="Lowest"
              aria-label="Lowest price staff may agree"
              value={formData.minPrice}
              onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
              min="0"
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="Highest"
              aria-label="Highest price staff may agree"
              value={formData.maxPrice}
              onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
              min="0"
            />
          </div>
          {bandInverted && (
            <p className="text-xs text-destructive">
              The lowest price cannot be higher than the highest.
            </p>
          )}
        </div>
      )}

      {profit !== 0 && (
        <div className={`p-3 rounded-lg ${profit > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          <p className="text-sm font-medium">
            Profit per item: {ksh(profit)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="quantity">How many you have *</Label>
          <Input
            id="quantity"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="0"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            required
            min="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lowStockThreshold">Warn me at</Label>
          <Input
            id="lowStockThreshold"
            type="number"
            inputMode="numeric"
            step="1"
            placeholder="5"
            value={formData.lowStockThreshold}
            onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
            min="0"
          />
        </div>
      </div>

      {/*
        * Set once here, used every time stock comes in.
        *
        * A bar buys beer by the crate and sells it by the bottle. Saying a crate
        * holds 24 once means the restock dialog can ask for crates and do the
        * division itself, rather than the shopkeeper typing 5 into a box marked
        * "how many came in" and ending up with five bottles on the shelf.
        */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="unitsPerPack">How many in a pack?</Label>
          <Input
            id="unitsPerPack"
            type="number"
            inputMode="numeric"
            step="1"
            min="2"
            placeholder="e.g. 24"
            value={formData.unitsPerPack}
            onChange={(e) => setFormData({ ...formData, unitsPerPack: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packLabel">What is it called?</Label>
          <Input
            id="packLabel"
            placeholder="e.g. crate"
            value={formData.packLabel}
            onChange={(e) => setFormData({ ...formData, packLabel: e.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Only if you buy it in packs and sell it one at a time. Leave both empty
        otherwise.
      </p>

      <div className="space-y-2">
        <Label htmlFor="barcode">Barcode (Optional)</Label>
        <Input
          id="barcode"
          inputMode="numeric"
          placeholder="The number under the bars"
          value={formData.barcode}
          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
          className="num"
        />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Type or scan it and this item comes straight up when you search, which
          beats picking the right bottle out of a list of near-identical names.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category (Optional)</Label>
        <Input
          id="category"
          placeholder="e.g. Food, Dairy, Soap"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        />
      </div>

    </Modal>
  );
}
