import { useState, useEffect, useMemo, useCallback } from 'react';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { POSHeader } from '@/components/pos/POSHeader';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { MaintenancePanel } from '@/components/pos/MaintenancePanel';
import { ScannedProductDialog } from '@/components/pos/ScannedProductDialog';
import { VariantPickerDialog } from '@/components/pos/VariantPickerDialog';
import { LoanQuickDialog } from '@/components/pos/LoanQuickDialog';
import { Sidebar, MobileMenuTrigger } from '@/components/layout/Sidebar';
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
import { getCurrentStoreType } from '@/lib/store-type-config';
import { playAddToCart } from '@/lib/sound-utils';
import { useLanguage } from '@/hooks/use-language';
import { useWarehouse } from '@/hooks/use-warehouse';
import { useAuth } from '@/hooks/use-auth';
import { App } from '@capacitor/app';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
// POS Product type for display
interface POSProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  image?: string;
  barcode?: string;
  barcode2?: string;
  barcode3?: string;
  variantLabel?: string;
  // Multi-unit support
  bulkUnit?: string;
  smallUnit?: string;
  conversionFactor?: number;
  bulkSalePrice?: number;
  costPrice?: number;
  bulkCostPrice?: number;
  wholesalePrice?: number;
  laborCost?: number;  // تكلفة العمالة (وضع ورشة الصيانة)
  // Pharmacy fields
  expiryDate?: string;
  batchNumber?: string;
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
  laborCost?: number;
}

type Currency = { code: 'USD' | 'TRY' | 'SYP'; symbol: string; name: string; rate: number };

// Keys for persistence across app background/foreground cycles
const CART_STORAGE_KEY = 'hyperpos_temp_cart';
const CART_OPEN_KEY = 'hyperpos_cart_open';
const PENDING_BARCODE_KEY = 'hyperpos_pending_scan';
// Note: PENDING_BARCODE_KEY is also exported from OfflineBarcodeScanner for consistency

