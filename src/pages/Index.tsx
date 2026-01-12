import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Menu, Settings, Users, LogOut, HelpCircle, ShieldAlert, MessageSquare 
} from 'lucide-react';
import { format, subDays, addDays, isSameDay } from 'date-fns';
import { useInventory } from '@/hooks/useInventory';
import { useCredit } from '@/hooks/useCredit';
import { useExpenses } from '@/hooks/useExpenses';
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
import { ExpenseManager } from '@/components/ExpenseManager';
import { SettingsPanel } from '@/components/SettingsPanel';
import { HelpPanel } from '@/components/HelpPanel';
import { PrivacyPanel } from '@/components/PrivacyPanel';
import { ContactPanel } from '@/components/ContactPanel';
import { Navigation, type TabType } from '@/components/Navigation'; // Added 'type' to avoid conflict
import { Product } from '@/types/inventory';
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

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [viewDate, setViewDate] = useState(new Date());

  const { toast } = useToast();
  const navigate = useNavigate();

  const { user, loading: authLoading, isOwner, shop, shopMember, signOut } = useAuth();
  
  const { 
    products, sales, isLoading: inventoryLoading, 
    addProduct, updateProduct, deleteProduct, 
    recordSale, getLowStockProducts, getStats, searchProducts 
  } = useInventory();
  
  const { 
    customers, creditSales, addCustomer, 
    addCreditSale, recordPayment, getTotalOwed, getCustomerTotalOwed 
  } = useCredit();
  
  const { expenses, addExpense, deleteExpense, quickAddTOT, getTotalExpenses } = useExpenses();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [user, authLoading, navigate]);

  // --- Missing Functions Added Back ---
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
  // -----------------------------------

  if (authLoading || (inventoryLoading && !shopMember)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading Duka Manager...</p>
      </div>
    );
  }

  const isToday = isSameDay(viewDate, new Date());
  const dateLabel = isToday ? "Today's" : format(viewDate, "MMM do");
  const filteredSales = sales.filter(s => isSameDay(new Date(s.createdAt), viewDate));
  const selectedDateSales = filteredSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  const selectedDateProfit = filteredSales.reduce((sum, s) => sum + Number(s.profit || 0), 0);
  const totalExpenses = getTotalExpenses();
  const baseStats = getStats();
  
  const displayStats = {
    ...baseStats,
    todaySales: selectedDateSales,
    todayProfit: selectedDateProfit,
    netProfit: selectedDateProfit - totalExpenses,
    totalCreditOwed: getTotalOwed(),
    totalExpenses: totalExpenses
  };

  const lowStockProducts = getLowStockProducts();
  const totalOwedAmount = getTotalOwed();
  const pendingCreditsCount = creditSales.filter(cs => cs.status !== 'paid').length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-30">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 bg-primary rounded-xl text-primary-foreground">
            <Store className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold truncate">{shop?.name || 'Duka Manager'}</h1>
            <p className="text-xs text-muted-foreground font-semibold uppercase">{isOwner ? 'Owner' : 'Staff'}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Menu className="h-6 w-6" />
                {isOwner && pendingCreditsCount > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-destructive rounded-full border-2 border-card" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Business Menu</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isOwner && (
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
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {activeTab === 'dashboard' && isOwner && (
          <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(prev => subDays(prev, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" className="text-xs h-8 px-2" onClick={() => setViewDate(new Date())} disabled={isToday}>Today</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDate(prev => addDays(prev, 1))} disabled={isToday}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (isOwner ? <OwnerDashboard stats={displayStats} dateLabel={dateLabel} /> : <EmployeeDashboard stats={baseStats} todaySalesCount={filteredSales.length} />)}
        {activeTab === 'products' && <ProductList products={products} onSearch={searchProducts} onEdit={(p) => { setEditingProduct(p); setShowProductForm(true); }} onDelete={deleteProduct} onAdd={() => { setEditingProduct(null); setShowProductForm(true); }} onSell={setSellingProduct} isOwner={isOwner} />}
        {activeTab === 'expenses' && isOwner && <ExpenseManager expenses={expenses} onAddExpense={addExpense} onDeleteExpense={deleteExpense} onQuickAddTOT={quickAddTOT} monthlySales={selectedDateSales} />}
        {activeTab === 'alerts' && <LowStockAlerts products={lowStockProducts} onRestock={isOwner ? (p) => { setEditingProduct(p); setShowProductForm(true); } : undefined} />}
        {activeTab === 'credit' && isOwner && (
          <CreditManager
            customers={customers}
            creditSales={creditSales}
            totalOwed={totalOwedAmount}
            onAddCustomer={(name, phone) => addCustomer({ name, phone: phone || '', email: '' })}
            onRecordPayment={recordPayment}
            getCustomerTotalOwed={getCustomerTotalOwed}
          />
        )}
        {activeTab === 'reports' && isOwner && <SalesReports sales={sales} creditSales={creditSales} />}
        {activeTab === 'settings' && <SettingsPanel />}
        {activeTab === 'help' && <HelpPanel />}
        {activeTab === 'privacy' && <PrivacyPanel />}
        {activeTab === 'contact' && <ContactPanel />}
      </main>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} alertCount={lowStockProducts.length} isOwner={isOwner} />
      
      {showProductForm && isOwner && <ProductForm product={editingProduct} onSave={handleSaveProduct} onClose={() => { setShowProductForm(false); setEditingProduct(null); }} />}
      {sellingProduct && <SellDialog product={sellingProduct} customers={customers} onSell={handleSell} onClose={() => setSellingProduct(null)} isOwner={isOwner} />}
    </div>
  );
};

export default Index;