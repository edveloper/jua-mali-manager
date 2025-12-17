import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Product, Sale, DashboardStats } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';

export const useInventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { shop, isOwner } = useAuth();
  const { toast } = useToast();

  const fetchProducts = async () => {
    if (!shop?.id) return;
    try {
      setIsLoading(true);
      const { data, error } = await (supabase.from('products') as any)
        .select('*')
        .eq('shop_id', shop.id)
        .order('name', { ascending: true });

      if (error) throw error;
      
      setProducts((data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category || 'General',
        costPrice: Number(p.cost_price || 0),
        sellingPrice: Number(p.price),
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
      const { data, error } = await (supabase.from('sales') as any)
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
          totalAmount: totalAmount,
          profit: totalAmount - (costAtSale * qty),
          createdAt: s.created_at
        };
      }));
    } catch (error: any) {
      console.error("Sales error:", error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSales();
  }, [shop?.id]);

  const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { unit?: string }) => {
    if (!shop?.id || !isOwner) return;
    try {
      const { error } = await (supabase.from('products') as any).insert([{
        shop_id: shop.id,
        name: productData.name,
        category: productData.category,
        cost_price: productData.costPrice,
        price: productData.sellingPrice,
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

  const updateProduct = async (id: string, updates: Partial<Product> & { unit?: string }) => {
    if (!isOwner) return;
    try {
      const { error } = await (supabase.from('products') as any)
        .update({
          name: updates.name,
          category: updates.category,
          cost_price: updates.costPrice,
          price: updates.sellingPrice,
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

  const deleteProduct = async (id: string) => {
    if (!isOwner) return;
    try {
      const { error } = await (supabase.from('products') as any).delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Product deleted" });
      await fetchProducts();
    } catch (error: any) {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const recordSale = async (productId: string, quantity: number) => {
    if (!shop?.id) return;
    const product = products.find(p => p.id === productId);
    if (!product || product.quantity < quantity) return null;

    try {
      const { data: saleData, error: saleError } = await (supabase.from('sales') as any).insert([{
        shop_id: shop.id,
        product_id: productId,
        product_name: product.name,
        quantity: quantity,
        total_amount: product.sellingPrice * quantity,
        cost_price_at_sale: product.costPrice || 0
      }]).select().single();

      if (saleError) throw saleError;

      await (supabase.from('products') as any)
        .update({ stock_level: product.quantity - quantity })
        .eq('id', productId);

      await fetchProducts();
      await fetchSales();
      return saleData;
    } catch (error: any) {
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
      totalStockValue: products.reduce((sum, p) => sum + (p.sellingPrice * p.quantity), 0),
      todaySales: todaySalesData.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0),
      todayProfit: todaySalesData.reduce((sum, s) => sum + (Number(s.profit) || 0), 0)
    };
  };

  return { 
    products, 
    sales, 
    isLoading, 
    addProduct,
    updateProduct,
    deleteProduct,
    recordSale, 
    getStats, 
    getLowStockProducts: () => products.filter(p => p.quantity <= p.lowStockThreshold),
    searchProducts: (q: string) => products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())),
    refreshProducts: fetchProducts 
  };
};