// Customers store for managing all customers data

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
    // Dispatch storage event for cross-component updates
    window.dispatchEvent(new Event('customersUpdated'));
  } catch {
    // ignore
  }
};

export const addCustomer = (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalPurchases' | 'totalDebt' | 'invoiceCount' | 'lastPurchase'>): Customer => {
  const customers = loadCustomers();
  const newCustomer: Customer = {
    ...customer,
    id: `CUST-${Date.now()}`,
    totalPurchases: 0,
    totalDebt: 0,
    invoiceCount: 0,
    lastPurchase: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  customers.unshift(newCustomer);
  saveCustomers(customers);
  return newCustomer;
};

export const updateCustomer = (id: string, updates: Partial<Customer>): Customer | null => {
  const customers = loadCustomers();
  const index = customers.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  customers[index] = {
    ...customers[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveCustomers(customers);
  return customers[index];
};

export const deleteCustomer = (id: string): boolean => {
  const customers = loadCustomers();
  const filtered = customers.filter(c => c.id !== id);
  if (filtered.length === customers.length) return false;
  saveCustomers(filtered);
  return true;
};

export const getCustomerById = (id: string): Customer | null => {
  const customers = loadCustomers();
  return customers.find(c => c.id === id) || null;
};

export const getCustomerByPhone = (phone: string): Customer | null => {
  const customers = loadCustomers();
  return customers.find(c => c.phone === phone) || null;
};

export const getCustomerByName = (name: string): Customer | null => {
  const customers = loadCustomers();
  return customers.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
};

export const findOrCreateCustomer = (name: string, phone?: string): Customer => {
  // Try to find by phone first
  if (phone) {
    const byPhone = getCustomerByPhone(phone);
    if (byPhone) return byPhone;
  }
  
  // Try to find by exact name
  const byName = getCustomerByName(name);
  if (byName) return byName;
  
  // Create new customer
  return addCustomer({ name, phone: phone || '' });
};

export const updateCustomerStats = (customerId: string, saleAmount: number, isDebt: boolean) => {
  const customer = getCustomerById(customerId);
  if (!customer) return;
  
  updateCustomer(customerId, {
    totalPurchases: customer.totalPurchases + saleAmount,
    totalDebt: isDebt ? customer.totalDebt + saleAmount : customer.totalDebt,
    invoiceCount: customer.invoiceCount + 1,
    lastPurchase: new Date().toISOString().split('T')[0],
  });
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
