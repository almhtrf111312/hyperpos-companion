export type AppFontId = 'cairo' | 'tajawal' | 'ibm-plex' | 'almarai' | 'readex';

export interface AppFontOption {
  id: AppFontId;
  name: string;
  nameAr: string;
  badgeAr?: string;
  descriptionAr: string;
  descriptionEn: string;
  cssFamily: string;
  previewClass: string;
}

export const APP_FONT_STORAGE_KEY = 'hyperpos_app_font';
export const DEFAULT_APP_FONT_ID: AppFontId = 'cairo';
export const APP_FONT_CHANGED_EVENT = 'hyperpos:app_font_changed';

export const APP_FONTS: readonly AppFontOption[] = [
  {
    id: 'cairo',
    name: 'Cairo',
    nameAr: 'كايرو',
    badgeAr: 'الافتراضي القياسي',
    descriptionAr: 'هندسي وعصري، يوفر أعلى درجات الوضوح لقوائم الأسعار والمبيعات اليومية',
    descriptionEn: 'Geometric and modern, default standard for POS and sales displays',
    cssFamily: "'Cairo', sans-serif",
    previewClass: 'font-preview-cairo',
  },
  {
    id: 'tajawal',
    name: 'Tajawal',
    nameAr: 'تجوّل',
    badgeAr: 'مريح للعين',
    descriptionAr: 'انسيابي ومريح جداً للقراءة المكثفة وشاشات الهواتف والأجهزة اللوحية',
    descriptionEn: 'Smooth, readable and very comfortable for long hours of mobile work',
    cssFamily: "'Tajawal', sans-serif",
    previewClass: 'font-preview-tajawal',
  },
  {
    id: 'ibm-plex',
    name: 'IBM Plex Sans Arabic',
    nameAr: 'آي بي إم بليكس',
    badgeAr: 'مالي واحترافي',
    descriptionAr: 'طابع مؤسسي دقيق، مثالي للمحاسبة والفواتير التفصيلية والتقارير المالية',
    descriptionEn: 'Corporate precision, excellent for accounting, detailed invoices and reports',
    cssFamily: "'IBM Plex Sans Arabic', sans-serif",
    previewClass: 'font-preview-ibm-plex',
  },
  {
    id: 'almarai',
    name: 'Almarai',
    nameAr: 'المراعي',
    badgeAr: 'أنيق ونظامي',
    descriptionAr: 'أنيق وبسيط، يحاكي واجهات أنظمة الهواتف الحديثة (iOS / Android Native)',
    descriptionEn: 'Clean and elegant, feels like native smartphone system typography',
    cssFamily: "'Almarai', sans-serif",
    previewClass: 'font-preview-almarai',
  },
  {
    id: 'readex',
    name: 'Readex Pro',
    nameAr: 'ريديكس برو',
    badgeAr: 'شاشات صغيرة وقابلية قراءة',
    descriptionAr: 'صُمم خصيصاً لقابلية القراءة الفائقة في المساحات الضيقة والشاشات الصغيرة',
    descriptionEn: 'Engineered for extreme readability on dense and compact screens',
    cssFamily: "'Readex Pro', sans-serif",
    previewClass: 'font-preview-readex',
  },
] as const;

export function isValidAppFontId(val: unknown): val is AppFontId {
  return typeof val === 'string' && APP_FONTS.some((f) => f.id === val);
}

export function getStoredAppFont(): AppFontId {
  try {
    let stored = localStorage.getItem(APP_FONT_STORAGE_KEY);
    if (stored) {
      stored = stored.trim().replace(/^['"]|['"]$/g, '');
    }
    if (isValidAppFontId(stored)) {
      return stored;
    }
  } catch {
    // localStorage might be unavailable
  }
  return DEFAULT_APP_FONT_ID;
}

export function applyAppFontToDOM(fontId: AppFontId): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-font', fontId);
  if (document.body) {
    document.body.setAttribute('data-font', fontId);
  }
}

export function setStoredAppFont(fontId: AppFontId): void {
  if (!isValidAppFontId(fontId)) return;
  try {
    localStorage.setItem(APP_FONT_STORAGE_KEY, fontId);
  } catch {
    // ignore
  }
  applyAppFontToDOM(fontId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APP_FONT_CHANGED_EVENT, { detail: { fontId } }));
  }
}

// Auto-apply font to DOM immediately upon module import
if (typeof document !== 'undefined') {
  applyAppFontToDOM(getStoredAppFont());
}
