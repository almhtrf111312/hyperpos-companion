import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Barcode, DollarSign, Box, X, Tag, ClipboardList } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { DualUnitDisplayCompact } from '@/components/products/DualUnitDisplay';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  image?: string;
  imageUrl?: string; // alternative field name used elsewhere
  description?: string;
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

  const productImage = product.image || (product as any).imageUrl;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[360px] mx-4 max-h-[82vh] overflow-y-auto rounded-[28px] border-0 bg-background p-0 shadow-2xl [&>button[aria-label='Close']]:hidden">
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>

          {productImage ? (
            <div className="h-32 w-full overflow-hidden rounded-t-[28px] bg-muted">
              <img src={productImage} alt={product.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded-t-[28px] bg-muted">
              <Package className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}

          <div className="space-y-4 p-4 pb-5">
            <div>
              <DialogHeader className="space-y-2 text-right">
                <DialogTitle className="text-xl font-bold leading-tight text-foreground">{product.name}</DialogTitle>
              </DialogHeader>
            </div>

            <div className="rounded-2xl bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-xs">{t('products.salePrice')}</span>
                </div>
                <span className="text-xl font-black text-green-600">${product.price}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  <span className="text-xs">{t('products.category')}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{product.category || '—'}</span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Box className="h-4 w-4" />
                  <span className="text-xs">{t('products.stock')}</span>
                </div>
                <div className="text-right">
                  {product.quantity > 0 ? (
                    <DualUnitDisplayCompact
                      totalPieces={product.quantity}
                      conversionFactor={product.conversionFactor || 1}
                      bulkUnit={product.bulkUnit}
                      smallUnit={product.smallUnit}
                    />
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">{t('products.outOfStock')}</span>
                  )}
                </div>
              </div>

              {product.barcode && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Barcode className="h-4 w-4" />
                    <span className="text-xs">{t('products.barcode')}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-foreground">{product.barcode}</span>
                </div>
              )}

              {product.description && (
                <div className="rounded-xl border border-border/70 bg-card px-3 py-2.5">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <ClipboardList className="h-4 w-4" />
                    <span className="text-xs">{t('products.description')}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{product.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
