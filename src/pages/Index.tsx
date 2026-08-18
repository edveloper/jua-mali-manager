import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { format, subDays, addDays, isSameDay } from 'date-fns';
import { useInventory, BasketLine, BasketPayment } from '@/hooks/useInventory';
import { useCredit } from '@/hooks/useCredit';
import { useExpenses } from '@/hooks/useExpenses';
import { useShopMembers } from '@/hooks/useShopMembers';
import { useTillCount } from '@/hooks/useTillCount';
import { useStockTake } from '@/hooks/useStockTake';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useMpesa } from '@/hooks/useMpesa';
import { useAuth } from '@/contexts/AuthContext';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { DayBook } from '@/components/DayBook';
import { DaySales } from '@/components/DaySales';
import { ProductList } from '@/components/ProductList';
import { ProductForm } from '@/components/ProductForm';
import { SaleDialog } from '@/components/SaleDialog';
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
import { AboutPanel } from '@/components/AboutPanel';
import { GettingStarted } from '@/components/GettingStarted';
import { CashUp } from '@/components/CashUp';
import { StockPanel } from '@/components/StockPanel';
import { SupplierDebts } from '@/components/SupplierDebts';
import { RecordsPanel } from '@/components/RecordsPanel';
import { MpesaReconcile } from '@/components/MpesaReconcile';
import { Logo } from '@/components/Logo';
import { Navigation, type TabType } from '@/components/Navigation';
import { Product } from '@/types/inventory';
import { PAYMENT_METHODS, methodLabel } from '@/lib/payment';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Screens reached from More, which get a back arrow instead of a nav slot. */
const SUB_SCREENS: TabType[] = ['settings', 'staff', 'help', 'privacy', 'contact', 'about', 'alerts'];

