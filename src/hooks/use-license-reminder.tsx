import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLicense } from './use-license';
import { useAuth } from './use-auth';

const REMINDER_STORAGE_KEY = 'license_reminder_last_shown';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hook to remind users when their free/trial license is nearing expiration.
 * - Shows a warning when <= 7 days remain (every 3 days).
 * - Escalates to an urgent error when <= 3 days remain (every 3 days).
 * - Shows a daily error notification once expired.
 * - Includes a quick "ترقية الآن" action button redirecting to license settings.
 */
export function useLicenseReminder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { expiresAt, remainingDays: licenseRemainingDays, isExpired, isLoading } = useLicense();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Check once per app session when user is loaded and license state resolved
    if (!user || isLoading || hasCheckedRef.current) return;

    const timer = setTimeout(() => {
      hasCheckedRef.current = true;

      // 1. Calculate days remaining
      let days = licenseRemainingDays;
      if (days === null && expiresAt) {
        const expiryTime = new Date(expiresAt).getTime();
        const diff = expiryTime - Date.now();
        days = Math.ceil(diff / ONE_DAY_MS);
      }

      // Fallback check from persistent cache if available
      if (days === null) {
        try {
          const cache = localStorage.getItem('hyperpos_license_cache_v1');
          if (cache) {
            const parsed = JSON.parse(cache);
            if (typeof parsed.remainingDays === 'number') {
              days = parsed.remainingDays;
            } else if (parsed.expiresAt) {
              days = Math.ceil((new Date(parsed.expiresAt).getTime() - Date.now()) / ONE_DAY_MS);
            }
          }
        } catch {
          // ignore cache read error
        }
      }

      if (days === null && !isExpired) return;

      const now = Date.now();
      const lastShownRaw = localStorage.getItem(REMINDER_STORAGE_KEY);
      const lastShown = lastShownRaw ? Number(lastShownRaw) || 0 : 0;

      const isActuallyExpired = isExpired || (days !== null && days <= 0);

      // Case 1: License has expired -> Show DAILY reminder
      if (isActuallyExpired) {
        if (now - lastShown < ONE_DAY_MS) return;

        localStorage.setItem(REMINDER_STORAGE_KEY, String(now));
        toast.error('انتهى ترخيصك المجاني', {
          description: 'انتهى ترخيصك المجاني، يرجى الترقية لمتابعة استخدام كامل مميزات النظام.',
          duration: 9000,
          action: {
            label: 'ترقية الآن',
            onClick: () => navigate('/settings?tab=license'),
          },
        });
        return;
      }

      // If more than 7 days remain, no reminder needed
      if (days === null || days > 7) return;

      // For <= 7 days, enforce 3-day reminder interval
      if (now - lastShown < THREE_DAYS_MS) return;

      localStorage.setItem(REMINDER_STORAGE_KEY, String(now));

      // Case 2: <= 3 days remaining -> Urgent Error Toast
      if (days <= 3) {
        const dayText = days <= 1 ? 'يوم واحد' : days === 2 ? 'يومين' : `${days} أيام`;
        toast.error('تحذير عاجل: اقتراب انتهاء الترخيص', {
          description: `تنبيه عاجل! ترخيصك المجاني ينتهي خلال ${dayText} فقط! سارع بالترقية لتفادي توقف الخدمات.`,
          duration: 8000,
          action: {
            label: 'ترقية الآن',
            onClick: () => navigate('/settings?tab=license'),
          },
        });
        return;
      }

      // Case 3: 4 to 7 days remaining -> Warning Toast
      if (days <= 7) {
        toast.warning('تذكير بالترخيص المجاني', {
          description: `ترخيصك المجاني ينتهي خلال ${days} أيام. قم بالترقية لمواصلة العمل دون أي توقف.`,
          duration: 6000,
          action: {
            label: 'ترقية الآن',
            onClick: () => navigate('/settings?tab=license'),
          },
        });
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, isLoading, expiresAt, licenseRemainingDays, isExpired, navigate]);
}
