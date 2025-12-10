import { useState, useEffect, useCallback } from 'react';
import { Product, Sale, DashboardStats } from '@/types/inventory';

const PRODUCTS_KEY = 'duka_products';
const SALES_KEY = 'duka_sales';

// Sample products for demo
const sampleProducts: Product[] = [
  {
    id: '1',
    name: 'Unga wa Ngano (2kg)',
    barcode: '6001234567890',
    costPrice: 180,
    sellingPrice: 220,
    quantity: 25,
    lowStockThreshold: 10,
    category: 'Food',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    name: 'Cooking Oil (1L)',
    barcode: '6001234567891',
    costPrice: 280,
    sellingPrice: 350,
    quantity: 8,
    lowStockThreshold: 10,
    category: 'Food',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    name: 'Sugar (1kg)',
    barcode: '6001234567892',
    costPrice: 150,
    sellingPrice: 180,
    quantity: 30,
    lowStockThreshold: 15,
    category: 'Food',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '4',
    name: 'Milk (500ml)',
    barcode: '6001234567893',
    costPrice: 55,
    sellingPrice: 70,
    quantity: 5,
    lowStockThreshold: 12,
    category: 'Dairy',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '5',
    name: 'Bread (Loaf)',
    barcode: '6001234567894',
    costPrice: 50,
    sellingPrice: 65,
    quantity: 3,
    lowStockThreshold: 5,
    category: 'Bakery',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export function useInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from localStorage
  useEffect(() => {
    const loadData = () => {
      try {
        const storedProducts = localStorage.getItem(PRODUCTS_KEY);
        const storedSales = localStorage.getItem(SALES_KEY);
        
        if (storedProducts) {
          const parsed = JSON.parse(storedProducts);
          setProducts(parsed.map((p: Product) => ({
            ...p,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
          })));
        } else {
          // Load sample products for first-time users
          setProducts(sampleProducts);
          localStorage.setItem(PRODUCTS_KEY, JSON.stringify(sampleProducts));
        }
        
        if (storedSales) {
          const parsed = JSON.parse(storedSales);
          setSales(parsed.map((s: Sale) => ({
            ...s,
            createdAt: new Date(s.createdAt),
          })));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Save products to localStorage
  const saveProducts = useCallback((newProducts: Product[]) => {
    setProducts(newProducts);
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(newProducts));
  }, []);

  // Save sales to localStorage
  const saveSales = useCallback((newSales: Sale[]) => {
    setSales(newSales);
    localStorage.setItem(SALES_KEY, JSON.stringify(newSales));
  }, []);

  // Add product
  const addProduct = useCallback((product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProduct: Product = {
      ...product,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    saveProducts([...products, newProduct]);
    return newProduct;
  }, [products, saveProducts]);

  // Update product
  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    const newProducts = products.map(p => 
      p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
    );
    saveProducts(newProducts);
  }, [products, saveProducts]);

  // Delete product
  const deleteProduct = useCallback((id: string) => {
    saveProducts(products.filter(p => p.id !== id));
  }, [products, saveProducts]);

  // Record sale
  const recordSale = useCallback((productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.quantity < quantity) return null;

    const sale: Sale = {
      id: crypto.randomUUID(),
      productId,
      productName: product.name,
      quantity,
      unitPrice: product.sellingPrice,
      costPrice: product.costPrice,
      totalAmount: product.sellingPrice * quantity,
      profit: (product.sellingPrice - product.costPrice) * quantity,
      createdAt: new Date(),
    };

    saveSales([...sales, sale]);
    updateProduct(productId, { quantity: product.quantity - quantity });
    
    return sale;
  }, [products, sales, saveSales, updateProduct]);

  // Get low stock products
  const getLowStockProducts = useCallback(() => {
    return products.filter(p => p.quantity <= p.lowStockThreshold);
  }, [products]);

  // Get dashboard stats
  const getStats = useCallback((): DashboardStats => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaySalesData = sales.filter(s => new Date(s.createdAt) >= today);
    
    return {
      totalProducts: products.length,
      lowStockCount: products.filter(p => p.quantity <= p.lowStockThreshold).length,
      totalStockValue: products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0),
      todaySales: todaySalesData.reduce((sum, s) => sum + s.totalAmount, 0),
      todayProfit: todaySalesData.reduce((sum, s) => sum + s.profit, 0),
    };
  }, [products, sales]);

  // Search products
  const searchProducts = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) ||
      p.barcode?.includes(query) ||
      p.category?.toLowerCase().includes(lowerQuery)
    );
  }, [products]);

  // Find by barcode
  const findByBarcode = useCallback((barcode: string) => {
    return products.find(p => p.barcode === barcode);
  }, [products]);

  return {
    products,
    sales,
    isLoading,
    addProduct,
    updateProduct,
    deleteProduct,
    recordSale,
    getLowStockProducts,
    getStats,
    searchProducts,
    findByBarcode,
  };
}
