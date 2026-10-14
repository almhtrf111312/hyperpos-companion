import { useState, useEffect } from 'react';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, useSearchParams, useNavigate, useLocation, Outlet, Navigate } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { MainLayout } from "./components/layout/MainLayout";
import { NotificationsProvider } from "./hooks/use-notifications";
import { AuthProvider } from "./hooks/use-auth";
import { LanguageProvider } from "./hooks/use-language";
import { ThemeProvider } from "./hooks/use-theme";
import { LicenseProvider } from "./hooks/use-license";
import { UserRoleProvider } from "./hooks/use-user-role";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RoleGuard } from "./components/auth/RoleGuard";
import { ExitConfirmDialog } from "./components/ExitConfirmDialog";
import { SetupWizard } from "./components/setup/SetupWizard";
import { OnboardingTour } from "./components/onboarding/OnboardingTour";
import { useAuth } from "./hooks/use-auth";
import { useUserRole } from "./hooks/use-user-role";
import { Button } from "@/components/ui/button";
import { Loader2, Store, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { LicenseGuard } from "./components/license/LicenseGuard";
import { LicenseWarningBadge } from "./components/license/LicenseWarningBadge";
import { OfflineProtectionBanner } from "./components/license/OfflineProtectionBanner";
import { CloudSyncProvider } from "./providers/CloudSyncProvider";
import { clearDemoDataOnce } from "./lib/clear-demo-data";
import { checkSettingsVersion } from "./lib/settings-version";
import { EVENTS } from "./lib/events";
import { saveLastRoute } from "./lib/last-route";
// Demo data loading removed - app uses cloud sync for data persistence
import { ClickProbe } from "./components/debug/ClickProbe";
import { SafeModeScreen } from "./components/debug/SafeModeScreen";
import { useAppPermissions } from "./hooks/use-app-permissions";
import { PrivacyPolicyScreen, usePrivacyAccepted } from "./components/PrivacyPolicyScreen";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Debts from "./pages/Debts";
import Partners from "./pages/Partners";
import Settings from "./pages/Settings";
import Services from "./pages/Services";
import Invoices from "./pages/Invoices";
import InvoiceTracking from "./pages/InvoiceTracking";
import Reports from "./pages/Reports";
import Expenses from "./pages/Expenses";
import CashShifts from "./pages/CashShifts";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Purchases from "./pages/Purchases";
import Signup from "./pages/Signup";
import Appearance from "./pages/Appearance";
import NotFound from "./pages/NotFound";
import Help from "./pages/Help";
import ContactDeveloper from "./pages/ContactDeveloper";
import BossPanel from "./pages/BossPanel";
import LibraryMembers from "./pages/LibraryMembers";
import { WarehouseProvider } from "./hooks/use-warehouse";
import { useLicenseReminder } from "./hooks/use-license-reminder";
import { useDueExpensesChecker } from "./hooks/use-due-expenses-checker";
import { SmartToast } from '@/components/ui/SmartToast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

// Redirect components for merged routes
const DebtsRedirect = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate('/customers?tab=debts', { replace: true }); }, [navigate]);
  return null;
};
const PartnersRedirect = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate('/settings?tab=partners', { replace: true }); }, [navigate]);
  return null;
};

const IndexRoute = () => <POS />;

