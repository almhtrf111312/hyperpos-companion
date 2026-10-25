import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { NativeCameraPreview } from '@/components/camera/NativeCameraPreview';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/hooks/use-language';
import { useMoney } from '@/hooks/use-money';
import { toast } from '@/lib/sonner-bridge';
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
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import {
  addPurchaseInvoiceCloud,
  addPurchaseInvoiceItemCloud,
  finalizePurchaseInvoiceCloud,
  deletePurchaseInvoiceCloud,
  loadPurchaseInvoiceWithItems,
  deletePurchaseInvoiceItemCloud,
  PurchaseInvoice,
  PurchaseInvoiceItem
} from '@/lib/cloud/purchase-invoices-cloud';
import { PurchaseInvoiceItemForm } from './PurchaseInvoiceItemForm';
import { useImageUpload } from '@/hooks/use-image-upload';
import { supabase } from '@/integrations/supabase/client';
import { addToQueue } from '@/lib/sync-queue';
import { emitEvent, EVENTS } from '@/lib/events';
import { checkRealInternetAccess } from '@/hooks/use-network-status';
import { addProductCloud } from '@/lib/cloud/products-cloud';
import { loadCapitalState, withdrawCapital } from '@/lib/capital-store';

interface PurchaseInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'header' | 'items' | 'finalize';

