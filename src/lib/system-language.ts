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
export function mapSystemLanguage(systemLang: string): 'ar' | 'en' {
  // Handle language codes with region (e.g., 'en-US', 'ar-SA')
  const baseLang = systemLang.split('-')[0].toLowerCase();
  
  // Map to supported languages
  if (baseLang === 'ar') return 'ar';
  return 'en'; // Default to English for all other languages
}

/**
 * Setup listener for system language changes
 * Triggers when app becomes active (e.g., returning from Settings)
 * @param callback - Function to call with new language
 */
export function setupSystemLanguageListener(callback: (lang: string) => void) {
  // Listen to app state changes (when user returns from Settings)
  App.addListener('appStateChange', async ({ isActive }) => {
    if (isActive) {
      const systemLang = await getSystemLanguage();
      const mappedLang = mapSystemLanguage(systemLang);
      callback(mappedLang);
    }
  });
}

/**
 * Initialize and get the appropriate language based on user preference
 * @param userPreference - User's saved preference ('auto', 'ar', 'en')
 * @returns Language to use
 */
export async function initializeLanguage(userPreference: string | null): Promise<'ar' | 'en'> {
  // If user wants auto-detection or has no preference
  if (!userPreference || userPreference === 'auto') {
    const systemLang = await getSystemLanguage();
    return mapSystemLanguage(systemLang);
  }
  
  // Use user's explicit preference
  return userPreference === 'en' ? 'en' : 'ar';
}
