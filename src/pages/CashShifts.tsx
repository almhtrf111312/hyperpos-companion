import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import {
  loadShifts,
  getActiveShift,
  openShift as openShiftFn,
  closeShift as closeShiftFn,
  calculateShiftStatus,
  addShiftAdjustment,
  Shift
} from '@/lib/cashbox-store';
import { EVENTS } from '@/lib/events';
import { useActionGuard } from '@/hooks/use-action-guard';
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
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Banknote
} from 'lucide-react';
import { toast } from 'sonner';

export default function CashShifts() {
  const { user, profile } = useAuth();
  const { t, isRTL } = useLanguage();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [openShift, setOpenShift] = useState<Shift | null>(null);
  const [shiftStatus, setShiftStatus] = useState({ cashSales: 0, cashExpenses: 0, expectedCash: 0 });

  // Dialog states
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [openingUSD, setOpeningUSD] = useState('');
  const [openingTRY, setOpeningTRY] = useState('');
  const [openingSYP, setOpeningSYP] = useState('');

  const [closingUSD, setClosingUSD] = useState('');
  const [closingTRY, setClosingTRY] = useState('');
  const [closingSYP, setClosingSYP] = useState('');
  const [createAdjustment, setCreateAdjustment] = useState(true);
  const closeShiftGuard = useActionGuard();

  // Exchange rates from settings
  const exchangeRates = useMemo(() => {
    try {
      const raw = localStorage.getItem('hyperpos_settings_v1');
      if (!raw) return { TRY: 32, SYP: 14500 };
      const parsed = JSON.parse(raw);
      const ex = parsed?.exchangeRates;
      return {
        TRY: Number(ex?.TRY ?? 32) || 32,
        SYP: Number(ex?.SYP ?? 14500) || 14500,
      };
    } catch {
      return { TRY: 32, SYP: 14500 };
    }
  }, []);

  // Multi-currency details of active shift
  const openShiftCurrencies = useMemo(() => {
    if (!openShift) return null;
    const curr = openShift.currencies;
    const usd = curr?.USD || {
      opening: openShift.openingCash,
      sales: openShift.salesTotal,
      expenses: openShift.expensesTotal,
      deposits: openShift.depositsTotal,
      withdrawals: openShift.withdrawalsTotal,
      expected: openShift.openingCash + openShift.salesTotal + openShift.depositsTotal - openShift.expensesTotal - openShift.withdrawalsTotal,
    };
    const tryObj = curr?.TRY || {
      opening: 0,
      sales: 0,
      expenses: 0,
      deposits: 0,
      withdrawals: 0,
      expected: 0,
    };
    const sypObj = curr?.SYP || {
      opening: 0,
      sales: 0,
      expenses: 0,
      deposits: 0,
      withdrawals: 0,
      expected: 0,
    };
    return {
      USD: { ...usd, expected: usd.opening + usd.sales + usd.deposits - usd.expenses - usd.withdrawals },
      TRY: { ...tryObj, expected: tryObj.opening + tryObj.sales + tryObj.deposits - tryObj.expenses - tryObj.withdrawals },
      SYP: { ...sypObj, expected: sypObj.opening + sypObj.sales + sypObj.deposits - sypObj.expenses - sypObj.withdrawals },
    };
  }, [openShift]);

  // Load data
  const loadData = () => {
    const allShifts = loadShifts();
    setShifts(allShifts);

    const currentShift = getActiveShift();
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
    }, 30000);

    return () => clearInterval(interval);
  }, [openShift]);

  // Get user display name
  const userName = profile?.full_name || user?.email?.split('@')[0] || t('products.defaultUser');
  const userId = user?.id || 'unknown';

  // Handle start shift
  const handleStartShift = () => {
    const usd = parseFloat(openingUSD) || 0;
    const tryAmt = parseFloat(openingTRY) || 0;
    const sypAmt = parseFloat(openingSYP) || 0;

    if (usd < 0 || tryAmt < 0 || sypAmt < 0 || (usd === 0 && tryAmt === 0 && sypAmt === 0 && openingUSD === '')) {
      toast.error(t('cashShifts.enterValidAmount'));
      return;
    }

    const totalOpeningUSD = Math.round((usd + (tryAmt / exchangeRates.TRY) + (sypAmt / exchangeRates.SYP)) * 100) / 100;

    openShiftFn(totalOpeningUSD, userId, userName, {
      USD: usd,
      TRY: tryAmt,
      SYP: sypAmt,
    });
    addActivityLog('shift_opened', userId, userName, `${t('cashShifts.startShift')} - $${totalOpeningUSD} (USD: $${usd}, TRY: ₺${tryAmt}, SYP: ل.س${sypAmt})`);
    toast.success(t('cashShifts.shiftOpened'));

    setShowStartDialog(false);
    setOpeningUSD('');
    setOpeningTRY('');
    setOpeningSYP('');
    loadData();
  };

  // Total closing USD from multi-currency inputs
  const totalClosingUSD = useMemo(() => {
    const usd = parseFloat(closingUSD) || 0;
    const tryAmt = parseFloat(closingTRY) || 0;
    const sypAmt = parseFloat(closingSYP) || 0;
    return Math.round((usd + (tryAmt / exchangeRates.TRY) + (sypAmt / exchangeRates.SYP)) * 100) / 100;
  }, [closingUSD, closingTRY, closingSYP, exchangeRates]);

  const hasAnyClosingInput = closingUSD !== '' || closingTRY !== '' || closingSYP !== '';

  // Calculate discrepancy for preview
  const previewDiscrepancy = useMemo(() => {
    if (!hasAnyClosingInput) return 0;
    return Math.round((totalClosingUSD - shiftStatus.expectedCash) * 100) / 100;
  }, [hasAnyClosingInput, totalClosingUSD, shiftStatus.expectedCash]);

  // Handle close shift
  const handleCloseShift = () => closeShiftGuard.run(async () => {
    if (!openShift) return;

    if (!hasAnyClosingInput) {
      toast.error(t('cashShifts.enterValidAmount'));
      return;
    }

    const usd = parseFloat(closingUSD) || 0;
    const tryAmt = parseFloat(closingTRY) || 0;
    const sypAmt = parseFloat(closingSYP) || 0;

    if (usd < 0 || tryAmt < 0 || sypAmt < 0) {
      toast.error(t('cashShifts.enterValidAmount'));
      return;
    }

    const adjustmentNote = createAdjustment ? t('cashShifts.createAdjustment') : undefined;

    // Close dialog immediately for responsive UX
    setShowCloseDialog(false);
    setClosingUSD('');
    setClosingTRY('');
    setClosingSYP('');
    setCreateAdjustment(true);

    try {
      const result = closeShiftFn(totalClosingUSD, adjustmentNote, {
        USD: usd,
        TRY: tryAmt,
        SYP: sypAmt,
      });

      if (result) {
        const { discrepancy } = result;
        const discrepancyText = discrepancy === 0
          ? t('cashShifts.noDiscrepancy')
          : discrepancy > 0
            ? `${t('cashShifts.surplus')} $${discrepancy.toFixed(2)}`
            : `${t('cashShifts.shortage')} $${Math.abs(discrepancy).toFixed(2)}`;

        addActivityLog('shift_closed', userId, userName, `${t('cashShifts.closeShift')} - ${discrepancyText} (USD: $${usd}, TRY: ₺${tryAmt}, SYP: ل.س${sypAmt})`);
        toast.success(t('cashShifts.shiftClosed'), { description: discrepancyText });
      }
    } catch (err) {
      console.error('[handleCloseShift]', err);
      toast.error(t('cashShifts.enterValidAmount'));
    } finally {
      loadData();
    }
  });

  // Recent shifts (last 10)
  const recentShifts = useMemo(() => {
    return shifts.slice(0, 10);
  }, [shifts]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            {t('cashShifts.pageTitle')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('cashShifts.pageSubtitle')}</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('cashShifts.refresh')}
          </Button>

          {openShift ? (
            <Button variant="destructive" onClick={() => setShowCloseDialog(true)}>
              <StopCircle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('cashShifts.closeShift')}
            </Button>
          ) : (
            <Button onClick={() => setShowStartDialog(true)}>
              <PlayCircle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('cashShifts.startShift')}
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
                  {t('cashShifts.currentShift')}
                </CardTitle>
                <CardDescription>
                  {t('cashShifts.startedAt')} {formatDateTime(openShift.openedAt)} • {openShift.userName}
                </CardDescription>
              </div>
              <Badge variant="default" className="bg-green-500">
                {t('cashShifts.active')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background rounded-lg p-4 border">
                <div className="text-sm text-muted-foreground mb-1">{t('cashShifts.openingCash')}</div>
                <div className="text-xl font-bold">{formatCurrency(openShift.openingCash, '$')}</div>
              </div>
              <div className="bg-background rounded-lg p-4 border">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  {t('cashShifts.cashSales')}
                </div>
                <div className="text-xl font-bold text-green-600">{formatCurrency(shiftStatus.cashSales, '$')}</div>
              </div>
              <div className="bg-background rounded-lg p-4 border">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  {t('cashShifts.cashExpenses')}
                </div>
                <div className="text-xl font-bold text-red-600">{formatCurrency(shiftStatus.cashExpenses, '$')}</div>
              </div>
              <div className="bg-background rounded-lg p-4 border border-primary">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  {t('cashShifts.expectedCash')}
                </div>
                <div className="text-xl font-bold text-primary">{formatCurrency(shiftStatus.expectedCash, '$')}</div>
              </div>
            </div>

            {/* Detailed Multi-Currency Breakdown */}
            {openShiftCurrencies && (
              <div className="pt-3 border-t">
                <div className="text-sm font-semibold mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Banknote className="w-4 h-4 text-primary" />
                    تفصيل النقدية بالدرج حسب العملة:
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    (أسعار الصرف: 1$ = {exchangeRates.TRY} TRY | 1$ = {exchangeRates.SYP} SYP)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* USD */}
                  <div className="bg-background rounded-lg p-3 border space-y-2">
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span className="flex items-center gap-1.5 text-blue-600">
                        <DollarSign className="w-4 h-4" /> الدولار الأمريكي (USD)
                      </span>
                      <Badge variant="outline" className="font-mono text-xs">$</Badge>
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground pt-1">
                      <div className="flex justify-between">
                        <span>الافتتاحي:</span>
                        <span className="font-medium text-foreground">${openShiftCurrencies.USD.opening.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المبيعات والمقبوضات:</span>
                        <span className="font-medium text-green-600">+${openShiftCurrencies.USD.sales.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المصروفات:</span>
                        <span className="font-medium text-red-600">-${openShiftCurrencies.USD.expenses.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t font-bold text-foreground text-sm">
                        <span>المتوقع بالدرج:</span>
                        <span className="text-primary font-mono">${openShiftCurrencies.USD.expected.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* TRY */}
                  <div className="bg-background rounded-lg p-3 border space-y-2">
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span className="flex items-center gap-1.5 text-amber-600">
                        <Banknote className="w-4 h-4" /> الليرة التركية (TRY)
                      </span>
                      <Badge variant="outline" className="font-mono text-xs">₺</Badge>
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground pt-1">
                      <div className="flex justify-between">
                        <span>الافتتاحي:</span>
                        <span className="font-medium text-foreground">₺{openShiftCurrencies.TRY.opening.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المبيعات والمقبوضات:</span>
                        <span className="font-medium text-green-600">+₺{openShiftCurrencies.TRY.sales.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المصروفات:</span>
                        <span className="font-medium text-red-600">-₺{openShiftCurrencies.TRY.expenses.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t font-bold text-foreground text-sm">
                        <span>المتوقع بالدرج:</span>
                        <span className="text-amber-600 font-mono">₺{openShiftCurrencies.TRY.expected.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* SYP */}
                  <div className="bg-background rounded-lg p-3 border space-y-2">
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <Banknote className="w-4 h-4" /> الليرة السورية (SYP)
                      </span>
                      <Badge variant="outline" className="font-mono text-xs">ل.س</Badge>
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground pt-1">
                      <div className="flex justify-between">
                        <span>الافتتاحي:</span>
                        <span className="font-medium text-foreground">{openShiftCurrencies.SYP.opening.toLocaleString()} ل.س</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المبيعات والمقبوضات:</span>
                        <span className="font-medium text-green-600">+{openShiftCurrencies.SYP.sales.toLocaleString()} ل.س</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المصروفات:</span>
                        <span className="font-medium text-red-600">-{openShiftCurrencies.SYP.expenses.toLocaleString()} ل.س</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t font-bold text-foreground text-sm">
                        <span>المتوقع بالدرج:</span>
                        <span className="text-emerald-600 font-mono">{openShiftCurrencies.SYP.expected.toLocaleString()} ل.س</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('cashShifts.noOpenShift')}</h3>
            <p className="text-muted-foreground mb-4">{t('cashShifts.startNewShift')}</p>
            <Button onClick={() => setShowStartDialog(true)}>
              <PlayCircle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('cashShifts.startShift')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Shifts */}
      <Card>
        <CardHeader>
          <CardTitle>{t('cashShifts.recentShifts')}</CardTitle>
          <CardDescription>{t('cashShifts.last10Shifts')}</CardDescription>
        </CardHeader>
        <CardContent>
          {recentShifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('cashShifts.noShifts')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('cashShifts.user')}</TableHead>
                    <TableHead>{t('cashShifts.openTime')}</TableHead>
                    <TableHead>{t('cashShifts.closeTime')}</TableHead>
                    <TableHead>{t('cashShifts.opening')}</TableHead>
                    <TableHead>{t('cashShifts.sales')}</TableHead>
                    <TableHead>{t('cashShifts.expected')}</TableHead>
                    <TableHead>{t('cashShifts.actual')}</TableHead>
                    <TableHead>{t('cashShifts.discrepancy')}</TableHead>
                    <TableHead>التعديلات</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentShifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">{shift.userName}</TableCell>
                      <TableCell className="text-sm">{formatDateTime(shift.openedAt)}</TableCell>
                      <TableCell className="text-sm">
                        {shift.closedAt ? formatDateTime(shift.closedAt) : '-'}
                      </TableCell>
                      <TableCell>{formatCurrency(shift.openingCash, '$')}</TableCell>
                      <TableCell className="text-green-600">
                        {formatCurrency(shift.salesTotal, '$')}
                      </TableCell>
                      <TableCell>{formatCurrency(shift.expectedCash || 0, '$')}</TableCell>
                      <TableCell>
                        {shift.closingCash !== undefined ? formatCurrency(shift.closingCash, '$') : '-'}
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
                        {shift.adjustments && shift.adjustments.length > 0 ? (
                          <div className="space-y-1">
                            {shift.adjustments.map(adj => (
                              <Badge key={adj.id} variant={adj.type === 'expense_added' ? 'destructive' : 'secondary'} className="text-xs">
                                {adj.type === 'expense_added' ? 'مصروف' : 'إيراد'} {formatCurrency(adj.amount, '$')}
                              </Badge>
                            ))}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>
                          {shift.status === 'open' ? t('cashShifts.status.open') : t('cashShifts.status.closed')}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              {t('cashShifts.startShiftTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('cashShifts.startShiftDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="text-xs text-muted-foreground">
              أدخل الرصيد الافتتاحي المتوفر في درج الكاشير لكل عملة:
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="openingUSD" className="text-xs font-semibold flex items-center gap-1">
                  <span>الدولار الأمريكي ($ USD)</span>
                </Label>
                <Input
                  id="openingUSD"
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingUSD}
                  onChange={(e) => setOpeningUSD(e.target.value)}
                  placeholder="0.00"
                  className="font-mono text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="openingTRY" className="text-xs font-semibold">
                    الليرة التركية (₺ TRY)
                  </Label>
                  <Input
                    id="openingTRY"
                    type="number"
                    min="0"
                    step="1"
                    value={openingTRY}
                    onChange={(e) => setOpeningTRY(e.target.value)}
                    placeholder="0"
                    className="font-mono text-base"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="openingSYP" className="text-xs font-semibold">
                    الليرة السورية (ل.س SYP)
                  </Label>
                  <Input
                    id="openingSYP"
                    type="number"
                    min="0"
                    step="500"
                    value={openingSYP}
                    onChange={(e) => setOpeningSYP(e.target.value)}
                    placeholder="0"
                    className="font-mono text-base"
                  />
                </div>
              </div>
            </div>

            {/* Total USD preview */}
            <div className="bg-primary/10 rounded-lg p-3 text-sm flex items-center justify-between border border-primary/20">
              <span className="font-semibold text-primary">إجمالي الافتتاحي بالدولار:</span>
              <span className="font-bold text-lg font-mono text-primary">
                ${(
                  (parseFloat(openingUSD) || 0) +
                  ((parseFloat(openingTRY) || 0) / exchangeRates.TRY) +
                  ((parseFloat(openingSYP) || 0) / exchangeRates.SYP)
                ).toFixed(2)}
              </span>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex justify-between items-center">
              <span><strong>{t('cashShifts.employee')}:</strong> {userName}</span>
              <span className="text-[11px] opacity-75">1$ = {exchangeRates.TRY} ₺ | {exchangeRates.SYP} ل.س</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleStartShift}>
              {t('cashShifts.startShift')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StopCircle className="h-5 w-5 text-destructive" />
              {t('cashShifts.closeShiftTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('cashShifts.closeShiftDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 max-h-[70vh] overflow-y-auto pr-1">
            {/* Quick Fill Button */}
            <div className="flex items-center justify-between bg-muted/40 p-2.5 rounded-lg border">
              <span className="text-xs text-muted-foreground">لإدخال المبالغ الفعلية المطابقة للحساب فوراً:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  if (openShiftCurrencies) {
                    setClosingUSD(openShiftCurrencies.USD.expected.toString());
                    setClosingTRY(openShiftCurrencies.TRY.expected.toString());
                    setClosingSYP(openShiftCurrencies.SYP.expected.toString());
                  } else {
                    setClosingUSD(shiftStatus.expectedCash.toString());
                  }
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 ml-1 text-green-600" />
                مطابقة مع المتوقع
              </Button>
            </div>

            {/* Inputs per currency */}
            <div className="space-y-3">
              {/* USD */}
              <div className="p-3 rounded-lg border bg-background space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <Label htmlFor="closingUSD" className="font-semibold flex items-center gap-1 text-blue-600">
                    <DollarSign className="w-3.5 h-3.5" /> الدولار الأمريكي ($ USD)
                  </Label>
                  <span className="text-muted-foreground">
                    المتوقع: <strong className="text-foreground font-mono">${openShiftCurrencies?.USD.expected.toFixed(2) ?? shiftStatus.expectedCash.toFixed(2)}</strong>
                  </span>
                </div>
                <Input
                  id="closingUSD"
                  type="number"
                  min="0"
                  step="0.01"
                  value={closingUSD}
                  onChange={(e) => setClosingUSD(e.target.value)}
                  placeholder="0.00"
                  className="font-mono text-base"
                />
              </div>

              {/* TRY */}
              <div className="p-3 rounded-lg border bg-background space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <Label htmlFor="closingTRY" className="font-semibold flex items-center gap-1 text-amber-600">
                    <Banknote className="w-3.5 h-3.5" /> الليرة التركية (₺ TRY)
                  </Label>
                  <span className="text-muted-foreground">
                    المتوقع: <strong className="text-foreground font-mono">₺{openShiftCurrencies?.TRY.expected.toLocaleString() ?? '0'}</strong>
                  </span>
                </div>
                <Input
                  id="closingTRY"
                  type="number"
                  min="0"
                  step="1"
                  value={closingTRY}
                  onChange={(e) => setClosingTRY(e.target.value)}
                  placeholder="0"
                  className="font-mono text-base"
                />
              </div>

              {/* SYP */}
              <div className="p-3 rounded-lg border bg-background space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <Label htmlFor="closingSYP" className="font-semibold flex items-center gap-1 text-emerald-600">
                    <Banknote className="w-3.5 h-3.5" /> الليرة السورية (ل.س SYP)
                  </Label>
                  <span className="text-muted-foreground">
                    المتوقع: <strong className="text-foreground font-mono">{openShiftCurrencies?.SYP.expected.toLocaleString() ?? '0'} ل.س</strong>
                  </span>
                </div>
                <Input
                  id="closingSYP"
                  type="number"
                  min="0"
                  step="500"
                  value={closingSYP}
                  onChange={(e) => setClosingSYP(e.target.value)}
                  placeholder="0"
                  className="font-mono text-base"
                />
              </div>
            </div>

            {/* Summary & Discrepancy Preview */}
            {hasAnyClosingInput && (
              <div className="space-y-2">
                <div className="bg-muted/60 rounded-lg p-3 text-xs space-y-1 border">
                  <div className="flex justify-between text-muted-foreground">
                    <span>المتوقع الإجمالي (معادلاً بالدولار):</span>
                    <span className="font-mono font-semibold text-foreground">${shiftStatus.expectedCash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>الفعلي المعدود (معادلاً بالدولار):</span>
                    <span className="font-mono font-semibold text-foreground">${totalClosingUSD.toFixed(2)}</span>
                  </div>
                </div>

                <div className={`rounded-lg p-4 border-2 ${previewDiscrepancy === 0
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
                    <span className="font-semibold text-sm">
                      {previewDiscrepancy === 0
                        ? t('cashShifts.noDiscrepancy')
                        : previewDiscrepancy > 0
                          ? t('cashShifts.surplus')
                          : t('cashShifts.shortage')}
                    </span>
                  </div>
                  <div className={`text-2xl font-bold font-mono ${previewDiscrepancy === 0
                      ? 'text-green-600'
                      : previewDiscrepancy > 0
                        ? 'text-blue-600'
                        : 'text-red-600'
                    }`}>
                    {previewDiscrepancy > 0 ? '+' : ''}{formatCurrency(previewDiscrepancy, '$')}
                  </div>
                </div>
              </div>
            )}

            {/* Adjustment buttons */}
            {hasAnyClosingInput && previewDiscrepancy !== 0 && openShift && (
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-3">
                {previewDiscrepancy < 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => {
                      const diff = Math.abs(previewDiscrepancy);
                      const success = addShiftAdjustment('expense_added', diff, 'عجز في الصندوق');
                      if (success) {
                        toast.success(`تم تسجيل ${formatCurrency(diff, '$')} كمصروف`);
                        loadData();
                      }
                    }}
                  >
                    <ArrowDownRight className="w-4 h-4 ml-1" />
                    تسجيل {formatCurrency(Math.abs(previewDiscrepancy), '$')} كمصروف
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-green-600 border-green-300 hover:bg-green-50"
                    onClick={() => {
                      const diff = previewDiscrepancy;
                      const success = addShiftAdjustment('income_added', diff, 'فائض في الصندوق');
                      if (success) {
                        toast.success(`تم تسجيل ${formatCurrency(diff, '$')} كإيراد إضافي`);
                        loadData();
                      }
                    }}
                  >
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                    تسجيل {formatCurrency(previewDiscrepancy, '$')} كإيراد
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  سيتم تعديل المجاميع لمطابقة الرصيد الفعلي
                </p>
              </div>
            )}

            {/* Adjustment option */}
            {hasAnyClosingInput && previewDiscrepancy !== 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Checkbox
                  id="createAdjustment"
                  checked={createAdjustment}
                  onCheckedChange={(checked) => setCreateAdjustment(checked as boolean)}
                />
                <Label htmlFor="createAdjustment" className="cursor-pointer text-sm">
                  {t('cashShifts.createAdjustment')}
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleCloseShift} disabled={closeShiftGuard.isRunning}>
              {closeShiftGuard.isRunning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('cashShifts.closeShift')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
