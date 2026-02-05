import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useIsMobile } from '@/hooks/use-mobile';

interface ProductDetailsDialogProps {
    product: any;
    open: boolean;
    onClose: () => void;
    onAddToCart?: () => void;
}

export function ProductDetailsDialog({
    product,
    open,
    onClose,
    onAddToCart
}: ProductDetailsDialogProps) {
    const isMobile = useIsMobile();

    if (!product) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className={`
        ${isMobile ? 'w-[95vw] max-w-none p-0' : 'max-w-lg'}
        max-h-[85vh] overflow-hidden flex flex-col
      `}>
                <DialogHeader className="p-4 pb-2">
                    <DialogTitle className="text-lg">تفاصيل المنتج</DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 px-4 pb-4">
                    {/* صورة المنتج */}
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4">
                        {product.image ? (
                            <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                لا توجد صورة
                            </div>
                        )}
                    </div>

                    {/* معلومات المنتج */}
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm text-muted-foreground">الاسم</label>
                            <p className="font-semibold text-lg">{product.name}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-muted-foreground">السعر</label>
                                <p className="font-bold text-primary text-xl">
                                    {product.price?.toFixed(2)} $
                                </p>
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground">الكمية المتاحة</label>
                                <p className={`font-bold text-xl ${product.quantity === 0 ? 'text-red-500' :
                                        product.quantity <= 5 ? 'text-orange-500' :
                                            'text-green-600'
                                    }`}>
                                    {product.quantity}
                                </p>
                            </div>
                        </div>

                        {product.category && (
                            <div>
                                <label className="text-sm text-muted-foreground">الفئة</label>
                                <p>{product.category}</p>
                            </div>
                        )}

                        {product.barcode && (
                            <div>
                                <label className="text-sm text-muted-foreground">الباركود</label>
                                <p className="font-mono">{product.barcode}</p>
                            </div>
                        )}

                        {product.description && (
                            <div>
                                <label className="text-sm text-muted-foreground">الوصف</label>
                                <p className="text-sm">{product.description}</p>
                            </div>
                        )}

                        {/* الوحدات */}
                        {(product.bulkUnit || product.smallUnit) && (
                            <div className="bg-muted p-3 rounded-lg space-y-2">
                                <label className="text-sm font-medium">الوحدات</label>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {product.smallUnit && (
                                        <div>
                                            <span className="text-muted-foreground">الوحدة الصغرى:</span>
                                            <span className="mr-2">{product.smallUnit}</span>
                                        </div>
                                    )}
                                    {product.bulkUnit && (
                                        <div>
                                            <span className="text-muted-foreground">الوحدة الكبرى:</span>
                                            <span className="mr-2">{product.bulkUnit}</span>
                                        </div>
                                    )}
                                    {product.conversionFactor && (
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground">معامل التحويل:</span>
                                            <span className="mr-2">{product.conversionFactor}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* أزرار الإجراءات */}
                <div className="p-4 border-t flex gap-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        إغلاق
                    </Button>
                    {onAddToCart && (
                        <Button
                            onClick={onAddToCart}
                            className="flex-1"
                            disabled={product.quantity === 0}
                        >
                            إضافة للسلة
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
