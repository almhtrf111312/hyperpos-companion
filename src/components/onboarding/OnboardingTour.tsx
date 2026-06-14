import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { cn } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

const ONBOARDING_KEY = 'hp_onboarding_complete';

const CARD_WIDTH_DESKTOP = 300;
const CARD_HEIGHT_ESTIMATE = 180;
const MOBILE_CARD_HEIGHT = 200; // approximate height of mobile bottom-sheet

type Lang = 'ar' | 'en';
type StepCopy = { ar: string; en: string };

interface TourStep {
  id: string;
  selector?: string;            // optional - if missing, centered welcome card
  title: StepCopy;
  desc: StepCopy;
  route?: string;               // navigate to this route before showing
  requireSidebar?: boolean;     // open sidebar on mobile before showing
  requireCart?: boolean;        // open cart drawer on mobile before showing
  mobileOnly?: boolean;
  desktopOnly?: boolean;
  adminOnly?: boolean;
  prefer?: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  // 0 — Welcome
  {
    id: 'welcome',
    title: { ar: 'مرحباً بك في FlowPOS Pro', en: 'Welcome to FlowPOS Pro' },
    desc: { ar: 'سنأخذك بجولة سريعة لاكتشاف أهم الميزات. يمكنك التخطي في أي وقت.', en: 'Quick tour of the most important features. You can skip anytime.' },
  },

  // 1 — Sidebar / Menu (mobile shows the trigger; desktop shows the sidebar)
  {
    id: 'menu-desktop',
    selector: '[data-tour="sidebar"]',
    title: { ar: 'القائمة الجانبية', en: 'Sidebar' },
    desc: { ar: 'كل أقسام التطبيق متاحة من هنا.', en: 'All sections of the app live here.' },
    desktopOnly: true,
    prefer: 'right',
  },
  {
    id: 'menu-mobile',
    selector: '[data-tour="mobile-menu-trigger"]',
    title: { ar: 'زر القائمة', en: 'Menu Button' },
    desc: { ar: 'اضغط هنا لفتح القائمة الجانبية والتنقل بين الأقسام.', en: 'Tap here to open the side menu.' },
    mobileOnly: true,
    prefer: 'bottom',
  },

