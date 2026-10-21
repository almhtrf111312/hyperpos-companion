import { showSmartToast, hideSmartToast, hideSmartToastById } from '@/hooks/use-smart-toast';
import { getSavedToastDuration } from '@/lib/toast-config';

/**
 * Sonner Bridge — جسر التوافق مع مكتبة sonner
 *
 * كل الملفات التي كانت تستورد `toast` من 'sonner' تستورده الآن من هنا،
 * فيتحول كل إشعار تلقائياً إلى بطاقة Dynamic Island الموحدة (SmartToast)
 * بدل الإشعارات الصغيرة القديمة، على الويب والموبايل معاً.
 *
 * يدعم: toast() / success / error / warning / info / message / loading / promise / dismiss
 */

type ToastAction = { label: string; onClick: () => void };

interface ToastData {
  id?: string | number;
  description?: unknown;
  duration?: number;
  action?: ToastAction;
  [key: string]: unknown;
}

type SmartType = 'success' | 'error' | 'warning' | 'info' | 'sync';

const toMessage = (m: unknown): string =>
  typeof m === 'string' ? m : m != null ? String(m) : '';

const descOf = (data?: ToastData): string | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  return data.description != null ? String(data.description) : undefined;
};

const actionOf = (data?: ToastData) =>
  data?.action ? { label: data.action.label, onClick: data.action.onClick } : undefined;

function show(type: SmartType, message: unknown, data?: ToastData, defaultDuration?: number): string {
  const msg = toMessage(message);
  const id = data?.id != null ? String(data.id) : `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const duration =
    data?.duration != null
      ? data.duration
      : (defaultDuration ?? getSavedToastDuration());

  showSmartToast({
    id,
    type,
    title: msg,
    description: descOf(data) || msg,
    duration,
    primaryAction: actionOf(data),
  });
  return id;
}

export const toast = Object.assign(
  (message: unknown, data?: ToastData) => show('info', message, data),
  {
    success: (message: unknown, data?: ToastData) => show('success', message, data),
    error: (message: unknown, data?: ToastData) => show('error', message, data, 6000),
    warning: (message: unknown, data?: ToastData) => show('warning', message, data, 5000),
    info: (message: unknown, data?: ToastData) => show('info', message, data),
    message: (message: unknown, data?: ToastData) => show('info', message, data),

    /** إشعار "جاري التنفيذ" — يبقى ظاهراً حتى يُستبدل بنفس الـ id أو يُغلق يدوياً */
    loading: (message: unknown, data?: ToastData) =>
      show('sync', message, { duration: Infinity, ...data }),

    /** وعد مع حالات loading/success/error — يستبدل الإشعار بنفس الـ id */
    promise: <T,>(
      promise: Promise<T> | (() => Promise<T>),
      msgs?: {
        loading?: string;
        success?: string | ((value: T) => string);
        error?: string | ((err: unknown) => string);
        id?: string | number;
        duration?: number;
      }
    ): Promise<T> => {
      const id = msgs?.id != null ? String(msgs.id) : `st_promise_${Date.now()}`;
      show('sync', msgs?.loading ?? 'جاري التنفيذ...', { id, duration: Infinity });
      const p = typeof promise === 'function' ? promise() : promise;
      return Promise.resolve(p).then(
        (value) => {
          const text = typeof msgs?.success === 'function' ? msgs.success(value) : (msgs?.success ?? 'تم بنجاح');
          show('success', text, { id, duration: msgs?.duration });
          return value;
        },
        (err) => {
          const text = typeof msgs?.error === 'function' ? msgs.error(err) : (msgs?.error ?? 'حدث خطأ');
          show('error', text, { id, duration: 6000 });
          throw err;
        }
      );
    },

    dismiss: (toastId?: string | number) => {
      if (toastId != null) {
        hideSmartToastById(String(toastId));
      } else {
        hideSmartToast();
      }
    },

    /** غير مدعوم بصرياً — يحوَّل لإشعار عادي حتى لا يضيع */
    custom: (message: unknown, data?: ToastData) => show('info', message, data),
  }
);

export default toast;
