/**
 * Offline Protection System
 * Encrypts local data after 30 days without server contact.
 * Shows warnings after 5 days.
 */

import { encryptBackup, decryptBackup } from './backup-encryption';
import { loadProductsFromIDB, saveProductsToIDB, clearProductsIDB } from './indexeddb-cache';

const WARNING_DAYS = 5;
const ENCRYPT_DAYS = 30;
const CONTACT_TIMESTAMP_KEY = 'hp_last_server_contact';
const DATA_ENCRYPTED_KEY = 'hp_data_encrypted';
const ENCRYPTED_BACKUP_KEY = 'hp_encrypted_backup';
const ENCRYPTED_IDB_KEY = 'hp_encrypted_idb_backup';

// localStorage keys to encrypt
const SENSITIVE_KEYS = [
  'hyperpos_products',
  'hyperpos_invoices',
  'hyperpos_customers',
  'hyperpos_debts',
  'hyperpos_expenses',
  'hyperpos_maintenance_v1',
  'hyperpos_partners',
  'hyperpos_categories',
  'hyperpos_capital',
  'hyperpos_cashbox',
];

/** Record a successful server contact */
export const recordServerContact = (): void => {
  try {
    localStorage.setItem(CONTACT_TIMESTAMP_KEY, Date.now().toString());
  } catch { /* ignore */ }
};

/** Get days since last server contact */
export const getDaysWithoutContact = (): number => {
  try {
    const ts = localStorage.getItem(CONTACT_TIMESTAMP_KEY);
    if (!ts) return 0; // Never contacted = treat as fresh (first launch)
    const elapsed = Date.now() - parseInt(ts, 10);
    return Math.floor(elapsed / (24 * 60 * 60 * 1000));
  } catch {
    return 0;
  }
};

/** Get offline status summary */
export const getOfflineStatus = (): {
  daysOffline: number;
  shouldWarn: boolean;
  shouldEncrypt: boolean;
} => {
  const daysOffline = getDaysWithoutContact();
  return {
    daysOffline,
    shouldWarn: daysOffline >= WARNING_DAYS && daysOffline < ENCRYPT_DAYS,
    shouldEncrypt: daysOffline >= ENCRYPT_DAYS,
  };
};

/** Check if data is currently encrypted */
export const isDataEncrypted = (): boolean => {
  try {
    return localStorage.getItem(DATA_ENCRYPTED_KEY) === 'true';
  } catch {
    return false;
  }
};

/** Encrypt all sensitive local data */
export const encryptLocalData = async (): Promise<boolean> => {
  try {
    // Already encrypted
    if (isDataEncrypted()) return true;

    // Collect localStorage data
    const localData: Record<string, string> = {};
    for (const key of SENSITIVE_KEYS) {
      const val = localStorage.getItem(key);
      if (val) {
        localData[key] = val;
      }
    }

    // Collect IndexedDB data
    let idbData: unknown[] | null = null;
    try {
      const idbResult = await loadProductsFromIDB();
      if (idbResult && idbResult.products.length > 0) {
        idbData = idbResult.products;
      }
    } catch {
      console.warn('[OfflineProtection] Failed to read IDB data');
    }

    // Encrypt localStorage data
    if (Object.keys(localData).length > 0) {
      const encrypted = encryptBackup(localData);
      localStorage.setItem(ENCRYPTED_BACKUP_KEY, encrypted);
    }

    // Encrypt IDB data
    if (idbData && idbData.length > 0) {
      const encryptedIdb = encryptBackup({ products: idbData });
      localStorage.setItem(ENCRYPTED_IDB_KEY, encryptedIdb);
    }

    // Remove original data
    for (const key of SENSITIVE_KEYS) {
      localStorage.removeItem(key);
    }

    // Clear IndexedDB
    try {
      await clearProductsIDB();
    } catch {
      console.warn('[OfflineProtection] Failed to clear IDB');
    }

    // Mark as encrypted
    localStorage.setItem(DATA_ENCRYPTED_KEY, 'true');
    console.log('[OfflineProtection] Data encrypted successfully');
    return true;
  } catch (error) {
    console.error('[OfflineProtection] Encryption failed:', error);
    return false;
  }
};

/** Decrypt and restore all local data */
export const decryptLocalData = async (): Promise<boolean> => {
  try {
    if (!isDataEncrypted()) return true;

    // Decrypt localStorage data
    const encryptedLS = localStorage.getItem(ENCRYPTED_BACKUP_KEY);
    if (encryptedLS) {
      const decrypted = decryptBackup(encryptedLS) as Record<string, string> | null;
      if (decrypted) {
        for (const [key, value] of Object.entries(decrypted)) {
          localStorage.setItem(key, value);
        }
      } else {
        console.error('[OfflineProtection] Failed to decrypt localStorage backup');
        return false;
      }
    }

    // Decrypt IDB data
    const encryptedIdb = localStorage.getItem(ENCRYPTED_IDB_KEY);
    if (encryptedIdb) {
      const decrypted = decryptBackup(encryptedIdb) as { products: unknown[] } | null;
      if (decrypted && decrypted.products) {
        try {
          await saveProductsToIDB(decrypted.products);
        } catch {
          console.warn('[OfflineProtection] Failed to restore IDB data');
        }
      }
    }

    // Cleanup
    localStorage.removeItem(ENCRYPTED_BACKUP_KEY);
    localStorage.removeItem(ENCRYPTED_IDB_KEY);
    localStorage.removeItem(DATA_ENCRYPTED_KEY);

    console.log('[OfflineProtection] Data decrypted successfully');
    return true;
  } catch (error) {
    console.error('[OfflineProtection] Decryption failed:', error);
    return false;
  }
};

/** Check and enforce offline protection (called periodically) */
export const checkAndEnforceProtection = async (): Promise<void> => {
  if (isDataEncrypted()) return; // Already encrypted

  const { shouldEncrypt } = getOfflineStatus();
  if (shouldEncrypt) {
    console.log('[OfflineProtection] 30 days without server contact - encrypting data');
    await encryptLocalData();
  }
};
