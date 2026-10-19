import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  User,
  Phone,
  Mail,
  MapPin,
  Edit,
  Trash2,
  Eye,
  CreditCard,
  X,
  Save,
  Loader2,
  FileText,
  ShoppingCart,
  Wrench,
  Share2,
  MoreVertical
} from 'lucide-react';
import { cn, formatNumber, formatCurrency, formatDateTime } from '@/lib/utils';
import { getStoreSettings } from '@/lib/native-print';
import { shareDebtStatement } from '@/lib/native-share';
import { DebtStatementCanvasData } from '@/lib/invoice-canvas-generator';
import { loadDebtsCloud, Debt } from '@/lib/cloud/debts-cloud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import {
  loadCustomersWithCashierNamesCloud,
  addCustomerCloud,
  updateCustomerCloud,
  deleteCustomerCloud,
  getCustomersStatsCloud,
  Customer
} from '@/lib/cloud/customers-cloud';
import { loadInvoicesCloud, Invoice } from '@/lib/cloud/invoices-cloud';
import {
  loadCustomersStatsMap,
  getCustomerStatsFrom,
  filterCustomerInvoices,
  remainingDebtOf,
} from '@/lib/cloud/customer-stats';
import { useUserRole } from '@/hooks/use-user-role';
import { useLanguage } from '@/hooks/use-language';
import { EVENTS } from '@/lib/events';
import Debts from '@/pages/Debts';

