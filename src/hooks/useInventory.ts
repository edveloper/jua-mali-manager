import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Product, Sale, SalePayment, DashboardStats, StockMovement } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';
import { instantForDate } from '@/lib/dates';
import type { RestockInput } from '@/types/inventory';
import { cacheRead, cacheWrite } from '@/lib/localCache';
import { enqueueSale, pendingSales, removeSale, looksLikeNoSignal } from '@/lib/saleQueue';

/*
 * The generated Supabase types are produced from the live schema, so they do
 * not know a function until its migration has been applied. Narrowed to one
 * named escape hatch rather than scattering casts through the call sites.
 */
const callRpc = supabase.rpc as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
import { markFresh, markServedFromCache } from '@/lib/offlineState';

export interface BasketLine {
  productId: string;
  quantity: number;
  /** The negotiated price per unit, when it differs from the catalog price. */
  unitPrice?: number;
}

export interface BasketPayment {
  method: string;
  amount: number;
  reference?: string;
}

/**
 * Money is decimal and JavaScript is not, so 15.7 * 3 is 47.099999999999994.
 * The database refuses a basket whose payments do not add up to its items, and
 * that refusal must come from a real mistake, not from binary floating point.
 */
const round2 = (n: number) => Math.round(n * 100) / 100;

export const useInventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [salePayments, setSalePayments] = useState<SalePayment[]>([]);
  const [allStockMovements, setAllStockMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { shop, isOwner } = useAuth();
  const { toast } = useToast();

  /*
   * Hydrate from the saved copy once per shop, not on every refresh.
   *
   * Without this, recording a sale refetches, the refetch reads the cache
   * first, and the screen jumps back to the pre-sale figures for a moment
   * before the server answers. Keyed by shop rather than a plain boolean so
   * that switching shops still gets its own first paint.
   */
  const hydratedFor = useRef<string | null>(null);
  // One drain at a time. The online event can fire more than once.
  const drainingRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = async () => {
    if (!shop?.id) { setPendingCount(0); return; }
    setPendingCount((await pendingSales(shop.id)).length);
  };

  const fetchProducts = async () => {
    if (!shop?.id) {
      setProducts([]);
      setAllSales([]);
      setSalePayments([]);
      setAllStockMovements([]);
      setIsLoading(false);
      return;
    }
    /*
     * Show what we had, then go and check.
     *
     * Reading the saved copy first means the Sell list is on screen before the
     * request has even left the phone, which on a slow connection is the whole
     * difference between an app and a spinner. When the request comes back the
     * list is replaced; when it never comes back, the shopkeeper still has
     * their prices and is told the figures are saved ones.
     */
    const firstLoad = hydratedFor.current !== shop.id;
    const saved = firstLoad ? await cacheRead<Product>(shop.id, 'products') : null;
    if (saved && saved.rows.length > 0) {
      setProducts(saved.rows);
      setIsLoading(false);
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.from('products')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      const mapped: Product[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category || 'General',
        costPrice: Number(p.cost_price || 0),
        sellingPrice: Number(p.price),
        minPrice: p.min_price === null || p.min_price === undefined ? null : Number(p.min_price),
        maxPrice: p.max_price === null || p.max_price === undefined ? null : Number(p.max_price),
        quantity: p.stock_level,
        lowStockThreshold: p.min_stock_level,
        unit: p.unit || 'pcs',
        canonicalId: p.canonical_id ?? null,
        canonicalSource: p.canonical_source ?? null,
        unitsPerPack: p.units_per_pack ?? null,
        packLabel: p.pack_label ?? null,
        barcode: p.barcode ?? null,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));

      setProducts(mapped);
      hydratedFor.current = shop.id;
      markFresh('products');
      // Not awaited: the shopkeeper is looking at the list already, and a
      // write to IndexedDB is not something to make them wait for.
      void cacheWrite(shop.id, 'products', mapped);
    } catch (error: any) {
      console.error("Products error:", error);
      // A failed fetch with a saved copy on screen is not an empty shop, it is
      // an old one. Say which, rather than leaving the figures looking live.
      if (saved && saved.rows.length > 0) markServedFromCache('products', saved.savedAt);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSales = async () => {
    if (!shop?.id) return;

    const saved = hydratedFor.current !== shop.id
      ? await cacheRead<Sale>(shop.id, 'sales')
      : null;
    if (saved && saved.rows.length > 0) setAllSales(saved.rows);

    try {
      const { data, error } = await supabase.from('sales')
        .select('*')
        .eq('shop_id', shop.id)
        // Postgres returns rows in no guaranteed order. Nothing should rely on
        // that, but leaving it unordered is how the sales chart ended up drawn
        // in whatever sequence the rows happened to arrive.
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: Sale[] = (data || []).map((s: any) => {
        const totalAmount = Number(s.total_amount || 0);
        const costAtSale = Number(s.cost_price_at_sale || 0);
        const qty = Number(s.quantity || 0);
        return {
          id: s.id,
          receiptId: s.receipt_id || s.id,
          productId: s.product_id,
          productName: s.product_name,
          quantity: qty,
          unitPrice: Number(s.unit_price ?? (qty > 0 ? totalAmount / qty : 0)),
          costPrice: costAtSale,
          listPriceAtSale: Number(s.list_price_at_sale ?? 0),
          priceSource: s.price_source || 'list',
          soldBy: s.sold_by || null,
          voidedAt: s.voided_at || null,
          voidedBy: s.voided_by || null,
          paymentMethod: s.payment_method || null,
          paymentReference: s.payment_reference || null,
          totalAmount,
          profit: totalAmount - (costAtSale * qty),
          createdAt: s.created_at
        };
      });

      setAllSales(mapped);
      markFresh('sales');
      void cacheWrite(shop.id, 'sales', mapped);
    } catch (error: any) {
      if (saved && saved.rows.length > 0) markServedFromCache('sales', saved.savedAt);
      console.error("Sales error:", error);
    }
  };

  // How the money actually arrived. Kept separate from sales because one
  // payment can cover several lines, and one receipt can take several payments.
  const fetchSalePayments = async () => {
    if (!shop?.id) return;
    try {
      const { data, error } = await supabase.from('sale_payments')
        .select('*')
        .eq('shop_id', shop.id);

      if (error) throw error;

      setSalePayments((data || []).map((p: any) => ({
        id: p.id,
        receiptId: p.receipt_id,
        amount: Number(p.amount || 0),
        method: p.payment_method,
        reference: p.payment_reference || null,
        createdAt: p.created_at,
      })));
    } catch (error: any) {
      console.error("Sale payments error:", error);
    }
  };

  const fetchStockMovements = async () => {
    if (!shop?.id) return;
    try {
      const { data, error } = await supabase.from('stock_movements')
        .select('*')
        .eq('shop_id', shop.id)
        .order('happened_at', { ascending: false });

      if (error) throw error;

      setAllStockMovements((data || []).map((m: any) => ({
        id: m.id,
        productId: m.product_id,
        productName: m.product_name || 'Unknown',
        movementType: m.movement_type,
        reason: m.reason,
        quantity: Number(m.quantity || 0),
        unitCost: Number(m.unit_cost || 0),
        totalCost: Number(m.total_cost || 0),
        notes: m.notes || '',
        happenedAt: m.happened_at,
        expenseId: m.expense_id || null,
        createdBy: m.created_by || null,
        voidedAt: m.voided_at || null,
        voidedBy: m.voided_by || null,
        voidReason: m.void_reason || null,
        previousCostPrice: m.previous_cost_price === null || m.previous_cost_price === undefined
          ? null
          : Number(m.previous_cost_price),
      })));
    } catch (error: any) {
      console.error("Stock movements error:", error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSales();
    fetchSalePayments();
    fetchStockMovements();
  }, [shop?.id]);

  // Everything that adds up money uses this. allSales exists only so the day
  // list can show a cancelled sale struck through rather than vanishing.
  const sales = allSales.filter((s) => !s.voidedAt);

  // Same rule for stock. allStockMovements keeps the cancelled ones so the
  // activity log can show that a correction was made.
  const stockMovements = allStockMovements.filter((m) => !m.voidedAt);

  const voidSale = async (saleId: string, reason?: string) => {
    if (!shop?.id) return false;
    const { error } = await supabase.rpc('void_sale_atomic', {
      p_shop_id: shop.id,
      p_sale_id: saleId,
      p_reason: reason ?? null,
    });

    if (error) {
      toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Sale cancelled', description: 'The stock has been put back.' });
    await fetchProducts();
    await fetchSales();
    await fetchSalePayments();
    return true;
  };

  const voidRestock = async (movementId: string, reason?: string) => {
    if (!shop?.id) return false;

    const { data, error } = await supabase.rpc('void_restock_atomic', {
      p_shop_id: shop.id,
      p_movement_id: movementId,
      p_reason: reason ?? null,
    });

    if (error) {
      toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' });
      return false;
    }

    const row = Array.isArray(data) ? data[0] : data;
    toast({
      title: 'Restock cancelled',
      description: row && row.cost_restored === false
        ? 'Stock and spending are back. Check the cost price, it could not be restored for an old entry.'
        : 'The stock, the cost price and the spending have been put back.',
    });

    await fetchProducts();
    await fetchStockMovements();
    await fetchSales();
    return true;
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { unit?: string }) => {
    if (!shop?.id || !isOwner) return;
    try {
      const { error } = await supabase.from('products').insert([{
        shop_id: shop.id,
        name: productData.name,
        category: productData.category,
        cost_price: productData.costPrice,
        price: productData.sellingPrice,
        min_price: productData.minPrice ?? null,
        max_price: productData.maxPrice ?? null,
        stock_level: productData.quantity,
        min_stock_level: productData.lowStockThreshold,
        unit: productData.unit || 'pcs',
        canonical_id: productData.canonicalId ?? null,
        canonical_source: productData.canonicalSource ?? null,
        units_per_pack: productData.unitsPerPack ?? null,
        pack_label: productData.packLabel ?? null,
        barcode: productData.barcode?.trim() || null
      }]);
      if (error) throw error;
      toast({ title: "Product added successfully" });
      await fetchProducts();
    } catch (error: any) {
      toast({ title: "Error adding product", description: error.message, variant: "destructive" });
    }
  };

  const bulkImportProducts = async (rows: Array<Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { unit?: string }>) => {
    if (!shop?.id || !isOwner) {
      // Returning quietly here is how a refusal reaches somebody as nothing at
      // all, which is exactly how the missing import call stayed hidden.
      const error = { message: 'Only the shop owner can import a catalogue' };
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
      return { inserted: 0, error };
    }
    if (rows.length === 0) return { inserted: 0, error: null as any };
    try {
      const payload = rows.map((row) => ({
        shop_id: shop.id,
        name: row.name,
        category: row.category,
        cost_price: row.costPrice,
        price: row.sellingPrice,
        stock_level: row.quantity,
        min_stock_level: row.lowStockThreshold,
        unit: row.unit || 'pcs'
      }));
      const { error } = await supabase.from('products').insert(payload);
      if (error) throw error;
      await fetchProducts();
      toast({ title: `Imported ${rows.length} products` });
      return { inserted: rows.length, error: null as any };
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
      return { inserted: 0, error };
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product> & { unit?: string }) => {
    if (!isOwner) return;
    try {
      const { error } = await supabase.from('products')
        .update({
          name: updates.name,
          category: updates.category,
          cost_price: updates.costPrice,
          price: updates.sellingPrice,
          min_price: updates.minPrice ?? null,
          max_price: updates.maxPrice ?? null,
          stock_level: updates.quantity,
          min_stock_level: updates.lowStockThreshold,
          unit: updates.unit,
          canonical_id: updates.canonicalId ?? null,
          canonical_source: updates.canonicalSource ?? null,
          units_per_pack: updates.unitsPerPack ?? null,
          pack_label: updates.packLabel ?? null,
          barcode: updates.barcode?.trim() || null
        })
        .eq('id', id);
      if (error) throw error;
      await fetchProducts();
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  };

  // Archive, never delete. stock_movements cascades on product deletion, so a
  // hard delete would take that product's whole restock history with it.
  const deleteProduct = async (id: string) => {
    if (!isOwner) return;
    try {
      const { error } = await supabase.from('products')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      toast({ title: "Product removed", description: "Past sales and restocks are kept." });
      await fetchProducts();
    } catch (error: any) {
      toast({ title: "Could not remove product", variant: "destructive" });
    }
  };

  // One sale, however many items and however many ways it was paid for. A single
  // item paid in cash is just the smallest case of this, which is why there is
  // no separate single-item path to drift out of step.
  //
  // unitPrice is the negotiated price per line. Omit it to sell at the catalog
  // price; the RPC re-checks permission and the owner's band either way.
  //
  // Items, payments and the deni all land in one transaction. The old flow wrote
  // the sale first and the debt afterwards, so a failure in between left a sale
  // looking paid that nobody owed.
  const recordBasketSale = async (
    lines: BasketLine[],
    payments: BasketPayment[],
    credit?: { customerId: string; amount: number }
  ) => {
    if (!shop?.id || lines.length === 0) return null;

    /*
     * Name the sale before sending it, and keep that name for every retry.
     *
     * This is what lets a queued sale be sent twice safely: the server
     * recognises the second arrival and answers with what happened the first
     * time, instead of recording it again.
     */
    const opId = crypto.randomUUID();
    const lineRows = lines.map((l) => ({
      product_id: l.productId,
      quantity: l.quantity,
      unit_price: l.unitPrice ?? null,
    }));
    const paymentRows = payments.map((p) => ({
      method: p.method,
      amount: round2(p.amount),
      reference: p.reference ?? null,
    }));

    try {
      const { data, error } = await callRpc('record_sale_once', {
        p_shop_id: shop.id,
        p_client_op_id: opId,
        p_lines: lineRows,
        p_payments: paymentRows,
        p_customer_id: credit?.customerId ?? null,
        p_credit_amount: round2(credit?.amount ?? 0),
      });
      if (error) throw error;

      await fetchProducts();
      await fetchSales();
      await fetchSalePayments();
      const rows = data as Record<string, unknown>[] | Record<string, unknown> | null;
      return Array.isArray(rows) ? rows[0] : rows;
    } catch (error: any) {
      /*
       * No signal is not a failed sale.
       *
       * The goods went across the counter either way. Telling somebody the sale
       * failed, when what actually failed was the network, teaches them the app
       * cannot be trusted in the places they most need it. So it is kept, and
       * sent when there is something to send it over.
       *
       * A genuine refusal -- not enough stock, no permission -- is a different
       * thing entirely and is reported as before, because retrying it forever
       * would change nothing.
       */
      if (looksLikeNoSignal(error)) {
        await enqueueSale({
          opId,
          shopId: shop.id,
          lines: lineRows,
          payments: paymentRows,
          customerId: credit?.customerId ?? null,
          creditAmount: round2(credit?.amount ?? 0),
          queuedAt: Date.now(),
          attempts: 0,
        });
        await refreshPendingCount();
        toast({
          title: 'Saved on this phone',
          description: 'No network. It will be sent as soon as you have signal.',
        });
        return { out_receipt_id: null, queued: true } as any;
      }

      toast({ title: "Sale failed", description: error.message, variant: "destructive" });
      return null;
    }
  };

  /*
   * Send whatever is waiting.
   *
   * Runs when the browser says the network is back and once on load, because
   * "back online" is a hopeful claim rather than a promise and a phone that was
   * closed while offline never hears the event at all.
   *
   * Failures are left in the queue. The server refuses a second recording of
   * the same named sale, so retrying costs a wasted request and never a
   * duplicate.
   */
  const drainPendingSales = async (options?: { manual?: boolean }) => {
    if (!shop?.id || drainingRef.current) return;
    drainingRef.current = true;

    try {
      const waiting = await pendingSales(shop.id);
      if (waiting.length === 0) return;

      let sent = 0;
      for (const sale of waiting) {
        const { error } = await callRpc('record_sale_once', {
          p_shop_id: sale.shopId,
          p_client_op_id: sale.opId,
          p_lines: sale.lines,
          p_payments: sale.payments,
          p_customer_id: sale.customerId,
          p_credit_amount: sale.creditAmount,
        });

        if (error) {
          // Still no signal: stop and keep the rest for next time. A real
          // refusal would repeat on every drain, so it is dropped rather than
          // left to jam the queue forever.
          if (looksLikeNoSignal(error)) break;
          console.error('A queued sale was refused outright:', error);
        }

        await removeSale(sale.opId);
        sent += 1;
      }

      if (sent > 0) {
        toast({
          title: sent === 1 ? 'Sale sent' : `${sent} sales sent`,
          description: 'What you recorded offline is now on the server.',
        });
        await fetchProducts();
        await fetchSales();
        await fetchSalePayments();
      } else if (options?.manual) {
        /*
         * Somebody tapped and nothing happened, so say why.
         *
         * Without this the banner reads as a dead button: it tries, the network
         * is still gone, the queue is unchanged and there is nothing on screen
         * to show any of that took place. A person taps twice more and then
         * writes the sales in a book as well.
         */
        toast({
          title: 'Still no network',
          description: 'Your sales are safe on this phone and will go as soon as there is signal.',
        });
      }
    } catch (error) {
      // A fetch that rejects rather than returning an error would otherwise
      // escape as an unhandled rejection, which is silent everywhere.
      console.error('Could not send the waiting sales:', error);
      if (options?.manual) {
        toast({
          title: 'Could not send them yet',
          description: 'They are still saved on this phone. Nothing is lost.',
        });
      }
    } finally {
      drainingRef.current = false;
      await refreshPendingCount();
    }
  };

  const restockProduct = async (input: RestockInput) => {
    const {
      productId, happenedAt, allocationMode, notes, paidNow = true,
      supplierId, paymentMethod, quantity, unitCost, packCount, unitsPerPack, packCost,
    } = input;
    // No client-side owner check: the RPC decides, using the same permission the
    // owner toggles. Two gates that can disagree is one gate too many.
    if (!shop?.id) return null;

    try {
      const { data, error } = await supabase.rpc('record_product_restock_atomic', {
        p_shop_id: shop.id,
        p_product_id: productId,
        // Two ways of saying the same delivery. Whichever was used, the
        // totals go in and the database derives the cost per unit, because
        // 2,500 for a carton of 24 is not a number that survives a round trip
        // through a rounded unit price.
        p_quantity: packCount ? null : quantity,
        p_unit_cost: packCount ? null : unitCost,
        p_pack_count: packCount ?? null,
        p_units_per_pack: packCount ? unitsPerPack : null,
        p_pack_cost: packCount ? packCost : null,
        p_happened_at: instantForDate(happenedAt),
        p_notes: notes || null,
        p_allocation_mode: allocationMode,
        p_paid_now: paidNow,
        p_supplier_id: supplierId ?? null,
        p_payment_method: paymentMethod ?? null,
      });
      if (error) throw error;

      toast({ title: "Restock recorded" });
      await fetchProducts();
      await fetchStockMovements();
      return Array.isArray(data) ? data[0] : data;
    } catch (error: any) {
      toast({ title: "Restock failed", description: error.message, variant: "destructive" });
      return null;
    }
  };

  const getStats = (): DashboardStats => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySalesData = sales.filter(s => new Date(s.createdAt) >= today);

    return {
      totalProducts: products.length,
      lowStockCount: products.filter(p => p.quantity <= p.lowStockThreshold).length,
      // Stock on hand is worth what you paid for it, not what you hope to sell
      // it for. Valuing it at retail books the profit before the sale happens.
      totalStockValue: products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0),
      totalStockRetailValue: products.reduce((sum, p) => sum + (p.sellingPrice * p.quantity), 0),
      todaySales: todaySalesData.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0),
      todayProfit: todaySalesData.reduce((sum, s) => sum + (Number(s.profit) || 0), 0)
    };
  };

  /*
   * Send what is waiting, when there is something to send it over.
   *
   * Both triggers matter. The event covers signal returning while the app is
   * open; the mount covers a phone that was shut in a dead spot and opened
   * somewhere with coverage, which never fires an event at all.
   */
  useEffect(() => {
    if (!shop?.id) return;

    void refreshPendingCount();
    void drainPendingSales();

    const onBack = () => { void drainPendingSales(); };
    window.addEventListener('online', onBack);
    return () => window.removeEventListener('online', onBack);
  }, [shop?.id]);

  return {
    products,
    sales,
    allSales,
    salePayments,
    voidSale,
    voidRestock,
    stockMovements,
    allStockMovements,
    isLoading,
    addProduct,
    bulkImportProducts,
    updateProduct,
    deleteProduct,
    recordBasketSale,
    restockProduct,
    getStats,
    getLowStockProducts: () => products.filter(p => p.quantity <= p.lowStockThreshold),
    getRestockMovements: () => stockMovements.filter((m) => m.reason === 'restock' && m.movementType === 'in'),
    /*
     * Name or barcode, with an exact barcode first.
     *
     * A scanner types the whole number and presses enter, so the match is
     * exact and should be the only thing on screen. Everything else is
     * somebody typing part of a name, where a substring is what they mean.
     */
    pendingSaleCount: pendingCount,
    drainPendingSales,
    searchProducts: (q: string) => {
      const query = q.trim().toLowerCase();
      if (!query) return products;

      const scanned = products.find((p) => (p.barcode ?? '').toLowerCase() === query);
      if (scanned) return [scanned];

      return products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.barcode ?? '').toLowerCase().includes(query)
      );
    },
    refreshProducts: fetchProducts
  };
};
