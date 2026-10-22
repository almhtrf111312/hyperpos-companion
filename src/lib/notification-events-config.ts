/**
 * Notification Events Configuration & Gatekeeper - FlowPOS Pro
 * ============================================================
 * Provides granular event control for all in-app notifications.
 * Allows cashiers/managers to toggle specific notifications on/off.
 * Synchronizes with store settings in localStorage and Supabase.
 */

export interface NotificationEventItem {
  key: string;
  title: string;
  description?: string;
  defaultEnabled: boolean;
  category: NotificationCategoryKey;
}

export type NotificationCategoryKey =
  | 'pos_sales'
  | 'invoices_refunds'
  | 'debts_customers'
  | 'products_stock'
  | 'expenses_cashbox'
  | 'sync_backup'
  | 'settings_system';

export interface NotificationCategoryGroup {
  id: NotificationCategoryKey;
  title: string;
  icon: string;
  color: string;
  events: NotificationEventItem[];
}

export const NOTIFICATION_EVENT_GROUPS: NotificationCategoryGroup[] = [
  {
    id: 'pos_sales',
    title: 'المبيعات ونقاط البيع (POS & Cart)',
    icon: 'ShoppingCart',
    color: 'emerald',
    events: [
      { key: 'pos_cash_sale', title: 'إتمام فاتورة بيع نقدي', defaultEnabled: true, category: 'pos_sales' },
      { key: 'pos_debt_sale', title: 'إتمام فاتورة بيع آجل / مركب', defaultEnabled: true, category: 'pos_sales' },
      { key: 'pos_deficit_applied', title: 'تطبيق عجز مسموح به في الصندوق', defaultEnabled: true, category: 'pos_sales' },
      { key: 'pos_surplus_applied', title: 'إضافة فارق الصرف كربح إضافي', defaultEnabled: true, category: 'pos_sales' },
      { key: 'pos_customer_required', title: 'تنبيه: اسم العميل مطلوب للبيع الآجل', defaultEnabled: true, category: 'pos_sales' },
      { key: 'pos_insufficient_stock', title: 'تنبيه: المخزون غير كافٍ للبيع', defaultEnabled: true, category: 'pos_sales' },
      { key: 'pos_send_to_printer', title: 'إرسال الفاتورة إلى الطابعة', defaultEnabled: true, category: 'pos_sales' },
      { key: 'pos_quick_customer_added', title: 'إضافة عميل سريع من الكاشير', defaultEnabled: true, category: 'pos_sales' },
    ],
  },
  {
    id: 'invoices_refunds',
    title: 'الفواتير والاسترداد والمرتجعات (Invoices & Refunds)',
    icon: 'FileText',
    color: 'orange',
    events: [
      { key: 'invoices_full_refund', title: 'استرداد كامل الفاتورة (مرتجع)', defaultEnabled: true, category: 'invoices_refunds' },
      { key: 'invoices_partial_refund', title: 'استرداد جزئي للفاتورة', defaultEnabled: true, category: 'invoices_refunds' },
      { key: 'invoices_debt_payment', title: 'تسجيل دفعة دين من الفاتورة', defaultEnabled: true, category: 'invoices_refunds' },
      { key: 'invoices_status_updated', title: 'تحديث حالة الفاتورة يدوياً', defaultEnabled: true, category: 'invoices_refunds' },
      // 19 و 20 معطلة افتراضياً
      { key: 'invoices_share_image_generating', title: 'توليد صورة الفاتورة للمشاركة', defaultEnabled: false, category: 'invoices_refunds' },
      { key: 'invoices_copied_clipboard', title: 'نسخ تفاصيل الفاتورة للحافظة', defaultEnabled: false, category: 'invoices_refunds' },
    ],
  },
  {
    id: 'debts_customers',
    title: 'الديون والعملاء (Debts & Customers)',
    icon: 'Users',
    color: 'amber',
    events: [
      { key: 'debts_payment_recorded', title: 'تسجيل دفعة دين نقدية', defaultEnabled: true, category: 'debts_customers' },
      { key: 'debts_new_added', title: 'إضافة دين نقدي جديد', defaultEnabled: true, category: 'debts_customers' },
      { key: 'debts_deleted', title: 'حذف سجل دين', defaultEnabled: true, category: 'debts_customers' },
      { key: 'customers_added', title: 'إضافة عميل جديد', defaultEnabled: true, category: 'debts_customers' },
      { key: 'customers_updated', title: 'تحديث بيانات عميل', defaultEnabled: true, category: 'debts_customers' },
      { key: 'customers_deleted', title: 'حذف عميل من النظام', defaultEnabled: true, category: 'debts_customers' },
    ],
  },
  {
    id: 'products_stock',
    title: 'المنتجات والمخزون والمشتريات (Products & Stock)',
    icon: 'Package',
    color: 'blue',
    events: [
      { key: 'products_added', title: 'إضافة منتج جديد', defaultEnabled: true, category: 'products_stock' },
      { key: 'products_updated', title: 'تعديل وحفظ بيانات منتج', defaultEnabled: true, category: 'products_stock' },
      { key: 'products_deleted', title: 'حذف منتج من النظام', defaultEnabled: true, category: 'products_stock' },
      { key: 'products_low_stock_warning', title: 'تنبيه اقتراب نفاد المخزون', defaultEnabled: true, category: 'products_stock' },
      { key: 'products_out_of_stock_alert', title: 'تنبيه نفاد المخزون بالكامل (صفر قطع)', defaultEnabled: true, category: 'products_stock' },
      { key: 'products_purchase_invoice', title: 'تسجيل فاتورة مشتريات بضاعة', defaultEnabled: true, category: 'products_stock' },
      { key: 'products_quick_purchase', title: 'شراء سريع لصنف فردي', defaultEnabled: true, category: 'products_stock' },
      { key: 'products_stock_audit', title: 'اعتماد جرد المخزون وفروقات الجرد', defaultEnabled: true, category: 'products_stock' },
      { key: 'products_damaged_recorded', title: 'تسجيل بضاعة تالفة / إتلاف', defaultEnabled: true, category: 'products_stock' },
    ],
  },
  {
    id: 'expenses_cashbox',
    title: 'المصاريف والورديات والصندوق (Cashbox & Shifts)',
    icon: 'DollarSign',
    color: 'rose',
    events: [
      { key: 'shifts_opened', title: 'فتح وردية كاشير جديدة', defaultEnabled: true, category: 'expenses_cashbox' },
      { key: 'shifts_closed', title: 'إغلاق وردية كاشير', defaultEnabled: true, category: 'expenses_cashbox' },
      { key: 'expenses_added', title: 'إضافة مصروف يومي من الكاش', defaultEnabled: true, category: 'expenses_cashbox' },
      { key: 'cashbox_movement', title: 'إيداع أو سحب نقدي يدوي بالصندوق', defaultEnabled: true, category: 'expenses_cashbox' },
      { key: 'expenses_recurring_scheduled', title: 'جدولة مصروف دوري متكرر', defaultEnabled: true, category: 'expenses_cashbox' },
      { key: 'expenses_recurring_autopay', title: 'سداد تلقائي لمصروف دوري', defaultEnabled: true, category: 'expenses_cashbox' },
    ],
  },
  {
    id: 'sync_backup',
    title: 'المزامنة السحابية والنسخ الاحتياطي (Sync & Backup)',
    icon: 'Cloud',
    color: 'sky',
    events: [
      // 48 و 49 معطلة افتراضياً
      { key: 'sync_completed_success', title: 'اكتمال المزامنة السحابية بنجاح', defaultEnabled: false, category: 'sync_backup' },
      { key: 'sync_offline_queued_warning', title: 'تنبيه: الفاتورة محفوظة محلياً (أوفلاين)', defaultEnabled: false, category: 'sync_backup' },
      { key: 'backup_local_exported', title: 'تصدير نسخة احتياطية محلية', defaultEnabled: true, category: 'sync_backup' },
      { key: 'backup_local_restored', title: 'استعادة نسخة احتياطية بنجاح', defaultEnabled: true, category: 'sync_backup' },
    ],
  },
  {
    id: 'settings_system',
    title: 'الإعدادات والمظهر والنظام (Settings & System)',
    icon: 'Sliders',
    color: 'purple',
    events: [
      { key: 'settings_store_saved', title: 'حفظ إعدادات المتجر وبيانات الفاتورة', defaultEnabled: true, category: 'settings_system' },
      { key: 'settings_rates_updated', title: 'تحديث وحفظ أسعار صرف العملات', defaultEnabled: true, category: 'settings_system' },
      { key: 'settings_appearance_saved', title: 'حفظ إعدادات المظهر والخطوط', defaultEnabled: true, category: 'settings_system' },
      { key: 'settings_demo_reset', title: 'تصفير ومسح البيانات التجريبية', defaultEnabled: true, category: 'settings_system' },
    ],
  },
];

