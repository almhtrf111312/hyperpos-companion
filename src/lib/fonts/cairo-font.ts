// Noto Sans Arabic Font - for PDF export with proper Arabic RTL support
// This font has excellent Arabic character support and is well-optimized for PDFs

// Font loading approach for jsPDF Arabic support using Noto Sans Arabic
// IMPORTANT: jsPDF requires TTF format fonts - WOFF/WOFF2 will cause "No unicode cmap" errors
export const loadArabicFont = async (doc: any): Promise<void> => {
  // TTF font sources only - jsPDF does NOT support WOFF/WOFF2
  const fontSources = [
    // Noto Sans Arabic TTF from Google Fonts GitHub (most reliable)
    'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf',
    // Amiri font - excellent Arabic font (backup)
    'https://cdn.jsdelivr.net/gh/alif-type/amiri@master/Amiri-Regular.ttf',
    // Google Fonts CDN direct TTF link
    'https://fonts.gstatic.com/s/notosansarabic/v28/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlj4wv4rqxzLI.ttf',
  ];

  let lastError: Error | null = null;

  for (const fontUrl of fontSources) {
    try {
      console.log('Attempting to load Arabic font from:', fontUrl);
      
      const response = await fetch(fontUrl, { 
        mode: 'cors',
        cache: 'force-cache' 
      });
      
      if (!response.ok) {
        console.warn(`Font source returned ${response.status}:`, fontUrl);
        continue; // Try next source
      }
      
      const fontBuffer = await response.arrayBuffer();
      
      // Validate we got actual data
      if (fontBuffer.byteLength < 1000) {
        console.warn('Font file too small, likely invalid:', fontUrl);
        continue;
      }
      
      // Convert to Base64
      const fontBase64 = btoa(
        new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      // Must use .ttf extension for jsPDF to recognize the font format
      const fileName = 'NotoSansArabic-Regular.ttf';
      
      // Register font with jsPDF
      doc.addFileToVFS(fileName, fontBase64);
      doc.addFont(fileName, 'NotoSansArabic', 'normal');
      doc.setFont('NotoSansArabic');
      
      console.log('Arabic TTF font loaded successfully from:', fontUrl, '- Size:', fontBuffer.byteLength, 'bytes');
      return;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Failed to load font from ${fontUrl}:`, error);
      continue; // Try next source
    }
  }

  // All sources failed
  console.error('Could not load Arabic TTF font from any source:', lastError);
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
