import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/use-language';
import { Package, Barcode, Tag, Hash, DollarSign, Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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

  const [productName, setProductName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');

  // Search existing products
  const [searchResults, setSearchResults] = useState<ExistingProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ExistingProduct | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Search for existing products by name or barcode
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
    if (!productName || !quantity || !costPrice) {
      return;
    }

    onAdd({
      product_name: productName,
      barcode: barcode || undefined,
      category: category || undefined,
      quantity: parseInt(quantity),
      cost_price: parseFloat(costPrice),
      sale_price: salePrice ? parseFloat(salePrice) : undefined,
      product_id: selectedProduct?.id
    });

    // Reset form for next item
    setProductName('');
    setBarcode('');
    setCategory('');
    setQuantity('1');
    setCostPrice('');
    setSalePrice('');
    setSelectedProduct(null);
  };

  return (
    <div className="p-3 border rounded-lg bg-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Package className="w-4 h-4" />
          {selectedProduct ? t('purchaseInvoice.updateStock') : t('purchaseInvoice.addNewProduct')}
        </h3>
        {selectedProduct && (
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
            {t('purchaseInvoice.existingProduct')}
          </span>
        )}
      </div>

      {/* Product Name */}
      <div className="space-y-1 relative">
        <Label className="flex items-center gap-1 text-xs">
          <Package className="w-3 h-3" />
          {t('products.name')} *
        </Label>
        <Input
          className="h-9"
          value={productName}
          onChange={(e) => {
            setProductName(e.target.value);
            setSelectedProduct(null);
          }}
          placeholder={t('products.exampleName')}
        />
        {/* Search dropdown */}
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

      {/* Barcode + Category Row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-xs">
            <Barcode className="w-3 h-3" />
            {t('products.barcode')}
          </Label>
          <Input
            className="h-9"
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              setSelectedProduct(null);
            }}
            placeholder="123..."
          />
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-xs">
            <Tag className="w-3 h-3" />
            {t('products.category')}
          </Label>
          <Input
            className="h-9"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t('products.category')}
          />
        </div>
      </div>

      {/* Quantity + Prices Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-xs">
            <Hash className="w-3 h-3" />
            # *
          </Label>
          <Input
            className="h-9 text-center"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-xs">
            <DollarSign className="w-3 h-3" />
            $ شراء *
          </Label>
          <Input
            className="h-9 text-center"
            type="number"
            step="0.01"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-xs">
            <DollarSign className="w-3 h-3" />
            $ بيع
          </Label>
          <Input
            className="h-9 text-center"
            type="number"
            step="0.01"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="flex-1 h-9 text-xs">
          {t('purchaseInvoice.finishAdding')}
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={loading || !productName || !quantity || !costPrice} className="flex-1 h-9 text-xs">
          <Plus className="w-3 h-3 ml-1" />
          {loading ? t('common.loading') : t('purchaseInvoice.addAndContinue')}
        </Button>
      </div>
    </div>
  );
}