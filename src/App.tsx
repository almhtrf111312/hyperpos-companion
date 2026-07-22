import { useState, useEffect } from 'react';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, useSearchParams, useNavigate, Outlet } from "react-router-dom";
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
import { LicenseGuard } from "./components/license/LicenseGuard";
import { LicenseWarningBadge } from "./components/license/LicenseWarningBadge";
import { OfflineProtectionBanner } from "./components/license/OfflineProtectionBanner";
import { CloudSyncProvider } from "./providers/CloudSyncProvider";
import { clearDemoDataOnce } from "./lib/clear-demo-data";
import { checkSettingsVersion } from "./lib/settings-version";
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
import Reports from "./pages/Reports";
import Expenses from "./pages/Expenses";
import CashShifts from "./pages/CashShifts";
import Warehouses from "./pages/Warehouses";
import StockTransfer from "./pages/StockTransfer";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Purchases from "./pages/Purchases";
import Signup from "./pages/Signup";
import Appearance from "./pages/Appearance";
import NotFound from "./pages/NotFound";
import Help from "./pages/Help";
import BossPanel from "./pages/BossPanel";
import LibraryMembers from "./pages/LibraryMembers";
import { WarehouseProvider } from "./hooks/use-warehouse";

const queryClient = new QueryClient();

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

const AppContent = () => {
  const [searchParams] = useSearchParams();
  const isSafeMode = searchParams.get('safe') === '1';
  const isDebugClick = searchParams.get('debugclick') === '1';
  const isReset = searchParams.get('reset') === '1';

  // Request camera and storage permissions early on native platforms
  useAppPermissions();

  // Privacy policy acceptance
  const { accepted: privacyAccepted, accept: acceptPrivacy } = usePrivacyAccepted();

  // Setup wizard shown to admin/boss on first login until completed
  const { user } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  const [setupComplete, setSetupComplete] = useState<boolean>(() => {
    try { return localStorage.getItem('hyperpos_setup_complete') === 'true'; } catch { return true; }
  });
  // Re-read flag whenever the user changes (after login/logout)
  useEffect(() => {
    try { setSetupComplete(localStorage.getItem('hyperpos_setup_complete') === 'true'); } catch {}
  }, [user?.id]);

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

  // Show setup wizard the first time an admin/boss logs in (cashiers skip it)
  const shouldShowSetup = !!user && !roleLoading && !setupComplete && (role === 'admin' || role === 'boss');
  if (shouldShowSetup) {
    return (
      <>
        <SetupWizard onComplete={() => setSetupComplete(true)} />
      </>
    );
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
        <Route path="/" element={<ProtectedRoute><POS /></ProtectedRoute>} />
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
          <Route path="/services" element={<Services />} />
          <Route path="/services/*" element={<Services />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/cash-shifts" element={<CashShifts />} />
          <Route path="/appearance" element={<Appearance />} />
          <Route path="/library" element={<LibraryMembers />} />

          {/* Admin/Boss only */}
          <Route path="/dashboard" element={<RoleGuard allowedRoles={['boss', 'admin']}><Dashboard /></RoleGuard>} />
          <Route path="/products" element={<RoleGuard allowedRoles={['boss', 'admin']}><Products /></RoleGuard>} />
          <Route path="/products/*" element={<RoleGuard allowedRoles={['boss', 'admin']}><Products /></RoleGuard>} />
          <Route path="/purchases" element={<RoleGuard allowedRoles={['boss', 'admin']}><Purchases /></RoleGuard>} />
          <Route path="/partners" element={<RoleGuard allowedRoles={['boss', 'admin']}><PartnersRedirect /></RoleGuard>} />
          <Route path="/warehouses" element={<RoleGuard allowedRoles={['boss', 'admin']}><Warehouses /></RoleGuard>} />
          <Route path="/stock-transfer" element={<RoleGuard allowedRoles={['boss', 'admin']}><StockTransfer /></RoleGuard>} />
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
