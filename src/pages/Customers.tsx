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
  Loader2
} from 'lucide-react';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  const { role } = useUserRole();
  const isOwner = role === 'admin' || role === 'boss';

  // Load customers from cloud
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // ✅ للمالك: تحميل مع أسماء الكاشير
      const data = await loadCustomersWithCashierNamesCloud();
      setCustomers(data);
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
    window.addEventListener('focus', loadData);

    return () => {
      window.removeEventListener(EVENTS.CUSTOMERS_UPDATED, handleUpdate);
      window.removeEventListener('focus', loadData);
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

    if (!formData.name || !formData.phone) {
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
      setSelectedCustomer(null);
      toast.success(t('customers.editSuccess'));
      loadData();
    } else {
      toast.error(t('customers.editFailed'));
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;

    setIsSaving(true);
    const success = await deleteCustomerCloud(selectedCustomer.id);
    setIsSaving(false);

    if (success) {
      setShowDeleteDialog(false);
      setSelectedCustomer(null);
      toast.success(t('customers.deleteSuccess'));
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

  const openViewDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowViewDialog(true);
  };

  const openDeleteDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDeleteDialog(true);
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">{t('nav.customersAndDebts' as any)}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">{t('customers.pageSubtitle')}</p>
        </div>
        {activeTab === 'customers' && (
          <Button className="bg-primary hover:bg-primary/90" onClick={() => {
            setFormData({ name: '', phone: '', email: '', address: '' });
            setShowAddDialog(true);
          }}>
            <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            {t('customers.addCustomer')}
          </Button>
        )}
      </div>

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
          <Debts />
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
                placeholder="+963 xxx xxx xxx"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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

      {/* View Customer Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              {t('customers.details')}
            </DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {selectedCustomer.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedCustomer.name}</h3>
                  <p className="text-muted-foreground">{selectedCustomer.invoiceCount} فاتورة</p>
                </div>
              </div>

              <div className="space-y-2 bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedCustomer.phone}</span>
                </div>
                {selectedCustomer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedCustomer.email}</span>
                  </div>
                )}
                {selectedCustomer.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedCustomer.address}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">إجمالي المشتريات</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(selectedCustomer.totalPurchases)}</p>
                </div>
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">الديون المستحقة</p>
                  <p className={cn("text-2xl font-bold", selectedCustomer.totalDebt > 0 ? "text-destructive" : "text-success")}>
                    {formatCurrency(selectedCustomer.totalDebt)}
                  </p>
                </div>
              </div>

              <div className="text-sm text-muted-foreground text-center">
                آخر عملية شراء: {selectedCustomer.lastPurchase}
              </div>
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
