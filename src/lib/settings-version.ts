/**
 * Settings Version Sync
 * =====================
 * Forces localStorage settings refresh when a new app version is deployed.
 * Increment SETTINGS_VERSION whenever you change default settings that must propagate.
 */

const SETTINGS_VERSION = 3;
const VERSION_KEY = 'hyperpos_settings_version';

// Keys to clear on version mismatch (stale config that should be refreshed)
const KEYS_TO_CLEAR = [
  'hyperpos_theme',
  'hyperpos_theme_settings',
  'hyperpos_product_fields_config',
  'hyperpos_custom_fields_config',
  'hyperpos_notification_settings',
  'hyperpos_print_settings',
  'hyperpos_store_type',
  'hyperpos_sync_settings',
  'setup_complete',
];

// Keys to NEVER clear (user session & critical data)
// These are preserved across version bumps:
// - sb-* (Supabase auth tokens)
// - hyperpos_products_*, hyperpos_customers_*, etc. (cached data)
// - hyperpos_product_form_temp (form persistence)
// - privacy_accepted, hyperpos_language

/**
 * Check if local settings version is outdated and clear stale keys if so.
 * Call once on app startup.
 */
export function checkSettingsVersion(): boolean {
  try {
    const localVersion = parseInt(localStorage.getItem(VERSION_KEY) || '0', 10);

    if (localVersion < SETTINGS_VERSION) {
      console.log(`[SettingsVersion] Upgrading from v${localVersion} to v${SETTINGS_VERSION}`);

      let cleared = 0;
      for (const key of KEYS_TO_CLEAR) {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          cleared++;
        }
      }

      localStorage.setItem(VERSION_KEY, String(SETTINGS_VERSION));
      console.log(`[SettingsVersion] Cleared ${cleared} stale keys`);
      return true; // settings were refreshed
    }

    return false; // no change needed
  } catch (e) {
    console.error('[SettingsVersion] Check failed:', e);
    return false;
  }
}
