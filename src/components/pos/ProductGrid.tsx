import { useState, useRef, useEffect } from 'react';
import { Search, Barcode, Package, LayoutGrid, List, AlignJustify } from 'lucide-react';
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

type ViewMode = 'grid' | 'list' | 'compact';

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
      if (prev === 'grid') return 'list';
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
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Search, View Toggle, and Categories */}
      <div data-tour="search-bar" className="p-4 md:p-6 border-b border-black/5 dark:border-white/5 bg-transparent space-y-4 md:space-y-6">
        <div className="flex gap-2 items-center">
          <div className="flex-1 min-w-0 relative flex items-center ps-12 md:ps-0">
            <Search className="absolute rtl:right-14 ltr:left-14 md:rtl:right-3 md:ltr:left-3 w-4 h-4 md:w-5 md:h-5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={tDynamic('productSearch')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = searchQuery.trim();
                  if (trimmed) {
                    const match = products.find(p => p.barcode === trimmed || (p as any).barcode2 === trimmed || (p as any).barcode3 === trimmed);
                    if (match && (!noInventory && (match.quantity <= 0 || match.archived))) {
                      toast.warning("المنتج موجود في الأرشيف (انتهت الكمية الموجودة في المخزن)");
                      return;
                    }
                    onBarcodeScan?.(trimmed);
                  }
                }
              }}
              className="rtl:pr-11 ltr:pl-11 md:rtl:pr-12 md:ltr:pl-12 h-12 md:h-14 rounded-full bg-white/80 dark:bg-zinc-900/80 border border-black/5 dark:border-white/10 text-base shadow-[0_2px_10px_rgb(0,0,0,0.02)] backdrop-blur-xl focus-visible:ring-black/10 dark:focus-visible:ring-white/10 w-full transition-all"
            />
          </div>

          {/* Mobile Single Cycle View Mode Button */}
          <button
            type="button"
            onClick={cycleViewMode}
            className="flex md:hidden items-center justify-center h-11 w-11 rounded-2xl border border-border bg-muted/70 text-foreground hover:bg-background/80 shadow-sm flex-shrink-0 transition-all duration-200"
            title={
              viewMode === 'grid'
                ? t('pos.viewGrid')
                : viewMode === 'list'
                ? t('pos.viewList')
                : t('pos.viewCompact')
            }
          >
            {viewMode === 'grid' && <LayoutGrid className="w-4 h-4 text-primary" />}
            {viewMode === 'list' && <List className="w-4 h-4 text-primary" />}
            {viewMode === 'compact' && <AlignJustify className="w-4 h-4 text-primary" />}
          </button>

          {/* Desktop View Mode Toggle (3 Buttons) */}
          <div className="hidden md:flex border border-border rounded-2xl overflow-hidden flex-shrink-0 bg-muted/70 p-1 shadow-sm h-11 md:h-12 items-center">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 md:p-2.5 rounded-xl transition-all duration-200",
                viewMode === 'grid' ? "bg-gradient-primary text-primary-foreground shadow-md shadow-primary/30" : "text-muted-foreground hover:bg-background/70"
              )}
              title={t('pos.viewGrid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 md:p-2.5 rounded-xl transition-all duration-200",
                viewMode === 'list' ? "bg-gradient-primary text-primary-foreground shadow-md shadow-primary/30" : "text-muted-foreground hover:bg-background/70"
              )}
              title={t('pos.viewList')}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={cn(
                "p-2 md:p-2.5 rounded-xl transition-all duration-200",
                viewMode === 'compact' ? "bg-gradient-primary text-primary-foreground shadow-md shadow-primary/30" : "text-muted-foreground hover:bg-background/70"
              )}
              title={t('pos.viewCompact')}
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>

          {!isRestaurant && (
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 md:h-12 md:w-12 rounded-2xl border-border bg-background/90 shadow-sm flex-shrink-0"
              onClick={() => setScannerOpen(true)}
            >
              <Barcode className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          )}
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          {categories.map((category, index) => (
            <button
              key={`${category}-${index}`}
              onClick={() => onCategoryChange(category)}
              className={cn(
                "px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 flex-shrink-0 border",
                  selectedCategory === category
                    ? "bg-black dark:bg-white text-white dark:text-black shadow-[0_4px_14px_rgba(0,0,0,0.2)] dark:shadow-[0_4px_14px_rgba(255,255,255,0.2)] border-transparent scale-105"
                    : "bg-white dark:bg-zinc-900 text-foreground hover:bg-black/5 dark:hover:bg-white/10 border-black/5 dark:border-white/10"
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="flex-1 p-3 md:p-4 overflow-y-auto pb-28">
        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 md:gap-2">
            {filteredProducts.map((product, index) => (
              <button
                key={product.id}
                {...pressHandlers(product)}
                className="pos-item text-right fade-in p-2.5 md:p-3 group hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgb(0,0,0,0.4)] hover:-translate-y-1.5 border border-black/5 dark:border-white/10 rounded-3xl transition-all duration-300 bg-white dark:bg-zinc-900"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="w-full aspect-square rounded-2xl bg-slate-50 dark:bg-zinc-950 flex items-center justify-center mb-3 overflow-hidden group-hover:scale-105 transition-transform duration-500 ease-out">
                  <ProductImage
                    imageUrl={product.image}
                    alt={product.name}
                    className="w-full h-full"
                    iconClassName="w-6 h-6 md:w-8 md:h-8"
                  />
                </div>
                <h3 className="font-bold text-foreground text-[10px] sm:text-xs md:text-sm line-clamp-2 mb-1 leading-snug">{product.name}</h3>
                <p className="text-foreground font-black text-xs sm:text-sm md:text-base">${product.price}</p>
                <div className="mt-0.5 scale-90 origin-right">
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

        {/* List View */}
        {viewMode === 'list' && (
          <div className="space-y-1.5">
            {filteredProducts.map((product, index) => (
              <button
                key={product.id}
                {...pressHandlers(product)}
                className="w-full flex items-center gap-3 p-2.5 rounded-2xl border border-border/70 bg-card shadow-sm hover:bg-muted/40 hover:shadow-md transition-all text-right fade-in"
              >
                <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <ProductImage
                    imageUrl={product.image}
                    alt={product.name}
                    className="w-full h-full"
                    iconClassName="w-6 h-6"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm truncate">{product.name}</h3>
                  <DualUnitDisplayCompact
                    totalPieces={product.quantity}
                    conversionFactor={product.conversionFactor || 1}
                    bulkUnit={product.bulkUnit}
                    smallUnit={product.smallUnit}
                  />
                </div>
                <p className="text-primary font-bold text-base flex-shrink-0">${product.price}</p>
              </button>
            ))}
          </div>
        )}

        {/* Compact View (no images) */}
        {viewMode === 'compact' && (
          <div className="space-y-1">
            {filteredProducts.map((product, index) => (
              <button
                key={product.id}
                {...pressHandlers(product)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border border-border/70 bg-card shadow-sm hover:bg-muted/40 hover:shadow-md transition-all text-right fade-in"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground text-sm truncate">{product.name}</h3>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <DualUnitDisplayCompact
                    totalPieces={product.quantity}
                    conversionFactor={product.conversionFactor || 1}
                    bulkUnit={product.bulkUnit}
                    smallUnit={product.smallUnit}
                  />
                  <p className="text-primary font-bold text-sm">${product.price}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Package className="w-12 h-12 mb-2 opacity-50" />
            <p>{t('pos.noProducts')}</p>
          </div>
        )}
      </div>

      <BarcodeScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleBarcodeScan} />
      <ProductDetailsDialog
        product={selectedProduct}
        isOpen={detailsDialogOpen}
        onClose={() => { setDetailsDialogOpen(false); setSelectedProduct(null); }}
        onAddToCart={(prod, quantity) => {
          for (let i = 0; i < quantity; i++) {
            onProductClick(prod);
          }
        }}
      />
    </div>
  );
}
