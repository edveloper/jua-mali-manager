import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import { useCredit } from '@/hooks/useCredit';
import { useAuth } from '@/contexts/AuthContext';
import { OwnerDashboard } from '@/components/OwnerDashboard';
import { EmployeeDashboard } from '@/components/EmployeeDashboard';
import { ProductList } from '@/components/ProductList';
import { ProductForm } from '@/components/ProductForm';
import { SellDialog } from '@/components/SellDialog';
import { LowStockAlerts } from '@/components/LowStockAlerts';
import { SalesHistory } from '@/components/SalesHistory';
import { CreditManager } from '@/components/CreditManager';
import { SalesReports } from '@/components/SalesReports';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Navigation, TabType } from '@/components/Navigation';
import { Product } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isOwner, shop, shopMember, signOut } = useAuth();
  
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

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const stats = getStats();
  const lowStockProducts = getLowStockProducts();
  const totalOwed = getTotalOwed();
  const pendingCredits = creditSales.filter(cs => cs.status !== 'paid').length;

  // Get today's sales count for employee dashboard
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySalesCount = sales.filter(s => new Date(s.createdAt) >= today).length;

  const handleSaveProduct = (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only shop owners can modify products.",
        variant: "destructive",
      });
      return;
    }

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
    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only shop owners can delete products.",
        variant: "destructive",
      });
      return;
    }

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
    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only shop owners can edit products.",
        variant: "destructive",
      });
      return;
    }
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handleAddProduct = () => {
    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only shop owners can add products.",
        variant: "destructive",
      });
      return;
    }
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

  // Show loading only while checking auth status
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user, the useEffect will handle redirect
  if (!user) {
    return null;
  }

  // Wait for shop membership data to load (with timeout fallback)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground mt-4">Loading your shop...</p>
        </div>
      </div>
    );
  }

  // If user exists but no shop membership found after loading, show error or redirect
  if (!shopMember) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-4 space-y-4">
          <p className="text-destructive mb-4 text-lg font-semibold">No shop found</p>
          <p className="text-muted-foreground text-sm">
            Your account is not associated with any shop. This might be because:
          </p>
          <ul className="text-muted-foreground text-sm text-left space-y-2">
            <li>• Your shop is still being set up</li>
            <li>• You need to be added by a shop owner</li>
          </ul>
          <Button onClick={() => {
            signOut();
            navigate('/auth');
          }} variant="outline" className="mt-4">
            Sign Out and Try Again
          </Button>
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
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">
                {shop?.name || 'Duka Manager'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isOwner ? 'Owner Dashboard' : 'Employee View'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-4">
        {activeTab === 'dashboard' && (
          isOwner ? (
            <OwnerDashboard stats={{ ...stats, totalCreditOwed: totalOwed }} />
          ) : (
            <EmployeeDashboard stats={stats} todaySalesCount={todaySalesCount} />
          )
        )}
        
        {activeTab === 'products' && (
          <ProductList
            products={products}
            onSearch={searchProducts}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
            onAdd={handleAddProduct}
            onSell={setSellingProduct}
            isOwner={isOwner}
          />
        )}
        
        {activeTab === 'alerts' && (
          <LowStockAlerts
            products={lowStockProducts}
            onRestock={isOwner ? handleEditProduct : undefined}
          />
        )}
        
        {activeTab === 'sales' && <SalesHistory sales={sales} />}

        {activeTab === 'credit' && isOwner && (
          <CreditManager
            customers={customers}
            creditSales={creditSales}
            totalOwed={totalOwed}
            onAddCustomer={handleAddCustomer}
            onRecordPayment={handleRecordPayment}
            getCustomerTotalOwed={getCustomerTotalOwed}
          />
        )}

        {activeTab === 'reports' && isOwner && (
          <SalesReports sales={sales} />
        )}

        {activeTab === 'settings' && <SettingsPanel />}
      </main>

      {/* Bottom Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertCount={lowStockProducts.length}
        creditCount={pendingCredits}
        isOwner={isOwner}
      />

      {/* Modals - Only show product form for owners */}
      {showProductForm && isOwner && (
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
          isOwner={isOwner}
        />
      )}
    </div>
  );
};

export default Index;