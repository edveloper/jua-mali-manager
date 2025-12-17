import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Loader2 } from 'lucide-react';
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

  const {
    user,
    loading: authLoading, // Renamed 'loading' to 'authLoading' to match your local variable
    isOwner,
    shop,
    shopMember,
    signOut
  } = useAuth();

  const {
    products,
    sales,
    isLoading: inventoryLoading,
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading || (inventoryLoading && !shopMember)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading your Duka...</p>
      </div>
    );
  }

  if (!user || !shopMember) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 text-center">
        <div className="max-w-md space-y-6">
          <Store className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold">Shop Not Found</h2>
          <Button onClick={() => window.location.reload()}>Retry Connection</Button>
          <Button onClick={signOut} variant="outline">Sign Out</Button>
        </div>
      </div>
    );
  }

  // --- STATS CALCULATION ---
  const stats = getStats();
  const lowStockProducts = getLowStockProducts();
  const totalOwedAmount = getTotalOwed();
  const pendingCreditsCount = creditSales.filter(cs => cs.status !== 'paid').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySalesCount = sales.filter(s => new Date(s.createdAt) >= today).length;

  // --- ACTION HANDLERS ---
  const handleSaveProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!isOwner) return;
    if (editingProduct) {
      await updateProduct(editingProduct.id, productData);
    } else {
      await addProduct(productData);
    }
    setShowProductForm(false);
    setEditingProduct(null);
  };

  const handleSell = async (productId: string, quantity: number, isCredit?: boolean, customerId?: string) => {
    const sale = await recordSale(productId, quantity);
    if (sale && isCredit && customerId) {
      await addCreditSale(
        customerId,
        sale.id,
        sale.product_name || sale.productName,
        quantity,
        sale.total_amount || sale.totalAmount
      );
    }
    setSellingProduct(null);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-30">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 bg-primary rounded-xl text-primary-foreground"><Store className="h-6 w-6" /></div>
          <div className="flex-1">
            <h1 className="text-xl font-bold truncate">{shop?.name || 'My Duka'}</h1>
            <p className="text-xs text-muted-foreground font-semibold uppercase">{isOwner ? 'Owner' : 'Staff'}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>Logout</Button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4">
        {activeTab === 'dashboard' && (
          isOwner ? (
            <OwnerDashboard stats={{ ...stats, totalCreditOwed: totalOwedAmount }} />
          ) : (
            <EmployeeDashboard stats={stats} todaySalesCount={todaySalesCount} />
          )
        )}

        {activeTab === 'products' && (
          <ProductList
            products={products}
            onSearch={searchProducts}
            onEdit={(p) => { setEditingProduct(p); setShowProductForm(true); }}
            onDelete={(id) => deleteProduct(id)}
            onAdd={() => { setEditingProduct(null); setShowProductForm(true); }}
            onSell={setSellingProduct}
            isOwner={isOwner}
          />
        )}

        {activeTab === 'alerts' && (
          <LowStockAlerts
            products={lowStockProducts}
            onRestock={isOwner ? (p) => { setEditingProduct(p); setShowProductForm(true); } : undefined}
          />
        )}

        {activeTab === 'sales' && <SalesHistory sales={sales} />}

        {activeTab === 'credit' && isOwner && (
          <CreditManager
            customers={customers}
            creditSales={creditSales}
            totalOwed={totalOwedAmount}
            onAddCustomer={async (name, phone) => {
              const newCustomer = await addCustomer({ name, phone: phone || '', email: '' });
              return newCustomer; // Returns the actual Customer object after the cloud saves it
            }}
            onRecordPayment={recordPayment}
            getCustomerTotalOwed={getCustomerTotalOwed}
          />
        )}

        {activeTab === 'reports' && isOwner && <SalesReports sales={sales} />}
        {activeTab === 'settings' && <SettingsPanel />}
      </main>

      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertCount={lowStockProducts.length}
        creditCount={pendingCreditsCount}
        isOwner={isOwner}
      />

      {showProductForm && isOwner && (
        <ProductForm
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={() => { setShowProductForm(false); setEditingProduct(null); }}
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