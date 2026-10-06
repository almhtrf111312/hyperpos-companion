/**
 * UI Scale Configuration Manager for FlowPOS Pro
 * 
 * Controls root document fontSize proportionally across the entire app
 * (Base 100% = 14px root fontSize).
 */

export type UIScaleId = '80' | '90' | '100' | '110' | '120';

export interface UIScaleOption {
  id: UIScaleId;
  percentage: number;
  fontSizePx: string;
  labelAr: string;
  labelEn: string;
  badgeAr: string;
  badgeEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export const UI_SCALE_STORAGE_KEY = 'hyperpos_ui_scale';
export const DEFAULT_UI_SCALE_ID: UIScaleId = '100';
export const UI_SCALE_CHANGED_EVENT = 'hyperpos:ui_scale_changed';

export const UI_SCALE_OPTIONS: readonly UIScaleOption[] = [
  {
    id: '80',
    percentage: 80,
    fontSizePx: '11.2px',
    labelAr: 'مدمج جداً (-20%)',
    labelEn: 'Ultra Compact (-20%)',
    badgeAr: 'أقصى اتساع',
    badgeEn: 'Max Space',
    descriptionAr: 'يُظهر أكبر قدر من البيانات والفواتير في الشاشة الواحدة، ممتاز للشاشات الصغيرة',
    descriptionEn: 'Shows maximum data and rows per screen, great for smaller displays',
  },
  {
    id: '90',
    percentage: 90,
    fontSizePx: '12.6px',
    labelAr: 'مدمج (-10%)',
    labelEn: 'Compact (-10%)',
    badgeAr: 'مساحة إضافية',
    badgeEn: 'Extra Space',
    descriptionAr: 'حجم مدمج ومريح يعرض المزيد من العناصر مع الحفاظ على وضوح القراءة',
    descriptionEn: 'Compact and comfortable, fits more items while keeping great readability',
  },
  {
    id: '100',
    percentage: 100,
    fontSizePx: '14px',
    labelAr: 'متوازن / قياسي (100%)',
    labelEn: 'Standard / Balanced (100%)',
    badgeAr: 'الافتراضي القياسي',
    badgeEn: 'Default Standard',
    descriptionAr: 'المقياس الأساسي المعتمد في FlowPOS Pro، متناسق ومريح لجميع الأجهزة',
    descriptionEn: 'Default recommended scale for FlowPOS Pro, balanced for all screens',
  },
  {
    id: '110',
    percentage: 110,
    fontSizePx: '15.4px',
    labelAr: 'مكبر (+10%)',
    labelEn: 'Enlarged (+10%)',
    badgeAr: 'قراءة مريحة',
    badgeEn: 'Easy Reading',
    descriptionAr: 'نصوص وعناصر أكبر حجماً لقراءة أسهل وأسرع على مسافة الكاشير',
    descriptionEn: 'Larger text and buttons for faster, easier reading at POS counter distance',
  },
  {
    id: '120',
    percentage: 120,
    fontSizePx: '16.8px',
    labelAr: 'كبير جداً (+20%)',
    labelEn: 'Extra Large (+20%)',
    badgeAr: 'أقصى وضوح',
    badgeEn: 'Max Clarity',
    descriptionAr: 'أعلى مستوى تكبير للنصوص والأزرار، مثالي للشاشات البعيدة وضعاف البصر',
    descriptionEn: 'Highest scale level for buttons and text, ideal for distance and accessibility',
  },
] as const;

export function isValidUIScaleId(val: unknown): val is UIScaleId {
  return typeof val === 'string' && UI_SCALE_OPTIONS.some((o) => o.id === val);
}

export function getStoredUIScale(): UIScaleId {
  try {
    let stored = localStorage.getItem(UI_SCALE_STORAGE_KEY);
    if (stored) {
      stored = stored.trim().replace(/^['"]|['"]$/g, '');
    }
    if (isValidUIScaleId(stored)) {
      return stored;
    }
  } catch {
    // localStorage might be unavailable
  }
  return DEFAULT_UI_SCALE_ID;
}

export function applyUIScaleToDOM(scaleId: UIScaleId): void {
  if (typeof document === 'undefined') return;
  const option = UI_SCALE_OPTIONS.find((o) => o.id === scaleId) || UI_SCALE_OPTIONS[2];
  document.documentElement.style.fontSize = option.fontSizePx;
  document.documentElement.setAttribute('data-ui-scale', scaleId);
  if (document.body) {
    document.body.setAttribute('data-ui-scale', scaleId);
  }
}

export function setStoredUIScale(scaleId: UIScaleId): void {
  if (!isValidUIScaleId(scaleId)) return;
  try {
    localStorage.setItem(UI_SCALE_STORAGE_KEY, scaleId);
  } catch {
    // ignore
  }
  applyUIScaleToDOM(scaleId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(UI_SCALE_CHANGED_EVENT, { detail: { scaleId } })
    );
  }
}
