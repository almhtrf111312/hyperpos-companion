import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { NativeCameraPreview } from '@/components/camera/NativeCameraPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/hooks/use-language';
import { Plus, Camera, ScanLine, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getEffectiveFieldsConfig } from '@/lib/product-fields-config';
import { getCategoryNamesCloud } from '@/lib/cloud/categories-cloud';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { useImageUpload } from '@/hooks/use-image-upload';

interface PurchaseInvoiceItemFormProps {
  onAdd: (item: {
    product_name: string;
    barcode?: string;
    category?: string;
    quantity: number;
    cost_price: number;
    sale_price?: number;
    product_id?: string;
    // Extended fields
    wholesale_price?: number;
    expiry_date?: string;
    serial_number?: string;
    batch_number?: string;
    warranty?: string;
    size?: string;
    color?: string;
    weight?: string;
    fabric_type?: string;
    table_number?: string;
    order_notes?: string;
    author?: string;
    publisher?: string;
    min_stock_level?: number;
    image_url?: string;
    // Dual unit fields
    track_by_unit?: string;
    bulk_unit?: string;
    small_unit?: string;
    conversion_factor?: number;
    bulk_cost_price?: number;
    bulk_sale_price?: number;
  }) => void;
  onClose: () => void;
  loading: boolean;
}

interface ExistingProduct {
  id: string;
  name: string;
  barcode?: string;
  category?: string;
  cost_price: number;
  sale_price: number;
}

