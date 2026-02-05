import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Barcode, DollarSign, Box, Layers } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { DualUnitDisplayCompact } from '@/components/products/DualUnitDisplay';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  image?: string;
  barcode?: string;
  conversionFactor?: number;
  bulkUnit?: string;
  smallUnit?: string;
  bulkSalePrice?: number;
  costPrice?: number;
  bulkCostPrice?: number;
}

interface ProductDetailsDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductDetailsDialog({ product, isOpen, onClose }: ProductDetailsDialogProps) {
  const { t } = useLanguage();

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Image */}
          {product.image ? (
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full aspect-video rounded-lg bg-muted flex items-center justify-center">
              <Package className="w-16 h-16 text-muted-foreground/50" />
            </div>
          )}

          {/* Product Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div className="glass-card p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">{t('products.category')}</span>
              </div>
              <p className="font-semibold text-sm">{product.category}</p>
            </div>

            {/* Sale Price */}
            <div className="glass-card p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">{t('products.salePrice')}</span>
              </div>
              <p className="font-bold text-sm text-green-600">${product.price}</p>
            </div>

            {/* Bulk Price (if available) */}
            {product.bulkSalePrice && product.bulkSalePrice > 0 && (
              <div className="glass-card p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Box className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">
                    {t('products.bulkPrice')} ({product.bulkUnit || 'كرتونة'})
                  </span>
                </div>
                <p className="font-bold text-sm text-blue-600">${product.bulkSalePrice}</p>
              </div>
            )}

            {/* Barcode */}
            {product.barcode && (
              <div className="glass-card p-3 rounded-lg col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <Barcode className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">{t('products.barcode')}</span>
                </div>
                <p className="font-mono text-sm font-semibold">{product.barcode}</p>
              </div>
            )}
          </div>

          {/* Stock Information */}
          <div className="glass-card p-4 rounded-lg">
            <h4 className="font-semibold mb-2 text-sm">{t('products.stock')}</h4>
            <DualUnitDisplayCompact
              totalPieces={product.quantity}
              conversionFactor={product.conversionFactor || 1}
              bulkUnit={product.bulkUnit}
              smallUnit={product.smallUnit}
            />
          </div>

          {/* Cost Prices (if available) */}
          {(product.costPrice || product.bulkCostPrice) && (
            <div className="glass-card p-4 rounded-lg">
              <h4 className="font-semibold mb-2 text-sm">{t('products.costPrice')}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {product.costPrice && (
                  <div>
                    <span className="text-muted-foreground">{product.smallUnit || 'قطعة'}: </span>
                    <span className="font-semibold">${product.costPrice}</span>
                  </div>
                )}
                {product.bulkCostPrice && product.bulkCostPrice > 0 && (
                  <div>
                    <span className="text-muted-foreground">{product.bulkUnit || 'كرتونة'}: </span>
                    <span className="font-semibold">${product.bulkCostPrice}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profit Margin (if cost price available) */}
          {product.costPrice && product.costPrice > 0 && (
            <div className="glass-card p-4 rounded-lg bg-primary/5">
              <h4 className="font-semibold mb-2 text-sm">{t('products.profitMargin')}</h4>
              <div className="text-sm">
                <span className="text-muted-foreground">هامش الربح: </span>
                <span className="font-bold text-primary">
                  {((((product.price - product.costPrice) / product.costPrice) * 100).toFixed(2))}%
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
