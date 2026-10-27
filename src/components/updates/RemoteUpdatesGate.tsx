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

export function RemoteUpdatesGate() {
  const { user } = useAuth();
  const { isBoss } = useUserRole();
  const [cfg, setCfg] = useState<ReleaseConfig>(getCachedReleaseConfig());
  const [banners, setBanners] = useState<Broadcast[]>([]);
  const [forcedDismissed, setForcedDismissed] = useState(
    () => localStorage.getItem(FORCED_DISMISS_KEY) === new Date().toDateString());

  const refresh = useCallback(async () => {
    if (!user?.id || !navigator.onLine) return;
    try {
      reportClientVersion(user.id).catch(() => {});
      setCfg(await fetchReleaseConfig());
      const list = await fetchActiveBroadcasts();
      const seen = new Set(getSeenBroadcasts());
      const fresh = list.filter(b => !seen.has(b.id));
      for (const b of fresh) sendLocalNotification(b.title, b.body, b.kind === 'info' ? 'system' : 'critical').catch(() => {});
      setBanners(fresh);
    } catch { /* offline: keep cached */ }
  }, [user?.id]);

  useEffect(() => {
    refresh();
    const onOnline = () => refresh();
    window.addEventListener('online', onOnline);
    const t = setInterval(refresh, 15 * 60 * 1000);
    return () => { window.removeEventListener('online', onOnline); clearInterval(t); };
  }, [refresh]);

  if (!user) return null;
  const status = computeUpdateStatus(cfg, CURRENT_VERSION_CODE);
  const doUpdate = () => openExternal(cfg.update_url || cfg.telegram_url);

  if (status.state === 'locked' && !isBoss) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-sm w-full text-center space-y-4 rounded-2xl border border-destructive/40 bg-card p-6">
          <Lock className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="text-lg font-bold text-foreground">يجب تحديث التطبيق</h2>
          <p className="text-sm text-muted-foreground">{cfg.message || 'توقف هذا الإصدار عن العمل. حدّث التطبيق للمتابعة.'}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">v{CURRENT_VERSION_NAME} → v{cfg.latest_version_name || '?'}</p>
          <Button className="w-full gap-2" onClick={doUpdate}><Download className="w-4 h-4" /> تحديث الآن</Button>
          {cfg.telegram_url && (
            <Button variant="outline" className="w-full gap-2" onClick={() => openExternal(cfg.telegram_url)}><Send className="w-4 h-4" /> قناة Telegram</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {status.state === 'forced' && !forcedDismissed && (
        <div className="fixed inset-0 z-[150] bg-background/80 flex items-center justify-center p-6" dir="rtl">
          <div className="max-w-sm w-full text-center space-y-3 rounded-2xl border border-warning/40 bg-card p-6 shadow-lg">
            <AlertTriangle className="w-10 h-10 mx-auto text-warning" />
            <h2 className="text-lg font-bold text-foreground">تحديث إجباري</h2>
            <p className="text-sm text-muted-foreground">{cfg.message || 'يوجد تحديث إجباري لهذا التطبيق.'}</p>
            <p className="text-sm font-bold text-destructive">سيتوقف التطبيق بعد {status.daysLeft} {status.daysLeft === 1 ? 'يوم' : 'أيام'}</p>
            <Button className="w-full gap-2" onClick={doUpdate}><Download className="w-4 h-4" /> تحديث الآن</Button>
            <Button variant="ghost" className="w-full" onClick={() => {
              localStorage.setItem(FORCED_DISMISS_KEY, new Date().toDateString()); setForcedDismissed(true);
            }}>لاحقاً</Button>
          </div>
        </div>
      )}
      {banners.length > 0 && (
        <div className="fixed top-2 inset-x-2 z-[140] space-y-2 max-w-lg mx-auto" dir="rtl">
          {banners.map(b => (
            <div key={b.id} className={`rounded-xl border p-3 shadow-lg bg-card flex gap-3 items-start ${b.kind === 'warning' ? 'border-destructive/50' : 'border-primary/40'}`}>
              <Megaphone className={`w-5 h-5 shrink-0 mt-0.5 ${b.kind === 'warning' ? 'text-destructive' : 'text-primary'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{b.title}</p>
                {b.body && <p className="text-xs text-muted-foreground whitespace-pre-line">{b.body}</p>}
                {(b.link_url || b.kind === 'update') && (
                  <Button size="sm" className="mt-2 h-7 gap-1 text-xs" onClick={() => openExternal(b.link_url || cfg.update_url)}>
                    <Download className="w-3 h-3" /> فتح الرابط
                  </Button>
                )}
              </div>
              <button aria-label="إغلاق" className="text-muted-foreground hover:text-foreground" onClick={() => {
                markBroadcastSeen(b.id); setBanners(p => p.filter(x => x.id !== b.id));
              }}><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
