import { useState } from 'react';
import { Calendar, Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';

export interface ReportFilters {
  dateRange: { from: string; to: string };
  search: string;
  status: string;
  cashierId: string;
  warehouseId: string;
  category: string;
  paymentType: string;
}

interface FilterConfig {
  showStatus?: boolean;
  showCashier?: boolean;
  showWarehouse?: boolean;
  showCategory?: boolean;
  showPaymentType?: boolean;
  showSearch?: boolean;
  statusOptions?: { value: string; label: string }[];
  cashiers?: { id: string; name: string }[];
  warehouses?: { id: string; name: string }[];
  categories?: { id: string; name: string }[];
}

interface Props {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  config: FilterConfig;
}

export function ReportFiltersBar({ filters, onChange, config }: Props) {
  const { t, isRTL, language } = useLanguage();
  const [showCustomDate, setShowCustomDate] = useState(false);

  const datePresets = [
    { label: t('reports.today') || 'اليوم', getValue: () => { const d = new Date().toISOString().split('T')[0]; return { from: d, to: d }; } },
    { label: t('reports.yesterday') || 'أمس', getValue: () => { const d = new Date(Date.now() - 86400000).toISOString().split('T')[0]; return { from: d, to: d }; } },
    { label: t('reports.thisWeek') || 'هذا الأسبوع', getValue: () => {
      const now = new Date();
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    }},
    { label: t('reports.thisMonth') || 'هذا الشهر', getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    }},
    { label: t('reports.last30Days') || 'آخر 30 يوم', getValue: () => {
      const now = new Date();
      const start = new Date(Date.now() - 30 * 86400000);
      return { from: start.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    }},
  ];

  const update = (partial: Partial<ReportFilters>) => {
    onChange({ ...filters, ...partial });
  };

  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.cashierId !== 'all' || filters.warehouseId !== 'all' || filters.category !== 'all' || filters.paymentType !== 'all';

  const clearFilters = () => {
    onChange({
      ...filters,
      search: '',
      status: 'all',
      cashierId: 'all',
      warehouseId: 'all',
      category: 'all',
      paymentType: 'all',
    });
  };

  return (
    <div className="space-y-3">
      {/* Date presets row */}
      <div className="flex flex-wrap gap-1.5">
        {datePresets.map((preset) => {
          const presetValue = preset.getValue();
          const isActive = filters.dateRange.from === presetValue.from && filters.dateRange.to === presetValue.to;
          return (
            <button
              key={preset.label}
              onClick={() => {
                update({ dateRange: presetValue });
                setShowCustomDate(false);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary/30 shadow-sm"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border-border/50"
              )}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowCustomDate(!showCustomDate)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1",
            showCustomDate
              ? "bg-primary text-primary-foreground border-primary/30 shadow-sm"
              : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border-border/50"
          )}
        >
          <Calendar className="w-3 h-3" />
          {t('reports.custom') || 'مخصص'}
        </button>
      </div>

      {/* Custom date inputs */}
      {showCustomDate && (
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 bg-card rounded-lg border border-border/50 px-2.5 py-1.5">
            <span className="text-xs text-muted-foreground">{t('reports.from') || 'من'}:</span>
            <Input
              type="date"
              value={filters.dateRange.from}
              onChange={(e) => update({ dateRange: { ...filters.dateRange, from: e.target.value } })}
              className="h-7 text-xs border-0 bg-transparent p-0 w-32 focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-card rounded-lg border border-border/50 px-2.5 py-1.5">
            <span className="text-xs text-muted-foreground">{t('reports.to') || 'إلى'}:</span>
            <Input
              type="date"
              value={filters.dateRange.to}
              onChange={(e) => update({ dateRange: { ...filters.dateRange, to: e.target.value } })}
              className="h-7 text-xs border-0 bg-transparent p-0 w-32 focus-visible:ring-0"
            />
          </div>
        </div>
      )}

      {/* Contextual filters row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        {config.showSearch !== false && (
          <div className="relative flex-1 min-w-[200px] w-full sm:max-w-[360px]">
            <Search className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
            <Input
              placeholder={t('reports.searchPlaceholder') || 'ابحث بالاسم أو الرقم أو الباركود...'}
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              className={cn("h-10 text-sm rounded-lg", isRTL ? "pr-9 pl-11" : "pl-9 pr-11")}
            />
            {filters.search && (
              <button
                type="button"
                aria-label={t('common.clear') || 'مسح البحث'}
                onClick={() => update({ search: '' })}
                className={cn("absolute top-0 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground z-10", isRTL ? "left-0" : "right-0")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Status filter */}
        {config.showStatus && (
          <Select value={filters.status} onValueChange={(v) => update({ status: v })}>
            <SelectTrigger className="h-8 text-xs w-[130px] rounded-lg">
              <SelectValue placeholder={t('common.status') || 'الحالة'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('reports.allStatuses') || 'كل الحالات'}</SelectItem>
              {(config.statusOptions || [
                { value: 'completed', label: t('reports.statusCompleted') || 'مكتملة' },
                { value: 'refunded', label: t('reports.statusRefunded') || 'مرتجعة' },
                { value: 'cancelled', label: t('reports.statusCancelled') || 'ملغاة' },
              ]).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Cashier filter */}
        {config.showCashier && config.cashiers && config.cashiers.length > 0 && (
          <Select value={filters.cashierId} onValueChange={(v) => update({ cashierId: v })}>
            <SelectTrigger className="h-8 text-xs w-[140px] rounded-lg">
              <SelectValue placeholder={t('cashShifts.cashier') || 'الكاشير'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('reports.filterAllCashiers') || 'جميع الكاشيرات'}</SelectItem>
              {config.cashiers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Warehouse filter */}
        {config.showWarehouse && config.warehouses && config.warehouses.length > 0 && (
          <Select value={filters.warehouseId} onValueChange={(v) => update({ warehouseId: v })}>
            <SelectTrigger className="h-8 text-xs w-[140px] rounded-lg">
              <SelectValue placeholder={t('reports.warehouse') || 'المستودع'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('reports.allWarehouses') || 'جميع المستودعات'}</SelectItem>
              {config.warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Category filter */}
        {config.showCategory && config.categories && config.categories.length > 0 && (
          <Select value={filters.category} onValueChange={(v) => update({ category: v })}>
            <SelectTrigger className="h-8 text-xs w-[140px] rounded-lg">
              <SelectValue placeholder={t('products.category') || 'القسم'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('reports.filterAllCategories') || 'جميع الأقسام'}</SelectItem>
              {config.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Payment type filter */}
        {config.showPaymentType && (
          <Select value={filters.paymentType} onValueChange={(v) => update({ paymentType: v })}>
            <SelectTrigger className="h-8 text-xs w-[120px] rounded-lg">
              <SelectValue placeholder={t('reports.paymentType') || 'نوع الدفع'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all') || 'الكل'}</SelectItem>
              <SelectItem value="cash">{t('pos.cash') || 'نقدي'}</SelectItem>
              <SelectItem value="debt">{t('pos.debt') || 'آجل'}</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1 text-muted-foreground">
            <X className="w-3 h-3" />
            {t('reports.clearFilters') || 'مسح الفلاتر'}
          </Button>
        )}
      </div>
    </div>
  );
}
