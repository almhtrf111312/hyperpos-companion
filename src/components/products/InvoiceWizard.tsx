import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import {
    FileText,
    User,
    Calendar,
    Hash,
    DollarSign,
    ArrowRight,
    ArrowLeft,
    Plus,
    Package,
    Save,
    CheckCircle,
    Building,
    AlertTriangle
} from 'lucide-react';
import {
    addPurchaseInvoiceCloud,
    addPurchaseInvoiceItemCloud,
    finalizePurchaseInvoiceCloud,
    loadPurchaseInvoiceWithItems,
    deletePurchaseInvoiceItemCloud,
    PurchaseInvoice,
    PurchaseInvoiceItem
} from '@/lib/cloud/purchase-invoices-cloud';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// تعريف الخطوات
type WizardStep = 'header' | 'add-product' | 'review';

interface InvoiceWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function InvoiceWizard({ open, onOpenChange, onSuccess }: InvoiceWizardProps) {
    const { t } = useLanguage();
    const [step, setStep] = useState<WizardStep>('header');
    const [loading, setLoading] = useState(false);
    const [currentInvoice, setCurrentInvoice] = useState<PurchaseInvoice | null>(null);
    const [invoiceItems, setInvoiceItems] = useState<PurchaseInvoiceItem[]>([]);

    // 1. بيانات الفاتورة الرئيسية
    const [headerData, setHeaderData] = useState({
        invoiceNumber: '',
        supplierName: '',
        supplierCompany: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        expectedItemsCount: '',
        expectedTotalQuantity: '',
        expectedGrandTotal: '',
        notes: ''
    });

    // 2. بيانات المنتج الحالي
    const [currentItem, setCurrentItem] = useState({
        name: '',
        barcode: '',
        quantity: '',
        costPrice: '',
        salePrice: '' // اختياري
    });

    // إعادة تعيين عند الفتح
    useEffect(() => {
        if (open) {
            setStep('header');
            setHeaderData({
                invoiceNumber: '',
                supplierName: '',
                supplierCompany: '',
                invoiceDate: new Date().toISOString().split('T')[0],
                expectedItemsCount: '',
                expectedTotalQuantity: '',
                expectedGrandTotal: '',
                notes: ''
            });
            setCurrentItem({
                name: '',
                barcode: '',
                quantity: '',
                costPrice: '',
                salePrice: ''
            });
            setCurrentInvoice(null);
            setInvoiceItems([]);
        }
    }, [open]);

