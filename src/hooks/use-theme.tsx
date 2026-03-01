import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThemeMode = 'light' | 'dark';
export type ThemeColor = 'emerald' | 'blue' | 'purple' | 'rose' | 'orange' | 'cyan' | 'indigo' | 'coral' | 'lime' | 'magenta' | 'coffee';

interface ThemeContextType {
  mode: ThemeMode;
  color: ThemeColor;
  blurEnabled: boolean;
  transparencyLevel: number;
  setMode: (mode: ThemeMode) => void;
  setColor: (color: ThemeColor) => void;
  setBlurEnabled: (enabled: boolean) => void;
  setTransparencyLevel: (level: number) => void;
  setTheme: (mode: ThemeMode, color: ThemeColor) => void;
  setFullTheme: (mode: ThemeMode, color: ThemeColor, blur: boolean, transparency?: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'hyperpos_theme_v1';

// Theme color definitions with HSL values
export const themeColors: Record<ThemeColor, { name: string; nameAr: string; primary: string; accent: string }> = {
  emerald: {
    name: 'Emerald',
    nameAr: 'الزمردي',
    primary: '160 84% 39%',
    accent: '173 80% 40%',
  },
  blue: {
    name: 'Blue',
    nameAr: 'الأزرق',
    primary: '217 91% 60%',
    accent: '199 89% 48%',
  },
  purple: {
    name: 'Purple',
    nameAr: 'البنفسجي',
    primary: '271 81% 56%',
    accent: '280 67% 50%',
  },
  rose: {
    name: 'Rose',
    nameAr: 'الوردي',
    primary: '346 77% 50%',
    accent: '330 65% 55%',
  },
  orange: {
    name: 'Orange',
    nameAr: 'البرتقالي',
    primary: '25 95% 53%',
    accent: '38 92% 50%',
  },
  cyan: {
    name: 'Cyan',
    nameAr: 'السماوي',
    primary: '186 100% 42%',
    accent: '192 91% 36%',
  },
  indigo: {
    name: 'Indigo',
    nameAr: 'النيلي',
    primary: '239 84% 67%',
    accent: '224 76% 48%',
  },
  coral: {
    name: 'Coral',
    nameAr: 'المرجاني',
    primary: '16 85% 55%',
    accent: '8 78% 50%',
  },
  lime: {
    name: 'Lime',
    nameAr: 'الليموني',
    primary: '85 70% 45%',
    accent: '95 65% 38%',
  },
  magenta: {
    name: 'Magenta',
    nameAr: 'الأرجواني',
    primary: '310 75% 55%',
    accent: '320 70% 48%',
  },
  coffee: {
    name: 'Coffee',
    nameAr: 'القهوة',
    primary: '28 80% 60%',
    accent: '26 43% 35%',
  },
};

// Per-color light-mode palette tint — each theme gets a slightly hued background/muted
// that complements its primary color for a harmonious, polished look
type LightPalette = {
  background: string; foreground: string;
  card: string; cardForeground: string;
  popover: string; popoverForeground: string;
  secondary: string; secondaryForeground: string;
  muted: string; mutedForeground: string;
  border: string; input: string;
  sidebar: string; sidebarForeground: string;
  sidebarAccent: string; sidebarAccentForeground: string; sidebarBorder: string;
  posGrid: string; posItem: string; posItemHover: string; posCart: string;
};

const lightPalettes: Record<ThemeColor, LightPalette> = {
  emerald: {
    background: '150 30% 99%', foreground: '160 40% 12%',
    card: '150 20% 99%', cardForeground: '160 40% 12%',
    popover: '0 0% 100%', popoverForeground: '160 40% 12%',
    secondary: '150 25% 94%', secondaryForeground: '160 40% 18%',
    muted: '150 20% 93%', mutedForeground: '160 20% 38%',
    border: '150 18% 80%', input: '150 18% 80%',
    sidebar: '150 25% 98%', sidebarForeground: '160 40% 12%',
    sidebarAccent: '150 30% 93%', sidebarAccentForeground: '160 84% 30%', sidebarBorder: '150 18% 82%',
    posGrid: '150 18% 97%', posItem: '150 20% 99%', posItemHover: '150 25% 94%', posCart: '150 20% 98%',
  },
  blue: {
    background: '220 40% 99%', foreground: '222 47% 11%',
    card: '220 30% 99%', cardForeground: '222 47% 11%',
    popover: '0 0% 100%', popoverForeground: '222 47% 11%',
    secondary: '214 35% 94%', secondaryForeground: '222 47% 14%',
    muted: '214 30% 92%', mutedForeground: '215 20% 38%',
    border: '214 28% 80%', input: '214 28% 80%',
    sidebar: '220 35% 98%', sidebarForeground: '222 47% 11%',
    sidebarAccent: '214 35% 94%', sidebarAccentForeground: '217 91% 50%', sidebarBorder: '214 28% 82%',
    posGrid: '214 25% 97%', posItem: '220 30% 99%', posItemHover: '214 30% 94%', posCart: '220 25% 98%',
  },
  purple: {
    background: '270 35% 99%', foreground: '270 40% 12%',
    card: '270 25% 99%', cardForeground: '270 40% 12%',
    popover: '0 0% 100%', popoverForeground: '270 40% 12%',
    secondary: '270 30% 94%', secondaryForeground: '270 40% 18%',
    muted: '270 25% 92%', mutedForeground: '270 20% 40%',
    border: '270 20% 80%', input: '270 20% 80%',
    sidebar: '270 30% 98%', sidebarForeground: '270 40% 12%',
    sidebarAccent: '270 30% 93%', sidebarAccentForeground: '271 81% 46%', sidebarBorder: '270 20% 82%',
    posGrid: '270 18% 97%', posItem: '270 25% 99%', posItemHover: '270 30% 94%', posCart: '270 22% 98%',
  },
  rose: {
    background: '345 40% 99%', foreground: '345 40% 12%',
    card: '345 25% 99%', cardForeground: '345 40% 12%',
    popover: '0 0% 100%', popoverForeground: '345 40% 12%',
    secondary: '345 30% 94%', secondaryForeground: '345 40% 18%',
    muted: '345 20% 92%', mutedForeground: '345 15% 40%',
    border: '345 18% 82%', input: '345 18% 82%',
    sidebar: '345 30% 98%', sidebarForeground: '345 40% 12%',
    sidebarAccent: '345 28% 93%', sidebarAccentForeground: '346 77% 40%', sidebarBorder: '345 18% 83%',
    posGrid: '345 15% 97%', posItem: '345 22% 99%', posItemHover: '345 25% 94%', posCart: '345 18% 98%',
  },
  orange: {
    background: '30 45% 99%', foreground: '25 50% 12%',
    card: '30 30% 99%', cardForeground: '25 50% 12%',
    popover: '0 0% 100%', popoverForeground: '25 50% 12%',
    secondary: '30 35% 94%', secondaryForeground: '25 50% 18%',
    muted: '30 28% 92%', mutedForeground: '25 25% 40%',
    border: '30 22% 82%', input: '30 22% 82%',
    sidebar: '30 35% 98%', sidebarForeground: '25 50% 12%',
    sidebarAccent: '30 32% 93%', sidebarAccentForeground: '25 95% 43%', sidebarBorder: '30 22% 83%',
    posGrid: '30 20% 97%', posItem: '30 28% 99%', posItemHover: '30 30% 94%', posCart: '30 22% 98%',
  },
  cyan: {
    background: '186 40% 99%', foreground: '186 50% 10%',
    card: '186 25% 99%', cardForeground: '186 50% 10%',
    popover: '0 0% 100%', popoverForeground: '186 50% 10%',
    secondary: '186 35% 93%', secondaryForeground: '186 50% 16%',
    muted: '186 28% 91%', mutedForeground: '186 20% 38%',
    border: '186 22% 80%', input: '186 22% 80%',
    sidebar: '186 35% 98%', sidebarForeground: '186 50% 10%',
    sidebarAccent: '186 32% 92%', sidebarAccentForeground: '186 100% 32%', sidebarBorder: '186 22% 81%',
    posGrid: '186 18% 97%', posItem: '186 22% 99%', posItemHover: '186 28% 93%', posCart: '186 20% 98%',
  },
  indigo: {
    background: '239 40% 99%', foreground: '239 45% 12%',
    card: '239 25% 99%', cardForeground: '239 45% 12%',
    popover: '0 0% 100%', popoverForeground: '239 45% 12%',
    secondary: '239 30% 94%', secondaryForeground: '239 45% 18%',
    muted: '239 24% 92%', mutedForeground: '239 20% 40%',
    border: '239 20% 81%', input: '239 20% 81%',
    sidebar: '239 30% 98%', sidebarForeground: '239 45% 12%',
    sidebarAccent: '239 28% 93%', sidebarAccentForeground: '239 84% 54%', sidebarBorder: '239 20% 82%',
    posGrid: '239 16% 97%', posItem: '239 22% 99%', posItemHover: '239 26% 94%', posCart: '239 18% 98%',
  },
  coral: {
    background: '16 40% 99%', foreground: '16 50% 12%',
    card: '16 28% 99%', cardForeground: '16 50% 12%',
    popover: '0 0% 100%', popoverForeground: '16 50% 12%',
    secondary: '16 32% 93%', secondaryForeground: '16 50% 18%',
    muted: '16 26% 91%', mutedForeground: '16 22% 40%',
    border: '16 20% 81%', input: '16 20% 81%',
    sidebar: '16 32% 98%', sidebarForeground: '16 50% 12%',
    sidebarAccent: '16 30% 92%', sidebarAccentForeground: '16 85% 45%', sidebarBorder: '16 20% 82%',
    posGrid: '16 16% 97%', posItem: '16 24% 99%', posItemHover: '16 28% 93%', posCart: '16 18% 98%',
  },
  lime: {
    background: '85 35% 99%', foreground: '85 45% 10%',
    card: '85 22% 99%', cardForeground: '85 45% 10%',
    popover: '0 0% 100%', popoverForeground: '85 45% 10%',
    secondary: '85 28% 93%', secondaryForeground: '85 45% 16%',
    muted: '85 22% 91%', mutedForeground: '85 18% 38%',
    border: '85 18% 80%', input: '85 18% 80%',
    sidebar: '85 28% 98%', sidebarForeground: '85 45% 10%',
    sidebarAccent: '85 26% 92%', sidebarAccentForeground: '85 70% 35%', sidebarBorder: '85 18% 81%',
    posGrid: '85 14% 97%', posItem: '85 20% 99%', posItemHover: '85 24% 93%', posCart: '85 16% 98%',
  },
  magenta: {
    background: '310 38% 99%', foreground: '310 45% 12%',
    card: '310 24% 99%', cardForeground: '310 45% 12%',
    popover: '0 0% 100%', popoverForeground: '310 45% 12%',
    secondary: '310 28% 93%', secondaryForeground: '310 45% 18%',
    muted: '310 22% 92%', mutedForeground: '310 18% 40%',
    border: '310 18% 81%', input: '310 18% 81%',
    sidebar: '310 28% 98%', sidebarForeground: '310 45% 12%',
    sidebarAccent: '310 26% 93%', sidebarAccentForeground: '310 75% 45%', sidebarBorder: '310 18% 82%',
    posGrid: '310 14% 97%', posItem: '310 22% 99%', posItemHover: '310 24% 93%', posCart: '310 16% 98%',
  },
  coffee: {
    background: '60 33% 98%',         // Warm Off-White #FDFDF7
    foreground: '26 43% 21%',         // Rich Coffee Brown #4B3621
    card: '60 33% 99%', cardForeground: '26 43% 21%',
    popover: '60 33% 99%', popoverForeground: '26 43% 21%',
    secondary: '42 31% 94%',          // Warm Pale Cream #F6F3EC
    secondaryForeground: '26 43% 21%',
    muted: '42 31% 94%', mutedForeground: '26 30% 42%',
    border: '42 25% 85%', input: '42 25% 85%',
    sidebar: '60 33% 98%', sidebarForeground: '26 43% 21%',
    sidebarAccent: '42 31% 94%', sidebarAccentForeground: '28 80% 50%', sidebarBorder: '42 25% 85%',
    posGrid: '42 25% 96%', posItem: '60 33% 99%', posItemHover: '42 31% 94%', posCart: '60 33% 98%',
  },
};

// Dark mode base colors (shared for all themes)
const darkModeColors = {
  background: '222 47% 6%',
  foreground: '210 40% 98%',
  card: '222 47% 9%',
  cardForeground: '210 40% 98%',
  popover: '222 47% 10%',
  popoverForeground: '210 40% 98%',
  secondary: '215 28% 17%',
  secondaryForeground: '210 40% 98%',
  muted: '215 28% 15%',
  mutedForeground: '215 20% 60%',
  border: '215 28% 18%',
  input: '215 28% 17%',
  sidebar: '222 47% 7%',
  sidebarForeground: '210 40% 92%',
  sidebarAccent: '215 28% 14%',
  sidebarBorder: '215 28% 14%',
  posGrid: '222 47% 9%',
  posItem: '222 47% 11%',
  posItemHover: '222 47% 14%',
  posCart: '222 47% 8%',
};

function triggerThemeTransition() {
  const root = document.documentElement;
  root.classList.add('theme-transitioning');
  // Remove after transition completes
  setTimeout(() => root.classList.remove('theme-transitioning'), 500);
}

function applyTheme(mode: ThemeMode, color: ThemeColor) {
  const root = document.documentElement;
  const colors = mode === 'light' ? lightPalettes[color] : darkModeColors;
  const colorTheme = themeColors[color];

  // Apply base colors
  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--foreground', colors.foreground);
  root.style.setProperty('--card', colors.card);
  root.style.setProperty('--card-foreground', colors.cardForeground);
  root.style.setProperty('--popover', colors.popover);
  root.style.setProperty('--popover-foreground', colors.popoverForeground);
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--secondary-foreground', colors.secondaryForeground);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--muted-foreground', colors.mutedForeground);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--input', colors.input);

  // Sidebar
  root.style.setProperty('--sidebar-background', colors.sidebar);
  root.style.setProperty('--sidebar-foreground', colors.sidebarForeground);
  root.style.setProperty('--sidebar-accent', colors.sidebarAccent);
  root.style.setProperty('--sidebar-border', colors.sidebarBorder);
  // sidebar-accent-foreground (previously missing — causes nav hover color issues)
  if (mode === 'light') {
    root.style.setProperty('--sidebar-accent-foreground', (colors as LightPalette).sidebarAccentForeground);
  } else {
    root.style.setProperty('--sidebar-accent-foreground', '210 40% 98%');
  }

  // POS
  root.style.setProperty('--pos-grid', colors.posGrid);
  root.style.setProperty('--pos-item', colors.posItem);
  root.style.setProperty('--pos-item-hover', colors.posItemHover);
  root.style.setProperty('--pos-cart', colors.posCart);

  // Apply color theme
  root.style.setProperty('--primary', colorTheme.primary);
  root.style.setProperty('--primary-foreground', '0 0% 100%');
  root.style.setProperty('--accent', colorTheme.accent);
  root.style.setProperty('--accent-foreground', '0 0% 100%');
  root.style.setProperty('--ring', colorTheme.primary);
  root.style.setProperty('--sidebar-primary', colorTheme.primary);
  root.style.setProperty('--sidebar-primary-foreground', '0 0% 100%');
  root.style.setProperty('--sidebar-ring', colorTheme.primary);
  root.style.setProperty('--pos-total', colorTheme.primary);

  // Update gradient
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${colorTheme.primary}), hsl(${colorTheme.accent}))`);
  root.style.setProperty('--shadow-glow', `0 0 40px -10px hsl(${colorTheme.primary} / 0.3)`);

  // Add or remove dark/light class
  if (mode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
}

// Default theme for new users: Light mode with Blue color
const DEFAULT_MODE: ThemeMode = 'light';
const DEFAULT_COLOR: ThemeColor = 'blue';
const DEFAULT_BLUR: boolean = false;
const DEFAULT_TRANSPARENCY: number = 0;

function applyBlurTheme(enabled: boolean, mode: ThemeMode, transparency: number = 0) {
  const root = document.documentElement;
  if (enabled && transparency > 0) {
    root.classList.add('blur-theme');
    const t = transparency / 100; // 0.1 to 0.9

    // Smooth easing curve for more natural feel
    const easedT = t * t * (3 - 2 * t); // smoothstep

    if (mode === 'dark') {
      // Dark mode: deep navy-tinted glass - higher opacity for readability
      const bgAlpha = 0.88 - easedT * 0.33; // 0.88 → 0.55
      const borderAlpha = 0.10 + easedT * 0.15; // stronger white borders
      const highlightAlpha = 0.03 + easedT * 0.05;

      root.style.setProperty('--glass-bg', `hsla(222, 47%, 9%, ${bgAlpha})`);
      root.style.setProperty('--glass-border', `rgba(255, 255, 255, ${borderAlpha})`);
      root.style.setProperty('--glass-highlight', `rgba(255, 255, 255, ${highlightAlpha})`);
      root.style.setProperty('--glass-shadow', `0 8px 32px rgba(0, 0, 0, ${0.20 + easedT * 0.15})`);
    } else {
      // Light mode: frosted white glass
      const bgAlpha = 0.82 - easedT * 0.42; // 0.82 → 0.40
      const borderAlpha = 0.08 + easedT * 0.10;
      const highlightAlpha = 0.4 + easedT * 0.2;

      root.style.setProperty('--glass-bg', `hsla(0, 0%, 100%, ${bgAlpha})`);
      root.style.setProperty('--glass-border', `rgba(0, 0, 0, ${borderAlpha})`);
      root.style.setProperty('--glass-highlight', `rgba(255, 255, 255, ${highlightAlpha})`);
      root.style.setProperty('--glass-shadow', `0 8px 32px rgba(0, 0, 0, ${0.06 + easedT * 0.08})`);
    }

    root.style.setProperty('--glass-inset-shadow', `inset 0 1px 0 var(--glass-highlight)`);
    // Blur increases with transparency for legibility
    const blurPx = 12 + easedT * 16; // 12px → 28px
    root.style.setProperty('--blur-intensity', `${blurPx}px`);
  } else {
    root.classList.remove('blur-theme');
    // Reset all glass CSS variables so they don't linger as inline styles
    root.style.removeProperty('--glass-bg');
    root.style.removeProperty('--glass-border');
    root.style.removeProperty('--glass-highlight');
    root.style.removeProperty('--glass-shadow');
    root.style.removeProperty('--glass-inset-shadow');
    root.style.removeProperty('--blur-intensity');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [color, setColorState] = useState<ThemeColor>(DEFAULT_COLOR);
  const [blurEnabled, setBlurEnabledState] = useState<boolean>(DEFAULT_BLUR);
  const [transparencyLevel, setTransparencyLevelState] = useState<number>(DEFAULT_TRANSPARENCY);
  const [isInitialized, setIsInitialized] = useState(false);

  // ✅ Step 1: Load from localStorage IMMEDIATELY (synchronous, no blocking)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) {
        const { mode: savedMode, color: savedColor, blur: savedBlur, transparency: savedTransparency } = JSON.parse(saved);
        const finalMode = savedMode || DEFAULT_MODE;
        const finalColor = savedColor || DEFAULT_COLOR;
        const finalBlur = savedBlur ?? DEFAULT_BLUR;
        const finalTransparency = savedTransparency ?? DEFAULT_TRANSPARENCY;
        setModeState(finalMode);
        setColorState(finalColor);
        setBlurEnabledState(finalBlur);
        setTransparencyLevelState(finalTransparency);
        applyTheme(finalMode, finalColor);
        applyBlurTheme(finalBlur, finalMode, finalTransparency);
      } else {
        applyTheme(DEFAULT_MODE, DEFAULT_COLOR);
        applyBlurTheme(DEFAULT_BLUR, DEFAULT_MODE, DEFAULT_TRANSPARENCY);
      }
    } catch {
      applyTheme(DEFAULT_MODE, DEFAULT_COLOR);
      applyBlurTheme(DEFAULT_BLUR, DEFAULT_MODE, DEFAULT_TRANSPARENCY);
    }
    setIsInitialized(true);
  }, []);

  // ✅ Step 2: Sync from cloud in BACKGROUND (non-blocking)
  useEffect(() => {
    const syncFromCloud = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: store } = await (supabase as any)
          .from('stores')
          .select('theme_settings')
          .eq('user_id', user.id)
          .maybeSingle();

        const cloudSettings = store?.theme_settings;
        if (cloudSettings && cloudSettings.mode) {
          const finalMode = cloudSettings.mode || DEFAULT_MODE;
          const finalColor = cloudSettings.color || DEFAULT_COLOR;
          const finalBlur = cloudSettings.blur ?? DEFAULT_BLUR;
          const finalTransparency = cloudSettings.transparency ?? DEFAULT_TRANSPARENCY;
          setModeState(finalMode);
          setColorState(finalColor);
          setBlurEnabledState(finalBlur);
          setTransparencyLevelState(finalTransparency);
          applyTheme(finalMode, finalColor);
          applyBlurTheme(finalBlur, finalMode, finalTransparency);
          localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode: finalMode, color: finalColor, blur: finalBlur, transparency: finalTransparency }));
        }
      } catch { /* ignore cloud sync errors */ }
    };
    syncFromCloud();
  }, []);

  const syncThemeToCloud = useCallback(async (m: ThemeMode, c: ThemeColor, b: boolean, t: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const themeSettings = { mode: m, color: c, blur: b, transparency: t };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('stores')
        .update({ theme_settings: themeSettings })
        .eq('user_id', user.id);
    } catch { /* ignore cloud sync errors */ }
  }, []);

  const saveTheme = (m: ThemeMode, c: ThemeColor, b: boolean, t: number) => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode: m, color: c, blur: b, transparency: t }));
    syncThemeToCloud(m, c, b, t);
  };

  const setMode = (newMode: ThemeMode) => {
    triggerThemeTransition();
    setModeState(newMode);
    applyTheme(newMode, color);
    applyBlurTheme(blurEnabled, newMode, transparencyLevel);
    saveTheme(newMode, color, blurEnabled, transparencyLevel);
  };

  const setColor = (newColor: ThemeColor) => {
    triggerThemeTransition();
    setColorState(newColor);
    applyTheme(mode, newColor);
    saveTheme(mode, newColor, blurEnabled, transparencyLevel);
  };

  const setBlurEnabled = (enabled: boolean) => {
    triggerThemeTransition();
    setBlurEnabledState(enabled);
    applyBlurTheme(enabled, mode, transparencyLevel);
    saveTheme(mode, color, enabled, transparencyLevel);
  };

  const setTransparencyLevel = (level: number) => {
    setTransparencyLevelState(level);
    applyBlurTheme(blurEnabled, mode, level);
    saveTheme(mode, color, blurEnabled, level);
  };

  const setTheme = (newMode: ThemeMode, newColor: ThemeColor) => {
    triggerThemeTransition();
    setModeState(newMode);
    setColorState(newColor);
    applyTheme(newMode, newColor);
    applyBlurTheme(blurEnabled, newMode, transparencyLevel);
    saveTheme(newMode, newColor, blurEnabled, transparencyLevel);
  };

  const setFullTheme = (newMode: ThemeMode, newColor: ThemeColor, blur: boolean, transparency?: number) => {
    triggerThemeTransition();
    const t = transparency ?? transparencyLevel;
    setModeState(newMode);
    setColorState(newColor);
    setBlurEnabledState(blur);
    setTransparencyLevelState(t);
    applyTheme(newMode, newColor);
    applyBlurTheme(blur, newMode, t);
    saveTheme(newMode, newColor, blur, t);
  };

  return (
    <ThemeContext.Provider value={{ mode, color, blurEnabled, transparencyLevel, setMode, setColor, setBlurEnabled, setTransparencyLevel, setTheme, setFullTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
