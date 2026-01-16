/**
 * Cross-platform file download utility
 * Works on web browsers and Capacitor (Android/iOS)
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
 * Save file on native platform and share it
 */
const saveFileNative = async (
  filename: string,
  content: string,
  mimeType: string
): Promise<boolean> => {
  try {
    // Save file to cache directory first
    const result = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    console.log('File saved to:', result.uri);

    // Get the file URI for sharing
    const fileUri = result.uri;

    // Use Share API to let user save/share the file
    await Share.share({
      title: filename,
      text: 'نسخة احتياطية من HyperPOS',
      url: fileUri,
      dialogTitle: 'حفظ النسخة الاحتياطية',
    });

    return true;
  } catch (error) {
    console.error('Native save error:', error);
    
    // Fallback: try to save to Documents directory
    try {
      await Filesystem.writeFile({
        path: `HyperPOS/${filename}`,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      
      return true;
    } catch (fallbackError) {
      console.error('Fallback save error:', fallbackError);
      return false;
    }
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
