/**
 * Simple XOR + Base64 encryption for HyperPOS backups
 * This provides basic obfuscation for backup files
 */

const ENCRYPTION_KEY = 'HyperPOS2024SecureBackup';
const BACKUP_PREFIX = 'HPBK_';

/**
 * Encrypt backup data using XOR cipher + Base64 encoding
 */
export const encryptBackup = (data: object): string => {
  try {
    const jsonString = JSON.stringify(data);
    let encrypted = '';
    
    for (let i = 0; i < jsonString.length; i++) {
      const charCode = jsonString.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      encrypted += String.fromCharCode(charCode);
    }
    
    // Convert to Base64 and add prefix for identification
    return BACKUP_PREFIX + btoa(unescape(encodeURIComponent(encrypted)));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('فشل في تشفير البيانات');
  }
};

/**
 * Decrypt backup data from XOR cipher + Base64 encoding
 */
export const decryptBackup = (encryptedData: string): object | null => {
  try {
    // Check if it's an encrypted backup file
    if (!isEncryptedBackup(encryptedData)) {
      console.error('Invalid backup format: missing prefix');
      return null;
    }
    
    // Remove prefix and decode Base64
    const base64Data = encryptedData.slice(BACKUP_PREFIX.length);
    const decoded = decodeURIComponent(escape(atob(base64Data)));
    
    // XOR decrypt
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      decrypted += String.fromCharCode(charCode);
    }
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

/**
 * Check if a string is an encrypted HyperPOS backup
 */
export const isEncryptedBackup = (data: string): boolean => {
  return data.startsWith(BACKUP_PREFIX);
};

/**
 * Get backup file extension
 */
export const getBackupFileExtension = (): string => {
  return '.hpbk';
};

/**
 * Get backup MIME type
 */
export const getBackupMimeType = (): string => {
  return 'application/octet-stream';
};
