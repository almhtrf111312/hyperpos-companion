/**
 * Flow POS Pro - Error Radar Service
 * رادار الأخطاء المركزي - خدمة تسجيل وتشخيص أخطاء التطبيق مع دعم التخزين والإرسال دون اتصال
 * 
 * المبادئ الأساسية:
 * 1. حماية تامة للخصوصية: لا يتم حفظ كلمات مرور، رموز مصادقة، محتوى حقول، أو بيانات دفع.
 * 2. عدم التأثير على الأداء: التسجيل خفيف، آمن، ولا يعطل حركة البيع أو شاشات POS نهائياً.
 * 3. العمل في وضع عدم الاتصال (Offline-First): تخزين محلي مشفر مع تدوير دوري وحماية من التكرار المفرط.
 * 4. المزامنة الذكية الآمنة: معرّف ثابت لكل سجل، إرسال تدريجي عند عودة الاتصال، وحذف من الطابور فقط بعد تأكيد الخادم.
 */

import { secureSet, secureGet, secureRemove } from './secure-storage';
import { supabase } from '@/integrations/supabase/client';

export type ErrorRadarType = 
  | 'react_boundary'
  | 'uncaught_error'
  | 'unhandled_rejection'
  | 'diagnostic';

export type ErrorRadarSeverity = 'critical' | 'error' | 'warning' | 'info';

export type ErrorSyncStatus = 'local_only' | 'pending' | 'sending' | 'synced' | 'failed';

export interface ErrorRadarBreadcrumb {
  timestamp: string;
  category: 'ui' | 'navigation' | 'network' | 'sync';
  action: string;
}

export interface ErrorRadarDeviceMetadata {
  platform: 'web' | 'android' | 'ios';
  screen: string;
  isOnline: boolean;
  language: string;
}

export interface ErrorRadarLog {
  id: string;
  fingerprint: string;
  type: ErrorRadarType;
  severity: ErrorRadarSeverity;
  message: string;
  stack?: string;
  componentStack?: string;
  route: string;
  device: ErrorRadarDeviceMetadata;
  userRole: 'boss' | 'admin' | 'cashier' | 'anonymous';
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  isResolved: boolean;
  resolvedAt?: string;
  breadcrumbs?: ErrorRadarBreadcrumb[];
  metadata?: Record<string, unknown>;
  syncStatus?: ErrorSyncStatus;
  syncedAt?: string;
  syncError?: string;
  retryCount?: number;
}

export interface QueuedErrorRadarLog extends ErrorRadarLog {
  syncStatus: ErrorSyncStatus;
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: string;
  syncedAt?: string;
  syncError?: string;
}

// ثوابت التهيئة والتخزين المحلي
const STORAGE_KEY = 'radar_error_logs';
const STORAGE_NAMESPACE = 'hp_radar';
const FALLBACK_STORAGE_KEY = 'hyperpos_error_radar_v1';

// ثوابت طابور المزامنة الأوفلاين المنعزل
const QUEUE_STORAGE_KEY = 'radar_sync_queue';
const FALLBACK_QUEUE_KEY = 'hyperpos_radar_queue_v1';

// حدود التخزين والتدوير
const MAX_LOGS = 100; // حد أقصى لسجلات الأرشيف المحلي
const MAX_QUEUE_ITEMS = 50; // سقف أقصى لطابور المزامنة
const MAX_BREADCRUMBS = 10; // حد أقصى للإجراءات الأخيرة
const DEDUPLICATION_WINDOW_MS = 10000; // نافذة 10 ثوانٍ لمنع تكرار نفس الخطأ
const MAX_RETRIES = 5; // أقصى عدد محاولات إرسال لكل خطأ
const MAX_LOG_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 أيام مدة الصلاحية القصوى للسجل بالطابور
const DISPATCH_BATCH_SIZE = 3; // إرسال تدريجي على دفعات صغيرة
const DISPATCH_DELAY_MS = 600; // تأخير 600ms بين كل سجل وآخر لعدم إجهاد الشبكة

