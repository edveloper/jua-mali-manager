import { useState } from 'react';
import { Store } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import { useCredit } from '@/hooks/useCredit';
import { Dashboard } from '@/components/Dashboard';
import { ProductList } from '@/components/ProductList';
import { ProductForm } from '@/components/ProductForm';
import { SellDialog } from '@/components/SellDialog';
import { LowStockAlerts } from '@/components/LowStockAlerts';
import { SalesHistory } from '@/components/SalesHistory';
import { CreditManager } from '@/components/CreditManager';
import { SalesReports } from '@/components/SalesReports';
import { Navigation, TabType } from '@/components/Navigation';
import { Product } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  
  const { toast } = useToast();
  const {
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
  } = useInventory();

  const {
    customers,
    creditSales,
    addCustomer,
    addCreditSale,
    recordPayment,
    getTotalOwed,
    getCustomerTotalOwed,
  } = useCredit();

  const stats = getStats();
  const lowStockProducts = getLowStockProducts();
  const totalOwed = getTotalOwed();
  const pendingCredits = creditSales.filter(cs => cs.status !== 'paid').length;

  const handleSaveProduct = (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingProduct) {
      updateProduct(editingProduct.id, productData);
      toast({
        title: "Product Updated",
        description: `${productData.name} has been updated.`,
      });
    } else {
      addProduct(productData);
      toast({
        title: "Product Added",
        description: `${productData.name} has been added to inventory.`,
      });
    }
    setShowProductForm(false);
    setEditingProduct(null);
  };

  const handleDeleteProduct = (id: string) => {
    const product = products.find(p => p.id === id);
    deleteProduct(id);
    toast({
      title: "Product Deleted",
      description: product ? `${product.name} has been removed.` : "Product removed.",
      variant: "destructive",
    });
  };

  const handleSell = (productId: string, quantity: number, isCredit?: boolean, customerId?: string) => {
    const sale = recordSale(productId, quantity);
    if (sale) {
      if (isCredit && customerId) {
        addCreditSale(customerId, sale.id, sale.productName, quantity, sale.totalAmount);
        toast({
          title: "Credit Sale Recorded",
          description: `Sold ${quantity}x ${sale.productName} on credit for KSh ${sale.totalAmount.toLocaleString()}`,
        });
      } else {
        toast({
          title: "Sale Recorded",
          description: `Sold ${quantity}x ${sale.productName} for KSh ${sale.totalAmount.toLocaleString()}`,
        });
      }
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowProductForm(true);
  };

  const handleRecordPayment = (creditSaleId: string, amount: number) => {
    const payment = recordPayment(creditSaleId, amount);
    if (payment) {
      toast({
        title: "Payment Recorded",
        description: `KSh ${amount.toLocaleString()} payment received.`,
      });
    }
  };

  const handleAddCustomer = (name: string, phone?: string) => {
    const customer = addCustomer(name, phone);
    if (customer) {
      toast({
        title: "Customer Added",
        description: `${name} has been added.`,
      });
    }
    return customer;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground mt-4">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-30">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-xl">
              <Store className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Duka Manager</h1>
              <p className="text-sm text-muted-foreground">Simple Inventory Tracking</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-4">
        {activeTab === 'dashboard' && (
          <Dashboard stats={{ ...stats, totalCreditOwed: totalOwed }} />
        )}
        
        {activeTab === 'products' && (
          <ProductList
            products={products}
            onSearch={searchProducts}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
            onAdd={handleAddProduct}
            onSell={setSellingProduct}
          />
        )}
        
        {activeTab === 'alerts' && (
          <LowStockAlerts
            products={lowStockProducts}
            onRestock={handleEditProduct}
          />
        )}
        
        {activeTab === 'sales' && <SalesHistory sales={sales} />}

        {activeTab === 'credit' && (
          <CreditManager
            customers={customers}
            creditSales={creditSales}
            totalOwed={totalOwed}
            onAddCustomer={handleAddCustomer}
            onRecordPayment={handleRecordPayment}
            getCustomerTotalOwed={getCustomerTotalOwed}
          />
        )}

        {activeTab === 'reports' && <SalesReports sales={sales} />}
      </main>

      {/* Bottom Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertCount={lowStockProducts.length}
        creditCount={pendingCredits}
      />

      {/* Modals */}
      {showProductForm && (
        <ProductForm
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={() => {
            setShowProductForm(false);
            setEditingProduct(null);
          }}
        />
      )}

      {sellingProduct && (
        <SellDialog
          product={sellingProduct}
          customers={customers}
          onSell={handleSell}
          onClose={() => setSellingProduct(null)}
        />
      )}
    </div>
  );
};

export default Index;
