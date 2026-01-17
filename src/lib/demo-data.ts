/**
 * Demo Data - Synchronized sample data for products, customers, invoices, and debts
 * All data is interconnected and consistent
 */

import { Product } from './products-store';
import { Customer } from './customers-store';
import { Invoice, InvoiceItem, InvoiceStatus } from './invoices-store';
import { Debt } from './debts-store';

// ============================================
// PRODUCTS - Electronics & Accessories Store
// ============================================

const baseTime = Date.now();

export const demoProducts: Product[] = [
  {
    id: 'prod_001',
    name: 'آيفون 15 برو ماكس',
    barcode: '6941634001001',
    category: 'هواتف ذكية',
    costPrice: 4500,
    salePrice: 5200,
    quantity: 8,
    minStockLevel: 3,
    status: 'in_stock',
  },
  {
    id: 'prod_002',
    name: 'سامسونج جالكسي S24 ألترا',
    barcode: '6941634001002',
    category: 'هواتف ذكية',
    costPrice: 4000,
    salePrice: 4600,
    quantity: 12,
    minStockLevel: 3,
    status: 'in_stock',
  },
  {
    id: 'prod_003',
    name: 'سماعات AirPods Pro 2',
    barcode: '6941634001003',
    category: 'إكسسوارات',
    costPrice: 800,
    salePrice: 1050,
    quantity: 25,
    minStockLevel: 5,
    status: 'in_stock',
  },
  {
    id: 'prod_004',
    name: 'شاحن سريع 65W',
    barcode: '6941634001004',
    category: 'إكسسوارات',
    costPrice: 80,
    salePrice: 150,
    quantity: 45,
    minStockLevel: 10,
    status: 'in_stock',
  },
  {
    id: 'prod_005',
    name: 'كفر حماية آيفون',
    barcode: '6941634001005',
    category: 'إكسسوارات',
    costPrice: 25,
    salePrice: 60,
    quantity: 80,
    minStockLevel: 15,
    status: 'in_stock',
  },
  {
    id: 'prod_006',
    name: 'لاب توب MacBook Air M3',
    barcode: '6941634001006',
    category: 'أجهزة كمبيوتر',
    costPrice: 4200,
    salePrice: 4800,
    quantity: 5,
    minStockLevel: 2,
    status: 'in_stock',
  },
  {
    id: 'prod_007',
    name: 'آيباد برو 12.9',
    barcode: '6941634001007',
    category: 'تابلت',
    costPrice: 3500,
    salePrice: 4100,
    quantity: 7,
    minStockLevel: 2,
    status: 'in_stock',
  },
  {
    id: 'prod_008',
    name: 'ساعة Apple Watch Ultra',
    barcode: '6941634001008',
    category: 'ساعات ذكية',
    costPrice: 2800,
    salePrice: 3400,
    quantity: 10,
    minStockLevel: 3,
    status: 'in_stock',
  },
  {
    id: 'prod_009',
    name: 'باور بانك 20000mAh',
    barcode: '6941634001009',
    category: 'إكسسوارات',
    costPrice: 120,
    salePrice: 220,
    quantity: 2,
    minStockLevel: 8,
    status: 'low_stock',
  },
  {
    id: 'prod_010',
    name: 'كيبل USB-C 2m',
    barcode: '6941634001010',
    category: 'إكسسوارات',
    costPrice: 15,
    salePrice: 40,
    quantity: 0,
    minStockLevel: 20,
    status: 'out_of_stock',
  },
  {
    id: 'prod_011',
    name: 'سماعة بلوتوث JBL',
    barcode: '6941634001011',
    category: 'إكسسوارات',
    costPrice: 350,
    salePrice: 480,
    quantity: 15,
    minStockLevel: 5,
    status: 'in_stock',
  },
  {
    id: 'prod_012',
    name: 'شاشة حماية زجاجية',
    barcode: '6941634001012',
    category: 'إكسسوارات',
    costPrice: 10,
    salePrice: 35,
    quantity: 100,
    minStockLevel: 20,
    status: 'in_stock',
  },
];

// ============================================
// CUSTOMERS
// ============================================

