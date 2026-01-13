import { useState } from 'react';
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
  Save,
  UserCheck,
  Percent
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

const categories = [
  { id: 'phones', label: 'الهواتف' },
  { id: 'maintenance', label: 'الصيانة' },
  { id: 'accessories', label: 'الإكسسوارات' },
  { id: 'screens', label: 'الشاشات' },
];

interface CategoryShare {
  categoryId: string;
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
  joinedDate: string;
  totalProfitEarned: number;
  totalWithdrawn: number;
  currentBalance: number;
}

const initialPartners: Partner[] = [
  { 
    id: '1', 
    name: 'علي محمد', 
    phone: '+963 987 654 321', 
    email: 'ali@example.com',
    sharePercentage: 30, 
    categoryShares: [
      { categoryId: 'phones', percentage: 30, enabled: true },
      { categoryId: 'maintenance', percentage: 30, enabled: true },
      { categoryId: 'accessories', percentage: 30, enabled: true },
      { categoryId: 'screens', percentage: 30, enabled: true },
    ],
    accessAll: true,
    joinedDate: '2024-01-01',
    totalProfitEarned: 15000,
    totalWithdrawn: 10000,
    currentBalance: 5000
  },
  { 
    id: '2', 
    name: 'أحمد خالد', 
    phone: '+963 955 123 456', 
    email: 'ahmed@example.com',
    sharePercentage: 20, 
    categoryShares: [
      { categoryId: 'phones', percentage: 20, enabled: true },
      { categoryId: 'maintenance', percentage: 0, enabled: false },
      { categoryId: 'accessories', percentage: 20, enabled: true },
      { categoryId: 'screens', percentage: 0, enabled: false },
    ],
    accessAll: false,
    joinedDate: '2024-03-15',
    totalProfitEarned: 8000,
    totalWithdrawn: 6000,
    currentBalance: 2000
  },
  { 
    id: '3', 
    name: 'سامر حسن', 
    phone: '+963 944 789 012', 
    sharePercentage: 50, 
    categoryShares: [
      { categoryId: 'phones', percentage: 0, enabled: false },
      { categoryId: 'maintenance', percentage: 50, enabled: true },
      { categoryId: 'accessories', percentage: 0, enabled: false },
      { categoryId: 'screens', percentage: 0, enabled: false },
    ],
    accessAll: false,
    joinedDate: '2024-01-01',
    totalProfitEarned: 25000,
    totalWithdrawn: 20000,
    currentBalance: 5000
  },
];

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>(initialPartners);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    accessAll: true,
    categoryShares: categories.map(c => ({
      categoryId: c.id,
      percentage: 0,
      enabled: true,
    })),
  });
  const [withdrawAmount, setWithdrawAmount] = useState(0);

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

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      accessAll: true,
      categoryShares: categories.map(c => ({
        categoryId: c.id,
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
      joinedDate: new Date().toISOString().split('T')[0],
      totalProfitEarned: 0,
      totalWithdrawn: 0,
      currentBalance: 0,
    };
    
    setPartners([...partners, newPartner]);
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
    
    setPartners(partners.map(p => 
      p.id === selectedPartner.id 
        ? { 
            ...p, 
            name: formData.name, 
            phone: formData.phone, 
            email: formData.email || undefined, 
            sharePercentage: mainShare,
            categoryShares: formData.categoryShares,
            accessAll: formData.accessAll,
          }
        : p
    ));
    setShowEditDialog(false);
    setSelectedPartner(null);
    toast.success('تم تعديل بيانات الشريك بنجاح');
  };

  const handleDeletePartner = () => {
    if (!selectedPartner) return;
    
    setPartners(partners.filter(p => p.id !== selectedPartner.id));
    setShowDeleteDialog(false);
    setSelectedPartner(null);
    toast.success('تم حذف الشريك بنجاح');
  };

  const handleWithdraw = () => {
    if (!selectedPartner || withdrawAmount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (withdrawAmount > selectedPartner.currentBalance) {
      toast.error('المبلغ أكبر من الرصيد المتاح');
      return;
    }

    setPartners(partners.map(p => 
      p.id === selectedPartner.id 
        ? { 
            ...p, 
            totalWithdrawn: p.totalWithdrawn + withdrawAmount,
            currentBalance: p.currentBalance - withdrawAmount
          }
        : p
    ));
    setShowWithdrawDialog(false);
    setSelectedPartner(null);
    setWithdrawAmount(0);
    toast.success('تم تسجيل السحب بنجاح');
  };

  const openEditDialog = (partner: Partner) => {
    setSelectedPartner(partner);
    setFormData({
      name: partner.name,
      phone: partner.phone,
      email: partner.email || '',
      accessAll: partner.accessAll,
      categoryShares: partner.categoryShares.length > 0 
        ? partner.categoryShares 
        : categories.map(c => ({
            categoryId: c.id,
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
        <Button className="bg-primary hover:bg-primary/90" onClick={() => {
          resetForm();
          setShowAddDialog(true);
        }}>
          <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
          إضافة شريك
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
              <UserCheck className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.totalPartners}</p>
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
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.totalShare}%</p>
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
              <p className="text-lg md:text-2xl font-bold text-foreground">${stats.totalBalance.toLocaleString()}</p>
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
              <p className="text-lg md:text-2xl font-bold text-foreground">${stats.totalProfit.toLocaleString()}</p>
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
              </div>
            </div>

            {/* Category Shares */}
            {!partner.accessAll && partner.categoryShares.filter(c => c.enabled).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {partner.categoryShares.filter(c => c.enabled).map(cs => {
                  const cat = categories.find(c => c.id === cs.categoryId);
                  return (
                    <span key={cs.categoryId} className="px-2 py-0.5 rounded-full text-[10px] bg-accent/10 text-accent">
                      {cat?.label}: {cs.percentage}%
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
            <div className="grid grid-cols-3 gap-2 py-3 md:py-4 border-t border-border">
              <div className="text-center">
                <p className="text-[10px] md:text-xs text-muted-foreground">الأرباح</p>
                <p className="text-sm md:text-base font-bold text-success">${partner.totalProfitEarned.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] md:text-xs text-muted-foreground">المسحوب</p>
                <p className="text-sm md:text-base font-bold text-muted-foreground">${partner.totalWithdrawn.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] md:text-xs text-muted-foreground">الرصيد</p>
                <p className="text-sm md:text-base font-bold text-primary">${partner.currentBalance.toLocaleString()}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-3 md:pt-4 border-t border-border">
              <Button variant="outline" size="sm" className="flex-1 h-8 md:h-9 text-xs md:text-sm" onClick={() => openViewDialog(partner)}>
                <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
                عرض
              </Button>
              {partner.currentBalance > 0 && (
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

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-success/10 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">إجمالي الأرباح</p>
                  <p className="text-lg font-bold text-success">${selectedPartner.totalProfitEarned.toLocaleString()}</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">المسحوب</p>
                  <p className="text-lg font-bold">${selectedPartner.totalWithdrawn.toLocaleString()}</p>
                </div>
                <div className="bg-primary/10 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">الرصيد</p>
                  <p className="text-lg font-bold text-primary">${selectedPartner.currentBalance.toLocaleString()}</p>
                </div>
              </div>

              {selectedPartner.currentBalance > 0 && (
                <Button 
                  className="w-full bg-warning hover:bg-warning/90 text-warning-foreground" 
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
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
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
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">الرصيد المتاح</p>
                <p className="text-3xl font-bold text-primary">${selectedPartner.currentBalance.toLocaleString()}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">مبلغ السحب ($)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={withdrawAmount || ''}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                  max={selectedPartner.currentBalance}
                />
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setWithdrawAmount(selectedPartner.currentBalance)}
              >
                سحب كامل الرصيد
              </Button>

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
    </div>
  );
}
