// Cash Box (الصندوق) Page - Shift Management & Reconciliation
import { useState, useEffect, useMemo } from 'react';
import {
  Wallet, Clock, Play, Square, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight,
  History, Calculator, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { addActivityLog } from '@/lib/activity-log';
import { formatNumber, formatCurrency, formatDateTime, formatDate, formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  loadCashboxState,
  loadShifts,
  getActiveShift,
  openShift,
  closeShift,
  getShiftStats,
  addShiftAdjustment,
  Shift,
} from '@/lib/cashbox-store';
import { EVENTS } from '@/lib/events';

export default function Cashbox() {
  const { user, profile } = useAuth();
  const [cashboxState, setCashboxState] = useState(loadCashboxState());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  // Dialog states
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Form states
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // Load data
  const loadData = () => {
    setCashboxState(loadCashboxState());
    setShifts(loadShifts());
    setActiveShift(getActiveShift());
  };

  useEffect(() => {
    loadData();

    // Listen for updates
    const handleUpdate = () => loadData();
    window.addEventListener(EVENTS.CASHBOX_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.SHIFTS_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);

    return () => {
      window.removeEventListener(EVENTS.CASHBOX_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.SHIFTS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
    };
  }, []);

  // Calculate expected closing cash
  const expectedClosing = useMemo(() => {
    if (!activeShift) return 0;
    return activeShift.openingCash + activeShift.salesTotal + activeShift.depositsTotal
      - activeShift.expensesTotal - activeShift.withdrawalsTotal;
  }, [activeShift]);

  // Stats
  const stats = useMemo(() => getShiftStats(), [shifts]);

  // Handlers
  const handleOpenShift = () => {
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    const userName = profile?.full_name || user?.email || 'مستخدم';
    const userId = user?.id || '';

    openShift(amount, userId, userName);

    addActivityLog(
      'shift_opened',
      userId,
      userName,
      `تم فتح وردية جديدة برصيد افتتاحي ${formatCurrency(amount, '$')}`,
      { openingCash: amount }
    );

    toast.success('تم فتح الوردية بنجاح');
    setShowOpenDialog(false);
    setOpeningAmount('');
    loadData();
  };

  const handleCloseShift = () => {
    const amount = parseFloat(closingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    const result = closeShift(amount, closingNotes);

    if (!result) {
      toast.error('لا توجد وردية مفتوحة');
      return;
    }

    const userName = profile?.full_name || user?.email || 'مستخدم';
    const userId = user?.id || '';

    addActivityLog(
      'shift_closed',
      userId,
      userName,
      `تم إغلاق الوردية - الفارق: ${formatCurrency(result.discrepancy, '$')}`,
      {
        closingCash: amount,
        expectedCash: result.shift.expectedCash,
        discrepancy: result.discrepancy
      }
    );

    if (result.discrepancy !== 0) {
      const type = result.discrepancy > 0 ? 'فائض' : 'عجز';
      toast.warning(`تم إغلاق الوردية مع ${type}: ${formatCurrency(Math.abs(result.discrepancy), '$')}`);
    } else {
      toast.success('تم إغلاق الوردية بنجاح - الصندوق متطابق');
    }

    setShowCloseDialog(false);
    setClosingAmount('');
    setClosingNotes('');
    loadData();
  };

  return (
    <div className="min-h-screen bg-background p-2.5 sm:p-4 md:p-6 pt-2 sm:pt-3 space-y-3">
      {/* Top Section: Shift Card (Closed or Active) directly at the top */}
      {!activeShift ? (
        /* بطاقة لا توجد ورديات مفتوحة حالياً مرفوعة لأعلى الصفحة مباشرة */
        <div className="bg-card border border-border/80 rounded-2xl p-5 md:p-6 text-center space-y-3.5 shadow-xs relative overflow-hidden rtl:pr-14 ltr:pl-14 md:rtl:pr-6 md:ltr:pl-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-foreground">صندوق الوردية</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 rounded-xl text-xs gap-1.5 font-medium border-border/80 shadow-2xs cursor-pointer"
              onClick={() => setShowHistoryDialog(true)}
            >
              <History className="w-3.5 h-3.5" />
              <span>سجل الورديات</span>
            </Button>
          </div>

          <div className="py-2">
            <h2 className="text-base sm:text-lg font-bold text-foreground">لا توجد ورديات مفتوحة حالياً</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              ابدأ وردية جديدة لتسجيل ومتابعة المبيعات، المقبوضات، والمصروفات النقدية للصندوق بدقة
            </p>
          </div>
          <div className="pt-0.5">
            <Button
              onClick={() => setShowOpenDialog(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 px-6 rounded-2xl shadow-md shadow-primary/25 text-xs sm:text-sm gap-2 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>فتح وردية جديدة الآن</span>
            </Button>
          </div>
        </div>
      ) : (
        /* بطاقة الوردية النشطة مدمجة بالكامل مع زر إغلاق الوردية بداخلها */
        <Card className="border border-border/80 rounded-2xl overflow-hidden shadow-xs rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
          <CardHeader className="p-4 pb-3 border-b border-border/50 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-foreground">الوردية الحالية المفتوحة</CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    المسؤول: <span className="font-semibold text-foreground">{activeShift.userName}</span> • بدأت: <span className="font-mono">{formatDateTime(activeShift.openedAt)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 rounded-xl text-xs gap-1.5 font-medium border-border/80 shadow-2xs cursor-pointer"
                  onClick={() => setShowHistoryDialog(true)}
                >
                  <History className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">السجل</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 px-3 rounded-xl text-xs font-bold gap-1.5 shadow-sm cursor-pointer"
                  onClick={() => setShowCloseDialog(true)}
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>إغلاق الوردية</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              <div className="bg-muted/50 rounded-xl p-3 border border-border/40">
                <p className="text-[10px] sm:text-xs text-muted-foreground">رصيد الافتتاح</p>
                <p className="text-sm sm:text-base font-black text-foreground font-mono mt-0.5">
                  {formatCurrency(activeShift.openingCash, '$')}
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-3 border border-border/40">
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                  المبيعات
                </p>
                <p className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  +{formatCurrency(activeShift.salesTotal, '$')}
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-3 border border-border/40">
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                  الإيداعات
                </p>
                <p className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  +{formatCurrency(activeShift.depositsTotal, '$')}
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-3 border border-border/40">
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowDownRight className="w-3 h-3 text-destructive" />
                  المصاريف
                </p>
                <p className="text-sm sm:text-base font-black text-destructive font-mono mt-0.5">
                  -{formatCurrency(activeShift.expensesTotal, '$')}
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-3 border border-border/40">
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowDownRight className="w-3 h-3 text-destructive" />
                  السحوبات
                </p>
                <p className="text-sm sm:text-base font-black text-destructive font-mono mt-0.5">
                  -{formatCurrency(activeShift.withdrawalsTotal, '$')}
                </p>
              </div>

              <div className="bg-primary/10 rounded-xl p-3 border border-primary/30">
                <p className="text-[10px] sm:text-xs text-primary font-bold flex items-center gap-1">
                  <Calculator className="w-3 h-3" />
                  الرصيد المتوقع
                </p>
                <p className="text-sm sm:text-base font-black text-primary font-mono mt-0.5">
                  {formatCurrency(expectedClosing, '$')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compact 4-Metric Grid */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 text-center select-none">
        <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
          <span className="text-[9.5px] text-muted-foreground font-medium block truncate">حالة الوردية</span>
          <span className={cn(
            "text-xs sm:text-sm font-black tabular-nums block mt-0.5",
            activeShift ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"
          )}>
            {activeShift ? 'مفتوحة' : 'مغلقة'}
          </span>
        </div>
        <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
          <span className="text-[9.5px] text-primary font-medium block truncate">الرصيد الحالي</span>
          <span className="text-xs sm:text-sm font-black text-primary font-mono tabular-nums block mt-0.5">
            {formatCurrency(cashboxState.currentBalance, '$')}
          </span>
        </div>
        <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
          <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-medium block truncate">إجمالي الفائض</span>
          <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums block mt-0.5">
            {formatCurrency(stats.totalSurplus, '$')}
          </span>
        </div>
        <div className="bg-card py-2 px-1 rounded-xl border border-border shadow-xs">
          <span className="text-[9.5px] text-destructive font-medium block truncate">إجمالي العجز</span>
          <span className="text-xs sm:text-sm font-black text-destructive font-mono tabular-nums block mt-0.5">
            {formatCurrency(stats.totalShortage, '$')}
          </span>
        </div>
      </div>

      {/* Recent Shifts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            آخر الورديات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shifts.filter(s => s.status === 'closed').slice(0, 5).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد ورديات مغلقة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shifts.filter(s => s.status === 'closed').slice(0, 5).map(shift => (
                <div key={shift.id} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{shift.userName}</span>
                      <Badge variant={shift.discrepancy === 0 ? 'default' : shift.discrepancy! > 0 ? 'secondary' : 'destructive'}>
                        {shift.discrepancy === 0 ? 'متطابق' : shift.discrepancy! > 0 ? 'فائض' : 'عجز'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(shift.openedAt)}
                      {' • '}
                      {formatTime(shift.openedAt)}
                      {' - '}
                      {shift.closedAt && formatTime(shift.closedAt)}
                    </p>
                  </div>

                  <div className="text-left">
                    <p className="text-sm text-muted-foreground">المبيعات</p>
                    <p className="font-bold text-green-600">{formatCurrency(shift.salesTotal, '$')}</p>
                  </div>

                  <div className="text-left mr-4">
                    <p className="text-sm text-muted-foreground">الفارق</p>
                    <p className={cn(
                      "font-bold",
                      shift.discrepancy === 0 ? "text-foreground" : shift.discrepancy! > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {shift.discrepancy === 0 ? '0' : (shift.discrepancy! > 0 ? '+' : '') + formatCurrency(shift.discrepancy!, '$')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open Shift Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              فتح وردية جديدة
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الرصيد الافتتاحي</Label>
              <Input
                type="number"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="أدخل المبلغ الموجود في الصندوق"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                أدخل المبلغ النقدي الموجود فعلياً في الصندوق عند بدء الوردية
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpenDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleOpenShift}>
              فتح الوردية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Square className="w-5 h-5 text-destructive" />
              إغلاق الوردية
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Expected vs Actual */}
            <div className="bg-muted rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground">الرصيد المتوقع:</span>
                <span className="font-bold text-primary">{formatCurrency(expectedClosing, '$')}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                = الافتتاح + المبيعات + الإيداعات - المصاريف - السحوبات
              </p>
            </div>

            <div className="space-y-2">
              <Label>الرصيد الفعلي</Label>
              <Input
                type="number"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                placeholder="أدخل المبلغ الفعلي في الصندوق"
                min="0"
                step="0.01"
              />
            </div>

            {closingAmount && (
              <div className={cn(
                "rounded-xl p-4 border-2",
                parseFloat(closingAmount) === expectedClosing
                  ? "bg-green-500/10 border-green-500/30"
                  : parseFloat(closingAmount) > expectedClosing
                    ? "bg-blue-500/10 border-blue-500/30"
                    : "bg-red-500/10 border-red-500/30"
              )}>
                <div className="flex items-center gap-2">
                  {parseFloat(closingAmount) === expectedClosing ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                  )}
                  <span className="font-medium">
                    {parseFloat(closingAmount) === expectedClosing
                      ? 'الصندوق متطابق ✓'
                      : parseFloat(closingAmount) > expectedClosing
                        ? `فائض: ${formatCurrency(parseFloat(closingAmount) - expectedClosing, '$')}`
                        : `عجز: ${formatCurrency(expectedClosing - parseFloat(closingAmount), '$')}`
                    }
                  </span>
                </div>

                {/* أزرار التعديل السريع */}
                {parseFloat(closingAmount) !== expectedClosing && activeShift && (
                  <div className="mt-3 pt-3 border-t border-border">
                    {parseFloat(closingAmount) < expectedClosing ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => {
                          const diff = expectedClosing - parseFloat(closingAmount);
                          const success = addShiftAdjustment('expense_added', diff, 'عجز في الصندوق');
                          if (success) {
                            toast.success(`تم تسجيل ${formatCurrency(diff, '$')} كمصروف`);
                            loadData();
                          }
                        }}
                      >
                        <ArrowDownRight className="w-4 h-4" />
                        تسجيل {formatCurrency(expectedClosing - parseFloat(closingAmount), '$')} كمصروف
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => {
                          const diff = parseFloat(closingAmount) - expectedClosing;
                          const success = addShiftAdjustment('income_added', diff, 'فائض في الصندوق');
                          if (success) {
                            toast.success(`تم تسجيل ${formatCurrency(diff, '$')} كإيراد إضافي`);
                            loadData();
                          }
                        }}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        تسجيل {formatCurrency(parseFloat(closingAmount) - expectedClosing, '$')} كإيراد
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      سيتم تعديل المجاميع لمطابقة الرصيد الفعلي
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="أي ملاحظات حول الفارق أو الوردية..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleCloseShift}>
              إغلاق الوردية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              سجل الورديات
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {shifts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد ورديات</p>
              </div>
            ) : (
              shifts.map(shift => (
                <div key={shift.id} className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>
                        {shift.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                      </Badge>
                      {shift.status === 'closed' && (
                        <Badge variant={shift.discrepancy === 0 ? 'outline' : shift.discrepancy! > 0 ? 'secondary' : 'destructive'}>
                          {shift.discrepancy === 0 ? 'متطابق' : shift.discrepancy! > 0 ? 'فائض' : 'عجز'}
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">{shift.userName}</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">الافتتاح:</span>
                      <span className="font-medium mr-1">{formatCurrency(shift.openingCash, '$')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">المبيعات:</span>
                      <span className="font-medium text-green-600 mr-1">+{formatCurrency(shift.salesTotal, '$')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">المصاريف:</span>
                      <span className="font-medium text-red-600 mr-1">-{formatCurrency(shift.expensesTotal, '$')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">الإيداعات:</span>
                      <span className="font-medium text-green-600 mr-1">+{formatCurrency(shift.depositsTotal, '$')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">السحوبات:</span>
                      <span className="font-medium text-red-600 mr-1">-{formatCurrency(shift.withdrawalsTotal, '$')}</span>
                    </div>
                    {shift.status === 'closed' && (
                      <>
                        <div>
                          <span className="text-muted-foreground">المتوقع:</span>
                          <span className="font-medium text-primary mr-1">{formatCurrency(shift.expectedCash || 0, '$')}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">الإغلاق:</span>
                          <span className="font-medium mr-1">{formatCurrency(shift.closingCash || 0, '$')}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">الفارق:</span>
                          <span className={cn(
                            "font-medium mr-1",
                            shift.discrepancy === 0 ? "" : shift.discrepancy! > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {shift.discrepancy === 0 ? '0' : (shift.discrepancy! > 0 ? '+' : '') + formatCurrency(shift.discrepancy!, '$')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* التعديلات */}
                  {shift.adjustments && shift.adjustments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">التعديلات:</p>
                      <div className="space-y-1">
                        {shift.adjustments.map(adj => (
                          <div key={adj.id} className={cn(
                            "text-xs px-2 py-1 rounded flex items-center justify-between",
                            adj.type === 'expense_added' ? "bg-red-500/10 text-red-700" : "bg-green-500/10 text-green-700"
                          )}>
                            <span>
                              {adj.type === 'expense_added' ? '📉 مصروف' : '📈 إيراد'}: {adj.reason}
                            </span>
                            <span className="font-medium">{formatCurrency(adj.amount, '$')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatDateTime(shift.openedAt)}
                    {shift.closedAt && ` - ${formatDateTime(shift.closedAt)}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
