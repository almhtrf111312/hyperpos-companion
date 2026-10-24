import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  User,
  Building,
  Calendar,
  DollarSign,
  Package,
  Share2,
  Trash2,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  Edit2,
  Save,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  loadPurchaseInvoiceWithItems,
  deletePurchaseInvoiceCloud,
  editPurchaseInvoiceAtomic,
  PurchaseInvoice,
  PurchaseInvoiceItem,
  EditPurchaseInvoiceLine
} from '@/lib/cloud/purchase-invoices-cloud';
import { useUserRole } from '@/hooks/use-user-role';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { useMoney } from '@/hooks/use-money';
import { shareInvoice, InvoiceShareData } from '@/lib/native-share';
import { toast } from '@/lib/sonner-bridge';
import { emitEvent, EVENTS } from '@/lib/events';

interface PurchaseInvoiceViewDialogProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  onEdited?: (newInvoiceId: string) => void;
}

export function PurchaseInvoiceViewDialog({
  invoiceId,
  open,
  onOpenChange,
  onDeleted,
  onEdited,
}: PurchaseInvoiceViewDialogProps) {
  const { isOwner, isAdmin, isBoss } = useUserRole();
  const canEdit = isOwner || isAdmin || isBoss;

  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [items, setItems] = useState<PurchaseInvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editLines, setEditLines] = useState<EditPurchaseInvoiceLine[]>([]);
  const m = useMoney();

  const invSnap = useMemo(() => {
    if (!invoice) return undefined;
    const anyInv = invoice as any;
    if (anyInv.currency_code || anyInv.currency) {
      return {
        currency_code: anyInv.currency_code || anyInv.currency || 'USD',
        currency_symbol: anyInv.currency_symbol || anyInv.currencySymbol || '$',
        exchange_rate: Number(anyInv.exchange_rate) || 1,
        decimals: anyInv.decimals ?? undefined,
      };
    }
    return undefined;
  }, [invoice]);

  const displayMoney = (val: number) => {
    if (invSnap) {
      return m.fmtDoc(val, invSnap);
    }
    return m.fmt(val);
  };
  const [editReason, setEditReason] = useState('تعديل فاتورة مشتريات');

  const fetchInvoice = (id: string) => {
    setLoading(true);
    loadPurchaseInvoiceWithItems(id)
      .then((result) => {
        setInvoice(result.invoice);
        setItems(result.items || []);
        setIsEditing(false);
      })
      .catch((err) => {
        console.error('Error loading purchase invoice details:', err);
        toast.error('فشل تحميل تفاصيل فاتورة المشتريات');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (open && invoiceId) {
      fetchInvoice(invoiceId);
    } else {
      setInvoice(null);
      setItems([]);
      setPreviewImage(null);
      setIsEditing(false);
    }
  }, [open, invoiceId]);

  const handleStartEdit = () => {
    if (!invoice) return;
    setEditLines(
      items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        barcode: i.barcode,
        category: i.category,
        quantity: i.quantity,
        cost_price: i.cost_price,
        sale_price: i.sale_price,
      }))
    );
    setEditReason('تصحيح كميات وأسعار فاتورة الشراء');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleLineQtyChange = (index: number, val: number) => {
    setEditLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: Math.max(0, val) };
      return next;
    });
  };

  const handleLineCostChange = (index: number, val: number) => {
    setEditLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], cost_price: Math.max(0, val) };
      return next;
    });
  };

  const handleSaveEdit = async () => {
    if (!invoice) return;
    if (editLines.length === 0) {
      toast.error('يجب أن تحتوي الفاتورة على صنف واحد على الأقل');
      return;
    }
    const hasInvalidQty = editLines.some((l) => !l.quantity || l.quantity <= 0);
    if (hasInvalidQty) {
      toast.error('الكمية يجب أن تكون أكبر من صفر لجميع الأصناف');
      return;
    }

    setSavingEdit(true);
    const opId = `op_edit_pi_${invoice.id}_${Date.now()}`;
    const result = await editPurchaseInvoiceAtomic(invoice.id, editLines, opId, editReason);
    setSavingEdit(false);

    if (result.success && result.newInvoiceId) {
      toast.success('تم تعديل الفاتورة وإعادة احتساب المخزون والتكلفة بنجاح');
      emitEvent(EVENTS.PURCHASES_UPDATED);
      emitEvent(EVENTS.PRODUCTS_UPDATED);
      setIsEditing(false);
      onEdited?.(result.newInvoiceId);
      fetchInvoice(result.newInvoiceId);
    } else {
      toast.error(result.error || 'تعذر تعديل الفاتورة، يرجى التحقق من توفر المخزون');
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    if (!window.confirm(`هل أنت متأكد من حذف فاتورة المشتريات رقم #${invoice.invoice_number}؟`)) {
      return;
    }
    setDeleting(true);
    try {
      const success = await deletePurchaseInvoiceCloud(invoice.id);
      if (success) {
        toast.success(`تم حذف فاتورة المشتريات #${invoice.invoice_number} بنجاح`);
        emitEvent(EVENTS.PURCHASES_UPDATED);
        emitEvent(EVENTS.PRODUCTS_UPDATED);
        onOpenChange(false);
        onDeleted?.();
      } else {
        toast.error('تعذر حذف فاتورة المشتريات');
      }
    } catch (error) {
      console.error('Error deleting purchase invoice:', error);
      toast.error('حدث خطأ أثناء الحذف');
    } finally {
      setDeleting(false);
    }
  };

  const handleShareImage = async () => {
    if (!invoice) return;

    let storeName = 'FlowPOS Pro';
    let storePhone = '';
    let storeAddress = '';
    try {
      const raw = localStorage.getItem('hyperpos_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        storeName = parsed.storeSettings?.name || storeName;
        storePhone = parsed.storeSettings?.phone || '';
        storeAddress = parsed.storeSettings?.address || '';
      }
    } catch (e) {
      /* ignore */
    }

    const grandTotal = invoice.actual_grand_total || invoice.expected_grand_total || 0;

    const shareData: InvoiceShareData = {
      id: invoice.invoice_number,
      storeName,
      storePhone,
      storeAddress,
      customerName: invoice.supplier_name,
      supplierName: invoice.supplier_name,
      supplierPhone: invoice.supplier_phone,
      date: new Date(invoice.invoice_date).toLocaleDateString('ar-SA'),
      items: items.map((item) => ({
        name: item.product_name,
        quantity: item.quantity,
        unitPrice: item.cost_price,
        total: item.total_cost || item.quantity * item.cost_price,
      })),
      subtotal: grandTotal,
      total: grandTotal,
      currencySymbol: invSnap?.currency_symbol || (invoice as any).currency_symbol || (invoice as any).currencySymbol || m.activeSymbol,
      currency: invSnap?.currency_code || (invoice as any).currency || m.activeCode,
      paymentType: (invoice.payment_type || 'cash') as InvoiceShareData['paymentType'],
      type: 'purchase',
      notes: invoice.notes,
    };

    const success = await shareInvoice(shareData);
    if (success) {
      toast.success('تم فتح نافذة المشاركة');
    }
  };

  if (!open) return null;

  const currentGrandTotal = isEditing
    ? editLines.reduce((s, l) => s + (l.quantity || 0) * (l.cost_price || 0), 0)
    : invoice?.actual_grand_total || invoice?.expected_grand_total || 0;

  const currentTotalQty = isEditing
    ? editLines.reduce((s, l) => s + (l.quantity || 0), 0)
    : invoice?.actual_total_quantity || items.reduce((s, i) => s + (i.quantity || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100vw-1rem,42rem)] max-h-[calc(100dvh-2rem)] flex flex-col p-0 overflow-hidden text-xs sm:text-sm rounded-2xl break-words">
        {/* Fixed Header */}
        <DialogHeader className="p-3.5 sm:p-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center justify-between gap-2 text-base sm:text-lg">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-bold">
                  {isEditing ? 'تعديل فاتورة مشتريات' : `فاتورة مشتريات #${invoice?.invoice_number || ''}`}
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {invoice?.status === 'superseded' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        مستبدلة بتعديل لاحق
                      </span>
                    ) : invoice?.status === 'finalized' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        مؤكدة بالمخزون
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" />
                        مسودة
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick header actions */}
            {!isEditing && invoice && (
              <div className="flex items-center gap-1.5 shrink-0">
                {canEdit && invoice.status !== 'superseded' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-8 px-2.5 text-xs text-primary border-primary/40 hover:bg-primary/10"
                    onClick={handleStartEdit}
                    disabled={loading}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">تعديل</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleDelete}
                  disabled={loading || deleting}
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">حذف</span>
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="text-sm">جاري تحميل تفاصيل الفاتورة والأصناف...</p>
            </div>
          ) : !invoice ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>لم يتم العثور على الفاتورة المطلوبة</p>
            </div>
          ) : (
            <>
              {/* Invoice Info Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/50 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <User className="w-4 h-4 text-primary shrink-0" />
                  <span>المورد:</span>
                  <span className="text-foreground font-bold">{invoice.supplier_name}</span>
                  {invoice.supplier_company && (
                    <span className="text-xs text-muted-foreground">({invoice.supplier_company})</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <span>تاريخ الشراء:</span>
                  <span className="text-foreground font-medium">{invoice.invoice_date}</span>
                </div>
              </div>

              {/* Quick Summary Cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-card border border-border text-center">
                  <div className="text-[11px] text-muted-foreground mb-0.5">عدد الأصناف</div>
                  <div className="text-sm sm:text-base font-bold text-foreground">
                    {isEditing ? editLines.length : items.length} صنف
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border text-center">
                  <div className="text-[11px] text-muted-foreground mb-0.5">إجمالي الكمية</div>
                  <div className="text-sm sm:text-base font-bold text-primary">
                    {formatNumber(currentTotalQty)}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-card border border-border text-center">
                  <div className="text-[11px] text-muted-foreground mb-0.5">المجموع الإجمالي</div>
                  <div className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {displayMoney(currentGrandTotal)}
                    {invSnap && invSnap.currency_code !== 'USD' && (
                      <span className="text-xs text-muted-foreground block font-normal font-sans">
                        (≈ ${currentGrandTotal.toFixed(2)} USD)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Edit Mode Notice & Reason Input */}
              {isEditing && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>تعديل محاسبي ذري محمي</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    سيتم عكس حركة المخزون والذمة للأسطر القديمة وتسجيل الأسطر المعدلة كحركات جديدة وإعادة احتساب متوسط التكلفة آلياً، وتعليم الفاتورة القديمة كمستبدلة.
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground mb-1">سبب التعديل:</label>
                    <Input
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="اكتب سبب تعديل الفاتورة للتدقيق..."
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
              )}

              {/* Items Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-primary" />
                  <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                    {isEditing ? 'تعديل بنود الفاتورة' : `المنتجات المشتراة في هذه الفاتورة (${items.length})`}
                  </h4>
                </div>

                {/* Mobile Cards View (<sm) */}
                <div className="sm:hidden space-y-2">
                  {(isEditing ? editLines : items).map((item, idx) => (
                    <div
                      key={(item as any).id || idx}
                      className="p-3 rounded-xl border border-border bg-card/60 space-y-2 break-words"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-foreground text-xs">{item.product_name}</span>
                        {item.barcode && (
                          <span className="font-mono text-[10px] text-muted-foreground">{item.barcode}</span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">الكمية:</label>
                            <Input
                              type="number"
                              min="1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleLineQtyChange(idx, parseFloat(e.target.value) || 0)}
                              className="h-8 text-xs font-bold text-primary"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">التكلفة:</label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={item.cost_price}
                              onChange={(e) => handleLineCostChange(idx, parseFloat(e.target.value) || 0)}
                              className="h-8 text-xs font-bold"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-1 text-[11px] pt-1 border-t border-border/40">
                          <div>
                            <span className="text-muted-foreground block text-[10px]">الكمية:</span>
                            <span className="font-bold text-primary">{formatNumber(item.quantity)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">التكلفة:</span>
                            <span>{displayMoney(item.cost_price)}</span>
                          </div>
                          <div className="text-left">
                            <span className="text-muted-foreground block text-[10px]">الإجمالي:</span>
                            <span className="font-bold text-foreground">
                              {displayMoney((item as any).total_cost || item.quantity * item.cost_price)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop / Tablet Table View (>=sm) */}
                <div className="hidden sm:block border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-xs sm:text-sm text-right">
                      <thead className="bg-muted/70 text-muted-foreground sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5 text-center w-8">#</th>
                          <th className="p-2.5">اسم المنتج</th>
                          <th className="p-2.5 text-center w-28">الكمية</th>
                          <th className="p-2.5 text-center w-28">سعر التكلفة</th>
                          <th className="p-2.5 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(isEditing ? editLines : items).map((item, idx) => (
                          <tr key={(item as any).id || idx} className="hover:bg-muted/30 transition-colors">
                            <td className="p-2.5 text-center text-muted-foreground">{idx + 1}</td>
                            <td className="p-2.5 font-medium">
                              <div className="text-foreground">{item.product_name}</div>
                              {item.barcode && (
                                <div className="text-[10px] text-muted-foreground font-mono">{item.barcode}</div>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  min="1"
                                  step="any"
                                  value={item.quantity}
                                  onChange={(e) => handleLineQtyChange(idx, parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs font-bold text-center text-primary"
                                />
                              ) : (
                                <span className="font-bold text-primary">{formatNumber(item.quantity)}</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.cost_price}
                                  onChange={(e) => handleLineCostChange(idx, parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs font-bold text-center"
                                />
                              ) : (
                                <span className="text-muted-foreground">{displayMoney(item.cost_price)}</span>
                              )}
                            </td>
                            <td className="p-2.5 text-left font-bold text-foreground">
                              {displayMoney((item as any).total_cost || item.quantity * item.cost_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Invoice Image Thumbnail if present */}
              {invoice.image_url && !isEditing && (
                <div className="p-3 bg-muted/30 border border-border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium">صورة الفاتورة المرفقة</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setPreviewImage(invoice.image_url || null)}
                  >
                    <ExternalLink className="w-3 h-3" />
                    عرض الصورة
                  </Button>
                </div>
              )}

              {/* Notes if present */}
              {invoice.notes && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-semibold ml-1">ملاحظات:</span>
                  <span>{invoice.notes}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="p-3 sm:p-4 border-t bg-muted/20 shrink-0 flex items-center justify-between gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-9 px-4 text-xs"
                onClick={handleCancelEdit}
                disabled={savingEdit}
              >
                <X className="w-3.5 h-3.5" />
                إلغاء التعديل
              </Button>
              <Button
                size="sm"
                className="gap-1.5 h-9 px-5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    جارٍ الحفظ والاحتساب...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    حفظ التعديل المحاسبي
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 px-3.5 text-xs text-primary border-primary/40 hover:bg-primary/10"
                onClick={handleShareImage}
                disabled={loading || !invoice}
              >
                <Share2 className="w-3.5 h-3.5" />
                مشاركة الفاتورة كصورة
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-4 text-xs"
                onClick={() => onOpenChange(false)}
              >
                إغلاق
              </Button>
            </>
          )}
        </div>

        {/* Image Preview Modal */}
        {previewImage && (
          <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
            <DialogContent className="max-w-3xl p-2">
              <img
                src={previewImage}
                alt="معاينة فاتورة المشتريات"
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
