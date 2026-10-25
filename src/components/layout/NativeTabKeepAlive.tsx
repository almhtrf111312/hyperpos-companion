import React, { memo, ReactNode, useState, useEffect, lazy, Suspense } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { FeatureErrorBoundary } from '@/components/debug/FeatureErrorBoundary';
import { Loader2 } from 'lucide-react';

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

  return (
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
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
    <span className="text-xs text-muted-foreground font-medium">جاري تجهيز الصفحة...</span>
  </div>
);

/**
 * NativeTabHost Component
 * يدير التبويبات الرئيسية ويبقيها في الذاكرة بمجرد زيارتها
 * مع تمرير المسارات الفرعية أو غير التبويبية إلى Outlet
 */
export function NativeTabHost() {
  const location = useLocation();
  const activeTab = getBaseTabPath(location.pathname);

  // تتبع التبويبات التي تمت زيارتها فقط لعدم حجز ذاكرة لصفحات لم يدخلها المستخدم بعد
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (activeTab) initial.add(activeTab);
    return initial;
  });

  useEffect(() => {
    if (activeTab) {
      setMountedTabs(prev => {
        if (prev.has(activeTab)) return prev;
        const next = new Set(prev);
        next.add(activeTab);
        return next;
      });
    }
  }, [activeTab]);

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
            <FeatureErrorBoundary featureName="فواتير الشراء">
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
          <RoleGuard allowedRoles={['boss', 'admin']}>
            <FeatureErrorBoundary featureName="الإعدادات">
              <Suspense fallback={<TabFallback />}>
                <Settings />
              </Suspense>
            </FeatureErrorBoundary>
          </RoleGuard>
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

      {/* المسارات غير المحفوظة في التبويبات مثل ورديات الصندوق والمكتبة يتم عرضها عبر Outlet */}
      {!activeTab && <Outlet />}
    </div>
  );
}
