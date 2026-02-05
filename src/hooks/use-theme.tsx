import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemeColor = 'emerald' | 'blue' | 'purple' | 'rose' | 'orange' | 'cyan' | 'indigo' | 'amber' | 'teal' | 'crimson';

interface ThemeContextType {
  mode: ThemeMode;
  color: ThemeColor;
  blurEnabled: boolean;
  blurOpacity: number;
  setMode: (mode: ThemeMode) => void;
  setColor: (color: ThemeColor) => void;
  setBlurEnabled: (enabled: boolean) => void;
  setBlurOpacity: (opacity: number) => void;
  setTheme: (mode: ThemeMode, color: ThemeColor) => void;
  setFullTheme: (mode: ThemeMode, color: ThemeColor, blur: boolean, opacity?: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'hyperpos_theme_v2';

export const themeColors: Record<ThemeColor, { name: string; nameAr: string; primary: string; accent: string }> = {
  emerald: { name: 'Emerald', nameAr: 'الزمردي', primary: '160 84% 39%', accent: '173 80% 40%' },
  blue: { name: 'Blue', nameAr: 'الأزرق', primary: '217 91% 60%', accent: '199 89% 48%' },
  purple: { name: 'Purple', nameAr: 'البنفسجي', primary: '271 81% 56%', accent: '280 67% 50%' },
  rose: { name: 'Rose', nameAr: 'الوردي', primary: '346 77% 50%', accent: '330 65% 55%' },
  orange: { name: 'Orange', nameAr: 'البرتقالي', primary: '25 95% 53%', accent: '38 92% 50%' },
  cyan: { name: 'Cyan', nameAr: 'السماوي', primary: '186 100% 42%', accent: '192 91% 36%' },
  indigo: { name: 'Indigo', nameAr: 'النيلي', primary: '239 84% 67%', accent: '224 76% 48%' },
  amber: { name: 'Amber', nameAr: 'الكهرماني', primary: '38 92% 50%', accent: '45 93% 47%' },
  teal: { name: 'Teal', nameAr: 'التركوازي', primary: '173 80% 40%', accent: '166 72% 28%' },
  crimson: { name: 'Crimson', nameAr: 'القرمزي', primary: '348 83% 47%', accent: '356 80% 45%' },
};

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

const darkModeColors = {
  background: '222 47% 6%',
  foreground: '210 40% 98%',
  card: '222 47% 8%',
  cardForeground: '210 40% 98%',
  popover: '222 47% 10%',
  popoverForeground: '210 40% 98%',
  secondary: '215 28% 17%',
  secondaryForeground: '210 40% 98%',
  muted: '215 28% 14%',
  mutedForeground: '215 20% 55%',
  border: '215 28% 17%',
  input: '215 28% 17%',
  sidebar: '222 47% 7%',
  sidebarForeground: '210 40% 90%',
  sidebarAccent: '215 28% 14%',
  sidebarBorder: '215 28% 14%',
  posGrid: '222 47% 9%',
  posItem: '222 47% 11%',
  posItemHover: '222 47% 14%',
  posCart: '222 47% 8%',
};

function applyTheme(mode: ThemeMode, color: ThemeColor) {
  const root = document.documentElement;
  const colors = mode === 'light' ? lightModeColors : darkModeColors;
  const colorTheme = themeColors[color];

  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}`, value);
  });

  root.style.setProperty('--primary', colorTheme.primary);
  root.style.setProperty('--primary-foreground', '0 0% 100%');
  root.style.setProperty('--accent', colorTheme.accent);
  root.style.setProperty('--accent-foreground', '0 0% 100%');
  root.style.setProperty('--ring', colorTheme.primary);
  root.style.setProperty('--sidebar-primary', colorTheme.primary);
  root.style.setProperty('--sidebar-primary-foreground', '0 0% 100%');
  root.style.setProperty('--sidebar-ring', colorTheme.primary);
  root.style.setProperty('--pos-total', colorTheme.primary);
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${colorTheme.primary}), hsl(${colorTheme.accent}))`);
  root.style.setProperty('--shadow-glow', `0 0 40px -10px hsl(${colorTheme.primary} / 0.3)`);

  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function applyBlurTheme(enabled: boolean, mode: ThemeMode, opacity: number = 50) {
  const root = document.documentElement;
  const opacityDecimal = opacity / 100;

  if (enabled) {
    root.classList.add('blur-theme');

    const baseBg = mode === 'dark'
      ? `rgba(10, 10, 20, ${opacityDecimal})`
      : `rgba(255, 255, 255, ${opacityDecimal})`;

    root.style.setProperty('--glass-bg', baseBg);
    root.style.setProperty('--glass-border',
      mode === 'dark'
        ? `rgba(255, 255, 255, ${opacityDecimal * 0.3})`
        : `rgba(0, 0, 0, ${opacityDecimal * 0.1})`
    );
    root.style.setProperty('--glass-opacity', opacityDecimal.toString());
  } else {
    root.classList.remove('blur-theme');
    root.style.removeProperty('--glass-bg');
    root.style.removeProperty('--glass-border');
    root.style.removeProperty('--glass-opacity');
  }
}

const DEFAULT_MODE: ThemeMode = 'light';
const DEFAULT_COLOR: ThemeColor = 'blue';
const DEFAULT_BLUR: boolean = false;
const DEFAULT_OPACITY: number = 50;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [color, setColorState] = useState<ThemeColor>(DEFAULT_COLOR);
  const [blurEnabled, setBlurEnabledState] = useState<boolean>(DEFAULT_BLUR);
  const [blurOpacity, setBlurOpacityState] = useState<number>(DEFAULT_OPACITY);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const finalMode = parsed.mode || DEFAULT_MODE;
        const finalColor = parsed.color || DEFAULT_COLOR;
        const finalBlur = parsed.blur ?? DEFAULT_BLUR;
        const finalOpacity = parsed.opacity ?? DEFAULT_OPACITY;

