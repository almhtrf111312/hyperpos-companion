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
import { loadProductsCloud, getProductByBarcodeCloud, Product, invalidateProductsCache } from '@/lib/cloud/products-cloud';
import { getCategoryNamesCloud } from '@/lib/cloud/categories-cloud';
import { showToast } from '@/lib/toast-config';
import { EVENTS } from '@/lib/events';
import { usePOSShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { playAddToCart } from '@/lib/sound-utils';
import { useLanguage } from '@/hooks/use-language';
import { useWarehouse } from '@/hooks/use-warehouse';
import { useAuth } from '@/hooks/use-auth';
// POS Product type for display
interface POSProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  image?: string;
  barcode?: string;
  // Multi-unit support
  bulkUnit?: string;
  smallUnit?: string;
  conversionFactor?: number;
  bulkSalePrice?: number;
  costPrice?: number;
  bulkCostPrice?: number;
  wholesalePrice?: number;
}

const SETTINGS_STORAGE_KEY = 'hyperpos_settings_v1';

const loadHideMaintenanceSetting = (): boolean => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.hideMaintenanceSection ?? false;
  } catch {
    return false;
  }
};
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

const loadCurrencyNames = () => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { TRY: 'Turkish Lira', SYP: 'Syrian Pound' };
    const parsed = JSON.parse(raw);
    const names = parsed?.currencyNames;
    return {
      TRY: names?.TRY || 'Turkish Lira',
      SYP: names?.SYP || 'Syrian Pound',
    };
  } catch {
    return { TRY: 'Turkish Lira', SYP: 'Syrian Pound' };
  }
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  // Multi-unit support
  unit: 'piece' | 'bulk';
  bulkUnit?: string;
  smallUnit?: string;
  conversionFactor?: number;
  bulkSalePrice?: number;
  costPrice?: number;
  bulkCostPrice?: number;
}

type Currency = { code: 'USD' | 'TRY' | 'SYP'; symbol: string; name: string; rate: number };

