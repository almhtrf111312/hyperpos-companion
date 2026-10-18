import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { POSHeader } from '@/components/pos/POSHeader';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { MaintenancePanel } from '@/components/pos/MaintenancePanel';
import { ScannedProductDialog } from '@/components/pos/ScannedProductDialog';
import { VariantPickerDialog } from '@/components/pos/VariantPickerDialog';
import { LoanQuickDialog } from '@/components/pos/LoanQuickDialog';
import { Sidebar } from '@/components/layout/Sidebar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatNumber } from '@/lib/utils';
import { loadProductsCloud, loadProductsLocalFirst, getProductByBarcodeCloud, Product, invalidateProductsCache } from '@/lib/cloud/products-cloud';
import { getCategoryNamesCloud } from '@/lib/cloud/categories-cloud';
import { showToast } from '@/lib/toast-config';
import { EVENTS } from '@/lib/events';
import { usePOSShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { getCurrentStoreType, isNoInventoryMode } from '@/lib/store-type-config';
import { playAddToCart } from '@/lib/sound-utils';
import { useLanguage } from '@/hooks/use-language';
import { loadCurrencySymbols, loadCurrencyNames } from '@/hooks/use-currency';
import { getLocalizedUnit } from '@/lib/product-units';
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
    const primary = (parsed?.primaryCurrency || 'USD') as 'USD' | 'TRY' | 'SYP';
    const enabled = parsed?.enabledCurrencies;
    if (primary === 'TRY' && enabled?.TRY === false) return enabled?.USD !== false ? 'USD' : (enabled?.SYP ? 'SYP' : 'TRY');
    if (primary === 'SYP' && enabled?.SYP === false) return enabled?.USD !== false ? 'USD' : (enabled?.TRY ? 'TRY' : 'SYP');
    if (primary === 'USD' && enabled?.USD === false) return enabled?.TRY ? 'TRY' : (enabled?.SYP ? 'SYP' : 'USD');
    return primary;
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
    const isUsd = enabled?.USD !== false;
    const isTry = enabled?.TRY !== false;
    const isSyp = enabled?.SYP !== false;
    if (!isUsd && !isTry && !isSyp) return { USD: true, TRY: false, SYP: false };
    return {
      USD: isUsd,
      TRY: isTry,
      SYP: isSyp,
    };
  } catch {
    return { USD: true, TRY: true, SYP: true };
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

type Currency = { code: string; symbol: string; name: string; rate: number };

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
  const { t, tDynamic, language, isRTL } = useLanguage();
  const { profile } = useAuth();
  const { activeWarehouse, isLoading: isWarehouseLoading } = useWarehouse();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // تبدأ السلة مغلقة دائماً عند تشغيل الشاشة / التطبيق
  const [cartOpen, setCartOpen] = useState(false);

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
      name: `${t('pos.cart') || 'سلة'} 1`,
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

  // ✅ حفظ حالة فتح السلة في sessionStorage للجلسة الحية فقط دون التخزين الدائم
  const handleSetCartOpen = useCallback((open: boolean) => {
    if (open) {
      if (!cartOpen) {
        window.history.pushState({ posCartOpen: true }, '');
      }
      setCartOpen(true);
      try {
        sessionStorage.setItem(CART_OPEN_KEY, '1');
        localStorage.removeItem(CART_OPEN_KEY);
      } catch { }
    } else {
      // 🛡️ كبت إشعار الخروج لمدة ثانيتين عند إغلاق السلة برمجياً
      (window as any).__posSuppressExitUntil = Date.now() + 2000;
      if (window.history.state?.posCartOpen) {
        window.history.replaceState(null, '');
      }
      setCartOpen(false);
      try {
        sessionStorage.setItem(CART_OPEN_KEY, '0');
        localStorage.removeItem(CART_OPEN_KEY);
      } catch { }
    }
  }, [cartOpen]);

  useEffect(() => {
    const handlePopState = () => {
      if (cartOpenRef.current) {
        (window as any).__posSuppressExitUntil = Date.now() + 2000;
        setCartOpen(false);
        try {
          sessionStorage.setItem(CART_OPEN_KEY, '0');
          localStorage.removeItem(CART_OPEN_KEY);
        } catch { }
      }
    };
    window.addEventListener('popstate', handlePopState, true);
    return () => window.removeEventListener('popstate', handlePopState, true);
  }, []);

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
        try {
          sessionStorage.setItem(CART_OPEN_KEY, cartOpenRef.current ? '1' : '0');
          localStorage.removeItem(CART_OPEN_KEY);
        } catch { }
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
        // ✅ استعادة حالة السلة المفتوحة فقط أثناء الجلسة الحية (sessionStorage)
        try {
          const wasOpen = sessionStorage.getItem(CART_OPEN_KEY) === '1';
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
        bulkUnit: getLocalizedUnit(p.bulkUnit, true, language),
        smallUnit: getLocalizedUnit(p.smallUnit, false, language),
        conversionFactor: p.conversionFactor || 1,
        bulkSalePrice: p.bulkSalePrice || 0,
        costPrice: p.costPrice,
        bulkCostPrice: p.bulkCostPrice || 0,
        wholesalePrice: p.wholesalePrice,
        laborCost: p.laborCost || 0,
        expiryDate: p.expiryDate,
        batchNumber: p.batchNumber,
      }));
  }, [language]);

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
    return () => {
      window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleSettings as EventListener);
    };
  }, []);

  const currencies: Currency[] = useMemo(() => {
    const _ = settingsRev;
    const rates = loadExchangeRates();
    const names = loadCurrencyNames();
    const symbols = loadCurrencySymbols();
    const enabled = loadEnabledCurrencies();
    const all: Currency[] = [
      { 
        code: 'USD', 
        symbol: (symbols?.USD && symbols.USD.trim()) || '$', 
        name: (names?.USD && names.USD.trim()) || t('currency.usd') || 'دولار', 
        rate: 1 
      },
      { 
        code: 'TRY', 
        symbol: (symbols?.TRY && symbols.TRY.trim()) || '₺', 
        name: (names?.TRY && names.TRY.trim()) || 'ليرة تركية', 
        rate: rates.TRY 
      },
      { 
        code: 'SYP', 
        symbol: (symbols?.SYP && symbols.SYP.trim()) || 'ل.س', 
        name: (names?.SYP && names.SYP.trim()) || 'ليرة سورية', 
        rate: rates.SYP 
      },
    ];

    // تضمين أي عملات مخصصة أخرى مفعلة في الإعدادات
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const customRates = parsed?.exchangeRates || {};
        const customSymbols = parsed?.currencySymbols || {};
        const customNames = parsed?.currencyNames || {};
        const customEnabled = parsed?.enabledCurrencies || {};
        
        Object.keys(customEnabled).forEach(code => {
          if (!all.some(c => c.code === code) && customEnabled[code] !== false) {
            all.push({
              code,
              symbol: (customSymbols[code] && typeof customSymbols[code] === 'string' && customSymbols[code].trim()) || code,
              name: (customNames[code] && typeof customNames[code] === 'string' && customNames[code].trim()) || code,
              rate: Number(customRates[code] ?? 1) || 1,
            });
          }
        });
      }
    } catch {}

    const filtered = all.filter(c => enabled[c.code] !== false);
    return filtered.length > 0 ? filtered : [all[0]];
  }, [settingsRev, t]);

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => {
    const code = loadDefaultCurrencyCode();
    return currencies.find(c => c.code === code) || currencies[0];
  });

  useEffect(() => {
    const code = loadDefaultCurrencyCode();
    const defaultCurr = currencies.find(c => c.code === code) || currencies[0];
    setSelectedCurrency(prev => {
      // الحفاظ على اختيار المستخدم طالما أن العملة لا تزال مفعلة وموجودة، مع تحديث بياناتها
      const currentMatching = currencies.find(c => c.code === prev.code);
      if (currentMatching) {
        return currentMatching;
      }
      return defaultCurr;
    });
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

  const addToCart = (product: POSProduct, unit: 'piece' | 'bulk' = 'piece', quantityToAdd: number = 1) => {
    if (!isNoInventoryMode() && (product.quantity <= 0 || product.archived)) {
      showToast.warning(t('pos.productArchived') || "المنتج موجود في الأرشيف (انتهت الكمية الموجودة في المخزن)");
      return; // Don't add out-of-stock items
    }

    // Pharmacy: warn about expired products (block add)
    if (product.expiryDate) {
      const expiry = new Date(product.expiryDate);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 0) {
        showToast.error(`⚠️ ${product.name} - ${t('pos.expired') || 'منتهي الصلاحية!'}`);
        return;
      }
    }

    const priceForUnit = unit === 'bulk' && product.bulkSalePrice ? product.bulkSalePrice : product.price;

    const totalCartPieces = cart
      .filter(item => item.id === product.id)
      .reduce((sum, item) => sum + item.quantity * (item.unit === 'bulk' ? (item.conversionFactor || 1) : 1), 0);
    const additionalPieces = unit === 'bulk' ? (product.conversionFactor || 1) * quantityToAdd : quantityToAdd;

    if (!isNoInventoryMode() && totalCartPieces + additionalPieces > product.quantity) {
      const maxAvailable = unit === 'bulk' && product.conversionFactor ? Math.floor(product.quantity / product.conversionFactor) : product.quantity;
      const unitLabel = unit === 'bulk'
        ? getLocalizedUnit(product.bulkUnit, true, language)
        : getLocalizedUnit(product.smallUnit, false, language);
      showToast.error(`${t('pos.insufficientStock') || 'الكمية المطلوبة غير متوفرة'}. ${t('pos.available') || 'المتاح'}: ${maxAvailable} ${unitLabel}`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && item.unit === unit);
      if (existing) {
        return prev.map(item =>
          item.id === product.id && item.unit === unit
            ? { ...item, quantity: item.quantity + quantityToAdd }
            : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: priceForUnit,
        quantity: quantityToAdd,
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

    // Play sound effect and rely on visual cart update
    playAddToCart();
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
          showToast.warning(t('pos.productArchived') || "المنتج موجود في الأرشيف (انتهت الكمية الموجودة في المخزن)");
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
        showToast.warning(t('pos.productArchived') || "المنتج موجود في الأرشيف (انتهت الكمية الموجودة في المخزن)");
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
          showToast.warning(t('pos.productArchived') || "المنتج موجود في الأرشيف (انتهت الكمية الموجودة في المخزن)");
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
        showToast.warning(t('pos.productArchived') || "المنتج موجود في الأرشيف (انتهت الكمية الموجودة في المخزن)");
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
            const unitLabel = targetUnit === 'bulk'
              ? getLocalizedUnit(product.bulkUnit, true, language)
              : getLocalizedUnit(product.smallUnit, false, language);
            showToast.error(`${t('pos.insufficientStock') || 'الكمية المطلوبة غير متوفرة'}. ${t('pos.available') || 'المتاح'}: ${maxAvailable} ${unitLabel}`);
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
    const newName = `${t('pos.cart') || 'سلة'} ${heldCarts.length + 1}`;
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
        !isMobile && (isRTL ? "md:mr-20 md:ml-0" : "md:ml-20 md:mr-0")
      )}>
        {/* Header - مدمج فيه زر المنيو وتبديل الأوضاع بدون تداخل */}
        <POSHeader
          onCartClick={() => handleSetCartOpen(true)}
          cartItemsCount={cartItemsCount}
          showCartButton={false}
          activeMode={activeMode}
          onModeChange={setActiveMode}
          hideMaintenance={hideMaintenanceSection}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Products/Maintenance Area */}
          <div data-tour="product-grid" className={cn(
            "flex-1 flex flex-col h-full overflow-hidden",
            !isMobile && (isRTL ? "border-l border-border" : "border-r border-border")
          )}>
            {activeMode === 'products' || hideMaintenanceSection ? (
              <ProductGrid
                products={products}
                categories={categories}
                searchQuery={searchQuery}
                selectedCategory={selectedCategory}
                onSearchChange={handleSearchChange}
                onCategoryChange={setSelectedCategory}
                onProductClick={(product, qty) => addToCart(product, 'piece', qty || 1)}
                onAddToCart={(product, qty) => addToCart(product, 'piece', qty || 1)}
                onBarcodeScan={handleBarcodeScan}
                selectedCurrency={selectedCurrency}
              />
            ) : (
              <MaintenancePanel
                currencies={currencies as any}
                selectedCurrency={selectedCurrency as any}
                onCurrencyChange={setSelectedCurrency as any}
              />
            )}
          </div>

          {/* Cart Panel - Desktop Only (not tablet) */}
          {!isMobile && (
            <div className={cn(
              "w-[340px] md:w-[350px] lg:w-[390px] flex-shrink-0 p-2 md:p-3 flex flex-col h-full",
              isRTL ? "pl-0" : "pr-0"
            )} data-tour="cart-panel">
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