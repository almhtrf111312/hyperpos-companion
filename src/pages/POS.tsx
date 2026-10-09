import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { loadProductsCloud, loadProductsLocalFirst, getProductByBarcodeCloud, Product, invalidateProductsCache } from '@/lib/cloud/products-cloud';
import { getCategoryNamesCloud } from '@/lib/cloud/categories-cloud';
import { showToast } from '@/lib/toast-config';
import { EVENTS } from '@/lib/events';
import { usePOSShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { getCurrentStoreType, isNoInventoryMode } from '@/lib/store-type-config';
import { playAddToCart } from '@/lib/sound-utils';
import { useLanguage } from '@/hooks/use-language';
import { useWarehouse } from '@/hooks/use-warehouse';
import { useAuth } from '@/hooks/use-auth';
import { App } from '@capacitor/app';
// OnboardingTour mounted globally in App.tsx
// POS Product type for display
interface POSProduct {
  id: string;
  name: string;
  price: number;
  category?: string;
  quantity: number;
  image?: string;
  barcode?: string;
  barcode2?: string;
  barcode3?: string;
  variantLabel?: string;
  archived?: boolean;
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

type BarcodeScanMode = 'search' | 'add';

const loadBarcodeScanMode = (): BarcodeScanMode => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return 'search';
    return JSON.parse(raw)?.barcodeScanMode === 'add' ? 'add' : 'search';
  } catch {
    return 'search';
  }
};

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

const loadDefaultCurrencyCode = (): 'USD' | 'TRY' | 'SYP' => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return 'USD';
    const parsed = JSON.parse(raw);
    return parsed?.primaryCurrency || 'USD';
  } catch {
    return 'USD';
  }
};

