export const EVENTS = {
  PRODUCTS_UPDATED: 'hyperpos:products-updated',
  CATEGORIES_UPDATED: 'hyperpos:categories-updated',
  CUSTOMERS_UPDATED: 'hyperpos:customers-updated',
  DEBTS_UPDATED: 'hyperpos:debts-updated',
  MAINTENANCE_UPDATED: 'hyperpos:maintenance-updated',
  INVOICES_UPDATED: 'hyperpos:invoices-updated',
  SETTINGS_UPDATED: 'hyperpos:settings-updated',
  PARTNERS_UPDATED: 'hyperpos:partners-updated',
  EXPENSES_UPDATED: 'hyperpos:expenses-updated',
  SERVICES_UPDATED: 'hyperpos:services-updated',
  RECURRING_EXPENSES_UPDATED: 'hyperpos:recurring-expenses-updated',
  ACTIVITY_LOG_UPDATED: 'hyperpos:activity-log-updated',
  CASHBOX_UPDATED: 'hyperpos:cashbox-updated',
  SHIFTS_UPDATED: 'hyperpos:shifts-updated',
  CAPITAL_UPDATED: 'hyperpos:capital-updated',
  CASH_SHIFTS_UPDATED: 'hyperpos:cash-shifts-updated',
};

export function emitEvent(name: string, detail?: any) {
  try {
    // CustomEvent to notify listeners in the same tab/window
    window.dispatchEvent(new CustomEvent(name, { detail }));
    // Emit a simple legacy event name (without prefix) for backward compatibility with existing listeners
    const legacy = name.replace(/^hyperpos:/, '');
    if (legacy) {
      window.dispatchEvent(new Event(legacy));
    }
  } catch {
    // ignore (server-side rendering or no window)
  }
}
