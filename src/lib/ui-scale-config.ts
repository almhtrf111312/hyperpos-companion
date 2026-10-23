/**
 * UI Scale Configuration Manager for FlowPOS Pro
 * 
 * Controls root document fontSize proportionally across the entire app
 * (Base 100% = 14px root fontSize).
 * 
 * Single Source of Truth for Root Font-Size Scaling.
 */

export type UIScaleId = '60' | '70' | '80' | '90' | '100' | '110' | '120';

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

import { getPlatformStoragePrefix } from '@/lib/app-font-config';

export function getUIScaleStorageKey(): string {
  return `flowpos_ui_scale_${getPlatformStoragePrefix()}`;
}

export const UI_SCALE_STORAGE_KEY = 'flowpos_ui_scale';
export const LEGACY_UI_SCALE_STORAGE_KEY = 'hyperpos_ui_scale';
export const DEFAULT_UI_SCALE_ID: UIScaleId = '60';
export const DEFAULT_UI_SCALE_PX = '8.4px';
export const UI_SCALE_CHANGED_EVENT = 'hyperpos:ui_scale_changed';

/**
 * Master mapping between UI scale identifiers and root document font-size in pixels.
 * Paired identically with the early-bootstrap script in index.html.
 */
export const UI_SCALE_MAP: Readonly<Record<UIScaleId, string>> = {
  '60': '8.4px',
  '70': '9.8px',
  '80': '11.2px',
  '90': '12.6px',
  '100': '14px',
  '110': '15.4px',
  '120': '16.8px',
} as const;

export const UI_SCALE_OPTIONS: readonly UIScaleOption[] = [
  {
    id: '60',
    percentage: 60,
    fontSizePx: UI_SCALE_MAP['60'],
    labelAr: 'الأصغر إطلاقاً (60%)',
    labelEn: 'Ultra Compact (60%)',
    badgeAr: 'أقصى كثافة',
    badgeEn: 'Ultra Density',
    descriptionAr: 'حجم مكثف جداً يمنح أقصى مساحة رؤية لكامل الجداول والفواتير على شاشات الموبايل',
    descriptionEn: 'Ultra compact scale offering maximum visible rows and panels on mobile displays',
  },
  {
    id: '70',
    percentage: 70,
    fontSizePx: UI_SCALE_MAP['70'],
    labelAr: 'مدمج جداً (70%)',
    labelEn: 'Super Compact (70%)',
    badgeAr: 'كثافة عالية',
    badgeEn: 'High Density',
    descriptionAr: 'حجم مدمج ومريح يعرض بيانات إضافية واسعة مع الحفاظ على وضوح القراءة',
    descriptionEn: 'Super compact scale fitting extensive data while maintaining comfortable reading',
  },
  {
    id: '80',
    percentage: 80,
    fontSizePx: UI_SCALE_MAP['80'],
    labelAr: 'صغير جداً (-20%)',
    labelEn: 'Extra Small (-20%)',
    badgeAr: 'أقصى اتساع',
    badgeEn: 'Max Space',
    descriptionAr: 'يُظهر أكبر قدر من البيانات والفواتير في الشاشة الواحدة، ممتاز للشاشات الصغيرة',
    descriptionEn: 'Shows maximum data and rows per screen, great for smaller displays',
  },
  {
    id: '90',
    percentage: 90,
    fontSizePx: UI_SCALE_MAP['90'],
    labelAr: 'صغير (-10%)',
    labelEn: 'Small (-10%)',
    badgeAr: 'مساحة إضافية',
    badgeEn: 'Extra Space',
    descriptionAr: 'حجم مدمج ومريح يعرض المزيد من العناصر مع الحفاظ على وضوح القراءة',
    descriptionEn: 'Compact and comfortable, fits more items while keeping great readability',
  },
  {
    id: '100',
    percentage: 100,
    fontSizePx: UI_SCALE_MAP['100'],
    labelAr: 'وسط / قياسي (100%)',
    labelEn: 'Standard / Balanced (100%)',
    badgeAr: 'الافتراضي القياسي',
    badgeEn: 'Default Standard',
    descriptionAr: 'المقياس الأساسي المعتمد في FlowPOS Pro، متناسق ومريح لجميع الأجهزة',
    descriptionEn: 'Default recommended scale for FlowPOS Pro, balanced for all screens',
  },
  {
    id: '110',
    percentage: 110,
    fontSizePx: UI_SCALE_MAP['110'],
    labelAr: 'كبير (+10%)',
    labelEn: 'Large (+10%)',
    badgeAr: 'قراءة مريحة',
    badgeEn: 'Easy Reading',
    descriptionAr: 'نصوص وعناصر أكبر حجماً لقراءة أسهل وأسرع على مسافة الكاشير',
    descriptionEn: 'Larger text and buttons for faster, easier reading at POS counter distance',
  },
  {
    id: '120',
    percentage: 120,
    fontSizePx: UI_SCALE_MAP['120'],
    labelAr: 'كبير جداً (+20%)',
    labelEn: 'Extra Large (+20%)',
    badgeAr: 'أقصى وضوح',
    badgeEn: 'Max Clarity',
    descriptionAr: 'أعلى مستوى تكبير للنصوص والأزرار، مثالي للشاشات البعيدة وضعاف البصر',
    descriptionEn: 'Highest scale level for buttons and text, ideal for distance and accessibility',
  },
] as const;

export function isValidUIScaleId(val: unknown): val is UIScaleId {
  return typeof val === 'string' && Object.prototype.hasOwnProperty.call(UI_SCALE_MAP, val);
}

export function getStoredUIScale(): UIScaleId {
  try {
    const platformKey = getUIScaleStorageKey();
    let stored = localStorage.getItem(platformKey);
    if (!stored) {
      stored = localStorage.getItem(LEGACY_UI_SCALE_STORAGE_KEY);
    }
    if (!stored) {
      const rawSettings = localStorage.getItem('hyperpos_settings_v1');
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        stored = parsed?.uiScale;
      }
    }
    if (stored) {
      stored = stored.trim().replace(/^['"]|['"]$/g, '');
    }
    if (isValidUIScaleId(stored)) {
      return stored;
    }
  } catch {
    // localStorage might be unavailable in restricted contexts
  }
  return DEFAULT_UI_SCALE_ID;
}

/**
 * Single authoritative DOM updater for UI scale.
 * Sets documentElement font-size in pixels and assigns data-ui-scale attribute.
 */
export function applyUIScaleToDOM(scaleId: UIScaleId): void {
  if (typeof document === 'undefined') return;
  const validId = isValidUIScaleId(scaleId) ? scaleId : DEFAULT_UI_SCALE_ID;
  const fontSizePx = UI_SCALE_MAP[validId] || DEFAULT_UI_SCALE_PX;
  document.documentElement.style.fontSize = fontSizePx;
  document.documentElement.setAttribute('data-ui-scale', validId);
  if (document.body) {
    document.body.setAttribute('data-ui-scale', validId);
  }
}

export function setStoredUIScale(scaleId: UIScaleId): void {
  if (!isValidUIScaleId(scaleId)) return;
  try {
    const platformKey = getUIScaleStorageKey();
    localStorage.setItem(platformKey, scaleId);
    localStorage.setItem(LEGACY_UI_SCALE_STORAGE_KEY, scaleId);
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
