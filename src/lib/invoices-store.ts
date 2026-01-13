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
  } catch {
    // ignore
  }
  return [];
};

export const saveInvoices = (invoices: Invoice[]) => {
  try {
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
  } catch {
    // ignore
  }
};

export const addInvoice = (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Invoice => {
  const invoices = loadInvoices();
  const newInvoice: Invoice = {
    ...invoice,
    id: `INV-${Date.now()}`,
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
  const filtered = invoices.filter(inv => inv.id !== id);
  if (filtered.length === invoices.length) return false;
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
