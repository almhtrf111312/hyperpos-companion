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
      <DialogContent
        dir="rtl"
        className="mx-3 max-w-[380px] overflow-hidden rounded-[30px] border-0 bg-[#f8fafc] p-0 shadow-[0_20px_60px_rgba(15,23,42,0.25)] dark:bg-[#0f172a] [&>button[aria-label='Close']]:hidden"
      >
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition hover:bg-white"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>

          {productImage ? (
            <div className="h-40 w-full overflow-hidden bg-slate-100">
              <img src={productImage} alt={product.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-40 w-full items-center justify-center bg-slate-100">
              <Package className="h-12 w-12 text-slate-400" />
            </div>
          )}

          <div className="space-y-4 p-4 pb-5">
            <div className="pt-1">
              <p className="text-[11px] font-medium tracking-[0.18em] text-slate-400 uppercase">{t('products.product')}</p>
              <DialogHeader className="mt-2 text-right">
                <DialogTitle className="text-[22px] font-black leading-tight text-slate-900 dark:text-white">{product.name}</DialogTitle>
              </DialogHeader>
            </div>

            <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-emerald-100 p-3 shadow-inner shadow-emerald-200/50 ring-1 ring-emerald-200/70">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-emerald-700">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-[11px] font-bold">{t('products.salePrice')}</span>
                </div>
                <span className="text-[28px] font-black leading-none text-emerald-700">${product.price}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-2 text-slate-500">
                  <Tag className="h-4 w-4" />
                  <span className="text-[11px] font-medium">{t('products.category')}</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{product.category || '—'}</span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-2 text-slate-500">
                  <Box className="h-4 w-4" />
                  <span className="text-[11px] font-medium">{t('products.stock')}</span>
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
                    <span className="text-sm font-bold text-slate-500">{t('products.outOfStock')}</span>
                  )}
                </div>
              </div>

              {product.barcode && (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Barcode className="h-4 w-4" />
                    <span className="text-[11px] font-medium">{t('products.barcode')}</span>
                  </div>
                  <span className="font-mono text-[12px] font-bold text-slate-800">{product.barcode}</span>
                </div>
              )}

              {product.description && (
                <div className="rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    <ClipboardList className="h-4 w-4" />
                    <span className="text-[11px] font-medium">{t('products.description')}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{product.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
