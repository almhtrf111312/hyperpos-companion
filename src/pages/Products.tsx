import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Package,
  Edit,
  Trash2,
  Barcode,
  AlertTriangle,
  CheckCircle,
  X,
  Save,
  ScanLine,
  Tag,
  Image as ImageIcon,
  Camera,
  Loader2,
  Boxes,
  Truck,
  FileText,
  LayoutGrid,
  List,
  AlignJustify,
  Copy,
  Archive,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { cn, toWesternNumerals, formatNumber, formatMoney } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import { useMoney } from '@/hooks/use-money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from '@/lib/sonner-bridge';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { PENDING_BARCODE_KEY } from '@/components/barcode/OfflineBarcodeScanner';
import { CategoryManager } from '@/components/CategoryManager';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { UnitSettingsTab } from '@/components/products/UnitSettingsTab';
import { DualUnitDisplay } from '@/components/products/DualUnitDisplay';
import {
  loadProductsCloud,
  loadProductsLocalFirst,
  refreshProductsFromCloud,
  loadArchivedProductsCloud,
  restoreArchivedProductCloud,
  addProductCloud,
  updateProductCloud,
  deleteProductCloud,
  getStatus,
  Product
} from '@/lib/cloud/products-cloud';
import { getCategoryNamesCloud, getCategoryNamesLocalFirst } from '@/lib/cloud/categories-cloud';
import { useActionGuard } from '@/hooks/use-action-guard';
import {
  fetchAllWarehouseStocksCloud,
  loadWarehousesCloud,
  loadWarehousesLocalFirst,
  loadAllWarehouseStocksLocalFirst,
  WarehouseStock,
  Warehouse
} from '@/lib/cloud/warehouses-cloud';
import { useImageUpload } from '@/hooks/use-image-upload';
import { addActivityLog, diffFields } from '@/lib/activity-log';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { getEffectiveFieldsConfig, ProductFieldsConfig } from '@/lib/product-fields-config';
import { getEnabledCustomFields, CustomField } from '@/lib/custom-fields-config';
import { EVENTS } from '@/lib/events';
import { useLanguage } from '@/hooks/use-language';
import { useDebounce } from '@/hooks/use-debounce';
import { getLocalizedUnit as localizeProductUnit } from '@/lib/product-units';
import { useCamera } from '@/hooks/use-camera';
import { NativeCameraPreview } from '@/components/camera/NativeCameraPreview';
import { isNoInventoryMode, getCurrentStoreType } from '@/lib/store-type-config';
import { ProductImage } from '@/components/products/ProductImage';
import { getSignedImageUrl } from '@/lib/image-upload';

