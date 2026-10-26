import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { AlertTriangle, Bluetooth, CheckCircle2, Loader2, Printer, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FlowPosPrinter, type PrinterDevice } from '@/lib/printer/flowpos-printer';
import {
  checkReadiness,
  describePrinterError,
  pairAndConnect,
  printTestPage,
  saveSelectedPrinter,
  type ReadinessReason,
} from '@/lib/printer/bluetooth-printer';
import type { PaperWidth } from '@/lib/printer/receipt-escpos';

/** مفتاح بيخلّي النافذة ترجع لنفس الخطوة إذا Android أعاد إنشاء الشاشة بعد صفحة تشغيل البلوتوث */
export const PRINTER_FLOW_FLAG = 'flowpos_printer_flow';

type Step = 'checking' | 'blocked' | 'list' | 'pair' | 'working' | 'done';
type Readiness = Awaited<ReturnType<typeof checkReadiness>>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRTL: boolean;
  paperWidth: PaperWidth;
  onSaved?: () => void;
}

const L = (isRTL: boolean, ar: string, en: string) => (isRTL ? ar : en);

const byName = (a: PrinterDevice, b: PrinterDevice) =>
  (a.name || a.address).localeCompare(b.name || b.address);

export function BluetoothPrinterDialog({ open, onOpenChange, isRTL, paperWidth, onSaved }: Props) {
  const [step, setStep] = useState<Step>('checking');
  const [blockReason, setBlockReason] = useState<ReadinessReason | null>(null);
  const [devices, setDevices] = useState<Record<string, PrinterDevice>>({});
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<PrinterDevice | null>(null);
  const [pin, setPin] = useState('0000');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const scanTokenRef = useRef(0);   // أي نتيجة من بحث قديم بتنرفض
  const stepRef = useRef<Step>('checking');
  const busyRef = useRef(false);
  const paperRef = useRef<PaperWidth>(paperWidth);
  stepRef.current = step;

  // ---------- قائمة الأجهزة: مصدر واحد، دمج بالعنوان، ما في استبدال ----------
  const upsert = useCallback((d: PrinterDevice) => {
    if (!d?.address) return;
    setDevices((prev) => {
      const old = prev[d.address];
      return {
        ...prev,
        [d.address]: {
          address: d.address,
          name: d.name || old?.name || '',
          paired: Boolean(d.paired || old?.paired),
        },
      };
    });
  }, []);

  const stopScan = useCallback(async () => {
    scanTokenRef.current += 1;
    setScanning(false);
    try {
      await FlowPosPrinter.stopDiscovery();
    } catch {
      /* ما في بحث شغّال */
    }
  }, []);

  const startScan = useCallback(async () => {
    const token = ++scanTokenRef.current;
    setScanning(true);
    // نمسح القريبة بس، المحفوظة بتضل
    setDevices((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([, d]) => d.paired))
    );

    let handle: PluginListenerHandle | null = null;
    try {
      handle = await FlowPosPrinter.addListener('deviceFound', (d) => {
        if (token === scanTokenRef.current) upsert(d);
      });

      const saved = await FlowPosPrinter.listPaired();
      if (token !== scanTokenRef.current) return;
      saved.devices.forEach((d) => upsert({ ...d, paired: true }));

      const res = await FlowPosPrinter.discover({ durationMs: 12000 });
      if (token !== scanTokenRef.current) return;
      res.devices.forEach(upsert);
    } catch (e) {
      if (token === scanTokenRef.current) setError(describePrinterError(e));
    } finally {
      await handle?.remove();
      if (token === scanTokenRef.current) setScanning(false);
    }
  }, [upsert]);

  const restartScan = useCallback(async () => {
    await stopScan();
    await startScan();
  }, [stopScan, startScan]);

  // ---------- التحقق من الجاهزية ----------
  const refreshReadiness = useCallback(async () => {
    setError(null);
    setStep('checking');
    let r: Readiness;
    try {
      r = await checkReadiness();
    } catch (e) {
      setError(describePrinterError(e));
      setBlockReason(null);
      setStep('blocked');
      return;
    }
    if (!r.ok) {
      setBlockReason(r.reason);
      setStep('blocked');
      return;
    }
    setBlockReason(null);
    setStep('list');
    void startScan();
  }, [startScan]);

  // ---------- فتح/إغلاق النافذة ----------
  useEffect(() => {
    if (!open) {
      void stopScan();
      return;
    }
    setSelected(null);
    setPin('0000');
    setError(null);
    paperRef.current = paperWidth;
    void refreshReadiness();
    return () => {
      void stopScan();
    };
    // نبي الفتح بس يبدأ الفحص، مش كل تغيير بالـ props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ---------- لما يرجع التطبيق من شاشة النظام (مثلاً بعد تشغيل البلوتوث) ----------
  useEffect(() => {
    if (!open) return;
    const sub = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && stepRef.current === 'blocked') {
        void refreshReadiness();
      }
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, [open, refreshReadiness]);

  // ---------- الإجراءات ----------
  const enableBluetooth = async () => {
    setError(null);
    sessionStorage.setItem(PRINTER_FLOW_FLAG, 'await_bt');
    try {
      const res = await FlowPosPrinter.enableBluetooth();
      sessionStorage.removeItem(PRINTER_FLOW_FLAG);
      if (res.enabled) {
        await refreshReadiness();
      } else {
        setError(describePrinterError(new Error('BT_OFF')));
      }
    } catch (e) {
      sessionStorage.removeItem(PRINTER_FLOW_FLAG);
      setError(describePrinterError(e));
    }
  };

  const requestPermissions = async () => {
    setError(null);
    try {
      await FlowPosPrinter.requestPermissions();
      await refreshReadiness();
    } catch (e) {
      setError(describePrinterError(e));
    }
  };

  const pairAndSave = async (device: PrinterDevice, pinValue?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setStep('working');
    try {
      await stopScan(); // لا بحث واقتران بنفس الوقت
      setProgress(L(isRTL, 'جاري الاقتران…', 'Pairing…'));
      await pairAndConnect(device.address, pinValue);

      setProgress(L(isRTL, 'جاري الطباعة التجريبية…', 'Printing test page…'));
      await printTestPage(device.address, paperRef.current);

      saveSelectedPrinter({ ...device, paired: true }, paperRef.current);
      setSelected({ ...device, paired: true });
      setStep('done');
      onSaved?.();
    } catch (e) {
      setError(describePrinterError(e));
      // الطابعة المحفوظة ترجع للقائمة، والجديدة تبقى بخطوة الرمز
      setStep(device.paired ? 'list' : 'pair');
    } finally {
      busyRef.current = false;
    }
  };

  const selectDevice = (d: PrinterDevice) => {
    setSelected(d);
    setError(null);
    if (d.paired) {
      void pairAndSave(d, undefined); // محفوظة: ما بنطلب رمز
    } else {
      setStep('pair');
    }
  };

  // ---------- المحتوى ----------
  const list = useMemo(() => Object.values(devices), [devices]);
  const savedList = useMemo(() => list.filter((d) => d.paired).sort(byName), [list]);
  const nearbyList = useMemo(() => list.filter((d) => !d.paired).sort(byName), [list]);

  const blockedText = (reason: ReadinessReason | null): string => {
    switch (reason) {
      case 'NOT_ANDROID':
        return L(isRTL, 'هذي الميزة متاحة على تطبيق الأندرويد فقط', 'This feature is available on the Android app only');
      case 'NO_BLUETOOTH':
        return L(isRTL, 'هذا الجهاز ما بيدعم البلوتوث', 'This device does not support Bluetooth');
      case 'BT_OFF':
        return L(isRTL, 'البلوتوث مطفي. شغّله حتى نقدر نلاقي الطابعات', 'Bluetooth is off. Turn it on to find printers');
      case 'NO_PERMISSION':
        return L(
          isRTL,
          'نحتاج صلاحية البلوتوث حتى نبحث عن الطابعة ونتصل فيها. ما بنستخدم موقعك. إذا ما ظهرت نافذة الصلاحية، فعّلها يدوياً من إعدادات التطبيق في الهاتف',
          'We need Bluetooth permission to find and connect to the printer. We do not use your location. If the permission prompt does not appear, enable it manually in the phone app settings'
        );
      case 'NO_LOCATION':
        return L(
          isRTL,
          'على هالإصدار من الأندرويد لازم خدمة الموقع تكون شغّالة حتى يظهر البلوتوث الأجهزة القريبة',
          'On this Android version, location services must be on to discover nearby devices'
        );
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={isRTL ? 'rtl' : 'ltr'}
        className="w-[min(calc(100vw-1.5rem),32rem)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bluetooth className="w-4 h-4" />
            {L(isRTL, 'إضافة طابعة بلوتوث', 'Add Bluetooth printer')}
          </DialogTitle>
          <DialogDescription>
            {L(isRTL, 'اختار الطابعة من القائمة، وإذا طلبت رمز اقتران أدخله', 'Pick your printer from the list. If it asks for a pairing PIN, enter it')}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1) التحقق */}
        {step === 'checking' && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* 2) شي بيمنع البحث */}
        {step === 'blocked' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{blockedText(blockReason)}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {blockReason === 'BT_OFF' && (
                <Button onClick={() => void enableBluetooth()}>
                  {L(isRTL, 'تشغيل البلوتوث', 'Turn on Bluetooth')}
                </Button>
              )}
              {blockReason === 'NO_PERMISSION' && (
                <Button onClick={() => void requestPermissions()}>
                  {L(isRTL, 'السماح', 'Allow')}
                </Button>
              )}
              {(blockReason === 'NO_LOCATION' || blockReason === 'NO_PERMISSION' || blockReason === 'BT_OFF' || blockReason === null) && (
                <Button variant="outline" onClick={() => void refreshReadiness()}>
                  {L(isRTL, 'تحقق مرة ثانية', 'Check again')}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 3) قائمة الأجهزة */}
        {step === 'list' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {scanning
                  ? L(isRTL, 'جاري البحث عن طابعات قريبة…', 'Searching for nearby printers…')
                  : L(isRTL, 'انتهى البحث', 'Scan finished')}
              </p>
              {scanning ? (
                <Button size="sm" variant="outline" onClick={() => void stopScan()}>
                  {L(isRTL, 'إيقاف البحث', 'Stop scan')}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void restartScan()}>
                  <RefreshCw className="w-3.5 h-3.5 me-1" />
                  {L(isRTL, 'بحث من جديد', 'Scan again')}
                </Button>
              )}
            </div>

            {scanning && (
              <div className="h-1 w-full overflow-hidden rounded bg-muted">
                <div className="h-full w-1/3 animate-pulse bg-primary" />
              </div>
            )}

            {savedList.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {L(isRTL, 'الأجهزة المقترنة', 'Paired devices')}
                </h3>
                {savedList.map((d) => (
                  <DeviceRow key={d.address} device={d} isRTL={isRTL} onPick={selectDevice} />
                ))}
              </section>
            )}

            {nearbyList.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {L(isRTL, 'أجهزة قريبة', 'Nearby devices')}
                </h3>
                {nearbyList.map((d) => (
                  <DeviceRow key={d.address} device={d} isRTL={isRTL} onPick={selectDevice} />
                ))}
              </section>
            )}

            {!scanning && savedList.length === 0 && nearbyList.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                {L(
                  isRTL,
                  'ما لقينا طابعات. شغّل الطابعة وقرّبها من الهاتف، وتأكد إنها بوضع الاقتران (غالباً ضغطة مطوّلة على زر التغذية أو الـ Power حسب دليل الطابعة)',
                  'No printers found. Turn the printer on, bring it close, and make sure it is in pairing mode (usually a long press on the feed or power button)'
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {L(isRTL, 'إغلاق', 'Close')}
              </Button>
            </div>
          </div>
        )}

        {/* 4) رمز الاقتران (للطابعة الجديدة فقط) */}
        {step === 'pair' && selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <Printer className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold truncate">{selected.name || selected.address}</div>
                <div className="text-xs font-mono text-muted-foreground">{selected.address}</div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="bt-printer-pin" className="text-sm font-medium">
                {L(isRTL, 'رمز الاقتران', 'Pairing PIN')}
              </label>
              <Input
                id="bt-printer-pin"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
              <p className="text-xs text-muted-foreground">
                {L(isRTL, 'أغلب الطابعات بتستخدم 0000 أو 1234. إذا ما اشتغل، راجع دليل الطابعة.', 'Most printers use 0000 or 1234. If it fails, check the printer manual.')}
              </p>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setStep('list')}>
                {L(isRTL, 'رجوع', 'Back')}
              </Button>
              <Button onClick={() => void pairAndSave(selected, pin || undefined)}>
                {L(isRTL, 'اقتران', 'Pair')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* 5) شغّال */}
        {step === 'working' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{progress}</p>
          </div>
        )}

        {/* 6) تم */}
        {step === 'done' && selected && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            <p className="font-semibold">{L(isRTL, 'تم حفظ الطابعة', 'Printer saved')}</p>
            <p className="text-sm text-muted-foreground">{selected.name || selected.address}</p>
            <Button className="mt-2" onClick={() => onOpenChange(false)}>
              {L(isRTL, 'تم', 'Done')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeviceRow({
  device,
  isRTL,
  onPick,
}: {
  device: PrinterDevice;
  isRTL: boolean;
  onPick: (d: PrinterDevice) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(device)}
      className="w-full flex items-center gap-3 rounded-xl border p-3 text-start hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Printer className="w-5 h-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate">{device.name || device.address}</div>
        <div className="text-xs font-mono text-muted-foreground">{device.address}</div>
      </div>
      <Badge variant={device.paired ? 'secondary' : 'default'}>
        {device.paired
          ? L(isRTL, 'مقترنة', 'Paired')
          : L(isRTL, 'جديدة', 'New')}
      </Badge>
    </button>
  );
}
