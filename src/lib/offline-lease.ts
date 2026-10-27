/**
 * Offline Lease System — نظام تذكرة العمل دون اتصال
 *
 * يصدر الخادم تذكرة أوفلاين موقّعة (SHA-256) عبر الدالة issue_offline_lease
 * تتضمن: مدة صلاحية قصوى + حد أقصى لعدد الفواتير دون اتصال.
 *
 * طبقات الحماية:
 * 1. التذكرة مخزنة عبر secure-storage (تشفير + تحقق سلامة مرتبط ببصمة الجهاز).
 * 2. ساعة موثوقة أحادية الاتجاه (Monotonic Trusted Clock): آخر توقيت مؤكد من
 *    الخادم يُخزن كحد أدنى — إعادة ساعة الجهاز للخلف تُكتشف فوراً وتُحظر البيع.
 * 3. عداد فواتير أوفلاين لا يُصفَّر إلا بعد مزامنة ناجحة مع الخادم.
 *
 * ملاحظة توافق: الأجهزة التي لم تحصل على تذكرة بعد (نسخ قديمة) تُعامل بنظام
 * الحماية اليومي السابق (offline-protection) ولا تُحظر — يبدأ الإنفاذ الصارم
 * فور صدور أول تذكرة من الخادم.
 */

import { supabase } from '@/integrations/supabase/client';
import { getDeviceKey, secureSet, secureGet, secureRemove } from './secure-storage';
import { verifyAsync } from '@noble/ed25519';

/** المفتاح العام لتوقيع Ed25519 — المفتاح الخاص لا يغادر الخادم أبداً */
const LEASE_PUBLIC_KEY_B64 = '4LgiPzjwneJPJjg6ElvOEYh7yrGdyeAQwNb9mEgq7Dw=';
const b64ToBytes = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

/** نتيجة التحقق من التوقيع: null = لم يُتحقق بعد */
let verifiedSignature: string | null = null;
let failedSignature: string | null = null;

/** يتحقق من أن التذكرة موقعة من الخادم وأن حقولها مطابقة للحمولة الموقعة */
export async function verifySignedLease(lease: OfflineLease | null): Promise<boolean> {
  if (!lease?.signedPayload || !lease.edSignature) return false;
  try {
    const ok = await verifyAsync(
      b64ToBytes(lease.edSignature),
      new TextEncoder().encode(lease.signedPayload),
      b64ToBytes(LEASE_PUBLIC_KEY_B64),
    );
    if (!ok) { failedSignature = lease.edSignature; return false; }
    const p = JSON.parse(lease.signedPayload);
    const consistent = p.license_id === lease.licenseId
      && Number(p.valid_until_epoch) === lease.validUntilEpoch
      && Number(p.max_offline_invoices) === lease.maxOfflineInvoices
      && p.device_id === lease.deviceId;
    if (!consistent) { failedSignature = lease.edSignature; return false; }
    verifiedSignature = lease.edSignature;
    return true;
  } catch {
    failedSignature = lease.edSignature;
    return false;
  }
}

// تحقق عند تحميل الوحدة
if (typeof window !== 'undefined') {
  setTimeout(() => { void verifySignedLease(getStoredLease()); }, 0);
}

export interface OfflineLease {
  licenseId: string;
  deviceId: string;
  /** ثواني Unix — نهاية صلاحية التذكرة */
  validUntilEpoch: number;
  maxOfflineInvoices: number;
  signature: string;
  /** ثواني Unix — توقيت الخادم لحظة الإصدار */
  issuedAtEpoch: number;
  /** الحمولة الموقعة بـ Ed25519 (v2) */
  signedPayload?: string;
  edSignature?: string;
}

export type OfflineLeaseBlockReason = 'tampered' | 'expired' | 'limit_reached';

export interface OfflineLeaseStatus {
  allowed: boolean;
  /** true = لا توجد تذكرة بعد (تثبيت قديم) — يُسمح وفق نظام الأيام السابق */
  legacy: boolean;
  reason: OfflineLeaseBlockReason | null;
  message: string;
  remainingDays: number | null;
  remainingInvoices: number | null;
}

const LEASE_KEY = 'offline_lease';
const COUNTER_KEY = 'offline_inv_count';
const TRUSTED_TIME_KEY = 'hp_trusted_server_time';
const SECURE_NS = 'hp_sec';
const TAMPER_TOLERANCE_SEC = 60;
const DEFAULT_MAX_OFFLINE_INVOICES = 100;
const LEASE_RPC_TIMEOUT_MS = 5000;

