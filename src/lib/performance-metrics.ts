/**
 * Performance Instrumentation for Route Navigation and SWR Data Lifecycle.
 *
 * Privacy Invariant:
 * Strictly records timing marks and counts. NEVER records customer names,
 * phone numbers, invoice amounts, passwords, or PII.
 */

export interface RouteTimingMetrics {
  route: string;
  intentTimestamp: number;
  chunkReadyTimestamp?: number;
  cacheReadyTimestamp?: number;
  usefulRenderTimestamp?: number;
  freshDataTimestamp?: number;
  durations: {
    intentToChunkMs?: number;
    intentToCacheMs?: number;
    intentToRenderMs?: number;
    intentToFreshDataMs?: number;
    cacheToFreshDataMs?: number;
  };
}

const metricsStore = new Map<string, RouteTimingMetrics>();
const MAX_STORE_ENTRIES = 20;

export const performanceMetrics = {
  /**
   * Called when a navigation intent begins (e.g. tab click / route change)
   */
  markRouteIntent(route: string): void {
    const now = performance.now();
    metricsStore.set(route, {
      route,
      intentTimestamp: now,
      durations: {},
    });

    if (metricsStore.size > MAX_STORE_ENTRIES) {
      const oldestKey = metricsStore.keys().next().value;
      if (oldestKey) metricsStore.delete(oldestKey);
    }
  },

  /**
   * Called when lazy route chunk has downloaded / mounted
   */
  markChunkReady(route: string): void {
    const entry = metricsStore.get(route);
    if (!entry) return;
    const now = performance.now();
    entry.chunkReadyTimestamp = now;
    entry.durations.intentToChunkMs = Math.round(now - entry.intentTimestamp);
  },

  /**
   * Called when local SWR cache (0ms or IDB fallback) is retrieved
   */
  markCacheReady(route: string): void {
    const entry = metricsStore.get(route);
    if (!entry) return;
    const now = performance.now();
    entry.cacheReadyTimestamp = now;
    entry.durations.intentToCacheMs = Math.round(now - entry.intentTimestamp);
  },

  /**
   * Called when the first useful list or dashboard render finishes
   */
  markUsefulRender(route: string): void {
    const entry = metricsStore.get(route);
    if (!entry) return;
    const now = performance.now();
    entry.usefulRenderTimestamp = now;
    entry.durations.intentToRenderMs = Math.round(now - entry.intentTimestamp);

    if (import.meta.env.DEV) {
      console.debug(
        `[PerfMetrics] Route ${route} useful render: ${entry.durations.intentToRenderMs}ms (chunk: ${entry.durations.intentToChunkMs ?? 0}ms, cache: ${entry.durations.intentToCacheMs ?? 0}ms)`
      );
    }
  },

  /**
   * Called when background cloud re-validation completes
   */
  markFreshData(route: string): void {
    const entry = metricsStore.get(route);
    if (!entry) return;
    const now = performance.now();
    entry.freshDataTimestamp = now;
    entry.durations.intentToFreshDataMs = Math.round(now - entry.intentTimestamp);
    if (entry.cacheReadyTimestamp) {
      entry.durations.cacheToFreshDataMs = Math.round(now - entry.cacheReadyTimestamp);
    }

    if (import.meta.env.DEV) {
      console.debug(
        `[PerfMetrics] Route ${route} fresh cloud sync: ${entry.durations.intentToFreshDataMs}ms (background revalidation: ${entry.durations.cacheToFreshDataMs ?? 0}ms)`
      );
    }
  },

  /**
   * Get metrics for a route
   */
  getMetrics(route: string): RouteTimingMetrics | undefined {
    return metricsStore.get(route);
  },

  /**
   * Clear all recorded metrics
   */
  clear(): void {
    metricsStore.clear();
  },
};
