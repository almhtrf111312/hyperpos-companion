import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { loadProductsCloud, getProductByBarcodeCloud, Product } from '@/lib/cloud/products-cloud';
import { getCategoryNamesCloud } from '@/lib/cloud/categories-cloud';
import { showToast } from '@/lib/toast-config';
import { EVENTS } from '@/lib/events';
import { usePOSShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { playAddToCart } from '@/lib/sound-utils';
import { useLanguage } from '@/hooks/use-language';

// POS Product type for display
interface POSProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  image?: string;
  barcode?: string;
}

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
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'products' | 'maintenance'>('products');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(t('common.all'));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  
  // Load products and categories from cloud
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(['الكل']);

  // Scanned product dialog
  const [scannedProduct, setScannedProduct] = useState<POSProduct | null>(null);
  const [showScannedDialog, setShowScannedDialog] = useState(false);

  // Load products and categories from cloud
  const loadData = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const [cloudProducts, cloudCategories] = await Promise.all([
        loadProductsCloud(),
        getCategoryNamesCloud()
      ]);
      
      // Transform to POS format
      const posProducts: POSProduct[] = cloudProducts.map(p => ({
        id: p.id,
        name: p.name,
        price: p.salePrice,
        category: p.category,
        quantity: p.quantity,
        image: p.image,
        barcode: p.barcode,
      }));
      
      setProducts(posProducts);
      setCategories([t('common.all'), ...cloudCategories]);
    } catch (error) {
      console.error('Error loading POS data:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [t]);

  // Reload data when component mounts or when returning to this page
  useEffect(() => {
    loadData();

    const onProductsUpdated = () => loadData();
    const onCategoriesUpdated = () => loadData();

    window.addEventListener(EVENTS.PRODUCTS_UPDATED, onProductsUpdated as EventListener);
    window.addEventListener(EVENTS.CATEGORIES_UPDATED, onCategoriesUpdated as EventListener);
    window.addEventListener('focus', loadData);

    return () => {
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, onProductsUpdated as EventListener);
      window.removeEventListener(EVENTS.CATEGORIES_UPDATED, onCategoriesUpdated as EventListener);
      window.removeEventListener('focus', loadData);
    };
  }, [loadData]);

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
      showToast.warning(t('pos.outOfStock').replace('{name}', product.name));
    } else if (product.quantity <= 5) {
      showToast.info(t('pos.lowStockWarning').replace('{name}', product.name).replace('{qty}', String(product.quantity)));
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
    showToast.success(t('pos.addedToCart').replace('{name}', product.name));
  };

  // Handle barcode scan - show product dialog instead of adding directly
  const handleBarcodeScan = async (barcode: string) => {
    const cloudProduct = await getProductByBarcodeCloud(barcode);
    
    if (cloudProduct) {
      const posProduct: POSProduct = {
        id: cloudProduct.id,
        name: cloudProduct.name,
        price: cloudProduct.salePrice,
        category: cloudProduct.category,
        quantity: cloudProduct.quantity,
        image: cloudProduct.image,
        barcode: cloudProduct.barcode,
      };
      setScannedProduct(posProduct);
      setShowScannedDialog(true);
    } else {
      setSearchQuery(barcode);
      showToast.info(`${t('pos.barcode')}: ${barcode}`, t('pos.barcodeNotFound'));
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
        showToast.info(t('pos.cashSaleShortcut'));
      }
    },
    onDebtSale: () => {
      if (cart.length > 0 && customerName) {
        showToast.info(t('pos.debtSaleShortcut'));
      } else if (!customerName) {
        showToast.warning(t('pos.enterCustomerName'));
      }
    },
    onClearCart: () => {
      if (cart.length > 0) {
        clearCart();
        showToast.success(t('pos.cartCleared'));
      }
    },
    onToggleMode: () => {
      setActiveMode(prev => prev === 'products' ? 'maintenance' : 'products');
      showToast.info(activeMode === 'products' ? t('pos.switchedToMaintenance') : t('pos.switchedToProducts'));
    },
    enabled: !isMobile,
  });

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Always visible, collapsed by default on non-mobile */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
        defaultCollapsed={!isMobile}
      />
      
      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300",
        // Account for collapsed sidebar width based on RTL
        !isMobile && (document.documentElement.dir === 'rtl' ? "md:mr-20" : "md:ml-20")
      )}>
        {/* Header */}
        <POSHeader
          onMenuClick={() => setSidebarOpen(true)}
          onCartClick={() => setCartOpen(true)}
          cartItemsCount={cartItemsCount}
          showCartButton={false}
        />

        {/* Mode Tabs - Mobile Only */}
        {isMobile && (
          <div className="px-3 py-2 border-b border-border bg-card">
            <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'products' | 'maintenance')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="products" className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  {t('pos.products')}
                </TabsTrigger>
                <TabsTrigger value="maintenance" className="flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  {t('pos.maintenance')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Products/Maintenance Area */}
          <div className={cn(
            "flex-1 flex flex-col h-full overflow-hidden",
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

          {/* Cart Panel - Desktop Only (not tablet) */}
          {!isMobile && !isTablet && (
            <div className="w-80 flex-shrink-0">
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

      {/* Floating Cart Button - Mobile & Tablet */}
      {(isMobile || isTablet) && (
        <Button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 
                     w-16 h-16 rounded-full 
                     shadow-lg shadow-primary/30
                     flex items-center justify-center
                     hover:scale-105 active:scale-95
                     transition-all duration-200"
          size="icon"
        >
          <ShoppingCart className="w-7 h-7" />
          {cartItemsCount > 0 && (
            <span className="absolute -top-1 -right-1 
                           w-6 h-6 rounded-full 
                           bg-destructive text-destructive-foreground 
                           text-sm font-bold 
                           flex items-center justify-center
                           border-2 border-background
                           animate-pulse">
              {cartItemsCount}
            </span>
          )}
        </Button>
      )}
    </div>
  );
}