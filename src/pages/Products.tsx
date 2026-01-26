import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Loader2,
  Boxes
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { toast } from 'sonner';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { CategoryManager } from '@/components/CategoryManager';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { UnitSettingsTab } from '@/components/products/UnitSettingsTab';
import { DualUnitDisplay } from '@/components/products/DualUnitDisplay';
import { 
  loadProductsCloud, 
  addProductCloud,
  updateProductCloud,
  deleteProductCloud,
  getStatus,
  Product 
} from '@/lib/cloud/products-cloud';
import { getCategoryNamesCloud } from '@/lib/cloud/categories-cloud';
import { uploadProductImage } from '@/lib/image-upload';
import { addActivityLog } from '@/lib/activity-log';
import { useAuth } from '@/hooks/use-auth';
import { getEffectiveFieldsConfig, ProductFieldsConfig } from '@/lib/product-fields-config';
import { getEnabledCustomFields, CustomField } from '@/lib/custom-fields-config';
import { EVENTS } from '@/lib/events';
import { useLanguage } from '@/hooks/use-language';
import { useCamera } from '@/hooks/use-camera';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  
  const statusConfig = {
    in_stock: { label: t('products.available'), color: 'badge-success', icon: CheckCircle },
    low_stock: { label: t('products.low'), color: 'badge-warning', icon: AlertTriangle },
    out_of_stock: { label: t('products.outOfStock'), color: 'badge-danger', icon: AlertTriangle },
  };
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | 'multi_unit' | 'single_unit'>('all');
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<'search' | 'form'>('search');
  
  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Form state with dynamic fields
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category: 'هواتف',
    costPrice: 0,
    salePrice: 0,
    quantity: 0,
    expiryDate: '',
    image: '',
    // Dynamic fields (Fix #16)
    serialNumber: '',
    warranty: '',
    wholesalePrice: 0,
    size: '',
    color: '',
    minStockLevel: 5,
    // Unit settings
    bulkUnit: 'كرتونة',
    smallUnit: 'قطعة',
    conversionFactor: 1,
    bulkCostPrice: 0,
    bulkSalePrice: 0,
    trackByUnit: 'piece' as 'piece' | 'bulk',
  });
  
  // Unit settings collapsible state
  const [showUnitSettings, setShowUnitSettings] = useState(false);
  
  // Get effective field configuration - reload when page gains focus or storage changes
  const [fieldsConfig, setFieldsConfig] = useState<ProductFieldsConfig>(getEffectiveFieldsConfig);
  const [customFields, setCustomFields] = useState<CustomField[]>(() => getEnabledCustomFields());
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number>>({});
  
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
    
    // Reload on focus (when user comes back from settings)
    window.addEventListener('focus', reloadFieldsConfig);
    
    // Reload on storage change (different tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.includes('hyperpos_product_fields') || e.key?.includes('hyperpos_custom_fields')) {
        reloadFieldsConfig();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Initial load
    reloadFieldsConfig();
    
    return () => {
      window.removeEventListener(EVENTS.PRODUCT_FIELDS_UPDATED, handleFieldsUpdated);
      window.removeEventListener(EVENTS.CUSTOM_FIELDS_UPDATED, handleFieldsUpdated);
      window.removeEventListener('focus', reloadFieldsConfig);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Use Capacitor Camera hook
  const { pickFromGallery, isLoading: isCameraLoading } = useCamera({ maxSize: 640, quality: 70 });

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load data from cloud
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cloudProducts, cloudCategories] = await Promise.all([
        loadProductsCloud(),
        getCategoryNamesCloud()
      ]);
      setProducts(cloudProducts);
      setCategoryOptions(cloudCategories);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('فشل في تحميل المنتجات');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memory leak prevention - proper cleanup for storage events
  useEffect(() => {
    loadData();
    
    const handleProductsUpdated = () => loadData();
    const handleCategoriesUpdated = () => loadData();
    
    window.addEventListener(EVENTS.PRODUCTS_UPDATED, handleProductsUpdated);
    window.addEventListener(EVENTS.CATEGORIES_UPDATED, handleCategoriesUpdated);
    window.addEventListener('focus', loadData);
    
    return () => {
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, handleProductsUpdated);
      window.removeEventListener(EVENTS.CATEGORIES_UPDATED, handleCategoriesUpdated);
      window.removeEventListener('focus', loadData);
    };
  }, [loadData]);

  // Auto-open add dialog from URL params
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setFormData({ name: '', barcode: '', category: categoryOptions[0] || 'هواتف', costPrice: 0, salePrice: 0, quantity: 0, expiryDate: '', image: '', serialNumber: '', warranty: '', wholesalePrice: 0, size: '', color: '', minStockLevel: 5, bulkUnit: 'كرتونة', smallUnit: 'قطعة', conversionFactor: 1, bulkCostPrice: 0, bulkSalePrice: 0, trackByUnit: 'piece' });
      setShowAddDialog(true);
      // إزالة الـ param بعد فتح الـ dialog
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, categoryOptions, setSearchParams]);

  // Handle gallery selection using Capacitor Camera plugin
  const handleGallerySelect = async () => {
    const base64Image = await pickFromGallery();
    if (base64Image) {
      const toastId = toast.loading('جاري رفع الصورة...');
      const imageUrl = await uploadProductImage(base64Image);
      toast.dismiss(toastId);
      if (imageUrl) {
        setFormData(prev => ({ ...prev, image: imageUrl }));
        toast.success('تم رفع الصورة بنجاح');
      } else {
        toast.error('فشل في رفع الصورة');
      }
    }
  };

  // Reload categories from cloud
  const reloadCategories = useCallback(async () => {
    const cats = await getCategoryNamesCloud();
    setCategoryOptions(cats);
  }, []);

  // Get categories used by products (cannot be deleted)
  const usedCategories = [...new Set(products.map(p => p.category))];

  const categories = ['الكل', ...categoryOptions];

