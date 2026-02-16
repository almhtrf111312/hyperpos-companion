import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThemeMode = 'light' | 'dark';
export type ThemeColor = 'emerald' | 'blue' | 'purple' | 'rose' | 'orange' | 'cyan' | 'indigo' | 'amber' | 'teal' | 'crimson';

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
  amber: {
    name: 'Amber',
    nameAr: 'الكهرماني',
    primary: '38 92% 50%',
    accent: '45 93% 47%',
  },
  teal: {
    name: 'Teal',
    nameAr: 'التركوازي',
    primary: '173 80% 40%',
    accent: '166 72% 28%',
  },
  crimson: {
    name: 'Crimson',
    nameAr: 'القرمزي',
    primary: '348 83% 47%',
    accent: '356 80% 45%',
  },
};

// Light mode base colors
const lightModeColors = {
  background: '0 0% 100%',
  foreground: '222 47% 11%',
  card: '0 0% 98%',
  cardForeground: '222 47% 11%',
  popover: '0 0% 100%',
  popoverForeground: '222 47% 11%',
  secondary: '210 40% 96%',
  secondaryForeground: '222 47% 11%',
  muted: '210 40% 96%',
  mutedForeground: '215 16% 47%',
  border: '214 32% 91%',
  input: '214 32% 91%',
  sidebar: '0 0% 98%',
  sidebarForeground: '222 47% 11%',
  sidebarAccent: '210 40% 96%',
  sidebarBorder: '214 32% 91%',
  posGrid: '210 40% 98%',
  posItem: '0 0% 100%',
  posItemHover: '210 40% 96%',
  posCart: '0 0% 98%',
};

// Dark mode base colors
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
  const colors = mode === 'light' ? lightModeColors : darkModeColors;
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

  // Add or remove dark class for any other styles
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
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
