/**
 * Cloud Backup System using Supabase Storage
 * Replaces Google Drive backup with built-in cloud storage
 */
import { supabase } from '@/integrations/supabase/client';
import { encryptBackup, decryptBackup } from './backup-encryption';
import { generateBackupData } from './auto-backup';

const BUCKET_NAME = 'backups';
const MAX_BACKUPS = 10;

export interface CloudBackupFile {
  name: string;
  path: string;
  size: number;
  createdAt: string;
}

/**
 * Get current user ID
 */
const getUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
};

/**
 * Upload encrypted backup to cloud storage
 */
export const uploadCloudBackup = async (data?: object): Promise<boolean> => {
  try {
    const userId = await getUserId();
    if (!userId) {
      console.error('Cloud backup: No authenticated user');
      return false;
    }

    const backupData = data || await generateBackupData();
    const encrypted = encryptBackup(backupData);
    const fileName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.hpbk`;
    const filePath = `${userId}/${fileName}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, new Blob([encrypted], { type: 'application/octet-stream' }), {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Cloud backup upload error:', error);
      return false;
    }

    // Auto-cleanup: keep only last MAX_BACKUPS
    await cleanupOldBackups(userId);

    return true;
  } catch (error) {
    console.error('Cloud backup failed:', error);
    return false;
  }
};

/**
 * List all cloud backups for current user
 */
export const listCloudBackups = async (): Promise<CloudBackupFile[]> => {
  try {
    const userId = await getUserId();
    if (!userId) return [];

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId, {
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error || !data) return [];

    return data
      .filter(f => f.name.endsWith('.hpbk'))
      .map(f => ({
        name: f.name,
        path: `${userId}/${f.name}`,
        size: f.metadata?.size || 0,
        createdAt: f.created_at || '',
      }));
  } catch {
    return [];
  }
};

/**
 * Download and decrypt a cloud backup
 */
export const downloadCloudBackup = async (path: string): Promise<object | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(path);

    if (error || !data) {
      console.error('Cloud backup download error:', error);
      return null;
    }

    const text = await data.text();
    return decryptBackup(text);
  } catch (error) {
    console.error('Cloud backup download failed:', error);
    return null;
  }
};

/**
 * Delete a cloud backup
 */
export const deleteCloudBackup = async (path: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    return !error;
  } catch {
    return false;
  }
};

/**
 * Cleanup old backups, keeping only the most recent MAX_BACKUPS
 */
const cleanupOldBackups = async (userId: string): Promise<void> => {
  try {
    const { data } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId, {
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (!data || data.length <= MAX_BACKUPS) return;

    const toDelete = data
      .filter(f => f.name.endsWith('.hpbk'))
      .slice(MAX_BACKUPS)
      .map(f => `${userId}/${f.name}`);

    if (toDelete.length > 0) {
      await supabase.storage.from(BUCKET_NAME).remove(toDelete);
    }
  } catch {
    // Silent cleanup failure
  }
};

/**
 * Format file size for display
 */
export const formatBackupSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};
