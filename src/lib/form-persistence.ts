// Form state persistence for Android camera memory issues
// Saves form data before camera capture and restores it if app reloads

const FORM_STATE_KEY = 'hyperpos_form_state';
const MAX_AGE_MS = 3600000; // 1 hour

export interface FormStateEntry<T = unknown> {
  data: T;
  timestamp: number;
}

/**
 * Save form state before actions that might cause app reload (like camera)
 */
export function saveFormState<T>(formKey: string, data: T): void {
  try {
    const saved = JSON.parse(localStorage.getItem(FORM_STATE_KEY) || '{}');
    saved[formKey] = { 
      data, 
      timestamp: Date.now() 
    };
    localStorage.setItem(FORM_STATE_KEY, JSON.stringify(saved));
  } catch (e) {
    console.error('Failed to save form state:', e);
  }
}

/**
 * Load saved form state if it exists and is not expired
 */
export function loadFormState<T>(formKey: string): T | null {
  try {
    const saved = JSON.parse(localStorage.getItem(FORM_STATE_KEY) || '{}');
    const entry = saved[formKey] as FormStateEntry<T> | undefined;
    
    if (!entry) return null;
    
    // Check if data is expired (older than 1 hour)
    if (Date.now() - entry.timestamp > MAX_AGE_MS) {
      clearFormState(formKey);
      return null;
    }
    
    return entry.data;
  } catch (e) {
    console.error('Failed to load form state:', e);
    return null;
  }
}

/**
 * Clear saved form state after successful save
 */
export function clearFormState(formKey: string): void {
  try {
    const saved = JSON.parse(localStorage.getItem(FORM_STATE_KEY) || '{}');
    delete saved[formKey];
    localStorage.setItem(FORM_STATE_KEY, JSON.stringify(saved));
  } catch (e) {
    console.error('Failed to clear form state:', e);
  }
}

/**
 * Check if there's a pending form state to restore
 */
export function hasPendingFormState(formKey: string): boolean {
  return loadFormState(formKey) !== null;
}
