import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { 
  loadShifts, 
  getOpenShift, 
  startShift, 
  closeShift, 
  calculateShiftStatus,
  CashShift 
} from '@/lib/cash-shift-store';
import { EVENTS } from '@/lib/events';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { addActivityLog } from '@/lib/activity-log';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  PlayCircle, 
  StopCircle, 
  RefreshCw, 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

export default function CashShifts() {
  const { user, profile } = useAuth();
  const { t, isRTL } = useLanguage();
  
  const [shifts, setShifts] = useState<CashShift[]>([]);
  const [openShift, setOpenShift] = useState<CashShift | null>(null);
  const [shiftStatus, setShiftStatus] = useState({ cashSales: 0, cashExpenses: 0, expectedCash: 0 });
  
  // Dialog states
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [createAdjustment, setCreateAdjustment] = useState(true);
  
  // Load data
  const loadData = () => {
    const allShifts = loadShifts();
    setShifts(allShifts);
    
    const currentShift = getOpenShift();
    setOpenShift(currentShift);
    
    if (currentShift) {
      const status = calculateShiftStatus(currentShift);
      setShiftStatus(status);
    }
  };
  
  useEffect(() => {
    loadData();
    
    const handleUpdate = () => loadData();
    window.addEventListener(EVENTS.CASH_SHIFTS_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
    window.addEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
    
    return () => {
      window.removeEventListener(EVENTS.CASH_SHIFTS_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
      window.removeEventListener(EVENTS.EXPENSES_UPDATED, handleUpdate);
    };
  }, []);
  
  // Refresh status periodically
  useEffect(() => {
    if (!openShift) return;
    
    const interval = setInterval(() => {
      const status = calculateShiftStatus(openShift);
      setShiftStatus(status);
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [openShift]);
  
  // Get user display name
  const userName = profile?.full_name || user?.email?.split('@')[0] || 'مستخدم';
  const userId = user?.id || 'unknown';
  
  // Handle start shift
  const handleStartShift = () => {
    const amount = parseFloat(openingCash);
    if (isNaN(amount) || amount < 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }
    
    const newShift = startShift(userId, userName, amount);
    addActivityLog('shift_opened', userId, userName, `فتح وردية جديدة برصيد ${amount.toFixed(2)}`);
    toast.success('تم فتح الوردية بنجاح');
    
    setShowStartDialog(false);
    setOpeningCash('');
    loadData();
  };
  
  // Handle close shift
  const handleCloseShift = () => {
    if (!openShift) return;
    
    const amount = parseFloat(closingCash);
    if (isNaN(amount) || amount < 0) {
      toast.error('يرجى إدخال المبلغ الفعلي في الصندوق');
      return;
    }
    
    const closedShift = closeShift(openShift.id, amount, createAdjustment);
    
    if (closedShift) {
      const discrepancy = closedShift.discrepancy || 0;
      const discrepancyText = discrepancy === 0 
        ? 'بدون فرق' 
        : discrepancy > 0 
          ? `فائض ${discrepancy.toFixed(2)}` 
          : `عجز ${Math.abs(discrepancy).toFixed(2)}`;
      
      addActivityLog('shift_closed', userId, userName, `إغلاق الوردية - ${discrepancyText}`);
      toast.success('تم إغلاق الوردية بنجاح');
    }
    
    setShowCloseDialog(false);
    setClosingCash('');
    setCreateAdjustment(true);
    loadData();
  };
  
  // Calculate discrepancy for preview
  const previewDiscrepancy = useMemo(() => {
    const amount = parseFloat(closingCash);
    if (isNaN(amount)) return 0;
    return amount - shiftStatus.expectedCash;
  }, [closingCash, shiftStatus.expectedCash]);
  
  // Recent shifts (last 10)
  const recentShifts = useMemo(() => {
    return shifts.slice(0, 10);
  }, [shifts]);
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pr-14 md:pr-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            الصندوق والورديات
          </h1>
          <p className="text-muted-foreground mt-1">إدارة الورديات النقدية ومراقبة الصندوق</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 ml-2" />
            تحديث
          </Button>
          
          {openShift ? (
            <Button variant="destructive" onClick={() => setShowCloseDialog(true)}>
              <StopCircle className="h-4 w-4 ml-2" />
              إغلاق الوردية
            </Button>
          ) : (
            <Button onClick={() => setShowStartDialog(true)}>
              <PlayCircle className="h-4 w-4 ml-2" />
              فتح وردية
            </Button>
          )}
        </div>
      </div>
      
      {/* Current Shift Status */}
      {openShift ? (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary animate-pulse" />
                  وردية مفتوحة
                </CardTitle>
                <CardDescription>
                  بدأت في {formatDateTime(openShift.openingTime)} • {openShift.userName}
                </CardDescription>
              </div>
              <Badge variant="default" className="bg-green-500">
                نشطة
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background rounded-lg p-4 border">
                <div className="text-sm text-muted-foreground mb-1">رصيد الافتتاح</div>
                <div className="text-xl font-bold">{formatCurrency(openShift.openingCash, '$')}</div>
              </div>
              <div className="bg-background rounded-lg p-4 border">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  المبيعات النقدية
                </div>
                <div className="text-xl font-bold text-green-600">{formatCurrency(shiftStatus.cashSales, '$')}</div>
              </div>
              <div className="bg-background rounded-lg p-4 border">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  المصروفات
                </div>
                <div className="text-xl font-bold text-red-600">{formatCurrency(shiftStatus.cashExpenses, '$')}</div>
              </div>
              <div className="bg-background rounded-lg p-4 border border-primary">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  الرصيد المتوقع
                </div>
                <div className="text-xl font-bold text-primary">{formatCurrency(shiftStatus.expectedCash, '$')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد وردية مفتوحة</h3>
            <p className="text-muted-foreground mb-4">ابدأ وردية جديدة لتتبع المعاملات النقدية</p>
            <Button onClick={() => setShowStartDialog(true)}>
              <PlayCircle className="h-4 w-4 ml-2" />
              فتح وردية جديدة
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Recent Shifts */}
      <Card>
        <CardHeader>
          <CardTitle>الورديات السابقة</CardTitle>
          <CardDescription>آخر 10 ورديات</CardDescription>
        </CardHeader>
        <CardContent>
          {recentShifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد ورديات سابقة
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>وقت الفتح</TableHead>
                    <TableHead>وقت الإغلاق</TableHead>
                    <TableHead>الافتتاح</TableHead>
                    <TableHead>المبيعات</TableHead>
                    <TableHead>المتوقع</TableHead>
                    <TableHead>الفعلي</TableHead>
                    <TableHead>الفرق</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentShifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">{shift.userName}</TableCell>
                      <TableCell className="text-sm">{formatDateTime(shift.openingTime)}</TableCell>
                      <TableCell className="text-sm">
                        {shift.closingTime ? formatDateTime(shift.closingTime) : '-'}
                      </TableCell>
                      <TableCell>{formatCurrency(shift.openingCash, '$')}</TableCell>
                      <TableCell className="text-green-600">
                        {formatCurrency(shift.cashSales, '$')}
                      </TableCell>
                      <TableCell>{formatCurrency(shift.expectedCash, '$')}</TableCell>
                      <TableCell>
                        {shift.actualCash !== undefined ? formatCurrency(shift.actualCash, '$') : '-'}
                      </TableCell>
                      <TableCell>
                        {shift.discrepancy !== undefined ? (
                          <span className={
                            shift.discrepancy === 0 
                              ? 'text-muted-foreground' 
                              : shift.discrepancy > 0 
                                ? 'text-green-600' 
                                : 'text-red-600'
                          }>
                            {shift.discrepancy > 0 ? '+' : ''}{formatCurrency(shift.discrepancy, '$')}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>
                          {shift.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Start Shift Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              فتح وردية جديدة
            </DialogTitle>
            <DialogDescription>
              أدخل المبلغ الموجود في الصندوق عند بداية الوردية
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="openingCash">رصيد الافتتاح ($)</Label>
              <Input
                id="openingCash"
                type="number"
                min="0"
                step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
                className="text-lg"
              />
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <strong>الموظف:</strong> {userName}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleStartShift}>
              فتح الوردية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Close Shift Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StopCircle className="h-5 w-5 text-destructive" />
              إغلاق الوردية
            </DialogTitle>
            <DialogDescription>
              أدخل المبلغ الفعلي الموجود في الصندوق الآن
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-muted-foreground">رصيد الافتتاح</div>
                <div className="font-bold">{formatCurrency(openShift?.openingCash || 0, '$')}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3">
                <div className="text-muted-foreground">المبيعات</div>
                <div className="font-bold text-green-600">{formatCurrency(shiftStatus.cashSales, '$')}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3">
                <div className="text-muted-foreground">المصروفات</div>
                <div className="font-bold text-red-600">{formatCurrency(shiftStatus.cashExpenses, '$')}</div>
              </div>
              <div className="bg-primary/10 rounded-lg p-3">
                <div className="text-muted-foreground">المتوقع</div>
                <div className="font-bold text-primary">{formatCurrency(shiftStatus.expectedCash, '$')}</div>
              </div>
            </div>
            
            {/* Input */}
            <div className="space-y-2">
              <Label htmlFor="closingCash">المبلغ الفعلي في الصندوق ($)</Label>
              <Input
                id="closingCash"
                type="number"
                min="0"
                step="0.01"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0.00"
                className="text-lg"
              />
            </div>
            
            {/* Discrepancy Preview */}
            {closingCash && (
              <div className={`rounded-lg p-4 border-2 ${
                previewDiscrepancy === 0 
                  ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                  : previewDiscrepancy > 0 
                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' 
                    : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {previewDiscrepancy === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : previewDiscrepancy > 0 ? (
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-semibold">
                    {previewDiscrepancy === 0 
                      ? 'الصندوق متطابق' 
                      : previewDiscrepancy > 0 
                        ? 'فائض في الصندوق' 
                        : 'عجز في الصندوق'}
                  </span>
                </div>
                <div className={`text-2xl font-bold ${
                  previewDiscrepancy === 0 
                    ? 'text-green-600' 
                    : previewDiscrepancy > 0 
                      ? 'text-blue-600' 
                      : 'text-red-600'
                }`}>
                  {previewDiscrepancy > 0 ? '+' : ''}{formatCurrency(previewDiscrepancy, '$')}
                </div>
              </div>
            )}
            
            {/* Adjustment option */}
            {closingCash && previewDiscrepancy !== 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Checkbox
                  id="createAdjustment"
                  checked={createAdjustment}
                  onCheckedChange={(checked) => setCreateAdjustment(checked as boolean)}
                />
                <Label htmlFor="createAdjustment" className="cursor-pointer text-sm">
                  تسجيل الفرق كمصروف تسوية تلقائي
                </Label>
              </div>
            )}
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
    </div>
  );
}