const AppContent = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Save last active route silently on navigation (used only on cold start restore)
  useEffect(() => {
    saveLastRoute(location.pathname + location.search);
  }, [location]);

  // تفريغ السلة وحالتها من التخزين عند تشغيل التطبيق بالكامل (Cold Start) لضمان بدء السلة مغلقة دائماً
  useEffect(() => {
    try {
      localStorage.removeItem('hyperpos_temp_cart');
      localStorage.removeItem('hyperpos_cart_open');
      sessionStorage.removeItem('hyperpos_cart_open');
      localStorage.removeItem('hyperpos_cart_customer');
      localStorage.removeItem('hyperpos_cart_discount');
    } catch (e) {
      console.warn('[App] Failed to clear cart storage on startup:', e);
    }
  }, []);

  const isSafeMode = searchParams.get('safe') === '1';
  const isDebugClick = searchParams.get('debugclick') === '1';
  const isReset = searchParams.get('reset') === '1';

  // Request camera and storage permissions early on native platforms
  useAppPermissions();

  // License expiration reminder toasts
  useLicenseReminder();

  // Privacy policy acceptance
  const { accepted: privacyAccepted, accept: acceptPrivacy } = usePrivacyAccepted();

  // Setup wizard state for fresh installations
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { role, isLoading: roleLoading, refreshRole } = useUserRole();

  // 🔔 فحص المصاريف المستحقة والدفع التلقائي عند بدء تشغيل التطبيق
  useDueExpensesChecker();

  const [setupComplete, setSetupComplete] = useState<boolean>(() => {
    try {
      // Prioritize new signup flag over existing device settings
      if (sessionStorage.getItem('hyperpos_just_signed_up') === 'true') {
        return localStorage.getItem('hyperpos_setup_complete') === 'true';
      }
      return localStorage.getItem('hyperpos_setup_complete') === 'true' || !!localStorage.getItem('hyperpos_settings_v1');
    } catch { return true; }
  });
  // Re-read flag whenever the user changes (after login/logout) or settings are updated
  useEffect(() => {
    const checkState = () => {
      try {
        const isNew = sessionStorage.getItem('hyperpos_just_signed_up') === 'true';
        if (isNew) {
          setSetupComplete(localStorage.getItem('hyperpos_setup_complete') === 'true');
        } else {
          setSetupComplete(localStorage.getItem('hyperpos_setup_complete') === 'true' || !!localStorage.getItem('hyperpos_settings_v1'));
        }
      } catch {}
    };
    checkState();
    window.addEventListener(EVENTS.SETTINGS_UPDATED, checkState);
    return () => window.removeEventListener(EVENTS.SETTINGS_UPDATED, checkState);
  }, [user?.id]);

  // Setup wizard state (can also be launched on demand from Settings or Help)
  const [manualShowSetup, setManualShowSetup] = useState(false);
  useEffect(() => {
    const handleOpenWizard = () => setManualShowSetup(true);
    window.addEventListener('hyperpos:open-setup-wizard', handleOpenWizard);
    return () => window.removeEventListener('hyperpos:open-setup-wizard', handleOpenWizard);
  }, []);

  // Handle reset mode
  useEffect(() => {
    if (isReset) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('hyperpos') || key === 'setup_complete')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('[App] Reset: cleared', keysToRemove.length, 'keys');
        window.location.href = '/';
      } catch (error) {
        console.error('[App] Reset failed:', error);
      }
    }
  }, [isReset]);

  // Clear any existing demo data on app start (one-time migration)
  useEffect(() => {
    if (isSafeMode) return;
    try {
      checkSettingsVersion();
      clearDemoDataOnce();
    } catch (error) {
      console.error('[App] Failed to initialize:', error);
    }
  }, [isSafeMode]);

  // ✅ Handle app restored result (camera data after app kill) - Native only
  useEffect(() => {
    // Only setup listener on native platforms
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: any = null;

    const setupListener = async () => {
      listenerHandle = await CapApp.addListener('appRestoredResult', (data) => {
        console.log('[App Restored] Plugin data received:', data);

        // Handle Camera plugin data
        if (data.pluginId === 'Camera' && data.data) {
          try {
            // Save pending camera result for components to pick up
            localStorage.setItem('pendingCameraResult', JSON.stringify(data.data));

            // Emit custom event for immediate handling
            window.dispatchEvent(new CustomEvent('camera-restored', {
              detail: data.data
            }));

            console.log('[App Restored] Camera data saved successfully');
          } catch (e) {
            console.error('[App Restored] Failed to save camera data:', e);
          }
        }

        // Handle Barcode Scanner plugin data (ML Kit pluginId = 'BarcodeScanner')
        if ((data.pluginId === 'BarcodeScanner' || data.pluginId === 'CapacitorBarcodeScanner') && data.data) {
          try {
            // Extract barcode from all possible result shapes
            let scanResult: string | null = null;
            const d = data.data as any;
            if (d?.barcodes?.[0]?.rawValue) {
              scanResult = d.barcodes[0].rawValue;
            } else if (d?.rawValue) {
              scanResult = d.rawValue;
            } else if (d?.ScanResult) {
              scanResult = d.ScanResult;
            } else if (d?.result) {
              scanResult = d.result;
            } else if (typeof d === 'string') {
              scanResult = d;
            }

            if (scanResult) {
              console.log('[App Restored] Barcode scan result:', scanResult);
              localStorage.setItem('hyperpos_pending_scan', scanResult);

              // Emit custom event for immediate handling
              window.dispatchEvent(new CustomEvent('barcode-restored', {
                detail: scanResult
              }));
            }
          } catch (e) {
            console.error('[App Restored] Failed to save barcode data:', e);
          }
        }
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []);

  // Safe Mode - minimal UI for testing
  if (isSafeMode) {
    return (
      <>
        {isDebugClick && <ClickProbe />}
        <SafeModeScreen />
      </>
    );
  }

  // Privacy policy check
  if (!privacyAccepted) {
    return <PrivacyPolicyScreen onAccept={acceptPrivacy} />;
  }

  // Show setup wizard on manual trigger (from Settings or Help)
  if (manualShowSetup) {
    return (
      <SetupWizard onComplete={() => {
        try {
          sessionStorage.removeItem('hyperpos_just_signed_up');
          localStorage.setItem('hyperpos_setup_complete', 'true');
        } catch {}
        setSetupComplete(true);
        setManualShowSetup(false);
      }} />
    );
  }

  // Handle new signup setup flow with explicit state guarding
  const isNewSignup = (() => {
    try {
      return sessionStorage.getItem('hyperpos_just_signed_up') === 'true';
    } catch { return false; }
  })();

  if (isNewSignup) {
    // 1. While auth state is resolving for new signup, show waiting screen
    if (authLoading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4" dir="rtl">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
              <Store className="w-7 h-7 text-primary" />
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>جاري تهيئة حسابك الجديد...</span>
            </div>
            <p className="text-xs text-muted-foreground">يرجى الانتظار لحظات لإعداد متجرك</p>
          </div>
        </div>
      );
    }

    // 2. If user is authenticated, handle role resolution and setup wizard guard
    if (user) {
      // 2a. Still determining user role -> display loading state, do NOT leak to main UI
      if (roleLoading) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4" dir="rtl">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                <Store className="w-7 h-7 text-primary" />
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>جاري التحقق من صلاحيات الحساب وتجهيز المعالج...</span>
              </div>
              <p className="text-xs text-muted-foreground">نقوم بتهيئة إعدادات المتجر المناسبة لصلاحياتك</p>
            </div>
          </div>
        );
      }

      // 2b. Role resolution failed -> display clear error state with retry / logout options
      if (!role) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4" dir="rtl">
            <div className="w-full max-w-sm bg-card border border-border shadow-xl rounded-2xl p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">تعذّر تحديد صلاحيات الحساب</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  لم نتمكن من التحقق من صلاحيات حسابك لتهيئة المتجر. يرجى التأكد من اتصال الإنترنت وإعادة المحاولة.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => refreshRole()}
                  className="w-full h-10 rounded-xl text-xs font-bold gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  إعادة المحاولة
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      sessionStorage.removeItem('hyperpos_just_signed_up');
                      await signOut();
                    } catch {}
                    window.location.hash = '#/login';
                  }}
                  className="w-full h-10 rounded-xl text-xs font-medium gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  الرجوع لتسجيل الدخول
                </Button>
              </div>
            </div>
          </div>
        );
      }

      // 2c. Role is cashier: Cashiers do not initialize a store
      if (role === 'cashier') {
        try {
          sessionStorage.removeItem('hyperpos_just_signed_up');
          localStorage.setItem('hyperpos_setup_complete', 'true');
        } catch {}
      } else if ((role === 'admin' || role === 'boss') && !setupComplete) {
        // 2d. Role is admin or boss and setup not yet complete -> display SetupWizard
        return (
          <SetupWizard onComplete={() => {
            try {
              sessionStorage.removeItem('hyperpos_just_signed_up');
              localStorage.setItem('hyperpos_setup_complete', 'true');
            } catch {}
            setSetupComplete(true);
            setManualShowSetup(false);
          }} />
        );
      }
    }
  }

  return (
    <>
      {isDebugClick && <ClickProbe />}
      <ExitConfirmDialog />
      {/* Global onboarding tour — persists across route changes */}
      {user && <OnboardingTour />}
      <Routes>

        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Full-screen protected routes (no MainLayout) */}
        <Route path="/" element={<ProtectedRoute><IndexRoute /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
        <Route path="/boss" element={<ProtectedRoute><RoleGuard allowedRoles={['boss']}><BossPanel /></RoleGuard></ProtectedRoute>} />

        {/* Protected routes wrapped by a single persistent MainLayout */}
        <Route element={<ProtectedRoute><MainLayout><Outlet /></MainLayout></ProtectedRoute>}>
          {/* Cashier accessible */}
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/*" element={<Customers />} />
          <Route path="/debts" element={<DebtsRedirect />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoice-tracking" element={<InvoiceTracking />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/*" element={<Services />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/cash-shifts" element={<CashShifts />} />
          <Route path="/appearance" element={<Appearance />} />
          <Route path="/library" element={<LibraryMembers />} />
          <Route path="/contact" element={<ContactDeveloper />} />

          {/* Admin/Boss only */}
          <Route path="/dashboard" element={<Navigate to="/reports" replace />} />
          <Route path="/products" element={<RoleGuard allowedRoles={['boss', 'admin']}><Products /></RoleGuard>} />
          <Route path="/products/*" element={<RoleGuard allowedRoles={['boss', 'admin']}><Products /></RoleGuard>} />
          <Route path="/purchases" element={<RoleGuard allowedRoles={['boss', 'admin']}><Purchases /></RoleGuard>} />
          <Route path="/partners" element={<RoleGuard allowedRoles={['boss', 'admin']}><PartnersRedirect /></RoleGuard>} />
          {/* FROZEN: warehouses & stock transfer disabled — redirect home */}
          <Route path="/warehouses" element={<Navigate to="/" replace />} />
          <Route path="/stock-transfer" element={<Navigate to="/" replace />} />
          <Route path="/reports" element={<RoleGuard allowedRoles={['boss', 'admin']}><Reports /></RoleGuard>} />
          <Route path="/settings" element={<RoleGuard allowedRoles={['boss', 'admin']}><Settings /></RoleGuard>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <HashRouter>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <CloudSyncProvider>
                <LicenseProvider>
                  <UserRoleProvider>
                    <WarehouseProvider>
                      <NotificationsProvider>
                        <Sonner />
                        <SmartToast />
                        {/* LicenseWarningBadge is OUTSIDE LicenseGuard so it always renders */}
                        <LicenseWarningBadge />
                        <OfflineProtectionBanner />
                        <LicenseGuard>
                          <AppContent />
                        </LicenseGuard>
                      </NotificationsProvider>
                    </WarehouseProvider>
                  </UserRoleProvider>
                </LicenseProvider>
              </CloudSyncProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
