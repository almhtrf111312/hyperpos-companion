import { useEffect, useRef, useState } from 'react';

/**
 * يُرجع true عند التمرير للأعلى أو قرب أعلى الصفحة، وfalse عند التمرير للأسفل (أسلوب Google).
 * يستمع لتمرير window ولأي حاوية داخلية (capture).
 */
export function useScrollDirectionVisibility(threshold = 12) {
  const [visible, setVisible] = useState(true);
  const lastRef = useRef(new WeakMap<object, number>());

  useEffect(() => {
    const onScroll = (e: Event) => {
      const t = e.target;
      const el: Element | null = t === document || t === window ? document.documentElement : (t as Element);
      if (!el || !(el instanceof Element)) return;
      // تجاهل حاويات أفقية أو صغيرة (قوائم منسدلة، شرائط تبويب)
      if (el !== document.documentElement && el.clientHeight < window.innerHeight * 0.5) return;
      const top = el === document.documentElement ? (window.scrollY || el.scrollTop) : el.scrollTop;
      const last = lastRef.current.get(el) ?? 0;
      if (top < 40) setVisible(true);
      else if (top > last + threshold) setVisible(false);
      else if (top < last - threshold) setVisible(true);
      lastRef.current.set(el, top);
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
  }, [threshold]);

  return visible;
}

/** يتتبع حالة فتح القائمة الجانبية (حدث sidebar-state من MainLayout). */
export function useSidebarOpenState() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = (e: Event) => setOpen(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener('sidebar-state', h);
    return () => window.removeEventListener('sidebar-state', h);
  }, []);
  return open;
}
