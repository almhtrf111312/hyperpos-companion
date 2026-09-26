import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Barcode,
  Box,
  Package,
  Plus,
  Minus,
  X,
  MapPin,
  ShieldCheck,
  Building,
} from 'lucide-react';
import React, { useState, useRef } from 'react';
import { toast } from 'sonner';

export interface Product {
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
}: ProductDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<'pricing' | 'inventory' | 'info'>('pricing');
  const [qty, setQty] = useState(1);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  if (!product) return null;

  // الحسابات تعتمد حصرياً على البيانات الفعلية
  const salePrice = Number(product.price) || 0;
  const costPrice = product.costPrice !== undefined ? Number(product.costPrice) : undefined;
  const hasCost = costPrice !== undefined && !isNaN(costPrice);
  const profitPerPiece = hasCost ? Math.max(0, salePrice - costPrice!) : null;
  const profitMargin = hasCost && salePrice > 0 ? (((profitPerPiece! / salePrice) * 100).toFixed(1)) : null;

  const stock = Number(product.quantity) || 0;
  const minStock = product.minStockLevel !== undefined ? Number(product.minStockLevel) : null;
  const productImage = product.image || product.imageUrl;

  const handleCopyBarcode = () => {
    if (product.barcode) {
      navigator.clipboard.writeText(product.barcode);
      toast.success('تم نسخ الباركود');
    }
  };

  const handleAdd = () => {
    if (onAddToCart) onAddToCart(product, qty);
    onClose();
  };

  // معالجة سحب الشاشة لأسفل للإغلاق بسلاسة
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragY > 90) {
      onClose();
    }
    setDragY(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        dir="rtl"
        className="!fixed !inset-x-0 !bottom-0 !top-auto !z-50 !m-0 !w-full !max-w-lg !translate-y-0 !rounded-t-[28px] !border-t !border-slate-700/60 !bg-[#0f172a] !p-0 !text-slate-100 !shadow-2xl duration-300 animate-in slide-in-from-bottom [&>button:last-child]:hidden"
        style={{
          left: '50%',
          transform: `translateX(-50%) translateY(${dragY}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <DialogDescription className="sr-only">تفاصيل المنتج الفعلي</DialogDescription>

        {/* شريط السحب والإغلاق */}
        <div
          className="flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-600/70 mb-2 cursor-pointer active:bg-slate-400" onClick={onClose} />
          <div className="flex w-full items-center justify-between px-5">
            <span className="text-xs font-semibold text-slate-400">
              {product.category || 'صنف عام'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 active:scale-90 transition-transform"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* رأس البطاقة مع الصورة والاسم الفعلي */}
        <div className="flex items-center gap-3 px-5 py-2">
          {productImage ? (
            <img src={productImage} alt={product.name} className="h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-700 shadow-md" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 ring-1 ring-slate-700 text-slate-400 shadow-md">
              <Package className="h-7 w-7" />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <h3 className="truncate text-base font-bold text-white">{product.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-black text-emerald-400">${salePrice.toFixed(2)}</span>
              {product.barcode && (
                <button
                  type="button"
                  onClick={handleCopyBarcode}
                  className="flex items-center gap-1 rounded-lg bg-slate-800/90 px-2 py-0.5 text-[11px] font-mono text-slate-300 hover:bg-slate-700 active:scale-95 transition"
                >
                  <Barcode className="h-3 w-3" />
                  <span>{product.barcode}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* التبويبات الثلاثة */}
        <div className="flex border-b border-slate-800 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition ${activeTab === 'pricing' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
          >
            الأسعار والأرباح
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition ${activeTab === 'inventory' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
          >
            المخزون المتوفر
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition ${activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
          >
            الموقع والضمان
          </button>
        </div>

        {/* المحتوى الفعلي بدون Mock Data */}
        <div className="p-5 space-y-3 min-h-[140px]">
          {activeTab === 'pricing' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-800/80 p-2.5 border border-slate-700/50">
                <span className="text-slate-400 block mb-1">سعر التكلفة:</span>
                <span className="font-bold text-white text-sm">
                  {hasCost ? `$${costPrice!.toFixed(2)}` : 'غير مسجل'}
                </span>
              </div>
              <div className="rounded-xl bg-slate-800/80 p-2.5 border border-slate-700/50">
                <span className="text-slate-400 block mb-1">صافي الربح التقديري:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {hasCost ? `$${profitPerPiece!.toFixed(2)} (${profitMargin}%)` : 'يعتمد على التكلفة'}
                </span>
              </div>
              {product.wholesalePrice ? (
                <div className="col-span-2 rounded-xl bg-slate-800/80 p-2.5 border border-slate-700/50 flex justify-between">
                  <span className="text-slate-400">سعر الجملة:</span>
                  <span className="font-bold text-white">${Number(product.wholesalePrice).toFixed(2)}</span>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center rounded-xl bg-slate-800/80 p-3 border border-slate-700/50">
                <span className="text-slate-300">الكمية المتوفرة حالياً:</span>
                <span className={`text-base font-black ${stock > (minStock ?? 0) ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stock}
                </span>
              </div>
              {minStock !== null && (
                <div className="flex justify-between items-center rounded-xl bg-slate-800/80 p-3 border border-slate-700/50">
                  <span className="text-slate-300">الحد الأدنى للتنبيه:</span>
                  <span className="font-bold text-white">{minStock}</span>
                </div>
              )}
              <div className="flex justify-between items-center rounded-xl bg-slate-800/80 p-3 border border-slate-700/50">
                <span className="text-slate-300">حالة الصنف:</span>
                <span className={`font-bold ${stock === 0 ? 'text-red-400' : stock <= (minStock ?? 0) ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {stock === 0 ? 'نفد المخزون' : stock <= (minStock ?? 0) ? 'كمية منخفضة' : 'متوفر'}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-2 text-xs">
              {product.location ? (
                <div className="flex justify-between items-center rounded-xl bg-slate-800/80 p-3 border border-slate-700/50">
                  <span className="flex items-center gap-1.5 text-slate-300"><MapPin className="h-3.5 w-3.5 text-primary" /> موقع الرف:</span>
                  <span className="font-bold text-white">{product.location}</span>
                </div>
              ) : null}
              {product.supplier ? (
                <div className="flex justify-between items-center rounded-xl bg-slate-800/80 p-3 border border-slate-700/50">
                  <span className="flex items-center gap-1.5 text-slate-300"><Building className="h-3.5 w-3.5 text-primary" /> المورد:</span>
                  <span className="font-bold text-white">{product.supplier}</span>
                </div>
              ) : null}
              {product.warranty ? (
                <div className="flex justify-between items-center rounded-xl bg-slate-800/80 p-3 border border-slate-700/50">
                  <span className="flex items-center gap-1.5 text-slate-300"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> الضمان:</span>
                  <span className="font-bold text-white">{product.warranty}</span>
                </div>
              ) : null}
              {!product.location && !product.supplier && !product.warranty && (
                <p className="text-center text-slate-500 py-6">لا توجد بيانات موقع أو مورد أو ضمان مسجلة لهذا الصنف</p>
              )}
            </div>
          )}
        </div>

        {/* شريط الإضافة السفلية الثابت */}
        {onAddToCart && stock > 0 && (
          <div className="sticky bottom-0 flex items-center gap-3 border-t border-slate-800 bg-[#0f172a] px-5 py-4 pb-6">
            <div className="flex items-center gap-2 rounded-full bg-slate-800 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-white active:scale-90 transition"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-bold text-white">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(q => Math.min(stock, q + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-white active:scale-90 transition"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg active:scale-[0.98] transition"
            >
              <Box className="h-4 w-4" />
              إضافة للفاتورة — ${(salePrice * qty).toFixed(2)}
            </button>
          </div>
        )}

        {stock === 0 && (
          <div className="px-5 pb-6 pt-1">
            <div className="rounded-full bg-red-950/40 py-3 text-center text-sm font-bold text-red-400 border border-red-900/50">
              هذا الصنف غير متوفر حالياً
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
