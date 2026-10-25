import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  RefreshCw,
  Sliders,
  AlertTriangle,
  ShoppingBag,
  Printer,
  Share2,
  X,
} from 'lucide-react';
import { useSmartToastListener, hideSmartToast, SmartToastData } from '@/hooks/use-smart-toast';
import { cn } from '@/lib/utils';
import { getCurrentLanguage } from '@/lib/i18n';

// =========================================================================
// محرك المؤثرات الصوتية الخفيفة المدمج بواسطة Web Audio API (Native Feel)
// =========================================================================
function getAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  } catch {
    return null;
  }
}

function playDropSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(740, now + 0.08);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {}
}

function playDismissSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  } catch {}
}

// قراءة مدة بقاء الإشعار بدقة من الإعدادات المخزنة محلياً
export function getDefaultToastDuration(): number {
  try {
    const saved = localStorage.getItem('hyperpos_toast_duration');
    if (saved) {
      const val = Number(saved);
      if (!isNaN(val) && val >= 500 && val <= 10000) return val;
    }
  } catch {}
  return 2500;
}

// =========================================================================
// محلل التفاصيل الذكي: استخراج وتوحيد بيانات العمليات لكافة الإشعارات
// =========================================================================
export interface ParsedToastDetails {
  operationName: React.ReactNode;
  category: 'cash_sale' | 'debt_sale' | 'cart' | 'invoice' | 'stock' | 'out_of_stock' | 'restock' | 'settings' | 'refund' | 'sync' | 'error' | 'warning' | 'general';
  itemName?: string;
  isMultiple?: boolean;
  itemCount?: number;
  price?: string;
  stockQuantity?: number;
  invoiceNumber?: string;
  note?: string;
  primaryLabel?: React.ReactNode;
  primaryValue?: React.ReactNode;
  secondaryLabel?: React.ReactNode;
  secondaryValue?: React.ReactNode;
  description?: React.ReactNode;
  pillText?: React.ReactNode;
  statusBadge?: React.ReactNode;
}

