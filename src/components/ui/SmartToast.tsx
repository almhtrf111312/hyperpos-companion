import React, { useEffect, useState } from 'react';
import { useSmartToastListener, hideSmartToast } from '@/hooks/use-smart-toast';

export function SmartToast() {
  const { toast } = useSmartToastListener();
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (toast) {
      setIsVisible(true);
      setIsExpanded(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(hideSmartToast, 400); // Wait for exit animation
      }, toast.duration || 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!toast) return null;

  const colors = {
    success: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-emerald-500/80', icon: 'M5 13l4 4L19 7' },
    warning: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', bar: 'bg-amber-500/80', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    error: { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-400', bar: 'bg-rose-500/80', icon: 'M6 18L18 6M6 6l12 12' },
    info: { bg: 'bg-sky-500/15', border: 'border-sky-500/30', text: 'text-sky-400', bar: 'bg-sky-500/80', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
  };

  const config = colors[toast.type] || colors.info;

  return (
    <div className="fixed top-8 inset-x-0 px-3 z-[100] flex justify-center pointer-events-none">
      <div 
        className={`notification-spring w-full max-w-[394px] bg-slate-900/95 dark:bg-zinc-900/95 text-white rounded-[26px] shadow-2xl border border-white/15 backdrop-blur-2xl pointer-events-auto overflow-hidden ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-[130px] opacity-0'}`}
      >
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-8 h-1 rounded-full bg-white/20"></div>
        </div>

        <div className="px-3.5 pb-3 pt-0.5 flex items-center justify-between gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 relative ${config.bg} ${config.border} ${config.text}`}>
            <svg className={`w-5 h-5 ${toast.type === 'info' ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={config.icon}/>
            </svg>
            <span className={`absolute top-1 right-1 w-2 h-2 rounded-full pulse-dot ${config.bar.split('/')[0]}`}></span>
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white truncate leading-snug">{toast.title}</h4>
            {toast.subtitle && <p className="text-[11px] text-zinc-300 font-medium truncate mt-0.5">{toast.subtitle}</p>}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {toast.details && (
              <button onClick={() => setIsExpanded(!isExpanded)} className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 flex items-center justify-center transition">
                <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"/></svg>
              </button>
            )}
            <button onClick={() => setIsVisible(false)} className="w-7 h-7 rounded-xl bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className={`overflow-hidden transition-all duration-400 ease-out border-t border-white/10 bg-black/30 ${isExpanded ? 'max-h-[300px]' : 'max-h-0 border-transparent'}`}>
          <div className="p-3.5 text-xs text-zinc-300">
            {toast.details}
          </div>
        </div>

        <div className="h-1 bg-white/10 w-full overflow-hidden">
          <div className={`h-full ${config.bar} ${isVisible && !isExpanded ? 'timer-active' : 'timer-paused'}`} style={{ '--duration': `${toast.duration || 4500}ms` } as React.CSSProperties}></div>
        </div>
      </div>
    </div>
  );
}