// ذاكرة الإجراءات المؤقتة (Circular Buffer)
const recentBreadcrumbs: ErrorRadarBreadcrumb[] = [];

// مستمعو الأحداث لتحديث الواجهة فور حدوث خطأ جديد
type RadarListener = (logs: ErrorRadarLog[]) => void;
const listeners = new Set<RadarListener>();

/**
 * فلترة وتطهير البيانات الحساسة من النصوص والرسائل (Privacy Scrubber)
 * يضمن عدم تسريب كلمات المرور، التوكنات، البريد الإلكتروني، أو أرقام البطاقات
 */
export function scrubSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    // إخفاء رموز JWT
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[TOKEN_REDACTED]')
    // إخفاء رؤوس Bearer
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, 'Bearer [TOKEN_REDACTED]')
    // إخفاء حقول كلمات المرور والرموز السرية
    .replace(/(password|passwd|pwd|secret|token|apikey|api_key|auth_token)\s*[:=]\s*["']?[^"'\s,}&]+/gi, '$1=[REDACTED]')
    // إخفاء عناوين البريد الإلكتروني
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
    // إخفاء أرقام البطاقات وأرقام الحسابات (تسلسل 13-19 رقم)
    .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{1,7}\b/g, '[CARD_REDACTED]')
    // إخفاء أرقام الهواتف الدولية والمحلية
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE_REDACTED]');
}

/**
 * تنظيف المسار وإزالة أي معاملات استعلام حساسة (Query Params Scrubber)
 */
export function sanitizeRoute(rawRoute?: string): string {
  try {
    const route = rawRoute || (typeof window !== 'undefined' ? (window.location.hash || window.location.pathname) : '/');
    // إزالة معلمات الاستعلام الحساسة كرموز التفعيل والتوكنات
    const [path] = route.split('?');
    return path.substring(0, 100);
  } catch {
    return '/';
  }
}

/**
 * استخراج نوع المنصة الحالية
 */
function getPlatform(): 'web' | 'android' | 'ios' {
  if (typeof window === 'undefined') return 'web';
  const isCapacitor = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  const ua = navigator.userAgent || '';
  if (isCapacitor) {
    return /android/i.test(ua) ? 'android' : 'ios';
  }
  return 'web';
}

/**
 * جمع معلومات بيئة الجهاز بدون أي تفاصيل شخصية
 */
function getDeviceMetadata(): ErrorRadarDeviceMetadata {
  return {
    platform: getPlatform(),
    screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '0x0',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    language: typeof navigator !== 'undefined' ? (navigator.language || 'ar') : 'ar',
  };
}

/**
 * جلب دور المستخدم الحالي من الكاش المحلي الآمن دون قراءة أي بيانات شخصية
 */
function getCurrentUserRole(): 'boss' | 'admin' | 'cashier' | 'anonymous' {
  try {
    const cached = secureGet<{ role: string }>('user_role_cache', { namespace: 'hp_rc' });
    if (cached?.role === 'boss' || cached?.role === 'admin' || cached?.role === 'cashier') {
      return cached.role;
    }
  } catch {
    // ignore
  }
  return 'anonymous';
}

/**
 * إنشاء بصمة سريعة للخطأ لمنع الفيضانات والتكرار (Fingerprint Generator)
 */
