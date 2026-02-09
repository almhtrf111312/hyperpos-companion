/**
 * Trash Store - سلة المحذوفات
 * يحفظ العناصر المحذوفة محلياً للاسترداد لاحقاً
 */

const TRASH_STORAGE_KEY = 'hyperpos_trash_v1';
const MAX_TRASH_ITEMS = 500; // حد أقصى لمنع امتلاء التخزين

export type TrashItemType = 'invoice' | 'product' | 'customer' | 'debt' | 'expense' | 'warehouse';

export interface TrashItem {
  id: string;
  type: TrashItemType;
  label: string; // اسم العنصر للعرض
  data: Record<string, unknown>;
  deletedAt: string;
}

// تحميل سلة المحذوفات
export const loadTrash = (): TrashItem[] => {
  try {
    const stored = localStorage.getItem(TRASH_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('[Trash] Failed to load:', e);
  }
  return [];
};

// حفظ سلة المحذوفات
const saveTrash = (items: TrashItem[]): void => {
  try {
    // الاحتفاظ بأحدث العناصر فقط
    const trimmed = items.slice(0, MAX_TRASH_ITEMS);
    localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('[Trash] Failed to save:', e);
  }
};

// إضافة عنصر للمحذوفات
export const addToTrash = (
  type: TrashItemType,
  label: string,
  data: Record<string, unknown>
): void => {
  const trash = loadTrash();
  const item: TrashItem = {
    id: `trash_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type,
    label,
    data,
    deletedAt: new Date().toISOString(),
  };
  trash.unshift(item); // الأحدث أولاً
  saveTrash(trash);
};

// حذف عنصر نهائياً من سلة المحذوفات
export const removeFromTrash = (trashId: string): void => {
  const trash = loadTrash();
  saveTrash(trash.filter(t => t.id !== trashId));
};

// تفريغ سلة المحذوفات بالكامل
export const clearTrash = (): void => {
  localStorage.removeItem(TRASH_STORAGE_KEY);
};

// تفريغ نوع معين
export const clearTrashByType = (type: TrashItemType): void => {
  const trash = loadTrash();
  saveTrash(trash.filter(t => t.type !== type));
};

// الحصول على عناصر حسب النوع
export const getTrashByType = (type: TrashItemType): TrashItem[] => {
  return loadTrash().filter(t => t.type === type);
};

// الحصول على إحصائيات سلة المحذوفات
export const getTrashStats = (): Record<TrashItemType, number> => {
  const trash = loadTrash();
  return {
    invoice: trash.filter(t => t.type === 'invoice').length,
    product: trash.filter(t => t.type === 'product').length,
    customer: trash.filter(t => t.type === 'customer').length,
    debt: trash.filter(t => t.type === 'debt').length,
    expense: trash.filter(t => t.type === 'expense').length,
    warehouse: trash.filter(t => t.type === 'warehouse').length,
  };
};

// استرداد عنصر من سلة المحذوفات (يعيد البيانات ويحذفه من السلة)
export const restoreFromTrash = (trashId: string): TrashItem | null => {
  const trash = loadTrash();
  const item = trash.find(t => t.id === trashId);
  if (!item) return null;
  saveTrash(trash.filter(t => t.id !== trashId));
  return item;
};
