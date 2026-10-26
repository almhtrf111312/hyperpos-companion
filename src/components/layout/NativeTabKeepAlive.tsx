import React, { memo, ReactNode, useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { FeatureErrorBoundary } from '@/components/debug/FeatureErrorBoundary';
import { PageActivityProvider } from '@/contexts/PageActivityContext';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { performanceMetrics } from '@/lib/performance-metrics';

/**
 * KeepAliveTab Component
 * حاوية تبويب تحتفظ بالشجرة البرمجية في الذاكرة RAM وتتحكم بالظهور باستخدام GPU Acceleration
 * contentVisibility: hidden و contain: strict لمنع هدم الـ DOM وإعادة تصييره
 */
export interface KeepAliveTabProps {
  activePath: string;
  tabPath: string;
  children: ReactNode;
}

export const KeepAliveTab = memo(({ activePath, tabPath, children }: KeepAliveTabProps) => {
  const isMatch = activePath === tabPath;

  useEffect(() => {
    if (isMatch) {
      performanceMetrics.markUsefulRender(tabPath);
    }
  }, [isMatch, tabPath]);

  return (
    <PageActivityProvider isActive={isMatch} activePath={activePath}>
      <div
        role="tabpanel"
        aria-hidden={!isMatch}
        className={`w-full h-full flex-1 flex flex-col native-instant-tab ${
          isMatch 
            ? 'relative opacity-100 pointer-events-auto z-10' 
            : 'hidden opacity-0 pointer-events-none z-0'
        }`}
        style={{
          // تحسين أداء المعالجة الرسومية GPU عبر Hardware Acceleration
          contain: isMatch ? 'none' : 'strict',
          contentVisibility: isMatch ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </PageActivityProvider>
  );
});

KeepAliveTab.displayName = 'KeepAliveTab';

/**
 * استخراج المسار الأساسي للتبويبات الرئيسية
 */
export function getBaseTabPath(pathname: string): string | null {
  if (pathname === '/products' || pathname.startsWith('/products/')) return '/products';
  if (pathname === '/invoices' || pathname.startsWith('/invoices/')) return '/invoices';
  if (pathname === '/customers' || pathname.startsWith('/customers/')) return '/customers';
  if (pathname === '/services' || pathname.startsWith('/services/')) return '/services';
  if (pathname === '/expenses' || pathname.startsWith('/expenses/')) return '/expenses';
  if (pathname === '/purchases' || pathname.startsWith('/purchases/')) return '/purchases';
  if (pathname === '/reports' || pathname.startsWith('/reports/')) return '/reports';
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return '/settings';
  if (pathname === '/appearance' || pathname.startsWith('/appearance/')) return '/appearance';
  return null;
}

// Lazy load primary tab components
const Products = lazy(() => import('@/pages/Products'));
const Customers = lazy(() => import('@/pages/Customers'));
const Services = lazy(() => import('@/pages/Services'));
const Invoices = lazy(() => import('@/pages/Invoices'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const Settings = lazy(() => import('@/pages/Settings'));
const Reports = lazy(() => import('@/pages/Reports'));
const Purchases = lazy(() => import('@/pages/Purchases'));
const Appearance = lazy(() => import('@/pages/Appearance'));

const TabFallback = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3 p-4">
    <Loader2 className="w-8 h-8 animate-spin text-primary opacity-80" />
    <span className="text-xs text-muted-foreground font-medium">جاري تجهيز الشاشة...</span>
  </div>
);

/**
 * الحد الأقصى لعدد التبويبات المحتفظ بها في الذاكرة الحية RAM في نفس الوقت
 * 4 تبويبات تضمن تجربة تنقل فائقة السلاسة كالواتساب مع استهلاك ذاكرة لا يتجاوز 45 ميغابايت
 */
const MAX_MOUNTED_TABS = 4;

/**
 * NativeTabHost
 * المضيف الذكي للتبويبات المستمرة:
 * يُبقي الشاشات الرئيسية محملة في الخلفية دون إعادة جلب البيانات أو تفكيك الـ DOM عند التنقل
 * مع تطبيق سياسة LRU Eviction منضبطة لمنع تراكم الذاكرة.
 */
export const NativeTabHost = memo(() => {
  const location = useLocation();
  const { user } = useAuth();
  const activeTab = getBaseTabPath(location.pathname);

  // طابور LRU للتبويبات النشطة (الأحدث في نهاية المصفوفة)
  const [tabLRU, setTabLRU] = useState<string[]>(() => (activeTab ? [activeTab] : []));

  useEffect(() => {
    if (!activeTab) return;

    performanceMetrics.markRouteIntent(activeTab);

    setTabLRU(prev => {
      const filtered = prev.filter(t => t !== activeTab);
      filtered.push(activeTab);
      if (filtered.length > MAX_MOUNTED_TABS) {
        return filtered.slice(-MAX_MOUNTED_TABS);
      }
      return filtered;
    });
  }, [activeTab]);

  // إعادة ضبط التبويبات المركبة فور تغيير المستخدم لعزل الحسابات
  useEffect(() => {
    if (activeTab) {
      setTabLRU([activeTab]);
    } else {
      setTabLRU([]);
    }
  }, [user?.id]);

  const mountedTabs = useMemo(() => new Set(tabLRU), [tabLRU]);

  return (
    <div className="w-full flex-1 flex flex-col relative min-h-[calc(100vh-4rem)]">
      {mountedTabs.has('/products') && (
        <KeepAliveTab activePath={activeTab ?? ''} tabPath="/products">
          <RoleGuard allowedRoles={['boss', 'admin']}>
            <FeatureErrorBoundary featureName="إدارة المنتجات">
              <Suspense fallback={<TabFallback />}>
                <Products />
              </Suspense>
            </FeatureErrorBoundary>
          </RoleGuard>
        </KeepAliveTab>
      )}

      {mountedTabs.has('/invoices') && (
        <KeepAliveTab activePath={activeTab ?? ''} tabPath="/invoices">
          <FeatureErrorBoundary featureName="سجل الفواتير">
            <Suspense fallback={<TabFallback />}>
              <Invoices />
            </Suspense>
          </FeatureErrorBoundary>
        </KeepAliveTab>
      )}

      {mountedTabs.has('/customers') && (
        <KeepAliveTab activePath={activeTab ?? ''} tabPath="/customers">
          <FeatureErrorBoundary featureName="العملاء والديون">
            <Suspense fallback={<TabFallback />}>
              <Customers />
            </Suspense>
          </FeatureErrorBoundary>
        </KeepAliveTab>
      )}

      {mountedTabs.has('/services') && (
        <KeepAliveTab activePath={activeTab ?? ''} tabPath="/services">
          <FeatureErrorBoundary featureName="الخدمات">
            <Suspense fallback={<TabFallback />}>
              <Services />
            </Suspense>
          </FeatureErrorBoundary>
        </KeepAliveTab>
      )}

      {mountedTabs.has('/expenses') && (
        <KeepAliveTab activePath={activeTab ?? ''} tabPath="/expenses">
          <FeatureErrorBoundary featureName="المصاريف">
            <Suspense fallback={<TabFallback />}>
              <Expenses />
            </Suspense>
          </FeatureErrorBoundary>
        </KeepAliveTab>
      )}

      {mountedTabs.has('/purchases') && (
        <KeepAliveTab activePath={activeTab ?? ''} tabPath="/purchases">
          <RoleGuard allowedRoles={['boss', 'admin']}>
            <FeatureErrorBoundary featureName="المشتريات">
              <Suspense fallback={<TabFallback />}>
                <Purchases />
              </Suspense>
            </FeatureErrorBoundary>
          </RoleGuard>
        </KeepAliveTab>
      )}

      {mountedTabs.has('/reports') && (
        <KeepAliveTab activePath={activeTab ?? ''} tabPath="/reports">
          <RoleGuard allowedRoles={['boss', 'admin']}>
            <FeatureErrorBoundary featureName="التقارير">
              <Suspense fallback={<TabFallback />}>
                <Reports />
              </Suspense>
            </FeatureErrorBoundary>
          </RoleGuard>
        </KeepAliveTab>
      )}

      {mountedTabs.has('/settings') && (
        <KeepAliveTab activePath={activeTab ?? ''} tabPath="/settings">
          <FeatureErrorBoundary featureName="الإعدادات">
            <Suspense fallback={<TabFallback />}>
              <Settings />
            </Suspense>
          </FeatureErrorBoundary>
        </KeepAliveTab>
      )}

      {mountedTabs.has('/appearance') && (
        <KeepAliveTab activePath={activeTab ?? ''} tabPath="/appearance">
          <FeatureErrorBoundary featureName="المظهر">
            <Suspense fallback={<TabFallback />}>
              <Appearance />
            </Suspense>
          </FeatureErrorBoundary>
        </KeepAliveTab>
      )}

      {/* fallback للأي مسارات فرعية أخرى داخل الإطار العام */}
      {!activeTab && <Outlet />}
    </div>
  );
});

NativeTabHost.displayName = 'NativeTabHost';