function generateFingerprint(type: string, message: string, route: string): string {
  const normalized = `${type}:${message.slice(0, 120)}:${route}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * إضافة إجراء إلى شريط الأحداث الأخيرة (Breadcrumbs)
 */
export function addBreadcrumb(category: ErrorRadarBreadcrumb['category'], action: string): void {
  try {
    const cleanAction = scrubSensitiveData(action).slice(0, 80);
    recentBreadcrumbs.push({
      timestamp: new Date().toISOString(),
      category,
      action: cleanAction,
    });
    if (recentBreadcrumbs.length > MAX_BREADCRUMBS) {
      recentBreadcrumbs.shift();
    }
  } catch {
    // Non-blocking
  }
}

// ─── إدارة التخزين المحلي للأرشيف وطابور الإرسال ─────────────────────────────

/**
 * جلب جميع سجلات رادار الأخطاء من الأرشيف المحلي الآمن
 */
export function getErrorRadarLogs(): ErrorRadarLog[] {
  try {
    const logs = secureGet<ErrorRadarLog[]>(STORAGE_KEY, { namespace: STORAGE_NAMESPACE });
    if (logs && Array.isArray(logs)) {
      return logs;
    }

    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[ErrorRadar] Failed to load error logs:', err);
  }
  return [];
}

/**
 * حفظ سجلات رادار الأخطاء في الأرشيف المحلي
 */
function saveErrorRadarLogs(logs: ErrorRadarLog[]): void {
  try {
    const trimmed = logs.slice(0, MAX_LOGS);
    const success = secureSet(STORAGE_KEY, trimmed, { namespace: STORAGE_NAMESPACE });
    if (!success) {
      localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(trimmed));
    }
    // إشعار جميع المشتركين بالواجهة
    listeners.forEach(fn => {
      try { fn(trimmed); } catch {}
    });
  } catch (err) {
    console.warn('[ErrorRadar] Failed to save error logs:', err);
  }
}

/**
 * جلب طابور الإرسال المحلي (Outbound Queue)
 */
export function loadErrorRadarQueue(): QueuedErrorRadarLog[] {
  try {
    const queue = secureGet<QueuedErrorRadarLog[]>(QUEUE_STORAGE_KEY, { namespace: STORAGE_NAMESPACE });
    if (queue && Array.isArray(queue)) {
      return queue;
    }

    const raw = localStorage.getItem(FALLBACK_QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[ErrorRadar] Failed to load error queue:', err);
  }
  return [];
}

/**
 * حفظ طابور الإرسال المحلي
 */
function saveErrorRadarQueue(queue: QueuedErrorRadarLog[]): void {
  try {
    const trimmed = queue.slice(0, MAX_QUEUE_ITEMS);
    const success = secureSet(QUEUE_STORAGE_KEY, trimmed, { namespace: STORAGE_NAMESPACE });
    if (!success) {
      localStorage.setItem(FALLBACK_QUEUE_KEY, JSON.stringify(trimmed));
    }
  } catch (err) {
    console.warn('[ErrorRadar] Failed to save error queue:', err);
  }
}

/**
 * إضافة سجل لطابور الإرسال
 */
function enqueueErrorRadarLog(log: ErrorRadarLog): void {
  try {
    const queue = loadErrorRadarQueue();
    // التحقق من عدم وجود نفس المعرف الثابت مسبقاً
    if (queue.some(item => item.id === log.id)) {
      return;
    }

    const queuedItem: QueuedErrorRadarLog = {
      ...log,
      syncStatus: 'pending',
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    };

    queue.push(queuedItem);

    // تدوير الطابور إذا تجاوز الحد الأقصى
    while (queue.length > MAX_QUEUE_ITEMS) {
      queue.shift();
    }

    saveErrorRadarQueue(queue);
  } catch (err) {
    console.warn('[ErrorRadar] Failed to enqueue error log:', err);
  }
}

/**
 * حذف سجل من طابور الإرسال (يُستدعى حصراً بعد تأكيد استلام الخادم)
 */
function dequeueErrorRadarItem(id: string): void {
  try {
    const queue = loadErrorRadarQueue().filter(item => item.id !== id);
    saveErrorRadarQueue(queue);
  } catch (err) {
    console.warn('[ErrorRadar] Failed to dequeue item:', err);
  }
}

/**
 * تحديث عنصر داخل طابور الإرسال (عند فشل محاولة)
 */
function updateErrorRadarQueueItem(updatedItem: QueuedErrorRadarLog): void {
  try {
    const queue = loadErrorRadarQueue();
    const index = queue.findIndex(item => item.id === updatedItem.id);
    if (index !== -1) {
      queue[index] = updatedItem;
      saveErrorRadarQueue(queue);
    }
  } catch (err) {
    console.warn('[ErrorRadar] Failed to update queue item:', err);
  }
}

/**
 * تحديث حالة المزامنة لسجل في الأرشيف المحلي ليظهر للـ Boss بدقة
 */
function updateLogSyncStatusInArchive(
  id: string,
  syncStatus: ErrorSyncStatus,
  syncedAt?: string,
  syncError?: string
): void {
  try {
    const logs = getErrorRadarLogs();
    const log = logs.find(l => l.id === id);
    if (log) {
      log.syncStatus = syncStatus;
      if (syncedAt) log.syncedAt = syncedAt;
      if (syncError) log.syncError = syncError;
      saveErrorRadarLogs(logs);
    }
  } catch {
    // Non-blocking
  }
}

// ─── الإرسال التدريجي والمزامنة عبر الشبكة (Smart Dispatcher) ─────────────────

interface SendResult {
  success: boolean;
  serverConfirmed: boolean;
  error?: string;
  isTerminal?: boolean;
}

/**
 * إرسال سجل فردي للخادم والتحقق الصارم من استلامه
 * لا يتم اعتبار السجل مرسلاً إلا إذا أكد الخادم استلامه بنجاح
 */
async function sendErrorLogToServer(log: QueuedErrorRadarLog): Promise<SendResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, serverConfirmed: false, error: 'Network offline' };
  }

  try {
    // محاولة الإرسال لجدول error_logs في حال تم نشره على Supabase
    // نستخدم client_error_id كمعرف ثابت يمنع التكرار تماماً (Idempotency Key)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, status } = await (supabase as any)
      .from('error_logs')
      .insert({
        client_error_id: log.id,
        fingerprint: log.fingerprint,
        error_type: log.type,
        severity: log.severity,
        message: log.message,
        stack_trace: log.stack || null,
        component_stack: log.componentStack || null,
        route: log.route,
        device_info: log.device,
        user_role: log.userRole,
        occurrences: log.occurrences,
        first_seen_at: log.firstSeenAt,
        last_seen_at: log.lastSeenAt,
        breadcrumbs: log.breadcrumbs || [],
      });

    // تأكيد استلام الخادم برمز نجاح
    if (!error && (status === 200 || status === 201)) {
      return { success: true, serverConfirmed: true };
    }

    // إذا كان الجدول غير موجود على الخادم بعد (PostgREST code 42P01 أو PGRST204)
    if (error?.code === '42P01' || error?.code === 'PGRST204' || error?.message?.includes('does not exist')) {
      return {
        success: false,
        serverConfirmed: false,
        error: 'Table error_logs not deployed on server yet',
        isTerminal: true,
      };
    }

    return {
      success: false,
      serverConfirmed: false,
      error: error?.message || 'Server did not confirm receipt',
    };
  } catch (err: any) {
    return {
      success: false,
      serverConfirmed: false,
      error: err?.message || 'Network dispatch exception',
    };
  }
}

// مؤشر لمنع تداخل عمليات الإرسال
let isFlushingQueue = false;

/**
 * معالجة طابور رادار الأخطاء وإرساله تدريجياً عبر الشبكة
 * - يُرسل السجلات دفعة تلو الأخرى دون إجهاد الاتصال.
 * - لا يحذف أي سجل محلي إلا بعد تأكيد الخادم الرسمي.
 * - لا يظهر أي رسائل تضليلية للمستخدم العادي.
 */
export async function flushErrorRadarQueue(): Promise<{
  processed: number;
  synced: number;
  failed: number;
}> {
  if (isFlushingQueue) {
    return { processed: 0, synced: 0, failed: 0 };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, synced: 0, failed: 0 };
  }

  isFlushingQueue = true;
  let processed = 0;
  let synced = 0;
  let failed = 0;

  try {
    const queue = loadErrorRadarQueue();
    if (queue.length === 0) {
      isFlushingQueue = false;
      return { processed: 0, synced: 0, failed: 0 };
    }

    // استبعاد السجلات القديمة المنتهية الصلاحية (أكثر من 7 أيام أو استنفدت المحاولات)
    const now = Date.now();
    const activeItems = queue.filter(item => {
      const age = now - new Date(item.firstSeenAt).getTime();
      return age < MAX_LOG_AGE_MS && item.retryCount < item.maxRetries;
    });

    // اختيار دفعة صغيرة للإرسال التدريجي
    const batch = activeItems
      .filter(item => item.syncStatus !== 'synced')
      .slice(0, DISPATCH_BATCH_SIZE);

    for (const item of batch) {
      processed++;
      item.syncStatus = 'sending';
      item.lastAttemptAt = new Date().toISOString();
      item.retryCount += 1;

      const result = await sendErrorLogToServer(item);

      if (result.serverConfirmed) {
        synced++;
        item.syncStatus = 'synced';
        item.syncedAt = new Date().toISOString();
        
        // حذف السجل من الطابور المحلي حصراً بعد تأكيد نجاح الإرسال
        dequeueErrorRadarItem(item.id);
        updateLogSyncStatusInArchive(item.id, 'synced', item.syncedAt);
      } else {
        failed++;
        item.syncStatus = result.isTerminal ? 'failed' : 'pending';
        item.syncError = result.error;
        
        // إبقاء السجل في الطابور للمحاولات اللاحقة
        updateErrorRadarQueueItem(item);
        updateLogSyncStatusInArchive(item.id, item.syncStatus, undefined, result.error);

        // إذا كان الخطأ جذرياً (مثل عدم وجود الجدول)، نتوقف عن الإرسال لحين توافر الجدول
        if (result.isTerminal) {
          break;
        }
      }

      // تأخير تدريجي بين السجلات لتجنب إجهاد الشبكة
      await new Promise(r => setTimeout(r, DISPATCH_DELAY_MS));
    }
  } catch (err) {
    console.warn('[ErrorRadar] Exception during queue flush:', err);
  } finally {
    isFlushingQueue = false;
  }

  return { processed, synced, failed };
}

// ─── تسجيل الأخطاء المركزي (Core Capture Function) ───────────────────────────

/**
 * فحص ما إذا كان الخطأ عبارة عن انقطاع شبكة اعتيادي متوقع
 * أخطاء الشبكة المتوقعة (مثل عدم توفر إنترنت أو إلغاء الطلب) لا تُعتبر كراش أو خطأ حرج
 */
export function isExpectedNetworkError(error: unknown): boolean {
  if (!error) return false;
  let msg = '';
  if (error instanceof Error) {
    msg = `${error.name} ${error.message}`;
  } else if (typeof error === 'string') {
    msg = error;
  } else if (typeof error === 'object') {
    try {
      msg = JSON.stringify(error);
    } catch {
      msg = String(error);
    }
  }

  const lower = msg.toLowerCase();
  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('aborterror') ||
    lower.includes('user aborted') ||
    lower.includes('the user aborted a request') ||
    lower.includes('net::err_') ||
    lower.includes('network request failed') ||
    lower.includes('network offline') ||
    lower.includes('err_internet_disconnected') ||
    lower.includes('request was aborted')
  );
}

/**
 * تسجيل خطأ مركزي داخل رادار الأخطاء
 * مصممة لتكون آمنة 100% وغير معطلة لأي تدفق عمل
 */
export function captureError(
  error: unknown,
  context?: {
    source?: ErrorRadarType;
    severity?: ErrorRadarSeverity;
    componentStack?: string;
    metadata?: Record<string, unknown>;
  }
): ErrorRadarLog | null {
  try {
    let rawMessage = 'Unknown Error';
    let rawStack = '';

    if (error instanceof Error) {
      rawMessage = error.message || error.name || 'Error';
      rawStack = error.stack || '';
    } else if (typeof error === 'string') {
      rawMessage = error;
    } else if (error && typeof error === 'object') {
      try {
        rawMessage = JSON.stringify(error);
      } catch {
        rawMessage = String(error);
      }
    }

    // تنظيف وتطهير البيانات الحساسة من الرسالة والـ Stack
    const cleanMessage = scrubSensitiveData(rawMessage).slice(0, 300);
    const cleanStack = rawStack ? scrubSensitiveData(rawStack).slice(0, 1500) : undefined;
    const cleanComponentStack = context?.componentStack ? scrubSensitiveData(context.componentStack).slice(0, 1500) : undefined;
    const currentRoute = sanitizeRoute();
    const errorType = context?.source || 'uncaught_error';
    const isNet = isExpectedNetworkError(error);
    const defaultSeverity: ErrorRadarSeverity = isNet 
      ? 'warning' 
      : (errorType === 'react_boundary' ? 'critical' : 'error');
    const severity = context?.severity || defaultSeverity;
    const fingerprint = generateFingerprint(errorType, cleanMessage, currentRoute);

    const now = new Date().toISOString();
    const logs = getErrorRadarLogs();

    // فحص منع التكرار المفرط (Deduplication)
    const existingIndex = logs.findIndex(l => l.fingerprint === fingerprint);
    if (existingIndex !== -1) {
      const existing = logs[existingIndex];
      const timeDiff = Date.now() - new Date(existing.lastSeenAt).getTime();

      // إذا حدث نفس الخطأ خلال نافذة التكرار، نزيد العداد فقط دون إغراق السجلات
      if (timeDiff < DEDUPLICATION_WINDOW_MS) {
        existing.occurrences += 1;
        existing.lastSeenAt = now;
        existing.isResolved = false; // إعادة فتحه إذا تكرر
        saveErrorRadarLogs(logs);
        return existing;
      }
    }

    // إنشاء سجل خطأ جديد بمعرف فريد وثابت (Idempotency Key)
    const newLog: ErrorRadarLog = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fingerprint,
      type: errorType,
      severity,
      message: cleanMessage,
      stack: cleanStack,
      componentStack: cleanComponentStack,
      route: currentRoute,
      device: getDeviceMetadata(),
      userRole: getCurrentUserRole(),
      occurrences: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      isResolved: false,
      breadcrumbs: [...recentBreadcrumbs],
      metadata: context?.metadata ? JSON.parse(scrubSensitiveData(JSON.stringify(context.metadata))) : undefined,
      syncStatus: 'pending',
      retryCount: 0,
    };

    // 1. الحفظ في الأرشيف المحلي فوراً (يعمل دون إنترنت)
    logs.unshift(newLog);
    saveErrorRadarLogs(logs);

    // 2. الإدراج في طابور الإرسال المجدول
    enqueueErrorRadarLog(newLog);

    // 3. محاولة إرسال غير معطلة في الخلفية إذا كانت الشبكة متوفرة
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setTimeout(() => {
        flushErrorRadarQueue().catch(() => {});
      }, 1500);
    }

    return newLog;
  } catch (err) {
    // Non-blocking: لا نسمح أبداً لخطأ في المسجل بالتأثير على التطبيق أو حركة البيع
    console.warn('[ErrorRadar] Failed to capture error:', err);
    return null;
  }
}

/**
 * تسجيل معلومات تشخيصية يمررها التطبيق صراحةً
 */
export function recordDiagnostic(
  label: string,
  details?: Record<string, unknown>,
  severity: ErrorRadarSeverity = 'info'
): ErrorRadarLog | null {
  return captureError(label, {
    source: 'diagnostic',
    severity,
    metadata: details,
  });
}

/**
 * تحديد الخطأ كـ "تمت المعالجة"
 */
export async function markErrorResolved(id: string): Promise<boolean> {
  try {
    const logs = getErrorRadarLogs();
    const target = logs.find(l => l.id === id);
    if (!target) return false;

    target.isResolved = true;
    target.resolvedAt = new Date().toISOString();
    saveErrorRadarLogs(logs);

    // تحديث الخادم صامتاً إذا كان متاحاً
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('error_logs')
          .update({ is_resolved: true, resolved_at: target.resolvedAt })
          .eq('client_error_id', id);
      } catch {
        // Non-blocking
      }
    }
    return true;
  } catch (err) {
    console.warn('[ErrorRadar] Failed to mark error as resolved:', err);
    return false;
  }
}

/**
 * إعادة فتح الخطأ كـ "قيد المتابعة"
 */
export async function markErrorUnresolved(id: string): Promise<boolean> {
  try {
    const logs = getErrorRadarLogs();
    const target = logs.find(l => l.id === id);
    if (!target) return false;

    target.isResolved = false;
    target.resolvedAt = undefined;
    saveErrorRadarLogs(logs);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('error_logs')
          .update({ is_resolved: false, resolved_at: null })
          .eq('client_error_id', id);
      } catch {
        // Non-blocking
      }
    }
    return true;
  } catch (err) {
    console.warn('[ErrorRadar] Failed to mark error as unresolved:', err);
    return false;
  }
}

/**
 * عدد الأخطاء غير المحلولة لعرضها في شارة التنبيهات للـ Boss
 */
export function getUnresolvedErrorCount(): number {
  try {
    const logs = getErrorRadarLogs();
    return logs.filter(l => !l.isResolved).length;
  } catch {
    return 0;
  }
}

/**
 * حذف سجل خطأ محدد
 */
export function deleteErrorRadarLog(id: string): void {
  try {
    const logs = getErrorRadarLogs().filter(l => l.id !== id);
    saveErrorRadarLogs(logs);
    dequeueErrorRadarItem(id);
  } catch (err) {
    console.warn('[ErrorRadar] Failed to delete error log:', err);
  }
}

/**
 * مسح جميع سجلات رادار الأخطاء وطابورها المحلي المنعزل حصراً
 * (لا يمس أي مفاتيح أخرى في localStorage أو IndexedDB)
 */
export function clearErrorRadarLogs(): void {
  try {
    secureRemove(STORAGE_KEY, { namespace: STORAGE_NAMESPACE });
    secureRemove(QUEUE_STORAGE_KEY, { namespace: STORAGE_NAMESPACE });
    localStorage.removeItem(FALLBACK_STORAGE_KEY);
    localStorage.removeItem(FALLBACK_QUEUE_KEY);
    listeners.forEach(fn => {
      try { fn([]); } catch {}
    });
  } catch (err) {
    console.warn('[ErrorRadar] Failed to clear error logs:', err);
  }
}

/**
 * استعلام حالة طابور الإرسال للـ Boss
 */
export function getErrorRadarQueueStats(): {
  queueLength: number;
  isFlushing: boolean;
} {
  return {
    queueLength: loadErrorRadarQueue().length,
    isFlushing: isFlushingQueue,
  };
}

/**
 * تصدير السجلات بصيغة JSON نظيفة للمشاركة مع الدعم الفني
 */
export function exportErrorRadarLogsJSON(): string {
  try {
    const logs = getErrorRadarLogs();
    return JSON.stringify(logs, null, 2);
  } catch {
    return '[]';
  }
}

/**
 * الاشتراك في تحديثات رادار الأخطاء في الوقت الفعلي
 */
export function subscribeToErrorRadar(callback: RadarListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// مؤشر لمنع التهيئة المزدوجة للمستمعين
let isInitialized = false;

/**
 * تهيئة مستمعي الأخطاء العالمية (Global Listeners Initialization)
 * يتم استدعاؤها مرة واحدة في main.tsx
 */
export function initErrorRadar(): () => void {
  if (typeof window === 'undefined' || isInitialized) {
    return () => {};
  }

  isInitialized = true;

  // 1. التقاط أخطاء الجافاسكريبت العامة غير المعالجة
  const handleErrorEvent = (event: ErrorEvent) => {
    try {
      if (event.defaultPrevented) return;
      const isNet = isExpectedNetworkError(event.error || event.message);
      captureError(event.error || event.message, {
        source: 'uncaught_error',
        severity: isNet ? 'warning' : 'error',
      });
    } catch {}
  };

  // 2. التقاط إخفاقات الوعود غير المعالجة (Unhandled Promise Rejections)
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    try {
      if (event.defaultPrevented) return;
      const isNet = isExpectedNetworkError(event.reason);
      captureError(event.reason || 'Unhandled Promise Rejection', {
        source: 'unhandled_rejection',
        severity: isNet ? 'warning' : 'error',
      });
    } catch {}
  };

  // 3. مستمع الإجراءات السريعة (UI Action Breadcrumbs)
  const handleDocumentClick = (e: MouseEvent) => {
    try {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName?.toLowerCase();
      // حظر تسجيل الحقول النصية لمنع تسريب أي مدخلات
      if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
        addBreadcrumb('ui', `click: <${tagName} type="${(target as HTMLInputElement).type || 'text'}">`);
        return;
      }

      const btn = target.closest('button, a, [role="button"]');
      if (btn) {
        const ariaLabel = btn.getAttribute('aria-label');
        const title = btn.getAttribute('title');
        const rawText = btn.textContent?.trim().slice(0, 20) || '';
        const name = scrubSensitiveData(ariaLabel || title || rawText || btn.tagName.toLowerCase());
        addBreadcrumb('ui', `click: ${name}`);
      }
    } catch {}
  };

  // 4. مستمعات التنقل وحالة الشبكة
  const handlePopState = () => addBreadcrumb('navigation', `nav: ${sanitizeRoute()}`);
  const handleHashChange = () => addBreadcrumb('navigation', `hash: ${sanitizeRoute()}`);
  
  // 5. عند عودة الاتصال: إضافة حدث للـ breadcrumbs وتشغيل إرسال الطابور تدريجياً
  const handleOnline = () => {
    addBreadcrumb('network', 'status: online');
    setTimeout(() => {
      flushErrorRadarQueue().catch(() => {});
    }, 2500); // مهلة للتأكد من استقرار الشبكة
  };

  const handleOffline = () => {
    addBreadcrumb('network', 'status: offline');
  };

  window.addEventListener('error', handleErrorEvent);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  document.addEventListener('click', handleDocumentClick, { capture: true, passive: true });
  window.addEventListener('popstate', handlePopState, { passive: true });
  window.addEventListener('hashchange', handleHashChange, { passive: true });
  window.addEventListener('online', handleOnline, { passive: true });
  window.addEventListener('offline', handleOffline, { passive: true });

  // فحص دوري خفيف للطابور كل 5 دقائق عند توفر الشبكة
  const periodicQueueCheck = setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      flushErrorRadarQueue().catch(() => {});
    }
  }, 5 * 60 * 1000);

  // تشغيل أولي للطابور في حال توفر الشبكة
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    setTimeout(() => {
      flushErrorRadarQueue().catch(() => {});
    }, 4000);
  }

  console.log('[ErrorRadar] Central error telemetry engine & offline queue initialized successfully');

  return () => {
    window.removeEventListener('error', handleErrorEvent);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    document.removeEventListener('click', handleDocumentClick, { capture: true });
    window.removeEventListener('popstate', handlePopState);
    window.removeEventListener('hashchange', handleHashChange);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    clearInterval(periodicQueueCheck);
    isInitialized = false;
  };
}