// Memoized filtered results for performance
const filteredProducts = useMemo(() => {
  return products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                         product.barcode.includes(debouncedSearch);
    const matchesCategory = selectedCategory === 'الكل' || product.category === selectedCategory;
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    const matchesUnit = unitFilter === 'all' || 
                       (unitFilter === 'multi_unit' && product.conversionFactor && product.conversionFactor > 1) ||
                       (unitFilter === 'single_unit' && (!product.conversionFactor || product.conversionFactor <= 1));
    return matchesSearch && matchesCategory && matchesStatus && matchesUnit;
  });
}, [products, debouncedSearch, selectedCategory, statusFilter, unitFilter]);

  const stats = {
    total: products.length,
    inStock: products.filter(p => p.status === 'in_stock').length,
    lowStock: products.filter(p => p.status === 'low_stock').length,
    outOfStock: products.filter(p => p.status === 'out_of_stock').length,
    multiUnit: products.filter(p => p.conversionFactor && p.conversionFactor > 1).length,
  };

  const handleAddProduct = async () => {
    if (!formData.name || !formData.barcode) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    // Validate required custom fields
    for (const field of customFields) {
      if (field.required && !customFieldValues[field.id]) {
        toast.error(`حقل "${field.name}" مطلوب`);
        return;
      }
    }
    
    setIsSaving(true);
    
    // تحويل الكمية إلى قطع قبل الحفظ (دائماً نحفظ بالقطع)
    const quantityInPieces = formData.trackByUnit === 'bulk' 
      ? formData.quantity * formData.conversionFactor 
      : formData.quantity;
    
    // حساب سعر تكلفة الكرتونة تلقائياً
    const calculatedBulkCostPrice = formData.costPrice * formData.conversionFactor;
    
    const productData = {
      ...formData,
      quantity: quantityInPieces, // الكمية دائماً بالقطع
      bulkCostPrice: calculatedBulkCostPrice, // سعر التكلفة محسوب تلقائياً
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
          profile?.full_name || user.email || 'مستخدم',
          `تم إضافة منتج جديد: ${formData.name}`,
          { productId: newProduct.id, name: formData.name, barcode: formData.barcode }
        );
      }
      
      setShowAddDialog(false);
      setFormData({ name: '', barcode: '', category: 'هواتف', costPrice: 0, salePrice: 0, quantity: 0, expiryDate: '', image: '', serialNumber: '', warranty: '', wholesalePrice: 0, size: '', color: '', minStockLevel: 5, bulkUnit: 'كرتونة', smallUnit: 'قطعة', conversionFactor: 1, bulkCostPrice: 0, bulkSalePrice: 0, trackByUnit: 'piece' });
      setCustomFieldValues({});
      toast.success('تم إضافة المنتج بنجاح');
      loadData();
    } else {
      toast.error('فشل في إضافة المنتج');
    }
    
    setIsSaving(false);
  };

  const handleEditProduct = async () => {
    if (!selectedProduct || !formData.name) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    // Validate required custom fields
    for (const field of customFields) {
      if (field.required && !customFieldValues[field.id]) {
        toast.error(`حقل "${field.name}" مطلوب`);
        return;
      }
    }
    
    setIsSaving(true);
    
    // تحويل الكمية إلى قطع قبل الحفظ (دائماً نحفظ بالقطع)
    const quantityInPieces = formData.trackByUnit === 'bulk' 
      ? formData.quantity * formData.conversionFactor 
      : formData.quantity;
    
    // حساب سعر تكلفة الكرتونة تلقائياً
    const calculatedBulkCostPrice = formData.costPrice * formData.conversionFactor;
    
    const productData = {
      ...formData,
      quantity: quantityInPieces, // الكمية دائماً بالقطع
      bulkCostPrice: calculatedBulkCostPrice, // سعر التكلفة محسوب تلقائياً
      expiryDate: formData.expiryDate || undefined,
      customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
    };
    
    const success = await updateProductCloud(selectedProduct.id, productData);
    
    if (success) {
      // Log activity
      if (user) {
        addActivityLog(
          'product_updated',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `تم تعديل منتج: ${formData.name}`,
          { productId: selectedProduct.id, name: formData.name }
        );
      }
      
      setShowEditDialog(false);
      setSelectedProduct(null);
      setCustomFieldValues({});
      toast.success('تم تعديل المنتج بنجاح');
      loadData();
    } else {
      toast.error('فشل في تعديل المنتج');
    }
    
    setIsSaving(false);
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    
    setIsSaving(true);
    
    const productName = selectedProduct.name;
    const success = await deleteProductCloud(selectedProduct.id);
    
    if (success) {
      // Log activity
      if (user) {
        addActivityLog(
          'product_deleted',
          user.id,
          profile?.full_name || user.email || 'مستخدم',
          `تم حذف منتج: ${productName}`,
          { productId: selectedProduct.id, name: productName }
        );
      }
      
      setShowDeleteDialog(false);
      setSelectedProduct(null);
      toast.success('تم حذف المنتج بنجاح');
      loadData();
    } else {
      toast.error('فشل في حذف المنتج');
    }
    
    setIsSaving(false);
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    
    // الكمية في قاعدة البيانات دائماً بالقطع
    // نحولها للوحدة المستخدمة للتتبع عند العرض
    const trackByUnit = product.trackByUnit || 'piece';
    const conversionFactor = product.conversionFactor || 1;
    const quantityForDisplay = trackByUnit === 'bulk' 
      ? Math.floor(product.quantity / conversionFactor)
      : product.quantity;
    
    setFormData({
      name: product.name,
      barcode: product.barcode,
      category: product.category,
      costPrice: product.costPrice,
      salePrice: product.salePrice,
      quantity: quantityForDisplay,
      expiryDate: product.expiryDate || '',
      image: product.image || '',
      serialNumber: product.serialNumber || '',
      warranty: product.warranty || '',
      wholesalePrice: product.wholesalePrice || 0,
      size: product.size || '',
      color: product.color || '',
      minStockLevel: product.minStockLevel || 5,
      // Unit settings
      bulkUnit: product.bulkUnit || 'كرتونة',
      smallUnit: product.smallUnit || 'قطعة',
      conversionFactor: conversionFactor,
      bulkCostPrice: product.bulkCostPrice || 0,
      bulkSalePrice: product.bulkSalePrice || 0,
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
    setScannerOpen(true);
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-14 md:pr-0">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">{t('products.pageTitle')}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">{t('products.pageSubtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCategoryManager(true)}>
            <Tag className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            {t('products.categories')}
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => {
            setFormData({ name: '', barcode: '', category: categoryOptions[0] || 'هواتف', costPrice: 0, salePrice: 0, quantity: 0, expiryDate: '', image: '', serialNumber: '', warranty: '', wholesalePrice: 0, size: '', color: '', minStockLevel: 5, bulkUnit: 'كرتونة', smallUnit: 'قطعة', conversionFactor: 1, bulkCostPrice: 0, bulkSalePrice: 0, trackByUnit: 'piece' });
            setShowAddDialog(true);
          }}>
            <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            {t('products.addProduct')}
          </Button>
        </div>
      </div>

      {/* Stats - Clickable for filtering */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <button 
          onClick={() => setStatusFilter('all')}
          className={cn(
            "bg-card rounded-xl border p-3 md:p-4 text-right transition-all hover:shadow-md",
            statusFilter === 'all' ? "border-primary ring-2 ring-primary/20" : "border-border"
          )}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
              <Package className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs md:text-sm text-muted-foreground">إجمالي</p>
            </div>
          </div>
        </button>
        <button 
          onClick={() => setStatusFilter('in_stock')}
          className={cn(
            "bg-card rounded-xl border p-3 md:p-4 text-right transition-all hover:shadow-md",
            statusFilter === 'in_stock' ? "border-success ring-2 ring-success/20" : "border-border"
          )}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-success/10">
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-success" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.inStock}</p>
              <p className="text-xs md:text-sm text-muted-foreground">متوفر</p>
            </div>
          </div>
        </button>
        <button 
          onClick={() => setStatusFilter('low_stock')}
          className={cn(
            "bg-card rounded-xl border p-3 md:p-4 text-right transition-all hover:shadow-md",
            statusFilter === 'low_stock' ? "border-warning ring-2 ring-warning/20" : "border-border"
          )}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-warning" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.lowStock}</p>
              <p className="text-xs md:text-sm text-muted-foreground">منخفض</p>
            </div>
          </div>
        </button>
        <button 
          onClick={() => setStatusFilter('out_of_stock')}
          className={cn(
            "bg-card rounded-xl border p-3 md:p-4 text-right transition-all hover:shadow-md",
            statusFilter === 'out_of_stock' ? "border-destructive ring-2 ring-destructive/20" : "border-border"
          )}
        >
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-foreground">{stats.outOfStock}</p>
              <p className="text-xs md:text-sm text-muted-foreground">نفذ</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="بحث بالاسم أو الباركود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 md:pr-10 bg-muted border-0"
            />
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-10 w-10 flex-shrink-0"
            onClick={() => {
              setScanTarget('search');
              setScannerOpen(true);
            }}
          >
            <ScanLine className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
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
          
          {/* Unit Filter */}
          <div className="h-6 w-px bg-border mx-1 self-center" />
          <button
            onClick={() => setUnitFilter(unitFilter === 'multi_unit' ? 'all' : 'multi_unit')}
            className={cn(
              "px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-1.5",
              unitFilter === 'multi_unit'
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <Boxes className="w-3.5 h-3.5" />
            متعدد الوحدات ({stats.multiUnit})
          </button>
        </div>
      </div>

      {/* Products Grid - Mobile */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-start gap-3 mb-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
              <div className="flex justify-between pt-3 border-t border-border">
                <Skeleton className="h-4 w-20" />
                <div className="flex gap-1">
                  <Skeleton className="h-10 w-10 rounded" />
                  <Skeleton className="h-10 w-10 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3">
        {filteredProducts.map((product, index) => {
          const status = statusConfig[product.status];
          const profit = product.salePrice - product.costPrice;
          
          return (
            <div 
              key={product.id}
              className="bg-card rounded-xl border border-border p-4 fade-in"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground text-sm line-clamp-1">{product.name}</h3>
                  <p className="text-xs text-muted-foreground">{product.category}</p>
                </div>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", status.color)}>
                  {status.label}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">الشراء</p>
                  <p className="font-semibold text-sm">${product.costPrice}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">البيع</p>
                  <p className="font-semibold text-sm text-primary">${product.salePrice}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الربح</p>
                  <p className="font-semibold text-sm text-success">${profit}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="text-sm">
                  <DualUnitDisplay
                    totalPieces={product.quantity}
                    conversionFactor={product.conversionFactor || 1}
                    bulkUnit={product.bulkUnit}
                    smallUnit={product.smallUnit}
                    showTotal={false}
                    size="sm"
                  />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-10 w-10 min-w-[40px]" onClick={() => openEditDialog(product)}>
                    <Edit className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10 min-w-[40px] text-destructive" onClick={() => openDeleteDialog(product)}>
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Products Table - Desktop */}
      <div className="hidden lg:block bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-right py-3 px-3 text-sm font-medium text-muted-foreground">المنتج</th>
                <th className="text-right py-3 px-3 text-sm font-medium text-muted-foreground">التصنيف</th>
                <th className="text-right py-3 px-3 text-sm font-medium text-muted-foreground">الأسعار</th>
                <th className="text-right py-3 px-3 text-sm font-medium text-muted-foreground">الربح</th>
                <th className="text-right py-3 px-3 text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Boxes className="w-4 h-4" />
                    المخزون
                  </div>
                </th>
                <th className="text-center py-3 px-3 text-sm font-medium text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product, index) => {
                const status = statusConfig[product.status];
                const profit = product.salePrice - product.costPrice;
                const profitPercentage = product.costPrice > 0 ? ((profit / product.costPrice) * 100).toFixed(0) : '0';
                
                return (
                  <tr 
                    key={product.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {/* المنتج + الباركود */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-foreground text-sm truncate">{product.name}</span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Barcode className="w-3 h-3 flex-shrink-0" />
                            <span className="font-mono truncate">{product.barcode}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* التصنيف */}
                    <td className="py-3 px-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground whitespace-nowrap">
                        {product.category}
                      </span>
                    </td>
                    
                    {/* الأسعار (شراء + بيع) فوق بعض */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">شراء:</span>
                          <span className="text-muted-foreground">${product.costPrice}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">بيع:</span>
                          <span className="font-semibold text-foreground">${product.salePrice}</span>
                        </div>
                      </div>
                    </td>
                    
                    {/* الربح */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-success text-sm">${profit}</span>
                        <span className="text-xs text-muted-foreground">{profitPercentage}%</span>
                      </div>
                    </td>
                    
                    {/* المخزون + الحالة */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1.5">
                        <DualUnitDisplay
                          totalPieces={product.quantity}
                          conversionFactor={product.conversionFactor || 1}
                          bulkUnit={product.bulkUnit}
                          smallUnit={product.smallUnit}
                          showTotal={product.conversionFactor && product.conversionFactor > 1}
                          size="sm"
                        />
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium w-fit",
                          status.color
                        )}>
                          <status.icon className="w-2.5 h-2.5" />
                          {status.label}
                        </span>
                      </div>
                    </td>
                    
                    {/* الإجراءات (فوق بعض) */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col items-center gap-1">
                        <button 
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(product)}
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                          onClick={() => openDeleteDialog(product)}
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              إضافة منتج جديد
            </DialogTitle>
            <DialogDescription>أدخل بيانات المنتج الجديد</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 pb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">اسم المنتج *</label>
                <Input
                  placeholder="مثال: iPhone 15 Pro"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">الباركود *</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="123456789012"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                  <Button variant="outline" onClick={openBarcodeScannerForForm} type="button">
                    <ScanLine className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">التصنيف</label>
                <select 
                  className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">الكمية</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.quantity || ''}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">سعر الشراء ($)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.costPrice || ''}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">سعر البيع ($)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.salePrice || ''}
                  onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                />
              </div>
              
              {/* Unit Settings Collapsible */}
              <div className="sm:col-span-2">
                <Collapsible open={showUnitSettings} onOpenChange={setShowUnitSettings}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" type="button">
                      <span className="flex items-center gap-2">
                        <Boxes className="w-4 h-4" />
                        إعدادات الوحدات (كرتونة / قطعة)
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {showUnitSettings ? 'إخفاء' : 'عرض'}
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <UnitSettingsTab
                      data={{
                        bulkUnit: formData.bulkUnit,
                        smallUnit: formData.smallUnit,
                        conversionFactor: formData.conversionFactor,
                        bulkCostPrice: formData.bulkCostPrice,
                        bulkSalePrice: formData.bulkSalePrice,
                        trackByUnit: formData.trackByUnit,
                      }}
                      onChange={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
                      quantityInPieces={formData.trackByUnit === 'bulk' 
                        ? formData.quantity * formData.conversionFactor 
                        : formData.quantity}
                      pieceCostPrice={formData.costPrice}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </div>
              
              {/* Dynamic Fields based on store type (Fix #16) */}
              {fieldsConfig.expiryDate && (
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">تاريخ الصلاحية</label>
                  <DatePicker
                    value={formData.expiryDate}
                    onChange={(date) => setFormData({ ...formData, expiryDate: date })}
                    placeholder="اختر تاريخ الصلاحية"
                  />
                </div>
              )}
              {fieldsConfig.serialNumber && (
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">الرقم التسلسلي / IMEI</label>
                  <Input
                    placeholder="مثال: 123456789012345"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  />
                </div>
              )}
              {fieldsConfig.warranty && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">مدة الضمان</label>
                  <Input
                    placeholder="مثال: 12 شهر"
                    value={formData.warranty}
                    onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                  />
                </div>
              )}
              {fieldsConfig.wholesalePrice && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">سعر الجملة ($)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.wholesalePrice || ''}
                    onChange={(e) => setFormData({ ...formData, wholesalePrice: Number(e.target.value) })}
                  />
                </div>
              )}
              {fieldsConfig.sizeColor && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">المقاس</label>
                    <Input
                      placeholder="مثال: XL"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">اللون</label>
                    <Input
                      placeholder="مثال: أسود"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                  </div>
                </>
              )}
              {fieldsConfig.minStockLevel && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">الحد الأدنى للمخزون</label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={formData.minStockLevel || ''}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: Number(e.target.value) })}
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
                <label className="text-sm font-medium mb-1.5 block">صورة المنتج</label>
                <div className="flex flex-col gap-3">
                  {formData.image ? (
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                      <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image: '' })}
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
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGallerySelect}
                    disabled={isCameraLoading}
                  >
                    {isCameraLoading ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4 ml-2" />
                    )}
                    إضافة صورة
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleAddProduct}>
                <Save className="w-4 h-4 ml-2" />
                حفظ المنتج
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              تعديل المنتج
            </DialogTitle>
            <DialogDescription>تعديل بيانات المنتج</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 pb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">اسم المنتج *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">الباركود</label>
                <Input
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">التصنيف</label>
                <select 
                  className="w-full h-10 px-3 rounded-md bg-muted border-0 text-foreground"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">الكمية</label>
                <Input
                  type="number"
                  value={formData.quantity || ''}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">سعر الشراء ($)</label>
                <Input
                  type="number"
                  value={formData.costPrice || ''}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">سعر البيع ($)</label>
                <Input
                  type="number"
                  value={formData.salePrice || ''}
                  onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                />
              </div>
              
              {/* Unit Settings Collapsible */}
              <div className="sm:col-span-2">
                <Collapsible open={showUnitSettings} onOpenChange={setShowUnitSettings}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" type="button">
                      <span className="flex items-center gap-2">
                        <Boxes className="w-4 h-4" />
                        إعدادات الوحدات (كرتونة / قطعة)
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {showUnitSettings ? 'إخفاء' : 'عرض'}
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <UnitSettingsTab
                      data={{
                        bulkUnit: formData.bulkUnit,
                        smallUnit: formData.smallUnit,
                        conversionFactor: formData.conversionFactor,
                        bulkCostPrice: formData.bulkCostPrice,
                        bulkSalePrice: formData.bulkSalePrice,
                        trackByUnit: formData.trackByUnit,
                      }}
                      onChange={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
                      quantityInPieces={formData.trackByUnit === 'bulk' 
                        ? formData.quantity * formData.conversionFactor 
                        : formData.quantity}
                      pieceCostPrice={formData.costPrice}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </div>
              
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">تاريخ الصلاحية (اختياري)</label>
                <Input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
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
                <label className="text-sm font-medium mb-1.5 block">صورة المنتج</label>
                <div className="flex flex-col gap-3">
                  {formData.image ? (
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                      <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image: '' })}
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
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGallerySelect}
                    disabled={isCameraLoading}
                  >
                    {isCameraLoading ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4 ml-2" />
                    )}
                    إضافة صورة
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={handleEditProduct}>
                <Save className="w-4 h-4 ml-2" />
                حفظ التعديلات
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المنتج "{selectedProduct?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(barcode) => {
          if (scanTarget === 'form') {
            setFormData((prev) => ({ ...prev, barcode }));
            toast.success('تمت قراءة الباركود', { description: barcode });
            return;
          }

          setSearchQuery(barcode);
          const product = products.find((p) => p.barcode === barcode);
          if (product) {
            toast.success(`تم العثور على: ${product.name}`);
          } else {
            toast.info(`الباركود: ${barcode}`, { description: 'لم يتم العثور على منتج' });
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
    </div>
  );
}
