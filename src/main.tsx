import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Register Service Worker for offline support — as early as possible
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Auto-update when new version available
    updateSW(true);
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

createRoot(document.getElementById("root")!).render(<App />);
