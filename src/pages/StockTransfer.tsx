import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { 
  Plus, 
  ArrowLeftRight, 
  Package,
  Trash2,
  Check,
  X,
  Printer,
  FileText,
  Search,
  ScanLine
} from 'lucide-react';
import { useWarehouse } from '@/hooks/use-warehouse';
import { 
  StockTransfer as StockTransferType,
  StockTransferItem,
  loadStockTransfersCloud,
  createStockTransferCloud,
  completeStockTransferCloud,
  cancelStockTransferCloud,
  getStockTransferItemsCloud
} from '@/lib/cloud/warehouses-cloud';
import { loadProductsCloud, Product } from '@/lib/cloud/products-cloud';
import { printHTML } from '@/lib/print-utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BarcodeScanner } from '@/components/BarcodeScanner';

interface TransferItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: 'piece' | 'bulk';
  conversionFactor: number;
  quantityInPieces: number;
}

export default function StockTransfer() {
  const { warehouses, mainWarehouse, refreshWarehouses } = useWarehouse();
  
  const [transfers, setTransfers] = useState<StockTransferType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransferType | null>(null);
  const [selectedTransferItems, setSelectedTransferItems] = useState<StockTransferItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState<'piece' | 'bulk'>('piece');

  // Search and scanner state
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSuggestions, setProductSuggestions] = useState<Product[]>([]);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [transfersData, productsData] = await Promise.all([
          loadStockTransfersCloud(),
          loadProductsCloud()
        ]);
        setTransfers(transfersData);
        setProducts(productsData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const vehicleWarehouses = warehouses.filter(w => w.type === 'vehicle');

  const addItemToTransfer = () => {
    if (!selectedProductId || selectedQuantity <= 0) {
      toast.error('يرجى اختيار المنتج والكمية');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    // Check if already added
    if (transferItems.some(item => item.productId === selectedProductId)) {
      toast.error('هذا المنتج مضاف مسبقاً');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conversionFactor = (product as any).conversion_factor || 1;
    const quantityInPieces = selectedUnit === 'bulk' 
      ? selectedQuantity * conversionFactor 
      : selectedQuantity;

    setTransferItems(prev => [...prev, {
      productId: selectedProductId,
      productName: product.name,
      quantity: selectedQuantity,
      unit: selectedUnit,
      conversionFactor,
      quantityInPieces
    }]);

    setSelectedProductId('');
    setProductSearchQuery('');
    setShowProductSuggestions(false);
    setSelectedQuantity(1);
    setSelectedUnit('piece');
  };

  // Product search functions
  const handleProductSearch = (value: string) => {
    setProductSearchQuery(value);
    setHighlightedIndex(-1);
    if (value.length >= 2) {
      const matches = products.filter(p => 
        p.name.toLowerCase().includes(value.toLowerCase()) ||
        (p.barcode && p.barcode.includes(value))
      ).slice(0, 8);
      setProductSuggestions(matches);
      setShowProductSuggestions(matches.length > 0);
    } else {
      setShowProductSuggestions(false);
      setProductSuggestions([]);
    }
  };

  const selectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setProductSearchQuery(product.name);
    setShowProductSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showProductSuggestions || productSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < productSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : productSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < productSuggestions.length) {
          selectProduct(productSuggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowProductSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      selectProduct(product);
      toast.success(`تم العثور على: ${product.name}`);
    } else {
      toast.error('لم يتم العثور على منتج بهذا الباركود');
    }
    setIsScannerOpen(false);
  };

  const removeItemFromTransfer = (productId: string) => {
    setTransferItems(prev => prev.filter(item => item.productId !== productId));
  };

  const handleCreateTransfer = async () => {
    if (!mainWarehouse) {
      toast.error('لا يوجد مستودع رئيسي');
      return;
    }

    if (!toWarehouseId) {
      toast.error('يرجى اختيار المستودع الوجهة');
      return;
    }

    if (transferItems.length === 0) {
      toast.error('يرجى إضافة منتجات للتحويل');
      return;
    }

    const result = await createStockTransferCloud(
      mainWarehouse.id,
      toWarehouseId,
      transferItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        quantityInPieces: item.quantityInPieces
      })),
      notes
    );

    if (result) {
      toast.success('تم إنشاء أمر التحويل بنجاح');
      setIsCreateDialogOpen(false);
      resetForm();
      // Reload transfers
      const newTransfers = await loadStockTransfersCloud();
      setTransfers(newTransfers);
    } else {
      toast.error('فشل في إنشاء أمر التحويل');
    }
  };

  const handleCompleteTransfer = async (transfer: StockTransferType) => {
    if (confirm('هل أنت متأكد من تأكيد التحويل؟ سيتم خصم الكميات من المستودع الرئيسي وإضافتها لمخزن الموزع.')) {
      const success = await completeStockTransferCloud(transfer.id);
      if (success) {
        toast.success('تم تأكيد التحويل بنجاح');
        
        // طباعة وصل استلام العهدة تلقائياً بعد التأكيد
        await printTransferReceipt(transfer);
        
        const newTransfers = await loadStockTransfersCloud();
        setTransfers(newTransfers);
        refreshWarehouses();
      } else {
        toast.error('فشل في تأكيد التحويل');
      }
    }
  };

  const handleCancelTransfer = async (transfer: StockTransferType) => {
    if (confirm('هل أنت متأكد من إلغاء التحويل؟')) {
      const success = await cancelStockTransferCloud(transfer.id);
      if (success) {
        toast.success('تم إلغاء التحويل');
        const newTransfers = await loadStockTransfersCloud();
        setTransfers(newTransfers);
      } else {
        toast.error('فشل في إلغاء التحويل');
      }
    }
  };

  const viewTransferDetails = async (transfer: StockTransferType) => {
    setSelectedTransfer(transfer);
    const items = await getStockTransferItemsCloud(transfer.id);
    setSelectedTransferItems(items);
    setIsDetailsDialogOpen(true);
  };

  const printTransferReceipt = async (transfer: StockTransferType) => {
    const items = await getStockTransferItemsCloud(transfer.id);
    const toWarehouse = warehouses.find(w => w.id === transfer.to_warehouse_id);
    const fromWarehouse = warehouses.find(w => w.id === transfer.from_warehouse_id);

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
          h1 { text-align: center; margin-bottom: 20px; }
          .info { margin-bottom: 15px; }
          .info div { margin-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background: #f5f5f5; }
          .footer { margin-top: 30px; text-align: center; }
          .signature { margin-top: 50px; display: flex; justify-content: space-between; }
          .signature div { text-align: center; }
        </style>
      </head>
      <body>
        <h1>وصل استلام عهدة</h1>
        
        <div class="info">
          <div><strong>رقم التحويل:</strong> ${transfer.transfer_number}</div>
          <div><strong>التاريخ:</strong> ${format(new Date(transfer.created_at), 'yyyy/MM/dd HH:mm', { locale: ar })}</div>
          <div><strong>من:</strong> ${fromWarehouse?.name || 'المستودع الرئيسي'}</div>
          <div><strong>إلى:</strong> ${toWarehouse?.name || ''}</div>
          ${transfer.notes ? `<div><strong>ملاحظات:</strong> ${transfer.notes}</div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>الوحدة</th>
              <th>إجمالي القطع</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, i) => {
              const product = products.find(p => p.id === item.product_id);
              return `
                <tr>
                  <td>${i + 1}</td>
                  <td>${product?.name || 'منتج'}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unit === 'bulk' ? 'كرتونة' : 'قطعة'}</td>
                  <td>${item.quantity_in_pieces}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="signature">
          <div>
            <p>توقيع المستلم</p>
            <p>________________</p>
          </div>
          <div>
            <p>توقيع المسلّم</p>
            <p>________________</p>
          </div>
        </div>

        <div class="footer">
          <p>FlowPOS Pro - نظام نقاط البيع</p>
        </div>
      </body>
      </html>
    `;

    printHTML(html);
  };

  const resetForm = () => {
    setToWarehouseId('');
    setNotes('');
    setTransferItems([]);
    setSelectedProductId('');
    setProductSearchQuery('');
    setShowProductSuggestions(false);
    setSelectedQuantity(1);
    setSelectedUnit('piece');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">قيد الانتظار</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600">مكتمل</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600">ملغي</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getWarehouseName = (warehouseId: string) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse?.name || 'غير معروف';
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">تحويل العهدة</h1>
            <p className="text-muted-foreground">إدارة تحويل المخزون من المستودع الرئيسي للموزعين</p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                إنشاء أمر صرف
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5" />
                  إنشاء أمر صرف جديد
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* From/To */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>من المستودع</Label>
                    <Input value={mainWarehouse?.name || 'المستودع الرئيسي'} disabled />
                  </div>
                  <div>
                    <Label>إلى مخزن الموزع</Label>
                    <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المستودع" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleWarehouses.map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Add Product */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">إضافة منتج</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Row 1: Search and Barcode */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          ref={searchInputRef}
                          type="text"
                          placeholder="ابحث عن المنتج بالاسم أو الباركود..."
                          value={productSearchQuery}
                          onChange={(e) => handleProductSearch(e.target.value)}
                          onKeyDown={handleSearchKeyDown}
                          onFocus={() => {
                            if (productSearchQuery.length >= 2) setShowProductSuggestions(true);
                          }}
                          onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                          className="pr-9 h-11"
                        />
                        
                        {/* Suggestions Dropdown */}
                        {showProductSuggestions && productSuggestions.length > 0 && (
                          <div 
                            className="absolute top-full z-50 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto"
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {productSuggestions.map((product, index) => (
                              <div
                                key={product.id}
                                onClick={() => selectProduct(product)}
                                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                  index === highlightedIndex 
                                    ? 'bg-accent text-accent-foreground' 
                                    : 'hover:bg-accent/50'
                                }`}
                              >
                                <Package className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                <span className="flex-1 truncate">{product.name}</span>
                                {product.barcode && (
                                  <span className="text-xs text-muted-foreground">
                                    {product.barcode}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Barcode Scanner Button */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsScannerOpen(true)}
                        title="مسح باركود"
                        type="button"
                        className="h-11 w-11 flex-shrink-0"
                      >
                        <ScanLine className="w-5 h-5" />
                      </Button>
                    </div>
                    
                    {/* Row 2: Quantity, Unit, and Add Button */}
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={selectedQuantity}
                        onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
                        placeholder="الكمية"
                      />
                      
                      <Select value={selectedUnit} onValueChange={(v: 'piece' | 'bulk') => setSelectedUnit(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="piece">قطعة</SelectItem>
                          <SelectItem value="bulk">كرتونة</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button onClick={addItemToTransfer} disabled={!selectedProductId} className="gap-2">
                        <Plus className="w-4 h-4" />
                        إضافة
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Barcode Scanner Dialog */}
                <BarcodeScanner
                  isOpen={isScannerOpen}
                  onClose={() => setIsScannerOpen(false)}
                  onScan={handleBarcodeScan}
                />

                {/* Items List */}
                {transferItems.length > 0 && (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>المنتج</TableHead>
                          <TableHead>الكمية</TableHead>
                          <TableHead>الوحدة</TableHead>
                          <TableHead>إجمالي القطع</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transferItems.map(item => (
                          <TableRow key={item.productId}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{item.unit === 'bulk' ? 'كرتونة' : 'قطعة'}</TableCell>
                            <TableCell>{item.quantityInPieces}</TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => removeItemFromTransfer(item.productId)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <Label>ملاحظات (اختياري)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أي ملاحظات إضافية..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
                    إلغاء
                  </Button>
                  <Button onClick={handleCreateTransfer} disabled={transferItems.length === 0}>
                    إنشاء أمر الصرف
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Transfers List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              سجل التحويلات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
            ) : transfers.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا توجد تحويلات</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم التحويل</TableHead>
                      <TableHead>من</TableHead>
                      <TableHead>إلى</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map(transfer => (
                      <TableRow key={transfer.id}>
                        <TableCell className="font-mono">{transfer.transfer_number}</TableCell>
                        <TableCell>{getWarehouseName(transfer.from_warehouse_id)}</TableCell>
                        <TableCell>{getWarehouseName(transfer.to_warehouse_id)}</TableCell>
                        <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                        <TableCell>
                          {format(new Date(transfer.created_at), 'yyyy/MM/dd HH:mm', { locale: ar })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => viewTransferDetails(transfer)}
                              title="عرض التفاصيل"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            
                            {transfer.status === 'pending' && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleCompleteTransfer(transfer)}
                                  title="تأكيد التحويل"
                                  className="text-green-600"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleCancelTransfer(transfer)}
                                  title="إلغاء"
                                  className="text-destructive"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            
                            {transfer.status === 'completed' && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => printTransferReceipt(transfer)}
                                title="طباعة وصل الاستلام"
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>تفاصيل التحويل</DialogTitle>
            </DialogHeader>
            {selectedTransfer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">رقم التحويل:</span>
                    <p className="font-mono">{selectedTransfer.transfer_number}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الحالة:</span>
                    <p>{getStatusBadge(selectedTransfer.status)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">من:</span>
                    <p>{getWarehouseName(selectedTransfer.from_warehouse_id)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">إلى:</span>
                    <p>{getWarehouseName(selectedTransfer.to_warehouse_id)}</p>
                  </div>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المنتج</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>الوحدة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTransferItems.map(item => {
                        const product = products.find(p => p.id === item.product_id);
                        return (
                          <TableRow key={item.id}>
                            <TableCell>{product?.name || 'منتج'}</TableCell>
                            <TableCell>{item.quantity_in_pieces}</TableCell>
                            <TableCell>قطعة</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {selectedTransfer.notes && (
                  <div>
                    <span className="text-muted-foreground text-sm">ملاحظات:</span>
                    <p className="text-sm">{selectedTransfer.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
