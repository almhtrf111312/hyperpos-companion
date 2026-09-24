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
  Package,
  Activity,
  PackageSearch
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
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const storeType = getCurrentStoreType();
  const noInventory = isNoInventoryMode();
  const visibleSections = getVisibleSections(storeType);

  const [activeReport, setActiveReport] = useState('sales');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [salesViewMode, setSalesViewMode] = useState<'summary' | 'detailed'>('summary');
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

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
  const isDistributorStore = storeType === 'phones';

  // Report Categories for modern, organized accounting navigation
  const REPORT_CATEGORIES = useMemo(() => [
    { id: 'all', label: 'جميع التقارير' },
    { id: 'sales', label: 'المبيعات والأرباح' },
    { id: 'inventory', label: 'المخزون والجرد' },
    { id: 'purchases', label: 'المشتريات والمصاريف' },
    { id: 'debts', label: 'الديون والعملاء' },
    { id: 'admin', label: 'تقارير إدارية' },
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
          const filteredPurchases = purchases.filter(p => isDateInRange(toLocalDateString(p.createdAt), dateRange.from, dateRange.to));
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
              { header: 'طريقة الدفع', key: 'paymentType' },
              { header: 'الإجمالي', key: 'total' },
              { header: 'المدفوع', key: 'paid' },
              { header: 'المتبقي', key: 'remaining' },
              { header: 'الحالة', key: 'status' },
            ],
            data: filteredPurchases.map(p => ({
              invoiceNumber: p.invoiceNumber || p.id,
              supplierName: p.supplierName || 'مورد عام',
              date: toLocalDateString(p.createdAt),
              paymentType: p.paymentType === 'cash' ? 'نقدي' : p.paymentType === 'debt' ? 'آجل' : p.paymentType,
              total: formatCurrency(p.totalAmount || 0),
              paid: formatCurrency(p.paidAmount || 0),
              remaining: formatCurrency((p.totalAmount || 0) - (p.paidAmount || 0)),
              status: p.status === 'received' ? 'مستلم' : p.status === 'pending' ? 'معلق' : p.status,
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
              amount: formatCurrency(d.amount || 0),
              paid: formatCurrency(d.paidAmount || 0),
              remaining: formatCurrency((d.amount || 0) - (d.paidAmount || 0)),
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
          const filteredPurchases = purchases.filter(p => isDateInRange(toLocalDateString(p.createdAt), dateRange.from, dateRange.to));
          if (filteredPurchases.length === 0) { toast.error('لا توجد فواتير مشتريات للتصدير'); return; }
          await exportToExcel({
            title: 'تقرير فواتير المشتريات',
            sheetName: 'المشتريات',
            columns: [
              { header: 'رقم الفاتورة', key: 'invoiceNumber', width: 18 },
              { header: 'المورد', key: 'supplierName', width: 22 },
              { header: 'التاريخ', key: 'date', width: 15 },
              { header: 'طريقة الدفع', key: 'paymentType', width: 15 },
              { header: 'الإجمالي', key: 'total', width: 15 },
              { header: 'المدفوع', key: 'paid', width: 15 },
              { header: 'المتبقي', key: 'remaining', width: 15 },
              { header: 'الحالة', key: 'status', width: 15 },
            ],
            data: filteredPurchases.map(p => ({
              invoiceNumber: p.invoiceNumber || p.id,
              supplierName: p.supplierName || 'مورد عام',
              date: toLocalDateString(p.createdAt),
              paymentType: p.paymentType,
              total: p.totalAmount || 0,
              paid: p.paidAmount || 0,
              remaining: (p.totalAmount || 0) - (p.paidAmount || 0),
              status: p.status,
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
              amount: d.amount || 0,
              paid: d.paidAmount || 0,
              remaining: (d.amount || 0) - (d.paidAmount || 0),
              dueDate: d.dueDate || '-',
              status: d.status,
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

        {/* Category Tabs & Compact Report Selector */}
        <div className="space-y-2.5">
          {/* Main Category Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden pb-1 no-scrollbar">
            {REPORT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  if (cat.id !== 'all') {
                    const firstInCat = allReports.find(r => r.category === cat.id);
                    if (firstInCat && !allReports.filter(r => r.category === cat.id).some(r => r.id === activeReport)) {
                      setActiveReport(firstInCat.id);
                    }
                  }
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all select-none border",
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 border-primary"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border-border/60"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Sub Reports Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden py-1 no-scrollbar flex-wrap">
            {visibleReports.map((report) => {
              const Icon = report.icon;
              const isActive = activeReport === report.id;
              return (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => {
                    setActiveReport(report.id);
                    setActiveCategory(report.category);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border select-none shrink-0",
                    isActive
                      ? "bg-primary/10 text-primary border-primary font-bold shadow-sm"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/70 border-border/60"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span>{report.label}</span>
                </button>
              );
            })}
          </div>
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
        {!['daily-closing', 'cashier-performance', 'maintenance', 'debts', 'purchases', 'library', 'distributor-inventory', 'custody-value', 'partner-detailed', 'product-movement', 'inventory-stock', 'inventory-value', 'stock-discrepancy', 'top-products'].includes(activeReport) && (
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

        {/* Sales Report (Summary vs Detailed toggle) */}
        {activeReport === 'sales' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-card p-1.5 rounded-xl border border-border/70">
              <div className="text-xs font-semibold text-muted-foreground px-2">عرض تقرير المبيعات:</div>
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSalesViewMode('summary')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 select-none",
                    salesViewMode === 'summary' ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>ملخص بياني وإحصائي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSalesViewMode('detailed')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 select-none",
                    salesViewMode === 'detailed' ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>كشف الفواتير التفصيلي</span>
                </button>
              </div>
            </div>

            {salesViewMode === 'detailed' ? (
              <SalesDetailedReport
                invoices={cloudInvoices}
                dateRange={dateRange}
                cashierFilter={filters.cashierId}
                paymentFilter={filters.paymentType}
                statusFilter={filters.status}
                hideExportToolbar={true}
                hideHeaderCard={true}
              />
            ) : (
              <>
                {reportData.hasData && (
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
              </>
            )}
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