export function PurchaseInvoiceItemForm({ onAdd, onClose, loading }: PurchaseInvoiceItemFormProps) {
  const { t } = useLanguage();
  const fieldsConfig = getEffectiveFieldsConfig();
  // عملة إدخال فاتورة الشراء وأسعار الصرف
  const [inputCurrency, setInputCurrency] = useState<'USD' | 'TRY' | 'SYP'>(() => {
    try {
      const raw = localStorage.getItem('hyperpos_settings_v1');
      if (!raw) return 'USD';
      const parsed = JSON.parse(raw);
      return parsed?.primaryCurrency || 'USD';
    } catch {
      return 'USD';
    }
  });

  const { rates } = useMemo(() => {
    try {
      const raw = localStorage.getItem('hyperpos_settings_v1');
      const parsed = raw ? JSON.parse(raw) : {};
      const ex = parsed?.exchangeRates;
      return {
        rates: {
          USD: 1,
          TRY: Number(ex?.TRY) || 32,
          SYP: Number(ex?.SYP) || 14500,
        },
      };
    } catch {
      return {
        rates: { USD: 1, TRY: 32, SYP: 14500 },
      };
    }
  }, []);

  const currentRate = rates[inputCurrency] || 1;
  const currencySymbols: Record<string, string> = { USD: '$', TRY: '₺', SYP: 'ل.س' };

  const [productName, setProductName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');

  // Dynamic fields
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [warranty, setWarranty] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [weight, setWeight] = useState('');
  const [fabricType, setFabricType] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('');

  // Dual unit fields
  const [trackByUnit, setTrackByUnit] = useState('piece');
  const [bulkUnit, setBulkUnit] = useState('كرتونة');
  const [smallUnit, setSmallUnit] = useState('قطعة');
  const [conversionFactor, setConversionFactor] = useState('1');
  const [bulkCostPrice, setBulkCostPrice] = useState('');
  const [bulkSalePrice, setBulkSalePrice] = useState('');

  // Image — Offline-First: show immediately, upload in background
  const { imageValue: imageUrl, imagePreview, uploadStatus: imgStatus, handleBase64Image, handleFileInput, clearImage } = useImageUpload();

  // Barcode scanner
  const [showScanner, setShowScanner] = useState(false);

  // Categories
  const [categoryNames, setCategoryNames] = useState<string[]>([]);

  // Search existing products
  const [searchResults, setSearchResults] = useState<ExistingProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ExistingProduct | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Load categories
  useEffect(() => {
    getCategoryNamesCloud().then(setCategoryNames);
  }, []);

  useEffect(() => {
    const searchProducts = async () => {
      if (productName.length < 2 && barcode.length < 3) {
        setSearchResults([]);
        return;
      }

      const query = supabase
        .from('products')
        .select('id, name, barcode, category, cost_price, sale_price')
        .limit(5);

      if (barcode.length >= 3) {
        query.ilike('barcode', `%${barcode}%`);
      } else if (productName.length >= 2) {
        query.ilike('name', `%${productName}%`);
      }

      const { data } = await query;
      setSearchResults((data || []) as ExistingProduct[]);
      setShowSearch(true);
    };

    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [productName, barcode]);

  const selectExistingProduct = (product: ExistingProduct) => {
    setSelectedProduct(product);
    setProductName(product.name);
    setBarcode(product.barcode || '');
    setCategory(product.category || '');
    const convertedCost = product.cost_price ? (product.cost_price * currentRate) : 0;
    const convertedSale = product.sale_price ? (product.sale_price * currentRate) : 0;
    setCostPrice(convertedCost > 0 ? (inputCurrency === 'SYP' ? Math.round(convertedCost).toString() : convertedCost.toFixed(2)) : '');
    setSalePrice(convertedSale > 0 ? (inputCurrency === 'SYP' ? Math.round(convertedSale).toString() : convertedSale.toFixed(2)) : '');
    setSearchResults([]);
    setShowSearch(false);
  };

  const handleBarcodeScan = (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
    setShowScanner(false);
  };

  const [showCameraPreview, setShowCameraPreview] = useState(false);
  
  const handleCameraCapture = () => {
    setShowCameraPreview(true);
  };

  const handleCameraCaptured = (base64: string) => {
    setShowCameraPreview(false);
    handleBase64Image(base64);
  };

  const handleSubmit = () => {
    if (!productName || !quantity || !costPrice) return;

    // حساب التكلفة المرجعية بالدولار لضمان دقة المتوسط المرجح للتكلفة (WAC) وحساب الأرباح السحابية
    // cost_price_usd = cost_price_local / exchange_rate
    const costPriceNum = Number.parseFloat(costPrice) || 0;
    const costPriceUSD = currentRate > 0 ? (costPriceNum / currentRate) : costPriceNum;

    const salePriceNum = salePrice ? Number.parseFloat(salePrice) : undefined;
    const salePriceUSD = salePriceNum !== undefined ? (currentRate > 0 ? (salePriceNum / currentRate) : salePriceNum) : undefined;

    const wholesalePriceNum = wholesalePrice ? Number.parseFloat(wholesalePrice) : undefined;
    const wholesalePriceUSD = wholesalePriceNum !== undefined ? (currentRate > 0 ? (wholesalePriceNum / currentRate) : wholesalePriceNum) : undefined;

    const bulkCostPriceNum = bulkCostPrice ? Number.parseFloat(bulkCostPrice) : undefined;
    const bulkCostPriceUSD = bulkCostPriceNum !== undefined ? (currentRate > 0 ? (bulkCostPriceNum / currentRate) : bulkCostPriceNum) : undefined;

    const bulkSalePriceNum = bulkSalePrice ? Number.parseFloat(bulkSalePrice) : undefined;
    const bulkSalePriceUSD = bulkSalePriceNum !== undefined ? (currentRate > 0 ? (bulkSalePriceNum / currentRate) : bulkSalePriceNum) : undefined;

    onAdd({
      product_name: productName,
      barcode: barcode || undefined,
      category: category || undefined,
      quantity: Number.parseInt(quantity),
      cost_price: Number.parseFloat(costPriceUSD.toFixed(4)),
      sale_price: salePriceUSD !== undefined ? Number.parseFloat(salePriceUSD.toFixed(4)) : undefined,
      product_id: selectedProduct?.id,
      wholesale_price: wholesalePriceUSD !== undefined ? Number.parseFloat(wholesalePriceUSD.toFixed(4)) : undefined,
      expiry_date: expiryDate || undefined,
      serial_number: serialNumber || undefined,
      batch_number: batchNumber || undefined,
      warranty: warranty || undefined,
      size: size || undefined,
      color: color || undefined,
      weight: weight || undefined,
      fabric_type: fabricType || undefined,
      table_number: tableNumber || undefined,
      order_notes: orderNotes || undefined,
      author: author || undefined,
      publisher: publisher || undefined,
      min_stock_level: minStockLevel ? Number.parseInt(minStockLevel) : undefined,
      image_url: imageUrl || undefined,
      track_by_unit: trackByUnit,
      bulk_unit: bulkUnit,
      small_unit: smallUnit,
      conversion_factor: Number.parseInt(conversionFactor) || 1,
      bulk_cost_price: bulkCostPriceUSD !== undefined ? Number.parseFloat(bulkCostPriceUSD.toFixed(4)) : undefined,
      bulk_sale_price: bulkSalePriceUSD !== undefined ? Number.parseFloat(bulkSalePriceUSD.toFixed(4)) : undefined,
    });

    // Reset form
    setProductName('');
    setBarcode('');
    setCategory('');
    setQuantity('1');
    setCostPrice('');
    setSalePrice('');
    setWholesalePrice('');
    setExpiryDate('');
    setSerialNumber('');
    setBatchNumber('');
    setWarranty('');
    setSize('');
    setColor('');
    setWeight('');
    setFabricType('');
    setTableNumber('');
    setOrderNotes('');
    setAuthor('');
    setPublisher('');
    setMinStockLevel('');
    clearImage();
    setTrackByUnit('piece');
    setBulkUnit('كرتونة');
    setSmallUnit('قطعة');
    setConversionFactor('1');
    setBulkCostPrice('');
    setBulkSalePrice('');
    setSelectedProduct(null);
  };

  return (
    <div className="p-3 sm:p-4 border rounded-lg bg-card space-y-3 max-w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">
          {selectedProduct ? t('purchaseInvoice.updateStock') : t('purchaseInvoice.addNewProduct')}
        </h3>
        {selectedProduct && (
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
            {t('purchaseInvoice.existingProduct')}
          </span>
        )}
      </div>

      {/* Product Name */}
      <div className="space-y-1.5 relative">
        <Label className="text-sm">{t('products.name')} *</Label>
        <Input
          value={productName}
          onChange={(e) => {
            setProductName(e.target.value);
            setSelectedProduct(null);
          }}
          placeholder={t('products.exampleName')}
        />
        {showSearch && searchResults.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-32 overflow-y-auto">
            {searchResults.map((product) => (
              <button
                key={product.id}
                className="w-full p-2 text-right hover:bg-muted flex items-center justify-between text-sm"
                onClick={() => selectExistingProduct(product)}
              >
                <span>{product.name}</span>
                <span className="text-xs text-muted-foreground">{product.barcode}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Barcode with Camera Button */}
      <div className="space-y-1.5">
        <Label className="text-sm">{t('products.barcode')}</Label>
        <div className="flex gap-2">
          <Input
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              setSelectedProduct(null);
            }}
            placeholder="123..."
            className="flex-1 min-w-0"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={() => setShowScanner(true)}
            title={t('pos.scanBarcode')}
          >
            <ScanLine className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Category Dropdown */}
      <div className="space-y-1.5">
        <Label className="text-sm">{t('products.category')}</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder={t('products.category')} />
          </SelectTrigger>
          <SelectContent>
            {categoryNames.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* شريط اختيار عملة الشراء */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/60">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          عملة إدخال الفاتورة:
        </span>
        <div className="flex items-center gap-1 bg-background p-0.5 rounded-md border border-border/60">
          {(['USD', 'TRY', 'SYP'] as const).map((curr) => (
            <button
              key={curr}
              type="button"
              onClick={() => setInputCurrency(curr)}
              className={cn(
                "px-2.5 py-0.5 text-xs font-bold rounded transition-all flex items-center gap-1",
                inputCurrency === curr
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{currencySymbols[curr]}</span>
              <span>{curr}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quantity + Prices */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        <div className="space-y-1 sm:space-y-1.5 min-w-0">
          <Label className="text-xs sm:text-sm truncate block">{t('products.quantity')} *</Label>
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-9 text-xs sm:text-sm px-2 font-bold"
          />
        </div>
        <div className="space-y-1 sm:space-y-1.5 min-w-0">
          <Label className="text-xs sm:text-sm truncate block">
            {t('products.costPrice')} ({currencySymbols[inputCurrency]}) *
          </Label>
          <Input
            type="number"
            step="any"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            className="h-9 text-xs sm:text-sm px-2 font-bold"
          />
          {inputCurrency !== 'USD' && costPrice && (
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 leading-tight">
              ≈ ${( (Number.parseFloat(costPrice) || 0) / currentRate ).toFixed(2)} USD
            </p>
          )}
        </div>
        <div className="space-y-1 sm:space-y-1.5 min-w-0">
          <Label className="text-xs sm:text-sm truncate block">
            {t('products.salePrice')} ({currencySymbols[inputCurrency]})
          </Label>
          <Input
            type="number"
            step="any"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            className="h-9 text-xs sm:text-sm px-2"
          />
          {inputCurrency !== 'USD' && salePrice && (
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 leading-tight">
              ≈ ${( (Number.parseFloat(salePrice) || 0) / currentRate ).toFixed(2)} USD
            </p>
          )}
        </div>
      </div>

      {/* Dual Unit Settings */}
      <div className="p-2.5 sm:p-3 bg-muted/50 rounded-lg border border-border space-y-2.5 max-w-full overflow-hidden">
        <Label className="text-xs sm:text-sm font-medium">إعدادات الوحدة</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 min-w-0">
            <Label className="text-xs text-muted-foreground truncate block">وحدة التتبع</Label>
            <Select value={trackByUnit} onValueChange={setTrackByUnit}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="piece">قطعة</SelectItem>
                <SelectItem value="bulk">كرتونة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-0">
            <Label className="text-xs text-muted-foreground truncate block">معامل التحويل</Label>
            <Input
              type="number"
              min="1"
              value={conversionFactor}
              onChange={(e) => setConversionFactor(e.target.value)}
              className="h-8 text-xs"
              placeholder="12"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 min-w-0">
            <Label className="text-xs text-muted-foreground truncate block">اسم الوحدة الكبيرة</Label>
            <Input
              value={bulkUnit}
              onChange={(e) => setBulkUnit(e.target.value)}
              className="h-8 text-xs"
              placeholder="كرتونة"
            />
          </div>
          <div className="space-y-1 min-w-0">
            <Label className="text-xs text-muted-foreground truncate block">اسم الوحدة الصغيرة</Label>
            <Input
              value={smallUnit}
              onChange={(e) => setSmallUnit(e.target.value)}
              className="h-8 text-xs"
              placeholder="قطعة"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 min-w-0">
            <Label className="text-xs text-muted-foreground truncate block">سعر تكلفة الكرتونة</Label>
            <Input
              type="number"
              step="0.01"
              value={bulkCostPrice}
              onChange={(e) => setBulkCostPrice(e.target.value)}
              className="h-8 text-xs"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1 min-w-0">
            <Label className="text-xs text-muted-foreground truncate block">سعر بيع الكرتونة</Label>
            <Input
              type="number"
              step="0.01"
              value={bulkSalePrice}
              onChange={(e) => setBulkSalePrice(e.target.value)}
              className="h-8 text-xs"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Dynamic Fields Based on Settings */}
      {fieldsConfig.wholesalePrice && (
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.wholesalePrice')}</Label>
          <Input
            type="number"
            step="0.01"
            value={wholesalePrice}
            onChange={(e) => setWholesalePrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
      )}

      {fieldsConfig.expiryDate && (
        <div className="space-y-1.5">
          <Label className="text-sm">تاريخ الصلاحية</Label>
          <Input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>
      )}

      {fieldsConfig.batchNumber && (
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.batchNumber')}</Label>
          <Input
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
            placeholder={t('products.batchNumber')}
          />
        </div>
      )}

      {fieldsConfig.serialNumber && (
        <div className="space-y-1.5">
          <Label className="text-sm">الرقم التسلسلي</Label>
          <Input
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="IMEI / ISBN"
          />
        </div>
      )}

      {fieldsConfig.warranty && (
        <div className="space-y-1.5">
          <Label className="text-sm">الضمان</Label>
          <Input
            value={warranty}
            onChange={(e) => setWarranty(e.target.value)}
            placeholder="مثال: 12 شهر"
          />
        </div>
      )}

      {fieldsConfig.sizeColor && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">المقاس</Label>
            <Input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="S / M / L / XL"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">اللون</Label>
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="أحمر، أزرق..."
            />
          </div>
        </div>
      )}

      {fieldsConfig.weight && (
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.weight')}</Label>
          <Input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={t('products.weight')}
          />
        </div>
      )}

      {fieldsConfig.fabricType && (
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.fabricType')}</Label>
          <Input
            value={fabricType}
            onChange={(e) => setFabricType(e.target.value)}
            placeholder={t('products.fabricType')}
          />
        </div>
      )}

      {fieldsConfig.tableNumber && (
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.tableNumber')}</Label>
          <Input
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder={t('products.tableNumber')}
          />
        </div>
      )}

      {fieldsConfig.orderNotes && (
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.orderNotes')}</Label>
          <Input
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder={t('products.orderNotes')}
          />
        </div>
      )}

      {fieldsConfig.author && (
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.author')}</Label>
          <Input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder={t('products.author')}
          />
        </div>
      )}

      {fieldsConfig.publisher && (
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.publisher')}</Label>
          <Input
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            placeholder={t('products.publisher')}
          />
        </div>
      )}

      {fieldsConfig.minStockLevel && (
        <div className="space-y-1.5">
          <Label className="text-sm">الحد الأدنى للمخزون</Label>
          <Input
            type="number"
            min="0"
            value={minStockLevel}
            onChange={(e) => setMinStockLevel(e.target.value)}
            placeholder="5"
          />
        </div>
      )}

      {/* Product Image */}
      <div className="space-y-1.5">
        <Label className="text-sm">صورة المنتج</Label>
        <div className="flex gap-2">
          {imagePreview && (
            <div className="relative">
              <img src={imagePreview} alt="Product" className="w-12 h-12 rounded-lg object-cover border" />
              {imgStatus === 'syncing' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                </div>
              )}
            </div>
          )}
          <label className="flex-1">
            <div className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
              <ImageIcon className="w-4 h-4" />
              <span>{imgStatus === 'syncing' ? 'جاري المزامنة...' : 'اختر صورة'}</span>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
          </label>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={handleCameraCapture}
            title="التقاط صورة"
          >
            <Camera className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="flex-1">
          {t('purchaseInvoice.finishAdding')}
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={loading || !productName || !quantity || !costPrice} className="flex-1">
          <Plus className="w-4 h-4 ml-1" />
          {loading ? t('common.loading') : t('purchaseInvoice.addAndContinue')}
        </Button>
      </div>

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
      />
      <NativeCameraPreview
        isOpen={showCameraPreview}
        onClose={() => setShowCameraPreview(false)}
        onCapture={handleCameraCaptured}
        maxSize={400}
        quality={40}
      />
    </div>
  );
}
