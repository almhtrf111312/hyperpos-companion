import { Device } from '@capacitor/device';
import { App } from '@capacitor/app';

/**
 * Get the current system language code
 * @returns Language code (e.g., 'ar', 'en', 'en-US')
 */
export async function getSystemLanguage(): Promise<string> {
  try {
    const info = await Device.getLanguageCode();
    return info.value; // Returns language code like 'ar', 'en', etc.
  } catch (error) {
    console.error('Failed to get system language:', error);
    return 'ar'; // Default fallback to Arabic
  }
}

/**
 * Map system language codes to app-supported languages
 * @param systemLang - System language code
 * @returns Mapped language code ('ar' or 'en')
 */
export function mapSystemLanguage(systemLang: string): 'ar' | 'en' | 'tr' | 'fa' | 'ku' {
  if (!systemLang) return 'ar';
  // Handle language codes with region (e.g., 'en-US', 'ar-SA')
  const baseLang = systemLang.split('-')[0].toLowerCase();
  
  // Map to supported languages
  if (baseLang === 'ar') return 'ar';
  if (baseLang === 'en') return 'en';
  if (baseLang === 'tr') return 'tr';
  if (baseLang === 'fa') return 'fa';
  if (baseLang === 'ku' || baseLang === 'ckb') return 'ku';
  return 'ar'; // Default to Arabic for FlowPOS
}

/**
 * Setup listener for system language changes
 * Triggers when app becomes active (e.g., returning from Settings)
 * @param callback - Function to call with new language
 */
export function setupSystemLanguageListener(callback: (lang: string) => void) {
  let lastMapped: string | null = null;
  App.addListener('appStateChange', async ({ isActive }) => {
    if (!isActive) return;
    const systemLang = await getSystemLanguage();
    const mappedLang = mapSystemLanguage(systemLang);
    if (mappedLang === lastMapped) return;
    lastMapped = mappedLang;
    callback(mappedLang);
  });
}

/**
 * Initialize and get the appropriate language based on user preference
 * @param userPreference - User's saved preference
 * @returns Language to use - Defaults strictly to 'ar' on first launch
 */
export async function initializeLanguage(userPreference: string | null): Promise<'ar' | 'en' | 'tr' | 'fa' | 'ku'> {
  // Use user's explicit preference if valid
  const validLangs = ['ar', 'en', 'tr', 'fa', 'ku'] as const;
  if (userPreference && validLangs.includes(userPreference as any)) {
    return userPreference as any;
  }
  
  // Default is ALWAYS Arabic on first launch / no preference
  return 'ar';
}
