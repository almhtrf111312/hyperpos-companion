import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus,
  Receipt,
  Calendar,
  DollarSign,
  Trash2,
  Save,
  Users,
  TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { 
  loadExpenses, 
  addExpense, 
  deleteExpense,
  getExpenseStats,
  expenseTypes,
  Expense,
  ExpenseType 
} from '@/lib/expenses-store';
import { EVENTS } from '@/lib/events';

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    type: 'rent' as ExpenseType,
    customType: '',
    amount: 0,
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Listen for expense updates
  useEffect(() => {
    const handleUpdate = () => {
      setExpenses(loadExpenses());
    };
    
    window.addEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
    return () => window.removeEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
  }, []);

  const filteredExpenses = expenses.filter(expense =>
    expense.typeLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    expense.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = getExpenseStats();

  const resetForm = () => {
    setFormData({
      type: 'rent',
      customType: '',
      amount: 0,
      notes: '',
      date: new Date().toISOString().split('T')[0],
    });
  };

  const handleAddExpense = () => {
    if (formData.amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (formData.type === 'other' && !formData.customType) {
      toast.error('يرجى تحديد نوع المصروف');
      return;
    }

    addExpense({
      type: formData.type,
      customType: formData.customType,
      amount: formData.amount,
      notes: formData.notes,
      date: formData.date,
    });

    setExpenses(loadExpenses());
    setShowAddDialog(false);
    resetForm();
    toast.success('تم إضافة المصروف بنجاح');
  };

  const handleDeleteExpense = () => {
    if (!selectedExpense) return;
    
    deleteExpense(selectedExpense.id);
    setExpenses(loadExpenses());
    setShowDeleteDialog(false);
    setSelectedExpense(null);
    toast.success('تم حذف المصروف بنجاح');
  };

  const openDeleteDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowDeleteDialog(true);
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">المصاريف</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">إدارة المصاريف والنفقات الشهرية</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => {
          resetForm();
          setShowAddDialog(true);
        }}>
          <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
          إضافة مصروف
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-destructive/10">
              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">${stats.totalThisMonth.toLocaleString()}</p>
              <p className="text-xs md:text-sm text-muted-foreground">هذا الشهر</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-warning/10">
              <Receipt className="w-4 h-4 md:w-5 md:h-5 text-warning" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.monthlyCount}</p>
              <p className="text-xs md:text-sm text-muted-foreground">مصروف الشهر</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-info/10">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-info" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">${stats.totalExpenses.toLocaleString()}</p>
              <p className="text-xs md:text-sm text-muted-foreground">الإجمالي</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
              <Calendar className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.expenseCount}</p>
              <p className="text-xs md:text-sm text-muted-foreground">إجمالي السجلات</p>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Types Summary */}
      {Object.keys(stats.byType).length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-medium mb-3">توزيع مصاريف الشهر</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byType).map(([type, amount]) => (
              <div key={type} className="px-3 py-2 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">{type}: </span>
                <span className="font-semibold">${amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="بحث في المصاريف..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-9 md:pr-10 bg-muted border-0"
        />
      </div>

      {/* Expenses List */}
      <div className="space-y-3">
        {filteredExpenses.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">لا توجد مصاريف مسجلة</p>
            <p className="text-sm text-muted-foreground">ابدأ بإضافة مصروف جديد</p>
          </div>
        ) : (
          filteredExpenses.map((expense, index) => (
            <div 
              key={expense.id}
              className="bg-card rounded-xl border border-border p-4 card-hover fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{expense.typeLabel}</h3>
                    <p className="text-sm text-muted-foreground">{expense.date}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-destructive">-${expense.amount.toLocaleString()}</p>
                </div>
              </div>
              
              {expense.notes && (
                <p className="mt-2 text-sm text-muted-foreground bg-muted rounded-lg p-2">
                  {expense.notes}
                </p>
              )}
              
              {expense.distributions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    توزيع على الشركاء:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {expense.distributions.map(dist => (
                      <span key={dist.partnerId} className="px-2 py-1 bg-muted rounded-full text-xs">
                        {dist.partnerName}: ${dist.amount.toFixed(0)} ({dist.percentage.toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end mt-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => openDeleteDialog(expense)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              إضافة مصروف جديد
            </DialogTitle>
            <DialogDescription>سجل مصروف جديد وحدد نوعه والمبلغ</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">نوع المصروف *</label>
              <Select
                value={formData.type}
                onValueChange={(value: ExpenseType) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع المصروف" />
                </SelectTrigger>
                <SelectContent>
                  {expenseTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'other' && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">اسم المصروف *</label>
                <Input
                  placeholder="مثال: صيانة المكيف"
                  value={formData.customType}
                  onChange={(e) => setFormData({ ...formData, customType: e.target.value })}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1.5 block">المبلغ ($) *</label>
              <Input
                type="number"
                placeholder="0"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                min="0"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">التاريخ *</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">ملاحظات</label>
              <Textarea
                placeholder="أي ملاحظات إضافية..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleAddExpense}>
                <Save className="w-4 h-4 ml-2" />
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المصروف "{selectedExpense?.typeLabel}" بقيمة ${selectedExpense?.amount.toLocaleString()} نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