const BLOCK_MESSAGES: Record<OfflineLeaseBlockReason, string> = {
  tampered: 'تم رصد تلاعب بساعة الجهاز. العمل دون اتصال موقوف حتى إعادة الاتصال بالإنترنت للتحقق.',
  expired: 'انتهت صلاحية تذكرة العمل دون اتصال. يرجى الاتصال بالإنترنت لتجديدها.',
  limit_reached: 'تم بلوغ الحد الأقصى للفواتير دون اتصال. يرجى الاتصال بالإنترنت لمزامنة الفواتير.',
};

// ─── التخزين الداخلي ───────────────────────────────────────────────

function saveLease(lease: OfflineLease): void {
  secureSet(LEASE_KEY, lease, { namespace: SECURE_NS });
}

export function getStoredLease(): OfflineLease | null {
  const lease = secureGet<OfflineLease>(LEASE_KEY, { namespace: SECURE_NS });
  if (!lease || !lease.validUntilEpoch || !lease.deviceId) return null;
  return lease;
}

/** مسح التذكرة والعداد (عند تبديل المستخدم أو تسجيل الخروج) */
export function clearOfflineLease(): void {
  secureRemove(LEASE_KEY, { namespace: SECURE_NS });
  secureRemove(COUNTER_KEY, { namespace: SECURE_NS });
  try { localStorage.removeItem(TRUSTED_TIME_KEY); } catch { /* ignore */ }
}

// ─── الساعة الموثوقة أحادية الاتجاه ────────────────────────────────

/**
 * تحديث آخر توقيت مؤكد من الخادم. القيمة تتقدم فقط ولا ترجع للخلف أبداً،
 * فأي محاولة لخفضها يدوياً تُبقي القيمة الأعلى (اتجاه آمن ضد العبث).
 */
export function updateTrustedTime(serverEpochSec: number): void {
  try {
    if (!Number.isFinite(serverEpochSec) || serverEpochSec <= 0) return;
    const current = getTrustedTime();
    if (serverEpochSec > current) {
      localStorage.setItem(TRUSTED_TIME_KEY, String(Math.floor(serverEpochSec)));
    }
  } catch { /* ignore */ }
}

export function getTrustedTime(): number {
  try {
    return parseInt(localStorage.getItem(TRUSTED_TIME_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * كشف إرجاع ساعة الجهاز للخلف: إذا كان توقيت الجهاز الحالي أقدم من آخر
 * توقيت مؤكد من الخادم (بهامش تسامح 60 ثانية) فهذا عبث مؤكد.
 */
export function isTimeTampered(): boolean {
  const trusted = getTrustedTime();
  if (trusted <= 0) return false; // لم يسبق الاتصال بالخادم — لا حكم
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec < trusted - TAMPER_TOLERANCE_SEC;
}

// ─── عداد فواتير الأوفلاين ─────────────────────────────────────────

export function getOfflineInvoiceCount(): number {
  return secureGet<number>(COUNTER_KEY, { namespace: SECURE_NS }) ?? 0;
}

export function incrementOfflineInvoiceCounter(): number {
  const next = getOfflineInvoiceCount() + 1;
  secureSet(COUNTER_KEY, next, { namespace: SECURE_NS });
  return next;
}

/** يُستدعى فقط بعد مزامنة ناجحة بالكامل مع الخادم */
export function resetOfflineInvoiceCounter(): void {
  secureSet(COUNTER_KEY, 0, { namespace: SECURE_NS });
}

// ─── جلب التذكرة من الخادم ─────────────────────────────────────────

/**
 * طلب تذكرة أوفلاين جديدة من الخادم (issue_offline_lease).
 * الخادم يتحقق من الترخيص وربط الجهاز ويوقّع التذكرة بسرّ لا يغادر قاعدة البيانات.
 * عند النجاح: تُحفظ التذكرة، تتقدم الساعة الموثوقة، ويُصفَّر عداد الفواتير.
 */
async function fetchSignedLeaseV2(): Promise<OfflineLease | null> {
  const invoke = supabase.functions.invoke('issue-signed-lease', { body: { device_id: getDeviceKey() } });
  const timeout = new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), LEASE_RPC_TIMEOUT_MS));
  const { data, error } = await Promise.race([invoke, timeout]);
  if (error || !data?.success || !data.payload || !data.signature) return null;
  const p = JSON.parse(data.payload);
  const lease: OfflineLease = {
    licenseId: p.license_id,
    deviceId: p.device_id,
    validUntilEpoch: Number(p.valid_until_epoch),
    maxOfflineInvoices: Number(p.max_offline_invoices),
    signature: data.signature,
    issuedAtEpoch: Number(p.issued_at_epoch),
    signedPayload: data.payload,
    edSignature: data.signature,
  };
  if (!(await verifySignedLease(lease))) {
    console.warn('[OfflineLease] Server lease signature invalid');
    return null;
  }
  return lease;
}

export async function fetchOfflineLease(): Promise<OfflineLease | null> {
  try {
    const v2 = await fetchSignedLeaseV2().catch(() => null);
    if (v2) {
      saveLease(v2);
      updateTrustedTime(v2.issuedAtEpoch);
      resetOfflineInvoiceCounter();
      return v2;
    }
    const rpcPromise = (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> })
      .rpc('issue_offline_lease', { p_device_id: getDeviceKey() });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('offline lease request timeout')), LEASE_RPC_TIMEOUT_MS)
    );

    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);
    if (error) {
      console.warn('[OfflineLease] RPC error:', error);
      return null;
    }

    const payload = data as {
      success?: boolean;
      license_id?: string;
      device_id?: string;
      valid_until_epoch?: number;
      max_offline_invoices?: number;
      signature?: string;
      issued_at_epoch?: number;
    } | null;

    if (!payload?.success || !payload.license_id || !payload.valid_until_epoch || !payload.signature) {
      console.warn('[OfflineLease] Lease not issued:', payload);
      return null;
    }

    const lease: OfflineLease = {
      licenseId: payload.license_id,
      deviceId: payload.device_id || getDeviceKey(),
      validUntilEpoch: Number(payload.valid_until_epoch),
      maxOfflineInvoices: Number(payload.max_offline_invoices) || DEFAULT_MAX_OFFLINE_INVOICES,
      signature: payload.signature,
      issuedAtEpoch: Number(payload.issued_at_epoch) || Math.floor(Date.now() / 1000),
    };

    saveLease(lease);
    updateTrustedTime(lease.issuedAtEpoch);
    resetOfflineInvoiceCounter();
    console.log('[OfflineLease] Lease issued, valid until:', new Date(lease.validUntilEpoch * 1000).toISOString());
    return lease;
  } catch (err) {
    console.warn('[OfflineLease] Failed to fetch lease (offline?):', err);
    return null;
  }
}

