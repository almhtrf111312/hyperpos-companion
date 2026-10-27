import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageActivity } from '@/contexts/PageActivityContext';

/**
 * يُرجع true عند التمرير للأعلى أو قرب أعلى الصفحة، وfalse عند التمرير للأسفل (أسلوب Google).
 * يستمع لتمرير window ولأي حاوية داخلية (capture).
 */
export function useScrollDirectionVisibility(threshold = 12) {
  const [visible, setVisible] = useState(true);
  const lastRef = useRef(new WeakMap<object, number>());
  const { pathname } = useLocation();
  const { isActive } = usePageActivity();

  useEffect(() => {
    // العودة لتبويب محفوظ تبدأ بزر ظاهر، ولا ترث تمرير الصفحات الأخرى.
    setVisible(true);
    lastRef.current = new WeakMap<object, number>();
    lastRef.current.set(document.documentElement, window.scrollY || document.documentElement.scrollTop);
    if (!isActive) return;

    let lastInteraction = -Infinity;
    const onInteraction = () => { lastInteraction = performance.now(); };
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) onInteraction();
    };
    const onScroll = (e: Event) => {
      const t = e.target;
      const el: Element | null = t === document || t === window ? document.documentElement : (t as Element);
      if (!el || !(el instanceof Element)) return;
      // تجاهل حاويات أفقية أو صغيرة (قوائم منسدلة، شرائط تبويب)
      if (el !== document.documentElement && el.clientHeight < window.innerHeight * 0.5) return;
      const top = el === document.documentElement ? (window.scrollY || el.scrollTop) : el.scrollTop;
      const last = lastRef.current.get(el) ?? top;
      // تحميل البيانات واستعادة موضع الصفحة ليسا تمريراً قام به المستخدم.
      if (performance.now() - lastInteraction > 1000) {
        lastRef.current.set(el, top);
        return;
      }
      if (top < 40) setVisible(true);
      else if (top > last + threshold) setVisible(false);
      else if (top < last - threshold) setVisible(true);
      lastRef.current.set(el, top);
    };
    window.addEventListener('wheel', onInteraction, { passive: true, capture: true });
    window.addEventListener('touchmove', onInteraction, { passive: true, capture: true });
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('wheel', onInteraction, true);
      window.removeEventListener('touchmove', onInteraction, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [threshold, pathname, isActive]);

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