  // 2 — All tabs (these require sidebar to be open)
  { id: 'pos', selector: '[data-tour="pos"]', title: { ar: 'نقطة البيع', en: 'POS' }, desc: { ar: 'الشاشة الرئيسية للبيع: أضف المنتجات إلى السلة وأتمم البيع.', en: 'Main sales screen: add to cart and complete the sale.' }, requireSidebar: true, prefer: 'right' },
  { id: 'dashboard', selector: '[data-tour="dashboard"]', title: { ar: 'لوحة التحكم', en: 'Dashboard' }, desc: { ar: 'إحصائيات المبيعات والأرباح والمنتجات الأكثر مبيعاً.', en: 'Sales, profit and top-product stats.' }, requireSidebar: true, adminOnly: true, prefer: 'right' },
  { id: 'invoices', selector: '[data-tour="invoices"]', title: { ar: 'الفواتير', en: 'Invoices' }, desc: { ar: 'كل الفواتير: عرض، طباعة، مشاركة، إرجاع.', en: 'All invoices: view, print, share, refund.' }, requireSidebar: true, prefer: 'right' },
  { id: 'products', selector: '[data-tour="products"]', title: { ar: 'المنتجات', en: 'Products' }, desc: { ar: 'إدارة المخزون: إضافة، تعديل، أسعار، باركود.', en: 'Manage inventory, prices and barcodes.' }, requireSidebar: true, adminOnly: true, prefer: 'right' },
  { id: 'purchases', selector: '[data-tour="purchases"]', title: { ar: 'المشتريات', en: 'Purchases' }, desc: { ar: 'فواتير شراء البضاعة من الموردين وتحديث المخزون.', en: 'Purchase invoices from suppliers, with stock updates.' }, requireSidebar: true, adminOnly: true, prefer: 'right' },
  { id: 'customers', selector: '[data-tour="customers"]', title: { ar: 'العملاء والديون', en: 'Customers & Debts' }, desc: { ar: 'بيانات العملاء ومتابعة الديون والمدفوعات.', en: 'Customer profiles, debts and payments.' }, requireSidebar: true, prefer: 'right' },
  { id: 'library', selector: '[data-tour="library"]', title: { ar: 'المكتبة', en: 'Library' }, desc: { ar: 'أعضاء المكتبة وإعارة الكتب (يظهر في وضع المكتبات).', en: 'Library members and book loans (bookstore mode).' }, requireSidebar: true, prefer: 'right' },
  { id: 'services', selector: '[data-tour="services"]', title: { ar: 'الصيانة', en: 'Maintenance' }, desc: { ar: 'تسجيل ومتابعة أوامر الصيانة والإصلاحات.', en: 'Track repair and maintenance orders.' }, requireSidebar: true, prefer: 'right' },
  { id: 'expenses', selector: '[data-tour="expenses"]', title: { ar: 'المصروفات', en: 'Expenses' }, desc: { ar: 'تسجيل المصاريف اليومية لحساب صافي الربح.', en: 'Track expenses to compute net profit.' }, requireSidebar: true, prefer: 'right' },
  { id: 'cash-shifts', selector: '[data-tour="cash-shifts"]', title: { ar: 'الورديات', en: 'Cash Shifts' }, desc: { ar: 'فتح/إغلاق الوردية وحساب الصندوق نهاية اليوم.', en: 'Open/close shifts and reconcile the cash box at end of day.' }, requireSidebar: true, prefer: 'right' },
  { id: 'warehouses', selector: '[data-tour="warehouses"]', title: { ar: 'المستودعات', en: 'Warehouses' }, desc: { ar: 'إدارة مخازن متعددة ومخازن الموزعين.', en: 'Manage multiple warehouses and distributor stores.' }, requireSidebar: true, adminOnly: true, prefer: 'right' },
  { id: 'stock-transfer', selector: '[data-tour="stock-transfer"]', title: { ar: 'تحويل العهدة', en: 'Stock Transfer' }, desc: { ar: 'نقل البضاعة بين المخازن مع إيصال استلام.', en: 'Move stock between warehouses with receipts.' }, requireSidebar: true, adminOnly: true, prefer: 'right' },
  { id: 'reports', selector: '[data-tour="reports"]', title: { ar: 'التقارير', en: 'Reports' }, desc: { ar: 'تقارير شاملة للمبيعات والأرباح والمخزون والديون.', en: 'Comprehensive sales, profit, inventory and debt reports.' }, requireSidebar: true, adminOnly: true, prefer: 'right' },
  { id: 'appearance', selector: '[data-tour="appearance"]', title: { ar: 'المظهر', en: 'Appearance' }, desc: { ar: 'تخصيص الألوان والثيم واللغة.', en: 'Customize colors, theme and language.' }, requireSidebar: true, prefer: 'right' },
  { id: 'settings', selector: '[data-tour="settings"]', title: { ar: 'الإعدادات', en: 'Settings' }, desc: { ar: 'كل إعدادات التطبيق: المتجر، المستخدمين، الطباعة، النسخ الاحتياطي.', en: 'All app settings: store, users, printing, backups.' }, requireSidebar: true, adminOnly: true, prefer: 'right' },

  // 3 — Inside POS
  { id: 'pos-search', selector: '[data-tour="search-bar"]', title: { ar: 'البحث والتصنيفات', en: 'Search & Categories' }, desc: { ar: 'ابحث عن المنتجات بالاسم أو الباركود أو حسب التصنيف.', en: 'Search products by name, barcode, or category.' }, route: '/' },
  { id: 'pos-grid', selector: '[data-tour="product-grid"]', title: { ar: 'شبكة المنتجات', en: 'Product Grid' }, desc: { ar: 'اضغط على أي منتج لإضافته إلى السلة.', en: 'Tap any product to add it to the cart.' }, route: '/' },
  { id: 'cart-desktop', selector: '[data-tour="cart-panel"]', title: { ar: 'سلة المشتريات', en: 'Cart' }, desc: { ar: 'السلة ومجاميعها وخيارات الدفع.', en: 'Cart, totals, and payment options.' }, desktopOnly: true, route: '/' },
  { id: 'cart-mobile', selector: '[data-tour="cart-fab"]', title: { ar: 'زر السلة', en: 'Cart Button' }, desc: { ar: 'اضغط هنا لفتح السلة على الجوال.', en: 'Tap to open the cart on mobile.' }, mobileOnly: true, route: '/' },
  { id: 'cash-btn', selector: '[data-tour="cash-btn"]', title: { ar: 'الدفع النقدي', en: 'Cash Payment' }, desc: { ar: 'تأكيد البيع نقداً وحفظ الفاتورة مباشرة.', en: 'Confirm a cash sale and save instantly.' }, route: '/', prefer: 'top', requireCart: true },
  { id: 'debt-btn', selector: '[data-tour="debt-btn"]', title: { ar: 'البيع بالدين', en: 'Sell on Credit' }, desc: { ar: 'تسجيل البيع كدين على العميل ومتابعته لاحقاً.', en: 'Record the sale as a customer debt to follow up later.' }, route: '/', prefer: 'top', requireCart: true },

