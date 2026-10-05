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
  Share2
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
import { PageHeader } from '@/components/layout/PageHeader';

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

    const success = await shareDebtStatement(statementData);
    if (success) {
      toast.success('تم فتح نافذة المشاركة');
    }
  };

  const openDeleteDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDeleteDialog(true);
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <PageHeader
        title={t('nav.customersAndDebts' as any)}
        subtitle={t('customers.pageSubtitle')}
        actions={
          activeTab === 'customers' ? (
            <Button className="bg-primary hover:bg-primary/90" onClick={() => {
              setFormData({ name: '', phone: '', email: '', address: '' });
              setShowAddDialog(true);
            }}>
              <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
              {t('customers.addCustomer')}
            </Button>
          ) : (
            <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowEmbeddedAddDebt(true)}>
              <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
              {t('debts.addCashDebt')}
            </Button>
          )
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="customers" className="flex-1 md:flex-none">{t('customers.tabCustomers' as any)}</TabsTrigger>
          <TabsTrigger value="debts" className="flex-1 md:flex-none">{t('customers.tabDebts' as any)}</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <div className="space-y-4 md:space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
              <User className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('customers.total')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-warning/10">
              <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-warning" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.withDebt}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('customers.debtors')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-destructive/10">
              <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatCurrency(stats.totalDebt)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('customers.debts')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-success/10">
              <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-success" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatCurrency(stats.totalPurchases)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('customers.purchases')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('customers.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-9 md:pr-10 bg-muted border-0"
        />
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {filteredCustomers.map((customer, index) => (
          <div
            key={customer.id}
            className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 card-hover fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Customer Header */}
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-base md:text-lg font-bold text-primary-foreground">
                    {customer.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm md:text-base">{customer.name}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs md:text-sm text-muted-foreground">{customer.invoiceCount} {t('customers.invoices')}</p>
                    {/* ✅ شارة الكاشير للمالك */}
                    {isOwner && customer.cashierName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        👤 {customer.cashierName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {customer.totalDebt > 0 && (
                <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium badge-warning">
                  {t('customers.debtor')}
                </span>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
              <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="truncate">{customer.address}</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 md:gap-4 py-3 md:py-4 border-t border-border">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">{t('customers.purchases')}</p>
                <p className="text-base md:text-lg font-bold text-foreground">{formatCurrency(customer.totalPurchases)}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">{t('customers.debts')}</p>
                <p className={cn(
                  "text-base md:text-lg font-bold",
                  customer.totalDebt > 0 ? "text-destructive" : "text-success"
                )}>
                  {formatCurrency(customer.totalDebt)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-3 md:pt-4 border-t border-border">
              <Button variant="outline" size="sm" className="flex-1 h-8 md:h-9 text-xs md:text-sm" onClick={() => openViewDialog(customer)}>
                <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                {t('common.view')}
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-8 md:h-9 text-xs md:text-sm" onClick={() => openEditDialog(customer)}>
                <Edit className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                {t('common.edit')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 md:h-9 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => openDeleteDialog(customer)}
              >
                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
          </div>
        </TabsContent>

        <TabsContent value="debts">
          <Debts embedded onAddDebt={showEmbeddedAddDebt} onAddDebtChange={setShowEmbeddedAddDebt} />
        </TabsContent>
      </Tabs>

      {/* Add Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              {t('customers.addCustomer')}
            </DialogTitle>
            <DialogDescription>{t('customers.fillRequired')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('customers.name')} *</label>
              <Input
                placeholder={t('customers.name')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('customers.phone')} *</label>
              <Input
                type="tel"
                inputMode="tel"
                dir="ltr"
                placeholder="+963 xxx xxx xxx"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^\d+]/g, '') })}
                className="text-left"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('customers.email')}</label>
              <Input
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('customers.address')}</label>
              <Input
                placeholder={t('customers.address')}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleAddCustomer} disabled={isSaving}>
                <Save className="w-4 h-4 ml-2" />
                {isSaving ? 'جاري الحفظ...' : t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              {t('customers.editCustomer')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('customers.name')} *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('customers.phone')} *</label>
              <Input
                type="tel"
                inputMode="tel"
                dir="ltr"
                placeholder="+963 xxx xxx xxx"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^\d+]/g, '') })}
                className="text-left"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('customers.email')}</label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('customers.address')}</label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleEditCustomer}>
                <Save className="w-4 h-4 ml-2" />
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Customer Dialog - كشف حساب تفصيلي */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
              <User className="w-5 h-5 text-primary" />
              كشف حساب: {selectedCustomer?.name}
            </DialogTitle>
            <Button
              size="sm"
              variant="outline"
              className="border-primary/50 text-primary hover:bg-primary/10 gap-1.5"
              onClick={handleShareStatementImage}
            >
              <Share2 className="w-4 h-4" />
              مشاركة كشف الحساب كصورة
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
