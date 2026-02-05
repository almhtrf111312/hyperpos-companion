import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, Barcode, Layers, Calculator } from 'lucide-react';
import { DualUnitDisplay } from '@/components/products/DualUnitDisplay';
import { useLanguage } from '@/hooks/use-language';
import { cn, formatCurrency } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

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
    onAddToCart: (product: Product) => void;
}

export function ProductDetailsDialog({
    product,
    isOpen,
    onClose,
    onAddToCart
}: ProductDetailsDialogProps) {
    const { t } = useLanguage();

    if (!product) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        <span className="truncate">{product.name}</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-2">
                    <div className="space-y-6">
                        {/* Main Info */}
                        <div className="flex gap-4">
                            <div className="w-24 h-24 rounded-lg bg-muted/50 flex-shrink-0 overflow-hidden flex items-center justify-center border border-border">
                                {product.image ? (
                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Package className="w-10 h-10 text-muted-foreground/30" />
                                )}
                            </div>

                            <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">{t('products.price')}</span>
                                    <span className="text-xl font-bold text-primary">{formatCurrency(product.price)}</span>
                                </div>

                                {product.bulkSalePrice && product.bulkSalePrice > 0 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">{t('products.bulkPrice')} ({product.bulkUnit})</span>
                                        <span className="text-lg font-semibold text-green-500">{formatCurrency(product.bulkSalePrice)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Barcode className="w-3 h-3" />
                                    {t('products.barcode')}
                                </label>
                                <p className="font-mono text-sm">{product.barcode || '-'}</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Layers className="w-3 h-3" />
                                    {t('products.category')}
                                </label>
                                <p className="text-sm">{product.category}</p>
                            </div>
                        </div>

                        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                            <label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                                <Calculator className="w-3 h-3" />
                                {t('products.stock')}
                            </label>
                            <DualUnitDisplay
                                totalPieces={product.quantity}
                                conversionFactor={product.conversionFactor || 1}
                                bulkUnit={product.bulkUnit}
                                smallUnit={product.smallUnit}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 p-6 pt-2 bg-background border-t">
                    <Button variant="outline" onClick={onClose}>
                        {t('common.close')}
                    </Button>
                    <Button onClick={() => {
                        onAddToCart(product);
                        onClose();
                    }}>
                        {t('pos.addToCart')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
