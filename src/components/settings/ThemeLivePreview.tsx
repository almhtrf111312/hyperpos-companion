import { themeColors, ThemeColor, ThemeMode } from '@/hooks/use-theme';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';

interface ThemeLivePreviewProps {
  mode: ThemeMode;
  color: ThemeColor;
  blur: boolean;
  transparency: number;
}

export function ThemeLivePreview({ mode, color, blur, transparency }: ThemeLivePreviewProps) {
  const { isRTL, t } = useLanguage();
  const theme = themeColors[color];
  const isDark = mode === 'dark';

  // Base palette
  const bg = isDark ? 'hsl(222, 47%, 6%)' : 'hsl(0, 0%, 100%)';
  const cardBg = isDark ? 'hsl(222, 47%, 9%)' : 'hsl(0, 0%, 98%)';
  const mutedBg = isDark ? 'hsl(215, 28%, 15%)' : 'hsl(210, 40%, 96%)';
  const fg = isDark ? 'hsl(210, 40%, 98%)' : 'hsl(222, 47%, 11%)';
  const mutedFg = isDark ? 'hsl(215, 20%, 60%)' : 'hsl(215, 16%, 47%)';
  const borderColor = isDark ? 'hsl(215, 28%, 18%)' : 'hsl(214, 32%, 91%)';
  const sidebarBg = isDark ? 'hsl(222, 47%, 7%)' : 'hsl(0, 0%, 98%)';
  const primary = `hsl(${theme.primary})`;
  const accent = `hsl(${theme.accent})`;

  const glassStyle = blur && transparency > 0 && !isDark ? {
    backgroundColor: `hsla(0, 0%, 100%, ${0.82 - (transparency / 100) * 0.42})`,
    backdropFilter: `blur(${12 + (transparency / 100) * 16}px)`,
  } : {};

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        {isRTL ? '👁️ معاينة مباشرة' : '👁️ Live Preview'}
      </h3>
      <div
        className="rounded-xl border-2 border-border overflow-hidden shadow-lg transition-all duration-500"
        style={{ backgroundColor: bg, direction: isRTL ? 'rtl' : 'ltr' }}
      >
        <div className="flex h-[220px]">
          {/* Mini Sidebar */}
          <div
            className="w-12 flex flex-col items-center py-3 gap-2 shrink-0 transition-colors duration-500"
            style={{ backgroundColor: sidebarBg, borderInlineEnd: `1px solid ${borderColor}` }}
          >
            {/* Logo */}
            <div
              className="w-7 h-7 rounded-lg mb-2"
              style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
            />
            {/* Nav items */}
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="w-7 h-7 rounded-md transition-colors duration-500"
                style={{
                  backgroundColor: i === 0 ? `${primary}22` : mutedBg,
                  border: i === 0 ? `1.5px solid ${primary}44` : 'none',
                }}
              />
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 p-3 space-y-2.5 overflow-hidden transition-colors duration-500" style={blur && !isDark ? glassStyle : {}}>
            {/* Header bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 rounded-full w-20 transition-colors duration-500" style={{ backgroundColor: fg, opacity: 0.8 }} />
              </div>
              <div className="flex gap-1.5">
                <div className="w-6 h-6 rounded-full transition-colors duration-500" style={{ backgroundColor: mutedBg }} />
                <div className="w-6 h-6 rounded-full transition-colors duration-500" style={{ backgroundColor: mutedBg }} />
              </div>
            </div>

            {/* Stat Cards Row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: isRTL ? 'المبيعات' : 'Sales', value: '٢,٤٥٠', colorAlpha: '20' },
                { label: isRTL ? 'الأرباح' : 'Profit', value: '٨٥٠', colorAlpha: '15' },
                { label: isRTL ? 'المنتجات' : 'Items', value: '١٢٤', colorAlpha: '10' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="rounded-lg p-2 transition-all duration-500"
                  style={{
                    backgroundColor: cardBg,
                    border: `1px solid ${borderColor}`,
                    ...(blur && !isDark ? glassStyle : {}),
                  }}
                >
                  <div className="text-[8px] mb-0.5 transition-colors duration-500" style={{ color: mutedFg }}>{stat.label}</div>
                  <div className="text-xs font-bold transition-colors duration-500" style={{ color: fg }}>{stat.value}</div>
                  <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ backgroundColor: mutedBg }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        background: `linear-gradient(90deg, ${primary}, ${accent})`,
                        width: `${60 + i * 15}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Mini Table */}
            <div
              className="rounded-lg overflow-hidden transition-all duration-500"
              style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, ...(blur && !isDark ? glassStyle : {}) }}
            >
              {[0, 1, 2].map(row => (
                <div
                  key={row}
                  className="flex items-center gap-2 px-2 py-1.5 transition-colors duration-500"
                  style={{ borderBottom: row < 2 ? `1px solid ${borderColor}` : 'none' }}
                >
                  <div className="w-5 h-5 rounded-md shrink-0 transition-colors duration-500" style={{ backgroundColor: mutedBg }} />
                  <div className="flex-1">
                    <div className="h-2 rounded-full w-16 transition-colors duration-500" style={{ backgroundColor: fg, opacity: 0.6 }} />
                  </div>
                  <div
                    className="h-4 rounded-full px-2 flex items-center transition-colors duration-500"
                    style={{
                      backgroundColor: `${primary}22`,
                      color: primary,
                      fontSize: '7px',
                      fontWeight: 600,
                    }}
                  >
                    {row === 0 ? (isRTL ? 'مكتمل' : 'Done') : row === 1 ? (isRTL ? 'معلق' : 'Pending') : (isRTL ? 'جديد' : 'New')}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom button */}
            <div className="flex justify-end">
              <div
                className="h-6 rounded-md px-3 flex items-center transition-all duration-500"
                style={{
                  background: `linear-gradient(135deg, ${primary}, ${accent})`,
                  color: 'white',
                  fontSize: '8px',
                  fontWeight: 600,
                }}
              >
                {isRTL ? 'بيع جديد' : 'New Sale'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
