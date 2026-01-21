// Cloud Sync Hook - Manages data synchronization between localStorage and Supabase
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './use-auth';
import { 
  setCurrentUserId, 
  batchInsertToSupabase, 
  hasCloudData,
  fetchStoreSettings,
  saveStoreSettings as saveStoreSettingsCloud
} from '@/lib/supabase-store';
import { toast } from 'sonner';

// localStorage keys to migrate
const LOCAL_STORAGE_KEYS = {
  products: 'hyperpos_products_v1',
  categories: 'hyperpos_categories_v1',
  customers: 'hyperpos_customers_v1',
  invoices: 'hyperpos_invoices_v1',
  debts: 'hyperpos_debts_v1',
  expenses: 'hyperpos_expenses_v1',
  recurringExpenses: 'hyperpos_recurring_expenses_v1',
  partners: 'hyperpos_partners_v1',
  maintenance: 'hyperpos_maintenance_v1',
  settings: 'hyperpos_settings_v1',
};

// Map local storage keys to Supabase table names
const TABLE_MAPPING: Record<string, string> = {
  products: 'products',
  categories: 'categories',
  customers: 'customers',
  invoices: 'invoices',
  debts: 'debts',
  expenses: 'expenses',
  recurringExpenses: 'recurring_expenses',
  partners: 'partners',
  maintenance: 'maintenance_services',
};

// Field mappings from camelCase (localStorage) to snake_case (Supabase)
const fieldMappings: Record<string, Record<string, string>> = {
  products: {
    costPrice: 'cost_price',
    salePrice: 'sale_price',
    minStockLevel: 'min_stock_level',
    expiryDate: 'expiry_date',
    imageUrl: 'image_url',
    customFields: 'custom_fields',
  },
  customers: {
    totalPurchases: 'total_purchases',
    totalDebt: 'total_debt',
    invoiceCount: 'invoice_count',
    lastPurchase: 'last_purchase',
  },
  invoices: {
    invoiceNumber: 'invoice_number',
    invoiceType: 'invoice_type',
    cashierId: 'cashier_id',
    cashierName: 'cashier_name',
    customerId: 'customer_id',
    customerName: 'customer_name',
    customerPhone: 'customer_phone',
    discountPercentage: 'discount_percentage',
    taxRate: 'tax_rate',
    taxAmount: 'tax_amount',
    exchangeRate: 'exchange_rate',
    paymentType: 'payment_type',
    debtPaid: 'debt_paid',
    debtRemaining: 'debt_remaining',
  },
  debts: {
    invoiceId: 'invoice_id',
    customerName: 'customer_name',
    customerPhone: 'customer_phone',
    totalDebt: 'total_debt',
    totalPaid: 'total_paid',
    remainingDebt: 'remaining_debt',
    dueDate: 'due_date',
    isCashDebt: 'is_cash_debt',
  },
  expenses: {
    expenseType: 'expense_type',
  },
  recurringExpenses: {
    expenseType: 'expense_type',
    nextDueDate: 'next_due_date',
    isActive: 'is_active',
  },
  partners: {
    initialCapital: 'initial_capital',
    currentCapital: 'current_capital',
    sharePercentage: 'share_percentage',
    expenseSharePercentage: 'expense_share_percentage',
    accessAll: 'access_all',
    categoryShares: 'category_shares',
    totalProfitEarned: 'total_profit_earned',
    totalWithdrawn: 'total_withdrawn',
    currentBalance: 'current_balance',
    pendingProfit: 'pending_profit',
    confirmedProfit: 'confirmed_profit',
    pendingProfitDetails: 'pending_profit_details',
    profitHistory: 'profit_history',
    expenseHistory: 'expense_history',
    capitalHistory: 'capital_history',
    withdrawalHistory: 'withdrawal_history',
    joinedDate: 'joined_date',
  },
  maintenance: {
    customerName: 'customer_name',
    customerPhone: 'customer_phone',
    servicePrice: 'service_price',
    partsCost: 'parts_cost',
    paymentType: 'payment_type',
  },
};

// Transform object keys from camelCase to snake_case based on mapping
function transformToSnakeCase(data: Record<string, unknown>, dataType: string): Record<string, unknown> {
  const mapping = fieldMappings[dataType] || {};
  const transformed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip id if it's not a valid UUID format (localStorage uses timestamp IDs)
    if (key === 'id' && typeof value === 'string' && !value.includes('-')) {
      continue; // Let Supabase generate new UUID
    }
    
    // Skip internal fields
    if (key === 'status' && dataType === 'products') continue;
    if (key === 'createdAt' || key === 'updatedAt') continue;
    
    const snakeKey = mapping[key] || key;
    transformed[snakeKey] = value;
  }

  return transformed;
}

