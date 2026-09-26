import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Barcode, Box, Camera, ChevronLeft, Package, Plus, Minus, Tag, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  image?: string;
  imageUrl?: string;
  description?: string;
  barcode?: string;
  conversionFactor?: number;
  bulkUnit?: string;
  smallUnit?: string;
  bulkSalePrice?: number;
  costPrice?: number;
  bulkCostPrice?: number;
}

interface ProductDetailsDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

export function ProductDetailsDialog({ product, isOpen, onClose }: ProductDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<'pricing' | 'inventory' | 'barcode'>('pricing');
  const [qty, setQty] = useState(1);

  if (!product) return null;

  const productImage = product.image || (product as any).imageUrl;
  const costPrice = Number(product.costPrice ?? product.bulkCostPrice ?? (product.price * 0.65) ?? 0.65);
  const salePrice = Number(product.price ?? 1);
  const profitValue = Number((salePrice - costPrice).toFixed(2));
  const marginPercent = salePrice > 0 ? Math.round((profitValue / salePrice) * 1000) / 10 : 0;
  const stockValue = product.quantity > 0 ? `${product.quantity} قطعة` : 'غير متوفر';
  const quantityValue = Math.min(Math.max(qty, 1), Math.max(product.quantity, 1));
  const subtotal = salePrice * quantityValue;

  const barcodeBars = useMemo(
    () => [
      '10', '16', '22', '30', '36', '44', '48', '58', '64', '73', '80', '86', '96', '103', '108', '117', '124', '130', '138', '148', '154', '163', '170', '178', '184'
    ],
    []
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        dir="rtl"
        className="mx-0 max-w-[420px] overflow-hidden rounded-[30px] border-0 bg-[#f5f5f5] p-0 shadow-[0_28px_80px_rgba(15,23,42,0.26)] dark:bg-[#0f172a] [&>button[aria-label='Close']]:hidden"
      >
        <div className="relative bg-[#f3f3f3]">
          <div className="flex items-center justify-between px-5 pt-3">
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.12)] ring-1 ring-slate-200"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
              <span>SKU: MEI-6985</span>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
          </div>

          <div className="px-4 pb-3 pt-2">
            <div className="rounded-[18px] bg-[#e3e8e6] px-3 py-2 shadow-inner shadow-slate-200/80">
              <div className="flex items-center justify-between gap-2">
                <button className="rounded-[14px] bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
                  قسم: سماعات
                </button>
                <div className="rounded-[14px] bg-[#37c47e] px-3 py-1.5 text-[12px] font-bold text-white shadow-sm">
                  المخزون: {product.quantity} قطعة
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] bg-[#eef1ef] p-4 shadow-inner shadow-slate-200/70">
              <div className="flex justify-center">
                <div className="relative flex h-[136px] w-[136px] items-center justify-center rounded-[18px] bg-white shadow-md ring-1 ring-slate-200">
                  {productImage ? (
                    <img src={productImage} alt={product.name} className="h-[104px] w-[104px] rounded-[16px] object-cover" />
                  ) : (
                    <div className="flex h-[104px] w-[104px] items-center justify-center rounded-[16px] bg-slate-100">
                      <Package className="h-14 w-14 text-slate-400" />
                    </div>
                  )}
                  <button className="absolute -bottom-1 right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 text-center">
                <h2 className="text-[18px] font-black leading-[1.4] text-slate-900">{product.name}</h2>
                <p className="mt-1 text-[12px] text-slate-500">صوت نقي • مدخل AUX 3.5mm • ميكروفون مدمج</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1 rounded-[18px] bg-[#e7e7e7] p-1 text-[12px] font-bold text-slate-600">
              {[
                { key: 'pricing', label: 'الأسعار والأرباح' },
                { key: 'inventory', label: 'المخزون والرف' },
                { key: 'barcode', label: 'الباركود والمورد' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`rounded-[12px] px-2 py-2 transition ${
                    activeTab === tab.key ? 'bg-white text-[#1f5ff7] shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'pricing' && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-[16px] border border-blue-200 bg-blue-50 p-3">
                    <div className="text-[11px] font-bold text-blue-600">سعر البيع (مفرق)</div>
                    <div className="mt-1 text-[18px] font-black text-blue-700">{formatCurrency(salePrice)}</div>
                    <div className="mt-1 text-[10px] text-blue-500">سعر القطعة المعتمد</div>
                  </div>

                  <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold text-slate-500">سعر التكلفة (الشراء)</div>
                    <div className="mt-1 text-[18px] font-black text-slate-800">{formatCurrency(costPrice)}</div>
                    <div className="mt-1 text-[10px] text-slate-400">سعر الكرتونة: {formatCurrency((costPrice || 0) * 50)}</div>
                  </div>
                </div>

                <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800">
                    <span>صافي ربح القطعة:</span>
                    <span className="text-[12px] font-black text-emerald-600">
                      +{formatCurrency(profitValue)} (هامش {marginPercent}%)
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-200">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(16, marginPercent * 1.4))}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-emerald-600">
                    <span>تكلفة: {formatCurrency(costPrice)}</span>
                    <span>ربح ممتاز للمحل</span>
                    <span>سعر: {formatCurrency(salePrice)}</span>
                  </div>
                </div>

                <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-700">سعر الجملة (5 قطع فأكثر)</div>
                      <div className="text-[10px] text-slate-400">يطبق تلقائياً عند شراء الكمية</div>
                    </div>
                    <div className="text-[15px] font-black text-[#1f5ff7]">{formatCurrency(salePrice * 0.85)}</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-400">الكمية المتوفرة بالمستودع</div>
                    <div className="mt-1 text-[22px] font-black text-slate-900">{stockValue}</div>
                    <div className="mt-1 text-[10px] font-bold text-emerald-500">حالة ممتازة</div>
                  </div>

                  <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-400">حد إعادة الطلب (تنبيه)</div>
                    <div className="mt-1 text-[22px] font-black text-amber-500">5 قطع</div>
                    <div className="mt-1 text-[10px] text-slate-400">تنبيه عند الاقتراب</div>
                  </div>
                </div>

                <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-600">📍</div>
                      <div>
                        <div className="text-[12px] font-bold text-slate-800">موقع الصنف في المتجر</div>
                        <div className="text-[10px] text-slate-400">الرف الصوتي: زاوية A-03</div>
                      </div>
                    </div>
                    <button className="text-[11px] font-bold text-[#1f5ff7]">تعديل</button>
                  </div>
                </div>

                <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[12px] font-bold text-slate-700">سجل حركة الصنف:</div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>إجمالي المباع هذا الشهر:</span>
                    <span className="font-bold text-slate-900">18 قطعة</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>تاريخ آخر شحنة مورد:</span>
                    <span className="font-bold text-slate-900">10 سبتمبر 2026</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'barcode' && (
              <div className="mt-4 space-y-3">
                <div className="rounded-[18px] border-2 border-dashed border-slate-300 bg-white p-4 text-center">
                  <div className="text-[11px] font-bold text-slate-400">الباركود الدولي للمنتج (EAN-13)</div>
                  <div className="mt-3 flex items-center justify-center">
                    <svg className="h-12 w-full max-w-[220px] text-slate-900" viewBox="0 0 200 40" fill="currentColor" aria-label="barcode">
                      {barcodeBars.map((x, index) => {
                        const isEven = index % 2 === 0;
                        const width = isEven ? 3 : 2;
                        return <rect key={`${x}-${index}`} x={Number(x)} y={0} width={width} height={40} />;
                      })}
                    </svg>
                  </div>
                  <div className="mt-2 font-mono text-[16px] font-black tracking-[0.18em] text-slate-800">
                    {product.barcode || '6985503300281'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-2.5">
                    <div className="text-slate-400">الشركة المصنعة</div>
                    <div className="mt-1 font-bold text-slate-800">Meidou Audio Tech</div>
                  </div>
                  <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-2.5">
                    <div className="text-slate-400">فترة الضمان</div>
                    <div className="mt-1 font-bold text-slate-800">3 شهور استبدال</div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-[14px] bg-slate-100 px-1 py-1">
                  <button
                    onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-lg font-black text-slate-700 shadow-sm"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    value={quantityValue}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
                    className="w-12 border-0 bg-transparent text-center text-[15px] font-black text-slate-900 outline-none"
                    min={1}
                    max={Math.max(product.quantity, 1)}
                  />
                  <button
                    onClick={() => setQty((prev) => Math.min(Math.max(product.quantity, 1), prev + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-lg font-black text-slate-700 shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    onClose();
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[16px] bg-[#1f5ff7] px-4 py-3 text-[14px] font-black text-white shadow-[0_12px_24px_rgba(31,95,247,0.3)]"
                >
                  <span>إضافة للفاتورة</span>
                  <span className="rounded-lg bg-white/20 px-2 py-0.5 text-[11px]">{formatCurrency(subtotal)}</span>
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between text-[12px] text-slate-500">
                <button className="flex items-center gap-1 font-bold text-[#1f5ff7]">
                  <Tag className="h-3.5 w-3.5" />
                  <span>تعديل الصنف</span>
                </button>
                <button className="flex items-center gap-1 font-bold text-[#1f5ff7]">
                  <Box className="h-3.5 w-3.5" />
                  <span>خصم سريع</span>
                </button>
                <button onClick={onClose} className="font-bold text-rose-500">
                  إغلاق النافذة
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
