/// <reference types="vite/client" />

declare const __APP_VERSION__: {
  versionName: string;
  versionCode: number;
  lastUpdated: string;
  buildHistory?: Array<{ versionCode: number; date: string; description: string }>;
};
