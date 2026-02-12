// Smart Auto-Backup System
// Activity-based backup with Google Drive and local storage support
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import {
  getStoredTokens,
  getStoredFolderId,
  uploadBackup,
  setLastSyncTimestamp
} from './google-drive';
import { formatDateTime } from './utils';

const BACKUP_CONFIG_KEY = 'hyperpos_backup_config_v1';
const LAST_ACTIVITY_KEY = 'hyperpos_last_activity_v1';
const BACKUP_INTERVAL_HOURS = 3; // Backup every 3 hours if active
const IDLE_BACKUP_INTERVAL_HOURS = 24; // Backup once daily if idle

export interface BackupConfig {
  enabled: boolean;
  lastBackupTime?: string;
  lastActivityTime?: string;
  autoGoogleDrive: boolean;
  autoLocalStorage: boolean;
  backupOnExit: boolean;
}

// Load backup configuration
export const loadBackupConfig = (): BackupConfig => {
  try {
    const stored = localStorage.getItem(BACKUP_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return {
    enabled: true,
    autoGoogleDrive: true,
    autoLocalStorage: true,
    backupOnExit: true,
  };
};

// Save backup configuration
export const saveBackupConfig = (config: BackupConfig): void => {
  try {
    localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
};

// Record activity (call this after any transaction)
export const recordActivity = (): void => {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, new Date().toISOString());

    // Update config
    const config = loadBackupConfig();
    config.lastActivityTime = new Date().toISOString();
    saveBackupConfig(config);
  } catch {
    // ignore
  }
};

// Check if backup is needed
export const isBackupNeeded = (): boolean => {
  const config = loadBackupConfig();
  if (!config.enabled) return false;

  const now = new Date();
  const lastBackup = config.lastBackupTime ? new Date(config.lastBackupTime) : null;
  const lastActivity = config.lastActivityTime ? new Date(config.lastActivityTime) : null;

  // If never backed up, backup is needed
  if (!lastBackup) return true;

  const hoursSinceBackup = lastBackup
    ? (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60)
    : Infinity;

  // If there was activity since last backup
  if (lastActivity && lastBackup && lastActivity > lastBackup) {
    // Backup every 3 hours if active
    return hoursSinceBackup >= BACKUP_INTERVAL_HOURS;
  }

  // If idle, backup once daily
  return hoursSinceBackup >= IDLE_BACKUP_INTERVAL_HOURS;
};

// Get store settings for backup metadata
const getStoreSettings = (): Record<string, unknown> => {
  try {
    const stored = localStorage.getItem('hyperpos_settings');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return {};
};

// Generate comprehensive backup data with all system data
export const generateBackupData = async (): Promise<object> => {
  const storeSettings = getStoreSettings();

  // Load all data from Cloud Stores (Source of Truth)
  // These functions should ideally have local fallback/caching
  let invoices: any[] = [];
  let products: any[] = [];
  let partners: any[] = [];
  // dynamically import to avoid circular deps if any
  const { loadInvoicesCloud } = await import('./cloud/invoices-cloud');
  const { loadProductsCloud } = await import('./cloud/products-cloud');
  const { loadPartnersCloud } = await import('./cloud/partners-cloud');
  const { loadExpensesCloud } = await import('./cloud/expenses-cloud');
  const { loadWarehousesCloud, fetchAllWarehouseStocksCloud, loadStockTransfersCloud } = await import('./cloud/warehouses-cloud');

  // Try fetching main data
  try { invoices = await loadInvoicesCloud(); } catch (e) { console.error('Backup invoice error', e); }
  try { products = await loadProductsCloud(); } catch (e) { console.error('Backup product error', e); }
  try { partners = await loadPartnersCloud(); } catch (e) { console.error('Backup partner error', e); }

  let expenses: any[] = [];
  try { expenses = await loadExpensesCloud(); } catch (e) { console.error('Backup expense error', e); }

  let warehouses: any[] = [];
  let warehouseStock: any[] = [];
  let stockTransfers: any[] = [];
  try { warehouses = await loadWarehousesCloud(); } catch (e) { console.error('Backup warehouse error', e); }
  try { warehouseStock = await fetchAllWarehouseStocksCloud(); } catch (e) { console.error('Backup stock error', e); }
  try { stockTransfers = await loadStockTransfersCloud(); } catch (e) { console.error('Backup transfer error', e); }

  // Other local-only or less critical data from localStorage
  // Customers, Debts might be in Invoice Cloud or separate. 
  // Assuming Customers are separate? Let's check localStorage fallback for them.
  const customers = tryParse('hyperpos_customers_v1') || [];
  const debts = tryParse('hyperpos_debts_v1') || []; // If debts are cloud, should use loader. Assuming local fallback for now.

  const backupData: Record<string, unknown> = {
    version: '2.1', // Bump version/
    timestamp: new Date().toISOString(),
    localTimestamp: formatDateTime(new Date().toISOString()),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    source: 'hyperpos_backup_cloud',
    storeInfo: storeSettings,
    data: {
      // Cloud Data
      'hyperpos_invoices_v1': invoices,
      'hyperpos_products_v1': products,
      'hyperpos_partners_v1': partners,
      'hyperpos_expenses_v1': expenses,

      // Warehouse Data (New)
      'hyperpos_warehouses_v1': warehouses,
      'hyperpos_warehouse_stock_v1': warehouseStock,
      'hyperpos_stock_transfers_v1': stockTransfers,

      // Local/Legacy Data
      'hyperpos_customers_v1': customers,
      'hyperpos_debts_v1': debts,
      'hyperpos_recurring_expenses_v1': tryParse('hyperpos_recurring_expenses_v1'),
      'hyperpos_categories_v1': tryParse('hyperpos_categories_v1'),
      'hyperpos_maintenance_v1': tryParse('hyperpos_maintenance_v1'),

      // Internal State
      'hyperpos_cashbox_v1': tryParse('hyperpos_cashbox_v1'),
      'hyperpos_shifts_v1': tryParse('hyperpos_shifts_v1'),
      'hyperpos_capital_v1': tryParse('hyperpos_capital_v1'),

      // Configs
      'hyperpos_settings': tryParse('hyperpos_settings'),
      'hyperpos_settings_v1': tryParse('hyperpos_settings_v1'),
      'hyperpos_exchange_rates_v1': tryParse('hyperpos_exchange_rates_v1'),
      'hyperpos_custom_fields_config': tryParse('hyperpos_custom_fields_config'),
      'hyperpos_product_fields_config': tryParse('hyperpos_product_fields_config'),
      'hyperpos_backup_config_v1': tryParse('hyperpos_backup_config_v1'),
      'hyperpos_activity_log': tryParse('hyperpos_activity_log'),
    },
    summary: {
      invoicesCount: invoices.length,
      productsCount: products.length,
      customersCount: customers.length,
      expensesCount: expenses.length,
      partnersCount: partners.length,
      warehousesCount: warehouses.length,
    }
  };

  return backupData;
};

const tryParse = (key: string) => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
};

// Save backup to local storage (Capacitor Filesystem)
export const saveBackupLocally = async (): Promise<boolean> => {
  try {
    const backupData = await generateBackupData();
    const fileName = `hyperpos_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    // Check if running on native platform
    const isNative = typeof window !== 'undefined' &&
      !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

    if (isNative) {
      await Filesystem.writeFile({
        path: `HyperPOS/backups/${fileName}`,
        data: JSON.stringify(backupData, null, 2),
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    } else {
      // For web, save to localStorage as fallback
      const backups = loadLocalBackups();
      backups.unshift({
        fileName,
        data: backupData,
        createdAt: new Date().toISOString(),
      });
      // Keep only last 10 backups
      if (backups.length > 10) {
        backups.pop();
      }
      localStorage.setItem('hyperpos_local_backups', JSON.stringify(backups));
    }

    return true;
  } catch (error) {
    console.error('Failed to save backup locally:', error);
    return false;
  }
};

// Load local backups list
export const loadLocalBackups = (): Array<{ fileName: string; data: object; createdAt: string }> => {
  try {
    const stored = localStorage.getItem('hyperpos_local_backups');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return [];
};

// Save backup to Google Drive
export const saveBackupToGoogleDrive = async (): Promise<boolean> => {
  try {
    const tokens = getStoredTokens();
    const folderId = getStoredFolderId();

    if (!tokens?.access_token || !folderId) {
      console.log('Google Drive not connected');
      return false;
    }

    const backupData = await generateBackupData();
    const fileName = `hyperpos_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    const result = await uploadBackup(tokens.access_token, folderId, fileName, backupData);

    if (result) {
      setLastSyncTimestamp();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to save backup to Google Drive:', error);
    return false;
  }
};

// Perform auto-backup (both local and cloud)
export const performAutoBackup = async (): Promise<{ local: boolean; cloud: boolean }> => {
  const config = loadBackupConfig();
  const results = { local: false, cloud: false };

  if (!config.enabled) {
    return results;
  }

  // Save locally
  if (config.autoLocalStorage) {
    results.local = await saveBackupLocally();
  }

  // Save to Google Drive
  if (config.autoGoogleDrive) {
    results.cloud = await saveBackupToGoogleDrive();
  }

  // Update last backup time
  if (results.local || results.cloud) {
    config.lastBackupTime = new Date().toISOString();
    saveBackupConfig(config);
  }

  return results;
};

// Initialize auto-backup checker
let backupCheckInterval: ReturnType<typeof setInterval> | null = null;

export const initAutoBackup = (): void => {
  // Clear any existing interval
  if (backupCheckInterval) {
    clearInterval(backupCheckInterval);
  }

  // Check every 30 minutes if backup is needed
  backupCheckInterval = setInterval(async () => {
    if (isBackupNeeded()) {
      console.log('Auto-backup triggered');
      await performAutoBackup();
    }
  }, 30 * 60 * 1000); // 30 minutes

  // Also check on visibility change (when app comes to foreground)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isBackupNeeded()) {
      console.log('Auto-backup triggered on app focus');
      await performAutoBackup();
    }
  });
};

// Stop auto-backup
export const stopAutoBackup = (): void => {
  if (backupCheckInterval) {
    clearInterval(backupCheckInterval);
    backupCheckInterval = null;
  }
};

// Generate downloadable JSON backup for manual export
export const generateDownloadableBackup = async (): Promise<{ data: string; fileName: string }> => {
  const backupData = await generateBackupData();
  const fileName = `hyperpos_full_backup_${new Date().toISOString().split('T')[0]}.json`;

  return {
    data: JSON.stringify(backupData, null, 2),
    fileName,
  };
};
