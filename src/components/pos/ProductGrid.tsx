import { useState, useRef, useEffect } from 'react';
import { Search, Barcode, Package, LayoutGrid, Grid3x3, List, AlignJustify } from 'lucide-react';
import { ProductImage } from '@/components/products/ProductImage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, formatNumber } from '@/lib/utils';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { DualUnitDisplayCompact } from '@/components/products/DualUnitDisplay';
import { ProductDetailsDialog } from '@/components/pos/ProductDetailsDialog';
import { toast } from '@/lib/sonner-bridge';
import { useLanguage } from '@/hooks/use-language';
import { getCurrentStoreType, isNoInventoryMode } from '@/lib/store-type-config';

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
  barcode2?: string;
  barcode3?: string;
  conversionFactor?: number;
  bulkUnit?: string;
  smallUnit?: string;
  costPrice?: number;
  bulkCostPrice?: number;
  bulkSalePrice?: number;
  wholesalePrice?: number;
  location?: string;
  supplier?: string;
  warranty?: string;
  minStockLevel?: number;
  archived?: boolean;
}

interface ProductGridProps {
  products: Product[];
  categories: string[];
  searchQuery: string;
  selectedCategory: string;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onProductClick: (product: Product, quantity?: number) => void;
  onAddToCart?: (product: Product, quantity: number) => void;
  onBarcodeScan?: (barcode: string) => void;
  selectedCurrency?: { code: string; symbol: string; rate: number };
}

type ViewMode = 'grid' | 'dense' | 'list' | 'compact';

