// Currency types
export type CurrencyCode = 'USD' | 'TRY' | 'SYP';

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  name: string;
  nameAr: string;
}

export interface ExchangeRate {
  date: string;
  rates: Record<CurrencyCode, number>;
  timestamp: string;
}

// Product types
export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sku: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  description?: string;
  imageUrl?: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  variants?: ProductVariant[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

// Customer types
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  totalDebt: number;
  createdAt: string;
  updatedAt: string;
}

// Invoice types
export interface InvoiceItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  currency: CurrencyCode;
  exchangeRate: number;
  amountOriginal: number;
  amountUsd: number;
  costPrice: number;
  profit: number;
}

export type PaymentType = 'cash' | 'debt';
export type InvoiceStatus = 'completed' | 'pending' | 'cancelled';

export interface Invoice {
  id: string;
  date: string;
  time: string;
  cashierId: string;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountPercentage: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: CurrencyCode;
  exchangeRate: number;
  paymentType: PaymentType;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Debt types
export interface DebtPayment {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

export type DebtStatus = 'due' | 'partially_paid' | 'fully_paid' | 'overdue';

export interface Debt {
  id: string;
  invoiceId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  totalDebt: number;
  totalPaid: number;
  remainingDebt: number;
  dueDate?: string;
  status: DebtStatus;
  payments: DebtPayment[];
  createdAt: string;
  updatedAt: string;
}

// Service/Repair types
export type ServiceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Service {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  deviceType: string;
  problemDescription: string;
  internalCost: number;
  customerCharge: number;
  profit: number;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
  status: ServiceStatus;
  notes?: string;
  createdAt: string;
  completedAt?: string;
  createdBy: string;
}

// Partner types
export interface ProfitRecord {
  month: string;
  totalProfit: number;
  partnerShare: number;
  date: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface Partner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  sharePercentage: number;
  joinedDate: string;
  totalProfitEarned: number;
  totalWithdrawn: number;
  currentBalance: number;
  profitHistory: ProfitRecord[];
  withdrawalHistory: Withdrawal[];
  createdAt: string;
  updatedAt: string;
}

// User types
export type UserRole = 'admin' | 'cashier';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

// Store settings
export type StoreType = 'phones' | 'grocery' | 'pharmacy' | 'clothing' | 'restaurant' | 'repair' | 'bookstore' | 'custom';

export interface StoreSettings {
  name: string;
  type: StoreType;
  phone: string;
  address: string;
  email?: string;
  currencies: CurrencyCode[];
  taxEnabled: boolean;
  taxRate: number;
  syncInterval: number;
  createdAt: string;
  updatedAt: string;
}

// Cart types for POS
export interface CartItem {
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Dashboard stats
export interface DailyStats {
  date: string;
  totalSales: number;
  totalProfit: number;
  totalExpenses: number;
  netProfit: number;
  invoiceCount: number;
  debtCount: number;
  salesByCurrency: Record<CurrencyCode, number>;
}
