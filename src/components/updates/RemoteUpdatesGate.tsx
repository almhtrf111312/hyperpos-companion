import { useEffect, useState, useCallback } from 'react';
import { Download, X, Lock, AlertTriangle, Megaphone, Send } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { Button } from '@/components/ui/button';
import { sendLocalNotification } from '@/lib/native-notifications';
import {
  computeUpdateStatus, fetchActiveBroadcasts, fetchReleaseConfig, getCachedReleaseConfig,
  getSeenBroadcasts, markBroadcastSeen, openExternal, reportClientVersion,
  CURRENT_VERSION_CODE, CURRENT_VERSION_NAME, type Broadcast, type ReleaseConfig,
} from '@/lib/remote-updates';

const FORCED_DISMISS_KEY = 'hp_forced_update_dismissed_day';
const NOTIFIED_KEY = 'hp_notified_broadcasts';
const POLL_MS = 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const BANNER_AUTO_DISMISS_MS = 7000;

export function RemoteUpdatesGate() {
  const { user } = useAuth();
  const { isBoss } = useUserRole();
  const [cfg, setCfg] = useState<ReleaseConfig>(getCachedReleaseConfig());
  const [banners, setBanners] = useState<Broadcast[]>([]);
  const [forcedDismissed, setForcedDismissed] = useState(
    () => localStorage.getItem(FORCED_DISMISS_KEY) === new Date().toDateString());

  const dismissBanner = useCallback((id: string) => {
    markBroadcastSeen(id);
    setBanners(prev => prev.filter(x => x.id !== id));
  }, []);

  // اختفاء اللافتة المنبثقة تلقائياً بعد 7 ثوانٍ وحفظها كمقروءة دون إزعاج
  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setTimeout(() => {
      banners.forEach(b => markBroadcastSeen(b.id));
      setBanners([]);
    }, BANNER_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [banners]);

  const refresh = useCallback(async () => {
    if (!user?.id || !navigator.onLine) return;
    try {
      reportClientVersion(user.id).catch(() => {});
      const releaseCfg = await fetchReleaseConfig();
      setCfg(releaseCfg);
      const list = await fetchActiveBroadcasts();
      const seen = new Set(getSeenBroadcasts());

      const now = Date.now();
      const latestBuildCode = releaseCfg.latest_version_code || releaseCfg.min_version_code || CURRENT_VERSION_CODE;

      // تصفية الإعلانات: عدم إظهار لافتة لتحديث مثبت بالفعل أو إعلان عادي تجاوز 3 أيام
      const activeItems = list.filter(b => {
        if (b.kind === 'update') {
          const targetCode = b.target_version_code || latestBuildCode;
          if (CURRENT_VERSION_CODE >= targetCode) return false;
          return true;
        }
        const createdAt = new Date(b.created_at).getTime();
        if (now - createdAt > THREE_DAYS_MS) return false;
        return true;
      });

      const fresh = activeItems.filter(b => !seen.has(b.id));
      const notified = new Set<string>(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]'));
      for (const b of fresh.filter(x => !notified.has(x.id))) {
        notified.add(b.id);
        sendLocalNotification(b.title, b.body, b.kind === 'info' ? 'system' : 'critical').catch(() => {});
      }
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified].slice(-200)));

      if (fresh.length > 0) {
        setBanners(fresh);
      } else {
        setBanners(prev => (prev.length > 0 ? [] : prev));
      }
    } catch { /* offline: keep cached */ }
  }, [user?.id]);

  useEffect(() => {
    refresh();
    const onOnline = () => refresh();
    window.addEventListener('online', onOnline);
    // Poll every minute while the app is visible, and immediately on resume/focus
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    let resumeHandle: { remove: () => void } | null = null;
    import('@capacitor/app').then(({ App }) => App.addListener('resume', () => refresh()))
      .then(h => { resumeHandle = h; }).catch(() => {});
    return () => {
      window.removeEventListener('online', onOnline); clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      resumeHandle?.remove();
    };
  }, [refresh]);

  if (!user) return null;
  const status = computeUpdateStatus(cfg, CURRENT_VERSION_CODE);
  const doUpdate = () => openExternal(cfg.update_url || cfg.telegram_url);

  if (status.state === 'locked' && !isBoss) {
    return (
      <div
        className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
        dir="rtl"
      >
        <div className="max-w-sm w-full text-center space-y-4 rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl">
          <Lock className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold text-foreground">يجب تحديث التطبيق</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {cfg.message || 'توقف هذا الإصدار عن العمل. حدّث التطبيق للمتابعة.'}
          </p>
          <p className="text-xs text-muted-foreground font-mono" dir="ltr">
            v{CURRENT_VERSION_NAME} → v{cfg.latest_version_name || '?'}
          </p>
          <Button className="w-full gap-2 shadow-sm" onClick={doUpdate}>
            <Download className="w-4 h-4" /> تحديث الآن
          </Button>
          {cfg.telegram_url && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => openExternal(cfg.telegram_url)}
            >
              <Send className="w-4 h-4" /> قناة Telegram
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {status.state === 'forced' && !forcedDismissed && (
        <div
          className="fixed inset-0 z-[150] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
          dir="rtl"
        >
          <div className="max-w-sm w-full text-center space-y-3 rounded-2xl border border-warning/40 bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <AlertTriangle className="w-10 h-10 mx-auto text-warning" />
            <h2 className="text-lg font-bold text-foreground">تحديث إجباري</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {cfg.message || 'يوجد تحديث إجباري لهذا التطبيق.'}
            </p>
            <p className="text-sm font-bold text-destructive">
              سيتوقف التطبيق بعد {status.daysLeft} {status.daysLeft === 1 ? 'يوم' : 'أيام'}
            </p>
            <Button className="w-full gap-2 shadow-sm" onClick={doUpdate}>
              <Download className="w-4 h-4" /> تحديث الآن
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => {
                localStorage.setItem(FORCED_DISMISS_KEY, new Date().toDateString());
                setForcedDismissed(true);
              }}
            >
              لاحقاً
            </Button>
          </div>
        </div>
      )}
      {banners.length > 0 && (
        <div
          className="fixed top-[calc(env(safe-area-inset-top,0px)+0.75rem)] inset-x-3 z-[140] space-y-2.5 max-w-lg mx-auto pointer-events-none"
          dir="rtl"
        >
          {banners.map(b => (
            <div
              key={b.id}
              className={`pointer-events-auto rounded-xl border p-3.5 shadow-xl bg-card/95 backdrop-blur-md flex gap-3 items-start transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
                b.kind === 'warning'
                  ? 'border-destructive/60 bg-destructive/5'
                  : 'border-primary/40 bg-card'
              }`}
            >
              <Megaphone
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  b.kind === 'warning' ? 'text-destructive' : 'text-primary'
                }`}
              />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-bold text-foreground leading-snug">{b.title}</p>
                {b.body && (
                  <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                    {b.body}
                  </p>
                )}
                <div className="pt-1.5 flex items-center gap-2 flex-wrap">
                  {(b.link_url || b.kind === 'update') && (
                    <Button
                      size="sm"
                      className="h-7 px-3 gap-1.5 text-xs font-medium active:scale-95 transition-transform"
                      onClick={() => {
                        dismissBanner(b.id);
                        openExternal(b.link_url || cfg.update_url);
                      }}
                    >
                      <Download className="w-3.5 h-3.5" /> فتح الرابط
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
                    onClick={() => dismissBanner(b.id)}
                  >
                    إغلاق
                  </Button>
                </div>
              </div>
              <button
                type="button"
                aria-label="إغلاق الإشعار"
                className="w-9 h-9 -mr-1.5 -mt-1.5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-90 active:bg-muted transition-all touch-manipulation shrink-0"
                onClick={() => dismissBanner(b.id)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
