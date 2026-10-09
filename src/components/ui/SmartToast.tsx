import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSmartToastListener, hideSmartToast } from '@/hooks/use-smart-toast';
import { cn } from '@/lib/utils';

// =========================================================================
// محرك المؤثرات الصوتية الخفيفة المدمج بواسطة Web Audio API (Native Feel)
// مستوحى بدقة من المعاينة التفاعلية لـ Dynamic Island المطور
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

// 1. صوت السقوط الزئبقي من الجزيرة (Drop Chime)
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

// 2. صوت الانفجار الجانبي اللحظي (Burst & Pop)
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

// 3. صوت المغادرة السريعة (Dismiss & Retract)
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

// 4. نقرة فتح التفاصيل (Expand Tick)
function playExpandSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
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
  return 2000; // 2 ثانية الافتراضي
}

export function SmartToast() {
  const { toast } = useSmartToastListener();
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissDirection, setDismissDirection] = useState<'up' | 'left' | 'right' | null>(null);
  const [dragState, setDragState] = useState<{ x: number; y: number; rotate: number; opacity: number } | null>(null);

  // مراحل الحركة المتتالية (Dynamic Island Lifecycle)
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
    setDismissDirection(direction);
    setIsVisible(false);
    setAnimPhase('dismissed');
    playDismissSound();

    setTimeout(() => {
      hideSmartToast();
      setDismissDirection(null);
      setIsExpanded(false);
      setShockwaveKey(null);
    }, 280);
  }, []);

  // انكماش الإشعار وصعوده لتبتلعه الجزيرة تلقائياً عند انتهاء المؤقت
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
      setDismissDirection(null);
      setIsExpanded(false);
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

  // توسيع / طي التفاصيل عند النقر
  const toggleDetails = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsExpanded((prev) => {
      const next = !prev;
      if (next) {
        if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
        playExpandSound();
      } else {
        resetAutoDismiss(resolvedDuration);
      }
      return next;
    });
  }, [resetAutoDismiss, resolvedDuration]);

  // دورة حياة الإشعار عند وصول رسالة جديدة
  useEffect(() => {
    if (!toast) {
      setAnimPhase('dismissed');
      setIsVisible(false);
      return;
    }

    const duration = toast.duration || getDefaultToastDuration();
    setResolvedDuration(duration);
    setIsVisible(true);
    setIsExpanded(false);
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

  // محرك السحب اللمسي وبالفأرة (Touch & Pointer Gestures Engine)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;

    isDraggingRef.current = true;
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
    const distance = Math.hypot(deltaX, deltaY);
    const velocityX = deltaX / elapsedTime;
    const velocityY = deltaY / elapsedTime;

    pointerStartRef.current = null;

    // 1. نقرة سريعة (Tap)؟
    if (distance < 8 && elapsedTime < 280) {
      setDragState(null);
      toggleDetails();
      return;
    }

    // 2. سحب للأعلى (Swipe Up Dismiss)
    if (deltaY < -35 || velocityY < -0.35) {
      dismissNotification('up');
      return;
    }

    // 3. سحب لليمين (Swipe Right Dismiss)
    if (deltaX > 35 || velocityX > 0.28) {
      dismissNotification('right');
      return;
    }

    // 4. سحب لليسار (Swipe Left Dismiss)
    if (deltaX < -35 || velocityX < -0.28) {
      dismissNotification('left');
      return;
    }

    // ارتداد ناعم للمنتصف (Spring Back)
    setDragState(null);
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    pointerStartRef.current = null;
    setDragState(null);
  };

  if (!toast) return null;

  const colors = {
    success: {
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/30',
      text: 'text-emerald-500 dark:text-emerald-400',
      dot: 'bg-emerald-500',
      bar: 'bg-emerald-500',
      shockColor: '#10b981',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white',
      icon: 'M5 13l4 4L19 7',
      animate: '',
    },
    warning: {
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/30',
      text: 'text-amber-500 dark:text-amber-400',
      dot: 'bg-amber-500',
      bar: 'bg-amber-500',
      shockColor: '#f59e0b',
      btnBg: 'bg-amber-600 hover:bg-amber-500 text-white',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      animate: '',
    },
    error: {
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/30',
      text: 'text-rose-500 dark:text-rose-400',
      dot: 'bg-rose-500',
      bar: 'bg-rose-500',
      shockColor: '#f43f5e',
      btnBg: 'bg-rose-600 hover:bg-rose-500 text-white',
      icon: 'M6 18L18 6M6 6l12 12',
      animate: '',
    },
    info: {
      bg: 'bg-primary/15',
      border: 'border-primary/30',
      text: 'text-primary',
      dot: 'bg-primary',
      bar: 'bg-primary',
      shockColor: 'hsl(var(--primary))',
      btnBg: 'bg-primary hover:bg-primary/90 text-primary-foreground',
      icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      animate: '',
    },
    purple: {
      bg: 'bg-purple-500/15',
      border: 'border-purple-500/30',
      text: 'text-purple-500 dark:text-purple-400',
      dot: 'bg-purple-500',
      bar: 'bg-purple-500',
      shockColor: '#a855f7',
      btnBg: 'bg-purple-600 hover:bg-purple-500 text-white',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      animate: '',
    },
  };

  const config = colors[toast.type] || colors.info;

  const isError = toast.type === 'error' || (toast.type as string) === 'destructive';
  const isSuccessSubtitle = toast.subtitle?.includes('تمت معالجة هذا الإجراء وتسجيله بنجاح') ||
                            toast.subtitle?.includes('تم بنجاح') ||
                            toast.subtitle?.includes('بنجاح');
  const safeSubtitle = (isError && isSuccessSubtitle) ? null : toast.subtitle;

  // =========================================================================
  // حساب المظهر والتحول الفيزيائي حسب المرحلة (Transform & Physics Layout)
  // =========================================================================
  let transform = 'translate(0px, 0px) rotate(0deg) scale(1)';
  let opacity = 1;
  let cardClass = 'w-full max-w-[394px] rounded-[26px]';
  let contentOpacity = 1;

  if (animPhase === 'dropping') {
    transform = 'translate(0px, -6px) scale(0.65, 1.35)';
    cardClass = 'w-11 h-11 rounded-full';
    contentOpacity = 0;
  } else if (animPhase === 'bursting') {
    transform = 'translate(0px, 0px) scale(1)';
    cardClass = 'w-full max-w-[394px] rounded-[26px]';
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
              boxShadow: `0 0 28px ${config.shockColor}` 
            }}
          />
          <div 
            key={`sw2-${shockwaveKey}`} 
            className="shockwave-ring w-12 h-12"
            style={{ 
              borderColor: '#ffffff', 
              boxShadow: `0 0 20px ${config.shockColor}`,
              animationDelay: '0.05s',
              animationDuration: '0.52s' 
            }}
          />
          {/* ومضات الأطراف الجانبية للشاشة */}
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

      {/* بطاقة الإشعار الذكية المنبثقة من الجزيرة */}
      <div
        className={cn(
          "smart-toast-card bg-white/95 dark:bg-zinc-900/95 text-slate-900 dark:text-white border border-slate-200/90 dark:border-white/15 backdrop-blur-2xl pointer-events-auto cursor-grab active:cursor-grabbing overflow-hidden transform-gpu select-none touch-none",
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* مقبض السحب المرئي العلوي (Visual Pill Handle) */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-8 h-1 rounded-full bg-slate-300 dark:bg-white/20"></div>
        </div>

        {/* محتوى الإشعار القابل للتلاشي أثناء الانكماش والظهور */}
        <div 
          className="transition-opacity duration-200 ease-out"
          style={{ opacity: contentOpacity }}
        >
          {/* السطر الأساسي للإشعار */}
          <div 
            className="px-3.5 pb-3 pt-0.5 flex items-center justify-between gap-3 cursor-pointer"
            onClick={() => toggleDetails()}
          >
            {/* أيقونة الحالة مع نبض لوني فاخر */}
            <div className={cn("w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 relative", config.bg, config.border, config.text)}>
              <svg className={cn("w-5 h-5", config.animate)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={config.icon} />
              </svg>
              <span className={cn("absolute top-1 right-1 w-2 h-2 rounded-full pulse-dot", config.dot)} />
            </div>

            {/* النصوص والبيانات الرئيسية للإشعار */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="smart-toast-title text-xs font-bold text-slate-900 dark:text-white truncate leading-snug">
                  {toast.title}
                </h4>
                <span className="smart-toast-time text-[10px] text-slate-500 dark:text-zinc-400 font-mono shrink-0">
                  {toast.time || 'الآن'}
                </span>
              </div>
              {safeSubtitle && (
                <p className="smart-toast-subtitle text-[11px] text-slate-600 dark:text-zinc-300 font-medium truncate mt-0.5">
                  {safeSubtitle}
                </p>
              )}
            </div>

            {/* أزرار الإجراء السريع */}
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* زر فتح/إغلاق التفاصيل */}
              <button
                type="button"
                onClick={(e) => toggleDetails(e)}
                className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-zinc-300 flex items-center justify-center transition active:scale-95"
                title="عرض التفاصيل"
              >
                <svg className={cn("w-3.5 h-3.5 transition-transform duration-300", isExpanded && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* زر إغلاق صريح */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNotification('up');
                }}
                className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 dark:bg-white/5 dark:hover:bg-rose-500/20 dark:text-zinc-400 dark:hover:text-rose-400 flex items-center justify-center transition active:scale-95"
                title="إغلاق"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* قسم التفاصيل الموسع (يظهر بنعومة عند النقر على الإشعار) */}
          {/* ========================================================= */}
          <div 
            className={cn(
              "overflow-hidden transition-all duration-300 ease-out border-t bg-slate-50/80 dark:bg-black/30",
              isExpanded ? "max-h-[320px] border-slate-200/80 dark:border-white/10" : "max-h-0 border-transparent"
            )}
          >
            <div className="p-3.5 space-y-3 text-xs">
              {toast.details ? (
                <div className="space-y-2 text-slate-800 dark:text-zinc-200">
                  {toast.details}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-zinc-300 space-y-1 shadow-sm">
                  <div className="font-semibold text-slate-900 dark:text-white">{toast.title}</div>
                  {safeSubtitle ? (
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                      {safeSubtitle}
                    </div>
                  ) : !isError ? (
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                      تمت معالجة هذا الإجراء وتسجيله بنجاح.
                    </div>
                  ) : null}
                </div>
              )}

              {/* أزرار الإجراءات */}
              <div className="flex items-center gap-2 pt-1">
                {toast.primaryAction ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.primaryAction?.onClick();
                      dismissNotification('up');
                    }}
                    className={cn(
                      "smart-toast-btn-primary flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md",
                      config.btnBg
                    )}
                  >
                    <span>{toast.primaryAction.label}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => dismissNotification('up')}
                    className={cn(
                      "smart-toast-btn-primary flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md",
                      config.btnBg
                    )}
                  >
                    <span>{isError ? 'إغلاق' : 'حسناً'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => dismissNotification('up')}
                  className="smart-toast-btn-secondary py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/10 dark:hover:bg-white/15 dark:text-zinc-200 font-semibold text-xs transition active:scale-95 border border-slate-200/60 dark:border-white/10"
                >
                  {isError ? 'إغلاق' : 'تم، إغلاق'}
                </button>
              </div>
            </div>
          </div>

          {/* شريط المؤقت الزمني للإغلاق التلقائي (Linear Progress Timer) */}
          <div className="h-1 bg-slate-200/80 dark:bg-white/10 w-full overflow-hidden">
            <div
              className={cn(
                "h-full",
                config.bar,
                animPhase === 'expanded' && isVisible && "timer-active",
                (isExpanded || animPhase !== 'expanded' || !isVisible) && "timer-paused"
              )}
              style={{ '--duration': `${resolvedDuration}ms` } as React.CSSProperties}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
