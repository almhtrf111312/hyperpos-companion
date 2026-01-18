import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { NotificationsProvider } from "./hooks/use-notifications";
import { AuthProvider } from "./hooks/use-auth";
import { LanguageProvider } from "./hooks/use-language";
import { ThemeProvider } from "./hooks/use-theme";
import { LicenseProvider } from "./hooks/use-license";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ExitConfirmDialog } from "./components/ExitConfirmDialog";
import { SetupWizard } from "./components/setup/SetupWizard";
import { LicenseGuard } from "./components/license/LicenseGuard";
import { clearDemoDataOnce } from "./lib/clear-demo-data";
import { loadDemoData } from "./lib/demo-data";
import { ClickProbe } from "./components/debug/ClickProbe";
import { SafeModeScreen } from "./components/debug/SafeModeScreen";
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
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const [searchParams] = useSearchParams();
  const isSafeMode = searchParams.get('safe') === '1';
  const isDebugClick = searchParams.get('debugclick') === '1';
  const isReset = searchParams.get('reset') === '1';

  const [setupComplete, setSetupComplete] = useState(() => {
    try {
      return localStorage.getItem('hyperpos_setup_complete') === 'true';
    } catch {
      return false;
    }
  });

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

  // Safe demo data loading inside React lifecycle
  useEffect(() => {
    if (isSafeMode) return; // Don't load demo data in safe mode
    try {
      clearDemoDataOnce();
      loadDemoData();
    } catch (error) {
      console.error('[App] Failed to initialize demo data:', error);
    }
  }, [isSafeMode]);

  // Safe Mode - minimal UI for testing
  if (isSafeMode) {
    return (
      <>
        {isDebugClick && <ClickProbe />}
        <SafeModeScreen />
      </>
    );
  }

  if (!setupComplete) {
    return (
      <>
        {isDebugClick && <ClickProbe />}
        <SetupWizard onComplete={() => setSetupComplete(true)} />
      </>
    );
  }

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
        
        {/* Protected routes - All authenticated users */}
        <Route path="/" element={<ProtectedRoute><POS /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><MainLayout><Products /></MainLayout></ProtectedRoute>} />
        <Route path="/products/*" element={<ProtectedRoute><MainLayout><Products /></MainLayout></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><MainLayout><Customers /></MainLayout></ProtectedRoute>} />
        <Route path="/customers/*" element={<ProtectedRoute><MainLayout><Customers /></MainLayout></ProtectedRoute>} />
        <Route path="/debts" element={<ProtectedRoute><MainLayout><Debts /></MainLayout></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><MainLayout><Invoices /></MainLayout></ProtectedRoute>} />
        <Route path="/services" element={<ProtectedRoute><MainLayout><Services /></MainLayout></ProtectedRoute>} />
        <Route path="/services/*" element={<ProtectedRoute><MainLayout><Services /></MainLayout></ProtectedRoute>} />
        <Route path="/partners" element={<ProtectedRoute><MainLayout><Partners /></MainLayout></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><MainLayout><Expenses /></MainLayout></ProtectedRoute>} />
        <Route path="/cash-shifts" element={<ProtectedRoute><MainLayout><CashShifts /></MainLayout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><MainLayout><Reports /></MainLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><MainLayout><Settings /></MainLayout></ProtectedRoute>} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <LicenseProvider>
                <NotificationsProvider>
                  <LicenseGuard>
                    <AppContent />
                  </LicenseGuard>
                </NotificationsProvider>
              </LicenseProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
