import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Product, Sale, SalePayment, DashboardStats, StockMovement } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';

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

  const fetchProducts = async () => {
    if (!shop?.id) {
      setProducts([]);
      setAllSales([]);
      setSalePayments([]);
      setAllStockMovements([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from('products')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      setProducts((data || []).map((p: any) => ({
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
        createdAt: p.created_at,
        updatedAt: p.updated_at
      })));
    } catch (error: any) {
      console.error("Products error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSales = async () => {
    if (!shop?.id) return;
    try {
      const { data, error } = await supabase.from('sales')
        .select('*')
        .eq('shop_id', shop.id)
        // Postgres returns rows in no guaranteed order. Nothing should rely on
        // that, but leaving it unordered is how the sales chart ended up drawn
        // in whatever sequence the rows happened to arrive.
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAllSales((data || []).map((s: any) => {
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
      }));
    } catch (error: any) {
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
        unit: productData.unit || 'pcs'
      }]);
      if (error) throw error;
      toast({ title: "Product added successfully" });
      await fetchProducts();
    } catch (error: any) {
      toast({ title: "Error adding product", description: error.message, variant: "destructive" });
    }
  };

  const bulkImportProducts = async (rows: Array<Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { unit?: string }>) => {
    if (!shop?.id || !isOwner || rows.length === 0) return { inserted: 0, error: null as any };
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
          unit: updates.unit
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

    try {
      const { data, error } = await supabase.rpc('record_basket_sale_atomic', {
        p_shop_id: shop.id,
        p_lines: lines.map((l) => ({
          product_id: l.productId,
          quantity: l.quantity,
          unit_price: l.unitPrice ?? null,
        })),
        p_payments: payments.map((p) => ({
          method: p.method,
          amount: round2(p.amount),
          reference: p.reference ?? null,
        })),
        p_customer_id: credit?.customerId ?? null,
        p_credit_amount: round2(credit?.amount ?? 0),
      });
      if (error) throw error;

      await fetchProducts();
      await fetchSales();
      await fetchSalePayments();
      return Array.isArray(data) ? data[0] : data;
    } catch (error: any) {
      toast({ title: "Sale failed", description: error.message, variant: "destructive" });
      return null;
    }
  };

  const restockProduct = async (
    productId: string,
    quantity: number,
    unitCost: number,
    happenedAt: string,
    allocationMode: 'cash' | 'accrual',
    notes?: string,
    paidNow: boolean = true,
    supplierId?: string,
    paymentMethod?: string
  ) => {
    // No client-side owner check: the RPC decides, using the same permission the
    // owner toggles. Two gates that can disagree is one gate too many.
    if (!shop?.id) return null;

    try {
      const { data, error } = await supabase.rpc('record_product_restock_atomic', {
        p_shop_id: shop.id,
        p_product_id: productId,
        p_quantity: quantity,
        p_unit_cost: unitCost,
        p_happened_at: `${happenedAt}T12:00:00`,
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
    searchProducts: (q: string) => products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())),
    refreshProducts: fetchProducts
  };
};
