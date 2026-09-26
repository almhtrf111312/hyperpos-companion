import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  UsersRound,
  Calendar,
  Download,
  FileText,
  PieChart,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Wallet,
  Banknote,
  Receipt,
  MessageCircle,
  ClipboardList,
  Truck,
  Loader2,
  Package,
  Activity,
  PackageSearch,
  Search,
  Filter,
  Sun,
  Moon,
  Menu,
  Flame,
  X,
  FileSpreadsheet,
  Clock,
  ShoppingBag,
  Coins,
  Lock,
  UserCheck,
  ClipboardCheck,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import { toLocalDateString, isDateInRange } from '@/lib/date-utils';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/use-theme';
import { loadInvoicesCloud, Invoice } from '@/lib/cloud/invoices-cloud';
import { loadProductsCloud, Product } from '@/lib/cloud/products-cloud';
import { loadCustomersCloud, Customer } from '@/lib/cloud/customers-cloud';
import { loadPartnersCloud, Partner } from '@/lib/cloud/partners-cloud';
import { loadCategoriesCloud, Category } from '@/lib/cloud/categories-cloud';
import { loadExpensesCloud, Expense } from '@/lib/cloud/expenses-cloud';
import { loadDebtsCloud, Debt } from '@/lib/cloud/debts-cloud';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PartnerProfitDetailedReport } from '@/components/reports/PartnerProfitDetailedReport';
import { ProfitTrendChart } from '@/components/reports/ProfitTrendChart';
import { DistributorInventoryReport } from '@/components/reports/DistributorInventoryReport';
import { DistributorCustodyValueReport } from '@/components/reports/DistributorCustodyValueReport';
import { PurchaseInvoicesReport } from '@/components/reports/PurchaseInvoicesReport';
import { DebtsReport } from '@/components/reports/DebtsReport';
import { CashierPerformanceReport } from '@/components/reports/CashierPerformanceReport';
import { MaintenanceReport } from '@/components/reports/MaintenanceReport';
import { DailyClosingReport } from '@/components/reports/DailyClosingReport';
import { LibraryReport } from '@/components/reports/LibraryReport';
import { downloadJSON } from '@/lib/file-download';
import { loadPurchaseInvoicesCloud } from '@/lib/cloud/purchase-invoices-cloud';
import {
  exportInvoicesToExcel,
  exportProductsToExcel,
  exportExpensesToExcel,
  exportPartnersToExcel,
  exportCustomersToExcel,
  exportSalesReportToExcel,
  exportToExcel,
} from '@/lib/excel-export';
import {
  exportInvoicesToPDF,
  exportProductsToPDF,
  exportExpensesToPDF,
  exportPartnersToPDF,
  exportCustomersToPDF,
  exportToPDF,
} from '@/lib/pdf-export';
import { useLanguage } from '@/hooks/use-language';
import { MainLayout } from '@/components/layout/MainLayout';
import { EVENTS } from '@/lib/events';
import { getCurrentStoreType, getVisibleSections, isNoInventoryMode } from '@/lib/store-type-config';
import { ReportFiltersBar, ReportFilters } from '@/components/reports/ReportFiltersBar';
import { ReportToolbar } from '@/components/reports/ReportToolbar';
import { ProductMovementReport } from '@/components/reports/ProductMovementReport';
import { InventoryStockReport } from '@/components/reports/InventoryStockReport';
import { InventoryValueReport } from '@/components/reports/InventoryValueReport';
import { TopProductsReport } from '@/components/reports/TopProductsReport';
import { SalesDetailedReport } from '@/components/reports/SalesDetailedReport';
import { StockDiscrepancyReport } from '@/components/reports/StockDiscrepancyReport';

