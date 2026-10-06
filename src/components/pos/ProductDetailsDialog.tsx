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
  Copy,
  Check,
  DollarSign,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ProductImage } from '@/components/products/ProductImage';
import { loadAllWarehouseStocksLocalFirst } from '@/lib/cloud/warehouses-cloud';
import { cn } from '@/lib/utils';

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
  archived?: boolean;
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
  const [copiedBarcode, setCopiedBarcode] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (product) {
      setQty(1);
      setActiveTab('pricing');
    }
  }, [product?.id]);

  // مخزون المستودع الإضافي
  const warehouseStockQty = useMemo(() => {
    if (!product?.id) return 0;
    try {
      const allStocks = loadAllWarehouseStocksLocalFirst();
      if (!allStocks || !allStocks.length) return 0;
      return allStocks
        .filter(ws => ws.product_id === product.id)
        .reduce((acc, ws) => acc + (Number(ws.quantity) || 0), 0);
    } catch {
      return 0;
    }
  }, [product?.id]);

  if (!product) return null;

  // الحسابات تعتمد حصرياً على البيانات الفعلية
  const salePrice = Number(product.price) || 0;
  const costPrice =
    product.costPrice !== undefined &&
    product.costPrice !== null &&
    !isNaN(Number(product.costPrice)) &&
    Number(product.costPrice) > 0
      ? Number(product.costPrice)
      : null;
  const hasCost = costPrice !== null;
  const profitPerPiece = hasCost ? Math.max(0, salePrice - costPrice!) : null;
  const profitMargin =
    hasCost && salePrice > 0 ? (((profitPerPiece! / salePrice) * 100).toFixed(1)) : null;

  const wholesalePrice =
    product.wholesalePrice !== undefined &&
    product.wholesalePrice !== null &&
    !isNaN(Number(product.wholesalePrice)) &&
    Number(product.wholesalePrice) > 0
      ? Number(product.wholesalePrice)
      : null;
  const hasWholesale = wholesalePrice !== null;

  const stock = Number(product.quantity) || 0;
  const minStock =
    product.minStockLevel !== undefined &&
    product.minStockLevel !== null &&
    !isNaN(Number(product.minStockLevel)) &&
    Number(product.minStockLevel) > 0
      ? Number(product.minStockLevel)
      : null;

  const handleCopyBarcode = () => {
    if (product.barcode) {
      navigator.clipboard.writeText(product.barcode);
      setCopiedBarcode(true);
      toast.success('تم نسخ الباركود بنجاح');
      setTimeout(() => setCopiedBarcode(false), 2000);
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
        className="!fixed !inset-x-0 !bottom-0 !top-auto !z-50 !mx-auto !w-full !max-w-md !max-h-[90vh] !rounded-t-[32px] !border-t !border-border !bg-background !p-0 !text-foreground !shadow-2xl duration-300 animate-in slide-in-from-bottom [&>button:last-child]:hidden flex flex-col overflow-hidden"
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

        {/* رأس النافذة: شريط السحب + شارة القسم + زر الإغلاق */}
        <div
          className="flex flex-col items-center pt-3 pb-2 px-5 cursor-grab active:cursor-grabbing select-none shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* مقبض السحب */}
          <div
            className="h-1.5 w-12 rounded-full bg-muted-foreground/25 hover:bg-muted-foreground/45 mb-2.5 cursor-pointer transition-colors"
            onClick={onClose}
          />

          <div className="flex w-full items-center justify-between">
            {/* شارة القسم: كبسولة دائرية مع نقطة بارزة */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>{product.category ? `قسم: ${product.category}` : 'قسم: عام'}</span>
            </div>

            {/* زر إغلاق دائري (X) في أقصى اليسار */}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-90 transition-all border border-border/50"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* بطاقة بيانات الصنف الرئيسية (Hero Card) */}
        <div className="px-5 pb-3 shrink-0">
          <div className="bg-card rounded-3xl border border-border/80 shadow-sm p-4 flex items-center justify-between gap-3.5">
            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-lg font-bold text-foreground truncate" title={product.name}>
                {product.name}
              </h3>
              {product.description ? (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1" title={product.description}>
                  {product.description}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  {product.category || 'صنف عام'}
                </p>
              )}

              <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                <span className="text-2xl font-black text-primary tracking-tight">
                  ${salePrice.toFixed(2)}
                </span>
                {product.barcode && (
                  <button
                    type="button"
                    onClick={handleCopyBarcode}
                    title="انقر لنسخ الباركود"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 text-xs font-mono font-medium active:scale-95 transition-all shadow-2xs"
                  >
                    <Barcode className="h-3.5 w-3.5 text-primary" />
                    <span>{product.barcode}</span>
                    {copiedBarcode ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* صورة المنتج عبر ProductImage مع كاش محلي أوفلاين وسحابي */}
            <div className="h-20 w-20 md:h-24 md:w-24 rounded-2xl overflow-hidden border border-border/80 bg-muted/40 shadow-sm shrink-0 flex items-center justify-center">
              <ProductImage
                imageUrl={product.image || product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
                iconClassName="w-8 h-8 text-muted-foreground/40"
              />
            </div>
          </div>
        </div>

        {/* التبويبات الثلاثة بتصميم الكبسولات العصرية */}
        <div className="px-5 pb-2 shrink-0">
          <div className="flex p-1 bg-muted/50 rounded-2xl border border-border/50 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('pricing')}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all",
                activeTab === 'pricing'
                  ? "bg-card text-primary shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>الأسعار والأرباح</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all",
                activeTab === 'inventory'
                  ? "bg-card text-primary shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Package className="w-3.5 h-3.5" />
              <span>المخزون المتوفر</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all",
                activeTab === 'info'
                  ? "bg-card text-primary shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>الموقع والضمان</span>
            </button>
          </div>
        </div>

        {/* محتوى التبويبات القابل للتمرير عمودياً */}
        <div className="px-5 py-2 space-y-2.5 flex-1 overflow-y-auto">
          {/* تبويب الأسعار والأرباح */}
          {activeTab === 'pricing' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                {/* سعر التكلفة (الشراء) */}
                <div className="rounded-2xl bg-card p-3.5 border border-border/70 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-xs font-semibold">سعر التكلفة (الشراء)</span>
                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground/60" />
                  </div>
                  <p className="text-base font-bold text-foreground">
                    {hasCost ? `$${costPrice!.toFixed(2)}` : 'لا يوجد'}
                  </p>
                  <span className="text-[11px] text-muted-foreground mt-1">رأس مال القطعة</span>
                </div>

                {/* صافي الربح التقديري */}
                <div className="rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/20 p-3.5 border border-emerald-500/20 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
                    <span className="text-xs font-semibold">صافي الربح التقديري</span>
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {hasCost ? `$${profitPerPiece!.toFixed(2)}` : 'لا يوجد'}
                  </p>
                  <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">
                    {hasCost ? `هامش الربح: ${profitMargin}%` : 'لا يوجد'}
                  </span>
                </div>
              </div>

              {/* سعر الجملة */}
              <div className="rounded-2xl bg-card p-3.5 border border-border/70 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Box className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">سعر الجملة</span>
                    <span className="text-[11px] text-muted-foreground">يطبق تلقائياً عند طلب الكميات</span>
                  </div>
                </div>
                <span className="text-base font-bold text-foreground font-mono">
                  {hasWholesale ? `$${wholesalePrice!.toFixed(2)}` : 'لا يوجد'}
                </span>
              </div>
            </div>
          )}

          {/* تبويب المخزون المتوفر */}
          {activeTab === 'inventory' && (
            <div className="space-y-2.5">
              {/* الكمية المتوفرة بالمحل */}
              <div className="flex justify-between items-center rounded-2xl bg-card p-3.5 border border-border/70 shadow-xs">
                <div>
                  <span className="text-xs font-bold text-foreground block">الكمية المتوفرة بالمحل</span>
                  <span className="text-[11px] text-muted-foreground">الرصيد الفعلي الجاهز للبيع</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-base font-black font-mono", stock > 0 ? "text-foreground" : "text-destructive")}>
                    {stock} {product.smallUnit || ''}
                  </span>
                  {stock > 0 ? (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      ✓ متوفر للبيع الفوري
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
                      نفد المخزون
                    </span>
                  )}
                </div>
              </div>

              {/* حد إعادة الطلب */}
              <div className="flex justify-between items-center rounded-2xl bg-card p-3.5 border border-border/70 shadow-xs">
                <div>
                  <span className="text-xs font-bold text-foreground block">حد إعادة الطلب</span>
                  <span className="text-[11px] text-muted-foreground">الحد الأدنى للتنبيه</span>
                </div>
                <span className="text-sm font-bold text-foreground font-mono">
                  {minStock !== null ? `${minStock} ${product.smallUnit || ''}` : 'لا يوجد'}
                </span>
              </div>

              {/* بطاقة إضافية لمخزون المستودع */}
              <div className="flex justify-between items-center rounded-2xl bg-card p-3.5 border border-border/70 shadow-xs">
                <div>
                  <span className="text-xs font-bold text-foreground block">مخزون المستودع الإضافي</span>
                  <span className="text-[11px] text-muted-foreground">
                    {warehouseStockQty > 0 ? 'مخزون مسجل في المستودعات' : 'المستودع: لا يوجد مخزون إضافي'}
                  </span>
                </div>
                <span className={cn("text-sm font-bold font-mono", warehouseStockQty > 0 ? "text-primary" : "text-muted-foreground")}>
                  {warehouseStockQty > 0 ? `${warehouseStockQty} ${product.smallUnit || 'قطعة'}` : 'لا يوجد'}
                </span>
              </div>
            </div>
          )}

          {/* تبويب الموقع والضمان: بطاقة موحدة مقسمة */}
          {activeTab === 'info' && (
            <div className="rounded-2xl bg-card border border-border/70 shadow-xs overflow-hidden divide-y divide-border/60">
              {/* موقع الصنف في المتجر */}
              <div className="flex justify-between items-center p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">موقع الصنف في المتجر</span>
                    <span className="text-[11px] text-muted-foreground">الرف أو القسم الداخلي</span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {product.location ? product.location : 'لا يوجد'}
                </span>
              </div>

              {/* فترة الضمان */}
              <div className="flex justify-between items-center p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">فترة الضمان</span>
                    <span className="text-[11px] text-muted-foreground">الضمان المعتمد للمنتج</span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {product.warranty ? product.warranty : 'لا يوجد'}
                </span>
              </div>

              {/* المورد المعتمد إن وجد */}
              {product.supplier ? (
                <div className="flex justify-between items-center p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                      <Building className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">المورد المعتمد</span>
                      <span className="text-[11px] text-muted-foreground">جهة التوريد</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {product.supplier}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* الشريط السفلي لإضافة الصنف */}
        {onAddToCart && stock > 0 ? (
          <div className="shrink-0 flex items-center gap-3 border-t border-border bg-card/95 backdrop-blur-sm px-5 py-3.5 pb-6">
            {/* عداد كمية أملس */}
            <div className="flex items-center gap-1.5 rounded-2xl bg-muted/80 px-2 py-1.5 border border-border/80 shadow-xs">
              <button
                type="button"
                onClick={() => setQty(q => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-card text-foreground shadow-2xs hover:bg-muted active:scale-90 transition disabled:opacity-40 disabled:pointer-events-none"
                aria-label="تقليل الكمية"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-9 text-center text-sm font-bold text-foreground font-mono">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(q => Math.min(stock, q + 1))}
                disabled={qty >= stock}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-card text-foreground shadow-2xs hover:bg-muted active:scale-90 transition disabled:opacity-40 disabled:pointer-events-none"
                aria-label="زيادة الكمية"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* زر رئيسي عريض يظهر الإجمالي ديناميكياً */}
            <button
              type="button"
              onClick={handleAdd}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md active:scale-[0.98] transition hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              <span>+ إضافة للفاتورة — ${(salePrice * qty).toFixed(2)}</span>
            </button>
          </div>
        ) : (
          <div className="shrink-0 px-5 pb-6 pt-2">
            <div className="rounded-2xl bg-destructive/10 py-3 text-center text-sm font-bold text-destructive border border-destructive/20 flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>هذا الصنف غير متوفر حالياً بالمخزون</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