export default function Products() {
  const m = useMoney();
  const currencyCode = m.activeCode;
  const currencySymbol = m.activeSymbol;
  const exchangeRate = m.activeRate;
  const enabledCurrencies = m.enabledCurrencies;

  const parseFormPriceToUsd = (inputVal: string | number | undefined) => {
    const num = typeof inputVal === 'number' ? inputVal : Number(inputVal) || 0;
    return m.toUsd(num, m.activeCode, m.activeRate);
  };

  const formatPrice = (usdPrice: number) => {
    const val = usdPrice || 0;
    if (m.activeCode === 'USD') return <>${formatNumber(val, 2)}</>;
    const localFormatted = m.fmt(val);
    const usdEnabled = m.getCurrencyDef('USD').enabled;
    return (
      <>
        {localFormatted}{' '}
        {usdEnabled && (
          <span className="text-[0.8em] opacity-60 ml-1">({formatMoney(val, 'USD', 2)})</span>
        )}
      </>
    );
  };
  
  const formatPriceRaw = (usdPrice: number) => {
    const val = usdPrice || 0;
    if (m.activeCode === 'USD') return formatMoney(val, 'USD', 2);
    const localFormatted = m.fmt(val);
    const usdEnabled = m.getCurrencyDef('USD').enabled;
    return usdEnabled
      ? `${localFormatted} (${formatMoney(val, 'USD', 2)})`
      : localFormatted;
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { t, tDynamic, isRTL, language } = useLanguage();
  const { isBoss, isAdmin, isCashier } = useUserRole();
  const noInventory = isNoInventoryMode();
  const isRestaurant = getCurrentStoreType() === 'restaurant';
  const isRepairMode = getCurrentStoreType() === 'repair';

  // Whether this user can add/edit/delete products (owners always can; cashiers need explicit permission)
  const allowedPages = profile?.allowed_pages as string[] | null;
  const canAddProducts = isBoss || isAdmin || (isCashier && (allowedPages?.includes('products:add') ?? false));

  const statusConfig = {
    in_stock: { label: t('products.available'), color: 'badge-success', icon: CheckCircle },
    low_stock: { label: t('products.low'), color: 'badge-warning', icon: AlertTriangle },
    out_of_stock: { label: t('products.outOfStock'), color: 'badge-danger', icon: AlertTriangle },
  };
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const deleteGuard = useActionGuard();
  const [selectedCategory, setSelectedCategory] = useState(t('products.all'));
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock'>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | 'multi_unit' | 'single_unit'>('all');
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // View mode state (grid = cards, list = rows with images, compact = text-only)
  type ViewMode = 'grid' | 'list' | 'compact';
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('products_view_mode') as ViewMode) || 'grid';
  });

  useEffect(() => {
    localStorage.setItem('products_view_mode', viewMode);
  }, [viewMode]);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<'search' | 'form' | 'barcode1' | 'barcode2' | 'barcode3' | 'archive'>('search');

  // Archive state
  const [mainTab, setMainTab] = useState<'products' | 'archive'>('products');
  const [archivedProducts, setArchivedProducts] = useState<Product[]>([]);
  const [isArchiveLoading, setIsArchiveLoading] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [archivedProductToDelete, setArchivedProductToDelete] = useState<Product | null>(null);
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false);

  // Quick Restock state (for restocking out-of-stock items in the archive)
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [restockQuantity, setRestockQuantity] = useState<string>('10');
  const [isRestocking, setIsRestocking] = useState(false);

  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imagePreviewBase64, setImagePreviewBase64] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  /**
   * ✅ فتح نافذة المعاينة بشكل آمن على APK و Web
   * يحوّل المسار القصير (products/xxx.jpg) إلى signed URL قبل الفتح
   * data URL وروابط http تُمرَّر مباشرة
   */
  const openImagePreview = useCallback(async (imageUrl: string) => {
    if (!imageUrl) return;
    // data URL أو base64: عرض مباشر
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      setPreviewImageUrl(imageUrl);
      return;
    }
    // رابط http/https: عرض مباشر
    if (imageUrl.startsWith('http')) {
      setPreviewImageUrl(imageUrl);
      return;
    }
    // مسار تخزين قصير: توليد signed URL أولاً
    setPreviewLoading(true);
    try {
      const signedUrl = await getSignedImageUrl(imageUrl);
      setPreviewImageUrl(signedUrl || imageUrl);
    } catch {
      setPreviewImageUrl(imageUrl);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // Form state with dynamic fields
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    barcode2: '',  // باركود ثاني
    barcode3: '',  // باركود ثالث
    variantLabel: '',  // وصف المتغير
    category: t('products.defaultCategory'),
    costPrice: 0 as number | string,
    salePrice: 0 as number | string,
    laborCost: 0 as number | string,  // تكلفة العمالة (وضع ورشة الصيانة)
    quantity: 0 as number | string,
    expiryDate: '',
    image: '',
    // Dynamic fields (Fix #16)
    serialNumber: '',
    batchNumber: '',
    warranty: '',
    wholesalePrice: 0 as number | string,
    size: '',
    color: '',
    minStockLevel: 1 as number | string,
    weight: '',
    fabricType: '',
    tableNumber: '',
    orderNotes: '',
    author: '',
    publisher: '',
    // Unit settings
    bulkUnit: t('products.unitCarton'),
    smallUnit: t('products.unitPiece'),
    conversionFactor: 1 as number | string,
    bulkCostPrice: 0 as number | string,
    bulkSalePrice: 0 as number | string,
    trackByUnit: 'piece' as 'piece' | 'bulk',
  });

  // State for showing additional barcode fields
  const [showBarcode2, setShowBarcode2] = useState(false);
  const [showBarcode3, setShowBarcode3] = useState(false);

  // Unit settings collapsible state
  const [showUnitSettings, setShowUnitSettings] = useState(false);

  // Get effective field configuration - reload when page gains focus or storage changes
  const [fieldsConfig, setFieldsConfig] = useState<ProductFieldsConfig>(getEffectiveFieldsConfig);
  const [customFields, setCustomFields] = useState<CustomField[]>(() => getEnabledCustomFields());
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number>>({});

  // Helper function to convert Arabic numerals to English when typing in numeric fields
  // Allows empty string during typing so Backspace does not force 0 or lock the input
  const handleNumericChange = useCallback((field: keyof typeof formData, value: string) => {
    const converted = toWesternNumerals(value).trim();
    if (converted === '') {
      setFormData(prev => ({ ...prev, [field]: '' }));
      return;
    }
    // Allow numbers and decimal points (e.g. "12.")
    if (/^-?\d*\.?\d*$/.test(converted)) {
      setFormData(prev => ({ ...prev, [field]: converted }));
    }
  }, []);

  // When leaving the field (onBlur), restore fallback default if left empty
  const handleNumericBlur = useCallback((field: keyof typeof formData, defaultValue: number = 0) => {
    setFormData(prev => {
      const val = prev[field];
      if (val === '' || val === undefined || val === null) {
        return { ...prev, [field]: defaultValue };
      }
      const parsed = parseFloat(String(val));
      return { ...prev, [field]: isNaN(parsed) ? defaultValue : parsed };
    });
  }, []);

  // Helper function for text fields that may contain Arabic numerals (like barcode)
  const handleTextWithNumerals = useCallback((field: keyof typeof formData, value: string) => {
    const converted = toWesternNumerals(value);
    setFormData(prev => ({ ...prev, [field]: converted }));
  }, []);

  // Reload fields config when navigating to this page or when settings change
  useEffect(() => {
    const reloadFieldsConfig = () => {
      setFieldsConfig(getEffectiveFieldsConfig());
      setCustomFields(getEnabledCustomFields());
    };

    // Listen for custom events (same tab)
    const handleFieldsUpdated = () => reloadFieldsConfig();
    window.addEventListener(EVENTS.PRODUCT_FIELDS_UPDATED, handleFieldsUpdated);
    window.addEventListener(EVENTS.CUSTOM_FIELDS_UPDATED, handleFieldsUpdated);
    window.addEventListener(EVENTS.SETTINGS_UPDATED, handleFieldsUpdated);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.includes('hyperpos_product_fields') || e.key?.includes('hyperpos_custom_fields')) {
        reloadFieldsConfig();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    reloadFieldsConfig();

    return () => {
      window.removeEventListener(EVENTS.PRODUCT_FIELDS_UPDATED, handleFieldsUpdated);
      window.removeEventListener(EVENTS.CUSTOM_FIELDS_UPDATED, handleFieldsUpdated);
      window.removeEventListener(EVENTS.SETTINGS_UPDATED, handleFieldsUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  /*
   * AUTOMATIC FORM PERSISTENCE
   * Save form data to localStorage so it survives Android Process Death
   */
  const FORM_STORAGE_KEY = 'hyperpos_product_form_temp';
  // Temporary key for image restored via appRestoredResult (may arrive before form restore)
  const RESTORED_IMAGE_KEY = 'hyperpos_restored_image_temp';

  /*
   * Handle Photo Restoration from Android Process Death
   */
  const handlePhotoRestored = useCallback(async (base64Image: string) => {
    // 1. Persist image immediately
    localStorage.setItem(RESTORED_IMAGE_KEY, base64Image);
    // 2. Show preview right away — Offline-First
    setImagePreviewBase64(base64Image);
    setFormData(prev => ({ ...prev, image: base64Image }));
    // ✅ Offline-First: NO cloud upload here — sync happens after product save
    localStorage.removeItem(RESTORED_IMAGE_KEY);
  }, []);

  // Use Capacitor Camera hook with restoration callback
  // ✅ FIX: preferInline: true → always use the built-in WebView camera
  //    so Android never launches a separate Activity (no 'focus' event fired).
  const { takePhoto, pickFromGallery, isLoading: isCameraLoading, showInlineCamera, onInlineCaptured, closeInlineCamera } = useCamera({
    maxSize: 400,
    quality: 40,
    onPhotoRestored: handlePhotoRestored,
    fallbackToInline: true,
    preferInline: true,
  });

  // 1. Save state whenever important form values change (only when dialog is open)
  useEffect(() => {
    if (showAddDialog || showEditDialog) {
      const stateToSave = {
        formData,
        customFieldValues,
        isAdd: showAddDialog,
        isEdit: showEditDialog,
        selectedProductId: selectedProduct?.id,
        cameraPending: (() => { try { return !!JSON.parse(localStorage.getItem(FORM_STORAGE_KEY) || '{}').cameraPending; } catch { return false; } })(),
        timestamp: Date.now()
      };
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(stateToSave));
    }
    // ✅ لا نمسح الكاش عند إغلاق الـ dialog تلقائياً
    // المسح يحدث فقط عبر clearPersistedState() عند الحفظ الناجح أو الإلغاء الصريح
  }, [formData, customFieldValues, showAddDialog, showEditDialog, selectedProduct]);

  // 2. Clear state when dialog is closed explicitly (Cancel/Success)
  const clearPersistedState = useCallback(() => {
    localStorage.removeItem(FORM_STORAGE_KEY);
    localStorage.removeItem(RESTORED_IMAGE_KEY);
  }, []);

  // 3. Restore state on mount (if App was killed and restarted)
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(FORM_STORAGE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        const hour = 60 * 60 * 1000;

        // Only restore after Android killed the app during camera capture — never after normal navigation
        if (parsed.cameraPending && Date.now() - parsed.timestamp < hour) {
          console.log('Restoring persisted form state...', parsed);

          // Check if there is a temporarily-persisted restored image
          // (may have arrived via appRestoredResult before this effect ran)
          const restoredImage = localStorage.getItem(RESTORED_IMAGE_KEY);
          const formDataToRestore = restoredImage
            ? { ...parsed.formData, image: restoredImage }
            : parsed.formData;

          // Restore Basic Data immediately
          setFormData(formDataToRestore);
          setCustomFieldValues(parsed.customFieldValues);

          // Also restore the image preview if we have a restored image
          if (restoredImage) {
            setImagePreviewBase64(restoredImage);
          }

          // Restore Dialog State
          if (parsed.isEdit && parsed.selectedProductId) {
            setShowEditDialog(true);
          } else if (parsed.isAdd) {
            setShowAddDialog(true);
          }

          toast.info(t('products.dataRestored'), { duration: 3000 });
        } else {
          localStorage.removeItem(FORM_STORAGE_KEY);
          localStorage.removeItem(RESTORED_IMAGE_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to restore form state', e);
    }
  }, []);

  // Load data - Local-First (0ms instant display) + non-blocking background refresh
  const loadData = useCallback(async (isBackground = false) => {
    // 1. Step 1: Local-first - serve immediately from local cache without waiting for network
    if (!isBackground) {
      try {
        const localProducts = await loadProductsLocalFirst();
        const localCats = getCategoryNamesLocalFirst();
        const localWarehouses = loadWarehousesLocalFirst();
        const localStocks = loadAllWarehouseStocksLocalFirst();

        if (localProducts.length > 0) {
          setProducts(localProducts);
          if (localCats.length > 0) setCategoryOptions(localCats);
          if (localWarehouses.length > 0) setWarehouses(localWarehouses);
          if (localStocks.length > 0) setWarehouseStocks(localStocks);
          setIsLoading(false); // ✅ Products displayed in 0ms!
        } else {
          setIsLoading(true);
        }
      } catch (err) {
        console.warn('[Products] Local-first load error:', err);
      }
    }

    // 2. Step 2: Background refresh / sync from cloud
    try {
      const [cloudProducts, cloudCategories, allWarehouses, allWarehouseStocks] = await Promise.all([
        navigator.onLine ? refreshProductsFromCloud() : loadProductsCloud(),
        getCategoryNamesCloud(),
        loadWarehousesCloud(),
        fetchAllWarehouseStocksCloud()
      ]);

      if (cloudProducts.length > 0) {
        setProducts(cloudProducts);
      }
      if (cloudCategories.length > 0) {
        setCategoryOptions(cloudCategories);
      }
      setWarehouses(allWarehouses);
      setWarehouseStocks(allWarehouseStocks);
    } catch (error) {
      console.warn('Error refreshing products from cloud:', error);
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  }, []);

  // Helper function to get custody quantity for a product
  const getCustodyQuantity = useCallback((productId: string): number => {
    // Sum all warehouse stock for this product (excluding main warehouse)
    const vehicleWarehouses = warehouses.filter(w => w.type === 'vehicle');
    const vehicleWarehouseIds = new Set(vehicleWarehouses.map(w => w.id));

    return warehouseStocks
      .filter(ws => ws.product_id === productId && vehicleWarehouseIds.has(ws.warehouse_id))
      .reduce((sum, ws) => sum + (ws.quantity || 0), 0);
  }, [warehouses, warehouseStocks]);

  // Get custody breakdown by warehouse
  const getCustodyBreakdown = useCallback((productId: string): { warehouseName: string; quantity: number }[] => {
    const vehicleWarehouses = warehouses.filter(w => w.type === 'vehicle');

    return vehicleWarehouses
      .map(w => {
        const stock = warehouseStocks.find(ws => ws.product_id === productId && ws.warehouse_id === w.id);
        return {
          warehouseName: w.name,
          quantity: stock?.quantity || 0
        };
      })
      .filter(item => item.quantity > 0);
  }, [warehouses, warehouseStocks]);

  // Load archived products from cloud (supports background silent load)
  const loadArchivedData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsArchiveLoading(true);
    }
    try {
      const archived = await loadArchivedProductsCloud();
      setArchivedProducts(archived);
    } catch (err) {
      console.warn('[Products] Error loading archived products:', err);
    } finally {
      if (!isBackground) {
        setIsArchiveLoading(false);
      }
    }
  }, []);

  // تتبع ما إذا كانت أي نافذة تفاعلية مفتوحة لمنع مقاطعة المستخدم أثناء العمل
  const isAnyProductModalOpenRef = useRef(false);
  isAnyProductModalOpenRef.current = Boolean(
    showAddDialog || showEditDialog || showDeleteDialog || showRestockDialog || showHardDeleteDialog
  );
  const pendingProductRefreshRef = useRef(false);

  // Memory leak prevention - proper cleanup for storage events
  useEffect(() => {
    loadData();
    loadArchivedData();

    const handleProductsUpdated = () => {
      // 🛡️ إذا كانت هناك نافذة مفتوحة تفاعلية (إضافة/تعديل/توريد)، نؤجل التحديث حتى تغلق
      if (isAnyProductModalOpenRef.current) {
        pendingProductRefreshRef.current = true;
        return;
      }
      // 🚀 تحديث صامت في الخلفية دائماً لتجنب الوميض وفقدان التركيز أو التمرير
      loadData(true);
      loadArchivedData(true);
    };

    const handleCategoriesUpdated = () => {
      if (isAnyProductModalOpenRef.current) {
        pendingProductRefreshRef.current = true;
        return;
      }
      loadData(true);
    };

    window.addEventListener(EVENTS.PRODUCTS_UPDATED, handleProductsUpdated);
    window.addEventListener(EVENTS.CATEGORIES_UPDATED, handleCategoriesUpdated);
    window.addEventListener(EVENTS.APP_REFRESH, handleProductsUpdated);

    return () => {
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, handleProductsUpdated);
      window.removeEventListener(EVENTS.CATEGORIES_UPDATED, handleCategoriesUpdated);
      window.removeEventListener(EVENTS.APP_REFRESH, handleProductsUpdated);
    };
  }, [loadData, loadArchivedData]);

  // تنفيذ أي تحديث مؤجل عند إغلاق النوافذ المنبثقة
  useEffect(() => {
    const isAnyOpen = showAddDialog || showEditDialog || showDeleteDialog || showRestockDialog || showHardDeleteDialog;
    if (!isAnyOpen && pendingProductRefreshRef.current) {
      pendingProductRefreshRef.current = false;
      loadData(true);
      loadArchivedData(true);
    }
  }, [showAddDialog, showEditDialog, showDeleteDialog, showRestockDialog, showHardDeleteDialog, loadData, loadArchivedData]);

  // Auto-open add dialog from URL params
  // ✅ يُنفَّذ مرة واحدة فقط لكل طلب فتح، حتى لا يُمسح ما يكتبه المستخدم عند تحديث الفئات
  const autoOpenHandledRef = useRef(false);
  useEffect(() => {
    if (searchParams.get('action') !== 'new') {
      autoOpenHandledRef.current = false;
      return;
    }
    if (autoOpenHandledRef.current) return;
    autoOpenHandledRef.current = true;
    setFormData({ name: '', barcode: '', barcode2: '', barcode3: '', variantLabel: '', category: categoryOptions[0] || t('products.defaultCategory'), costPrice: 0, salePrice: 0, laborCost: 0, quantity: 0, expiryDate: '', image: '', serialNumber: '', batchNumber: '', warranty: '', wholesalePrice: 0, size: '', color: '', minStockLevel: 1, weight: '', fabricType: '', tableNumber: '', orderNotes: '', author: '', publisher: '', bulkUnit: t('products.unitCarton'), smallUnit: t('products.unitPiece'), conversionFactor: 1, bulkCostPrice: 0, bulkSalePrice: 0, trackByUnit: 'piece' });
    setShowAddDialog(true);
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  // ✅ استعادة الباركود المعلق بعد إعادة بناء Activity على Android
  useEffect(() => {
    const processPendingBarcode = () => {
      try {
        const pendingBarcode = localStorage.getItem('hyperpos_pending_scan');
        const pendingScanTarget = localStorage.getItem('hyperpos_scan_target') || 'form';
        if (pendingBarcode) {
          const cleanBarcode = pendingBarcode.trim();
          console.log('[Products] Found pending barcode on mount:', cleanBarcode, 'target:', pendingScanTarget);

          if (pendingScanTarget === 'barcode2') {
            setFormData(prev => ({ ...prev, barcode2: cleanBarcode }));
            setShowBarcode2(true);
          } else if (pendingScanTarget === 'barcode3') {
            setFormData(prev => ({ ...prev, barcode3: cleanBarcode }));
            setShowBarcode3(true);
          } else if (pendingScanTarget === 'search') {
            setSearchQuery(cleanBarcode);
          } else if (pendingScanTarget === 'archive') {
            setArchiveSearchQuery(cleanBarcode);
            setMainTab('archive');
          } else {
            setFormData(prev => ({ ...prev, barcode: cleanBarcode }));
            if (!showAddDialog && !showEditDialog) {
              setShowAddDialog(true);
            }
          }

          // مسح البيانات المعلقة فقط بعد المعالجة الناجحة
          localStorage.removeItem('hyperpos_pending_scan');
          localStorage.removeItem('hyperpos_scan_target');
          toast.success('تم قراءة الباركود', { description: cleanBarcode });
        }
      } catch (e) {
        console.warn('[Products] Error restoring pending barcode:', e);
      }
    };

    // Delay slightly to ensure form state is ready
    const timer = setTimeout(processPendingBarcode, 500);

    // Also listen for barcode-restored events
    const handleBarcodeRestored = (e: Event) => {
      const barcode = (e as CustomEvent).detail;
      if (barcode && typeof barcode === 'string') {
        console.log('[Products] Received barcode-restored event:', barcode);
        const target = localStorage.getItem('hyperpos_scan_target') || 'form';
        if (target === 'search') {
          setSearchQuery(barcode.trim());
        } else {
          setFormData(prev => ({ ...prev, barcode: barcode.trim() }));
        }
        localStorage.removeItem('hyperpos_pending_scan');
        localStorage.removeItem('hyperpos_scan_target');
        toast.success('تم قراءة الباركود', { description: barcode.trim() });
      }
    };
    window.addEventListener('barcode-restored', handleBarcodeRestored);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('barcode-restored', handleBarcodeRestored);
    };
  }, []);

  // Handle gallery selection using Capacitor Camera plugin
  const handleGallerySelect = async () => {
    try {
      const base64Image = await pickFromGallery();
      if (base64Image) {
        // Show preview immediately — Offline-First
        setImagePreviewBase64(base64Image);
        setFormData(prev => ({ ...prev, image: base64Image }));
        // ✅ Offline-First: NO cloud upload here — sync happens after product save
      }
    } catch (err) {
      console.error('Gallery select error:', err);
    }
  };

  // Handle camera capture using Capacitor Camera plugin
  // CRITICAL: Save form state to localStorage BEFORE opening native camera
  // Android may kill and recreate the Activity when camera app runs (memory pressure).
  // The persisted state is already being saved reactively via useEffect above,
  // but we force-save synchronously here to guarantee it's written before the OS
  // suspends our process.
  const handleCameraCapture = async () => {
    try {
      // Force-persist current form state synchronously before launching camera
      const stateToSave = {
        formData,
        customFieldValues,
        isAdd: showAddDialog,
        isEdit: showEditDialog,
        selectedProductId: selectedProduct?.id,
        cameraPending: true,
        timestamp: Date.now()
      };
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(stateToSave));

      const base64Image = await takePhoto();
      if (base64Image) {
        // Show preview immediately — Offline-First
        setImagePreviewBase64(base64Image);
        // Store base64 temporarily — will be replaced with cloud path before save
        setFormData(prev => ({ ...prev, image: base64Image }));
        // Also store in localStorage so it survives APK reload
        localStorage.setItem(RESTORED_IMAGE_KEY, base64Image);
      }
    } catch (err) {
      console.error('Camera capture error:', err);
    }
  };

  /**
   * If the current image is still a base64 string (not yet uploaded),
   * upload it now and return the cloud path.
   * This handles the APK case where background upload may not have finished.
   * 
   * IMPORTANT: uploadProductImage already compresses to ≤30KB and falls back
   * to returning the compressed base64 if cloud upload fails — so we ALWAYS
   * return a usable image value (never empty unless original was empty).
   */
  /**
   * Offline-First image strategy:
   * 1. Always compress image locally to ≤30KB
   * 2. Save compressed base64 WITH the product (works offline)
   * 3. After product is saved, attempt cloud upload in background
   * 4. If upload succeeds, update the product's image_url silently
   * 
   * This ensures ZERO network dependency during product save.
   */
  const ensureImageCompressed = async (imageValue: string): Promise<string> => {
    if (!imageValue) return '';
    // Already a cloud path or URL — return as-is
    if (!imageValue.startsWith('data:')) return imageValue;
    // Compress locally to ≤30KB — guaranteed to work offline
    try {
      const { compressImageOffline } = await import('@/lib/image-upload');
      const compressed = await compressImageOffline(imageValue);
      console.log('[Image] Compressed locally for offline save');
      return compressed;
    } catch (e) {
      console.error('[ensureImageCompressed] Compression failed:', e);
      return imageValue;
    }
  };

  /**
   * Background sync: upload image to cloud AFTER product is saved
   */
  const syncImageToCloud = async (productId: string, imageValue: string) => {
    if (!imageValue || !imageValue.startsWith('data:')) return;
    try {
      const { uploadProductImage } = await import('@/lib/image-upload');
      const cloudPath = await uploadProductImage(imageValue);
      if (cloudPath && !cloudPath.startsWith('data:')) {
        // Update product in DB with cloud path silently
        await updateProductCloud(productId, { image: cloudPath });
        console.log('[Image] ✅ Synced to cloud:', cloudPath);
      }
    } catch (e) {
      console.warn('[Image] Background sync failed, will retry later:', e);
    }
  };

  // Handle inline camera capture (fallback when native camera fails)
  // ✅ Offline-First: just store locally, sync happens after product save
  const handleInlineCaptured = useCallback((base64Image: string) => {
    onInlineCaptured(base64Image);
    // Show preview immediately — no network needed
    setImagePreviewBase64(base64Image);
    setFormData(prev => ({ ...prev, image: base64Image }));
  }, [onInlineCaptured]);

  // Reload categories from cloud
  const reloadCategories = useCallback(async () => {
    const cats = await getCategoryNamesCloud();
    setCategoryOptions(cats);
  }, []);

  // Get categories used by products (cannot be deleted)
  const usedCategories = [...new Set(products.map(p => p.category))];

  const categories = [t('products.all'), ...categoryOptions];

  // دمج المنتجات المؤرشفة مع المنتجات المنتهية (quantity <= 0) دون تكرار
  const mergedArchivedProducts = useMemo(() => {
    const list = [...archivedProducts];
    const seenIds = new Set(list.map(p => p.id));

    if (!noInventory) {
      for (const p of products) {
        if (p.quantity <= 0 && !seenIds.has(p.id)) {
          list.push(p);
          seenIds.add(p.id);
        }
      }
    }
    return list;
  }, [archivedProducts, products, noInventory]);

  const [archiveFilter, setArchiveFilter] = useState<'all' | 'out_of_stock' | 'manual_archived' | 'ready_to_restore'>('all');

  const archiveStats = useMemo(() => {
    const total = mergedArchivedProducts.length;
    const outOfStock = mergedArchivedProducts.filter(p => p.quantity <= 0).length;
    const manualArchived = mergedArchivedProducts.filter(p => p.archived).length;
    return { total, outOfStock, manualArchived };
  }, [mergedArchivedProducts]);

  // Memoized filtered archived products for archive search
  const filteredArchivedProducts = useMemo(() => {
    const q = archiveSearchQuery.trim().toLowerCase();
    return mergedArchivedProducts.filter(p => {
      if (archiveFilter === 'out_of_stock' && p.quantity > 0) return false;
      if (archiveFilter === 'manual_archived' && !p.archived) return false;
      if (archiveFilter === 'ready_to_restore' && !p.archived) return false;
      if (!q) return true;
      const matchesName = (p.name || '').toLowerCase().includes(q);
      const matchesBarcode1 = (p.barcode || '').toLowerCase().includes(q);
      const matchesBarcode2 = (p.barcode2 || '').toLowerCase().includes(q);
      const matchesBarcode3 = (p.barcode3 || '').toLowerCase().includes(q);
      const matchesCategory = (p.category || '').toLowerCase().includes(q);
      return matchesName || matchesBarcode1 || matchesBarcode2 || matchesBarcode3 || matchesCategory;
    });
  }, [mergedArchivedProducts, archiveSearchQuery, archiveFilter]);

  // Memoized filtered results for performance (Active products)
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      if (product.archived) return false;

      // استبعاد المنتجات المنتهية تماماً من قسم النشطة (تذهب حصراً للأرشيف)
      if (!noInventory && product.quantity <= 0) return false;

      // تصفية حسب حالة التوفر المتبقية (متوفر / منخفض)
      if (!noInventory) {
        if (statusFilter === 'in_stock') {
          if (product.quantity <= (product.minStockLevel || 5)) return false;
        } else if (statusFilter === 'low_stock') {
          const minStock = product.minStockLevel || 5;
          if (product.quantity > minStock) return false;
        }
      } else {
        if (statusFilter !== 'all' && product.status !== statusFilter) return false;
      }

      const matchesSearch = !debouncedSearch ||
        product.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        product.barcode.includes(debouncedSearch);
      const matchesCategory = selectedCategory === t('products.all') || product.category === selectedCategory;
      const matchesUnit = unitFilter === 'all' ||
        (unitFilter === 'multi_unit' && product.conversionFactor && product.conversionFactor > 1) ||
        (unitFilter === 'single_unit' && (!product.conversionFactor || product.conversionFactor <= 1));
      return matchesSearch && matchesCategory && matchesUnit;
    });
  }, [products, noInventory, debouncedSearch, selectedCategory, statusFilter, unitFilter, t]);

  const activeProductsCount = useMemo(() => {
    return products.filter(p => !p.archived && (noInventory || p.quantity > 0)).length;
  }, [products, noInventory]);

  const stats = {
    total: activeProductsCount,
    inStock: products.filter(p => !p.archived && (noInventory || p.quantity > 0) && (noInventory ? p.status === 'in_stock' : p.quantity > (p.minStockLevel || 5))).length,
    lowStock: products.filter(p => !p.archived && (noInventory || p.quantity > 0) && (noInventory ? p.status === 'low_stock' : p.quantity <= (p.minStockLevel || 5))).length,
    outOfStock: products.filter(p => !p.archived && p.quantity <= 0).length,
    multiUnit: products.filter(p => !p.archived && (noInventory || p.quantity > 0) && p.conversionFactor && p.conversionFactor > 1).length,
  };

  const openQuickRestock = (product: Product) => {
    setRestockProduct(product);
    setRestockQuantity('10');
    setShowRestockDialog(true);
  };

  const handleQuickRestock = async () => {
    if (!restockProduct) return;
    const qty = Number(toWesternNumerals(restockQuantity));
    if (isNaN(qty) || qty <= 0) {
      toast.error('يرجى إدخال كمية صالحة أكبر من صفر');
      return;
    }

    setIsRestocking(true);
    try {
      const success = await updateProductCloud(restockProduct.id, {
        quantity: qty,
        archived: false,
      });

      if (success) {
        if (user) {
          addActivityLog(
            'product_updated',
            user.id,
            profile?.full_name || user.email || t('products.defaultUser'),
            `إعادة تزويد المنتج "${restockProduct.name}" بالكمية ${qty}`,
            {
              productId: restockProduct.id,
              name: restockProduct.name,
              previousQuantity: restockProduct.quantity,
              newQuantity: qty,
            }
          );
        }
        toast.success(`تمت إعادة تزويد "${restockProduct.name}" بنجاح (${qty}) وعاد لنقطة البيع والمنتجات النشطة!`);
        setShowRestockDialog(false);
        setRestockProduct(null);
        await loadData();
        await loadArchivedData();
      } else {
        toast.error('تعذر تحديث كمية المنتج، يرجى المحاولة ثانية');
      }
    } catch (e) {
      console.error('Quick restock error:', e);
      toast.error('حدث خطأ أثناء حفظ الكمية');
    } finally {
      setIsRestocking(false);
    }
  };

  const handleAddProduct = async () => {
    // ✅ منع النقر المتعدد
    if (isSaving) return;

    // 1. فحص اسم المنتج
    if (!formData.name || !formData.name.trim()) {
      toast.error('يجب كتابة اسم المنتج');
      return;
    }

    // 2. فحص سعر البيع
    const salePriceNum = Number(formData.salePrice);
    const bulkSalePriceNum = Number(formData.bulkSalePrice);
    if (!(salePriceNum > 0) && !(bulkSalePriceNum > 0)) {
      toast.error('يرجى تحديد سعر بيع صالح أكبر من 0');
      return;
    }

    // 3. فحص تكرار الباركود قبل الإضافة
    const trimmedBarcode = (formData.barcode || '').trim();
    const effectiveBarcode = trimmedBarcode || `AUTO${Date.now()}`;
    const barcodesToCheck = [effectiveBarcode, formData.barcode2, formData.barcode3]
      .map(b => (b || '').trim())
      .filter(b => b && !b.startsWith('AUTO'));

    for (const bc of barcodesToCheck) {
      const duplicate = products.find(p =>
        p.barcode === bc || p.barcode2 === bc || p.barcode3 === bc
      );
      if (duplicate) {
        toast.error(`هذا الباركود مستخدم بالفعل لمنتج آخر: ${duplicate.name}`);
        return;
      }
    }

    // Validate required custom fields
    for (const field of customFields) {
      if (field.required && !customFieldValues[field.id]) {
        toast.error(`حقل "${field.name}" مطلوب`);
        return;
      }
    }

    setIsSaving(true);

    // ✅ Offline-First: ضغط الصورة محلياً فقط (بدون انتظار الشبكة)
    const finalImage = await ensureImageCompressed(formData.image);

    // تحويل الأرقام بشكل آمن عبر محرك العملات الموحد
    const numCostPrice = parseFormPriceToUsd(formData.costPrice);
    const numSalePrice = parseFormPriceToUsd(formData.salePrice);
    const numLaborCost = parseFormPriceToUsd(formData.laborCost);
    const numQuantity = Number(formData.quantity) || 0;
    const numWholesalePrice = parseFormPriceToUsd(formData.wholesalePrice);
    const numMinStockLevel = Number(formData.minStockLevel) || 1;
    const numConversionFactor = Number(formData.conversionFactor) || 1;
    const numBulkSalePrice = parseFormPriceToUsd(formData.bulkSalePrice);

    // تحويل الكمية إلى قطع قبل الحفظ - في وضع الفرن، استخدم كمية كبيرة
    const quantityInPieces = noInventory
      ? 99999
      : (formData.trackByUnit === 'bulk'
        ? numQuantity * numConversionFactor
        : numQuantity);

    // حساب سعر تكلفة الكرتونة تلقائياً
    const calculatedBulkCostPrice = numCostPrice * numConversionFactor;

    const productData = {
      ...formData,
      image: finalImage, // ✅ استخدم مسار السحابة أو فارغ (ليس base64 ضخم)
      barcode: effectiveBarcode,
      costPrice: noInventory && !isRepairMode ? 0 : numCostPrice,
      salePrice: numSalePrice,
      wholesalePrice: numWholesalePrice,
      laborCost: isRepairMode ? numLaborCost : 0,
      quantity: quantityInPieces, // الكمية دائماً بالقطع
      bulkCostPrice: noInventory ? 0 : calculatedBulkCostPrice,
      bulkSalePrice: numBulkSalePrice,
      minStockLevel: numMinStockLevel,
      conversionFactor: numConversionFactor,
      expiryDate: formData.expiryDate || undefined,
      customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
    };

    const newProduct = await addProductCloud(productData);

    if (newProduct) {
      // Log activity
      if (user) {
        addActivityLog(
          'product_added',
          user.id,
          profile?.full_name || user.email || t('products.defaultUser'),
          `تم {t('products.addProductTitle')}: ${formData.name}`,
          { productId: newProduct.id, name: formData.name, barcode: formData.barcode }
        );
      }

      // ✅ Background sync: upload image to cloud AFTER product saved
      if (finalImage.startsWith('data:')) {
        syncImageToCloud(newProduct.id, finalImage);
      }

      setShowAddDialog(false);
      setImagePreviewBase64('');
      setFormData({ name: '', barcode: '', barcode2: '', barcode3: '', variantLabel: '', category: t('products.defaultCategory'), costPrice: 0, salePrice: 0, laborCost: 0, quantity: 0, expiryDate: '', image: '', serialNumber: '', batchNumber: '', warranty: '', wholesalePrice: 0, size: '', color: '', minStockLevel: 1, weight: '', fabricType: '', tableNumber: '', orderNotes: '', author: '', publisher: '', bulkUnit: t('products.unitCarton'), smallUnit: t('products.unitPiece'), conversionFactor: 1, bulkCostPrice: 0, bulkSalePrice: 0, trackByUnit: 'piece' });
      setShowBarcode2(false);
      setShowBarcode3(false);
      setCustomFieldValues({});
      clearPersistedState(); // Clear persistence on success
      toast.success(t('products.addSuccess'));
      loadData();
    } else {
      toast.error('فشل في إضافة المنتج', {
        description: 'تعذر الحفظ في قاعدة البيانات. تحقق من صحة البيانات أو الصلاحيات.'
      });
    }

    setIsSaving(false);
  };

  const handleEditProduct = async () => {
    if (!selectedProduct) return;

    // 1. فحص اسم المنتج
    if (!formData.name || !formData.name.trim()) {
      toast.error('يجب كتابة اسم المنتج');
      return;
    }

    // 2. فحص سعر البيع
    const salePriceNum = Number(formData.salePrice);
    const bulkSalePriceNum = Number(formData.bulkSalePrice);
    if (!(salePriceNum > 0) && !(bulkSalePriceNum > 0)) {
      toast.error('يرجى تحديد سعر بيع صالح أكبر من 0');
      return;
    }

    // 3. فحص تكرار الباركود لمنتج آخر
    const barcodesToCheck = [formData.barcode, formData.barcode2, formData.barcode3]
      .map(b => (b || '').trim())
      .filter(b => b && !b.startsWith('AUTO'));

    for (const bc of barcodesToCheck) {
      const duplicate = products.find(p =>
        p.id !== selectedProduct.id &&
        (p.barcode === bc || p.barcode2 === bc || p.barcode3 === bc)
      );
      if (duplicate) {
        toast.error(`هذا الباركود مستخدم بالفعل لمنتج آخر: ${duplicate.name}`);
        return;
      }
    }

    // Validate required custom fields
    for (const field of customFields) {
      if (field.required && !customFieldValues[field.id]) {
        toast.error(`حقل "${field.name}" مطلوب`);
        return;
      }
    }

    setIsSaving(true);

    // ✅ Offline-First: ضغط الصورة محلياً فقط (بدون انتظار الشبكة)
    const finalImage = await ensureImageCompressed(formData.image);

    // تحويل الأرقام بشكل آمن عبر محرك العملات الموحد
    const numCostPrice = parseFormPriceToUsd(formData.costPrice);
    const numSalePrice = parseFormPriceToUsd(formData.salePrice);
    const numLaborCost = parseFormPriceToUsd(formData.laborCost);
    const numQuantity = Number(formData.quantity) || 0;
    const numWholesalePrice = parseFormPriceToUsd(formData.wholesalePrice);
    const numMinStockLevel = Number(formData.minStockLevel) || 1;
    const numConversionFactor = Number(formData.conversionFactor) || 1;
    const numBulkSalePrice = parseFormPriceToUsd(formData.bulkSalePrice);

    // تحويل الكمية إلى قطع قبل الحفظ (دائماً نحفظ بالقطع)
    const quantityInPieces = formData.trackByUnit === 'bulk'
      ? numQuantity * numConversionFactor
      : numQuantity;

    // حساب سعر تكلفة الكرتونة تلقائياً
    const calculatedBulkCostPrice = numCostPrice * numConversionFactor;

    // ✅ حماية الصورة: إذا أصبحت فارغة لكن المنتج لديه صورة سابقة، نحافظ عليها
    // (الحذف العمدي يستخدم قيمة خاصة '__CLEAR__')
    const previousImage = selectedProduct?.image || '';
    const imageToSave = finalImage && finalImage.length > 0
      ? finalImage
      : (previousImage || '');

    const isRestoring = selectedProduct.archived === true;

    const productData = {
      ...formData,
      image: imageToSave,
      costPrice: noInventory && !isRepairMode ? 0 : numCostPrice,
      salePrice: numSalePrice,
      wholesalePrice: numWholesalePrice,
      laborCost: isRepairMode ? numLaborCost : 0,
      quantity: quantityInPieces, // الكمية دائماً بالقطع
      bulkCostPrice: calculatedBulkCostPrice, // سعر التكلفة محسوب تلقائياً
      bulkSalePrice: numBulkSalePrice,
      minStockLevel: numMinStockLevel,
      conversionFactor: numConversionFactor,
      expiryDate: formData.expiryDate || undefined,
      customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
      archived: false, // ✅ تأكيد إزالة الأرشفة عند الحفظ أو الاسترداد
    };

    const success = await updateProductCloud(selectedProduct.id, productData);

    if (success) {
      // Log activity
      if (user) {
        addActivityLog(
          isRestoring ? 'product_added' : 'product_updated',
          user.id,
          profile?.full_name || user.email || t('products.defaultUser'),
          isRestoring ? `تم استرداد وتحديث منتج من الأرشيف: ${formData.name}` : `تم تعديل منتج: ${formData.name}`,
          {
            productId: selectedProduct.id,
            name: formData.name,
            quantity: quantityInPieces,
            changes: diffFields(
              selectedProduct,
              { ...selectedProduct, ...productData },
              ['name', 'barcode', 'category', 'salePrice', 'costPrice', 'quantity']
            ),
          }
        );
      }

      // ✅ Background sync: upload image to cloud AFTER product saved
      if (finalImage.startsWith('data:')) {
        syncImageToCloud(selectedProduct.id, finalImage);
      }

      setShowEditDialog(false);
      setImagePreviewBase64('');
      setSelectedProduct(null);
      setCustomFieldValues({});
      clearPersistedState(); // Clear persistence on success

      if (isRestoring) {
        setArchivedProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
        toast.success(`تم استرداد المنتج "${formData.name}" وإعادته لقائمة المنتجات بنجاح!`);
      } else {
        toast.success(t('products.editSuccess'));
      }

      loadData();
      loadArchivedData();
    } else {
      toast.error(isRestoring ? 'فشل استرداد المنتج من الأرشيف' : 'فشل في تعديل المنتج', {
        description: 'تعذر حفظ التعديلات في قاعدة البيانات. تحقق من صحة البيانات أو الصلاحيات.'
      });
    }

    setIsSaving(false);
  };

  const handleDeleteProduct = () => deleteGuard.run(async () => {
    if (!selectedProduct) return;
    const productSnapshot = selectedProduct;
    const toastId = `delete-product-${productSnapshot.id}`;

    // Close dialog immediately for responsive UX
    setShowDeleteDialog(false);
    setSelectedProduct(null);
    toast.loading(`جاري حذف: ${productSnapshot.name}`, { id: toastId });

    try {
      const success = await deleteProductCloud(productSnapshot.id);
      if (success) {
        setProducts(prev => prev.filter(p => p.id !== productSnapshot.id));
        if (user) {
          addActivityLog(
            'product_deleted',
            user.id,
            profile?.full_name || user.email || t('products.defaultUser'),
            `تم حذف منتج: ${productSnapshot.name}`,
            {
              productId: productSnapshot.id,
              name: productSnapshot.name,
              snapshot: {
                name: productSnapshot.name,
                barcode: productSnapshot.barcode,
                category: productSnapshot.category,
                salePrice: productSnapshot.salePrice,
                costPrice: productSnapshot.costPrice,
                quantity: productSnapshot.quantity,
              },
            }
          );
        }
        toast.success(t('products.deleteSuccess'), { id: toastId });
      } else {
        toast.error(t('products.deleteFailed'), { id: toastId });
      }
    } catch (err) {
      console.error('[handleDeleteProduct]', err);
      toast.error(t('products.deleteFailed'), { id: toastId });
    }
  });

  // {t('products.permanentDeleteTitle')} المؤرشف من السحابة والذاكرة وقاعدة البيانات
  const handleHardDeleteArchived = () => deleteGuard.run(async () => {
    if (!archivedProductToDelete) return;
    const target = archivedProductToDelete;
    const toastId = `hard-delete-${target.id}`;

    setShowHardDeleteDialog(false);
    setArchivedProductToDelete(null);
    toast.loading(`جاري الحذف النهائي: ${target.name}...`, { id: toastId });

    try {
      const success = await deleteProductCloud(target.id);
      if (success) {
        setArchivedProducts(prev => prev.filter(p => p.id !== target.id));
        if (user) {
          addActivityLog(
            'product_deleted',
            user.id,
            profile?.full_name || user.email || t('products.defaultUser'),
            `تم حذف المنتج نهائياً من الأرشيف والسحابة: ${target.name}`,
            {
              productId: target.id,
              name: target.name,
              barcode: target.barcode,
            }
          );
        }
        toast.success(`تم حذف المنتج "${target.name}" ومخزونه نهائياً من السحابة`, { id: toastId });
        loadData();
      } else {
        toast.error('تعذر حذف المنتج نهائياً من قاعدة البيانات', { id: toastId });
      }
    } catch (err) {
      console.error('[handleHardDeleteArchived]', err);
      toast.error('حدث خطأ أثناء محاولة الحذف النهائي للمنتج', { id: toastId });
    }
  });

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);

    // الكمية في قاعدة البيانات دائماً بالقطع
    // نحولها للوحدة المستخدمة للتتبع عند العرض
    const trackByUnit = product.trackByUnit || 'piece';
    const conversionFactor = product.conversionFactor || 1;
    const quantityForDisplay = trackByUnit === 'bulk'
      ? Math.floor(product.quantity / conversionFactor)
      : product.quantity;

    const toActiveCurrency = (usdVal: number) => {
      if (!usdVal) return 0;
      if (m.activeCode === 'USD') return usdVal;
      const converted = m.fromUsd(usdVal, m.activeCode, m.activeRate);
      return m.roundForCurrency(converted, m.activeCode);
    };

    setFormData({
      name: product.name,
      barcode: product.barcode,
      barcode2: product.barcode2 || '',
      barcode3: product.barcode3 || '',
      variantLabel: product.variantLabel || '',
      category: product.category,
      costPrice: toActiveCurrency(product.costPrice),
      salePrice: toActiveCurrency(product.salePrice),
      laborCost: toActiveCurrency(product.laborCost || 0),
      quantity: quantityForDisplay,
      expiryDate: product.expiryDate || '',
      image: product.image || '',
      serialNumber: product.serialNumber || '',
      batchNumber: product.batchNumber || '',
      warranty: product.warranty || '',
      wholesalePrice: toActiveCurrency(product.wholesalePrice || 0),
      size: product.size || '',
      color: product.color || '',
      minStockLevel: product.minStockLevel || 1,
      weight: product.weight || '',
      fabricType: product.fabricType || '',
      tableNumber: product.tableNumber || '',
      orderNotes: product.orderNotes || '',
      author: product.author || '',
      publisher: product.publisher || '',
      // Unit settings
      bulkUnit: product.bulkUnit || t('products.unitCarton'),
      smallUnit: product.smallUnit || t('products.unitPiece'),
      conversionFactor: conversionFactor,
      bulkCostPrice: toActiveCurrency(product.bulkCostPrice || 0),
      bulkSalePrice: toActiveCurrency(product.bulkSalePrice || 0),
      trackByUnit: trackByUnit,
    });
    // Check if product has unit settings to auto-expand
    if (product.conversionFactor && product.conversionFactor > 1) {
      setShowUnitSettings(true);
    }
    // Load custom field values from product
    setCustomFieldValues(product.customFields || {});
    setShowEditDialog(true);
  };

  const openDeleteDialog = (product: Product) => {
    setSelectedProduct(product);
    setShowDeleteDialog(true);
  };

  const openBarcodeScannerForForm = () => {
    setScanTarget('form');
    // حفظ scanTarget في localStorage لاستعادته بعد Activity Recreation
    try { localStorage.setItem('hyperpos_scan_target', 'form'); } catch { /* ignore */ }
    setScannerOpen(true);
  };

  // دالة توحيد وترجمة الوحدات حسب لغة النظام
  const getLocalizedUnit = (rawUnit: string | undefined, isBulk: boolean = false): string => {
    return localizeProductUnit(rawUnit, isBulk, language);
  };

  // التحكم في ظهور واختفاء الزر العائم لإضافة منتج مع حركة التمرير
  const [isFabVisible, setIsFabVisible] = useState(true);
  const lastScrollTopRef = useRef(0);

  const handleProductsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    if (currentScrollTop < 50) {
      // بالقرب من أعلى الصفحة يظهر الزر دائماً
      setIsFabVisible(true);
    } else if (currentScrollTop > lastScrollTopRef.current + 12) {
      // عند التمرير للأسفل لتصفح المنتجات الأقدم: يختفي الزر بسلاسة
      setIsFabVisible(false);
    } else if (currentScrollTop < lastScrollTopRef.current - 12) {
      // عند التمرير للأعلى باتجاه بداية الصفحة: يظهر الزر
      setIsFabVisible(true);
    }
    lastScrollTopRef.current = currentScrollTop;
  }, []);

  // إعادة إظهار الزر العائم تلقائياً عند تغيير التبويب واستماع التمرير على النافذة
  useEffect(() => {
    setIsFabVisible(true);
    const handleWindowScroll = () => {
      const currentScrollTop = window.scrollY || document.documentElement.scrollTop;
      if (currentScrollTop < 50) {
        setIsFabVisible(true);
      } else if (currentScrollTop > lastScrollTopRef.current + 12) {
        setIsFabVisible(false);
      } else if (currentScrollTop < lastScrollTopRef.current - 12) {
        setIsFabVisible(true);
      }
      lastScrollTopRef.current = currentScrollTop;
    };
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, [mainTab]);

  // دالة فتح نافذة إضافة منتج جديد
  const handleOpenAddProduct = useCallback(() => {
    setFieldsConfig(getEffectiveFieldsConfig());
    setFormData({
      name: '',
      barcode: '',
      barcode2: '',
      barcode3: '',
      variantLabel: '',
      category: categoryOptions[0] || t('products.defaultCategory'),
      costPrice: 0,
      salePrice: 0,
      laborCost: 0,
      quantity: 0,
      expiryDate: '',
      image: '',
      serialNumber: '',
      batchNumber: '',
      warranty: '',
      wholesalePrice: 0,
      size: '',
      color: '',
      minStockLevel: 1,
      weight: '',
      fabricType: '',
      tableNumber: '',
      orderNotes: '',
      author: '',
      publisher: '',
      bulkUnit: t('products.unitCarton'),
      smallUnit: t('products.unitPiece'),
      conversionFactor: 1,
      bulkCostPrice: 0,
      bulkSalePrice: 0,
      trackByUnit: 'piece',
    });
    setImagePreviewBase64('');
    setShowAddDialog(true);
  }, [categoryOptions, t]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background relative selection:bg-primary/20">

      {/* الشريط العلوي المباشر: النشطة (يمين) - التصنيفات (وسط) - الأرشيف (يسار) */}
      <div className={cn(
        "flex-shrink-0 px-3 md:px-6 pt-3 md:pt-4 pb-1.5 md:pb-2 max-w-full relative z-10",
        isRTL ? "pr-14 md:pr-6" : "pl-14 md:pl-6"
      )}>
        <div className="bg-muted/60 p-1 rounded-2xl grid grid-cols-3 gap-1 w-full sm:w-fit sm:min-w-[24rem] border border-border/40 shadow-xs select-none">
          {/* 1. النشطة (يمين في RTL) */}
          <button
            type="button"
            onClick={() => setMainTab('products')}
            className={cn(
              "rounded-xl p-1.5 sm:px-3.5 sm:py-2 text-[clamp(0.65rem,2.6vw,0.85rem)] font-bold min-w-0 leading-tight whitespace-normal text-center flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-colors duration-200 select-none cursor-pointer",
              mainTab === 'products'
                ? "bg-gradient-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            )}
          >
            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>{t('products.active') || 'النشطة'}</span>
          </button>

          {/* 2. التصنيفات (في المنتصف) */}
          <button
            type="button"
            onClick={() => setShowCategoryManager(true)}
            className="rounded-xl p-1.5 sm:px-3.5 sm:py-2 text-[clamp(0.65rem,2.6vw,0.85rem)] font-bold min-w-0 leading-tight whitespace-normal text-center flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-colors duration-200 select-none text-muted-foreground hover:text-foreground hover:bg-card/60 cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-primary" />
            <span>{t('products.categories') || 'التصنيفات'}</span>
          </button>

          {/* 3. الأرشيف (يسار في RTL) - لون أحمر ناصع وثابت بأي ثيم عند النقر */}
          <button
            type="button"
            onClick={() => {
              setMainTab('archive');
              loadArchivedData();
            }}
            className={cn(
              "rounded-xl p-1.5 sm:px-3.5 sm:py-2 text-[clamp(0.65rem,2.6vw,0.85rem)] font-bold min-w-0 leading-tight whitespace-normal text-center flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-colors duration-200 select-none cursor-pointer",
              mainTab === 'archive'
                ? "!bg-red-600 !text-white shadow-xs shadow-red-600/30"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            )}
          >
            <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="flex items-center gap-1 justify-center">
              {t('products.archive') || 'الأرشيف'}
              {mergedArchivedProducts.length > 0 && (
                <span className={cn(
                  "px-1.5 py-0.2 text-[9px] rounded-full font-bold leading-none shrink-0",
                  mainTab === 'archive'
                    ? "bg-white/25 text-white"
                    : "bg-red-500/15 text-red-600 dark:text-red-400"
                )}>
                  {mergedArchivedProducts.length}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Stats - كبسولات إحصائيات مصغرة بنسبة 50% مع تقليل الارتفاع */}
      {!noInventory && (
        <div className="flex-shrink-0 px-3 md:px-6 pb-2 md:pb-2.5">
          {mainTab === 'archive' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 md:gap-3">
              <button
                type="button"
                onClick={() => setArchiveFilter('all')}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2.5 rounded-xl border bg-card/90 transition-colors select-none text-start cursor-pointer hover:border-red-500/40",
                  archiveFilter === 'all' ? "border-red-500 bg-red-500/10 ring-1 ring-red-500/30 shadow-2xs" : "border-border/60 hover:bg-muted/40"
                )}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                  <Archive className="w-3.5 h-3.5 text-red-500" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="text-xs sm:text-base font-bold text-foreground leading-none">{archiveStats.total}</span>
                  <span className="text-[9px] sm:text-xs text-muted-foreground truncate leading-none mt-0.5 sm:mt-0">{t('products.totalArchive') || 'إجمالي الأرشيف'}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setArchiveFilter('out_of_stock')}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2.5 rounded-xl border bg-card/90 transition-colors select-none text-start cursor-pointer hover:border-destructive/40",
                  archiveFilter === 'out_of_stock' ? "border-destructive bg-destructive/10 ring-1 ring-destructive/30 shadow-2xs" : "border-border/60 hover:bg-muted/40"
                )}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="text-xs sm:text-base font-bold text-foreground leading-none">{archiveStats.outOfStock}</span>
                  <span className="text-[9px] sm:text-xs text-muted-foreground truncate leading-none mt-0.5 sm:mt-0">{t('products.outOfStock') || 'نَفَذ'}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setArchiveFilter('manual_archived')}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2.5 rounded-xl border bg-card/90 transition-colors select-none text-start cursor-pointer hover:border-warning/40",
                  archiveFilter === 'manual_archived' ? "border-warning bg-warning/10 ring-1 ring-warning/30 shadow-2xs" : "border-border/60 hover:bg-muted/40"
                )}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
                  <Archive className="w-3.5 h-3.5 text-warning" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="text-xs sm:text-base font-bold text-foreground leading-none">{archiveStats.manualArchived}</span>
                  <span className="text-[9px] sm:text-xs text-muted-foreground truncate leading-none mt-0.5 sm:mt-0">{t('products.manuallyArchived') || 'مؤرشف يدوياً'}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setArchiveFilter('ready_to_restore')}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2.5 rounded-xl border bg-card/90 transition-colors select-none text-start cursor-pointer hover:border-emerald-500/40",
                  archiveFilter === 'ready_to_restore' ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30 shadow-2xs" : "border-border/60 hover:bg-muted/40"
                )}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="text-xs sm:text-base font-bold text-foreground leading-none">{archiveStats.manualArchived}</span>
                  <span className="text-[9px] sm:text-xs text-muted-foreground truncate leading-none mt-0.5 sm:mt-0">{t('products.readyToRestore') || 'جاهز للاسترداد'}</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 md:gap-3">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2.5 rounded-xl border bg-card/90 transition-colors select-none text-start cursor-pointer hover:border-primary/40",
                  statusFilter === 'all' ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-2xs" : "border-border/60 hover:bg-muted/40"
                )}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="text-xs sm:text-base font-bold text-foreground leading-none">{stats.total}</span>
                  <span className="text-[9px] sm:text-xs text-muted-foreground truncate leading-none mt-0.5 sm:mt-0">{t('products.total')}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('in_stock')}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2.5 rounded-xl border bg-card/90 transition-colors select-none text-start cursor-pointer hover:border-success/40",
                  statusFilter === 'in_stock' ? "border-success bg-success/10 ring-1 ring-success/30 shadow-2xs" : "border-border/60 hover:bg-muted/40"
                )}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 text-success" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="text-xs sm:text-base font-bold text-foreground leading-none">{stats.inStock}</span>
                  <span className="text-[9px] sm:text-xs text-muted-foreground truncate leading-none mt-0.5 sm:mt-0">{t('products.available')}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('low_stock')}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2.5 rounded-xl border bg-card/90 transition-colors select-none text-start cursor-pointer hover:border-warning/40",
                  statusFilter === 'low_stock' ? "border-warning bg-warning/10 ring-1 ring-warning/30 shadow-2xs" : "border-border/60 hover:bg-muted/40"
                )}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className="text-xs sm:text-base font-bold text-foreground leading-none">{stats.lowStock}</span>
                  <span className="text-[9px] sm:text-xs text-muted-foreground truncate leading-none mt-0.5 sm:mt-0">{t('products.low')}</span>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filters & Search - Fixed Geometry for Both Modes */}
      <div className="flex-shrink-0 px-3 md:px-6 pb-2 md:pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={mainTab === 'archive' ? t('products.searchArchivePlaceholder') : t('products.searchPlaceholder')}
                value={mainTab === 'archive' ? archiveSearchQuery : searchQuery}
                onChange={(e) => mainTab === 'archive' ? setArchiveSearchQuery(e.target.value) : setSearchQuery(e.target.value)}
                className="pr-9 md:pr-10 bg-muted border-0"
              />
              {mainTab === 'archive' && archiveSearchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setArchiveSearchQuery('')}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            {!isRestaurant && (
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 flex-shrink-0"
                onClick={() => {
                  setScanTarget(mainTab === 'archive' ? 'archive' : 'search');
                  try { localStorage.setItem('hyperpos_scan_target', mainTab === 'archive' ? 'archive' : 'search'); } catch { /* ignore */ }
                  setScannerOpen(true);
                }}
                title={mainTab === 'archive' ? t('products.scanBarcodeArchive') : undefined}
              >
                <ScanLine className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            )}
            
            {/* View Mode Buttons */}
            <div className="flex bg-muted rounded-lg p-0.5 shrink-0">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => setViewMode('list')}
              >
                <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
              <Button
                variant={viewMode === 'compact' ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => setViewMode('compact')}
              >
                <AlignJustify className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>

          {mainTab === 'archive' ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setArchiveFilter('all')}
                className={cn(
                  "px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
                  archiveFilter === 'all'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t('common.all') || 'الكل'} ({archiveStats.total})
              </button>
              <div className="h-6 w-px bg-border mx-1 self-center" />
              <div className="px-3 py-1 rounded-full text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5" />
                <span>{t('products.cloudArchive')}</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    "px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {category}
                </button>
              ))}

              {/* Unit Filter */}
              <div className="h-6 w-px bg-border mx-1 self-center" />
              <button
                onClick={() => setUnitFilter(unitFilter === 'multi_unit' ? 'all' : 'multi_unit')}
                className={cn(
                  "px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5",
                  unitFilter === 'multi_unit'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Boxes className="w-3.5 h-3.5" />
                {t('products.multiUnit')} ({stats.multiUnit})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content Area - Scrollable */}
      {mainTab === 'archive' ? (
        <div onScroll={handleProductsScroll} className="flex-1 overflow-y-auto px-3 md:px-6 pb-24 space-y-3 pt-2">
          {/* Archived Products List / Cards */}
          {isArchiveLoading && mergedArchivedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('products.loadingArchive')}</p>
            </div>
          ) : filteredArchivedProducts.length === 0 ? (
            <div className="bg-card rounded-xl border border-dashed border-border p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Archive className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {archiveSearchQuery ? t('products.noArchiveResults') : t('products.archiveEmpty')}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {archiveSearchQuery
                  ? (t('products.tryDifferentSearch') || 'جرب البحث باسم أو باركود آخر')
                  : (t('products.noArchivedOrOutOfStock') || 'لا توجد منتجات مؤرشفة أو منتهية المخزون حالياً.')}
              </p>
              {archiveSearchQuery && (
                <Button variant="outline" size="sm" onClick={() => setArchiveSearchQuery('')}>
                  {t('products.clearSearch')}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredArchivedProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-card rounded-xl border border-border/80 p-3.5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-3"
                >
                  <div className="flex gap-3 items-start">
                    {product.image ? (
                      <div
                        className="w-16 h-16 rounded-lg overflow-hidden border border-border/60 flex-shrink-0 cursor-pointer"
                        onClick={() => openImagePreview(product.image!)}
                      >
                        <ProductImage
                          imageUrl={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          iconClassName="w-5 h-5"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground border border-border/60">
                        <Package className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 justify-between">
                        <h4 className="font-bold text-sm text-foreground truncate" title={product.name}>
                          {product.name}
                        </h4>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0",
                          product.archived
                            ? "bg-destructive/15 text-destructive"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold"
                        )}>
                          {product.archived ? t('products.archived') : t('products.outOfStock')}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {product.category && (
                          <span className="inline-block px-1.5 py-0.5 bg-muted rounded text-[11px] ml-1">
                            {product.category}
                          </span>
                        )}
                        {product.barcode && (
                          <p className="font-mono text-[11px] truncate text-muted-foreground" dir="ltr">
                            {product.barcode}
                          </p>
                        )}
                        {product.barcode2 && (
                          <p className="font-mono text-[10px] truncate text-muted-foreground/80" dir="ltr">
                            {t('products.barcode2')}: {product.barcode2}
                          </p>
                        )}
                        {product.barcode3 && (
                          <p className="font-mono text-[10px] truncate text-muted-foreground/80" dir="ltr">
                            {t('products.barcode3')}: {product.barcode3}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1 mt-2.5 pt-2 border-t border-border/40 text-center">
                        <div className="bg-muted/40 p-1 rounded">
                          <span className="text-[10px] text-muted-foreground block">{t('products.salePrice')}</span>
                          <span className="font-bold text-xs text-foreground">{formatPrice(product.salePrice)}</span>
                        </div>
                        <div className="bg-muted/40 p-1 rounded">
                          <span className="text-[10px] text-muted-foreground block">{t('products.costPrice')}</span>
                          <span className="text-xs text-foreground/80">{formatPrice(product.costPrice)}</span>
                        </div>
                        <div className="bg-muted/40 p-1 rounded">
                          <span className="text-[10px] text-muted-foreground block">{t('products.currentStock')}</span>
                          <span className={cn("text-xs font-bold", product.quantity <= 0 ? "text-destructive" : "text-muted-foreground")}>
                            {formatNumber(product.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* إجراءات المنتج في الأرشيف: إعادة تزويد + تعديل + حذف/أرشفة */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-border/60">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      onClick={() => openQuickRestock(product)}
                      title={t('products.restockSubtitle') || 'إعادة تزويد الكمية'}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t('products.restock') || 'إعادة تزويد'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs px-2.5 font-medium"
                      onClick={() => openEditDialog(product)}
                      title={t('common.edit') || 'تعديل بيانات المنتج'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {t('common.edit') || 'تعديل'}
                    </Button>
                    {product.archived ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs px-2.5 font-medium"
                        onClick={() => {
                          setArchivedProductToDelete(product);
                          setShowHardDeleteDialog(true);
                        }}
                        title={t('products.permanentDeleteTitle') || 'حذف نهائي للمنتج'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('products.permanentDelete')}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs px-2 font-medium text-destructive hover:bg-destructive/10"
                        onClick={() => openDeleteDialog(product)}
                        title={t('products.archiveAction') || 'أرشفة المنتج'}
                      >
                        <Archive className="w-3.5 h-3.5" />
                        {t('products.archiveAction')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div onScroll={handleProductsScroll} className="flex-1 overflow-y-auto px-3 md:px-6 pb-24">
        {/* Products Display (3 Modes: Grid / Large, List / Medium, Compact / Small) */}
        {isLoading ? (
          <div className={cn(
            "gap-3",
            viewMode === 'grid'
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : viewMode === 'list'
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2"
          )}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-card rounded-2xl border border-border p-3 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="w-20 h-20 rounded-2xl" />
                </div>
                <Skeleton className="h-8 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center border border-border text-muted-foreground space-y-2">
            <span className="text-3xl block">🔍</span>
            <p className="font-bold text-xs">{t('products.noProductsFound') || 'لا توجد منتجات مطابقة للبحث أو التصنيف'}</p>
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid'
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
              : viewMode === 'list'
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 items-start"
          )}>
            {filteredProducts.map((product, index) => {
              const status = statusConfig[product.status];
              const profit = product.salePrice - product.costPrice;

              // 1. Compact View (الوضع الأصغر - مدمج ومقلص الفراغات تماماً)
              if (viewMode === 'compact') {
                return (
                  <div
                    key={product.id}
                    className="bg-card rounded-xl px-2.5 py-1.5 border border-border shadow-2xs hover:border-border/80 transition-colors text-xs space-y-1 fade-in"
                    style={{ animationDelay: `${index * 10}ms` }}
                  >
                    {/* Line 1: Full Product Name + Action Buttons on Left */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <h3
                        className="font-black text-foreground text-xs leading-tight truncate flex-1 min-w-0 cursor-pointer hover:text-primary transition-colors"
                        title={product.name}
                        onClick={() => openEditDialog(product)}
                      >
                        {product.name}
                      </h3>

                      {/* Compact Quick Actions */}
                      {canAddProducts && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditDialog(product)}
                            className="w-6 h-6 rounded-md bg-muted text-foreground/75 border border-border/70 hover:bg-muted/80 hover:text-foreground active:scale-90 transition-[colors,transform] flex items-center justify-center shadow-2xs"
                            title={t('common.edit') || 'تعديل'}
                          >
                            <Edit className="w-3 h-3 text-foreground/75" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteDialog(product)}
                            className="w-6 h-6 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 active:scale-90 transition-[colors,transform] flex items-center justify-center shadow-2xs"
                            title={t('common.delete') || 'حذف'}
                          >
                            <Trash2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Line 2: Stock on Right + Clean Buy & Sell Price Badges on Left */}
                    <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-dashed border-border/60 text-[11px]">
                      {/* Stock Count (Aligned to Right) */}
                      {!noInventory ? (
                        <div className="flex items-center gap-1 text-muted-foreground font-bold shrink-0">
                          <span className="text-muted-foreground/70 text-[10px]">{t('products.stock') || 'المخزون'}:</span>
                          <span className="font-mono text-foreground font-black text-xs">{product.quantity}</span>
                          <span className="text-muted-foreground/70 text-[10px] font-sans">
                            {product.conversionFactor && product.conversionFactor > 1
                              ? getLocalizedUnit(product.bulkUnit, true)
                              : getLocalizedUnit(product.smallUnit, false)}
                          </span>
                          {(() => {
                            const custodyQty = getCustodyQuantity(product.id);
                            const breakdown = getCustodyBreakdown(product.id);
                            if (custodyQty > 0) {
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center gap-0.5 text-[9.5px] text-primary font-medium mr-1 cursor-help">
                                        <Truck className="w-2.5 h-2.5" />
                                        {custodyQty} {t('products.custody') || 'عهدة'}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <div className="text-xs space-y-1">
                                        <div className="font-medium border-b pb-1 mb-1">{t('products.custodyBreakdown') || 'توزيع العهدة'}:</div>
                                        {breakdown.map((item, idx) => (
                                          <div key={idx} className="flex justify-between gap-3">
                                            <span>{item.warehouseName}:</span>
                                            <span className="font-medium">{item.quantity}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {product.category}
                        </div>
                      )}

                      {/* Buy & Sell Pricing (Aligned to Left) */}
                      <div className="flex items-center gap-1 font-mono font-bold text-[10.5px] shrink-0">
                        {!noInventory && (
                          <div className="flex items-center gap-1 bg-muted/40 px-1.5 py-0.5 rounded-md border border-border/70 shadow-2xs">
                            <span className="text-[8.5px] font-sans text-muted-foreground font-medium">{t('products.buy') || 'شراء'}:</span>
                            <span className="text-foreground">{formatPrice(product.costPrice)}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/20 shadow-2xs text-primary">
                          <span className="text-[8.5px] font-sans text-primary/80 font-medium">{t('products.sell') || 'بيع'}:</span>
                          <span className="text-foreground font-black">{formatPrice(product.salePrice)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // 2. Medium View (الوضع المتوسط - ارتفاع أقل مقارب للصورة، صورة أكبر بـ 25-30%، أزرار متناسقة العرض)
              if (viewMode === 'list') {
                return (
                  <div
                    key={product.id}
                    className="bg-card rounded-2xl p-2.5 border border-border shadow-2xs hover:border-border/80 transition-colors fade-in"
                    style={{ animationDelay: `${index * 15}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      {/* Right: Product Thumbnail Image (Enlarged ~28% to 72x72px) */}
                      <div className="size-[5.14rem] rounded-xl bg-muted/40 overflow-hidden border border-border shrink-0 aspect-square flex items-center justify-center shadow-2xs">
                        <ProductImage
                          imageUrl={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          iconClassName="w-7 h-7 text-muted-foreground/40"
                        />
                      </div>

                      {/* Middle: Full Name + Status + Stock + Buy/Sell Prices (Height-matched with Image) */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between h-[5.14rem] py-0.5">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <h3
                            className="font-black text-foreground text-xs sm:text-sm leading-tight truncate flex-1 min-w-0 cursor-pointer hover:text-primary transition-colors"
                            title={product.name}
                            onClick={() => openEditDialog(product)}
                          >
                            {product.name}
                          </h3>
                          {!noInventory && (
                            <span className={cn(
                              "border text-[8px] sm:text-[8.5px] font-black px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap",
                              product.status === 'out_of_stock'
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                : product.status === 'low_stock'
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            )}>
                              {status.label}
                            </span>
                          )}
                        </div>

                        {/* Stock Count */}
                        {!noInventory ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold">
                            <span className="text-muted-foreground/70 text-[10px]">{t('products.stock') || 'المخزون'}:</span>
                            <span className="font-mono text-foreground font-black text-xs">{product.quantity}</span>
                            <span className="bg-muted text-muted-foreground text-[9px] px-1 py-0.2 rounded font-bold">
                              {product.conversionFactor && product.conversionFactor > 1
                                ? getLocalizedUnit(product.bulkUnit, true)
                                : getLocalizedUnit(product.smallUnit, false)}
                            </span>
                            {(() => {
                              const custodyQty = getCustodyQuantity(product.id);
                              const breakdown = getCustodyBreakdown(product.id);
                              if (custodyQty > 0) {
                                return (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center gap-0.5 text-[9.5px] text-primary font-medium mr-1 cursor-help">
                                          <Truck className="w-2.5 h-2.5" />
                                          {custodyQty} {t('products.custody') || 'عهدة'}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <div className="text-xs space-y-1">
                                          <div className="font-medium border-b pb-1 mb-1">{t('products.custodyBreakdown') || 'توزيع العهدة'}:</div>
                                          {breakdown.map((item, idx) => (
                                            <div key={idx} className="flex justify-between gap-3">
                                              <span>{item.warehouseName}:</span>
                                              <span className="font-medium">{item.quantity}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {product.category}
                          </div>
                        )}

                        {/* Buy & Sell Pricing (Aligned directly with bottom of image) */}
                        <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                          {!noInventory && (
                            <div className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded-md border border-border/70 shadow-2xs">
                              <span className="text-[9px] font-sans text-muted-foreground font-medium">{t('products.buy') || 'شراء'}:</span>
                              <span className="text-foreground font-bold tabular-nums">{formatPrice(product.costPrice)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 shadow-2xs text-primary">
                            <span className="text-[9px] font-sans text-primary/80 font-medium">{t('products.sell') || 'بيع'}:</span>
                            <span className="text-foreground font-black tabular-nums">{formatPrice(product.salePrice)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Left: Vertically Stacked Actions (Proportional, wider, slightly smaller icons, not elongated) */}
                      {canAddProducts && (
                        <div className="flex flex-col gap-1.5 shrink-0 justify-center h-[5.14rem]">
                          <button
                            type="button"
                            onClick={() => openEditDialog(product)}
                            className="size-7 sm:size-8 rounded-lg bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground active:scale-90 transition-[colors,transform] shadow-2xs flex items-center justify-center border border-border/80"
                            title={t('common.edit') || 'تعديل'}
                          >
                            <Edit className="w-3.5 h-3.5 text-foreground/80" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteDialog(product)}
                            className="w-7 h-7 sm:w-8 sm:h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:scale-90 transition-[colors,transform] shadow-2xs flex items-center justify-center border border-rose-500/20"
                            title={t('common.delete') || 'حذف'}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // 3. Large View (الوضع الكبير - الافتراضي)
              return (
                <div
                  key={product.id}
                  className="bg-card rounded-2xl p-3 border border-border shadow-2xs relative hover:border-border/80 transition-colors fade-in"
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  {/* Main Body: Right Info, Center Square Image, Left Stacked Actions */}
                  <div className="flex items-center justify-between gap-2.5">
                    {/* Right Column: Name, Barcode + Status, and Stock */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Product Name */}
                      <h3
                        className="font-black text-foreground text-sm leading-tight truncate cursor-pointer hover:text-primary transition-colors"
                        title={product.name}
                        onClick={() => openEditDialog(product)}
                      >
                        {product.name}
                      </h3>

                      {/* Barcode + Status (Spaced out with ample room) */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Barcode Box */}
                        {product.barcode && (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(product.barcode);
                              toast.success(`تم نسخ الباركود: ${product.barcode}`);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                navigator.clipboard.writeText(product.barcode);
                                toast.success(`تم نسخ الباركود: ${product.barcode}`);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 bg-muted hover:bg-muted/80 px-2 py-1 rounded-lg cursor-pointer transition-colors text-muted-foreground shadow-2xs"
                            title={t('products.clickToCopyBarcode') || 'انقر لنسخ الباركود'}
                          >
                            <Copy className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
                            <span className="font-mono text-[10px] font-bold tracking-wider">{product.barcode}</span>
                          </div>
                        )}

                        {/* Status Badge next to Barcode */}
                        {!noInventory && (
                          <span className={cn(
                            "border text-[9.5px] font-black px-2 py-0.5 rounded-full whitespace-nowrap",
                            product.status === 'out_of_stock'
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              : product.status === 'low_stock'
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          )}>
                            {status.label}
                          </span>
                        )}
                      </div>

                      {/* Stock Information (Aligned on the right) */}
                      {!noInventory ? (
                        <div className="flex items-center gap-1.5 text-xs text-foreground/80 font-bold">
                          <span>{t('products.stock') || 'المخزون'}:</span>
                          <span className="font-mono text-sm text-foreground font-black">{product.quantity}</span>
                          <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                            {product.conversionFactor && product.conversionFactor > 1
                              ? getLocalizedUnit(product.bulkUnit, true)
                              : getLocalizedUnit(product.smallUnit, false)}
                          </span>
                          {(() => {
                            const custodyQty = getCustodyQuantity(product.id);
                            const breakdown = getCustodyBreakdown(product.id);
                            if (custodyQty > 0) {
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium mr-1 cursor-help">
                                        <Truck className="w-2.5 h-2.5" />
                                        {custodyQty} {t('products.custody') || 'عهدة'}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <div className="text-xs space-y-1">
                                        <div className="font-medium border-b pb-1 mb-1">{t('products.custodyBreakdown') || 'توزيع العهدة'}:</div>
                                        {breakdown.map((item, idx) => (
                                          <div key={idx} className="flex justify-between gap-3">
                                            <span>{item.warehouseName}:</span>
                                            <span className="font-medium">{item.quantity}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {product.category}
                        </div>
                      )}

                      {/* Size/Color badges if enabled */}
                      {fieldsConfig.sizeColor && (product.size || product.color) && (
                        <div className="flex flex-wrap gap-1">
                          {product.size && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{product.size}</span>}
                          {product.color && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{product.color}</span>}
                        </div>
                      )}
                    </div>

                    {/* Center: Enlarged Square Image */}
                    <div className="w-24 h-24 rounded-2xl bg-muted/40 overflow-hidden border border-border shrink-0 aspect-square shadow-2xs flex items-center justify-center">
                      <ProductImage
                        imageUrl={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        iconClassName="w-10 h-10 text-muted-foreground/40"
                      />
                    </div>

                    {/* Left Column: Vertically Stacked Actions (Delete directly below Edit) */}
                    {canAddProducts && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditDialog(product)}
                          className="w-8 h-8 rounded-xl bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground active:scale-90 transition-[colors,transform] shadow-2xs flex items-center justify-center border border-border/80"
                          title={t('common.edit') || 'تعديل'}
                        >
                          <Edit className="w-4 h-4 text-foreground/80" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteDialog(product)}
                          className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:scale-90 transition-[colors,transform] shadow-2xs flex items-center justify-center border border-rose-500/20"
                          title={t('common.delete') || 'حذف'}
                        >
                          <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bottom 3-Metric Price Row (الشراء | البيع | الربح) */}
                  {noInventory ? (
                    <div className={cn("grid gap-1.5 text-center bg-muted/40 p-1.5 rounded-xl border border-border/80 mt-2.5", isRepairMode ? "grid-cols-3" : "grid-cols-2")}>
                      {isRepairMode ? (
                        <>
                          <div className="bg-card p-1 rounded-lg border border-border/70">
                            <span className="text-[9px] text-muted-foreground font-bold block">{t('products.pieceCost')}</span>
                            <span className="text-xs font-black text-foreground font-mono">{formatPrice(product.costPrice)}</span>
                          </div>
                          <div className="bg-card p-1 rounded-lg border border-border/70">
                            <span className="text-[9px] text-muted-foreground font-bold block">{t('products.laborCost')}</span>
                            <span className="text-xs font-black text-foreground font-mono">${formatNumber(product.laborCost || 0, 2)}</span>
                          </div>
                          <div className="bg-card p-1 rounded-lg border border-border/70">
                            <span className="text-[9px] text-muted-foreground font-bold block">{t('common.total')}</span>
                            <span className="text-xs font-black text-primary font-mono">{formatPrice(product.costPrice + (product.laborCost || 0))}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-card p-1 rounded-lg border border-border/70">
                            <span className="text-[9px] text-muted-foreground font-bold block">{t('products.salePrice') || 'البيع'}</span>
                            <span className="text-xs font-black text-primary font-mono">{formatPrice(product.salePrice)}</span>
                          </div>
                          <div className="bg-card p-1 rounded-lg border border-border/70">
                            <span className="text-[9px] text-muted-foreground font-bold block">{t('products.wholesalePrice')}</span>
                            <span className="text-xs font-black text-foreground font-mono">{formatPrice(product.wholesalePrice || 0)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 text-center bg-muted/40 p-1.5 rounded-xl border border-border/80 mt-2.5">
                      {/* الشراء */}
                      <div className="bg-card p-1 rounded-lg border border-border/70">
                        <span className="text-[9px] text-muted-foreground font-bold block">{t('products.costPrice') || 'الشراء'}</span>
                        <span className="text-xs font-black text-foreground font-mono">{formatPrice(product.costPrice)}</span>
                      </div>
                      {/* البيع */}
                      <div className="bg-card p-1 rounded-lg border border-border/70">
                        <span className="text-[9px] text-muted-foreground font-bold block">{t('products.salePrice') || 'البيع'}</span>
                        <span className="text-xs font-black text-primary font-mono">{formatPrice(product.salePrice)}</span>
                      </div>
                      {/* الربح */}
                      <div className={cn(
                        "p-1 rounded-lg border",
                        profit > 0
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : profit < 0
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-card border-border/70 text-muted-foreground"
                      )}>
                        <span className="text-[9px] font-bold block">{profit >= 0 ? (t('products.profit') || "الربح") : (t('products.loss') || "الخسارة")}</span>
                        <span className="text-xs font-black font-mono">
                          {profit > 0 ? `+${formatMoney(profit, undefined, 2)}` : profit < 0 ? `-${formatMoney(Math.abs(profit), undefined, 2)}` : formatMoney(0, undefined, 2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      )}

        {/* Add Product Dialog */}
        <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) { setImagePreviewBase64(''); clearPersistedState(); } }}>
          <DialogContent
            className="w-[min(calc(100vw-1rem),42rem)] max-h-[calc(100dvh-1.5rem)] flex flex-col p-0 overflow-hidden border border-border/70 shadow-2xl rounded-2xl"
            onPointerDownOutside={(e) => {
              if (formData.name?.trim()) e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              if (formData.name?.trim()) e.preventDefault();
            }}
          >
            {/* Premium Header */}
            <div className="shrink-0 bg-gradient-to-br from-primary/5 via-background to-background px-4 py-3 sm:px-6 border-b border-border/60">
              <DialogHeader className="space-y-0">
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  {t('products.addProductTitle') || 'إضافة منتج جديد'}
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">{t('products.name')} *</label>
                  <Input
                    placeholder={t('products.exampleName')}
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                {!noInventory && !isRestaurant && (
                  <>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-1.5 block">{t('products.barcode')} 1</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder={t('products.exampleBarcode')}
                          value={formData.barcode}
                          onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                        />
                        <Button variant="outline" size="icon" onClick={() => {
                          setScanTarget('barcode1');
                          setScannerOpen(true);
                        }}>
                          <Barcode className="w-4 h-4" />
                        </Button>
                        {!showBarcode2 && (
                          <Button variant="ghost" size="icon" onClick={() => setShowBarcode2(true)} title={t('products.addSecondBarcode')}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Barcode 2 */}
                    {showBarcode2 && (
                      <div className="sm:col-span-2">
                        <label className="text-sm font-medium mb-1.5 block">{t('products.barcode')} 2</label>
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('products.exampleBarcode')}
                            value={formData.barcode2}
                            onChange={(e) => setFormData(prev => ({ ...prev, barcode2: e.target.value }))}
                          />
                          <Button variant="outline" size="icon" onClick={() => {
                            setScanTarget('barcode2');
                            setScannerOpen(true);
                          }}>
                            <Barcode className="w-4 h-4" />
                          </Button>
                          {!showBarcode3 && (
                            <Button variant="ghost" size="icon" onClick={() => setShowBarcode3(true)} title={t('products.addThirdBarcode')}>
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => {
                            setFormData(prev => ({ ...prev, barcode2: '' }));
                            setShowBarcode2(false);
                          }} className="text-destructive">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* Barcode 3 */}
                    {showBarcode3 && (
                      <div className="sm:col-span-2">
                        <label className="text-sm font-medium mb-1.5 block">{t('products.barcode')} 3</label>
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('products.exampleBarcode')}
                            value={formData.barcode3}
                            onChange={(e) => setFormData(prev => ({ ...prev, barcode3: e.target.value }))}
                          />
                          <Button variant="outline" size="icon" onClick={() => {
                            setScanTarget('barcode3');
                            setScannerOpen(true);
                          }}>
                            <Barcode className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => {
                            setFormData(prev => ({ ...prev, barcode3: '' }));
                            setShowBarcode3(false);
                          }} className="text-destructive">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* Variant Label */}
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-1.5 block">{t('products.variantLabel')}</label>
                      <Input
                        placeholder={t('products.variantPlaceholder')}
                        value={formData.variantLabel}
                        onChange={(e) => setFormData(prev => ({ ...prev, variantLabel: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t('products.variantHint')}</p>
                    </div>
                  </>
                )}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('products.category')}</label>
                  <select
                    className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                {!noInventory && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.quantity')}</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      className="text-right"
                      placeholder="0"
                      value={formData.quantity ?? ''}
                      onChange={(e) => handleNumericChange('quantity', e.target.value)}
                      onBlur={() => handleNumericBlur('quantity', 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                )}
                {(!noInventory || isRepairMode) && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{isRepairMode ? `${t('products.pieceCost')} (${currencySymbol})` : `${t('products.costPrice')} (${currencySymbol})`}</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      className="text-right"
                      placeholder="0"
                      value={formData.costPrice ?? ''}
                      onChange={(e) => handleNumericChange('costPrice', e.target.value)}
                      onBlur={() => handleNumericBlur('costPrice', 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                )}
                {isRepairMode && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.laborCost')} ({currencySymbol})</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      className="text-right"
                      placeholder="0"
                      value={formData.laborCost ?? ''}
                      onChange={(e) => handleNumericChange('laborCost', e.target.value)}
                      onBlur={() => handleNumericBlur('laborCost', 0)}
                      onFocus={(e) => e.target.select()}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('products.laborCostHint')}</p>
                  </div>
                )}
                {!isRepairMode && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.salePrice')} ({currencySymbol})</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      className="text-right"
                      placeholder="0"
                      value={formData.salePrice ?? ''}
                      onChange={(e) => handleNumericChange('salePrice', e.target.value)}
                      onBlur={() => handleNumericBlur('salePrice', 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                )}

                {/* Unit Settings Collapsible */}
                {!noInventory && (
                  <div className="sm:col-span-2">
                    <Collapsible open={showUnitSettings} onOpenChange={setShowUnitSettings}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between" type="button">
                          <span className="flex items-center gap-2">
                            <Boxes className="w-4 h-4" />
                            {t('products.unitSettings')}
                          </span>
                          <span className="text-xs text-foreground/80">
                            {showUnitSettings ? t('products.hideLbl') : t('products.showLbl')}
                          </span>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        <UnitSettingsTab
                          data={{
                            bulkUnit: formData.bulkUnit,
                            smallUnit: formData.smallUnit,
                            conversionFactor: Number(formData.conversionFactor) || 1,
                            bulkCostPrice: Number(formData.bulkCostPrice) || 0,
                            bulkSalePrice: Number(formData.bulkSalePrice) || 0,
                            trackByUnit: formData.trackByUnit,
                          }}
                          onChange={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
                          quantityInPieces={formData.trackByUnit === 'bulk'
                            ? (Number(formData.quantity) || 0) * (Number(formData.conversionFactor) || 1)
                            : (Number(formData.quantity) || 0)}
                          pieceCostPrice={Number(formData.costPrice) || 0}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {/* Dynamic Fields based on store type (Fix #16) */}
                {fieldsConfig.expiryDate && (
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1.5 block">{t('products.expiryDate')}</label>
                    <DatePicker
                      value={formData.expiryDate}
                      onChange={(date) => setFormData(prev => ({ ...prev, expiryDate: date }))}
                      placeholder={t('products.selectExpiryDate')}
                    />
                  </div>
                )}
                {fieldsConfig.batchNumber && (
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1.5 block">{t('products.batchNumber')}</label>
                    <Input
                      placeholder={t('products.batchNumber')}
                      value={formData.batchNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, batchNumber: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.serialNumber && (
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1.5 block">{t('products.serialNumber')}</label>
                    <Input
                      placeholder={t('products.exampleSerial')}
                      value={formData.serialNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.warranty && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.warranty')}</label>
                    <Input
                      placeholder={t('products.exampleWarranty')}
                      value={formData.warranty}
                      onChange={(e) => setFormData(prev => ({ ...prev, warranty: e.target.value }))}
                    />
                  </div>
                )}
                {(fieldsConfig.wholesalePrice || (Number(formData.wholesalePrice) || 0) > 0) && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.wholesalePrice')} ({currencySymbol})</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      className="text-right"
                      placeholder="0"
                      value={formData.wholesalePrice ?? ''}
                      onChange={(e) => handleNumericChange('wholesalePrice', e.target.value)}
                      onBlur={() => handleNumericBlur('wholesalePrice', 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                )}
                {fieldsConfig.sizeColor && (
                  <>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-1.5 block">{t('products.size')}</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {['S', 'M', 'L', 'XL', 'XXL', '36', '38', '40', '42', '44', '46'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              const sizes = formData.size ? formData.size.split(',').map(x => x.trim()).filter(Boolean) : [];
                              const updated = sizes.includes(s) ? sizes.filter(x => x !== s) : [...sizes, s];
                              setFormData(prev => ({ ...prev, size: updated.join(', ') }));
                            }}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                              formData.size?.split(',').map(x => x.trim()).includes(s)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <Input
                        placeholder={t('products.exampleSize')}
                        value={formData.size}
                        onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                        className="text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-1.5 block">{t('products.color')}</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {[
                          { name: 'أسود', hex: '#000' }, { name: 'أبيض', hex: '#fff' }, { name: 'أحمر', hex: '#ef4444' },
                          { name: 'أزرق', hex: '#3b82f6' }, { name: 'أخضر', hex: '#22c55e' }, { name: 'رمادي', hex: '#6b7280' },
                          { name: 'بني', hex: '#92400e' }, { name: 'بيج', hex: '#d4a76a' }, { name: 'كحلي', hex: '#1e3a5f' },
                        ].map(c => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => {
                              const colors = formData.color ? formData.color.split(',').map(x => x.trim()).filter(Boolean) : [];
                              const updated = colors.includes(c.name) ? colors.filter(x => x !== c.name) : [...colors, c.name];
                              setFormData(prev => ({ ...prev, color: updated.join(', ') }));
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors",
                              formData.color?.split(',').map(x => x.trim()).includes(c.name)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                            )}
                          >
                            <span className="w-3 h-3 rounded-full border border-border/50 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                            {c.name}
                          </button>
                        ))}
                      </div>
                      <Input
                        placeholder={t('products.exampleColor')}
                        value={formData.color}
                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                        className="text-xs"
                      />
                    </div>
                  </>
                )}
                {fieldsConfig.weight && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.weight')}</label>
                    <Input
                      placeholder={t('products.weight')}
                      value={formData.weight}
                      onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.fabricType && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.fabricType')}</label>
                    <Input
                      placeholder={t('products.fabricType')}
                      value={formData.fabricType}
                      onChange={(e) => setFormData(prev => ({ ...prev, fabricType: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.tableNumber && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.tableNumber')}</label>
                    <Input
                      placeholder={t('products.tableNumber')}
                      value={formData.tableNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, tableNumber: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.orderNotes && (
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1.5 block">{t('products.orderNotes')}</label>
                    <Input
                      placeholder={t('products.orderNotes')}
                      value={formData.orderNotes}
                      onChange={(e) => setFormData(prev => ({ ...prev, orderNotes: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.author && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.author')}</label>
                    <Input
                      placeholder={t('products.author')}
                      value={formData.author}
                      onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.publisher && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.publisher')}</label>
                    <Input
                      placeholder={t('products.publisher')}
                      value={formData.publisher}
                      onChange={(e) => setFormData(prev => ({ ...prev, publisher: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.minStockLevel && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.minStock')}</label>
                    <Input
                      type="number"
                      dir="ltr"
                      className="text-right"
                      placeholder="5"
                      value={formData.minStockLevel || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, minStockLevel: Number(e.target.value) }))}
                    />
                  </div>
                )}
                {/* Custom Fields */}
                {customFields.map((field) => (
                  <div key={field.id} className={field.type === 'text' ? 'sm:col-span-2' : ''}>
                    <label className="text-sm font-medium mb-1.5 block">
                      {field.name} {field.required && '*'}
                    </label>
                    {field.type === 'select' && field.options ? (
                      <select
                        className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                        value={customFieldValues[field.id] || ''}
                        onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.id]: e.target.value })}
                      >
                        <option value="">{t('maintenance.select')}</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={field.type === 'number' ? 'number' : 'text'}
                        placeholder={field.placeholder || ''}
                        value={customFieldValues[field.id] || ''}
                        onChange={(e) => setCustomFieldValues({
                          ...customFieldValues,
                          [field.id]: field.type === 'number' ? Number(e.target.value) : e.target.value
                        })}
                      />
                    )}
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">{t('products.productImage')}</label>
                  <div className="flex flex-col gap-3">
                    {(imagePreviewBase64 || formData.image) ? (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border group cursor-pointer" onClick={() => {
                        if (imagePreviewBase64) openImagePreview(imagePreviewBase64);
                        else if (formData.image) openImagePreview(formData.image);
                      }}>
                        {imagePreviewBase64 ? (
                          <img
                            src={imagePreviewBase64}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ProductImage
                            imageUrl={formData.image}
                            alt="Preview"
                            className="w-24 h-24 rounded-lg"
                            iconClassName="w-6 h-6"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Search className="w-5 h-5 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, image: '' })); setImagePreviewBase64(''); setImageLoadError(false); }}
                          className="absolute top-1 right-1 p-1 bg-destructive/90 rounded-full text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full min-h-12"
                        onClick={handleCameraCapture}
                        disabled={isCameraLoading}
                      >
                        {isCameraLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                        {t('products.captureImage')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full min-h-12"
                        onClick={handleGallerySelect}
                        disabled={isCameraLoading}
                      >
                        <ImageIcon className="w-4 h-4" />
                        {t('products.chooseImage')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t bg-muted/30 px-4 py-3 sm:px-6 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11 rounded-xl text-sm font-bold border-border/80 hover:bg-muted/60 transition-colors cursor-pointer shadow-xs"
                onClick={() => {
                  setShowAddDialog(false);
                  setImagePreviewBase64('');
                  clearPersistedState();
                }}
              >
                {t('common.cancel') || 'إلغاء'}
              </Button>
              <Button
                type="button"
                className="flex-1 h-11 rounded-xl text-sm font-black bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/25 transition-colors cursor-pointer"
                onClick={handleAddProduct}
              >
                <Save className="w-4 h-4 ml-2" />
                {t('products.saveProduct') || 'حفظ المنتج'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Product Dialog */}
        <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) clearPersistedState(); }}>
          <DialogContent
            className="w-[min(calc(100vw-1rem),42rem)] max-h-[calc(100dvh-1.5rem)] flex flex-col p-0 overflow-hidden border border-border/70 shadow-2xl rounded-2xl"
            onPointerDownOutside={(e) => {
              if (formData.name?.trim()) e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              if (formData.name?.trim()) e.preventDefault();
            }}
          >
            {/* Premium Header */}
            <div className="shrink-0 bg-gradient-to-br from-primary/5 via-background to-background px-4 py-3 sm:px-6 border-b border-border/60">
              <DialogHeader className="space-y-0">
                <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  {selectedProduct?.archived ? t('products.restoreAndEditProduct') : tDynamic('editProduct')}
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">{t('products.name')} *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                {!isRestaurant && (
                  <>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-1.5 block">{t('products.barcode')} 1</label>
                      <div className="flex gap-2">
                        <Input
                          value={formData.barcode}
                          onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                        />
                        <Button variant="outline" size="icon" onClick={() => {
                          setScanTarget('barcode1');
                          setScannerOpen(true);
                        }}>
                          <Barcode className="w-4 h-4" />
                        </Button>
                        {!showBarcode2 && (
                          <Button variant="ghost" size="icon" onClick={() => setShowBarcode2(true)} title={t('products.addSecondBarcode')}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Barcode 2 */}
                    {showBarcode2 && (
                      <div className="sm:col-span-2">
                        <label className="text-sm font-medium mb-1.5 block">{t('products.barcode')} 2</label>
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('products.exampleBarcode')}
                            value={formData.barcode2}
                            onChange={(e) => setFormData(prev => ({ ...prev, barcode2: e.target.value }))}
                          />
                          <Button variant="outline" size="icon" onClick={() => {
                            setScanTarget('barcode2');
                            setScannerOpen(true);
                          }}>
                            <Barcode className="w-4 h-4" />
                          </Button>
                          {!showBarcode3 && (
                            <Button variant="ghost" size="icon" onClick={() => setShowBarcode3(true)} title={t('products.addThirdBarcode')}>
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => {
                            setFormData(prev => ({ ...prev, barcode2: '' }));
                            setShowBarcode2(false);
                          }} className="text-destructive">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* Barcode 3 */}
                    {showBarcode3 && (
                      <div className="sm:col-span-2">
                        <label className="text-sm font-medium mb-1.5 block">{t('products.barcode')} 3</label>
                        <div className="flex gap-2">
                          <Input
                            placeholder={t('products.exampleBarcode')}
                            value={formData.barcode3}
                            onChange={(e) => setFormData(prev => ({ ...prev, barcode3: e.target.value }))}
                          />
                          <Button variant="outline" size="icon" onClick={() => {
                            setScanTarget('barcode3');
                            setScannerOpen(true);
                          }}>
                            <Barcode className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => {
                            setFormData(prev => ({ ...prev, barcode3: '' }));
                            setShowBarcode3(false);
                          }} className="text-destructive">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {/* Variant Label */}
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">{t('products.variantLabel')}</label>
                  <Input
                    placeholder={t('products.variantPlaceholder')}
                    value={formData.variantLabel}
                    onChange={(e) => setFormData(prev => ({ ...prev, variantLabel: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('products.variantHint')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('products.category')}</label>
                  <select
                    className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('products.quantity')}</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    className="text-right"
                    placeholder="0"
                    value={formData.quantity ?? ''}
                    onChange={(e) => handleNumericChange('quantity', e.target.value)}
                    onBlur={() => handleNumericBlur('quantity', 0)}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('products.costPrice')} ({currencySymbol})</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    className="text-right"
                    placeholder="0"
                    value={formData.costPrice ?? ''}
                    onChange={(e) => handleNumericChange('costPrice', e.target.value)}
                    onBlur={() => handleNumericBlur('costPrice', 0)}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('products.salePrice')} ({currencySymbol})</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    className="text-right"
                    placeholder="0"
                    value={formData.salePrice ?? ''}
                    onChange={(e) => handleNumericChange('salePrice', e.target.value)}
                    onBlur={() => handleNumericBlur('salePrice', 0)}
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                {/* Unit Settings Collapsible */}
                <div className="sm:col-span-2">
                  <Collapsible open={showUnitSettings} onOpenChange={setShowUnitSettings}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between" type="button">
                        <span className="flex items-center gap-2">
                          <Boxes className="w-4 h-4" />
                          {t('products.unitSettings')}
                        </span>
                        <span className="text-xs text-foreground/80">
                          {showUnitSettings ? t('common.hide') : t('common.show')}
                        </span>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <UnitSettingsTab
                        data={{
                          bulkUnit: formData.bulkUnit,
                          smallUnit: formData.smallUnit,
                          conversionFactor: Number(formData.conversionFactor) || 1,
                          bulkCostPrice: Number(formData.bulkCostPrice) || 0,
                          bulkSalePrice: Number(formData.bulkSalePrice) || 0,
                          trackByUnit: formData.trackByUnit,
                        }}
                        onChange={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
                        quantityInPieces={formData.trackByUnit === 'bulk'
                          ? (Number(formData.quantity) || 0) * (Number(formData.conversionFactor) || 1)
                          : (Number(formData.quantity) || 0)}
                        pieceCostPrice={Number(formData.costPrice) || 0}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                {/* Dynamic Fields */}
                {fieldsConfig.expiryDate && (
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1.5 block">{t('products.expiryDate')}</label>
                    <DatePicker
                      value={formData.expiryDate}
                      onChange={(date) => setFormData(prev => ({ ...prev, expiryDate: date }))}
                      placeholder={t('products.selectExpiryDate')}
                    />
                  </div>
                )}
                {fieldsConfig.batchNumber && (
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1.5 block">{t('products.batchNumber')}</label>
                    <Input
                      placeholder={t('products.batchNumber')}
                      value={formData.batchNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, batchNumber: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.serialNumber && (
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1.5 block">{t('products.serialNumber')}</label>
                    <Input
                      placeholder={t('products.exampleSerial')}
                      value={formData.serialNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.warranty && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.warranty')}</label>
                    <Input
                      placeholder={t('products.exampleWarranty')}
                      value={formData.warranty}
                      onChange={(e) => setFormData(prev => ({ ...prev, warranty: e.target.value }))}
                    />
                  </div>
                )}
                {(fieldsConfig.wholesalePrice || (Number(formData.wholesalePrice) || 0) > 0) && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.wholesalePrice')} ({currencySymbol})</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      className="text-right"
                      placeholder="0"
                      value={formData.wholesalePrice ?? ''}
                      onChange={(e) => handleNumericChange('wholesalePrice', e.target.value)}
                      onBlur={() => handleNumericBlur('wholesalePrice', 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                )}
                {fieldsConfig.sizeColor && (
                  <>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-1.5 block">{t('products.size')}</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {['S', 'M', 'L', 'XL', 'XXL', '36', '38', '40', '42', '44', '46'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              const sizes = formData.size ? formData.size.split(',').map(x => x.trim()).filter(Boolean) : [];
                              const updated = sizes.includes(s) ? sizes.filter(x => x !== s) : [...sizes, s];
                              setFormData(prev => ({ ...prev, size: updated.join(', ') }));
                            }}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                              formData.size?.split(',').map(x => x.trim()).includes(s)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <Input
                        placeholder={t('products.exampleSize')}
                        value={formData.size}
                        onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                        className="text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-1.5 block">{t('products.color')}</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {[
                          { name: 'أسود', hex: '#000' }, { name: 'أبيض', hex: '#fff' }, { name: 'أحمر', hex: '#ef4444' },
                          { name: 'أزرق', hex: '#3b82f6' }, { name: 'أخضر', hex: '#22c55e' }, { name: 'رمادي', hex: '#6b7280' },
                          { name: 'بني', hex: '#92400e' }, { name: 'بيج', hex: '#d4a76a' }, { name: 'كحلي', hex: '#1e3a5f' },
                        ].map(c => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => {
                              const colors = formData.color ? formData.color.split(',').map(x => x.trim()).filter(Boolean) : [];
                              const updated = colors.includes(c.name) ? colors.filter(x => x !== c.name) : [...colors, c.name];
                              setFormData(prev => ({ ...prev, color: updated.join(', ') }));
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors",
                              formData.color?.split(',').map(x => x.trim()).includes(c.name)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                            )}
                          >
                            <span className="w-3 h-3 rounded-full border border-border/50 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                            {c.name}
                          </button>
                        ))}
                      </div>
                      <Input
                        placeholder={t('products.exampleColor')}
                        value={formData.color}
                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                        className="text-xs"
                      />
                    </div>
                  </>
                )}
                {fieldsConfig.weight && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.weight')}</label>
                    <Input
                      placeholder={t('products.weight')}
                      value={formData.weight}
                      onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.fabricType && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.fabricType')}</label>
                    <Input
                      placeholder={t('products.fabricType')}
                      value={formData.fabricType}
                      onChange={(e) => setFormData(prev => ({ ...prev, fabricType: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.tableNumber && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.tableNumber')}</label>
                    <Input
                      placeholder={t('products.tableNumber')}
                      value={formData.tableNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, tableNumber: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.orderNotes && (
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1.5 block">{t('products.orderNotes')}</label>
                    <Input
                      placeholder={t('products.orderNotes')}
                      value={formData.orderNotes}
                      onChange={(e) => setFormData(prev => ({ ...prev, orderNotes: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.author && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.author')}</label>
                    <Input
                      placeholder={t('products.author')}
                      value={formData.author}
                      onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.publisher && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.publisher')}</label>
                    <Input
                      placeholder={t('products.publisher')}
                      value={formData.publisher}
                      onChange={(e) => setFormData(prev => ({ ...prev, publisher: e.target.value }))}
                    />
                  </div>
                )}
                {fieldsConfig.minStockLevel && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t('products.minStock')}</label>
                    <Input
                      type="number"
                      dir="ltr"
                      className="text-right"
                      placeholder="5"
                      value={formData.minStockLevel || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, minStockLevel: Number(e.target.value) }))}
                    />
                  </div>
                )}

                {/* Custom Fields in Edit Dialog */}
                {customFields.map((field) => (
                  <div key={field.id} className={field.type === 'text' ? 'sm:col-span-2' : ''}>
                    <label className="text-sm font-medium mb-1.5 block">
                      {field.name} {field.required && '*'}
                    </label>
                    {field.type === 'select' && field.options ? (
                      <select
                        className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                        value={customFieldValues[field.id] || ''}
                        onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.id]: e.target.value })}
                      >
                        <option value="">اختر...</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={field.type === 'number' ? 'number' : 'text'}
                        placeholder={field.placeholder || ''}
                        value={customFieldValues[field.id] || ''}
                        onChange={(e) => setCustomFieldValues({
                          ...customFieldValues,
                          [field.id]: field.type === 'number' ? Number(e.target.value) : e.target.value
                        })}
                      />
                    )}
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">{t('products.productImage')}</label>
                  <div className="flex flex-col gap-3">
                    {(imagePreviewBase64 || formData.image) ? (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border group cursor-pointer" onClick={() => {
                        if (imagePreviewBase64) openImagePreview(imagePreviewBase64);
                        else if (formData.image) openImagePreview(formData.image);
                      }}>
                        {imagePreviewBase64 ? (
                          <img
                            src={imagePreviewBase64}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ProductImage
                            imageUrl={formData.image}
                            alt="Preview"
                            className="w-24 h-24 rounded-lg"
                            iconClassName="w-6 h-6"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Search className="w-5 h-5 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, image: '' })); setImagePreviewBase64(''); setImageLoadError(false); }}
                          className="absolute top-1 right-1 p-1 bg-destructive/90 rounded-full text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full min-h-12"
                        onClick={handleCameraCapture}
                        disabled={isCameraLoading}
                      >
                        {isCameraLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                        {t('products.captureImage')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full min-h-12"
                        onClick={handleGallerySelect}
                        disabled={isCameraLoading}
                      >
                        <ImageIcon className="w-4 h-4" />
                        {t('products.chooseImage')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t bg-muted/30 px-4 py-3 sm:px-6 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11 rounded-xl text-sm font-bold border-border/80 hover:bg-muted/60 transition-colors cursor-pointer shadow-xs"
                onClick={() => {
                  setShowEditDialog(false);
                  setImagePreviewBase64('');
                  clearPersistedState();
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                className={cn(
                  "flex-1 h-11 rounded-xl text-sm font-black shadow-md transition-colors cursor-pointer",
                  selectedProduct?.archived
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25"
                )}
                onClick={handleEditProduct}
              >
                {selectedProduct?.archived ? (
                  <>
                    <RotateCcw className="w-4 h-4 ml-2" />
                    {t('products.restoreAndEditProduct')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 ml-2" />
                    {t('common.save')}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('products.deleteConfirm')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('products.deleteConfirm')} "{selectedProduct?.name}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel disabled={deleteGuard.isRunning}>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteProduct} disabled={deleteGuard.isRunning} className="bg-destructive hover:bg-destructive/90">
                {deleteGuard.isRunning ? (t('common.deleting') || 'جاري الحذف...') : t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Hard Delete Confirmation for Archived Product */}
        <AlertDialog open={showHardDeleteDialog} onOpenChange={setShowHardDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                {t('products.permanentDeleteTitle') || 'حذف نهائي قطعي للمنتج'}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  {t('products.permanentDeleteConfirm') || 'هل أنت متأكد من حذف هذا المنتج نهائياً من قاعدة البيانات والسحابة؟'}
                  {archivedProductToDelete?.name && (
                    <span className="block mt-1 font-bold text-foreground">
                      "{archivedProductToDelete.name}"
                    </span>
                  )}
                </p>
                <p className="text-xs text-destructive font-medium bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
                  {t('products.permanentDeleteWarning')}
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel disabled={deleteGuard.isRunning}>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleHardDeleteArchived}
                disabled={deleteGuard.isRunning}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleteGuard.isRunning ? t('products.permanentlyDeleting') : t('products.permanentDeleteButton')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Barcode Scanner */}
        <BarcodeScanner
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={(barcode) => {
            console.log('[Products] Scanned:', barcode);
            setScannerOpen(false);

            if (scanTarget === 'archive') {
              const cleanBarcode = barcode.trim();
              setArchiveSearchQuery(cleanBarcode);
              toast.success('تم قراءة الباركود للبحث في الأرشيف', { description: cleanBarcode });
              return;
            }

            if (scanTarget === 'form' || scanTarget === 'barcode1') {
              const cleanBarcode = barcode.trim();
              console.log('[Products] Setting primary barcode:', cleanBarcode);
              setFormData(prev => ({ ...prev, barcode: cleanBarcode }));
              toast.success(t('pos.scanned'), { description: cleanBarcode });
              return;
            }

            if (scanTarget === 'barcode2') {
              const cleanBarcode = barcode.trim();
              console.log('[Products] Setting barcode 2:', cleanBarcode);
              setFormData(prev => ({ ...prev, barcode2: cleanBarcode }));
              toast.success(t('pos.scanned'), { description: cleanBarcode });
              return;
            }

            if (scanTarget === 'barcode3') {
              const cleanBarcode = barcode.trim();
              console.log('[Products] Setting barcode 3:', cleanBarcode);
              setFormData(prev => ({ ...prev, barcode3: cleanBarcode }));
              toast.success(t('pos.scanned'), { description: cleanBarcode });
              return;
            }

            setSearchQuery(barcode);
            const product = products.find((p) => p.barcode === barcode);
            if (product) {
              toast.success(`${t('common.found')}: ${product.name}`);
            } else {
              toast.info(`${t('pos.barcode')}: ${barcode}`, { description: t('pos.productNotFound') || 'Product not found' });
            }
          }}
        />

        {/* Category Manager */}
        <CategoryManager
          isOpen={showCategoryManager}
          onClose={() => setShowCategoryManager(false)}
          onCategoriesChange={reloadCategories}
          usedCategories={usedCategories}
        />

        {/* Quick Restock Dialog */}
        <Dialog open={showRestockDialog} onOpenChange={setShowRestockDialog}>
          <DialogContent className="sm:max-w-[30rem]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
                <Boxes className="w-5 h-5 text-emerald-600" />
                {t('products.restockTitle')}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t('products.restockDesc')}
              </DialogDescription>
            </DialogHeader>

            {restockProduct && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3 p-3 bg-muted/60 rounded-xl border border-border/60">
                  {restockProduct.image ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0">
                      <ProductImage imageUrl={restockProduct.image} alt={restockProduct.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground border border-border">
                      <Package className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-foreground truncate">{restockProduct.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {restockProduct.category && <span>{restockProduct.category}</span>}
                      {restockProduct.barcode && <span className="font-mono text-[11px]">{restockProduct.barcode}</span>}
                    </div>
                    <div className="text-xs text-destructive font-semibold mt-0.5">
                      {t('products.currentStock')}: {restockProduct.quantity} ({t('products.outOfStockBadge')})
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t('products.newQuantity')} ({restockProduct.smallUnit || t('products.unitPiece')})</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    className="text-center text-lg font-bold h-12"
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(e.target.value)}
                    placeholder="10"
                    autoFocus
                  />
                </div>

                {/* Quick Add Pills */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {[1, 5, 10, 20, 50, 100].map((val) => (
                    <Button
                      key={val}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-bold px-2.5"
                      onClick={() => setRestockQuantity(String(val))}
                    >
                      +{val}
                    </Button>
                  ))}
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    className="w-full h-10 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleQuickRestock}
                    disabled={isRestocking}
                  >
                    {isRestocking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t('products.confirmRestock')}
                  </Button>

                  <Button
                    variant="ghost"
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-foreground h-8"
                    onClick={() => {
                      const p = restockProduct;
                      setShowRestockDialog(false);
                      setRestockProduct(null);
                      openEditDialog(p);
                    }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    {t('products.editAllDetailsInstead')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Image Preview Dialog - previewImageUrl دائماً signed URL أو data URL */}
        <Dialog open={!!previewImageUrl || previewLoading} onOpenChange={(open) => { if (!open) { setPreviewImageUrl(null); setPreviewLoading(false); } }}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 sm:p-4 flex flex-col items-center justify-center">
            <DialogHeader className="sr-only">
              <DialogTitle>{t('products.viewProductImage')}</DialogTitle>
            </DialogHeader>
            {previewLoading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{t('products.loadingImage')}</p>
              </div>
            ) : previewImageUrl ? (
              <img
                src={previewImageUrl}
                alt={t('products.productImage')}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const msg = document.createElement('p');
                  msg.textContent = t('products.imageLoadError');
                  msg.className = 'text-muted-foreground text-sm py-8';
                  e.currentTarget.parentNode?.appendChild(msg);
                }}
              />
            ) : null}
          </DialogContent>
        </Dialog>
        {/* Native Camera Preview — @capgo/camera-preview (no Activity restart) */}
        <NativeCameraPreview
          isOpen={showInlineCamera}
          onClose={closeInlineCamera}
          onCapture={handleInlineCaptured}
          maxSize={400}
          quality={40}
        />

        {/* Floating Action Button (FAB) لإضافة منتج - ظاهر دائماً وثابت لسهولة وسرعة الوصول */}
        {canAddProducts && (
          <div
            className={cn(
              "fixed z-40 transition-[opacity,transform] duration-300 ease-out pointer-events-none",
              "bottom-20 md:bottom-8",
              isRTL ? "left-4 md:left-8" : "right-4 md:right-8",
              isFabVisible
                ? "translate-y-0 opacity-100 scale-100"
                : "translate-y-24 opacity-0 scale-90 pointer-events-none"
            )}
          >
            <button
              type="button"
              onClick={handleOpenAddProduct}
              className={cn(
                "pointer-events-auto flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full",
                "bg-gradient-primary hover:opacity-95 active:scale-95 text-primary-foreground font-bold",
                "shadow-xl shadow-primary/35 hover:shadow-2xl border border-primary-foreground/25 ring-4 ring-primary/15 transition-[transform,opacity] duration-300 ease-out cursor-pointer"
              )}
              title={tDynamic('addProduct')}
              aria-label={tDynamic('addProduct')}
            >
              <Plus className="w-7 h-7 md:w-8 md:h-8 stroke-[2.5]" />
            </button>
          </div>
        )}
    </div>
  );
}












