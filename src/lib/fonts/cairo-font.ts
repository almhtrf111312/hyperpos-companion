// Noto Sans Arabic Font - for PDF export with proper Arabic RTL support
// IMPORTANT: jsPDF requires TTF fonts. WOFF/WOFF2 will cause "No unicode cmap" or glyph issues.

export const ARABIC_FONT_NAME = 'NotoSansArabic';

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  // Avoid stack issues with huge buffers by using a loop.
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const fetchFontAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
  if (!response.ok) throw new Error(`Font fetch failed (${response.status}): ${url}`);
  const buf = await response.arrayBuffer();
  if (buf.byteLength < 1000) throw new Error(`Font file too small: ${url}`);
  return arrayBufferToBase64(buf);
};

// Loads Arabic fonts into jsPDF (normal + bold) and sets default to normal.
export const loadArabicFont = async (doc: any): Promise<void> => {
  const regularSources = [
    // Google Fonts repo (reliable)
    'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf',
    // Google Fonts direct (fallback)
    'https://fonts.gstatic.com/s/notosansarabic/v28/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlj4wv4rqxzLI.ttf',
    // Amiri fallback
    'https://cdn.jsdelivr.net/gh/alif-type/amiri@master/Amiri-Regular.ttf',
  ];

  const boldSources = [
    'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansArabic/NotoSansArabic-Bold.ttf',
    'https://cdn.jsdelivr.net/gh/alif-type/amiri@master/Amiri-Bold.ttf',
  ];

  let lastError: Error | null = null;

  // 1) Load Regular (required)
  for (const url of regularSources) {
    try {
      console.log('Attempting to load Arabic regular font from:', url);
      const base64 = await fetchFontAsBase64(url);
      const fileName = 'NotoSansArabic-Regular.ttf';
      doc.addFileToVFS(fileName, base64);
      doc.addFont(fileName, ARABIC_FONT_NAME, 'normal');
      doc.setFont(ARABIC_FONT_NAME, 'normal');
      console.log('Arabic regular font loaded successfully from:', url);
      lastError = null;
      break;
    } catch (e) {
      lastError = e as Error;
      console.warn('Arabic regular font source failed:', url, e);
    }
  }

  if (lastError) {
    console.error('Could not load Arabic regular font from any source:', lastError);
    throw lastError;
  }

  // 2) Load Bold (optional but strongly recommended)
  for (const url of boldSources) {
    try {
      console.log('Attempting to load Arabic bold font from:', url);
      const base64 = await fetchFontAsBase64(url);
      const fileName = 'NotoSansArabic-Bold.ttf';
      doc.addFileToVFS(fileName, base64);
      doc.addFont(fileName, ARABIC_FONT_NAME, 'bold');
      console.log('Arabic bold font loaded successfully from:', url);
      break;
    } catch (e) {
      console.warn('Arabic bold font source failed:', url, e);
    }
  }
};

// Helper to check if Arabic font is available
export const isArabicFontLoaded = (doc: any): boolean => {
  try {
    const fonts = doc.getFontList?.();
    return !!fonts && ARABIC_FONT_NAME in fonts;
  } catch {
    return false;
  }
};

export const isArabicBoldFontLoaded = (doc: any): boolean => {
  try {
    const fonts = doc.getFontList?.();
    const styles = fonts?.[ARABIC_FONT_NAME];
    return Array.isArray(styles) && styles.includes('bold');
  } catch {
    return false;
  }
};
