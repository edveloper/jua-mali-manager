export interface Product {
  id: string;
  name: string;
  barcode?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  lowStockThreshold: number;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
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
  category: 'Tax' | 'Rent' | 'Salary' | 'Utilities' | 'Transport' | 'Licenses' | 'Other';
  description: string;
  amount: number;
  date: string;
  createdAt: string;
}
