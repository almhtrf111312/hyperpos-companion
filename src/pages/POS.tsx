import { useState, useEffect, useMemo, useRef } from 'react';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { POSHeader } from '@/components/pos/POSHeader';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { MaintenancePanel } from '@/components/pos/MaintenancePanel';
import { ScannedProductDialog } from '@/components/pos/ScannedProductDialog';
import { Sidebar } from '@/components/layout/Sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProductsForPOS, POSProduct, getProductByBarcode } from '@/lib/products-store';
import { getCategoryNames } from '@/lib/categories-store';
import { showToast } from '@/lib/toast-config';
import { EVENTS } from '@/lib/events';
import { usePOSShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { playAddToCart } from '@/lib/sound-utils';

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

const loadExchangeRates = () => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { TRY: 32, SYP: 14500 };
    const parsed = JSON.parse(raw);
    const ex = parsed?.exchangeRates;
    const TRY = Number(ex?.TRY ?? 32);
    const SYP = Number(ex?.SYP ?? 14500);
    return {
      TRY: Number.isFinite(TRY) && TRY > 0 ? TRY : 32,
      SYP: Number.isFinite(SYP) && SYP > 0 ? SYP : 14500,
    };
  } catch {
    return { TRY: 32, SYP: 14500 };
  }
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

type Currency = { code: 'USD' | 'TRY' | 'SYP'; symbol: string; name: string; rate: number };

