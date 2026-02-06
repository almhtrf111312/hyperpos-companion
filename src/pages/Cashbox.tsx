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
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-7 h-7 text-primary" />
            الصندوق
          </h1>
          <p className="text-muted-foreground mt-1">إدارة الورديات والمصالحة اليومية</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistoryDialog(true)}>
            <History className="w-4 h-4 ml-2" />
            السجل
          </Button>
          {activeShift ? (
            <Button variant="destructive" onClick={() => setShowCloseDialog(true)}>
              <Square className="w-4 h-4 ml-2" />
              إغلاق الوردية
            </Button>
          ) : (
            <Button onClick={() => setShowOpenDialog(true)}>
              <Play className="w-4 h-4 ml-2" />
              فتح وردية
            </Button>
          )}
        </div>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className={cn(
          "border-2",
          activeShift ? "border-green-500/50 bg-green-500/5" : "border-orange-500/50 bg-orange-500/5"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">حالة الوردية</p>
                <p className="text-xl font-bold mt-1">
                  {activeShift ? 'مفتوحة' : 'مغلقة'}
                </p>
              </div>
              {activeShift ? (
                <CheckCircle className="w-10 h-10 text-green-500" />
              ) : (
                <Clock className="w-10 h-10 text-orange-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">الرصيد الحالي</p>
                <p className="text-xl font-bold mt-1 text-primary">
                  {formatCurrency(cashboxState.currentBalance, '$')}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الفائض</p>
                <p className="text-xl font-bold mt-1 text-green-600">
                  {formatCurrency(stats.totalSurplus, '$')}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي العجز</p>
                <p className="text-xl font-bold mt-1 text-red-600">
                  {formatCurrency(stats.totalShortage, '$')}
                </p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Shift Details */}
      {activeShift && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              الوردية الحالية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-muted rounded-xl p-4">
                <p className="text-xs text-muted-foreground">رصيد الافتتاح</p>
                <p className="text-lg font-bold text-foreground mt-1">
                  {formatCurrency(activeShift.openingCash, '$')}
                </p>
              </div>

              <div className="bg-muted rounded-xl p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                  المبيعات
                </p>
                <p className="text-lg font-bold text-green-600 mt-1">
                  +{formatCurrency(activeShift.salesTotal, '$')}
                </p>
              </div>

              <div className="bg-muted rounded-xl p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                  الإيداعات
                </p>
                <p className="text-lg font-bold text-green-600 mt-1">
                  +{formatCurrency(activeShift.depositsTotal, '$')}
                </p>
              </div>

              <div className="bg-muted rounded-xl p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowDownRight className="w-3 h-3 text-red-500" />
                  المصاريف
                </p>
                <p className="text-lg font-bold text-red-600 mt-1">
                  -{formatCurrency(activeShift.expensesTotal, '$')}
                </p>
              </div>

              <div className="bg-muted rounded-xl p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowDownRight className="w-3 h-3 text-red-500" />
                  السحوبات
                </p>
                <p className="text-lg font-bold text-red-600 mt-1">
                  -{formatCurrency(activeShift.withdrawalsTotal, '$')}
                </p>
              </div>

              <div className="bg-primary/10 rounded-xl p-4 border-2 border-primary/30">
                <p className="text-xs text-primary flex items-center gap-1">
                  <Calculator className="w-3 h-3" />
                  الرصيد المتوقع
                </p>
                <p className="text-lg font-bold text-primary mt-1">
                  {formatCurrency(expectedClosing, '$')}
                </p>
              </div>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              <span>بدأت في: </span>
              <span className="font-medium">
                {formatDateTime(activeShift.openedAt)}
              </span>
              <span className="mx-2">•</span>
              <span>المسؤول: </span>
              <span className="font-medium">{activeShift.userName}</span>
            </div>
          </CardContent>
        </Card>
      )}

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

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">الافتتاح:</span>
                      <span className="font-medium mr-1">{formatCurrency(shift.openingCash, '$')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">المبيعات:</span>
                      <span className="font-medium text-green-600 mr-1">+{formatCurrency(shift.salesTotal, '$')}</span>
                    </div>
                    {shift.status === 'closed' && (
                      <>
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
                            {formatCurrency(shift.discrepancy || 0, '$')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

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