// ─── تقييم حالة التذكرة ────────────────────────────────────────────

export function getOfflineLeaseStatus(): OfflineLeaseStatus {
  const ok: OfflineLeaseStatus = {
    allowed: true, legacy: false, reason: null, message: '',
    remainingDays: null, remainingInvoices: null,
  };

  // 1. كشف العبث بالساعة — يحظر حتى مع وجود تذكرة صالحة
  if (isTimeTampered()) {
    return { ...ok, allowed: false, reason: 'tampered', message: BLOCK_MESSAGES.tampered };
  }

  const lease = getStoredLease();

  // 2. لا تذكرة بعد (تثبيت قديم لم يتصل منذ الترقية) — نمط التوافق السابق
  if (!lease) {
    return { ...ok, legacy: true };
  }

  // 2.5 تذكرة v2: يجب أن يكون توقيعها صالحاً — أي تعديل يدوي يكسر التوقيع
  if (lease.edSignature) {
    if (failedSignature === lease.edSignature) {
      return { ...ok, allowed: false, reason: 'tampered', message: BLOCK_MESSAGES.tampered };
    }
    if (verifiedSignature !== lease.edSignature) void verifySignedLease(lease);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const remainingDays = Math.max(0, Math.ceil((lease.validUntilEpoch - nowSec) / 86400));
  const count = getOfflineInvoiceCount();
  const remainingInvoices = Math.max(0, lease.maxOfflineInvoices - count);

  // 3. انتهاء صلاحية التذكرة
  if (nowSec > lease.validUntilEpoch) {
    return { ...ok, allowed: false, reason: 'expired', message: BLOCK_MESSAGES.expired, remainingDays: 0, remainingInvoices };
  }

  // 4. بلوغ حد الفواتير دون اتصال
  if (count >= lease.maxOfflineInvoices) {
    return { ...ok, allowed: false, reason: 'limit_reached', message: BLOCK_MESSAGES.limit_reached, remainingDays, remainingInvoices: 0 };
  }

  return { ...ok, remainingDays, remainingInvoices };
}

/**
 * بوابة البيع: متصل بالإنترنت = مسموح دائماً (الخادم يحكم).
 * دون اتصال = يخضع لحالة التذكرة.
 */
export function canSellOffline(): OfflineLeaseStatus {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    return { allowed: true, legacy: false, reason: null, message: '', remainingDays: null, remainingInvoices: null };
  }
  return getOfflineLeaseStatus();
}
