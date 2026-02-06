/**
 * Cross-platform file download utility
 * Works on web browsers and Capacitor (Android/iOS)
 * Supports direct download to Downloads folder on Android
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface DownloadOptions {
  filename: string;
  content: string;
  mimeType?: string;
}

/**
 * Check if running on native platform (Android/iOS)
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Request storage permissions on Android
 */
const requestStoragePermissions = async (): Promise<boolean> => {
  try {
    // Check current permission status
    const { publicStorage } = await Filesystem.checkPermissions();

    if (publicStorage === 'granted') {
      return true;
    }

    // Request permissions
    const result = await Filesystem.requestPermissions();
    return result.publicStorage === 'granted';
  } catch (error) {
    console.log('[FileDownload] Permission check error:', error);
    // On newer Android versions, permissions might not be needed
    return true;
  }
};

/**
 * Download/save a file - works on both web and native
 */
export const downloadFile = async (options: DownloadOptions): Promise<boolean> => {
  const { filename, content, mimeType = 'application/json' } = options;

  try {
    if (isNativePlatform()) {
      // Native platform - use Filesystem API
      return await saveFileNative(filename, content, mimeType);
    } else {
      // Web browser - use traditional download
      return downloadFileWeb(filename, content, mimeType);
    }
  } catch (error) {
    console.error('Download error:', error);
    return false;
  }
};

/**
 * Save file on native platform - tries Downloads first, then fallbacks
 */
const saveFileNative = async (
  filename: string,
  content: string,
  mimeType: string
): Promise<boolean> => {
  try {
    // 1. Try Documents directory first (Preferred: Accessible without special permissions on Android 11+)
    try {
      const result = await Filesystem.writeFile({
        path: `HyperPOS/${filename}`,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });

      console.log('[FileDownload] Saved to Documents/HyperPOS:', result.uri);
      return true;
    } catch (documentsError) {
      console.warn('[FileDownload] Documents save failed, trying Downloads:', documentsError);
    }

    // 2. Try Downloads directory (External Storage)
    try {
      const result = await Filesystem.writeFile({
        path: `Download/${filename}`,
        data: content,
        directory: Directory.ExternalStorage,
        encoding: Encoding.UTF8,
        recursive: true,
      });

      console.log('[FileDownload] Saved to Downloads:', result.uri);
      return true;
    } catch (externalError) {
      console.warn('[FileDownload] ExternalStorage save failed:', externalError);
    }

    // 3. Fallback: Save to Cache and Open Share Dialog
    // This is the most reliable fallback if direct access is restricted
    const cacheResult = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    console.log('[FileDownload] Saved to Cache for sharing:', cacheResult.uri);

    await Share.share({
      title: filename,
      text: 'نسخة احتياطية من HyperPOS',
      url: cacheResult.uri,
      dialogTitle: 'حفظ النسخة الاحتياطية',
    });

    return true;
  } catch (error) {
    console.error('[FileDownload] All save methods failed:', error);
    return false;
  }
};

/**
 * Download file on web browser
 */
const downloadFileWeb = (
  filename: string,
  content: string,
  mimeType: string
): boolean => {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Web download error:', error);
    return false;
  }
};

/**
 * Download JSON data as a file
 */
export const downloadJSON = async (
  filename: string,
  data: object
): Promise<boolean> => {
  const content = JSON.stringify(data, null, 2);
  return downloadFile({
    filename,
    content,
    mimeType: 'application/json',
  });
};

/**
 * Download text content as a file
 */
export const downloadText = async (
  filename: string,
  content: string
): Promise<boolean> => {
  return downloadFile({
    filename,
    content,
    mimeType: 'text/plain;charset=utf-8',
  });
};

/**
 * Download CSV content as a file
 */
export const downloadCSV = async (
  filename: string,
  content: string
): Promise<boolean> => {
  // Add BOM for Excel compatibility with Arabic
  const BOM = '\uFEFF';
  return downloadFile({
    filename,
    content: BOM + content,
    mimeType: 'text/csv;charset=utf-8',
  });
};

/**
 * Get the default download directory path for display to user
 */
export const getDownloadPath = (): string => {
  if (isNativePlatform()) {
    return 'مجلد التنزيلات (Downloads)';
  }
  return 'مجلد التنزيلات';
};
