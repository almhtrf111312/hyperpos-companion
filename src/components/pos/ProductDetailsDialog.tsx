import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Barcode,
  Box,
  Camera,
  Package,
  Plus,
  Minus,
  Tag,
  X,
  Copy,
  Printer,
  Edit,
  Percent,
  Check,
  TrendingUp,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  image?: string;
  imageUrl?: string;
  description?: string;
  barcode?: string;
  costPrice?: number;
  bulkCostPrice?: number;
  bulkSalePrice?: number;
  wholesalePrice?: number;
  conversionFactor?: number;
  bulkUnit?: string;
  smallUnit?: string;
  location?: string;
  supplier?: string;
  warranty?: string;
  minStockLevel?: number;
}

interface ProductDetailsDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (product: Product, quantity: number) => void;
  onEditProduct?: (product: Product) => void;
}

export function ProductDetailsDialog({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onEditProduct,
}: ProductDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<'pricing' | 'inventory' | 'barcode'>('pricing');
  const [qty, setQty] = useState(1);
  const [copied, setCopied] = useState(false);

  if (!product) return null;

  const salePrice = Number(product.price) || 0;
  const costPrice = Number(product.costPrice ?? product.bulkCostPrice ?? (salePrice * 0.65)) || 0;
  const profitPerPiece = Math.max(0, salePrice - costPrice);
  const profitMargin = salePrice > 0 ? ((profitPerPiece / salePrice) * 100).toFixed(1) : '0';
  const wholesalePrice = Number(product.wholesalePrice ?? product.bulkSalePrice ?? (salePrice * 0.9)) || salePrice;

  const stock = Number(product.quantity) || 0;
  const minStock = Number(product.minStockLevel) || 5;
  const sku = product.barcode ? `SKU-${product.barcode.slice(-4)}` : `SKU-${product.id.slice(0, 6)}`;

  const quantityValue = Math.max(1, qty);
  const subtotal = (salePrice * quantityValue).toFixed(2);
  const productImage = product.image || (product as any).imageUrl;

  const handleCopyBarcode = () => {
    if (product.barcode) {
      navigator.clipboard.writeText(product.barcode);
      setCopied(true);
      toast.success('تم نسخ الباركود بنجاح');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAdd = () => {
    if (onAddToCart) {
      onAddToCart(product, quantityValue);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        dir="rtl"
        className="product-details-dialog mx-auto w-[calc(100vw-24px)] max-w-[390px] overflow-hidden rounded-[26px] border-0 bg-[#f8fafc] p-0 shadow-2xl dark:bg-[#0f172a] [&>button[aria-label='Close']]:hidden"
      >
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <DialogDescription className="sr-only">تفاصيل المنتج والأسعار والمخزون</DialogDescription>

        <div className="relative flex flex-col max-h-[88vh] overflow-y-auto">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{sku}</span>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="rounded-[20px] bg-white p-3.5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-800/80 dark:ring-slate-700">
              <div className="flex justify-center">
                <div className="relative flex h-[110px] w-[110px] items-center justify-center rounded-[18px] bg-slate-50 shadow-inner ring-1 ring-slate-200/70 dark:bg-slate-900">
                  {productImage ? (
                    <img src={productImage} alt={product.name} className="h-[96px] w-[96px] rounded-[14px] object-cover" />
                  ) : (
                    <Package className="h-12 w-12 text-slate-300 dark:text-slate-600" />
                  )}
                  <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md dark:bg-primary">
                    <Camera className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>

              <div className="mt-3 text-center">
                <h2 className="text-[17px] font-black leading-tight text-slate-900 dark:text-white">{product.name}</h2>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                  {product.description || (product.category ? `تصنيف: ${product.category}` : 'صنف متوفر في المتجر')}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-[16px] bg-slate-200/70 p-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800">
              {[
                { key: 'pricing', label: 'الأسعار والأرباح' },
                { key: 'inventory', label: 'المخزون والرف' },
                { key: 'barcode', label: 'الباركود والمورد' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`rounded-[12px] py-2 transition-all ${
                    activeTab === tab.key
                      ? 'bg-white text-primary shadow-sm font-black dark:bg-slate-900 dark:text-primary'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'pricing' && (
              <div className="mt-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[16px] border border-blue-200/80 bg-blue-50/60 p-2.5 dark:bg-blue-950/20 dark:border-blue-900/40">
                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400">سعر البيع (مفرق)</div>
                    <div className="mt-0.5 text-[18px] font-black text-blue-700 dark:text-blue-300">${salePrice.toFixed(2)}</div>
                    <div className="text-[9px] text-blue-500/80">سعر القطعة المعتمد</div>
                  </div>

                  <div className="rounded-[16px] border border-slate-200 bg-white p-2.5 dark:bg-slate-800/80 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">سعر التكلفة (الشراء)</div>
                    <div className="mt-0.5 text-[18px] font-black text-slate-800 dark:text-slate-200">${costPrice.toFixed(2)}</div>
                    <div className="text-[9px] text-slate-400">التكلفة الفعلية</div>
                  </div>
                </div>

                <div className="rounded-[16px] border border-emerald-200 bg-emerald-50/70 p-2.5 dark:bg-emerald-950/20 dark:border-emerald-900/40">
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                      صافي ربح القطعة:
                    </span>
                    <span className="text-[13px] font-black text-emerald-700 dark:text-emerald-400">
                      +${profitPerPiece.toFixed(2)}
                      <span className="text-[10px] font-normal mr-1">(هامش {profitMargin}%)</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-[14px] bg-white px-3 py-2 text-[11px] shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-800/80 dark:ring-slate-700">
                  <span className="font-medium text-slate-600 dark:text-slate-400">سعر الجملة (5 قطع فأكثر):</span>
                  <span className="font-black text-slate-800 dark:text-slate-200">${wholesalePrice.toFixed(2)}</span>
                </div>
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="mt-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[16px] border border-slate-200 bg-white p-2.5 dark:bg-slate-800/80 dark:border-slate-700">
                    <div className="text-[10px] font-bold text-slate-400">المخزون الحالي</div>
                    <div className="mt-0.5 text-[19px] font-black text-slate-900 dark:text-white">
                      {stock} <span className="text-[11px] font-medium text-slate-500">قطعة</span>
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-amber-200 bg-amber-50/60 p-2.5 dark:bg-amber-950/20 dark:border-amber-900/40">
                    <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">حد الطلب (الحد الأدنى)</div>
                    <div className="mt-0.5 text-[19px] font-black text-amber-700 dark:text-amber-300">
                      {minStock} <span className="text-[11px] font-medium">قطع</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[16px] border border-slate-200 bg-white p-3 space-y-2 text-[11px] shadow-sm dark:bg-slate-800/80 dark:border-slate-700">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      موقع الصنف في المتجر:
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{product.location || 'الرف الرئيسي (A-01)'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700">
                    <span>حالة التوفر:</span>
                    <span className={`font-bold ${stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {stock > 0 ? 'متوفر للبيع الفوري' : 'نفذت الكمية'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'barcode' && (
              <div className="mt-3 space-y-2.5">
                <div className="rounded-[18px] border border-dashed border-slate-300 bg-white p-3 text-center dark:bg-slate-800 dark:border-slate-600">
                  <div className="text-[10px] font-bold text-slate-400">الباركود الدولي للمنتج (EAN-13)</div>

                  <div className="my-2 flex justify-center items-center h-9 px-4">
                    <div className="flex items-center gap-[2.5px] h-8">
                      {[12, 24, 18, 30, 16, 28, 20, 32, 14, 26, 22, 16, 30, 24, 18, 28, 14, 26, 32, 20].map((h, i) => (
                        <span
                          key={i}
                          style={{ height: `${h}px` }}
                          className={`w-[2.5px] rounded-sm ${i % 3 === 0 ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-400'}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="font-mono text-[13px] font-black tracking-widest text-slate-800 dark:text-slate-200">
                    {product.barcode || '6985503300281'}
                  </div>

                  <div className="mt-2.5 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyBarcode}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      نسخ الرقم
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info('جاري إرسال الباركود للطابعة...')}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"
                    >
                      <Printer className="h-3 w-3" />
                      طباعة ملصق
                    </button>
                  </div>
                </div>

                <div className="rounded-[16px] border border-slate-200 bg-white p-2.5 space-y-1.5 text-[11px] dark:bg-slate-800/80 dark:border-slate-700">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>المورد:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{product.supplier || 'المورد الرئيسي'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      الضمان:
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{product.warranty || '3 أشهر استبدال'}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3.5 rounded-[18px] border border-slate-200 bg-white p-2.5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-[12px] bg-slate-100 p-1 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-white text-slate-700 shadow-sm active:scale-95 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-[14px] font-black text-slate-900 dark:text-white">
                    {quantityValue}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((prev) => prev + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-white text-slate-700 shadow-sm active:scale-95 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAdd}
                  className="flex flex-1 items-center justify-between rounded-[14px] bg-primary px-3.5 py-2.5 text-[13px] font-black text-white shadow-md shadow-primary/20 transition active:scale-[0.98]"
                >
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-4 w-4" />
                    إضافة للفاتورة
                  </span>
                  <span className="rounded-lg bg-black/15 px-2 py-0.5 text-[11px] font-bold">
                    ${subtotal}
                  </span>
                </button>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    if (onEditProduct) onEditProduct(product);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-1 rounded-lg py-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <Edit className="h-3 w-3" />
                  تعديل الصنف
                </button>
                <button
                  type="button"
                  onClick={() => toast.info('تم تفعيل وضع الخصم السريع')}
                  className="flex items-center justify-center gap-1 rounded-lg py-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <Percent className="h-3 w-3" />
                  خصم سريع
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center gap-1 rounded-lg py-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                >
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
