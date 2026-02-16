import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Register Service Worker for offline support
const updateSW = registerSW({
  onNeedRefresh() {
    // Auto-update when new version available
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[SW] App ready for offline use');
  },
});

createRoot(document.getElementById("root")!).render(<App />);
