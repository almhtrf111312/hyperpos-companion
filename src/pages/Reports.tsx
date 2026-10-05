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
  ArrowDownRight,
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
import { PageHeader } from '@/components/layout/PageHeader';

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
  const [cloudPurchases, setCloudPurchases] = useState<any[]>([]);

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

      const [invoices, products, customers, partners, categories, expenses, debts, purchases] = await Promise.all([
        loadInvoicesCloud(),
        loadProductsCloud(),
        loadCustomersCloud(),
        loadPartnersCloud(),
        loadCategoriesCloud(),
        loadExpensesCloud(),
        loadDebtsCloud(),
        loadPurchaseInvoicesCloud().catch(() => [])
      ]);
      setCloudInvoices(invoices);
      setCloudProducts(products);
      setCloudCustomers(customers);
      setCloudPartners(partners);
      setCloudCategories(categories);
      setCloudExpenses(expenses);
      setCloudDebts(debts);
      setCloudPurchases(purchases || []);
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
    window.addEventListener(EVENTS.PURCHASES_UPDATED, handleUpdate);
    return () => {
      window.removeEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.CUSTOMERS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.PARTNERS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.CATEGORIES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.PURCHASES_UPDATED, handleUpdate);
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
    // Helper function to reliably compute invoice profit with cloudProducts costPrice fallback and discounts
    const getInvoiceCalculatedMetrics = (inv: (typeof cloudInvoices)[0]) => {
      const discount = Number(inv.discount || (inv as any).discountAmount || 0);

      let itemsProfit = 0;
      let hasCalculatedItems = false;

      if (Array.isArray(inv.items) && inv.items.length > 0) {
        inv.items.forEach(item => {
          const catalogProduct = cloudProducts.find(p => p.id === item.id || (p.barcode && p.barcode === (item as any).barcode) || p.name === item.name);
          const actualCost = item.costPrice !== undefined && item.costPrice !== null
            ? Number(item.costPrice)
            : (catalogProduct?.costPrice !== undefined && catalogProduct?.costPrice !== null ? Number(catalogProduct.costPrice) : 0);

          let singleItemProfit: number;
          if (item.profit !== undefined && item.profit !== null && Number(item.profit) > 0) {
            singleItemProfit = Number(item.profit);
          } else {
            const price = Number(item.price || 0);
            const qty = Number(item.quantity || 1);
            singleItemProfit = Math.max(0, (price - actualCost) * qty);
          }
          itemsProfit += singleItemProfit;
          hasCalculatedItems = true;
        });
      }

      let profit = 0;
      if (inv.profit !== undefined && inv.profit !== null && Number(inv.profit) > 0) {
        profit = Number(inv.profit);
      } else if (hasCalculatedItems) {
        profit = Math.max(0, itemsProfit - discount);
      }

      return { profit, discount };
    };

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
      // Apply search filter
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matches = (inv.customerName || '').toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    let totalSales = 0;
    let totalProfit = 0;
    let totalDiscount = 0;

    const dailySalesMap: Record<string, { sales: number; profit: number; orders: number; discount: number }> = {};
    filteredInvoices.forEach(inv => {
      const invTotal = Number(inv.total || 0);
      const { profit, discount } = getInvoiceCalculatedMetrics(inv);
      totalSales += invTotal;
      totalProfit += profit;
      totalDiscount += discount;

      const date = toLocalDateString(inv.createdAt);
      if (!dailySalesMap[date]) dailySalesMap[date] = { sales: 0, profit: 0, orders: 0, discount: 0 };
      dailySalesMap[date].sales += invTotal;
      dailySalesMap[date].profit += profit;
      dailySalesMap[date].orders += 1;
      dailySalesMap[date].discount += discount;
    });

    const totalOrders = filteredInvoices.length;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    const allDailySales = Object.entries(dailySalesMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const dailySales = allDailySales.slice(-7);

    const productSalesMap: Record<string, { name: string; sales: number; revenue: number; profit: number }> = {};
    filteredInvoices.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach(item => {
          const key = item.id || item.name;
          if (!productSalesMap[key]) productSalesMap[key] = { name: item.name, sales: 0, revenue: 0, profit: 0 };
          const qty = Number(item.quantity || 1);
          const itemTotal = Number(item.total || (Number(item.price || 0) * qty));
          productSalesMap[key].sales += qty;
          productSalesMap[key].revenue += itemTotal;
          const catalogProduct = cloudProducts.find(p => p.id === item.id || (p.barcode && p.barcode === (item as any).barcode) || p.name === item.name);
          const actualCost = item.costPrice !== undefined && item.costPrice !== null
            ? Number(item.costPrice)
            : (catalogProduct?.costPrice !== undefined && catalogProduct?.costPrice !== null ? Number(catalogProduct.costPrice) : 0);
          const itemProfit = (item.profit !== undefined && item.profit !== null && Number(item.profit) > 0)
            ? Number(item.profit)
            : Math.max(0, (Number(item.price || 0) - actualCost) * qty);
          productSalesMap[key].profit += itemProfit;
        });
      }
    });

    const allProducts = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);
    const topProducts = allProducts.slice(0, 5);

    const customerPurchasesMap: Record<string, { name: string; orders: number; total: number }> = {};
    filteredInvoices.forEach(inv => {
      const name = inv.customerName || t('reports.cashCustomer');
      if (!customerPurchasesMap[name]) customerPurchasesMap[name] = { name, orders: 0, total: 0 };
      customerPurchasesMap[name].orders += 1;
      customerPurchasesMap[name].total += Number(inv.total || 0);
    });

    const allCustomers = Object.values(customerPurchasesMap).sort((a, b) => b.total - a.total);
    const topCustomers = allCustomers.slice(0, 5);

    const topProduct = topProducts.length > 0 ? topProducts[0].name : t('common.noData');
    const topCustomer = topCustomers.length > 0 ? topCustomers[0].name : t('common.noData');

    return {
      summary: { totalSales, totalProfit, totalDiscount, totalOrders, avgOrderValue, topProduct, topCustomer },
      dailySales, allDailySales, topProducts, allProducts, topCustomers, allCustomers,
      hasData: filteredInvoices.length > 0,
    };
  }, [dateRange, filters.status, filters.cashierId, filters.paymentType, filters.search, cloudInvoices, cloudProducts, t]);

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

  // Profit Margin & Sales Trend Calculations
  const profitMargin = useMemo(() => {
    if (reportData.summary.totalSales > 0) {
      return ((reportData.summary.totalProfit / reportData.summary.totalSales) * 100).toFixed(1);
    }
    return '0.0';
  }, [reportData.summary.totalProfit, reportData.summary.totalSales]);

  // حساب المبيعات للفترة السابقة المماثلة لمقارنة النمو الحقيقي
  const previousPeriodSales = useMemo(() => {
    try {
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      const durationMs = Math.max(86400000, toDate.getTime() - fromDate.getTime());
      const prevToDate = new Date(fromDate.getTime() - 86400000);
      const prevFromDate = new Date(prevToDate.getTime() - durationMs);
      const prevFromStr = prevFromDate.toISOString().split('T')[0];
      const prevToStr = prevToDate.toISOString().split('T')[0];

      return cloudInvoices
        .filter(inv => {
          const invDate = toLocalDateString(inv.createdAt);
          return (inv.type === 'sale' || inv.type === 'maintenance') &&
            inv.status !== 'refunded' &&
            isDateInRange(invDate, prevFromStr, prevToStr);
        })
        .reduce((sum, inv) => sum + inv.total, 0);
    } catch {
      return 0;
    }
  }, [dateRange, cloudInvoices]);

  const salesTrend = useMemo(() => {
    if (previousPeriodSales <= 0) {
      if (reportData.summary.totalSales > 0) {
        return { isUp: true, label: `${reportData.summary.totalOrders} مبيعات في الفترة` };
      }
      return { isUp: true, label: '0% عن الفترة السابقة' };
    }
    const diff = ((reportData.summary.totalSales - previousPeriodSales) / previousPeriodSales) * 100;
    const isUp = diff >= 0;
    return {
      isUp,
      label: `${isUp ? '+' : ''}${diff.toFixed(1)}% عن الفترة السابقة`,
    };
  }, [reportData.summary.totalSales, reportData.summary.totalOrders, previousPeriodSales]);

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

  const getFilteredDebtsForReport = useCallback(() => {
    return cloudDebts.filter(d => {
      if (filters.status !== 'all' && d.status !== filters.status) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!(d.customerName || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [cloudDebts, filters]);

  const getFilteredPurchasesForReport = useCallback(() => {
    return cloudPurchases.filter(p => {
      const pDate = toLocalDateString(p.created_at || p.invoice_date);
      if (!isDateInRange(pDate, dateRange.from, dateRange.to)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const num = (p.invoice_number || p.id || '').toLowerCase();
        const sup = (p.supplier_name || '').toLowerCase();
        if (!num.includes(q) && !sup.includes(q)) return false;
      }
      return true;
    });
  }, [cloudPurchases, dateRange, filters]);

  const getFilteredExpensesForReport = useCallback(() => {
    return expenseReportData.expenses.filter(e => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const label = (e.typeLabel || '').toLowerCase();
        const notes = (e.notes || '').toLowerCase();
        if (!label.includes(q) && !notes.includes(q)) return false;
      }
      return true;
    });
  }, [expenseReportData.expenses, filters]);

  // ========== DYNAMIC SUMMARY CARDS ==========
  const summaryCards = useMemo(() => {
    switch (activeReport) {
      case 'sales':
        return [
          {
            icon: DollarSign,
            value: formatCurrency(reportData.summary.totalSales),
            label: 'إجمالي المبيعات',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: salesTrend.label,
          },
          {
            icon: TrendingUp,
            value: formatCurrency(reportData.summary.totalProfit),
            label: 'صافي الأرباح',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: `هامش ربح: ${profitMargin}%`,
          },
          {
            icon: ShoppingBag,
            value: `${reportData.summary.totalOrders} طلب`,
            label: 'عدد الطلبات',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: reportData.summary.totalOrders > 0 ? `${reportData.summary.totalOrders} طلب مكتمل` : 'لا توجد طلبات',
          },
          {
            icon: Clock,
            value: formatCurrency(reportData.summary.avgOrderValue),
            label: 'متوسط قيمة الطلب',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: reportData.allCustomers.length > 0 ? `${reportData.allCustomers.length} عميل بالفترة` : 'لكل طلب مسجل',
          },
        ];

      case 'profits':
        return [
          {
            icon: TrendingUp,
            value: formatCurrency(reportData.summary.totalProfit),
            label: 'إجمالي صافي الأرباح',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: 'صافي الربح المحقق',
          },
          {
            icon: PieChart,
            value: `${profitMargin}%`,
            label: 'نسبة هامش الربح',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: 'معدل الربحية العام',
          },
          {
            icon: DollarSign,
            value: formatCurrency(reportData.summary.totalSales),
            label: 'المبيعات المولدة للربح',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: 'إجمالي إيراد المبيعات',
          },
          {
            icon: Coins,
            value: formatCurrency(reportData.summary.totalOrders > 0 ? reportData.summary.totalProfit / reportData.summary.totalOrders : 0),
            label: 'متوسط الربح/فاتورة',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: 'متوسط عائد الفاتورة',
          },
        ];

      case 'inventory': {
        const prods = getFilteredProductsForReport();
        const costValue = prods.reduce((s, p) => s + ((p.costPrice || 0) * (p.quantity || 0)), 0);
        const saleValue = prods.reduce((s, p) => s + ((p.salePrice || 0) * (p.quantity || 0)), 0);
        const totalQty = prods.reduce((s, p) => s + (p.quantity || 0), 0);
        return [
          {
            icon: DollarSign,
            value: formatCurrency(costValue),
            label: 'قيمة المخزون (بالتكلفة)',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: 'سعر الشراء الفعلي',
          },
          {
            icon: TrendingUp,
            value: formatCurrency(saleValue),
            label: 'القيمة البيعية المتوقعة',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: 'عائد البيع المتوقع',
          },
          {
            icon: Package,
            value: `${prods.length} صنف`,
            label: 'إجمالي عدد الأصناف',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: 'الأصناف المسجلة (SKU)',
          },
          {
            icon: ShoppingCart,
            value: `${formatNumber(totalQty)} قطعة`,
            label: 'إجمالي القطع المتوفرة',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: 'إجمالي الوحدات بالمخزن',
          },
        ];
      }

      case 'inventory-stock':
      case 'stock-discrepancy': {
        const prods = getFilteredProductsForReport();
        const lowStock = prods.filter(p => (p.quantity || 0) <= (p.minStockLevel || 5) && (p.quantity || 0) > 0).length;
        const outStock = prods.filter(p => (p.quantity || 0) <= 0).length;
        const totalQty = prods.reduce((s, p) => s + (p.quantity || 0), 0);
        const costValue = prods.reduce((s, p) => s + ((p.costPrice || 0) * (p.quantity || 0)), 0);
        return [
          {
            icon: PackageSearch,
            value: `${prods.length} صنف`,
            label: 'إجمالي الأصناف المجرودة',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: 'أصناف مشمولة بالجرد',
          },
          {
            icon: Clock,
            value: `${lowStock} صنف`,
            label: 'أصناف قاربت على النفاذ',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: 'الكمية ≤ الحد الأدنى',
          },
          {
            icon: X,
            value: `${outStock} صنف`,
            label: 'أصناف نفدت بالكامل',
            color: 'text-rose-600',
            bg: 'bg-rose-500/10',
            subtext: 'الرصيد بالمخزن = 0',
          },
          {
            icon: ShoppingBag,
            value: `${formatNumber(totalQty)} قطعة`,
            label: 'إجمالي كميات الجرد',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: `بقيمة: ${formatCurrency(costValue)}`,
          },
        ];
      }

      case 'product-movement':
      case 'top-products': {
        const totalSold = reportData.allProducts.reduce((sum, p) => sum + p.sales, 0);
        const totalRev = reportData.allProducts.reduce((sum, p) => sum + p.revenue, 0);
        const topQtyProd = reportData.allProducts.slice().sort((a, b) => b.sales - a.sales)[0]?.name || 'لا يوجد';
        const topProfitProd = reportData.allProducts.slice().sort((a, b) => b.profit - a.profit)[0]?.name || 'لا يوجد';
        return [
          {
            icon: ShoppingBag,
            value: `${formatNumber(totalSold)} قطعة`,
            label: 'إجمالي القطع المباعة',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: 'حركة المبيعات بالفترة',
          },
          {
            icon: DollarSign,
            value: formatCurrency(totalRev),
            label: 'عائد مبيعات المنتجات',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: 'إجمالي إيراد الأصناف',
          },
          {
            icon: Flame,
            value: topQtyProd,
            label: 'الصنف الأكثر طلباً',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: 'الأعلى طلباً بالكمية',
          },
          {
            icon: TrendingUp,
            value: topProfitProd,
            label: 'الصنف الأعلى ربحاً',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: 'الأعلى تحقيقاً للأرباح',
          },
        ];
      }

      case 'debts': {
        const debts = getFilteredDebtsForReport();
        const remDebt = debts.reduce((s, d) => s + (d.remainingDebt ?? Math.max(0, (d.totalDebt || 0) - (d.totalPaid || 0))), 0);
        const paidDebt = debts.reduce((s, d) => s + (d.totalPaid || 0), 0);
        const origDebt = debts.reduce((s, d) => s + (d.totalDebt || 0), 0);
        const debtorCount = new Set(debts.filter(d => (d.remainingDebt ?? Math.max(0, (d.totalDebt || 0) - (d.totalPaid || 0))) > 0).map(d => d.customerId || d.customerName)).size;
        return [
          {
            icon: Banknote,
            value: formatCurrency(remDebt),
            label: 'إجمالي الديون القائمة',
            color: 'text-rose-600',
            bg: 'bg-rose-500/10',
            subtext: 'مستحقات واجبة التحصيل',
          },
          {
            icon: UserCheck,
            value: formatCurrency(paidDebt),
            label: 'إجمالي المسدد',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: 'دفعات تم تحصيلها',
          },
          {
            icon: DollarSign,
            value: formatCurrency(origDebt),
            label: 'إجمالي أصل الدين',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: 'إجمالي المديونيات المسجلة',
          },
          {
            icon: Users,
            value: `${debtorCount} عميل`,
            label: 'عدد العملاء المدينين',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: 'عملاء لديهم رصيد مستحق',
          },
        ];
      }

      case 'customers':
        return [
          {
            icon: Users,
            value: `${cloudCustomers.length} عميل`,
            label: 'إجمالي عدد العملاء',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: 'مسجلين بالدليل',
          },
          {
            icon: UserCheck,
            value: `${reportData.allCustomers.length} عميل`,
            label: 'العملاء النشطون بالفترة',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: 'أجروا طلبات خلال الفترة',
          },
          {
            icon: DollarSign,
            value: formatCurrency(reportData.summary.totalSales),
            label: 'إجمالي مشتريات العملاء',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: 'إيراد المبيعات بالفترة',
          },
          {
            icon: Sparkles,
            value: reportData.summary.topCustomer,
            label: 'العميل الأكثر شراءً',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: 'الأعلى إنفاقاً بالفترة',
          },
        ];

      case 'purchases': {
        const purchs = getFilteredPurchasesForReport();
        const totalPurch = purchs.reduce((s, p) => s + (p.actual_grand_total || p.expected_grand_total || 0), 0);
        const purchCount = purchs.length;
        const suppCount = new Set(purchs.map(p => p.supplier_name || p.supplier_id || 'عام')).size;
        const avgPurch = purchCount > 0 ? totalPurch / purchCount : 0;
        return [
          {
            icon: FileText,
            value: formatCurrency(totalPurch),
            label: 'إجمالي المشتريات',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: 'إجمالي فواتير التوريد',
          },
          {
            icon: ShoppingCart,
            value: `${purchCount} فاتورة`,
            label: 'عدد فواتير الشراء',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: 'فواتير توريد مستلمة',
          },
          {
            icon: Truck,
            value: `${suppCount} مورد`,
            label: 'عدد الموردين',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: 'تم التعامل معهم بالفترة',
          },
          {
            icon: Clock,
            value: formatCurrency(avgPurch),
            label: 'متوسط قيمة الفاتورة',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: 'متوسط تكلفة التوريد',
          },
        ];
      }

      case 'expenses': {
        const exps = getFilteredExpensesForReport();
        const totExp = exps.reduce((s, e) => s + (e.amount || 0), 0);
        const topExp = expenseReportData.byType[0];
        const daysBetween = Math.max(1, Math.round((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const avgDailyExp = totExp / daysBetween;
        return [
          {
            icon: Receipt,
            value: formatCurrency(totExp),
            label: 'إجمالي المصاريف',
            color: 'text-destructive',
            bg: 'bg-destructive/10',
            subtext: 'إجمالي النفقات بالفترة',
          },
          {
            icon: FileText,
            value: `${exps.length} سند`,
            label: 'عدد سندات الصرف',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: 'سندات صرف مسجلة',
          },
          {
            icon: TrendingUp,
            value: topExp ? topExp.type : 'لا يوجد',
            label: 'أكبر بند مصروف',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: topExp ? `بقيمة: ${formatCurrency(topExp.amount)}` : 'لا توجد مصاريف',
          },
          {
            icon: Calendar,
            value: formatCurrency(avgDailyExp),
            label: 'متوسط الصرف اليومي',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: 'معدل الإنفاق اليومي',
          },
        ];
      }

      case 'partners':
      case 'partner-detailed':
        return [
          {
            icon: TrendingUp,
            value: formatCurrency(partnerReportData.summary.totalProfitInPeriod),
            label: 'أرباح الشركاء بالفترة',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: 'صافي نصيب الشركاء',
          },
          {
            icon: Wallet,
            value: formatCurrency(partnerReportData.summary.totalCurrentBalance),
            label: 'إجمالي الرصيد المستحق',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: 'أرصدة الشركاء الحالية',
          },
          {
            icon: Banknote,
            value: formatCurrency(partnerReportData.summary.totalWithdrawnInPeriod),
            label: 'المسحوبات بالفترة',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: 'دفعات مسحوبة للشركاء',
          },
          {
            icon: UsersRound,
            value: `${partnerReportData.summary.partnersCount} شريك`,
            label: 'عدد الشركاء',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: 'شركاء مسجلون بالنظام',
          },
        ];

      case 'daily-closing': {
        const targetDate = selectedDayDate || dateRange.to || new Date().toISOString().split('T')[0];
        const dayData = reportData.allDailySales.find(d => d.date === targetDate);
        const dSales = dayData?.sales || 0;
        const dProfit = dayData?.profit || 0;
        const dOrders = dayData?.orders || 0;
        const dAvg = dOrders > 0 ? dSales / dOrders : 0;
        return [
          {
            icon: DollarSign,
            value: formatCurrency(dSales),
            label: 'مبيعات اليوم',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: `تاريخ: ${targetDate}`,
          },
          {
            icon: TrendingUp,
            value: formatCurrency(dProfit),
            label: 'صافي أرباح اليوم',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: dSales > 0 ? `هامش ربح: ${Math.round((dProfit / dSales) * 100)}%` : 'صافي ربح اليوم',
          },
          {
            icon: ShoppingBag,
            value: `${dOrders} فاتورة`,
            label: 'عدد فواتير اليوم',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: 'فواتير اليوم المسجلة',
          },
          {
            icon: Clock,
            value: formatCurrency(dAvg),
            label: 'متوسط قيمة الفاتورة',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: 'متوسط الفاتورة اليومية',
          },
        ];
      }

      case 'cashier-performance': {
        const invs = getFilteredInvoicesForReport();
        const cMap = new Map<string, { count: number; total: number; profit: number }>();
        invs.forEach(inv => {
          const name = inv.cashierName || 'كاشير عام';
          const cur = cMap.get(name) || { count: 0, total: 0, profit: 0 };
          cur.count += 1;
          cur.total += inv.total || 0;
          cur.profit += inv.profit || 0;
          cMap.set(name, cur);
        });
        const sorted = Array.from(cMap.entries()).sort((a, b) => b[1].total - a[1].total);
        const topC = sorted[0];
        const topCName = topC ? topC[0] : 'لا يوجد';
        const topCOrders = topC ? topC[1].count : 0;
        const activeCCount = sorted.length;
        const totCSales = sorted.reduce((s, c) => s + c[1].total, 0);
        const avgC = activeCCount > 0 ? totCSales / activeCCount : 0;
        return [
          {
            icon: UserCheck,
            value: topCName,
            label: 'أعلى كاشير مبيعاً',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: topC ? `مبيعات: ${formatCurrency(topC[1].total)}` : 'لا توجد بيانات',
          },
          {
            icon: ShoppingBag,
            value: `${topCOrders} فاتورة`,
            label: 'فواتير الكاشير الأعلى',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: 'أعلى إنجاز مبيعات',
          },
          {
            icon: Users,
            value: `${activeCCount} كاشير`,
            label: 'إجمالي الكاشيرات النشطين',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: 'باشروا البيع بالفترة',
          },
          {
            icon: DollarSign,
            value: formatCurrency(avgC),
            label: 'متوسط المبيعات لكل كاشير',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: 'معدل مبيعات الموظف',
          },
        ];
      }

      case 'maintenance': {
        const maintInvs = cloudInvoices.filter(inv => inv.type === 'maintenance' && isDateInRange(toLocalDateString(inv.createdAt), dateRange.from, dateRange.to));
        const mTot = maintInvs.reduce((s, inv) => s + inv.total, 0);
        const mProf = maintInvs.reduce((s, inv) => s + (inv.profit || 0), 0);
        const mCount = maintInvs.length;
        const mAvg = mCount > 0 ? mTot / mCount : 0;
        return [
          {
            icon: DollarSign,
            value: formatCurrency(mTot),
            label: 'إجمالي خدمات الصيانة',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: 'عائد الصيانة بالفترة',
          },
          {
            icon: TrendingUp,
            value: formatCurrency(mProf),
            label: 'صافي أرباح الصيانة',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: mTot > 0 ? `هامش ربح: ${Math.round((mProf / mTot) * 100)}%` : 'أرباح الصيانة',
          },
          {
            icon: ShoppingBag,
            value: `${mCount} فاتورة`,
            label: 'عدد فواتير الصيانة',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: 'أجهزة مستلمة/مصلحة',
          },
          {
            icon: Clock,
            value: formatCurrency(mAvg),
            label: 'متوسط فاتورة الصيانة',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: 'متوسط تكلفة الخدمة',
          },
        ];
      }

      default:
        return [
          {
            icon: DollarSign,
            value: formatCurrency(reportData.summary.totalSales),
            label: 'إجمالي المبيعات',
            color: 'text-primary',
            bg: 'bg-primary/10',
            subtext: salesTrend.label,
          },
          {
            icon: TrendingUp,
            value: formatCurrency(reportData.summary.totalProfit),
            label: 'صافي الأرباح',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            subtext: `هامش ربح: ${profitMargin}%`,
          },
          {
            icon: ShoppingBag,
            value: `${reportData.summary.totalOrders} طلب`,
            label: 'عدد الطلبات',
            color: 'text-blue-600',
            bg: 'bg-blue-500/10',
            subtext: reportData.summary.totalOrders > 0 ? `${reportData.summary.totalOrders} طلب مكتمل` : 'لا توجد طلبات',
          },
          {
            icon: Clock,
            value: formatCurrency(reportData.summary.avgOrderValue),
            label: 'متوسط قيمة الطلب',
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            subtext: reportData.allCustomers.length > 0 ? `${reportData.allCustomers.length} عميل بالفترة` : 'لكل طلب مسجل',
          },
        ];
    }
  }, [
    activeReport,
    reportData,
    profitMargin,
    salesTrend,
    getFilteredProductsForReport,
    getFilteredDebtsForReport,
    cloudCustomers,
    getFilteredPurchasesForReport,
    getFilteredExpensesForReport,
    expenseReportData,
    partnerReportData,
    selectedDayDate,
    dateRange,
    cloudInvoices,
    getFilteredInvoicesForReport,
  ]);

  const handleExportPDF = useCallback(async () => {
    const storeInfo = getStoreInfo();
    if (isLoading) { toast.error(t('reports.waitForData')); return; }
    const currentSummary = summaryCards.map(c => ({ label: c.label, value: c.value }));
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
          })), storeInfo, { start: dateRange.from, end: dateRange.to }, currentSummary);
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
          })), storeInfo, currentSummary);
          break;
        }
        case 'inventory-stock':
        case 'stock-discrepancy': {
          const filteredProducts = getFilteredProductsForReport();
          if (filteredProducts.length === 0) { toast.error(t('reports.noProductsToExport')); return; }
          await exportToPDF({
            title: 'كشف الجرد الفعلي للمخزون',
            subtitle: `الفترة: ${dateRange.from} إلى ${dateRange.to}`,
            storeName: storeInfo.name,
            storePhone: storeInfo.phone,
            storeAddress: storeInfo.address,
            summary: currentSummary,
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
          const filteredPurchases = getFilteredPurchasesForReport();
          if (filteredPurchases.length === 0) { toast.error('لا توجد فواتير مشتريات في الفترة المحددة للتصدير'); return; }
          await exportToPDF({
            title: 'تقرير فواتير المشتريات',
            subtitle: `الفترة من ${dateRange.from} إلى ${dateRange.to}`,
            storeName: storeInfo.name,
            storePhone: storeInfo.phone,
            storeAddress: storeInfo.address,
            summary: currentSummary,
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
          const filteredDebts = getFilteredDebtsForReport();
          if (filteredDebts.length === 0) { toast.error('لا توجد ديون للتصدير'); return; }
          const totalDebtVal = filteredDebts.reduce((s, d) => s + (d.totalDebt || 0), 0);
          const totalPaidVal = filteredDebts.reduce((s, d) => s + (d.totalPaid || 0), 0);
          const remainingDebtVal = filteredDebts.reduce((s, d) => s + (d.remainingDebt ?? Math.max(0, (d.totalDebt || 0) - (d.totalPaid || 0))), 0);
          await exportToPDF({
            title: 'تقرير الديون والبيع المؤجل',
            reportType: 'تقرير الديون والبيع المؤجل',
            subtitle: `تاريخ التقرير: ${dateRange.to}`,
            storeName: storeInfo.name,
            storePhone: storeInfo.phone,
            storeAddress: storeInfo.address,
            summary: [
              { label: 'إجمالي الديون', value: totalDebtVal },
              { label: 'إجمالي المسدد', value: totalPaidVal },
              { label: 'المتبقي للتحصيل', value: remainingDebtVal },
              { label: 'عدد الديون', value: filteredDebts.length },
            ],
            columns: [
              { header: 'العميل', key: 'customerName' },
              { header: 'المبلغ الإجمالي', key: 'totalDebt' },
              { header: 'المسدد', key: 'totalPaid' },
              { header: 'المتبقي', key: 'remainingDebt' },
              { header: 'تاريخ الاستحقاق', key: 'dueDate' },
              { header: 'الحالة', key: 'status_label' },
            ],
            data: filteredDebts.map(d => ({
              customerName: d.customerName || 'عميل',
              totalDebt: d.totalDebt || 0,
              totalPaid: d.totalPaid || 0,
              remainingDebt: d.remainingDebt ?? Math.max(0, (d.totalDebt || 0) - (d.totalPaid || 0)),
              dueDate: d.dueDate || '-',
              status_label: d.status === 'fully_paid' ? 'مسدد' : d.status === 'partially_paid' ? 'مسدد جزئياً' : d.status === 'overdue' ? 'متأخر' : 'مستحق',
            })),
            totals: {
              totalDebt: totalDebtVal,
              totalPaid: totalPaidVal,
              remainingDebt: remainingDebtVal,
            },
            fileName: `debts-report-${dateRange.to}.pdf`,
            orientation: 'landscape',
          });
          break;
        }
        case 'cashier-performance': {
          const invoicesInRange = getFilteredInvoicesForReport();
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
            summary: currentSummary,
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
            summary: currentSummary,
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
        case 'top-products':
        case 'product-movement': {
          if (reportData.allProducts.length === 0) { toast.error(t('reports.noProductsSold')); return; }
          await exportToPDF({
            title: activeReport === 'product-movement' ? 'تقرير حركة المنتجات' : 'تقرير المنتجات الأكثر مبيعاً',
            subtitle: `الفترة من ${dateRange.from} إلى ${dateRange.to}`,
            storeName: storeInfo.name,
            storePhone: storeInfo.phone,
            storeAddress: storeInfo.address,
            summary: currentSummary,
            columns: [
              { header: 'الترتيب', key: 'rank' },
              { header: 'اسم المنتج', key: 'name' },
              { header: 'الكمية المباعة', key: 'sales' },
              { header: 'إجمالي الإيراد', key: 'revenue' },
              { header: 'إجمالي الأرباح', key: 'profit' },
            ],
            data: reportData.allProducts.map((p, idx) => ({
              rank: idx + 1,
              name: p.name,
              sales: `${p.sales} قطعة`,
              revenue: formatCurrency(p.revenue),
              profit: formatCurrency(p.profit),
            })),
            fileName: `${activeReport}-${dateRange.from}.pdf`,
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
            summary: currentSummary,
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
          })), storeInfo, currentSummary);
          break;
        }
        case 'partners':
        case 'partner-detailed': {
          if (cloudPartners.length === 0) { toast.error(t('reports.noPartnersToExport')); return; }
          await exportPartnersToPDF(cloudPartners.map(p => ({
            name: p.name, sharePercentage: p.sharePercentage || 0, currentCapital: p.currentCapital || 0,
            totalProfit: p.totalProfitEarned || 0, totalWithdrawn: p.totalWithdrawn || 0, currentBalance: p.currentBalance || 0,
          })), storeInfo, currentSummary);
          break;
        }
        case 'expenses': {
          const filteredExpenses = getFilteredExpensesForReport();
          if (filteredExpenses.length === 0) { toast.error(t('reports.noExpensesToExport')); return; }
          await exportExpensesToPDF(filteredExpenses.map(e => ({
            id: e.id, type: e.type, typeLabel: e.typeLabel, amount: e.amount || 0,
            date: e.date, notes: e.notes || '',
          })), storeInfo, { start: dateRange.from, end: dateRange.to }, currentSummary);
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
  }, [
    dateRange,
    activeReport,
    cloudPartners,
    cloudInvoices,
    reportData,
    isLoading,
    t,
    summaryCards,
    getFilteredInvoicesForReport,
    getFilteredProductsForReport,
    getFilteredCustomersForReport,
    getFilteredDebtsForReport,
    getFilteredPurchasesForReport,
    getFilteredExpensesForReport,
  ]);

  const handleExportExcel = useCallback(async () => {
    const currentSummary = summaryCards.map(c => ({ label: c.label, value: c.value }));
    try {
      switch (activeReport) {
        case 'sales':
        case 'profits': {
          const filteredInvoices = getFilteredInvoicesForReport();
          if (filteredInvoices.length === 0) { toast.error(t('reports.noDataToExport')); return; }
          await exportInvoicesToExcel(filteredInvoices.map(inv => ({
            id: inv.id, customerName: inv.customerName || 'عميل نقدي', total: inv.total,
            profit: inv.profit, paymentType: inv.paymentType, type: inv.type,
            createdAt: inv.createdAt, cashierName: inv.cashierName || '-',
          })), { start: dateRange.from, end: dateRange.to }, currentSummary);
          break;
        }
        case 'products':
        case 'inventory': {
          const filteredProducts = getFilteredProductsForReport();
          if (filteredProducts.length === 0) { toast.error(t('reports.noProductsToExport')); return; }
          await exportProductsToExcel(filteredProducts, currentSummary);
          break;
        }
        case 'inventory-stock':
        case 'stock-discrepancy': {
          const filteredProducts = getFilteredProductsForReport();
          if (filteredProducts.length === 0) { toast.error(t('reports.noProductsToExport')); return; }
          await exportToExcel({
            title: 'كشف الجرد الفعلي للمخزون',
            sheetName: 'الجرد الفعلي',
            summary: currentSummary,
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
          const filteredPurchases = getFilteredPurchasesForReport();
          if (filteredPurchases.length === 0) { toast.error('لا توجد فواتير مشتريات للتصدير'); return; }
          await exportToExcel({
            title: 'تقرير فواتير المشتريات',
            sheetName: 'المشتريات',
            summary: currentSummary,
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
          const filteredDebts = getFilteredDebtsForReport();
          if (filteredDebts.length === 0) { toast.error('لا توجد ديون للتصدير'); return; }
          const totalDebtVal = filteredDebts.reduce((s, d) => s + (d.totalDebt || 0), 0);
          const totalPaidVal = filteredDebts.reduce((s, d) => s + (d.totalPaid || 0), 0);
          const remainingDebtVal = filteredDebts.reduce((s, d) => s + (d.remainingDebt ?? Math.max(0, (d.totalDebt || 0) - (d.totalPaid || 0))), 0);
          await exportToExcel({
            title: 'تقرير الديون والبيع المؤجل',
            sheetName: 'الديون',
            summary: [
              { label: 'إجمالي الديون', value: totalDebtVal },
              { label: 'إجمالي المسدد', value: totalPaidVal },
              { label: 'المتبقي للتحصيل', value: remainingDebtVal },
              { label: 'عدد الديون', value: filteredDebts.length },
            ],
            columns: [
              { header: 'العميل', key: 'customerName', width: 22 },
              { header: 'المبلغ الإجمالي', key: 'totalDebt', width: 15 },
              { header: 'المسدد', key: 'totalPaid', width: 15 },
              { header: 'المتبقي', key: 'remainingDebt', width: 15 },
              { header: 'تاريخ الاستحقاق', key: 'dueDate', width: 15 },
              { header: 'الحالة', key: 'status_label', width: 15 },
            ],
            data: filteredDebts.map(d => ({
              customerName: d.customerName || 'عميل',
              totalDebt: d.totalDebt || 0,
              totalPaid: d.totalPaid || 0,
              remainingDebt: d.remainingDebt ?? Math.max(0, (d.totalDebt || 0) - (d.totalPaid || 0)),
              dueDate: d.dueDate || '-',
              status_label: d.status === 'fully_paid' ? 'مسدد' : d.status === 'partially_paid' ? 'مسدد جزئياً' : d.status === 'overdue' ? 'متأخر' : 'مستحق',
            })),
            totals: {
              totalDebt: totalDebtVal,
              totalPaid: totalPaidVal,
              remainingDebt: remainingDebtVal,
            },
            fileName: `debts-${dateRange.to}.xlsx`,
          });
          break;
        }
        case 'cashier-performance': {
          const invoicesInRange = getFilteredInvoicesForReport();
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
            summary: currentSummary,
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
            summary: currentSummary,
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
        case 'top-products':
        case 'product-movement': {
          if (reportData.allProducts.length === 0) { toast.error(t('reports.noProductsSold')); return; }
          await exportToExcel({
            title: activeReport === 'product-movement' ? 'حركة المنتجات' : 'المنتجات الأكثر مبيعاً',
            sheetName: 'المنتجات',
            summary: currentSummary,
            columns: [
              { header: 'الترتيب', key: 'rank', width: 10 },
              { header: 'اسم المنتج', key: 'name', width: 25 },
              { header: 'الكمية المباعة', key: 'sales', width: 15 },
              { header: 'إجمالي الإيراد', key: 'revenue', width: 18 },
              { header: 'إجمالي الأرباح', key: 'profit', width: 18 },
            ],
            data: reportData.allProducts.map((p, idx) => ({
              rank: idx + 1,
              name: p.name,
              sales: p.sales,
              revenue: p.revenue,
              profit: p.profit,
            })),
            fileName: `${activeReport}-${dateRange.from}.xlsx`,
          });
          break;
        }
        case 'daily-closing': {
          const salesInRange = reportData.dailySales;
          if (salesInRange.length === 0) { toast.error(t('reports.noDataToExport')); return; }
          await exportToExcel({
            title: 'تقرير الإغلاق اليومي',
            sheetName: 'الإغلاق اليومي',
            summary: currentSummary,
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
          await exportCustomersToExcel(filteredCustomers.map(c => ({
            name: c.name, phone: c.phone, totalPurchases: c.totalPurchases || 0,
            ordersCount: c.invoiceCount || 0, balance: c.totalDebt || 0,
          })), currentSummary);
          break;
        }
        case 'partners':
        case 'partner-detailed':
          await exportPartnersToExcel(cloudPartners.map(p => ({
            name: p.name, sharePercentage: p.sharePercentage, initialCapital: p.initialCapital,
            currentCapital: p.currentCapital, totalProfit: p.totalProfitEarned,
            totalWithdrawn: p.totalWithdrawn, currentBalance: p.currentBalance,
          })), currentSummary);
          break;
        case 'expenses': {
          const filteredExpenses = getFilteredExpensesForReport();
          await exportExpensesToExcel(filteredExpenses.map(e => ({
            id: e.id, type: e.type, amount: e.amount, date: e.date, notes: e.notes,
          })), { start: dateRange.from, end: dateRange.to }, currentSummary);
          break;
        }
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
  }, [
    dateRange,
    activeReport,
    cloudPartners,
    cloudInvoices,
    reportData,
    t,
    summaryCards,
    getFilteredInvoicesForReport,
    getFilteredProductsForReport,
    getFilteredCustomersForReport,
    getFilteredDebtsForReport,
    getFilteredPurchasesForReport,
    getFilteredExpensesForReport,
  ]);

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
    let validEndDate: Date;
    if (dateRange.to) {
      const parts = dateRange.to.split('-');
      if (parts.length === 3) {
        validEndDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        validEndDate = new Date(dateRange.to);
      }
    } else {
      validEndDate = new Date();
    }
    if (isNaN(validEndDate.getTime())) validEndDate = new Date();

    const days: { date: string; dayNum: string; sales: number; profit: number; orders: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(validEndDate);
      d.setDate(d.getDate() - i);
      const dateStr = toLocalDateString(d);
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
      category: 'المخزون والمشتريات',
      items: [
        { id: 'top-products', name: 'الأكثر مبيعاً', icon: Flame, bg: 'bg-amber-100/70 dark:bg-amber-950/60 text-amber-600' },
        { id: 'product-movement', name: 'حركة منتج', icon: RefreshCw, bg: 'bg-purple-100/70 dark:bg-purple-950/60 text-purple-600' },
        { id: 'inventory-stock', name: 'الجرد وفروقات المخزون', icon: ClipboardCheck, bg: 'bg-cyan-100/70 dark:bg-cyan-950/60 text-cyan-600' },
        { id: 'purchases', name: 'فواتير المشتريات', icon: FileText, bg: 'bg-sky-100/70 dark:bg-sky-950/60 text-sky-600' },
      ]
    },
    {
      category: 'العملاء والشركاء',
      items: [
        { id: 'customers', name: 'دليل العملاء', icon: Users, bg: 'bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-600' },
        { id: 'partners', name: 'أرباح الشركاء', icon: UsersRound, bg: 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-600' },
      ]
    },
    {
      category: 'التقارير الإدارية والتشغيلية',
      items: [
        { id: 'daily-closing', name: 'الإغلاق اليومي', icon: Lock, bg: 'bg-pink-100/70 dark:bg-pink-950/60 text-pink-600' },
        { id: 'cashier-performance', name: 'أداء الكاشير', icon: UserCheck, bg: 'bg-teal-100/70 dark:bg-teal-950/60 text-teal-600' },
        ...(visibleSections.maintenance ? [{ id: 'maintenance', name: 'خدمات الصيانة', icon: ClipboardList, bg: 'bg-violet-100/70 dark:bg-violet-950/60 text-violet-600' }] : []),
        ...(storeType === 'bookstore' ? [{ id: 'library', name: 'تقرير المكتبة', icon: BookOpen, bg: 'bg-blue-100/70 dark:bg-blue-950/60 text-blue-600' }] : []),
        ...(isDistributorStore ? [
          { id: 'distributor-inventory', name: 'مخزون الموزع', icon: Truck, bg: 'bg-amber-100/70 dark:bg-amber-950/60 text-amber-600' },
          { id: 'custody-value', name: 'قيمة العهدة', icon: Wallet, bg: 'bg-purple-100/70 dark:bg-purple-950/60 text-purple-600' },
        ] : []),
      ]
    }
  ];

  // ========== RENDER ==========

  return (
    <MainLayout>
      <div className="p-3 md:p-6 space-y-3.5 md:space-y-4 max-w-4xl mx-auto">
        {/* Sticky Opaque Header with Centered Title & Non-overlapping layout */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md -mx-3 px-3 md:-mx-6 md:px-6 py-2 border-b border-border/50 shadow-sm">
          <PageHeader title="التقارير المالية" className="mb-0 md:mb-0" />
        </div>

        {/* Quick Access Pill Row — no horizontal scroll, always 2-per-row in compact layout */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveReport('sales');
              setViewTab('summary');
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl text-[11px] font-bold transition-all border active:scale-95 w-full",
              activeReport === 'sales'
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/70 hover:bg-muted text-foreground"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            <span>المبيعات</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveReport('inventory');
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl text-[11px] font-bold transition-all border active:scale-95 w-full",
              activeReport === 'inventory'
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/70 hover:bg-muted text-foreground"
            )}
          >
            <Package className="w-3.5 h-3.5 text-amber-600" />
            <span>المخزون</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveReport('debts');
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl text-[11px] font-bold transition-all border active:scale-95 w-full",
              activeReport === 'debts'
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/70 hover:bg-muted text-foreground"
            )}
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>الديون</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveReport('expenses');
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl text-[11px] font-bold transition-all border active:scale-95 w-full",
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
            className="col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl text-[11px] font-bold transition-all border border-border/80 bg-card hover:bg-muted text-foreground shadow-sm active:scale-95 w-full"
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
              onClick={handleExportExcel}
              disabled={isLoading}
              className="h-10 px-3 rounded-xl border-emerald-300 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shrink-0 shadow-sm transition-all active:scale-95 flex items-center gap-1.5 text-[11px] font-bold"
              title="تصدير Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={isLoading}
              className="h-10 px-3 rounded-xl border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 shrink-0 shadow-sm transition-all active:scale-95 flex items-center gap-1.5 text-[11px] font-bold"
              title="تصدير PDF"
            >
              <FileText className="w-4 h-4" />
              <span>PDF</span>
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

        {/* Dynamic Executive Metrics Cards Grid - adapts to activeReport */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {summaryCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className={cn(
                  "relative overflow-hidden rounded-2xl bg-card p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[115px] transition-all duration-200 border",
                  idx === 0 ? "border-2 border-primary/40 shadow-sm" : "border border-border/70 hover:border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-semibold truncate max-w-[130px]" title={card.label}>
                    {card.label}
                  </span>
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", card.bg, card.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="my-1">
                  <p className={cn("text-xl sm:text-2xl font-black tracking-tight truncate", idx === 0 ? "text-primary" : "text-foreground")} title={String(card.value)}>
                    {card.value}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-muted-foreground truncate">
                  {idx === 0 && activeReport === 'sales' && (
                    salesTrend.isUp ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )
                  )}
                  {card.subtext && <span className="truncate" title={card.subtext}>{card.subtext}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* View Mode Segmented Controls — compact and bounded */}
        <div className="grid grid-cols-3 gap-1.5 w-full">
          <button
            type="button"
            onClick={() => {
              if (activeReport !== 'sales') setActiveReport('sales');
              handleSwitchView('summary');
            }}
            className={cn(
              "py-2 px-1 rounded-full border text-[11px] font-semibold leading-tight transition-all text-center select-none shadow-sm whitespace-normal",
              activeReport === 'sales' && viewTab === 'summary'
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            ملخص بياني
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeReport !== 'sales') setActiveReport('sales');
              handleSwitchView('detailed');
            }}
            className={cn(
              "py-2 px-1 rounded-full border text-[11px] font-semibold leading-tight transition-all text-center select-none shadow-sm whitespace-normal",
              activeReport === 'sales' && viewTab === 'detailed'
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            كشف الفواتير
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeReport !== 'sales') setActiveReport('sales');
              handleSwitchView('comprehensive');
            }}
            className={cn(
              "py-2 px-1 rounded-full border text-[11px] font-semibold leading-tight transition-all text-center select-none shadow-sm whitespace-normal",
              activeReport === 'sales' && viewTab === 'comprehensive'
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            عرض شامل
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
                    {/* Daily Sales Bar Chart Card */}
                    <div className="bg-card rounded-2xl border border-border/70 p-4 space-y-3.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                          <h3 className="text-sm font-bold text-foreground">المبيعات اليومية</h3>
                        </div>
                        <div className="bg-muted text-foreground border border-border/70 text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                          <span className="text-primary font-black">${formatCurrency(activeChartDay.sales).replace('$', '')}</span>
                          <span className="text-muted-foreground/50">|</span>
                          <span className="text-emerald-600 font-bold">ربح: {formatCurrency(activeChartDay.profit)}</span>
                          <span className="text-muted-foreground/50">|</span>
                          <span className="text-muted-foreground text-[11px]">{activeChartDay.orders} طلب</span>
                        </div>
                      </div>

                      {/* Vertical Bar Chart columns with explicit h-48 height & theme responsiveness */}
                      <div className="pt-4 pb-2">
                        <div className="grid grid-cols-7 gap-1.5 sm:gap-3 items-end h-48 min-h-[190px] px-1 pb-1 border-b border-border/50">
                          {chartDays.map((day, idx) => {
                            const isSelected = day.date === activeChartDay.date;
                            const heightPct = day.sales > 0 
                              ? Math.max(14, (day.sales / maxChartSales) * 100) 
                              : 8;

                            return (
                              <div 
                                key={idx} 
                                onClick={() => setSelectedDayDate(day.date)}
                                className="flex flex-col items-center justify-end h-full gap-2 cursor-pointer group"
                              >
                                {isSelected && day.sales > 0 && (
                                  <span className="text-[10px] font-black text-primary animate-in fade-in zoom-in-95 duration-200">
                                    ${Math.round(day.sales)}
                                  </span>
                                )}
                                <div className="w-full flex items-end justify-center h-full">
                                  <div 
                                    className={cn(
                                      "w-6 sm:w-9 rounded-t-xl transition-all duration-300",
                                      isSelected
                                        ? "bg-primary shadow-md shadow-primary/30"
                                        : day.sales > 0
                                          ? "bg-primary/40 hover:bg-primary/60"
                                          : "bg-muted/70 hover:bg-muted"
                                    )}
                                    style={{ height: `${heightPct}%` }}
                                  />
                                </div>
                                <span 
                                  className={cn(
                                    "text-[11px] sm:text-xs font-mono transition-colors",
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
                      <div className="flex items-center justify-between pt-2 text-xs">
                        {activeChartDay.sales > 0 && activeChartDay.date === topChartDay.date ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            أعلى مبيعات للأسبوع (${formatCurrency(activeChartDay.sales).replace('$', '')})
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{activeChartDay.orders} طلبات مسجلة</span>
                        )}
                        <span className="text-muted-foreground font-mono text-[11px]">
                          التاريخ: {activeChartDay.date}
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
