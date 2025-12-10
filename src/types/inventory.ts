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
  phone?: string;
  createdAt: Date;
}

export interface CreditSale {
  id: string;
  customerId: string;
  customerName: string;
  saleId: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: 'pending' | 'partial' | 'paid';
  createdAt: Date;
  dueDate?: Date;
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