export default function POS() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'products' | 'maintenance'>('products');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);

  // Scanned product dialog
  const [scannedProduct, setScannedProduct] = useState<POSProduct | null>(null);
  const [showScannedDialog, setShowScannedDialog] = useState(false);

  // Load products and categories from shared stores
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(['الكل']);

  // Reload data when component mounts or when returning to this page
  useEffect(() => {
    const loadData = () => {
      setProducts(getProductsForPOS());
      setCategories(['الكل', ...getCategoryNames()]);
    };
    
    loadData();

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes('hyperpos')) {
        loadData();
      }
    };

    const onProductsUpdated = () => loadData();
    const onCategoriesUpdated = () => loadData();

    window.addEventListener('storage', handleStorage);
    window.addEventListener(EVENTS.PRODUCTS_UPDATED, onProductsUpdated as EventListener);
    window.addEventListener(EVENTS.CATEGORIES_UPDATED, onCategoriesUpdated as EventListener);
    window.addEventListener('productsUpdated', onProductsUpdated as EventListener);
    window.addEventListener('categoriesUpdated', onCategoriesUpdated as EventListener);

    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, onProductsUpdated as EventListener);
      window.removeEventListener(EVENTS.CATEGORIES_UPDATED, onCategoriesUpdated as EventListener);
      window.removeEventListener('productsUpdated', onProductsUpdated as EventListener);
      window.removeEventListener('categoriesUpdated', onCategoriesUpdated as EventListener);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const currencies: Currency[] = useMemo(() => {
    const rates = loadExchangeRates();
    return [
      { code: 'USD', symbol: '$', name: 'دولار أمريكي', rate: 1 },
      { code: 'TRY', symbol: '₺', name: 'ليرة تركية', rate: rates.TRY },
      { code: 'SYP', symbol: 'ل.س', name: 'ليرة سورية', rate: rates.SYP },
    ];
  }, []);

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => currencies[0]);
  const [customerName, setCustomerName] = useState('');

  const addToCart = (product: POSProduct) => {
    if (product.quantity === 0) {
      showToast.warning(`تنبيه: المنتج "${product.name}" نفذ من المخزون!`, 'تم إضافته للسلة رغم ذلك');
    } else if (product.quantity <= 5) {
      showToast.info(`تنبيه: كمية "${product.name}" منخفضة (${product.quantity} فقط)`);
    }
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
    
    // Play sound effect
    playAddToCart();
    showToast.success(`تمت إضافة "${product.name}" إلى السلة`);
  };

  // Handle barcode scan - show product dialog instead of adding directly
  const handleBarcodeScan = (barcode: string) => {
    const product = getProductByBarcode(barcode);
    
    if (product) {
      setScannedProduct(product);
      setShowScannedDialog(true);
    } else {
      setSearchQuery(barcode);
      showToast.info(`الباركود: ${barcode}`, 'لم يتم العثور على منتج بهذا الباركود');
    }
  };

  const handleAddScannedProduct = (product: POSProduct) => {
    addToCart(product);
    setShowScannedDialog(false);
    setScannedProduct(null);
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + change);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomerName('');
  };

  // Keyboard shortcuts for POS (desktop only)
  const [scannerTrigger, setScannerTrigger] = useState(0);
  
  usePOSShortcuts({
    onCashSale: () => {
      if (cart.length > 0) {
        showToast.info('اضغط F1 لتأكيد البيع النقدي', 'استخدم زر البيع النقدي في السلة');
      }
    },
    onDebtSale: () => {
      if (cart.length > 0 && customerName) {
        showToast.info('اضغط F2 لتأكيد البيع بالدين', 'استخدم زر الدين في السلة');
      } else if (!customerName) {
        showToast.warning('يجب إدخال اسم العميل أولاً');
      }
    },
    onClearCart: () => {
      if (cart.length > 0) {
        clearCart();
        showToast.success('تم مسح السلة');
      }
    },
    onToggleMode: () => {
      setActiveMode(prev => prev === 'products' ? 'maintenance' : 'products');
      showToast.info(activeMode === 'products' ? 'تم التبديل إلى الصيانة' : 'تم التبديل إلى المنتجات');
    },
    enabled: !isMobile,
  });

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar - Hidden on tablet for more product space */}
      {!isTablet && (
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <POSHeader
          onMenuClick={() => setSidebarOpen(true)}
          onCartClick={() => setCartOpen(true)}
          cartItemsCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        />

        {/* Mode Tabs - Mobile Only */}
        {isMobile && (
          <div className="px-3 py-2 border-b border-border bg-card">
            <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'products' | 'maintenance')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="products" className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  المنتجات
                </TabsTrigger>
                <TabsTrigger value="maintenance" className="flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  الصيانة
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Products/Maintenance Area */}
          <div className={cn(
            "flex-1 overflow-hidden",
            !isMobile && "border-l border-border"
          )}>
            {activeMode === 'products' ? (
              <ProductGrid
                products={products}
                categories={categories}
                searchQuery={searchQuery}
                selectedCategory={selectedCategory}
                onSearchChange={setSearchQuery}
                onCategoryChange={setSelectedCategory}
                onProductClick={addToCart}
                onBarcodeScan={handleBarcodeScan}
              />
            ) : (
              <MaintenancePanel
                currencies={currencies}
                selectedCurrency={selectedCurrency}
                onCurrencyChange={setSelectedCurrency}
              />
            )}
          </div>

          {/* Cart Panel - Desktop */}
          {!isMobile && (
            <div className="w-96 flex-shrink-0">
              <CartPanel
                cart={cart}
                currencies={currencies}
                selectedCurrency={selectedCurrency}
                discount={discount}
                customerName={customerName}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeItem}
                onClearCart={clearCart}
                onCurrencyChange={setSelectedCurrency}
                onDiscountChange={setDiscount}
                onCustomerNameChange={setCustomerName}
              />
            </div>
          )}
        </div>
      </div>

      {/* Cart Sheet - Mobile */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <CartPanel
            cart={cart}
            currencies={currencies}
            selectedCurrency={selectedCurrency}
            discount={discount}
            customerName={customerName}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
            onCurrencyChange={setSelectedCurrency}
            onDiscountChange={setDiscount}
            onCustomerNameChange={setCustomerName}
            onClose={() => setCartOpen(false)}
            isMobile
          />
        </SheetContent>
      </Sheet>

      {/* Scanned Product Dialog */}
      <ScannedProductDialog
        product={scannedProduct}
        isOpen={showScannedDialog}
        onClose={() => {
          setShowScannedDialog(false);
          setScannedProduct(null);
        }}
        onAddToCart={handleAddScannedProduct}
      />
    </div>
  );
}