export const demoCustomers: Customer[] = [
  {
    id: 'cust_001',
    name: 'أحمد محمد الكريم',
    phone: '0501234567',
    email: 'ahmed@email.com',
    address: 'الرياض، حي النخيل',
    totalPurchases: 15400,
    totalDebt: 4100,
    invoiceCount: 4,
    lastPurchase: new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(baseTime - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'cust_002',
    name: 'سارة عبدالله العمري',
    phone: '0559876543',
    email: 'sara.omari@email.com',
    address: 'جدة، حي الروضة',
    totalPurchases: 8700,
    totalDebt: 0,
    invoiceCount: 3,
    lastPurchase: new Date(baseTime - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(baseTime - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(baseTime - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'cust_003',
    name: 'خالد سعود الدوسري',
    phone: '0541112233',
    email: '',
    address: 'الدمام، حي الفيصلية',
    totalPurchases: 5200,
    totalDebt: 5200,
    invoiceCount: 1,
    lastPurchase: new Date(baseTime - 10 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(baseTime - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(baseTime - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'cust_004',
    name: 'فاطمة حسن الزهراني',
    phone: '0567778899',
    email: 'fatima.z@email.com',
    address: 'الرياض، حي العليا',
    totalPurchases: 12300,
    totalDebt: 1050,
    invoiceCount: 5,
    lastPurchase: new Date(baseTime - 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(baseTime - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(baseTime - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'cust_005',
    name: 'عمر يوسف الشمري',
    phone: '0533445566',
    email: '',
    address: 'بريدة، حي السلام',
    totalPurchases: 3400,
    totalDebt: 0,
    invoiceCount: 2,
    lastPurchase: new Date(baseTime - 15 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(baseTime - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(baseTime - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ============================================
// INVOICES - Linked to products and customers
// ============================================

// Helper to calculate dates
const daysAgo = (days: number) => {
  const date = new Date(baseTime - days * 24 * 60 * 60 * 1000);
  return date.toISOString();
};

// Create invoice items with correct structure
const createItem = (id: string, name: string, price: number, quantity: number): InvoiceItem => ({
  id,
  name,
  price,
  quantity,
  total: price * quantity,
});

export const demoInvoices: Invoice[] = [
  // Invoice 1 - Ahmed bought iPhone (DEBT - partial)
  {
    id: 'INV-001',
    type: 'sale',
    customerName: 'أحمد محمد الكريم',
    customerPhone: '0501234567',
    items: [
      createItem('prod_001', 'آيفون 15 برو ماكس', 5200, 1),
    ],
    subtotal: 5200,
    discount: 0,
    total: 5200,
    totalInCurrency: 5200,
    currency: 'SAR',
    currencySymbol: 'ر.س',
    paymentType: 'debt',
    status: 'paid' as InvoiceStatus,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(20),
  },
  // Invoice 2 - Sara bought accessories (CASH)
  {
    id: 'INV-002',
    type: 'sale',
    customerName: 'سارة عبدالله العمري',
    customerPhone: '0559876543',
    items: [
      createItem('prod_003', 'سماعات AirPods Pro 2', 1050, 2),
      createItem('prod_004', 'شاحن سريع 65W', 150, 3),
    ],
    subtotal: 2550,
    discount: 50,
    total: 2500,
    totalInCurrency: 2500,
    currency: 'SAR',
    currencySymbol: 'ر.س',
    paymentType: 'cash',
    status: 'paid' as InvoiceStatus,
    createdAt: daysAgo(18),
    updatedAt: daysAgo(18),
  },
  // Invoice 3 - Khaled bought iPhone (DEBT - full)
  {
    id: 'INV-003',
    type: 'sale',
    customerName: 'خالد سعود الدوسري',
    customerPhone: '0541112233',
    items: [
      createItem('prod_001', 'آيفون 15 برو ماكس', 5200, 1),
    ],
    subtotal: 5200,
    discount: 0,
    total: 5200,
    totalInCurrency: 5200,
    currency: 'SAR',
    currencySymbol: 'ر.س',
    paymentType: 'debt',
    status: 'pending' as InvoiceStatus,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10),
  },
  // Invoice 4 - Ahmed bought Samsung (CASH)
  {
    id: 'INV-004',
    type: 'sale',
    customerName: 'أحمد محمد الكريم',
    customerPhone: '0501234567',
    items: [
      createItem('prod_002', 'سامسونج جالكسي S24 ألترا', 4600, 1),
    ],
    subtotal: 4600,
    discount: 0,
    total: 4600,
    totalInCurrency: 4600,
    currency: 'SAR',
    currencySymbol: 'ر.س',
    paymentType: 'cash',
    status: 'paid' as InvoiceStatus,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(8),
  },
  // Invoice 5 - Fatima bought AirPods (DEBT)
  {
    id: 'INV-005',
    type: 'sale',
    customerName: 'فاطمة حسن الزهراني',
    customerPhone: '0567778899',
    items: [
      createItem('prod_003', 'سماعات AirPods Pro 2', 1050, 1),
    ],
    subtotal: 1050,
    discount: 0,
    total: 1050,
    totalInCurrency: 1050,
    currency: 'SAR',
    currencySymbol: 'ر.س',
    paymentType: 'debt',
    status: 'pending' as InvoiceStatus,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  // Invoice 6 - Sara bought MacBook (CASH)
  {
    id: 'INV-006',
    type: 'sale',
    customerName: 'سارة عبدالله العمري',
    customerPhone: '0559876543',
    items: [
      createItem('prod_006', 'لاب توب MacBook Air M3', 4800, 1),
      createItem('prod_005', 'كفر حماية آيفون', 60, 2),
    ],
    subtotal: 4920,
    discount: 0,
    total: 4920,
    totalInCurrency: 4920,
    currency: 'SAR',
    currencySymbol: 'ر.س',
    paymentType: 'cash',
    status: 'paid' as InvoiceStatus,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  // Invoice 7 - Omar bought accessories (CASH)
  {
    id: 'INV-007',
    type: 'sale',
    customerName: 'عمر يوسف الشمري',
    customerPhone: '0533445566',
    items: [
      createItem('prod_011', 'سماعة بلوتوث JBL', 480, 1),
      createItem('prod_004', 'شاحن سريع 65W', 150, 2),
      createItem('prod_012', 'شاشة حماية زجاجية', 35, 5),
    ],
    subtotal: 955,
    discount: 0,
    total: 955,
    totalInCurrency: 955,
    currency: 'SAR',
    currencySymbol: 'ر.س',
    paymentType: 'cash',
    status: 'paid' as InvoiceStatus,
    createdAt: daysAgo(15),
    updatedAt: daysAgo(15),
  },
  // Invoice 8 - Ahmed bought Apple Watch (DEBT - remaining)
  {
    id: 'INV-008',
    type: 'sale',
    customerName: 'أحمد محمد الكريم',
    customerPhone: '0501234567',
    items: [
      createItem('prod_008', 'ساعة Apple Watch Ultra', 3400, 1),
    ],
    subtotal: 3400,
    discount: 0,
    total: 3400,
    totalInCurrency: 3400,
    currency: 'SAR',
    currencySymbol: 'ر.س',
    paymentType: 'debt',
    status: 'pending' as InvoiceStatus,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  // Invoice 9 - Maintenance invoice
  {
    id: 'INV-009',
    type: 'maintenance',
    customerName: 'عبدالرحمن السالم',
    customerPhone: '0544556677',
    items: [],
    subtotal: 350,
    discount: 0,
    total: 350,
    totalInCurrency: 350,
    currency: 'SAR',
    currencySymbol: 'ر.س',
    paymentType: 'cash',
    status: 'paid' as InvoiceStatus,
    serviceDescription: 'تغيير شاشة آيفون 13',
    serviceType: 'صيانة هواتف',
    productType: 'آيفون 13',
    partsCost: 200,
    profit: 150,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  // Invoice 10 - Fatima bought multiple items (CASH)
  {
    id: 'INV-010',
    type: 'sale',
    customerName: 'فاطمة حسن الزهراني',
    customerPhone: '0567778899',
    items: [
      createItem('prod_007', 'آيباد برو 12.9', 4100, 1),
      createItem('prod_004', 'شاحن سريع 65W', 150, 1),
    ],
    subtotal: 4250,
    discount: 0,
    total: 4250,
    totalInCurrency: 4250,
    currency: 'SAR',
    currencySymbol: 'ر.س',
    paymentType: 'cash',
    status: 'paid' as InvoiceStatus,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
];

// ============================================
// DEBTS - Linked to invoices and customers
// ============================================

export const demoDebts: Debt[] = [
  // Ahmed's first debt (iPhone) - partially paid
  {
    id: 'debt_001',
    invoiceId: 'INV-001',
    customerName: 'أحمد محمد الكريم',
    customerPhone: '0501234567',
    totalDebt: 5200,
    totalPaid: 4500, // Paid 4500 of 5200
    remainingDebt: 700,
    dueDate: new Date(baseTime + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Due in 10 days
    status: 'partially_paid',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(5),
    notes: 'دفع معظم المبلغ، المتبقي 700 ريال',
    isCashDebt: false,
  },
  // Khaled's debt (iPhone) - unpaid & overdue
  {
    id: 'debt_002',
    invoiceId: 'INV-003',
    customerName: 'خالد سعود الدوسري',
    customerPhone: '0541112233',
    totalDebt: 5200,
    totalPaid: 0,
    remainingDebt: 5200,
    dueDate: new Date(baseTime - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Overdue 5 days ago
    status: 'overdue',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10),
    notes: 'لم يسدد أي مبلغ حتى الآن',
    isCashDebt: false,
  },
  // Fatima's debt (AirPods) - unpaid
  {
    id: 'debt_003',
    invoiceId: 'INV-005',
    customerName: 'فاطمة حسن الزهراني',
    customerPhone: '0567778899',
    totalDebt: 1050,
    totalPaid: 0,
    remainingDebt: 1050,
    dueDate: new Date(baseTime + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Due in 25 days
    status: 'due',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
    isCashDebt: false,
  },
  // Ahmed's second debt (Apple Watch) - unpaid
  {
    id: 'debt_004',
    invoiceId: 'INV-008',
    customerName: 'أحمد محمد الكريم',
    customerPhone: '0501234567',
    totalDebt: 3400,
    totalPaid: 0,
    remainingDebt: 3400,
    dueDate: new Date(baseTime + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Due in 28 days
    status: 'due',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    isCashDebt: false,
  },
];

// ============================================
// LOAD DEMO DATA FUNCTION
// ============================================

const PRODUCTS_KEY = 'hyperpos_products_v1';
const CUSTOMERS_KEY = 'hyperpos_customers_v1';
const INVOICES_KEY = 'hyperpos_invoices_v1';
const DEBTS_KEY = 'hyperpos_debts_v1';
const DEMO_LOADED_KEY = 'hyperpos_demo_loaded_v2';

export const loadDemoData = (): void => {
  // Check if demo data was already loaded
  if (localStorage.getItem(DEMO_LOADED_KEY)) {
    console.log('[DemoData] Demo data already loaded, skipping...');
    return;
  }

  try {
    // Only load if data is empty
    const existingProducts = localStorage.getItem(PRODUCTS_KEY);
    const existingCustomers = localStorage.getItem(CUSTOMERS_KEY);
    const existingInvoices = localStorage.getItem(INVOICES_KEY);
    const existingDebts = localStorage.getItem(DEBTS_KEY);

    const hasProducts = existingProducts && JSON.parse(existingProducts).length > 0;
    const hasCustomers = existingCustomers && JSON.parse(existingCustomers).length > 0;
    const hasInvoices = existingInvoices && JSON.parse(existingInvoices).length > 0;
    const hasDebts = existingDebts && JSON.parse(existingDebts).length > 0;

    // If any data exists, don't overwrite
    if (hasProducts || hasCustomers || hasInvoices || hasDebts) {
      console.log('[DemoData] Existing data found, skipping demo data...');
      localStorage.setItem(DEMO_LOADED_KEY, 'true');
      return;
    }

    // Load demo data
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(demoProducts));
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(demoCustomers));
    localStorage.setItem(INVOICES_KEY, JSON.stringify(demoInvoices));
    localStorage.setItem(DEBTS_KEY, JSON.stringify(demoDebts));
    localStorage.setItem(DEMO_LOADED_KEY, 'true');

    console.log('[DemoData] Demo data loaded successfully!');
    console.log(`  - ${demoProducts.length} products`);
    console.log(`  - ${demoCustomers.length} customers`);
    console.log(`  - ${demoInvoices.length} invoices`);
    console.log(`  - ${demoDebts.length} debts`);
  } catch (error) {
    console.error('[DemoData] Failed to load demo data:', error);
  }
};

// ============================================
// RESET DEMO DATA FUNCTION (for testing)
// ============================================

export const resetDemoData = (): void => {
  localStorage.removeItem(DEMO_LOADED_KEY);
  localStorage.removeItem(PRODUCTS_KEY);
  localStorage.removeItem(CUSTOMERS_KEY);
  localStorage.removeItem(INVOICES_KEY);
  localStorage.removeItem(DEBTS_KEY);
  loadDemoData();
  console.log('[DemoData] Demo data reset and reloaded!');
};
