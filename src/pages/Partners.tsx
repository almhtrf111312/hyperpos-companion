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
  PiggyBank
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  addCapital as addCapitalToStore,
  withdrawProfit,
  withdrawCapital,
  smartWithdraw
} from '@/lib/partners-store';
import { cn, formatNumber } from '@/lib/utils';
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

interface CategoryShare {
  categoryId: string;
  categoryName: string;
  percentage: number;
  enabled: boolean;
}

interface Partner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  sharePercentage: number;
  categoryShares: CategoryShare[];
  accessAll: boolean;
  sharesExpenses: boolean;
  joinedDate: string;
  totalProfitEarned: number;
  totalWithdrawn: number;
  totalExpensesPaid: number;
  currentBalance: number;
  // رأس المال
  initialCapital: number;
  currentCapital: number;
  capitalWithdrawals: any[];
  capitalHistory: any[];
  confirmedProfit: number;
  pendingProfit: number;
}

const PARTNERS_STORAGE_KEY = 'hyperpos_partners_v1';

const loadPartners = (): Partner[] => {
  try {
    const stored = localStorage.getItem(PARTNERS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
};

const savePartners = (partners: Partner[]) => {
  try {
    localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(partners));
  } catch {
    // ignore
  }
};

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>(() => loadPartners());
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
    sharesExpenses: false, // يشارك في المصاريف
    expenseSharePercentage: 0, // نسبة المشاركة في المصاريف
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

  const updatePartners = (newPartners: Partner[]) => {
    setPartners(newPartners);
    savePartners(newPartners);
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

  const handleAddPartner = () => {
    if (!formData.name || !formData.phone) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const mainShare = calculateMainShare();
    if (mainShare <= 0) {
      toast.error('يرجى تحديد نسبة أرباح صحيحة');
      return;
    }
    
    const newPartner: Partner = {
      id: Date.now().toString(),
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      sharePercentage: mainShare,
      categoryShares: formData.categoryShares,
      accessAll: formData.accessAll,
      sharesExpenses: formData.sharesExpenses,
      joinedDate: new Date().toISOString().split('T')[0],
      totalProfitEarned: 0,
      totalWithdrawn: 0,
      totalExpensesPaid: 0,
      currentBalance: 0,
      // رأس المال
      initialCapital: 0,
      currentCapital: 0,
      capitalWithdrawals: [],
      capitalHistory: [],
      confirmedProfit: 0,
      pendingProfit: 0,
    };
    
    const updatedPartners = [...partners, newPartner];
    setPartners(updatedPartners);
    savePartners(updatedPartners); // حفظ مباشر
    setShowAddDialog(false);
    resetForm();
    toast.success('تم إضافة الشريك بنجاح');
  };

  const handleEditPartner = () => {
    if (!selectedPartner || !formData.name) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }

    const mainShare = calculateMainShare();
    
    const updatedPartners = partners.map(p => 
      p.id === selectedPartner.id 
        ? { 
            ...p, 
            name: formData.name, 
            phone: formData.phone, 
            email: formData.email || undefined, 
            sharePercentage: mainShare,
            categoryShares: formData.categoryShares,
            accessAll: formData.accessAll,
            sharesExpenses: formData.sharesExpenses,
          }
        : p
    );
    setPartners(updatedPartners);
    savePartners(updatedPartners); // حفظ مباشر
    setShowEditDialog(false);
    setSelectedPartner(null);
    toast.success('تم تعديل بيانات الشريك بنجاح');
  };

  const handleDeletePartner = () => {
    if (!selectedPartner) return;
    
    const updatedPartners = partners.filter(p => p.id !== selectedPartner.id);
    setPartners(updatedPartners);
    savePartners(updatedPartners); // حفظ مباشر
    setShowDeleteDialog(false);
    setSelectedPartner(null);
    toast.success('تم حذف الشريك بنجاح');
  };

  const handleWithdraw = () => {
    if (!selectedPartner || withdrawAmount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    const profitAvailable = selectedPartner.currentBalance || 0;
    const capitalAvailable = selectedPartner.currentCapital || 0;
    const totalAvailable = profitAvailable + capitalAvailable;

    // التحقق من الرصيد حسب نوع السحب
    if (withdrawType === 'profit' && withdrawAmount > profitAvailable) {
      toast.error('المبلغ أكبر من الأرباح المتاحة');
      return;
    }
    if (withdrawType === 'capital' && withdrawAmount > capitalAvailable) {
      toast.error('المبلغ أكبر من رأس المال المتاح');
      return;
    }
    if (withdrawType === 'auto' && withdrawAmount > totalAvailable) {
      toast.error('المبلغ أكبر من الرصيد الكلي المتاح');
      return;
    }

    let success = false;
    let resultMessage = '';

    if (withdrawType === 'profit') {
      success = withdrawProfit(selectedPartner.id, withdrawAmount, withdrawNotes);
      resultMessage = `تم سحب $${withdrawAmount.toLocaleString()} من الأرباح`;
    } else if (withdrawType === 'capital') {
      success = withdrawCapital(selectedPartner.id, withdrawAmount, withdrawNotes);
      resultMessage = `تم سحب $${withdrawAmount.toLocaleString()} من رأس المال`;
    } else {
      const result = smartWithdraw(selectedPartner.id, withdrawAmount, withdrawNotes);
      success = result.success;
      if (success) {
        const parts = [];
        if (result.fromProfit > 0) parts.push(`$${result.fromProfit.toLocaleString()} من الأرباح`);
        if (result.fromCapital > 0) parts.push(`$${result.fromCapital.toLocaleString()} من رأس المال`);
        resultMessage = `تم سحب ${parts.join(' و ')}`;
      }
    }

    if (success) {
      // إعادة تحميل الشركاء
      setPartners(loadPartners());
      setShowWithdrawDialog(false);
      setSelectedPartner(null);
      setWithdrawAmount(0);
      setWithdrawType('auto');
      setWithdrawNotes('');
      toast.success(resultMessage);
    } else {
      toast.error('حدث خطأ أثناء السحب');
    }
  };

  const handleAddCapital = () => {
    if (!selectedPartner || capitalAmount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    const success = addCapitalToStore(selectedPartner.id, capitalAmount, capitalNotes);
    
    if (success) {
      setPartners(loadPartners());
      setShowAddCapitalDialog(false);
      setSelectedPartner(null);
      setCapitalAmount(0);
      setCapitalNotes('');
      toast.success(`تم إضافة $${capitalAmount.toLocaleString()} إلى رأس المال`);
    } else {
      toast.error('حدث خطأ أثناء إضافة رأس المال');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">إدارة الشركاء</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">إدارة الشركاء وتوزيع الأرباح حسب الأقسام</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCategoryManager(true)}>
            <Tag className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            التصنيفات
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => {
            resetForm();
            setShowAddDialog(true);
          }}>
            <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            إضافة شريك
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
              <p className="text-xs md:text-sm text-muted-foreground">الشركاء</p>
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
              <p className="text-xs md:text-sm text-muted-foreground">موزع</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-warning/10">
              <Wallet className="w-4 h-4 md:w-5 md:h-5 text-warning" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">${formatNumber(stats.totalBalance)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">الأرصدة</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-success/10">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-success" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">${formatNumber(stats.totalProfit)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">الأرباح</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="بحث بالاسم أو رقم الهاتف..."
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
                  <p className="text-xs md:text-sm text-muted-foreground">منذ {partner.joinedDate}</p>
                </div>
              </div>
              <div className="text-left">
                <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-bold bg-primary/10 text-primary">
                  {partner.sharePercentage}%
                </span>
                {partner.accessAll ? (
                  <p className="text-[10px] text-muted-foreground mt-1">كامل المحل</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1">أقسام محددة</p>
                )}
                {partner.sharesExpenses && (
                  <span className="text-[10px] text-success">● يشارك في المصاريف</span>
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
                <p className="text-[10px] md:text-xs text-muted-foreground">الأرباح</p>
                <p className="text-sm md:text-base font-bold text-success">${formatNumber(partner.currentBalance || 0)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] md:text-xs text-muted-foreground">رأس المال</p>
                <p className="text-sm md:text-base font-bold text-info">${formatNumber(partner.currentCapital || 0)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-3 md:pt-4 border-t border-border">
              <Button variant="outline" size="sm" className="flex-1 h-8 md:h-9 text-xs md:text-sm" onClick={() => openViewDialog(partner)}>
                <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                عرض
              </Button>
              <Button size="sm" className="flex-1 h-8 md:h-9 bg-success hover:bg-success/90 text-success-foreground text-xs md:text-sm" onClick={() => openAddCapitalDialog(partner)}>
                <ArrowUpRight className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                إيداع
              </Button>
              {((partner.currentBalance || 0) > 0 || (partner.currentCapital || 0) > 0) && (
                <Button size="sm" className="flex-1 h-8 md:h-9 bg-warning hover:bg-warning/90 text-warning-foreground text-xs md:text-sm" onClick={() => openWithdrawDialog(partner)}>
                  <ArrowDownLeft className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                  سحب
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
              إضافة شريك جديد
            </DialogTitle>
            <DialogDescription>أدخل بيانات الشريك الجديد ونسب الأرباح</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">الاسم *</label>
              <Input
                placeholder="اسم الشريك"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">رقم الهاتف *</label>
              <Input
                placeholder="+963 xxx xxx xxx"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">البريد الإلكتروني</label>
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
                  <p className="font-medium text-foreground">الوصول لكامل المحل</p>
                  <p className="text-sm text-muted-foreground">نسبة موحدة لجميع الأقسام</p>
                </div>
                <Switch 
                  checked={formData.accessAll}
                  onCheckedChange={handleAccessAllChange}
                />
              </div>

              {/* Shares Expenses */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div>
                  <p className="font-medium text-foreground">المشاركة في المصاريف</p>
                  <p className="text-sm text-muted-foreground">هل يشارك هذا الشريك في دفع المصاريف؟</p>
                </div>
                <Switch 
                  checked={formData.sharesExpenses}
                  onCheckedChange={(checked) => setFormData({ ...formData, sharesExpenses: checked })}
                />
              </div>

              {/* Expense Share Percentage */}
              {formData.sharesExpenses && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">نسبة المشاركة في المصاريف (%)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    max="100"
                    value={formData.expenseSharePercentage || ''}
                    onChange={(e) => setFormData({ ...formData, expenseSharePercentage: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">النسبة التي سيدفعها من إجمالي المصاريف</p>
                </div>
              )}

              {formData.accessAll ? (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">نسبة الأرباح لجميع الأقسام (%)</label>
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
                  <p className="text-sm font-medium">نسبة الأرباح لكل قسم:</p>
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
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleAddPartner}>
                <Save className="w-4 h-4 ml-2" />
                حفظ
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
              تعديل بيانات الشريك
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">الاسم *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">رقم الهاتف *</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">البريد الإلكتروني</label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            {/* Access Type */}
            <div className="p-4 bg-muted rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">الوصول لكامل المحل</p>
                  <p className="text-sm text-muted-foreground">نسبة موحدة لجميع الأقسام</p>
                </div>
                <Switch 
                  checked={formData.accessAll}
                  onCheckedChange={handleAccessAllChange}
                />
              </div>

              {/* Shares Expenses */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div>
                  <p className="font-medium text-foreground">المشاركة في المصاريف</p>
                  <p className="text-sm text-muted-foreground">هل يشارك هذا الشريك في دفع المصاريف؟</p>
                </div>
                <Switch 
                  checked={formData.sharesExpenses}
                  onCheckedChange={(checked) => setFormData({ ...formData, sharesExpenses: checked })}
                />
              </div>

              {/* Expense Share Percentage */}
              {formData.sharesExpenses && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">نسبة المشاركة في المصاريف (%)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    max="100"
                    value={formData.expenseSharePercentage || ''}
                    onChange={(e) => setFormData({ ...formData, expenseSharePercentage: Number(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">النسبة التي سيدفعها من إجمالي المصاريف</p>
                </div>
              )}

              {formData.accessAll ? (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">نسبة الأرباح لجميع الأقسام (%)</label>
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
                  <p className="text-sm font-medium">نسبة الأرباح لكل قسم:</p>
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
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleEditPartner}>
                <Save className="w-4 h-4 ml-2" />
                حفظ التغييرات
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Partner Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              تفاصيل الشريك
            </DialogTitle>
          </DialogHeader>
          {selectedPartner && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {selectedPartner.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedPartner.name}</h3>
                  <p className="text-muted-foreground">{selectedPartner.phone}</p>
                  {selectedPartner.email && (
                    <p className="text-sm text-muted-foreground">{selectedPartner.email}</p>
                  )}
                </div>
              </div>

              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نوع الوصول:</span>
                  <span className="font-medium">
                    {selectedPartner.accessAll ? 'كامل المحل' : 'أقسام محددة'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تاريخ الانضمام:</span>
                  <span>{selectedPartner.joinedDate}</span>
                </div>
              </div>

              {/* Category Shares */}
              <div className="space-y-2">
                <p className="text-sm font-medium">نسب الأرباح:</p>
                {selectedPartner.categoryShares.map(cs => {
                  const cat = categories.find(c => c.id === cs.categoryId);
                  return (
                    <div key={cs.categoryId} className={cn(
                      "flex justify-between items-center p-2 rounded-lg",
                      cs.enabled ? "bg-primary/10" : "bg-muted opacity-50"
                    )}>
                      <span className="text-sm">{cat?.label}</span>
                      <span className={cn(
                        "font-bold",
                        cs.enabled ? "text-primary" : "text-muted-foreground"
                      )}>
                        {cs.enabled ? `${cs.percentage}%` : 'غير مفعل'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Financial Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-success/10 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <p className="text-xs text-muted-foreground">الأرباح المتاحة</p>
                  </div>
                  <p className="text-lg font-bold text-success">${formatNumber(selectedPartner.currentBalance || 0)}</p>
                </div>
                <div className="bg-info/10 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <PiggyBank className="w-4 h-4 text-info" />
                    <p className="text-xs text-muted-foreground">رأس المال</p>
                  </div>
                  <p className="text-lg font-bold text-info">${formatNumber(selectedPartner.currentCapital || 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">إجمالي الأرباح المكتسبة</p>
                  <p className="text-lg font-bold">${formatNumber(selectedPartner.totalProfitEarned || 0)}</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">إجمالي المسحوب</p>
                  <p className="text-lg font-bold">${formatNumber(selectedPartner.totalWithdrawn || 0)}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  className="flex-1 bg-success hover:bg-success/90 text-success-foreground" 
                  onClick={() => {
                    setShowViewDialog(false);
                    openAddCapitalDialog(selectedPartner);
                  }}
                >
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                  إضافة رصيد
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
                    سحب رصيد
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog - Improved */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-warning" />
              سحب رصيد
            </DialogTitle>
            <DialogDescription>
              سحب رصيد للشريك {selectedPartner?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedPartner && (
            <div className="space-y-4 py-4">
              {/* الأرصدة المتاحة */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-success/10 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <p className="text-xs text-muted-foreground">الأرباح</p>
                  </div>
                  <p className="text-xl font-bold text-success">${formatNumber(selectedPartner.currentBalance || 0)}</p>
                </div>
                <div className="bg-info/10 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <PiggyBank className="w-4 h-4 text-info" />
                    <p className="text-xs text-muted-foreground">رأس المال</p>
                  </div>
                  <p className="text-xl font-bold text-info">${formatNumber(selectedPartner.currentCapital || 0)}</p>
                </div>
              </div>

              {/* نوع السحب */}
              <div className="space-y-3">
                <label className="text-sm font-medium">نوع السحب</label>
                <RadioGroup value={withdrawType} onValueChange={(value) => setWithdrawType(value as 'profit' | 'capital' | 'auto')}>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="profit" id="profit" disabled={(selectedPartner.currentBalance || 0) <= 0} />
                    <Label htmlFor="profit" className={cn("cursor-pointer", (selectedPartner.currentBalance || 0) <= 0 && "opacity-50")}>
                      سحب من الأرباح فقط
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="capital" id="capital" disabled={(selectedPartner.currentCapital || 0) <= 0} />
                    <Label htmlFor="capital" className={cn("cursor-pointer", (selectedPartner.currentCapital || 0) <= 0 && "opacity-50")}>
                      سحب من رأس المال فقط
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="auto" id="auto" />
                    <Label htmlFor="auto" className="cursor-pointer">
                      تلقائي (الأرباح أولاً ثم رأس المال)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* مبلغ السحب */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">مبلغ السحب ($)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={withdrawAmount || ''}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                />
              </div>

              {/* أزرار السحب السريع */}
              <div className="flex gap-2">
                {withdrawType === 'profit' && (selectedPartner.currentBalance || 0) > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={() => setWithdrawAmount(selectedPartner.currentBalance || 0)}
                  >
                    كامل الأرباح
                  </Button>
                )}
                {withdrawType === 'capital' && (selectedPartner.currentCapital || 0) > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={() => setWithdrawAmount(selectedPartner.currentCapital || 0)}
                  >
                    كامل رأس المال
                  </Button>
                )}
                {withdrawType === 'auto' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={() => setWithdrawAmount((selectedPartner.currentBalance || 0) + (selectedPartner.currentCapital || 0))}
                  >
                    سحب كل الرصيد
                  </Button>
                )}
              </div>

              {/* ملاحظات */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">ملاحظات (اختياري)</label>
                <Textarea
                  placeholder="أضف ملاحظة..."
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowWithdrawDialog(false)}>
                  إلغاء
                </Button>
                <Button className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground" onClick={handleWithdraw}>
                  <Save className="w-4 h-4 ml-2" />
                  تأكيد السحب
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
              إضافة رأس مال
            </DialogTitle>
            <DialogDescription>
              إضافة رأس مال للشريك {selectedPartner?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedPartner && (
            <div className="space-y-4 py-4">
              <div className="bg-info/10 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <PiggyBank className="w-5 h-5 text-info" />
                  <p className="text-sm text-muted-foreground">رأس المال الحالي</p>
                </div>
                <p className="text-3xl font-bold text-info">${formatNumber(selectedPartner.currentCapital || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  (الإجمالي: ${formatNumber(selectedPartner.initialCapital || 0)})
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">مبلغ الإيداع ($)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={capitalAmount || ''}
                  onChange={(e) => setCapitalAmount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">ملاحظات (اختياري)</label>
                <Textarea
                  placeholder="مثال: إيداع شهر يناير..."
                  value={capitalNotes}
                  onChange={(e) => setCapitalNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddCapitalDialog(false)}>
                  إلغاء
                </Button>
                <Button className="flex-1 bg-success hover:bg-success/90 text-success-foreground" onClick={handleAddCapital}>
                  <Save className="w-4 h-4 ml-2" />
                  تأكيد الإيداع
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
            <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الشريك "{selectedPartner?.name}" نهائياً. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePartner} className="bg-destructive hover:bg-destructive/90">
              حذف
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
