import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { format, subDays, addDays, isSameDay } from 'date-fns';
import { useInventory } from '@/hooks/useInventory';
import { useCredit } from '@/hooks/useCredit';
import { useExpenses } from '@/hooks/useExpenses';
import { useShopMembers } from '@/hooks/useShopMembers';
import { useAuth } from '@/contexts/AuthContext';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { DayBook } from '@/components/DayBook';
import { DaySales } from '@/components/DaySales';
import { ProductList } from '@/components/ProductList';
import { ProductForm } from '@/components/ProductForm';
import { SellDialog } from '@/components/SellDialog';
import { RestockDialog } from '@/components/RestockDialog';
import { LowStockAlerts } from '@/components/LowStockAlerts';
import { CreditManager } from '@/components/CreditManager';
import { SalesReports } from '@/components/SalesReports';
import { ExpenseManager } from '@/components/ExpenseManager';
import { SettingsPanel } from '@/components/SettingsPanel';
import { EmployeeManager } from '@/components/EmployeeManager';
import { MoreMenu } from '@/components/MoreMenu';
import { HelpPanel } from '@/components/HelpPanel';
import { PrivacyPanel } from '@/components/PrivacyPanel';
import { ContactPanel } from '@/components/ContactPanel';
import { Navigation, type TabType } from '@/components/Navigation';
import { Product } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Screens reached from More, which get a back arrow instead of a nav slot. */
const SUB_SCREENS: TabType[] = ['settings', 'staff', 'help', 'privacy', 'contact', 'alerts'];

