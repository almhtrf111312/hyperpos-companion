import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { NotificationsProvider } from "./hooks/use-notifications";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Debts from "./pages/Debts";
import Partners from "./pages/Partners";
import Settings from "./pages/Settings";
import Services from "./pages/Services";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <NotificationsProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<MainLayout><Dashboard /></MainLayout>} />
            <Route path="/pos" element={<POS />} />
            <Route path="/products" element={<MainLayout><Products /></MainLayout>} />
            <Route path="/products/*" element={<MainLayout><Products /></MainLayout>} />
            <Route path="/customers" element={<MainLayout><Customers /></MainLayout>} />
            <Route path="/customers/*" element={<MainLayout><Customers /></MainLayout>} />
            <Route path="/debts" element={<MainLayout><Debts /></MainLayout>} />
            <Route path="/services" element={<MainLayout><Services /></MainLayout>} />
            <Route path="/services/*" element={<MainLayout><Services /></MainLayout>} />
            <Route path="/partners" element={<MainLayout><Partners /></MainLayout>} />
            <Route path="/reports" element={<MainLayout><Reports /></MainLayout>} />
            <Route path="/settings" element={<MainLayout><Settings /></MainLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </NotificationsProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
