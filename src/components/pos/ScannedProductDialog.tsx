import { Package, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { POSProduct } from '@/lib/products-store';

interface ScannedProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: POSProduct | null;
  onAddToCart: (product: POSProduct) => void;
}

export function ScannedProductDialog({
  isOpen,
  onClose,
  product,
  onAddToCart,
}: ScannedProductDialogProps) {
  if (!product) return null;

  const handleAdd = () => {
    onAddToCart(product);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            تم العثور على المنتج
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-foreground mb-1">{product.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">{product.category}</p>
              <p className="text-2xl font-bold text-primary">${product.price}</p>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المخزون المتاح:</span>
              <span className="font-semibold">{product.quantity} قطعة</span>
            </div>
            {product.barcode && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">الباركود:</span>
                <span className="font-mono">{product.barcode}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              <X className="w-4 h-4 ml-2" />
              إغلاق
            </Button>
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90" 
              onClick={handleAdd}
              disabled={product.quantity === 0}
            >
              <Plus className="w-4 h-4 ml-2" />
              إضافة للسلة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
