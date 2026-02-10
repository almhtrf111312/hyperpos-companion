import * as React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { TranslationKey } from '@/lib/i18n';
import { createPortal } from 'react-dom';

interface AppTooltipProps {
  /** Translation key for the tooltip text */
  tooltipKey: TranslationKey;
  /** The element to wrap */
  children: React.ReactElement;
  /** Preferred side for the tooltip (desktop only) */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Disable the tooltip */
  disabled?: boolean;
}

/**
 * AppTooltip - Dual-mode tooltip component
 * Desktop: Radix tooltip with 500ms hover delay
 * Mobile: Long-press (1s) with portal-rendered tooltip
 */
export function AppTooltip({ tooltipKey, children, side = 'top', disabled = false }: AppTooltipProps) {
  const { t, isRTL } = useLanguage();
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showMobileTooltip, setShowMobileTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Detect touch device
  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  const text = t(tooltipKey);

  // --- Mobile long-press handlers ---
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    const touch = e.touches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    longPressTimer.current = setTimeout(() => {
      // Position tooltip above the element center
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
      setShowMobileTooltip(true);
    }, 1000); // 1 second long press
  }, [disabled]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setShowMobileTooltip(false);
  }, []);

  const handleTouchMove = useCallback(() => {
    // Cancel long press if finger moves
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Close mobile tooltip when clicking outside
  useEffect(() => {
    if (!showMobileTooltip) return;
    const handleClickOutside = () => setShowMobileTooltip(false);
    document.addEventListener('touchstart', handleClickOutside);
    return () => document.removeEventListener('touchstart', handleClickOutside);
  }, [showMobileTooltip]);

  if (disabled) {
    return children;
  }

  // --- Mobile: long-press tooltip ---
  if (isTouchDevice) {
    return (
      <>
        {React.cloneElement(children, {
          onTouchStart: (e: React.TouchEvent) => {
            handleTouchStart(e);
            // Preserve original handler
            children.props.onTouchStart?.(e);
          },
          onTouchEnd: (e: React.TouchEvent) => {
            handleTouchEnd();
            children.props.onTouchEnd?.(e);
          },
          onTouchMove: (e: React.TouchEvent) => {
            handleTouchMove();
            children.props.onTouchMove?.(e);
          },
          ref: triggerRef,
        })}
        {showMobileTooltip && createPortal(
          <div
            className="app-tooltip-mobile"
            style={{
              position: 'fixed',
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: 'translate(-50%, -100%)',
              zIndex: 99999,
            }}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {text}
          </div>,
          document.body
        )}
      </>
    );
  }

  // --- Desktop: Radix tooltip ---
  return (
    <TooltipPrimitive.Root delayDuration={500}>
      <TooltipPrimitive.Trigger asChild>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={isRTL && (side === 'left' || side === 'right') ? (side === 'left' ? 'right' : 'left') : side}
          sideOffset={6}
          className={cn(
            "app-tooltip-content",
            "z-[99999] overflow-hidden rounded-lg px-3 py-2 text-xs font-medium",
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
          )}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {text}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
