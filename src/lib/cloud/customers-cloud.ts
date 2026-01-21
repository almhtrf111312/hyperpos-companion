// Cloud Customers Store - Supabase-backed customers management
import { 
  fetchFromSupabase, 
  insertToSupabase, 
  updateInSupabase, 
  deleteFromSupabase,
  getCurrentUserId 
} from '../supabase-store';
import { emitEvent, EVENTS } from '../events';

export interface CloudCustomer {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  total_purchases: number;
  total_debt: number;
  invoice_count: number;
  last_purchase: string | null;
  created_at: string;
  updated_at: string;
}

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

// Transform cloud to legacy format
function toCustomer(cloud: CloudCustomer): Customer {
  return {
    id: cloud.id,
    name: cloud.name,
    phone: cloud.phone || '',
    email: cloud.email || undefined,
    address: cloud.address || undefined,
    totalPurchases: Number(cloud.total_purchases) || 0,
    totalDebt: Number(cloud.total_debt) || 0,
    invoiceCount: cloud.invoice_count || 0,
    lastPurchase: cloud.last_purchase || '',
    createdAt: cloud.created_at,
    updatedAt: cloud.updated_at,
  };
}

// Cache
let customersCache: Customer[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

// Load customers
export const loadCustomersCloud = async (): Promise<Customer[]> => {
  const userId = getCurrentUserId();
  if (!userId) return [];

  if (customersCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return customersCache;
  }

  const cloudCustomers = await fetchFromSupabase<CloudCustomer>('customers', {
    column: 'created_at',
    ascending: false,
  });

  customersCache = cloudCustomers.map(toCustomer);
  cacheTimestamp = Date.now();
  
  return customersCache;
};

export const invalidateCustomersCache = () => {
  customersCache = null;
  cacheTimestamp = 0;
};

// Add customer
export const addCustomerCloud = async (
  customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalPurchases' | 'totalDebt' | 'invoiceCount' | 'lastPurchase'>
): Promise<Customer | null> => {
  const inserted = await insertToSupabase<CloudCustomer>('customers', {
    name: customer.name,
    phone: customer.phone || null,
    email: customer.email || null,
    address: customer.address || null,
    total_purchases: 0,
    total_debt: 0,
    invoice_count: 0,
  });
  
  if (inserted) {
    invalidateCustomersCache();
    emitEvent(EVENTS.CUSTOMERS_UPDATED, null);
    return toCustomer(inserted);
  }
  
  return null;
};

// Update customer
export const updateCustomerCloud = async (
  id: string, 
  data: Partial<Omit<Customer, 'id' | 'createdAt'>>
): Promise<boolean> => {
  const updates: Record<string, unknown> = {};
  
  if (data.name !== undefined) updates.name = data.name;
  if (data.phone !== undefined) updates.phone = data.phone || null;
  if (data.email !== undefined) updates.email = data.email || null;
  if (data.address !== undefined) updates.address = data.address || null;
  if (data.totalPurchases !== undefined) updates.total_purchases = data.totalPurchases;
  if (data.totalDebt !== undefined) updates.total_debt = data.totalDebt;
  if (data.invoiceCount !== undefined) updates.invoice_count = data.invoiceCount;
  if (data.lastPurchase !== undefined) updates.last_purchase = data.lastPurchase || null;

  const success = await updateInSupabase('customers', id, updates);
  
  if (success) {
    invalidateCustomersCache();
    emitEvent(EVENTS.CUSTOMERS_UPDATED, null);
  }
  
  return success;
};

// Delete customer
export const deleteCustomerCloud = async (id: string): Promise<boolean> => {
  const success = await deleteFromSupabase('customers', id);
  
  if (success) {
    invalidateCustomersCache();
    emitEvent(EVENTS.CUSTOMERS_UPDATED, null);
  }
  
  return success;
};

// Find or create customer
export const findOrCreateCustomerCloud = async (name: string, phone?: string): Promise<Customer | null> => {
  const customers = await loadCustomersCloud();
  
  let customer = customers.find(c => 
    c.name.toLowerCase() === name.toLowerCase() || 
    (phone && c.phone === phone)
  );
  
  if (!customer) {
    customer = await addCustomerCloud({ name, phone: phone || '' });
  }
  
  return customer;
};

// Update customer stats
export const updateCustomerStatsCloud = async (
  customerId: string, 
  purchaseAmount: number, 
  isDebt: boolean
): Promise<void> => {
  const customers = await loadCustomersCloud();
  const customer = customers.find(c => c.id === customerId);
  
  if (customer) {
    await updateCustomerCloud(customerId, {
      totalPurchases: customer.totalPurchases + purchaseAmount,
      totalDebt: isDebt ? customer.totalDebt + purchaseAmount : customer.totalDebt,
      invoiceCount: customer.invoiceCount + 1,
      lastPurchase: new Date().toISOString(),
    });
  }
};

// Get customers stats
export const getCustomersStatsCloud = async () => {
  const customers = await loadCustomersCloud();
  return {
    total: customers.length,
    withDebt: customers.filter(c => c.totalDebt > 0).length,
    totalDebt: customers.reduce((sum, c) => sum + c.totalDebt, 0),
    totalPurchases: customers.reduce((sum, c) => sum + c.totalPurchases, 0),
  };
};