function resolveToastDetails(toast: SmartToastData): ParsedToastDetails {
  const type = toast.type || 'success';
  let cat: ParsedToastDetails['category'] = 'general';
  const str = `${typeof toast.title === 'string' ? toast.title : ''} ${typeof toast.subtitle === 'string' ? toast.subtitle : ''} ${typeof toast.description === 'string' ? toast.description : ''} ${toast.operation || ''}`.toLowerCase();

  if (type === 'cash_sale') cat = 'cash_sale';
  else if (type === 'debt_sale') cat = 'debt_sale';
  else if (type === 'settings') cat = 'settings';
  else if (type === 'refund') cat = 'refund';
  else if (type === 'sync') cat = 'sync';
  else if (type === 'error') cat = 'error';
  else if (type === 'warning') cat = 'warning';
  else {
    if (str.includes('سلة') || str.includes('cart') || str.includes('sepet')) cat = 'cart';
    else if (str.includes('آجل') || str.includes('دين') || str.includes('ذمم') || str.includes('سداد') || str.includes('debt') || str.includes('borç') || str.includes('veresiye')) cat = 'debt_sale';
    else if (str.includes('فاتورة') || str.includes('بيع') || str.includes('sale') || str.includes('invoice') || str.includes('satış') || str.includes('kasa')) cat = 'cash_sale';
    else if (str.includes('حرج') || str.includes('منخفض') || str.includes('low stock') || str.includes('kritik') || str.includes('azalan')) cat = 'stock';
    else if (str.includes('نفاد') || str.includes('فاضي') || str.includes('نفذ') || str.includes('out of stock') || str.includes('tükendi')) cat = 'out_of_stock';
    else if (str.includes('إعداد') || str.includes('setting') || str.includes('ayar')) cat = 'settings';
    else if (str.includes('استرداد') || str.includes('مرتجع') || str.includes('refund') || str.includes('iade')) cat = 'refund';
    else if (str.includes('مزامنة') || str.includes('sync') || str.includes('senkron')) cat = 'sync';
    else if (str.includes('خطأ') || str.includes('فشل') || str.includes('error') || str.includes('fail') || str.includes('hata')) cat = 'error';
    else if (str.includes('تحذير') || str.includes('تنبيه') || str.includes('warning') || str.includes('uyarı')) cat = 'warning';
    else cat = 'general';
  }

  const invoiceNum = toast.invoiceNumber || (typeof toast.subtitle === 'string' && toast.subtitle.startsWith('#') ? toast.subtitle.replace(/^#/, '') : undefined);

  // استخراج وتنسيق التفاصيل الحقيقية للعملية
  let formattedItemName = toast.itemName;
  let formattedDescription = toast.description;
  const formattedPrice = toast.price ? String(toast.price) : undefined;

  // 1. إضافة أو تعديل منتج
  if (str.includes('إضافة منتج') || str.includes('تم حفظ المنتج') || str.includes('إضافة الصنف') || toast.operation === 'product_added') {
    if (!formattedItemName && toast.description && typeof toast.description === 'string' && !toast.description.includes('نجاح')) {
      formattedItemName = `📦 ${toast.description}`;
      formattedDescription = undefined;
    } else if (formattedItemName) {
      formattedItemName = `📦 ${formattedItemName}`;
    }
  } else if (str.includes('تعديل منتج') || str.includes('تحديث بيانات') || str.includes('تعديل الصنف') || toast.operation === 'product_updated') {
    if (!formattedItemName && toast.description && typeof toast.description === 'string') {
      formattedItemName = `✏️ تم تحديث بيانات ${toast.description}`;
      formattedDescription = undefined;
    } else if (formattedItemName) {
      formattedItemName = `✏️ تم تحديث بيانات ${formattedItemName}`;
    }
  } else if (cat === 'sync' || str.includes('مزامنة')) {
    if (!formattedDescription && !formattedItemName) {
      formattedItemName = '☁️ تم التزامن مع السحابة بنجاح';
    } else if (formattedDescription && typeof formattedDescription === 'string') {
      formattedItemName = `☁️ ${formattedDescription}`;
      formattedDescription = undefined;
    }
  } else if (cat === 'cash_sale' || cat === 'debt_sale' || str.includes('فاتورة')) {
    if (invoiceNum && !formattedItemName && !formattedDescription) {
      formattedItemName = `🧾 فاتورة #${invoiceNum}`;
    }
  }

  return {
    operationName: toast.title || toast.operation || 'إشعار النظام',
    category: cat,
    itemName: formattedItemName,
    isMultiple: toast.isMultiple !== undefined ? toast.isMultiple : (toast.itemCount !== undefined ? toast.itemCount > 1 : false),
    itemCount: toast.itemCount,
    price: formattedPrice,
    stockQuantity: toast.stockQuantity,
    invoiceNumber: invoiceNum,
    note: typeof toast.subtitle === 'string' && !toast.subtitle.startsWith('#') ? toast.subtitle : undefined,
    primaryLabel: toast.primaryLabel,
    primaryValue: toast.primaryValue,
    secondaryLabel: toast.secondaryLabel,
    secondaryValue: toast.secondaryValue,
    description: formattedDescription,
    pillText: toast.pillText,
    statusBadge: toast.statusBadge,
  };
}

export interface UnifiedSmartToastProps extends SmartToastData {
  onDismiss?: (id: string) => void;
}

export const SmartToastCard: React.FC<UnifiedSmartToastProps> = () => null;

export function SmartToast() {
  const { toast } = useSmartToastListener();
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [dismissDirection, setDismissDirection] = useState<'up' | 'left' | 'right' | null>(null);
  const [dragState, setDragState] = useState<{ x: number; y: number; rotate: number; opacity: number } | null>(null);

  // مراحل ظهور وانكماش بطاقة الإشعار
  const [animPhase, setAnimPhase] = useState<'entering' | 'expanded' | 'retracting' | 'dismissed'>('dismissed');
  const [resolvedDuration, setResolvedDuration] = useState<number>(2500);

  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(2500);
  const pointerStartRef = useRef<{ x: number; y: number; time: number; pointerId: number } | null>(null);
  const isDraggingRef = useRef(false);

  // إغلاق الإشعار بالسحب الجانبي بزاوية دوران خفيفة وسلسة
  const dismissNotification = useCallback((direction: 'up' | 'left' | 'right' = 'up') => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    setDragState(null);
    setIsPaused(false);
    setDismissDirection(direction);
    setIsVisible(false);
    setAnimPhase('dismissed');
    playDismissSound();

    setTimeout(() => {
      hideSmartToast();
      setDismissDirection(null);
    }, 260);
  }, []);

  // انكماش الإشعار وصعوده للأعلى لتبتلعه الجزيرة التفاعلية فوراً (Swipe Up / Expiration)
  const retractNotification = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    setAnimPhase('retracting');
    playDismissSound();

    setTimeout(() => {
      hideSmartToast();
      setAnimPhase('dismissed');
      setIsVisible(false);
      setIsPaused(false);
      setDismissDirection(null);
      setDragState(null);
    }, 260);
  }, []);

  // تجميد العد التنازلي عند اللمس أو وضع المؤشر
  const pauseCountdown = useCallback(() => {
    setIsPaused(true);
    const elapsed = Date.now() - (startTimeRef.current || Date.now());
    remainingTimeRef.current = Math.max(500, remainingTimeRef.current - elapsed);
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  // استئناف العد التنازلي عند رفع اليد أو خروج المؤشر
  const resumeCountdown = useCallback(() => {
    setIsPaused(false);
    startTimeRef.current = Date.now();
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    if (!Number.isFinite(remainingTimeRef.current)) return;
    autoDismissTimerRef.current = setTimeout(() => {
      retractNotification();
    }, remainingTimeRef.current);
  }, [retractNotification]);

  // دورة حياة الإشعار عند استلام تنبيه جديد
  useEffect(() => {
    if (!toast) {
      setAnimPhase('dismissed');
      setIsVisible(false);
      setIsPaused(false);
      return;
    }

    const duration = toast.duration || getDefaultToastDuration();
    setResolvedDuration(duration);
    remainingTimeRef.current = duration;
    startTimeRef.current = Date.now();
    setIsVisible(true);
    setIsPaused(false);
    setDismissDirection(null);
    setDragState(null);

    // 1. مرحلة الظهور الناعم من الجزيرة
    setAnimPhase('entering');
    playDropSound();

    // 2. التمدد المستقر وبدء مؤقت الإغلاق
    const tExpand = setTimeout(() => {
      setAnimPhase('expanded');
      startTimeRef.current = Date.now();
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
      if (Number.isFinite(duration)) {
        autoDismissTimerRef.current = setTimeout(() => {
          retractNotification();
        }, duration);
      }
    }, 80);

    return () => {
      clearTimeout(tExpand);
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
    };
  }, [toast, retractNotification]);

  // تجميد الإشعار عند وضع المؤشر (Mouse Hover)
  const handleMouseEnter = () => {
    pauseCountdown();
  };

  const handleMouseLeave = () => {
    if (isDraggingRef.current) return;
    resumeCountdown();
  };

  // محرك السحب واللمس مع التجميد الفوري عند وضع اليد (Touch / Pointer Down)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;

    isDraggingRef.current = true;
    pauseCountdown();

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
      pointerId: e.pointerId,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !pointerStartRef.current) return;

    const deltaX = e.clientX - pointerStartRef.current.x;
    const deltaY = e.clientY - pointerStartRef.current.y;

    const clampedDeltaY = deltaY > 20 ? deltaY * 0.2 : deltaY;
    const rotation = deltaX * 0.06;
    const distance = Math.hypot(deltaX, clampedDeltaY);
    const opacity = Math.max(0.3, 1 - distance / 240);

    setDragState({
      x: deltaX,
      y: clampedDeltaY,
      rotate: rotation,
      opacity,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !pointerStartRef.current) return;
    isDraggingRef.current = false;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const deltaX = e.clientX - pointerStartRef.current.x;
    const deltaY = e.clientY - pointerStartRef.current.y;
    const elapsedTime = Math.max(Date.now() - pointerStartRef.current.time, 1);
    const velocityX = deltaX / elapsedTime;
    const velocityY = deltaY / elapsedTime;

    pointerStartRef.current = null;

    // 1. سحب للأعلى (ابتلاع ناعم بالجزيرة)
    if (deltaY < -20 || velocityY < -0.22) {
      retractNotification();
      return;
    }

    // 2. سحب لليمين (طيران جانبي بزاوية دوران خفيفة وسلسة)
    if (deltaX > 25 || velocityX > 0.22) {
      dismissNotification('right');
      return;
    }

    // 3. سحب لليسار (طيران جانبي بزاوية دوران خفيفة وسلسة)
    if (deltaX < -25 || velocityX < -0.22) {
      dismissNotification('left');
      return;
    }

    // لمس بدون سحب: يستأنف العد التنازلي عند رفع اليد
    setDragState(null);
    resumeCountdown();
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    pointerStartRef.current = null;
    setDragState(null);
    resumeCountdown();
  };

  if (!toast) return null;

  // استخراج وتنسيق تفاصيل العملية
  const details = resolveToastDetails(toast);

  // أنماط الأيقونات والألوان التفاعلية المتناسقة مع رموز السمة
  const getCategoryConfig = () => {
    switch (details.category) {
      case 'cash_sale':
      case 'invoice':
        return {
          bg: 'bg-primary/10',
          border: 'border-primary/30',
          text: 'text-primary',
          dot: 'bg-primary',
          bar: 'bg-primary',
          icon: <CheckCircle2 className="w-4 h-4 text-primary" />,
        };
      case 'debt_sale':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/25',
          text: 'text-amber-600 dark:text-amber-400',
          dot: 'bg-amber-500',
          bar: 'bg-amber-500',
          icon: <Clock className="w-4 h-4" />,
        };
      case 'settings':
        return {
          bg: 'bg-primary/10',
          border: 'border-primary/30',
          text: 'text-primary',
          dot: 'bg-primary',
          bar: 'bg-primary',
          icon: <Sliders className="w-4 h-4 text-primary" />,
        };
      case 'refund':
        return {
          bg: 'bg-orange-500/10',
          border: 'border-orange-500/25',
          text: 'text-orange-600 dark:text-orange-400',
          dot: 'bg-orange-500',
          bar: 'bg-orange-500',
          icon: <RotateCcw className="w-4 h-4" />,
        };
      case 'sync':
        return {
          bg: 'bg-primary/10',
          border: 'border-primary/30',
          text: 'text-primary',
          dot: 'bg-primary',
          bar: 'bg-primary',
          icon: <RefreshCw className="w-4 h-4 text-primary" />,
        };
      case 'error':
      case 'out_of_stock':
        return {
          bg: 'bg-destructive/10',
          border: 'border-destructive/25',
          text: 'text-destructive',
          dot: 'bg-destructive',
          bar: 'bg-destructive',
          icon: <XCircle className="w-4 h-4" />,
        };
      case 'warning':
      case 'stock':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/25',
          text: 'text-amber-600 dark:text-amber-400',
          dot: 'bg-amber-500',
          bar: 'bg-amber-500',
          icon: <AlertTriangle className="w-4 h-4" />,
        };
      case 'cart':
        return {
          bg: 'bg-primary/10',
          border: 'border-primary/25',
          text: 'text-primary',
          dot: 'bg-primary',
          bar: 'bg-primary',
          icon: <ShoppingBag className="w-4 h-4" />,
        };
      default:
        return {
          bg: 'bg-primary/10',
          border: 'border-primary/25',
          text: 'text-primary',
          dot: 'bg-primary',
          bar: 'bg-primary',
          icon: <CheckCircle2 className="w-4 h-4" />,
        };
    }
  };

  const config = getCategoryConfig();

  // حساب التحول الفيزيائي لظهور وانكماش البطاقة
  let transform = 'translate(0px, 0px) scale(1)';
  let opacity = 1;

  if (animPhase === 'entering') {
    transform = 'translate(0px, -10px) scale(0.96)';
    opacity = 0.85;
  } else if (animPhase === 'retracting') {
    transform = 'translate(0px, -30px) scale(0.75)';
    opacity = 0;
  } else if (!isVisible) {
    if (dismissDirection === 'right') {
      transform = 'translateX(100vw) rotate(10deg)';
    } else if (dismissDirection === 'left') {
      transform = 'translateX(-100vw) rotate(-10deg)';
    } else {
      transform = 'translateY(-80px) scale(0.9)';
    }
    opacity = 0;
  } else if (dragState) {
    transform = `translate(${dragState.x}px, ${dragState.y}px) rotate(${dragState.rotate}deg)`;
    opacity = dragState.opacity;
  }

  const isDismissing = !isVisible && dismissDirection !== null;

  return (
    <div className="fixed top-[calc(0.75rem+env(safe-area-inset-top))] inset-x-0 px-3 z-[100] flex justify-center pointer-events-none" dir="rtl">
      {/* بطاقة الإشعار الذكية المدمجة والمحسوبة وفق ألوان السمة */}
      <div
        className={cn(
          "smart-toast-card pointer-events-auto cursor-grab active:cursor-grabbing overflow-hidden transform-gpu select-none touch-none",
          "w-full max-w-[21rem] sm:max-w-[22rem] rounded-2xl shadow-xl border border-border/80 bg-card/95 backdrop-blur-xl",
          animPhase === 'entering' && "transition-all duration-100 ease-out",
          animPhase === 'expanded' && "transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          animPhase === 'retracting' && "dynamic-island-retract",
          isDismissing && "notification-dismissing",
          (!isDismissing && animPhase === 'expanded') && "notification-spring",
          dragState && !isDismissing && "dragging"
        )}
        style={{
          transform,
          opacity,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* محتوى الإشعار المدمج المباشر بدون أسطر فارغة */}
        <div className="px-3 py-2 flex items-center justify-between gap-2.5">
          {/* الأيقونة + العنوان والتفاصيل في سطرين مدمجين */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={cn("w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 relative", config.bg, config.border, config.text)}>
              {config.icon}
            </div>

            <div className="min-w-0 flex-1">
              {/* السطر الأول: العملية ورقم الفاتورة */}
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-black text-foreground truncate">
                  {details.operationName}
                </h4>
                {details.invoiceNumber && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted font-mono font-bold text-muted-foreground shrink-0 border border-border/40">
                    #{details.invoiceNumber}
                  </span>
                )}
              </div>

              {/* السطر الثاني: التفاصيل الحقيقية للعملية (القطعة / السعر / الحالة) */}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate mt-0.5">
                {details.itemName ? (
                  <span className="font-semibold text-foreground/90 truncate">
                    {details.itemName}
                  </span>
                ) : details.description ? (
                  <span className="truncate">{details.description}</span>
                ) : (
                  <span>{details.statusBadge || 'تمت العملية بنجاح'}</span>
                )}

                {details.price && (
                  <span className="font-mono font-bold text-primary shrink-0 mr-auto">
                    ({details.price})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* زر إغلاق أنيق وصغير */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              retractNotification();
            }}
            className="w-5 h-5 rounded-md text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* أزرار الإجراءات المتكاملة (طباعة / مشاركة) إن وُجدت */}
        {(toast.primaryAction || toast.secondaryAction) && (
          <div className="px-3 pb-2 pt-0 flex items-center gap-2">
            {toast.primaryAction && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  toast.primaryAction?.onClick();
                  retractNotification();
                }}
                className="flex-1 py-1 px-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition active:scale-95 shadow-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>{toast.primaryAction.label}</span>
              </button>
            )}
            {toast.secondaryAction && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  toast.secondaryAction?.onClick();
                  retractNotification();
                }}
                className="flex-1 py-1 px-2.5 rounded-lg bg-muted hover:bg-muted/80 text-card-foreground font-bold text-xs transition active:scale-95 border border-border/40 flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>{toast.secondaryAction.label}</span>
              </button>
            )}
          </div>
        )}

        {/* شريط المؤقت الزمني للإغلاق التلقائي (يتجمد فوراً عند وضع اليد أو المؤشر) */}
        <div className="h-0.5 bg-muted/50 w-full overflow-hidden">
          <div
            className={cn(
              "h-full",
              config.bar,
              animPhase === 'expanded' && isVisible && !isPaused && "timer-active",
              (isPaused || animPhase !== 'expanded' || !isVisible) && "timer-paused"
            )}
            style={{ '--duration': Number.isFinite(resolvedDuration) ? `${resolvedDuration}ms` : '0ms' } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}
