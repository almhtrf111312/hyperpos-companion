/**
 * Sync History - Tracks the last N sync operations for UI display
 */
import { secureSet, secureGet } from './secure-storage';
import { emitEvent } from './events';

const SYNC_HISTORY_KEY = 'sync_history';
const SYNC_HISTORY_NAMESPACE = 'hp_sync';
const MAX_HISTORY_ITEMS = 10;

export interface SyncHistoryItem {
  id: string;
  type: string;
  label: string; // Human-readable label
  timestamp: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error?: string;
}

export const SYNC_HISTORY_UPDATED = 'syncHistoryUpdated';

// Operation type labels (Arabic)
const TYPE_LABELS: Record<string, string> = {
  sale: 'عملية بيع',
  expense: 'مصروف',
  debt: 'دين',
  debt_payment: 'سداد دين',
  debt_sale_bundle: 'بيع آجل',
  stock_update: 'تحديث مخزون',
  customer_update: 'تحديث عميل',
  invoice_create: 'إنشاء فاتورة',
  profit_record: 'تسجيل ربح',
};

export const loadHistory = (): SyncHistoryItem[] => {
  try {
    return secureGet<SyncHistoryItem[]>(SYNC_HISTORY_KEY, { namespace: SYNC_HISTORY_NAMESPACE }) || [];
  } catch {
    return [];
  }
};

const saveHistory = (items: SyncHistoryItem[]): void => {
  try {
    // Keep only last MAX_HISTORY_ITEMS
    const trimmed = items.slice(-MAX_HISTORY_ITEMS);
    secureSet(SYNC_HISTORY_KEY, trimmed, { namespace: SYNC_HISTORY_NAMESPACE });
    emitEvent(SYNC_HISTORY_UPDATED, trimmed);
  } catch (e) {
    console.error('[SyncHistory] Save error:', e);
  }
};

/** Add a new operation to history as 'pending' */
export const addToHistory = (id: string, type: string, customLabel?: string): void => {
  const history = loadHistory();
  
  // Don't duplicate
  if (history.some(h => h.id === id)) return;
  
  history.push({
    id,
    type,
    label: customLabel || TYPE_LABELS[type] || type,
    timestamp: new Date().toISOString(),
    status: 'pending',
  });
  
  saveHistory(history);
};

/** Update status of a history item */
export const updateHistoryStatus = (
  id: string, 
  status: SyncHistoryItem['status'], 
  error?: string
): void => {
  const history = loadHistory();
  const item = history.find(h => h.id === id);
  if (item) {
    item.status = status;
    if (error) item.error = error;
    saveHistory(history);
  }
};

/** Mark all pending items as synced */
export const markAllSynced = (): void => {
  const history = loadHistory();
  let changed = false;
  history.forEach(h => {
    if (h.status === 'pending' || h.status === 'syncing') {
      h.status = 'synced';
      changed = true;
    }
  });
  if (changed) saveHistory(history);
};

/** Clear synced items older than 1 hour */
export const cleanupSyncedItems = (): void => {
  const history = loadHistory();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const filtered = history.filter(h => {
    if (h.status === 'synced') {
      return new Date(h.timestamp).getTime() > oneHourAgo;
    }
    return true; // Keep pending/failed
  });
  if (filtered.length !== history.length) {
    saveHistory(filtered);
  }
};
