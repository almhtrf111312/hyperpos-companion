import { useCallback, useEffect, useState, useMemo } from 'react';
import { Bell, Download, Megaphone, Wrench, AlertTriangle, RefreshCw, Eye, EyeOff, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  fetchActiveBroadcasts, getCachedReleaseConfig, getSeenBroadcasts, openExternal,
  CURRENT_VERSION_CODE,
  type Broadcast,
} from '@/lib/remote-updates';

const ICONS = { info: Megaphone, warning: AlertTriangle, update: Download, maintenance: Wrench } as const;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 72 ساعة

export default function Notifications() {
  const [rawItems, setRawItems] = useState<Broadcast[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>(getSeenBroadcasts);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'unread' | 'read'>('all');

  const releaseConfig = getCachedReleaseConfig();
  const latestBuildCode = releaseConfig.latest_version_code || releaseConfig.min_version_code || CURRENT_VERSION_CODE;
  const updateUrl = releaseConfig.update_url || releaseConfig.telegram_url || 'https://t.me/flowpospro';

  // جلب الإشعارات النشطة من السحابة (تختفي فوراً إذا حذفها Boss)
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchActiveBroadcasts();
      setRawItems(list);
    } catch {
      /* وضع عدم الاتصال */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('hp-broadcasts-updated', h);
    return () => window.removeEventListener('hp-broadcasts-updated', h);
  }, [load]);

  // تطبيق شروط الاختفاء التلقائي:
  // 1. الإشعارات العادية تختفي بعد 3 أيام
  // 2. إشعارات التحديث لا تختفي بعد 3 أيام إذا لم يثبت التحديث بعد (CURRENT < target)
  // 3. تختفي إشعارات التحديث تلقائياً بمجرد تحديث التطبيق إلى الإصدار المعلن (CURRENT >= target)
  const filteredBroadcasts = useMemo(() => {
    const now = Date.now();

    return rawItems.filter((b) => {
      const isUpdate = b.kind === 'update';
      const targetCode = (b as any).target_version_code || latestBuildCode;

      if (isUpdate) {
        // إذا كان التحديث قد تم تثبيته بالفعل على جهاز العميل -> يختفي تلقائياً
        if (CURRENT_VERSION_CODE >= targetCode) {
          return false;
        }
        // إذا لم يُثبت التحديث بعد -> يظل موجوداً دائماً ولا يختفي بعد 3 أيام
        return true;
      }

      // الإشعارات العادية الأخرى: تختفي بعد 3 أيام (72 ساعة) من تاريخ الإنشاء
      const createdAt = new Date(b.created_at).getTime();
      const isOlderThan3Days = (now - createdAt) > THREE_DAYS_MS;
      if (isOlderThan3Days) {
        return false;
      }

      return true;
    });
  }, [rawItems, latestBuildCode]);

  // تبديل حالة القراءة (مقروء / غير مقروء)
  const toggleRead = (id: string) => {
    setSeenIds((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter((x) => x !== id);
      } else {
        next = [...prev, id];
      }
      localStorage.setItem('hyperpos_seen_broadcasts', JSON.stringify(next));
      window.dispatchEvent(new Event('hp-broadcasts-updated'));
      return next;
    });
  };

  // تحديد الكل كمقروء
  const markAllRead = () => {
    const allIds = filteredBroadcasts.map((b) => b.id);
    const set = new Set([...seenIds, ...allIds]);
    const next = Array.from(set);
    setSeenIds(next);
    localStorage.setItem('hyperpos_seen_broadcasts', JSON.stringify(next));
    window.dispatchEvent(new Event('hp-broadcasts-updated'));
  };

  // تصفية العرض حسب التبويب المختار
  const displayedItems = useMemo(() => {
    return filteredBroadcasts.filter((b) => {
      const isRead = seenIds.includes(b.id);
      if (tab === 'unread') return !isRead;
      if (tab === 'read') return isRead;
      return true;
    });
  }, [filteredBroadcasts, seenIds, tab]);

  const unreadCount = filteredBroadcasts.filter((b) => !seenIds.includes(b.id)).length;
  const readCount = filteredBroadcasts.filter((b) => seenIds.includes(b.id)).length;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4" dir="rtl">
      {/* الشريط العلوي */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          الإشعارات والتنبيهات
          {unreadCount > 0 && (
            <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-xs">
              {unreadCount} جديد
            </Badge>
          )}
        </h1>
        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs h-8 gap-1">
              <CheckCheck className="w-3.5 h-3.5 text-primary" />
              تحديد الكل كمقروء
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={load} aria-label="تحديث" className="h-8 w-8 p-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* كبسولات التصفية (الكل / غير المقروءة / المقروءة) */}
      <div className="flex gap-2 border-b border-border/60 pb-2">
        <Button
          variant={tab === 'all' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full text-xs h-7"
          onClick={() => setTab('all')}
        >
          الكل ({filteredBroadcasts.length})
        </Button>
        <Button
          variant={tab === 'unread' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full text-xs h-7"
          onClick={() => setTab('unread')}
        >
          غير مقروءة ({unreadCount})
        </Button>
        <Button
          variant={tab === 'read' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full text-xs h-7"
          onClick={() => setTab('read')}
        >
          مقروءة ({readCount})
        </Button>
      </div>

      {/* شاشة فارغة */}
      {!loading && displayedItems.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground space-y-2">
          <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto" />
          <p>
            {tab === 'unread'
              ? 'لا توجد إشعارات غير مقروءة'
              : tab === 'read'
              ? 'لا توجد إشعارات مقروءة محفوظة'
              : 'لا توجد إشعارات حالياً'}
          </p>
        </div>
      )}

      {/* قائمة الإشعارات */}
      <div className="space-y-2.5">
        {displayedItems.map((b) => {
          const Icon = ICONS[b.kind] || Megaphone;
          const isRead = seenIds.includes(b.id);
          const isUpdate = b.kind === 'update';
          const link = b.link_url || (isUpdate ? updateUrl : '');

          return (
            <div
              key={b.id}
              className={`rounded-2xl border p-4 flex gap-3.5 transition-all ${
                b.kind === 'warning'
                  ? 'border-destructive/40 bg-destructive/5'
                  : isUpdate
                  ? 'border-primary/40 bg-primary/5'
                  : isRead
                  ? 'border-border/60 bg-card/60 opacity-80'
                  : 'border-border bg-card shadow-xs'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  b.kind === 'warning'
                    ? 'bg-destructive/15 text-destructive'
                    : isUpdate
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-foreground flex items-center gap-2">
                    {b.title}
                    {isUpdate && (
                      <Badge variant="outline" className="border-primary/50 text-primary text-[10px] px-1.5 py-0">
                        تحديث معلّق
                      </Badge>
                    )}
                  </p>
                  <Badge variant={isRead ? 'secondary' : 'default'} className="text-[10px] px-1.5 py-0 shrink-0">
                    {isRead ? 'مقروء' : 'جديد'}
                  </Badge>
                </div>

                {b.body && <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{b.body}</p>}

                <p className="text-[11px] text-muted-foreground/80 font-mono" dir="ltr">
                  {new Date(b.created_at).toLocaleString('en-GB')}
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {link && (
                    <Button size="sm" className="h-8 gap-1.5 text-xs font-bold" onClick={() => openExternal(link)}>
                      <Download className="w-3.5 h-3.5" />
                      {isUpdate ? 'تحميل التحديث وتثبيته' : 'فتح الرابط'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={isRead ? 'ghost' : 'outline'}
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => toggleRead(b.id)}
                  >
                    {isRead ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        تحديد كغير مقروء
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        تحديد كمقروء
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
