import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { useScrollDirectionVisibility, useSidebarOpenState } from '@/hooks/use-scroll-visibility';

export interface SmartFabProps {
  onClick?: () => void;
  label?: string;
  icon?: React.ReactNode;
  /** @deprecated يتم الاستماع لكل حاويات التمرير تلقائياً */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  /** @deprecated الزر دائري دائماً */
  showLabelOnDesktop?: boolean;
  children?: React.ReactNode;
}

/** موضع الأزرار العائمة الموحد: يمين بالعربي، يسار بالإنجليزي */
export function floatingSideClass(isRTL: boolean) {
  return isRTL ? 'right-5 sm:right-8' : 'left-5 sm:left-8';
}
export const floatingBottomClass = 'bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:bottom-10';

export const SmartFab: React.FC<SmartFabProps> = ({
  onClick,
  label = 'إضافة',
  icon = <Plus className="w-7 h-7 stroke-[2.5]" />,
  className,
  children,
}) => {
  const { isRTL } = useLanguage();
  const scrollVisible = useScrollDirectionVisibility();
  const sidebarOpen = useSidebarOpenState();
  const isVisible = scrollVisible && !sidebarOpen;

  return (
    <div
      className={cn(
        'fixed z-30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)]',
        floatingSideClass(isRTL),
        floatingBottomClass,
        isVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-[calc(100%+2rem)] pointer-events-none'
      )}
    >
      {children || (
        <Button
          onClick={onClick}
          title={label}
          aria-label={label}
          className={cn(
            'size-16 rounded-full p-0 bg-gradient-primary text-primary-foreground',
            'shadow-xl shadow-primary/30 ring-4 ring-primary/15 hover:shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-200',
            className
          )}
        >
          {icon}
        </Button>
      )}
    </div>
  );
};