        setModeState(finalMode);
        setColorState(finalColor);
        setBlurEnabledState(finalBlur);
        setBlurOpacityState(finalOpacity);

        applyTheme(finalMode, finalColor);
        applyBlurTheme(finalBlur, finalMode, finalOpacity);
      } else {
        applyTheme(DEFAULT_MODE, DEFAULT_COLOR);
        applyBlurTheme(DEFAULT_BLUR, DEFAULT_MODE, DEFAULT_OPACITY);
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({
          mode: DEFAULT_MODE,
          color: DEFAULT_COLOR,
          blur: DEFAULT_BLUR,
          opacity: DEFAULT_OPACITY
        }));
      }
    } catch {
      applyTheme(DEFAULT_MODE, DEFAULT_COLOR);
      applyBlurTheme(DEFAULT_BLUR, DEFAULT_MODE, DEFAULT_OPACITY);
    }
    setIsInitialized(true);
  }, []);

  const saveTheme = (newMode: ThemeMode, newColor: ThemeColor, newBlur: boolean, newOpacity: number) => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({
      mode: newMode,
      color: newColor,
      blur: newBlur,
      opacity: newOpacity
    }));
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    applyTheme(newMode, color);
    applyBlurTheme(blurEnabled, newMode, blurOpacity);
    saveTheme(newMode, color, blurEnabled, blurOpacity);
  };

  const setColor = (newColor: ThemeColor) => {
    setColorState(newColor);
    applyTheme(mode, newColor);
    applyBlurTheme(blurEnabled, mode, blurOpacity);
    saveTheme(mode, newColor, blurEnabled, blurOpacity);
  };

  const setBlurEnabled = (enabled: boolean) => {
    setBlurEnabledState(enabled);
    applyBlurTheme(enabled, mode, blurOpacity);
    saveTheme(mode, color, enabled, blurOpacity);
  };

  const setBlurOpacity = (opacity: number) => {
    setBlurOpacityState(opacity);
    applyBlurTheme(blurEnabled, mode, opacity);
    saveTheme(mode, color, blurEnabled, opacity);
  };

  const setTheme = (newMode: ThemeMode, newColor: ThemeColor) => {
    setModeState(newMode);
    setColorState(newColor);
    applyTheme(newMode, newColor);
    applyBlurTheme(blurEnabled, newMode, blurOpacity);
    saveTheme(newMode, newColor, blurEnabled, blurOpacity);
  };

  const setFullTheme = (newMode: ThemeMode, newColor: ThemeColor, blur: boolean, opacity?: number) => {
    const finalOpacity = opacity ?? blurOpacity;
    setModeState(newMode);
    setColorState(newColor);
    setBlurEnabledState(blur);
    if (opacity !== undefined) setBlurOpacityState(opacity);
    applyTheme(newMode, newColor);
    applyBlurTheme(blur, newMode, finalOpacity);
    saveTheme(newMode, newColor, blur, finalOpacity);
  };

  if (!isInitialized) return null;

  return (
    <ThemeContext.Provider value={{
      mode,
      color,
      blurEnabled,
      blurOpacity,
      setMode,
      setColor,
      setBlurEnabled,
      setBlurOpacity,
      setTheme,
      setFullTheme
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
