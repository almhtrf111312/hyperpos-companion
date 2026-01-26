import { cn } from '@/lib/utils';
import { Boxes } from 'lucide-react';

interface DualUnitDisplayProps {
  /** إجمالي القطع (الوحدة الصغرى) */
  totalPieces: number;
  /** معامل التحويل (عدد القطع في الكرتونة) */
  conversionFactor: number;
  /** اسم الوحدة الكبرى (مثل كرتونة) */
  bulkUnit?: string;
  /** اسم الوحدة الصغرى (مثل قطعة) */
  smallUnit?: string;
  /** إظهار المجموع الكلي */
  showTotal?: boolean;
  /** حجم العرض */
  size?: 'sm' | 'md' | 'lg';
  /** اتجاه العرض */
  direction?: 'horizontal' | 'vertical';
  /** إظهار الأيقونة */
  showIcon?: boolean;
}

/**
 * مكون عرض المخزون الثنائي
 * يعرض الكمية في خانتين: كراتين كاملة + قطع متبقية
 */
export function DualUnitDisplay({
  totalPieces,
  conversionFactor,
  bulkUnit = 'كرتونة',
  smallUnit = 'قطعة',
  showTotal = true,
  size = 'md',
  direction = 'horizontal',
  showIcon = false,
}: DualUnitDisplayProps) {
  // إذا لم يكن هناك معامل تحويل (أو = 1)، نعرض القطع فقط
  if (!conversionFactor || conversionFactor <= 1) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          {showIcon && <Boxes className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className={cn(
            "font-semibold text-foreground",
            size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'
          )}>
            {totalPieces} {smallUnit}
          </span>
        </div>
      </div>
    );
  }

  // حساب عدد الكراتين الكاملة والقطع المتبقية
  const fullBulkUnits = Math.floor(totalPieces / conversionFactor);
  const remainingPieces = totalPieces % conversionFactor;

  const badgeSize = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : size === 'lg' ? 'text-sm px-3 py-1.5' : 'text-xs px-2 py-1';
  const totalSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <div className={cn(
      "flex gap-1",
      direction === 'vertical' ? 'flex-col items-start' : 'flex-row flex-wrap items-center'
    )}>
      {/* خانة الكراتين */}
      <div className={cn(
        "inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary font-semibold",
        badgeSize
      )}>
        {showIcon && <Boxes className="w-3 h-3" />}
        <span>{fullBulkUnits}</span>
        <span className="font-normal opacity-80">{bulkUnit}</span>
      </div>

      {/* خانة القطع المتبقية */}
      {remainingPieces > 0 && (
        <>
          <span className={cn("text-muted-foreground", totalSize)}>+</span>
          <div className={cn(
            "inline-flex items-center gap-1 rounded-md bg-muted text-foreground font-semibold",
            badgeSize
          )}>
            <span>{remainingPieces}</span>
            <span className="font-normal text-muted-foreground">{smallUnit}</span>
          </div>
        </>
      )}

      {/* المجموع الكلي */}
      {showTotal && (
        <div className={cn(
          "text-muted-foreground w-full",
          totalSize,
          direction === 'horizontal' ? 'basis-full mt-0.5' : 'mt-0.5'
        )}>
          المجموع: {totalPieces} {smallUnit}
        </div>
      )}
    </div>
  );
}

/**
 * نسخة مصغرة للـ POS
 */
export function DualUnitDisplayCompact({
  totalPieces,
  conversionFactor,
  bulkUnit = 'كرتونة',
  smallUnit = 'قطعة',
}: Pick<DualUnitDisplayProps, 'totalPieces' | 'conversionFactor' | 'bulkUnit' | 'smallUnit'>) {
  if (!conversionFactor || conversionFactor <= 1) {
    return (
      <span className="text-[10px] md:text-xs text-muted-foreground">
        {totalPieces} {smallUnit}
      </span>
    );
  }

  const fullBulkUnits = Math.floor(totalPieces / conversionFactor);
  const remainingPieces = totalPieces % conversionFactor;

  return (
    <div className="flex flex-wrap items-center gap-1 text-[10px] md:text-xs">
      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
        {fullBulkUnits} {bulkUnit}
      </span>
      {remainingPieces > 0 && (
        <span className="text-muted-foreground">
          +{remainingPieces}
        </span>
      )}
    </div>
  );
}