export default function Reports() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const storeType = getCurrentStoreType();
  const noInventory = isNoInventoryMode();
  const visibleSections = getVisibleSections(storeType);

  const { mode, setMode } = useTheme();
  const [activeReport, setActiveReport] = useState('sales');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [salesViewMode, setSalesViewMode] = useState<'summary' | 'detailed'>('summary');
  const [viewTab, setViewTab] = useState<'summary' | 'detailed' | 'comprehensive'>('summary');
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('month');
  const [isAllReportsModalOpen, setIsAllReportsModalOpen] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [stockViewMode, setStockViewMode] = useState<'audit' | 'discrepancy'>('audit');
  const [isLoading, setIsLoading] = useState(true);

  // Unified filters state
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0],
    },
    search: '',
    status: 'all',
    cashierId: 'all',
    warehouseId: 'all',
    category: 'all',
    paymentType: 'all',
  });

  const dateRange = filters.dateRange;

  const handleDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setFilters(prev => ({ ...prev, dateRange: { from: todayStr, to: todayStr } }));
    } else if (preset === 'yesterday') {
      const y = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const yStr = y.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, dateRange: { from: yStr, to: yStr } }));
    } else if (preset === 'week') {
      const w = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const wStr = w.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, dateRange: { from: wStr, to: todayStr } }));
    } else if (preset === 'month') {
      const m = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const mStr = m.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, dateRange: { from: mStr, to: todayStr } }));
    } else if (preset === 'custom') {
      setShowCustomDateModal(true);
    }
  };

  // Cloud data state
  const [cloudInvoices, setCloudInvoices] = useState<Invoice[]>([]);
  const [cloudProducts, setCloudProducts] = useState<Product[]>([]);
  const [cloudCustomers, setCloudCustomers] = useState<Customer[]>([]);
  const [cloudPartners, setCloudPartners] = useState<Partner[]>([]);
  const [cloudCategories, setCloudCategories] = useState<Category[]>([]);
  const [cloudExpenses, setCloudExpenses] = useState<Expense[]>([]);
  const [cloudDebts, setCloudDebts] = useState<Debt[]>([]);

  const loadCloudData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      // Local-first products pre-population for instant 0ms report calculations
      if (cloudProducts.length === 0) {
        try {
          const { loadProductsLocalFirst } = await import('@/lib/cloud/products-cloud');
          const localProds = await loadProductsLocalFirst();
          if (localProds && localProds.length > 0) setCloudProducts(localProds);
        } catch {
          // ignore local load error
        }
      }

      const [invoices, products, customers, partners, categories, expenses, debts] = await Promise.all([
        loadInvoicesCloud(),
        loadProductsCloud(),
        loadCustomersCloud(),
        loadPartnersCloud(),
        loadCategoriesCloud(),
        loadExpensesCloud(),
        loadDebtsCloud()
      ]);
      setCloudInvoices(invoices);
      setCloudProducts(products);
      setCloudCustomers(customers);
      setCloudPartners(partners);
      setCloudCategories(categories);
      setCloudExpenses(expenses);
      setCloudDebts(debts);
    } catch (error) {
      console.error('Error loading cloud data for reports:', error);
      if (!isSilent) toast.error(t('reports.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t, cloudProducts.length]);

  useEffect(() => {
    loadCloudData();
    const handleUpdate = () => loadCloudData(true);
    window.addEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.PRODUCTS_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.CUSTOMERS_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.PARTNERS_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.CATEGORIES_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
    return () => {
      window.removeEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.CUSTOMERS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.PARTNERS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.CATEGORIES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
    };
  }, [loadCloudData]);

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
  const isDistributorStore = storeType === 'phones';

  // Report Categories for modern, organized accounting navigation
  const REPORT_CATEGORIES = useMemo(() => [
    { id: 'sales', label: 'المبيعات والأرباح', icon: ShoppingCart },
    { id: 'inventory', label: 'المخزون والجرد', icon: Package },
    { id: 'purchases', label: 'المشتريات والمصاريف', icon: FileText },
    { id: 'debts', label: 'الديون والعملاء', icon: Banknote },
    { id: 'admin', label: 'تقارير إدارية', icon: Activity },
    { id: 'all', label: 'جميع التقارير', icon: BarChart3 },
  ], []);

  // All available reports categorized and refined
  const allReports = useMemo(() => [
    { id: 'sales', category: 'sales', label: t('reports.sales'), icon: ShoppingCart },
    { id: 'profits', category: 'sales', label: t('reports.profits'), icon: TrendingUp },
    { id: 'partner-detailed', category: 'sales', label: t('reports.partnerDetailedReport'), icon: ClipboardList },

    ...(!noInventory ? [
      { id: 'inventory', category: 'inventory', label: 'المخزون وقيمته', icon: Package },
      { id: 'product-movement', category: 'inventory', label: 'حركة منتج', icon: Activity },
      { id: 'inventory-stock', category: 'inventory', label: 'الجرد وفروقات المخزون', icon: PackageSearch },
      { id: 'top-products', category: 'inventory', label: 'الأكثر مبيعاً', icon: TrendingUp },
    ] : []),

    { id: 'purchases', category: 'purchases', label: 'فواتير المشتريات', icon: FileText },
    { id: 'expenses', category: 'purchases', label: t('reports.expenses'), icon: Receipt },

    { id: 'debts', category: 'debts', label: 'الديون والبيع المؤجل', icon: Banknote },
    { id: 'customers', category: 'debts', label: t('reports.customers'), icon: Users },
    { id: 'partners', category: 'debts', label: t('reports.partners'), icon: UsersRound },

    { id: 'daily-closing', category: 'admin', label: 'الإغلاق اليومي', icon: Calendar },
    { id: 'cashier-performance', category: 'admin', label: 'أداء الكاشير', icon: Users },
    ...(visibleSections.maintenance ? [{ id: 'maintenance', category: 'admin', label: 'خدمات الصيانة', icon: ClipboardList }] : []),
    ...(storeType === 'bookstore' ? [{ id: 'library', category: 'admin', label: 'تقرير المكتبة', icon: BookOpen }] : []),
    ...(isDistributorStore ? [
      { id: 'distributor-inventory', category: 'admin', label: t('reports.distributorInventory'), icon: Truck },
      { id: 'custody-value', category: 'admin', label: t('reports.custodyValue'), icon: Wallet },
    ] : []),
  ], [noInventory, visibleSections.maintenance, storeType, isDistributorStore, t]);

  const visibleReports = useMemo(() => {
    if (activeCategory === 'all') return allReports;
    return allReports.filter(r => r.category === activeCategory);
  }, [activeCategory, allReports]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      if (tab === 'sales-detailed') {
        setActiveReport('sales');
        setSalesViewMode('detailed');
        setActiveCategory('sales');
      } else if (tab === 'stock-discrepancy') {
        setActiveReport('inventory-stock');
        setStockViewMode('discrepancy');
        setActiveCategory('inventory');
      } else {
        setActiveReport(tab);
        const rep = allReports.find(r => r.id === tab);
        if (rep) setActiveCategory(rep.category);
      }
    }
  }, [searchParams, allReports]);

  // Extract unique cashier names for filter
  const uniqueCashiers = useMemo(() => {
    const map = new Map<string, string>();
    cloudInvoices.forEach(inv => {
      const name = inv.cashierName || 'غير محدد';
      if (!map.has(name)) map.set(name, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [cloudInvoices]);

  const uniqueCategories = useMemo(() => {
    return cloudCategories.map(c => ({ id: c.name, name: c.name }));
  }, [cloudCategories]);

  // Filter config per report type
  const filterConfig = useMemo(() => {
    switch (activeReport) {
      case 'sales':
      case 'sales-detailed':
        return { showStatus: true, showCashier: true, showPaymentType: true, showSearch: true, cashiers: uniqueCashiers };
      case 'profits':
        return { showCashier: true, showPaymentType: true, cashiers: uniqueCashiers };
      case 'products':
        return { showCategory: true, showSearch: true, categories: uniqueCategories };
      case 'inventory':
        return { showCategory: true, showSearch: true, categories: uniqueCategories };
      case 'stock-discrepancy':
        return { showSearch: true, showWarehouse: true, warehouses: [] };
      case 'customers':
        return { showSearch: true };
      case 'cashier-performance':
        return { showCashier: true, cashiers: uniqueCashiers };
      case 'expenses':
        return { showSearch: true };
      case 'debts':
        return { showStatus: true, showSearch: true, statusOptions: [
          { value: 'due', label: 'مستحق' },
          { value: 'partially_paid', label: 'مسدد جزئياً' },
          { value: 'fully_paid', label: 'مسدد' },
          { value: 'overdue', label: 'متأخر' },
        ]};
      case 'maintenance':
        return { showPaymentType: true, showSearch: true };
      default:
        return {};
    }
  }, [activeReport, uniqueCashiers, uniqueCategories]);

  // ========== DATA CALCULATIONS ==========

  const reportData = useMemo(() => {
    const filteredInvoices = cloudInvoices.filter(inv => {
      const invDate = toLocalDateString(inv.createdAt);
      const isValidType = inv.type === 'sale' || inv.type === 'maintenance';
      if (!isDateInRange(invDate, dateRange.from, dateRange.to)) return false;
      if (!isValidType) return false;
      // Exclude refunded
      if (inv.status === 'refunded') return false;
      // Apply status filter
      if (filters.status !== 'all' && inv.status !== filters.status) return false;
      // Apply cashier filter
      if (filters.cashierId !== 'all' && (inv.cashierName || 'غير محدد') !== filters.cashierId) return false;
      // Apply payment type filter
      if (filters.paymentType !== 'all' && inv.paymentType !== filters.paymentType) return false;
      return true;
    });

    const totalSales = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalProfit = filteredInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);
    const totalOrders = filteredInvoices.length;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    const dailySalesMap: Record<string, { sales: number; profit: number; orders: number }> = {};
    filteredInvoices.forEach(inv => {
      const date = toLocalDateString(inv.createdAt);
      if (!dailySalesMap[date]) dailySalesMap[date] = { sales: 0, profit: 0, orders: 0 };
      dailySalesMap[date].sales += inv.total;
      dailySalesMap[date].profit += inv.profit || 0;
      dailySalesMap[date].orders += 1;
    });

    const allDailySales = Object.entries(dailySalesMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const dailySales = allDailySales.slice(-7);

    const productSalesMap: Record<string, { name: string; sales: number; revenue: number; profit: number }> = {};
    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const key = item.id || item.name;
        if (!productSalesMap[key]) productSalesMap[key] = { name: item.name, sales: 0, revenue: 0, profit: 0 };
        productSalesMap[key].sales += item.quantity;
        productSalesMap[key].revenue += item.total;
        const itemProfit = item.profit ?? (item.costPrice !== undefined ? Math.max(0, item.price - item.costPrice) * item.quantity : item.total * 0.4);
        productSalesMap[key].profit += itemProfit;
      });
    });

    const allProducts = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);
    const topProducts = allProducts.slice(0, 5);

    const customerPurchasesMap: Record<string, { name: string; orders: number; total: number }> = {};
    filteredInvoices.forEach(inv => {
      const name = inv.customerName || t('reports.cashCustomer');
      if (!customerPurchasesMap[name]) customerPurchasesMap[name] = { name, orders: 0, total: 0 };
      customerPurchasesMap[name].orders += 1;
      customerPurchasesMap[name].total += inv.total;
    });

    const allCustomers = Object.values(customerPurchasesMap).sort((a, b) => b.total - a.total);
    const topCustomers = allCustomers.slice(0, 5);

    const topProduct = topProducts.length > 0 ? topProducts[0].name : t('common.noData');
    const topCustomer = topCustomers.length > 0 ? topCustomers[0].name : t('common.noData');

    return {
      summary: { totalSales, totalProfit, totalOrders, avgOrderValue, topProduct, topCustomer },
      dailySales, allDailySales, topProducts, allProducts, topCustomers, allCustomers,
      hasData: filteredInvoices.length > 0,
    };
  }, [dateRange, filters.status, filters.cashierId, filters.paymentType, cloudInvoices, t]);

  // Partner report data
  const partnerReportData = useMemo(() => {
    const partners = cloudPartners;
    const categories = cloudCategories;
    const filteredPartners = selectedPartnerId === 'all' ? partners : partners.filter(p => p.id === selectedPartnerId);

    const partnerProfitData = filteredPartners.map(partner => {
      const filteredProfitHistory = (partner.profitHistory || []).filter(record => {
        const recordDate = toLocalDateString(record.createdAt);
        return isDateInRange(recordDate, dateRange.from, dateRange.to);
      });
      const totalProfitInPeriod = filteredProfitHistory.reduce((sum, r) => sum + r.amount, 0);

      const profitByCategory: Record<string, { categoryName: string; amount: number; count: number }> = {};
      filteredProfitHistory.forEach(record => {
        const catName = record.category || t('reports.noCategory');
        if (!profitByCategory[catName]) profitByCategory[catName] = { categoryName: catName, amount: 0, count: 0 };
        profitByCategory[catName].amount += record.amount;
        profitByCategory[catName].count += 1;
      });

      const dailyProfitMap: Record<string, number> = {};
      filteredProfitHistory.forEach(record => {
        const date = toLocalDateString(record.createdAt);
        dailyProfitMap[date] = (dailyProfitMap[date] || 0) + record.amount;
      });
      const dailyProfit = Object.entries(dailyProfitMap).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));

      const filteredWithdrawals = (partner.withdrawalHistory || []).filter(w => {
        const wDate = toLocalDateString(w.date);
        return isDateInRange(wDate, dateRange.from, dateRange.to);
      });
      const totalWithdrawnInPeriod = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);

      return {
        id: partner.id, name: partner.name, sharePercentage: partner.sharePercentage,
        accessAll: partner.accessAll, currentBalance: partner.currentBalance,
        currentCapital: partner.currentCapital, totalProfitInPeriod, totalWithdrawnInPeriod,
        profitByCategory: Object.values(profitByCategory).sort((a, b) => b.amount - a.amount),
        dailyProfit, pendingProfit: partner.pendingProfit,
        confirmedProfit: partner.confirmedProfit, totalProfitEarned: partner.totalProfitEarned,
      };
    });

    const totalPartnerProfitInPeriod = partnerProfitData.reduce((sum, p) => sum + p.totalProfitInPeriod, 0);
    const totalPartnerWithdrawnInPeriod = partnerProfitData.reduce((sum, p) => sum + p.totalWithdrawnInPeriod, 0);
    const totalCurrentBalance = partnerProfitData.reduce((sum, p) => sum + p.currentBalance, 0);
    const totalPendingProfit = partnerProfitData.reduce((sum, p) => sum + p.pendingProfit, 0);

    const aggregatedCategoryProfits: Record<string, { categoryName: string; amount: number; count: number }> = {};
    partnerProfitData.forEach(partner => {
      partner.profitByCategory.forEach(cat => {
        if (!aggregatedCategoryProfits[cat.categoryName]) aggregatedCategoryProfits[cat.categoryName] = { categoryName: cat.categoryName, amount: 0, count: 0 };
        aggregatedCategoryProfits[cat.categoryName].amount += cat.amount;
        aggregatedCategoryProfits[cat.categoryName].count += cat.count;
      });
    });

    return {
      partners: partnerProfitData, allPartners: partners, categories,
      summary: { totalProfitInPeriod: totalPartnerProfitInPeriod, totalWithdrawnInPeriod: totalPartnerWithdrawnInPeriod, totalCurrentBalance, totalPendingProfit, partnersCount: filteredPartners.length },
      aggregatedCategoryProfits: Object.values(aggregatedCategoryProfits).sort((a, b) => b.amount - a.amount),
      hasData: partnerProfitData.some(p => p.totalProfitInPeriod > 0 || p.currentBalance > 0),
    };
  }, [dateRange, selectedPartnerId, cloudPartners, cloudCategories, t]);

  // Expense report data
  const expenseReportData = useMemo(() => {
    const allExpenses = cloudExpenses;
    const partners = cloudPartners;
    const filteredExpenses = allExpenses.filter(exp => {
      const expDate = toLocalDateString(exp.date);
      return isDateInRange(expDate, dateRange.from, dateRange.to);
    });

    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const byType: Record<string, { type: string; amount: number; count: number }> = {};
    filteredExpenses.forEach(exp => {
      const type = exp.typeLabel;
      if (!byType[type]) byType[type] = { type, amount: 0, count: 0 };
      byType[type].amount += exp.amount;
      byType[type].count += 1;
    });

    const partnerExpenses: Record<string, { name: string; amount: number; percentage: number }> = {};
    filteredExpenses.forEach(exp => {
      exp.distributions.forEach(dist => {
        if (!partnerExpenses[dist.partnerId]) partnerExpenses[dist.partnerId] = { name: dist.partnerName, amount: 0, percentage: 0 };
        partnerExpenses[dist.partnerId].amount += dist.amount;
      });
    });
    Object.values(partnerExpenses).forEach(pe => {
      pe.percentage = totalExpenses > 0 ? (pe.amount / totalExpenses) * 100 : 0;
    });

    const dailyExpenseMap: Record<string, number> = {};
    filteredExpenses.forEach(exp => {
      dailyExpenseMap[exp.date] = (dailyExpenseMap[exp.date] || 0) + exp.amount;
    });
    const dailyExpenses = Object.entries(dailyExpenseMap).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      expenses: filteredExpenses, totalExpenses,
      byType: Object.values(byType).sort((a, b) => b.amount - a.amount),
      partnerExpenses: Object.values(partnerExpenses).sort((a, b) => b.amount - a.amount),
      dailyExpenses, hasData: filteredExpenses.length > 0, allPartners: partners,
    };
  }, [dateRange, cloudExpenses, cloudPartners]);

  // ========== DYNAMIC SUMMARY CARDS ==========

  const summaryCards = useMemo(() => {
    switch (activeReport) {
      case 'sales':
        return [
          { icon: DollarSign, value: formatCurrency(reportData.summary.totalSales), label: t('reports.totalSales'), color: 'text-primary', bg: 'bg-primary/10' },
          { icon: TrendingUp, value: formatCurrency(reportData.summary.totalProfit), label: t('reports.totalProfit'), color: 'text-green-600', bg: 'bg-green-500/10' },
          { icon: ShoppingCart, value: String(reportData.summary.totalOrders), label: t('reports.ordersCount'), color: 'text-blue-600', bg: 'bg-blue-500/10' },
          { icon: PieChart, value: formatCurrency(reportData.summary.avgOrderValue), label: t('reports.avgOrderValue'), color: 'text-amber-600', bg: 'bg-amber-500/10' },
        ];
      case 'profits':
        return [
          { icon: TrendingUp, value: formatCurrency(reportData.summary.totalProfit), label: 'إجمالي الأرباح', color: 'text-green-600', bg: 'bg-green-500/10' },
          { icon: DollarSign, value: formatCurrency(reportData.summary.totalSales), label: 'إجمالي المبيعات', color: 'text-primary', bg: 'bg-primary/10' },
          { icon: ShoppingCart, value: String(reportData.summary.totalOrders), label: 'عدد الفواتير', color: 'text-blue-600', bg: 'bg-blue-500/10' },
          { icon: PieChart, value: reportData.summary.totalOrders > 0 ? formatCurrency(reportData.summary.totalProfit / reportData.summary.totalOrders) : '$0', label: 'متوسط الربح/فاتورة', color: 'text-amber-600', bg: 'bg-amber-500/10' },
        ];
      case 'inventory': {
        const totalQty = cloudProducts.reduce((s, p) => s + (p.quantity || 0), 0);
        const costValue = cloudProducts.reduce((s, p) => s + ((p.costPrice || 0) * (p.quantity || 0)), 0);
        const saleValue = cloudProducts.reduce((s, p) => s + ((p.salePrice || 0) * (p.quantity || 0)), 0);
        return [
          { icon: Package, value: String(cloudProducts.length), label: 'عدد الأصناف', color: 'text-primary', bg: 'bg-primary/10' },
          { icon: ShoppingCart, value: String(totalQty), label: 'إجمالي الكميات', color: 'text-blue-600', bg: 'bg-blue-500/10' },
          { icon: DollarSign, value: formatCurrency(costValue), label: 'قيمة المخزون (شراء)', color: 'text-amber-600', bg: 'bg-amber-500/10' },
          { icon: TrendingUp, value: formatCurrency(saleValue), label: 'قيمة المخزون (بيع)', color: 'text-green-600', bg: 'bg-green-500/10' },
        ];
      }
      case 'expenses':
        return [
          { icon: Receipt, value: formatCurrency(expenseReportData.totalExpenses), label: 'إجمالي المصاريف', color: 'text-destructive', bg: 'bg-destructive/10' },
          { icon: Calendar, value: String(expenseReportData.expenses.length), label: 'عدد المصاريف', color: 'text-blue-600', bg: 'bg-blue-500/10' },
          { icon: PieChart, value: String(expenseReportData.byType.length), label: 'أنواع المصاريف', color: 'text-amber-600', bg: 'bg-amber-500/10' },
          { icon: UsersRound, value: String(expenseReportData.partnerExpenses.length), label: 'الشركاء المشاركون', color: 'text-primary', bg: 'bg-primary/10' },
        ];
      case 'partners':
        return [
          { icon: TrendingUp, value: formatCurrency(partnerReportData.summary.totalProfitInPeriod), label: 'الأرباح في الفترة', color: 'text-green-600', bg: 'bg-green-500/10' },
          { icon: Wallet, value: formatCurrency(partnerReportData.summary.totalCurrentBalance), label: 'الرصيد الحالي', color: 'text-primary', bg: 'bg-primary/10' },
          { icon: Banknote, value: formatCurrency(partnerReportData.summary.totalWithdrawnInPeriod), label: 'المسحوب في الفترة', color: 'text-amber-600', bg: 'bg-amber-500/10' },
          { icon: UsersRound, value: String(partnerReportData.summary.partnersCount), label: 'عدد الشركاء', color: 'text-blue-600', bg: 'bg-blue-500/10' },
        ];
      default:
        return [
          { icon: DollarSign, value: formatCurrency(reportData.summary.totalSales), label: t('reports.totalSales'), color: 'text-primary', bg: 'bg-primary/10' },
          { icon: TrendingUp, value: formatCurrency(reportData.summary.totalProfit), label: t('reports.totalProfit'), color: 'text-green-600', bg: 'bg-green-500/10' },
          { icon: ShoppingCart, value: String(reportData.summary.totalOrders), label: t('reports.ordersCount'), color: 'text-blue-600', bg: 'bg-blue-500/10' },
          { icon: PieChart, value: formatCurrency(reportData.summary.avgOrderValue), label: t('reports.avgOrderValue'), color: 'text-amber-600', bg: 'bg-amber-500/10' },
        ];
    }
  }, [activeReport, reportData, expenseReportData, partnerReportData, cloudProducts, t]);

  // ========== EXPORT HANDLERS ==========

  const getStoreInfo = () => {
    try {
      const stored = localStorage.getItem('hyperpos_settings_v1') || localStorage.getItem('hyperpos_settings');
      if (stored) {
        const settings = JSON.parse(stored);
        return {
          name: settings.storeSettings?.name || settings.storeName || 'HyperPOS',
          phone: settings.storeSettings?.phone || settings.storePhone,
          address: settings.storeSettings?.address || settings.storeAddress,
          logo: settings.storeSettings?.logo || settings.logoUrl
        };
      }
    } catch { /* ignore */ }
    return { name: 'HyperPOS' };
  };

  // Helpers: apply same filters used in the visible report
  const getFilteredInvoicesForReport = useCallback(() => {
    return cloudInvoices.filter(inv => {
      const invDate = toLocalDateString(inv.createdAt);
      const isValidType = inv.type === 'sale' || inv.type === 'maintenance';
      if (!isDateInRange(invDate, dateRange.from, dateRange.to)) return false;
      if (!isValidType) return false;
      if (inv.status === 'refunded') return false;
      if (filters.status !== 'all' && inv.status !== filters.status) return false;
      if (filters.cashierId !== 'all' && (inv.cashierName || 'غير محدد') !== filters.cashierId) return false;
      if (filters.paymentType !== 'all' && inv.paymentType !== filters.paymentType) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matches = (inv.customerName || '').toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [cloudInvoices, dateRange, filters]);

  const getFilteredProductsForReport = useCallback(() => {
    return cloudProducts.filter(p => {
      if (filters.category !== 'all' && (p.category || '') !== filters.category) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.barcode || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [cloudProducts, filters]);

  const getFilteredCustomersForReport = useCallback(() => {
    return cloudCustomers.filter(c => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !(c.phone || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [cloudCustomers, filters]);

  const handleExportPDF = useCallback(async () => {
    const storeInfo = getStoreInfo();
    if (isLoading) { toast.error(t('reports.waitForData')); return; }
    try {
      switch (activeReport) {
        case 'sales':
        case 'profits': {
          const filteredInvoices = getFilteredInvoicesForReport();
          if (filteredInvoices.length === 0) { toast.error(t('reports.noDataToExport')); return; }
          await exportInvoicesToPDF(filteredInvoices.map(inv => ({
            id: inv.id, customerName: inv.customerName || 'عميل نقدي', total: inv.total,
            discount: inv.discount || 0, profit: inv.profit || 0, paymentType: inv.paymentType,
            type: inv.type, createdAt: inv.createdAt, cashierName: inv.cashierName || '-',
          })), storeInfo, { start: dateRange.from, end: dateRange.to });
          break;
        }
        case 'products':
        case 'inventory': {
          const filteredProducts = getFilteredProductsForReport();
          if (filteredProducts.length === 0) { toast.error(t('reports.noProductsToExport')); return; }
          await exportProductsToPDF(filteredProducts.map(p => ({
            name: p.name, barcode: p.barcode || '', category: p.category || 'بدون تصنيف',
            costPrice: p.costPrice || 0, salePrice: p.salePrice || 0, quantity: p.quantity || 0,
            minStockLevel: p.minStockLevel || 0,
          })), storeInfo);
          break;
        }
        case 'inventory-stock': {
          const filteredProducts = getFilteredProductsForReport();
          if (filteredProducts.length === 0) { toast.error(t('reports.noProductsToExport')); return; }
          await exportToPDF({
            title: 'كشف الجرد الفعلي للمخزون',
            subtitle: `الفترة: ${dateRange.from} إلى ${dateRange.to}`,
            storeName: storeInfo.name,
            storePhone: storeInfo.phone,
            storeAddress: storeInfo.address,
            columns: [
              { header: 'اسم المنتج', key: 'name' },
              { header: 'الباركود', key: 'barcode' },
              { header: 'التصنيف', key: 'category' },
              { header: 'الرصيد الدفتري', key: 'quantity' },
              { header: 'سعر التكلفة', key: 'costPrice' },
              { header: 'إجمالي القيمة', key: 'totalValue' },
            ],
            data: filteredProducts.map(p => ({
              name: p.name,
              barcode: p.barcode || '-',
              category: p.category || 'عام',
              quantity: p.quantity || 0,
              costPrice: formatCurrency(p.costPrice || 0),
              totalValue: formatCurrency((p.quantity || 0) * (p.costPrice || 0)),
            })),
            fileName: `inventory-audit-${dateRange.from}.pdf`,
          });
          break;
        }
        case 'purchases': {
          const purchases = await loadPurchaseInvoicesCloud();
          const filteredPurchases = purchases.filter(p => isDateInRange(toLocalDateString(p.created_at || p.invoice_date), dateRange.from, dateRange.to));
          if (filteredPurchases.length === 0) { toast.error('لا توجد فواتير مشتريات في الفترة المحددة للتصدير'); return; }
          await exportToPDF({
            title: 'تقرير فواتير المشتريات',
            subtitle: `الفترة من ${dateRange.from} إلى ${dateRange.to}`,
            storeName: storeInfo.name,
            storePhone: storeInfo.phone,
            storeAddress: storeInfo.address,
            columns: [
              { header: 'رقم الفاتورة', key: 'invoiceNumber' },
              { header: 'المورد', key: 'supplierName' },
              { header: 'التاريخ', key: 'date' },
              { header: 'الإجمالي المتوقع', key: 'expectedTotal' },
              { header: 'الإجمالي الفعلي', key: 'actualTotal' },
              { header: 'عدد الأصناف', key: 'itemsCount' },
              { header: 'الحالة', key: 'status' },
            ],
            data: filteredPurchases.map(p => ({
              invoiceNumber: p.invoice_number || p.id,
              supplierName: p.supplier_name || 'مورد عام',
              date: toLocalDateString(p.created_at || p.invoice_date),
              expectedTotal: formatCurrency(p.expected_grand_total || 0),
              actualTotal: formatCurrency(p.actual_grand_total || p.expected_grand_total || 0),
              itemsCount: p.actual_items_count || p.expected_items_count || 0,
              status: p.status === 'finalized' ? 'معتمدة ومكتملة' : p.status === 'reconciled' ? 'تمت المطابقة' : 'مسودة',
            })),
            fileName: `purchases-${dateRange.from}-to-${dateRange.to}.pdf`,
          });
          break;
        }
        case 'debts': {
          if (cloudDebts.length === 0) { toast.error('لا توجد ديون للتصدير'); return; }
          await exportToPDF({
            title: 'تقرير الديون والبيع المؤجل',
            subtitle: `تاريخ التقرير: ${dateRange.to}`,
            storeName: storeInfo.name,
            storePhone: storeInfo.phone,
            storeAddress: storeInfo.address,
            columns: [
              { header: 'العميل', key: 'customerName' },
              { header: 'المبلغ الإجمالي', key: 'amount' },
              { header: 'المسدد', key: 'paid' },
              { header: 'المتبقي', key: 'remaining' },
              { header: 'تاريخ الاستحقاق', key: 'dueDate' },
              { header: 'الحالة', key: 'status' },
            ],
            data: cloudDebts.map(d => ({
              customerName: d.customerName || 'عميل',
              amount: formatCurrency(d.totalDebt || 0),
              paid: formatCurrency(d.totalPaid || 0),
              remaining: formatCurrency(d.remainingDebt || (d.totalDebt || 0) - (d.totalPaid || 0)),
              dueDate: d.dueDate || '-',
              status: d.status === 'fully_paid' ? 'مسدد' : d.status === 'partially_paid' ? 'مسدد جزئياً' : 'مستحق',
            })),
            fileName: `debts-report-${dateRange.to}.pdf`,
          });
          break;
        }
        case 'cashier-performance': {
          const invoicesInRange = cloudInvoices.filter(inv => isDateInRange(toLocalDateString(inv.createdAt), dateRange.from, dateRange.to));
          if (invoicesInRange.length === 0) { toast.error(t('reports.noDataToExport')); return; }
          const cashierMap = new Map<string, { count: number; total: number; profit: number }>();
          invoicesInRange.forEach(inv => {
            const name = inv.cashierName || 'كاشير عام';
            const cur = cashierMap.get(name) || { count: 0, total: 0, profit: 0 };
            cur.count += 1;
            cur.total += inv.total || 0;
            cur.profit += inv.profit || 0;
            cashierMap.set(name, cur);
          });
          await exportToPDF({
            title: 'تقرير أداء موظفي الكاشير',
            subtitle: `الفترة من ${dateRange.from} إلى ${dateRange.to}`,
            storeName: storeInfo.name,
            storePhone: storeInfo.phone,
            storeAddress: storeInfo.address,
            columns: [
              { header: 'اسم الكاشير', key: 'name' },
              { header: 'عدد الفواتير', key: 'count' },
              { header: 'إجمالي المبيعات', key: 'sales' },
              { header: 'متوسط الفاتورة', key: 'avg' },
              { header: 'إجمالي الأرباح', key: 'profit' },
            ],
            data: Array.from(cashierMap.entries()).map(([name, data]) => ({
              name,
              count: data.count,
              sales: formatCurrency(data.total),
              avg: formatCurrency(data.count > 0 ? data.total / data.count : 0),
              profit: formatCurrency(data.profit),
            })),
            fileName: `cashier-performance-${dateRange.from}.pdf`,
          });
          break;
        }
        case 'maintenance': {
          const maintInvoices = cloudInvoices.filter(inv => inv.type === 'maintenance' && isDateInRange(toLocalDateString(inv.createdAt), dateRange.from, dateRange.to));
          if (maintInvoices.length === 0) { toast.error('لا توجد فواتير صيانة في هذه الفترة'); return; }
          await exportToPDF({
            title: 'تقرير خدمات الصيانة',
            subtitle: `الفترة من ${dateRange.from} إلى ${dateRange.to}`,
            storeName: storeInfo.name,
            storePhone: storeInfo.phone,
            storeAddress: storeInfo.address,
            columns: [
              { header: 'رقم الفاتورة', key: 'id' },
              { header: 'العميل', key: 'customer' },
              { header: 'التاريخ', key: 'date' },
              { header: 'المبلغ الإجمالي', key: 'total' },
              { header: 'الربح', key: 'profit' },
              { header: 'طريقة الدفع', key: 'payment' },
            ],
            data: maintInvoices.map(inv => ({
              id: inv.id,
              customer: inv.customerName || 'عميل نقدي',
              date: toLocalDateString(inv.createdAt),
              total: formatCurrency(inv.total),
              profit: formatCurrency(inv.profit || 0),
              payment: inv.paymentType,
            })),
            fileName: `maintenance-report-${dateRange.from}.pdf`,
          });
          break;
        }
        case 'top-products': {
          if (reportData.topProducts.length === 0) { toast.error(t('reports.noProductsSold')); return; }
          await exportToPDF({
            title: 'تقرير المنتجات الأكثر مبيعاً',
            subtitle: `الفترة من ${dateRange.from} إلى ${dateRange.to}`,
            storeName: storeInfo.name,
            storePhone: storeInfo.phone,
            storeAddress: storeInfo.address,
            columns: [
              { header: 'الترتيب', key: 'rank' },
              { header: 'اسم المنتج', key: 'name' },
              { header: 'الكمية المباعة', key: 'sales' },
              { header: 'إجمالي الإيراد', key: 'revenue' },
            ],
            data: reportData.topProducts.map((p, idx) => ({
              rank: idx + 1,
              name: p.name,
              sales: `${p.sales} قطعة`,
              revenue: formatCurrency(p.revenue),
            })),
            fileName: `top-products-${dateRange.from}.pdf`,
          });
          break;
        }
        case 'daily-closing': {
          const salesInRange = reportData.dailySales;
          if (salesInRange.length === 0) { toast.error(t('reports.noDataToExport')); return; }
          await exportToPDF({
            title: 'تقرير الإغلاق اليومي',
            subtitle: `الفترة من ${dateRange.from} إلى ${dateRange.to}`,
            storeName: storeInfo.name,
            storePhone: storeInfo.phone,
            storeAddress: storeInfo.address,
            columns: [
              { header: 'التاريخ', key: 'date' },
              { header: 'إجمالي المبيعات', key: 'sales' },
              { header: 'عدد الطلبات', key: 'orders' },
            ],
            data: salesInRange.map(d => ({
              date: d.date,
              sales: formatCurrency(d.sales),
              orders: d.orders,
            })),
            fileName: `daily-closing-${dateRange.from}.pdf`,
          });
          break;
        }
        case 'customers': {
          const filteredCustomers = getFilteredCustomersForReport();
          if (filteredCustomers.length === 0) { toast.error(t('reports.noCustomersToExport')); return; }
          await exportCustomersToPDF(filteredCustomers.map(c => ({
            name: c.name, phone: c.phone || '', totalPurchases: c.totalPurchases || 0,
            ordersCount: c.invoiceCount || 0, balance: c.totalDebt || 0,
          })), storeInfo);
          break;
        }
        case 'partners': {
          if (cloudPartners.length === 0) { toast.error(t('reports.noPartnersToExport')); return; }
          await exportPartnersToPDF(cloudPartners.map(p => ({
            name: p.name, sharePercentage: p.sharePercentage || 0, currentCapital: p.currentCapital || 0,
            totalProfit: p.totalProfitEarned || 0, totalWithdrawn: p.totalWithdrawn || 0, currentBalance: p.currentBalance || 0,
          })), storeInfo);
          break;
        }
        case 'expenses': {
          if (expenseReportData.expenses.length === 0) { toast.error(t('reports.noExpensesToExport')); return; }
          await exportExpensesToPDF(expenseReportData.expenses.map(e => ({
            id: e.id, type: e.type, typeLabel: e.typeLabel, amount: e.amount || 0,
            date: e.date, notes: e.notes || '',
          })), storeInfo, { start: dateRange.from, end: dateRange.to });
          break;
        }
        default: {
          toast.info('تم تصدير التقرير');
        }
      }
      toast.success(t('reports.exportSuccessPDF'));
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error(t('reports.exportError'));
    }
  }, [dateRange, activeReport, expenseReportData, cloudPartners, cloudDebts, cloudInvoices, reportData, isLoading, t, getFilteredInvoicesForReport, getFilteredProductsForReport, getFilteredCustomersForReport]);

  const handleExportExcel = useCallback(async () => {
    try {
      switch (activeReport) {
        case 'sales':
        case 'profits': {
          const filteredInvoices = getFilteredInvoicesForReport();
          if (filteredInvoices.length === 0) { toast.error(t('reports.noDataToExport')); return; }
          exportInvoicesToExcel(filteredInvoices.map(inv => ({
            id: inv.id, customerName: inv.customerName || 'عميل نقدي', total: inv.total,
            profit: inv.profit, paymentType: inv.paymentType, type: inv.type,
            createdAt: inv.createdAt, cashierName: inv.cashierName || '-',
          })), { start: dateRange.from, end: dateRange.to });
          break;
        }
        case 'products':
        case 'inventory': {
          const filteredProducts = getFilteredProductsForReport();
          if (filteredProducts.length === 0) { toast.error(t('reports.noProductsToExport')); return; }
          exportProductsToExcel(filteredProducts.map(p => ({
            name: p.name, barcode: p.barcode || '', barcode2: p.barcode2 || '', barcode3: p.barcode3 || '',
            variantLabel: p.variantLabel || '', category: p.category || 'بدون تصنيف',
            costPrice: p.costPrice, salePrice: p.salePrice, quantity: p.quantity,
          })));
          break;
        }
        case 'inventory-stock': {
          const filteredProducts = getFilteredProductsForReport();
          if (filteredProducts.length === 0) { toast.error(t('reports.noProductsToExport')); return; }
          await exportToExcel({
            title: 'كشف الجرد الفعلي للمخزون',
            sheetName: 'الجرد الفعلي',
            columns: [
              { header: 'اسم المنتج', key: 'name', width: 25 },
              { header: 'الباركود', key: 'barcode', width: 18 },
              { header: 'التصنيف', key: 'category', width: 18 },
              { header: 'الرصيد الدفتري', key: 'quantity', width: 15 },
              { header: 'سعر التكلفة', key: 'costPrice', width: 15 },
              { header: 'إجمالي القيمة', key: 'totalValue', width: 18 },
            ],
            data: filteredProducts.map(p => ({
              name: p.name,
              barcode: p.barcode || '-',
              category: p.category || 'عام',
              quantity: p.quantity || 0,
              costPrice: p.costPrice || 0,
              totalValue: (p.quantity || 0) * (p.costPrice || 0),
            })),
            fileName: `inventory-audit-${dateRange.from}.xlsx`,
          });
          break;
        }
        case 'purchases': {
          const purchases = await loadPurchaseInvoicesCloud();
          const filteredPurchases = purchases.filter(p => isDateInRange(toLocalDateString(p.created_at || p.invoice_date), dateRange.from, dateRange.to));
          if (filteredPurchases.length === 0) { toast.error('لا توجد فواتير مشتريات للتصدير'); return; }
          await exportToExcel({
            title: 'تقرير فواتير المشتريات',
            sheetName: 'المشتريات',
            columns: [
              { header: 'رقم الفاتورة', key: 'invoiceNumber', width: 18 },
              { header: 'المورد', key: 'supplierName', width: 22 },
              { header: 'التاريخ', key: 'date', width: 15 },
              { header: 'الإجمالي المتوقع', key: 'expectedTotal', width: 16 },
              { header: 'الإجمالي الفعلي', key: 'actualTotal', width: 16 },
              { header: 'عدد الأصناف', key: 'itemsCount', width: 14 },
              { header: 'الحالة', key: 'status', width: 16 },
            ],
            data: filteredPurchases.map(p => ({
              invoiceNumber: p.invoice_number || p.id,
              supplierName: p.supplier_name || 'مورد عام',
              date: toLocalDateString(p.created_at || p.invoice_date),
              expectedTotal: p.expected_grand_total || 0,
              actualTotal: p.actual_grand_total || p.expected_grand_total || 0,
              itemsCount: p.actual_items_count || p.expected_items_count || 0,
              status: p.status === 'finalized' ? 'معتمدة ومكتملة' : p.status === 'reconciled' ? 'تمت المطابقة' : 'مسودة',
            })),
            fileName: `purchases-${dateRange.from}.xlsx`,
          });
          break;
        }
        case 'debts': {
          if (cloudDebts.length === 0) { toast.error('لا توجد ديون للتصدير'); return; }
          await exportToExcel({
            title: 'تقرير الديون والبيع المؤجل',
            sheetName: 'الديون',
            columns: [
              { header: 'العميل', key: 'customerName', width: 22 },
              { header: 'المبلغ الإجمالي', key: 'amount', width: 15 },
              { header: 'المسدد', key: 'paid', width: 15 },
              { header: 'المتبقي', key: 'remaining', width: 15 },
              { header: 'تاريخ الاستحقاق', key: 'dueDate', width: 15 },
              { header: 'الحالة', key: 'status', width: 15 },
            ],
            data: cloudDebts.map(d => ({
              customerName: d.customerName || 'عميل',
              amount: d.totalDebt || 0,
              paid: d.totalPaid || 0,
              remaining: d.remainingDebt || (d.totalDebt || 0) - (d.totalPaid || 0),
              dueDate: d.dueDate || '-',
              status: d.status === 'fully_paid' ? 'مسدد' : d.status === 'partially_paid' ? 'مسدد جزئياً' : 'مستحق',
            })),
            fileName: `debts-${dateRange.to}.xlsx`,
          });
          break;
        }
        case 'cashier-performance': {
          const invoicesInRange = cloudInvoices.filter(inv => isDateInRange(toLocalDateString(inv.createdAt), dateRange.from, dateRange.to));
          if (invoicesInRange.length === 0) { toast.error(t('reports.noDataToExport')); return; }
          const cashierMap = new Map<string, { count: number; total: number; profit: number }>();
          invoicesInRange.forEach(inv => {
            const name = inv.cashierName || 'كاشير عام';
            const cur = cashierMap.get(name) || { count: 0, total: 0, profit: 0 };
            cur.count += 1;
            cur.total += inv.total || 0;
            cur.profit += inv.profit || 0;
            cashierMap.set(name, cur);
          });
          await exportToExcel({
            title: 'تقرير أداء موظفي الكاشير',
            sheetName: 'أداء الكاشير',
            columns: [
              { header: 'اسم الكاشير', key: 'name', width: 22 },
              { header: 'عدد الفواتير', key: 'count', width: 15 },
              { header: 'إجمالي المبيعات', key: 'sales', width: 18 },
              { header: 'متوسط الفاتورة', key: 'avg', width: 18 },
              { header: 'إجمالي الأرباح', key: 'profit', width: 18 },
            ],
            data: Array.from(cashierMap.entries()).map(([name, data]) => ({
              name,
              count: data.count,
              sales: data.total,
              avg: data.count > 0 ? data.total / data.count : 0,
              profit: data.profit,
            })),
            fileName: `cashier-performance-${dateRange.from}.xlsx`,
          });
          break;
        }
        case 'maintenance': {
          const maintInvoices = cloudInvoices.filter(inv => inv.type === 'maintenance' && isDateInRange(toLocalDateString(inv.createdAt), dateRange.from, dateRange.to));
          if (maintInvoices.length === 0) { toast.error('لا توجد فواتير صيانة للتصدير'); return; }
          await exportToExcel({
            title: 'تقرير خدمات الصيانة',
            sheetName: 'خدمات الصيانة',
            columns: [
              { header: 'رقم الفاتورة', key: 'id', width: 18 },
              { header: 'العميل', key: 'customer', width: 22 },
              { header: 'التاريخ', key: 'date', width: 15 },
              { header: 'المبلغ الإجمالي', key: 'total', width: 15 },
              { header: 'الربح', key: 'profit', width: 15 },
              { header: 'طريقة الدفع', key: 'payment', width: 15 },
            ],
            data: maintInvoices.map(inv => ({
              id: inv.id,
              customer: inv.customerName || 'عميل نقدي',
              date: toLocalDateString(inv.createdAt),
              total: inv.total,
              profit: inv.profit || 0,
              payment: inv.paymentType,
            })),
            fileName: `maintenance-${dateRange.from}.xlsx`,
          });
          break;
        }
        case 'top-products': {
          if (reportData.topProducts.length === 0) { toast.error(t('reports.noProductsSold')); return; }
          await exportToExcel({
            title: 'المنتجات الأكثر مبيعاً',
            sheetName: 'الأكثر مبيعاً',
            columns: [
              { header: 'الترتيب', key: 'rank', width: 10 },
              { header: 'اسم المنتج', key: 'name', width: 25 },
              { header: 'الكمية المباعة', key: 'sales', width: 15 },
              { header: 'إجمالي الإيراد', key: 'revenue', width: 18 },
            ],
            data: reportData.topProducts.map((p, idx) => ({
              rank: idx + 1,
              name: p.name,
              sales: p.sales,
              revenue: p.revenue,
            })),
            fileName: `top-products-${dateRange.from}.xlsx`,
          });
          break;
        }
        case 'daily-closing': {
          const salesInRange = reportData.dailySales;
          if (salesInRange.length === 0) { toast.error(t('reports.noDataToExport')); return; }
          await exportToExcel({
            title: 'تقرير الإغلاق اليومي',
            sheetName: 'الإغلاق اليومي',
            columns: [
              { header: 'التاريخ', key: 'date', width: 15 },
              { header: 'إجمالي المبيعات', key: 'sales', width: 18 },
              { header: 'عدد الطلبات', key: 'orders', width: 15 },
            ],
            data: salesInRange.map(d => ({
              date: d.date,
              sales: d.sales,
              orders: d.orders,
            })),
            fileName: `daily-closing-${dateRange.from}.xlsx`,
          });
          break;
        }
        case 'customers': {
          const filteredCustomers = getFilteredCustomersForReport();
          if (filteredCustomers.length === 0) { toast.error(t('reports.noCustomersToExport')); return; }
          exportCustomersToExcel(filteredCustomers.map(c => ({
            name: c.name, phone: c.phone, totalPurchases: c.totalPurchases || 0,
            ordersCount: c.invoiceCount || 0, balance: c.totalDebt || 0,
          })));
          break;
        }
        case 'partners':
          exportPartnersToExcel(cloudPartners.map(p => ({
            name: p.name, sharePercentage: p.sharePercentage, initialCapital: p.initialCapital,
            currentCapital: p.currentCapital, totalProfit: p.totalProfitEarned,
            totalWithdrawn: p.totalWithdrawn, currentBalance: p.currentBalance,
          })));
          break;
        case 'expenses':
          exportExpensesToExcel(expenseReportData.expenses.map(e => ({
            id: e.id, type: e.type, amount: e.amount, date: e.date, notes: e.notes,
          })), { start: dateRange.from, end: dateRange.to });
          break;
        default: {
          toast.info('تم تجهيز التقرير');
          return;
        }
      }
      toast.success(t('reports.exportSuccessExcel'));
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error(t('reports.exportError'));
    }
  }, [dateRange, activeReport, expenseReportData, cloudPartners, cloudDebts, cloudInvoices, reportData, t, getFilteredInvoicesForReport, getFilteredProductsForReport, getFilteredCustomersForReport]);

  const handleShareExpenseReport = (partnerName: string) => {
    const partnerExpenses = expenseReportData.expenses.filter(exp =>
      exp.distributions.some(d => d.partnerName === partnerName)
    );
    const partnerTotal = partnerExpenses.reduce((sum, exp) => {
      const dist = exp.distributions.find(d => d.partnerName === partnerName);
      return sum + (dist?.amount || 0);
    }, 0);
    const report = `📊 تقرير المصاريف - ${partnerName}\n📅 الفترة: ${dateRange.from} إلى ${dateRange.to}\n\n💰 إجمالي المصاريف المشتركة: $${formatNumber(partnerTotal)}\n\n📋 التفاصيل:\n${partnerExpenses.map(exp => {
      const dist = exp.distributions.find(d => d.partnerName === partnerName);
      return `• ${exp.date} - ${exp.typeLabel}: $${formatNumber(dist?.amount || 0)}`;
    }).join('\n')}\n\n---\nتم إنشاء التقرير بواسطة HyperPOS`;
    window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
    toast.success(t('reports.shareWhatsapp'));
  };

  const maxSales = Math.max(...reportData.dailySales.map(d => d.sales), 1);

  // 7-day Bar chart data ending on dateRange.to
  const chartDays = useMemo(() => {
    const endDate = new Date(dateRange.to);
    const validEndDate = isNaN(endDate.getTime()) ? new Date() : endDate;
    const days: { date: string; dayNum: string; sales: number; profit: number; orders: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(validEndDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayNum = String(d.getDate());
      const salesData = reportData.allDailySales.find(s => s.date === dateStr);
      days.push({
        date: dateStr,
        dayNum,
        sales: salesData ? salesData.sales : 0,
        profit: salesData ? salesData.profit : 0,
        orders: salesData ? salesData.orders : 0,
      });
    }
    return days;
  }, [dateRange.to, reportData.allDailySales]);

  const maxChartSales = useMemo(() => Math.max(...chartDays.map(d => d.sales), 1), [chartDays]);

  const topChartDay = useMemo(() => {
    const sorted = [...chartDays].sort((a, b) => b.sales - a.sales);
    return sorted[0] || chartDays[chartDays.length - 1];
  }, [chartDays]);

  const activeChartDay = useMemo(() => {
    if (selectedDayDate) {
      const found = chartDays.find(d => d.date === selectedDayDate);
      if (found) return found;
    }
    return topChartDay;
  }, [chartDays, selectedDayDate, topChartDay]);

  const profitMargin = useMemo(() => {
    if (reportData.summary.totalSales > 0) {
      return ((reportData.summary.totalProfit / reportData.summary.totalSales) * 100).toFixed(1);
    }
    return '0.0';
  }, [reportData.summary.totalProfit, reportData.summary.totalSales]);

  const storeInfo = useMemo(() => getStoreInfo(), []);

  const handleSwitchView = (tab: 'summary' | 'detailed' | 'comprehensive') => {
    setViewTab(tab);
    setSalesViewMode(tab === 'detailed' ? 'detailed' : 'summary');
    const titles: Record<string, string> = {
      summary: 'ملخص بياني وإحصائي',
      detailed: 'كشف الفواتير التفصيلي',
      comprehensive: 'عرض تقرير شامل'
    };
    toast.success(`تم تبديل العرض إلى: ${titles[tab]} ✨`, { duration: 2500 });
  };

  const handleSelectReportFromModal = (reportId: string, reportName: string) => {
    setIsAllReportsModalOpen(false);
    setActiveReport(reportId);
    if (reportId === 'sales') {
      setViewTab('summary');
    }
    toast.success(`تم الانتقال إلى: ${reportName} ✨`, { duration: 2500 });
  };

  const ALL_REPORT_SECTIONS = [
    {
      category: 'المبيعات والمالية',
      items: [
        { id: 'sales', name: 'المبيعات والأرباح', icon: BarChart3, bg: 'bg-blue-100/70 dark:bg-blue-950/60 text-blue-600' },
        { id: 'profits', name: 'تفاصيل الأرباح', icon: TrendingUp, bg: 'bg-rose-100/70 dark:bg-rose-950/60 text-rose-600' },
        { id: 'top-products', name: 'الأكثر مبيعاً', icon: Flame, bg: 'bg-amber-100/70 dark:bg-amber-950/60 text-amber-600' },
        { id: 'expenses', name: 'المصاريف', icon: Banknote, bg: 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-600' },
      ]
    },
    {
      category: 'المخزون والمشتريات',
      items: [
        { id: 'inventory', name: 'المخزون وقيمته', icon: Package, bg: 'bg-orange-100/70 dark:bg-orange-950/60 text-orange-600' },
        { id: 'product-movement', name: 'حركة منتج', icon: RefreshCw, bg: 'bg-purple-100/70 dark:bg-purple-950/60 text-purple-600' },
        { id: 'inventory-stock', name: 'الجرد والفروقات', icon: ClipboardCheck, bg: 'bg-cyan-100/70 dark:bg-cyan-950/60 text-cyan-600' },
        { id: 'purchases', name: 'فواتير المشتريات', icon: FileText, bg: 'bg-sky-100/70 dark:bg-sky-950/60 text-sky-600' },
      ]
    },
    {
      category: 'العملاء والإدارة',
      items: [
        { id: 'debts', name: 'الديون والآجل', icon: Clock, bg: 'bg-yellow-100/70 dark:bg-yellow-950/60 text-amber-600' },
        { id: 'customers', name: 'دليل العملاء', icon: Users, bg: 'bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-600' },
        { id: 'daily-closing', name: 'الإغلاق اليومي', icon: Lock, bg: 'bg-pink-100/70 dark:bg-pink-950/60 text-pink-600' },
        { id: 'cashier-performance', name: 'أداء الكاشير', icon: UserCheck, bg: 'bg-teal-100/70 dark:bg-teal-950/60 text-teal-600' },
      ]
    }
  ];

  // ========== RENDER ==========

  return (
    <MainLayout>
      <div className="p-3 md:p-6 space-y-3.5 md:space-y-4 max-w-4xl mx-auto">
        {/* Header: report title only */}
        <div className="flex items-center justify-between gap-2 pt-1 pb-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">
              التقارير المالية
            </h1>
          </div>
        </div>

        {/* Quick Access Pill Row — only the four requested financial groups */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => {
              setActiveReport('sales');
              setViewTab('summary');
            }}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0 active:scale-95",
              activeReport === 'sales'
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/70 hover:bg-muted text-foreground"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            <span>المبيعات والأرباح</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveReport('inventory');
            }}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0 active:scale-95",
              activeReport === 'inventory'
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/70 hover:bg-muted text-foreground"
            )}
          >
            <Package className="w-3.5 h-3.5 text-amber-600" />
            <span>المخزون والجرد</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveReport('debts');
            }}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0 active:scale-95",
              activeReport === 'debts'
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/70 hover:bg-muted text-foreground"
            )}
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>الديون والعملاء</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveReport('expenses');
            }}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0 active:scale-95",
              activeReport === 'expenses'
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/70 hover:bg-muted text-foreground"
            )}
          >
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
            <span>المصاريف</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAllReportsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border border-border/80 bg-card hover:bg-muted text-foreground shadow-sm shrink-0 active:scale-95"
          >
            <span>+ المزيد</span>
          </button>
        </div>

        {/* Date Filter & Search Hub */}
        <div className="bg-card rounded-2xl border border-border/70 p-3 sm:p-4 space-y-3 shadow-sm">
          {/* Preset Buttons */}
          <div className="bg-muted/40 p-1 rounded-2xl flex items-center justify-between border border-border/40 gap-1 text-xs">
            <button
              type="button"
              onClick={() => handleDatePreset('today')}
              className={cn(
                "flex-1 py-1.5 px-2 text-center rounded-xl font-medium transition-all select-none text-xs",
                datePreset === 'today' ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('yesterday')}
              className={cn(
                "flex-1 py-1.5 px-2 text-center rounded-xl font-medium transition-all select-none text-xs",
                datePreset === 'yesterday' ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              أمس
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('week')}
              className={cn(
                "flex-1 py-1.5 px-2 text-center rounded-xl font-medium transition-all select-none text-xs",
                datePreset === 'week' ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              الأسبوع
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('month')}
              className={cn(
                "flex-1 py-1.5 px-2 text-center rounded-xl font-medium transition-all select-none text-xs",
                datePreset === 'month' ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              30 يوم
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('custom')}
              className={cn(
                "flex-1 py-1.5 px-2 text-center rounded-xl font-medium transition-all select-none text-xs",
                datePreset === 'custom' ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              مخصص
            </button>
          </div>

          {/* Search & Export Actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={filters.search}
                onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="بحث بالمنتج أو الرقم..."
                className="w-full h-10 pr-9 pl-3 text-xs bg-background border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/70 transition-all"
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilterDrawer(v => !v)}
              className={cn(
                "h-10 w-10 rounded-xl border-border/80 shrink-0 shadow-sm transition-all",
                showFilterDrawer && "border-primary bg-primary/10 text-primary"
              )}
              title="تصفية إضافية"
            >
              <Filter className="w-4 h-4 text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleExportExcel}
              disabled={isLoading}
              className="h-10 w-10 rounded-xl border-emerald-300 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 shrink-0 shadow-sm transition-all active:scale-95"
              title="تصدير Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleExportPDF}
              disabled={isLoading}
              className="h-10 w-10 rounded-xl border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 shrink-0 shadow-sm transition-all active:scale-95"
              title="تصدير PDF"
            >
              <FileText className="w-4 h-4" />
            </Button>
          </div>

          {/* Sub-bar: Dates & Auto update badge */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              ● محدث تلقائياً
            </span>
            <div className="flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{dateRange.from} — {dateRange.to}</span>
            </div>
          </div>
        </div>

        {/* Expandable Filter Drawer */}
        {showFilterDrawer && (
          <div className="bg-card rounded-2xl border border-border/70 p-4 space-y-3 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <span>تصفية إضافية للبيانات</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowFilterDrawer(false)} className="h-7 px-2 text-xs">
                إغلاق
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">الكاشير:</label>
                <Select value={filters.cashierId} onValueChange={v => setFilters(prev => ({ ...prev, cashierId: v }))}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع موظفي الكاشير</SelectItem>
                    {uniqueCashiers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">طريقة الدفع:</label>
                <Select value={filters.paymentType} onValueChange={v => setFilters(prev => ({ ...prev, paymentType: v }))}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الطرق</SelectItem>
                    <SelectItem value="cash">نقداً</SelectItem>
                    <SelectItem value="card">شبكة / بطاقة</SelectItem>
                    <SelectItem value="transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="debt">آجل / دين</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">الحالة:</label>
                <Select value={filters.status} onValueChange={v => setFilters(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="completed">مكتملة</SelectItem>
                    <SelectItem value="pending">معلقة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* 2x2 Executive Metrics Cards Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {/* Card 1: إجمالي المبيعات (Primary Gradient Card) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-purple-700 text-white p-3.5 sm:p-4 shadow-lg shadow-indigo-500/20 flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-xs font-semibold">إجمالي المبيعات</span>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <p className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {formatCurrency(reportData.summary.totalSales)}
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-white/90 font-medium">
              <span>+12.4% عن الفترة السابقة</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2: إجمالي الأرباح */}
          <div className="relative overflow-hidden rounded-2xl bg-card border border-border/70 p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">إجمالي الأرباح</span>
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <p className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                {formatCurrency(reportData.summary.totalProfit)}
              </p>
            </div>
            <p className="text-emerald-600 font-semibold text-[10px] sm:text-xs">
              هامش ربح: {profitMargin}%
            </p>
          </div>

          {/* Card 3: متوسط قيمة الطلب */}
          <div className="relative overflow-hidden rounded-2xl bg-card border border-border/70 p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">متوسط قيمة الطلب</span>
              <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <p className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                {formatCurrency(reportData.summary.avgOrderValue)}
              </p>
            </div>
            <p className="text-muted-foreground text-[10px] sm:text-xs">
              لكل عميل مسجل
            </p>
          </div>

          {/* Card 4: عدد الطلبات */}
          <div className="relative overflow-hidden rounded-2xl bg-card border border-border/70 p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium">عدد الطلبات</span>
              <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <p className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                {reportData.summary.totalOrders} طلب
              </p>
            </div>
            <p className="text-muted-foreground text-[10px] sm:text-xs">
              مكتملة بنجاح 100%
            </p>
          </div>
        </div>

        {/* View Mode Segmented Controls */}
        <div className="bg-muted/50 p-1 rounded-2xl flex items-center justify-around border border-border/50 text-xs">
          <button
            type="button"
            onClick={() => {
              if (activeReport !== 'sales') setActiveReport('sales');
              handleSwitchView('summary');
            }}
            className={cn(
              "flex-1 py-2 px-2 rounded-xl font-medium transition-all text-center select-none text-xs",
              activeReport === 'sales' && viewTab === 'summary'
                ? "bg-card text-primary font-black shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            ملخص بياني وإحصائي
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeReport !== 'sales') setActiveReport('sales');
              handleSwitchView('detailed');
            }}
            className={cn(
              "flex-1 py-2 px-2 rounded-xl font-medium transition-all text-center select-none text-xs",
              activeReport === 'sales' && viewTab === 'detailed'
                ? "bg-card text-primary font-black shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            كشف الفواتير التفصيلي
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeReport !== 'sales') setActiveReport('sales');
              handleSwitchView('comprehensive');
            }}
            className={cn(
              "flex-1 py-2 px-2 rounded-xl font-medium transition-all text-center select-none text-xs",
              activeReport === 'sales' && viewTab === 'comprehensive'
                ? "bg-card text-primary font-black shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            عرض تقرير شامل
          </button>
        </div>

        {/* Sub-report Active Return Banner */}
        {activeReport !== 'sales' && (
          <div className="flex items-center justify-between bg-primary/10 rounded-2xl border border-primary/20 p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveReport('sales');
                  setViewTab('summary');
                  toast.success('تمت العودة إلى ملخص المبيعات');
                }}
                className="h-8 px-3 rounded-xl border-primary/30 bg-background text-primary font-bold text-xs gap-1.5 shadow-sm"
              >
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180 text-primary" />
                <span>العودة للملخص</span>
              </Button>
              <span className="text-xs font-black text-foreground">
                التقرير المعروض: <span className="text-primary">{allReports.find(r => r.id === activeReport)?.label || activeReport}</span>
              </span>
            </div>
          </div>
        )}

        {/* Loading State - only shown if completely empty on initial load */}
        {isLoading && cloudInvoices.length === 0 && cloudProducts.length === 0 && (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <p className="text-muted-foreground text-sm">جاري تحميل البيانات...</p>
          </div>
        )}

        {/* ========== REPORT CONTENT ========== */}

        {/* Sales Report (Summary vs Detailed vs Comprehensive) */}
        {activeReport === 'sales' && (
          <div className="space-y-4">
            {viewTab === 'detailed' ? (
              <SalesDetailedReport
                invoices={cloudInvoices}
                dateRange={dateRange}
                cashierFilter={filters.cashierId}
                paymentFilter={filters.paymentType}
                statusFilter={filters.status}
                hideExportToolbar={true}
                hideHeaderCard={true}
              />
            ) : viewTab === 'comprehensive' ? (
              <div className="space-y-4">
                <ProfitTrendChart days={60} startDate={dateRange.from} endDate={dateRange.to} />
                {reportData.topCustomers.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border/70 p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span>أفضل العملاء تعاملاً</span>
                    </h3>
                    <div className="space-y-2">
                      {reportData.topCustomers.map((cust, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                          <span className="text-xs font-bold text-foreground">{cust.name}</span>
                          <div className="text-left">
                            <span className="text-xs font-black text-primary">{formatCurrency(cust.total)}</span>
                            <span className="text-[10px] text-muted-foreground mr-2">({cust.orders} طلب)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {reportData.hasData && (
                  <>
                    {/* Daily Sales Bar Chart Card (Screenshot 1) */}
                    <div className="bg-card rounded-2xl border border-border/70 p-4 space-y-3.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                          <h3 className="text-sm font-bold text-foreground">المبيعات اليومية</h3>
                        </div>
                        <div className="bg-slate-900 text-white dark:bg-slate-800 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                          <span>{formatCurrency(activeChartDay.sales).replace('$', '')}$</span>
                          <span className="text-white/70">|</span>
                          <span>القيمة: {formatCurrency(activeChartDay.sales)}</span>
                        </div>
                      </div>

                      {/* Vertical Bar Chart columns */}
                      <div className="pt-4 pb-2">
                        <div className="grid grid-cols-7 gap-2 items-end h-32 px-1">
                          {chartDays.map((day, idx) => {
                            const isSelected = day.date === activeChartDay.date;
                            const heightPct = day.sales > 0 
                              ? Math.max(16, (day.sales / maxChartSales) * 100) 
                              : 6;

                            return (
                              <div 
                                key={idx} 
                                onClick={() => setSelectedDayDate(day.date)}
                                className="flex flex-col items-center justify-end h-full gap-2 cursor-pointer group"
                              >
                                <div className="w-full flex items-end justify-center h-full">
                                  <div 
                                    className={cn(
                                      "w-7 sm:w-9 rounded-t-xl transition-all duration-500",
                                      isSelected
                                        ? "bg-gradient-to-t from-primary via-indigo-600 to-indigo-400 shadow-md shadow-primary/30"
                                        : "bg-muted/70 group-hover:bg-muted"
                                    )}
                                    style={{ height: `${heightPct}%` }}
                                  />
                                </div>
                                <span 
                                  className={cn(
                                    "text-xs font-mono transition-colors",
                                    isSelected ? "text-primary font-black" : "text-muted-foreground font-medium"
                                  )}
                                >
                                  {day.dayNum}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Chart Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                        {activeChartDay.sales > 0 && activeChartDay.date === topChartDay.date ? (
                          <span className="text-emerald-600 font-bold">أعلى مبيعات للأسبوع</span>
                        ) : (
                          <span className="text-muted-foreground">{activeChartDay.orders} طلبات</span>
                        )}
                        <span className="text-muted-foreground font-mono">
                          التاريخ المحدد: {activeChartDay.date}
                        </span>
                      </div>
                    </div>

                    {/* Top Products Card (Screenshot 1) */}
                    {reportData.topProducts.length > 0 && (
                      <div className="bg-card rounded-2xl border border-border/70 p-4 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                            <h3 className="text-sm font-bold text-foreground">أفضل المنتجات مبيعاً</h3>
                          </div>
                          <span className="text-xs text-muted-foreground font-medium">
                            {reportData.topProducts.length} أصناف
                          </span>
                        </div>

                        <div className="space-y-2 pt-1">
                          {reportData.topProducts.map((product, idx) => (
                            <div 
                              key={idx} 
                              className="bg-muted/20 hover:bg-muted/40 transition-colors p-3 rounded-2xl flex items-center justify-between border border-border/40"
                            >
                              <div className="flex items-center gap-3">
                                <span 
                                  className={cn(
                                    "w-7 h-7 rounded-xl text-xs font-black flex items-center justify-center shrink-0 shadow-sm",
                                    idx === 0 
                                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/40" 
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700"
                                  )}
                                >
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="text-xs sm:text-sm font-bold text-foreground">{product.name}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">الكمية المباعة: {product.sales} قطعة</p>
                                </div>
                              </div>
                              <div className="text-left">
                                <p className="text-xs sm:text-sm font-black text-foreground">{formatCurrency(product.revenue)}</p>
                                <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">
                                  ربح: {formatCurrency(product.profit)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReport('top-products');
                              toast.success('تم الانتقال إلى تقرير الأكثر مبيعاً ✨');
                            }}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium flex items-center justify-center gap-1.5 w-full py-1.5"
                          >
                            <span>عرض جميع المنتجات في التقرير</span>
                            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180 ltr:rotate-0" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Bottom Sheet Modal: جميع أقسام وتقارير النظام (Screenshot 2) */}
        {isAllReportsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setIsAllReportsModalOpen(false)}
            />
            <div className="relative w-full max-w-lg bg-card rounded-t-[2.5rem] sm:rounded-3xl border border-border shadow-2xl z-10 max-h-[88vh] overflow-y-auto p-5 pb-8 space-y-5 animate-in slide-in-from-bottom duration-300">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsAllReportsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className="text-center flex-1 pr-8">
                  <h2 className="text-base sm:text-lg font-black text-foreground">جميع أقسام وتقارير النظام</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">اختر القسم للوصول السريع إلى بياناته</p>
                </div>
              </div>

              {/* Categorized Sections */}
              <div className="space-y-4">
                {ALL_REPORT_SECTIONS.map((section, sIdx) => (
                  <div key={sIdx} className="space-y-2">
                    <h3 className="text-xs font-bold text-muted-foreground px-1">
                      {section.category}
                    </h3>
                    <div className="grid grid-cols-2 gap-2.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isCurrentActive = activeReport === item.id;

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectReportFromModal(item.id, item.name)}
                            className={cn(
                              "p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer active:scale-95 group",
                              isCurrentActive
                                ? "bg-primary/10 border-primary ring-1 ring-primary/20 shadow-sm"
                                : "bg-muted/30 hover:bg-muted/60 border-border/50"
                            )}
                          >
                            <span className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                              {item.name}
                            </span>
                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
                              <Icon className="w-4 h-4" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Custom Date Modal */}
        {showCustomDateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCustomDateModal(false)} />
            <div className="relative bg-card rounded-3xl border border-border p-5 max-w-sm w-full space-y-4 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <h3 className="font-bold text-sm text-foreground">تحديد الفترة الزمنية</h3>
                <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full" onClick={() => setShowCustomDateModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">من تاريخ:</label>
                  <input
                    type="date"
                    value={filters.dateRange.from}
                    onChange={e => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, from: e.target.value } }))}
                    className="w-full h-10 px-3 text-xs rounded-xl bg-background border border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">إلى تاريخ:</label>
                  <input
                    type="date"
                    value={filters.dateRange.to}
                    onChange={e => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, to: e.target.value } }))}
                    className="w-full h-10 px-3 text-xs rounded-xl bg-background border border-border text-foreground"
                  />
                </div>
              </div>
              <Button
                className="w-full rounded-xl text-xs font-bold h-10"
                onClick={() => {
                  setShowCustomDateModal(false);
                  toast.success(`تم تطبيق الفترة: من ${filters.dateRange.from} إلى ${filters.dateRange.to}`);
                }}
              >
                تطبيق الفترة
              </Button>
            </div>
          </div>
        )}

        {/* Sales Detailed direct fallback */}
        {activeReport === 'sales-detailed' && (
          <SalesDetailedReport
            invoices={cloudInvoices}
            dateRange={dateRange}
            cashierFilter={filters.cashierId}
            paymentFilter={filters.paymentType}
            statusFilter={filters.status}
            hideExportToolbar={true}
            hideHeaderCard={true}
          />
        )}

        {/* Profit Trend */}
        {activeReport === 'profits' && (
          <ProfitTrendChart days={60} startDate={dateRange.from} endDate={dateRange.to} />
        )}

        {/* Products */}
        {reportData.hasData && activeReport === 'products' && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-border/50 bg-muted/30">
              <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                {t('reports.bestProducts')}
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              {reportData.topProducts.length > 0 ? (
                <div className="space-y-2">
                  {reportData.topProducts.map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">{idx + 1}</span>
                        <span className="font-medium text-sm">{product.name}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-foreground">{formatCurrency(product.revenue)}</p>
                        <p className="text-[10px] text-muted-foreground">{product.sales} {t('reports.pieces')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">{t('reports.noProductsSold')}</p>
              )}
            </div>
          </div>
        )}

        {/* Inventory */}
        {activeReport === 'inventory' && (
          <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
            <h3 className="text-lg font-semibold mb-4">تقرير المخزون</h3>
            {cloudProducts.length > 0 ? (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-right">#</th>
                      <th className="p-2 text-right">الاسم</th>
                      <th className="p-2 text-center">الباركود</th>
                      <th className="p-2 text-center">التصنيف</th>
                      <th className="p-2 text-center">الكمية</th>
                      <th className="p-2 text-center">سعر الشراء</th>
                      <th className="p-2 text-center">سعر البيع</th>
                      <th className="p-2 text-center">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cloudProducts
                      .filter(p => {
                        if (filters.category !== 'all' && (p.category || '') !== filters.category) return false;
                        if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase()) && !(p.barcode || '').includes(filters.search)) return false;
                        return true;
                      })
                      .map((p, i) => (
                        <tr key={p.id} className="border-t hover:bg-muted/30">
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2 font-medium">{p.name}</td>
                          <td className="p-2 text-center font-mono text-xs">{p.barcode || '-'}</td>
                          <td className="p-2 text-center text-xs">{p.category || '-'}</td>
                          <td className="p-2 text-center">{p.quantity}</td>
                          <td className="p-2 text-center">{formatCurrency(p.costPrice || 0)}</td>
                          <td className="p-2 text-center">{formatCurrency(p.salePrice || 0)}</td>
                          <td className="p-2 text-center font-medium">{formatCurrency((p.salePrice || 0) * (p.quantity || 0))}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">لا توجد منتجات</p>
            )}
          </div>
        )}

        {/* Product Movement */}
        {activeReport === 'product-movement' && <ProductMovementReport dateRange={dateRange} />}

        {/* Inventory & Stock Counts / Discrepancy unified */}
        {activeReport === 'inventory-stock' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-card p-1.5 rounded-xl border border-border/70">
              <div className="text-xs font-semibold text-muted-foreground px-2">نوع التدقيق المخزني:</div>
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setStockViewMode('audit')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 select-none",
                    stockViewMode === 'audit' ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <PackageSearch className="w-3.5 h-3.5" />
                  <span>جلسات الجرد الفعلي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStockViewMode('discrepancy')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 select-none",
                    stockViewMode === 'discrepancy' ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>كاشف العجز وفروقات المخزون</span>
                </button>
              </div>
            </div>

            {stockViewMode === 'audit' ? (
              <InventoryStockReport dateRange={dateRange} />
            ) : (
              <StockDiscrepancyReport search={filters.search} warehouseId={filters.warehouseId} />
            )}
          </div>
        )}

        {/* Stock Discrepancy Detector direct fallback */}
        {activeReport === 'stock-discrepancy' && <StockDiscrepancyReport search={filters.search} warehouseId={filters.warehouseId} />}

        {/* Inventory Value */}
        {activeReport === 'inventory-value' && <InventoryValueReport dateRange={dateRange} />}

        {/* Top Products */}
        {activeReport === 'top-products' && <TopProductsReport dateRange={dateRange} />}

        {/* Purchases */}
        {activeReport === 'purchases' && <PurchaseInvoicesReport dateRange={dateRange} hideInternalExport={true} />}

        {/* Debts */}
        {activeReport === 'debts' && <DebtsReport dateRange={dateRange} hideInternalExport={true} />}

        {/* Cashier Performance */}
        {activeReport === 'cashier-performance' && (
          <CashierPerformanceReport dateRange={dateRange} invoices={cloudInvoices} isLoading={isLoading} hideInternalExport={true} />
        )}

        {/* Maintenance */}
        {activeReport === 'maintenance' && (
          <MaintenanceReport dateRange={dateRange} invoices={cloudInvoices} isLoading={isLoading} hideInternalExport={true} />
        )}

        {/* Daily Closing */}
        {activeReport === 'daily-closing' && (
          <DailyClosingReport invoices={cloudInvoices} expenses={cloudExpenses} debts={cloudDebts} isLoading={isLoading} dateRange={dateRange} hideInternalExport={true} />
        )}

        {/* Library */}
        {activeReport === 'library' && <LibraryReport dateRange={dateRange} />}

        {/* Customers */}
        {reportData.hasData && activeReport === 'customers' && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-border/50 bg-muted/30">
              <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {t('reports.bestCustomers')}
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              {reportData.topCustomers.length > 0 ? (
                <div className="space-y-2">
                  {reportData.topCustomers.map((customer, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">{idx + 1}</span>
                        <span className="font-medium text-sm">{customer.name}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-foreground">{formatCurrency(customer.total)}</p>
                        <p className="text-[10px] text-muted-foreground">{customer.orders} {t('reports.order')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">{t('reports.noCustomers')}</p>
              )}
            </div>
          </div>
        )}

        {/* Partners Report */}
        {activeReport === 'partners' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <span className="text-sm text-muted-foreground">{t('reports.selectPartnerLabel')}</span>
              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t('reports.allPartners')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('reports.allPartners')}</SelectItem>
                  {partnerReportData.allPartners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!partnerReportData.hasData && partnerReportData.allPartners.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-8 text-center">
                <UsersRound className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">لا يوجد شركاء مسجلين</p>
              </div>
            ) : (
              <>
                {partnerReportData.aggregatedCategoryProfits.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="text-lg font-semibold mb-4">الأرباح حسب الصنف</h3>
                    <div className="space-y-3">
                      {partnerReportData.aggregatedCategoryProfits.map((cat, idx) => {
                        const maxCatProfit = Math.max(...partnerReportData.aggregatedCategoryProfits.map(c => c.amount), 1);
                        return (
                          <div key={idx} className="flex items-center gap-4">
                            <span className="text-sm font-medium w-32 truncate">{cat.categoryName}</span>
                            <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                              <div className="h-full bg-gradient-to-l from-primary to-primary/60 rounded-lg transition-all duration-500" style={{ width: `${(cat.amount / maxCatProfit) * 100}%` }} />
                            </div>
                            <div className="text-left w-28">
                              <p className="text-sm font-semibold">{formatCurrency(cat.amount)}</p>
                              <p className="text-xs text-muted-foreground">{cat.count} عملية</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {partnerReportData.partners.map(partner => (
                  <div key={partner.id} className="bg-card rounded-2xl border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">{partner.name.charAt(0)}</div>
                        <div>
                          <h3 className="text-lg font-semibold">{partner.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {partner.accessAll ? `${t('reports.generalShare')}: ${partner.sharePercentage}%` : t('reports.specializedPartner')}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-bold text-green-600">{formatCurrency(partner.totalProfitInPeriod)}</p>
                        <p className="text-xs text-muted-foreground">أرباح الفترة</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
                        <p className="text-lg font-bold text-foreground">{formatCurrency(partner.currentBalance)}</p>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">رأس المال</p>
                        <p className="text-lg font-bold text-foreground">{formatCurrency(partner.currentCapital)}</p>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">أرباح معلقة</p>
                        <p className="text-lg font-bold text-amber-600">{formatCurrency(partner.pendingProfit)}</p>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">المسحوب في الفترة</p>
                        <p className="text-lg font-bold text-foreground">{formatCurrency(partner.totalWithdrawnInPeriod)}</p>
                      </div>
                    </div>

                    {partner.profitByCategory.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">توزيع الأرباح حسب الصنف</h4>
                        <div className="flex flex-wrap gap-2">
                          {partner.profitByCategory.slice(0, 5).map((cat, idx) => (
                            <span key={idx} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                              {cat.categoryName}: {formatCurrency(cat.amount)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {partner.dailyProfit.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">الأرباح اليومية</h4>
                        <div className="space-y-2">
                          {partner.dailyProfit.slice(-5).map((day, idx) => {
                            const maxDayProfit = Math.max(...partner.dailyProfit.map(d => d.amount), 1);
                            return (
                              <div key={idx} className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-20">{day.date}</span>
                                <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                                  <div className="h-full bg-green-500/70 rounded transition-all duration-500" style={{ width: `${(day.amount / maxDayProfit) * 100}%` }} />
                                </div>
                                <span className="text-xs font-semibold w-20 text-left">{formatCurrency(day.amount)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Partner Detailed */}
        {activeReport === 'partner-detailed' && <PartnerProfitDetailedReport dateRange={dateRange} />}

        {/* Distributor Reports */}
        {activeReport === 'distributor-inventory' && <DistributorInventoryReport />}
        {activeReport === 'custody-value' && <DistributorCustodyValueReport />}

        {/* Expenses */}
        {activeReport === 'expenses' && (
          <div className="space-y-6">
            {!expenseReportData.hasData ? (
              <div className="bg-card rounded-2xl border border-border p-8 text-center">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">لا توجد مصاريف في الفترة المحددة</p>
              </div>
            ) : (
              <>
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">المصاريف حسب النوع</h3>
                  <div className="space-y-3">
                    {expenseReportData.byType.map((type, idx) => {
                      const maxAmount = Math.max(...expenseReportData.byType.map(t => t.amount), 1);
                      return (
                        <div key={idx} className="flex items-center gap-4">
                          <span className="text-sm font-medium w-28 truncate">{type.type}</span>
                          <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                            <div className="h-full bg-gradient-to-l from-destructive to-destructive/60 rounded-lg transition-all duration-500" style={{ width: `${(type.amount / maxAmount) * 100}%` }} />
                          </div>
                          <div className="text-left w-28">
                            <p className="text-sm font-semibold">{formatCurrency(type.amount)}</p>
                            <p className="text-xs text-muted-foreground">{type.count} مصروف</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">توزيع المصاريف على الشركاء</h3>
                  <div className="space-y-4">
                    {expenseReportData.partnerExpenses.map((partner, idx) => (
                      <div key={idx} className="bg-muted rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">{partner.name.charAt(0)}</div>
                            <div>
                              <h4 className="font-semibold">{partner.name}</h4>
                              <p className="text-sm text-muted-foreground">{formatNumber(Math.round(partner.percentage))}% من الإجمالي</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-bold text-destructive">{formatCurrency(partner.amount)}</p>
                            <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => handleShareExpenseReport(partner.name)}>
                              <MessageCircle className="w-5 h-5" />
                            </Button>
                          </div>
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden">
                          <div className="h-full bg-destructive/70 rounded-full transition-all duration-500" style={{ width: `${partner.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {expenseReportData.dailyExpenses.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="text-lg font-semibold mb-4">المصاريف اليومية</h3>
                    <div className="space-y-3">
                      {expenseReportData.dailyExpenses.slice(-7).map((day, idx) => {
                        const maxDaily = Math.max(...expenseReportData.dailyExpenses.map(d => d.amount), 1);
                        return (
                          <div key={idx} className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground w-24">{day.date}</span>
                            <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                              <div className="h-full bg-destructive/60 rounded-lg transition-all duration-500" style={{ width: `${(day.amount / maxDaily) * 100}%` }} />
                            </div>
                            <span className="text-sm font-semibold w-24 text-left">{formatCurrency(day.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">قائمة المصاريف</h3>
                  <div className="space-y-3">
                    {expenseReportData.expenses.slice(0, 10).map((expense, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-destructive" />
                          </div>
                          <div>
                            <h4 className="font-medium">{expense.typeLabel}</h4>
                            <p className="text-xs text-muted-foreground">{expense.date}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-destructive">-{formatCurrency(expense.amount)}</p>
                          <p className="text-xs text-muted-foreground">{expense.distributions.length} شريك</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* No Data for sales-based reports */}
        {!isLoading && !reportData.hasData && ['sales', 'profits', 'products', 'customers'].includes(activeReport) && (
          <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
              <ShoppingCart className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">{t('reports.noData')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('reports.tryChangeDateRange')}</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
