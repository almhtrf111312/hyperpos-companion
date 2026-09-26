// App lifecycle: persist the current route on background. Never redirect on resume.
import { useEffect, useCallback } from 'react';
import { saveLastRoute } from '@/lib/last-route';

interface AppStateChangeEvent {
  isActive: boolean;
}

interface CapacitorAppPlugin {
  addListener: (
    eventName: 'appStateChange' | 'pause' | 'resume',
    callback: (state: AppStateChangeEvent) => void
  ) => Promise<{ remove: () => void }>;
}

interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: {
      App?: CapacitorAppPlugin;
    };
  };
}

type LifecycleCallback = () => void;

interface UseAppLifecycleOptions {
  onPause?: LifecycleCallback;
  onResume?: LifecycleCallback;
  onStateChange?: (isActive: boolean) => void;
  clearSensitiveData?: boolean;
}

const SENSITIVE_SESSION_KEYS = [
  '_hpdk',
];

export function useAppLifecycle(options: UseAppLifecycleOptions = {}) {
  const { onPause, onResume, onStateChange, clearSensitiveData = false } = options;

  const handlePause = useCallback(() => {
    saveLastRoute();

    if (clearSensitiveData) {
      SENSITIVE_SESSION_KEYS.forEach(key => {
        try {
          sessionStorage.removeItem(key);
        } catch {
          // ignore
        }
      });
    }

    onPause?.();
  }, [onPause, clearSensitiveData]);

  const handleResume = useCallback(() => {
    // Keep the in-memory React tree as-is. No navigation reset on resume.
    onResume?.();
  }, [onResume]);

  const handleStateChange = useCallback((isActive: boolean) => {
    if (isActive) {
      handleResume();
    } else {
      handlePause();
    }
    onStateChange?.(isActive);
  }, [handlePause, handleResume, onStateChange]);

  useEffect(() => {
    const windowWithCapacitor = window as unknown as CapacitorWindow;
    const isNative = windowWithCapacitor.Capacitor?.isNativePlatform?.();

    let cleanup: (() => void) | null = null;

    const setupListeners = async () => {
      if (isNative && windowWithCapacitor.Capacitor?.Plugins?.App) {
        const App = windowWithCapacitor.Capacitor.Plugins.App;

        try {
          const stateListener = await App.addListener('appStateChange', (state) => {
            handleStateChange(state.isActive);
          });

          cleanup = () => {
            stateListener.remove();
          };
        } catch (error) {
          console.warn('[AppLifecycle] Failed to setup Capacitor listeners:', error);
        }
      } else {
        const handleVisibilityChange = () => {
          handleStateChange(document.visibilityState === 'visible');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        cleanup = () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
      }
    };

    setupListeners();

    return () => {
      cleanup?.();
    };
  }, [handleStateChange]);
}

export function useAuthLifecycle(refreshSession: () => Promise<void>) {
  useAppLifecycle({
    onResume: () => {
      refreshSession().catch(err => {
        console.error('[AuthLifecycle] Failed to refresh session:', err);
      });
    },
    clearSensitiveData: false,
  });
}

export function useOrientationChange(callback: (isPortrait: boolean) => void) {
  useEffect(() => {
    let lastOrientation = window.innerHeight > window.innerWidth;

    const handleOrientationChange = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      if (isPortrait !== lastOrientation) {
        lastOrientation = isPortrait;
        callback(isPortrait);
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [callback]);
}
