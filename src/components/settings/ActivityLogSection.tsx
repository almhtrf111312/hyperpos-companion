import { useState, useEffect, useMemo } from 'react';
import {
  Activity, User, Filter, Trash2, ShoppingCart, CreditCard,
  Tag, Search, ChevronDown, ChevronUp, FileText,
  Clock, Undo2, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { loadActivityLogs, clearActivityLogs, ActivityLog, ActivityType, activityTypeLabels } from '@/lib/activity-log';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { supabase } from '@/integrations/supabase/client';

type FilterCategory = 'all' | 'pricing' | 'sales' | 'debts' | 'auth';

export function ActivityLogSection() {
  const { isRTL, language } = useLanguage();
  const isAr = language === 'ar';

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [specificFilter, setSpecificFilter] = useState<ActivityType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [customFilterOpen, setCustomFilterOpen] = useState(false);

  useEffect(() => {
    setLogs(loadActivityLogs());

    // جلب الأرشيف المحفوظ على Supabase لعرضه ومزامنته عبر كل الأجهزة
    const fetchCloudLogs = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: cloudRows, error } = await (supabase as any)
          .from('activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && Array.isArray(cloudRows) && cloudRows.length > 0) {
          const cloudLogs: ActivityLog[] = cloudRows.map(row => ({
            id: row.id,
            type: row.action_type as ActivityType,
            userId: row.actor_id || row.user_id,
            userName: row.actor_name || 'مستخدم',
            description: row.description || '',
            details: (row.metadata as Record<string, unknown>) || {},
            timestamp: row.created_at,
          }));

          setLogs(prev => {
            const existingIds = new Set(prev.map(l => l.id));
            const existingKeys = new Set(prev.map(l => `${l.type}_${l.description}_${l.timestamp.slice(0, 16)}`));
            const newFromCloud = cloudLogs.filter(cl => 
              !existingIds.has(cl.id) && !existingKeys.has(`${cl.type}_${cl.description}_${cl.timestamp.slice(0, 16)}`)
            );
            return [...prev, ...newFromCloud].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        }
      } catch (err) {
        console.warn('[ActivityLogSection] Failed to load cloud logs:', err);
      }
    };

    fetchCloudLogs();
  }, []);

  const handleClearLogs = () => {
    clearActivityLogs();
    setLogs([]);
    setClearDialogOpen(false);
  };

  // التصنيف حسب الفئات المطلوبة في التصميم
  const isPricingLog = (log: ActivityLog) => {
    if (log.type === 'product_updated') return true;
    const details = log.details || {};
    const changes = details.changes as Record<string, unknown> | undefined;
    return !!(changes && (changes.salePrice || changes.costPrice || changes.price));
  };

  const isSalesLog = (log: ActivityLog) => {
    return ['sale', 'invoice_created', 'invoice_refunded', 'invoice_updated', 'refund'].includes(log.type);
  };

  const isDebtsLog = (log: ActivityLog) => {
    return ['debt_created', 'debt_paid', 'debt_payment', 'debt_writeoff', 'debt_deleted'].includes(log.type);
  };

  const isAuthLog = (log: ActivityLog) => {
    return ['login', 'logout', 'shift_opened', 'shift_closed', 'password_changed', 'user_added', 'user_deleted'].includes(log.type);
  };

  // فلترة السجلات
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. فلتر الفئة الرئيسية
      if (selectedCategory === 'pricing' && !isPricingLog(log)) return false;
      if (selectedCategory === 'sales' && !isSalesLog(log)) return false;
      if (selectedCategory === 'debts' && !isDebtsLog(log)) return false;
      if (selectedCategory === 'auth' && !isAuthLog(log)) return false;

      // 2. فلتر مخصص للنوع
      if (specificFilter && log.type !== specificFilter) return false;

      // 3. فلتر البحث
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const descMatch = (log.description || '').toLowerCase().includes(query);
        const userMatch = (log.userName || '').toLowerCase().includes(query);
        const detailsStr = JSON.stringify(log.details || {}).toLowerCase();
        const detailsMatch = detailsStr.includes(query);
        return descMatch || userMatch || detailsMatch;
      }

      return true;
    });
  }, [logs, selectedCategory, specificFilter, searchQuery]);

  // وقت نسبي باللغتين
  const formatRelativeTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (isAr) {
      if (minutes < 1) return 'الآن';
      if (minutes < 60) return `منذ ${minutes} دقيقة`;
      if (hours < 24) return `منذ ${hours} ساعات`;
      if (days < 7) return `منذ ${days} أيام`;
      return new Date(timestamp).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
    } else {
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="w-full max-w-[430px] mx-auto space-y-3 text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 1. Header Row (Sticky Header matching mockup) */}
      <header className="bg-white/95 dark:bg-card/95 backdrop-blur-md border border-zinc-200/90 dark:border-border/80 rounded-2xl px-3.5 py-3 space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <h1 className="text-sm font-bold text-zinc-900 dark:text-foreground leading-tight">
                  {isAr ? 'سجل النشاطات والعمليات' : 'Activity & Operations Log'}
                </h1>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                {isAr ? 'تدقيق حركات المتجر والمستخدمين' : 'Audit store events and user actions'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setClearDialogOpen(true)}
            disabled={logs.length === 0}
            className="h-8 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
            title={isAr ? 'مسح سجل النشاط' : 'Clear Log'}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>{isAr ? 'مسح السجل' : 'Clear Log'}</span>
          </button>
        </div>

        {/* 2. Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 text-xs font-semibold">
          {/* All */}
          <button
            onClick={() => { setSelectedCategory('all'); setSpecificFilter(null); }}
            className={cn(
              "px-3 py-1.5 rounded-xl shrink-0 transition shadow-xs",
              selectedCategory === 'all' && !specificFilter
                ? "bg-zinc-900 text-white dark:bg-primary dark:text-primary-foreground font-bold"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-muted dark:hover:bg-muted/80 text-zinc-600 dark:text-muted-foreground"
            )}
          >
            {isAr ? `الكل (${logs.length})` : `All (${logs.length})`}
          </button>

          {/* Pricing */}
          <button
            onClick={() => { setSelectedCategory('pricing'); setSpecificFilter(null); }}
            className={cn(
              "px-3 py-1.5 rounded-xl shrink-0 transition flex items-center gap-1 shadow-xs",
              selectedCategory === 'pricing'
                ? "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 font-bold"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-muted dark:hover:bg-muted/80 text-zinc-600 dark:text-muted-foreground"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>{isAr ? 'تعديل الأسعار' : 'Price Updates'}</span>
          </button>

          {/* Sales */}
          <button
            onClick={() => { setSelectedCategory('sales'); setSpecificFilter(null); }}
            className={cn(
              "px-3 py-1.5 rounded-xl shrink-0 transition flex items-center gap-1 shadow-xs",
              selectedCategory === 'sales'
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-muted dark:hover:bg-muted/80 text-zinc-600 dark:text-muted-foreground"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{isAr ? 'المبيعات والفواتير' : 'Sales & Invoices'}</span>
          </button>

          {/* Debts */}
          <button
            onClick={() => { setSelectedCategory('debts'); setSpecificFilter(null); }}
            className={cn(
              "px-3 py-1.5 rounded-xl shrink-0 transition flex items-center gap-1 shadow-xs",
              selectedCategory === 'debts'
                ? "bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 font-bold"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-muted dark:hover:bg-muted/80 text-zinc-600 dark:text-muted-foreground"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>{isAr ? 'الديون والتحصيل' : 'Debts & Collections'}</span>
          </button>

          {/* Auth */}
          <button
            onClick={() => { setSelectedCategory('auth'); setSpecificFilter(null); }}
            className={cn(
              "px-3 py-1.5 rounded-xl shrink-0 transition flex items-center gap-1 shadow-xs",
              selectedCategory === 'auth'
                ? "bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 font-bold"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-muted dark:hover:bg-muted/80 text-zinc-600 dark:text-muted-foreground"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>{isAr ? 'دخول وخروج' : 'Sessions & Shifts'}</span>
          </button>

          {/* Custom Filter */}
          <button
            onClick={() => setCustomFilterOpen(true)}
            className={cn(
              "px-2.5 py-1.5 rounded-xl shrink-0 transition flex items-center gap-1 text-[11px]",
              specificFilter
                ? "bg-primary/20 text-primary border border-primary/40 font-bold"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-muted text-zinc-600 dark:text-muted-foreground"
            )}
            title={isAr ? 'تصفية مخصصة' : 'Custom Filter'}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{specificFilter ? (activityTypeLabels[specificFilter]?.[isAr ? 'ar' : 'en'] || specificFilter) : (isAr ? 'تصفية مخصصة' : 'Custom')}</span>
          </button>
        </div>
      </header>

      {/* 3. Search Bar + Quick Indicators */}
      <div className="px-3 py-2 bg-slate-50 dark:bg-muted/30 border border-zinc-200 dark:border-border/80 rounded-xl flex items-center justify-between text-xs">
        <div className="relative flex-1 max-w-[250px]">
          <span className={cn("absolute inset-y-0 flex items-center pointer-events-none text-zinc-400", isRTL ? "right-2.5" : "left-2.5")}>
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث بالمنتج، العميل، المستخدم...' : 'Search product, customer, user...'}
            className={cn(
              "w-full bg-white dark:bg-card border border-zinc-200 dark:border-border/70 rounded-lg py-1 text-xs text-zinc-800 dark:text-foreground placeholder-zinc-400 focus:outline-none focus:border-blue-600",
              isRTL ? "pr-8 pl-2" : "pl-8 pr-2"
            )}
          />
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>{isAr ? `عرض ${filteredLogs.length} عمليات` : `Showing ${filteredLogs.length} items`}</span>
        </div>
      </div>

      {/* 4. Logs Container */}
      <div className="space-y-2.5 max-h-[640px] overflow-y-auto no-scrollbar pb-6">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center space-y-2 border border-dashed border-zinc-200 dark:border-border/80 rounded-2xl bg-white dark:bg-card">
            <div className="text-3xl">🔍</div>
            <p className="text-xs font-bold text-zinc-700 dark:text-foreground">
              {isAr ? 'لا توجد نشاطات مطابقة للبحث أو التصفية' : 'No matching activities found'}
            </p>
            <p className="text-[11px] text-zinc-400">
              {isAr ? 'جرّب تغيير التصنيف أو كلمات البحث' : 'Try changing category or search query'}
            </p>
          </div>
        ) : (
          filteredLogs.map(log => (
            <ActivityCard
              key={log.id}
              log={log}
              isAr={isAr}
              isRTL={isRTL}
              timeText={formatRelativeTime(log.timestamp)}
              isExpanded={expandedLogId === log.id}
              onToggle={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
            />
          ))
        )}
      </div>

      {/* 5. Clear Confirmation Modal */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-xs rounded-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-lg mt-2">
            🗑️
          </div>
          <DialogHeader className="text-center space-y-1">
            <DialogTitle className="text-xs font-bold text-zinc-900 dark:text-foreground text-center">
              {isAr ? 'مسح سجل الحركات؟' : 'Clear Activity Log?'}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-zinc-500 text-center">
              {isAr ? 'هل أنت متأكد من مسح جميع سجلات التدقيق؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to clear all audit logs? This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-semibold">
            <Button variant="outline" onClick={() => setClearDialogOpen(false)} className="rounded-xl border border-zinc-200 bg-zinc-50 dark:bg-muted text-zinc-700 dark:text-muted-foreground hover:bg-zinc-100">
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleClearLogs} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold">
              {isAr ? 'نعم، مسح السجل' : 'Yes, Clear'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. Custom Filter Modal */}
      <Dialog open={customFilterOpen} onOpenChange={setCustomFilterOpen}>
        <DialogContent className="max-w-xs rounded-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-xs font-bold text-zinc-900 dark:text-foreground flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span>{isAr ? 'تصفية دقيقة للحركات' : 'Filter by Operation'}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto py-1">
            <button
              onClick={() => { setSpecificFilter(null); setCustomFilterOpen(false); }}
              className={cn(
                "p-2 rounded-lg border text-[11px] text-start transition font-medium",
                !specificFilter ? "border-primary bg-primary/10 text-primary font-bold" : "border-zinc-200 dark:border-border hover:bg-zinc-50 dark:hover:bg-muted/40"
              )}
            >
              {isAr ? 'جميع العمليات' : 'All Operations'}
            </button>
            {Object.keys(activityTypeLabels).map(typeKey => {
              const type = typeKey as ActivityType;
              const isSelected = specificFilter === type;
              return (
                <button
                  key={type}
                  onClick={() => { setSpecificFilter(type); setCustomFilterOpen(false); }}
                  className={cn(
                    "p-2 rounded-lg border text-[11px] text-start transition font-medium truncate",
                    isSelected ? "border-primary bg-primary/10 text-primary font-bold" : "border-zinc-200 dark:border-border hover:bg-zinc-50 dark:hover:bg-muted/40"
                  )}
                >
                  {activityTypeLabels[type]?.[isAr ? 'ar' : 'en'] || type}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// 🎨 Activity Card Component
// ==========================================
interface ActivityCardProps {
  log: ActivityLog;
  isAr: boolean;
  isRTL: boolean;
  timeText: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function ActivityCard({ log, isAr, isRTL, timeText, isExpanded, onToggle }: ActivityCardProps) {
  const details = (log.details as Record<string, unknown>) || {};
  const changes = (details.changes as Record<string, unknown>) || {};

  // تصنيف نوع النشاط بدقة
  const isPricing = log.type === 'product_updated' && !!(changes.salePrice || changes.costPrice || changes.price);
  const isDebt = log.type === 'debt_created' || (log.type === 'sale' && (details.paymentType === 'debt' || details.paymentType === 'split'));
  const isCash = log.type === 'sale' && details.paymentType !== 'debt' && details.paymentType !== 'split';
  const isDebtPay = log.type === 'debt_paid' || log.type === 'debt_payment';
  const isRefund = ['invoice_refunded', 'invoice_refund', 'refund', 'partial_refund'].includes(log.type) ||
                   (details.refund_amount !== undefined || details.restored_units !== undefined);

  // إعدادات المظهر المالي والأيقونات المطابقة للـ Mockup
  let iconEmoji = '📄';
  let iconClass = 'bg-zinc-50 border-zinc-200 text-zinc-700 dark:bg-muted dark:border-border';
  let badgeLabel = activityTypeLabels[log.type]?.[isAr ? 'ar' : 'en'] || log.type;
  let badgeClass = 'bg-zinc-50 text-zinc-800 border-zinc-200 dark:bg-muted dark:text-foreground dark:border-border';
  
  let leftAmount: string | null = null;
  let leftStatus: string | null = null;
  let leftClass = 'text-zinc-900 dark:text-foreground';

  if (isPricing) {
    iconEmoji = '🏷️';
    iconClass = 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300';
    badgeLabel = isAr ? 'تعديل تسعيرة منتج' : 'Price Adjustment';
    badgeClass = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800/60';
  } else if (isDebt) {
    iconEmoji = '📝';
    iconClass = 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-800/60 dark:text-purple-300';
    badgeLabel = isAr ? 'إنشاء دين / فاتورة آجل' : 'Credit Sale';
    badgeClass = 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800/60';
    const amountVal = Number(details.total || details.debtRemaining || details.amount || 0);
    leftAmount = `$${amountVal.toFixed(2)}`;
    leftStatus = isAr ? 'ذمة معلقة' : 'Pending Debt';
    leftClass = 'text-rose-600 dark:text-rose-400';
  } else if (isCash) {
    iconEmoji = '🛒';
    iconClass = 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300';
    badgeLabel = isAr ? 'عملية بيع نقدي' : 'Cash Sale';
    badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800/60';
    const amountVal = Number(details.total || details.amount || 0);
    leftAmount = `$${amountVal.toFixed(2)}`;
    leftStatus = isAr ? 'مسدد نقداً ✓' : 'Paid in Cash ✓';
    leftClass = 'text-emerald-700 dark:text-emerald-400';
  } else if (isDebtPay) {
    iconEmoji = '💳';
    iconClass = 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-300';
    badgeLabel = isAr ? 'تسديد دين' : 'Debt Payment';
    badgeClass = 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800/60';
    const amountVal = Number(details.amount || details.total || 0);
    leftAmount = `$${amountVal.toFixed(2)}`;
    leftStatus = isAr ? 'تم القبض ✓' : 'Collected ✓';
    leftClass = 'text-blue-700 dark:text-blue-400';
  } else if (isRefund) {
    iconEmoji = '↩️';
    iconClass = 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300';
    badgeLabel = isAr ? (log.type === 'partial_refund' ? 'استرداد جزئي' : 'استرداد فاتورة') : 'Refund';
    badgeClass = 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800/60';
    const refundVal = Number(details.refund_amount || details.refundAmount || details.amount || details.total || 0);
    if (refundVal > 0) {
      leftAmount = `$${refundVal.toFixed(2)}`;
      leftStatus = isAr ? 'مسترد من الصندوق' : 'Refunded';
      leftClass = 'text-rose-600 dark:text-rose-400';
    }
  }

  // استخراج العنوان الأنيق
  const cardTitle = useMemo(() => {
    if (details.name && typeof details.name === 'string') return details.name;
    return log.description;
  }, [details.name, log.description]);

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-zinc-200 dark:border-border/80 p-3 shadow-card space-y-2.5 transition">
      {/* 1. Header of the Card */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5">
          {/* Activity Emoji / Icon Container */}
          <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 text-sm font-bold", iconClass)}>
            {iconEmoji}
          </div>

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", badgeClass)}>
                {badgeLabel}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {timeText}
              </span>
            </div>

            <h3 className="text-xs font-bold text-zinc-900 dark:text-foreground mt-1 leading-snug">
              {cardTitle}
            </h3>
          </div>
        </div>

        {/* User Identity or Top Amount */}
        <div className={cn("shrink-0", isRTL ? "text-left" : "text-right")}>
          {leftAmount ? (
            <div>
              <span className={cn("text-xs font-black font-mono numeric-tabular block", leftClass)}>
                {leftAmount}
              </span>
              {leftStatus && (
                <span className={cn("text-[10px] font-semibold", leftClass)}>
                  {leftStatus}
                </span>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-muted px-2 py-0.5 rounded-md border border-zinc-200/70 dark:border-border/70">
              <User className="w-3 h-3 text-zinc-400" />
              <span>{isAr ? `المستخدم: ${log.userName}` : log.userName}</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Show/Hide Details Toggle Button */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 pt-1.5 border-t border-zinc-100 dark:border-border/50 transition cursor-pointer"
      >
        <span>{isExpanded ? (isAr ? 'إخفاء التفاصيل' : 'Hide details') : (isAr ? 'عرض التفاصيل' : 'Show details')}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transform transition-transform duration-200", isExpanded && "rotate-180")} />
      </button>

      {/* 3. Expanded Details Section */}
      {isExpanded && (
        <div className="space-y-2 text-xs overflow-hidden pt-1 animate-in fade-in-50 duration-200">
          {isPricing ? (
            <PriceComparisonTable changes={changes} isAr={isAr} />
          ) : isDebt ? (
            <DebtDetailsGrid details={details} userName={log.userName} isAr={isAr} />
          ) : isCash ? (
            <CashDetailsBox details={details} isAr={isAr} />
          ) : isDebtPay ? (
            <DebtPaymentDetailsBox details={details} isAr={isAr} />
          ) : isRefund ? (
            <RefundDetailsBox details={details} isAr={isAr} />
          ) : (
            <GenericDetailsBox details={details} isAr={isAr} />
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 📊 1. Price Comparison Table
// ==========================================
function PriceComparisonTable({ changes, isAr }: { changes: Record<string, unknown>; isAr: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saleChange = (changes.salePrice || changes.price) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const costChange = changes.costPrice as any;

  const oldCost = costChange?.from !== undefined ? Number(costChange.from) : null;
  const newCost = costChange?.to !== undefined ? Number(costChange.to) : (oldCost ?? 0);

  const oldSale = saleChange?.from !== undefined ? Number(saleChange.from) : null;
  const newSale = saleChange?.to !== undefined ? Number(saleChange.to) : (oldSale ?? 0);

  const costDiff = oldCost !== null && newCost !== null ? newCost - oldCost : 0;
  const saleDiff = oldSale !== null && newSale !== null ? newSale - oldSale : 0;

  const oldProfit = oldSale !== null && oldCost !== null ? oldSale - oldCost : 0;
  const newProfit = newSale !== null && newCost !== null ? newSale - newCost : 0;

  const oldMargin = oldSale && oldSale > 0 ? (oldProfit / oldSale) * 100 : 0;
  const newMargin = newSale && newSale > 0 ? (newProfit / newSale) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Modification source banner */}
      <div className="flex items-center justify-between bg-zinc-50 dark:bg-muted/40 px-2.5 py-1.5 rounded-lg border border-zinc-200/60 dark:border-border/60 text-[11px]">
        <span className="text-zinc-500 font-medium">{isAr ? 'مصدر التعديل:' : 'Source:'}</span>
        <span className="font-bold text-zinc-800 dark:text-foreground">
          {isAr ? 'تعديل يدوي مباشر من بطاقة الصنف' : 'Direct manual edit from product card'}
        </span>
      </div>

      {/* Comparison Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-border overflow-hidden">
        <div className="bg-zinc-100 dark:bg-muted px-3 py-1.5 grid grid-cols-3 text-[11px] font-bold text-zinc-500 dark:text-muted-foreground text-center">
          <div className="text-start">{isAr ? 'نوع السعر' : 'Price Type'}</div>
          <div>{isAr ? 'السابق (القديم)' : 'Old (Previous)'}</div>
          <div>{isAr ? 'المعتمد (الجديد)' : 'New (Confirmed)'}</div>
        </div>

        {/* Row 1: Cost Price */}
        <div className="px-3 py-2 grid grid-cols-3 text-xs items-center text-center border-t border-zinc-100 dark:border-border/40 bg-white dark:bg-card">
          <div className="text-start font-medium text-zinc-700 dark:text-foreground flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
            <span>{isAr ? 'رأس المال (الشراء)' : 'Cost Price'}</span>
          </div>
          <div className="font-mono text-zinc-500 line-through numeric-tabular">
            {oldCost !== null ? `$${oldCost.toFixed(2)}` : '—'}
          </div>
          <div className="font-mono font-bold text-zinc-900 dark:text-foreground numeric-tabular flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400">
            <span>${newCost.toFixed(2)}</span>
            {costDiff !== 0 && (
              <span className="text-[10px] text-zinc-400 font-normal">
                ({costDiff > 0 ? `+$${costDiff.toFixed(2)}` : `-$${Math.abs(costDiff).toFixed(2)}`})
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Sale Price */}
        <div className="px-3 py-2 grid grid-cols-3 text-xs items-center text-center border-t border-zinc-100 dark:border-border/40 bg-blue-50/30 dark:bg-blue-950/20">
          <div className="text-start font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
            <span>{isAr ? 'سعر البيع (المعتمد)' : 'Sale Price'}</span>
          </div>
          <div className="font-mono text-zinc-500 line-through numeric-tabular">
            {oldSale !== null ? `$${oldSale.toFixed(2)}` : '—'}
          </div>
          <div className="font-mono font-black text-blue-700 dark:text-blue-400 numeric-tabular flex items-center justify-center gap-1">
            <span>${newSale.toFixed(2)}</span>
            {saleDiff !== 0 && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                ({saleDiff > 0 ? `+$${saleDiff.toFixed(2)} ↗` : `-$${Math.abs(saleDiff).toFixed(2)} ↘`})
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Expected Margin */}
        <div className="px-3 py-2 grid grid-cols-3 text-xs items-center text-center border-t border-zinc-100 dark:border-border/40 bg-emerald-50/30 dark:bg-emerald-950/20">
          <div className="text-start font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
            <span>{isAr ? 'هامش الربح المتوقع' : 'Expected Margin'}</span>
          </div>
          <div className="font-mono text-zinc-500 numeric-tabular">
            {oldCost !== null && oldSale !== null ? `$${oldProfit.toFixed(2)} (${oldMargin.toFixed(0)}%)` : '—'}
          </div>
          <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 numeric-tabular">
            ${newProfit.toFixed(2)} ({newMargin.toFixed(1)}%)
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 📝 2. Debt Sale Grid (2x2)
// ==========================================
function DebtDetailsGrid({ details, userName, isAr }: { details: Record<string, unknown>; userName?: string; isAr: boolean }) {
  const total = Number(details.total || details.amount || 0);
  const itemsCount = Number(details.itemsCount || 1);
  const downPayment = Number(details.downPayment || 0);
  const debtRemaining = Number(details.debtRemaining || (total - downPayment));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {/* Total Invoice */}
        <div className="p-2 rounded-xl bg-zinc-50 dark:bg-muted/40 border border-zinc-200/80 dark:border-border/80">
          <span className="text-[10px] text-zinc-500 block">{isAr ? 'إجمالي الفاتورة:' : 'Invoice Total:'}</span>
          <span className="font-bold text-zinc-900 dark:text-foreground font-mono numeric-tabular text-xs">${total.toFixed(2)}</span>
        </div>

        {/* Items Sold */}
        <div className="p-2 rounded-xl bg-zinc-50 dark:bg-muted/40 border border-zinc-200/80 dark:border-border/80">
          <span className="text-[10px] text-zinc-500 block">{isAr ? 'عدد المنتجات المباعة:' : 'Sold Items Count:'}</span>
          <span className="font-bold text-zinc-900 dark:text-foreground font-mono numeric-tabular text-xs">
            {isAr ? `${itemsCount} صنف (قطعة)` : `${itemsCount} item(s)`}
          </span>
        </div>

        {/* Down Payment */}
        <div className="p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-medium">
            {isAr ? 'الدفعة المستلمة نقداً:' : 'Cash Received:'}
          </span>
          <span className="font-bold text-emerald-800 dark:text-emerald-300 font-mono numeric-tabular text-xs">${downPayment.toFixed(2)}</span>
        </div>

        {/* Remaining Debt */}
        <div className="p-2 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60">
          <span className="text-[10px] text-rose-700 dark:text-rose-400 block font-medium">
            {isAr ? 'المتبقي كدين على العميل:' : 'Remaining Customer Debt:'}
          </span>
          <span className="font-bold text-rose-800 dark:text-rose-300 font-mono numeric-tabular text-xs">${debtRemaining.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1 pt-1 border-t border-zinc-100 dark:border-border/50">
        <span>{isAr ? 'طريقة السداد: ' : 'Payment Method: '}<strong className="text-zinc-800 dark:text-foreground">{isAr ? 'حساب آجل (دين)' : 'Credit (Debt)'}</strong></span>
        {userName && <span>{isAr ? 'الكاشير: ' : 'Cashier: '}<strong className="text-zinc-800 dark:text-foreground">{userName}</strong></span>}
      </div>
    </div>
  );
}

// ==========================================
// 🛒 3. Cash Sale Details Box
// ==========================================
function CashDetailsBox({ details, isAr }: { details: Record<string, unknown>; isAr: boolean }) {
  const total = Number(details.total || details.amount || 0);
  const invoiceNumber = (details.invoiceNumber || details.invoiceId || '') as string;
  const customerName = (details.customerName || (isAr ? 'عميل نقدي مباشر' : 'Direct Cash Customer')) as string;

  return (
    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-muted/40 border border-zinc-200/80 dark:border-border/80 space-y-1.5 text-xs">
      {invoiceNumber && (
        <div className="flex justify-between">
          <span className="text-zinc-500">{isAr ? 'رقم الفاتورة:' : 'Invoice No:'}</span>
          <span className="font-mono font-bold text-zinc-800 dark:text-foreground">#{invoiceNumber}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-zinc-500">{isAr ? 'العميل:' : 'Customer:'}</span>
        <span className="font-bold text-zinc-800 dark:text-foreground">{customerName}</span>
      </div>
      <div className="flex justify-between border-t border-zinc-200/60 dark:border-border/50 pt-1">
        <span className="text-zinc-500">{isAr ? 'حالة الصندوق:' : 'Drawer Status:'}</span>
        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
          + ${total.toFixed(2)} {isAr ? 'تم إيداعها في الدرج' : 'deposited in drawer'}
        </span>
      </div>
    </div>
  );
}

// ==========================================
// 💳 4. Debt Payment Details Box
// ==========================================
function DebtPaymentDetailsBox({ details, isAr }: { details: Record<string, unknown>; isAr: boolean }) {
  const amount = Number(details.amount || details.total || 0);
  const customerName = (details.customerName as string) || (isAr ? 'أحمد' : 'Customer');
  const remaining = Number(details.remainingAfter || details.debtRemaining || 0);

  return (
    <div className="p-2.5 rounded-xl bg-blue-50/40 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-zinc-600 dark:text-muted-foreground">{isAr ? 'العميل المسدد:' : 'Paying Customer:'}</span>
        <span className="font-bold text-zinc-900 dark:text-foreground">{customerName}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-zinc-600 dark:text-muted-foreground">{isAr ? 'المبلغ المسدد:' : 'Paid Amount:'}</span>
        <span className="font-mono font-bold text-blue-800 dark:text-blue-300">${amount.toFixed(2)} {isAr ? 'نقداً' : 'Cash'}</span>
      </div>
      <div className="flex justify-between border-t border-blue-200/60 dark:border-blue-800/40 pt-1">
        <span className="text-zinc-600 dark:text-muted-foreground">{isAr ? 'الرصيد المتبقي على العميل:' : 'Remaining Balance:'}</span>
        <span className={cn("font-mono font-bold", remaining <= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
          ${remaining.toFixed(2)} {remaining <= 0 ? (isAr ? '(تمت التصفية)' : '(Cleared)') : ''}
        </span>
      </div>
    </div>
  );
}

// ==========================================
// ↩️ 5. Invoice Refund / Partial Refund Box
// ==========================================
function RefundDetailsBox({ details, isAr }: { details: Record<string, unknown>; isAr: boolean }) {
  const invoiceNumber = String(details.invoice_number || details.invoiceNumber || details.invoiceId || '');
  const refundAmount = Number(details.refund_amount || details.refundAmount || details.amount || 0);
  const invoiceTotal = Number(details.invoice_total || details.invoiceTotal || details.total || 0);
  const restoredUnits = Number(details.restored_units || details.restoredUnits || details.quantity || 0);
  const deletedDebt = Number(details.deleted_debt_amount || details.deletedDebt || details.debtReduced || 0);

  return (
    <div className="p-2.5 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 space-y-1.5 text-xs">
      {invoiceNumber && (
        <div className="flex justify-between">
          <span className="text-zinc-500">{isAr ? 'رقم الفاتورة المستردة:' : 'Refunded Invoice:'}</span>
          <span className="font-mono font-bold text-zinc-900 dark:text-foreground">#{invoiceNumber}</span>
        </div>
      )}
      {refundAmount > 0 && (
        <div className="flex justify-between">
          <span className="text-zinc-600 dark:text-muted-foreground">{isAr ? 'المبلغ المسترد للزبون:' : 'Refunded Amount:'}</span>
          <span className="font-mono font-bold text-rose-700 dark:text-rose-400">${refundAmount.toFixed(2)}</span>
        </div>
      )}
      {invoiceTotal > 0 && (
        <div className="flex justify-between">
          <span className="text-zinc-500">{isAr ? 'إجمالي الفاتورة الأصلية:' : 'Original Total:'}</span>
          <span className="font-mono font-semibold text-zinc-800 dark:text-foreground">${invoiceTotal.toFixed(2)}</span>
        </div>
      )}
      {restoredUnits > 0 && (
        <div className="flex justify-between">
          <span className="text-zinc-500">{isAr ? 'القطع المرجعة للمخزون:' : 'Restored Stock Units:'}</span>
          <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            {isAr ? `${restoredUnits} قطعة` : `${restoredUnits} unit(s)`}
          </span>
        </div>
      )}
      {deletedDebt > 0 && (
        <div className="flex justify-between">
          <span className="text-zinc-500">{isAr ? 'تخفيض الدين المسترد:' : 'Debt Deducted:'}</span>
          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">${deletedDebt.toFixed(2)}</span>
        </div>
      )}
      <div className="border-t border-rose-200/60 dark:border-rose-900/40 pt-1 text-[11px] text-zinc-500 flex items-center justify-between">
        <span>{isAr ? 'حالة الحركة:' : 'Status:'}</span>
        <span className="font-semibold text-rose-700 dark:text-rose-400">
          {isAr ? 'تم استرجاع البضاعة وتعديل قيود الصندوق' : 'Goods returned and balance adjusted'}
        </span>
      </div>
    </div>
  );
}

// ==========================================
// 📦 6. Generic Details Box (No raw UUIDs or technical keys)
// ==========================================
function GenericDetailsBox({ details, isAr }: { details: Record<string, unknown>; isAr: boolean }) {
  const HIDDEN_KEYS = new Set([
    'operation_id', 'operationId', 'id', 'userId', 'user_id', 'actor_id',
    'txKind', 'entityType', 'entityId', 'warehouseId', 'wholesaleMode',
    'snapshot', 'changes', 'items', 'full', 'source', 'cogs'
  ]);

  const entries = Object.entries(details).filter(([k, v]) => {
    if (HIDDEN_KEYS.has(k)) return false;
    return v !== null && v !== undefined && typeof v !== 'object';
  });

  if (entries.length === 0) {
    return (
      <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-muted/30 border border-zinc-200/60 dark:border-border/60 text-xs text-zinc-400 text-center">
        {isAr ? 'لا توجد تفاصيل إضافية مسجلة' : 'No additional details'}
      </div>
    );
  }

  const labelMap: Record<string, { ar: string; en: string }> = {
    name: { ar: 'الاسم', en: 'Name' },
    barcode: { ar: 'الباركود', en: 'Barcode' },
    category: { ar: 'التصنيف', en: 'Category' },
    quantity: { ar: 'الكمية', en: 'Quantity' },
    price: { ar: 'السعر', en: 'Price' },
    amount: { ar: 'المبلغ', en: 'Amount' },
    total: { ar: 'الإجمالي', en: 'Total' },
    customerName: { ar: 'العميل', en: 'Customer' },
    phone: { ar: 'الهاتف', en: 'Phone' },
    type: { ar: 'النوع', en: 'Type' },
  };

  return (
    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-muted/30 border border-zinc-200/80 dark:border-border/80 space-y-1.5 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
        {entries.map(([key, val]) => (
          <div key={key} className="flex justify-between items-center gap-2 border-b border-zinc-200/40 dark:border-border/40 pb-1">
            <span className="text-zinc-500 font-medium">
              {labelMap[key]?.[isAr ? 'ar' : 'en'] || key}:
            </span>
            <span className="font-bold text-zinc-800 dark:text-foreground break-all">
              {typeof val === 'number' && (key.toLowerCase().includes('price') || key.toLowerCase().includes('total') || key.toLowerCase().includes('amount'))
                ? `$${val.toFixed(2)}`
                : String(val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
