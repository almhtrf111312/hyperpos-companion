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
      toast.success('تم نسخ الباركود بنجاح');
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
    if (dragY > 80) {
      onClose();
    }
    setDragY(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        dir="rtl"
        className="!fixed !inset-x-0 !bottom-0 !top-auto !z-50 !mx-auto !w-full !max-w-md !max-h-[85vh] !rounded-t-[28px] !border-t !border-border !bg-card !p-0 !text-card-foreground !shadow-2xl duration-300 animate-in slide-in-from-bottom [&>button:last-child]:hidden flex flex-col overflow-hidden"
        style={{
          left: 0,
          right: 0,
          margin: '0 auto',
          transform: `translateY(${dragY}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <DialogDescription className="sr-only">تفاصيل المنتج الفعلي</DialogDescription>

        {/* شريط السحب والإغلاق */}
        <div
          className="flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing select-none shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 mb-2 cursor-pointer transition-colors" onClick={onClose} />
          <div className="flex w-full items-center justify-between px-5">
            <span className="text-xs font-semibold text-muted-foreground">
              {product.category || 'صنف عام'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-90 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* رأس البطاقة مع الصورة والاسم الفعلي */}
        <div className="flex items-center gap-3 px-5 py-2 shrink-0">
          {productImage ? (
            <img src={productImage} alt={product.name} className="h-14 w-14 rounded-2xl object-cover ring-1 ring-border shadow-sm shrink-0" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted ring-1 ring-border text-muted-foreground shadow-sm shrink-0">
              <Package className="h-7 w-7" />
            </div>
          )}
          <div className="flex-1 overflow-hidden min-w-0">
            <h3 className="truncate text-base font-bold text-foreground">{product.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">${salePrice.toFixed(2)}</span>
              {product.barcode && (
                <button
                  type="button"
                  onClick={handleCopyBarcode}
                  className="flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95 transition"
                >
                  <Barcode className="h-3 w-3" />
                  <span>{product.barcode}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* التبويبات الثلاثة */}
        <div className="flex border-b border-border px-5 pt-2 shrink-0 bg-card">
          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'pricing' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            الأسعار والأرباح
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'inventory' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            المخزون المتوفر
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition-colors ${activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            الموقع والضمان
          </button>
        </div>

        {/* المحتوى القابل للتمرير عمودياً بدون تشوه */}
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          {activeTab === 'pricing' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl bg-muted/40 p-3 border border-border/70">
                <span className="text-muted-foreground block mb-1">سعر التكلفة:</span>
                <span className="font-bold text-foreground text-sm">
                  {hasCost ? `$${costPrice!.toFixed(2)}` : 'غير مسجل'}
                </span>
              </div>
              <div className="rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 p-3 border border-emerald-500/20">
                <span className="text-emerald-700 dark:text-emerald-400 block mb-1">صافي الربح التقديري:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {hasCost ? `$${profitPerPiece!.toFixed(2)} (${profitMargin}%)` : 'يعتمد على التكلفة'}
                </span>
              </div>
              {product.wholesalePrice ? (
                <div className="col-span-2 rounded-2xl bg-muted/40 p-3 border border-border/70 flex justify-between items-center">
                  <span className="text-muted-foreground">سعر الجملة:</span>
                  <span className="font-bold text-foreground">${Number(product.wholesalePrice).toFixed(2)}</span>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center rounded-2xl bg-muted/40 p-3.5 border border-border/70">
                <span className="text-muted-foreground font-medium">الكمية المتوفرة حالياً:</span>
                <span className={`text-base font-black ${stock > (minStock ?? 0) ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {stock}
                </span>
              </div>
              {minStock !== null && (
                <div className="flex justify-between items-center rounded-2xl bg-muted/40 p-3.5 border border-border/70">
                  <span className="text-muted-foreground font-medium">الحد الأدنى للتنبيه:</span>
                  <span className="font-bold text-foreground">{minStock}</span>
                </div>
              )}
              <div className="flex justify-between items-center rounded-2xl bg-muted/40 p-3.5 border border-border/70">
                <span className="text-muted-foreground font-medium">حالة الصنف:</span>
                <span className={`font-bold ${stock === 0 ? 'text-rose-500' : stock <= (minStock ?? 0) ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {stock === 0 ? 'نفد المخزون' : stock <= (minStock ?? 0) ? 'كمية منخفضة' : 'متوفر'}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-2 text-xs">
              {product.location ? (
                <div className="flex justify-between items-center rounded-2xl bg-muted/40 p-3.5 border border-border/70">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-primary" /> موقع الرف:</span>
                  <span className="font-bold text-foreground">{product.location}</span>
                </div>
              ) : null}
              {product.supplier ? (
                <div className="flex justify-between items-center rounded-2xl bg-muted/40 p-3.5 border border-border/70">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Building className="h-3.5 w-3.5 text-primary" /> المورد:</span>
                  <span className="font-bold text-foreground">{product.supplier}</span>
                </div>
              ) : null}
              {product.warranty ? (
                <div className="flex justify-between items-center rounded-2xl bg-muted/40 p-3.5 border border-border/70">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> الضمان:</span>
                  <span className="font-bold text-foreground">{product.warranty}</span>
                </div>
              ) : null}
              {!product.location && !product.supplier && !product.warranty && (
                <p className="text-center text-muted-foreground py-6">لا توجد بيانات موقع أو مورد أو ضمان مسجلة لهذا الصنف</p>
              )}
            </div>
          )}
        </div>

        {/* شريط الإضافة السفلية الثابت */}
        {onAddToCart && stock > 0 && (
          <div className="shrink-0 flex items-center gap-3 border-t border-border bg-card px-5 py-3.5 pb-6">
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-2 py-1.5 border border-border">
              <button
                type="button"
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-card text-foreground shadow-sm hover:bg-muted active:scale-90 transition"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-bold text-foreground">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(q => Math.min(stock, q + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-card text-foreground shadow-sm hover:bg-muted active:scale-90 transition"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md active:scale-[0.98] transition"
            >
              <Box className="h-4 w-4" />
              إضافة للفاتورة — ${(salePrice * qty).toFixed(2)}
            </button>
          </div>
        )}

        {stock === 0 && (
          <div className="shrink-0 px-5 pb-6 pt-2">
            <div className="rounded-2xl bg-rose-500/10 py-3 text-center text-sm font-bold text-rose-500 border border-rose-500/20">
              هذا الصنف غير متوفر حالياً بالمخزون
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
