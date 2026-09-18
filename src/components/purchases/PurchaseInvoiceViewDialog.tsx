import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FileText,
  User,
  Building,
  Calendar,
  DollarSign,
  Package,
  Printer,
  Trash2,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';
import {
  loadPurchaseInvoiceWithItems,
  deletePurchaseInvoiceCloud,
  PurchaseInvoice,
  PurchaseInvoiceItem
} from '@/lib/cloud/purchase-invoices-cloud';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { printHTML } from '@/lib/native-print';
import { toast } from 'sonner';
import { emitEvent, EVENTS } from '@/lib/events';

interface PurchaseInvoiceViewDialogProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function PurchaseInvoiceViewDialog({
  invoiceId,
  open,
  onOpenChange,
  onDeleted,
}: PurchaseInvoiceViewDialogProps) {
  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [items, setItems] = useState<PurchaseInvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (open && invoiceId) {
      setLoading(true);
      loadPurchaseInvoiceWithItems(invoiceId)
        .then((result) => {
          setInvoice(result.invoice);
          setItems(result.items || []);
        })
        .catch((err) => {
          console.error('Error loading purchase invoice details:', err);
          toast.error('فشل تحميل تفاصيل فاتورة المشتريات');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setInvoice(null);
      setItems([]);
      setPreviewImage(null);
    }
  }, [open, invoiceId]);

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

  const handlePrint = () => {
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
    const totalQty = invoice.actual_total_quantity || items.reduce((s, i) => s + (i.quantity || 0), 0);

    const rowsHtml = items.map((item, idx) => `
      <tr>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: bold; text-align: right;">
          ${item.product_name}
          ${item.barcode ? `<div style="font-size: 10px; color: #64748b; font-family: monospace;">${item.barcode}</div>` : ''}
        </td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center;">${formatNumber(item.quantity)}</td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center;">${formatCurrency(item.cost_price)}</td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: left; font-weight: bold;">${formatCurrency(item.total_cost || item.quantity * item.cost_price)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>فاتورة مشتريات #${invoice.invoice_number}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Arabic', sans-serif;
              margin: 0;
              padding: 20px;
              color: #0f172a;
              background: #fff;
            }
            .header {
              border-bottom: 2px solid #0284c7;
              padding-bottom: 12px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .store-title {
              font-size: 20px;
              font-weight: 800;
              color: #0284c7;
            }
            .inv-badge {
              background: #f0f9ff;
              border: 1px solid #bae6fd;
              padding: 4px 10px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: bold;
              color: #0369a1;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px 16px;
              background: #f8fafc;
              padding: 12px;
              border-radius: 8px;
              margin-bottom: 16px;
              font-size: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            th {
              background: #f1f5f9;
              color: #334155;
              padding: 8px 6px;
              font-size: 12px;
              border-bottom: 2px solid #cbd5e1;
            }
            .summary {
              border-top: 2px solid #0f172a;
              padding-top: 12px;
              display: flex;
              justify-content: space-between;
              font-size: 15px;
              font-weight: bold;
            }
            .notes {
              margin-top: 16px;
              padding: 8px 12px;
              background: #fffbeb;
              border: 1px solid #fef3c7;
              border-radius: 6px;
              font-size: 11px;
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="store-title">${storeName}</div>
              <div style="font-size: 11px; color: #64748b;">${storeAddress} ${storePhone ? `• هاتف: ${storePhone}` : ''}</div>
            </div>
            <div class="inv-badge">
              فاتورة مشتريات #${invoice.invoice_number}
            </div>
          </div>

          <div class="info-grid">
            <div><strong>المورد:</strong> ${invoice.supplier_name} ${invoice.supplier_company ? `(${invoice.supplier_company})` : ''}</div>
            <div><strong>تاريخ الفاتورة:</strong> ${invoice.invoice_date}</div>
            <div><strong>الحالة:</strong> ${invoice.status === 'finalized' ? 'مؤكدة (تم إدخالها للمخزون)' : 'مسودة'}</div>
            <div><strong>عدد الأصناف:</strong> ${items.length} صنف (إجمالي ${formatNumber(totalQty)} قطعة)</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th style="text-align: right;">اسم الصنف</th>
                <th style="width: 70px; text-align: center;">الكمية</th>
                <th style="width: 85px; text-align: center;">سعر التكلفة</th>
                <th style="width: 95px; text-align: left;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary">
            <span>إجمالي الفاتورة:</span>
            <span>${formatCurrency(grandTotal)}</span>
          </div>

          ${invoice.notes ? `<div class="notes"><strong>ملاحظات:</strong> ${invoice.notes}</div>` : ''}
        </body>
      </html>
    `;

    printHTML(htmlContent);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] p-4 sm:p-6 overflow-y-auto">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle className="flex items-center justify-between gap-2 text-base sm:text-lg">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span>فاتورة مشتريات #{invoice?.invoice_number || ''}</span>
                {invoice?.status === 'finalized' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mr-2 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    مؤكدة بالمخزون
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 mr-2 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3" />
                    مسودة
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={handlePrint}
                disabled={loading || !invoice}
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDelete}
                disabled={loading || deleting || !invoice}
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                حذف
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

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
          <div className="space-y-4 pt-2">
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
                  {items.length} صنف
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border text-center">
                <div className="text-[11px] text-muted-foreground mb-0.5">إجمالي الكمية</div>
                <div className="text-sm sm:text-base font-bold text-primary">
                  {formatNumber(invoice.actual_total_quantity || items.reduce((s, i) => s + (i.quantity || 0), 0))}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border text-center">
                <div className="text-[11px] text-muted-foreground mb-0.5">المجموع الإجمالي</div>
                <div className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(invoice.actual_grand_total || invoice.expected_grand_total || 0)}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-primary" />
                <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                  المنتجات المشتراة في هذه الفاتورة ({items.length})
                </h4>
              </div>

              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border rounded-xl border-dashed">
                  لا توجد أصناف مسجلة داخل هذه الفاتورة
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-xs sm:text-sm text-right">
                      <thead className="bg-muted/70 text-muted-foreground sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5 text-center w-8">#</th>
                          <th className="p-2.5">اسم المنتج</th>
                          <th className="p-2.5 text-center">الكمية</th>
                          <th className="p-2.5 text-center">سعر التكلفة</th>
                          <th className="p-2.5 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-muted/30 transition-colors">
                            <td className="p-2.5 text-center text-muted-foreground">{idx + 1}</td>
                            <td className="p-2.5 font-medium">
                              <div className="text-foreground">{item.product_name}</div>
                              {item.barcode && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {item.barcode}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-bold text-primary">
                              {formatNumber(item.quantity)}
                            </td>
                            <td className="p-2.5 text-center text-muted-foreground">
                              {formatCurrency(item.cost_price)}
                            </td>
                            <td className="p-2.5 text-left font-bold text-foreground">
                              {formatCurrency(item.total_cost || item.quantity * item.cost_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Invoice Image Thumbnail if present */}
            {invoice.image_url && (
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