export default function POS() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { activeWarehouse, isLoading: isWarehouseLoading } = useWarehouse();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'products' | 'maintenance'>('products');
  const hideMaintenanceSection = loadHideMaintenanceSetting();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(t('common.all'));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Load products and categories from cloud
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([t('common.all')]);

  // Scanned product dialog
  const [scannedProduct, setScannedProduct] = useState<POSProduct | null>(null);
  const [showScannedDialog, setShowScannedDialog] = useState(false);

  // Load products and categories from cloud with retry logic
  const loadData = useCallback(async (retryCount = 0) => {
    // ✅ انتظار تحميل الـ profile أولاً
    if (profile === undefined) {
      console.log('[POS] Profile not loaded yet, waiting...');
      return;
    }

    setIsLoadingProducts(true);

    // ✅ إبطال الـ Cache قبل التحميل لضمان الحصول على أحدث البيانات
    invalidateProductsCache();

    try {
      const [cloudProducts, cloudCategories] = await Promise.all([
        loadProductsCloud(),
        getCategoryNamesCloud()
      ]);

      // إذا لم تُرجع المنتجات وعدد المحاولات أقل من 3، أعد المحاولة
      if (cloudProducts.length === 0 && retryCount < 3) {
        console.log(`[POS] No products returned, retrying (${retryCount + 1}/3)...`);
        setTimeout(() => loadData(retryCount + 1), 1000);
        return;
      }

      // Transform to POS format with multi-unit support
      const allPosProducts: POSProduct[] = cloudProducts.map(p => ({
        id: p.id,
        name: p.name,
        price: p.salePrice,
        category: p.category,
        quantity: p.quantity, // Default quantity from products table
        image: p.image,
        barcode: p.barcode,
        bulkUnit: p.bulkUnit || t('products.unitCarton'),
        smallUnit: p.smallUnit || t('products.unitPiece'),
        conversionFactor: p.conversionFactor || 1,
        bulkSalePrice: p.bulkSalePrice || 0,
        costPrice: p.costPrice,
        bulkCostPrice: p.bulkCostPrice || 0,
        wholesalePrice: p.wholesalePrice,
      }));

      // ✅ تحديد نوع المستخدم من الـ profile - الافتراضي هو كاشير (يرى كل شيء)
      const userType = profile?.user_type || 'cashier';

      console.log(`[POS] User type from profile: ${userType}, profile:`, profile);

      // ✅ الكاشير: يرى جميع المنتجات (يعمل في المحل مباشرة)
      // ✅ الموزع / نقطة البيع: يرى فقط المنتجات في عهدته (المستودع المخصص)
      if ((userType === 'distributor' || userType === 'pos') && activeWarehouse) {
        // جلب مخزون المستودع المُعيّن
        const { loadWarehouseStockCloud } = await import('@/lib/cloud/warehouses-cloud');
        const warehouseStock = await loadWarehouseStockCloud(activeWarehouse.id);

        console.log(`[POS] ${userType} user, warehouse: ${activeWarehouse.name}, stock items:`, warehouseStock.length);

        // فلترة المنتجات حسب المخزون المتاح في المستودع
        const filteredProducts = allPosProducts
          .map(p => {
            const stockItem = warehouseStock.find(s => s.product_id === p.id);
            if (stockItem && stockItem.quantity > 0) {
              return { ...p, quantity: stockItem.quantity };
            }
            return null;
          })
          .filter((p): p is POSProduct => p !== null);

        console.log(`[POS] Filtered products for ${userType}:`, filteredProducts.length);
        setProducts(filteredProducts);
      } else {
        // ✅ الكاشير والإدارة: عرض كل المنتجات (الوصول الكامل)
        console.log(`[POS] Cashier/Admin user (type: ${userType}), showing ALL products:`, allPosProducts.length);
        setProducts(allPosProducts);
      }

      setCategories([t('common.all'), ...cloudCategories]);
    } catch (error) {
      console.error('Error loading POS data:', error);

      // إعادة المحاولة في حالة الخطأ
      if (retryCount < 3) {
        console.log(`[POS] Error loading, retrying (${retryCount + 1}/3)...`);
        setTimeout(() => loadData(retryCount + 1), 1500);
        return;
      }
    } finally {
      setIsLoadingProducts(false);
    }
  }, [t, activeWarehouse, profile]);

  // Reload data when component mounts or when returning to this page
  useEffect(() => {
    loadData();

    const onProductsUpdated = () => loadData();
    const onCategoriesUpdated = () => loadData();
    const onFocus = () => loadData();

    window.addEventListener(EVENTS.PRODUCTS_UPDATED, onProductsUpdated as EventListener);
    window.addEventListener(EVENTS.CATEGORIES_UPDATED, onCategoriesUpdated as EventListener);
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, onProductsUpdated as EventListener);
      window.removeEventListener(EVENTS.CATEGORIES_UPDATED, onCategoriesUpdated as EventListener);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadData]);

  const currencies: Currency[] = useMemo(() => {
    const rates = loadExchangeRates();
    const names = loadCurrencyNames();
    return [
      { code: 'USD', symbol: '$', name: t('currency.usd'), rate: 1 },
      { code: 'TRY', symbol: '₺', name: names.TRY, rate: rates.TRY },
      { code: 'SYP', symbol: 'ل.س', name: names.SYP, rate: rates.SYP },
    ];
  }, []);

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => currencies[0]);
  const [customerName, setCustomerName] = useState('');

  const addToCart = (product: POSProduct, unit: 'piece' | 'bulk' = 'piece') => {
    if (product.quantity === 0) {
      showToast.warning(t('pos.outOfStock').replace('{name}', product.name));
    } else if (product.quantity <= 5) {
      showToast.info(t('pos.lowStockWarning').replace('{name}', product.name).replace('{qty}', String(product.quantity)));
    }

    const priceForUnit = unit === 'bulk' && product.bulkSalePrice ? product.bulkSalePrice : product.price;

    setCart(prev => {
      // Check for existing item with same unit
      const existing = prev.find(item => item.id === product.id && item.unit === unit);
      if (existing) {
        return prev.map(item =>
          item.id === product.id && item.unit === unit
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: priceForUnit,
        quantity: 1,
        unit,
        bulkUnit: product.bulkUnit,
        smallUnit: product.smallUnit,
        conversionFactor: product.conversionFactor,
        bulkSalePrice: product.bulkSalePrice,
        costPrice: product.costPrice,
        bulkCostPrice: product.bulkCostPrice,
        wholesalePrice: product.wholesalePrice,
      }];
    });

    // Play sound effect
    playAddToCart();
    const unitLabel = unit === 'bulk' ? (product.bulkUnit || t('products.unitCarton')) : (product.smallUnit || t('products.unitPiece'));
    showToast.success(t('pos.addedToCart').replace('{name}', `${product.name} (${unitLabel})`));
  };

  // Toggle unit for cart item
  const toggleCartItemUnit = (itemId: string, currentUnit: 'piece' | 'bulk') => {
    const product = products.find(p => p.id === itemId);
    if (!product) return;

    // Don't toggle if no bulk pricing
    if (!product.bulkSalePrice || product.bulkSalePrice <= 0) {
      showToast.warning(t('pos.noWholesalePrice'));
      return;
    }

    const newUnit = currentUnit === 'piece' ? 'bulk' : 'piece';
    const newPrice = newUnit === 'bulk' ? product.bulkSalePrice : product.price;

    setCart(prev => prev.map(item =>
      item.id === itemId && item.unit === currentUnit
        ? { ...item, unit: newUnit, price: newPrice }
        : item
    ));
  };

  // Handle barcode scan
  const handleBarcodeScan = async (barcode: string) => {
    console.log('[POS] Scanned:', barcode);

    // 1. Try local products first (FAST)
    const localProduct = products.find(p => p.barcode === barcode);
    if (localProduct) {
      // ✅ Show product in grid instead of auto-adding
      setSearchQuery(barcode);
      showToast.success(t('pos.productFound').replace('{name}', localProduct.name) || `Found: ${localProduct.name}`);
      return;
    }

    // 2. Try Cloud (Slow)
    try {
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
          bulkUnit: cloudProduct.bulkUnit || 'carton',
          smallUnit: cloudProduct.smallUnit || 'piece',
          conversionFactor: cloudProduct.conversionFactor || 1,
          bulkSalePrice: cloudProduct.bulkSalePrice || 0,
          costPrice: cloudProduct.costPrice,
          bulkCostPrice: cloudProduct.bulkCostPrice || 0,
          wholesalePrice: cloudProduct.wholesalePrice,
        };
        // Add directly or show dialog? Logic was show dialog.
        // User wants "Add to Cart / Fill Input". 
        // Let's stick to existing logic but ensure it runs.
        setScannedProduct(posProduct);
        setShowScannedDialog(true);
      } else {
        setSearchQuery(barcode);
        showToast.info(`${t('pos.barcode')}: ${barcode}`, t('pos.barcodeNotFound'));
      }
    } catch (err) {
      console.error('Cloud lookup error:', err);
      setSearchQuery(barcode);
    }
  };

  const handleAddScannedProduct = (product: POSProduct) => {
    addToCart(product, 'piece');
    setShowScannedDialog(false);
    setScannedProduct(null);
  };

  const updateQuantity = (id: string, change: number, unit?: 'piece' | 'bulk') => {
    setCart(prev => prev.map(item => {
      // Match by id and unit (if provided)
      if (item.id === id && (unit === undefined || item.unit === unit)) {
        const newQty = Math.max(1, item.quantity + change);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (id: string, unit?: 'piece' | 'bulk') => {
    setCart(prev => prev.filter(item => !(item.id === id && (unit === undefined || item.unit === unit))));
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

        {/* Mode Tabs - Mobile Only (hidden if maintenance section is hidden) */}
        {isMobile && !hideMaintenanceSection && (
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
            {activeMode === 'products' || hideMaintenanceSection ? (
              <ProductGrid
                products={products}
                categories={categories}
                searchQuery={searchQuery}
                selectedCategory={selectedCategory}
                onSearchChange={setSearchQuery}
                onCategoryChange={setSelectedCategory}
                onProductClick={(product) => addToCart(product, 'piece')}
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
                onToggleUnit={toggleCartItemUnit}
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
            onToggleUnit={toggleCartItemUnit}
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
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 
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