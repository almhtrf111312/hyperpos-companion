import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";

// Load version info from version.json
let appVersion = { versionName: '1.0.0', versionCode: 221, lastUpdated: new Date().toISOString() };
try {
  const versionFile = fs.readFileSync(path.resolve(__dirname, 'version.json'), 'utf-8');
  appVersion = JSON.parse(versionFile);
} catch { /* use defaults */ }

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Inject app version at build time
  define: {
    '__APP_VERSION__': JSON.stringify(appVersion),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/~oauth/],
        skipWaiting: true,
        clientsClaim: true,
        // ✅ Offline fallback page
        offlineGoogleAnalytics: false,
        runtimeCaching: [
          {
            // Cache the app shell (HTML pages) with NetworkFirst for fast offline
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Cache JS/CSS assets aggressively
            urlPattern: /\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Cache images
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'FlowPOS Pro',
        short_name: 'FlowPOS',
        description: 'نظام إدارة محاسبي متكامل',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        dir: 'rtl',
        lang: 'ar',
        icons: [
          { src: '/app-icon.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {},
}));
