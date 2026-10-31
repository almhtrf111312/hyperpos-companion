import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";

// Load version info strictly from version.json
const versionFilePath = path.resolve(__dirname, 'version.json');
if (!fs.existsSync(versionFilePath)) {
  throw new Error(`[Vite Build Error] version.json missing at ${versionFilePath}`);
}
const versionRaw = fs.readFileSync(versionFilePath, 'utf-8');
const appVersion = JSON.parse(versionRaw);
if (!appVersion.versionCode || !appVersion.versionName) {
  throw new Error(`[Vite Build Error] Invalid version metadata in ${versionFilePath}`);
}

// Load changelog from public/changelog.json
let appChangelog: Array<{ type: string; ar: string; en: string }> = [];
try {
  const changelogFile = fs.readFileSync(path.resolve(__dirname, 'public/changelog.json'), 'utf-8');
  appChangelog = JSON.parse(changelogFile);
} catch { /* use defaults */ }

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Inject app version at build time
  define: {
    '__APP_VERSION__': JSON.stringify(appVersion),
    '__APP_CHANGELOG__': JSON.stringify(appChangelog),
    '__BUILD_COMMIT__': JSON.stringify(process.env.VITE_BUILD_COMMIT || 'local'),
    '__BUILD_TIMESTAMP__': JSON.stringify(new Date().toISOString()),
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
      injectRegister: null,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/~oauth/],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Instant 0ms app-shell loading: StaleWhileRevalidate serves cache immediately
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pages-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Hashed build assets are immutable; old caches are removed on upgrade.
            urlPattern: /\.(?:js|css)$/i,
            handler: 'CacheFirst',
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
  build: {
    sourcemap: false,
    // base './' needed for Electron file:// protocol
    ...(process.env.ELECTRON_BUILD === 'true' ? {} : {}),
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('jspdf')) {
              return 'vendor-pdf';
            }
            if (id.includes('exceljs')) {
              return 'vendor-excel';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
          }
        },
      },
    },
  },
  base: './',
}));