  // Finish
  {
    id: 'done',
    title: { ar: 'انتهت الجولة 🎉', en: 'Tour complete 🎉' },
    desc: { ar: 'يمكنك إعادة الجولة في أي وقت من صفحة المساعدة.', en: 'You can replay this tour anytime from the Help page.' },
  },
];

function rectsOverlap(a: { top: number; left: number; width: number; height: number }, b: DOMRect): boolean {
  return !(a.left + a.width < b.left || a.left > b.right || a.top + a.height < b.top || a.top > b.bottom);
}

export function OnboardingTour() {
  const { language, isRTL } = useLanguage();
  const lang: Lang = language === 'en' ? 'en' : 'ar';
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

  const isAdminLike = role === 'admin' || role === 'boss';

  const activeSteps = useMemo(() => tourSteps.filter(step => {
    if (step.mobileOnly && !isMobile) return false;
    if (step.desktopOnly && isMobile) return false;
    if (step.adminOnly && !isAdminLike) return false;
    return true;
  }), [isMobile, isAdminLike]);

  const activeStepsRef = useRef(activeSteps);
  activeStepsRef.current = activeSteps;

  // Auto-start once user/role known and not completed
  useEffect(() => {
    if (!user || !role) return;
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      const timer = setTimeout(() => setIsActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, role]);

  // Listen for external replay request (from Help page)
  useEffect(() => {
    const onReplay = () => {
      setCurrentStep(0);
      setIsActive(true);
    };
    window.addEventListener('onboarding:replay', onReplay);
    return () => window.removeEventListener('onboarding:replay', onReplay);
  }, []);

  // Broadcast tour-active flag so MainLayout/Sidebar can keep sidebar open on mobile
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('onboarding:state', { detail: { active: isActive } }));
  }, [isActive]);

  const completeTour = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsActive(false);
    setCurrentStep(0);
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

    if (prefer === 'right' || prefer === 'left') {
      const preferSide = prefer === 'right' ? (isRTL ? 'left' : 'right') : (isRTL ? 'right' : 'left');
      if (preferSide === 'right' && spaceRight >= cw) candidates.push({ left: rect.right + gap, top: centerV });
      if (preferSide === 'left' && spaceLeft >= cw) candidates.push({ left: rect.left - cw - gap, top: centerV });
      if (preferSide === 'right' && spaceLeft >= cw) candidates.push({ left: rect.left - cw - gap, top: centerV });
      if (preferSide === 'left' && spaceRight >= cw) candidates.push({ left: rect.right + gap, top: centerV });
    }

    if (prefer === 'top' && spaceTop >= ch) candidates.push({ top: rect.top - ch - gap, left: centerH });
    if (spaceBottom >= ch) candidates.push({ top: rect.bottom + gap, left: centerH });
    if (spaceTop >= ch) candidates.push({ top: rect.top - ch - gap, left: centerH });
    if (spaceRight >= cw) candidates.push({ left: rect.right + gap, top: centerV });
    if (spaceLeft >= cw) candidates.push({ left: rect.left - cw - gap, top: centerV });

    for (const pos of candidates) {
      const clampedLeft = Math.max(edgePad, Math.min(pos.left, vw - cw - edgePad));
      const clampedTop = Math.max(edgePad, Math.min(pos.top, vh - ch - edgePad));
      if (!rectsOverlap({ top: clampedTop, left: clampedLeft, width: cw, height: ch }, rect)) {
        return { top: clampedTop, left: clampedLeft };
      }
    }

    return { top: vh / 2 - ch / 2, left: vw / 2 - cw / 2 };
  }, [isRTL]);

  // ----- helpers for sidebar/cart state on mobile -----

  const isSidebarOpen = useCallback(() => {
    const aside = document.querySelector('aside[data-tour="sidebar"]');
    if (!aside) return false;
    return aside.classList.contains('translate-x-0');
  }, []);

  const openSidebar = useCallback(() => {
    if (isSidebarOpen()) return;
    const btn = document.querySelector('[data-tour="mobile-menu-trigger"]') as HTMLButtonElement | null;
    btn?.click();
  }, [isSidebarOpen]);

  const closeSidebar = useCallback(() => {
    if (!isSidebarOpen()) return;
    const overlay = document.querySelector('.fixed.inset-0.bg-black\\/60') as HTMLElement | null;
    overlay?.click();
  }, [isSidebarOpen]);

  const isCartDrawerOpen = useCallback(() => {
    return !!document.querySelector('[data-tour="cart-panel"]');
  }, []);

  // Prepare environment + position for current step
  useEffect(() => {
    if (!isActive) return;

    setIsVisible(false);

    const steps = activeStepsRef.current;
    const step = steps[currentStep];
    if (!step) return;

    // Welcome / Done — centered card, no target
    if (!step.selector) {
      setTargetRect(null);
      setCardPosition({
        top: window.innerHeight / 2 - CARD_HEIGHT_ESTIMATE / 2,
        left: window.innerWidth / 2 - CARD_WIDTH_DESKTOP / 2,
      });
      const t = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(t);
    }

    // Navigate if route changes
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
    }

    // Mobile sidebar management
    if (isMobile) {
      if (step.requireSidebar) {
        openSidebar();
      } else if (!step.requireCart) {
        // For POS-grid/search/cart steps we want sidebar closed
        closeSidebar();
      }

      if (step.requireCart && !isCartDrawerOpen()) {
        // Need to close sidebar first, then open cart
        closeSidebar();
        setTimeout(() => {
          const fab = document.querySelector('[data-tour="cart-fab"]') as HTMLButtonElement | null;
          fab?.click();
        }, 250);
      }
    }

    const settleDelay = isMobile
      ? (step.requireSidebar ? 600 : step.requireCart ? 700 : 350)
      : (step.requireSidebar ? 400 : 250);

    const timer = setTimeout(() => {
      let attempts = 0;
      const maxAttempts = 25;
      const pollInterval = 100;

      const tryPosition = () => {
        const el = document.querySelector(step.selector!);
        if (el) {
          // Scroll into view; on mobile leave room for bottom-sheet
          try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch { /* noop */ }

          setTimeout(() => {
            const rect = el.getBoundingClientRect();

            // If on mobile and rect is hidden behind bottom-sheet, scroll up a bit
            if (isMobile && rect.bottom > window.innerHeight - MOBILE_CARD_HEIGHT - 20) {
              window.scrollBy({ top: rect.bottom - (window.innerHeight - MOBILE_CARD_HEIGHT - 20), behavior: 'smooth' });
              setTimeout(() => {
                const r2 = el.getBoundingClientRect();
                setTargetRect(r2);
                if (!isMobile) setCardPosition(calculatePosition(r2, step.prefer));
                setIsVisible(true);
              }, 250);
            } else {
              setTargetRect(rect);
              if (!isMobile) setCardPosition(calculatePosition(rect, step.prefer));
              setIsVisible(true);
            }
          }, 220);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryPosition, pollInterval);
        } else {
          // Skip step gracefully if not found
          setTargetRect(null);
          setIsVisible(true);
        }
      };
      tryPosition();
    }, settleDelay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isActive, isMobile]);

  // Reposition on resize/scroll
  useEffect(() => {
    if (!isActive) return;

    const updateRect = () => {
      const steps = activeStepsRef.current;
      const step = steps[currentStep];
      if (!step?.selector) return;
      const el = document.querySelector(step.selector);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      if (!isMobile) setCardPosition(calculatePosition(rect, step.prefer));
    };

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isActive, currentStep, calculatePosition, isMobile]);

  const handleNext = () => {
    if (currentStep < activeSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  if (!isActive) return null;

  const step = activeSteps[currentStep];
  if (!step) return null;

  const stepText = lang === 'ar'
    ? `خطوة ${currentStep + 1} من ${activeSteps.length}`
    : `Step ${currentStep + 1} of ${activeSteps.length}`;
  const nextLabel = currentStep < activeSteps.length - 1
    ? (lang === 'ar' ? 'التالي' : 'Next')
    : (lang === 'ar' ? 'إنهاء' : 'Finish');
  const prevLabel = lang === 'ar' ? 'السابق' : 'Previous';

  const cardContent = (
    <>
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          <h3 className="font-bold text-[13px] text-foreground truncate">
            {step.title[lang]}
          </h3>
        </div>
        <button
          onClick={completeTour}
          className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          aria-label="Close tour"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="px-3 pb-2 text-xs text-muted-foreground leading-relaxed">
        {step.desc[lang]}
      </p>

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

      <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
        <span className="text-[10px] text-muted-foreground">{stepText}</span>
        <div className="flex items-center gap-1.5">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="h-7 px-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center gap-0.5"
            >
              {isRTL ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
              {prevLabel}
            </button>
          )}
          <button
            onClick={handleNext}
            className="h-7 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-0.5"
          >
            {nextLabel}
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

      {/* MOBILE: bottom sheet */}
      {isMobile ? (
        <div
          ref={cardRef}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-[10000] bg-card border-t border-border rounded-t-2xl shadow-2xl",
            "transition-all duration-300 ease-in-out",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
          )}
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          {cardContent}
        </div>
      ) : (
        /* DESKTOP: floating positioned */
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
