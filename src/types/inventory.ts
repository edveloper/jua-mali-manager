export interface Product {
  id: string;
  name: string;
  durationMinutes?: number;
  costPrice: number;
  sellingPrice: number;
  /** Owner-set floor for negotiated prices. null = unbounded. */
  minPrice?: number | null;
  /** Owner-set ceiling for negotiated prices. null = unbounded. */
  maxPrice?: number | null;
  quantity: number;
  lowStockThreshold: number;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  name: string;
  category?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  lowStockThreshold: number;
  durationMinutes?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ServiceSale {
  id: string;
  serviceId: string;
  serviceName: string;
  quantity: number;
  totalAmount: number;
  profit: number;
  staffName?: string;
  sessionTime?: string;
  notes?: string;
  status?: 'completed' | 'scheduled' | 'cancelled';
  createdAt: Date | string;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  /** What the catalog price was at the time, so premium/discount is reportable. */
  listPriceAtSale?: number;
  priceSource?: 'list' | 'override';
  soldBy?: string | null;
  /** null means the sale predates payment-method tracking, not that it was cash. */
  paymentMethod?: string | null;
  /** Set when the sale was cancelled. Voided sales are excluded from all totals. */
  voidedAt?: string | null;
  totalAmount: number;
  profit: number;
  isCredit?: boolean;
  customerId?: string;
  createdAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string;
}

export interface CreditSale {
  id: string;
  customerId: string;
  saleId: string;
  productName: string;
  quantity: number;
  amount: number;
  balance: number; 
  status: 'pending' | 'partially_paid' | 'paid';
  createdAt: string;
}

export interface CreditPayment {
  id: string;
  creditSaleId: string;
  customerId: string;
  amount: number;
  /** When the money actually came in. This is the date reports use. */
  paidAt: string;
  paymentMethod?: string | null;
  notes?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  /** Inventory on hand valued at what it cost you. This is the asset figure. */
  totalStockValue: number;
  /** What that same stock would bring in if it all sold at list price. */
  totalStockRetailValue?: number;
  /** Services only: remaining capacity valued at service price. Not an asset. */
  totalCapacityValue?: number;
  todaySales: number;
  todayProfit: number;
  totalCreditOwed?: number;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  expenseType: 'one_off' | 'variable' | 'recurring';
  recurrenceUnit: 'none' | 'daily' | 'weekly' | 'monthly' | 'annual';
  allocationMode: 'cash' | 'accrual';
  /**
   * 'restock' means the Restock flow created it, so its cost is already carried
   * as COGS and it must not be counted again as an operating expense.
   */
  source: 'manual' | 'restock';
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt: string;
}

export interface ExpenseDraft {
  category: string;
  description: string;
  amount: number;
  date: string;
  expenseType: 'one_off' | 'variable' | 'recurring';
  recurrenceUnit: 'none' | 'daily' | 'weekly' | 'monthly' | 'annual';
  allocationMode: 'cash' | 'accrual';
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  movementType: 'in' | 'out' | 'adjustment';
  reason: 'restock' | 'sale' | 'damage' | 'return' | 'manual_adjustment';
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
  happenedAt: string;
  expenseId?: string | null;
}
