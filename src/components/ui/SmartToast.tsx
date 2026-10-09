import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSmartToastListener, hideSmartToast, SmartToastData } from '@/hooks/use-smart-toast';
import { cn } from '@/lib/utils';

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
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {}
}

function playBurstSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
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
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  } catch {}
}

// قراءة مدة بقاء الإشعار المضبوطة من الإعدادات (الافتراضي 2 ثانية، أو بين 0.5 و 3 ثواني)
function getDefaultToastDuration(): number {
  try {
    const saved = localStorage.getItem('hyperpos_toast_duration');
    if (saved) {
      const val = Number(saved);
      if (!isNaN(val) && val >= 500 && val <= 5000) return val;
    }
  } catch {}
  return 2000;
}

// =========================================================================
// محلل التفاصيل الذكي: استخراج اسم العملية والقطعة والسعر والوحدات المتعددة
// =========================================================================
interface ParsedToastDetails {
  operationName: string;
  category: 'cart' | 'invoice' | 'stock' | 'out_of_stock' | 'restock' | 'pin' | 'payment' | 'general';
  itemName?: string;
  isMultiple?: boolean;
  itemCount?: number;
  price?: string;
  stockQuantity?: number;
  note?: string;
}

function resolveToastDetails(toast: SmartToastData): ParsedToastDetails {
  if (toast.operation) {
    let cat: ParsedToastDetails['category'] = 'general';
    if (toast.operation.includes('سلة')) cat = 'cart';
    else if (toast.operation.includes('فاتورة') || toast.operation.includes('بيع')) cat = 'invoice';
    else if (toast.operation.includes('حرج') || toast.operation.includes('منخفض')) cat = 'stock';
    else if (toast.operation.includes('نفاد') || toast.operation.includes('فاضي')) cat = 'out_of_stock';
    else if (toast.operation.includes('زيادة') || toast.operation.includes('توريد')) cat = 'restock';
    else if (toast.operation.includes('تثبيت') || toast.operation.includes('تعليق')) cat = 'pin';
    else if (toast.operation.includes('دين') || toast.operation.includes('دفعة')) cat = 'payment';

    return {
      operationName: toast.operation,
      category: cat,
      itemName: toast.itemName,
      isMultiple: toast.isMultiple ?? (toast.itemCount !== undefined && toast.itemCount > 1),
      itemCount: toast.itemCount,
      price: toast.price ? String(toast.price) : undefined,
      stockQuantity: toast.stockQuantity,
      note: toast.subtitle,
    };
  }

  const title = toast.title || '';
  const subtitle = toast.subtitle || '';
  const combined = `${title} ${subtitle}`;

  // 1. إضافة إلى السلة
  if (combined.includes('إضافة') && (combined.includes('سلة') || combined.includes('السلة'))) {
    const match = combined.match(/(?:إضافة|أضيف)\s+(.+?)(?:\s+إلى\s+السلة|\s*\(|$)/);
    const rawName = match ? match[1].trim() : undefined;
    return {
      operationName: 'إضافة منتج إلى السلة',
      category: 'cart',
      itemName: rawName,
      isMultiple: combined.includes('وحدات متعددة') || combined.includes('كرتونة'),
      note: subtitle !== title ? subtitle : undefined,
    };
  }

  // 2. فاتورة مكتملة / بيع
  if (combined.includes('فاتورة') || combined.includes('مزامنة') || combined.includes('مزامنتها')) {
    const isDebt = combined.includes('آجل') || combined.includes('دين');
    const priceMatch = combined.match(/([$₺€][\d,.]+|[\d,.]+\s*[$₺€]|[\d,.]+\s*(?:ل\.س|SP|TRY|USD))/i);
    return {
      operationName: isDebt ? 'فاتورة بيع آجل' : 'فاتورة مكتملة',
      category: 'invoice',
      price: priceMatch ? priceMatch[0] : undefined,
      isMultiple: true,
      note: subtitle !== title ? subtitle : undefined,
    };
  }

  // 3. تنبيه مخزون حرج
  if (combined.includes('مخزون منخفض') || combined.includes('حرج') || combined.includes('كمية منخفضة')) {
    const nameMatch = combined.match(/المنتج\s+["'«]([^"'»]+)["'»]/) || combined.match(/المنتج\s+([^لديه]+)/);
    const qtyMatch = combined.match(/\((\d+)\s*فقط\)/) || combined.match(/(\d+)\s*(?:فقط|قطعة)/);
    return {
      operationName: 'تنبيه مخزون حرج',
      category: 'stock',
      itemName: nameMatch ? nameMatch[1].trim() : undefined,
      stockQuantity: qtyMatch ? Number(qtyMatch[1]) : undefined,
      note: subtitle !== title ? subtitle : undefined,
    };
  }

  // 4. نفاد المخزون
  if (combined.includes('نفذ المخزون') || combined.includes('نفاد') || combined.includes('فاضي') || combined.includes('انتهت الكمية')) {
    const nameMatch = combined.match(/المنتج\s+["'«]([^"'»]+)["'»]/);
    return {
      operationName: 'نفاد المخزون',
      category: 'out_of_stock',
      itemName: nameMatch ? nameMatch[1].trim() : undefined,
      stockQuantity: 0,
      note: 'المخزون نفد بالكامل (0)',
    };
  }

  // 5. زيادة مخزون
  if (combined.includes('زيادة مخزون') || combined.includes('توريد') || combined.includes('شراء')) {
    return {
      operationName: 'زيادة مخزون',
      category: 'restock',
      note: subtitle !== title ? subtitle : undefined,
    };
  }

  // 6. تثبيت طلب
  if (combined.includes('تثبيت') || combined.includes('معلق')) {
    return {
      operationName: 'تثبيت العملية',
      category: 'pin',
      note: subtitle !== title ? subtitle : undefined,
    };
  }

  // 7. سداد دين
  if (combined.includes('دين') || combined.includes('دفعة') || combined.includes('سداد')) {
    const priceMatch = combined.match(/([$₺€][\d,.]+|[\d,.]+\s*[$₺€]|[\d,.]+\s*(?:ل\.س|SP|TRY|USD))/i);
    return {
      operationName: 'سداد دفعة / دفع دين',
      category: 'payment',
      price: priceMatch ? priceMatch[0] : undefined,
      note: subtitle !== title ? subtitle : undefined,
    };
  }

  // افتراضي
  return {
    operationName: title,
    category: toast.type === 'error' ? 'out_of_stock' : toast.type === 'warning' ? 'stock' : 'general',
    note: subtitle && subtitle !== title ? subtitle : undefined,
  };
}

export function SmartToast() {
  const { toast } = useSmartToastListener();
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [dismissDirection, setDismissDirection] = useState<'up' | 'left' | 'right' | null>(null);
  const [dragState, setDragState] = useState<{ x: number; y: number; rotate: number; opacity: number } | null>(null);

  // مراحل حركة الجزيرة التفاعلية
  const [animPhase, setAnimPhase] = useState<'dropping' | 'bursting' | 'expanded' | 'retracting' | 'dismissed'>('dismissed');
  const [shockwaveKey, setShockwaveKey] = useState<number | null>(null);
  const [resolvedDuration, setResolvedDuration] = useState<number>(2000);

  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number; pointerId: number } | null>(null);
  const isDraggingRef = useRef(false);

  // إغلاق الإشعار بالسحب الخاطف
  const dismissNotification = useCallback((direction: 'up' | 'left' | 'right' = 'up') => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
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
      setShockwaveKey(null);
    }, 280);
  }, []);

  // انكماش الإشعار وصعوده لتبتلعه الجزيرة تلقائياً
  const retractNotification = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
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
      setShockwaveKey(null);
    }, 280);
  }, []);

  // ضبط مؤقت الإغلاق التلقائي
  const resetAutoDismiss = useCallback((duration: number) => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    autoDismissTimerRef.current = setTimeout(() => {
      retractNotification();
    }, duration);
  }, [retractNotification]);

  // دورة حياة الإشعار عند وصول رسالة جديدة
  useEffect(() => {
    if (!toast) {
      setAnimPhase('dismissed');
      setIsVisible(false);
      setIsPaused(false);
      return;
    }

    const duration = toast.duration || getDefaultToastDuration();
    setResolvedDuration(duration);
    setIsVisible(true);
    setIsPaused(false);
    setDismissDirection(null);
    setDragState(null);

    // 1. مرحلة السقوط الكروي من الجزيرة (Droplet Drop)
    setAnimPhase('dropping');
    playDropSound();

    // 2. لحظة الارتطام والانفجار وموجات الصدمة الجانبية (Burst & Shockwaves)
    const tImpact = setTimeout(() => {
      setShockwaveKey(Date.now());
      playBurstSound();
      setAnimPhase('bursting');
    }, 110);

    // 3. التمدد السائل المستقر وبدء شريط المؤقت (Fluid Expand)
    const tExpand = setTimeout(() => {
      setAnimPhase('expanded');
      resetAutoDismiss(duration);
    }, 360);

    return () => {
      clearTimeout(tImpact);
      clearTimeout(tExpand);
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, [toast, resetAutoDismiss]);

  // تجميد الإشعار عند وضع المؤشر (Mouse Hover)
  const handleMouseEnter = () => {
    setIsPaused(true);
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
  };

  const handleMouseLeave = () => {
    if (isDraggingRef.current) return;
    setIsPaused(false);
    resetAutoDismiss(resolvedDuration);
  };

  // محرك السحب واللمس مع التجميد الفوري عند وضع اليد
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;

    isDraggingRef.current = true;
    setIsPaused(true);
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
      pointerId: e.pointerId,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !pointerStartRef.current) return;

    const deltaX = e.clientX - pointerStartRef.current.x;
    const deltaY = e.clientY - pointerStartRef.current.y;

    const clampedDeltaY = deltaY > 30 ? deltaY * 0.25 : deltaY;
    const rotation = deltaX * 0.08;
    const distance = Math.hypot(deltaX, clampedDeltaY);
    const opacity = Math.max(0.25, 1 - distance / 260);

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

    // 1. سحب للأعلى
    if (deltaY < -35 || velocityY < -0.35) {
      dismissNotification('up');
      return;
    }

    // 2. سحب لليمين
    if (deltaX > 35 || velocityX > 0.28) {
      dismissNotification('right');
      return;
    }

    // 3. سحب لليسار
    if (deltaX < -35 || velocityX < -0.28) {
      dismissNotification('left');
      return;
    }

    // إفلات اللمس دون سحب: يستأنف المؤقت انسيابياً
    setDragState(null);
    setIsPaused(false);
    resetAutoDismiss(resolvedDuration);
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    pointerStartRef.current = null;
    setDragState(null);
    setIsPaused(false);
    resetAutoDismiss(resolvedDuration);
  };

  if (!toast) return null;

  // استخراج وتحليل تفاصيل العملية
  const details = resolveToastDetails(toast);

  // أنماط الأيقونات والألوان التفاعلية المتناسقة تماماً مع السمة
  const getCategoryConfig = () => {
    switch (details.category) {
      case 'cart':
        return {
          bg: 'bg-primary/15',
          border: 'border-primary/30',
          text: 'text-primary',
          dot: 'bg-primary',
          bar: 'bg-primary',
          shockColor: 'hsl(var(--primary))',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
        };
      case 'invoice':
        return {
          bg: 'bg-emerald-500/15',
          border: 'border-emerald-500/30',
          text: 'text-emerald-500 dark:text-emerald-400',
          dot: 'bg-emerald-500',
          bar: 'bg-emerald-500',
          shockColor: '#10b981',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
      case 'stock':
        return {
          bg: 'bg-amber-500/15',
          border: 'border-amber-500/30',
          text: 'text-amber-500 dark:text-amber-400',
          dot: 'bg-amber-500',
          bar: 'bg-amber-500',
          shockColor: '#f59e0b',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
        };
      case 'out_of_stock':
        return {
          bg: 'bg-rose-500/15',
          border: 'border-rose-500/30',
          text: 'text-rose-500 dark:text-rose-400',
          dot: 'bg-rose-500',
          bar: 'bg-rose-500',
          shockColor: '#f43f5e',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
        };
      case 'restock':
        return {
          bg: 'bg-sky-500/15',
          border: 'border-sky-500/30',
          text: 'text-sky-500 dark:text-sky-400',
          dot: 'bg-sky-500',
          bar: 'bg-sky-500',
          shockColor: '#0ea5e9',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
          ),
        };
      case 'pin':
        return {
          bg: 'bg-purple-500/15',
          border: 'border-purple-500/30',
          text: 'text-purple-500 dark:text-purple-400',
          dot: 'bg-purple-500',
          bar: 'bg-purple-500',
          shockColor: '#a855f7',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          ),
        };
      case 'payment':
        return {
          bg: 'bg-indigo-500/15',
          border: 'border-indigo-500/30',
          text: 'text-indigo-500 dark:text-indigo-400',
          dot: 'bg-indigo-500',
          bar: 'bg-indigo-500',
          shockColor: '#6366f1',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
        };
      default:
        return {
          bg: 'bg-primary/15',
          border: 'border-primary/30',
          text: 'text-primary',
          dot: 'bg-primary',
          bar: 'bg-primary',
          shockColor: 'hsl(var(--primary))',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        };
    }
  };

  const config = getCategoryConfig();

  // حساب التحول الفيزيائي حسب مرحلة حركة الجزيرة
  let transform = 'translate(0px, 0px) rotate(0deg) scale(1)';
  let opacity = 1;
  let cardClass = 'w-full max-w-[404px] rounded-[26px]';
  let contentOpacity = 1;

  if (animPhase === 'dropping') {
    transform = 'translate(0px, -6px) scale(0.65, 1.35)';
    cardClass = 'w-11 h-11 rounded-full';
    contentOpacity = 0;
  } else if (animPhase === 'bursting') {
    transform = 'translate(0px, 0px) scale(1)';
    cardClass = 'w-full max-w-[404px] rounded-[26px]';
    contentOpacity = 0.8;
  } else if (animPhase === 'retracting') {
    transform = 'translate(0px, -45px) scale(0.32, 1.25)';
    cardClass = 'w-9 h-9 rounded-full';
    opacity = 0;
    contentOpacity = 0;
  } else if (!isVisible) {
    if (dismissDirection === 'right') {
      transform = 'translateX(120vw) rotate(14deg)';
    } else if (dismissDirection === 'left') {
      transform = 'translateX(-120vw) rotate(-14deg)';
    } else {
      transform = 'translateY(-140px) scale(0.92)';
    }
    opacity = 0;
  } else if (dragState) {
    transform = `translate(${dragState.x}px, ${dragState.y}px) rotate(${dragState.rotate}deg)`;
    opacity = dragState.opacity;
  }

  const isDismissing = !isVisible && dismissDirection !== null;

  return (
    <div className="fixed top-5 inset-x-0 px-3 z-[100] flex justify-center pointer-events-none">
      {/* موجات الصدمة العريضة الجانبية (Lateral Shockwaves & Edge Flares) */}
      {shockwaveKey && (
        <div className="absolute top-4 pointer-events-none flex items-center justify-center -z-10 w-full overflow-visible">
          <div
            key={`sw1-${shockwaveKey}`}
            className="shockwave-ring w-12 h-12"
            style={{
              borderColor: config.shockColor,
              boxShadow: `0 0 28px ${config.shockColor}`,
            }}
          />
          <div
            key={`sw2-${shockwaveKey}`}
            className="shockwave-ring w-12 h-12"
            style={{
              borderColor: '#ffffff',
              boxShadow: `0 0 20px ${config.shockColor}`,
              animationDelay: '0.05s',
              animationDuration: '0.52s',
            }}
          />
          <div
            key={`fl-${shockwaveKey}`}
            className="edge-flare left-1"
            style={{ backgroundColor: config.shockColor }}
          />
          <div
            key={`fr-${shockwaveKey}`}
            className="edge-flare right-1"
            style={{ backgroundColor: config.shockColor }}
          />
        </div>
      )}

      {/* بطاقة الإشعار الذكية المنبثقة من الجزيرة (تتوافق 100% مع الشفافية والسمة) */}
      <div
        className={cn(
          "smart-toast-card pointer-events-auto cursor-grab active:cursor-grabbing overflow-hidden transform-gpu select-none touch-none",
          cardClass,
          animPhase === 'dropping' && "transition-[transform,width,height,border-radius] duration-120 ease-out",
          animPhase === 'bursting' && "transition-all duration-360 [transition-timing-function:cubic-bezier(0.34,1.45,0.64,1)]",
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
        {/* مقبض السحب المرئي العلوي (Pill Handle) */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-8 h-1 rounded-full bg-foreground/20"></div>
        </div>

        {/* محتوى الإشعار المباشر مع كامل التفاصيل دون زر فتح */}
        <div
          className="px-3.5 pb-2.5 pt-0.5 space-y-2 transition-opacity duration-200 ease-out"
          style={{ opacity: contentOpacity }}
        >
          {/* سطر الرأس: أيقونة العملية + اسم العملية + مؤشر التجميد + زر الإغلاق */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* أيقونة العملية الدقيقة مع نبض متوهج */}
              <div className={cn("w-9 h-9 rounded-2xl border flex items-center justify-center shrink-0 relative", config.bg, config.border, config.text)}>
                {config.icon}
                <span className={cn("absolute top-1 right-1 w-2 h-2 rounded-full pulse-dot", config.dot)} />
              </div>

              {/* اسم العملية وحالة الوقت / التجميد */}
              <div className="min-w-0 flex-1">
                <h4 className="text-[13px] font-extrabold text-foreground truncate leading-tight tracking-tight">
                  {details.operationName}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isPaused ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 dark:text-amber-400">
                      <span>⏸</span> مجمّد للقراءة
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {toast.time || 'الآن'}
                    </span>
                  )}
                  {details.category === 'invoice' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                      معتمدة
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* زر إغلاق صريح وناعم */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissNotification('up');
              }}
              className="w-7 h-7 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition active:scale-90 border border-border/40 shrink-0"
              title="إغلاق"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* كتلة تفاصيل العملية المباشرة - معروضة كلياً وفورياً */}
          <div className="p-2.5 rounded-2xl bg-foreground/[0.03] dark:bg-white/[0.04] border border-border/40 space-y-1.5 text-xs">
            {/* سطر القطعة أو الوحدات المتعددة */}
            {details.isMultiple ? (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-xs">
                  <span>📦</span>
                  <span>وحدات متعددة</span>
                  {details.itemCount && (
                    <span className="font-mono text-[11px] opacity-80">({details.itemCount} قطع)</span>
                  )}
                </span>
                {details.price && (
                  <span className="font-mono font-extrabold text-xs text-foreground bg-muted/50 px-2 py-0.5 rounded-lg border border-border/30">
                    {details.price}
                  </span>
                )}
              </div>
            ) : details.itemName ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[11px] text-muted-foreground shrink-0 font-medium">القطعة:</span>
                  <span className="font-bold text-foreground text-xs truncate" title={details.itemName}>
                    {details.itemName}
                  </span>
                </div>
                {details.price && (
                  <span className="font-mono font-extrabold text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20 shrink-0">
                    {details.price}
                  </span>
                )}
              </div>
            ) : null}

            {/* سطر السعر الصريح إذا لم تكن القطعة معروضة */}
            {!details.itemName && !details.isMultiple && details.price && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground font-medium">السعر / القيمة:</span>
                <span className="font-mono font-black text-sm text-primary tracking-tight">
                  {details.price}
                </span>
              </div>
            )}

            {/* سطر المخزون (لتنبيهات المخزون الحرج أو نفاد المخزون) */}
            {details.stockQuantity !== undefined && (
              <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-border/25">
                <span className="text-[11px] text-muted-foreground font-medium">المخزون المتوفر:</span>
                <span
                  className={cn(
                    "font-mono font-bold text-xs px-2 py-0.5 rounded-lg border",
                    details.stockQuantity === 0
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  )}
                >
                  {details.stockQuantity === 0 ? 'نفد بالكامل (0)' : `${details.stockQuantity} قطعة فقط`}
                </span>
              </div>
            )}

            {/* سطر الملاحظة أو التفصيل الإضافي */}
            {details.note && (
              <div className="text-[11px] text-muted-foreground leading-relaxed pt-0.5 border-t border-border/25">
                {details.note}
              </div>
            )}

            {/* زر الإجراء الأساسي إن وُجد */}
            {toast.primaryAction && (
              <button
                type="button"
                onClick={() => {
                  toast.primaryAction?.onClick();
                  dismissNotification('up');
                }}
                className="w-full mt-1 py-1.5 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition active:scale-95 shadow-sm"
              >
                {toast.primaryAction.label}
              </button>
            )}
          </div>
        </div>

        {/* شريط المؤقت الزمني للإغلاق التلقائي (يتجمد فوراً عند وضع اليد) */}
        <div className="h-1 bg-muted/40 dark:bg-white/10 w-full overflow-hidden">
          <div
            className={cn(
              "h-full",
              config.bar,
              animPhase === 'expanded' && isVisible && !isPaused && "timer-active",
              (isPaused || animPhase !== 'expanded' || !isVisible) && "timer-paused"
            )}
            style={{ '--duration': `${resolvedDuration}ms` } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}