export default function Customers() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'debts' ? 'debts' : 'customers';

  const handleTabChange = (value: string) => {
    if (value === 'debts') {
      setSearchParams({ tab: 'debts' }, { replace: true });
    } else {
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    }
  };
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [customerDebts, setCustomerDebts] = useState<Debt[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [showEmbeddedAddDebt, setShowEmbeddedAddDebt] = useState(false);

  const { role } = useUserRole();
  const isOwner = role === 'admin' || role === 'boss';

  // Load customers from cloud
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // ✅ للمالك: تحميل مع أسماء الكاشير
      const data = await loadCustomersWithCashierNamesCloud();

      // ✅ مصدر حقيقة واحد: الأرقام تُحسب من الفواتير النشطة
      try {
        const statsMap = await loadCustomersStatsMap();
        setCustomers(
          data.map(c => {
            const s = getCustomerStatsFrom(statsMap, { id: c.id, name: c.name });
            return { ...c, ...s };
          })
        );
      } catch {
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Listen for updates
    const handleUpdate = () => loadData();
    window.addEventListener(EVENTS.CUSTOMERS_UPDATED, handleUpdate);

    return () => {
      window.removeEventListener(EVENTS.CUSTOMERS_UPDATED, handleUpdate);
    };
  }, [loadData]);

  // Auto-open add dialog from URL params
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setFormData({ name: '', phone: '', email: '', address: '' });
      setShowAddDialog(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [stats, setStats] = useState({ total: 0, withDebt: 0, totalDebt: 0, totalPurchases: 0 });

  useEffect(() => {
    const loadStats = async () => {
      const s = await getCustomersStatsCloud();
      setStats(s);
    };
    loadStats();
  }, [customers]);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  );

  const handleAddCustomer = async () => {
    if (isSaving || savingRef.current) return;

    if (!formData.name?.trim() || !formData.phone?.trim()) {
      console.log('Validation Errors - Customers Page:', {
        name: formData.name,
        phone: formData.phone,
        nameEmpty: !formData.name?.trim(),
        phoneEmpty: !formData.phone?.trim()
      });
      toast.error(t('customers.fillRequired'));
      return;
    }

    // ✅ التحقق من عدم تكرار الاسم
    const duplicate = customers.find(c =>
      c.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
    );
    if (duplicate) {
      toast.error(t('customers.nameExists'));
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      const newCustomer = await addCustomerCloud({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address || undefined,
      });

      if (newCustomer) {
        setShowAddDialog(false);
        setFormData({ name: '', phone: '', email: '', address: '' });
        toast.success(t('customers.addSuccess'));
        import('@/lib/activity-log').then(({ logActivity }) => logActivity('customer_added', `إضافة زبون: ${newCustomer.name}`, { id: newCustomer.id }));
        loadData();
      } else {
        toast.error(t('customers.addFailed'));
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleEditCustomer = async () => {
    if (!selectedCustomer || !formData.name) {
      toast.error(t('customers.fillRequired'));
      return;
    }

    setIsSaving(true);
    const success = await updateCustomerCloud(selectedCustomer.id, {
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      address: formData.address || undefined,
    });
    setIsSaving(false);

    if (success) {
      setShowEditDialog(false);
      const editedName = formData.name;
      const editedId = selectedCustomer.id;
      setSelectedCustomer(null);
      toast.success(t('customers.editSuccess'));
      import('@/lib/activity-log').then(({ logActivity }) => logActivity('customer_updated', `تعديل زبون: ${editedName}`, { id: editedId }));
      loadData();
    } else {
      toast.error(t('customers.editFailed'));
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;

    setIsSaving(true);
    const deletedName = selectedCustomer.name;
    const deletedId = selectedCustomer.id;
    const success = await deleteCustomerCloud(selectedCustomer.id);
    setIsSaving(false);

    if (success) {
      setShowDeleteDialog(false);
      setSelectedCustomer(null);
      toast.success(t('customers.deleteSuccess'));
      import('@/lib/activity-log').then(({ logActivity }) => logActivity('customer_deleted', `حذف زبون: ${deletedName}`, { id: deletedId }));
      loadData();
    } else {
      toast.error(t('customers.deleteFailed'));
    }
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
    });
    setShowEditDialog(true);
  };

  const openViewDialog = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerInvoices([]);
    setCustomerDebts([]);
    setShowViewDialog(true);

    // ✅ تحميل فواتير وديون العميل الحية (غير المستردة)
    setLoadingInvoices(true);
    try {
      const [allInvoices, allDebts] = await Promise.all([
        loadInvoicesCloud(),
        loadDebtsCloud().catch(() => []),
      ]);
      const matchedInvoices = filterCustomerInvoices(allInvoices, { id: customer.id, name: customer.name });
      const matchedDebts = allDebts.filter(d =>
        (customer.id && d.customerId === customer.id) ||
        (d.customerName && d.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase()) ||
        (customer.phone && d.customerPhone === customer.phone)
      );
      setCustomerInvoices(matchedInvoices);
      setCustomerDebts(matchedDebts);
    } catch (e) {
      console.error('Error loading customer invoices and debts:', e);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleShareStatementImage = async () => {
    if (!selectedCustomer) return;
    const store = getStoreSettings();
    const totalPurchases = customerInvoices.reduce((s, i) => s + i.total, 0);
    const totalDebt = customerInvoices.reduce((s, i) => s + remainingDebtOf(i), 0) +
      customerDebts.filter(d => d.isCashDebt).reduce((s, d) => s + d.remainingDebt, 0);
    const totalPaid = Math.max(0, totalPurchases - totalDebt);

    const statementRows = [
      ...customerInvoices.map(inv => {
        const remaining = remainingDebtOf(inv);
        const paid = Math.max(0, inv.total - remaining);
        return {
          id: inv.id,
          date: new Date(inv.createdAt).toLocaleDateString('ar-SA'),
          type: inv.paymentType === 'cash' ? 'بيع نقدي' : 'بيع آجل',
          total: inv.total,
          paid,
          remaining,
          status: remaining <= 0 ? 'مسدد' : (paid > 0 ? 'مسدد جزئياً' : 'مستحق'),
        };
      }),
      ...customerDebts.filter(d => d.isCashDebt).map(d => ({
        id: d.invoiceId,
        date: new Date(d.createdAt).toLocaleDateString('ar-SA'),
        type: 'دين نقدي (سلفة)',
        total: d.totalDebt,
        paid: d.totalPaid,
        remaining: d.remainingDebt,
        status: d.remainingDebt <= 0 ? 'مسدد' : (d.totalPaid > 0 ? 'مسدد جزئياً' : 'مستحق'),
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const statementData: DebtStatementCanvasData = {
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone,
      date: new Date().toLocaleDateString('ar-SA'),
      totalPurchases,
      totalPaid,
      totalDebt,
      currencySymbol: '$',
      transactions: statementRows,
      storeName: store.name,
      storePhone: store.phone,
      storeAddress: store.address,
      storeLogo: store.logo,
    };

    await shareDebtStatement(statementData);
  };

  const openDeleteDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDeleteDialog(true);
  };

  return (
    <div className="p-2.5 sm:p-4 md:p-6 pt-2 sm:pt-3 space-y-3">
      {/* Top Navigation Tabs - lifted with smart mobile clearance */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-3">
        <div className="flex items-center justify-between gap-2 rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
          <div className="bg-muted/60 p-1 rounded-2xl flex items-center gap-1 overflow-x-auto scrollbar-none w-full sm:w-fit border border-border/40 shadow-xs select-none">
            <TabsList className="bg-transparent p-0 h-auto gap-1">
              <TabsTrigger
                value="customers"
                className="rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-colors duration-200 select-none cursor-pointer w-auto flex-shrink-0 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>{t('customers.tabCustomers' as any) || 'العملاء'}</span>
              </TabsTrigger>
              <TabsTrigger
                value="debts"
                className="rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-colors duration-200 select-none cursor-pointer w-auto flex-shrink-0 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground"
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>{t('customers.tabDebts' as any) || 'الديون'}</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="customers" className="space-y-3 m-0">
          {/* Add Customer Action directly under Customers tab */}
          <div className="flex items-center justify-between gap-2">
            <Button
              className="bg-gradient-primary hover:brightness-105 active:scale-95 text-primary-foreground font-bold h-9 px-4 rounded-xl shadow-sm text-xs gap-1.5 transition-[colors,transform] cursor-pointer"
              onClick={() => {
                setFormData({ name: '', phone: '', email: '', address: '' });
                setShowAddDialog(true);
              }}
            >
              <Plus className="w-4 h-4" />
              <span>{t('customers.addCustomer')}</span>
            </Button>
          </div>
          {/* Compact Stats Strip (Compressed 4-Metric Grid saving significant vertical space) */}
          <div className="grid grid-cols-4 gap-1.5 text-center select-none">
            <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
              <span className="text-[9.5px] text-muted-foreground font-medium block truncate">{t('customers.total')}</span>
              <span className="text-sm font-black text-foreground tabular-nums">{stats.total}</span>
            </div>
            <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
              <span className="text-[9.5px] text-orange-600 dark:text-orange-400 font-medium block truncate">{t('customers.debtors')}</span>
              <span className="text-sm font-black text-orange-600 dark:text-orange-400 tabular-nums">{stats.withDebt}</span>
            </div>
            <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
              <span className="text-[9.5px] text-muted-foreground font-medium block truncate">{t('customers.debts')}</span>
              <span className="text-xs font-black text-destructive font-mono whitespace-nowrap">{formatCurrency(stats.totalDebt)}</span>
            </div>
            <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
              <span className="text-[9.5px] text-muted-foreground font-medium block truncate">{t('customers.purchases')}</span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">{formatCurrency(stats.totalPurchases)}</span>
            </div>
          </div>

          {/* Search & Counter */}
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('customers.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pr-9 text-xs bg-card border-border rounded-xl font-medium shadow-xs focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
            <div className="flex items-center justify-between text-muted-foreground text-[10.5px] px-1 font-semibold">
              <span>قائمة العملاء</span>
              <span className="font-mono">{filteredCustomers.length} عملاء</span>
            </div>
          </div>

          {/* Customers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredCustomers.length === 0 ? (
              <div className="col-span-full bg-card rounded-2xl border border-border p-8 text-center">
                <User className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">لا يوجد عملاء مطابقين للبحث</p>
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => openViewDialog(customer)}
                  className="bg-card rounded-2xl p-3 border border-border shadow-xs relative hover:border-primary/40 active:scale-[0.99] transition-[border-color,transform] cursor-pointer select-none"
                >
                  {/* Top-Left Options Menu */}
                  <div className="absolute left-2.5 top-2.5 z-10" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted active:scale-90 transition-transform">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48 text-xs font-bold">
                        <DropdownMenuItem onClick={() => openViewDialog(customer)} className="justify-between cursor-pointer">
                          <span>كشف الحساب والفواتير</span>
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(customer)} className="justify-between cursor-pointer">
                          <span>{t('common.edit')}</span>
                          <Edit className="w-4 h-4 text-muted-foreground" />
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedCustomer(customer);
                          handleShareStatementImage();
                        }} className="justify-between cursor-pointer">
                          <span>مشاركة كشف الحساب</span>
                          <Share2 className="w-4 h-4 text-muted-foreground" />
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openDeleteDialog(customer)} className="justify-between text-destructive cursor-pointer">
                          <span>{t('common.delete')}</span>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Header Row: Customer Name & Status Badges */}
                  <div className="flex items-center gap-2 pr-0 pl-8 flex-wrap min-w-0">
                    <span className="font-black text-foreground text-sm truncate max-w-full" title={customer.name}>{customer.name}</span>
                    {customer.totalDebt > 0 ? (
                      <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {t('customers.debtor')}
                      </span>
                    ) : (
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        خالص
                      </span>
                    )}
                    {isOwner && customer.cashierName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                        👤 {customer.cashierName}
                      </span>
                    )}
                  </div>

                  {/* Contact Meta Row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10.5px]">
                    <span className="bg-muted text-muted-foreground font-mono px-1.5 py-0.5 rounded font-bold" dir="ltr">
                      📞 {customer.phone}
                    </span>
                    <span className="text-muted-foreground text-[10px] flex items-center gap-1 font-medium">
                      <span>🛒</span>
                      <span>{customer.invoiceCount} {t('customers.invoices')}</span>
                    </span>
                    {customer.address && (
                      <span className="text-muted-foreground text-[10px] truncate max-w-[9.3rem]">
                        📍 {customer.address}
                      </span>
                    )}
                  </div>

                  {/* Financial Summary Box */}
                  <div className="mt-2.5 pt-2 border-t border-dashed border-border flex items-end justify-between">
                    <div className="text-[10px] text-muted-foreground space-y-0.5 min-w-0">
                      <div className="font-medium text-muted-foreground">
                        {t('customers.purchases')}: <span className="font-mono font-bold text-foreground whitespace-nowrap">{formatCurrency(customer.totalPurchases)}</span>
                      </div>
                    </div>
                    <div className="text-left whitespace-nowrap shrink-0">
                      <span className="text-[9.5px] text-muted-foreground block font-sans">{t('customers.debts')}</span>
                      <span className={cn(
                        "text-sm font-black font-mono whitespace-nowrap",
                        customer.totalDebt > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {formatCurrency(customer.totalDebt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="debts" className="m-0 space-y-3">
          {/* Add Cash Debt Action directly under Debts tab */}
          <div className="flex items-center justify-between gap-2">
            <Button
              className="bg-gradient-primary hover:brightness-105 active:scale-95 text-primary-foreground font-bold h-9 px-4 rounded-xl shadow-sm text-xs gap-1.5 transition-[colors,transform] cursor-pointer"
              onClick={() => setShowEmbeddedAddDebt(true)}
            >
              <Plus className="w-4 h-4" />
              <span>{t('debts.addCashDebt')}</span>
            </Button>
          </div>

          <Debts embedded onAddDebt={showEmbeddedAddDebt} onAddDebtChange={setShowEmbeddedAddDebt} />
        </TabsContent>
      </Tabs>

      {/* Add Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl modal-dot-expand overflow-hidden bg-card text-card-foreground border border-border shadow-2xl p-0">
          <DialogHeader className="p-4 pb-3 border-b border-border/50 text-right bg-muted/30">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Plus className="w-4 h-4 text-primary" />
              <span>{t('customers.addCustomer')}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">{t('customers.fillRequired')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <div>
              <label className="text-xs font-semibold mb-1 block text-foreground">{t('customers.name')} *</label>
              <Input
                placeholder={t('customers.name')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 text-xs rounded-xl bg-background border-border"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block text-foreground">{t('customers.phone')} *</label>
              <Input
                type="tel"
                inputMode="tel"
                dir="ltr"
                placeholder="+963 xxx xxx xxx"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^\d+]/g, '') })}
                className="h-9 text-xs rounded-xl bg-background border-border text-left font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block text-foreground">{t('customers.email')}</label>
              <Input
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-9 text-xs rounded-xl bg-background border-border"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block text-foreground">{t('customers.address')}</label>
              <Input
                placeholder={t('customers.address')}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-9 text-xs rounded-xl bg-background border-border"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 h-9 text-xs rounded-xl" onClick={() => setShowAddDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1 h-9 text-xs rounded-xl bg-gradient-primary hover:brightness-105 active:scale-95 text-primary-foreground font-bold shadow-sm" onClick={handleAddCustomer} disabled={isSaving}>
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'جاري الحفظ...' : t('common.save')}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl modal-dot-expand overflow-hidden bg-card text-card-foreground border border-border shadow-2xl p-0">
          <DialogHeader className="p-4 pb-3 border-b border-border/50 text-right bg-muted/30">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Edit className="w-4 h-4 text-primary" />
              <span>{t('customers.editCustomer')}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <div>
              <label className="text-xs font-semibold mb-1 block text-foreground">{t('customers.name')} *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 text-xs rounded-xl bg-background border-border"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block text-foreground">{t('customers.phone')} *</label>
              <Input
                type="tel"
                inputMode="tel"
                dir="ltr"
                placeholder="+963 xxx xxx xxx"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^\d+]/g, '') })}
                className="h-9 text-xs rounded-xl bg-background border-border text-left font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block text-foreground">{t('customers.email')}</label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-9 text-xs rounded-xl bg-background border-border"
              />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block text-foreground">{t('customers.address')}</label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-9 text-xs rounded-xl bg-background border-border"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 h-9 text-xs rounded-xl" onClick={() => setShowEditDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1 h-9 text-xs rounded-xl bg-gradient-primary hover:brightness-105 active:scale-95 text-primary-foreground font-bold shadow-sm" onClick={handleEditCustomer}>
                <Save className="w-3.5 h-3.5" />
                <span>{t('common.save')}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Customer Dialog - كشف حساب تفصيلي */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-2xl rounded-3xl modal-dot-expand overflow-hidden max-h-[92vh] flex flex-col p-0 border border-border bg-card text-card-foreground shadow-2xl">
          <DialogHeader className="p-4 pb-3 border-b border-border/50 text-right bg-muted/30 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <User className="w-4 h-4 text-primary" />
              <span>كشف حساب: {selectedCustomer?.name}</span>
            </DialogTitle>
            <Button
              size="sm"
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/10 gap-1.5 h-8 text-xs rounded-xl"
              onClick={handleShareStatementImage}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>مشاركة كصورة</span>
            </Button>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold text-primary-foreground">
                    {selectedCustomer.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold">{selectedCustomer.name}</h3>
                  <div className="flex items-center gap-3 text-xs md:text-sm text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {selectedCustomer.phone}
                    </span>
                    {selectedCustomer.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {selectedCustomer.address}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ✅ إحصائيات حية محسوبة من الفواتير والديون */}
              {(() => {
                const totalPurchases = customerInvoices.reduce((s, i) => s + i.total, 0);
                const totalDebt = customerInvoices.reduce((s, i) => s + remainingDebtOf(i), 0) +
                  customerDebts.filter(d => d.isCashDebt).reduce((s, d) => s + d.remainingDebt, 0);
                const totalPaid = Math.max(0, totalPurchases - totalDebt);

                return (
                  <div className="grid grid-cols-3 gap-2 md:gap-3">
                    <div className="bg-muted rounded-xl p-3 text-center">
                      <p className="text-[11px] md:text-xs text-muted-foreground">إجمالي المشتريات</p>
                      <p className="text-base md:text-xl font-bold text-primary">
                        {formatCurrency(totalPurchases)}
                      </p>
                    </div>
                    <div className="bg-muted rounded-xl p-3 text-center">
                      <p className="text-[11px] md:text-xs text-muted-foreground">إجمالي المسدد</p>
                      <p className="text-base md:text-xl font-bold text-success">
                        {formatCurrency(totalPaid)}
                      </p>
                    </div>
                    <div className="bg-muted rounded-xl p-3 text-center">
                      <p className="text-[11px] md:text-xs text-muted-foreground">الديون المستحقة</p>
                      <p className={cn(
                        "text-base md:text-xl font-bold",
                        totalDebt > 0 ? "text-destructive" : "text-success"
                      )}>
                        {formatCurrency(totalDebt)}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* ✅ جدول كشف الحساب التفصيلي */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    كشف الحساب التفصيلي (الفواتير والديون)
                  </span>
                  {loadingInvoices && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </h4>

                {(() => {
                  const statementItems = [
                    ...customerInvoices.map(inv => {
                      const remaining = remainingDebtOf(inv);
                      const paid = Math.max(0, inv.total - remaining);
                      return {
                        id: inv.id,
                        date: inv.createdAt,
                        type: inv.paymentType === 'cash' ? 'بيع نقدي' : 'بيع آجل',
                        paymentType: inv.paymentType,
                        total: inv.total,
                        paid,
                        remaining,
                        status: remaining <= 0 ? 'fully_paid' : (paid > 0 ? 'partially_paid' : 'due'),
                      };
                    }),
                    ...customerDebts.filter(d => d.isCashDebt).map(d => ({
                      id: d.invoiceId,
                      date: d.createdAt,
                      type: 'سلفة نقدية',
                      paymentType: 'cash_debt',
                      total: d.totalDebt,
                      paid: d.totalPaid,
                      remaining: d.remainingDebt,
                      status: d.remainingDebt <= 0 ? 'fully_paid' : (d.totalPaid > 0 ? 'partially_paid' : 'due'),
                    }))
                  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                  if (!loadingInvoices && statementItems.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-6 bg-muted rounded-xl">
                        لا توجد حركات مسجلة لهذا العميل
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-2 max-h-72 overflow-y-auto border rounded-xl divide-y">
                      {statementItems.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="p-3 bg-card hover:bg-muted/40 transition-colors text-xs flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-foreground">{item.id}</span>
                              <Badge
                                variant={item.paymentType === 'cash' ? 'default' : 'destructive'}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {item.type}
                              </Badge>
                            </div>
                            <span className="text-muted-foreground" dir="ltr">
                              {formatDateTime(new Date(item.date))}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-1 text-center bg-muted/50 rounded-lg p-1.5">
                            <div>
                              <span className="text-[10px] text-muted-foreground block">الإجمالي</span>
                              <span className="font-bold text-foreground">{formatCurrency(item.total)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block">المدفوع</span>
                              <span className="font-bold text-success">{formatCurrency(item.paid)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block">المتبقي</span>
                              <span className={cn(
                                "font-bold",
                                item.remaining > 0 ? "text-destructive" : "text-success"
                              )}>
                                {formatCurrency(item.remaining)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {selectedCustomer.lastPurchase && (
                <div className="text-xs text-muted-foreground text-center pt-1">
                  آخر عملية شراء: {selectedCustomer.lastPurchase}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف العميل "{selectedCustomer?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
