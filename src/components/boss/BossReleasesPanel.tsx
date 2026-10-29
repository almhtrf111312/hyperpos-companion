import { useState, useEffect, useMemo } from 'react';
import {
  CURRENT_VERSION_NAME as BUNDLED_VERSION_NAME,
  CURRENT_VERSION_CODE as BUNDLED_VERSION_CODE,
  fetchReleaseConfig,
  saveReleaseConfig,
  type ReleaseConfig,
  type Broadcast,
  BROADCAST_TEMPLATES,
} from '@/lib/remote-updates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/sonner-bridge';
import { useAuth } from '@/hooks/use-auth';
import {
  Rocket,
  Send,
  RefreshCw,
  Trash2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Radio,
  Bell,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface DeployedVersion {
  code: number;
  name: string;
  count: number;
}

interface ClientVersionRow {
  user_id: string;
  version_name: string;
  version_code: number;
  platform: string | null;
  last_seen_at: string;
  name?: string;
}

export function BossReleasesPanel() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<ReleaseConfig | null>(null);
  const [deployedVersions, setDeployedVersions] = useState<DeployedVersion[]>([]);
  const [rawClients, setRawClients] = useState<ClientVersionRow[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [onlyOld, setOnlyOld] = useState(false);

  // Release Form State
  const [releaseType, setReleaseType] = useState<'optional' | 'forced'>('optional');
  const [minAllowedCode, setMinAllowedCode] = useState<number>(0);
  const [graceDays, setGraceDays] = useState<number>(3);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [updateUrl, setUpdateUrl] = useState<string>('');
  const [telegramUrl, setTelegramUrl] = useState<string>('');

  // Modals & Busy states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isPublishingTelegramOnly, setIsPublishingTelegramOnly] = useState(false);

  // أحدث نسخة مدفوعة إلى main (تُقرأ من GitHub مباشرة، لا من نسخة التطبيق المثبتة)
  const [mainVersion, setMainVersion] = useState<{ versionName: string; versionCode: number; sha: string | null; message?: string | null; notes: string[] } | null>(null);
  const [mainError, setMainError] = useState<string | null>(null);
  const loadMainVersion = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-main-version', { body: {} });
      if (error || !data?.versionCode) throw new Error(data?.error || error?.message || 'تعذر القراءة');
      setMainVersion(data);
      setMainError(null);
    } catch (e: any) {
      setMainError(e.message);
    }
  };
  useEffect(() => {
    loadMainVersion();
    const t = setInterval(loadMainVersion, 60_000);
    return () => clearInterval(t);
  }, []);
  const CURRENT_VERSION_NAME = mainVersion?.versionName ?? BUNDLED_VERSION_NAME;
  const CURRENT_VERSION_CODE = mainVersion?.versionCode ?? BUNDLED_VERSION_CODE;
  
  const hasUnpublishedCommits = useMemo(() => {
    if (!mainVersion) return false;
    const mainCode = mainVersion.versionCode ?? 0;
    const cloudCode = cfg?.latest_version_code ?? 0;
    // فك التجمد: إذا كان الرقم في السحابة مشوهاً (>1000 بينما الكود الحقيقي مئات)
    if (cloudCode > 1000 && mainCode < 1000) return true;
    if (mainCode > cloudCode) return true;
    if (mainVersion.sha && cfg?.latest_commit_sha && mainVersion.sha !== cfg.latest_commit_sha) return true;
    return false;
  }, [mainVersion, cfg]);

  // Broadcast Composer State
  const [broadcastDraft, setBroadcastDraft] = useState({
    title: '',
    body: '',
    kind: 'info' as Broadcast['kind'],
    link_url: '',
    expires_days: '7',
  });

  // 1. التعبئة التلقائية الفورية عند الدخول (Auto-population)
  const loadData = async () => {
    try {
      const config = await fetchReleaseConfig();
      setCfg(config);
      setUpdateUrl(config.update_url || 'https://t.me/flowpospro');
      setTelegramUrl(config.telegram_url || 'https://t.me/flowpospro');
      setCustomMessage(config.message || 'يرجى التحديث للاستمرار في استخدام التطبيق بكفاءة وأمان.');

      if (config.min_version_code && config.min_version_code > 0) {
        setReleaseType('forced');
        setMinAllowedCode(config.min_version_code);
        setGraceDays(config.grace_days ?? 3);
      } else {
        setReleaseType('optional');
        setMinAllowedCode(0);
      }

      // جلب إصدارات الأجهزة المسجلة
      const { data: clients } = await supabase
        .from('client_versions')
        .select('*')
        .order('last_seen_at', { ascending: false });

      const rows = (clients || []) as ClientVersionRow[];
      if (rows.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', rows.map((r) => r.user_id));

        const names = new Map((profiles || []).map((x) => [x.user_id, x.full_name || '']));
        rows.forEach((r) => {
          r.name = names.get(r.user_id) || r.user_id.slice(0, 8);
        });
      }
      setRawClients(rows);

      // تجميع الإصدارات المنشورة مع عدد الأجهزة
      const counts = new Map<number, { name: string; count: number }>();
      rows.forEach((c) => {
        const entry = counts.get(c.version_code) || { name: c.version_name || String(c.version_code), count: 0 };
        entry.count += 1;
        counts.set(c.version_code, entry);
      });
      const list = Array.from(counts.entries()).map(([code, val]) => ({
        code,
        name: val.name,
        count: val.count,
      }));
      list.sort((a, b) => b.code - a.code);
      setDeployedVersions(list);

      // جلب الإعلانات النشطة
      const { data: bData } = await supabase
        .from('app_broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      setBroadcasts((bData || []) as Broadcast[]);
    } catch (err) {
      console.error('[BossReleases] Error loading data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const latestCode = Math.max(cfg?.latest_version_code || 0, CURRENT_VERSION_CODE);
  const filteredClients = useMemo(() => {
    if (!onlyOld) return rawClients;
    return rawClients.filter((v) => v.version_code < latestCode);
  }, [rawClients, onlyOld, latestCode]);

  const outdatedCount = useMemo(() => {
    return rawClients.filter((v) => v.version_code < latestCode).length;
  }, [rawClients, latestCode]);

  // 2. النشر الفوري بضغطة زر وتأكيد (1-Click Publish Flow)
  const handlePublishConfirm = async () => {
    setIsBusy(true);
    try {
      const minCode = releaseType === 'forced' ? (minAllowedCode || CURRENT_VERSION_CODE) : 0;
      const updatedConfig: ReleaseConfig = {
        ...(cfg || {}),
        latest_version_name: CURRENT_VERSION_NAME,
        latest_version_code: CURRENT_VERSION_CODE,
        latest_commit_sha: mainVersion?.sha || cfg?.latest_commit_sha || null,
        latest_commit_message: mainVersion?.message || cfg?.latest_commit_message || null,
        last_synced_at: new Date().toISOString(),
        min_version_code: minCode,
        forced_since: releaseType === 'forced' ? new Date().toISOString() : null,
        grace_days: graceDays,
        update_url: updateUrl.trim(),
        telegram_url: telegramUrl.trim(),
        message: customMessage.trim(),
      };

      // أ) حفظ الإعدادات في قاعدة البيانات
      const { error: saveErr } = await saveReleaseConfig(updatedConfig);
      if (saveErr) {
        throw new Error('فشل حفظ الإعدادات: ' + saveErr.message);
      }
      setCfg(updatedConfig);

      // ب) إطلاق عملية البناء والنشر المباشر عبر السحابة
      const { data, error } = await supabase.functions.invoke('trigger-public-release', { body: {} });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const details = ctx?.text ? await ctx.text().catch(() => '') : '';
        throw new Error(details || error.message);
      }

      toast.success(
        `تم إطلاق النشر بنجاح (${data?.sha ? data.sha.slice(0, 7) : 'Commit'}) — سيتم بناء ملف APK وإرساله للقناة مباشرة! 🚀`
      );
      setIsConfirmModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('[BossReleases] Publish error:', err);
      toast.error(err.message || 'فشل إطلاق عملية النشر');
    } finally {
      setIsBusy(false);
    }
  };

  // 3. نشر رسالة ترويجية في Telegram دون إعادة بناء ملف الـ APK
  const handlePublishTelegramOnly = async () => {
    if (!updateUrl) {
      return toast.error('يرجى تحديد رابط التحديث أولاً');
    }
    setIsPublishingTelegramOnly(true);
    try {
      const { error } = await supabase.functions.invoke('publish-telegram-release', {
        body: {
          version: `v${CURRENT_VERSION_NAME}`,
          title: `تحديث FlowPOS Pro v${CURRENT_VERSION_NAME} متاح الآن`,
          notes: customMessage,
          download_url: updateUrl,
        },
      });
      if (error) throw error;
      toast.success('تم نشر الإشعار في قناة Telegram بنجاح 📢');
    } catch (err: any) {
      toast.error('فشل النشر في التليجرام: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsPublishingTelegramOnly(false);
    }
  };

  // 4. حفظ الإعدادات فقط دون تشغيل البناء
  const handleSaveConfigOnly = async () => {
    setIsBusy(true);
    try {
      const minCode = releaseType === 'forced' ? (minAllowedCode || CURRENT_VERSION_CODE) : 0;
      const updatedConfig: ReleaseConfig = {
        ...(cfg || {}),
        latest_version_name: CURRENT_VERSION_NAME,
        latest_version_code: CURRENT_VERSION_CODE,
        latest_commit_sha: mainVersion?.sha || cfg?.latest_commit_sha || null,
        latest_commit_message: mainVersion?.message || cfg?.latest_commit_message || null,
        last_synced_at: new Date().toISOString(),
        min_version_code: minCode,
        forced_since: releaseType === 'forced' ? (cfg?.forced_since || new Date().toISOString()) : null,
        grace_days: graceDays,
        update_url: updateUrl.trim(),
        telegram_url: telegramUrl.trim(),
        message: customMessage.trim(),
      };
      const { error } = await saveReleaseConfig(updatedConfig);
      if (error) throw error;
      setCfg(updatedConfig);
      toast.success('تم حفظ إعدادات الإصدارات في السحابة بنجاح 💾');
    } catch (err: any) {
      toast.error('فشل حفظ الإعدادات: ' + err.message);
    } finally {
      setIsBusy(false);
    }
  };

  // 5. إرسال إشعار عام داخل التطبيق (In-App Broadcast)
  const handleSendBroadcast = async () => {
    if (!broadcastDraft.title.trim()) {
      return toast.error('يرجى كتابة عنوان الإشعار');
    }
    setIsBusy(true);
    try {
      const days = parseInt(broadcastDraft.expires_days) || 7;
      const { error } = await supabase.from('app_broadcasts').insert({
        title: broadcastDraft.title.trim(),
        body: broadcastDraft.body.trim(),
        kind: broadcastDraft.kind,
        link_url: broadcastDraft.link_url.trim() || null,
        created_by: user?.id,
        expires_at: days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
      });
      if (error) throw error;
      toast.success('تم بث الإشعار لجميع الأجهزة بنجاح 📣');
      setBroadcastDraft({ title: '', body: '', kind: 'info', link_url: '', expires_days: '7' });
      loadData();
    } catch (err: any) {
      toast.error('فشل إرسال الإشعار: ' + err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const toggleBroadcast = async (b: Broadcast) => {
    await supabase.from('app_broadcasts').update({ is_active: !b.is_active }).eq('id', b.id);
    loadData();
  };

  const deleteBroadcast = async (b: Broadcast) => {
    await supabase.from('app_broadcasts').delete().eq('id', b.id);
    loadData();
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-6">
      {/* 0. تنبيه وجود كود / تحديث جديد على main لم يُنشر بعد */}
      {hasUnpublishedCommits && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 text-amber-600 dark:text-amber-400 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚀</span>
            <div>
              <p className="text-xs font-black">يوجد تحديث جديد على فرع main جاهز للنشر!</p>
              <p className="text-[11px] opacity-80 font-mono mt-0.5" dir="ltr">
                Commit: {mainVersion?.sha || '—'}
                {mainVersion?.message ? ` · ${mainVersion.message}` : ''}
                {mainVersion?.versionName ? ` (v${mainVersion.versionName} • Build ${mainVersion.versionCode})` : ''}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsConfirmModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 rounded-xl shrink-0"
          >
            نشر الآن للمستخدمين
          </Button>
        </div>
      )}
      {mainError && (
        <p className="text-[11px] text-muted-foreground text-center">
          تعذر قراءة أحدث نسخة من main ({mainError}) — تُعرض نسخة هذا التطبيق.
        </p>
      )}

      {/* 1. بطاقة إحصاءات الإصدارات الحالية */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-xs">
          <p className="text-[11px] font-medium text-muted-foreground">الإصدار الجاهز</p>
          <p className="font-extrabold text-sm md:text-base text-primary mt-0.5" dir="ltr">
            v{CURRENT_VERSION_NAME}
          </p>
          <span className="text-[10px] text-muted-foreground font-mono">Build {CURRENT_VERSION_CODE}</span>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-xs">
          <p className="text-[11px] font-medium text-muted-foreground">الأجهزة المتصلة</p>
          <p className="font-extrabold text-sm md:text-base text-foreground mt-0.5">
            {rawClients.length}
          </p>
          <span className="text-[10px] text-muted-foreground">جهاز مسجل</span>
        </div>
        <div className={cn(
          "rounded-2xl border p-3 shadow-xs transition-colors",
          outdatedCount > 0 ? "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-600"
        )}>
          <p className="text-[11px] font-medium opacity-80">نسخ سابقة</p>
          <p className="font-extrabold text-sm md:text-base mt-0.5">
            {outdatedCount}
          </p>
          <span className="text-[10px] opacity-80">{outdatedCount > 0 ? 'بحاجة لتحديث' : 'الجميع محدّث'}</span>
        </div>
      </div>

      {/* 2. بطاقة نشر التحديث الهادئة (Zero-Data Entry) */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground">نشر تحديث جديد</h2>
              <p className="text-[11px] text-muted-foreground">بناء ملف APK وإرساله مباشرة لقناة Telegram</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
            جاهز للبث
          </Badge>
        </div>

        {/* حقول النسخة والـ Build معبأة تلقائياً */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground block mb-1">النسخة (تلقائي)</Label>
            <input
              dir="ltr"
              readOnly
              value={`v${CURRENT_VERSION_NAME}`}
              className="w-full bg-muted/50 rounded-xl p-2.5 font-bold text-xs sm:text-sm border border-border/60 text-foreground cursor-default outline-none"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground block mb-1">Build (تلقائي)</Label>
            <input
              dir="ltr"
              readOnly
              value={`Build ${CURRENT_VERSION_CODE}`}
              className="w-full bg-muted/50 rounded-xl p-2.5 font-bold text-xs sm:text-sm border border-border/60 text-foreground cursor-default outline-none"
            />
          </div>
        </div>

        {/* محوّل نوع التحديث الكبسولي (Segmented Control) */}
        <div>
          <Label className="text-xs text-muted-foreground block mb-1.5 font-medium">نوع التحديث للمستخدمين</Label>
          <div className="grid grid-cols-2 bg-muted/60 p-1 rounded-xl gap-1 border border-border/50">
            <button
              type="button"
              className={cn(
                "py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                releaseType === 'optional'
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setReleaseType('optional')}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              اختياري (سلس)
            </button>
            <button
              type="button"
              className={cn(
                "py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                releaseType === 'forced'
                  ? "bg-destructive text-destructive-foreground shadow-xs font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setReleaseType('forced')}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              إجباري (إلزام التحديث)
            </button>
          </div>
        </div>

        {/* خانة أقدم إصدار مسموح ومهلة الإيقاف (تظهر فقط عند اختيار إجباري) */}
        {releaseType === 'forced' && (
          <div className="p-3.5 bg-destructive/5 border border-destructive/20 rounded-xl space-y-3 animate-in fade-in">
            <div>
              <Label className="text-xs font-bold text-destructive block mb-1">
                أقدم إصدار مسموح باستخدامه:
              </Label>
              <select
                className="w-full bg-card rounded-xl border border-destructive/30 p-2.5 text-xs font-semibold text-foreground focus:ring-1 focus:ring-destructive outline-none"
                value={minAllowedCode}
                onChange={(e) => setMinAllowedCode(Number(e.target.value))}
              >
                <option value={CURRENT_VERSION_CODE}>
                  الإصدار الحالي فقط (v{CURRENT_VERSION_NAME}) — إيقاف كافة النسخ السابقة فوراً
                </option>
                {deployedVersions.map((v) => (
                  <option key={v.code} value={v.code}>
                    من إصدار v{v.name} (Build {v.code}) فما فوق — ({v.count} جهاز مسجل)
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                أي جهاز يعمل بإصدار أقدم من هذا الاختيار سيتلقى شاشة حظر إجبارية بعد انتهاء المهلة.
              </p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground block mb-1">مهلة الإيقاف بعد الإشعار:</Label>
              <select
                className="w-full bg-card rounded-xl border border-border p-2.5 text-xs font-medium text-foreground outline-none"
                value={graceDays}
                onChange={(e) => setGraceDays(Number(e.target.value))}
              >
                <option value={0}>إيقاف فوري (0 أيام مهلة)</option>
                <option value={1}>يوم واحد مهلة</option>
                <option value={3}>٣ أيام مهلة (موصى به)</option>
                <option value={7}>٧ أيام مهلة</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground block mb-1">رسالة الإيقاف للمستخدمين:</Label>
              <Input
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="يرجى التحديث للاستمرار..."
                className="text-xs rounded-lg"
              />
            </div>
          </div>
        )}

        {/* روابط التحديث والقناة */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div>
            <Label className="text-[11px] text-muted-foreground block mb-1">رابط تحميل التحديث (APK Link)</Label>
            <Input
              dir="ltr"
              value={updateUrl}
              onChange={(e) => setUpdateUrl(e.target.value)}
              placeholder="https://t.me/..."
              className="text-xs rounded-xl h-9 font-mono"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground block mb-1">رابط القناة الرسمية (Telegram)</Label>
            <Input
              dir="ltr"
              value={telegramUrl}
              onChange={(e) => setTelegramUrl(e.target.value)}
              placeholder="https://t.me/..."
              className="text-xs rounded-xl h-9 font-mono"
            />
          </div>
        </div>

        {/* أزرار الإجراءات الرئيسية */}
        <div className="pt-2 space-y-2">
          {/* زر النشر الكبير ذو الضغطة الواحدة */}
          <Button
            type="button"
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={isBusy}
            className="w-full h-12 text-sm font-extrabold rounded-xl bg-primary text-primary-foreground shadow-md hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
            نشر التحديث الآن (بناء + رفع + تيليجرام)
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={handleSaveConfigOnly}
              className="h-9 text-xs rounded-xl"
            >
              حفظ السياسة فقط
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isBusy || isPublishingTelegramOnly}
              onClick={handlePublishTelegramOnly}
              className="h-9 text-xs rounded-xl gap-1 text-primary hover:text-primary"
            >
              {isPublishingTelegramOnly ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              رسالة تيليجرام فقط
            </Button>
          </div>
        </div>
      </div>

      {/* 3. بطاقة بث الإشعارات الجماعية (In-App Broadcasts) */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-3.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-foreground">
              <Bell className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground">بث إشعار لجميع الأجهزة</h3>
          </div>
          <span className="text-[11px] text-muted-foreground">يظهر فوراً في شاشات المستخدمين</span>
        </div>

        {/* قوالب سريعة */}
        <div className="flex flex-wrap gap-1.5">
          {BROADCAST_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.label}
              type="button"
              onClick={() => {
                setBroadcastDraft({
                  title: tmpl.title,
                  body: tmpl.body,
                  kind: tmpl.kind,
                  link_url: tmpl.kind === 'update' || tmpl.kind === 'warning' ? updateUrl : '',
                  expires_days: tmpl.kind === 'warning' ? '3' : '7',
                });
              }}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
            >
              {tmpl.label}
            </button>
          ))}
        </div>

        <Input
          placeholder="عنوان الإشعار..."
          value={broadcastDraft.title}
          onChange={(e) => setBroadcastDraft({ ...broadcastDraft, title: e.target.value })}
          className="text-xs rounded-xl h-9"
        />

        <Textarea
          rows={2}
          placeholder="نص الإشعار..."
          value={broadcastDraft.body}
          onChange={(e) => setBroadcastDraft({ ...broadcastDraft, body: e.target.value })}
          className="text-xs rounded-xl"
        />

        <div className="grid grid-cols-2 gap-2">
          <Input
            dir="ltr"
            placeholder="رابط توجيهي (اختياري)..."
            value={broadcastDraft.link_url}
            onChange={(e) => setBroadcastDraft({ ...broadcastDraft, link_url: e.target.value })}
            className="text-xs rounded-xl h-9 font-mono"
          />
          <Input
            dir="ltr"
            inputMode="numeric"
            placeholder="مدة الإشعار بالأيام (افتراضي 7)"
            value={broadcastDraft.expires_days}
            onChange={(e) => setBroadcastDraft({ ...broadcastDraft, expires_days: e.target.value })}
            className="text-xs rounded-xl h-9"
          />
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleSendBroadcast}
          disabled={isBusy}
          className="w-full rounded-xl gap-1.5 text-xs font-bold"
        >
          <Send className="w-3.5 h-3.5" /> بث الإشعار للمستخدمين
        </Button>

        {/* قائمة الإشعارات السابقة */}
        {broadcasts.length > 0 && (
          <div className="pt-2 space-y-1.5 max-h-48 overflow-y-auto">
            <Label className="text-[11px] text-muted-foreground block mb-1">الإشعارات الحالية والسابقة:</Label>
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2 p-2 rounded-xl border border-border/70 bg-muted/20 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant={b.kind === 'warning' ? 'destructive' : 'secondary'}
                    className="text-[9px] px-1.5 py-0 shrink-0"
                  >
                    {b.kind}
                  </Badge>
                  <p className="truncate font-semibold text-foreground text-xs">{b.title}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={b.is_active}
                    onCheckedChange={() => toggleBroadcast(b)}
                    className="scale-75"
                  />
                  <button
                    type="button"
                    onClick={() => deleteBroadcast(b)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. بطاقة إصدارات المستخدمين المسجلة */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">إصدارات أجهزة المستخدمين</h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
              <Switch checked={onlyOld} onCheckedChange={setOnlyOld} className="scale-75" />
              <span>القديمة فقط</span>
            </label>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-lg"
              onClick={loadData}
              title="تحديث البيانات"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border/60 text-[11px]">
                <th className="text-start py-2 font-medium">المستخدم</th>
                <th className="text-start font-medium">الإصدار المسجل</th>
                <th className="text-start font-medium">المنصة</th>
                <th className="text-start font-medium">آخر نشاط</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredClients.map((row) => {
                const isOld = row.version_code < latestCode;
                return (
                  <tr key={row.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 font-medium text-foreground truncate max-w-[120px]">{row.name}</td>
                    <td dir="ltr" className={cn("text-start font-mono text-[11px]", isOld ? "text-destructive font-bold" : "text-emerald-600 font-semibold")}>
                      v{row.version_name} ({row.version_code})
                    </td>
                    <td className="text-muted-foreground text-[11px]">{row.platform || 'web'}</td>
                    <td dir="ltr" className="text-start text-muted-foreground text-[10px]">
                      {row.last_seen_at ? new Date(row.last_seen_at).toLocaleDateString('en-GB') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredClients.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              {onlyOld ? 'رائع! لا توجد أي أجهزة تعمل بإصدارات قديمة 🎉' : 'لا توجد بيانات أجهزة مسجلة بعد'}
            </p>
          )}
        </div>
      </div>

      {/* نافذة تأكيد النشر المباشر (Confirmation Modal) */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Rocket className="w-5 h-5 text-primary" />
              تأكيد نشر التحديث العام للمستخدمين
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              يرجى مراجعة تفاصيل التحديث قبل بدء عملية البناء الآلي.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 border border-border/60">
              <div className="flex justify-between">
                <span className="text-muted-foreground">الإصدار المراد نشره:</span>
                <span className="font-bold text-foreground font-mono" dir="ltr">v{CURRENT_VERSION_NAME} (Build {CURRENT_VERSION_CODE})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">نوع التحديث:</span>
                <span className={cn("font-bold", releaseType === 'forced' ? 'text-destructive' : 'text-emerald-600')}>
                  {releaseType === 'forced' ? 'إجباري (إلزام)' : 'اختياري (سلس)'}
                </span>
              </div>
              {releaseType === 'forced' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">أقدم إصدار مسموح:</span>
                  <span className="font-bold text-foreground font-mono" dir="ltr">Build {minAllowedCode || CURRENT_VERSION_CODE}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">وجهة ملف الـ APK:</span>
                <span className="font-semibold text-primary">قناة Telegram الرسمية</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              ⚡ بمجرد التأكيد، ستقوم السحابة بتشغيل سير العمل الآلي لبناء ملف التطبيق وتوقيعه رقمياً، ثم رفعه كملف تثبيت مباشر داخل القناة وتحديث سياسة الأجهزة المتصلة.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isBusy}
              className="text-xs rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handlePublishConfirm}
              disabled={isBusy}
              className="text-xs font-bold rounded-xl gap-2 bg-primary text-primary-foreground"
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              تأكيد وبدء النشر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
