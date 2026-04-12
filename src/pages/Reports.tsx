import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Wallet,
  Banknote,
  Receipt,
  MessageCircle,
  ClipboardList,
  Truck,
  Loader2,
  Package
} from 'lucide-react';
import { toLocalDateString, isDateInRange } from '@/lib/date-utils';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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
import {
  exportInvoicesToExcel,
  exportProductsToExcel,
  exportExpensesToExcel,
  exportPartnersToExcel,
  exportCustomersToExcel,
  exportSalesReportToExcel,
} from '@/lib/excel-export';
import {
  exportInvoicesToPDF,
  exportProductsToPDF,
  exportExpensesToPDF,
  exportPartnersToPDF,
  exportCustomersToPDF
} from '@/lib/pdf-export';
import { useLanguage } from '@/hooks/use-language';
import { MainLayout } from '@/components/layout/MainLayout';
import { EVENTS } from '@/lib/events';
import { getCurrentStoreType, getVisibleSections, isNoInventoryMode } from '@/lib/store-type-config';
import { ReportFiltersBar, ReportFilters } from '@/components/reports/ReportFiltersBar';
import { ReportToolbar } from '@/components/reports/ReportToolbar';

export default function Reports() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const storeType = getCurrentStoreType();
  const noInventory = isNoInventoryMode();
  const visibleSections = getVisibleSections(storeType);

  const [activeReport, setActiveReport] = useState('sales');
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

  // Cloud data state
  const [cloudInvoices, setCloudInvoices] = useState<Invoice[]>([]);
  const [cloudProducts, setCloudProducts] = useState<Product[]>([]);
  const [cloudCustomers, setCloudCustomers] = useState<Customer[]>([]);
  const [cloudPartners, setCloudPartners] = useState<Partner[]>([]);
  const [cloudCategories, setCloudCategories] = useState<Category[]>([]);
  const [cloudExpenses, setCloudExpenses] = useState<Expense[]>([]);
  const [cloudDebts, setCloudDebts] = useState<Debt[]>([]);

  const loadCloudData = useCallback(async () => {
    setIsLoading(true);
    try {
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
      toast.error(t('reports.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCloudData();
    const handleUpdate = () => loadCloudData();
    window.addEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.PRODUCTS_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.CUSTOMERS_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.PARTNERS_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.CATEGORIES_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
    window.addEventListener('focus', loadCloudData);
    return () => {
      window.removeEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.CUSTOMERS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.PARTNERS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.CATEGORIES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
      window.removeEventListener('focus', loadCloudData);
    };
  }, [loadCloudData]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['sales', 'profits', 'products', 'inventory', 'customers', 'partners', 'partner-detailed', 'expenses', 'distributor-inventory', 'custody-value', 'purchases', 'debts', 'cashier-performance', 'maintenance', 'daily-closing', 'library'].includes(tab)) {
      setActiveReport(tab);
    }
  }, [searchParams]);

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
  const isDistributorStore = storeType === 'phones';

  // All available reports
  const allReports = [
    { id: 'sales', label: t('reports.sales'), icon: ShoppingCart },
    { id: 'profits', label: t('reports.profits'), icon: TrendingUp },
    { id: 'products', label: t('reports.products'), icon: BarChart3 },
    ...(!noInventory ? [{ id: 'inventory', label: t('reports.inventoryReport'), icon: Package }] : []),
    { id: 'customers', label: t('reports.customers'), icon: Users },
    { id: 'partners', label: t('reports.partners'), icon: UsersRound },
    { id: 'partner-detailed', label: t('reports.partnerDetailedReport'), icon: ClipboardList },
    { id: 'expenses', label: t('reports.expenses'), icon: Receipt },
    { id: 'purchases', label: 'فواتير المشتريات', icon: FileText },
    { id: 'debts', label: 'تقرير الديون', icon: Banknote },
    { id: 'cashier-performance', label: 'أداء الكاشير', icon: Users },
    ...(visibleSections.maintenance ? [{ id: 'maintenance', label: 'خدمات الصيانة', icon: ClipboardList }] : []),
    { id: 'daily-closing', label: 'الإغلاق اليومي', icon: Calendar },
    ...(storeType === 'bookstore' ? [{ id: 'library', label: 'تقرير المكتبة', icon: BookOpen }] : []),
    ...(isDistributorStore ? [
      { id: 'distributor-inventory', label: t('reports.distributorInventory'), icon: Truck },
      { id: 'custody-value', label: t('reports.custodyValue'), icon: Wallet },
    ] : []),
  ];

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
        return { showStatus: true, showCashier: true, showPaymentType: true, showSearch: true, cashiers: uniqueCashiers };
      case 'profits':
        return { showCashier: true, showPaymentType: true, cashiers: uniqueCashiers };
      case 'products':
        return { showCategory: true, showSearch: true, categories: uniqueCategories };
      case 'inventory':
        return { showCategory: true, showSearch: true, categories: uniqueCategories };
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

    const productSalesMap: Record<string, { name: string; sales: number; revenue: number }> = {};
    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const key = item.id || item.name;
        if (!productSalesMap[key]) productSalesMap[key] = { name: item.name, sales: 0, revenue: 0 };
        productSalesMap[key].sales += item.quantity;
        productSalesMap[key].revenue += item.total;
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
      const stored = localStorage.getItem('hyperpos_settings');
      if (stored) {
        const settings = JSON.parse(stored);
        return { name: settings.storeSettings?.name || 'HyperPOS', phone: settings.storeSettings?.phone, address: settings.storeSettings?.address };
      }
    } catch { /* ignore */ }
    return { name: 'HyperPOS' };
  };

  const handleExportPDF = useCallback(async () => {
    const storeInfo = getStoreInfo();
    if (isLoading) { toast.error(t('reports.waitForData')); return; }
    try {
      switch (activeReport) {
        case 'sales':
        case 'profits': {
          const filteredInvoices = cloudInvoices.filter(inv => {
            const invDate = toLocalDateString(inv.createdAt);
            const isValidType = inv.type === 'sale' || inv.type === 'maintenance';
            return isDateInRange(invDate, dateRange.from, dateRange.to) && isValidType && inv.status !== 'refunded';
          });
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
          if (cloudProducts.length === 0) { toast.error(t('reports.noProductsToExport')); return; }
          await exportProductsToPDF(cloudProducts.map(p => ({
            name: p.name, barcode: p.barcode || '', category: p.category || 'بدون تصنيف',
            costPrice: p.costPrice || 0, salePrice: p.salePrice || 0, quantity: p.quantity || 0,
            minStockLevel: p.minStockLevel || 0,
          })), storeInfo);
          break;
        }
        case 'customers': {
          if (cloudCustomers.length === 0) { toast.error(t('reports.noCustomersToExport')); return; }
          await exportCustomersToPDF(cloudCustomers.map(c => ({
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
          const defaultInvoices = cloudInvoices.filter(inv => {
            const invDate = toLocalDateString(inv.createdAt);
            return isDateInRange(invDate, dateRange.from, dateRange.to);
          });
          if (defaultInvoices.length === 0) { toast.error(t('reports.noDataToExport')); return; }
          await exportInvoicesToPDF(defaultInvoices.map(inv => ({
            id: inv.id, customerName: inv.customerName || 'عميل نقدي', total: inv.total,
            discount: inv.discount || 0, profit: inv.profit || 0, paymentType: inv.paymentType,
            type: inv.type, createdAt: inv.createdAt, cashierName: inv.cashierName || '-',
          })), storeInfo, { start: dateRange.from, end: dateRange.to });
        }
      }
      toast.success(t('reports.exportSuccessPDF'));
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error(t('reports.exportError'));
    }
  }, [dateRange, activeReport, expenseReportData, cloudInvoices, cloudProducts, cloudCustomers, cloudPartners, isLoading, t]);

  const handleExportExcel = useCallback(async () => {
    try {
      switch (activeReport) {
        case 'sales':
        case 'profits': {
          const filteredInvoices = cloudInvoices.filter(inv => {
            const invDate = toLocalDateString(inv.createdAt);
            return isDateInRange(invDate, dateRange.from, dateRange.to) && inv.status !== 'refunded';
          });
          exportInvoicesToExcel(filteredInvoices.map(inv => ({
            id: inv.id, customerName: inv.customerName || 'عميل نقدي', total: inv.total,
            profit: inv.profit, paymentType: inv.paymentType, type: inv.type,
            createdAt: inv.createdAt, cashierName: inv.cashierName || '-',
          })), { start: dateRange.from, end: dateRange.to });
          break;
        }
        case 'products':
        case 'inventory':
          exportProductsToExcel(cloudProducts.map(p => ({
            name: p.name, barcode: p.barcode || '', barcode2: p.barcode2 || '', barcode3: p.barcode3 || '',
            variantLabel: p.variantLabel || '', category: p.category || 'بدون تصنيف',
            costPrice: p.costPrice, salePrice: p.salePrice, quantity: p.quantity,
          })));
          break;
        case 'customers':
          exportCustomersToExcel(cloudCustomers.map(c => ({
            name: c.name, phone: c.phone, totalPurchases: c.totalPurchases || 0,
            ordersCount: c.invoiceCount || 0, balance: c.totalDebt || 0,
          })));
          break;
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
          const filteredInvoices = cloudInvoices.filter(inv => {
            const invDate = toLocalDateString(inv.createdAt);
            return isDateInRange(invDate, dateRange.from, dateRange.to);
          });
          exportInvoicesToExcel(filteredInvoices.map(inv => ({
            id: inv.id, customerName: inv.customerName || 'عميل نقدي', total: inv.total,
            profit: inv.profit, paymentType: inv.paymentType, type: inv.type,
            createdAt: inv.createdAt, cashierName: inv.cashierName || '-',
          })), { start: dateRange.from, end: dateRange.to });
        }
      }
      toast.success(t('reports.exportSuccessExcel'));
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error(t('reports.exportError'));
    }
  }, [dateRange, activeReport, expenseReportData, cloudInvoices, cloudProducts, cloudCustomers, cloudPartners, t]);

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

  // ========== RENDER ==========

  return (
    <MainLayout>
      <div className="p-3 md:p-6 space-y-4 md:space-y-5">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-border p-4 md:p-5">
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="relative flex items-center justify-between rtl:pr-14 md:rtl:pr-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-foreground">{t('reports.pageTitle')}</h1>
                <p className="text-xs text-muted-foreground">{t('reports.pageSubtitle')}</p>
              </div>
            </div>
            {isLoading && (
              <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[10px]">{t('common.loading')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Report Tabs - Grid layout */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
          {allReports.map((report) => {
            const Icon = report.icon;
            const isActive = activeReport === report.id;
            return (
              <button
                key={report.id}
                onClick={() => setActiveReport(report.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[11px] font-medium transition-all border text-center",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 border-primary/30"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border-border/50"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive && "drop-shadow-sm")} />
                <span className="leading-tight line-clamp-2">{report.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filters Bar */}
        <div className="bg-card rounded-2xl border border-border p-3 md:p-4 space-y-3">
          <ReportFiltersBar
            filters={filters}
            onChange={setFilters}
            config={filterConfig}
          />
          {/* Export toolbar - unified location */}
          <div className="flex items-center justify-between border-t border-border/30 pt-3">
            <ReportToolbar
              onExportPDF={handleExportPDF}
              onExportExcel={handleExportExcel}
              disabled={isLoading}
            />
            <div className="text-[10px] text-muted-foreground">
              {dateRange.from} → {dateRange.to}
            </div>
          </div>
        </div>

        {/* Dynamic Summary Cards */}
        {!['daily-closing', 'cashier-performance', 'maintenance', 'debts', 'purchases', 'library', 'distributor-inventory', 'custody-value', 'partner-detailed'].includes(activeReport) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {summaryCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="group relative overflow-hidden bg-card rounded-xl border border-border p-3 sm:p-4 transition-all hover:shadow-md">
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", card.bg)}>
                        <Icon className={cn("w-3.5 h-3.5", card.color)} />
                      </div>
                    </div>
                    <p className="text-base sm:text-xl font-bold text-foreground">{card.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{card.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <p className="text-muted-foreground text-sm">جاري تحميل البيانات...</p>
          </div>
        )}

        {/* ========== REPORT CONTENT ========== */}

        {/* Sales Chart */}
        {reportData.hasData && activeReport === 'sales' && (
          <>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-border/50 bg-muted/30">
                <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  {t('reports.dailySales')}
                </h3>
              </div>
              <div className="p-4 sm:p-6">
                {reportData.dailySales.length > 0 ? (
                  <div className="space-y-2.5">
                    {reportData.dailySales.map((day, idx) => (
                      <div key={idx} className="flex items-center gap-3 group">
                        <span className="text-xs text-muted-foreground w-20 font-mono">{day.date}</span>
                        <div className="flex-1 h-7 bg-muted/60 rounded-lg overflow-hidden">
                          <div className="h-full bg-gradient-to-l from-primary to-primary/70 rounded-lg transition-all duration-700 ease-out group-hover:brightness-110" style={{ width: `${day.sales / maxSales * 100}%` }} />
                        </div>
                        <span className="text-xs font-semibold w-20 text-left tabular-nums">{formatCurrency(day.sales)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">{t('reports.noDailyData')}</p>
                )}
              </div>
            </div>

            {/* Top Products in sales tab */}
            {reportData.topProducts.length > 0 && (
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-border/50 bg-muted/30">
                  <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    أفضل المنتجات مبيعاً
                  </h3>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="space-y-2">
                    {reportData.topProducts.map((product, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">{idx + 1}</span>
                          <span className="font-medium text-sm">{product.name}</span>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm text-foreground">{formatCurrency(product.revenue)}</p>
                          <p className="text-[10px] text-muted-foreground">{product.sales} قطعة</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
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

        {/* Purchases */}
        {activeReport === 'purchases' && <PurchaseInvoicesReport dateRange={dateRange} />}

        {/* Debts */}
        {activeReport === 'debts' && <DebtsReport dateRange={dateRange} />}

        {/* Cashier Performance */}
        {activeReport === 'cashier-performance' && (
          <CashierPerformanceReport dateRange={dateRange} invoices={cloudInvoices} isLoading={isLoading} />
        )}

        {/* Maintenance */}
        {activeReport === 'maintenance' && (
          <MaintenanceReport dateRange={dateRange} invoices={cloudInvoices} isLoading={isLoading} />
        )}

        {/* Daily Closing */}
        {activeReport === 'daily-closing' && (
          <DailyClosingReport invoices={cloudInvoices} expenses={cloudExpenses} debts={cloudDebts} isLoading={isLoading} dateRange={dateRange} />
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
