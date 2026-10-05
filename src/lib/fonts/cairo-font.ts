// Noto Sans Arabic Font - for PDF export with proper Arabic RTL support
// IMPORTANT: jsPDF requires TTF fonts. WOFF/WOFF2 will cause "No unicode cmap" or glyph issues.

export const ARABIC_FONT_NAME = 'NotoSansArabic';

// Memory cache for font base64 data to avoid repeated downloads and enable instant offline use
let cachedRegularBase64: string | null = null;
let cachedBoldBase64: string | null = null;

const STORAGE_KEY_REGULAR = 'hyperpos_font_noto_reg_v1';
const STORAGE_KEY_BOLD = 'hyperpos_font_noto_bold_v1';

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.length;
  // Process in chunks to prevent potential call stack overflow with large arrays
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
};

const fetchFontAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Font fetch failed (${response.status}): ${url}`);
  const buf = await response.arrayBuffer();
  if (buf.byteLength < 1000) throw new Error(`Font file too small: ${url}`);
  return arrayBufferToBase64(buf);
};

// Loads Arabic fonts into jsPDF (normal + bold) and sets default to normal.
// Includes offline local caching in memory and localStorage for resilience when offline on mobile/desktop.
export const loadArabicFont = async (doc: any): Promise<void> => {
  // 1) Load Regular font
  if (!cachedRegularBase64) {
    // Check localStorage cache first (offline fast-path)
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REGULAR);
      if (stored && stored.length > 5000) {
        cachedRegularBase64 = stored;
      }
    } catch {
      // localStorage may fail in restricted webview, proceed to fetch
    }
  }

  const regularSources = [
    // Local public bundled font (100% offline support in web & Capacitor app)
    '/fonts/NotoSansArabic-Regular.ttf',
    'fonts/NotoSansArabic-Regular.ttf',
    // Google Fonts CDN repo (reliable online fallback)
    'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf',
    // Google Fonts direct fallback
    'https://fonts.gstatic.com/s/notosansarabic/v28/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlj4wv4rqxzLI.ttf',
    // Amiri fallback
    'https://cdn.jsdelivr.net/gh/alif-type/amiri@master/Amiri-Regular.ttf',
  ];

  const boldSources = [
    // Local public bundled font
    '/fonts/NotoSansArabic-Bold.ttf',
    'fonts/NotoSansArabic-Bold.ttf',
    // CDN fallbacks
    'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansArabic/NotoSansArabic-Bold.ttf',
    'https://cdn.jsdelivr.net/gh/alif-type/amiri@master/Amiri-Bold.ttf',
  ];

  let lastError: Error | null = null;

  if (cachedRegularBase64) {
    const fileName = 'NotoSansArabic-Regular.ttf';
    doc.addFileToVFS(fileName, cachedRegularBase64);
    doc.addFont(fileName, ARABIC_FONT_NAME, 'normal');
    doc.setFont(ARABIC_FONT_NAME, 'normal');
  } else {
    for (const url of regularSources) {
      try {
        const base64 = await fetchFontAsBase64(url);
        const fileName = 'NotoSansArabic-Regular.ttf';
        doc.addFileToVFS(fileName, base64);
        doc.addFont(fileName, ARABIC_FONT_NAME, 'normal');
        doc.setFont(ARABIC_FONT_NAME, 'normal');
        cachedRegularBase64 = base64;
        try {
          localStorage.setItem(STORAGE_KEY_REGULAR, base64);
        } catch {
          // Ignore quota exceed
        }
        lastError = null;
        break;
      } catch (e) {
        lastError = e as Error;
      }
    }

    if (lastError && !cachedRegularBase64) {
      console.error('Could not load Arabic regular font from any source:', lastError);
      throw lastError;
    }
  }

  // 2) Load Bold font (optional but recommended)
  if (cachedBoldBase64) {
    const fileName = 'NotoSansArabic-Bold.ttf';
    doc.addFileToVFS(fileName, cachedBoldBase64);
    doc.addFont(fileName, ARABIC_FONT_NAME, 'bold');
  } else {
    try {
      const storedBold = localStorage.getItem(STORAGE_KEY_BOLD);
      if (storedBold && storedBold.length > 5000) {
        cachedBoldBase64 = storedBold;
        const fileName = 'NotoSansArabic-Bold.ttf';
        doc.addFileToVFS(fileName, cachedBoldBase64);
        doc.addFont(fileName, ARABIC_FONT_NAME, 'bold');
        return;
      }
    } catch {
      // ignore
    }

    for (const url of boldSources) {
      try {
        const base64 = await fetchFontAsBase64(url);
        const fileName = 'NotoSansArabic-Bold.ttf';
        doc.addFileToVFS(fileName, base64);
        doc.addFont(fileName, ARABIC_FONT_NAME, 'bold');
        cachedBoldBase64 = base64;
        try {
          localStorage.setItem(STORAGE_KEY_BOLD, base64);
        } catch {
          // ignore
        }
        break;
      } catch {
        // Bold is optional
      }
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