export default function POS() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { t, tDynamic } = useLanguage();
  const { profile } = useAuth();
  const { activeWarehouse, isLoading: isWarehouseLoading } = useWarehouse();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ✅ استعادة حالة السلة المفتوحة عند العودة للتطبيق
  const [cartOpen, setCartOpen] = useState(() => {
    try { return localStorage.getItem(CART_OPEN_KEY) === '1'; } catch { return false; }
  });

  const [activeMode, setActiveMode] = useState<'products' | 'maintenance'>('products');
  const hideMaintenanceSection = loadHideMaintenanceSetting();

  // ✅ استعادة الباركود المعلق من الماسح الأصلي عند إعادة التشغيل أو العودة
  const [pendingScan, setPendingScan] = useState<string | null>(() => {
    try {
      const barcode = localStorage.getItem(PENDING_BARCODE_KEY);
      if (barcode) {
        console.log('[POS] Found pending barcode on mount (Activity Recreation):', barcode);
        return barcode;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(t('common.all'));
  const [cart, setCart] = useState<CartItem[]>([]);

  // حفظ السلة
  const saveCart = useCallback(() => {
    if (cart.length > 0) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      console.log('[POS] Cart saved:', cart.length, 'items');
    }
  }, [cart]);

  // استعادة السلة - فقط إذا كانت السلة فارغة حالياً
  const restoreCart = useCallback(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const items = JSON.parse(saved);
        if (Array.isArray(items) && items.length > 0) {
          setCart(prev => {
            if (prev.length > 0) {
              console.log('[POS] Cart already has items, skipping restore');
              localStorage.removeItem(CART_STORAGE_KEY);
              return prev;
            }
            showToast.success(`تم استعادة ${items.length} منتج`);
            console.log('[POS] Cart restored:', items.length, 'items');
            return items;
          });
        }
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch (e) {
      console.error('[POS] Failed to restore cart:', e);
    }
  }, []);

  // ✅ حفظ حالة فتح السلة في localStorage لاستعادتها عند العودة
  const handleSetCartOpen = useCallback((open: boolean) => {
    setCartOpen(open);
    try { localStorage.setItem(CART_OPEN_KEY, open ? '1' : '0'); } catch { }
  }, []);

  // تم إزالة useEffect القديم الذي كان يمسح الباركود المعلق فقط دون معالجته

  // مستمع حالة التطبيق (APK)
  useEffect(() => {
    let appListener: { remove: () => void } | null = null;

    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        // حفظ السلة عند الخروج
        if (cart.length > 0) {
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
          console.log('[POS] App going background, saved cart:', cart.length);
        }
        // ✅ حفظ حالة السلة المفتوحة عند الخروج
        localStorage.setItem(CART_OPEN_KEY, cartOpen ? '1' : '0');
      } else {
        // استعادة عند العودة
        restoreCart();
        // ✅ استعادة الباركود المعلق عند العودة من ماسح الباركود
        try {
          const pending = localStorage.getItem(PENDING_BARCODE_KEY);
          if (pending) {
            console.log('[POS] Restoring pending barcode scan on resume:', pending);
            setPendingScan(pending);
            // DON'T clear from localStorage here - let handleBarcodeScan clear it after successful processing
          }
        } catch { }
        // ✅ استعادة حالة السلة المفتوحة
        try {
          const wasOpen = localStorage.getItem(CART_OPEN_KEY) === '1';
          if (wasOpen) {
            setCartOpen(true);
          }
        } catch { }
      }
    }).then(listener => {
      appListener = listener;
    }).catch(() => {
      // Not native - use beforeunload
      window.addEventListener('beforeunload', saveCart);
    });

    // ✅ Listen for barcode-restored event (from App.tsx appRestoredResult)
    const handleBarcodeRestored = (e: Event) => {
      const barcode = (e as CustomEvent).detail;
      if (barcode && typeof barcode === 'string') {
        console.log('[POS] Received barcode-restored event:', barcode);
        setPendingScan(barcode);
      }
    };
    window.addEventListener('barcode-restored', handleBarcodeRestored);

    return () => {
      if (appListener) appListener.remove();
      window.removeEventListener('beforeunload', saveCart);
      window.removeEventListener('barcode-restored', handleBarcodeRestored);
    };
  }, [cart, cartOpen, saveCart, restoreCart]);

  const [discount, setDiscount] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Load products and categories from cloud
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([t('common.all')]);

  // Scanned product dialog
  const [scannedProduct, setScannedProduct] = useState<POSProduct | null>(null);
  const [showScannedDialog, setShowScannedDialog] = useState(false);
  // Variant picker dialog (multiple products with same barcode)
  const [variantMatches, setVariantMatches] = useState<POSProduct[]>([]);
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  // Loan dialog for bookstore mode
  const [showLoanDialog, setShowLoanDialog] = useState(false);
  const [loanProduct, setLoanProduct] = useState<POSProduct | null>(null);

  // Load products and categories from cloud with retry logic
  // ✅ تحميل فوري من IndexedDB ثم تحديث من السحابة في الخلفية
  const loadData = useCallback(async (retryCount = 0, isBackgroundRefresh = false) => {
    // ✅ انتظار تحميل الـ profile أولاً
    if (profile === undefined) {
      console.log('[POS] Profile not loaded yet, waiting...');
      return;
    }

    // فقط عرض Loading في المرة الأولى (ليس عند التحديث الخلفي)
    if (!isBackgroundRefresh) {
      setIsLoadingProducts(true);
    }

    // ❌ لا نمسح الكاش هنا - نتركه يخدم المنتجات فوراً
    // invalidateProductsCache(); -- تم إزالته لتحميل فوري

    try {
      const [cloudProducts, cloudCategories] = await Promise.all([
        loadProductsCloud(),
        getCategoryNamesCloud()
      ]);

      // إذا لم تُرجع المنتجات وعدد المحاولات أقل من 3، أعد المحاولة
      if (cloudProducts.length === 0 && retryCount < 3) {
        console.log(`[POS] No products returned, retrying (${retryCount + 1}/3)...`);
        setTimeout(() => loadData(retryCount + 1, isBackgroundRefresh), 1000);
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
        barcode2: p.barcode2,
        barcode3: p.barcode3,
        variantLabel: p.variantLabel,
        bulkUnit: p.bulkUnit || t('products.unitCarton'),
        smallUnit: p.smallUnit || t('products.unitPiece'),
        conversionFactor: p.conversionFactor || 1,
        bulkSalePrice: p.bulkSalePrice || 0,
        costPrice: p.costPrice,
        bulkCostPrice: p.bulkCostPrice || 0,
        wholesalePrice: p.wholesalePrice,
        laborCost: p.laborCost || 0,
        // Pharmacy fields
        expiryDate: p.expiryDate,
        batchNumber: p.batchNumber,
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
        setTimeout(() => loadData(retryCount + 1, isBackgroundRefresh), 1500);
        return;
      }
    } finally {
      setIsLoadingProducts(false);
    }
  }, [t, activeWarehouse, profile]);

  // Reload data when component mounts or when returning to this page
  useEffect(() => {
    loadData();

    // التحديثات اللاحقة تكون في الخلفية (بدون شاشة تحميل)
    const onProductsUpdated = () => loadData(0, true);
    const onCategoriesUpdated = () => loadData(0, true);
    const onFocus = () => loadData(0, true);

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
      return; // Don't add out-of-stock items
    }

    // Pharmacy: warn about expired products (block add)
    if (product.expiryDate) {
      const expiry = new Date(product.expiryDate);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 0) {
        showToast.error(`⚠️ ${product.name} - منتهي الصلاحية!`);
        return;
      }
    }

    const priceForUnit = unit === 'bulk' && product.bulkSalePrice ? product.bulkSalePrice : product.price;

    setCart(prev => {
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
        laborCost: product.laborCost,
        expiryDate: product.expiryDate,
        batchNumber: product.batchNumber,
      }];
    });

    // Play sound effect
    playAddToCart();
    // Show only ONE toast per add action
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

    // ✅ Clear pending barcode since we're handling it now
    try { localStorage.removeItem(PENDING_BARCODE_KEY); } catch {}

    // 1. Try local products first (FAST) - search all 3 barcodes
    const matches = products.filter(p =>
      p.barcode === barcode || p.barcode2 === barcode || p.barcode3 === barcode
    );

    if (matches.length > 1) {
      setVariantMatches(matches);
      setShowVariantPicker(true);
      return;
    }

    if (matches.length === 1) {
      setSearchQuery(barcode);
      showToast.success(t('pos.productFound').replace('{name}', matches[0].name) || `Found: ${matches[0].name}`);
      return;
    }

    // 2. Try Cloud (Slow)
    try {
      const cloudProduct = await getProductByBarcodeCloud(barcode);
      if (cloudProduct) {
        setSearchQuery(barcode);
        showToast.success(t('pos.productFound').replace('{name}', cloudProduct.name) || `Found: ${cloudProduct.name}`);
      } else {
        setSearchQuery(barcode);
        showToast.info(`${t('pos.barcode')}: ${barcode}`, t('pos.barcodeNotFound'));
      }
    } catch (err) {
      console.error('Cloud lookup error:', err);
      setSearchQuery(barcode);
    }
  };

  // ✅ Process pending scan once products are loaded
  useEffect(() => {
    // If we have a pending scan, wait for products to NOT be loading
    if (pendingScan && !isLoadingProducts) {
      if (products.length > 0) {
        console.log('[POS] Processing pending scan after load:', pendingScan);
        handleBarcodeScan(pendingScan);
        setPendingScan(null); // Clear from state
        try { localStorage.removeItem(PENDING_BARCODE_KEY); } catch { }
      } else {
        // Edge case: no products loaded (empty db or offline). Try scanning anyway (it might look up in cloud)
        console.log('[POS] Processing pending scan (no local products):', pendingScan);
        handleBarcodeScan(pendingScan);
        setPendingScan(null); // Clear from state
        try { localStorage.removeItem(PENDING_BARCODE_KEY); } catch { }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScan, isLoadingProducts, products.length]);

  const handleAddScannedProduct = (product: POSProduct) => {
    addToCart(product, 'piece');
    setShowScannedDialog(false);
    setScannedProduct(null);
  };

  const handleLoanProduct = (product: POSProduct) => {
    setLoanProduct(product);
    setShowLoanDialog(true);
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

  // Update item price manually (for Boss/Admin discounts)
  const updateItemPrice = (id: string, newPrice: number, unit: 'piece' | 'bulk') => {
    if (newPrice < 0) return;
    setCart(prev => prev.map(item =>
      item.id === id && item.unit === unit
        ? { ...item, price: newPrice }
        : item
    ));
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
          onCartClick={() => handleSetCartOpen(true)}
          cartItemsCount={cartItemsCount}
          showCartButton={false}
        />

        {/* Mobile menu trigger - same as MainLayout */}
        {isMobile && !sidebarOpen && (
          <MobileMenuTrigger onClick={() => setSidebarOpen(true)} />
        )}

        {/* Mode Tabs - Mobile Only (hidden if maintenance section is hidden) */}
        {isMobile && !hideMaintenanceSection && (
          <div className="px-3 py-2.5 border-b border-border/70 bg-card/95 supports-[backdrop-filter]:bg-card/80 backdrop-blur-md">
            <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'products' | 'maintenance')}>
              <TabsList className="grid w-full grid-cols-2 h-12 rounded-2xl bg-muted/70 border border-border p-1">
                <TabsTrigger value="products" className="flex items-center gap-2 rounded-xl text-sm">
                  <ShoppingCart className="w-4 h-4" />
                  {tDynamic('products')}
                </TabsTrigger>
                <TabsTrigger value="maintenance" className="flex items-center gap-2 rounded-xl text-sm">
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
          <div data-tour="product-grid" className={cn(
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
            <div className="w-80 flex-shrink-0" data-tour="cart-panel">
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
                onUpdateItemPrice={updateItemPrice}
              />
            </div>
          )}
        </div>
      </div>

      {/* Cart Sheet - Mobile */}
      <Sheet open={cartOpen} onOpenChange={handleSetCartOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 [&>button]:hidden">
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
            onUpdateItemPrice={updateItemPrice}
            onClose={() => handleSetCartOpen(false)}
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
        onLoan={getCurrentStoreType() === 'bookstore' ? handleLoanProduct : undefined}
      />

      {/* Loan Quick Dialog for bookstore mode */}
      {loanProduct && (
        <LoanQuickDialog
          isOpen={showLoanDialog}
          onClose={() => {
            setShowLoanDialog(false);
            setLoanProduct(null);
          }}
          productId={loanProduct.id}
          productName={loanProduct.name}
          onLoanComplete={() => {
            loadData(0, true);
            setLoanProduct(null);
          }}
        />
      )}

      {/* Variant Picker Dialog */}
      <VariantPickerDialog
        isOpen={showVariantPicker}
        onClose={() => {
          setShowVariantPicker(false);
          setVariantMatches([]);
        }}
        products={variantMatches}
        onSelect={(product) => {
          addToCart(product, 'piece');
          setShowVariantPicker(false);
          setVariantMatches([]);
        }}
      />

      {/* Floating Cart Button - Mobile & Tablet */}
      {(isMobile || isTablet) && (
        <Button
          data-tour="cart-fab"
          onClick={() => handleSetCartOpen(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 
                     w-16 h-16 rounded-full 
                     bg-gradient-primary text-primary-foreground
                     shadow-lg shadow-primary/35 border border-primary/20
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

      {/* Onboarding Tour */}
      <OnboardingTour />
    </div>
  );
}