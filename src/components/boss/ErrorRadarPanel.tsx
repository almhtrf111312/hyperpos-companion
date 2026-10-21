import React, { useState, useEffect, useMemo } from 'react';
import { useUserRole } from '@/hooks/use-user-role';
import { useLanguage } from '@/hooks/use-language';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/lib/sonner-bridge';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Smartphone,
  Globe,
  RefreshCw,
  Search,
  Copy,
  Wifi,
  WifiOff,
  Terminal,
  Eye,
  ShieldAlert,
  FileDown,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ErrorRadarLog,
  getErrorRadarLogs,
  subscribeToErrorRadar,
  markErrorResolved,
  markErrorUnresolved,
  flushErrorRadarQueue,
  getErrorRadarQueueStats,
  exportErrorRadarLogsJSON,
} from '@/lib/error-radar';

const ITEMS_PER_PAGE = 10;

export function ErrorRadarPanel() {
  const { isBoss, isLoading: roleLoading } = useUserRole();
  const { direction } = useLanguage();

  const [logs, setLogs] = useState<ErrorRadarLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueStats, setQueueStats] = useState({ queueLength: 0, isFlushing: false });

  // الفلاتر والبحث
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'web' | 'android' | 'ios'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'error' | 'warning' | 'info'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ترقيم الصفحات
  const [currentPage, setCurrentPage] = useState(1);

  // السجل المختار للعرض التفصيلي
  const [selectedLog, setSelectedLog] = useState<ErrorRadarLog | null>(null);

  // تحديث البيانات (المحلية والمركزية للـ Boss)
  const refreshLogs = async () => {
    setIsLoading(true);
    try {
      // 1. جلب السجلات المحلية أولاً
      const localLogs = getErrorRadarLogs();
      
      // 2. إذا كان المستخدم Boss ومتصلاً بالإنترنت، جلب السجلات المركزية من Supabase
      if (isBoss && typeof navigator !== 'undefined' && navigator.onLine) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: remoteData, error } = await (supabase as any)
          .from('error_logs')
          .select('*')
          .order('occurred_at', { ascending: false })
          .limit(100);

        if (!error && remoteData && remoteData.length > 0) {
          // تحويل سجلات الخادم إلى تنسيق ErrorRadarLog
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mappedRemote: ErrorRadarLog[] = remoteData.map((row: any) => ({
            id: row.id,
            fingerprint: row.extra_context?.fingerprint || row.id,
            type: row.error_type || 'uncaught_error',
            severity: row.extra_context?.severity || 'error',
            message: row.error_message,
            stack: row.error_stack,
            componentStack: row.component_stack,
            route: row.page_url || '',
            device: {
              platform: row.platform || 'web',
              screen: row.screen_resolution || '',
              isOnline: row.was_online ?? true,
              language: row.device_language || 'ar',
            },
            userRole: row.extra_context?.user_role || (row.user_email ? 'admin' : 'anonymous'),
            occurrences: row.extra_context?.occurrences || 1,
            firstSeenAt: row.occurred_at || row.created_at,
            lastSeenAt: row.occurred_at || row.created_at,
            isResolved: row.is_resolved || false,
            breadcrumbs: row.extra_context?.breadcrumbs || [],
            syncStatus: 'synced',
          }));

          setLogs(mappedRemote);
          setQueueStats(getErrorRadarQueueStats());
          setIsLoading(false);
          return;
        }
      }

      // الرجوع للمحلي في حال عدم وجود اتصال أو تعذر الجلب
      setLogs(localLogs);
      setQueueStats(getErrorRadarQueueStats());
    } catch (err) {
      console.warn('[ErrorRadarPanel] Failed to load remote logs:', err);
      setLogs(getErrorRadarLogs());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshLogs();
    const unsubscribe = subscribeToErrorRadar(() => {
      refreshLogs();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // تصفية السجلات والبحث والترتيب من الأحدث للأقدم
  const filteredLogs = useMemo(() => {
    return logs
      .filter(log => {
        // فلتر الحالة
        if (statusFilter === 'unresolved' && log.isResolved) return false;
        if (statusFilter === 'resolved' && !log.isResolved) return false;

        // فلتر المنصة
        if (platformFilter !== 'all' && log.device?.platform !== platformFilter) return false;

        // فلتر الخطورة
        if (severityFilter !== 'all' && log.severity !== severityFilter) return false;

        // فلتر البحث بالمعرف أو محتوى الرسالة
        if (searchQuery.trim()) {
          const query = searchQuery.trim().toLowerCase();
          const matchId = log.id?.toLowerCase().includes(query);
          const matchMsg = log.message?.toLowerCase().includes(query);
          const matchRoute = log.route?.toLowerCase().includes(query);
          if (!matchId && !matchMsg && !matchRoute) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  }, [logs, statusFilter, platformFilter, severityFilter, searchQuery]);

  // إجمالي الصفحات
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  // إعادة الصفحة للأولى عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, platformFilter, severityFilter, searchQuery]);

  // إحصائيات سريعة
  const stats = useMemo(() => {
    const total = logs.length;
    const unresolved = logs.filter(l => !l.isResolved).length;
    const critical = logs.filter(l => l.severity === 'critical' && !l.isResolved).length;
    const resolved = logs.filter(l => l.isResolved).length;
    return { total, unresolved, critical, resolved };
  }, [logs]);

  // تبديل حالة الحل للخطأ
  const handleToggleResolve = async (log: ErrorRadarLog) => {
    const newResolvedState = !log.isResolved;
    try {
      let success = false;
      if (newResolvedState) {
        success = await markErrorResolved(log.id);
        if (success) {
          toast.success('تم تحديد الخطأ كمحلول بنجاح');
        } else {
          toast.error('تعذر تحديد الخطأ كمحلول');
        }
      } else {
        success = await markErrorUnresolved(log.id);
        if (success) {
          toast.info('تمت إعادة فتح الخطأ للمتابعة');
        } else {
          toast.error('تعذر إعادة فتح الخطأ');
        }
      }
      refreshLogs();
      if (selectedLog && selectedLog.id === log.id) {
        setSelectedLog(prev => prev ? { ...prev, isResolved: newResolvedState } : null);
      }
    } catch {
      toast.error('حدث خطأ أثناء تحديث حالة السجل');
    }
  };

  // المزامنة اليدوية مع الخادم
  const handleManualSync = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('الجهاز غير متصل بالإنترنت حالياً');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await flushErrorRadarQueue();
      if (result.synced > 0) {
        toast.success(`تمت مزامنة ${result.synced} سجل مع الخادم بنجاح`);
      } else if (result.failed > 0) {
        toast.info('تمت جدولة السجلات للمزامنة عند استقرار الاتصال أو توفر الجدول السحابي');
      } else {
        toast.info('جميع السجلات متزامنة بالفعل');
      }
      refreshLogs();
    } catch {
      toast.error('فشلت محاولة المزامنة');
    } finally {
      setIsSyncing(false);
    }
  };

  // تصدير ملف السجلات
  const handleExportJSON = () => {
    try {
      const json = exportErrorRadarLogsJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowpos-error-radar-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('تم تصدير ملف تقرير الأخطاء بنجاح');
    } catch {
      toast.error('تعذر تصدير السجلات');
    }
  };

  // نسخ محتوى الـ Stack Trace كنص خام
  const handleCopyText = (text?: string, label = 'النص') => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      toast.success(`تم نسخ ${label} إلى الحافظة`);
    } catch {
      toast.error('تعذر النسخ إلى الحافظة');
    }
  };

  // حماية صارمة: عرض شاشة الحجب إذا لم يكن المستخدم Boss
  if (roleLoading) {
    return (
      <Card className="border border-border/70 rounded-2xl p-8 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          <span>جاري التحقق من الصلاحيات الإدارية...</span>
        </div>
      </Card>
    );
  }

  if (!isBoss) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 rounded-2xl p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-destructive mb-1">صلاحية غير كافية</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          عذراً، الوصول إلى «رادار الأخطاء التشخيصي» مخصص حصراً لحساب Boss الرئيسي لحماية سرية النظام.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4" dir={direction}>
      {/* بطاقات الإحصاءات العلوية */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 shadow-none rounded-xl">
          <CardContent className="p-3 md:p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg md:text-xl font-bold leading-tight">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground truncate">إجمالي المسجل</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20 shadow-none rounded-xl">
          <CardContent className="p-3 md:p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg md:text-xl font-bold leading-tight">{stats.unresolved}</p>
              <p className="text-[11px] text-muted-foreground truncate">قيد المتابعة</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20 shadow-none rounded-xl">
          <CardContent className="p-3 md:p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg md:text-xl font-bold leading-tight">{stats.critical}</p>
              <p className="text-[11px] text-muted-foreground truncate">أخطاء حرجة</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 shadow-none rounded-xl">
          <CardContent className="p-3 md:p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg md:text-xl font-bold leading-tight">{stats.resolved}</p>
              <p className="text-[11px] text-muted-foreground truncate">تم حلها</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* شريط الإجراءات والبحث والفلترة */}
      <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="p-3 md:p-4 pb-2 bg-muted/20 border-b border-border/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                <Terminal className="w-5 h-5 text-primary" />
                <span>رادار تشخيص الأخطاء المباشر</span>
                <Badge variant="outline" className="text-[10px] font-mono font-medium">
                  Offline-First
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                سجل آمن وتلقائي للأعطال واستثناءات الجافاسكريبت مع عزل كامل للخصوصية.
              </CardDescription>
            </div>

            {/* أزرار الإجراءات السريعة */}
            <div className="flex items-center gap-1.5 self-end md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="h-8 text-xs gap-1.5"
                title="محاولة مزامنة السجلات المعلقة"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
                <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة الطابور'}</span>
                {queueStats.queueLength > 0 && (
                  <Badge variant="secondary" className="px-1 text-[10px] h-4">
                    {queueStats.queueLength}
                  </Badge>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJSON}
                className="h-8 text-xs gap-1.5"
                title="تصدير السجلات بصيغة JSON"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تصدير JSON</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsRefreshing(true);
                  refreshLogs();
                  setTimeout(() => setIsRefreshing(false), 400);
                }}
                disabled={isRefreshing}
                className="h-8 w-8 p-0"
                title="تحديث القائمة"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 md:p-4 space-y-3">
          {/* حقول البحث والفلترة */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* البحث */}
            <div className="relative">
              <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برمز الخطأ، الرسالة، أو المسار..."
                className="ps-9 h-9 text-xs"
              />
            </div>

            {/* فلتر الحالة */}
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="unresolved">قيد المتابعة فقط</SelectItem>
                <SelectItem value="resolved">تم الحل فقط</SelectItem>
              </SelectContent>
            </Select>

            {/* فلتر المنصة */}
            <Select value={platformFilter} onValueChange={(v: any) => setPlatformFilter(v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="المنصة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المنصات</SelectItem>
                <SelectItem value="web">متصفح الويب (Web)</SelectItem>
                <SelectItem value="android">أندرويد (Android)</SelectItem>
                <SelectItem value="ios">آبل (iOS)</SelectItem>
              </SelectContent>
            </Select>

            {/* فلتر الخطورة */}
            <Select value={severityFilter} onValueChange={(v: any) => setSeverityFilter(v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="درجة الخطورة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع درجات الخطورة</SelectItem>
                <SelectItem value="critical">حرج (Critical)</SelectItem>
                <SelectItem value="error">خطأ (Error)</SelectItem>
                <SelectItem value="warning">تحذير (Warning)</SelectItem>
                <SelectItem value="info">تشخيصي (Info)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* قائمة السجلات */}
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
              <p>جاري قراءة سجلات رادار الأخطاء...</p>
            </div>
          ) : paginatedLogs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground rounded-xl border border-dashed border-border/80 bg-muted/10 p-6">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/80 mb-2" />
              <p className="text-sm font-semibold text-foreground">لا توجد أخطاء تطابق معايير البحث</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                النظام يعمل بكفاءة. عند حدوث أي استثناء أو خطأ غير معالج سيظهر هنا تلقائياً دون تعطيل المستخدمين.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedLogs.map((log) => {
                const isCritical = log.severity === 'critical';
                const isWarning = log.severity === 'warning';
                const isInfo = log.severity === 'info';

                return (
                  <div
                    key={log.id}
                    className={`p-3 md:p-3.5 rounded-xl border transition-all duration-200 ${
                      log.isResolved
                        ? 'bg-muted/20 border-border/60 opacity-80'
                        : isCritical
                        ? 'bg-rose-500/[0.04] border-rose-500/30 dark:bg-rose-950/20'
                        : isWarning
                        ? 'bg-amber-500/[0.04] border-amber-500/30 dark:bg-amber-950/20'
                        : 'bg-card border-border/80 shadow-xs hover:border-primary/40'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      {/* تفاصيل السجل */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* شارة الخطورة */}
                          <Badge
                            variant={isCritical ? 'destructive' : isWarning ? 'secondary' : 'outline'}
                            className={`text-[10px] uppercase font-bold px-1.5 py-0 ${
                              isCritical
                                ? 'bg-rose-600 text-white'
                                : isWarning
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                : isInfo
                                ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30'
                                : ''
                            }`}
                          >
                            {log.severity}
                          </Badge>

                          {/* حالة الحل */}
                          {log.isResolved ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-medium">
                              <Check className="w-3 h-3 me-0.5" />
                              تم الحل
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30 font-medium">
                              قيد المتابعة
                            </Badge>
                          )}

                          {/* رمز المنصة */}
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
                            {log.device?.platform === 'android' ? (
                              <Smartphone className="w-3 h-3 text-emerald-600" />
                            ) : log.device?.platform === 'ios' ? (
                              <Smartphone className="w-3 h-3 text-blue-600" />
                            ) : (
                              <Globe className="w-3 h-3 text-sky-600" />
                            )}
                            <span className="capitalize">{log.device?.platform || 'web'}</span>
                          </span>

                          {/* حالة الشبكة أثناء الخطأ */}
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-md">
                            {log.device?.isOnline ? (
                              <Wifi className="w-2.5 h-2.5 text-emerald-500" />
                            ) : (
                              <WifiOff className="w-2.5 h-2.5 text-rose-500" />
                            )}
                            <span>{log.device?.isOnline ? 'Online' : 'Offline'}</span>
                          </span>

                          {/* عداد التكرار */}
                          {log.occurrences > 1 && (
                            <Badge variant="secondary" className="text-[10px] font-mono font-bold bg-muted px-1.5 py-0">
                              تكرر {log.occurrences}×
                            </Badge>
                          )}

                          {/* معرف الخطأ */}
                          <span className="text-[10px] font-mono text-muted-foreground select-all">
                            {log.id}
                          </span>
                        </div>

                        {/* نص رسالة الخطأ المطهرة */}
                        <p className="text-xs sm:text-sm font-semibold text-foreground break-words line-clamp-2">
                          {log.message}
                        </p>

                        {/* معلومات المسار والوقت والدور */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            <code className="text-[10px] bg-muted/70 px-1 py-0.2 rounded font-mono">
                              {log.route || '/'}
                            </code>
                          </span>

                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(log.lastSeenAt).toLocaleString('ar-SA')}</span>
                          </span>

                          <span className="text-[10px] bg-muted/50 px-1.5 py-0.2 rounded">
                            الدور: <span className="font-medium text-foreground">{log.userRole}</span>
                          </span>
                        </div>
                      </div>

                      {/* أزرار الإجراءات للسطر */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center pt-1 sm:pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>تفاصيل</span>
                        </Button>

                        <Button
                          variant={log.isResolved ? 'ghost' : 'default'}
                          size="sm"
                          onClick={() => handleToggleResolve(log)}
                          className={`h-7 px-2 text-xs gap-1 ${
                            log.isResolved
                              ? 'text-muted-foreground hover:text-foreground'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {log.isResolved ? (
                            <>
                              <RotateCcw className="w-3 h-3" />
                              <span>إعادة فتح</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3" />
                              <span>تم الحل</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* شريط ترقيم الصفحات (Pagination) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <div>
                <span>صفحة {currentPage} من {totalPages}</span>
                <span className="ms-1 font-mono">({filteredLogs.length} سجل)</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* نافذة عرض تفاصيل الخطأ (Plain-Text Stack Trace Dialog) */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-4 md:p-6" dir={direction}>
          {selectedLog && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={selectedLog.severity === 'critical' ? 'destructive' : 'outline'}
                    className="text-[10px] uppercase font-bold"
                  >
                    {selectedLog.severity}
                  </Badge>
                  <DialogTitle className="text-sm md:text-base font-bold break-words flex-1 text-start">
                    تفاصيل السجل التشخيصي
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs font-mono select-all text-start pt-1 text-muted-foreground">
                  المعرف: {selectedLog.id}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-3.5 py-2 pe-1 text-xs">
                {/* رسالة الخطأ */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">رسالة الخطأ المطهرة (Message):</p>
                  <p className="text-xs sm:text-sm font-mono font-medium text-foreground select-all break-words">
                    {selectedLog.message}
                  </p>
                </div>

                {/* بطاقات البيانات الوصفية (Metadata Grid) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-card border">
                    <p className="text-[10px] text-muted-foreground">نوع المصدر (Source)</p>
                    <p className="font-semibold text-foreground text-xs mt-0.5">{selectedLog.type}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border">
                    <p className="text-[10px] text-muted-foreground">المسار (Route)</p>
                    <p className="font-mono text-foreground text-xs mt-0.5 truncate">{selectedLog.route}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border">
                    <p className="text-[10px] text-muted-foreground">المنصة والشاشة</p>
                    <p className="font-medium text-foreground text-xs mt-0.5">
                      {selectedLog.device?.platform} ({selectedLog.device?.screen})
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border">
                    <p className="text-[10px] text-muted-foreground">حالة الاتصال واللغة</p>
                    <p className="font-medium text-foreground text-xs mt-0.5">
                      {selectedLog.device?.isOnline ? 'Online' : 'Offline'} • {selectedLog.device?.language}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border">
                    <p className="text-[10px] text-muted-foreground">أول ظهور</p>
                    <p className="text-[11px] text-foreground mt-0.5">
                      {new Date(selectedLog.firstSeenAt).toLocaleString('ar-SA')}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border">
                    <p className="text-[10px] text-muted-foreground">آخر ظهور</p>
                    <p className="text-[11px] text-foreground mt-0.5">
                      {new Date(selectedLog.lastSeenAt).toLocaleString('ar-SA')}
                    </p>
                  </div>
                </div>

                {/* شريط الإجراءات والمسار الأخير (Breadcrumbs) */}
                {selectedLog.breadcrumbs && selectedLog.breadcrumbs.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>الإجراءات الأخيرة السابقة للخطأ (Breadcrumbs - أقصى حد 10):</span>
                    </p>
                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border/80 space-y-1 max-h-36 overflow-y-auto font-mono text-[11px]">
                      {selectedLog.breadcrumbs.map((b, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-muted-foreground py-0.5 border-b border-border/40 last:border-0">
                          <span className="text-[10px] text-muted-foreground/70 shrink-0">
                            {new Date(b.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-primary shrink-0">
                            [{b.category}]
                          </span>
                          <span className="text-foreground truncate select-all">{b.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* تفاصيل مسار المكونات (Component Stack) */}
                {selectedLog.componentStack && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        مسار المكوّنات التفاعلية (Component Stack):
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyText(selectedLog.componentStack, 'Component Stack')}
                        className="h-6 px-1.5 text-[10px] gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>نسخ</span>
                      </Button>
                    </div>
                    {/* عرض كنص خام حصراً دون تصيير HTML لحماية الأمان */}
                    <pre className="select-all whitespace-pre-wrap font-mono text-[11px] leading-relaxed p-3 rounded-xl bg-muted/60 text-foreground border border-border/70 overflow-x-auto max-h-40">
                      {selectedLog.componentStack}
                    </pre>
                  </div>
                )}

                {/* تتبع المكدس البرمجي (Stack Trace) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      تتبع المكدس البرمجي (Stack Trace - نص خام محمي):
                    </p>
                    {selectedLog.stack && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyText(selectedLog.stack, 'Stack Trace')}
                        className="h-6 px-1.5 text-[10px] gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>نسخ المكدس</span>
                      </Button>
                    )}
                  </div>
                  {/* عرض كنص خام حصراً لمنع ثغرات XSS أو تشويه الواجهة */}
                  <pre className="select-all whitespace-pre-wrap font-mono text-[11px] leading-relaxed p-3 rounded-xl bg-muted/80 text-foreground border border-border/80 overflow-x-auto max-h-56">
                    {selectedLog.stack || 'لا يتوفر تتبع مكدس إضافي (Uncaught event or string exception)'}
                  </pre>
                </div>
              </div>

              <DialogFooter className="pt-2 border-t flex flex-row items-center justify-between gap-2">
                <Button
                  variant={selectedLog.isResolved ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => handleToggleResolve(selectedLog)}
                  className={`text-xs gap-1.5 ${
                    !selectedLog.isResolved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                  }`}
                >
                  {selectedLog.isResolved ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة فتح الخطأ</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تحديد الخطأ كمحلول</span>
                    </>
                  )}
                </Button>

                <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)} className="text-xs">
                  إغلاق
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
