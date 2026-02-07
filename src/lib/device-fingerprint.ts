// Device Fingerprint Generator
// Creates a unique device identifier for device binding

const DEVICE_ID_KEY = 'hyperpos_device_id';

// Generate a unique fingerprint based on browser/device characteristics
const generateBrowserFingerprint = (): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let canvasHash = '';
  
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('FlowPOS Device ID', 2, 2);
    canvasHash = canvas.toDataURL().slice(-50);
  }

  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    canvasHash,
    // Add some randomness for first-time generation
    (() => { const a = new Uint8Array(8); crypto.getRandomValues(a); return Array.from(a).map(b => b.toString(36)).join(''); })(),
  ];

  // Create a hash from the components
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Convert to a readable format
  const timestamp = Date.now().toString(36);
  const hashStr = Math.abs(hash).toString(36);
  
  return `DEV-${timestamp}-${hashStr}`.toUpperCase();
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
    deviceId = generateBrowserFingerprint();
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
