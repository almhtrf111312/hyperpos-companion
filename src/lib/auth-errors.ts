/**
 * معالج وتنسيق رسائل أخطاء المصادقة والحسابات
 * يحول رسائل وأكواد أخطاء Supabase إلى رسائل واضحة ومحددة باللغة العربية
 */

export function getAuthErrorMessage(error: unknown, mode: 'login' | 'signup' = 'login'): string {
  if (!error) return 'حدث خطأ غير متوقع';

  const raw = typeof error === 'string'
    ? error
    : (error as { message?: string })?.message || (error as Error)?.message || '';
  
  const lower = raw.toLowerCase();

  // 1. فحص ضعف كلمة المرور
  if (
    lower.includes('weak') ||
    (lower.includes('password') && (
      lower.includes('least') ||
      lower.includes('short') ||
      lower.includes('characters') ||
      lower.includes('6') ||
      lower.includes('min')
    ))
  ) {
    return 'كلمة المرور ضعيفة (يجب أن تكون 6 أحرف على الأقل)';
  }

  // 2. فحص تكرار البريد الإلكتروني
  if (
    lower.includes('already registered') ||
    lower.includes('user already') ||
    lower.includes('already exists') ||
    lower.includes('duplicate key') ||
    lower.includes('email address is already registered')
  ) {
    return 'هذا البريد الإلكتروني مسجل مسبقاً';
  }

  // 3. فحص صيغة البريد الإلكتروني
  if (
    lower.includes('invalid email') ||
    lower.includes('email format') ||
    lower.includes('unable to validate email') ||
    lower.includes('valid email')
  ) {
    return 'صيغة البريد الإلكتروني غير صحيحة';
  }

  // 4. خطأ بيانات الدخول / كلمة المرور لحساب موجود
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_grant') ||
    lower.includes('invalid password') ||
    lower.includes('wrong password')
  ) {
    return 'كلمة المرور غير صحيحة لهذا الحساب';
  }

  // 5. تأكيد البريد الإلكتروني
  if (
    lower.includes('email not confirmed') ||
    lower.includes('not verified') ||
    lower.includes('confirm your email')
  ) {
    return 'البريد الإلكتروني لم يتم تأكيده بعد. يرجى مراجعة صندوق بريدك الوارد';
  }

  // 6. تجاوز حد المحاولات
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return 'تم تجاوز عدد المحاولات المسموح به. يرجى الانتظار دقيقة ثم المحاولة مجدداً';
  }

  // 7. مشاكل الشبكة والاتصال
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('connection refused')
  ) {
    return 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت';
  }

  // 8. عدم وجود الحساب
  if (lower.includes('user not found') || lower.includes('no user')) {
    return 'لا يوجد حساب مسجل بهذا البريد الإلكتروني';
  }

  return raw || (mode === 'login' ? 'فشل تسجيل الدخول' : 'فشل إنشاء الحساب');
}

/**
 * التحقق من صحة صيغة البريد الإلكتروني
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}
