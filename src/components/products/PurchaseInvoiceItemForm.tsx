import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/use-language';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getEffectiveFieldsConfig } from '@/lib/product-fields-config';

interface PurchaseInvoiceItemFormProps {
  onAdd: (item: {
    product_name: string;
    barcode?: string;
    category?: string;
    quantity: number;
    cost_price: number;
    sale_price?: number;
    product_id?: string;
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
  const [warranty, setWarranty] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('');

  // Search existing products
  const [searchResults, setSearchResults] = useState<ExistingProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ExistingProduct | null>(null);
  const [showSearch, setShowSearch] = useState(false);

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

  const handleSubmit = () => {
    if (!productName || !quantity || !costPrice) return;

    onAdd({
      product_name: productName,
      barcode: barcode || undefined,
      category: category || undefined,
      quantity: parseInt(quantity),
      cost_price: parseFloat(costPrice),
      sale_price: salePrice ? parseFloat(salePrice) : undefined,
      product_id: selectedProduct?.id
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
    setWarranty('');
    setSize('');
    setColor('');
    setMinStockLevel('');
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

      {/* Barcode + Category */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.barcode')}</Label>
          <Input
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              setSelectedProduct(null);
            }}
            placeholder="123..."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">{t('products.category')}</Label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t('products.category')}
          />
        </div>
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

      {/* Dynamic Fields Based on Settings */}
      {fieldsConfig.wholesalePrice && (
        <div className="space-y-1.5">
          <Label className="text-sm">سعر الجملة</Label>
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
    </div>
  );
}