const loadEnabledCurrencies = () => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { USD: true, TRY: true, SYP: true };
    const parsed = JSON.parse(raw);
    const enabled = parsed?.enabledCurrencies;
    const primary = parsed?.primaryCurrency || 'USD';
    return {
      USD: true,
      TRY: primary === 'TRY' ? true : (enabled?.TRY ?? true),
      SYP: primary === 'SYP' ? true : (enabled?.SYP ?? true),
    };
  } catch {
    return { USD: true, TRY: true, SYP: true };
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
  category?: string;
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
export interface HeldCart {
  id: string;
  name: string;
  cart: CartItem[];
  customerName: string;
  discount: number;
  createdAt: number;
}
const HELD_CARTS_KEY = 'hyperpos_held_carts_v1';
const CART_STORAGE_KEY = 'hyperpos_temp_cart';
const CART_OPEN_KEY = 'hyperpos_cart_open';
const CART_CUSTOMER_KEY = 'hyperpos_cart_customer';
const CART_DISCOUNT_KEY = 'hyperpos_cart_discount';
const PENDING_BARCODE_KEY = 'hyperpos_pending_scan';
// Note: PENDING_BARCODE_KEY is also exported from OfflineBarcodeScanner for consistency

// ذاكرة مؤقتة على مستوى الوحدة لحفظ المنتجات والأقسام ومنع إعادة التحميل أو قفزات الواجهة عند تبديل التبويبات
let memoryPosProductsCache: POSProduct[] = [];
let memoryPosCategoriesCache: string[] = [];

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

  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);

  // Multi-cart (Held Carts) State Management
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => {
    try {
      const raw = localStorage.getItem(HELD_CARTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    let legacyCart: CartItem[] = [];
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) legacyCart = parsed;
      }
    } catch {}
    let legacyCustomer = '';
    try { legacyCustomer = localStorage.getItem(CART_CUSTOMER_KEY) || ''; } catch {}
    let legacyDiscount = 0;
    try { legacyDiscount = Number(localStorage.getItem(CART_DISCOUNT_KEY)) || 0; } catch {}
    return [{
      id: 'cart_1',
      name: 'سلة 1',
      cart: legacyCart,
      customerName: legacyCustomer,
      discount: legacyDiscount,
      createdAt: Date.now(),
    }];
  });

  const [activeCartId, setActiveCartId] = useState<string>(() => heldCarts[0]?.id || 'cart_1');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(t('common.all'));
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // ✅ useRef لحفظ آخر قيمة للسلة — يُستخدم في listeners لتجنب stale closures
  const cartRef = useRef<CartItem[]>(cart);
  const cartOpenRef = useRef(cartOpen);
  useEffect(() => { cartRef.current = cart; }, [cart]);
  useEffect(() => { cartOpenRef.current = cartOpen; }, [cartOpen]);

  // ✅ حفظ السلة تلقائياً عند كل تغيير
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } else {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, [cart]);

  // حفظ السلة
  const saveCart = useCallback(() => {
    const currentCart = cartRef.current;
    if (currentCart.length > 0) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(currentCart));
      console.log('[POS] Cart saved:', currentCart.length, 'items');
    }
  }, []);

  // استعادة السلة - دون حذفها من localStorage حتى لا تضيع عند التبديل المتكرر بين التطبيقات
  const restoreCart = useCallback(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const items = JSON.parse(saved);
        if (Array.isArray(items) && items.length > 0) {
          setCart(prev => {
            if (prev.length > 0) return prev;
            console.log('[POS] Cart restored:', items.length, 'items');
            return items;
          });
        }
      }
    } catch (e) {
      console.error('[POS] Failed to restore cart:', e);
    }
  }, []);

  // ✅ حفظ حالة فتح السلة في localStorage لاستعادتها عند العودة
  const handleSetCartOpen = useCallback((open: boolean) => {
    // If opening, push state. If closing via button (not back navigation), go back to pop it.
    if (open && !cartOpen) {
      window.history.pushState({ posCartOpen: true }, '');
    } else if (!open && cartOpen && window.history.state?.posCartOpen) {
      window.history.back();
      // the popstate listener will handle setting state
      return; 
    }
    
    setCartOpen(open);
    try { localStorage.setItem(CART_OPEN_KEY, open ? '1' : '0'); } catch { }
  }, [cartOpen]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (cartOpen) {
        setCartOpen(false);
        try { localStorage.setItem(CART_OPEN_KEY, '0'); } catch { }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [cartOpen]);

  // تم إزالة useEffect القديم الذي كان يمسح الباركود المعلق فقط دون معالجته

  // مستمع حالة التطبيق (APK + Web) لحفظ واستعادة السلة بأمان دون إعادة تحميل أو تسريب listeners
  useEffect(() => {
    let appListener: { remove: () => void } | null = null;
    let visibilityHandler: (() => void) | null = null;

    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        // ✅ استخدام cartRef لضمان أحدث القيم
        const currentCart = cartRef.current;
        if (currentCart.length > 0) {
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(currentCart));
          console.log('[POS] App going background, saved cart:', currentCart.length);
        }
        localStorage.setItem(CART_OPEN_KEY, cartOpenRef.current ? '1' : '0');
      } else {
        // استعادة عند العودة دون إعادة طلب سحابي
        restoreCart();
        // ✅ استعادة الباركود المعلق عند العودة من ماسح الباركود
        try {
          const pending = localStorage.getItem(PENDING_BARCODE_KEY);
          if (pending) {
            console.log('[POS] Restoring pending barcode scan on resume:', pending);
            setPendingScan(pending);
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
      // بيئة الويب - حفظ السلة عند الخروج أو تغيير التبويب دون إعادة طلب المنتجات
      window.addEventListener('beforeunload', saveCart);
      visibilityHandler = () => {
        if (document.visibilityState === 'hidden') {
          saveCart();
        } else if (document.visibilityState === 'visible') {
          restoreCart();
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
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
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      window.removeEventListener('barcode-restored', handleBarcodeRestored);
    };
  }, [saveCart, restoreCart]);

  const [discount, setDiscount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CART_DISCOUNT_KEY);
      if (saved) return Number(saved) || 0;
    } catch {}
    return 0;
  });

  useEffect(() => {
    try {
      if (discount > 0) localStorage.setItem(CART_DISCOUNT_KEY, String(discount));
      else localStorage.removeItem(CART_DISCOUNT_KEY);
    } catch {}
  }, [discount]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(() => memoryPosProductsCache.length === 0);

  // Load products and categories from cloud or memory cache
  const [products, setProducts] = useState<POSProduct[]>(() => memoryPosProductsCache);
  const [categories, setCategories] = useState<string[]>(() =>
    memoryPosCategoriesCache.length > 0 ? memoryPosCategoriesCache : [t('common.all')]
  );

  const updateProducts = useCallback((items: POSProduct[]) => {
    memoryPosProductsCache = items;
    setProducts(items);
  }, []);

  const updateCategories = useCallback((cats: string[]) => {
    memoryPosCategoriesCache = cats;
    setCategories(cats);
  }, []);

  // Scanned product dialog
  const [scannedProduct, setScannedProduct] = useState<POSProduct | null>(null);
  const [showScannedDialog, setShowScannedDialog] = useState(false);
  // Variant picker dialog (multiple products with same barcode)
  const [variantMatches, setVariantMatches] = useState<POSProduct[]>([]);
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  // Loan dialog for bookstore mode
  const [showLoanDialog, setShowLoanDialog] = useState(false);
  const [loanProduct, setLoanProduct] = useState<POSProduct | null>(null);

  // دالة مساعدة لتحويل المنتجات إلى صيغة نقطة البيع مع استبعاد المؤرشف بشكل قطعي
  const formatPosProducts = useCallback((productList: Product[]): POSProduct[] => {
    return productList
      .filter(p => !p.archived)
      .map(p => ({
        id: p.id,
        name: p.name,
        price: p.salePrice,
        category: p.category,
        quantity: p.quantity,
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
        expiryDate: p.expiryDate,
        batchNumber: p.batchNumber,
      }));
  }, [t]);

  // Load products and categories from cloud with retry logic
  // ✅ تحميل فوري من الكاش المحلي المسبق ثم مزامنة سحابية هادئة في الخلفية دون وميض أو قفزة بالواجهة
  const loadData = useCallback(async (retryCount = 0, isBackgroundRefresh = false) => {
    if (profile === undefined) {
      console.log('[POS] Profile not loaded yet, waiting...');
      return;
    }

    const userType = profile?.user_type || 'cashier';
    const hasCached = memoryPosProductsCache.length > 0;

    // ⚡ الخطوة 1: التحميل الفوري من الكاش المحلي (Local-First) دون حجب الشاشة إذا لم تكن البيانات بالذاكرة
    if (!isBackgroundRefresh && !hasCached) {
      try {
        const localProducts = await loadProductsLocalFirst();
        if (localProducts && localProducts.length > 0) {
          const initialPosProducts = formatPosProducts(localProducts);

          // فحص كاش المستودع المحلي للموزع/نقطة البيع لئلا يتأخر العرض المبدئي
          if ((userType === 'distributor' || userType === 'pos') && activeWarehouse) {
            const { loadWarehouseStockLocally } = await import('@/lib/cloud/warehouses-cloud');
            const localWarehouseStock = loadWarehouseStockLocally(activeWarehouse.id);
            if (localWarehouseStock && localWarehouseStock.length > 0) {
              const filtered = initialPosProducts
                .map(p => {
                  const s = localWarehouseStock.find(item => item.product_id === p.id);
                  if (s && s.quantity > 0) return { ...p, quantity: s.quantity };
                  return null;
                })
                .filter((p): p is POSProduct => p !== null);
              updateProducts(filtered);
            } else {
              updateProducts(initialPosProducts);
            }
          } else {
            updateProducts(initialPosProducts);
          }

          // إيقاف مؤشر التحميل فوراً ليظهر كل شيء في أقل من نصف ثانية
          setIsLoadingProducts(false);
          console.log(`[POS] ⚡ Instant local-first render: ${initialPosProducts.length} products`);
        } else {
          // فقط إذا لم يتوفر أي كاش سابق، إبقاء مؤشر التحميل
          setIsLoadingProducts(true);
        }
      } catch (err) {
        console.warn('[POS] Local-first initial load failed:', err);
        setIsLoadingProducts(true);
      }
    }

    // 🔄 الخطوة 2: المزامنة السحابية في الخلفية (Background Sync) بدون حجب الشاشة
    try {
      const [cloudProducts, cloudCategories] = await Promise.all([
        loadProductsCloud(),
        getCategoryNamesCloud()
      ]);

      if (cloudProducts.length === 0 && retryCount < 3) {
        console.log(`[POS] No products returned, retrying (${retryCount + 1}/3)...`);
        setTimeout(() => loadData(retryCount + 1, true), 1000);
        return;
      }

      const allPosProducts = formatPosProducts(cloudProducts);

      if ((userType === 'distributor' || userType === 'pos') && activeWarehouse) {
        const { loadWarehouseStockCloud } = await import('@/lib/cloud/warehouses-cloud');
        const warehouseStock = await loadWarehouseStockCloud(activeWarehouse.id);

        const filteredProducts = allPosProducts
          .map(p => {
            const stockItem = warehouseStock.find(s => s.product_id === p.id);
            if (stockItem && stockItem.quantity > 0) {
              return { ...p, quantity: stockItem.quantity };
            }
            return null;
          })
          .filter((p): p is POSProduct => p !== null);

        updateProducts(filteredProducts);
      } else {
        updateProducts(allPosProducts);
      }

      updateCategories([t('common.all'), ...cloudCategories]);
    } catch (error) {
      console.error('Error in background sync:', error);
      if (retryCount < 3) {
        setTimeout(() => loadData(retryCount + 1, true), 1500);
      }
    } finally {
      setIsLoadingProducts(false);
    }
  }, [profile, activeWarehouse, formatPosProducts, t, updateProducts, updateCategories]);

  // Reload data when component mounts or when returning to this page
  useEffect(() => {
    const hasCached = memoryPosProductsCache.length > 0;
    loadData(0, hasCached);

    // ✅ الاستماع لحدث EVENTS.PRODUCTS_UPDATED لتحديث لحظي وفوري من الكاش أولاً ثم الخلفية
    const onProductsUpdated = async () => {
      try {
        const local = await loadProductsLocalFirst();
        if (local && local.length > 0) {
          const userType = profile?.user_type || 'cashier';
          const posItems = formatPosProducts(local);
          if ((userType === 'distributor' || userType === 'pos') && activeWarehouse) {
            const { loadWarehouseStockLocally } = await import('@/lib/cloud/warehouses-cloud');
            const localWarehouseStock = loadWarehouseStockLocally(activeWarehouse.id);
            if (localWarehouseStock && localWarehouseStock.length > 0) {
              const filtered = posItems
                .map(p => {
                  const s = localWarehouseStock.find(item => item.product_id === p.id);
                  if (s && s.quantity > 0) return { ...p, quantity: s.quantity };
                  return null;
                })
                .filter((p): p is POSProduct => p !== null);
              updateProducts(filtered);
            } else {
              updateProducts(posItems);
            }
          } else {
            updateProducts(posItems);
          }
        }
      } catch (e) {
        console.warn('[POS] onProductsUpdated local cache error:', e);
      }
      loadData(0, true);
    };

    const onCategoriesUpdated = () => loadData(0, true);

    window.addEventListener(EVENTS.PRODUCTS_UPDATED, onProductsUpdated as EventListener);
    window.addEventListener(EVENTS.CATEGORIES_UPDATED, onCategoriesUpdated as EventListener);

    return () => {
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, onProductsUpdated as EventListener);
      window.removeEventListener(EVENTS.CATEGORIES_UPDATED, onCategoriesUpdated as EventListener);
    };
  }, [loadData, formatPosProducts, profile, activeWarehouse, updateProducts]);

  const [settingsRev, setSettingsRev] = useState(0);

  useEffect(() => {
    const handleSettings = () => setSettingsRev(r => r + 1);
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleSettings as EventListener);
    window.addEventListener('settings-updated', handleSettings as EventListener);
    return () => {
      window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleSettings as EventListener);
      window.removeEventListener('settings-updated', handleSettings as EventListener);
    };
  }, []);

  const currencies: Currency[] = useMemo(() => {
    const _ = settingsRev;
    const rates = loadExchangeRates();
    const names = loadCurrencyNames();
    const enabled = loadEnabledCurrencies();
    const all: Currency[] = [
      { code: 'USD', symbol: '$', name: t('currency.usd') || 'دولار', rate: 1 },
      { code: 'TRY', symbol: '₺', name: names.TRY || 'ليرة تركية', rate: rates.TRY },
      { code: 'SYP', symbol: 'ل.س', name: names.SYP || 'ليرة سورية', rate: rates.SYP },
    ];
    const filtered = all.filter(c => enabled[c.code] !== false);
    return filtered.length > 0 ? filtered : [all[0]];
  }, [settingsRev, t]);

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => {
    const code = loadDefaultCurrencyCode();
    return currencies.find(c => c.code === code) || currencies[0];
  });

  useEffect(() => {
    const code = loadDefaultCurrencyCode();
    const newCurr = currencies.find(c => c.code === code) || currencies[0];
    setSelectedCurrency(prev => prev.code !== newCurr.code || prev.rate !== newCurr.rate ? newCurr : prev);
  }, [currencies]);
  const [customerName, setCustomerName] = useState<string>(() => {
    try {
      return localStorage.getItem(CART_CUSTOMER_KEY) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      if (customerName.trim()) localStorage.setItem(CART_CUSTOMER_KEY, customerName);
      else localStorage.removeItem(CART_CUSTOMER_KEY);
    } catch {}
  }, [customerName]);

  const addToCart = (product: POSProduct, unit: 'piece' | 'bulk' = 'piece') => {
    if (!isNoInventoryMode() && (product.quantity <= 0 || product.archived)) {
      showToast.warning("المنتج موجود في الأرشيف (انتهت الكمية الموجودة في المخزن)");
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

    const totalCartPieces = cart
      .filter(item => item.id === product.id)
      .reduce((sum, item) => sum + item.quantity * (item.unit === 'bulk' ? (item.conversionFactor || 1) : 1), 0);
    const additionalPieces = unit === 'bulk' ? (product.conversionFactor || 1) : 1;

    if (!isNoInventoryMode() && totalCartPieces + additionalPieces > product.quantity) {
      const maxAvailable = unit === 'bulk' && product.conversionFactor ? Math.floor(product.quantity / product.conversionFactor) : product.quantity;
      const unitLabel = unit === 'bulk' ? (product.bulkUnit || t('products.unitCarton')) : (product.smallUnit || t('products.unitPiece'));
      showToast.error(`الكمية المطلوبة غير متوفرة. المتاح: ${maxAvailable} ${unitLabel}`);
      return;
    }

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
        category: product.category,
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
    try { localStorage.removeItem(PENDING_BARCODE_KEY); } catch { }

    // 1. Try local products first (FAST) - search all 3 barcodes
    const matches = products.filter(p =>
      p.barcode === barcode || p.barcode2 === barcode || p.barcode3 === barcode
    );

    if (matches.length > 1) {
      if (!isNoInventoryMode()) {
        const availableMatches = matches.filter(p => p.quantity > 0 && !p.archived);
        if (availableMatches.length === 0) {
          showToast.warning("المنتج موجود في الأرشيف (انتهت الكمية الموجودة في المخزن)");
          return;
        }
        if (availableMatches.length === 1) {
          if (loadBarcodeScanMode() === 'add') {
            addToCart(availableMatches[0], 'piece');
            return;
          }
          setSearchQuery(barcode);
          showToast.success(t('pos.productFound').replace('{name}', availableMatches[0].name) || `Found: ${availableMatches[0].name}`);
          return;
        }
        setVariantMatches(availableMatches);
        setShowVariantPicker(true);
        return;
      }
      setVariantMatches(matches);
      setShowVariantPicker(true);
      return;
    }

    if (matches.length === 1) {
      if (!isNoInventoryMode() && (matches[0].quantity <= 0 || matches[0].archived)) {
        showToast.warning("المنتج موجود في الأرشيف (انتهت الكمية الموجودة في المخزن)");
        return;
      }
      if (loadBarcodeScanMode() === 'add') {
        addToCart(matches[0], 'piece');
        return;
      }
      setSearchQuery(barcode);
      showToast.success(t('pos.productFound').replace('{name}', matches[0].name) || `Found: ${matches[0].name}`);
      return;
    }

    // 2. Try Cloud (Slow)
    try {
      const cloudProduct = await getProductByBarcodeCloud(barcode);
      if (cloudProduct) {
        if (!isNoInventoryMode() && (cloudProduct.quantity <= 0 || cloudProduct.archived)) {
          showToast.warning("المنتج موجود في الأرشيف (انتهت الكمية الموجودة في المخزن)");
          return;
        }
        if (loadBarcodeScanMode() === 'add') {
          addToCart({
            id: cloudProduct.id,
            name: cloudProduct.name,
            price: cloudProduct.salePrice,
            category: cloudProduct.category,
            quantity: cloudProduct.quantity,
            image: cloudProduct.image,
            barcode: cloudProduct.barcode,
            barcode2: cloudProduct.barcode2,
            barcode3: cloudProduct.barcode3,
            variantLabel: cloudProduct.variantLabel,
            bulkUnit: cloudProduct.bulkUnit,
            smallUnit: cloudProduct.smallUnit,
            conversionFactor: cloudProduct.conversionFactor,
            bulkSalePrice: cloudProduct.bulkSalePrice,
            costPrice: cloudProduct.costPrice,
            bulkCostPrice: cloudProduct.bulkCostPrice,
            wholesalePrice: cloudProduct.wholesalePrice,
            laborCost: cloudProduct.laborCost,
            expiryDate: cloudProduct.expiryDate,
          }, 'piece');
          return;
        }
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

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    const trimmed = query.trim();
    if (trimmed.length >= 2 && !isNoInventoryMode()) {
      const match = products.find(p => p.barcode === trimmed || p.barcode2 === trimmed || p.barcode3 === trimmed);
      if (match && (match.quantity <= 0 || match.archived)) {
        showToast.warning("المنتج موجود في الأرشيف (انتهت الكمية الموجودة في المخزن)");
      }
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
    if (change > 0 && !isNoInventoryMode()) {
      const product = products.find(p => p.id === id);
      if (product) {
        const targetUnit = unit || 'piece';
        const itemToUpdate = cart.find(item => item.id === id && item.unit === targetUnit);
        if (itemToUpdate) {
          const totalCartPieces = cart
            .filter(item => item.id === id)
            .reduce((sum, item) => sum + item.quantity * (item.unit === 'bulk' ? (item.conversionFactor || 1) : 1), 0);
          const additionalPieces = targetUnit === 'bulk' ? (product.conversionFactor || 1) : 1;

          if (totalCartPieces + additionalPieces > product.quantity) {
            const maxAvailable = targetUnit === 'bulk' && product.conversionFactor ? Math.floor(product.quantity / product.conversionFactor) : product.quantity;
            const unitLabel = targetUnit === 'bulk' ? (product.bulkUnit || t('products.unitCarton')) : (product.smallUnit || t('products.unitPiece'));
            showToast.error(`الكمية المطلوبة غير متوفرة. المتاح: ${maxAvailable} ${unitLabel}`);
            return;
          }
        }
      }
    }

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
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_CUSTOMER_KEY);
      localStorage.removeItem(CART_DISCOUNT_KEY);
    } catch {}
  };

  const handleSwitchCart = useCallback((cartId: string) => {
    setHeldCarts(prev => {
      const updated = prev.map(c => c.id === activeCartId ? {
        ...c,
        cart,
        customerName,
        discount,
      } : c);
      
      const target = updated.find(c => c.id === cartId);
      if (target) {
        setCart(target.cart);
        setCustomerName(target.customerName);
        setDiscount(target.discount);
        setActiveCartId(target.id);
      }
      return updated;
    });
  }, [activeCartId, cart, customerName, discount]);

  const handleAddNewCart = useCallback(() => {
    const newId = `cart_${Date.now()}`;
    const newName = `سلة ${heldCarts.length + 1}`;
    setHeldCarts(prev => [
      ...prev.map(c => c.id === activeCartId ? { ...c, cart, customerName, discount } : c),
      { id: newId, name: newName, cart: [], customerName: '', discount: 0, createdAt: Date.now() }
    ]);
    setCart([]);
    setCustomerName('');
    setDiscount(0);
    setActiveCartId(newId);
  }, [activeCartId, cart, customerName, discount, heldCarts.length]);

  const handleRemoveCart = useCallback((cartId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (heldCarts.length <= 1) return;
    
    setHeldCarts(prev => {
      const remaining = prev.filter(c => c.id !== cartId);
      if (activeCartId === cartId) {
        const nextActive = remaining[0];
        setCart(nextActive.cart);
        setCustomerName(nextActive.customerName);
        setDiscount(nextActive.discount);
        setActiveCartId(nextActive.id);
      }
      return remaining;
    });
  }, [activeCartId, heldCarts.length]);

  useEffect(() => {
    try {
      localStorage.setItem(HELD_CARTS_KEY, JSON.stringify(heldCarts));
    } catch {}
  }, [heldCarts]);

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
    <div className="flex h-screen bg-slate-50/50 dark:bg-zinc-950/50">
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
          activeMode={activeMode}
          onModeChange={setActiveMode}
          hideMaintenance={hideMaintenanceSection}
        />

        {/* Mobile menu trigger - same as MainLayout */}
        {isMobile && !sidebarOpen && (
          <MobileMenuTrigger onClick={() => setSidebarOpen(true)} />
        )}

        {/* Mode Buttons - Compact Segmented Pill */}
        {isMobile && !hideMaintenanceSection && (
          <div className="px-3 py-2 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-3xl flex justify-center">
            <div className="inline-flex items-center p-1 rounded-full bg-slate-100 dark:bg-zinc-900 border border-black/5 dark:border-white/5 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveMode('products')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300",
                    activeMode === 'products'
                      ? "bg-white dark:bg-zinc-800 text-foreground shadow-[0_2px_8px_rgb(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgb(0,0,0,0.4)]"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{tDynamic('products')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('maintenance')}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300",
                    activeMode === 'maintenance'
                      ? "bg-white dark:bg-zinc-800 text-foreground shadow-[0_2px_8px_rgb(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgb(0,0,0,0.4)]"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{t('pos.maintenance')}</span>
              </button>
            </div>
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
                onSearchChange={handleSearchChange}
                onCategoryChange={setSelectedCategory}
                onProductClick={(product) => addToCart(product, 'piece')}
                onBarcodeScan={handleBarcodeScan}
                selectedCurrency={selectedCurrency}
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
          {!isMobile && (
            <div className="w-[340px] md:w-[350px] lg:w-[390px] flex-shrink-0 p-2 md:p-3 pl-0 flex flex-col h-full" data-tour="cart-panel">
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
                heldCarts={heldCarts}
                activeCartId={activeCartId}
                onSwitchCart={handleSwitchCart}
                onAddNewCart={handleAddNewCart}
                onRemoveCart={handleRemoveCart}
                lastAddedItemId={lastAddedItemId}
                isMobile={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Cart Sheet - Mobile */}
      {isMobile && (
        <Sheet open={cartOpen} onOpenChange={handleSetCartOpen}>
          <SheetContent side="bottom" className="h-[85vh] p-0 [&>button]:hidden bg-transparent border-none">
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
              heldCarts={heldCarts}
              activeCartId={activeCartId}
              onSwitchCart={handleSwitchCart}
              onAddNewCart={handleAddNewCart}
              onRemoveCart={handleRemoveCart}
              lastAddedItemId={lastAddedItemId}
              onClose={() => handleSetCartOpen(false)}
              isMobile
            />
          </SheetContent>
        </Sheet>
      )}

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
    </div>

  );
}