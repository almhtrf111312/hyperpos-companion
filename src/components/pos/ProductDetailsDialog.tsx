import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Barcode, DollarSign, Box, Layers, X } from 'lucide-react';
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
      <DialogContent className="max-w-xs mx-4 max-h-[60vh] overflow-y-auto rounded-2xl p-3 [&>button[aria-label='Close']]:hidden">
        {/* Close Button - Top Right */}
        <div className="absolute left-2 top-2 z-10">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <DialogHeader className="pt-1">
          <DialogTitle className="text-base font-bold text-center px-6 leading-tight">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Product Image - Smaller */}
          {product.image ? (
            <div className="w-full h-28 rounded-lg overflow-hidden bg-muted">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full h-20 rounded-lg bg-muted flex items-center justify-center">
              <Package className="w-10 h-10 text-muted-foreground/50" />
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
                    سعر الجملة ({product.bulkUnit || 'كرتونة'})
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
              <h4 className="font-semibold mb-2 text-sm">هامش الربح</h4>
              <div className="text-sm">
                <span className="text-muted-foreground">هامش الربح: </span>
                <span className="font-bold text-primary">
                  {((((product.price - product.costPrice) / product.costPrice) * 100).toFixed(2))}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Explicit Close Button */}
        <div className="mt-4 flex justify-center sticky bottom-0 bg-background/95 backdrop-blur py-2 border-t -mx-3 px-3">
          <button
            onClick={onClose}
            className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium py-2 rounded-lg transition-colors"
          >
            {t('common.close') || 'إغلاق'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
