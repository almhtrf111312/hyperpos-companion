import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { cn } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { TranslationKey } from '@/lib/i18n';

const ONBOARDING_KEY = 'hp_onboarding_complete';

const CARD_WIDTH_DESKTOP = 280;
const CARD_HEIGHT_ESTIMATE = 170;

interface TourStep {
  selector: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  route?: string;
  requireSidebar?: boolean;
  requireCart?: boolean;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
  prefer?: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  { selector: '[data-tour="sidebar"]', titleKey: 'onboarding.step1Title' as TranslationKey, descKey: 'onboarding.step1Desc' as TranslationKey, desktopOnly: true, requireSidebar: true, prefer: 'right' },
  { selector: '[data-tour="pos"]', titleKey: 'onboarding.step2Title' as TranslationKey, descKey: 'onboarding.step2Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  { selector: '[data-tour="dashboard"]', titleKey: 'onboarding.step7Title' as TranslationKey, descKey: 'onboarding.step7Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  { selector: '[data-tour="invoices"]', titleKey: 'onboarding.step9Title' as TranslationKey, descKey: 'onboarding.step9Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  { selector: '[data-tour="products"]', titleKey: 'onboarding.step10Title' as TranslationKey, descKey: 'onboarding.step10Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  { selector: '[data-tour="customers"]', titleKey: 'onboarding.step11Title' as TranslationKey, descKey: 'onboarding.step11Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  { selector: '[data-tour="expenses"]', titleKey: 'onboarding.step12Title' as TranslationKey, descKey: 'onboarding.step12Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  { selector: '[data-tour="reports"]', titleKey: 'onboarding.step13Title' as TranslationKey, descKey: 'onboarding.step13Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  { selector: '[data-tour="settings"]', titleKey: 'onboarding.step8Title' as TranslationKey, descKey: 'onboarding.step8Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  { selector: '[data-tour="product-grid"]', titleKey: 'onboarding.step3Title' as TranslationKey, descKey: 'onboarding.step3Desc' as TranslationKey, route: '/' },
  { selector: '[data-tour="search-bar"]', titleKey: 'onboarding.step4Title' as TranslationKey, descKey: 'onboarding.step4Desc' as TranslationKey, route: '/' },
  { selector: '[data-tour="cart-panel"]', titleKey: 'onboarding.step5Title' as TranslationKey, descKey: 'onboarding.step5Desc' as TranslationKey, desktopOnly: true, route: '/' },
  { selector: '[data-tour="cart-fab"]', titleKey: 'onboarding.step6Title' as TranslationKey, descKey: 'onboarding.step6Desc' as TranslationKey, mobileOnly: true, route: '/' },
  { selector: '[data-tour="cash-btn"]', titleKey: 'onboarding.step14Title' as TranslationKey, descKey: 'onboarding.step14Desc' as TranslationKey, route: '/', prefer: 'top', requireCart: true },
  { selector: '[data-tour="debt-btn"]', titleKey: 'onboarding.step15Title' as TranslationKey, descKey: 'onboarding.step15Desc' as TranslationKey, route: '/', prefer: 'top', requireCart: true },
  { selector: '[data-tour="action-btns"]', titleKey: 'onboarding.step16Title' as TranslationKey, descKey: 'onboarding.step16Desc' as TranslationKey, route: '/', prefer: 'top', requireCart: true },
];

// Check if two rects overlap
function rectsOverlap(a: { top: number; left: number; width: number; height: number }, b: DOMRect): boolean {
  return !(a.left + a.width < b.left || a.left > b.right || a.top + a.height < b.top || a.top > b.bottom);
}

export function OnboardingTour() {
  const { t, isRTL } = useLanguage();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const activeSteps = useMemo(() => tourSteps.filter(step => {
    if (step.mobileOnly && !isMobile) return false;
    if (step.desktopOnly && isMobile) return false;
    return true;
  }), [isMobile]);

  const activeStepsRef = useRef(activeSteps);
  activeStepsRef.current = activeSteps;

  useEffect(() => {
    if (!user || !role) return;
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      const timer = setTimeout(() => setIsActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, role]);

  const completeTour = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsActive(false);
  }, []);

  // Desktop: smart positioning with overlap detection
  const calculatePosition = useCallback((rect: DOMRect, prefer?: string) => {
    const gap = 12;
    const edgePad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = Math.min(CARD_WIDTH_DESKTOP, vw - edgePad * 2);
    const ch = cardRef.current?.offsetHeight || CARD_HEIGHT_ESTIMATE;

    const spaceBottom = vh - rect.bottom - gap;
    const spaceTop = rect.top - gap;
    const spaceRight = vw - rect.right - gap;
    const spaceLeft = rect.left - gap;

    type Candidate = { top: number; left: number };
    const candidates: Candidate[] = [];

    const centerH = Math.max(edgePad, Math.min(rect.left + rect.width / 2 - cw / 2, vw - cw - edgePad));
    const centerV = Math.max(edgePad, Math.min(rect.top + rect.height / 2 - ch / 2, vh - ch - edgePad));

    // Build candidate positions in priority order
    if (prefer === 'right' || prefer === 'left') {
      const preferSide = prefer === 'right' ? (isRTL ? 'left' : 'right') : (isRTL ? 'right' : 'left');
      if (preferSide === 'right' && spaceRight >= cw) candidates.push({ left: rect.right + gap, top: centerV });
      if (preferSide === 'left' && spaceLeft >= cw) candidates.push({ left: rect.left - cw - gap, top: centerV });
      // Fallback: opposite side
      if (preferSide === 'right' && spaceLeft >= cw) candidates.push({ left: rect.left - cw - gap, top: centerV });
      if (preferSide === 'left' && spaceRight >= cw) candidates.push({ left: rect.right + gap, top: centerV });
    }

    if (prefer === 'top' && spaceTop >= ch) candidates.push({ top: rect.top - ch - gap, left: centerH });
    if (spaceBottom >= ch) candidates.push({ top: rect.bottom + gap, left: centerH });
    if (spaceTop >= ch) candidates.push({ top: rect.top - ch - gap, left: centerH });
    if (spaceRight >= cw) candidates.push({ left: rect.right + gap, top: centerV });
    if (spaceLeft >= cw) candidates.push({ left: rect.left - cw - gap, top: centerV });

    // Pick first non-overlapping candidate
    for (const pos of candidates) {
      const clampedLeft = Math.max(edgePad, Math.min(pos.left, vw - cw - edgePad));
      const clampedTop = Math.max(edgePad, Math.min(pos.top, vh - ch - edgePad));
      if (!rectsOverlap({ top: clampedTop, left: clampedLeft, width: cw, height: ch }, rect)) {
        return { top: clampedTop, left: clampedLeft };
      }
    }

    // Ultimate fallback: center of screen
    return { top: vh / 2 - ch / 2, left: vw / 2 - cw / 2 };
  }, [isRTL]);

  const updatePosition = useCallback(() => {
    if (isMobile) return; // Mobile uses fixed bottom-sheet, no positioning needed

    const steps = activeStepsRef.current;
    const step = steps[currentStep];
    if (!step) return;

    const el = document.querySelector(step.selector);
    if (!el) {
      setTargetRect(null);
      setCardPosition({ top: window.innerHeight / 2 - 85, left: window.innerWidth / 2 - CARD_WIDTH_DESKTOP / 2 });
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    setCardPosition(calculatePosition(rect, step.prefer));
  }, [currentStep, calculatePosition, isMobile]);

  // Prepare environment for current step
  useEffect(() => {
    if (!isActive) return;

    setIsVisible(false);

    const steps = activeStepsRef.current;
    const step = steps[currentStep];
    if (!step) return;

    // Navigate if needed
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
    }

    // Pre-step hooks: manage sidebar & cart state
    if (step.requireSidebar && isMobile) {
      // Open sidebar on mobile - check if target is already visible
      const targetAlready = document.querySelector(step.selector);
      if (!targetAlready) {
        const menuBtn = document.querySelector('[data-tour="mobile-menu-trigger"]') as HTMLButtonElement;
        if (menuBtn) menuBtn.click();
      }
    } else if (!step.requireSidebar && isMobile) {
      // Close sidebar if it's currently open
      const sidebarAside = document.querySelector('aside[data-tour="sidebar"]');
      if (sidebarAside) {
        const isTranslated = sidebarAside.classList.contains('translate-x-0');
        if (isTranslated) {
          // Click the overlay backdrop to close
          const overlay = document.querySelector('.fixed.inset-0.bg-black\\/60') as HTMLElement;
          if (overlay) overlay.click();
        }
      }
    }

    if (step.requireCart && isMobile) {
      // Only click cart FAB if cart drawer isn't already open
      const cartDrawer = document.querySelector('[data-tour="cart-panel"]');
      if (!cartDrawer) {
        const cartFab = document.querySelector('[data-tour="cart-fab"]') as HTMLButtonElement;
        if (cartFab) cartFab.click();
      }
    }

    // Wait for layout to settle
    const settleDelay = step.requireSidebar ? 700 : step.requireCart ? 500 : 300;

    const timer = setTimeout(() => {
      // Polling: wait for target element to appear in DOM (max 2s)
      let attempts = 0;
      const maxAttempts = 20;
      const pollInterval = 100;

      const tryPosition = () => {
        const el = document.querySelector(step.selector);
        if (el) {
          // Scroll element into view - on mobile use 'start' to keep it above bottom-sheet
          el.scrollIntoView({ behavior: 'smooth', block: isMobile ? 'start' : 'center' });
          setTimeout(() => {
            const rect = el.getBoundingClientRect();
            setTargetRect(rect);
            if (!isMobile) {
              setCardPosition(calculatePosition(rect, step.prefer));
            }
            requestAnimationFrame(() => {
              if (!isMobile) updatePosition();
              setIsVisible(true);
            });
          }, 200);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryPosition, pollInterval);
        } else {
          // Element not found after polling - show card without spotlight
          if (!isMobile) updatePosition();
          setTargetRect(null);
          setIsVisible(true);
        }
      };
      tryPosition();
    }, settleDelay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isActive]);

  // Listen for resize/scroll (desktop only)
  useEffect(() => {
    if (!isActive || isMobile) return;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isActive, updatePosition, isMobile]);

  // Mobile: update targetRect on scroll for spotlight tracking
  useEffect(() => {
    if (!isActive || !isMobile) return;
    const updateMobileRect = () => {
      const steps = activeStepsRef.current;
      const step = steps[currentStep];
      if (!step) return;
      const el = document.querySelector(step.selector);
      if (el) setTargetRect(el.getBoundingClientRect());
    };
    window.addEventListener('scroll', updateMobileRect, true);
    return () => window.removeEventListener('scroll', updateMobileRect, true);
  }, [isActive, isMobile, currentStep]);

  const handleNext = () => {
    if (currentStep < activeSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isActive) return null;

  const step = activeSteps[currentStep];
  const stepText = (t('onboarding.stepOf' as TranslationKey) || 'Step {current} of {total}')
    .replace('{current}', String(currentStep + 1))
    .replace('{total}', String(activeSteps.length));

  // Shared card content
  const cardContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          <h3 className="font-bold text-[13px] text-foreground truncate">
            {t(step.titleKey)}
          </h3>
        </div>
        <button
          onClick={completeTour}
          className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Description */}
      <p className="px-3 pb-2 text-xs text-muted-foreground leading-relaxed">
        {t(step.descKey)}
      </p>

      {/* Progress dots */}
      <div className="px-3 pb-1.5">
        <div className="flex gap-0.5">
          {activeSteps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-[3px] rounded-full flex-1 transition-all duration-300",
                i <= currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
        <span className="text-[10px] text-muted-foreground">{stepText}</span>
        <div className="flex items-center gap-1.5">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="h-7 px-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center gap-0.5"
            >
              {isRTL ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
              {t('onboarding.previous' as TranslationKey)}
            </button>
          )}
          {currentStep === 0 && (
            <button
              onClick={completeTour}
              className="h-7 px-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              {t('onboarding.skip' as TranslationKey)}
            </button>
          )}
          <button
            onClick={handleNext}
            className="h-7 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-0.5"
          >
            {currentStep < activeSteps.length - 1 
              ? t('onboarding.next' as TranslationKey)
              : t('onboarding.finish' as TranslationKey)
            }
            {currentStep < activeSteps.length - 1 && (
              isRTL ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999]" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 4}
                y={targetRect.top - 4}
                width={targetRect.width + 8}
                height={targetRect.height + 8}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-mask)"
          style={{ pointerEvents: 'all' }}
          onClick={completeTour}
        />
      </svg>

      {/* Spotlight ring */}
      {targetRect && (
        <div
          className="absolute rounded-xl ring-2 ring-primary/50 pointer-events-none transition-all duration-500 ease-in-out"
          style={{
            left: targetRect.left - 4,
            top: targetRect.top - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 16px hsl(var(--primary) / 0.25)',
          }}
        />
      )}

      {/* Tour Card - MOBILE: fixed bottom-sheet */}
      {isMobile ? (
        <div
          ref={cardRef}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-[10000] bg-card border-t border-border rounded-t-2xl shadow-2xl",
            "transition-all duration-400 ease-in-out",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
          )}
          style={{ maxHeight: step.requireCart ? '22vh' : '28vh' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          {cardContent}
        </div>
      ) : (
        /* Tour Card - DESKTOP: floating positioned */
        <div
          ref={cardRef}
          className={cn(
            "absolute z-[10000] bg-card border border-border rounded-xl shadow-xl",
            "transition-all duration-500 ease-in-out",
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          )}
          style={{
            top: cardPosition.top,
            left: cardPosition.left,
            width: Math.min(CARD_WIDTH_DESKTOP, window.innerWidth - 16),
            maxWidth: '92vw',
          }}
        >
          {cardContent}
        </div>
      )}
    </div>,
    document.body
  );
}
