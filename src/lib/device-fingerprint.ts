// Device Fingerprint Generator
// Creates a unique device identifier for device binding

const DEVICE_ID_KEY = 'hyperpos_device_id';

// Generate a cryptographically secure device ID using UUID v4
const generateSecureDeviceId = (): string => {
  // Use crypto.randomUUID() for 128-bit cryptographic randomness (impossible to enumerate)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `DEV-${crypto.randomUUID()}`.toUpperCase();
  }
  // Fallback: generate UUID from crypto.getRandomValues
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set version 4 bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const uuid = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  return `DEV-${uuid}`.toUpperCase();
};

// Get or generate device ID
export const getDeviceId = async (): Promise<string> => {
  try {
    // First check if we have a stored device ID
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    
    if (deviceId) {
      return deviceId;
    }

    // Check if Capacitor Device plugin is available (for mobile)
    try {
      // Dynamic import to avoid build errors when Capacitor Device is not installed
      const CapacitorDevice = await import('@capacitor/core').then(m => (m as any).Device).catch(() => null);
      if (CapacitorDevice && typeof CapacitorDevice.getId === 'function') {
        const info = await CapacitorDevice.getId();
        if (info?.identifier) {
          deviceId = `CAP-${info.identifier}`;
          localStorage.setItem(DEVICE_ID_KEY, deviceId);
          return deviceId;
        }
      }
    } catch {
      // Capacitor not available, use browser fingerprint
    }

    // Generate browser fingerprint
    deviceId = generateSecureDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    // Fallback to a simple random ID
    const randBytes = new Uint8Array(8); crypto.getRandomValues(randBytes);
    const fallbackId = `FB-${Date.now()}-${Array.from(randBytes).map(b => b.toString(36)).join('')}`.toUpperCase();
    try {
      localStorage.setItem(DEVICE_ID_KEY, fallbackId);
    } catch {
      // Ignore storage errors
    }
    return fallbackId;
  }
};

// Clear stored device ID (for testing purposes only)
export const clearDeviceId = (): void => {
  try {
    localStorage.removeItem(DEVICE_ID_KEY);
  } catch {
    // Ignore errors
  }
};
