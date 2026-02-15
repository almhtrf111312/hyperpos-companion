import { Package, Plus, X, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from '@/hooks/use-language';
import { getCurrentStoreType } from '@/lib/store-type-config';

// POS Product type matching the one used in POS.tsx (not from localStorage)
interface POSProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  image?: string;
  barcode?: string;
  bulkUnit?: string;
  smallUnit?: string;
  conversionFactor?: number;
  bulkSalePrice?: number;
  costPrice?: number;
  bulkCostPrice?: number;
}

interface ScannedProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: POSProduct | null;
  onAddToCart: (product: POSProduct) => void;
  onLoan?: (product: POSProduct) => void;
}

export function ScannedProductDialog({
  isOpen,
  onClose,
  product,
  onAddToCart,
  onLoan,
}: ScannedProductDialogProps) {
  const { t } = useLanguage();
  const isBookstore = getCurrentStoreType() === 'bookstore';
  
  if (!product) return null;

  const handleAdd = () => {
    onAddToCart(product);
    onClose();
  };

  const handleLoan = () => {
    if (onLoan) {
      onLoan(product);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {t('scannedProduct.productFound')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              {product.image ? (
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <Package className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-foreground mb-1">{product.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">{product.category}</p>
              <p className="text-2xl font-bold text-primary">${product.price}</p>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('scannedProduct.availableStock')}:</span>
              <span className="font-semibold text-foreground">{product.quantity} {t('scannedProduct.piece')}</span>
            </div>
            {product.barcode && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">{t('scannedProduct.barcode')}:</span>
                <span className="font-mono text-foreground">{product.barcode}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              <X className="w-4 h-4 ml-2" />
              {t('scannedProduct.close')}
            </Button>
            {isBookstore && onLoan && (
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleLoan}
                disabled={product.quantity === 0}
              >
                <BookOpen className="w-4 h-4 ml-2" />
                إعارة
              </Button>
            )}
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90" 
              onClick={handleAdd}
              disabled={product.quantity === 0}
            >
              <Plus className="w-4 h-4 ml-2" />
              {t('scannedProduct.addToCart')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