export interface CloudSyncState {
  isInitialized: boolean;
  isMigrating: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  error: string | null;
}

export function useCloudSync() {
  const { user, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<CloudSyncState>({
    isInitialized: false,
    isMigrating: false,
    isSyncing: false,
    lastSyncTime: null,
    error: null,
  });

  // Initialize cloud sync when user is authenticated
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      setCurrentUserId(user.id);
      checkAndMigrateData();
    } else {
      setCurrentUserId(null);
      setState(prev => ({ ...prev, isInitialized: true }));
    }
  }, [user, authLoading]);

  // Check if migration is needed and perform it
  const checkAndMigrateData = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, isMigrating: true }));

    try {
      // Check if user already has cloud data
      const hasProducts = await hasCloudData('products');
      
      if (hasProducts) {
        // User already has cloud data, no migration needed
        console.log('Cloud data found, skipping migration');
        setState(prev => ({ 
          ...prev, 
          isInitialized: true, 
          isMigrating: false,
          lastSyncTime: new Date().toISOString()
        }));
        return;
      }

      // Check if there's local data to migrate
      const hasLocalData = Object.values(LOCAL_STORAGE_KEYS).some(key => {
        const stored = localStorage.getItem(key);
        if (!stored) return false;
        try {
          const parsed = JSON.parse(stored);
          return Array.isArray(parsed) ? parsed.length > 0 : !!parsed;
        } catch {
          return false;
        }
      });

      if (hasLocalData) {
        console.log('Migrating local data to cloud...');
        await migrateLocalToCloud();
        toast.success('تم ترحيل بياناتك إلى السحابة بنجاح', {
          description: 'بياناتك الآن محفوظة بأمان ويمكنك الوصول لها من أي جهاز'
        });
      } else {
        // First time user, create default store
        await saveStoreSettingsCloud({
          name: 'متجري',
          store_type: 'phones',
          language: 'ar',
          theme: 'light',
        });
      }

      setState(prev => ({ 
        ...prev, 
        isInitialized: true, 
        isMigrating: false,
        lastSyncTime: new Date().toISOString()
      }));

    } catch (error) {
      console.error('Migration error:', error);
      setState(prev => ({ 
        ...prev, 
        isInitialized: true, 
        isMigrating: false,
        error: 'فشل في ترحيل البيانات'
      }));
    }
  }, [user]);

  // Migrate local storage data to Supabase
  const migrateLocalToCloud = async () => {
    const migrations: Promise<boolean>[] = [];

    for (const [dataType, localKey] of Object.entries(LOCAL_STORAGE_KEYS)) {
      if (dataType === 'settings') continue; // Handle settings separately
      
      const tableName = TABLE_MAPPING[dataType];
      if (!tableName) continue;

      const stored = localStorage.getItem(localKey);
      if (!stored) continue;

      try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed) || parsed.length === 0) continue;

        // Transform data for Supabase
        const transformedData = parsed.map(item => transformToSnakeCase(item, dataType));

        migrations.push(
          batchInsertToSupabase(tableName, transformedData).then(success => {
            if (success) {
              // Clear local storage after successful migration
              localStorage.removeItem(localKey);
              console.log(`Migrated ${dataType}: ${parsed.length} items`);
            }
            return success;
          })
        );
      } catch (error) {
        console.error(`Error migrating ${dataType}:`, error);
      }
    }

    // Migrate settings
    const settingsStored = localStorage.getItem(LOCAL_STORAGE_KEYS.settings);
    if (settingsStored) {
      try {
        const settings = JSON.parse(settingsStored);
        await saveStoreSettingsCloud({
          name: settings.storeName || 'متجري',
          phone: settings.storePhone,
          address: settings.storeAddress,
          store_type: settings.storeType || 'phones',
          theme: settings.theme || 'light',
          language: settings.language || 'ar',
          exchange_rates: settings.exchangeRates,
          tax_enabled: settings.taxEnabled || false,
          tax_rate: settings.taxRate || 0,
          print_settings: settings.print,
          notification_settings: settings.notifications,
        });
        localStorage.removeItem(LOCAL_STORAGE_KEYS.settings);
      } catch (error) {
        console.error('Error migrating settings:', error);
      }
    }

    await Promise.all(migrations);
  };

  // Manual sync trigger
  const syncNow = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, isSyncing: true }));

    try {
      // Reload data from cloud
      setState(prev => ({ 
        ...prev, 
        isSyncing: false,
        lastSyncTime: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Sync error:', error);
      setState(prev => ({ 
        ...prev, 
        isSyncing: false,
        error: 'فشل في المزامنة'
      }));
    }
  }, [user]);

  return {
    ...state,
    syncNow,
    isReady: state.isInitialized && !state.isMigrating,
  };
}
