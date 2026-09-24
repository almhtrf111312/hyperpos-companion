import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import {
  ShoppingBag,
  Image as ImageIcon,
  Loader2,
  ScanLine,
  Camera,
  ChevronDown,
  ChevronUp,
  Package,
  Check,
  X,
  Layers,
  Calendar,
  DollarSign,
  AlertCircle,
  Search,
  Barcode
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseSupabase = SupabaseClient<any, 'public', any>;
import { addToQueue } from '@/lib/sync-queue';
import { emitEvent, EVENTS } from '@/lib/events';
import { checkRealInternetAccess } from '@/hooks/use-network-status';
import { useImageUpload } from '@/hooks/use-image-upload';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { NativeCameraPreview } from '@/components/camera/NativeCameraPreview';
import { getCategoryNamesCloud } from '@/lib/cloud/categories-cloud';
import { addProductCloud, updateProductCloud } from '@/lib/cloud/products-cloud';
import { isNoInventoryMode } from '@/lib/store-type-config';

interface QuickPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ExistingProductOption {
  id: string;
  name: string;
  barcode?: string;
  category?: string;
  cost_price: number;
  sale_price: number;
  quantity?: number;
  min_stock_level?: number;
  expiry_date?: string;
  image_url?: string;
  custom_fields?: Record<string, unknown>;
}

export function QuickPurchaseDialog({ open, onOpenChange, onSuccess }: QuickPurchaseDialogProps) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);

  // Core Product Info
  const [productName, setProductName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');

  // Extended Product Fields (matching Add Product)
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('5');
  const [expiryDate, setExpiryDate] = useState('');

  // Unit / Carton Settings (Collapsible)
  const [showUnitSettings, setShowUnitSettings] = useState(false);
  const [trackByUnit, setTrackByUnit] = useState<'piece' | 'bulk'>('piece');
  const [bulkUnit, setBulkUnit] = useState('كرتونة');
  const [smallUnit, setSmallUnit] = useState('قطعة');
  const [conversionFactor, setConversionFactor] = useState('1');
  const [bulkCostPrice, setBulkCostPrice] = useState('');
  const [bulkSalePrice, setBulkSalePrice] = useState('');

  // Existing Product Search & Selection
  const [searchResults, setSearchResults] = useState<ExistingProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ExistingProductOption | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Category List
  const [categories, setCategories] = useState<string[]>([]);

  // Scanners & Camera
  const [showScanner, setShowScanner] = useState(false);
  const [showCameraPreview, setShowCameraPreview] = useState(false);

  // Image Upload Hook
  const {
    imageValue: imageUrl,
    imagePreview,
    uploadStatus: imgStatus,
    handleBase64Image,
    handleFileInput,
    clearImage,
    setInitialImage: setImageValue
  } = useImageUpload();

  // Load Categories on mount / open
  useEffect(() => {
    if (open) {
      getCategoryNamesCloud().then(cats => setCategories(cats || []));
    }
  }, [open]);

  // Reset Form on Close
  useEffect(() => {
    if (!open) {
      setProductName('');
      setBarcode('');
      setCategory('');
      setQuantity('1');
      setCostPrice('');
      setSalePrice('');
      setWholesalePrice('');
      setMinStockLevel('5');
      setExpiryDate('');
      setShowUnitSettings(false);
      setTrackByUnit('piece');
      setBulkUnit('كرتونة');
      setSmallUnit('قطعة');
      setConversionFactor('1');
      setBulkCostPrice('');
      setBulkSalePrice('');
      setSelectedProduct(null);
      setSearchResults([]);
      setShowSearchDropdown(false);
      setShowScanner(false);
      setShowCameraPreview(false);
      clearImage();
    }
  }, [open, clearImage]);

  // Live search for existing products by name or barcode
  useEffect(() => {
    if (selectedProduct) return;
    const term = productName.trim();
    const bCode = barcode.trim();

    if (term.length < 2 && bCode.length < 3) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const query = supabase
          .from('products')
          .select('id, name, barcode, category, cost_price, sale_price, quantity, min_stock_level, expiry_date, image_url, custom_fields')
          .eq('archived', false)
          .limit(6);

        if (bCode.length >= 3) {
          query.or(`barcode.ilike.%${bCode}%,barcode2.ilike.%${bCode}%,barcode3.ilike.%${bCode}%`);
        } else if (term.length >= 2) {
          query.ilike('name', `%${term}%`);
        }

        const { data } = await query;
        if (data && data.length > 0) {
          setSearchResults(data as ExistingProductOption[]);
          setShowSearchDropdown(true);
        } else {
          setSearchResults([]);
          setShowSearchDropdown(false);
        }
      } catch (err) {
        console.warn('Failed to search existing products:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [productName, barcode, selectedProduct]);

  // Handle Select Existing Product
  const handleSelectProduct = (prod: ExistingProductOption) => {
    setSelectedProduct(prod);
    setProductName(prod.name);
    setBarcode(prod.barcode || '');
    setCategory(prod.category || '');
    setCostPrice(prod.cost_price ? String(prod.cost_price) : '');
    setSalePrice(prod.sale_price ? String(prod.sale_price) : '');
    if (prod.min_stock_level !== undefined && prod.min_stock_level !== null) {
      setMinStockLevel(String(prod.min_stock_level));
    }
    if (prod.expiry_date) {
      setExpiryDate(prod.expiry_date);
    }
    if (prod.custom_fields && prod.custom_fields.wholesalePrice) {
      setWholesalePrice(String(prod.custom_fields.wholesalePrice));
    }
    if (prod.image_url) {
      setImageValue(prod.image_url);
    }
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  const handleClearSelectedProduct = () => {
    setSelectedProduct(null);
  };

  // Barcode scanned
  const handleBarcodeScanned = (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
    setShowScanner(false);
  };

  // Camera capture
  const handleCameraCaptured = (base64: string) => {
    setShowCameraPreview(false);
    handleBase64Image(base64);
  };

  // Calculate Subtotals
  const qtyNum = Math.max(1, Number.parseInt(quantity) || 1);
  const costNum = Number.parseFloat(costPrice) || 0;
  const saleNum = Number.parseFloat(salePrice) || 0;
  const wholesaleNum = Number.parseFloat(wholesalePrice) || 0;
  const totalCost = costNum * qtyNum;

  // Submit Handler
  const handleSubmit = async () => {
    if (!productName.trim()) {
      toast.error(language === 'en' ? 'Product name is required' : 'يرجى إدخال اسم المنتج');
      return;
    }
    if (!costPrice || costNum < 0) {
      toast.error(language === 'en' ? 'Please specify a valid cost price' : 'يرجى تحديد سعر الشراء بشكل صحيح');
      return;
    }

    setLoading(true);

    const hasInternet = await checkRealInternetAccess(2500);

    // Offline Handling
    if (!hasInternet) {
      addToQueue('quick_purchase', {
        productName: productName.trim(),
        quantity: qtyNum,
        costPrice: costNum,
        totalCost,
        imageUrl: imageUrl || undefined,
        barcode: barcode.trim() || undefined,
        category: category || undefined,
        salePrice: saleNum > 0 ? saleNum : costNum,
        wholesalePrice: wholesaleNum > 0 ? wholesaleNum : undefined,
        minStockLevel: Number.parseInt(minStockLevel) || 5,
        expiryDate: expiryDate || undefined,
        productId: selectedProduct?.id,
      });

      toast.success((t('purchases.quickAdded') || 'تمت إضافة المشتريات بنجاح') + ' (offline)', { icon: '📴' });
      emitEvent(EVENTS.PURCHASES_UPDATED);
      emitEvent(EVENTS.PRODUCTS_UPDATED);
      onSuccess?.();
      onOpenChange(false);
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('يرجى تسجيل الدخول أولاً');
        return;
      }

      let targetProductId = selectedProduct?.id;

      // 1. If not selected, check if a product with same barcode or exact name exists
      if (!targetProductId) {
        if (barcode.trim()) {
          const { data: byBarcode } = await supabase
            .from('products')
            .select('id, quantity, cost_price, sale_price, purchase_history')
            .eq('user_id', user.id)
            .eq('barcode', barcode.trim())
            .maybeSingle();

          if (byBarcode) {
            targetProductId = byBarcode.id;
          }
        }
        if (!targetProductId && productName.trim()) {
          const { data: byName } = await supabase
            .from('products')
            .select('id, quantity, cost_price, sale_price, purchase_history')
            .eq('user_id', user.id)
            .ilike('name', productName.trim())
            .maybeSingle();

          if (byName) {
            targetProductId = byName.id;
          }
        }
      }

      const invoiceNumber = `QP-${Date.now()}`;
      const today = new Date().toISOString().split('T')[0];

      // 2. Either update existing product stock or insert brand new product with all rich details
      if (targetProductId) {
        // Fetch current product to calculate weighted cost and append history
        const { data: existingProd } = await supabase
          .from('products')
          .select('quantity, cost_price, purchase_history')
          .eq('id', targetProductId)
          .single();

        const currentQty = existingProd?.quantity || 0;
        const currentCost = Number(existingProd?.cost_price) || 0;
        const newQty = isNoInventoryMode() ? 99999 : currentQty + qtyNum;
        const avgCost = newQty > 0 && costNum > 0
          ? Math.round(((currentQty * currentCost) + (qtyNum * costNum)) / (currentQty + qtyNum) * 100) / 100
          : costNum;

        const purchaseHistory = Array.isArray(existingProd?.purchase_history)
          ? [...existingProd.purchase_history]
          : [];

        purchaseHistory.push({
          invoice_id: invoiceNumber,
          invoice_number: invoiceNumber,
          supplier_name: productName.trim(),
          date: today,
          quantity: qtyNum,
          cost_price: costNum,
          added_at: new Date().toISOString(),
        });

        const updates: Record<string, unknown> = {
          quantity: newQty,
          cost_price: avgCost,
          purchase_history: purchaseHistory,
          updated_at: new Date().toISOString(),
        };

        if (saleNum > 0) updates.sale_price = saleNum;
        if (category) updates.category = category;
        if (barcode.trim()) updates.barcode = barcode.trim();
        if (expiryDate) updates.expiry_date = expiryDate;
        if (imageUrl) updates.image_url = imageUrl;
        if (wholesaleNum > 0) {
          updates.custom_fields = {
            ...((selectedProduct?.custom_fields as Record<string, unknown>) || {}),
            wholesalePrice: wholesaleNum,
          };
        }

        await (supabase as unknown as LooseSupabase).from('products').update(updates).eq('id', targetProductId);
      } else {
        // Create brand new product with all rich fields directly!
        const createdProduct = await addProductCloud({
          name: productName.trim(),
          barcode: barcode.trim(),
          category: category.trim(),
          costPrice: costNum,
          salePrice: saleNum > 0 ? saleNum : costNum,
          wholesalePrice: wholesaleNum > 0 ? wholesaleNum : undefined,
          quantity: isNoInventoryMode() ? 99999 : qtyNum,
          minStockLevel: Number.parseInt(minStockLevel) || 5,
          expiryDate: expiryDate || undefined,
          image: imageUrl || undefined,
          trackByUnit,
          bulkUnit,
          smallUnit,
          conversionFactor: Number.parseInt(conversionFactor) || 1,
          bulkCostPrice: bulkCostPrice ? Number.parseFloat(bulkCostPrice) : undefined,
          bulkSalePrice: bulkSalePrice ? Number.parseFloat(bulkSalePrice) : undefined,
        });

        if (createdProduct) {
          targetProductId = createdProduct.id;
        }
      }

      // 3. Create purchase invoice
      const { data: invoice, error: invError } = await supabase
        .from('purchase_invoices')
        .insert({
          user_id: user.id,
          invoice_number: invoiceNumber,
          supplier_name: productName.trim(),
          invoice_date: today,
          expected_items_count: 1,
          expected_total_quantity: qtyNum,
          expected_grand_total: totalCost,
          actual_items_count: 1,
          actual_total_quantity: qtyNum,
          actual_grand_total: totalCost,
          status: 'finalized',
          image_url: imageUrl || null,
        })
        .select()
        .single();

      if (invError) throw invError;

      // 4. Create purchase invoice item with product link
      await supabase
        .from('purchase_invoice_items')
        .insert({
          invoice_id: invoice.id,
          product_id: targetProductId || null,
          product_name: productName.trim(),
          barcode: barcode.trim() || null,
          category: category.trim() || null,
          quantity: qtyNum,
          cost_price: costNum,
          sale_price: saleNum > 0 ? saleNum : costNum,
          total_cost: totalCost,
        });

      toast.success(t('purchases.quickAdded') || 'تمت إضافة الفاتورة وتحديث المخزون بنجاح');
      emitEvent(EVENTS.PURCHASES_UPDATED);
      emitEvent(EVENTS.PRODUCTS_UPDATED);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding quick purchase:', error);
      // Fallback to queue on error
      addToQueue('quick_purchase', {
        productName: productName.trim(),
        quantity: qtyNum,
        costPrice: costNum,
        totalCost,
        imageUrl: imageUrl || undefined,
        barcode: barcode.trim() || undefined,
        category: category || undefined,
        salePrice: saleNum > 0 ? saleNum : costNum,
        wholesalePrice: wholesaleNum > 0 ? wholesaleNum : undefined,
        minStockLevel: Number.parseInt(minStockLevel) || 5,
        expiryDate: expiryDate || undefined,
        productId: selectedProduct?.id,
      });
      toast.success((t('purchases.quickAdded') || 'تم حفظ الفاتورة في قائمة الانتظار') + ' (queued)', { icon: '📴' });
      emitEvent(EVENTS.PURCHASES_UPDATED);
      emitEvent(EVENTS.PRODUCTS_UPDATED);
      onSuccess?.();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-[calc(100vw-1.25rem)] sm:w-full sm:max-w-lg max-h-[88vh] overflow-y-auto overflow-x-hidden p-3.5 sm:p-6 text-xs sm:text-sm rounded-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ShoppingBag className="w-5 h-5 text-primary shrink-0" />
              <span>{t('purchases.quickAdd') || 'إضافة مشتريات سريعة'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              أدخل تفاصيل الشراء؛ سيتم تسجيل الفاتورة وإضافة الصنف وتحديث المخزون والأسعار تلقائياً.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 sm:space-y-4 pt-2.5 sm:pt-3">
            {/* Existing Product Indicator */}
            {selectedProduct && (
              <div className="flex items-center justify-between p-2.5 bg-primary/10 border border-primary/20 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium text-primary">
                    منتج مسجل مسبقاً: <strong>{selectedProduct.name}</strong> (المخزون الحالي: {selectedProduct.quantity ?? 0})
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-destructive hover:bg-destructive/10 text-xs"
                  onClick={handleClearSelectedProduct}
                >
                  <X className="w-3.5 h-3.5 ml-1" />
                  إلغاء التحديد
                </Button>
              </div>
            )}

            {/* Product Name with Autocomplete */}
            <div className="space-y-1.5 relative">
              <Label className="text-xs sm:text-sm font-medium">
                {t('products.name') || 'اسم المنتج'} *
              </Label>
              <div className="relative">
                <Input
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    if (selectedProduct && e.target.value !== selectedProduct.name) {
                      setSelectedProduct(null);
                    }
                  }}
                  placeholder={t('purchases.itemNamePlaceholder') || 'اكتب اسم المنتج للبحث أو الإضافة...'}
                  className="h-10 text-sm"
                  autoFocus
                />
                {productName && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductName('');
                      setSelectedProduct(null);
                      setSearchResults([]);
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  <div className="p-1.5 bg-muted/60 text-[11px] font-medium text-muted-foreground">
                    منتجات مطابقة موجودة بالمخزون:
                  </div>
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectProduct(item)}
                      className="w-full text-right p-2.5 hover:bg-accent flex items-center justify-between border-b last:border-b-0 text-xs transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{item.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.barcode ? `باركود: ${item.barcode}` : 'بدون باركود'}
                          {item.category ? ` • ${item.category}` : ''}
                        </span>
                      </div>
                      <div className="text-left font-mono">
                        <span className="text-primary font-bold">${item.cost_price?.toFixed(2) || '0.00'}</span>
                        <span className="text-[10px] text-muted-foreground block">
                          المتوفر: {item.quantity ?? 0}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Barcode & Category Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Barcode */}
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm font-medium flex items-center justify-between">
                  <span>{t('products.barcode') || 'الباركود'}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">اختياري</span>
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="امسح أو اكتب الباركود"
                    className="h-10 text-sm font-mono"
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setShowScanner(true)}
                    title="مسح الباركود بالكاميرا"
                  >
                    <ScanLine className="w-4 h-4 text-primary" />
                  </Button>
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm font-medium">
                  {t('products.category') || 'الفئة / التصنيف'}
                </Label>
                <div className="flex gap-1.5">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-10 text-sm flex-1">
                      <SelectValue placeholder={t('products.category') || 'اختر الفئة'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="أو اكتب جديدة"
                    className="h-10 text-sm w-32 hidden sm:block"
                  />
                </div>
              </div>
            </div>

            {/* Pricing and Quantities */}
            <div className="p-3 bg-muted/40 border border-border/70 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Quantity */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-medium">
                    {t('products.quantity') || 'الكمية المشتراة'} *
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-10 text-center font-bold text-base"
                  />
                </div>

                {/* Cost Price */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-medium flex items-center justify-between">
                    <span>{t('products.costPrice') || 'سعر الشراء (التكلفة)'} *</span>
                    <span className="text-[10px] text-primary font-mono">$</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="h-10 text-left font-mono font-bold text-base"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Sale Price */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-medium flex items-center justify-between">
                    <span>{t('products.salePrice') || 'سعر البيع المقترح'}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">$</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="0.00"
                    className="h-10 text-left font-mono"
                    dir="ltr"
                  />
                </div>

                {/* Wholesale Price */}
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-medium flex items-center justify-between">
                    <span>{t('products.wholesalePrice') || 'سعر الجملة'}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">$</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    placeholder="0.00"
                    className="h-10 text-left font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Grand Total Indicator */}
              <div className="flex items-center justify-between px-3 py-2 bg-card rounded-lg border border-border">
                <span className="text-xs text-muted-foreground font-medium">
                  {(t('purchases.totalAmount') || 'إجمالي تكلفة الشراء')}:
                </span>
                <span className="text-base font-bold font-mono text-primary">
                  ${totalCost.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Inventory Controls: Min Stock & Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm font-medium">
                  {t('products.minStockLevel') || 'حد تنبيه المخزون'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={minStockLevel}
                  onChange={(e) => setMinStockLevel(e.target.value)}
                  placeholder="5"
                  className="h-10 text-center font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm font-medium">
                  {t('products.expiryDate') || 'تاريخ انتهاء الصلاحية'}
                </Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>
            </div>

            {/* Collapsible Dual Units Support */}
            <Collapsible open={showUnitSettings} onOpenChange={setShowUnitSettings} className="border rounded-xl p-3 bg-muted/20">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex items-center justify-between p-1 h-auto text-xs font-semibold text-foreground">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-primary" />
                    <span>إعدادات وحدات التجزئة والكرتونة (اختياري)</span>
                  </div>
                  {showUnitSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">الوحدة الكبرى (كرتونة/صندوق)</Label>
                    <Input
                      value={bulkUnit}
                      onChange={(e) => setBulkUnit(e.target.value)}
                      placeholder="كرتونة"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">الوحدة الصغرى (قطعة/علبة)</Label>
                    <Input
                      value={smallUnit}
                      onChange={(e) => setSmallUnit(e.target.value)}
                      placeholder="قطعة"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">معامل التحويل (قطع)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={conversionFactor}
                      onChange={(e) => setConversionFactor(e.target.value)}
                      className="h-9 text-xs text-center font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">تكلفة الكرتونة ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bulkCostPrice}
                      onChange={(e) => setBulkCostPrice(e.target.value)}
                      placeholder="0.00"
                      className="h-9 text-xs font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">سعر بيع الكرتونة ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bulkSalePrice}
                      onChange={(e) => setBulkSalePrice(e.target.value)}
                      placeholder="0.00"
                      className="h-9 text-xs font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Product / Receipt Photo */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm font-medium">
                صورة المنتج أو الفاتورة
              </Label>
              {imagePreview ? (
                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border group bg-black/5">
                  <img src={imagePreview} alt="Receipt Preview" className="w-full h-full object-contain" />
                  {imgStatus === 'syncing' && (
                    <div className="absolute top-2 left-2 bg-black/70 rounded-full px-2 py-1 flex items-center gap-1.5 text-[11px] text-white">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>جارٍ المزامنة...</span>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 h-7 px-2.5 text-xs shadow-md"
                    onClick={clearImage}
                  >
                    <X className="w-3.5 h-3.5 ml-1" />
                    {t('common.delete') || 'حذف الصورة'}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 text-xs font-medium"
                    onClick={() => setShowCameraPreview(true)}
                  >
                    <Camera className="w-4 h-4 ml-1.5 text-primary" />
                    التقاط بالكاميرا
                  </Button>
                  <label className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-10 text-xs font-medium"
                      asChild
                    >
                      <span>
                        <ImageIcon className="w-4 h-4 ml-1.5 text-primary" />
                        اختيار من المعرض
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11 text-sm"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                {t('common.cancel') || 'إلغاء'}
              </Button>
              <Button
                type="button"
                className="flex-1 h-11 text-sm bg-primary hover:bg-primary/90 font-bold"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    {t('common.loading') || 'جارٍ الحفظ...'}
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 ml-2" />
                    {selectedProduct ? 'تحديث المخزون والفاتورة' : 'حفظ المنتج وتحديث المخزون'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Dialog */}
      {showScanner && (
        <BarcodeScanner
          isOpen={showScanner}
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Camera Capture Dialog */}
      {showCameraPreview && (
        <NativeCameraPreview
          isOpen={showCameraPreview}
          onCapture={handleCameraCaptured}
          onClose={() => setShowCameraPreview(false)}
        />
      )}
    </>
  );
}
