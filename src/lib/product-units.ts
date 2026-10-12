import { getCurrentLanguage, Language } from '@/lib/i18n';

/**
 * الكلمات الدلالية للوحدات الفردية (قطعة، حبة، وحدة...) بمختلف اللغات وتنسيقات الإكسل وقواعد البيانات
 */
const PIECE_KEYWORDS = new Set([
  'pc',
  'pcs',
  'piece',
  'pieces',
  'unit',
  'units',
  'item',
  'items',
  'قطعة',
  'قطعه',
  'قطع',
  'حبة',
  'حبه',
  'حبوب',
  'وحدة',
  'وحدات',
  'عنصر',
  'adet',
  'tane',
  'parça',
  'parca',
  'عدد',
  'تکه',
  'دانه',
  'دانە',
]);

/**
 * الكلمات الدلالية للوحدات الكبرى (كرتونة، كرتون، صندوق، طرد...)
 */
const BULK_KEYWORDS = new Set([
  'carton',
  'cartons',
  'karton',
  'ctn',
  'case',
  'cases',
  'كرتونة',
  'كرتونه',
  'كرتون',
  'كراتين',
  'صندوق',
  'صناديق',
  'طرد',
  'طرود',
  'koli',
  'کارتن',
  'کارتۆن',
  'کارتون',
  'سندووق',
]);

const BOX_KEYWORDS = new Set([
  'box',
  'boxes',
  'علبة',
  'علبه',
  'علب',
  'kutu',
  'جعبه',
  'قوتوو',
]);

const PACK_KEYWORDS = new Set([
  'pack',
  'packs',
  'package',
  'packages',
  'باكيت',
  'باكيتات',
  'باقة',
  'paket',
  'بسته',
  'پاکەت',
]);

const KG_KEYWORDS = new Set([
  'kg',
  'kgs',
  'kilogram',
  'kilograms',
  'كغ',
  'كيلو',
  'كيلوغرام',
  'كغم',
]);

const GRAM_KEYWORDS = new Set(['g', 'gram', 'grams', 'غرام', 'غم', 'گرم']);
const LITER_KEYWORDS = new Set(['l', 'liter', 'liters', 'litre', 'لتر', 'لیتر']);
const METER_KEYWORDS = new Set(['m', 'meter', 'meters', 'metre', 'متر', 'مەتر']);

/**
 * يتحقق مما إذا كانت الوحدة المعطاة تمثل "قطعة" أو وحدة فردية
 */
export function isPieceUnit(rawUnit?: string | null): boolean {
  if (!rawUnit) return false;
  const normalized = rawUnit.trim().toLowerCase();
  return (
    PIECE_KEYWORDS.has(normalized) ||
    normalized.startsWith('قطعة') ||
    normalized.startsWith('حبة') ||
    normalized.startsWith('piece')
  );
}

/**
 * يتحقق مما إذا كانت الوحدة المعطاة تمثل "كرتونة" أو وحدة كبرى
 */
export function isBulkUnit(rawUnit?: string | null): boolean {
  if (!rawUnit) return false;
  const normalized = rawUnit.trim().toLowerCase();
  return (
    BULK_KEYWORDS.has(normalized) ||
    normalized.startsWith('كرتون') ||
    normalized.startsWith('carton') ||
    normalized.startsWith('koli')
  );
}

export interface LocalizeUnitOptions {
  count?: number;
  short?: boolean;
}

/**
 * توحيد وترجمة اسم الوحدة ديناميكياً بناءً على لغة التطبيق الحالية:
 * - إذا كانت اللغة عربية: تظهر دائماً "قطعة" (أو كرتونة / علبة / كغ...) حتى لو كانت مسجلة في قاعدة البيانات بـ "pc" أو "piece".
 * - إذا كانت اللغة إنجليزية: تظهر دائماً بالإنجليزية "pc" أو "Carton" حتى لو كانت مسجلة بالعربية "قطعة".
 * - إذا كانت لغة أخرى (تركية، كردية، فارسية): تترجم بدقة للغة المقابلة.
 * - الوحدات المخصصة غير المعيارية تظهر كما أدخلها المستخدم.
 */
