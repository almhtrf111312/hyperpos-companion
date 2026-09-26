export const LAST_ROUTE_KEY = 'hyperpos_last_route';

export function getCurrentAppRoute(): string {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('/')) return hash;
  return window.location.pathname;
}

export function saveLastRoute(route?: string): void {
  // لا نحفظ المسار إذا كان الهدف دائماً فتح نقطة البيع عند التشغيل الجديد
}

/**
 * عند التشغيل النظيف للتطبيق، التوجيه الافتراضي يكون دائماً إلى نقطة البيع /pos
 */
export function restoreLastRouteIfNeeded(): void {
  try {
    localStorage.removeItem(LAST_ROUTE_KEY);
    const hash = window.location.hash.replace(/^#/, '');
    const currentPath = (hash.startsWith('/') ? hash : '/').split('?')[0];

    // إذا فتح التطبيق على الجذر أو لم يكن هناك مسار محدد، وجّهه إلى نقطة البيع مباشرة
    if (currentPath === '/' || !currentPath) {
      window.location.hash = '/pos';
    }
  } catch {
    // Ignore errors
  }
}
