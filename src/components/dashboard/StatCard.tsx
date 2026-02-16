import { ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useCountUp } from '@/hooks/use-count-up';
import { MiniSparkline } from './MiniSparkline';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  linkTo?: string;
  sparklineData?: number[];
}

const variantStyles = {
  default: 'glass border-border/50',
  primary: 'glass bg-primary/5 border-primary/20',
  success: 'glass bg-success/5 border-success/20',
  warning: 'glass bg-warning/5 border-warning/20',
  danger: 'glass bg-destructive/5 border-destructive/20',
};

const iconBgStyles = {
  default: 'bg-muted/50 backdrop-blur-md',
  primary: 'bg-primary/20 backdrop-blur-md',
  success: 'bg-success/20 backdrop-blur-md',
  warning: 'bg-warning/20 backdrop-blur-md',
  danger: 'bg-destructive/20 backdrop-blur-md',
};

const iconColorStyles = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

function extractNumber(value: string | number): { num: number; prefix: string; suffix: string } {
  if (typeof value === 'number') return { num: value, prefix: '', suffix: '' };
  const match = value.match(/^([^\d-]*)([-\d,.]+)(.*)$/);
  if (!match) return { num: 0, prefix: '', suffix: value };
  const num = parseFloat(match[2].replace(/,/g, ''));
  return { num: isNaN(num) ? 0 : num, prefix: match[1], suffix: match[3] };
}

function formatAnimatedNumber(num: number, original: string | number): string {
  if (typeof original === 'number') return num.toLocaleString();
  // Preserve the comma formatting from the original
  const { prefix, suffix } = extractNumber(original);
  return `${prefix}${num.toLocaleString()}${suffix}`;
}

export function StatCard({ title, value, subtitle, icon, trend, variant = 'default', linkTo, sparklineData }: StatCardProps) {
  const navigate = useNavigate();
  const { num } = useMemo(() => extractNumber(value), [value]);
  const animatedNum = useCountUp(num);

  const displayValue = formatAnimatedNumber(animatedNum, value);

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="w-4 h-4" />;
    if (trend.value < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value > 0) return 'text-success';
    if (trend.value < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const handleClick = () => {
    if (linkTo) navigate(linkTo);
  };

  return (
    <div
      className={cn(
        "group rounded-xl p-2.5 md:p-3 transition-all duration-300",
        "hover:translate-y-[-2px] hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30",
        variantStyles[variant],
        linkTo && "cursor-pointer hover:ring-2 hover:ring-primary/50 hover:bg-card/90"
      )}
      onClick={handleClick}
      role={linkTo ? "button" : undefined}
      tabIndex={linkTo ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-[10px] md:text-xs font-medium text-muted-foreground line-clamp-2 leading-tight">{title}</p>
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm md:text-xl font-bold text-foreground truncate">{displayValue}</p>
            {subtitle && (
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <MiniSparkline data={sparklineData} />
          )}
          {trend && (
            <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor())}>
              {getTrendIcon()}
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground font-normal">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn(
          "p-2 rounded-lg shrink-0 transition-transform duration-300 group-hover:scale-110 hidden md:flex",
          iconBgStyles[variant]
        )}>
          <div className={cn(iconColorStyles[variant], "[&>svg]:w-4 [&>svg]:h-4 md:[&>svg]:w-5 md:[&>svg]:h-5")}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}
