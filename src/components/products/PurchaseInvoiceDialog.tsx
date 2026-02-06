import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import {
  Package,
  FileText,
  User,
  Building,
  Calendar,
  Hash,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Plus,
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
import { PurchaseInvoiceItemForm } from './PurchaseInvoiceItemForm';
import { PurchaseReconciliation } from './PurchaseReconciliation';

interface PurchaseInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'header' | 'items' | 'reconciliation';

export function PurchaseInvoiceDialog({ open, onOpenChange, onSuccess }: PurchaseInvoiceDialogProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('header');
  const [loading, setLoading] = useState(false);

  // Header form state
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierCompany, setSupplierCompany] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedItemsCount, setExpectedItemsCount] = useState('');
  const [expectedTotalQuantity, setExpectedTotalQuantity] = useState('');
  const [expectedGrandTotal, setExpectedGrandTotal] = useState('');
  const [notes, setNotes] = useState('');

  // Invoice state
  const [currentInvoice, setCurrentInvoice] = useState<PurchaseInvoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<PurchaseInvoiceItem[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('header');
      setInvoiceNumber('');
      setSupplierName('');
      setSupplierCompany('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setExpectedItemsCount('');
      setExpectedTotalQuantity('');
      setExpectedGrandTotal('');
      setNotes('');
      setCurrentInvoice(null);
      setInvoiceItems([]);
      setShowItemForm(false);
    }
  }, [open]);

  const handleCreateInvoice = async () => {
    if (!invoiceNumber || !supplierName || !expectedItemsCount || !expectedTotalQuantity || !expectedGrandTotal) {
      toast.error(t('products.fillRequired'));
      return;
    }

    setLoading(true);
    const invoice = await addPurchaseInvoiceCloud({
      invoice_number: invoiceNumber,
      supplier_name: supplierName,
      supplier_company: supplierCompany,
      invoice_date: invoiceDate,
      expected_items_count: parseInt(expectedItemsCount),
      expected_total_quantity: parseInt(expectedTotalQuantity),
      expected_grand_total: parseFloat(expectedGrandTotal),
      notes
    });
    setLoading(false);

    if (invoice) {
      setCurrentInvoice(invoice);
      setStep('items');
      setShowItemForm(true);
      toast.success(t('purchaseInvoice.invoiceCreated'));
    } else {
      toast.error(t('common.error'));
    }
  };

  const handleAddItem = async (item: {
    product_name: string;
    barcode?: string;
    category?: string;
    quantity: number;
    cost_price: number;
    sale_price?: number;
    product_id?: string;
  }) => {
    if (!currentInvoice) return;

    setLoading(true);
    const newItem = await addPurchaseInvoiceItemCloud({
      invoice_id: currentInvoice.id,
      ...item
    });
    setLoading(false);

    if (newItem) {
      setInvoiceItems(prev => [...prev, newItem]);
      // Refresh invoice data
      const { invoice } = await loadPurchaseInvoiceWithItems(currentInvoice.id);
      if (invoice) setCurrentInvoice(invoice);
      toast.success(t('purchaseInvoice.itemAdded'));
    } else {
      toast.error(t('common.error'));
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!currentInvoice) return;

    const success = await deletePurchaseInvoiceItemCloud(itemId, currentInvoice.id);
    if (success) {
      setInvoiceItems(prev => prev.filter(i => i.id !== itemId));
      const { invoice } = await loadPurchaseInvoiceWithItems(currentInvoice.id);
      if (invoice) setCurrentInvoice(invoice);
      toast.success(t('common.success'));
    }
  };

  const handleFinalize = async () => {
    if (!currentInvoice) return;

    setLoading(true);
    const success = await finalizePurchaseInvoiceCloud(currentInvoice.id);
    setLoading(false);

    if (success) {
      toast.success(t('purchaseInvoice.finalized'));
      onSuccess?.();
      onOpenChange(false);
    } else {
      toast.error(t('common.error'));
    }
  };

  const goToReconciliation = () => {
    setShowItemForm(false);
    setStep('reconciliation');
  };

  const backToItems = () => {
    setStep('items');
    setShowItemForm(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('purchaseInvoice.title')}
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 'header' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
            <span>1</span>
            <span>{t('purchaseInvoice.headerStep')}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 'items' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
            <span>2</span>
            <span>{t('purchaseInvoice.itemsStep')}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 'reconciliation' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
            <span>3</span>
            <span>{t('purchaseInvoice.reconciliationStep')}</span>
          </div>
        </div>

        {/* Step 1: Header */}
        {step === 'header' && (
          <div className="space-y-3">
            {/* Invoice Number */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-sm">
                <Hash className="w-4 h-4" />
                {t('purchaseInvoice.invoiceNumber')} *
              </Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-2024-001"
                className="h-10"
              />
            </div>

            {/* Supplier Name */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-sm">
                <User className="w-4 h-4" />
                {t('purchaseInvoice.supplierName')} *
              </Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder={t('purchaseInvoice.supplierNamePlaceholder')}
                className="h-10"
              />
            </div>

            {/* Supplier Company */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-sm">
                <Building className="w-4 h-4" />
                {t('purchaseInvoice.supplierCompany')}
              </Label>
              <Input
                value={supplierCompany}
                onChange={(e) => setSupplierCompany(e.target.value)}
                placeholder={t('purchaseInvoice.supplierCompanyPlaceholder')}
                className="h-10"
              />
            </div>

            {/* Expected Values - Improved Grid */}
            <div className="p-3 bg-muted/50 rounded-xl space-y-3">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                {t('purchaseInvoice.expectedValues')}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('purchaseInvoice.expectedItemsCount')} *</Label>
                  <Input
                    type="number"
                    value={expectedItemsCount}
                    onChange={(e) => setExpectedItemsCount(e.target.value)}
                    placeholder="10"
                    className="h-9 text-center"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('purchaseInvoice.expectedQuantity')} *</Label>
                  <Input
                    type="number"
                    value={expectedTotalQuantity}
                    onChange={(e) => setExpectedTotalQuantity(e.target.value)}
                    placeholder="100"
                    className="h-9 text-center"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {t('purchaseInvoice.expectedTotal')} *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={expectedGrandTotal}
                    onChange={(e) => setExpectedGrandTotal(e.target.value)}
                    placeholder="1000.00"
                    className="h-9 text-center"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm">{t('common.notes')}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('purchaseInvoice.notesPlaceholder')}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreateInvoice} disabled={loading}>
                {loading ? t('common.loading') : t('common.next')}
                <ArrowLeft className="w-4 h-4 mr-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Items */}
        {step === 'items' && currentInvoice && (
          <div className="space-y-4">
            {/* Progress indicator */}
            <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">{t('purchaseInvoice.itemsAdded')}:</span>
                  <span className={`font-bold mx-1 ${invoiceItems.length === currentInvoice.expected_items_count
                      ? 'text-success'
                      : invoiceItems.length > currentInvoice.expected_items_count
                        ? 'text-destructive'
                        : 'text-foreground'
                    }`}>
                    {invoiceItems.length}
                  </span>
                  <span className="text-muted-foreground">/ {currentInvoice.expected_items_count}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">{t('purchaseInvoice.totalQuantity')}:</span>
                  <span className={`font-bold mx-1 ${currentInvoice.actual_total_quantity === currentInvoice.expected_total_quantity
                      ? 'text-success'
                      : 'text-foreground'
                    }`}>
                    {currentInvoice.actual_total_quantity}
                  </span>
                  <span className="text-muted-foreground">/ {currentInvoice.expected_total_quantity}</span>
                </div>
              </div>
              <Button size="sm" onClick={goToReconciliation}>
                {t('purchaseInvoice.finishAndVerify')}
                <ArrowLeft className="w-4 h-4 mr-2" />
              </Button>
            </div>

            {/* Items list */}
            {invoiceItems.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-right">{t('products.name')}</th>
                      <th className="p-2 text-center">{t('products.quantity')}</th>
                      <th className="p-2 text-center">{t('products.costPrice')}</th>
                      <th className="p-2 text-center">{t('common.total')}</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">{item.product_name}</td>
                        <td className="p-2 text-center">{item.quantity}</td>
                        <td className="p-2 text-center">${item.cost_price.toFixed(2)}</td>
                        <td className="p-2 text-center">${item.total_cost.toFixed(2)}</td>
                        <td className="p-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Item Form */}
            {showItemForm && (
              <PurchaseInvoiceItemForm
                onAdd={handleAddItem}
                onClose={() => setShowItemForm(false)}
                loading={loading}
              />
            )}

            {!showItemForm && (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setShowItemForm(true)}
              >
                <Plus className="w-4 h-4 ml-2" />
                {t('purchaseInvoice.addAnotherItem')}
              </Button>
            )}
          </div>
        )}

        {/* Step 3: Reconciliation */}
        {step === 'reconciliation' && currentInvoice && (
          <PurchaseReconciliation
            invoice={currentInvoice}
            items={invoiceItems}
            onBack={backToItems}
            onFinalize={handleFinalize}
            loading={loading}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}