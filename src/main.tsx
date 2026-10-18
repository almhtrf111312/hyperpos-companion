import { createRoot } from "react-dom/client";
import { Component, ReactNode, ErrorInfo } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';
import { restoreLastRouteIfNeeded } from "./lib/last-route";
import { initializeLanguage } from "./lib/i18n";
import { applyAppFontToDOM, getStoredAppFont } from "./lib/app-font-config";
import { applyUIScaleToDOM, getStoredUIScale } from "./lib/ui-scale-config";
import App from "./App.tsx";
import "./index.css";
import { initErrorRadar, captureError } from "./lib/error-radar";

// Initialize Error Radar listeners as early as possible
initErrorRadar();

// Initialize font, scale, and language layout immediately on startup
applyAppFontToDOM(getStoredAppFont());
applyUIScaleToDOM(getStoredUIScale());
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
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
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
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#0a0a0a', color: '#fff',
          padding: '24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif',
          direction: 'rtl',
        }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: '#ef4444' }}>
            حدث خطأ أثناء تحميل واجهة التطبيق
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#a1a1aa', maxWidth: '380px', marginBottom: '24px', lineHeight: '1.5' }}>
            تم رصد المشكلة وجاري توثيقها في رادار الأخطاء للتشخيص والمراجعة. يمكنك العودة للشاشة الرئيسية أو إعادة المحاولة بأمان.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleGoHome}
              style={{
                backgroundColor: '#2563eb', color: '#fff', border: 'none',
                padding: '10px 18px', borderRadius: '8px',
                fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600,
              }}
            >
              العودة للرئيسية (نقطة البيع)
            </button>
            <button
              onClick={this.handleRetry}
              style={{
                backgroundColor: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46',
                padding: '10px 18px', borderRadius: '8px',
                fontSize: '0.875rem', cursor: 'pointer', fontWeight: 500,
              }}
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
