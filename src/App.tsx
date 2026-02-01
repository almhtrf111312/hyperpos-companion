import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, useSearchParams } from "react-router-dom";
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
// SetupWizard removed - users go directly to login
import { LicenseGuard } from "./components/license/LicenseGuard";
import { LicenseWarningBadge } from "./components/license/LicenseWarningBadge";
import { CloudSyncProvider } from "./providers/CloudSyncProvider";
import { clearDemoDataOnce } from "./lib/clear-demo-data";
// Demo data loading removed - app uses cloud sync for data persistence
import { ClickProbe } from "./components/debug/ClickProbe";
import { SafeModeScreen } from "./components/debug/SafeModeScreen";
import { useAppPermissions } from "./hooks/use-app-permissions";
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
import Signup from "./pages/Signup";
import Appearance from "./pages/Appearance";
import NotFound from "./pages/NotFound";
import BossPanel from "./pages/BossPanel";
import { WarehouseProvider } from "./hooks/use-warehouse";

const queryClient = new QueryClient();

const AppContent = () => {
  const [searchParams] = useSearchParams();
  const isSafeMode = searchParams.get('safe') === '1';
  const isDebugClick = searchParams.get('debugclick') === '1';
  const isReset = searchParams.get('reset') === '1';

  // Request camera and storage permissions early on native platforms
  useAppPermissions();

  // Setup wizard removed - users go directly to login/signup
  // Settings can be configured from Settings page after login
  const [setupComplete] = useState(true);

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
      // Only clear demo data, don't load new ones
      // Demo data should not be loaded for production apps with cloud sync
      clearDemoDataOnce();
    } catch (error) {
      console.error('[App] Failed to clear demo data:', error);
    }
  }, [isSafeMode]);

  // ✅ Handle app restored result (camera data after app kill)
  useEffect(() => {
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

  // Setup wizard removed - directly show app content

  return (
    <>
      {isDebugClick && <ClickProbe />}
      <ExitConfirmDialog />
      <Toaster />
      <Sonner />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected routes - Cashier accessible */}
        <Route path="/" element={<ProtectedRoute><POS /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><MainLayout><Customers /></MainLayout></ProtectedRoute>} />
        <Route path="/customers/*" element={<ProtectedRoute><MainLayout><Customers /></MainLayout></ProtectedRoute>} />
        <Route path="/debts" element={<ProtectedRoute><MainLayout><Debts /></MainLayout></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><MainLayout><Invoices /></MainLayout></ProtectedRoute>} />
        <Route path="/services" element={<ProtectedRoute><MainLayout><Services /></MainLayout></ProtectedRoute>} />
        <Route path="/services/*" element={<ProtectedRoute><MainLayout><Services /></MainLayout></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><MainLayout><Expenses /></MainLayout></ProtectedRoute>} />
        <Route path="/cash-shifts" element={<ProtectedRoute><MainLayout><CashShifts /></MainLayout></ProtectedRoute>} />
        <Route path="/appearance" element={<ProtectedRoute><Appearance /></ProtectedRoute>} />

        {/* Protected routes - Admin/Boss only */}
        <Route path="/dashboard" element={<ProtectedRoute><RoleGuard allowedRoles={['boss', 'admin']}><MainLayout><Dashboard /></MainLayout></RoleGuard></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><RoleGuard allowedRoles={['boss', 'admin']}><MainLayout><Products /></MainLayout></RoleGuard></ProtectedRoute>} />
        <Route path="/products/*" element={<ProtectedRoute><RoleGuard allowedRoles={['boss', 'admin']}><MainLayout><Products /></MainLayout></RoleGuard></ProtectedRoute>} />
        <Route path="/partners" element={<ProtectedRoute><RoleGuard allowedRoles={['boss', 'admin']}><MainLayout><Partners /></MainLayout></RoleGuard></ProtectedRoute>} />
        <Route path="/warehouses" element={<ProtectedRoute><RoleGuard allowedRoles={['boss', 'admin']}><MainLayout><Warehouses /></MainLayout></RoleGuard></ProtectedRoute>} />
        <Route path="/stock-transfer" element={<ProtectedRoute><RoleGuard allowedRoles={['boss', 'admin']}><MainLayout><StockTransfer /></MainLayout></RoleGuard></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><RoleGuard allowedRoles={['boss', 'admin']}><MainLayout><Reports /></MainLayout></RoleGuard></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><RoleGuard allowedRoles={['boss', 'admin']}><MainLayout><Settings /></MainLayout></RoleGuard></ProtectedRoute>} />

        {/* Boss only routes */}
        <Route path="/boss" element={<ProtectedRoute><RoleGuard allowedRoles={['boss']}><BossPanel /></RoleGuard></ProtectedRoute>} />

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
                        {/* LicenseWarningBadge is OUTSIDE LicenseGuard so it always renders */}
                        <LicenseWarningBadge />
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
