// Smart Auto-Backup System
// Activity-based backup with Google Drive and local storage support
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { 
  getStoredTokens, 
  getStoredFolderId, 
  uploadBackup,
  setLastSyncTimestamp 
} from './google-drive';

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
export const generateBackupData = (): object => {
  const backupData: Record<string, unknown> = {
    version: '2.0',
    timestamp: new Date().toISOString(),
    localTimestamp: new Date().toLocaleString('ar-SA', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    source: 'hyperpos_backup',
    storeInfo: getStoreSettings(),
    data: {},
  };
  
  // Comprehensive list of all data keys to backup
  const keysToBackup = [
    // Core data
    'hyperpos_invoices_v1',
    'hyperpos_products_v1',
    'hyperpos_customers_v1',
    'hyperpos_debts_v1',
    'hyperpos_partners_v1',
    'hyperpos_expenses_v1',
    'hyperpos_recurring_expenses_v1',
    'hyperpos_categories_v1',
    'hyperpos_maintenance_v1',
    
    // Financial data
    'hyperpos_cashbox_v1',
    'hyperpos_shifts_v1',
    'hyperpos_capital_v1',
    
    // Settings
    'hyperpos_settings',
    'hyperpos_settings_v1',
    'hyperpos_exchange_rates_v1',
    'hyperpos_custom_fields_config',
    'hyperpos_product_fields_config',
    
    // Backup config
    'hyperpos_backup_config_v1',
    
    // Activity logs
    'hyperpos_activity_log',
  ];
  
  keysToBackup.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        (backupData.data as Record<string, unknown>)[key] = JSON.parse(value);
      }
    } catch {
      // If JSON parse fails, store as string
      const value = localStorage.getItem(key);
      if (value) {
        (backupData.data as Record<string, unknown>)[key] = value;
      }
    }
  });
  
  // Add summary statistics
  try {
    const invoices = (backupData.data as Record<string, unknown>)['hyperpos_invoices_v1'];
    const products = (backupData.data as Record<string, unknown>)['hyperpos_products_v1'];
    const customers = (backupData.data as Record<string, unknown>)['hyperpos_customers_v1'];
    const expenses = (backupData.data as Record<string, unknown>)['hyperpos_expenses_v1'];
    const partners = (backupData.data as Record<string, unknown>)['hyperpos_partners_v1'];
    
    backupData.summary = {
      invoicesCount: Array.isArray(invoices) ? invoices.length : 0,
      productsCount: Array.isArray(products) ? products.length : 0,
      customersCount: Array.isArray(customers) ? customers.length : 0,
      expensesCount: Array.isArray(expenses) ? expenses.length : 0,
      partnersCount: Array.isArray(partners) ? partners.length : 0,
    };
  } catch {
    // ignore summary errors
  }
  
  return backupData;
};

// Save backup to local storage (Capacitor Filesystem)
export const saveBackupLocally = async (): Promise<boolean> => {
  try {
    const backupData = generateBackupData();
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
    
    const backupData = generateBackupData();
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
export const generateDownloadableBackup = (): { data: string; fileName: string } => {
  const backupData = generateBackupData();
  const fileName = `hyperpos_full_backup_${new Date().toISOString().split('T')[0]}.json`;
  
  return {
    data: JSON.stringify(backupData, null, 2),
    fileName,
  };
};