    // إنشاء الفاتورة (الانتقال للخطوة 2)
    const handleCreateInvoice = async () => {
        if (!headerData.invoiceNumber || !headerData.supplierName || !headerData.expectedGrandTotal) {
            toast.error(t('products.fillRequired'));
            return;
        }

        setLoading(true);
        try {
            const invoice = await addPurchaseInvoiceCloud({
                invoice_number: headerData.invoiceNumber,
                supplier_name: headerData.supplierName,
                supplier_company: headerData.supplierCompany,
                invoice_date: headerData.invoiceDate,
                expected_items_count: parseInt(headerData.expectedItemsCount) || 0,
                expected_total_quantity: parseInt(headerData.expectedTotalQuantity) || 0,
                expected_grand_total: parseFloat(headerData.expectedGrandTotal),
                notes: headerData.notes
            });

            if (invoice) {
                setCurrentInvoice(invoice);
                setStep('add-product');
                toast.success(t('purchaseInvoice.invoiceCreated'));
            }
        } catch (error) {
            console.error(error);
            toast.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    // إضافة منتج (والبقاء في نفس الخطوة لمنتج تالٍ)
    const handleAddProduct = async (next: boolean) => {
        if (!currentInvoice || !currentItem.name || !currentItem.quantity || !currentItem.costPrice) {
            toast.error(t('products.fillRequired'));
            return;
        }

        setLoading(true);
        try {
            const newItem = await addPurchaseInvoiceItemCloud({
                invoice_id: currentInvoice.id,
                product_name: currentItem.name,
                barcode: currentItem.barcode,
                quantity: parseInt(currentItem.quantity),
                cost_price: parseFloat(currentItem.costPrice),
                sale_price: currentItem.salePrice ? parseFloat(currentItem.salePrice) : undefined
            });

            if (newItem) {
                setInvoiceItems(prev => [...prev, newItem]);

                // تحديث بيانات الفاتورة
                const { invoice } = await loadPurchaseInvoiceWithItems(currentInvoice.id);
                if (invoice) setCurrentInvoice(invoice);

                toast.success(t('purchaseInvoice.itemAdded'));

                if (next) {
                    // تفريغ الحقول لمنتج جديد
                    setCurrentItem({
                        name: '',
                        barcode: '',
                        quantity: '',
                        costPrice: '',
                        salePrice: ''
                    });
                    // تركيز تلقائي على الاسم (اختياري)
                } else {
                    // الانتقال للمراجعة
                    setStep('review');
                }
            }
        } catch (error) {
            console.error(error);
            toast.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    // إنهاء الفاتورة
    const handleFinalize = async () => {
        if (!currentInvoice) return;

        setLoading(true);
        try {
            const success = await finalizePurchaseInvoiceCloud(currentInvoice.id);
            if (success) {
                toast.success(t('purchaseInvoice.finalized'));
                onSuccess?.();
                onOpenChange(false);
            } else {
                toast.error('فشل في إنهاء الفاتورة');
            }
        } catch (error) {
            console.error(error);
            toast.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-2 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        {t('purchaseInvoice.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'header' && "الخطوة 1: بيانات الفاتورة الأساسية"}
                        {step === 'add-product' && "الخطوة 2: إضافة المنتجات"}
                        {step === 'review' && "الخطوة 3: المراجعة والإنهاء"}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/10">

                    {/* Step 1: Header Form */}
                    {step === 'header' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>رقم الفاتورة *</Label>
                                    <Input
                                        placeholder="مثال: INV-001"
                                        value={headerData.invoiceNumber}
                                        onChange={e => setHeaderData({ ...headerData, invoiceNumber: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>تاريخ الفاتورة *</Label>
                                    <Input
                                        type="date"
                                        value={headerData.invoiceDate}
                                        onChange={e => setHeaderData({ ...headerData, invoiceDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>اسم المورد *</Label>
                                    <Input
                                        placeholder="اسم الشخص"
                                        value={headerData.supplierName}
                                        onChange={e => setHeaderData({ ...headerData, supplierName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>الشركة (اختياري)</Label>
                                    <Input
                                        placeholder="اسم الشركة"
                                        value={headerData.supplierCompany}
                                        onChange={e => setHeaderData({ ...headerData, supplierCompany: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-100 dark:border-orange-900/50 space-y-4">
                                <h3 className="font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                    <AlertTriangle className="w-4 h-4" />
                                    أرقام المطابقة (للتأكد لاحقاً)
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>العدد المتوقع</Label>
                                        <Input
                                            type="number"
                                            placeholder="عدد الأصناف"
                                            value={headerData.expectedItemsCount}
                                            onChange={e => setHeaderData({ ...headerData, expectedItemsCount: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>الكمية المتوقعة</Label>
                                        <Input
                                            type="number"
                                            placeholder="إجمالي القطع"
                                            value={headerData.expectedTotalQuantity}
                                            onChange={e => setHeaderData({ ...headerData, expectedTotalQuantity: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>القيمة الإجمالية *</Label>
                                        <Input
                                            type="number"
                                            placeholder="المبلغ الكلي"
                                            className="border-orange-200"
                                            value={headerData.expectedGrandTotal}
                                            onChange={e => setHeaderData({ ...headerData, expectedGrandTotal: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Add Products (One by One) */}
                    {step === 'add-product' && (
                        <div className="space-y-6 max-w-lg mx-auto">
                            <div className="text-center space-y-2 mb-6">
                                <h3 className="text-lg font-bold">إضافة منتج جديد</h3>
                                <p className="text-sm text-muted-foreground">
                                    تم إضافة {invoiceItems.length} منتجات حتى الآن
                                </p>
                            </div>

                            <div className="space-y-4 bg-card p-4 rounded-xl border shadow-sm">
                                <div className="space-y-2">
                                    <Label>اسم المنتج *</Label>
                                    <Input
                                        value={currentItem.name}
                                        onChange={e => setCurrentItem({ ...currentItem, name: e.target.value })}
                                        placeholder="اسم الصنف"
                                        autoFocus
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>الباركود</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={currentItem.barcode}
                                                onChange={e => setCurrentItem({ ...currentItem, barcode: e.target.value })}
                                                placeholder="Scan..."
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>الكمية *</Label>
                                        <Input
                                            type="number"
                                            value={currentItem.quantity}
                                            onChange={e => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                                            placeholder="10"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>سعر التكلفة *</Label>
                                        <Input
                                            type="number"
                                            value={currentItem.costPrice}
                                            onChange={e => setCurrentItem({ ...currentItem, costPrice: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>سعر البيع (اختياري)</Label>
                                        <Input
                                            type="number"
                                            value={currentItem.salePrice}
                                            onChange={e => setCurrentItem({ ...currentItem, salePrice: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    className="flex-1"
                                    onClick={() => handleAddProduct(true)}
                                    disabled={loading}
                                >
                                    <Plus className="w-4 h-4 ml-2" />
                                    حفظ وإضافة التالي
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setStep('review')}
                                >
                                    مراجعة الفاتورة
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Review */}
                    {step === 'review' && currentInvoice && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="p-4 flex flex-col items-center text-center">
                                        <span className="text-xs text-muted-foreground">عدد الأصناف</span>
                                        <span className={cn("text-2xl font-bold",
                                            invoiceItems.length === currentInvoice.expected_items_count ? "text-green-600" : "text-yellow-600"
                                        )}>
                                            {invoiceItems.length} / {currentInvoice.expected_items_count}
                                        </span>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 flex flex-col items-center text-center">
                                        <span className="text-xs text-muted-foreground">الكمية الكلية</span>
                                        <span className={cn("text-2xl font-bold",
                                            currentInvoice.actual_total_quantity === currentInvoice.expected_total_quantity ? "text-green-600" : "text-yellow-600"
                                        )}>
                                            {currentInvoice.actual_total_quantity} / {currentInvoice.expected_total_quantity}
                                        </span>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 flex flex-col items-center text-center">
                                        <span className="text-xs text-muted-foreground">الإجمالي الفعلي</span>
                                        <span className={cn("text-2xl font-bold",
                                            Math.abs((currentInvoice.actual_grand_total || 0) - currentInvoice.expected_grand_total) < 1 ? "text-green-600" : "text-red-600"
                                        )}>
                                            {currentInvoice.actual_grand_total?.toFixed(2)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">من {currentInvoice.expected_grand_total}</span>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="border rounded-lg overflow-hidden bg-background">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted text-muted-foreground">
                                        <tr>
                                            <th className="p-3 text-right">المنتج</th>
                                            <th className="p-3 text-center">الكمية</th>
                                            <th className="p-3 text-center">التكلفة</th>
                                            <th className="p-3 text-center">الإجمالي</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {invoiceItems.map((item) => (
                                            <tr key={item.id}>
                                                <td className="p-3 font-medium">{item.product_name}</td>
                                                <td className="p-3 text-center">{item.quantity}</td>
                                                <td className="p-3 text-center">{item.cost_price.toFixed(2)}</td>
                                                <td className="p-3 text-center">{item.total_cost.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>

                <div className="p-6 bg-background border-t flex justify-between">
                    {step === 'header' && (
                        <>
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
                            <Button onClick={handleCreateInvoice} disabled={loading}>
                                التالي: إضافة المنتجات
                                <ArrowLeft className="w-4 h-4 mr-2" />
                            </Button>
                        </>
                    )}

                    {step === 'add-product' && (
                        <>
                            <Button variant="ghost" onClick={() => setStep('review')}>
                                تخطي للمراجعة
                            </Button>
                            {/* Buttons are inside form for easy access */}
                        </>
                    )}

                    {step === 'review' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('add-product')}>
                                <Plus className="w-4 h-4 ml-2" />
                                إضافة المزيد
                            </Button>
                            <Button
                                onClick={handleFinalize}
                                disabled={loading}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                <CheckCircle className="w-4 h-4 ml-2" />
                                اعتماد الفاتورة نهائياً
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
