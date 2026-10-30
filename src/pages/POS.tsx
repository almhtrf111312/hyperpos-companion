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
import { getCategoryNamesCloud, getCategoryNamesLocalFirst } from '@/lib/cloud/categories-cloud';
import { showToast } from '@/lib/toast-config';
import { EVENTS } from '@/lib/events';
import { usePOSShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { getCurrentStoreType, isNoInventoryMode, getVisibleSections } from '@/lib/store-type-config';
import { playAddToCart } from '@/lib/sound-utils';
import { useLanguage } from '@/hooks/use-language';
import { loadCurrencySymbols, loadCurrencyNames } from '@/hooks/use-currency';
import { loadNormalizedCurrencySettings } from '@/lib/currencies';
import { getLocalizedUnit } from '@/lib/product-units';
import { useWarehouse } from '@/hooks/use-warehouse';
import { useAuth } from '@/hooks/use-auth';
import { App } from '@capacitor/app';

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
const loadDefaultCurrencyCode = (): string => {
  try {
    const normalized = loadNormalizedCurrencySettings();
    return normalized.primaryCurrencyCode || 'USD';
  } catch {
    return 'USD';
  }
};

const loadEnabledCurrencies = () => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { USD: true };
    const parsed = JSON.parse(raw);
    const enabled = parsed?.enabledCurrencies || {};
    return {
      USD: true,
      ...Object.fromEntries(Object.entries(enabled)
        .filter(([code, value]) => code.toUpperCase() !== 'USD' && value === true)
        .map(([code]) => [code.toUpperCase(), true])),
    };
  } catch {
    return { USD: true };
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
  /** سعر يدوي (دولار) يتقدّم على سعر المفرق والجملة */
  manualPrice?: number;
  expiryDate?: string;
  batchNumber?: string;
  /** عملة إدخال/عرض السعر لهذا السطر فقط */
  priceEntryCurrencyCode?: string;
  /** لقطة معدل صرف وقت اختيار عملة السطر */
  priceEntryRateSnapshot?: number;
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
  invoiceCurrencyCode?: string;
  invoiceExchangeRateSnapshot?: number;
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

  // Alert when printing is requested but no Bluetooth printer is paired
  useEffect(() => {
    const handleRequestPairing = () => {
      showToast.info(isRTL ? 'يرجى ربط طابعة بلوتوث من شاشة الإعدادات > الطباعة' : 'Please pair a Bluetooth printer in Settings > Printing');
    };
    window.addEventListener('flowpos:request-printer-pairing', handleRequestPairing);
    return () => window.removeEventListener('flowpos:request-printer-pairing', handleRequestPairing);
  }, [isRTL]);
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
  const [categories, setCategories] = useState<string[]>(() => {
    if (memoryPosCategoriesCache.length > 0) return memoryPosCategoriesCache;
    const localCats = getCategoryNamesLocalFirst();
    return [t('common.all'), ...localCats];
  });

  const updateProducts = useCallback((next: POSProduct[] | ((prev: POSProduct[]) => POSProduct[])) => {
    setProducts(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      memoryPosProductsCache = resolved;
      return resolved;
    });
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

          const localCats = getCategoryNamesLocalFirst();
          if (localCats && localCats.length > 0) {
            updateCategories([t('common.all'), ...localCats]);
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
    const onProductsUpdated = (e: Event) => {
      try {
        const customEv = e as CustomEvent<Product[] | null>;
        const payload = customEv.detail;
        // إذا وصل تحديث جزئي لأصناف محددة فقط (مثل الأصناف المستردة)
        if (Array.isArray(payload) && payload.length > 0 && payload.length < 50) {
          const deltaMap = new Map(payload.map(p => [p.id, p]));
          
          updateProducts((prev) =>
            prev.map(item => {
              const updated = deltaMap.get(item.id);
              if (updated) {
                return {
                  ...item,
                  quantity: updated.quantity,
                };
              }
              return item;
            })
          );
          // لا داعي لاستدعاء loadData(0, true) هنا لتجنب تنزيل 1000 منتج وإبطاء الـ POS
          return;
        }

        // في حال التحديث الشامل
        if (Array.isArray(payload) && payload.length >= 50) {
          const posItems = formatPosProducts(payload);
          updateProducts(posItems);
          return;
        }
      } catch (err) {
        console.warn('[POS] onProductsUpdated error:', err);
      }
      
      // خلفية هادئة فقط إذا لم تكن البيانات متوفرة
      loadData(0, true);
    };

    const onCategoriesUpdated = () => loadData(0, true);

    window.addEventListener(EVENTS.PRODUCTS_UPDATED, onProductsUpdated as EventListener);
    window.addEventListener(EVENTS.CATEGORIES_UPDATED, onCategoriesUpdated as EventListener);
    window.addEventListener(EVENTS.APP_REFRESH, onProductsUpdated as EventListener);

    return () => {
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, onProductsUpdated as EventListener);
      window.removeEventListener(EVENTS.CATEGORIES_UPDATED, onCategoriesUpdated as EventListener);
      window.removeEventListener(EVENTS.APP_REFRESH, onProductsUpdated as EventListener);
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
    const normalized = loadNormalizedCurrencySettings();
    const result: Currency[] = [];

    // 1. إضافة الدولار إذا كان مفعلاً
    const usd = normalized.currencies.USD || {
      code: 'USD',
      symbol: '$',
      name: t('currency.usd') || 'دولار',
      rate: 1,
      enabled: true,
    };

    if (usd.enabled !== false) {
      result.push({
        code: 'USD',
        symbol: usd.symbol || '$',
        name: usd.name || 'دولار',
        rate: 1,
        enabled: true,
      });
    }

    // 2. إضافة فقط العملات الأخرى المفعلة صراحة
    for (const [code, c] of Object.entries(normalized.currencies)) {
      if (code === 'USD') continue;
      if (c.enabled === true && Number.isFinite(c.rate) && c.rate > 0) {
        result.push({
          code: c.code,
          symbol: c.symbol,
          name: c.name,
          rate: c.rate,
          enabled: true,
        });
      }
    }

    // 3. ضمان أمان: إذا عُطلت كل العملات، يبقى الدولار دائماً
    if (result.length === 0) {
      result.push({
        code: 'USD',
        symbol: usd.symbol || '$',
        name: usd.name || 'دولار',
        rate: 1,
        enabled: true,
      });
    }

    return result;
  }, [settingsRev, t]);

  // 1. تثبيت عملة عرض شبكة المنتجات على عملة المتجر الافتراضية
  const defaultStoreCurrencyCode = loadDefaultCurrencyCode();
  const catalogCurrency = useMemo(() => {
    return currencies.find(c => c.code === defaultStoreCurrencyCode) || currencies[0];
  }, [currencies, defaultStoreCurrencyCode]);

  // 2. عملة السلة والقبض (مستقلة تماماً)
  const [cartCurrency, setCartCurrency] = useState<Currency>(() => {
    return currencies.find(c => c.code === defaultStoreCurrencyCode) || currencies[0];
  });

  useEffect(() => {
    const code = loadDefaultCurrencyCode();
    const defaultCurr = currencies.find(c => c.code === code) || currencies[0];
    setCartCurrency(prev => {
      // إذا كانت السلة فارغة، تأخذ تلقائياً العملة الافتراضية من الإعدادات
      if (cart.length === 0) {
        return defaultCurr;
      }
      // الحفاظ على لقطة عملة الفاتورة طالما أن العملة لا تزال مفعلة وموجودة
      const currentMatching = currencies.find(c => c.code === prev.code);
      if (currentMatching) {
        return currentMatching;
      }
      return defaultCurr;
    });
  }, [currencies, cart.length]);
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
        // دمج الكميات مع الحفاظ التام على السعر التفضيلي اليدوي إن وُجد
        return prev.map(item =>
          item.id === product.id && item.unit === unit
            ? { ...item, quantity: item.quantity + quantityToAdd, price: item.price ?? priceForUnit }
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
        return;
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
        invoiceCurrencyCode: cartCurrency.code,
        invoiceExchangeRateSnapshot: cartCurrency.rate,
      } : c);
      
      const target = updated.find(c => c.id === cartId);
      if (target) {
        setCart(target.cart);
        setCustomerName(target.customerName);
        setDiscount(target.discount);
        if (target.invoiceCurrencyCode) {
          const matchingCurr = currencies.find(c => c.code === target.invoiceCurrencyCode);
          if (matchingCurr) setCartCurrency(matchingCurr);
        }
        setActiveCartId(target.id);
      }
      return updated;
    });
  }, [activeCartId, cart, customerName, discount, cartCurrency, currencies]);

  const handleAddNewCart = useCallback(() => {
    const defaultCode = loadDefaultCurrencyCode();
    const defaultCurr = currencies.find(c => c.code === defaultCode) || currencies[0];
    const newId = `cart_${Date.now()}`;
    const newName = `${t('pos.cart') || 'سلة'} ${heldCarts.length + 1}`;
    setHeldCarts(prev => [
      ...prev.map(c => c.id === activeCartId ? {
        ...c,
        cart,
        customerName,
        discount,
        invoiceCurrencyCode: cartCurrency.code,
        invoiceExchangeRateSnapshot: cartCurrency.rate,
      } : c),
      {
        id: newId,
        name: newName,
        cart: [],
        customerName: '',
        discount: 0,
        createdAt: Date.now(),
        invoiceCurrencyCode: defaultCurr.code,
        invoiceExchangeRateSnapshot: defaultCurr.rate,
      }
    ]);
    setCart([]);
    setCustomerName('');
    setDiscount(0);
    setCartCurrency(defaultCurr);
    setActiveCartId(newId);
  }, [activeCartId, cart, customerName, discount, heldCarts.length, currencies, cartCurrency, t]);

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
        if (nextActive.invoiceCurrencyCode) {
          const matchingCurr = currencies.find(c => c.code === nextActive.invoiceCurrencyCode);
          if (matchingCurr) setCartCurrency(matchingCurr);
        }
        setActiveCartId(nextActive.id);
      }
      return remaining;
    });
  }, [activeCartId, heldCarts.length, currencies]);

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
        ? { ...item, manualPrice: newPrice }
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
        showToast.success(t('pos.cartCleared'), { id: 'pos-cart-cleared', duration: 1500 });
      }
    },
    onToggleMode: () => {
      setActiveMode(prev => prev === 'products' ? 'maintenance' : 'products');
      showToast.info(activeMode === 'products' ? t('pos.switchedToMaintenance') : t('pos.switchedToProducts'), { id: 'pos-toggle-mode', duration: 1500 });
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
              selectedCurrency={catalogCurrency} // لا يتغير إطلاقاً عند تبديل عملة السلة
            />
          </div>

          {/* Cart Panel - Desktop Only (not tablet) */}
          {!isMobile && (
            <div className={cn(
              "w-80 lg:w-96 flex-shrink-0 p-2 md:p-3 flex flex-col h-full",
              isRTL ? "pl-0" : "pr-0"
            )} data-tour="cart-panel">
              <CartPanel
                cart={cart}
                currencies={currencies}
                selectedCurrency={cartCurrency}
                discount={discount}
                customerName={customerName}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeItem}
                onClearCart={clearCart}
                onCurrencyChange={(newCurr) => {
                  // يغير عملة السلة والقبض فقط دون المساس بأسعار الكتالوج المعروضة
                  setCartCurrency(newCurr);
                }}
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
                isMaintenanceEnabled={!hideMaintenanceSection && Boolean(getVisibleSections(getCurrentStoreType())?.maintenance)}
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
              selectedCurrency={cartCurrency}
              discount={discount}
              customerName={customerName}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
              onClearCart={clearCart}
              onCurrencyChange={(newCurr) => {
                // يغير عملة السلة والقبض فقط دون المساس بأسعار الكتالوج المعروضة
                setCartCurrency(newCurr);
              }}
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
              isMaintenanceEnabled={!hideMaintenanceSection && Boolean(getVisibleSections(getCurrentStoreType())?.maintenance)}
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