export function ProductGrid({
  products,
  categories,
  searchQuery,
  selectedCategory,
  onSearchChange,
  onCategoryChange,
  onProductClick,
  onAddToCart,
  onBarcodeScan,
  selectedCurrency,
}: ProductGridProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t, tDynamic } = useLanguage();
  const isRestaurant = getCurrentStoreType() === 'restaurant';

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('pos_view_mode') as ViewMode) || 'grid';
  });

  useEffect(() => {
    localStorage.setItem('pos_view_mode', viewMode);
  }, [viewMode]);

  // تنسيق السعر بالعملة المختارة ومعدل الصرف
  const formatDisplayPrice = (usdPrice: number) => {
    const rate = selectedCurrency?.rate || 1;
    const symbol = selectedCurrency?.symbol || '$';
    const converted = usdPrice * rate;
    const decimals = (selectedCurrency?.rate && selectedCurrency.rate >= 100) ? 0 : 2;

    return `${symbol}${formatNumber(converted, decimals)}`;
  };

  const cycleViewMode = () => {
    setViewMode((prev) => {
      if (prev === 'grid') return 'dense';
      if (prev === 'dense') return 'list';
      if (prev === 'list') return 'compact';
      return 'grid';
    });
  };

  // ✅ استعادة الباركود المعلق — يتم التعامل معها في POS.tsx الآن
  // ProductGrid لم يعد يعالج PENDING_BARCODE_KEY مباشرة لتجنب التكرار

  const noInventory = isNoInventoryMode();

  const filteredProducts = products.filter(product => {
    if (product.archived) return false;
    if (!noInventory && product.quantity <= 0) return false;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.barcode && product.barcode.includes(searchQuery));
    const matchesCategory = selectedCategory === t('common.all') || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleBarcodeScan = (barcode: string) => {
    // ✅ Don't call setScannerOpen(false) here — onClose callback handles it
    onSearchChange(barcode);
    onBarcodeScan?.(barcode);
    try { localStorage.removeItem('hyperpos_pending_scan'); } catch {}
  };

  const touchMovedRef = useRef(false);
  const longPressTriggeredRef = useRef(false);

  const handleLongPressStart = (product: Product) => {
    touchMovedRef.current = false;
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        longPressTriggeredRef.current = true;
        setSelectedProduct(product);
        setDetailsDialogOpen(true);
        if (navigator.vibrate) navigator.vibrate(50);
      }
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    touchMovedRef.current = true;
    handleLongPressEnd();
  };

  const handleProductClick = (product: Product) => {
    handleLongPressEnd();
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    onProductClick(product);
  };

  const pressHandlers = (product: Product) => ({
    onClick: () => handleProductClick(product),
    onTouchStart: () => handleLongPressStart(product),
    onTouchEnd: handleLongPressEnd,
    onTouchCancel: handleLongPressEnd,
    onTouchMove: handleTouchMove,
    onMouseDown: () => handleLongPressStart(product),
    onMouseUp: handleLongPressEnd,
    onMouseLeave: handleLongPressEnd,
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-zinc-950/50">
      {/* Modern Apple-like Header Area */}
      <div data-tour="search-bar" className="px-3 py-3 md:px-5 md:py-5 flex flex-col gap-3 md:gap-4 bg-transparent shrink-0">
        <div className="flex gap-2.5 items-center">
          <div className="flex-1 relative flex items-center shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] rounded-full">
            <Search className="absolute rtl:right-4 ltr:left-4 w-5 h-5 text-muted-foreground/50 pointer-events-none" />
            <Input
              type="text"
              placeholder={tDynamic('productSearch')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = searchQuery.trim();
                  if (trimmed) {
                    const match = products.find(p => p.barcode === trimmed || p.barcode2 === trimmed || p.barcode3 === trimmed);
                    if (match) onProductClick(match);
                  }
                }
              }}
              className="rtl:pr-12 ltr:pl-12 h-12 md:h-14 rounded-full bg-white dark:bg-zinc-900 border-none text-sm md:text-base shadow-none w-full focus-visible:ring-2 focus-visible:ring-primary/30 transition-[box-shadow,border-color] font-medium"
            />
          </div>

          {!isRestaurant && (
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-white dark:bg-zinc-900 border-none shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] shrink-0 text-primary hover:bg-primary/5 active:scale-95 transition-[transform,colors]"
              onClick={() => setScannerOpen(true)}
            >
              <Barcode className="w-5 h-5 md:w-6 md:h-6" />
            </Button>
          )}

          {/* Mobile View Toggle */}
          <button
            type="button"
            onClick={cycleViewMode}
            className="flex items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-full bg-white dark:bg-zinc-900 border-none shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] shrink-0 text-foreground hover:bg-black/5 active:scale-95 transition-[transform,colors]"
          >
            {viewMode === 'grid' && <LayoutGrid className="w-5 h-5" />}
            {viewMode === 'dense' && <Grid3x3 className="w-5 h-5" />}
            {viewMode === 'list' && <List className="w-5 h-5" />}
            {viewMode === 'compact' && <AlignJustify className="w-5 h-5" />}
          </button>
        </div>

        {/* Categories Horizontal Scroll */}
        <div data-tour="categories" className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 md:mx-0 md:px-0">
          {categories.map((category, index) => (
            <button
              key={category + index}
              onClick={() => onCategoryChange(category)}
              className={cn(
                "category-pill px-4 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-[transform,colors,box-shadow] duration-200 flex-shrink-0 active:scale-95",
                selectedCategory === category
                  ? "active bg-primary text-primary-foreground shadow-md scale-105 ring-2 ring-primary/20"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80 shadow-sm border border-border/60"
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 p-3 pt-0 md:p-5 overflow-y-auto pb-32">
        {viewMode === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 md:gap-3.5">
            {filteredProducts.map((product, index) => (
              <button
                key={product.id}
                {...pressHandlers(product)}
                className="pos-item text-start fade-in group bg-card hover:bg-card/90 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow,background-color] duration-200 border border-border/60 flex flex-col"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                {/* الصورة بإطار متناسق واحتواء كامل مع شارة المخزون العلوية */}
                <div className="w-full aspect-[4/3] bg-muted/20 p-1 relative overflow-hidden shrink-0 flex items-center justify-center">
                  {/* شارة الكمية: مثبتة بأقصى الزاوية بخلفية زجاجية معتمة تضمن الوضوح في كل الثيمات */}
                  <div className="absolute z-10 top-1 rtl:left-1 rtl:right-auto ltr:right-1 ltr:left-auto bg-black/75 dark:bg-black/85 backdrop-blur-md border border-white/20 text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white shadow-sm select-none pointer-events-none [&_*]:text-white">
                    <DualUnitDisplayCompact
                      totalPieces={product.quantity}
                      conversionFactor={product.conversionFactor || 1}
                      bulkUnit={product.bulkUnit}
                      smallUnit={product.smallUnit}
                    />
                  </div>
                  <ProductImage
                    imageUrl={product.image}
                    alt={product.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out"
                    iconClassName="w-7 h-7 text-muted-foreground/30"
                  />
                </div>

                {/* جسم البطاقة المستغل للمساحة بالكامل لاسم المنتج والسعر */}
                <div className="p-2.5 flex flex-col justify-between flex-1 gap-1.5 w-full">
                  <h3 className="font-bold text-foreground text-xs md:text-sm line-clamp-2 leading-snug min-h-[2.5rem] w-full text-start" title={product.name}>
                    {product.name}
                  </h3>

                  {/* السطر السفلي: السعر بكامل العرض لمنع أي قص أو التفاف */}
                  <div className="w-full pt-1 border-t border-border/30 mt-auto text-start">
                    <span className="text-primary font-black text-xs md:text-sm block truncate w-full">
                      {formatDisplayPrice(product.price)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Dense View - 3 items side-by-side on mobile, 4-7 on desktop */}
        {viewMode === 'dense' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
            {filteredProducts.map((product, index) => (
              <button
                key={product.id}
                {...pressHandlers(product)}
                className="pos-item text-start fade-in group bg-card rounded-xl p-2 shadow-xs hover:shadow-sm border border-border/50 flex flex-col justify-between transition-[box-shadow,border-color] duration-200"
                style={{ animationDelay: `${index * 15}ms` }}
              >
                <div className="w-full aspect-square bg-muted/20 p-1 rounded-lg overflow-hidden mb-1.5 relative flex items-center justify-center">
                  <div className="absolute z-10 top-1 rtl:left-1 rtl:right-auto ltr:right-1 ltr:left-auto bg-black/75 dark:bg-black/85 backdrop-blur-md border border-white/20 text-[9px] font-bold px-1 py-0.5 rounded text-white shadow-sm select-none pointer-events-none [&_*]:text-white">
                    <DualUnitDisplayCompact
                      totalPieces={product.quantity}
                      conversionFactor={product.conversionFactor || 1}
                      bulkUnit={product.bulkUnit}
                      smallUnit={product.smallUnit}
                    />
                  </div>
                  <ProductImage
                    imageUrl={product.image}
                    alt={product.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                    iconClassName="w-5 h-5 text-muted-foreground/30"
                  />
                </div>
                <div className="space-y-1 w-full">
                  <h4 className="font-bold text-[11px] text-foreground line-clamp-2 leading-tight min-h-[2rem] w-full text-start" title={product.name}>
                    {product.name}
                  </h4>
                  <div className="w-full pt-0.5 border-t border-border/30 text-start">
                    <span className="font-black text-primary text-[11px] block truncate w-full">
                      {formatDisplayPrice(product.price)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="flex flex-col gap-3">
            {filteredProducts.map((product, index) => (
              <button
                key={product.id}
                {...pressHandlers(product)}
                className="pos-item text-start fade-in group flex items-center bg-white dark:bg-zinc-900 rounded-[20px] p-2 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 border border-black/5 dark:border-white/5"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden relative">
                  <ProductImage
                    imageUrl={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  />
                </div>
                <div className="flex-1 min-w-0 px-4">
                  <h3 className="font-bold text-sm md:text-base text-foreground line-clamp-1 mb-1 truncate" title={product.name}>{product.name}</h3>
                  <div className="text-muted-foreground text-xs font-medium mb-1">
                    <DualUnitDisplayCompact
                      totalPieces={product.quantity}
                      conversionFactor={product.conversionFactor || 1}
                      bulkUnit={product.bulkUnit}
                      smallUnit={product.smallUnit}
                    />
                  </div>
                  <p className="text-primary font-black text-sm md:text-base tabular-nums">{formatDisplayPrice(product.price)}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Compact View */}
        {viewMode === 'compact' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {filteredProducts.map((product, index) => (
              <button
                key={product.id}
                {...pressHandlers(product)}
                className="pos-item text-start fade-in group flex items-center justify-between bg-white dark:bg-zinc-900 rounded-xl p-3 shadow-sm hover:shadow-md transition-[box-shadow,border-color] duration-200 border border-black/5 dark:border-white/5"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex-1 min-w-0 pe-2 overflow-hidden text-start">
                  <h3 className="font-bold text-xs text-foreground truncate" title={product.name}>{product.name}</h3>
                  <p className="text-primary font-bold text-xs mt-0.5 tabular-nums">{formatDisplayPrice(product.price)}</p>
                </div>
                <div className="text-[10px] bg-muted/50 rounded-lg px-2 py-1 shrink-0 font-medium">
                  <DualUnitDisplayCompact
                    totalPieces={product.quantity}
                    conversionFactor={product.conversionFactor || 1}
                    bulkUnit={product.bulkUnit}
                    smallUnit={product.smallUnit}
                  />
                </div>
              </button>
            ))}
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground fade-in">
            <Package className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium text-sm">{t('common.all')}</p>
          </div>
        )}
      </div>

      
      {scannerOpen && (
        <BarcodeScanner
          isOpen={scannerOpen}
          onScan={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      )}
      
      {selectedProduct && (
        <ProductDetailsDialog
          product={selectedProduct}
          isOpen={detailsDialogOpen}
          onClose={() => {
            setDetailsDialogOpen(false);
            setSelectedProduct(null);
          }}
          onAddToCart={(product, qty) => {
            if (onAddToCart) {
              onAddToCart(product, qty);
            } else {
              onProductClick(product, qty);
            }
          }}
        />
      )}
    </div>
  );
}