export function getLocalizedUnit(
  rawUnit?: string | null,
  isBulk: boolean = false,
  language?: Language,
  options?: LocalizeUnitOptions
): string {
  const currentLang = language || getCurrentLanguage();
  const raw = rawUnit?.trim();
  const normalized = raw?.toLowerCase();
  const count = options?.count;
  const isMultiple = count !== undefined && count > 1;

  // 1. حالة عدم توفر اسم وحدة: استخدام الافتراضي حسب نوع الوحدة واللغة
  if (!raw) {
    if (isBulk) {
      return getStandardBulkName(currentLang, isMultiple);
    }
    return getStandardPieceName(currentLang, isMultiple, options?.short);
  }

  // 2. فحص وتوحيد وحدة القطعة
  if (
    PIECE_KEYWORDS.has(normalized!) ||
    normalized!.startsWith('قطعة') ||
    normalized!.startsWith('حبة') ||
    normalized!.startsWith('piece') ||
    (!isBulk && (normalized === 'pc' || normalized === 'pcs' || normalized === 'unit'))
  ) {
    return getStandardPieceName(currentLang, isMultiple, options?.short);
  }

  // 3. فحص وتوحيد وحدة الكرتونة / الجملة
  if (
    BULK_KEYWORDS.has(normalized!) ||
    normalized!.startsWith('كرتون') ||
    normalized!.startsWith('carton') ||
    normalized!.startsWith('koli') ||
    (isBulk && !BOX_KEYWORDS.has(normalized!) && !PACK_KEYWORDS.has(normalized!))
  ) {
    return getStandardBulkName(currentLang, isMultiple);
  }

  // 4. فحص وتوحيد علبة (Box)
  if (BOX_KEYWORDS.has(normalized!)) {
    switch (currentLang) {
      case 'ar':
        return isMultiple ? 'علب' : 'علبة';
      case 'en':
        return isMultiple ? 'boxes' : 'box';
      case 'tr':
        return 'kutu';
      case 'fa':
        return 'جعبه';
      case 'ku':
        return 'قوتوو';
      default:
        return 'علبة';
    }
  }

  // 5. فحص وتوحيد باكيت (Pack)
  if (PACK_KEYWORDS.has(normalized!)) {
    switch (currentLang) {
      case 'ar':
        return isMultiple ? 'باكيتات' : 'باكيت';
      case 'en':
        return isMultiple ? 'packs' : 'pack';
      case 'tr':
        return 'paket';
      case 'fa':
        return 'بسته';
      case 'ku':
        return 'پاکەت';
      default:
        return 'باكيت';
    }
  }

  // 6. فحص وتوحيد الكيلوغرام
  if (KG_KEYWORDS.has(normalized!)) {
    switch (currentLang) {
      case 'ar':
        return 'كغ';
      case 'en':
        return 'kg';
      case 'tr':
        return 'kg';
      case 'fa':
        return 'کیلو';
      case 'ku':
        return 'کگم';
      default:
        return 'كغ';
    }
  }

  // 7. فحص وتوحيد الغرام
  if (GRAM_KEYWORDS.has(normalized!)) {
    switch (currentLang) {
      case 'ar':
        return 'غرام';
      case 'en':
        return 'g';
      case 'tr':
        return 'g';
      case 'fa':
        return 'گرم';
      case 'ku':
        return 'گرام';
      default:
        return 'غرام';
    }
  }

  // 8. فحص وتوحيد اللتر
  if (LITER_KEYWORDS.has(normalized!)) {
    switch (currentLang) {
      case 'ar':
        return 'لتر';
      case 'en':
        return 'L';
      case 'tr':
        return 'L';
      case 'fa':
        return 'لیتر';
      case 'ku':
        return 'لیتر';
      default:
        return 'لتر';
    }
  }

  // 9. فحص وتوحيد المتر
  if (METER_KEYWORDS.has(normalized!)) {
    switch (currentLang) {
      case 'ar':
        return 'متر';
      case 'en':
        return 'm';
      case 'tr':
        return 'm';
      case 'fa':
        return 'متر';
      case 'ku':
        return 'مەتر';
      default:
        return 'متر';
    }
  }

  // إذا كانت وحدة مخصصة أخرى يدخلها المستخدم، تُعرض كما هي
  return raw;
}

function getStandardPieceName(
  lang: Language,
  isMultiple: boolean,
  short: boolean = true
): string {
  switch (lang) {
    case 'ar':
      return 'قطعة';
    case 'en':
      if (short) {
        return isMultiple ? 'pcs' : 'pc';
      }
      return isMultiple ? 'pieces' : 'piece';
    case 'tr':
      return 'adet';
    case 'fa':
      return 'عدد';
    case 'ku':
      return 'دانە';
    default:
      return 'قطعة';
  }
}

function getStandardBulkName(lang: Language, isMultiple: boolean): string {
  switch (lang) {
    case 'ar':
      return isMultiple ? 'كراتين' : 'كرتونة';
    case 'en':
      return isMultiple ? 'Cartons' : 'Carton';
    case 'tr':
      return 'koli';
    case 'fa':
      return 'کارتن';
    case 'ku':
      return 'کارتۆن';
    default:
      return 'كرتونة';
  }
}
