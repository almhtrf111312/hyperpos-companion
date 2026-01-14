import { emitEvent, EVENTS } from './events';

const CUSTOMERS_STORAGE_KEY = 'hyperpos_customers_v1';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  totalDebt: number;
  invoiceCount: number;
  lastPurchase: string;
  createdAt: string;
  updatedAt: string;
}

export const loadCustomers = (): Customer[] => {
  try {
    const stored = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
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

export const saveCustomers = (customers: Customer[]) => {
  try {
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
    // Dispatch standardized custom event
    emitEvent(EVENTS.CUSTOMERS_UPDATED, customers);
  } catch {
    // ignore
  }
};

export const addCustomer = (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalPurchases' | 'totalDebt' | 'invoiceCount' | 'lastPurchase'>): Customer => {
  const customers = loadCustomers();
  const newCustomer: Customer = {
    ...customer,
    id: Date.now().toString(),
    totalPurchases: 0,
    totalDebt: 0,
    invoiceCount: 0,
    lastPurchase: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  customers.push(newCustomer);
  saveCustomers(customers);
  return newCustomer;
};
