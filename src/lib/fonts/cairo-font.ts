// Noto Sans Arabic Font - for PDF export with proper Arabic RTL support
// This font has excellent Arabic character support and is well-optimized for PDFs

// Font loading approach for jsPDF Arabic support using Noto Sans Arabic
export const loadArabicFont = async (doc: any): Promise<void> => {
  // Try multiple font sources in order of preference
  const fontSources = [
    // jsDelivr - most reliable CDN for npm packages
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-arabic@5.0.6/files/noto-sans-arabic-arabic-400-normal.woff',
    // Unpkg fallback
    'https://unpkg.com/@fontsource/noto-sans-arabic@5.0.6/files/noto-sans-arabic-arabic-400-normal.woff',
    // Google Fonts CDN (may have version changes)
    'https://fonts.gstatic.com/s/notosansarabic/v28/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhEwv4raxts.woff2',
  ];

  let lastError: Error | null = null;

  for (const fontUrl of fontSources) {
    try {
      const response = await fetch(fontUrl, { 
        mode: 'cors',
        cache: 'force-cache' 
      });
      
      if (!response.ok) {
        continue; // Try next source
      }
      
      const fontBuffer = await response.arrayBuffer();
      const fontBase64 = btoa(
        new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      // Determine file extension from URL
      const isWoff = fontUrl.includes('.woff');
      const fileName = isWoff ? 'NotoSansArabic-Regular.woff' : 'NotoSansArabic-Regular.ttf';
      
      // Register font with jsPDF
      doc.addFileToVFS(fileName, fontBase64);
      doc.addFont(fileName, 'NotoSansArabic', 'normal');
      doc.setFont('NotoSansArabic');
      
      console.log('Arabic font loaded successfully from:', fontUrl);
      return;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Failed to load font from ${fontUrl}:`, error);
      continue; // Try next source
    }
  }

  // All sources failed
  console.warn('Could not load Noto Sans Arabic font from any source:', lastError);
  throw lastError || new Error('Failed to load Arabic font from all sources');
};

// Arabic font name constant for consistency
export const ARABIC_FONT_NAME = 'NotoSansArabic';

// Helper to check if Arabic font is available
export const isArabicFontLoaded = (doc: any): boolean => {
  try {
    const fonts = doc.getFontList();
    return ARABIC_FONT_NAME in fonts;
  } catch {
    return false;
  }
};
