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
import { getCurrentStoreType } from '@/lib/store-type-config';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  image?: string;
  barcode?: string;
  conversionFactor?: number;
  bulkUnit?: string;
  smallUnit?: string;
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
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { t, tDynamic } = useLanguage();
  const isRestaurant = getCurrentStoreType() === 'restaurant';

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('pos_view_mode') as ViewMode) || 'grid';
  });

  useEffect(() => {
    localStorage.setItem('pos_view_mode', viewMode);
  }, [viewMode]);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.barcode && product.barcode.includes(searchQuery));
    const matchesCategory = selectedCategory === t('common.all') || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleBarcodeScan = (barcode: string) => {
    setScannerOpen(false);
    onSearchChange(barcode);
    toast.success(`${t('pos.barcode')}: ${barcode}`);
  };

  const touchMovedRef = useRef(false);

  const handleLongPressStart = (product: Product) => {
    touchMovedRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        setSelectedProduct(product);
        setDetailsDialogOpen(true);
        if (navigator.vibrate) navigator.vibrate(50);
      }
    }, 1000);
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
      <div data-tour="search-bar" className="p-3 md:p-4 border-b border-border space-y-3">
        <div className="flex gap-2">
          {/* View Mode Buttons - moved to left */}
          <div className="flex border rounded-lg overflow-hidden flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 md:p-2.5 transition-colors",
                viewMode === 'grid' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              title={t('pos.viewGrid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 md:p-2.5 transition-colors",
                viewMode === 'list' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              title={t('pos.viewList')}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={cn(
                "p-2 md:p-2.5 transition-colors",
                viewMode === 'compact' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              title={t('pos.viewCompact')}
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={tDynamic('productSearch')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pr-9 md:pr-10 h-10 md:h-12 bg-muted border-0 text-sm md:text-base"
            />
          </div>

          {!isRestaurant && (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0"
              onClick={() => setScannerOpen(true)}
            >
              <Barcode className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 md:mx-0 md:px-0">
          {categories.map((category, index) => (
            <button
              key={`${category}-${index}`}
              onClick={() => onCategoryChange(category)}
              className={cn(
                "px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
                selectedCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
            {filteredProducts.map((product, index) => (
              <button
                key={product.id}
                {...pressHandlers(product)}
                className="pos-item text-right fade-in p-2.5 md:p-4"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="w-full aspect-square rounded-lg bg-muted/50 flex items-center justify-center mb-2 md:mb-3 overflow-hidden">
                  <ProductImage
                    imageUrl={product.image}
                    alt={product.name}
                    className="w-full h-full"
                    iconClassName="w-8 h-8 md:w-12 md:h-12"
                  />
                </div>
                <h3 className="font-semibold text-foreground text-xs md:text-sm line-clamp-2 mb-1">{product.name}</h3>
                <p className="text-primary font-bold text-sm md:text-base">${product.price}</p>
                <div className="mt-0.5 md:mt-1">
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
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-right fade-in"
                style={{ animationDelay: `${index * 20}ms` }}
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
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-right fade-in"
                style={{ animationDelay: `${index * 15}ms` }}
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
      />
    </div>
  );
}
