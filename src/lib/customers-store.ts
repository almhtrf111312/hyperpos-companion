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

export const updateCustomer = (id: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>): boolean => {
  const customers = loadCustomers();
  const index = customers.findIndex(c => c.id === id);
  if (index === -1) return false;
  customers[index] = {
    ...customers[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  saveCustomers(customers);
  return true;
};

export const deleteCustomer = (id: string): boolean => {
  const customers = loadCustomers();
  const filtered = customers.filter(c => c.id !== id);
  if (filtered.length === customers.length) return false;
  saveCustomers(filtered);
  return true;
};

export const findOrCreateCustomer = (name: string, phone?: string): Customer => {
  const customers = loadCustomers();
  let customer = customers.find(c => 
    c.name.toLowerCase() === name.toLowerCase() || 
    (phone && c.phone === phone)
  );
  if (!customer) {
    customer = addCustomer({ name, phone: phone || '' });
  }
  return customer;
};

export const updateCustomerStats = (customerId: string, purchaseAmount: number, isDebt: boolean): void => {
  const customers = loadCustomers();
  const index = customers.findIndex(c => c.id === customerId);
  if (index !== -1) {
    customers[index].totalPurchases += purchaseAmount;
    if (isDebt) {
      customers[index].totalDebt += purchaseAmount;
    }
    customers[index].invoiceCount += 1;
    customers[index].lastPurchase = new Date().toISOString();
    customers[index].updatedAt = new Date().toISOString();
    saveCustomers(customers);
  }
};

export const getCustomersStats = () => {
  const customers = loadCustomers();
  return {
    total: customers.length,
    withDebt: customers.filter(c => c.totalDebt > 0).length,
    totalDebt: customers.reduce((sum, c) => sum + c.totalDebt, 0),
    totalPurchases: customers.reduce((sum, c) => sum + c.totalPurchases, 0),
  };
};
