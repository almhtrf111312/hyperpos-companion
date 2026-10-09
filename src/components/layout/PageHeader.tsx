import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, icon, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6 ps-12 md:ps-0 min-h-[50px] shrink-0", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary shadow-xs">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex flex-col justify-center">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground leading-tight tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-normal truncate line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 w-full sm:w-auto [&>button]:h-9 [&>button]:px-3.5 [&_button]:text-xs sm:[&_button]:text-sm [&_button]:transition-all">
          {actions}
        </div>
      )}
    </div>
  );
}
