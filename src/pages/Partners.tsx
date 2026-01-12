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

interface Partner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  sharePercentage: number;
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
    sharePercentage: 0,
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

  const handleAddPartner = () => {
    if (!formData.name || !formData.phone || formData.sharePercentage <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const totalShare = stats.totalShare + formData.sharePercentage;
    if (totalShare > 100) {
      toast.error('مجموع نسب الشركاء لا يمكن أن يتجاوز 100%');
      return;
    }
    
    const newPartner: Partner = {
      id: Date.now().toString(),
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      sharePercentage: formData.sharePercentage,
      joinedDate: new Date().toISOString().split('T')[0],
      totalProfitEarned: 0,
      totalWithdrawn: 0,
      currentBalance: 0,
    };
    
    setPartners([...partners, newPartner]);
    setShowAddDialog(false);
    setFormData({ name: '', phone: '', email: '', sharePercentage: 0 });
    toast.success('تم إضافة الشريك بنجاح');
  };

  const handleEditPartner = () => {
    if (!selectedPartner || !formData.name) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }

    const otherShareTotal = partners
      .filter(p => p.id !== selectedPartner.id)
      .reduce((sum, p) => sum + p.sharePercentage, 0);
    
    if (otherShareTotal + formData.sharePercentage > 100) {
      toast.error('مجموع نسب الشركاء لا يمكن أن يتجاوز 100%');
      return;
    }
    
    setPartners(partners.map(p => 
      p.id === selectedPartner.id 
        ? { ...p, name: formData.name, phone: formData.phone, email: formData.email || undefined, sharePercentage: formData.sharePercentage }
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
      sharePercentage: partner.sharePercentage,
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

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">إدارة الشركاء</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">إدارة الشركاء وتوزيع الأرباح</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => {
          setFormData({ name: '', phone: '', email: '', sharePercentage: 0 });
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
              <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-bold bg-primary/10 text-primary">
                {partner.sharePercentage}%
              </span>
            </div>

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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              إضافة شريك جديد
            </DialogTitle>
            <DialogDescription>أدخل بيانات الشريك الجديد</DialogDescription>
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
            <div>
              <label className="text-sm font-medium mb-1.5 block">نسبة الأرباح (%) *</label>
              <Input
                type="number"
                placeholder="0"
                min="1"
                max={100 - stats.totalShare}
                value={formData.sharePercentage || ''}
                onChange={(e) => setFormData({ ...formData, sharePercentage: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                المتاح: {100 - stats.totalShare}%
              </p>
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
        <DialogContent className="sm:max-w-md">
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
            <div>
              <label className="text-sm font-medium mb-1.5 block">نسبة الأرباح (%)</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={formData.sharePercentage || ''}
                onChange={(e) => setFormData({ ...formData, sharePercentage: Number(e.target.value) })}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleEditPartner}>
                <Save className="w-4 h-4 ml-2" />
                حفظ
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
                  <p className="text-muted-foreground">نسبة الأرباح: {selectedPartner.sharePercentage}%</p>
                </div>
              </div>
              
              <div className="space-y-2 bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedPartner.phone}</span>
                </div>
                {selectedPartner.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedPartner.email}</span>
                  </div>
                )}
                <div className="text-sm text-muted-foreground pt-2 border-t border-border">
                  تاريخ الانضمام: {selectedPartner.joinedDate}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">إجمالي الأرباح</p>
                  <p className="text-lg font-bold text-success">${selectedPartner.totalProfitEarned.toLocaleString()}</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">المسحوب</p>
                  <p className="text-lg font-bold">${selectedPartner.totalWithdrawn.toLocaleString()}</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
                  <p className="text-lg font-bold text-primary">${selectedPartner.currentBalance.toLocaleString()}</p>
                </div>
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
              سحب أرباح
            </DialogTitle>
            <DialogDescription>
              سحب أرباح للشريك {selectedPartner?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedPartner && (
            <div className="space-y-4 py-4">
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">الرصيد المتاح</p>
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
                  <ArrowDownLeft className="w-4 h-4 ml-2" />
                  تأكيد السحب
                </Button>
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
              هل أنت متأكد من حذف الشريك "{selectedPartner?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
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