export function PurchaseInvoiceDialog({ open, onOpenChange, onSuccess }: PurchaseInvoiceDialogProps) {
  const { t, isRTL } = useLanguage();
  const [step, setStep] = useState<Step>('header');
  const [loading, setLoading] = useState(false);

  const m = useMoney();
  const primaryCurrencyCode = m.activeCode;
  const primaryRate = m.activeRate;
  const primarySymbol = m.activeSymbol;

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

  // Invoice image — Offline-First
  const { imageValue: invoiceImageUrl, imagePreview: invoiceImagePreview, uploadStatus: invoiceImgStatus, handleBase64Image: handleInvoiceBase64, handleFileInput: handleImageUpload, clearImage: clearInvoiceImage } = useImageUpload();

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
      clearInvoiceImage();
    }
  }, [open, clearInvoiceImage]);

  const handleCreateInvoice = async () => {
    if (!invoiceNumber || !supplierName) {
      toast.error(t('products.fillRequired'));
      return;
    }

    // فحص الاتصال الفعلي بالإنترنت (وليس فقط الشبكة)
    const hasInternet = await checkRealInternetAccess(2500);
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
    // Extended fields
    wholesale_price?: number;
    expiry_date?: string;
    serial_number?: string;
    batch_number?: string;
    warranty?: string;
    size?: string;
    color?: string;
    weight?: string;
    fabric_type?: string;
    table_number?: string;
    order_notes?: string;
    author?: string;
    publisher?: string;
    min_stock_level?: number;
    image_url?: string;
    // Dual unit fields
    track_by_unit?: string;
    bulk_unit?: string;
    small_unit?: string;
    conversion_factor?: number;
    bulk_cost_price?: number;
    bulk_sale_price?: number;
  }) => {
    if (!currentInvoice) return;

    let resolvedProductId = item.product_id;

    // If not linked to an existing product, resolve or pre-create in products catalog
    if (!resolvedProductId && !isOfflineInvoice) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (item.barcode?.trim()) {
            const { data: existing } = await supabase
              .from('products')
              .select('id')
              .eq('user_id', user.id)
              .eq('barcode', item.barcode.trim())
              .maybeSingle();
            if (existing) resolvedProductId = existing.id;
          }
          if (!resolvedProductId && item.product_name.trim()) {
            const { data: existing } = await supabase
              .from('products')
              .select('id')
              .eq('user_id', user.id)
              .ilike('name', item.product_name.trim())
              .maybeSingle();
            if (existing) resolvedProductId = existing.id;
          }

          if (!resolvedProductId) {
            const createdProd = await addProductCloud({
              name: item.product_name.trim(),
              barcode: item.barcode?.trim() || '',
              category: item.category?.trim() || '',
              costPrice: item.cost_price,
              salePrice: item.sale_price || item.cost_price,
              quantity: 0, // Initial 0; finalized invoice adds item.quantity cleanly!
              minStockLevel: item.min_stock_level || 5,
              expiryDate: item.expiry_date,
              image: item.image_url,
              wholesalePrice: item.wholesale_price,
              serialNumber: item.serial_number,
              batchNumber: item.batch_number,
              warranty: item.warranty,
              size: item.size,
              color: item.color,
              weight: item.weight,
              fabricType: item.fabric_type,
              tableNumber: item.table_number,
              orderNotes: item.order_notes,
              author: item.author,
              publisher: item.publisher,
              trackByUnit: item.track_by_unit as 'piece' | 'bulk' | undefined,
              bulkUnit: item.bulk_unit,
              smallUnit: item.small_unit,
              conversionFactor: item.conversion_factor,
              bulkCostPrice: item.bulk_cost_price,
              bulkSalePrice: item.bulk_sale_price,
            });
            if (createdProd) {
              resolvedProductId = createdProd.id;
            }
          }
        }
      } catch (err) {
        console.warn('Could not pre-create product catalog item:', err);
      }
    }

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
        product_id: resolvedProductId,
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
      product_name: item.product_name,
      barcode: item.barcode,
      category: item.category,
      quantity: item.quantity,
      cost_price: item.cost_price,
      sale_price: item.sale_price,
      product_id: resolvedProductId,
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

  // يسحب قيمة فاتورة الشراء من رأس المال فقط إذا كان المحل يتتبع رأس مال
  const deductFromCapital = () => {
    try {
      const state = loadCapitalState();
      const tracksCapital = state.transactions.length > 0 || state.initialCapital > 0;
      if (!tracksCapital || !currentInvoice) return;
      const total = invoiceItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.cost_price) || 0), 0);
      if (total <= 0) return;
      const tx = withdrawCapital(total, `فاتورة شراء ${currentInvoice.invoice_number} - ${currentInvoice.supplier_name}`, 'system');
      if (!tx) toast.warning('رأس المال غير كافٍ لتغطية فاتورة الشراء، لم يتم السحب منه');
    } catch { /* ignore */ }
  };

  // إغلاق الحوار: حذف المسودة الفارغة حتى لا تُحفظ فواتير شراء بقيمة صفر
  const handleOpenChange = (next: boolean) => {
    if (!next && currentInvoice && invoiceItems.length === 0 && currentInvoice.status === 'draft') {
      if (!currentInvoice.id.startsWith('local_')) {
        deletePurchaseInvoiceCloud(currentInvoice.id).then(() => emitEvent(EVENTS.PURCHASES_UPDATED)).catch(() => {});
      }
      setCurrentInvoice(null);
    }
    onOpenChange(next);
  };

  const handleFinalize = async () => {
    if (!currentInvoice) return;
    if (invoiceItems.length === 0) {
      toast.error('أضف صنفاً واحداً على الأقل قبل حفظ الفاتورة');
      return;
    }

    setLoading(true);

    // If offline or local invoice, queue the entire invoice for later sync
    const hasInternetForFinalize = isOfflineInvoice ? false : await checkRealInternetAccess(2500);
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
      deductFromCapital();
      toast.success(t('purchaseInvoice.finalized') + ' (offline)', { icon: '📴' });
      emitEvent(EVENTS.PURCHASES_UPDATED);
      emitEvent(EVENTS.PRODUCTS_UPDATED);
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
        deductFromCapital();
        toast.success(t('purchaseInvoice.finalized'));
        emitEvent(EVENTS.PURCHASES_UPDATED);
        emitEvent(EVENTS.PRODUCTS_UPDATED);
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
      deductFromCapital();
      toast.success(t('purchaseInvoice.finalized') + ' (queued)', { icon: '📴' });
      emitEvent(EVENTS.PURCHASES_UPDATED);
      emitEvent(EVENTS.PRODUCTS_UPDATED);
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

  const [showCameraPreview, setShowCameraPreview] = useState(false);
  
  const handleCameraCapture = () => {
    setShowCameraPreview(true);
  };

  const handleCameraCaptured = (base64: string) => {
    setShowCameraPreview(false);
    handleInvoiceBase64(base64);
  };

  if (!open) return null;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 h-[100dvh] w-full bg-background flex flex-col overflow-hidden animate-in fade-in-50 duration-150",
          showCameraPreview && "hidden"
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* 1. الترويسة العلوية الثابتة (Full-Screen Sticky Header) */}
        <div className="shrink-0 bg-card/95 backdrop-blur-md border-b border-border/80 px-4 py-3 sm:px-6 shadow-xs z-40">
          <div className="max-w-4xl w-full mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 rounded-xl flex items-center justify-center ring-1 ring-primary/20 shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground truncate">
                  {t('purchaseInvoice.title')}
                </h2>
                <p className="text-[11px] text-muted-foreground truncate">
                  {step === 'header'
                    ? 'الخطوة 1: بيانات المورد ورقم الفاتورة'
                    : step === 'items'
                    ? 'الخطوة 2: إدخال أصناف وكميات الفاتورة'
                    : 'الخطوة 3: مراجعة واعتماد الفاتورة بالمخزون'}
                </p>
              </div>
            </div>

            {/* مؤشر المراحل المتجاوب */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              <div className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all",
                step === 'header' ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"
              )}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-black/15">1</span>
                <span className="hidden sm:inline">{t('purchaseInvoice.headerStep')}</span>
              </div>
              <div className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all",
                step === 'items' ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"
              )}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-black/15">2</span>
                <span className="hidden sm:inline">{t('purchaseInvoice.itemsStep')}</span>
              </div>
              <div className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all",
                step === 'finalize' ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"
              )}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-black/15">3</span>
                <span className="hidden sm:inline">{t('purchases.finalize')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. جسم الشاشة الكاملة القابل للتمرير */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 pb-28 space-y-5">
            {/* Step 1: Header */}
            {step === 'header' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-card p-4 sm:p-6 rounded-2xl border border-border shadow-2xs">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-sm font-medium">
                    <Hash className="w-4 h-4 text-primary" />
                    {t('purchaseInvoice.invoiceNumber')} *
                  </Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="INV-2024-001"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-sm font-medium">
                    <User className="w-4 h-4 text-primary" />
                    {t('purchaseInvoice.supplierName')} *
                  </Label>
                  <Input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder={t('purchaseInvoice.supplierNamePlaceholder')}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-sm font-medium">
                    <Building className="w-4 h-4 text-primary" />
                    {t('purchaseInvoice.supplierCompany')}
                  </Label>
                  <Input
                    value={supplierCompany}
                    onChange={(e) => setSupplierCompany(e.target.value)}
                    placeholder={t('purchaseInvoice.supplierCompanyPlaceholder')}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-sm font-medium">
                    <Calendar className="w-4 h-4 text-primary" />
                    {t('purchases.invoiceDate')}
                  </Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-sm font-medium">{t('common.notes')}</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('purchaseInvoice.notesPlaceholder')}
                    rows={3}
                    className="resize-none rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Items */}
            {step === 'items' && currentInvoice && (
              <div className="space-y-4">
                <div className="p-3 sm:p-4 bg-card border border-border rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div className="text-xs sm:text-sm">
                    <span className="text-muted-foreground">{t('purchaseInvoice.itemsAdded')}:</span>
                    <span className="font-bold mx-1 text-foreground">{invoiceItems.length}</span>
                    <span className="text-muted-foreground mx-2">|</span>
                    <span className="text-muted-foreground">{t('common.total')}:</span>
                    <span className="font-bold mx-1 text-primary font-mono">
                      {m.fmt(currentInvoice.actual_grand_total || 0)}
                    </span>
                  </div>
                  {!showItemForm && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowItemForm(true)}
                      className="h-9 rounded-xl text-xs font-bold gap-1"
                    >
                      <Plus className="w-4 h-4 text-primary" />
                      {t('purchaseInvoice.addAnotherItem')}
                    </Button>
                  )}
                </div>

                {invoiceItems.length > 0 && (
                  <div className="border border-border rounded-2xl overflow-x-auto max-w-full bg-card shadow-2xs">
                    <table className="w-full text-xs sm:text-sm min-w-[21.4rem]">
                      <thead className="bg-muted/70">
                        <tr>
                          <th className="p-2.5 text-right">{t('products.name')}</th>
                          <th className="p-2.5 text-center">{t('products.quantity')}</th>
                          <th className="p-2.5 text-center">{t('products.costPrice')}</th>
                          <th className="p-2.5 text-center">{t('common.total')}</th>
                          <th className="p-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceItems.map((item) => (
                          <tr key={item.id} className="border-t border-border/60">
                            <td className="p-2.5 font-medium">{item.product_name}</td>
                            <td className="p-2.5 text-center font-mono">{item.quantity}</td>
                            <td className="p-2.5 text-center font-mono">{m.fmt(item.cost_price)}</td>
                            <td className="p-2.5 text-center font-bold font-mono">{m.fmt(item.total_cost)}</td>
                            <td className="p-2.5 text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
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

                {showItemForm && (
                  <PurchaseInvoiceItemForm
                    onAdd={handleAddItem}
                    onClose={() => setShowItemForm(false)}
                    loading={loading}
                  />
                )}
              </div>
            )}

            {/* Step 3: Finalize with Image */}
            {step === 'finalize' && currentInvoice && (
              <div className="space-y-4">
                <div className="p-4 bg-card rounded-2xl border border-border space-y-3 shadow-2xs">
                  <h3 className="font-bold text-sm text-foreground">{t('purchases.invoiceSummary')}</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="p-2.5 rounded-xl bg-muted/40">
                      <span className="text-muted-foreground block text-[11px]">{t('purchaseInvoice.supplierName')}</span>
                      <span className="font-bold text-foreground">{currentInvoice.supplier_name}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-muted/40">
                      <span className="text-muted-foreground block text-[11px]">{t('purchaseInvoice.invoiceNumber')}</span>
                      <span className="font-bold font-mono text-foreground">#{currentInvoice.invoice_number}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-muted/40">
                      <span className="text-muted-foreground block text-[11px]">{t('purchaseInvoice.itemsAdded')}</span>
                      <span className="font-bold text-foreground">{invoiceItems.length}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                      <span className="text-muted-foreground block text-[11px]">{t('common.total')}</span>
                      <span className="font-black text-primary font-mono">
                        {m.fmt(currentInvoice.actual_grand_total || 0)}
                        {primaryCurrencyCode !== 'USD' && (
                          <span className="text-[11px] text-muted-foreground font-normal block font-sans">
                            (${currentInvoice.actual_grand_total?.toFixed(2)} USD)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border border-border bg-card rounded-2xl p-3.5 max-h-48 overflow-y-auto space-y-1.5">
                  {invoiceItems.map((item, index) => (
                    <div key={item.id} className="flex justify-between items-center text-xs sm:text-sm py-1.5 border-b last:border-b-0 border-border/50">
                      <span className="font-medium">{index + 1}. {item.product_name}</span>
                      <span className="text-muted-foreground font-mono">{item.quantity} × {m.fmt(item.cost_price)}</span>
                    </div>
                  ))}
                </div>

                {/* Invoice Image Upload */}
                <div className="p-4 bg-card rounded-2xl border border-border space-y-3">
                  <Label className="text-sm font-bold block">{t('purchases.receiptPhoto')}</Label>
                  {invoiceImagePreview ? (
                    <div className="relative">
                      <img src={invoiceImagePreview} alt="Invoice" className="w-full h-48 object-contain bg-muted/30 rounded-xl border" />
                      {invoiceImgStatus === 'syncing' && (
                        <div className="absolute top-2 left-2 bg-black/60 rounded-full p-1.5">
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        </div>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2 h-8 text-xs px-3 rounded-xl"
                        onClick={clearInvoiceImage}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-xl font-bold gap-2"
                        onClick={handleCameraCapture}
                      >
                        <Camera className="w-4 h-4 text-primary" />
                        {t('purchases.camera')}
                      </Button>
                      <label className="w-full">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-12 rounded-xl font-bold gap-2"
                          asChild
                        >
                          <span>
                            <ImageIcon className="w-4 h-4 text-primary" />
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
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. شريط الأزرار السفلي الثابت والموحد للموبايل (Sticky Bottom Action Bar) */}
        <div className="shrink-0 sticky bottom-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/80 p-3 sm:px-6 shadow-lg">
          <div className="max-w-4xl w-full mx-auto flex items-center gap-3">
            {step === 'header' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11 rounded-xl font-bold text-xs sm:text-sm"
                  onClick={() => handleOpenChange(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  className="flex-[2] h-11 rounded-xl font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-1.5"
                  onClick={handleCreateInvoice}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{loading ? t('common.loading') : t('common.next')}</span>
                  <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                </Button>
              </>
            )}

            {step === 'items' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11 rounded-xl font-bold text-xs sm:text-sm"
                  onClick={() => handleOpenChange(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  className="flex-[2] h-11 rounded-xl font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-1.5"
                  onClick={goToFinalize}
                  disabled={invoiceItems.length === 0 || loading}
                >
                  <span>{t('purchases.finalize')} ({invoiceItems.length})</span>
                  <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                </Button>
              </>
            )}

            {step === 'finalize' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11 rounded-xl font-bold text-xs sm:text-sm gap-1.5"
                  onClick={backToItems}
                  disabled={loading}
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>{t('common.back')}</span>
                </Button>
                <Button
                  type="button"
                  className="flex-[2] h-11 rounded-xl font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-1.5"
                  onClick={handleFinalize}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{loading ? t('common.loading') : t('purchaseInvoice.finalizeInvoice')}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <NativeCameraPreview
        isOpen={showCameraPreview}
        onClose={() => setShowCameraPreview(false)}
        onCapture={handleCameraCaptured}
        maxSize={400}
        quality={40}
      />
    </>,
    document.body
  );
}