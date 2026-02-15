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

const CARD_WIDTH_MOBILE = 260;
const CARD_WIDTH_DESKTOP = 280;
const CARD_HEIGHT_ESTIMATE = 170;

interface TourStep {
  selector: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  route?: string;
  requireSidebar?: boolean;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
  prefer?: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  // Sidebar overview
  { selector: '[data-tour="sidebar"]', titleKey: 'onboarding.step1Title' as TranslationKey, descKey: 'onboarding.step1Desc' as TranslationKey, desktopOnly: true, requireSidebar: true, prefer: 'right' },
  // POS nav
  { selector: '[data-tour="pos"]', titleKey: 'onboarding.step2Title' as TranslationKey, descKey: 'onboarding.step2Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  // Dashboard nav
  { selector: '[data-tour="dashboard"]', titleKey: 'onboarding.step7Title' as TranslationKey, descKey: 'onboarding.step7Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  // Invoices nav (new)
  { selector: '[data-tour="invoices"]', titleKey: 'onboarding.step9Title' as TranslationKey, descKey: 'onboarding.step9Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  // Products nav (new)
  { selector: '[data-tour="products"]', titleKey: 'onboarding.step10Title' as TranslationKey, descKey: 'onboarding.step10Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  // Customers nav (new)
  { selector: '[data-tour="customers"]', titleKey: 'onboarding.step11Title' as TranslationKey, descKey: 'onboarding.step11Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  // Expenses nav (new)
  { selector: '[data-tour="expenses"]', titleKey: 'onboarding.step12Title' as TranslationKey, descKey: 'onboarding.step12Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  // Reports nav (new)
  { selector: '[data-tour="reports"]', titleKey: 'onboarding.step13Title' as TranslationKey, descKey: 'onboarding.step13Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  // Settings nav
  { selector: '[data-tour="settings"]', titleKey: 'onboarding.step8Title' as TranslationKey, descKey: 'onboarding.step8Desc' as TranslationKey, requireSidebar: true, prefer: 'right' },
  // POS page steps
  { selector: '[data-tour="product-grid"]', titleKey: 'onboarding.step3Title' as TranslationKey, descKey: 'onboarding.step3Desc' as TranslationKey, route: '/' },
  { selector: '[data-tour="search-bar"]', titleKey: 'onboarding.step4Title' as TranslationKey, descKey: 'onboarding.step4Desc' as TranslationKey, route: '/' },
  { selector: '[data-tour="cart-panel"]', titleKey: 'onboarding.step5Title' as TranslationKey, descKey: 'onboarding.step5Desc' as TranslationKey, desktopOnly: true, route: '/' },
  { selector: '[data-tour="cart-fab"]', titleKey: 'onboarding.step6Title' as TranslationKey, descKey: 'onboarding.step6Desc' as TranslationKey, mobileOnly: true, route: '/' },
];

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

  const cardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH_DESKTOP;

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

  // Smart positioning: check all 4 directions, pick best
  const calculatePosition = useCallback((rect: DOMRect, prefer?: string) => {
    const gap = 12;
    const edgePad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = Math.min(cardWidth, vw - edgePad * 2);
    const ch = cardRef.current?.offsetHeight || CARD_HEIGHT_ESTIMATE;

    // Available space in each direction
    const spaceBottom = vh - rect.bottom - gap;
    const spaceTop = rect.top - gap;
    const spaceRight = vw - rect.right - gap;
    const spaceLeft = rect.left - gap;

    let top: number;
    let left: number;

    // For sidebar items, prefer beside (right/left)
    if (prefer === 'right' || prefer === 'left') {
      const preferSide = prefer === 'right' ? (isRTL ? 'left' : 'right') : (isRTL ? 'right' : 'left');
      
      if (preferSide === 'right' && spaceRight >= cw) {
        left = rect.right + gap;
        top = Math.max(edgePad, Math.min(rect.top + rect.height / 2 - ch / 2, vh - ch - edgePad));
      } else if (preferSide === 'left' && spaceLeft >= cw) {
        left = rect.left - cw - gap;
        top = Math.max(edgePad, Math.min(rect.top + rect.height / 2 - ch / 2, vh - ch - edgePad));
      } else if (spaceBottom >= ch) {
        top = rect.bottom + gap;
        left = Math.max(edgePad, Math.min(rect.left + rect.width / 2 - cw / 2, vw - cw - edgePad));
      } else if (spaceTop >= ch) {
        top = rect.top - ch - gap;
        left = Math.max(edgePad, Math.min(rect.left + rect.width / 2 - cw / 2, vw - cw - edgePad));
      } else {
        // Fallback: opposite side
        if (preferSide === 'right') {
          left = rect.left - cw - gap;
        } else {
          left = rect.right + gap;
        }
        top = Math.max(edgePad, Math.min(rect.top, vh - ch - edgePad));
      }
      left = Math.max(edgePad, Math.min(left, vw - cw - edgePad));
      return { top, left };
    }

    // Default: pick direction with most space
    if (prefer === 'top' && spaceTop >= ch) {
      top = rect.top - ch - gap;
      left = Math.max(edgePad, Math.min(rect.left + rect.width / 2 - cw / 2, vw - cw - edgePad));
    } else if (spaceBottom >= ch) {
      top = rect.bottom + gap;
      left = Math.max(edgePad, Math.min(rect.left + rect.width / 2 - cw / 2, vw - cw - edgePad));
    } else if (spaceTop >= ch) {
      top = rect.top - ch - gap;
      left = Math.max(edgePad, Math.min(rect.left + rect.width / 2 - cw / 2, vw - cw - edgePad));
    } else if (spaceRight >= cw) {
      left = rect.right + gap;
      top = Math.max(edgePad, Math.min(rect.top + rect.height / 2 - ch / 2, vh - ch - edgePad));
    } else if (spaceLeft >= cw) {
      left = rect.left - cw - gap;
      top = Math.max(edgePad, Math.min(rect.top + rect.height / 2 - ch / 2, vh - ch - edgePad));
    } else {
      top = vh / 2 - ch / 2;
      left = vw / 2 - cw / 2;
    }

    return { top, left };
  }, [isRTL, cardWidth]);

  const updatePosition = useCallback(() => {
    const steps = activeStepsRef.current;
    const step = steps[currentStep];
    if (!step) return;

    const el = document.querySelector(step.selector);
    if (!el) {
      setTargetRect(null);
      setCardPosition({ top: window.innerHeight / 2 - 85, left: window.innerWidth / 2 - cardWidth / 2 });
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    setCardPosition(calculatePosition(rect, step.prefer));
  }, [currentStep, calculatePosition, cardWidth]);

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

    // Open sidebar for sidebar-related steps (on mobile)
    if (step.requireSidebar && isMobile) {
      const menuBtn = document.querySelector('[data-tour="mobile-menu-trigger"]') as HTMLButtonElement;
      if (menuBtn) menuBtn.click();
    }

    // Wait for layout to settle, then position
    const timer = setTimeout(() => {
      let attempts = 0;
      const tryPosition = () => {
        const el = document.querySelector(step.selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          setTimeout(() => {
            updatePosition();
            requestAnimationFrame(() => {
              updatePosition();
              setIsVisible(true);
            });
          }, 120);
        } else if (attempts < 6) {
          attempts++;
          setTimeout(tryPosition, 200);
        } else {
          updatePosition();
          setIsVisible(true);
        }
      };
      tryPosition();
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isActive]);

  // Listen for resize/scroll
  useEffect(() => {
    if (!isActive) return;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isActive, updatePosition]);

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

      {/* Tour Card - compact */}
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
          width: Math.min(cardWidth, window.innerWidth - 16),
          maxWidth: '92vw',
        }}
      >
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
      </div>
    </div>,
    document.body
  );
}
