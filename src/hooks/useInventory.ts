import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Product, Sale, DashboardStats, StockMovement } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';

export const useInventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { shop, isOwner } = useAuth();
  const { toast } = useToast();

  const fetchProducts = async () => {
    if (!shop?.id) {
      setProducts([]);
      setSales([]);
      setStockMovements([]);
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
        .eq('shop_id', shop.id);

      if (error) throw error;

      setSales((data || []).map((s: any) => {
        const totalAmount = Number(s.total_amount || 0);
        const costAtSale = Number(s.cost_price_at_sale || 0);
        const qty = Number(s.quantity || 0);
        return {
          id: s.id,
          productId: s.product_id,
          productName: s.product_name,
          quantity: qty,
          unitPrice: Number(s.unit_price ?? (qty > 0 ? totalAmount / qty : 0)),
          costPrice: costAtSale,
          listPriceAtSale: Number(s.list_price_at_sale ?? 0),
          priceSource: s.price_source || 'list',
          soldBy: s.sold_by || null,
          totalAmount,
          profit: totalAmount - (costAtSale * qty),
          createdAt: s.created_at
        };
      }));
    } catch (error: any) {
      console.error("Sales error:", error);
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

      setStockMovements((data || []).map((m: any) => ({
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
      })));
    } catch (error: any) {
      console.error("Stock movements error:", error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSales();
    fetchStockMovements();
  }, [shop?.id]);

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

  // unitPrice is the negotiated price per unit. Omit it to sell at the catalog
  // price; the RPC re-checks permission and the owner's band either way.
  const recordSale = async (productId: string, quantity: number, unitPrice?: number) => {
    if (!shop?.id) return;

    try {
      const { data, error } = await supabase.rpc('record_product_sale_atomic', {
        p_shop_id: shop.id,
        p_product_id: productId,
        p_quantity: quantity,
        p_unit_price: unitPrice ?? null,
      });
      if (error) throw error;

      await fetchProducts();
      await fetchSales();
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
    notes?: string
  ) => {
    if (!shop?.id || !isOwner) return null;

    try {
      const { data, error } = await supabase.rpc('record_product_restock_atomic', {
        p_shop_id: shop.id,
        p_product_id: productId,
        p_quantity: quantity,
        p_unit_cost: unitCost,
        p_happened_at: `${happenedAt}T12:00:00`,
        p_notes: notes || null,
        p_allocation_mode: allocationMode,
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
    stockMovements,
    isLoading,
    addProduct,
    bulkImportProducts,
    updateProduct,
    deleteProduct,
    recordSale,
    restockProduct,
    getStats,
    getLowStockProducts: () => products.filter(p => p.quantity <= p.lowStockThreshold),
    getRestockMovements: () => stockMovements.filter((m) => m.reason === 'restock' && m.movementType === 'in'),
    searchProducts: (q: string) => products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())),
    refreshProducts: fetchProducts
  };
};
