import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, Printer, Share2 } from 'lucide-react';
import { useSmartToastListener } from '@/hooks/use-smart-toast';

export interface UnifiedSmartToastProps {
  id: string;
  type?: 'cash_sale' | 'debt_sale' | 'settings' | 'refund' | 'sync' | 'success' | 'error' | 'warning' | 'info';
  title: React.ReactNode;
  subtitle?: React.ReactNode;          // مثال: رقم الفاتورة #INV-2026-002
  statusBadge?: React.ReactNode;       // مثال: "الآن • معتمدة" أو "الآن • تم الحفظ"
  primaryLabel?: React.ReactNode;      // السطر الأول في الصندوق الداخلي (مثال: رقم الفاتورة / العميل)
  primaryValue?: React.ReactNode;      // قيمة السطر الأول الخاصة بالعملية
  secondaryLabel?: React.ReactNode;    // السطر الثاني في الصندوق الداخلي (مثال: القطعة / التفاصيل)
  secondaryValue?: React.ReactNode;    // قيمة السطر الثاني الخاصة بالعملية
  description?: React.ReactNode;       // النص التفصيلي للإشعارات العامة وإشعارات الإعدادات
  pillText?: React.ReactNode;          // الكبسولة البارزة على اليسار (مثال: المبلغ بالعملة أو شارة "محفوظ ✓")
  duration?: number;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  onDismiss: (id: string) => void;
}

export const SmartToastCard: React.FC<UnifiedSmartToastProps> = ({
  id,
  type = 'success',
  title,
  subtitle,
  statusBadge,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  description,
  pillText,
  duration = 3500,
  primaryAction,
  secondaryAction,
  onDismiss,
}) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const startXRef = useRef<number | null>(null);

  // إغلاق تلقائي بعد انتهاء مدة الإشعار
  useEffect(() => {
    if (duration <= 0 || duration === Infinity) return;
    const timer = setTimeout(() => {
      setIsRemoving(true);
      setTimeout(() => onDismiss(id), 180);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const handleStart = (clientX: number) => {
    startXRef.current = clientX;
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || startXRef.current === null) return;
    setDragX(clientX - startXRef.current);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(dragX) > 75) {
      setIsRemoving(true);
      setTimeout(() => onDismiss(id), 180);
    } else {
      setDragX(0);
    }
    startXRef.current = null;
  };

  const isError = type === 'error';
  const isWarning = type === 'warning' || type === 'debt_sale';

  const accentColor = isError
    ? 'border-red-500/30 bg-white dark:bg-zinc-900 shadow-red-500/5'
    : isWarning
    ? 'border-amber-500/30 bg-white dark:bg-zinc-900 shadow-amber-500/5'
    : 'border-emerald-500/30 bg-white dark:bg-zinc-900 shadow-emerald-500/5';

  const pillClasses = isError
    ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
    : isWarning
    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';

  return (
    <div
      dir="rtl"
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => handleStart(e.clientX)}
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      style={{
        transform: isRemoving
          ? `translate3d(${dragX >= 0 ? '120%' : '-120%'}, 0, 0)`
          : `translate3d(${dragX}px, 0, 0)`,
        opacity: isRemoving ? 0 : Math.max(0.2, 1 - Math.abs(dragX) / 260),
        transition: isDragging ? 'none' : 'transform 0.22s ease-out, opacity 0.22s ease-out',
        touchAction: 'pan-y',
      }}
      className={`w-[94vw] max-w-md mx-auto rounded-2xl border shadow-xl p-3.5 select-none cursor-grab active:cursor-grabbing backdrop-blur-md ${accentColor}`}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {isError ? (
            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          ) : isWarning ? (
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          )}
          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{title}</span>
          {subtitle && (
            <span className="text-xs font-semibold text-primary dark:text-primary-foreground/90 shrink-0">{subtitle}</span>
          )}
        </div>
        {statusBadge && (
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            {statusBadge}
          </span>
        )}
      </div>

      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700/60 p-3 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1 text-right flex-1 min-w-0">
          {primaryLabel || primaryValue ? (
            <div className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
              {primaryLabel && <span className="text-zinc-400 ml-1">{primaryLabel}:</span>}
              <span className="font-bold text-zinc-800 dark:text-zinc-100">{primaryValue}</span>
            </div>
          ) : null}

          {secondaryLabel || secondaryValue ? (
            <div className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
              {secondaryLabel && <span className="text-zinc-400 ml-1">{secondaryLabel}:</span>}
              <span className="font-medium text-zinc-700 dark:text-zinc-200">{secondaryValue}</span>
            </div>
          ) : null}

          {description && (
            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-200 leading-relaxed">
              {description}
            </div>
          )}
        </div>

        {pillText && (
          <div className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 ${pillClasses}`}>
            {pillText}
          </div>
        )}
      </div>

      {/* أزرار الإجراءات المتكاملة (طباعة / مشاركة) إن وُجدت */}
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50">
          {primaryAction && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                primaryAction.onClick();
                onDismiss(id);
              }}
              className="flex-1 py-1.5 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition active:scale-95 shadow-sm flex items-center justify-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>{primaryAction.label}</span>
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                secondaryAction.onClick();
                onDismiss(id);
              }}
              className="flex-1 py-1.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold text-xs transition active:scale-95 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>{secondaryAction.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export function SmartToast() {
  const { toasts, dismissToast } = useSmartToastListener();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 inset-x-0 px-3 z-[9999] flex flex-col items-center gap-2.5 pointer-events-none">
      {toasts.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <SmartToastCard
            {...item}
            onDismiss={dismissToast}
          />
        </div>
      ))}
    </div>
  );
}
