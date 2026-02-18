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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/~oauth/],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
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
  build: {
    rollupOptions: {
      external: ['@zxing/library'],
    },
  },
}));
