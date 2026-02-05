import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Search,
  Filter,
  Grid3X3,
  List,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  Package
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { loadProductsCloud } from '@/lib/cloud/products-cloud';

interface Product {
  id: string;
  name: string;
  salePrice: number;
  quantity: number;
  category: string;
  image?: string;
  barcode?: string;
}

// مكون جديد: معالج الفواتير خطوة بخطوة
function InvoiceWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<'header' | 'products' | 'review'>('header');
  const [invoiceData, setInvoiceData] = useState({
    customerName: '',
    date: new Date().toISOString().split('T')[0],
    items: [] as any[]
  });
  const [currentProduct, setCurrentProduct] = useState({
    name: '',
    quantity: 1,
    price: 0,
    unit: 'piece'
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const isMobile = useIsMobile();
  const { toast } = useToast();

  const handleNextProduct = () => {
    if (!currentProduct.name || currentProduct.quantity <= 0) {
      toast({
        title: "تنبيه",
        description: "يرجى إدخال اسم المنتج والكمية",
        variant: "destructive"
      });
      return;
    }

    if (editingIndex !== null) {
      // تعديل منتج موجود
      const newItems = [...invoiceData.items];
      newItems[editingIndex] = currentProduct;
      setInvoiceData({ ...invoiceData, items: newItems });
      setEditingIndex(null);
    } else {
      // إضافة منتج جديد
      setInvoiceData({
        ...invoiceData,
        items: [...invoiceData.items, { ...currentProduct, id: Date.now() }]
      });
    }

    // إعادة تعيين المنتج الحالي
    setCurrentProduct({ name: '', quantity: 1, price: 0, unit: 'piece' });

    toast({
      title: "تم الحفظ",
      description: editingIndex !== null ? "تم تعديل المنتج" : "تم إضافة المنتج"
    });
  };

  const handlePreviousProduct = () => {
    if (invoiceData.items.length === 0) {
      setStep('header');
      return;
    }

    const lastIndex = invoiceData.items.length - 1;
    setCurrentProduct(invoiceData.items[lastIndex]);
    setEditingIndex(lastIndex);

    // إزالة المنتج من القائمة مؤقتاً للتعديل
    const newItems = invoiceData.items.slice(0, -1);
    setInvoiceData({ ...invoiceData, items: newItems });
  };

  const handleReview = () => {
    if (invoiceData.items.length === 0) {
      toast({
        title: "تنبيه",
        description: "يرجى إضافة منتج واحد على الأقل",
        variant: "destructive"
      });
      return;
    }
    setStep('review');
  };

  const handleFinish = () => {
    // حفظ الفاتورة
    console.log('Invoice saved:', invoiceData);
    toast({
      title: "تم بنجاح",
      description: `تم حفظ الفاتورة بـ ${invoiceData.items.length} منتجات`
    });
    onClose();
    // إعادة التعيين
    setStep('header');
    setInvoiceData({ customerName: '', date: new Date().toISOString().split('T')[0], items: [] });
    setCurrentProduct({ name: '', quantity: 1, price: 0, unit: 'piece' });
  };

  const totalAmount = invoiceData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${isMobile ? 'w-[95vw] max-w-none p-4' : 'max-w-2xl'} max-h-[90vh] overflow-hidden flex flex-col`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {step === 'header' && 'بيانات الفاتورة'}
            {step === 'products' && `إضافة منتج ${editingIndex !== null ? '(تعديل)' : `(${invoiceData.items.length + 1})`}`}
            {step === 'review' && 'مراجعة الفاتورة'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {step === 'header' && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">اسم العميل</label>
                <Input
                  value={invoiceData.customerName}
                  onChange={(e) => setInvoiceData({ ...invoiceData, customerName: e.target.value })}
                  placeholder="أدخل اسم العميل"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">التاريخ</label>
                <Input
                  type="date"
                  value={invoiceData.date}
                  onChange={(e) => setInvoiceData({ ...invoiceData, date: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={() => setStep('products')}>
                التالي: إضافة المنتجات
              </Button>
            </div>
          )}

          {step === 'products' && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">اسم المنتج *</label>
                <Input
                  value={currentProduct.name}
                  onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                  placeholder="اسم المنتج"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">الكمية *</label>
                  <Input
                    type="number"
                    min="1"
                    value={currentProduct.quantity}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">السعر</label>
                  <Input
                    type="number"
                    value={currentProduct.price}
                    onChange={(e) => setCurrentProduct({ ...currentProduct, price: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">الوحدة</label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={currentProduct.unit}
                  onChange={(e) => setCurrentProduct({ ...currentProduct, unit: e.target.value })}
                >
                  <option value="piece">قطعة</option>
                  <option value="kg">كيلوغرام</option>
                  <option value="box">صندوق</option>
                  <option value="meter">متر</option>
                </select>
              </div>

              {/* عرض المنتجات المضافة */}
              {invoiceData.items.length > 0 && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-medium mb-2">المنتجات المضافة ({invoiceData.items.length}):</p>
                  <div className="space-y-1">
                    {invoiceData.items.map((item, idx) => (
                      <div key={item.id} className="text-sm flex justify-between">
                        <span>{idx + 1}. {item.name} × {item.quantity}</span>
                        <span>{(item.quantity * item.price).toFixed(2)} $</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t mt-2 pt-2 font-bold flex justify-between">
                    <span>الإجمالي:</span>
                    <span>{totalAmount.toFixed(2)} $</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handlePreviousProduct} className="flex-1">
                  السابق
                </Button>
                <Button onClick={handleNextProduct} className="flex-1">
                  {editingIndex !== null ? 'حفظ التعديل' : 'المنتج التالي'}
                </Button>
              </div>

              <Button variant="secondary" className="w-full" onClick={handleReview}>
                مراجعة الفاتورة وإنهائها
              </Button>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">العميل:</span>
                  <span className="font-medium">{invoiceData.customerName || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">التاريخ:</span>
                  <span>{invoiceData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">عدد المنتجات:</span>
                  <span>{invoiceData.items.length}</span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-right">المنتج</th>
                      <th className="p-2">الكمية</th>
                      <th className="p-2">السعر</th>
                      <th className="p-2">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">{item.name}</td>
                        <td className="p-2 text-center">{item.quantity} {item.unit}</td>
                        <td className="p-2 text-center">{item.price.toFixed(2)}</td>
                        <td className="p-2 text-center font-medium">{(item.quantity * item.price).toFixed(2)} $</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-xl font-bold text-center p-4 bg-primary/10 rounded-lg">
                الإجمالي: {totalAmount.toFixed(2)} $
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep('products')} className="flex-1">
                  الرجوع للتعديل
                </Button>
                <Button onClick={handleFinish} className="flex-1">
                  تأكيد وإنهاء
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const isMobile = useIsMobile();
  const { toast } = useToast();

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const data = await loadProductsCloud();
      setProducts(data);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل المنتجات",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.includes(searchQuery)
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">المنتجات</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setInvoiceOpen(true)}
            className="gap-2 flex-1 md:flex-none"
          >
            <FileText className="h-4 w-4" />
            فاتورة جديدة
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {!isMobile && "منتج جديد"}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="البحث في المنتجات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Products Grid - متجاوب */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {[...Array(isMobile ? 4 : 8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-24 md:h-32 bg-muted rounded-t-lg" />
              <CardContent className="p-3">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className={`grid gap-3 md:gap-4 ${viewMode === 'grid'
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            : 'grid-cols-1'
          }`}>
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className={`group overflow-hidden hover:shadow-lg transition-all ${viewMode === 'list' ? 'flex flex-row items-center' : ''
                }`}
            >
              {/* صورة المنتج */}
              <div className={`relative bg-muted overflow-hidden ${viewMode === 'list' ? 'w-24 h-24' : 'h-24 md:h-32'
                }`}>
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Package className="h-8 w-8 md:h-12 md:w-12" />
                  </div>
                )}
                {/* بادج الكمية */}
                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold ${product.quantity === 0 ? 'bg-red-500 text-white' :
                    product.quantity <= 5 ? 'bg-orange-500 text-white' :
                      'bg-green-500 text-white'
                  }`}>
                  {product.quantity}
                </div>
              </div>

              <CardContent className={`p-3 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm md:text-base truncate">{product.name}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">{product.category}</p>
                  </div>

                  {!isMobile && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 ml-2" />
                          تعديل
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 ml-2" />
                          حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-lg md:text-xl font-bold text-primary">
                    {product.salePrice.toFixed(2)} $
                  </span>
                  {isMobile && (
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* نتائج البحث */}
      {!isLoading && filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">لا توجد منتجات</p>
        </div>
      )}

      {/* معالج الفواتير */}
      <InvoiceWizard open={invoiceOpen} onClose={() => setInvoiceOpen(false)} />
    </div>
  );
}
