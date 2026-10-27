import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Send, Save, Trash2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/sonner-bridge';
import {
  BROADCAST_TEMPLATES, CURRENT_VERSION_CODE, CURRENT_VERSION_NAME, DEFAULT_RELEASE_CONFIG,
  fetchReleaseConfig, saveReleaseConfig, type Broadcast, type ReleaseConfig,
} from '@/lib/remote-updates';

interface VersionRow { user_id: string; version_name: string; version_code: number; platform: string | null; last_seen_at: string; name?: string }

export function BossReleasesPanel() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<ReleaseConfig>(DEFAULT_RELEASE_CONFIG);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [onlyOld, setOnlyOld] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', kind: 'info' as Broadcast['kind'], link_url: '', expires_days: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setCfg(await fetchReleaseConfig());
    const { data: b } = await supabase.from('app_broadcasts').select('*').order('created_at', { ascending: false }).limit(50);
    setBroadcasts((b || []) as Broadcast[]);
    const { data: v } = await supabase.from('client_versions').select('*').order('last_seen_at', { ascending: false });
    const rows = (v || []) as VersionRow[];
    if (rows.length) {
      const { data: p } = await supabase.from('profiles').select('user_id, full_name').in('user_id', rows.map(r => r.user_id));
      const names = new Map((p || []).map(x => [x.user_id, x.full_name || '']));
      rows.forEach(r => { r.name = names.get(r.user_id) || r.user_id.slice(0, 8); });
    }
    setVersions(rows);
  };
  useEffect(() => { load(); }, []);

  const latestCode = Math.max(cfg.latest_version_code, CURRENT_VERSION_CODE);
  const shown = useMemo(() => onlyOld ? versions.filter(v => v.version_code < latestCode) : versions, [versions, onlyOld, latestCode]);
  const oldCount = versions.filter(v => v.version_code < latestCode).length;

  const save = async (next: ReleaseConfig) => {
    setBusy(true);
    const { error } = await saveReleaseConfig(next);
    setBusy(false);
    if (error) return toast.error('فشل الحفظ: ' + error.message);
    setCfg(next); toast.success('تم حفظ إعدادات الإصدار');
  };

  const forceCurrent = () => save({
    ...cfg, min_version_code: CURRENT_VERSION_CODE, latest_version_code: CURRENT_VERSION_CODE,
    latest_version_name: CURRENT_VERSION_NAME, forced_since: new Date().toISOString(),
  });

  const publishTelegram = async () => {
    if (!cfg.update_url) return toast.error('أدخل رابط التحديث أولاً');
    setBusy(true);
    const { error } = await supabase.functions.invoke('publish-telegram-release', {
      body: { version: `v${cfg.latest_version_name || CURRENT_VERSION_NAME}`, title: 'تحديث جديد متاح', notes: cfg.message, download_url: cfg.update_url },
    });
    setBusy(false);
    if (error) return toast.error('فشل النشر في Telegram');
    toast.success('تم النشر في القناة');
  };

  const send = async () => {
    if (!draft.title.trim()) return toast.error('اكتب عنوان الإشعار');
    setBusy(true);
    const days = parseInt(draft.expires_days);
    const { error } = await supabase.from('app_broadcasts').insert({
      title: draft.title.trim(), body: draft.body.trim(), kind: draft.kind,
      link_url: draft.link_url.trim() || null, created_by: user?.id,
      expires_at: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
    });
    setBusy(false);
    if (error) return toast.error('فشل الإرسال: ' + error.message);
    toast.success('تم إرسال الإشعار لكل المستخدمين');
    setDraft({ title: '', body: '', kind: 'info', link_url: '', expires_days: '' });
    load();
  };

  const toggle = async (b: Broadcast) => {
    await supabase.from('app_broadcasts').update({ is_active: !b.is_active }).eq('id', b.id); load();
  };
  const remove = async (b: Broadcast) => {
    await supabase.from('app_broadcasts').delete().eq('id', b.id); load();
  };

  const num = (v: string) => parseInt(v.replace(/[^\d]/g, '')) || 0;

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-border bg-card p-2"><p className="text-[11px] text-muted-foreground">إصدارك</p><p className="font-bold text-sm" dir="ltr">v{CURRENT_VERSION_NAME} ({CURRENT_VERSION_CODE})</p></div>
        <div className="rounded-xl border border-border bg-card p-2"><p className="text-[11px] text-muted-foreground">أجهزة مسجلة</p><p className="font-bold text-sm">{versions.length}</p></div>
        <div className="rounded-xl border border-destructive/30 bg-card p-2"><p className="text-[11px] text-muted-foreground">نسخ قديمة</p><p className="font-bold text-sm text-destructive">{oldCount}</p></div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Release config */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">التحكم بالإصدارات</h3>
            <Button size="sm" variant="destructive" className="h-8 gap-1 text-xs" disabled={busy} onClick={forceCurrent}>
              <Zap className="w-3.5 h-3.5" /> اجعل v{CURRENT_VERSION_NAME} إجبارياً
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">آخر إصدار (اسم)</Label><Input dir="ltr" value={cfg.latest_version_name} onChange={e => setCfg({ ...cfg, latest_version_name: e.target.value })} /></div>
            <div><Label className="text-xs">آخر إصدار (Build)</Label><Input dir="ltr" inputMode="numeric" value={cfg.latest_version_code || ''} onChange={e => setCfg({ ...cfg, latest_version_code: num(e.target.value) })} /></div>
            <div><Label className="text-xs">أقل Build مسموح</Label><Input dir="ltr" inputMode="numeric" value={cfg.min_version_code || ''} onChange={e => setCfg({ ...cfg, min_version_code: num(e.target.value), forced_since: cfg.forced_since || new Date().toISOString() })} /></div>
            <div><Label className="text-xs">مهلة الإيقاف (أيام)</Label><Input dir="ltr" inputMode="numeric" value={cfg.grace_days} onChange={e => setCfg({ ...cfg, grace_days: num(e.target.value) })} /></div>
          </div>
          <div><Label className="text-xs">رابط التحديث</Label><Input dir="ltr" placeholder="https://..." value={cfg.update_url} onChange={e => setCfg({ ...cfg, update_url: e.target.value })} /></div>
          <div><Label className="text-xs">رابط قناة Telegram</Label><Input dir="ltr" placeholder="https://t.me/..." value={cfg.telegram_url} onChange={e => setCfg({ ...cfg, telegram_url: e.target.value })} /></div>
          <div><Label className="text-xs">رسالة التحديث الإجباري</Label><Textarea rows={2} value={cfg.message} onChange={e => setCfg({ ...cfg, message: e.target.value })} /></div>
          {cfg.forced_since && cfg.min_version_code > 0 && (
            <p className="text-[11px] text-muted-foreground">بدأ الإجبار: {new Date(cfg.forced_since).toLocaleString('en-GB')} — الإيقاف بعد {cfg.grace_days} أيام</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1" disabled={busy} onClick={() => save(cfg)}><Save className="w-4 h-4" /> حفظ</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => save({ ...cfg, min_version_code: 0, forced_since: null })}>إلغاء الإجبار</Button>
          </div>
          <Button size="sm" variant="secondary" className="w-full gap-1" disabled={busy} onClick={publishTelegram}>
            <Send className="w-4 h-4" /> نشر التحديث في قناة Telegram
          </Button>
        </div>

        {/* Broadcast composer */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-bold text-sm">إرسال إشعار لكل المستخدمين</h3>
          <div className="flex flex-wrap gap-1.5">
            {BROADCAST_TEMPLATES.map(t => (
              <Button key={t.label} size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => setDraft({ ...draft, title: t.title, body: t.body, kind: t.kind, link_url: t.kind === 'update' || t.kind === 'warning' ? cfg.update_url : draft.link_url })}>
                {t.label}
              </Button>
            ))}
          </div>
          <Input placeholder="العنوان" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          <Textarea rows={3} placeholder="نص الرسالة" value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input dir="ltr" placeholder="رابط (اختياري)" value={draft.link_url} onChange={e => setDraft({ ...draft, link_url: e.target.value })} />
            <Input dir="ltr" inputMode="numeric" placeholder="ينتهي بعد (أيام)" value={draft.expires_days} onChange={e => setDraft({ ...draft, expires_days: e.target.value.replace(/[^\d]/g, '') })} />
          </div>
          <Button className="w-full gap-2" disabled={busy} onClick={send}><Send className="w-4 h-4" /> إرسال</Button>

          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {broadcasts.map(b => (
              <div key={b.id} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-xs">
                <Badge variant={b.kind === 'warning' ? 'destructive' : 'secondary'} className="text-[10px]">{b.kind}</Badge>
                <span className="flex-1 truncate font-medium">{b.title}</span>
                <span className="text-muted-foreground" dir="ltr">{new Date(b.created_at).toLocaleDateString('en-GB')}</span>
                <Switch checked={b.is_active} onCheckedChange={() => toggle(b)} />
                <button aria-label="حذف" onClick={() => remove(b)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {!broadcasts.length && <p className="text-xs text-muted-foreground text-center py-2">لا توجد إشعارات</p>}
          </div>
        </div>
      </div>

      {/* Installed versions */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-sm">إصدارات المستخدمين</h3>
          <div className="flex items-center gap-2 text-xs">
            <Switch checked={onlyOld} onCheckedChange={setOnlyOld} /> نسخ قديمة فقط
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={load} aria-label="تحديث"><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-muted-foreground border-b border-border"><th className="text-start py-1.5">المستخدم</th><th className="text-start">الإصدار</th><th className="text-start">المنصة</th><th className="text-start">آخر ظهور</th></tr></thead>
            <tbody>
              {shown.map(v => (
                <tr key={v.user_id} className="border-b border-border/50">
                  <td className="py-1.5 font-medium">{v.name}</td>
                  <td dir="ltr" className={`text-start ${v.version_code < latestCode ? 'text-destructive font-bold' : ''}`}>v{v.version_name} ({v.version_code})</td>
                  <td>{v.platform}</td>
                  <td dir="ltr" className="text-start">{new Date(v.last_seen_at).toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <p className="text-xs text-muted-foreground text-center py-3">لا توجد بيانات بعد — تظهر عند فتح المستخدمين للتطبيق</p>}
        </div>
      </div>
    </div>
  );
}
