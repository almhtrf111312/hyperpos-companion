import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { cn } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { TranslationKey } from '@/lib/i18n';

const ONBOARDING_KEY = 'hp_onboarding_complete';

// Fixed card dimensions for stable positioning
const CARD_WIDTH = 320;
const CARD_HEIGHT_ESTIMATE = 200;

interface TourStep {
  selector: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

const tourSteps: TourStep[] = [
  { selector: '[data-tour="sidebar"]', titleKey: 'onboarding.step1Title' as TranslationKey, descKey: 'onboarding.step1Desc' as TranslationKey, desktopOnly: true },
  { selector: '[data-tour="pos"]', titleKey: 'onboarding.step2Title' as TranslationKey, descKey: 'onboarding.step2Desc' as TranslationKey },
  { selector: '[data-tour="product-grid"]', titleKey: 'onboarding.step3Title' as TranslationKey, descKey: 'onboarding.step3Desc' as TranslationKey },
  { selector: '[data-tour="search-bar"]', titleKey: 'onboarding.step4Title' as TranslationKey, descKey: 'onboarding.step4Desc' as TranslationKey },
  { selector: '[data-tour="cart-panel"]', titleKey: 'onboarding.step5Title' as TranslationKey, descKey: 'onboarding.step5Desc' as TranslationKey, desktopOnly: true },
  { selector: '[data-tour="cart-fab"]', titleKey: 'onboarding.step6Title' as TranslationKey, descKey: 'onboarding.step6Desc' as TranslationKey, mobileOnly: true },
  { selector: '[data-tour="dashboard"]', titleKey: 'onboarding.step7Title' as TranslationKey, descKey: 'onboarding.step7Desc' as TranslationKey },
  { selector: '[data-tour="settings"]', titleKey: 'onboarding.step8Title' as TranslationKey, descKey: 'onboarding.step8Desc' as TranslationKey },
];

export function OnboardingTour() {
  const { t, isRTL } = useLanguage();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { role } = useUserRole();
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

  // Calculate position without depending on card ref (use fixed estimates first, then refine)
  const calculatePosition = useCallback((rect: DOMRect) => {
    const padding = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardW = Math.min(CARD_WIDTH, vw * 0.9);
    
    // Use actual card height if available, else estimate
    const cardH = cardRef.current?.offsetHeight || CARD_HEIGHT_ESTIMATE;

    let top: number;
    let left: number;

    // Try bottom
    if (rect.bottom + padding + cardH < vh) {
      top = rect.bottom + padding;
      left = Math.max(padding, Math.min(rect.left + rect.width / 2 - cardW / 2, vw - cardW - padding));
    }
    // Try top
    else if (rect.top - padding - cardH > 0) {
      top = rect.top - padding - cardH;
      left = Math.max(padding, Math.min(rect.left + rect.width / 2 - cardW / 2, vw - cardW - padding));
    }
    // Fallback: center
    else {
      top = vh / 2 - cardH / 2;
      left = vw / 2 - cardW / 2;
    }

    return { top, left };
  }, []);

  const updatePosition = useCallback(() => {
    const steps = activeStepsRef.current;
    const step = steps[currentStep];
    if (!step) return;

    const el = document.querySelector(step.selector);
    if (!el) {
      setTargetRect(null);
      setCardPosition({ top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 160 });
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    setCardPosition(calculatePosition(rect));
  }, [currentStep, calculatePosition]);

  // On step change: hide briefly, reposition, then show
  useEffect(() => {
    if (!isActive) return;
    
    setIsVisible(false);
    
    const steps = activeStepsRef.current;
    const step = steps[currentStep];
    if (!step) return;
    
    const el = document.querySelector(step.selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const timer = setTimeout(() => {
      updatePosition();
      requestAnimationFrame(() => {
        updatePosition();
        setIsVisible(true);
      });
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
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#spotlight-mask)"
          style={{ pointerEvents: 'all' }}
          onClick={completeTour}
        />
      </svg>

      {/* Spotlight ring glow */}
      {targetRect && (
        <div
          className="absolute rounded-xl ring-2 ring-primary/60 shadow-[0_0_20px_rgba(var(--primary),0.3)] pointer-events-none transition-all duration-400 ease-out"
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Tour Card - uses opacity for smooth show/hide instead of position jumping */}
      <div
        ref={cardRef}
        className={cn(
          "absolute z-[10000] w-[320px] max-w-[90vw] bg-card border border-border rounded-2xl shadow-2xl",
          "transition-[opacity,transform] duration-300 ease-out",
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{ top: cardPosition.top, left: cardPosition.left }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-bold text-base text-foreground">
              {t(step.titleKey)}
            </h3>
          </div>
          <button
            onClick={completeTour}
            className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <p className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed">
          {t(step.descKey)}
        </p>

        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div className="flex gap-1">
            {activeSteps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full flex-1 transition-all duration-300",
                  i <= currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 pt-2">
          <span className="text-xs text-muted-foreground">{stepText}</span>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="h-8 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1"
              >
                {isRTL ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                {t('onboarding.previous' as TranslationKey)}
              </button>
            )}
            {currentStep === 0 && (
              <button
                onClick={completeTour}
                className="h-8 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {t('onboarding.skip' as TranslationKey)}
              </button>
            )}
            <button
              onClick={handleNext}
              className="h-8 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
            >
              {currentStep < activeSteps.length - 1 
                ? t('onboarding.next' as TranslationKey)
                : t('onboarding.finish' as TranslationKey)
              }
              {currentStep < activeSteps.length - 1 && (
                isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