/**
 * Returns default events dictionary with 19, 20, 48, 49 disabled by default
 */
export function getDefaultNotificationEvents(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const group of NOTIFICATION_EVENT_GROUPS) {
    for (const evt of group.events) {
      defaults[evt.key] = evt.defaultEnabled;
    }
  }
  return defaults;
}

const SETTINGS_KEY = 'hyperpos_settings_v1';

/**
 * Check if a specific notification event is allowed to show
 */
export function isNotificationEventAllowed(eventKey: string): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return true;
    const settings = JSON.parse(raw);
    const notifSettings = settings?.notificationSettings;

    // 1. Check master switch
    if (notifSettings?.masterEnabled === false) {
      return false;
    }

    // 2. Check event-specific switch
    const events = notifSettings?.events;
    if (events && typeof events === 'object') {
      if (events[eventKey] !== undefined) {
        return Boolean(events[eventKey]);
      }
    }

    // 3. Fallback to default state for this event
    const defaults = getDefaultNotificationEvents();
    if (defaults[eventKey] !== undefined) {
      return defaults[eventKey];
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Resolves an eventKey from notification text content (title/description)
 * Enables transparent gatekeeper filtering even for legacy calls.
 */
export function resolveEventKeyFromText(title?: string, description?: string): string | null {
  const full = `${title || ''} ${description || ''}`.toLowerCase();
  if (!full.trim()) return null;

  // 19. Generating share image
  if (full.includes('إنشاء صورة الفاتورة') || full.includes('generating invoice image') || full.includes('generating share image')) {
    return 'invoices_share_image_generating';
  }

  // 20. Clipboard copied
  if (full.includes('نسخ تفاصيل الفاتورة') || full.includes('invoice details copied') || full.includes('invoicecopied')) {
    return 'invoices_copied_clipboard';
  }

  // 48. Cloud sync completed
  if (
    full.includes('ترحيل بياناتك إلى السحابة') ||
    full.includes('تمت المزامنة بنجاح') ||
    full.includes('synced successfully') ||
    full.includes('syncedsuccess')
  ) {
    return 'sync_completed_success';
  }

  // 49. Offline invoice saved locally warning
  if (
    full.includes('حفظ فاتورة البيع المؤجل أوفلاين') ||
    (full.includes('فاتورة البيع') && full.includes('أوفلاين')) ||
    full.includes('offlinesalewarning')
  ) {
    return 'sync_offline_queued_warning';
  }

  // POS & Sales
  if (full.includes('إتمام عملية البيع') || full.includes('بيع نقدي') || full.includes('cash_sale')) {
    return 'pos_cash_sale';
  }
  if (full.includes('بيع آجل') || full.includes('بيع مركب') || full.includes('debt_sale')) {
    return 'pos_debt_sale';
  }
  if (full.includes('المخزون غير كافٍ') || full.includes('insufficient stock')) {
    return 'pos_insufficient_stock';
  }

  // Debts & Customers
  if (full.includes('تسجيل دفعة دين') || full.includes('سداد دين') || full.includes('payment received')) {
    return 'debts_payment_recorded';
  }
  if (full.includes('إضافة دين') || full.includes('دين جديد') || full.includes('new debt')) {
    return 'debts_new_added';
  }
  if (full.includes('إضافة عميل جديد') || full.includes('تمت إضافة العميل')) {
    return 'customers_added';
  }

  // Products & Stock
  if (full.includes('إضافة المنتج') || full.includes('تمت إضافة المنتج بنجاح')) {
    return 'products_added';
  }
  if (full.includes('تحديث المنتج') || full.includes('تم تعديل المنتج')) {
    return 'products_updated';
  }
  if (full.includes('حذف المنتج') || full.includes('تم حذف المنتج')) {
    return 'products_deleted';
  }
  if (full.includes('اقتراب نفاد المخزون') || full.includes('الحد الأدنى للمخزون') || full.includes('low stock')) {
    return 'products_low_stock_warning';
  }
  if (full.includes('نفاد المخزون بالكامل') || full.includes('الكمية صفر') || full.includes('out of stock')) {
    return 'products_out_of_stock_alert';
  }

  // Shifts & Expenses
  if (full.includes('فتح وردية') || full.includes('فتح الوردية')) {
    return 'shifts_opened';
  }
  if (full.includes('إغلاق وردية') || full.includes('إغلاق الوردية')) {
    return 'shifts_closed';
  }
  if (full.includes('إضافة مصروف') || full.includes('تسجيل مصروف') || full.includes('مصروف يومي')) {
    return 'expenses_added';
  }

  // Backups
  if (full.includes('تصدير نسخة احتياطية') || full.includes('تم تصدير النسخة')) {
    return 'backup_local_exported';
  }
  if (full.includes('استعادة نسخة احتياطية') || full.includes('تمت استعادة النسخة')) {
    return 'backup_local_restored';
  }

  // Settings
  if (full.includes('حفظ إعدادات المتجر') || full.includes('تم حفظ الإعدادات')) {
    return 'settings_store_saved';
  }
  if (full.includes('تحديث أسعار الصرف') || full.includes('أسعار صرف العملات')) {
    return 'settings_rates_updated';
  }
  if (full.includes('إعدادات المظهر') || full.includes('حفظ إعدادات المظهر')) {
    return 'settings_appearance_saved';
  }

  return null;
}
