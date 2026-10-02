import { createRoot } from "react-dom/client";
import { Component, ReactNode, ErrorInfo } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';
import { restoreLastRouteIfNeeded } from "./lib/last-route";
import { initializeLanguage } from "./lib/i18n";
import App from "./App.tsx";
import "./index.css";

// Initialize language and RTL layout immediately on startup
initializeLanguage();

// Cold-start only: if the WebView opened at "/", put the user back on the last screen.
restoreLastRouteIfNeeded();

// Register Service Worker for offline support — as early as possible
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
  }

  handleReload = () => {
    try {
      localStorage.removeItem('device_binding_cache');
      sessionStorage.removeItem('hyperpos_auto_login_attempted');
    } catch { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#0a0a0a', color: '#fff',
          padding: '24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif',
        }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: '#ef4444' }}>
            حدث خطأ أثناء تحميل التطبيق
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#a1a1aa', maxWidth: '360px', marginBottom: '20px' }}>
            {this.state.error?.message || 'تعذر تشغيل واجهة النظام'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              backgroundColor: '#2563eb', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: '8px',
              fontSize: '0.875rem', cursor: 'pointer',
            }}
          >
            إعادة المحاولة ومسح الكاش المؤقت
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);
