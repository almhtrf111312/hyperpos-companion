import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, Edit, Trash2, BookOpen, X, Save,
  UserCheck, UserX, Clock, AlertTriangle, RotateCcw, Ban
} from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/use-language';
import { DatePicker } from '@/components/ui/date-picker';
import {
  loadMembersCloud, addMemberCloud, updateMemberCloud, deleteMemberCloud,
  loadLoansCloud, addLoanCloud, returnLoanCloud, markLoanLostCloud, deleteLoanCloud,
  LibraryMember, BookLoan
} from '@/lib/cloud/library-cloud';
import { loadProductsCloud, Product } from '@/lib/cloud/products-cloud';

export default function LibraryMembers() {
  const { t, isRTL } = useLanguage();
  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [loans, setLoans] = useState<BookLoan[]>([]);
  const [books, setBooks] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('members');

  // Member dialogs
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditMember, setShowEditMember] = useState(false);
  const [showDeleteMember, setShowDeleteMember] = useState(false);
  const [selectedMember, setSelectedMember] = useState<LibraryMember | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', phone: '', email: '', notes: '' });

  // Loan dialogs
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<BookLoan | null>(null);
  const [loanForm, setLoanForm] = useState({ productId: '', memberId: '', dueDate: '', notes: '' });
  const [returnLateFee, setReturnLateFee] = useState(0);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [m, l, b] = await Promise.all([
        loadMembersCloud(), loadLoansCloud(), loadProductsCloud()
      ]);
      setMembers(m);
      setLoans(l);
      setBooks(b);
    } catch (e) {
      console.error('Failed to load library data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Member CRUD
  const handleAddMember = async () => {
    if (!memberForm.name.trim()) { toast.error('الاسم مطلوب'); return; }
    const result = await addMemberCloud(memberForm);
    if (result) {
      toast.success('تم إضافة العضو بنجاح');
      setShowAddMember(false);
      setMemberForm({ name: '', phone: '', email: '', notes: '' });
      loadData();
    } else {
      toast.error('فشل في إضافة العضو');
    }
  };

  const handleEditMember = async () => {
    if (!selectedMember) return;
    const ok = await updateMemberCloud(selectedMember.id, memberForm);
    if (ok) {
      toast.success('تم تحديث العضو');
      setShowEditMember(false);
      loadData();
    } else {
      toast.error('فشل في التحديث');
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;
    const ok = await deleteMemberCloud(selectedMember.id);
    if (ok) {
      toast.success('تم حذف العضو');
      setShowDeleteMember(false);
      loadData();
    } else {
      toast.error('فشل في الحذف');
    }
  };

  // Loan CRUD
  const handleAddLoan = async () => {
    if (!loanForm.productId || !loanForm.memberId || !loanForm.dueDate) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    const result = await addLoanCloud(loanForm);
    if (result) {
      toast.success('تم تسجيل الإعارة بنجاح');
      setShowAddLoan(false);
      setLoanForm({ productId: '', memberId: '', dueDate: '', notes: '' });
      loadData();
    } else {
      toast.error('فشل في تسجيل الإعارة');
    }
  };

  const handleReturnLoan = async () => {
    if (!selectedLoan) return;
    const ok = await returnLoanCloud(selectedLoan.id, returnLateFee);
    if (ok) {
      toast.success('تم إرجاع الكتاب');
      setShowReturnDialog(false);
      setReturnLateFee(0);
      loadData();
    } else {
      toast.error('فشل في تسجيل الإرجاع');
    }
  };

  const handleMarkLost = async (loan: BookLoan) => {
    const ok = await markLoanLostCloud(loan.id);
    if (ok) {
      toast.success('تم تسجيل الكتاب كمفقود');
      loadData();
    }
  };

  // Filters
  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.phone.includes(searchQuery)
  );

  const filteredLoans = loans.filter(l =>
    (l.memberName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.bookName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeLoansByMember = (memberId: string) =>
    loans.filter(l => l.memberId === memberId && l.status === 'active').length;

  const overdueLoans = loans.filter(l => {
    if (l.status !== 'active') return false;
    return new Date(l.dueDate) < new Date();
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">نشط</span>;
      case 'returned': return <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">مُرجع</span>;
      case 'overdue': return <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">متأخر</span>;
      case 'lost': return <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">مفقود</span>;
      default: return null;
    }
  };

  const isOverdue = (loan: BookLoan) => loan.status === 'active' && new Date(loan.dueDate) < new Date();

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            إدارة المكتبة
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة الأعضاء والإعارات</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs">الأعضاء</span>
          </div>
          <p className="text-lg font-bold text-foreground">{members.length}</p>
        </div>
        <div className="bg-card rounded-xl border p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs">إعارات نشطة</span>
          </div>
          <p className="text-lg font-bold text-foreground">{loans.filter(l => l.status === 'active').length}</p>
        </div>
        <div className="bg-card rounded-xl border p-3">
          <div className="flex items-center gap-2 text-destructive mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs">متأخرة</span>
          </div>
          <p className="text-lg font-bold text-destructive">{overdueLoans.length}</p>
        </div>
        <div className="bg-card rounded-xl border p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Ban className="w-4 h-4" />
            <span className="text-xs">مفقودة</span>
          </div>
          <p className="text-lg font-bold text-foreground">{loans.filter(l => l.status === 'lost').length}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="members" className="flex-1 gap-1">
            <Users className="w-4 h-4" /> الأعضاء
          </TabsTrigger>
          <TabsTrigger value="loans" className="flex-1 gap-1">
            <BookOpen className="w-4 h-4" /> الإعارات
          </TabsTrigger>
        </TabsList>

        {/* Search + Add */}
        <div className="flex gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
            />
          </div>
          <Button onClick={() => {
            if (activeTab === 'members') {
              setMemberForm({ name: '', phone: '', email: '', notes: '' });
              setShowAddMember(true);
            } else {
              setLoanForm({ productId: '', memberId: '', dueDate: '', notes: '' });
              setShowAddLoan(true);
            }
          }}>
            <Plus className="w-4 h-4 ml-1" />
            {activeTab === 'members' ? 'عضو جديد' : 'إعارة جديدة'}
          </Button>
        </div>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-2 mt-2">
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">لا يوجد أعضاء بعد</div>
          ) : (
            filteredMembers.map(member => (
              <div key={member.id} className="bg-card rounded-xl border p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground truncate">{member.name}</p>
                    {member.membershipStatus === 'active' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success">نشط</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">معلّق</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {member.phone && <span>{member.phone}</span>}
                    <span>إعارات نشطة: {activeLoansByMember(member.id)}</span>
                    {member.lateFees > 0 && (
                      <span className="text-destructive">غرامات: {formatNumber(member.lateFees)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                    setSelectedMember(member);
                    setMemberForm({ name: member.name, phone: member.phone, email: member.email, notes: member.notes });
                    setShowEditMember(true);
                  }}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                    setSelectedMember(member);
                    setShowDeleteMember(true);
                  }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Loans Tab */}
        <TabsContent value="loans" className="space-y-2 mt-2">
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : filteredLoans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">لا يوجد إعارات بعد</div>
          ) : (
            filteredLoans.map(loan => (
              <div key={loan.id} className={cn(
                "bg-card rounded-xl border p-4",
                isOverdue(loan) && "border-destructive/50"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">{loan.bookName}</p>
                      {getStatusBadge(isOverdue(loan) ? 'overdue' : loan.status)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>العضو: {loan.memberName}</span>
                      <span>الإعارة: {loan.loanDate}</span>
                      <span className={cn(isOverdue(loan) && "text-destructive font-medium")}>
                        الاسترداد: {loan.dueDate}
                      </span>
                    </div>
                    {loan.returnDate && (
                      <p className="text-xs text-success mt-0.5">تم الإرجاع: {loan.returnDate}</p>
                    )}
                  </div>
                  {loan.status === 'active' && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                        setSelectedLoan(loan);
                        setReturnLateFee(0);
                        setShowReturnDialog(true);
                      }}>
                        <RotateCcw className="w-3 h-3 ml-1" /> إرجاع
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleMarkLost(loan)}>
                        مفقود
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Member Dialog */}
      <Dialog open={showAddMember || showEditMember} onOpenChange={(open) => {
        if (!open) { setShowAddMember(false); setShowEditMember(false); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{showEditMember ? 'تعديل العضو' : 'عضو جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">اسم العضو *</label>
              <Input value={memberForm.name} onChange={(e) => setMemberForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">رقم الهاتف</label>
              <Input value={memberForm.phone} onChange={(e) => setMemberForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">البريد الإلكتروني</label>
              <Input value={memberForm.email} onChange={(e) => setMemberForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ملاحظات</label>
              <Input value={memberForm.notes} onChange={(e) => setMemberForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={showEditMember ? handleEditMember : handleAddMember}>
              <Save className="w-4 h-4 ml-1" />
              {showEditMember ? 'تحديث' : 'إضافة'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Loan Dialog */}
      <Dialog open={showAddLoan} onOpenChange={setShowAddLoan}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إعارة كتاب</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">الكتاب *</label>
              <Select value={loanForm.productId} onValueChange={(v) => setLoanForm(p => ({ ...p, productId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر كتاب" /></SelectTrigger>
                <SelectContent>
                  {books.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">العضو *</label>
              <Select value={loanForm.memberId} onValueChange={(v) => setLoanForm(p => ({ ...p, memberId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر عضو" /></SelectTrigger>
                <SelectContent>
                  {members.filter(m => m.membershipStatus === 'active').map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">تاريخ الاسترداد *</label>
              <Input
                type="date"
                value={loanForm.dueDate}
                onChange={(e) => setLoanForm(p => ({ ...p, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ملاحظات</label>
              <Input value={loanForm.notes} onChange={(e) => setLoanForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleAddLoan}>
              <BookOpen className="w-4 h-4 ml-1" /> تسجيل الإعارة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return Loan Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إرجاع كتاب</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              الكتاب: <strong>{selectedLoan?.bookName}</strong>
              <br />
              العضو: <strong>{selectedLoan?.memberName}</strong>
            </p>
            {selectedLoan && isOverdue(selectedLoan) && (
              <div className="bg-destructive/10 rounded-lg p-3 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 inline ml-1" />
                هذا الكتاب متأخر عن موعد الاسترداد!
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">غرامة التأخير</label>
              <Input
                type="number"
                value={returnLateFee}
                onChange={(e) => setReturnLateFee(Number(e.target.value))}
                min={0}
              />
            </div>
            <Button className="w-full" onClick={handleReturnLoan}>
              <RotateCcw className="w-4 h-4 ml-1" /> تأكيد الإرجاع
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Member Confirm */}
      <AlertDialog open={showDeleteMember} onOpenChange={setShowDeleteMember}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العضو</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف العضو "{selectedMember?.name}"؟ سيتم حذف جميع إعاراته أيضاً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
