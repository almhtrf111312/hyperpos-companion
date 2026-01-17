// Fix #19: Input Validation & Sanitization utilities
import { z } from 'zod';

// ====== Basic Sanitization ======

// Sanitize text input - remove potential XSS patterns
export const sanitizeText = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs (except images)
    .replace(/data:(?!image\/)[^;]+;/gi, '')
    // Encode HTML entities for remaining < and >
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

// Sanitize for display (lighter - just prevents script injection)
export const sanitizeForDisplay = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

// ====== Zod Schemas for Forms ======

// Product validation schema
export const productSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'اسم المنتج مطلوب')
    .max(100, 'اسم المنتج طويل جداً (الحد الأقصى 100 حرف)'),
  barcode: z.string()
    .trim()
    .min(1, 'الباركود مطلوب')
    .max(50, 'الباركود طويل جداً')
    .regex(/^[a-zA-Z0-9-_]+$/, 'الباركود يجب أن يحتوي على أحرف وأرقام فقط'),
  category: z.string()
    .trim()
    .min(1, 'التصنيف مطلوب')
    .max(50, 'التصنيف طويل جداً'),
  costPrice: z.number()
    .min(0, 'سعر الشراء يجب أن يكون 0 أو أكثر')
    .max(9999999, 'سعر الشراء كبير جداً'),
  salePrice: z.number()
    .min(0, 'سعر البيع يجب أن يكون 0 أو أكثر')
    .max(9999999, 'سعر البيع كبير جداً'),
  quantity: z.number()
    .int('الكمية يجب أن تكون رقماً صحيحاً')
    .min(0, 'الكمية يجب أن تكون 0 أو أكثر')
    .max(999999, 'الكمية كبيرة جداً'),
  minStockLevel: z.number()
    .int()
    .min(0)
    .max(999999)
    .optional(),
  expiryDate: z.string().optional(),
  image: z.string().optional(),
});

// Customer validation schema
export const customerSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'اسم العميل مطلوب')
    .max(100, 'اسم العميل طويل جداً'),
  phone: z.string()
    .trim()
    .max(20, 'رقم الهاتف طويل جداً')
    .regex(/^[0-9+\-\s]*$/, 'رقم الهاتف غير صالح')
    .optional()
    .or(z.literal('')),
  email: z.string()
    .trim()
    .email('البريد الإلكتروني غير صالح')
    .max(100, 'البريد الإلكتروني طويل جداً')
    .optional()
    .or(z.literal('')),
  address: z.string()
    .trim()
    .max(200, 'العنوان طويل جداً')
    .optional(),
});

// Invoice item validation
export const invoiceItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  price: z.number().min(0).max(9999999),
  quantity: z.number().int().min(1).max(999999),
});

// Invoice validation schema
export const invoiceSchema = z.object({
  customerName: z.string()
    .trim()
    .min(1, 'اسم العميل مطلوب')
    .max(100, 'اسم العميل طويل جداً'),
  customerPhone: z.string()
    .trim()
    .max(20)
    .regex(/^[0-9+\-\s]*$/, 'رقم الهاتف غير صالح')
    .optional()
    .or(z.literal('')),
  items: z.array(invoiceItemSchema).min(1, 'يجب إضافة منتج واحد على الأقل'),
  discount: z.number().min(0).max(9999999).optional(),
  paymentType: z.enum(['cash', 'debt']),
  serviceDescription: z.string().trim().max(500).optional(),
});

// Expense validation schema
export const expenseSchema = z.object({
  type: z.enum(['rent', 'utilities', 'wages', 'equipment', 'internet', 'electricity', 'other']),
  customType: z.string().trim().max(50).optional(),
  amount: z.number()
    .min(0.01, 'المبلغ يجب أن يكون أكبر من صفر')
    .max(9999999, 'المبلغ كبير جداً'),
  notes: z.string().trim().max(200, 'الملاحظات طويلة جداً').optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
});

// Partner validation schema
export const partnerSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'اسم الشريك مطلوب')
    .max(100, 'اسم الشريك طويل جداً'),
  phone: z.string()
    .trim()
    .min(1, 'رقم الهاتف مطلوب')
    .max(20, 'رقم الهاتف طويل جداً')
    .regex(/^[0-9+\-\s]+$/, 'رقم الهاتف غير صالح'),
  email: z.string()
    .trim()
    .email('البريد الإلكتروني غير صالح')
    .optional()
    .or(z.literal('')),
  sharePercentage: z.number()
    .min(0, 'النسبة يجب أن تكون 0 أو أكثر')
    .max(100, 'النسبة لا يمكن أن تتجاوز 100%'),
  initialCapital: z.number()
    .min(0, 'رأس المال يجب أن يكون 0 أو أكثر')
    .max(999999999, 'رأس المال كبير جداً'),
});

// ====== Validation Helper Functions ======

export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  errors: Record<string, string>;
};

export function validateProduct(data: unknown): ValidationResult<z.infer<typeof productSchema>> {
  const result = productSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach(err => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return { success: false, errors };
}

export function validateCustomer(data: unknown): ValidationResult<z.infer<typeof customerSchema>> {
  const result = customerSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach(err => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return { success: false, errors };
}

export function validateInvoice(data: unknown): ValidationResult<z.infer<typeof invoiceSchema>> {
  const result = invoiceSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach(err => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return { success: false, errors };
}

export function validateExpense(data: unknown): ValidationResult<z.infer<typeof expenseSchema>> {
  const result = expenseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach(err => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return { success: false, errors };
}

export function validatePartner(data: unknown): ValidationResult<z.infer<typeof partnerSchema>> {
  const result = partnerSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach(err => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return { success: false, errors };
}
