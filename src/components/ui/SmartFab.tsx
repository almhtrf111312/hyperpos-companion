import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SmartFabProps {
  onClick?: () => void;
  label?: string;
  icon?: React.ReactNode;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  showLabelOnDesktop?: boolean;
  children?: React.ReactNode;
}

export const SmartFab: React.FC<SmartFabProps> = ({
  onClick,
  label = 'إضافة',
  icon = <Plus className="w-6 h-6" />,
  scrollContainerRef,
  className,
  showLabelOnDesktop = true,
  children,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollTopRef = useRef(0);

  const handleScroll = useCallback((scrollTop: number) => {
    if (scrollTop < 40) {
      setIsVisible(true);
    } else if (scrollTop > lastScrollTopRef.current + 12) {
      setIsVisible(false); // إخفاء عند التمرير للأسفل
    } else if (scrollTop < lastScrollTopRef.current - 12) {
      setIsVisible(true); // إظهار عند التمرير للأعلى
    }
    lastScrollTopRef.current = scrollTop;
  }, []);

  useEffect(() => {
    const onWindowScroll = () => {
      const top = window.scrollY || document.documentElement.scrollTop;
      handleScroll(top);
    };
    window.addEventListener('scroll', onWindowScroll, { passive: true });

    const target = scrollContainerRef?.current;
    let onTargetScroll: (() => void) | undefined;
    if (target) {
      onTargetScroll = () => handleScroll(target.scrollTop);
      target.addEventListener('scroll', onTargetScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', onWindowScroll);
      if (target && onTargetScroll) {
        target.removeEventListener('scroll', onTargetScroll);
      }
    };
  }, [scrollContainerRef, handleScroll]);

  return (
    <div
      className={cn(
        'fixed z-40 transition-all duration-300 ease-in-out',
        // موضع ذكي: يحترم RTL وأشرطة التنقل السفلية للهواتف
        'inset-inline-end-4 sm:inset-inline-end-8 end-4 sm:end-8',
        'bottom-20 sm:bottom-8',
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-8 scale-90 pointer-events-none'
      )}
    >
      {children || (
        <Button
          onClick={onClick}
          size="lg"
          className={cn(
            'h-14 rounded-full shadow-xl bg-gradient-primary text-primary-foreground font-semibold',
            'hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 px-4 sm:px-6',
            className
          )}
          aria-label={label}
        >
          {icon}
          {showLabelOnDesktop && (
            <span className="hidden sm:inline text-sm font-medium">{label}</span>
          )}
        </Button>
      )}
    </div>
  );
};
