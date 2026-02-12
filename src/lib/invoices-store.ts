import { emitEvent, EVENTS } from './events';
import { deleteDebtByInvoiceId, loadDebts, recordPayment } from './debts-store';
import { revertProfitDistribution } from './partners-store';
import { safeSave, safeLoad } from './safe-storage';
import { toast } from 'sonner';

// Invoices store for managing all sales and maintenance invoices

const INVOICES_STORAGE_KEY = 'hyperpos_invoices_v1';

export type InvoiceType = 'sale' | 'maintenance';
export type PaymentType = 'cash' | 'debt';
export type InvoiceStatus = 'paid' | 'pending' | 'cancelled';

export interface InvoiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface Invoice {
  id: string;
  type: InvoiceType;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  totalInCurrency: number;
  currency: string;
  currencySymbol: string;
  paymentType: PaymentType;
  status: InvoiceStatus;
  // For maintenance invoices
  serviceDescription?: string;
  serviceType?: string;
  productType?: string;
  partsCost?: number;
  profit?: number;
  // Debt tracking fields for partial payments sync
  debtPaid?: number;
  debtRemaining?: number;
  createdAt: string;
  updatedAt: string;
}

export const loadInvoices = (): Invoice[] => {
  try {
    const stored = localStorage.getItem(INVOICES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load invoices:', error);
  }
  return [];
};

export const saveInvoices = (invoices: Invoice[]): boolean => {
  // Validate data before saving
  if (!Array.isArray(invoices)) {
    console.error('saveInvoices: Invalid data - expected array');
    toast.error('خطأ في حفظ الفواتير', {
      description: 'البيانات غير صالحة'
    });
    return false;
  }
  
  const result = safeSave(INVOICES_STORAGE_KEY, invoices);
  
  if (!result.success) {
    console.error('Failed to save invoices:', result.error);
    toast.error('فشل في حفظ الفواتير', {
      description: result.error === 'Storage quota exceeded - try clearing old data' 
        ? 'مساحة التخزين ممتلئة - حاول حذف بعض البيانات القديمة'
        : 'حدث خطأ أثناء الحفظ'
    });
    return false;
  }
  
  // Emit standardized event so other components update in same-tab
  emitEvent(EVENTS.INVOICES_UPDATED, invoices);
  return true;
};

// Fix #14: Sequential invoice numbering
const INVOICE_COUNTER_KEY = 'hyperpos_invoice_counter_v1';

const getNextInvoiceNumber = (): string => {
  try {
    const year = new Date().getFullYear();
    const counterData = localStorage.getItem(INVOICE_COUNTER_KEY);
    let counter = { year, number: 0 };
    
    if (counterData) {
      const parsed = JSON.parse(counterData);
      if (parsed.year === year) {
        counter = parsed;
      }
      // Reset counter if year changed
    }
    
    counter.number += 1;
    localStorage.setItem(INVOICE_COUNTER_KEY, JSON.stringify(counter));
    
    // Format: INV-2026-001
    return `INV-${year}-${String(counter.number).padStart(3, '0')}`;
  } catch (error) {
    console.error('Failed to generate invoice number:', error);
    // Fallback to timestamp-based ID
    return `INV-${Date.now()}`;
  }
};

export const addInvoice = (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Invoice => {
  const invoices = loadInvoices();
  const newInvoice: Invoice = {
    ...invoice,
    id: getNextInvoiceNumber(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  invoices.unshift(newInvoice); // Add to beginning
  saveInvoices(invoices);
  return newInvoice;
};

export const updateInvoice = (id: string, updates: Partial<Invoice>): Invoice | null => {
  const invoices = loadInvoices();
  const index = invoices.findIndex(inv => inv.id === id);
  if (index === -1) return null;
  
  invoices[index] = {
    ...invoices[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveInvoices(invoices);
  return invoices[index];
};

export const deleteInvoice = (id: string): boolean => {
  const invoices = loadInvoices();
  const invoice = invoices.find(inv => inv.id === id);
  
  if (!invoice) return false;
  
  // Delete associated debt if exists
  if (invoice.paymentType === 'debt') {
    deleteDebtByInvoiceId(id);
  }
  
  // Revert profit distribution
  revertProfitDistribution(id);
  
  const filtered = invoices.filter(inv => inv.id !== id);
  saveInvoices(filtered);
  return true;
};

export const getInvoiceById = (id: string): Invoice | null => {
  const invoices = loadInvoices();
  return invoices.find(inv => inv.id === id) || null;
};

export const getInvoicesByType = (type: InvoiceType): Invoice[] => {
  return loadInvoices().filter(inv => inv.type === type);
};

export const getInvoiceStats = () => {
  const invoices = loadInvoices();
  const today = new Date().toDateString();
  const todayInvoices = invoices.filter(inv => new Date(inv.createdAt).toDateString() === today);
  
  return {
    total: invoices.length,
    todayCount: todayInvoices.length,
    todaySales: todayInvoices.reduce((sum, inv) => sum + inv.total, 0),
    totalSales: invoices.reduce((sum, inv) => sum + inv.total, 0),
    pendingDebts: invoices.filter(inv => inv.paymentType === 'debt' && inv.status === 'pending').length,
    totalProfit: invoices.reduce((sum, inv) => sum + (inv.profit || 0), 0),
  };
};

// تحديد الفاتورة كمدفوعة مع مزامنة الدين
export const markInvoicePaidWithDebtSync = (invoiceId: string): boolean => {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) return false;
  
  // تحديث الفاتورة مع تصفير المتبقي
  updateInvoice(invoiceId, { 
    status: 'paid', 
    paymentType: 'cash',
    debtPaid: invoice.totalInCurrency || invoice.total,
    debtRemaining: 0
  });
  
  // مزامنة الدين - تحديده كمدفوع بالكامل
  if (invoice.paymentType === 'debt') {
    const debts = loadDebts();
    const debt = debts.find(d => d.invoiceId === invoiceId);
    if (debt && debt.status !== 'fully_paid') {
      recordPayment(debt.id, debt.remainingDebt);
    }
  }
  
  return true;
};
