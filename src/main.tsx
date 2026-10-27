import { createRoot } from "react-dom/client";
import { Component, ReactNode, ErrorInfo } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';
import { restoreLastRouteIfNeeded } from "./lib/last-route";
import { initializeLanguage } from "./lib/i18n";
import { applyAppFontToDOM, getStoredAppFont } from "./lib/app-font-config";
import { applyUIScaleToDOM, getStoredUIScale } from "./lib/ui-scale-config";
import { initPerformanceMode } from "./lib/performance-mode";
import App from "./App.tsx";
import "./index.css";
import { initErrorRadar, captureError } from "./lib/error-radar";

// Initialize Error Radar listeners as early as possible
initErrorRadar();

// Initialize font, scale, performance mode, and language layout immediately on startup
applyAppFontToDOM(getStoredAppFont());
applyUIScaleToDOM(getStoredUIScale());
initPerformanceMode();
initializeLanguage();

// Cold-start only: if the WebView opened at "/", put the user back on the last screen.
restoreLastRouteIfNeeded();

// Unregister any lingering Service Worker if running inside native Android/Capacitor
// to prevent reload loops and cache conflicts with local APK assets.
if (Capacitor.isNativePlatform()) {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    }).catch(() => {});
  }
}

// Register Service Worker for offline support — strictly for browser-based Web PWA
const updateSW = Capacitor.isNativePlatform() ? null : registerSW({
  immediate: true,
  onNeedRefresh() {
    // Auto-update when new version available
    updateSW?.(true);
  },
  onOfflineReady() {
    console.log('[SW] App ready for offline use');
  },
  onRegistered(registration) {
    console.log('[SW] Registered:', registration?.scope);
    // Periodic check for updates (every 60 min)
    if (registration) {
      // Check for a newer published version often, and whenever the tab regains focus,
      // so the laptop never stays on an old build.
      const check = () => { registration.update().catch(() => {}); };
      setInterval(check, 5 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    }
  },
  onRegisterError(error) {
    console.error('[SW] Registration error:', error);
  },
});

// ─── Global Error Boundary ────────────────────────────────────────────
// Catches any uncaught error in the entire React tree and shows a
// user-friendly retry screen instead of a silent black page.
interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalCrash] Uncaught root error:', error, errorInfo);
    try {
      captureError(error, {
        source: 'react_boundary',
        severity: 'critical',
        componentStack: errorInfo?.componentStack || undefined,
      });
    } catch {
      // Non-blocking
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.hash = '#/';
      }
    } catch { /* ignore */ }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center dir-rtl font-sans">
          <h2 className="text-xl font-bold mb-2 text-destructive">
            حدث خطأ أثناء تحميل واجهة التطبيق
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
            تم رصد المشكلة وجاري توثيقها في رادار الأخطاء للتشخيص والمراجعة. يمكنك العودة للشاشة الرئيسية أو إعادة المحاولة بأمان.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={this.handleGoHome}
              className="bg-primary text-primary-foreground border-none px-4 py-2.5 rounded-lg text-sm cursor-pointer font-semibold shadow-xs hover:opacity-90 transition-opacity"
            >
              العودة للرئيسية (نقطة البيع)
            </button>
            <button
              onClick={this.handleRetry}
              className="bg-secondary text-secondary-foreground border border-border px-4 py-2.5 rounded-lg text-sm cursor-pointer font-medium hover:bg-secondary/80 transition-colors"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Remove offline fallback overlay if React mounts successfully
try {
  document.getElementById('offline-fallback-screen')?.remove();
} catch {}

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);
