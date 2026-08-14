import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Menu, Settings, Users, LogOut, HelpCircle, ShieldAlert, MessageSquare, Download
} from 'lucide-react';
import { format, subDays, addDays, isSameDay } from 'date-fns';
import { useInventory } from '@/hooks/useInventory';
import { useServices } from '@/hooks/useServices';
import { useCredit } from '@/hooks/useCredit';
import { useExpenses } from '@/hooks/useExpenses';
import { useAuth } from '@/contexts/AuthContext';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { OwnerDashboard } from '@/components/OwnerDashboard';
import { EmployeeDashboard } from '@/components/EmployeeDashboard';
import { ProductList } from '@/components/ProductList';
import { ProductForm } from '@/components/ProductForm';
import { SellDialog } from '@/components/SellDialog';
import { RestockDialog } from '@/components/RestockDialog';
import { LowStockAlerts } from '@/components/LowStockAlerts';
import { CreditManager } from '@/components/CreditManager';
import { SalesReports } from '@/components/SalesReports';
import { ServiceSessionHistory } from '@/components/ServiceSessionHistory';
import { ExpenseManager } from '@/components/ExpenseManager';
import { SettingsPanel } from '@/components/SettingsPanel';
import { HelpPanel } from '@/components/HelpPanel';
import { PrivacyPanel } from '@/components/PrivacyPanel';
import { ContactPanel } from '@/components/ContactPanel';
import { Navigation, type TabType } from '@/components/Navigation';
import { Product, Sale } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CatalogKind = 'products' | 'services';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [catalogView, setCatalogView] = useState<CatalogKind>('products');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCatalogKind, setEditingCatalogKind] = useState<CatalogKind>('products');
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [sellingCatalogKind, setSellingCatalogKind] = useState<CatalogKind>('products');
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { installApp, canInstall } = usePwaInstall();

  const { user, loading: authLoading, isOwner, can, shop, shopMember, membershipResolved, signOut } = useAuth();

  const {
    products, sales, stockMovements, isLoading: inventoryLoading,
    addProduct, bulkImportProducts, updateProduct, deleteProduct,
    recordSale, restockProduct, getLowStockProducts, getStats, searchProducts
  } = useInventory();

  const {
    services, serviceSales, isLoading: servicesLoading,
    addService, bulkImportServices, updateService, deleteService,
    recordServiceSale, getLowAvailabilityServices, getStats: getServiceStats, searchServices
  } = useServices();

  const {
    customers, creditSales, addCustomer,
    addCreditSale, recordPayment, getTotalOwed, getCustomerTotalOwed
  } = useCredit();

  const offeringMode = shop?.offering_mode || 'products';
  const isServicesMode = offeringMode === 'services';
  const isMixedMode = offeringMode === 'mixed';
  const isServicesCatalog = isServicesMode || (isMixedMode && catalogView === 'services');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [user, authLoading, navigate]);

  // Signed in, but no longer a member of any shop -- i.e. the owner removed them.
  // Without this they land in an empty dashboard that looks broken. Gated on
  // membershipResolved so a failed lookup never signs anyone out by mistake.
  useEffect(() => {
    if (authLoading || !user || !membershipResolved || shopMember) return;
    (async () => {
      await signOut();
      navigate('/auth?removed=1', { replace: true });
    })();
  }, [authLoading, user, membershipResolved, shopMember, signOut, navigate]);

  useEffect(() => {
    if (offeringMode === 'services') {
      setCatalogView('services');
      if (activeTab === 'credit') setActiveTab('dashboard');
    } else if (offeringMode === 'products') {
      setCatalogView('products');
    }
  }, [offeringMode, activeTab]);

  const serviceToCatalogItem = (service: any): Product => ({
    id: service.id,
    name: service.name,
    category: service.category || 'General',
    costPrice: Number(service.costPrice || 0),
    sellingPrice: Number(service.sellingPrice || 0),
    quantity: Number(service.quantity || 0),
    lowStockThreshold: Number(service.lowStockThreshold || 0),
    durationMinutes: Number(service.durationMinutes || 0),
    createdAt: new Date(service.createdAt),
    updatedAt: new Date(service.updatedAt),
  });

  const serviceSaleToReportSale = (entry: any): Sale => {
    const quantity = Number(entry.quantity || 0);
    const totalAmount = Number(entry.totalAmount || 0);
    const unitPrice = quantity > 0 ? totalAmount / quantity : 0;
    return {
      id: entry.id,
      productId: entry.serviceId,
      productName: entry.serviceName,
      quantity,
      unitPrice,
      costPrice: 0,
      totalAmount,
      profit: Number(entry.profit || 0),
      createdAt: new Date(entry.createdAt),
    };
  };

  const serviceSalesForReports = serviceSales.map(serviceSaleToReportSale);
  const reportSales: Sale[] = isServicesMode
    ? serviceSalesForReports
    : (isMixedMode ? [...sales, ...serviceSalesForReports] : sales);

  const currentMonthProductSales = sales
    .filter((s) => {
      const d = new Date(s.createdAt);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

  const currentMonthServiceSales = serviceSales
    .filter((s) => {
      const d = new Date(s.createdAt);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

  const currentMonthSales = isServicesMode
    ? currentMonthServiceSales
    : (isMixedMode ? currentMonthProductSales + currentMonthServiceSales : currentMonthProductSales);

  const { expenses, addExpense, deleteExpense, quickAddTOT, getAccruedExpensesForDate, getExpenseTotalForRange } = useExpenses(currentMonthSales);

  const loadingData = isServicesMode
    ? servicesLoading
    : (isMixedMode ? (inventoryLoading || servicesLoading) : inventoryLoading);

  const isAppLoading = authLoading || (loadingData && !shopMember);

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
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground animate-pulse">Loading Duka Manager...</p>
          </>
        ) : (
          <div className="panel-glass p-5 max-w-sm text-center space-y-3">
            <p className="font-semibold">Still loading...</p>
            <p className="text-sm text-muted-foreground">Connection or session sync is taking longer than expected.</p>
            <Button className="w-full" onClick={() => window.location.reload()}>Reload App</Button>
          </div>
        )}
      </div>
    );
  }

  const productStats = getStats();
  const serviceStats = getServiceStats();
  const baseStats = isServicesMode
    ? serviceStats
    : (isMixedMode
      ? {
          totalProducts: productStats.totalProducts + serviceStats.totalProducts,
          lowStockCount: productStats.lowStockCount + serviceStats.lowStockCount,
          totalStockValue: productStats.totalStockValue + serviceStats.totalStockValue,
          todaySales: productStats.todaySales + serviceStats.todaySales,
          todayProfit: productStats.todayProfit + serviceStats.todayProfit,
        }
      : productStats);

  const isToday = isSameDay(viewDate, new Date());
  const dateLabel = isToday ? "Today's" : format(viewDate, "MMM do");
  const filteredSales = reportSales.filter((s) => isSameDay(new Date(s.createdAt), viewDate));
  const selectedDateSales = filteredSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  const selectedDateProfit = filteredSales.reduce((sum, s) => sum + Number(s.profit || 0), 0);
  const totalExpenses = getAccruedExpensesForDate(viewDate, { includeInventoryPurchases: false });

  const totalCreditOwed = isServicesMode ? 0 : getTotalOwed();
  const displayStats = {
    ...baseStats,
    todaySales: selectedDateSales,
    todayProfit: selectedDateProfit,
    netProfit: selectedDateProfit - totalExpenses,
    totalCreditOwed,
    totalExpenses: totalExpenses
  };

  const productLowAlerts = getLowStockProducts();
  const serviceLowAlerts = getLowAvailabilityServices().map(serviceToCatalogItem);
  const lowStockProducts = isServicesMode
    ? serviceLowAlerts
    : (isMixedMode ? [...productLowAlerts, ...serviceLowAlerts] : productLowAlerts);

  const totalOwedAmount = totalCreditOwed;
  const pendingCreditsCount = creditSales.filter((cs) => cs.status !== 'paid').length;

  const productMissingCostCount = products.filter((p) => Number(p.costPrice || 0) <= 0).length;
  const productMissingPriceCount = products.filter((p) => Number(p.sellingPrice || 0) <= 0).length;
  const serviceMissingCostCount = services.filter((s) => Number(s.costPrice || 0) <= 0).length;
  const serviceMissingPriceCount = services.filter((s) => Number(s.sellingPrice || 0) <= 0).length;
  const hasDataCompletionTasks = (productMissingCostCount + productMissingPriceCount + serviceMissingCostCount + serviceMissingPriceCount) > 0;

  const handleSaveProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!isOwner) return;

    if (editingCatalogKind === 'services') {
      if (editingProduct) {
        await updateService(editingProduct.id, {
          name: productData.name,
          category: productData.category,
          costPrice: productData.costPrice,
          sellingPrice: productData.sellingPrice,
          quantity: productData.quantity,
          lowStockThreshold: productData.lowStockThreshold,
          durationMinutes: productData.durationMinutes,
        });
      } else {
        await addService({
          name: productData.name,
          category: productData.category,
          costPrice: productData.costPrice,
          sellingPrice: productData.sellingPrice,
          quantity: productData.quantity,
          lowStockThreshold: productData.lowStockThreshold,
          durationMinutes: productData.durationMinutes,
        });
      }
    } else {
      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
      } else {
        await addProduct(productData);
      }
    }

    setShowProductForm(false);
    setEditingProduct(null);
  };

  const handleSell = async (
    itemId: string,
    quantity: number,
    isCredit?: boolean,
    customerId?: string,
    meta?: { staffName?: string; sessionTime?: string; notes?: string; status?: 'completed' | 'scheduled' | 'cancelled' },
    unitPrice?: number
  ) => {
    if (sellingCatalogKind === 'services') {
      await recordServiceSale(itemId, quantity, meta);
      setSellingProduct(null);
      return;
    }

    const sale = await recordSale(itemId, quantity, unitPrice);
    if (sale && isCredit && customerId) {
      const pName = sale.productName || (sale as any).product_name;
      const pAmount = sale.totalAmount || (sale as any).total_amount;

      await addCreditSale(
        customerId,
        sale.id,
        pName,
        quantity,
        Number(pAmount)
      );
    }
    setSellingProduct(null);
  };

  const currentCatalogProducts = isServicesCatalog ? services.map(serviceToCatalogItem) : products;
  const currentSearch = (query: string) => (
    isServicesCatalog
      ? searchServices(query).map(serviceToCatalogItem)
      : searchProducts(query)
  );
  const currentOfferingLabel = isServicesCatalog ? 'services' : (offeringMode === 'mixed' ? 'mixed' : 'products');

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30">
        <div className="max-w-md mx-auto px-4 pt-3">
          <div className="panel-glass px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-xl text-primary-foreground shadow-sm">
            <Store className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold truncate">{shop?.name || 'Duka Manager'}</h1>
            <p className="section-kicker mt-0.5">{isOwner ? 'Owner Workspace' : 'Staff Workspace'}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Menu className="h-6 w-6" />
                {isOwner && offeringMode !== 'services' && pendingCreditsCount > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-destructive rounded-full border-2 border-card" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Business Menu</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {canInstall && (
                <DropdownMenuItem onClick={installApp} className="bg-primary/10 text-primary font-semibold focus:bg-primary/20 focus:text-primary">
                  <Download className="mr-2 h-4 w-4" />
                  <span>Download App</span>
                </DropdownMenuItem>
              )}

              {isOwner && offeringMode !== 'services' && (
                <DropdownMenuItem onClick={() => setActiveTab('credit')}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Credit Book</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setActiveTab('settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setActiveTab('help')}>
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>How To / Help</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab('contact')}>
                <MessageSquare className="mr-2 h-4 w-4" />
                <span>Contact & Feedback</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTab('privacy')}>
                <ShieldAlert className="mr-2 h-4 w-4" />
                <span>Privacy & Policy</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {activeTab === 'dashboard' && isOwner && (
          <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate((prev) => subDays(prev, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" className="text-xs h-8 px-2" onClick={() => setViewDate(new Date())} disabled={isToday}>Today</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate((prev) => addDays(prev, 1))} disabled={isToday}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          isOwner ? (
            <div className="space-y-3">
              {hasDataCompletionTasks && (
                <div className="panel-glass p-4 border border-warning/40 bg-warning/5">
                  <p className="text-sm font-semibold">Data Completion Needed</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Missing key fields from imported items can distort profit and reports.
                  </p>
                  <div className="text-xs mt-2 space-y-1">
                    {productMissingCostCount > 0 && <p>{productMissingCostCount} products missing cost price.</p>}
                    {productMissingPriceCount > 0 && <p>{productMissingPriceCount} products missing selling price.</p>}
                    {serviceMissingCostCount > 0 && <p>{serviceMissingCostCount} services missing direct cost.</p>}
                    {serviceMissingPriceCount > 0 && <p>{serviceMissingPriceCount} services missing service price.</p>}
                  </div>
                  <Button size="sm" className="mt-3" onClick={() => setActiveTab('products')}>Review Catalog Data</Button>
                </div>
              )}
              <OwnerDashboard
                stats={displayStats}
                dateLabel={dateLabel}
                onNavigate={setActiveTab}
                offeringMode={offeringMode}
              />
            </div>
          ) : (
            <EmployeeDashboard stats={baseStats} todaySalesCount={filteredSales.length} offeringMode={offeringMode} />
          )
        )}

        {activeTab === 'products' && isMixedMode && (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted">
            <Button variant={catalogView === 'products' ? 'secondary' : 'ghost'} onClick={() => setCatalogView('products')}>Products</Button>
            <Button variant={catalogView === 'services' ? 'secondary' : 'ghost'} onClick={() => setCatalogView('services')}>Services</Button>
          </div>
        )}

        {activeTab === 'products' && (
          <ProductList
            products={currentCatalogProducts}
            onSearch={currentSearch}
            onEdit={(p) => {
              setEditingCatalogKind(isServicesCatalog ? 'services' : 'products');
              setEditingProduct(p);
              setShowProductForm(true);
            }}
            onDelete={(id) => (isServicesCatalog ? deleteService(id) : deleteProduct(id))}
            onAdd={() => {
              setEditingCatalogKind(isServicesCatalog ? 'services' : 'products');
              setEditingProduct(null);
              setShowProductForm(true);
            }}
            onSell={(p) => {
              setSellingCatalogKind(isServicesCatalog ? 'services' : 'products');
              setSellingProduct(p);
            }}
            onRestock={(!isServicesCatalog && isOwner) ? (p) => setRestockingProduct(p) : undefined}
            isOwner={isOwner}
            offeringMode={currentOfferingLabel}
          />
        )}

        {activeTab === 'expenses' && isOwner && (
          <ExpenseManager
            expenses={expenses}
            onAddExpense={addExpense}
            onDeleteExpense={deleteExpense}
            onQuickAddTOT={quickAddTOT}
            monthlySales={currentMonthSales}
            offeringMode={offeringMode}
            businessCategory={shop?.business_category || 'retail'}
            singleOffering={Boolean(shop?.single_offering)}
          />
        )}

        {activeTab === 'alerts' && (
          <LowStockAlerts
            products={lowStockProducts}
            offeringMode={offeringMode}
            onRestock={isOwner ? (p) => {
              const serviceHit = services.find((s) => s.id === p.id);
              setEditingCatalogKind(serviceHit ? 'services' : 'products');
              setEditingProduct(p);
              setShowProductForm(true);
            } : undefined}
          />
        )}

        {activeTab === 'credit' && isOwner && offeringMode !== 'services' && (
          <CreditManager
            customers={customers}
            creditSales={creditSales}
            totalOwed={totalOwedAmount}
            onAddCustomer={(name, phone) => addCustomer({ name, phone: phone || '', email: '' })}
            onRecordPayment={recordPayment}
            getCustomerTotalOwed={getCustomerTotalOwed}
          />
        )}

        {activeTab === 'reports' && isOwner && (
          <div className="space-y-6">
            <SalesReports
              sales={reportSales}
              creditSales={offeringMode === 'services' ? [] : creditSales}
              getExpenseTotalForRange={getExpenseTotalForRange}
              expenses={expenses}
              stockPurchases={stockMovements.filter((m) => m.reason === 'restock' && m.movementType === 'in')}
              serviceSessions={serviceSales}
              offeringMode={offeringMode}
              businessCategory={shop?.business_category || 'retail'}
              singleOffering={Boolean(shop?.single_offering)}
              lowStockProducts={lowStockProducts}
            />
            {(isServicesMode || isMixedMode) && <ServiceSessionHistory sessions={serviceSales} />}
          </div>
        )}
        {activeTab === 'settings' && (
          <SettingsPanel
            onImportProducts={bulkImportProducts}
            onImportServices={bulkImportServices}
          />
        )}
        {activeTab === 'help' && <HelpPanel />}
        {activeTab === 'privacy' && <PrivacyPanel />}
        {activeTab === 'contact' && <ContactPanel />}
      </main>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} alertCount={lowStockProducts.length} isOwner={isOwner} offeringMode={offeringMode} />

      {showProductForm && isOwner && (
        <ProductForm
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={() => { setShowProductForm(false); setEditingProduct(null); }}
          offeringMode={editingCatalogKind === 'services' ? 'services' : 'products'}
        />
      )}
      {sellingProduct && (
        <SellDialog
          product={sellingProduct}
          customers={customers}
          onSell={handleSell}
          onClose={() => setSellingProduct(null)}
          isOwner={isOwner}
          offeringMode={sellingCatalogKind === 'services' ? 'services' : 'products'}
          allowCredit={sellingCatalogKind !== 'services'}
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
