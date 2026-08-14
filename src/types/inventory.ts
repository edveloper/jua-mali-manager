export interface Product {
  id: string;
  name: string;
  barcode?: string;
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
  createdAt: Date;
}

export interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  totalStockValue: number;
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
