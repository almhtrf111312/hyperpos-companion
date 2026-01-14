import { useState, useEffect, useRef } from 'react';
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
  Upload,
  Image as ImageIcon
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
import { toast } from 'sonner';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { CategoryManager } from '@/components/CategoryManager';
import { getCategoryNames } from '@/lib/categories-store';
import { 
  loadProducts, 
  saveProducts, 
  getStatus,
  Product 
} from '@/lib/products-store';

const statusConfig = {
  in_stock: { label: 'متوفر', color: 'badge-success', icon: CheckCircle },
  low_stock: { label: 'كمية منخفضة', color: 'badge-warning', icon: AlertTriangle },
  out_of_stock: { label: 'نفذ المخزون', color: 'badge-danger', icon: AlertTriangle },
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>(() => loadProducts());
  const [searchQuery, setSearchQuery] = useState('');
const [selectedCategory, setSelectedCategory] = useState('الكل');
const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
const [categoryOptions, setCategoryOptions] = useState<string[]>(getCategoryNames());
const [showCategoryManager, setShowCategoryManager] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<'search' | 'form'>('search');
  
  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category: 'هواتف',
    costPrice: 0,
    salePrice: 0,
    quantity: 0,
    expiryDate: '',
    image: '',
  });
  
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Image upload handler
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('يرجى اختيار ملف صورة صالح');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error('حجم الصورة يجب أن يكون أقل من 2 ميغابايت');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        // Compress image
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 300;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setFormData(prev => ({ ...prev, image: compressedBase64 }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Reload categories from store
  const reloadCategories = () => {
    setCategoryOptions(getCategoryNames());
  };

  // Get categories used by products (cannot be deleted)
  const usedCategories = [...new Set(products.map(p => p.category))];

  const categories = ['الكل', ...categoryOptions];

const filteredProducts = products.filter(product => {
  const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       product.barcode.includes(searchQuery);
  const matchesCategory = selectedCategory === 'الكل' || product.category === selectedCategory;
  const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
  return matchesSearch && matchesCategory && matchesStatus;
});

  const stats = {
    total: products.length,
    inStock: products.filter(p => p.status === 'in_stock').length,
    lowStock: products.filter(p => p.status === 'low_stock').length,
    outOfStock: products.filter(p => p.status === 'out_of_stock').length,
  };

  // Helper to update products state and save to localStorage
  const updateProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    saveProducts(newProducts);
  };

  const handleAddProduct = () => {
    if (!formData.name || !formData.barcode) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    
    const newProduct: Product = {
      id: Date.now().toString(),
      ...formData,
      expiryDate: formData.expiryDate || undefined,
      status: getStatus(formData.quantity),
    };
    
    updateProducts([...products, newProduct]);
    setShowAddDialog(false);
    setFormData({ name: '', barcode: '', category: 'هواتف', costPrice: 0, salePrice: 0, quantity: 0, expiryDate: '', image: '' });
    toast.success('تم إضافة المنتج بنجاح');
  };

  const handleEditProduct = () => {
    if (!selectedProduct || !formData.name) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    
    updateProducts(products.map(p => 
      p.id === selectedProduct.id 
        ? { ...p, ...formData, status: getStatus(formData.quantity) }
        : p
    ));
    setShowEditDialog(false);
    setSelectedProduct(null);
    toast.success('تم تعديل المنتج بنجاح');
  };

  const handleDeleteProduct = () => {
    if (!selectedProduct) return;
    
    updateProducts(products.filter(p => p.id !== selectedProduct.id));
    setShowDeleteDialog(false);
    setSelectedProduct(null);
    toast.success('تم حذف المنتج بنجاح');
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode,
      category: product.category,
      costPrice: product.costPrice,
      salePrice: product.salePrice,
      quantity: product.quantity,
      expiryDate: product.expiryDate || '',
      image: product.image || '',
    });
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">إدارة المنتجات</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">إدارة مخزون المنتجات والأسعار</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCategoryManager(true)}>
            <Tag className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            التصنيفات
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => {
            setFormData({ name: '', barcode: '', category: categoryOptions[0] || 'هواتف', costPrice: 0, salePrice: 0, quantity: 0, expiryDate: '', image: '' });
            setShowAddDialog(true);
          }}>
            <Plus className="w-4 h-4 md:w-5 md:h-5 ml-2" />
            إضافة منتج
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
        </div>
      </div>

      {/* Products Grid - Mobile */}
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
                  <span className="text-muted-foreground">المخزون: </span>
                  <span className="font-semibold">{product.quantity}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(product)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDeleteDialog(product)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Products Table - Desktop */}
      <div className="hidden lg:block bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">المنتج</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">الباركود</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">التصنيف</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">سعر الشراء</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">سعر البيع</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">الربح</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">الكمية</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">الحالة</th>
                <th className="text-center py-4 px-6 text-sm font-medium text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product, index) => {
                const status = statusConfig[product.status];
                const profit = product.salePrice - product.costPrice;
                const profitPercentage = ((profit / product.costPrice) * 100).toFixed(0);
                
                return (
                  <tr 
                    key={product.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <span className="font-medium text-foreground">{product.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Barcode className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm text-muted-foreground">{product.barcode}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {product.category}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-muted-foreground">${product.costPrice}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-foreground">${product.salePrice}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-success">${profit}</span>
                        <span className="text-xs text-muted-foreground">{profitPercentage}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-foreground">{product.quantity}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium",
                        status.color
                      )}>
                        <status.icon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(product)}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                          onClick={() => openDeleteDialog(product)}
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
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">تاريخ الصلاحية (اختياري)</label>
                <Input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">صورة المنتج</label>
                <input
                  type="file"
                  accept="image/*"
                  ref={imageInputRef}
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <div className="flex items-center gap-3">
                  {formData.image ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
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
                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 ml-2" />
                    رفع صورة
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
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">تاريخ الصلاحية (اختياري)</label>
                <Input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">صورة المنتج</label>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="edit-image-input"
                  onChange={handleImageUpload}
                />
                <div className="flex items-center gap-3">
                  {formData.image ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
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
                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('edit-image-input')?.click()}
                  >
                    <Upload className="w-4 h-4 ml-2" />
                    {formData.image ? 'تغيير الصورة' : 'رفع صورة'}
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
