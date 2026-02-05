import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
}

const variantStyles = {
  default: 'glass-card border-none text-white',
  primary: 'glass-card border-none text-white bg-primary/20',
  success: 'glass-card border-none text-white bg-success/20',
  warning: 'glass-card border-none text-white bg-warning/20',
  danger: 'glass-card border-none text-white bg-destructive/20',
};

const iconBgStyles = {
  default: 'bg-muted',
  primary: 'bg-primary/20',
  success: 'bg-success/20',
  warning: 'bg-warning/20',
  danger: 'bg-destructive/20',
};

const iconColorStyles = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

export function StatCard({ title, value, subtitle, icon, trend, variant = 'default', linkTo }: StatCardProps) {
  const navigate = useNavigate();

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
    if (linkTo) {
      navigate(linkTo);
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl p-3 md:p-4 card-hover transition-all duration-300",
        variantStyles[variant],
        linkTo && "cursor-pointer hover:bg-white/10"
      )}
      onClick={handleClick}
      role={linkTo ? "button" : undefined}
      tabIndex={linkTo ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <div className="space-y-0.5">
            <p className="text-lg md:text-xl font-bold text-foreground count-up">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          {trend && (
            <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor())}>
              {getTrendIcon()}
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground font-normal">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn(
          "p-2 rounded-lg shrink-0",
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
