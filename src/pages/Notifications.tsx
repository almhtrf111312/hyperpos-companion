import { useCallback, useEffect, useState } from 'react';
import { Bell, Download, Check, Megaphone, Wrench, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchActiveBroadcasts, getCachedReleaseConfig, getSeenBroadcasts, markBroadcastSeen, openExternal,
  type Broadcast,
} from '@/lib/remote-updates';

const ICONS = { info: Megaphone, warning: AlertTriangle, update: Download, maintenance: Wrench } as const;

/** Notification inbox: read notices disappear; update notices stay with their download link. */
export default function Notifications() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchActiveBroadcasts();
      const seen = new Set(getSeenBroadcasts());
      setItems(list.filter(b => b.kind === 'update' || !seen.has(b.id)));
    } catch { /* offline */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener('hp-broadcasts-updated', h);
    return () => window.removeEventListener('hp-broadcasts-updated', h);
  }, [load]);

  const markRead = (id: string) => {
    markBroadcastSeen(id);
    setItems(p => p.filter(x => x.id !== id || x.kind === 'update'));
    window.dispatchEvent(new Event('hp-broadcasts-updated'));
  };
  const updateUrl = getCachedReleaseConfig().update_url;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> الإشعارات</h1>
        <Button variant="ghost" size="sm" onClick={load} aria-label="تحديث"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
      </div>
      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">لا توجد إشعارات جديدة</div>
      )}
      {items.map(b => {
        const Icon = ICONS[b.kind] || Megaphone;
        const link = b.link_url || (b.kind === 'update' ? updateUrl : '');
        return (
          <div key={b.id} className={`rounded-2xl border bg-card p-4 flex gap-3 ${b.kind === 'warning' ? 'border-destructive/50' : 'border-border'}`}>
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${b.kind === 'warning' ? 'text-destructive' : 'text-primary'}`} />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-bold text-foreground">{b.title}</p>
              {b.body && <p className="text-xs text-muted-foreground whitespace-pre-line">{b.body}</p>}
              <p className="text-[11px] text-muted-foreground" dir="ltr">{new Date(b.created_at).toLocaleString('en-GB')}</p>
              <div className="flex gap-2 pt-1">
                {link && <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => openExternal(link)}><Download className="w-3 h-3" /> {b.kind === 'update' ? 'تحميل التحديث' : 'فتح الرابط'}</Button>}
                {b.kind !== 'update' && <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => markRead(b.id)}><Check className="w-3 h-3" /> تمت القراءة</Button>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
