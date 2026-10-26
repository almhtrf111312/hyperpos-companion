import { FlowPosPrinter, isNativeAndroid, type PrinterDevice } from './flowpos-printer';
import { buildReceiptParts, toBase64, type PaperWidth, type ReceiptLine } from './receipt-escpos';
import { getStoredPrinterConfig, saveStoredPrinterConfig } from './printer-config';

export type ReadinessReason = 'NOT_ANDROID' | 'NO_BLUETOOTH' | 'BT_OFF' | 'NO_PERMISSION' | 'NO_LOCATION';

export async function checkReadiness(): Promise<{ ok: true; reason?: undefined } | { ok: false; reason: ReadinessReason }> {
  if (!isNativeAndroid()) return { ok: false, reason: 'NOT_ANDROID' };
  try {
    const s = await FlowPosPrinter.getState();
    if (!s.supported) return { ok: false, reason: 'NO_BLUETOOTH' };
    if (!s.enabled) return { ok: false, reason: 'BT_OFF' };
    if (!s.hasPermissions) return { ok: false, reason: 'NO_PERMISSION' };
    if (s.needsLocation && !s.hasLocation) return { ok: false, reason: 'NO_LOCATION' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'NO_BLUETOOTH' };
  }
}

/** الاقتران يصير عبر النظام. الرمز بيتمرر للـ plugin بالذاكرة فقط ولا بيتخزن. */
export async function pairAndConnect(address: string, pin?: string): Promise<void> {
  await FlowPosPrinter.pair({ address, pin: pin?.trim() || undefined });
  await FlowPosPrinter.connect({ address });
}

export function saveSelectedPrinter(device: PrinterDevice, paperWidth: PaperWidth): void {
  const current = getStoredPrinterConfig();
  saveStoredPrinterConfig({
    ...current,
    connectionType: 'bluetooth',
    deviceAddress: device.address,
    deviceName: device.name,
    paperWidth,
  });
}

export function clearSelectedPrinter(): void {
  const current = getStoredPrinterConfig();
  saveStoredPrinterConfig({ ...current, deviceAddress: undefined, deviceName: undefined });
}

/** يطبع أجزاء بالترتيب. كل جزء طلب منفصل، هيك حجم الـ bridge يبقى صغير. */
export async function printParts(address: string, parts: Uint8Array[]): Promise<void> {
  for (const part of parts) {
    await FlowPosPrinter.print({ address, data: toBase64(part) });
  }
}

export async function printTestPage(address: string, paper: PaperWidth): Promise<void> {
  const lines: ReceiptLine[] = [
    { text: 'FlowPOS Pro', align: 'center', bold: true, size: 1.4 },
    { text: 'Printer test', align: 'center' },
    { text: new Date().toLocaleString(), align: 'center' },
    { text: '--------------------------------', align: 'center' },
    { text: 'Connection OK', align: 'center', bold: true },
  ];
  const parts = await buildReceiptParts(lines, paper);
  await printParts(address, parts);
}

/** يرجّع رسالة مفهومة من كود الخطأ اللي جاي من الـ plugin. */
export function describePrinterError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('BT_OFF')) return 'فعّل البلوتوث من هاتفك أولاً';
  if (msg.includes('NO_PERMISSION')) return 'امنح التطبيق صلاحية البلوتوث من إعدادات الهاتف';
  if (msg.includes('NO_LOCATION')) return 'فعّل خدمة الموقع (GPS) لاكتشاف الطابعات على هذا الجهاز';
  if (msg.includes('PAIR_FAILED')) return 'فشل الاقتران. تأكد من الرمز (غالباً 0000 أو 1234) وأن الطابعة قريبة وشغّالة';
  if (msg.includes('PAIR_TIMEOUT')) return 'انتهى وقت الاقتران. جرّب مرة ثانية والطابعة بوضع الاقتران';
  if (msg.includes('CONNECT_FAILED')) return 'تعذّر الاتصال بالطابعة. تأكد أنها تعمل وقريبة من الهاتف';
  if (msg.includes('PRINT_FAILED')) return 'فشلت الطباعة. تحقق من الورق وغطاء الطابعة ثم أعد المحاولة';
  if (msg.includes('DISCOVERY_FAILED')) return 'تعذّر بدء البحث عن الأجهزة. جرّب مرة ثانية';
  return 'حدث خطأ غير متوقع مع الطابعة';
}
