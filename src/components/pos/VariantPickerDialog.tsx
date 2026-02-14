import { Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from '@/hooks/use-language';

interface VariantProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  image?: string;
  barcode?: string;
  variantLabel?: string;
  bulkUnit?: string;
  smallUnit?: string;
  conversionFactor?: number;
  bulkSalePrice?: number;
  costPrice?: number;
  bulkCostPrice?: number;
  wholesalePrice?: number;
}

interface VariantPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  products: VariantProduct[];
  onSelect: (product: VariantProduct) => void;
}

export function VariantPickerDialog({
  isOpen,
  onClose,
  products,
  onSelect,
}: VariantPickerDialogProps) {
  const { t } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            اختر المنتج المطلوب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto py-2">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => {
                onSelect(product);
                onClose();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-right"
            >
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Package className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{product.name}</p>
                {product.variantLabel && (
                  <p className="text-sm text-primary font-medium">({product.variantLabel})</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="font-bold text-foreground text-sm">${product.price}</span>
                  <span>متوفر: {product.quantity}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
