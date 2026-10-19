/**
 * Demo Data - Synchronized sample data for products, customers, invoices, and debts
 * Flow POS Pro - Guest Demo Mode
 */

import { Product } from './products-store';
import { Customer } from './customers-store';
import { Invoice, InvoiceItem, InvoiceStatus } from './invoices-store';
import { Debt } from './debts-store';

export const DEMO_MODE_KEY = 'hyperpos_is_demo_mode';
export const DEMO_STARTED_AT_KEY = 'hyperpos_demo_started_at';
export const DEMO_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if the current user session is in Guest Demo Mode
 */
export const isGuestDemoMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DEMO_MODE_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * Get remaining time for the 24-hour guest demo session
 */
export const getDemoRemainingTime = (): { hours: number; minutes: number; totalMinutes: number; isExpired: boolean } => {
  if (typeof window === 'undefined') {
    return { hours: 24, minutes: 0, totalMinutes: 1440, isExpired: false };
  }
  try {
    let startedAt = Number(localStorage.getItem(DEMO_STARTED_AT_KEY));
    if (!startedAt || isNaN(startedAt)) {
      startedAt = Date.now();
      localStorage.setItem(DEMO_STARTED_AT_KEY, startedAt.toString());
    }
    const elapsed = Date.now() - startedAt;
    const remainingMs = DEMO_DURATION_MS - elapsed;
    if (remainingMs <= 0) {
      return { hours: 0, minutes: 0, totalMinutes: 0, isExpired: true };
    }
    const totalMinutes = Math.floor(remainingMs / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes, totalMinutes, isExpired: false };
  } catch {
    return { hours: 24, minutes: 0, totalMinutes: 1440, isExpired: false };
  }
};

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
    costPrice: 950,
    salePrice: 1100,
    quantity: 8,
    minStockLevel: 3,
    status: 'in_stock',
  },
  {
    id: 'prod_002',
    name: 'سامسونج جالكسي S24 ألترا',
    barcode: '6941634001002',
    category: 'هواتف ذكية',
    costPrice: 820,
    salePrice: 980,
    quantity: 12,
    minStockLevel: 3,
    status: 'in_stock',
  },
  {
    id: 'prod_003',
    name: 'سماعات AirPods Pro 2',
    barcode: '6941634001003',
    category: 'إكسسوارات',
    costPrice: 180,
    salePrice: 240,
    quantity: 25,
    minStockLevel: 5,
    status: 'in_stock',
  },
  {
    id: 'prod_004',
    name: 'شاحن سريع 65W',
    barcode: '6941634001004',
    category: 'إكسسوارات',
    costPrice: 15,
    salePrice: 30,
    quantity: 45,
    minStockLevel: 10,
    status: 'in_stock',
  },
  {
    id: 'prod_005',
    name: 'كفر حماية مغناطيسي',
    barcode: '6941634001005',
    category: 'إكسسوارات',
    costPrice: 5,
    salePrice: 15,
    quantity: 80,
    minStockLevel: 15,
    status: 'in_stock',
  },
  {
    id: 'prod_006',
    name: 'لاب توب MacBook Air M3',
    barcode: '6941634001006',
    category: 'أجهزة كمبيوتر',
    costPrice: 920,
    salePrice: 1150,
    quantity: 5,
    minStockLevel: 2,
    status: 'in_stock',
  },
  {
    id: 'prod_007',
    name: 'آيباد برو 12.9 إنش',
    barcode: '6941634001007',
    category: 'تابلت',
    costPrice: 750,
    salePrice: 920,
    quantity: 7,
    minStockLevel: 2,
    status: 'in_stock',
  },
  {
    id: 'prod_008',
    name: 'ساعة Apple Watch Ultra',
    barcode: '6941634001008',
    category: 'ساعات ذكية',
    costPrice: 620,
    salePrice: 780,
    quantity: 6,
    minStockLevel: 2,
    status: 'in_stock',
  },
  {
    id: 'prod_009',
    name: 'بنك طاقة أنكر 20000mAh',
    barcode: '6941634001009',
    category: 'إكسسوارات',
    costPrice: 28,
    salePrice: 48,
    quantity: 30,
    minStockLevel: 5,
    status: 'in_stock',
  },
  {
    id: 'prod_010',
    name: 'كابل شحن Type-C مضفر',
    barcode: '6941634001010',
    category: 'إكسسوارات',
    costPrice: 4,
    salePrice: 12,
    quantity: 100,
    minStockLevel: 20,
    status: 'in_stock',
  },
  {
    id: 'prod_011',
    name: 'سماعة رأس بلوتوث سوني',
    barcode: '6941634001011',
    category: 'إكسسوارات',
    costPrice: 140,
    salePrice: 195,
    quantity: 10,
    minStockLevel: 3,
    status: 'in_stock',
  },
  {
    id: 'prod_012',
    name: 'شاشة حماية زجاجية نانو',
    barcode: '6941634001012',
    category: 'إكسسوارات',
    costPrice: 2,
    salePrice: 8,
    quantity: 120,
    minStockLevel: 25,
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
    email: 'ahmed@example.com',
    address: 'الرياض، حي الملز',
    totalPurchases: 2080,
    totalDebt: 380,
    invoiceCount: 3,
    lastPurchase: new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(baseTime - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'cust_002',
    name: 'سارة عبدالله العمري',
    phone: '0559876543',
    email: 'sara@example.com',
    address: 'جدة، حي الروضة',
    totalPurchases: 1450,
    totalDebt: 0,
    invoiceCount: 2,
    lastPurchase: new Date(baseTime - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(baseTime - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(baseTime - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'cust_003',
    name: 'خالد سعود الدوسري',
    phone: '0541112233',
    email: 'khaled@example.com',
    address: 'الدمام، حي الشاطئ',
    totalPurchases: 1100,
    totalDebt: 1100,
    invoiceCount: 1,
    lastPurchase: new Date(baseTime - 10 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(baseTime - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(baseTime - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'cust_004',
    name: 'فاطمة حسن الزهراني',
    phone: '0567778899',
    email: 'fatima@example.com',
    address: 'مكة المكرمة، حي العزيزية',
    totalPurchases: 1190,
    totalDebt: 240,
    invoiceCount: 2,
    lastPurchase: new Date(baseTime - 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(baseTime - 25 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(baseTime - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'cust_005',
    name: 'عمر يوسف الشمري',
    phone: '0533445566',
    email: '',
    address: 'الخبر، حي العقربية',
    totalPurchases: 780,
    totalDebt: 0,
    invoiceCount: 1,
    lastPurchase: new Date(baseTime - 15 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(baseTime - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(baseTime - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ============================================
// INVOICES - Linked to products and customers
// ============================================

const daysAgo = (days: number) => {
  const date = new Date(baseTime - days * 24 * 60 * 60 * 1000);
  return date.toISOString();
};

const createItem = (id: string, name: string, price: number, quantity: number, costPrice?: number): InvoiceItem => ({
  id,
  name,
  price,
  quantity,
  total: price * quantity,
  costPrice: costPrice || Math.round(price * 0.8),
  profit: Math.round(price * quantity - (costPrice || Math.round(price * 0.8)) * quantity),
});

export const demoInvoices: Invoice[] = [
  // Invoice 1 - Ahmed bought iPhone (DEBT - partially paid)
  {
    id: 'INV-001',
    type: 'sale',
    customerName: 'أحمد محمد الكريم',
    customerPhone: '0501234567',
    items: [
      createItem('prod_001', 'آيفون 15 برو ماكس', 1100, 1, 950),
    ],
    subtotal: 1100,
    discount: 0,
    total: 1100,
    totalInCurrency: 1100,
    currency: 'USD',
    currencySymbol: '$',
    paymentType: 'debt',
    status: 'paid' as InvoiceStatus,
    debtPaid: 720,
    debtRemaining: 380,
    profit: 150,
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
      createItem('prod_003', 'سماعات AirPods Pro 2', 240, 1, 180),
      createItem('prod_004', 'شاحن سريع 65W', 30, 2, 15),
    ],
    subtotal: 300,
    discount: 10,
    total: 290,
    totalInCurrency: 290,
    currency: 'USD',
    currencySymbol: '$',
    paymentType: 'cash',
    status: 'paid' as InvoiceStatus,
    profit: 70,
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
      createItem('prod_001', 'آيفون 15 برو ماكس', 1100, 1, 950),
    ],
    subtotal: 1100,
    discount: 0,
    total: 1100,
    totalInCurrency: 1100,
    currency: 'USD',
    currencySymbol: '$',
    paymentType: 'debt',
    status: 'pending' as InvoiceStatus,
    debtPaid: 0,
    debtRemaining: 1100,
    profit: 150,
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
      createItem('prod_002', 'سامسونج جالكسي S24 ألترا', 980, 1, 820),
    ],
    subtotal: 980,
    discount: 0,
    total: 980,
    totalInCurrency: 980,
    currency: 'USD',
    currencySymbol: '$',
    paymentType: 'cash',
    status: 'paid' as InvoiceStatus,
    profit: 160,
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
      createItem('prod_003', 'سماعات AirPods Pro 2', 240, 1, 180),
    ],
    subtotal: 240,
    discount: 0,
    total: 240,
    totalInCurrency: 240,
    currency: 'USD',
    currencySymbol: '$',
    paymentType: 'debt',
    status: 'pending' as InvoiceStatus,
    debtPaid: 0,
    debtRemaining: 240,
    profit: 60,
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
      createItem('prod_006', 'لاب توب MacBook Air M3', 1150, 1, 920),
      createItem('prod_005', 'كفر حماية مغناطيسي', 15, 1, 5),
    ],
    subtotal: 1165,
    discount: 5,
    total: 1160,
    totalInCurrency: 1160,
    currency: 'USD',
    currencySymbol: '$',
    paymentType: 'cash',
    status: 'paid' as InvoiceStatus,
    profit: 235,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  // Invoice 7 - Omar bought Watch (CASH)
  {
    id: 'INV-007',
    type: 'sale',
    customerName: 'عمر يوسف الشمري',
    customerPhone: '0533445566',
    items: [
      createItem('prod_008', 'ساعة Apple Watch Ultra', 780, 1, 620),
    ],
    subtotal: 780,
    discount: 0,
    total: 780,
    totalInCurrency: 780,
    currency: 'USD',
    currencySymbol: '$',
    paymentType: 'cash',
    status: 'paid' as InvoiceStatus,
    profit: 160,
    createdAt: daysAgo(15),
    updatedAt: daysAgo(15),
  },
  // Invoice 8 - Fatima bought iPad (CASH)
  {
    id: 'INV-008',
    type: 'sale',
    customerName: 'فاطمة حسن الزهراني',
    customerPhone: '0567778899',
    items: [
      createItem('prod_007', 'آيباد برو 12.9 إنش', 920, 1, 750),
      createItem('prod_004', 'شاحن سريع 65W', 30, 1, 15),
    ],
    subtotal: 950,
    discount: 0,
    total: 950,
    totalInCurrency: 950,
    currency: 'USD',
    currencySymbol: '$',
    paymentType: 'cash',
    status: 'paid' as InvoiceStatus,
    profit: 185,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
];

// ============================================
// DEBTS - Linked to invoices and customers
// ============================================

export const demoDebts: Debt[] = [
  // Ahmed's remaining debt from INV-001
  {
    id: 'debt_001',
    invoiceId: 'INV-001',
    customerName: 'أحمد محمد الكريم',
    customerPhone: '0501234567',
    totalDebt: 1100,
    totalPaid: 720,
    remainingDebt: 380,
    dueDate: new Date(baseTime + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'partially_paid',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(5),
    notes: 'تم سداد دفعة أولى 720$، المتبقي 380$',
    isCashDebt: false,
  },
  // Khaled's debt (iPhone) - unpaid & overdue
  {
    id: 'debt_002',
    invoiceId: 'INV-003',
    customerName: 'خالد سعود الدوسري',
    customerPhone: '0541112233',
    totalDebt: 1100,
    totalPaid: 0,
    remainingDebt: 1100,
    dueDate: new Date(baseTime - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'overdue',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10),
    notes: 'مستحق منذ 3 أيام',
    isCashDebt: false,
  },
  // Fatima's debt (AirPods) - unpaid
  {
    id: 'debt_003',
    invoiceId: 'INV-005',
    customerName: 'فاطمة حسن الزهراني',
    customerPhone: '0567778899',
    totalDebt: 240,
    totalPaid: 0,
    remainingDebt: 240,
    dueDate: new Date(baseTime + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'due',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
    isCashDebt: false,
  },
];

// ============================================
// GUEST DEMO MODE - INJECT & CLEAR HELPERS
// ============================================

/**
 * Injects pre-populated demo data, creates a local admin session,
 * and enters isolated Guest Demo Mode for 24 hours.
 */
export const injectGuestDemoData = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  // 1. Mark demo mode active
  localStorage.setItem(DEMO_MODE_KEY, 'true');
  localStorage.setItem(DEMO_STARTED_AT_KEY, Date.now().toString());
  localStorage.setItem('hyperpos_setup_complete', 'true');

  // 2. Mock demo user session & profile
  const demoUser = {
    id: 'guest-demo-user',
    email: 'guest@flowpos.demo',
    role: 'authenticated',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: { full_name: 'مستخدم تجريبي (Demo)' },
    created_at: new Date().toISOString(),
  };

  const demoSession = {
    access_token: 'demo-token',
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    refresh_token: 'demo-refresh',
    user: demoUser,
  };

  localStorage.setItem('hyperpos_session_cache', JSON.stringify({
    user: demoUser,
    session: demoSession,
    expires_at: demoSession.expires_at,
    cached_at: Date.now(),
  }));

  localStorage.setItem('hyperpos_cached_profile', JSON.stringify({
    id: 'demo-profile',
    user_id: 'guest-demo-user',
    full_name: 'مستخدم تجريبي (Demo)',
    avatar_url: null,
    preferred_language: 'ar',
    user_type: 'pos',
    allowed_pages: null,
  }));

  // 3. Store settings
  const demoSettings = {
    storeSettings: {
      name: 'متجر فلو التجريبي',
      type: 'general',
      phone: '0999000111',
      email: 'demo@flowpos.app',
      address: 'المعرض الرئيسي',
      logo: '',
    },
    primaryCurrency: 'USD',
    enabledCurrencies: { USD: true, TRY: true, SYP: true },
    exchangeRates: { TRY: 34, SYP: 14500 },
    language: 'ar',
    theme: 'dark',
    taxEnabled: false,
    taxRate: 0,
    printSettings: {
      autoPrint: true,
      showStoreName: true,
      showLogo: false,
      showAddress: true,
      showPhone: true,
      showEmail: false,
      showInvoiceNumber: true,
      showDateTime: true,
      showCashierName: true,
      welcomeMessage: 'أهلاً بكم في متجر فلو التجريبي',
      footer: 'شكراً لزيارتكم! (نسخة تجريبية)',
      showAlternativeCurrencies: true,
      paperSize: '80mm',
      copies: '1',
    },
    discountPercentEnabled: true,
    discountFixedEnabled: true,
    barcodeScanMode: 'search',
    trackCapital: true,
    initialCapital: 10000,
  };
  localStorage.setItem('hyperpos_settings_v1', JSON.stringify(demoSettings));

  // 4. Products in localStorage and IndexedDB
  localStorage.setItem('hyperpos_products_v1', JSON.stringify(demoProducts));
  localStorage.setItem('hyperpos_products_cache', JSON.stringify({
    products: demoProducts,
    timestamp: Date.now(),
  }));
  try {
    const { saveProductsToIDB } = await import('./indexeddb-cache');
    await saveProductsToIDB(demoProducts);
  } catch (e) {
    console.warn('[DemoData] Failed to save demo products to IDB:', e);
  }

  // 5. Customers in localStorage & cache
  localStorage.setItem('hyperpos_customers_v1', JSON.stringify(demoCustomers));
  localStorage.setItem('hyperpos_customers_cache', JSON.stringify(demoCustomers));

  // 6. Invoices in localStorage & cache
  localStorage.setItem('hyperpos_invoices_v1', JSON.stringify(demoInvoices));
  localStorage.setItem('hyperpos_invoices_cache', JSON.stringify({
    invoices: demoInvoices,
    timestamp: Date.now(),
  }));

  // 7. Debts in localStorage & cache
  localStorage.setItem('hyperpos_debts_v1', JSON.stringify(demoDebts));
  localStorage.setItem('hyperpos_debts_cache', JSON.stringify(demoDebts));

  // 8. Categories
  const demoCategories = [
    { id: 'cat_01', name: 'هواتف ذكية', createdAt: new Date().toISOString() },
    { id: 'cat_02', name: 'إكسسوارات', createdAt: new Date().toISOString() },
    { id: 'cat_03', name: 'أجهزة كمبيوتر', createdAt: new Date().toISOString() },
    { id: 'cat_04', name: 'تابلت', createdAt: new Date().toISOString() },
    { id: 'cat_05', name: 'ساعات ذكية', createdAt: new Date().toISOString() },
  ];
  localStorage.setItem('hyperpos_categories_cache', JSON.stringify(demoCategories));

  // 9. Cashbox & Capital
  localStorage.setItem('hyperpos_cashbox_v1', JSON.stringify({
    currentBalance: 500,
    lastUpdated: new Date().toISOString(),
  }));

  localStorage.setItem('hyperpos_capital_v1', JSON.stringify({
    initialCapital: 10000,
    currentCapital: 10000,
    totalInvestments: 10000,
    totalWithdrawals: 0,
    transactions: [],
    lastUpdated: new Date().toISOString(),
  }));

  // 10. Emit events so all active components reload state immediately
  try {
    const { emitEvent, EVENTS } = await import('./events');
    emitEvent(EVENTS.PRODUCTS_UPDATED, demoProducts);
    emitEvent(EVENTS.CUSTOMERS_UPDATED, demoCustomers);
    emitEvent(EVENTS.INVOICES_UPDATED, demoInvoices);
    emitEvent(EVENTS.DEBTS_UPDATED, demoDebts);
    emitEvent(EVENTS.SETTINGS_UPDATED);
    emitEvent(EVENTS.STORE_TYPE_CHANGED);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('guest-demo-started'));
    }
  } catch {}
};

/**
 * Safely clears Guest Demo Mode data while strictly protecting real user data.
 * If an active real user session exists, it immediately aborts.
 */
export const clearGuestDemoData = async (force: boolean = false): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const isDemo = isGuestDemoMode();
  if (!isDemo && !force) {
    console.warn('[DemoMode] Aborting wipe: Current mode is NOT demo mode!');
    return false;
  }

  // Absolute safety net: never clear if a real authenticated user is signed in!
  try {
    const cached = localStorage.getItem('hyperpos_session_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.user?.id && parsed.user.id !== 'guest-demo-user' && !force) {
        console.warn('[DemoMode] Real authenticated user detected, aborting wipe to protect real data!');
        return false;
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.user?.id && parsed.user.id !== 'guest-demo-user' && !force) {
            console.warn('[DemoMode] Real Supabase user session detected, aborting wipe to protect real data!');
            return false;
          }
        }
      }
    }
  } catch {}

  // Remove demo markers
  localStorage.removeItem(DEMO_MODE_KEY);
  localStorage.removeItem(DEMO_STARTED_AT_KEY);
  localStorage.removeItem('hyperpos_session_cache');
  localStorage.removeItem('hyperpos_cached_profile');

  // Clear demo data keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('hyperpos_') &&
        key !== 'hyperpos_language' &&
        key !== 'hyperpos_theme' &&
        key !== 'hyperpos_stay_logged_in') {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // Clear IndexedDB products cache
  try {
    const { clearProductsIDB } = await import('./indexeddb-cache');
    await clearProductsIDB();
  } catch {}

  // Invalidate memory caches
  try {
    const { invalidateAllCaches } = await import('./cloud');
    await invalidateAllCaches();
  } catch {}

  // Emit events
  try {
    const { emitEvent, EVENTS } = await import('./events');
    emitEvent(EVENTS.PRODUCTS_UPDATED, []);
    emitEvent(EVENTS.CUSTOMERS_UPDATED, []);
    emitEvent(EVENTS.INVOICES_UPDATED, []);
    emitEvent(EVENTS.DEBTS_UPDATED, []);
    emitEvent(EVENTS.SETTINGS_UPDATED);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('guest-demo-ended'));
    }
  } catch {}

  return true;
};

// ============================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================

export const loadDemoData = (): void => {
  injectGuestDemoData().catch(console.error);
};

export const resetDemoData = (): void => {
  clearGuestDemoData(true).then(() => injectGuestDemoData()).catch(console.error);
};
