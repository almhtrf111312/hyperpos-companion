import { useState, useEffect, useMemo } from 'react';
import {
  Activity, User, Filter, Trash2, ShoppingCart, CreditCard,
  Package, Tag, Search, ChevronDown, ChevronUp, FileText,
  DollarSign, Clock, CheckCircle2, AlertCircle, ArrowRight,
  TrendingUp, Wallet, Wrench, Shield, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { loadActivityLogs, clearActivityLogs, ActivityLog, ActivityType, activityTypeLabels } from '@/lib/activity-log';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { supabase } from '@/integrations/supabase/client';

type FilterCategory = 'all' | 'prices' | 'sales' | 'debts' | 'auth';

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
  const isPriceLog = (log: ActivityLog) => {
    if (log.type === 'product_updated') return true;
    const details = log.details || {};
    const changes = details.changes as Record<string, unknown> | undefined;
    return !!(changes && (changes.salePrice || changes.costPrice || changes.price));
  };

  const isSaleLog = (log: ActivityLog) => {
    return ['sale', 'invoice_created', 'invoice_refunded', 'invoice_updated', 'refund'].includes(log.type);
  };

  const isDebtLog = (log: ActivityLog) => {
    return ['debt_created', 'debt_paid', 'debt_payment', 'debt_writeoff', 'debt_deleted'].includes(log.type);
  };

  const isAuthLog = (log: ActivityLog) => {
    return ['login', 'logout', 'shift_opened', 'shift_closed', 'password_changed', 'user_added', 'user_deleted'].includes(log.type);
  };

  // فلترة السجلات
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. فلتر الفئة الرئيسية
      if (selectedCategory === 'prices' && !isPriceLog(log)) return false;
      if (selectedCategory === 'sales' && !isSaleLog(log)) return false;
      if (selectedCategory === 'debts' && !isDebtLog(log)) return false;
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
    <div className="space-y-4 max-w-full overflow-hidden text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 1. Header Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              {isAr ? 'سجل النشاطات والعمليات' : 'Activity & Operations Log'}
            </h1>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xs text-muted-foreground">
            {isAr ? 'تدقيق حركات المتجر والمستخدمين' : 'Audit store movements and user actions'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setClearDialogOpen(true)}
          disabled={logs.length === 0}
          className="h-8 px-3 rounded-xl border border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-semibold gap-1.5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
          <span>{isAr ? 'مسح السجل' : 'Clear Log'}</span>
        </Button>
      </div>

      {/* 2. Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
        {/* All */}
        <button
          onClick={() => { setSelectedCategory('all'); setSpecificFilter(null); }}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 shadow-xs",
            selectedCategory === 'all' && !specificFilter
              ? "bg-foreground text-background dark:bg-primary dark:text-primary-foreground shadow-sm"
              : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
          )}
        >
          {isAr ? `الكل (${logs.length})` : `All (${logs.length})`}
        </button>

        {/* Prices */}
        <button
          onClick={() => { setSelectedCategory('prices'); setSpecificFilter(null); }}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 shadow-xs",
            selectedCategory === 'prices'
              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 font-bold"
              : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
          )}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span>{isAr ? 'تعديل الأسعار' : 'Price Updates'}</span>
        </button>

        {/* Sales */}
        <button
          onClick={() => { setSelectedCategory('sales'); setSpecificFilter(null); }}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 shadow-xs",
            selectedCategory === 'sales'
              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-bold"
              : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
          )}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>{isAr ? 'المبيعات والفواتير' : 'Sales & Invoices'}</span>
        </button>

        {/* Debts */}
        <button
          onClick={() => { setSelectedCategory('debts'); setSpecificFilter(null); }}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 shadow-xs",
            selectedCategory === 'debts'
              ? "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/40 font-bold"
              : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
          )}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
          <span>{isAr ? 'الديون والتحصيل' : 'Debts & Collections'}</span>
        </button>

        {/* Auth & Shifts */}
        <button
          onClick={() => { setSelectedCategory('auth'); setSpecificFilter(null); }}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 shadow-xs",
            selectedCategory === 'auth'
              ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 font-bold"
              : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
          )}
        >
          <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
          <span>{isAr ? 'دخول وخروج' : 'Sessions & Shifts'}</span>
        </button>

        {/* Custom Filter */}
        <button
          onClick={() => setCustomFilterOpen(true)}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 border border-border/60",
            specificFilter
              ? "bg-primary/20 text-primary border-primary/40 font-bold"
              : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>{specificFilter ? (activityTypeLabels[specificFilter]?.[isAr ? 'ar' : 'en'] || specificFilter) : (isAr ? 'تصفية مخصصة' : 'Custom Filter')}</span>
        </button>
      </div>

      {/* 3. Search Bar + Operations Count Indicator */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className={cn("w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2", isRTL ? "right-3" : "left-3")} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث بالمنتج، العميل، المستخدم...' : 'Search by product, customer, user...'}
            className={cn("h-9 rounded-xl text-xs bg-muted/30 border-border/70", isRTL ? "pr-9 pl-3" : "pl-9 pr-3")}
          />
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/40 border border-border/60 text-xs font-medium text-muted-foreground shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>
            {isAr ? `عرض ${filteredLogs.length} عمليات` : `Showing ${filteredLogs.length} items`}
          </span>
        </div>
      </div>

      {/* 4. Activity Cards List */}
      <div className="space-y-3 max-h-[620px] overflow-y-auto pr-0.5">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
            <Activity className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">
              {isAr ? 'لا توجد نشاطات مسجلة مطابقة' : 'No matching activities found'}
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

      {/* 5. Clear Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {isAr ? 'تأكيد مسح السجل' : 'Confirm Clear Log'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {isAr ? 'هل أنت متأكد من مسح سجل النشاط بالكامل؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to clear all activities? This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" onClick={() => setClearDialogOpen(false)} className="rounded-xl flex-1">
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleClearLogs} className="rounded-xl flex-1 font-semibold">
              {isAr ? 'مسح السجل' : 'Clear Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Custom Filter Dialog */}
      <Dialog open={customFilterOpen} onOpenChange={setCustomFilterOpen}>
        <DialogContent className="max-w-md rounded-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <span>{isAr ? 'تصفية حسب نوع العملية' : 'Filter by Operation Type'}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto py-2">
            <button
              onClick={() => { setSpecificFilter(null); setCustomFilterOpen(false); }}
              className={cn(
                "p-2.5 rounded-xl border text-xs text-start transition-all font-medium",
                !specificFilter ? "border-primary bg-primary/10 text-primary font-bold" : "border-border/60 hover:bg-muted/50"
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
                    "p-2.5 rounded-xl border text-xs text-start transition-all font-medium truncate",
                    isSelected ? "border-primary bg-primary/10 text-primary font-bold" : "border-border/60 hover:bg-muted/50"
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

  // هل هذا تعديل سعر؟
  const isPriceUpdate = log.type === 'product_updated' && !!(changes.salePrice || changes.costPrice || changes.price);
  
  // هل هذا إنشاء دين أو بيع مركب/آجل؟
  const isDebtCreation = log.type === 'debt_created' || (log.type === 'sale' && (details.paymentType === 'debt' || details.paymentType === 'split'));

  // هل هذا بيع نقدي مباشر؟
  const isCashSale = log.type === 'sale' && details.paymentType !== 'debt' && details.paymentType !== 'split';

  // هل هذا تسديد دين؟
  const isDebtPayment = log.type === 'debt_paid' || log.type === 'debt_payment';

  // استخراج المبالغ والحالات المرافقة لها
  let topAmount: number | null = null;
  let topStatusText: string | null = null;
  let topStatusClass = '';

  if (isDebtCreation) {
    topAmount = Number(details.total || details.debtRemaining || details.amount || 0);
    topStatusText = isAr ? 'ذمة معلقة' : 'Pending Debt';
    topStatusClass = 'text-rose-600 dark:text-rose-400';
  } else if (isCashSale) {
    topAmount = Number(details.total || details.amount || 0);
    topStatusText = isAr ? 'مسدد نقداً ✓' : 'Paid in Cash ✓';
    topStatusClass = 'text-emerald-600 dark:text-emerald-400';
  } else if (isDebtPayment) {
    topAmount = Number(details.amount || details.total || 0);
    topStatusText = isAr ? 'تم القبض ✓' : 'Collected ✓';
    topStatusClass = 'text-blue-600 dark:text-blue-400';
  } else if (details.amount !== undefined || details.total !== undefined) {
    topAmount = Number(details.amount ?? details.total);
    topStatusClass = 'text-foreground';
  }

  // بادج العملية
  const getBadgeInfo = () => {
    if (isPriceUpdate) {
      return {
        label: isAr ? 'تعديل تسعيرة منتج' : 'Price Adjustment',
        className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
        iconBg: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        icon: Tag,
      };
    }
    if (isDebtCreation) {
      return {
        label: isAr ? 'إنشاء دين / فاتورة آجل' : 'Debt / Credit Invoice',
        className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
        iconBg: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        icon: FileText,
      };
    }
    if (isCashSale) {
      return {
        label: isAr ? 'عملية بيع نقدي' : 'Cash Sale',
        className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
        iconBg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        icon: ShoppingCart,
      };
    }
    if (isDebtPayment) {
      return {
        label: isAr ? 'تسديد دين' : 'Debt Payment',
        className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
        iconBg: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        icon: CreditCard,
      };
    }
    return {
      label: activityTypeLabels[log.type]?.[isAr ? 'ar' : 'en'] || log.type,
      className: 'bg-muted text-muted-foreground border-border/60',
      iconBg: 'bg-muted text-muted-foreground border-border/40',
      icon: Activity,
    };
  };

  const badge = getBadgeInfo();
  const IconComponent = badge.icon;

  // العنوان الرئيسي
  const getCardTitle = () => {
    if (details.name && typeof details.name === 'string') {
      return details.name;
    }
    return log.description;
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-xs hover:border-border transition-all space-y-3">
      {/* 1. Top Row */}
      <div className="flex items-start justify-between gap-3">
        {/* Left side in RTL / End side: Amount & Subtitle */}
        {topAmount !== null && topAmount > 0 ? (
          <div className="space-y-0.5 shrink-0 text-start">
            <div className={cn("text-base sm:text-lg font-extrabold tracking-tight", topStatusClass)}>
              ${topAmount.toFixed(2)}
            </div>
            {topStatusText && (
              <div className={cn("text-[11px] font-semibold", topStatusClass)}>
                {topStatusText}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {log.userName && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60 bg-muted/40 text-[11px]">
                <User className="w-3 h-3 text-muted-foreground" />
                <span>{isAr ? `المستخدم: ${log.userName}` : `User: ${log.userName}`}</span>
              </span>
            )}
          </div>
        )}

        {/* Right side in RTL / Start side: Badge, Time, User, Squircle Icon */}
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                {timeText}
              </span>
              <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-bold border", badge.className)}>
                {badge.label}
              </span>
            </div>

            {log.userName && topAmount !== null && topAmount > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{isAr ? `المستخدم: ${log.userName}` : log.userName}</span>
              </span>
            )}
          </div>

          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs", badge.iconBg)}>
            <IconComponent className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Main Title Row */}
      <div>
        <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug break-words">
          {getCardTitle()}
        </h3>
      </div>

      {/* 3. Toggle Details Button */}
      <div>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:underline transition-colors"
        >
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{isExpanded ? (isAr ? 'إخفاء التفاصيل' : 'Hide details') : (isAr ? 'عرض التفاصيل' : 'View details')}</span>
        </button>
      </div>

      {/* 4. Expanded Details Section */}
      {isExpanded && (
        <div className="pt-2 animate-in fade-in-50 duration-200">
          {isPriceUpdate ? (
            <PriceUpdateDetails changes={changes} isAr={isAr} />
          ) : isDebtCreation ? (
            <DebtSaleDetails details={details} userName={log.userName} isAr={isAr} />
          ) : isCashSale ? (
            <CashSaleDetails details={details} isAr={isAr} />
          ) : isDebtPayment ? (
            <DebtPaymentDetails details={details} isAr={isAr} />
          ) : (
            <GenericDetails details={details} isAr={isAr} />
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 📊 Template 1: Price Update Details
// ==========================================
function PriceUpdateDetails({ changes, isAr }: { changes: Record<string, unknown>; isAr: boolean }) {
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
    <div className="space-y-2.5">
      {/* Source banner */}
      <div className="bg-muted/40 rounded-xl p-2.5 text-xs text-muted-foreground flex items-center justify-between border border-border/40">
        <span className="font-medium">
          {isAr ? 'مصدر التعديل: تعديل يدوي مباشر من بطاقة الصنف' : 'Source: Manual edit from product card'}
        </span>
      </div>

      {/* Comparison Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden text-xs bg-background/50">
        <div className="grid grid-cols-3 bg-muted/60 p-2 font-bold text-muted-foreground text-center border-b border-border/40">
          <div className="text-start">{isAr ? 'نوع السعر' : 'Price Type'}</div>
          <div>{isAr ? 'السابق (القديم)' : 'Previous (Old)'}</div>
          <div>{isAr ? 'المعتمد (الجديد)' : 'Confirmed (New)'}</div>
        </div>

        {/* Cost Price */}
        <div className="grid grid-cols-3 p-2.5 items-center text-center border-b border-border/30">
          <div className="text-start font-medium text-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>{isAr ? 'رأس المال (الشراء)' : 'Cost (Purchase)'}</span>
          </div>
          <div className="text-muted-foreground font-mono">
            {oldCost !== null ? `$${oldCost.toFixed(2)}` : '—'}
          </div>
          <div className="font-bold text-foreground font-mono flex items-center justify-center gap-1">
            <span>${newCost.toFixed(2)}</span>
            {costDiff !== 0 && (
              <span className={cn("text-[10px]", costDiff > 0 ? "text-rose-500" : "text-emerald-500")}>
                ({costDiff > 0 ? `+$${costDiff.toFixed(2)}` : `-$${Math.abs(costDiff).toFixed(2)}`})
              </span>
            )}
          </div>
        </div>

        {/* Sale Price */}
        <div className="grid grid-cols-3 p-2.5 items-center text-center border-b border-border/30">
          <div className="text-start font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>{isAr ? 'سعر البيع (المعتمد)' : 'Sale Price (Confirmed)'}</span>
          </div>
          <div className="text-muted-foreground font-mono">
            {oldSale !== null ? `$${oldSale.toFixed(2)}` : '—'}
          </div>
          <div className="font-bold text-blue-600 dark:text-blue-400 font-mono flex items-center justify-center gap-1">
            <span>${newSale.toFixed(2)}</span>
            {saleDiff !== 0 && (
              <span className="text-[10px]">
                ({saleDiff > 0 ? `+$${saleDiff.toFixed(2)}` : `-$${Math.abs(saleDiff).toFixed(2)}`})
              </span>
            )}
          </div>
        </div>

        {/* Expected Margin */}
        <div className="grid grid-cols-3 p-2.5 items-center text-center">
          <div className="text-start font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{isAr ? 'هامش الربح المتوقع' : 'Expected Profit Margin'}</span>
          </div>
          <div className="text-muted-foreground font-mono text-[11px]">
            {oldCost !== null && oldSale !== null ? `(${oldMargin.toFixed(0)}%) $${oldProfit.toFixed(2)}` : '—'}
          </div>
          <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px] flex items-center justify-center gap-1">
            <span>(${newMargin.toFixed(1)}%)</span>
            <span>${newProfit.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 🧾 Template 2: Debt Sale / Credit Invoice
// ==========================================
function DebtSaleDetails({ details, userName, isAr }: { details: Record<string, unknown>; userName?: string; isAr: boolean }) {
  const total = Number(details.total || details.amount || 0);
  const itemsCount = Number(details.itemsCount || 1);
  const downPayment = Number(details.downPayment || 0);
  const debtRemaining = Number(details.debtRemaining || (total - downPayment));
  const customerName = (details.customerName as string) || (isAr ? 'عميل' : 'Customer');

  return (
    <div className="space-y-2.5">
      {/* 2x2 Grid of metric boxes matching screenshot */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Box 1: Invoice Total */}
        <div className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-1">
          <div className="text-muted-foreground">{isAr ? 'إجمالي الفاتورة:' : 'Invoice Total:'}</div>
          <div className="font-extrabold text-sm sm:text-base text-foreground font-mono">${total.toFixed(2)}</div>
        </div>

        {/* Box 2: Items Sold */}
        <div className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-1">
          <div className="text-muted-foreground">{isAr ? 'عدد المنتجات المباعة:' : 'Sold Items Count:'}</div>
          <div className="font-bold text-sm sm:text-base text-foreground">
            {isAr ? `${itemsCount} صنف (قطعة)` : `${itemsCount} items`}
          </div>
        </div>

        {/* Box 3: Down Payment (Green tint) */}
        <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-1">
          <div className="text-emerald-700 dark:text-emerald-400 font-medium">
            {isAr ? 'الدفعة المستلمة نقداً:' : 'Cash Received:'}
          </div>
          <div className="font-extrabold text-sm sm:text-base text-emerald-700 dark:text-emerald-400 font-mono">
            ${downPayment.toFixed(2)}
          </div>
        </div>

        {/* Box 4: Remaining Debt (Red tint) */}
        <div className="p-3 rounded-xl border border-rose-500/25 bg-rose-500/5 space-y-1">
          <div className="text-rose-700 dark:text-rose-400 font-medium">
            {isAr ? 'المتبقي كدين على العميل:' : 'Remaining Customer Debt:'}
          </div>
          <div className="font-extrabold text-sm sm:text-base text-rose-700 dark:text-rose-400 font-mono">
            ${debtRemaining.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Footer Info Row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 px-1">
        <span>{isAr ? `طريقة السداد: حساب آجل (دين)` : 'Payment: Deferred Debt'}</span>
        {userName && <span>{isAr ? `الكاشير: ${userName}` : `Cashier: ${userName}`}</span>}
      </div>
    </div>
  );
}

// ==========================================
// 🛒 Template 3: Cash Sale Details
// ==========================================
function CashSaleDetails({ details, isAr }: { details: Record<string, unknown>; isAr: boolean }) {
  const total = Number(details.total || details.amount || 0);
  const invoiceNumber = (details.invoiceNumber || details.invoiceId || '') as string;
  const customerName = (details.customerName || (isAr ? 'عميل نقدي مباشر' : 'Direct Cash Customer')) as string;

  return (
    <div className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-2 text-xs">
      {invoiceNumber && (
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">{isAr ? 'رقم الفاتورة:' : 'Invoice No:'}</span>
          <span className="font-mono font-bold text-foreground">#{invoiceNumber}</span>
        </div>
      )}
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">{isAr ? 'العميل:' : 'Customer:'}</span>
        <span className="font-semibold text-foreground">{customerName}</span>
      </div>
      <div className="flex justify-between items-center pt-1 border-t border-border/40">
        <span className="text-muted-foreground">{isAr ? 'حالة الصندوق:' : 'Drawer Status:'}</span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
          + ${total.toFixed(2)} {isAr ? 'تم إيداعها في الدرج' : 'deposited to drawer'}
        </span>
      </div>
    </div>
  );
}

// ==========================================
// 💳 Template 4: Debt Payment Details
// ==========================================
function DebtPaymentDetails({ details, isAr }: { details: Record<string, unknown>; isAr: boolean }) {
  const amount = Number(details.amount || details.total || 0);
  const customerName = (details.customerName as string) || (isAr ? 'عميل' : 'Customer');
  const remaining = Number(details.remainingAfter || details.debtRemaining || 0);

  return (
    <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2 text-xs">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">{isAr ? 'العميل المسدد:' : 'Paying Customer:'}</span>
        <span className="font-bold text-foreground">{customerName}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">{isAr ? 'المبلغ المسدد:' : 'Paid Amount:'}</span>
        <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
          ${amount.toFixed(2)} {isAr ? 'نقداً' : 'Cash'}
        </span>
      </div>
      <div className="flex justify-between items-center pt-1 border-t border-blue-500/15">
        <span className="text-muted-foreground">{isAr ? 'الرصيد المتبقي على العميل:' : 'Remaining Balance:'}</span>
        <span className={cn("font-bold font-mono", remaining <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          ${remaining.toFixed(2)} {remaining <= 0 ? (isAr ? '(تمت التصفية)' : '(Cleared)') : ''}
        </span>
      </div>
    </div>
  );
}

// ==========================================
// 📦 Template 5: Generic Details (Other Actions)
// ==========================================
function GenericDetails({ details, isAr }: { details: Record<string, unknown>; isAr: boolean }) {
  const entries = Object.entries(details).filter(([k, v]) => {
    if (['changes', 'snapshot', 'txKind', 'entityType', 'entityId', 'warehouseId', 'wholesaleMode'].includes(k)) return false;
    return v !== null && v !== undefined && typeof v !== 'object';
  });

  if (entries.length === 0) {
    return (
      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/40 text-xs text-muted-foreground text-center">
        {isAr ? 'لا توجد تفاصيل إضافية مسجلة' : 'No additional details recorded'}
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
    <div className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-1.5 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {entries.map(([key, val]) => (
          <div key={key} className="flex justify-between items-center gap-2 border-b border-border/20 pb-1">
            <span className="text-muted-foreground">
              {labelMap[key]?.[isAr ? 'ar' : 'en'] || key}:
            </span>
            <span className="font-semibold text-foreground break-all">
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
