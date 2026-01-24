// Noto Sans Arabic Font - for PDF export with proper Arabic RTL support
// This font has excellent Arabic character support and is well-optimized for PDFs

// Font loading approach for jsPDF Arabic support using Noto Sans Arabic
export const loadArabicFont = async (doc: any): Promise<void> => {
  try {
    // Load Noto Sans Arabic from Google Fonts CDN
    // Using Regular weight (400) for best readability
    const fontUrl = 'https://fonts.gstatic.com/s/notosansarabic/v28/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlj4wv4rqxzLI.ttf';
    
    const response = await fetch(fontUrl);
    if (!response.ok) {
      throw new Error('Failed to load Noto Sans Arabic font');
    }
    
    const fontBuffer = await response.arrayBuffer();
    const fontBase64 = btoa(
      new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    // Register font with jsPDF
    doc.addFileToVFS('NotoSansArabic-Regular.ttf', fontBase64);
    doc.addFont('NotoSansArabic-Regular.ttf', 'NotoSansArabic', 'normal');
    doc.setFont('NotoSansArabic');
    
    return;
  } catch (error) {
    console.warn('Could not load Noto Sans Arabic font, using fallback:', error);
    throw error;
  }
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
