/**
 * Sync History - Tracks the last N sync operations for UI display
 */
import { secureSet, secureGet } from './secure-storage';
import { emitEvent } from './events';

const SYNC_HISTORY_KEY = 'sync_history';
const SYNC_HISTORY_NAMESPACE = 'hp_sync';
const MAX_HISTORY_ITEMS = 10;

export type SyncCategory = 'sale' | 'expense' | 'debt' | 'inventory' | 'purchase' | 'sync' | 'system';

export interface SyncHistoryMeta {
  operationTitle?: string;
  amountText?: string;
  partyOrItem?: string;
  details?: string;
}

export interface SyncHistoryItem {
  id: string;
  type: string;
  label: string; // Human-readable label
  timestamp: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error?: string;
  category?: SyncCategory;
  meta?: SyncHistoryMeta;
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

/**
 * ترجمة العمليات والمزامنات إلى لغة محاسبية دقيقة وتفادي إظهار أسماء الجداول
 */
export function formatAccountingSyncLabel(
  type: string,
  rawLabelOrPayload?: any
): { title: string; subtitle?: string; category: SyncCategory } {
  const t = (type || '').toLowerCase();
  
  if (t === 'sale' || t === 'invoice_create' || t.includes('invoice') || t.includes('sale')) {
    let invNum = '';
    let customer = '';
    let amount = '';
    if (typeof rawLabelOrPayload === 'object' && rawLabelOrPayload !== null) {
      invNum = rawLabelOrPayload.invoiceNumber || rawLabelOrPayload.id || '';
      customer = rawLabelOrPayload.customerName || '';
      amount = rawLabelOrPayload.amountText || (rawLabelOrPayload.totalInCurrency ? `${rawLabelOrPayload.totalInCurrency}` : '');
    }
    const shortId = invNum ? `#${String(invNum).replace(/^inv[-_]?/i, '')}` : '';
    return {
      title: `تمت مزامنة فاتورة مبيعات ${shortId}`.trim(),
      subtitle: [customer ? `الزبون: ${customer}` : '', amount ? `المبلغ: ${amount}` : ''].filter(Boolean).join(' • '),
      category: 'sale'
    };
  }

  if (t === 'expense' || t.includes('expense')) {
    let desc = '';
    let amount = '';
    if (typeof rawLabelOrPayload === 'object' && rawLabelOrPayload !== null) {
      desc = rawLabelOrPayload.name || rawLabelOrPayload.description || rawLabelOrPayload.category || '';
      amount = rawLabelOrPayload.amountText || (rawLabelOrPayload.amount ? `${rawLabelOrPayload.amount}` : '');
    }
    return {
      title: `تمت مزامنة مصروف: ${desc || 'مصروف تشغيلي'}`.trim(),
      subtitle: amount ? `المدفوع: ${amount}` : undefined,
      category: 'expense'
    };
  }

  if (t === 'debt' || t === 'debt_payment' || t === 'debt_sale_bundle' || t.includes('debt')) {
    let party = '';
    let amount = '';
    if (typeof rawLabelOrPayload === 'object' && rawLabelOrPayload !== null) {
      party = rawLabelOrPayload.customerName || rawLabelOrPayload.supplierName || '';
      amount = rawLabelOrPayload.amountText || (rawLabelOrPayload.amount ? `${rawLabelOrPayload.amount}` : '');
    }
    return {
      title: `تمت مزامنة حركة دين${party ? `: ${party}` : ''}`,
      subtitle: amount ? `قيمة الدفعة: ${amount}` : undefined,
      category: 'debt'
    };
  }

  if (t === 'stock_update' || t === 'inventory' || t.includes('stock') || t.includes('product')) {
    let item = '';
    if (typeof rawLabelOrPayload === 'object' && rawLabelOrPayload !== null) {
      item = rawLabelOrPayload.productName || rawLabelOrPayload.name || '';
    }
    return {
      title: `تمت مزامنة تحديث مخزون${item ? `: ${item}` : ''}`,
      category: 'inventory'
    };
  }

  if (t === 'purchase' || t.includes('purchase')) {
    return {
      title: 'تمت مزامنة فاتورة شراء',
      category: 'purchase'
    };
  }

  return {
    title: TYPE_LABELS[type] || 'تمت مزامنة البيانات',
    category: 'sync'
  };
}

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
export const addToHistory = (
  id: string, 
  type: string, 
  customLabel?: string, 
  meta?: SyncHistoryMeta, 
  category?: SyncCategory
): void => {
  const history = loadHistory();
  
  // Don't duplicate
  if (history.some(h => h.id === id)) return;
  
  const accounting = formatAccountingSyncLabel(type, meta || customLabel);
  
  history.push({
    id,
    type,
    label: customLabel || accounting.title || TYPE_LABELS[type] || type,
    timestamp: new Date().toISOString(),
    status: 'pending',
    category: category || accounting.category,
    meta: meta || (accounting.subtitle ? { partyOrItem: accounting.subtitle } : undefined),
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
