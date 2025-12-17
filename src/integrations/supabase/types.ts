export interface Product {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  lowStockThreshold: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
}

export interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  totalStockValue: number;
  todaySales: number;
  todayProfit: number;
}

export interface CreditSale {
  id: string;
  customerId: string;
  saleId: string;
  productName: string;
  quantity: number;
  amount: number;
  status: 'pending' | 'partially_paid' | 'paid';
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string;
}