const SCREEN_TITLES: Partial<Record<TabType, string>> = {
  settings: 'Shop details',
  staff: 'Staff',
  help: 'How this works',
  privacy: 'Your data',
  contact: 'Contact us',
  alerts: 'Running low',
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { installApp, canInstall } = usePwaInstall();

  const { user, loading: authLoading, isOwner, can, shop, shopMember, membershipResolved, signOut } = useAuth();

  const {
    products, sales, allSales, stockMovements, isLoading: inventoryLoading,
    addProduct, bulkImportProducts, updateProduct, deleteProduct,
    recordSale, voidSale, restockProduct, getLowStockProducts, getStats, searchProducts
  } = useInventory();

  const {
    customers, creditSales, addCustomer,
    addCreditSale, recordPayment, getTotalOwed, getCustomerTotalOwed,
    getPaymentsTotalForRange, getPaymentsForCredit
  } = useCredit();

  const { members, nameFor } = useShopMembers();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [user, authLoading, navigate]);

  // Signed in, but no longer a member of any shop -- i.e. the owner removed them.
  // Gated on membershipResolved so a failed lookup never signs anyone out.
  useEffect(() => {
    if (authLoading || !user || !membershipResolved || shopMember) return;
    (async () => {
      await signOut();
      navigate('/auth?removed=1', { replace: true });
    })();
  }, [authLoading, user, membershipResolved, shopMember, signOut, navigate]);

  const currentMonthSales = sales
    .filter((s) => {
      const d = new Date(s.createdAt);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

  const { expenses, addExpense, deleteExpense, quickAddTOT, getAccruedExpensesForDate, getExpenseTotalForRange } =
    useExpenses(currentMonthSales);

  const isAppLoading = authLoading || (inventoryLoading && !shopMember);

  useEffect(() => {
    if (!isAppLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadingTimedOut(true), 15000);
    return () => window.clearTimeout(timer);
  }, [isAppLoading]);

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        {!loadingTimedOut ? (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Opening your shop...</p>
          </>
        ) : (
          <div className="sheet max-w-sm text-center space-y-3">
            <p className="font-semibold">Taking longer than usual</p>
            <p className="text-sm text-muted-foreground">Check your connection, then try again.</p>
            <Button className="w-full" onClick={() => window.location.reload()}>Try again</Button>
          </div>
        )}
      </div>
    );
  }

  const stats = getStats();
  const isToday = isSameDay(viewDate, new Date());
  const dateLabel = isToday ? "Today's" : format(viewDate, 'MMM d');

  const daySales = sales.filter((s) => isSameDay(new Date(s.createdAt), viewDate));
  const daySalesWithVoided = allSales.filter((s) => isSameDay(new Date(s.createdAt), viewDate));
  const daySalesTotal = daySales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  const dayProfit = daySales.reduce((sum, s) => sum + Number(s.profit || 0), 0);
  const daySpent = getAccruedExpensesForDate(viewDate, { includeInventoryPurchases: false });

  // A sale is "on deni" when a credit record points at it.
  const creditSaleIds = new Set(creditSales.map((c) => c.saleId));
  const dayOnDeni = daySales
    .filter((s) => creditSaleIds.has(s.id))
    .reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  const dayPaidNow = daySalesTotal - dayOnDeni;
  const dayDeniPaidBack = getPaymentsTotalForRange(viewDate, viewDate);

  const lowStockProducts = getLowStockProducts();
  const unpaidDeniCount = creditSales.filter((cs) => cs.status !== 'paid').length;
  const staffCount = members.filter((m) => m.role === 'employee').length;

  const missingCostCount = products.filter((p) => Number(p.costPrice || 0) <= 0).length;
  const missingPriceCount = products.filter((p) => Number(p.sellingPrice || 0) <= 0).length;

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

  const handleSell = async (
    itemId: string,
    quantity: number,
    options?: {
      isCredit?: boolean;
      customerId?: string;
      newCustomer?: { name: string; phone: string };
      unitPrice?: number;
    }
  ) => {
    const { isCredit, customerId, newCustomer, unitPrice } = options || {};

    // Resolve the customer BEFORE the sale. If we created them afterwards and it
    // failed, stock would already be gone and the sale would look like cash.
    let resolvedCustomerId = customerId;
    if (isCredit && !resolvedCustomerId && newCustomer?.name) {
      const created = await addCustomer({
        name: newCustomer.name,
        phone: newCustomer.phone || '',
        email: '',
      });
      resolvedCustomerId = created?.id;
    }

    if (isCredit && !resolvedCustomerId) {
      toast({
        title: 'Could not save the customer',
        description: 'Nothing was recorded. Check your connection and try again.',
        variant: 'destructive',
      });
      return false;
    }

    const sale = await recordSale(itemId, quantity, unitPrice);
    if (!sale) return false;

    if (isCredit && resolvedCustomerId) {
      await addCreditSale(
        resolvedCustomerId,
        sale.id,
        sale.product_name,
        quantity,
        Number(sale.total_amount)
      );
    }
    setSellingProduct(null);
    return true;
  };

  const isSubScreen = SUB_SCREENS.includes(activeTab);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background border-b border-border">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-3">
          {isSubScreen ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'alerts' ? 'dashboard' : 'more')}
                className="-ml-2 p-2 text-muted-foreground"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-base font-semibold truncate">{SCREEN_TITLES[activeTab]}</h1>
            </>
          ) : (
            <h1 className="text-lg font-bold truncate">{shop?.name || 'Tarihi'}</h1>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {activeTab === 'dashboard' && (
          <>
            {isOwner && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {isToday ? format(new Date(), 'EEEE d MMMM') : format(viewDate, 'EEEE d MMMM')}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate((p) => subDays(p, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-8 px-2" onClick={() => setViewDate(new Date())} disabled={isToday}>
                    Today
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate((p) => addDays(p, 1))} disabled={isToday}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {isOwner && (missingCostCount + missingPriceCount) > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className="sheet w-full text-left border-warning/50 bg-warning/5 pressable"
              >
                <p className="text-sm font-semibold">Some items are missing prices</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Without a cost price the app cannot work out your profit, so it will look better than it is.
                </p>
              </button>
            )}

            {isOwner && (
              <DayBook
                dateLabel={dateLabel}
                sales={daySalesTotal}
                paidNow={dayPaidNow}
                onDeni={dayOnDeni}
                deniPaidBack={dayDeniPaidBack}
                spent={daySpent}
                takeHome={dayProfit - daySpent}
                stockValue={stats.totalStockValue}
                stockRetailValue={stats.totalStockRetailValue ?? 0}
                owedToYou={getTotalOwed()}
                lowStockCount={lowStockProducts.length}
                onNavigate={setActiveTab}
              />
            )}

            {!isOwner && lowStockProducts.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('alerts')}
                className="sheet w-full text-left pressable"
              >
                <p className="sheet-heading">Running low</p>
                <p className="text-lg amount text-warning mt-1">
                  {lowStockProducts.length} {lowStockProducts.length === 1 ? 'item' : 'items'}
                </p>
              </button>
            )}

            <DaySales
              sales={daySalesWithVoided}
              nameFor={nameFor}
              onVoid={voidSale}
              showSeller={isOwner && staffCount > 0}
            />
          </>
        )}

        {activeTab === 'products' && (
          <ProductList
            products={products}
            onSearch={searchProducts}
            onEdit={(p) => { setEditingProduct(p); setShowProductForm(true); }}
            onDelete={deleteProduct}
            onAdd={() => { setEditingProduct(null); setShowProductForm(true); }}
            onSell={(p) => setSellingProduct(p)}
            onRestock={isOwner ? (p) => setRestockingProduct(p) : undefined}
            isOwner={isOwner}
          />
        )}

        {activeTab === 'credit' && isOwner && (
          <CreditManager
            customers={customers}
            creditSales={creditSales}
            totalOwed={getTotalOwed()}
            onAddCustomer={(name, phone) => addCustomer({ name, phone: phone || '', email: '' })}
            onRecordPayment={recordPayment}
            getCustomerTotalOwed={getCustomerTotalOwed}
            getPaymentsForCredit={getPaymentsForCredit}
          />
        )}

        {activeTab === 'money' && isOwner && (
          <Tabs defaultValue="spending">
            <TabsList className="w-full grid grid-cols-2 gap-1 p-1">
              <TabsTrigger value="spending">Spending</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="spending" className="pt-3">
              <ExpenseManager
                expenses={expenses}
                onAddExpense={addExpense}
                onDeleteExpense={deleteExpense}
                onQuickAddTOT={quickAddTOT}
                monthlySales={currentMonthSales}
                businessCategory={shop?.business_category || 'retail'}
              />
            </TabsContent>
            <TabsContent value="reports" className="pt-3">
              <SalesReports
                sales={sales}
                creditSales={creditSales}
                getCreditPaymentsTotalForRange={getPaymentsTotalForRange}
                getExpenseTotalForRange={getExpenseTotalForRange}
                expenses={expenses}
                stockPurchases={stockMovements.filter((m) => m.reason === 'restock' && m.movementType === 'in')}
                businessCategory={shop?.business_category || 'retail'}
              />
            </TabsContent>
          </Tabs>
        )}

        {activeTab === 'more' && (
          <MoreMenu
            onNavigate={setActiveTab}
            staffCount={staffCount}
            canInstall={canInstall}
            onInstall={installApp}
          />
        )}

        {activeTab === 'alerts' && (
          <LowStockAlerts
            products={lowStockProducts}
            onRestock={isOwner ? (p) => setRestockingProduct(p) : undefined}
          />
        )}

        {activeTab === 'staff' && isOwner && <EmployeeManager />}
        {activeTab === 'settings' && <SettingsPanel onImportProducts={bulkImportProducts} />}
        {activeTab === 'help' && <HelpPanel />}
        {activeTab === 'privacy' && <PrivacyPanel />}
        {activeTab === 'contact' && <ContactPanel />}
      </main>

      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOwner={isOwner}
        deniCount={isOwner ? unpaidDeniCount : 0}
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
          canOverridePrice={can('override_price')}
        />
      )}
      {restockingProduct && (
        <RestockDialog
          product={restockingProduct}
          onRestock={async (productId, quantity, unitCost, happenedAt, allocationMode, notes) => {
            await restockProduct(productId, quantity, unitCost, happenedAt, allocationMode, notes);
            setRestockingProduct(null);
          }}
          onClose={() => setRestockingProduct(null)}
        />
      )}
    </div>
  );
};

export default Index;
