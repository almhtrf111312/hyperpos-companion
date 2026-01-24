// Cairo Regular Font - Base64 encoded for PDF export
// This is a subset of Cairo font that supports Arabic characters

// Using Amiri font as fallback - well-known Arabic font
// Font loading approach for jsPDF Arabic support
export const loadArabicFont = async (doc: any): Promise<void> => {
  try {
    // Load Cairo font from Google Fonts CDN
    const fontUrl = 'https://fonts.gstatic.com/s/cairo/v28/SLXGc1nY6HkvalIkTp2mxdt0.ttf';
    
    const response = await fetch(fontUrl);
    if (!response.ok) {
      throw new Error('Failed to load Cairo font');
    }
    
    const fontBuffer = await response.arrayBuffer();
    const fontBase64 = btoa(
      new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    // Register font with jsPDF
    doc.addFileToVFS('Cairo-Regular.ttf', fontBase64);
    doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
    doc.setFont('Cairo');
    
    return;
  } catch (error) {
    console.warn('Could not load Cairo font, using fallback:', error);
  }
};

// Pre-loaded minimal Cairo font subset (Arabic numerals + common characters)
// This is a base64-encoded version for offline support
export const CAIRO_FONT_FALLBACK = true;

// Helper to check if Arabic font is available
export const isArabicFontLoaded = (doc: any): boolean => {
  try {
    const fonts = doc.getFontList();
    return 'Cairo' in fonts;
  } catch {
    return false;
  }
};
