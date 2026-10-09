import { useState, useRef, useEffect } from 'react';
import { Search, Barcode, Package, LayoutGrid, Grid3x3, List, AlignJustify } from 'lucide-react';
import { ProductImage } from '@/components/products/ProductImage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { DualUnitDisplayCompact } from '@/components/products/DualUnitDisplay';
import { ProductDetailsDialog } from '@/components/pos/ProductDetailsDialog';
import { toast } from 'sonner';
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
  onProductClick: (product: Product) => void;
  onBarcodeScan?: (barcode: string) => void;
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
  onBarcodeScan,
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
              className="rtl:pr-12 ltr:pl-12 h-12 md:h-14 rounded-full bg-white dark:bg-zinc-900 border-none text-sm md:text-base shadow-none w-full focus-visible:ring-2 focus-visible:ring-primary/30 transition-all font-medium"
            />
          </div>

          {!isRestaurant && (
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-white dark:bg-zinc-900 border-none shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] shrink-0 text-primary hover:bg-primary/5 active:scale-95 transition-all"
              onClick={() => setScannerOpen(true)}
            >
              <Barcode className="w-5 h-5 md:w-6 md:h-6" />
            </Button>
          )}

          {/* Mobile View Toggle */}
          <button
            type="button"
            onClick={cycleViewMode}
            className="flex items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-full bg-white dark:bg-zinc-900 border-none shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] shrink-0 text-foreground hover:bg-black/5 active:scale-95 transition-all"
          >
            {viewMode === 'grid' && <LayoutGrid className="w-5 h-5" />}
            {viewMode === 'dense' && <Grid3x3 className="w-5 h-5" />}
            {viewMode === 'list' && <List className="w-5 h-5" />}
            {viewMode === 'compact' && <AlignJustify className="w-5 h-5" />}
          </button>
        </div>

        {/* Categories Horizontal Scroll */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 md:mx-0 md:px-0">
          {categories.map((category, index) => (
            <button
              key={category + index}
              onClick={() => onCategoryChange(category)}
              className={cn(
                "px-4 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 active:scale-95",
                selectedCategory === category
                  ? "bg-primary text-primary-foreground shadow-md scale-105 ring-2 ring-primary/20"
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
                className="pos-item text-right fade-in group bg-card hover:bg-card/90 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-border/60 flex flex-col"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                {/* الصورة بدون أي عناصر معلقة تشوهها */}
                <div className="w-full aspect-[16/10] bg-muted/40 relative overflow-hidden shrink-0">
                  <ProductImage
                    imageUrl={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    iconClassName="w-7 h-7 text-muted-foreground/30"
                  />
                </div>

                {/* جسم البطاقة المستغل للمساحة */}
                <div className="p-2.5 flex flex-col justify-between flex-1 gap-1.5">
                  {/* اسم المنتج ومعه رقم القطعة/الباركود بجانبه مباشرة */}
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="font-bold text-foreground text-xs md:text-sm line-clamp-1 leading-tight flex-1">
                      {product.name}
                    </h3>
                    {(product.barcode || (product as any).sku || (product as any).item_number) && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-muted text-muted-foreground rounded shrink-0 border border-border/40">
                        #{product.barcode || (product as any).sku || (product as any).item_number}
                      </span>
                    )}
                  </div>

                  {/* السطر السفلي: السعر وبجانبه مباشرة عدد القطع / المخزون */}
                  <div className="flex items-center justify-between gap-1.5 mt-auto pt-1 border-t border-border/30">
                    <span className="text-primary font-black text-xs md:text-sm">
                      ${product.price}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-md shrink-0 border border-border/40">
                      <DualUnitDisplayCompact
                        totalPieces={product.quantity}
                        conversionFactor={product.conversionFactor || 1}
                        bulkUnit={product.bulkUnit}
                        smallUnit={product.smallUnit}
                      />
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
                className="pos-item text-right fade-in group bg-card rounded-xl p-2 shadow-xs hover:shadow-sm border border-border/50 flex flex-col justify-between transition-all"
                style={{ animationDelay: `${index * 15}ms` }}
              >
                <div className="w-full aspect-square bg-muted/30 rounded-lg overflow-hidden mb-1.5 relative">
                  <ProductImage
                    imageUrl={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    iconClassName="w-5 h-5 text-muted-foreground/30"
                  />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-[11px] text-foreground line-clamp-1 leading-tight">
                    {product.name}
                  </h4>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-black text-primary">${product.price}</span>
                    <span className="text-muted-foreground font-mono">
                      {product.quantity}ق
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
                className="pos-item text-right fade-in group flex items-center bg-white dark:bg-zinc-900 rounded-[20px] p-2 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-black/5 dark:border-white/5"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden relative">
                  <ProductImage
                    imageUrl={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  />
                </div>
                <div className="flex-1 px-4">
                  <h3 className="font-bold text-sm md:text-base text-foreground line-clamp-1 mb-1">{product.name}</h3>
                  <div className="text-muted-foreground text-xs font-medium mb-1">
                    <DualUnitDisplayCompact
                      totalPieces={product.quantity}
                      conversionFactor={product.conversionFactor || 1}
                      bulkUnit={product.bulkUnit}
                      smallUnit={product.smallUnit}
                    />
                  </div>
                  <p className="text-primary font-black text-sm md:text-base">$\{product.price}</p>
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
                className="pos-item text-right fade-in group flex items-center justify-between bg-white dark:bg-zinc-900 rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200 border border-black/5 dark:border-white/5"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex-1 pe-2 overflow-hidden text-right">
                  <h3 className="font-bold text-xs text-foreground truncate">{product.name}</h3>
                  <p className="text-primary font-bold text-xs mt-0.5">$\{product.price}</p>
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
        />
      )}
    </div>
  );
}