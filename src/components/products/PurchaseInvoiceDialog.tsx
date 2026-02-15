import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import {
  FileText,
  User,
  Building,
  Calendar,
  Hash,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Plus,
  Camera,
  Image as ImageIcon
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
import { uploadProductImage } from '@/lib/image-upload';
import { supabase } from '@/integrations/supabase/client';
import { addToQueue } from '@/lib/sync-queue';
import { emitEvent, EVENTS } from '@/lib/events';
import { checkRealInternetAccess } from '@/hooks/use-network-status';

interface PurchaseInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'header' | 'items' | 'finalize';

export function PurchaseInvoiceDialog({ open, onOpenChange, onSuccess }: PurchaseInvoiceDialogProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('header');
  const [loading, setLoading] = useState(false);

  // Header form state
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierCompany, setSupplierCompany] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Invoice state
  const [currentInvoice, setCurrentInvoice] = useState<PurchaseInvoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<PurchaseInvoiceItem[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);

  // Invoice image
  const [invoiceImageUrl, setInvoiceImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('header');
      setInvoiceNumber('');
      setSupplierName('');
      setSupplierCompany('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setCurrentInvoice(null);
      setInvoiceItems([]);
      setShowItemForm(false);
      setInvoiceImageUrl('');
    }
  }, [open]);

  const handleCreateInvoice = async () => {
    if (!invoiceNumber || !supplierName) {
      toast.error(t('products.fillRequired'));
      return;
    }

    // فحص الاتصال الفعلي بالإنترنت (وليس فقط الشبكة)
    const hasInternet = await checkRealInternetAccess(15000);
    if (!hasInternet) {
      const localInvoice: PurchaseInvoice = {
        id: `local_${Date.now()}`,
        user_id: 'offline',
        invoice_number: invoiceNumber,
        supplier_name: supplierName,
        supplier_company: supplierCompany,
        invoice_date: invoiceDate,
        expected_items_count: 0,
        expected_total_quantity: 0,
        expected_grand_total: 0,
        actual_items_count: 0,
        actual_total_quantity: 0,
        actual_grand_total: 0,
        status: 'draft',
        notes: notes || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCurrentInvoice(localInvoice);
      setStep('items');
      setShowItemForm(true);
      toast.success(t('purchaseInvoice.invoiceCreated') + ' (offline)', { icon: '📴' });
      return;
    }

    setLoading(true);
    const invoice = await addPurchaseInvoiceCloud({
      invoice_number: invoiceNumber,
      supplier_name: supplierName,
      supplier_company: supplierCompany,
      invoice_date: invoiceDate,
      expected_items_count: 0,
      expected_total_quantity: 0,
      expected_grand_total: 0,
      notes: notes || undefined
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

  const isOfflineInvoice = currentInvoice?.id?.startsWith('local_');

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

    // If offline invoice, store items locally
    if (isOfflineInvoice) {
      const localItem: PurchaseInvoiceItem = {
        id: `local_item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        invoice_id: currentInvoice.id,
        product_name: item.product_name,
        barcode: item.barcode,
        category: item.category,
        quantity: item.quantity,
        cost_price: item.cost_price,
        sale_price: item.sale_price,
        total_cost: item.quantity * item.cost_price,
        created_at: new Date().toISOString(),
        product_id: item.product_id,
      };
      setInvoiceItems(prev => [...prev, localItem]);
      // Update local invoice totals
      setCurrentInvoice(prev => {
        if (!prev) return prev;
        const allItems = [...invoiceItems, localItem];
        return {
          ...prev,
          actual_items_count: allItems.length,
          actual_total_quantity: allItems.reduce((s, i) => s + i.quantity, 0),
          actual_grand_total: allItems.reduce((s, i) => s + i.total_cost, 0),
        };
      });
      toast.success(t('purchaseInvoice.itemAdded'));
      return;
    }

    setLoading(true);
    const newItem = await addPurchaseInvoiceItemCloud({
      invoice_id: currentInvoice.id,
      ...item
    });
    setLoading(false);

    if (newItem) {
      setInvoiceItems(prev => [...prev, newItem]);
      const { invoice } = await loadPurchaseInvoiceWithItems(currentInvoice.id);
      if (invoice) setCurrentInvoice(invoice);
      toast.success(t('purchaseInvoice.itemAdded'));
    } else {
      toast.error(t('common.error'));
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!currentInvoice) return;

    // If offline, just remove locally
    if (isOfflineInvoice || itemId.startsWith('local_item_')) {
      setInvoiceItems(prev => {
        const filtered = prev.filter(i => i.id !== itemId);
        setCurrentInvoice(inv => {
          if (!inv) return inv;
          return {
            ...inv,
            actual_items_count: filtered.length,
            actual_total_quantity: filtered.reduce((s, i) => s + i.quantity, 0),
            actual_grand_total: filtered.reduce((s, i) => s + i.total_cost, 0),
          };
        });
        return filtered;
      });
      toast.success(t('common.success'));
      return;
    }

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

    // If offline or local invoice, queue the entire invoice for later sync
    const hasInternetForFinalize = isOfflineInvoice ? false : await checkRealInternetAccess(15000);
    if (isOfflineInvoice || !hasInternetForFinalize) {
      addToQueue('purchase_invoice', {
        invoiceNumber: currentInvoice.invoice_number,
        supplierName: currentInvoice.supplier_name,
        supplierCompany: currentInvoice.supplier_company || undefined,
        invoiceDate: currentInvoice.invoice_date,
        notes: currentInvoice.notes || undefined,
        imageUrl: invoiceImageUrl || undefined,
        items: invoiceItems.map(item => ({
          product_name: item.product_name,
          barcode: item.barcode,
          category: item.category,
          quantity: item.quantity,
          cost_price: item.cost_price,
          sale_price: item.sale_price,
          product_id: item.product_id,
        })),
      });
      setLoading(false);
      toast.success(t('purchaseInvoice.finalized') + ' (offline)', { icon: '📴' });
      emitEvent(EVENTS.PURCHASES_UPDATED);
      onSuccess?.();
      onOpenChange(false);
      return;
    }

    try {
      // Save image URL if present
      if (invoiceImageUrl) {
        await supabase
          .from('purchase_invoices')
          .update({ image_url: invoiceImageUrl })
          .eq('id', currentInvoice.id);
      }

      const success = await finalizePurchaseInvoiceCloud(currentInvoice.id);
      setLoading(false);

      if (success) {
        toast.success(t('purchaseInvoice.finalized'));
        emitEvent(EVENTS.PURCHASES_UPDATED);
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast.error(t('common.error'));
      }
    } catch (error) {
      console.error('Finalize error, queueing:', error);
      // Fallback: queue on network error
      addToQueue('purchase_invoice', {
        invoiceNumber: currentInvoice.invoice_number,
        supplierName: currentInvoice.supplier_name,
        supplierCompany: currentInvoice.supplier_company || undefined,
        invoiceDate: currentInvoice.invoice_date,
        notes: currentInvoice.notes || undefined,
        imageUrl: invoiceImageUrl || undefined,
        items: invoiceItems.map(item => ({
          product_name: item.product_name,
          barcode: item.barcode,
          category: item.category,
          quantity: item.quantity,
          cost_price: item.cost_price,
          sale_price: item.sale_price,
          product_id: item.product_id,
        })),
      });
      setLoading(false);
      toast.success(t('purchaseInvoice.finalized') + ' (queued)', { icon: '📴' });
      emitEvent(EVENTS.PURCHASES_UPDATED);
      onSuccess?.();
      onOpenChange(false);
    }
  };

  const goToFinalize = () => {
    setShowItemForm(false);
    setStep('finalize');
  };

  const backToItems = () => {
    setStep('items');
    setShowItemForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const url = await uploadProductImage(base64);
        if (url) setInvoiceImageUrl(url);
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingImage(false);
    }
  };

  const handleCameraCapture = async () => {
    try {
      const { Camera: CapCamera } = await import('@capacitor/camera');
      const photo = await (CapCamera as any).getPhoto({
        quality: 70,
        resultType: 'base64' as any,
        source: 'CAMERA' as any,
      });
      if (photo?.base64String) {
        setUploadingImage(true);
        const base64 = `data:image/jpeg;base64,${photo.base64String}`;
        const url = await uploadProductImage(base64);
        if (url) setInvoiceImageUrl(url);
        setUploadingImage(false);
      }
    } catch {
      // Camera not available
    }
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
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${step === 'finalize' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
            <span>3</span>
            <span>{t('purchases.finalize')}</span>
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

            {/* Invoice Date */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-sm">
                <Calendar className="w-4 h-4" />
                {t('purchases.invoiceDate')}
              </Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="h-10"
              />
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
              <div className="text-sm">
                <span className="text-muted-foreground">{t('purchaseInvoice.itemsAdded')}:</span>
                <span className="font-bold mx-1 text-foreground">
                  {invoiceItems.length}
                </span>
                <span className="text-muted-foreground mx-2">|</span>
                <span className="text-muted-foreground">{t('common.total')}:</span>
                <span className="font-bold mx-1 text-foreground">
                  ${currentInvoice.actual_grand_total?.toFixed(2) || '0.00'}
                </span>
              </div>
              <Button size="sm" onClick={goToFinalize} disabled={invoiceItems.length === 0}>
                {t('purchases.finalize')}
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

        {/* Step 3: Finalize with Image */}
        {step === 'finalize' && currentInvoice && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
              <h3 className="font-semibold text-sm">{t('purchases.invoiceSummary')}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('purchaseInvoice.supplierName')}: </span>
                  <span className="font-medium">{currentInvoice.supplier_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('purchaseInvoice.invoiceNumber')}: </span>
                  <span className="font-medium">#{currentInvoice.invoice_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('purchaseInvoice.itemsAdded')}: </span>
                  <span className="font-medium">{invoiceItems.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('common.total')}: </span>
                  <span className="font-bold text-primary">${currentInvoice.actual_grand_total?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Items list */}
            <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
              {invoiceItems.map((item, index) => (
                <div key={item.id} className="flex justify-between text-xs py-1">
                  <span>{index + 1}. {item.product_name}</span>
                  <span className="text-muted-foreground">{item.quantity}×${item.cost_price.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Invoice Image Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('purchases.receiptPhoto')}</Label>
              {invoiceImageUrl ? (
                <div className="relative">
                  <img src={invoiceImageUrl} alt="Invoice" className="w-full h-40 object-cover rounded-lg border" />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 h-7 text-xs px-2"
                    onClick={() => setInvoiceImageUrl('')}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleCameraCapture}
                    disabled={uploadingImage}
                  >
                    <Camera className="w-4 h-4 ml-1" />
                    {t('purchases.camera')}
                  </Button>
                  <label className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={uploadingImage}
                      asChild
                    >
                      <span>
                        <ImageIcon className="w-4 h-4 ml-1" />
                        {t('purchases.gallery')}
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              )}
              {uploadingImage && (
                <p className="text-xs text-muted-foreground text-center">{t('common.loading')}...</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={backToItems} disabled={loading}>
                <ArrowRight className="w-4 h-4 ml-1" />
                {t('common.back')}
              </Button>
              <Button className="flex-1" onClick={handleFinalize} disabled={loading || uploadingImage}>
                {loading ? t('common.loading') : t('purchaseInvoice.finalizeInvoice')}
                <Check className="w-4 h-4 mr-1" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}