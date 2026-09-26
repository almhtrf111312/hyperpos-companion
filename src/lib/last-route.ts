export const LAST_ROUTE_KEY = 'hyperpos_last_route';

const SKIP_PATHS = new Set(['/', '/login', '/signup', '/reset-password']);

function hashToRoute(): string {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('/')) return hash;
  return window.location.pathname + window.location.search + window.location.hash;
}

export function getCurrentAppRoute(): string {
  return hashToRoute();
}

export function saveLastRoute(route?: string): void {
  const path = route ?? getCurrentAppRoute();
  const pathname = path.split('?')[0];
  if (!pathname || SKIP_PATHS.has(pathname)) return;
  try {
    localStorage.setItem(LAST_ROUTE_KEY, path);
  } catch {
    // ignore quota / private-mode errors
  }
}

/**
 * Restore the last screen only on a real document load (WebView start URL).
 * Does nothing if the hash already points at a real page — no resume redirect.
 */
export function restoreLastRouteIfNeeded(): void {
  try {
    const saved = localStorage.getItem(LAST_ROUTE_KEY);
    if (!saved || SKIP_PATHS.has(saved.split('?')[0])) return;

    const hash = window.location.hash.replace(/^#/, '');
    const currentPath = (hash.startsWith('/') ? hash : '/').split('?')[0];
    if (currentPath !== '/') return;

    const next = saved.startsWith('/') ? saved : `/${saved}`;
    window.location.hash = next;
  } catch {
    // ignore restore errors
  }
}
