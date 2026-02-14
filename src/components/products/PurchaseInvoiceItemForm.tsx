import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/hooks/use-language';
import { Plus, Camera, ScanLine, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getEffectiveFieldsConfig } from '@/lib/product-fields-config';
import { getCategoryNamesCloud } from '@/lib/cloud/categories-cloud';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { uploadProductImage } from '@/lib/image-upload';

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
  const [minStockLevel, setMinStockLevel] = useState('');

  // Dual unit fields
  const [trackByUnit, setTrackByUnit] = useState('piece');
  const [bulkUnit, setBulkUnit] = useState('كرتونة');
  const [smallUnit, setSmallUnit] = useState('قطعة');
  const [conversionFactor, setConversionFactor] = useState('1');
  const [bulkCostPrice, setBulkCostPrice] = useState('');
  const [bulkSalePrice, setBulkSalePrice] = useState('');

  // Image
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

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
    setCostPrice(product.cost_price?.toString() || '');
    setSalePrice(product.sale_price?.toString() || '');
    setSearchResults([]);
    setShowSearch(false);
  };

  const handleBarcodeScan = (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
    setShowScanner(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const url = await uploadProductImage(base64);
        if (url) setImageUrl(url);
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingImage(false);
    }
  };

  const handleCameraCapture = async () => {
    try {
      const { Camera: CapCamera } = await import('@capacitor/camera');
      const photo = await (CapCamera as any).getPhoto({
        quality: 70,
        resultType: 'base64' as any,
        source: 'CAMERA' as any,
      });
      if (photo?.base64String) {
        setUploadingImage(true);
        const base64 = `data:image/jpeg;base64,${photo.base64String}`;
        const url = await uploadProductImage(base64);
        if (url) setImageUrl(url);
        setUploadingImage(false);
      }
    } catch {
      // Camera not available or cancelled
    }
  };

  const handleSubmit = () => {
    if (!productName || !quantity || !costPrice) return;

    onAdd({
      product_name: productName,
      barcode: barcode || undefined,
      category: category || undefined,
      quantity: parseInt(quantity),
      cost_price: parseFloat(costPrice),
      sale_price: salePrice ? parseFloat(salePrice) : undefined,
      product_id: selectedProduct?.id,
      wholesale_price: wholesalePrice ? parseFloat(wholesalePrice) : undefined,
      expiry_date: expiryDate || undefined,
      serial_number: serialNumber || undefined,
      batch_number: batchNumber || undefined,
      warranty: warranty || undefined,
      size: size || undefined,
      color: color || undefined,
      min_stock_level: minStockLevel ? parseInt(minStockLevel) : undefined,
      image_url: imageUrl || undefined,
      track_by_unit: trackByUnit,
      bulk_unit: bulkUnit,
      small_unit: smallUnit,
      conversion_factor: parseInt(conversionFactor) || 1,
      bulk_cost_price: bulkCostPrice ? parseFloat(bulkCostPrice) : undefined,
      bulk_sale_price: bulkSalePrice ? parseFloat(bulkSalePrice) : undefined,
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
    setMinStockLevel('');
    setImageUrl('');
    setTrackByUnit('piece');
    setBulkUnit('كرتونة');
    setSmallUnit('قطعة');
    setConversionFactor('1');
    setBulkCostPrice('');
    setBulkSalePrice('');
    setSelectedProduct(null);
  };

  return (
    <div className="p-4 border rounded-lg bg-card space-y-3">
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
            className="flex-1"
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

      {/* Quantity + Prices */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.quantity')} *</Label>
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.costPrice')} *</Label>
          <Input
            type="number"
            step="0.01"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.salePrice')}</Label>
          <Input
            type="number"
            step="0.01"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
          />
        </div>
      </div>

      {/* Dual Unit Settings */}
      <div className="p-3 bg-muted/50 rounded-lg border border-border space-y-2.5">
        <Label className="text-sm font-medium">إعدادات الوحدة</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">وحدة التتبع</Label>
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
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">معامل التحويل</Label>
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
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">اسم الوحدة الكبيرة</Label>
            <Input
              value={bulkUnit}
              onChange={(e) => setBulkUnit(e.target.value)}
              className="h-8 text-xs"
              placeholder="كرتونة"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">اسم الوحدة الصغيرة</Label>
            <Input
              value={smallUnit}
              onChange={(e) => setSmallUnit(e.target.value)}
              className="h-8 text-xs"
              placeholder="قطعة"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">سعر تكلفة الكرتونة</Label>
            <Input
              type="number"
              step="0.01"
              value={bulkCostPrice}
              onChange={(e) => setBulkCostPrice(e.target.value)}
              className="h-8 text-xs"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">سعر بيع الكرتونة</Label>
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
          {imageUrl && (
            <img src={imageUrl} alt="Product" className="w-12 h-12 rounded-lg object-cover border" />
          )}
          <label className="flex-1">
            <div className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
              <ImageIcon className="w-4 h-4" />
              <span>{uploadingImage ? 'جاري الرفع...' : 'اختر صورة'}</span>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
          </label>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={handleCameraCapture}
            disabled={uploadingImage}
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
    </div>
  );
}
