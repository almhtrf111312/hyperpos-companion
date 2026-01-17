// Fix #20: App Lifecycle Management for Capacitor
import { useEffect, useCallback } from 'react';

// Types for Capacitor App plugin
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

// Callback types
type LifecycleCallback = () => void;

interface UseAppLifecycleOptions {
  onPause?: LifecycleCallback;
  onResume?: LifecycleCallback;
  onStateChange?: (isActive: boolean) => void;
  clearSensitiveData?: boolean;
}

// Sensitive data keys that should be cleared on pause
const SENSITIVE_SESSION_KEYS = [
  '_hpdk', // Device key from secure storage
];

/**
 * Hook to manage app lifecycle events for Capacitor apps
 * Handles pause/resume events and clears sensitive data when app goes to background
 */
export function useAppLifecycle(options: UseAppLifecycleOptions = {}) {
  const { onPause, onResume, onStateChange, clearSensitiveData = false } = options;

  const handlePause = useCallback(() => {
    console.log('[AppLifecycle] App paused');
    
    // Clear sensitive session data if requested
    if (clearSensitiveData) {
      SENSITIVE_SESSION_KEYS.forEach(key => {
        try {
          sessionStorage.removeItem(key);
        } catch (e) {
          console.warn('Failed to clear session key:', key);
        }
      });
    }
    
    onPause?.();
  }, [onPause, clearSensitiveData]);

  const handleResume = useCallback(() => {
    console.log('[AppLifecycle] App resumed');
    
    // Re-validate session when app resumes
    // This will trigger a re-check of auth state
    window.dispatchEvent(new Event('focus'));
    
    onResume?.();
  }, [onResume]);

  const handleStateChange = useCallback((isActive: boolean) => {
    console.log('[AppLifecycle] State changed:', isActive ? 'active' : 'inactive');
    
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
          // Listen for app state changes
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
        // Fallback for web: use visibility API
        const handleVisibilityChange = () => {
          const isActive = document.visibilityState === 'visible';
          handleStateChange(isActive);
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Also handle window blur/focus for tab switching
        const handleBlur = () => handlePause();
        const handleFocus = () => handleResume();
        
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        
        cleanup = () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('blur', handleBlur);
          window.removeEventListener('focus', handleFocus);
        };
      }
    };

    setupListeners();

    return () => {
      cleanup?.();
    };
  }, [handleStateChange, handlePause, handleResume]);
}

/**
 * Hook specifically for auth session management on app lifecycle
 */
export function useAuthLifecycle(refreshSession: () => Promise<void>) {
  useAppLifecycle({
    onResume: () => {
      // Refresh session when app resumes
      refreshSession().catch(err => {
        console.error('[AuthLifecycle] Failed to refresh session:', err);
      });
    },
    clearSensitiveData: false, // Don't clear auth data, just refresh
  });
}

/**
 * Hook to handle orientation changes
 * Useful for closing overlays and preventing UI blocking during rotation
 */
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

    // Listen to orientation change event
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Also listen to resize as fallback
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [callback]);
}
