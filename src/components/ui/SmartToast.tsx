import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSmartToastListener, hideSmartToast } from '@/hooks/use-smart-toast';
import { cn } from '@/lib/utils';

// نظام المؤثرات الصوتية الخفيفة بواسطة Web Audio API (Native Feel)
function playHapticSound(type: 'pop' | 'expand' | 'dismiss' | 'success' = 'pop') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'pop') {
      // نغمة ناعمة تدل على ظهور الإشعار (Dual Tone Chime)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'expand') {
      // نقرة فتح خفيفة
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'dismiss') {
      // نغمة إغلاق خاطفة
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.09);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'success') {
      // نغمة نجاح
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // تجاهل في حال حظر المتصفح للصوت التلقائي
  }
}

export function SmartToast() {
  const { toast } = useSmartToastListener();
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissDirection, setDismissDirection] = useState<'up' | 'left' | 'right' | null>(null);
  const [dragState, setDragState] = useState<{ x: number; y: number; rotate: number; opacity: number } | null>(null);

  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number; pointerId: number } | null>(null);
  const isDraggingRef = useRef(false);

  // إغلاق الإشعار باتجاه معين
  const dismissNotification = useCallback((direction: 'up' | 'left' | 'right' = 'up') => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    setDragState(null);
    setDismissDirection(direction);
    setIsVisible(false);
    playHapticSound('dismiss');

    setTimeout(() => {
      hideSmartToast();
      setDismissDirection(null);
      setIsExpanded(false);
    }, 340);
  }, []);

  // إعادة ضبط مؤقت الإغلاق التلقائي
  const resetAutoDismiss = useCallback((duration: number = 4500) => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    autoDismissTimerRef.current = setTimeout(() => {
      dismissNotification('up');
    }, duration);
  }, [dismissNotification]);

  // توسيع / طي التفاصيل عند النقر
  const toggleDetails = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsExpanded((prev) => {
      const next = !prev;
      if (next) {
        // إيقاف مؤقت الإغلاق أثناء قراءة التفاصيل
        if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
        playHapticSound('expand');
      } else {
        resetAutoDismiss(toast?.duration || 4500);
      }
      return next;
    });
  }, [resetAutoDismiss, toast?.duration]);

  // عند استقبال إشعار جديد
  useEffect(() => {
    if (toast) {
      setIsVisible(true);
      setIsExpanded(false);
      setDismissDirection(null);
      setDragState(null);
      playHapticSound(toast.type === 'success' ? 'success' : 'pop');
      resetAutoDismiss(toast.duration || 4500);

      return () => {
        if (autoDismissTimerRef.current) {
          clearTimeout(autoDismissTimerRef.current);
        }
      };
    }
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
    const rotation = deltaX * 0.05;
    const distance = Math.hypot(deltaX, clampedDeltaY);
    const opacity = Math.max(0.2, 1 - distance / 260);

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
      bg: 'bg-primary/15',
      border: 'border-primary/30',
      text: 'text-primary',
      dot: 'bg-primary',
      bar: 'bg-primary',
      btnBg: 'smart-toast-btn-primary',
      icon: 'M5 13l4 4L19 7',
      animate: '',
    },
    warning: {
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/30',
      text: 'text-amber-500 dark:text-amber-400',
      dot: 'bg-amber-500',
      bar: 'bg-amber-500',
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
      btnBg: 'smart-toast-btn-primary',
      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
      animate: 'animate-spin',
    },
    purple: {
      bg: 'bg-primary/15',
      border: 'border-primary/30',
      text: 'text-primary',
      dot: 'bg-primary',
      bar: 'bg-primary',
      btnBg: 'smart-toast-btn-primary',
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

  // حساب التحول (Transform & Opacity)
  let transform = 'translate(0px, 0px) rotate(0deg)';
  let opacity = 1;

  if (!isVisible) {
    if (dismissDirection === 'right') {
      transform = 'translateX(115vw) rotate(12deg)';
    } else if (dismissDirection === 'left') {
      transform = 'translateX(-115vw) rotate(-12deg)';
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
    <div className="fixed top-6 inset-x-0 px-3 z-[100] flex justify-center pointer-events-none">
      {/* بطاقة الإشعار القابلة للتفاعل والسحب */}
      <div
        className={cn(
          "smart-toast-card w-full max-w-[394px] bg-white/95 dark:bg-zinc-900/95 text-slate-900 dark:text-white rounded-[26px] border border-slate-200/90 dark:border-white/15 backdrop-blur-2xl pointer-events-auto cursor-grab active:cursor-grabbing overflow-hidden transform-gpu select-none touch-none",
          isDismissing ? "notification-dismissing" : "notification-spring",
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

        {/* السطر الأساسي للإشعار */}
        <div 
          className="px-3.5 pb-3 pt-0.5 flex items-center justify-between gap-3 cursor-pointer"
          onClick={() => toggleDetails()}
        >
          {/* أيقونة الحالة مع نبض لوني */}
          <div className={cn("w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 relative", config.bg, config.border, config.text)}>
            <svg className={cn("w-5 h-5", config.animate)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={config.icon} />
            </svg>
            <span className={cn("absolute top-1 right-1 w-2 h-2 rounded-full pulse-dot", config.dot)} />
          </div>

          {/* النصوص الرئيسية للإشعار */}
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

          {/* أزرار الإجراء السريع يميناً ويساراً (داخل الإشعار) */}
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

            {/* زر إغلاق صريح إضافي (داخل الإشعار) */}
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
            {/* محتوى التفاصيل */}
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

            {/* أزرار الإجراءات التفاعلية داخل التفاصيل */}
            <div className="flex items-center gap-2 pt-1">
              {toast.primaryAction ? (
                <button
                  type="button"
                  onClick={() => {
                    playHapticSound('success');
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
              isVisible && "timer-active",
              (isExpanded || !isVisible) && "timer-paused"
            )}
            style={{ '--duration': `${toast.duration || 4500}ms` } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}