const SCREEN_TITLES: Partial<Record<TabType, string>> = {
  settings: 'Shop details',
  staff: 'Staff',
  help: 'How this works',
  privacy: 'Your data',
  contact: 'Contact us',
  about: 'About Tarihi',
  alerts: 'Running low',
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  // Controlled so Reports can send the owner to Export, where the files live.
  const [moneyTab, setMoneyTab] = useState('reports');
  const [showSale, setShowSale] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [productsView, setProductsView] = useState<'sell' | 'stock'>('sell');
  const [deniView, setDeniView] = useState<'in' | 'out'>('in');
  const [viewDate, setViewDate] = useState(new Date());
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { installApp, canInstall } = usePwaInstall();

  const { user, loading: authLoading, isOwner, can, shop, shopMember, membershipResolved, signOut } = useAuth();

  const {
    products, sales, allSales, stockMovements, isLoading: inventoryLoading,
    addProduct, bulkImportProducts, updateProduct, deleteProduct,
    recordBasketSale, voidSale, restockProduct, getLowStockProducts, getStats, searchProducts,
    salePayments
  } = useInventory();

  const {
    customers, creditSales, payments: creditPayments, addCustomer,
    refresh: refreshCredit, recordPayment, getTotalOwed, getCustomerTotalOwed,
    getPaymentsTotalForRange, getPaymentsForCredit, paymentsBetween
  } = useCredit();

  const { members, nameFor, fullNameFor } = useShopMembers();
  const { countFor, openingFor, saveCount } = useTillCount();
  const {
    entries: mpesaEntries, isImporting: mpesaImporting,
    importEntries, forget: forgetMpesaEntry,
  } = useMpesa();
  const { takes, recordCount } = useStockTake();
  const {
    suppliers, debts: supplierDebts,
    totalOwed: totalOwedToSuppliers, addSupplier, addDebt, payDebt,
    debtsFor, owedTo, paymentsFor, supplierName,
  } = useSuppliers();

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

  const { expenses, addExpense, deleteExpense, quickAddTOT, getAccruedExpensesForDate, getCashSpentForDate, getExpenseTotalForRange } =
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

  // What was taken on deni today. Read from the credit book rather than from the
  // sales, because a receipt can be part paid and part deni -- the debt is the
  // only place the unpaid share is actually written down.
  const dayCredits = creditSales.filter((c) => isSameDay(new Date(c.createdAt), viewDate));
  const dayOnDeni = dayCredits.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  // How the money that did arrive arrived. One receipt can have several of
  // these, which is exactly why they are rows and not a column on the sale.
  const dayPayments = salePayments.filter((p) => isSameDay(new Date(p.createdAt), viewDate));
  const dayPaidNow = dayPayments.reduce((sum, p) => sum + p.amount, 0);
  const dayDeniPaidBack = getPaymentsTotalForRange(viewDate, viewDate);

  // Whatever is left over is takings from before payment methods were recorded.
  // It is shown as "not recorded" rather than assumed to be cash.
  const dayUnrecorded = Math.max(0, daySalesTotal - dayOnDeni - dayPaidNow);

  const receivedToday: { method: string; amount: number }[] = [
    ...dayPayments.map((p) => ({ method: p.method, amount: p.amount })),
    ...paymentsBetween(viewDate, viewDate)
      .map((p) => ({ method: p.paymentMethod || 'unknown', amount: p.amount })),
    ...(dayUnrecorded > 0 ? [{ method: 'unknown', amount: dayUnrecorded }] : []),
  ];

  const cashOf = (rows: { method: string; amount: number }[]) =>
    rows.filter((r) => r.method === 'cash').reduce((sum, r) => sum + r.amount, 0);

  const cashSales = cashOf(dayPayments.map((p) => ({ method: p.method, amount: p.amount })));
  const cashDeniPaid = cashOf(
    paymentsBetween(viewDate, viewDate).map((p) => ({ method: p.paymentMethod || 'unknown', amount: p.amount }))
  );
  // Not daySpent: that figure spreads recurring bills across the month, which is
  // right for profit and wrong for a till.
  const cashSpent = getCashSpentForDate(viewDate);

  const byMethod = [...PAYMENT_METHODS.map((m) => m.value), 'unknown']
    .map((method) => ({
      method,
      label: method === 'unknown' ? 'Not recorded' : methodLabel(method),
      amount: receivedToday
        .filter((r) => r.method === method)
        .reduce((sum, r) => sum + r.amount, 0),
    }))
    .filter((row) => row.amount > 0);

  const lowStockProducts = getLowStockProducts();
  const unpaidDeniCount = creditSales.filter((cs) => cs.status !== 'paid').length;
  const staffCount = members.filter((m) => m.role === 'employee').length;

  const missingCostCount = products.filter((p) => Number(p.costPrice || 0) <= 0).length;
  const missingPriceCount = products.filter((p) => Number(p.sellingPrice || 0) <= 0).length;

  const goTo = (tab: TabType) => {
    if (tab === 'stock') {
      setProductsView('stock');
      setActiveTab('products');
      return;
    }
    // Tapping Sell always means selling, even if Stock was the last thing open.
    if (tab === 'products') setProductsView('sell');
    setActiveTab(tab);
  };

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

  // Items, payments and any deni go to the database as one call, so a basket
  // cannot end up half recorded. The customer is still resolved first: creating
  // them afterwards and failing would leave a sale nobody owed.
  const handleSell = async (
    lines: BasketLine[],
    payments: BasketPayment[],
    credit?: { customerId?: string; newCustomer?: { name: string; phone: string }; amount: number }
  ) => {
    let resolvedCustomerId = credit?.customerId;

    if (credit && !resolvedCustomerId && credit.newCustomer?.name) {
      const created = await addCustomer({
        name: credit.newCustomer.name,
        phone: credit.newCustomer.phone || '',
        email: '',
      });
      resolvedCustomerId = created?.id;
    }

    if (credit && !resolvedCustomerId) {
      toast({
        title: 'Could not save the customer',
        description: 'Nothing was recorded. Check your connection and try again.',
        variant: 'destructive',
      });
      return false;
    }

    const result = await recordBasketSale(
      lines,
      payments,
      credit && resolvedCustomerId
        ? { customerId: resolvedCustomerId, amount: credit.amount }
        : undefined
    );
    if (!result) return false;

    if (credit) await refreshCredit();
    setShowSale(false);
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
            <>
              <h1 className="text-lg font-bold truncate flex-1 min-w-0">{shop?.name || 'Tarihi'}</h1>
              <Logo wordmark={false} size="sm" />
            </>
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
                onClick={() => goTo('products')}
                className="sheet w-full text-left border-warning/50 bg-warning/5 pressable"
              >
                <p className="text-sm font-semibold">Some items are missing prices</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Without a cost price the app cannot work out your profit, so it will look better than it is.
                </p>
              </button>
            )}

            {isOwner && (
              <GettingStarted
                hasProducts={products.length > 0}
                hasSales={sales.length > 0}
                onNavigate={goTo}
              />
            )}

            {isOwner && sales.length > 0 && (
              <DayBook
                dateLabel={dateLabel}
                sales={daySalesTotal}
                paidNow={dayPaidNow}
                onDeni={dayOnDeni}
                deniPaidBack={dayDeniPaidBack}
                byMethod={byMethod}
                spent={daySpent}
                takeHome={dayProfit - daySpent}
                stockValue={stats.totalStockValue}
                stockRetailValue={stats.totalStockRetailValue ?? 0}
                owedToYou={getTotalOwed()}
                lowStockCount={lowStockProducts.length}
                onNavigate={goTo}
              />
            )}

            {!isOwner && products.length === 0 && (
              <div className="sheet">
                <p className="text-sm text-muted-foreground">
                  Nothing has been added to sell yet. Ask the owner to add the products
                  you handle and they will show up here.
                </p>
              </div>
            )}

            {!isOwner && lowStockProducts.length > 0 && (
              <button
                type="button"
                onClick={() => goTo('alerts')}
                className="sheet w-full text-left pressable"
              >
                <p className="sheet-heading">Running low</p>
                <p className="text-lg amount text-warning mt-1">
                  {lowStockProducts.length} {lowStockProducts.length === 1 ? 'item' : 'items'}
                </p>
              </button>
            )}

            {isOwner && daySales.length > 0 && (
              <CashUp
                dateLabel={isToday ? 'today' : format(viewDate, 'MMM d')}
                cashSales={cashSales}
                cashDeniPaid={cashDeniPaid}
                cashSpent={cashSpent}
                nonCashIn={byMethod.filter((m) => m.method !== 'cash').map((m) => ({ label: m.label, amount: m.amount }))}
                openingBalance={openingFor(viewDate)}
                savedCount={countFor(viewDate)}
                onSaveCount={(countedCash, expectedCash) => saveCount(viewDate, countedCash, expectedCash)}
              />
            )}

            {(sales.length > 0 || !isOwner) && (
            <DaySales
              sales={daySalesWithVoided}
              nameFor={nameFor}
              onVoid={voidSale}
              showSeller={isOwner && staffCount > 0}
            />
            )}
          </>
        )}

        {activeTab === 'products' && isOwner && (
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant={productsView === 'sell' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setProductsView('sell')}
            >
              Sell
            </Button>
            <Button
              variant={productsView === 'stock' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setProductsView('stock')}
            >
              Stock
            </Button>
          </div>
        )}

        {activeTab === 'products' && isOwner && productsView === 'stock' && (
          <StockPanel
            products={products}
            sales={sales}
            takes={takes}
            onRecordCount={recordCount}
          />
        )}

        {activeTab === 'products' && (!isOwner || productsView === 'sell') && (
          <ProductList
            products={products}
            onSearch={searchProducts}
            onEdit={(p) => { setEditingProduct(p); setShowProductForm(true); }}
            onDelete={deleteProduct}
            onAdd={() => { setEditingProduct(null); setShowProductForm(true); }}
            onSell={(p) => { setSellingProduct(p); setShowSale(true); }}
            onStartSale={() => { setSellingProduct(null); setShowSale(true); }}
            onRestock={isOwner ? (p) => setRestockingProduct(p) : undefined}
            isOwner={isOwner}
          />
        )}

        {activeTab === 'credit' && isOwner && (
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant={deniView === 'in' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDeniView('in')}
            >
              They owe me
            </Button>
            <Button
              variant={deniView === 'out' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDeniView('out')}
            >
              I owe
            </Button>
          </div>
        )}

        {activeTab === 'credit' && isOwner && deniView === 'out' && (
          <SupplierDebts
            suppliers={suppliers}
            totalOwed={totalOwedToSuppliers}
            debtsFor={debtsFor}
            owedTo={owedTo}
            paymentsFor={paymentsFor}
            supplierName={supplierName}
            onAddSupplier={addSupplier}
            onAddDebt={addDebt}
            onPay={payDebt}
          />
        )}

        {activeTab === 'credit' && (isOwner || can('manage_deni')) && (!isOwner || deniView === 'in') && (
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

        {/* Staff with the permission get Spending on its own -- Reports would
            show them cost prices and profit, which they are not meant to see. */}
        {activeTab === 'money' && !isOwner && can('record_expenses') && (
          <ExpenseManager
            expenses={expenses}
            onAddExpense={addExpense}
            onDeleteExpense={deleteExpense}
            onQuickAddTOT={quickAddTOT}
            monthlySales={0}
            businessCategory={shop?.business_category || 'retail'}
          />
        )}

        {activeTab === 'money' && isOwner && (
          <Tabs value={moneyTab} onValueChange={setMoneyTab}>
            <TabsList className="w-full grid grid-cols-4 gap-1 p-1">
              <TabsTrigger value="reports" className="text-xs px-1">Reports</TabsTrigger>
              <TabsTrigger value="spending" className="text-xs px-1">Spending</TabsTrigger>
              <TabsTrigger value="mpesa" className="text-xs px-1">M-Pesa</TabsTrigger>
              <TabsTrigger value="export" className="text-xs px-1">Export</TabsTrigger>
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
                salePayments={salePayments}
                stockPurchases={stockMovements.filter((m) => m.reason === 'restock' && m.movementType === 'in')}
                businessCategory={shop?.business_category || 'retail'}
                onGoToExport={() => setMoneyTab('export')}
              />
            </TabsContent>
            <TabsContent value="mpesa" className="pt-3">
              <MpesaReconcile
                sales={allSales}
                salePayments={salePayments}
                entries={mpesaEntries}
                isImporting={mpesaImporting}
                onImport={importEntries}
                onForget={forgetMpesaEntry}
              />
            </TabsContent>
            <TabsContent value="export" className="pt-3">
              <RecordsPanel
                shopName={shop?.name || ''}
                salePayments={salePayments}
                ownerName={String(user?.user_metadata?.full_name || '')}
                mpesaEntries={mpesaEntries}
                getExpenseTotalForRange={getExpenseTotalForRange}
                sales={allSales}
                expenses={expenses}
                creditSales={creditSales}
                creditPayments={creditPayments}
                supplierDebts={supplierDebts}
                suppliers={suppliers}
                products={products}
                customerName={(id) => customers.find((c) => c.id === id)?.name ?? 'Customer'}
                sellerName={fullNameFor}
              />
            </TabsContent>
          </Tabs>
        )}

        {activeTab === 'more' && (
          <MoreMenu
            onNavigate={goTo}
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
        {activeTab === 'about' && <AboutPanel />}
      </main>

      <Navigation
        activeTab={activeTab}
        onTabChange={goTo}
        isOwner={isOwner}
        deniCount={isOwner || can('manage_deni') ? unpaidDeniCount : 0}
        canManageDeni={can('manage_deni')}
        canRecordExpenses={can('record_expenses')}
      />

      {showProductForm && isOwner && (
        <ProductForm
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={() => { setShowProductForm(false); setEditingProduct(null); }}
        />
      )}
      {showSale && (
        <SaleDialog
          products={products}
          customers={customers}
          initialProduct={sellingProduct}
          onSubmit={handleSell}
          onClose={() => { setShowSale(false); setSellingProduct(null); }}
          isOwner={isOwner}
          canOverridePrice={can('override_price')}
        />
      )}
      {restockingProduct && (
        <RestockDialog
          product={restockingProduct}
          suppliers={suppliers}
          onAddSupplier={addSupplier}
          onRestock={async (productId, quantity, unitCost, happenedAt, allocationMode, notes, paidNow, supplierId, paymentMethod) => {
            await restockProduct(productId, quantity, unitCost, happenedAt, allocationMode, notes, paidNow, supplierId, paymentMethod);
            setRestockingProduct(null);
          }}
          onClose={() => setRestockingProduct(null)}
        />
      )}
    </div>
  );
};

export default Index;
