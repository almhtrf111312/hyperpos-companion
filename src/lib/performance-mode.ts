import { useState, useEffect } from 'react';

export type PerformanceModePref = 'auto' | 'full' | 'lite';
export type EffectivePerformanceMode = 'full' | 'lite';

const PERF_MODE_STORAGE_KEY = 'hyperpos_perf_mode_v1';

export function detectLowEndDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) {
      return true;
    }
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) {
      return true;
    }
  } catch {
    // تجاهل أي قيود متصفح
  }
  return false;
}

export function getPerformanceModePref(): PerformanceModePref {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = window.localStorage.getItem(PERF_MODE_STORAGE_KEY);
    if (saved === 'full' || saved === 'lite' || saved === 'auto') {
      return saved;
    }
  } catch {
    // تجاهل
  }
  return 'auto';
}

export function resolveEffectivePerformanceMode(pref?: PerformanceModePref): EffectivePerformanceMode {
  const mode = pref ?? getPerformanceModePref();
  if (mode === 'lite') return 'lite';
  if (mode === 'full') return 'full';
  return detectLowEndDevice() ? 'lite' : 'full';
}

export function applyPerformanceModeToDOM(pref?: PerformanceModePref): EffectivePerformanceMode {
  const effective = resolveEffectivePerformanceMode(pref);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-perf', effective);
  }
  return effective;
}

export function setPerformanceModePref(pref: PerformanceModePref): EffectivePerformanceMode {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PERF_MODE_STORAGE_KEY, pref);
    } catch {
      // تجاهل
    }
  }
  const effective = applyPerformanceModeToDOM(pref);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hyperpos:perf-mode-changed', { detail: { pref, effective } }));
  }
  return effective;
}

export function initPerformanceMode(): EffectivePerformanceMode {
  return applyPerformanceModeToDOM();
}

export function usePerformanceMode() {
  const [pref, setPrefState] = useState<PerformanceModePref>(getPerformanceModePref);
  const [effective, setEffective] = useState<EffectivePerformanceMode>(() => resolveEffectivePerformanceMode(pref));

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setPrefState(e.detail.pref);
        setEffective(e.detail.effective);
      } else {
        const p = getPerformanceModePref();
        setPrefState(p);
        setEffective(resolveEffectivePerformanceMode(p));
      }
    };
    window.addEventListener('hyperpos:perf-mode-changed', handler as EventListener);
    return () => window.removeEventListener('hyperpos:perf-mode-changed', handler as EventListener);
  }, []);

  return {
    pref,
    effective,
    setPref: setPerformanceModePref,
  };
}
