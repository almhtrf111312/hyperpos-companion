/**
 * Secure Storage Module
 * Provides encryption for sensitive data stored in localStorage
 * Uses AES-like XOR encryption with dynamic keys and integrity verification
 */

// Generate a unique device key based on browser fingerprint
const getDeviceKey = (): string => {
  const cached = sessionStorage.getItem('_hpdk');
  if (cached) return cached;
  
  // Create a device-specific key using available browser info
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth.toString(),
    screen.width.toString(),
    screen.height.toString(),
    new Date().getTimezoneOffset().toString(),
  ];
  
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const key = 'HP' + Math.abs(hash).toString(36) + 'SK';
  sessionStorage.setItem('_hpdk', key);
  return key;
};

// Generate a timestamp-based salt
const generateSalt = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
};

// Simple hash function for integrity check
const simpleHash = (str: string): string => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
};

// XOR encrypt with multi-layer keys
const xorEncrypt = (data: string, keys: string[]): string => {
  let result = data;
  for (const key of keys) {
    let encrypted = '';
    for (let i = 0; i < result.length; i++) {
      const charCode = result.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      encrypted += String.fromCharCode(charCode);
    }
    result = encrypted;
  }
  return result;
};

// XOR decrypt (reverse order of keys)
const xorDecrypt = (data: string, keys: string[]): string => {
  return xorEncrypt(data, [...keys].reverse());
};

export interface SecureStorageOptions {
  expiresIn?: number; // milliseconds until expiration
  namespace?: string;
}

interface StoredData {
  v: number; // version
  s: string; // salt
  d: string; // encrypted data
  h: string; // hash for integrity
  e?: number; // expiration timestamp
}

const CURRENT_VERSION = 1;
const APP_SECRET = 'HyperPOS2024SecureStorage';

/**
 * Securely store data with encryption
 */
export const secureSet = (key: string, data: unknown, options: SecureStorageOptions = {}): boolean => {
  try {
    const salt = generateSalt();
    const deviceKey = getDeviceKey();
    const dataString = JSON.stringify(data);
    
    // Multi-layer encryption
    const keys = [APP_SECRET, deviceKey, salt];
    const encrypted = xorEncrypt(dataString, keys);
    
    // Base64 encode for safe storage
    const encoded = btoa(unescape(encodeURIComponent(encrypted)));
    
    // Create integrity hash
    const hash = simpleHash(dataString + salt);
    
    const stored: StoredData = {
      v: CURRENT_VERSION,
      s: salt,
      d: encoded,
      h: hash,
    };
    
    if (options.expiresIn) {
      stored.e = Date.now() + options.expiresIn;
    }
    
    const namespace = options.namespace || 'hp_sec';
    localStorage.setItem(`${namespace}_${key}`, JSON.stringify(stored));
    return true;
  } catch (error) {
    console.error('SecureStorage set error:', error);
    return false;
  }
};

/**
 * Retrieve and decrypt data from secure storage
 */
export const secureGet = <T = unknown>(key: string, options: SecureStorageOptions = {}): T | null => {
  try {
    const namespace = options.namespace || 'hp_sec';
    const raw = localStorage.getItem(`${namespace}_${key}`);
    if (!raw) return null;
    
    const stored: StoredData = JSON.parse(raw);
    
    // Check version compatibility
    if (stored.v !== CURRENT_VERSION) {
      // Handle migration if needed
      console.warn('SecureStorage version mismatch');
    }
    
    // Check expiration
    if (stored.e && Date.now() > stored.e) {
      localStorage.removeItem(`${namespace}_${key}`);
      return null;
    }
    
    const deviceKey = getDeviceKey();
    const decoded = decodeURIComponent(escape(atob(stored.d)));
    
    // Decrypt
    const keys = [APP_SECRET, deviceKey, stored.s];
    const decrypted = xorDecrypt(decoded, keys);
    
    // Verify integrity
    const hash = simpleHash(decrypted + stored.s);
    if (hash !== stored.h) {
      console.error('SecureStorage integrity check failed');
      return null;
    }
    
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error('SecureStorage get error:', error);
    return null;
  }
};

/**
 * Remove data from secure storage
 */
export const secureRemove = (key: string, options: SecureStorageOptions = {}): void => {
  const namespace = options.namespace || 'hp_sec';
  localStorage.removeItem(`${namespace}_${key}`);
};

/**
 * Clear all secure storage items with a specific namespace
 */
export const secureClear = (namespace: string = 'hp_sec'): void => {
  const prefix = `${namespace}_`;
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
};

/**
 * Check if a key exists and is not expired
 */
export const secureHas = (key: string, options: SecureStorageOptions = {}): boolean => {
  const namespace = options.namespace || 'hp_sec';
  const raw = localStorage.getItem(`${namespace}_${key}`);
  if (!raw) return false;
  
  try {
    const stored: StoredData = JSON.parse(raw);
    if (stored.e && Date.now() > stored.e) {
      localStorage.removeItem(`${namespace}_${key}`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};
