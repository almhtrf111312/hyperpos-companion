import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Package, Barcode, DollarSign, Box, X, Tag } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  image?: string;
  imageUrl?: string;
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
  const stockText = product.quantity > 0 ? `${product.quantity} ${product.smallUnit || product.bulkUnit || 'قطعة'}` : t('products.outOfStock');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        dir="rtl"
        className="mx-3 max-w-[380px] overflow-hidden rounded-[26px] border-0 bg-[#f3f3f3] p-0 shadow-[0_25px_80px_rgba(15,23,42,0.25)] dark:bg-[#0f172a] [&>button[aria-label='Close']]:hidden"
      >
        <div className="relative bg-[#f3f3f3]">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.16)] ring-1 ring-slate-200 transition hover:bg-slate-50"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>

          {productImage ? (
            <div className="h-[200px] w-full overflow-hidden bg-slate-100">
              <img src={productImage} alt={product.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-[200px] w-full items-center justify-center bg-slate-100">
              <Package className="h-14 w-14 text-slate-400" />
            </div>
          )}

          <div className="space-y-4 px-4 pb-4 pt-3">
            <div className="text-right">
              <p className="text-[9px] font-medium tracking-[0.24em] text-slate-400 uppercase">{t('products.product')}</p>
              <h2 className="mt-2 text-[22px] font-black leading-[1.2] text-slate-900 dark:text-white">
                {product.name}
              </h2>
            </div>

            <div className="flex items-center justify-between rounded-[18px] border border-emerald-200 bg-[#dfeee9] px-3 py-3 shadow-inner shadow-emerald-200/50">
              <span className="text-[32px] font-black leading-none text-slate-900">${product.price}</span>
              <div className="flex items-center gap-2 text-slate-800">
                <span className="text-[15px] font-medium">{t('products.salePrice')}</span>
                <DollarSign className="h-4 w-4" />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                <div className="text-left text-[15px] font-bold text-slate-800">{product.category || '—'}</div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="text-[15px] font-medium">{t('products.category')}</span>
                  <Tag className="h-4 w-4" />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                <div className="text-left text-[15px] font-bold text-slate-800">{stockText}</div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="text-[15px] font-medium">{t('products.stock')}</span>
                  <Box className="h-4 w-4" />
                </div>
              </div>

              {product.barcode && (
                <div className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                  <div className="text-left font-mono text-[15px] font-bold text-slate-800">{product.barcode}</div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="text-[15px] font-medium">{t('products.barcode')}</span>
                    <Barcode className="h-4 w-4" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
