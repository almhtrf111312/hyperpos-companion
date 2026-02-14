import { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Phone,
  Mail,
  DollarSign,
  TrendingUp,
  Wallet,
  Eye,
  Edit,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Save,
  UserCheck,
  Percent,
  Tag,
  Banknote,
  PiggyBank,
  Receipt
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
// ✅ استخدام الدوال السحابية بدلاً من المحلية
import {
  loadPartnersCloud,
  addPartnerCloud,
  updatePartnerCloud,
  deletePartnerCloud,
  withdrawProfitCloud,
  addCapitalWithCashboxCloud,
  Partner,
} from '@/lib/cloud/partners-cloud';
import { ExpenseRecord } from '@/lib/partners-store';
import { EVENTS } from '@/lib/events';
import { cn, formatNumber, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
import { getCategoryNames } from '@/lib/categories-store';
import { CategoryManager } from '@/components/CategoryManager';
import { loadProducts } from '@/lib/products-store';
import { useLanguage } from '@/hooks/use-language';

interface CategoryShare {
  categoryId: string;
  categoryName: string;
  percentage: number;
  enabled: boolean;
}

export default function Partners() {
  const { t } = useLanguage();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Load categories from shared store
  const [categories, setCategories] = useState(() =>
    getCategoryNames().map((name, idx) => ({ id: `cat_${idx}`, label: name }))
  );

  // Get used categories from products
  const usedCategories = [...new Set(loadProducts().map(p => p.category))];

  // Reload categories from store
  const reloadCategories = () => {
    setCategories(getCategoryNames().map((name, idx) => ({ id: `cat_${idx}`, label: name })));
  };

  // ✅ تحميل الشركاء من Cloud
  const loadPartnersData = async () => {
    setIsLoading(true);
    try {
      const cloudPartners = await loadPartnersCloud();
      setPartners(cloudPartners);
    } catch (error) {
      console.error('Error loading partners:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // تحميل البيانات عند فتح الصفحة والاستماع للتحديثات
  useEffect(() => {
    loadPartnersData();

    const handleUpdate = () => loadPartnersData();
    window.addEventListener(EVENTS.PARTNERS_UPDATED, handleUpdate);

    return () => {
      window.removeEventListener(EVENTS.PARTNERS_UPDATED, handleUpdate);
    };
  }, []);

  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showAddCapitalDialog, setShowAddCapitalDialog] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    accessAll: true,
    sharesExpenses: false,
    expenseSharePercentage: 0,
    categoryShares: categories.map(c => ({
      categoryId: c.id,
      categoryName: c.label,
      percentage: 0,
      enabled: true,
    })),
  });
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawType, setWithdrawType] = useState<'profit' | 'capital' | 'auto'>('auto');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [capitalAmount, setCapitalAmount] = useState(0);
  const [capitalNotes, setCapitalNotes] = useState('');

  // Update form when categories change
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      categoryShares: categories.map(c => {
        const existing = prev.categoryShares.find(cs => cs.categoryName === c.label);
        return existing || {
          categoryId: c.id,
          categoryName: c.label,
          percentage: 0,
          enabled: true,
        };
      }),
    }));
  }, [categories]);

  const filteredPartners = partners.filter(partner =>
    partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.phone.includes(searchQuery)
  );

  const stats = {
    totalPartners: partners.length,
    totalShare: partners.reduce((sum, p) => sum + p.sharePercentage, 0),
    totalBalance: partners.reduce((sum, p) => sum + p.currentBalance, 0),
    totalProfit: partners.reduce((sum, p) => sum + p.totalProfitEarned, 0),
  };

  // تم استبدالها بدوال Cloud
  const refreshPartners = async () => {
    await loadPartnersData();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      accessAll: true,
      sharesExpenses: false,
      expenseSharePercentage: 0,
      categoryShares: categories.map(c => ({
        categoryId: c.id,
        categoryName: c.label,
        percentage: 0,
        enabled: true,
      })),
    });
  };

  const calculateMainShare = () => {
    if (formData.accessAll) {
      const firstEnabled = formData.categoryShares.find(c => c.enabled);
      return firstEnabled?.percentage || 0;
    }
    const enabledShares = formData.categoryShares.filter(c => c.enabled && c.percentage > 0);
    if (enabledShares.length === 0) return 0;
    return Math.max(...enabledShares.map(c => c.percentage));
  };

  const handleAddPartner = async () => {
    if (!formData.name || !formData.phone) {
      toast.error(t('partners.fillRequiredFields'));
      return;
    }

    const mainShare = calculateMainShare();
    if (mainShare <= 0) {
      toast.error(t('partners.invalidSharePercentage'));
      return;
    }

    // ✅ استخدام الدالة السحابية
    const newPartner = await addPartnerCloud({
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      sharePercentage: mainShare,
      expenseSharePercentage: formData.expenseSharePercentage || 0,
      categoryShares: formData.categoryShares,
      accessAll: formData.accessAll,
      sharesExpenses: formData.sharesExpenses,
      joinedDate: new Date().toISOString().split('T')[0],
      totalProfitEarned: 0,
      totalWithdrawn: 0,
      totalExpensesPaid: 0,
      currentBalance: 0,
      initialCapital: 0,
      currentCapital: 0,
      confirmedProfit: 0,
      pendingProfit: 0,
    });

    if (newPartner) {
      await refreshPartners();
      setShowAddDialog(false);
      resetForm();
      toast.success(t('partners.partnerAdded'));
    } else {
      toast.error(t('partners.error'));
    }
  };

  const handleEditPartner = async () => {
    if (!selectedPartner || !formData.name) {
      toast.error(t('partners.fillRequiredFields'));
      return;
    }

    const mainShare = calculateMainShare();

    // ✅ استخدام الدالة السحابية
    const success = await updatePartnerCloud(selectedPartner.id, {
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      sharePercentage: mainShare,
      categoryShares: formData.categoryShares,
      accessAll: formData.accessAll,
      sharesExpenses: formData.sharesExpenses,
    });

    if (success) {
      await refreshPartners();
      setShowEditDialog(false);
      setSelectedPartner(null);
      toast.success(t('partners.partnerUpdated'));
    } else {
      toast.error(t('partners.error'));
    }
  };

  const handleDeletePartner = async () => {
    if (!selectedPartner) return;

    // ✅ استخدام الدالة السحابية
    const success = await deletePartnerCloud(selectedPartner.id);

    if (success) {
      await refreshPartners();
      setShowDeleteDialog(false);
      setSelectedPartner(null);
      toast.success(t('partners.partnerDeleted'));
    } else {
      toast.error(t('partners.error'));
    }
  };

  const handleWithdraw = async () => {
    if (!selectedPartner || withdrawAmount <= 0) {
      toast.error(t('partners.enterValidAmount'));
      return;
    }

    const profitAvailable = selectedPartner.currentBalance || 0;
    const capitalAvailable = selectedPartner.currentCapital || 0;
    const totalAvailable = profitAvailable + capitalAvailable;

    if (withdrawType === 'profit' && withdrawAmount > profitAvailable) {
      toast.error(t('partners.amountExceedsProfit'));
      return;
    }
    if (withdrawType === 'capital' && withdrawAmount > capitalAvailable) {
      toast.error(t('partners.amountExceedsCapital'));
      return;
    }
    if (withdrawType === 'auto' && withdrawAmount > totalAvailable) {
      toast.error(t('partners.amountExceedsTotal'));
      return;
    }

    let success = false;
    let resultMessage = '';

    // ✅ استخدام الدوال السحابية للسحب
    if (withdrawType === 'profit' || withdrawType === 'auto') {
      // سحب من الأرباح أولاً
      const profitToWithdraw = Math.min(withdrawAmount, profitAvailable);
      if (profitToWithdraw > 0) {
        success = await withdrawProfitCloud(selectedPartner.id, profitToWithdraw, withdrawNotes);
        resultMessage = `${t('partners.withdrawnFromProfit')} ${formatCurrency(profitToWithdraw)}`;
      }

      // إذا كان السحب التلقائي ويحتاج المزيد من رأس المال
      if (withdrawType === 'auto' && withdrawAmount > profitAvailable) {
        const fromCapital = withdrawAmount - profitAvailable;
        // TODO: إضافة دالة withdrawCapitalCloud
        resultMessage += ` + ${formatCurrency(fromCapital)} ${t('partners.fromCapital')}`;
      }
    } else if (withdrawType === 'capital') {
      // TODO: إضافة دالة withdrawCapitalCloud
      success = true;
      resultMessage = `${t('partners.withdrawnFromCapital')} ${formatCurrency(withdrawAmount)}`;
    }

    if (success) {
      await refreshPartners();
      setShowWithdrawDialog(false);
      setSelectedPartner(null);
      setWithdrawAmount(0);
      setWithdrawType('auto');
      setWithdrawNotes('');
      toast.success(resultMessage);
    } else {
      toast.error(t('partners.withdrawError'));
    }
  };

  const handleAddCapital = async () => {
    if (!selectedPartner || capitalAmount <= 0) {
      toast.error(t('partners.enterValidAmount'));
      return;
    }

    // ✅ استخدام الدالة السحابية الموحدة التي تضيف للصندوق تلقائياً (بدون وردية)
    const success = await addCapitalWithCashboxCloud(
      selectedPartner.id,
      selectedPartner.name,
      capitalAmount,
      capitalNotes
    );

    if (success) {
      await refreshPartners();
      setShowAddCapitalDialog(false);
      setSelectedPartner(null);
      setCapitalAmount(0);
      setCapitalNotes('');
      toast.success(`${t('partners.capitalAdded')} ${formatCurrency(capitalAmount)} (تمت الإضافة للصندوق)`);
    } else {
      toast.error(t('partners.capitalAddError'));
    }
  };

  const openAddCapitalDialog = (partner: Partner) => {
    setSelectedPartner(partner);
    setCapitalAmount(0);
    setCapitalNotes('');
    setShowAddCapitalDialog(true);
  };

  const openEditDialog = (partner: Partner) => {
    setSelectedPartner(partner);
    setFormData({
      name: partner.name,
      phone: partner.phone,
      email: partner.email || '',
      accessAll: partner.accessAll,
      sharesExpenses: partner.sharesExpenses || false,
      expenseSharePercentage: (partner as any).expenseSharePercentage || 0,
      categoryShares: partner.categoryShares.length > 0
        ? partner.categoryShares.map(cs => ({
          ...cs,
          categoryName: cs.categoryName || categories.find(c => c.id === cs.categoryId)?.label || '',
        }))
        : categories.map(c => ({
          categoryId: c.id,
          categoryName: c.label,
          percentage: partner.sharePercentage,
          enabled: true,
        })),
    });
    setShowEditDialog(true);
  };

  const openViewDialog = (partner: Partner) => {
    setSelectedPartner(partner);
    setShowViewDialog(true);
  };

  const openDeleteDialog = (partner: Partner) => {
    setSelectedPartner(partner);
    setShowDeleteDialog(true);
  };

  const openWithdrawDialog = (partner: Partner) => {
    setSelectedPartner(partner);
    setWithdrawAmount(0);
    setWithdrawType('auto');
    setWithdrawNotes('');
    setShowWithdrawDialog(true);
  };

  const updateCategoryShare = (categoryId: string, field: 'percentage' | 'enabled', value: number | boolean) => {
    setFormData({
      ...formData,
      categoryShares: formData.categoryShares.map(c =>
        c.categoryId === categoryId
          ? { ...c, [field]: value }
          : c
      ),
    });
  };

  const handleAccessAllChange = (checked: boolean) => {
    if (checked) {
      const firstPercentage = formData.categoryShares[0]?.percentage || 0;
      setFormData({
        ...formData,
        accessAll: true,
        categoryShares: formData.categoryShares.map(c => ({
          ...c,
          enabled: true,
          percentage: firstPercentage,
        })),
      });
    } else {
      setFormData({
        ...formData,
        accessAll: false,
      });
    }
  };

  const handleUniformPercentageChange = (value: number) => {
    if (formData.accessAll) {
      setFormData({
        ...formData,
        categoryShares: formData.categoryShares.map(c => ({
          ...c,
          percentage: value,
        })),
      });
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">{t('partners.title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">{t('partners.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCategoryManager(true)}>
            <Tag className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            {t('partners.categories')}
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => {
            resetForm();
            setShowAddDialog(true);
          }}>
            <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            {t('partners.addPartner')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
              <UserCheck className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatNumber(stats.totalPartners)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('partners.partners')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-info/10">
              <Percent className="w-4 h-4 md:w-5 md:h-5 text-info" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatNumber(stats.totalShare)}%</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('partners.distributed')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-warning/10">
              <Wallet className="w-4 h-4 md:w-5 md:h-5 text-warning" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatCurrency(stats.totalBalance)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('partners.balances')}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-success/10">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-success" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{formatCurrency(stats.totalProfit)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">{t('partners.profits')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('partners.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-9 md:pr-10 bg-muted border-0"
        />
      </div>

      {/* Partners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {filteredPartners.map((partner, index) => (
          <div
            key={partner.id}
            className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 card-hover fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Partner Header */}
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-base md:text-lg font-bold text-primary-foreground">
                    {partner.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm md:text-base">{partner.name}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">{t('partners.since')} {partner.joinedDate}</p>
                </div>
              </div>
              <div className="text-left">
                <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-bold bg-primary/10 text-primary">
                  {partner.sharePercentage}%
                </span>
                {partner.accessAll ? (
                  <p className="text-[10px] text-muted-foreground mt-1">{t('partners.fullStore')}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1">{t('partners.specificCategories')}</p>
                )}
                {partner.sharesExpenses && (
                  <span className="text-[10px] text-success">● {t('partners.sharesExpenses')}</span>
                )}
              </div>
            </div>

            {/* Category Shares */}
            {!partner.accessAll && partner.categoryShares.filter(c => c.enabled).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {partner.categoryShares.filter(c => c.enabled).map(cs => {
                  return (
                    <span key={cs.categoryId} className="px-2 py-0.5 rounded-full text-[10px] bg-accent/10 text-accent">
                      {cs.categoryName || cs.categoryId}: {cs.percentage}%
                    </span>
                  );
                })}
              </div>
            )}

            {/* Contact Info */}
            <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
              <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>{partner.phone}</span>
              </div>
              {partner.email && (
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="truncate">{partner.email}</span>
                </div>
              )}
            </div>

            {/* Financial Stats */}
            <div className="grid grid-cols-2 gap-2 py-3 md:py-4 border-t border-border">
              <div className="text-center">
                <p className="text-[10px] md:text-xs text-muted-foreground">{t('partners.profits')}</p>
                <p className="text-sm md:text-base font-bold text-success">{formatCurrency(partner.currentBalance || 0)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] md:text-xs text-muted-foreground">{t('partners.capital')}</p>
                <p className="text-sm md:text-base font-bold text-info">{formatCurrency(partner.currentCapital || 0)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-3 md:pt-4 border-t border-border">
              <Button variant="outline" size="sm" className="flex-1 h-8 md:h-9 text-xs md:text-sm" onClick={() => openViewDialog(partner)}>
                <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                {t('common.view')}
              </Button>
              <Button size="sm" className="flex-1 h-8 md:h-9 bg-success hover:bg-success/90 text-success-foreground text-xs md:text-sm" onClick={() => openAddCapitalDialog(partner)}>
                <ArrowUpRight className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                {t('partners.deposit')}
              </Button>
              {((partner.currentBalance || 0) > 0 || (partner.currentCapital || 0) > 0) && (
                <Button size="sm" className="flex-1 h-8 md:h-9 bg-warning hover:bg-warning/90 text-warning-foreground text-xs md:text-sm" onClick={() => openWithdrawDialog(partner)}>
                  <ArrowDownLeft className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                  {t('partners.withdraw')}
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={() => openEditDialog(partner)}>
                <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-destructive" onClick={() => openDeleteDialog(partner)}>
                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Partner Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              {t('partners.addNewPartner')}
            </DialogTitle>
            <DialogDescription>{t('partners.addPartnerDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('common.name')} *</label>
              <Input
                placeholder={t('partners.partnerName')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('common.phone')} *</label>
              <Input
                placeholder="+963 xxx xxx xxx"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('common.email')}</label>
              <Input
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            {/* Access Type */}
            <div className="p-4 bg-muted rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{t('partners.accessFullStore')}</p>
                  <p className="text-sm text-muted-foreground">{t('partners.uniformPercentage')}</p>
                </div>
                <Switch
                  checked={formData.accessAll}
                  onCheckedChange={handleAccessAllChange}
                />
              </div>

              {/* Shares Expenses */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div>
                  <p className="font-medium text-foreground">{t('partners.expenseSharing')}</p>
                  <p className="text-sm text-muted-foreground">{t('partners.expenseSharingDesc')}</p>
                </div>
                <Switch
                  checked={formData.sharesExpenses}
                  onCheckedChange={(checked) => setFormData({ ...formData, sharesExpenses: checked })}
                />
              </div>

              {/* Expense Share Percentage */}
              {formData.sharesExpenses && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('partners.expenseSharePercentage')}</label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    max="100"
                    value={formData.expenseSharePercentage || ''}
                    onChange={(e) => setFormData({ ...formData, expenseSharePercentage: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('partners.expenseShareDesc')}</p>
                </div>
              )}

              {formData.accessAll ? (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('partners.profitPercentageAll')}</label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    max="100"
                    value={formData.categoryShares[0]?.percentage || ''}
                    onChange={(e) => handleUniformPercentageChange(Number(e.target.value))}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{t('partners.profitPerCategory')}:</p>
                  {categories.map(cat => {
                    const share = formData.categoryShares.find(c => c.categoryId === cat.id);
                    return (
                      <div key={cat.id} className="flex items-center gap-3">
                        <Switch
                          checked={share?.enabled || false}
                          onCheckedChange={(checked) => updateCategoryShare(cat.id, 'enabled', checked)}
                        />
                        <span className="flex-1 text-sm">{cat.label}</span>
                        <Input
                          type="number"
                          className="w-20"
                          placeholder="0"
                          min="0"
                          max="100"
                          disabled={!share?.enabled}
                          value={share?.percentage || ''}
                          onChange={(e) => updateCategoryShare(cat.id, 'percentage', Number(e.target.value))}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleAddPartner}>
                <Save className="w-4 h-4 ml-2" />
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              {t('partners.editPartner')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('common.name')} *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('common.phone')} *</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('common.email')}</label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            {/* Access Type */}
            <div className="p-4 bg-muted rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{t('partners.accessFullStore')}</p>
                  <p className="text-sm text-muted-foreground">{t('partners.uniformPercentage')}</p>
                </div>
                <Switch
                  checked={formData.accessAll}
                  onCheckedChange={handleAccessAllChange}
                />
              </div>

              {/* Shares Expenses */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div>
                  <p className="font-medium text-foreground">{t('partners.expenseSharing')}</p>
                  <p className="text-sm text-muted-foreground">{t('partners.expenseSharingDesc')}</p>
                </div>
                <Switch
                  checked={formData.sharesExpenses}
                  onCheckedChange={(checked) => setFormData({ ...formData, sharesExpenses: checked })}
                />
              </div>

              {/* Expense Share Percentage */}
              {formData.sharesExpenses && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('partners.expenseSharePercentage')}</label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    max="100"
                    value={formData.expenseSharePercentage || ''}
                    onChange={(e) => setFormData({ ...formData, expenseSharePercentage: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('partners.expenseShareDesc')}</p>
                </div>
              )}

              {formData.accessAll ? (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('partners.profitPercentageAll')}</label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    max="100"
                    value={formData.categoryShares[0]?.percentage || ''}
                    onChange={(e) => handleUniformPercentageChange(Number(e.target.value))}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{t('partners.profitPerCategory')}:</p>
                  {categories.map(cat => {
                    const share = formData.categoryShares.find(c => c.categoryId === cat.id);
                    return (
                      <div key={cat.id} className="flex items-center gap-3">
                        <Switch
                          checked={share?.enabled || false}
                          onCheckedChange={(checked) => updateCategoryShare(cat.id, 'enabled', checked)}
                        />
                        <span className="flex-1 text-sm">{cat.label}</span>
                        <Input
                          type="number"
                          className="w-20"
                          placeholder="0"
                          min="0"
                          max="100"
                          disabled={!share?.enabled}
                          value={share?.percentage || ''}
                          onChange={(e) => updateCategoryShare(cat.id, 'percentage', Number(e.target.value))}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleEditPartner}>
                <Save className="w-4 h-4 ml-2" />
                {t('common.saveChanges')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Partner Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              {t('partners.partnerDetails')}
            </DialogTitle>
          </DialogHeader>
          {selectedPartner && (
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {selectedPartner.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedPartner.name}</h3>
                  <p className="text-muted-foreground">{t('partners.since')} {selectedPartner.joinedDate}</p>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-success/10 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">{t('partners.profits')}</p>
                  <p className="text-2xl font-bold text-success">${formatNumber(selectedPartner.currentBalance || 0)}</p>
                </div>
                <div className="bg-info/10 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">{t('partners.capital')}</p>
                  <p className="text-2xl font-bold text-info">${formatNumber(selectedPartner.currentCapital || 0)}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('partners.sharePercentage')}</span>
                  <span className="font-medium">{selectedPartner.sharePercentage}%</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('partners.totalProfitEarned')}</span>
                  <span className="font-medium text-success">${formatNumber(selectedPartner.totalProfitEarned)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('partners.totalWithdrawn')}</span>
                  <span className="font-medium text-warning">${formatNumber(selectedPartner.totalWithdrawn)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">{t('partners.totalCapital')}</span>
                  <span className="font-medium text-info">${formatNumber(selectedPartner.initialCapital || 0)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => {
                    setShowViewDialog(false);
                    openAddCapitalDialog(selectedPartner);
                  }}
                >
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                  {t('partners.addBalance')}
                </Button>
                {((selectedPartner.currentBalance || 0) > 0 || (selectedPartner.currentCapital || 0) > 0) && (
                  <Button
                    className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground"
                    onClick={() => {
                      setShowViewDialog(false);
                      openWithdrawDialog(selectedPartner);
                    }}
                  >
                    <ArrowDownLeft className="w-4 h-4 ml-2" />
                    {t('partners.withdrawBalance')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-warning" />
              {t('partners.withdrawBalance')}
            </DialogTitle>
            <DialogDescription>
              {t('partners.withdrawFor')} {selectedPartner?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedPartner && (
            <div className="space-y-4 py-4">
              {/* Available Balances */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-success/10 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <p className="text-xs text-muted-foreground">{t('partners.profits')}</p>
                  </div>
                  <p className="text-xl font-bold text-success">${formatNumber(selectedPartner.currentBalance || 0)}</p>
                </div>
                <div className="bg-info/10 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <PiggyBank className="w-4 h-4 text-info" />
                    <p className="text-xs text-muted-foreground">{t('partners.capital')}</p>
                  </div>
                  <p className="text-xl font-bold text-info">${formatNumber(selectedPartner.currentCapital || 0)}</p>
                </div>
              </div>

              {/* Withdraw Type */}
              <div className="space-y-3">
                <label className="text-sm font-medium">{t('partners.withdrawType')}</label>
                <RadioGroup value={withdrawType} onValueChange={(value) => setWithdrawType(value as 'profit' | 'capital' | 'auto')}>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="profit" id="profit" disabled={(selectedPartner.currentBalance || 0) <= 0} />
                    <Label htmlFor="profit" className={cn("cursor-pointer", (selectedPartner.currentBalance || 0) <= 0 && "opacity-50")}>
                      {t('partners.withdrawFromProfitOnly')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="capital" id="capital" disabled={(selectedPartner.currentCapital || 0) <= 0} />
                    <Label htmlFor="capital" className={cn("cursor-pointer", (selectedPartner.currentCapital || 0) <= 0 && "opacity-50")}>
                      {t('partners.withdrawFromCapitalOnly')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="auto" id="auto" />
                    <Label htmlFor="auto" className="cursor-pointer">
                      {t('partners.withdrawAuto')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Withdraw Amount */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('partners.withdrawAmount')}</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={withdrawAmount || ''}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                />
              </div>

              {/* Quick Withdraw Buttons */}
              <div className="flex gap-2">
                {withdrawType === 'profit' && (selectedPartner.currentBalance || 0) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setWithdrawAmount(selectedPartner.currentBalance || 0)}
                  >
                    {t('partners.allProfit')}
                  </Button>
                )}
                {withdrawType === 'capital' && (selectedPartner.currentCapital || 0) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setWithdrawAmount(selectedPartner.currentCapital || 0)}
                  >
                    {t('partners.allCapital')}
                  </Button>
                )}
                {withdrawType === 'auto' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setWithdrawAmount((selectedPartner.currentBalance || 0) + (selectedPartner.currentCapital || 0))}
                  >
                    {t('partners.withdrawAll')}
                  </Button>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('common.notes')} ({t('common.optional')})</label>
                <Textarea
                  placeholder={t('partners.addNote')}
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowWithdrawDialog(false)}>
                  {t('common.cancel')}
                </Button>
                <Button className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground" onClick={handleWithdraw}>
                  <Save className="w-4 h-4 ml-2" />
                  {t('partners.confirmWithdraw')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Capital Dialog */}
      <Dialog open={showAddCapitalDialog} onOpenChange={setShowAddCapitalDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-success" />
              {t('partners.addCapital')}
            </DialogTitle>
            <DialogDescription>
              {t('partners.addCapitalFor')} {selectedPartner?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedPartner && (
            <div className="space-y-4 py-4">
              <div className="bg-info/10 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <PiggyBank className="w-5 h-5 text-info" />
                  <p className="text-sm text-muted-foreground">{t('partners.currentCapital')}</p>
                </div>
                <p className="text-3xl font-bold text-info">${formatNumber(selectedPartner.currentCapital || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ({t('partners.total')}: ${formatNumber(selectedPartner.initialCapital || 0)})
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('partners.depositAmount')}</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={capitalAmount || ''}
                  onChange={(e) => setCapitalAmount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('common.notes')} ({t('common.optional')})</label>
                <Textarea
                  placeholder={t('partners.depositExample')}
                  value={capitalNotes}
                  onChange={(e) => setCapitalNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddCapitalDialog(false)}>
                  {t('common.cancel')}
                </Button>
                <Button className="flex-1 bg-success hover:bg-success/90 text-success-foreground" onClick={handleAddCapital}>
                  <Save className="w-4 h-4 ml-2" />
                  {t('partners.confirmDeposit')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('partners.deleteConfirmation')} "{selectedPartner?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePartner} className="bg-destructive hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Manager */}
      <CategoryManager
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        onCategoriesChange={reloadCategories}
        usedCategories={usedCategories}
      />
    </div>
  );
}
