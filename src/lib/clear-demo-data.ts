// Clear all demo/user data from localStorage
// This function clears products, invoices, debts, maintenance, and customers data

const STORAGE_KEYS_TO_CLEAR = [
  'hyperpos_products_v1',
  'hyperpos_invoices_v1', 
  'hyperpos_maintenance_v1',
  // Categories are kept as they're useful defaults
];

// Version key to track if data has been cleared
const CLEAR_VERSION_KEY = 'hyperpos_clear_version';
const CURRENT_CLEAR_VERSION = '2'; // Increment this to trigger a new clear

export const clearDemoDataOnce = () => {
  try {
    const clearedVersion = localStorage.getItem(CLEAR_VERSION_KEY);
    
    // Only clear if we haven't cleared this version yet
    if (clearedVersion !== CURRENT_CLEAR_VERSION) {
      STORAGE_KEYS_TO_CLEAR.forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Mark as cleared
      localStorage.setItem(CLEAR_VERSION_KEY, CURRENT_CLEAR_VERSION);
      console.log('Demo data cleared for version', CURRENT_CLEAR_VERSION);
    }
  } catch {
    // Ignore errors
  }
};

// Function to manually clear all data (can be called from settings)
export const clearAllUserData = () => {
  try {
    STORAGE_KEYS_TO_CLEAR.forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch {
    return false;
  }
};
