import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Eye,
  Edit,
  Undo2,
  Printer,
  Send,
  Filter,
  Calendar,
  DollarSign,
  Banknote,
  CreditCard,
  Wrench,
  ShoppingCart,
  Truck,
  X,
  Check,
  MoreVertical,
  AlertTriangle,
  RotateCcw,
  Plus,
  Minus,
  Layers,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';
import { cn, formatNumber, formatCurrency, formatDateTime, roundCurrency } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { EVENTS } from '@/lib/events';
import {
  loadInvoicesCloud,
  invalidateInvoicesCache,
  deleteInvoiceCloud,
  refundInvoiceCloud,
  refundInvoicePartialCloud,
  PartialRefundItem,
  updateInvoiceCloud,
  getInvoiceStatsCloud,
  Invoice,
  InvoiceType,
  RefundResult
} from '@/lib/cloud/invoices-cloud';
import { invalidateProductsCache, refreshProductsFromCloud } from '@/lib/cloud/products-cloud';
import { emitEvent, EVENTS as PROD_EVENTS } from '@/lib/events';
import { deleteDebtByInvoiceIdCloud } from '@/lib/cloud/debts-cloud';
import { printHTML } from '@/lib/native-print';
import { shareInvoice, InvoiceShareData } from '@/lib/native-share';
import { useActionGuard } from '@/hooks/use-action-guard';
import { addToQueueIfNotExists } from '@/lib/sync-queue';
import { useCloudSyncContext } from '@/providers/CloudSyncProvider';
import { getCurrentUserRole } from '@/lib/supabase-store';
import { PurchaseInvoicesListTab } from '@/components/purchases/PurchaseInvoicesListTab';

export default function Invoices() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState<'sales' | 'purchases'>('sales');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | InvoiceType>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'cash' | 'debt'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [invoiceToRefund, setInvoiceToRefund] = useState<Invoice | null>(null);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [partialRefundQuantities, setPartialRefundQuantities] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ total: 0, todayCount: 0, todaySales: 0, totalSales: 0, pendingDebts: 0, totalProfit: 0 });
  const refundGuard = useActionGuard();
  const markPaidGuard = useActionGuard();
  const deleteGuard = useActionGuard();
  const { isOnline } = useCloudSyncContext();

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load invoices with proper cleanup
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [invoicesData, statsData] = await Promise.all([
        loadInvoicesCloud(),
        getInvoiceStatsCloud()
      ]);
      setInvoices(invoicesData);
      setStats(statsData);
      setIsLoading(false);
    };
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);

    return () => {
      window.removeEventListener(EVENTS.INVOICES_UPDATED, handleUpdate);
    };
  }, []);

  // Memoized filtered invoices for performance
  // ✅ Hide refunded invoices - they only appear in archive
  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(inv => inv.status !== 'refunded');

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(inv =>
        inv.customerName.toLowerCase().includes(query) ||
        inv.id.toLowerCase().includes(query) ||
        inv.serviceDescription?.toLowerCase().includes(query) ||
        inv.items?.some(item => item.name.toLowerCase().includes(query))
      );
    }

    if (filterType !== 'all') {
      result = result.filter(inv => inv.type === filterType);
    }

    if (filterPayment !== 'all') {
      result = result.filter(inv => inv.paymentType === filterPayment);
    }

    if (dateFilter) {
      result = result.filter(inv => inv.createdAt.startsWith(dateFilter));
    }

    return result;
  }, [invoices, debouncedSearch, filterType, filterPayment, dateFilter]);

  // استخراج تواريخ الأيام التي تحتوي على فواتير فعلية لتمييزها في التقويم
  const salesInvoiceDates = useMemo(() => {
    const dates = new Set<string>();
    for (const inv of invoices) {
      if (inv.status !== 'refunded' && inv.createdAt) {
        dates.add(inv.createdAt.slice(0, 10));
      }
    }
    return Array.from(dates);
  }, [invoices]);

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowViewDialog(true);
  };

  const handleRefund = (invoice: Invoice) => {
    // ✅ منع الاسترداد المزدوج من الواجهة
    if (invoice.status === 'refunded') {
      toast.warning('هذه الفاتورة مستردة بالفعل');
      return;
    }
    // ✅ فحص دور المستخدم — الكاشير لا يملك صلاحية الاسترداد (يحتاج إذن مشرف)
    getCurrentUserRole().then(role => {
      if (role === 'cashier') {
        toast.error('ليس لديك صلاحية تنفيذ الاسترداد', {
          description: 'هذه العملية تتطلب صلاحيات المشرف أو المدير. تواصل مع مالك المتجر.',
          duration: 5000,
        });
        return;
      }
      // لديه صلاحية — نفتح نافذة الاسترداد
      setInvoiceToRefund(invoice);
      setRefundMode('full');
      const initialQty: Record<string, number> = {};
      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach(item => {
          const key = item.productId || item.name;
          initialQty[key] = 0;
        });
      }
      setPartialRefundQuantities(initialQty);
      setShowRefundDialog(true);
    });
  };

  const updatePartialQty = (key: string, delta: number, maxQty: number) => {
    setPartialRefundQuantities(prev => {
      const current = prev[key] || 0;
      const updated = Math.max(0, Math.min(maxQty, current + delta));
      return { ...prev, [key]: updated };
    });
  };

  const setAllPartialQtyMax = () => {
    if (!invoiceToRefund?.items) return;
    const allMax: Record<string, number> = {};
    invoiceToRefund.items.forEach(item => {
      const key = item.productId || item.name;
      allMax[key] = item.quantity;
    });
    setPartialRefundQuantities(allMax);
  };

  const resetAllPartialQty = () => {
    if (!invoiceToRefund?.items) return;
    const allZero: Record<string, number> = {};
    invoiceToRefund.items.forEach(item => {
      const key = item.productId || item.name;
      allZero[key] = 0;
    });
    setPartialRefundQuantities(allZero);
  };

  const partialRefundStats = useMemo(() => {
    if (!invoiceToRefund || !invoiceToRefund.items) {
      return { totalRefundAmount: 0, itemsCount: 0, unitsCount: 0, isValid: false, cashToReturn: 0, debtReduction: 0 };
    }
    let totalRefundAmount = 0;
    let unitsCount = 0;
    let itemsCount = 0;

    invoiceToRefund.items.forEach(item => {
      const key = item.productId || item.name;
      const qty = partialRefundQuantities[key] || 0;
      if (qty > 0) {
        unitsCount += qty;
        itemsCount += 1;
        totalRefundAmount += item.price * qty;
      }
    });

    totalRefundAmount = roundCurrency(totalRefundAmount);

    let cashToReturn = 0;
    let debtReduction = 0;

    if (invoiceToRefund.paymentType === 'debt') {
      const debtRemaining = Number(invoiceToRefund.debtRemaining ?? (invoiceToRefund.total - (invoiceToRefund.debtPaid ?? 0)));
      if (totalRefundAmount <= debtRemaining) {
        debtReduction = totalRefundAmount;
        cashToReturn = 0;
      } else {
        debtReduction = debtRemaining;
        cashToReturn = roundCurrency(totalRefundAmount - debtRemaining);
      }
    } else {
      cashToReturn = totalRefundAmount;
    }

    return {
      totalRefundAmount,
      itemsCount,
      unitsCount,
      isValid: unitsCount > 0,
      cashToReturn,
      debtReduction
    };
  }, [invoiceToRefund, partialRefundQuantities]);

  const confirmRefund = () => refundGuard.run(async () => {
    if (!invoiceToRefund) return;
    const invoice = invoiceToRefund;
    // Snapshot invoice-specific data BEFORE running so notifications reflect this exact invoice
    const invoiceLabel = invoice.id;
    const invoiceTotal = invoice.totalInCurrency || invoice.total || 0;
    const invoiceCurrencySymbol = invoice.currencySymbol || '$';
    // Unique toast id per invoice → prevents duplicate stacked notifications on re-triggers
    const toastId = `refund-${invoiceLabel}`;

    // ✅ Close the dialog immediately (non-blocking UX) but DO NOT change the
    // invoice state until the server confirms the refund succeeded.
    setShowRefundDialog(false);
    setInvoiceToRefund(null);

    // ✅ Offline path: queue and stop here
    if (!isOnline) {
      addToQueueIfNotExists('invoice_refund', { invoiceNumber: invoiceLabel }, `invoice-refund:${invoiceLabel}`);
      toast.info(`تم جدولة استرداد ${invoiceLabel}`, {
        id: toastId,
        description: `المبلغ: ${formatCurrency(invoiceTotal, invoice.currency)} — سيُنفَّذ عند عودة الإنترنت`,
        duration: 3500,
      });
      return;
    }

    // ✅ Online path: dialog is already closed, but the guard remains held until completion.
    toast.loading(`جاري استرداد ${invoiceLabel}...`, { id: toastId });
    try {
        const result = await refundInvoiceCloud(invoiceLabel, 'online');
        if (typeof result === 'object' && result.alreadyRefunded) {
          setInvoices(prev => prev.map(inv =>
            inv.id === invoiceLabel ? { ...inv, status: 'refunded' as const } : inv
          ));
          toast.info(`الفاتورة ${invoiceLabel} مستردة بالفعل`, {
            id: toastId,
            description: 'لم تتم إضافة أي كمية جديدة إلى المخزون',
            duration: 3500,
          });
          return;
        }

        const ok = result && (result === true || (result as RefundResult).success);
        if (!ok) {
          const reason = typeof result === 'object' ? (result as RefundResult).error : undefined;
          toast.error(`فشل في استرداد ${invoiceLabel}`, {
            id: toastId,
            description: reason || 'لم يطرأ أي تغيير على الفاتورة أو المخزون',
            duration: 5000,
          });
          // No optimistic change was made, so nothing to roll back.
          return;
        }

        // Confirmed by the server → now reflect the refunded state in the list
        setInvoices(prev => prev.map(inv =>
          inv.id === invoiceLabel ? { ...inv, status: 'refunded' as const } : inv
        ));
        invalidateInvoicesCache();


        // Refresh stats silently — don't block UI
        getInvoiceStatsCloud().then(setStats).catch(() => {});

        // Refresh product quantities from cloud so local inventory reflects the refund
        try {
          invalidateProductsCache();
          refreshProductsFromCloud().then(() => {
            // Notify listeners that products updated
            emitEvent(PROD_EVENTS.PRODUCTS_UPDATED as any, null);
          }).catch(() => {});
        } catch (e) { /* noop */ }

        const refundedTotal = typeof result === 'object' ? result.invoiceTotal : invoiceTotal;
        const refundedCurrency = typeof result === 'object' ? (result.invoiceCurrency || invoice.currency) : invoice.currency;
        const lines: string[] = [`💵 المبلغ: ${formatCurrency(refundedTotal, refundedCurrency)}`];
        if (typeof result === 'object' && (result as RefundResult).success) {
          const r = result as RefundResult;
          if (r.restoredUnitsCount > 0) {
            lines.push(`📦 أُعيدت ${formatNumber(r.restoredUnitsCount)} قطعة من ${formatNumber(r.restoredItemsCount)} منتج`);
          }
          if (r.deletedDebtAmount > 0) {
            lines.push(`🗑️ دين محذوف: ${r.deletedDebtAmount.toFixed(2)}${invoiceCurrencySymbol}`);
          }
          if (r.cashToRefund && r.cashToRefund > 0) {
            lines.push(`💰 يُرجع نقداً للعميل ومن الوردية: ${formatCurrency(r.cashToRefund, refundedCurrency)}`);
          }
        }
        toast.success(`✅ تم استرداد ${invoiceLabel}`, {
          id: toastId,
          description: lines.join(' • '),
          duration: 4500,
        });
      } catch (err) {
        console.error('[confirmRefund] background error:', err);
        toast.error(`فشل في استرداد ${invoiceLabel}`, { id: toastId, duration: 3500 });
        invalidateInvoicesCache();
        const invoicesData = await loadInvoicesCloud();
        setInvoices(invoicesData);
      }
  });

  const confirmPartialRefund = () => refundGuard.run(async () => {
    if (!invoiceToRefund) return;
    const invoice = invoiceToRefund;
    const invoiceLabel = invoice.id;
    const toastId = `refund-${invoiceLabel}`;

    const itemsToRefund: PartialRefundItem[] = [];
    invoice.items?.forEach(item => {
      const key = item.productId || item.name;
      const qty = partialRefundQuantities[key] || 0;
      if (qty > 0) {
        itemsToRefund.push({
          productId: item.productId,
          productName: item.name,
          quantityToRefund: qty,
          quantity: qty,
          unitPrice: item.price,
          costPrice: item.costPrice || 0,
          profit: (item.price - (item.costPrice || 0)) * qty
        });
      }
    });

    if (itemsToRefund.length === 0) {
      toast.warning('يرجى تحديد كمية عنصر واحد على الأقل للاسترداد');
      return;
    }

    setShowRefundDialog(false);
    setInvoiceToRefund(null);

    if (!isOnline) {
      const refundedTotal = itemsToRefund.reduce((s, it) => s + (it.quantityToRefund * it.unitPrice), 0);
      const remainingTotal = Math.max(0, (invoice.total || 0) - refundedTotal);
      const isFull = remainingTotal <= 0;

      addToQueueIfNotExists(
        'invoice_refund_partial',
        { invoiceNumber: invoiceLabel, itemsToRefund },
        `invoice-refund-partial:${invoiceLabel}:${Date.now()}`
      );

      setInvoices(prev => prev.map(inv => {
        if (inv.id !== invoiceLabel) return inv;
        return {
          ...inv,
          total: remainingTotal,
          status: isFull ? ('refunded' as const) : inv.status,
          notes: (inv.notes ? inv.notes + '\n' : '') + `مرتجع جزئي (${refundedTotal}) أوفلاين بانتظار المزامنة`,
        };
      }));

      toast.info(`تمت جدولة الاسترداد الجزئي للفاتورة ${invoiceLabel}`, {
        id: toastId,
        description: `قيمة المرتجع: ${formatCurrency(refundedTotal, invoice.currency)} — سيُرفع تلقائياً عند الاتصال`,
        duration: 4000,
      });
      return;
    }

    toast.loading(`جاري الاسترداد الجزئي للفاتورة ${invoiceLabel}...`, { id: toastId });
    try {
      const result = await refundInvoicePartialCloud(invoiceLabel, itemsToRefund);
      if (!result.success) {
        toast.error(`فشل الاسترداد الجزئي: ${result.error}`, { id: toastId, duration: 5000 });
        return;
      }

      // Invalidate and reload
      invalidateInvoicesCache();
      const [updatedInvoices, statsData] = await Promise.all([
        loadInvoicesCloud(),
        getInvoiceStatsCloud()
      ]);
      setInvoices(updatedInvoices);
      setStats(statsData);

      try {
        invalidateProductsCache();
        refreshProductsFromCloud().then(() => {
          emitEvent(PROD_EVENTS.PRODUCTS_UPDATED as any, null);
        }).catch(() => {});
      } catch (e) { /* noop */ }

      const lines: string[] = [
        `💵 قيمة المرتجع: ${formatCurrency(result.refundedAmount, invoice.currency)}`
      ];
      if (result.cashToRefund > 0) {
        lines.push(`💰 يُرجع نقداً للعميل ومن الوردية: ${formatCurrency(result.cashToRefund, invoice.currency)}`);
      }
      if (result.debtReduced > 0) {
        lines.push(`📉 تخفيض الدين: ${formatCurrency(result.debtReduced, invoice.currency)}`);
      }
      lines.push(`📦 أُعيدت ${formatNumber(result.restoredUnitsCount)} قطعة`);

      toast.success(result.isFullyRefunded ? `✅ تم استرداد كامل الفاتورة ${invoiceLabel}` : `✅ تم الاسترداد الجزئي للفاتورة ${invoiceLabel}`, {
        id: toastId,
        description: lines.join(' • '),
        duration: 5000,
      });
    } catch (err) {
      console.error('[confirmPartialRefund] error:', err);
      toast.error(`فشل الاسترداد الجزئي للفاتورة ${invoiceLabel}`, { id: toastId, duration: 4000 });
      const invoicesData = await loadInvoicesCloud();
      setInvoices(invoicesData);
    }
  });

  const handleMarkPaid = (invoice: Invoice) => markPaidGuard.run(async () => {
    await updateInvoiceCloud(invoice.id, { status: 'paid', debtPaid: invoice.total, debtRemaining: 0 });
    await deleteDebtByInvoiceIdCloud(invoice.id);
    const invoicesData = await loadInvoicesCloud();
    setInvoices(invoicesData);
    toast.success(t('invoices.statusUpdated'));
  });

  // ✅ دالة تعقيم HTML لمنع XSS في template الطباعة
  // القيم المُدخَلة من المستخدم (أسماء المنتجات/العملاء/العناوين) قد تحتوي على
  // رموز HTML خبيثة لو أُدرجت مباشرة في template string.
  const escapeHtml = (unsafe: string | null | undefined): string => {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Navigate to debts page to pay installment
  const handlePayDebt = (invoice: Invoice) => {
    navigate(`/debts?invoiceId=${invoice.id}&autoOpenPayment=true`);
  };

  const handlePrint = (invoice: Invoice) => {
    // Dynamic store settings with proper defaults
    const storeDefaults = {
      storeName: 'HyperPOS Store',
      storeAddress: '',
      storePhone: '',
      storeLogo: '',
      footer: 'شكراً لتعاملكم معنا!',
      currencySymbol: 'ر.س'
    };

    let storeConfig = { ...storeDefaults };

    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeConfig = {
          storeName: settings.storeSettings?.name || storeDefaults.storeName,
          storeAddress: settings.storeSettings?.address || storeDefaults.storeAddress,
          storePhone: settings.storeSettings?.phone || storeDefaults.storePhone,
          storeLogo: settings.storeSettings?.logo || storeDefaults.storeLogo,
          footer: settings.printSettings?.footer || storeDefaults.footer,
          currencySymbol: settings.currencySymbol || storeDefaults.currencySymbol,
        };
      }
    } catch (error) {
      console.error('Failed to load store settings for print:', error);
      toast.error(t('invoices.printSettingsError'));
    }

    const { storeName, storeAddress, storePhone, storeLogo, footer } = storeConfig;

    const date = new Date(invoice.createdAt).toLocaleDateString('ar-SA');
    const time = new Date(invoice.createdAt).toLocaleTimeString('ar-SA');

    // ✅ جميع القيم المُدخَلة من المستخدم تمر عبر escapeHtml() لمنع XSS
    const itemsHtml = invoice.type === 'sale'
      ? invoice.items.map(item => `
          <tr>
            <td style="padding: 5px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
            <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: left;">${formatCurrency(item.total)}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="3" style="padding: 10px;">
          <div style="margin-bottom: 5px;"><strong>وصف الخدمة:</strong> ${escapeHtml(invoice.serviceDescription) || 'صيانة'}</div>
          ${invoice.partsCost ? `<div style="margin-bottom: 5px;"><strong>تكلفة القطع:</strong> ${formatCurrency(invoice.partsCost)}</div>` : ''}
          <div><strong>المبلغ المقبوض:</strong> ${formatCurrency(invoice.total)}</div>
          ${invoice.profit ? `<div style="color: green;"><strong>صافي الربح:</strong> ${formatCurrency(invoice.profit)}</div>` : ''}
        </td></tr>`;

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <title>فاتورة - ${invoice.id}</title>
          <style>
            /* Reset & Base - Mobile First */
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { 
              font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
              padding: 10px; 
              max-width: 80mm; 
              margin: 0 auto; 
              font-size: 12px;
              line-height: 1.4;
              color: #333;
            }
            
            /* Header */
            .header { 
              text-align: center; 
              margin-bottom: 15px; 
              border-bottom: 2px dashed #333; 
              padding-bottom: 12px; 
            }
            .logo { 
              max-width: 60px; 
              max-height: 60px; 
              margin: 0 auto 8px; 
              display: block; 
              object-fit: contain;
            }
            .store-name { 
              font-size: 1.3em; 
              font-weight: bold; 
              margin: 5px 0; 
              word-wrap: break-word;
            }
            .store-info { 
              font-size: 0.85em; 
              color: #555; 
              word-wrap: break-word;
            }
            
            /* Invoice Info */
            .invoice-info { 
              margin: 12px 0; 
              font-size: 0.9em; 
              border: 1px solid #ddd;
              border-radius: 6px;
              padding: 10px;
              background: #fafafa;
            }
            .invoice-info > div { 
              padding: 3px 0; 
              display: flex;
              justify-content: space-between;
              flex-wrap: wrap;
            }
            .invoice-info strong { 
              color: #333;
              min-width: 80px;
            }
            
            /* Table */
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 12px 0; 
              font-size: 0.9em;
            }
            th { 
              background: #333; 
              color: #fff;
              padding: 8px 5px; 
              text-align: right; 
              font-size: 0.85em;
            }
            td { 
              padding: 8px 5px; 
              border-bottom: 1px solid #eee; 
              vertical-align: top;
              word-wrap: break-word;
              max-width: 120px;
            }
            td:first-child {
              max-width: 45%;
              overflow-wrap: break-word;
              hyphens: auto;
            }
            td:nth-child(2) { text-align: center; width: 20%; }
            td:nth-child(3) { text-align: left; width: 25%; white-space: nowrap; }
            
            /* Service description for maintenance */
            .service-desc {
              white-space: pre-wrap;
              word-wrap: break-word;
              line-height: 1.5;
            }
            
            /* Discount */
            .discount-row {
              text-align: left;
              padding: 5px 0;
              color: #c00;
              font-weight: 500;
            }
            
            /* Total */
            .total { 
              font-size: 1.2em; 
              font-weight: bold; 
              margin-top: 12px; 
              border-top: 2px solid #333; 
              padding-top: 10px; 
              text-align: center;
              background: #f5f5f5;
              padding: 12px;
              border-radius: 6px;
            }
            
            /* Footer */
            .footer { 
              text-align: center; 
              margin-top: 20px; 
              font-size: 0.8em; 
              color: #666;
              border-top: 1px dashed #ccc;
              padding-top: 12px;
            }
            
            /* Print Styles */
            @media print {
              body { padding: 5px; max-width: 100%; }
              .header { page-break-after: avoid; }
              table { page-break-inside: avoid; }
              .total { page-break-before: avoid; }
              @page { 
                size: 80mm auto; 
                margin: 5mm; 
              }
            }
            
            /* Mobile Optimization */
            @media screen and (max-width: 320px) {
              body { font-size: 11px; padding: 8px; }
              .store-name { font-size: 1.1em; }
              td { padding: 6px 3px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${storeLogo ? `<img src="${escapeHtml(storeLogo)}" alt="شعار" class="logo" onerror="this.style.display='none'" />` : ''}
            <div class="store-name">${escapeHtml(storeName)}</div>
            ${storeAddress ? `<div class="store-info">${escapeHtml(storeAddress)}</div>` : ''}
            ${storePhone ? `<div class="store-info">${escapeHtml(storePhone)}</div>` : ''}
          </div>
          <div class="invoice-info">
            <div><strong>رقم الفاتورة:</strong> <span>${escapeHtml(invoice.id)}</span></div>
            <div><strong>التاريخ:</strong> <span>${escapeHtml(date)} - ${escapeHtml(time)}</span></div>
            <div><strong>العميل:</strong> <span>${escapeHtml(invoice.customerName)}</span></div>
            ${invoice.customerPhone ? `<div><strong>الهاتف:</strong> <span>${escapeHtml(invoice.customerPhone)}</span></div>` : ''}
            <div><strong>النوع:</strong> <span>${invoice.type === 'sale' ? 'مبيعات' : 'صيانة'}</span></div>
            <div><strong>الدفع:</strong> <span>${invoice.paymentType === 'cash' ? 'نقدي' : 'آجل'}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>البيان</th>
                <th>الكمية</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ${invoice.discount > 0 ? `<div class="discount-row">خصم: ${formatCurrency(invoice.discount)}</div>` : ''}
          ${invoice.taxAmount && invoice.taxAmount > 0 ? `<div class="discount-row" style="color: #555;">ضريبة${invoice.taxRate ? ` (${invoice.taxRate}%)` : ''}: ${formatCurrency(invoice.taxAmount)}</div>` : ''}
          <div class="total">
            الإجمالي: ${formatCurrency(invoice.totalInCurrency)}
          </div>
          <div class="footer">${footer}</div>
        </body>
      </html>
    `;

    // استخدام iframe للطباعة بدلاً من window.open
    printHTML(printContent);
    toast.success('جاري إرسال الفاتورة للطابعة...');
  };
  const handleWhatsApp = async (invoice: Invoice) => {
    // Dynamic store settings with proper defaults
    let storeName = 'FlowPOS Pro';
    let storePhone = '';

    try {
      const settingsRaw = localStorage.getItem('hyperpos_settings_v1');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        storeName = settings.storeSettings?.name || storeName;
        storePhone = settings.storeSettings?.phone || '';
      }
    } catch (error) {
      console.error('Failed to load store settings for WhatsApp:', error);
    }

    const date = new Date(invoice.createdAt).toLocaleDateString('ar-SA');

    // تحضير بيانات المشاركة
    const shareData: InvoiceShareData = {
      id: invoice.id,
      storeName,
      storePhone,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      date,
      items: invoice.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.total,
      })),
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      total: invoice.totalInCurrency,
      currencySymbol: invoice.currencySymbol,
      paymentType: invoice.paymentType,
      serviceDescription: invoice.serviceDescription,
      type: invoice.type,
      taxAmount: invoice.taxAmount,
      taxRate: invoice.taxRate,
    };

    const success = await shareInvoice(shareData);
    if (success) {
      toast.success(t('invoices.shareOpened') || 'تم فتح نافذة المشاركة');
    }
  };
  const handleShare = handleWhatsApp;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rtl:pr-14 ltr:pl-14 md:rtl:pr-0 md:ltr:pl-0">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">
            {t('invoices.title')}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('invoices.subtitle')}
          </p>
        </div>
      </div>

      {/* Fixed 2-button segmented control (strictly non-scrollable) */}
      <div className="w-full sm:w-auto inline-flex p-1 rounded-2xl bg-muted/80 border border-border shadow-sm overflow-hidden select-none">
        <button
          type="button"
          onClick={() => setActiveMainTab('sales')}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex-1 sm:flex-initial",
            activeMainTab === 'sales'
              ? "bg-gradient-primary text-primary-foreground shadow-md shadow-primary/30"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>فواتير المبيعات</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('purchases')}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex-1 sm:flex-initial",
            activeMainTab === 'purchases'
              ? "bg-gradient-primary text-primary-foreground shadow-md shadow-primary/30"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <Truck className="w-4 h-4" />
          <span>فواتير المشتريات</span>
        </button>
      </div>

      <Tabs value={activeMainTab} onValueChange={(val: any) => setActiveMainTab(val)} className="w-full space-y-6">
        <TabsContent value="sales" className="space-y-6 m-0">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('invoices.totalInvoices')}</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('invoices.todaySales')}</p>
                <p className="text-xl font-bold">{formatCurrency(stats.todaySales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <CreditCard className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('invoices.pendingDebts')}</p>
                <p className="text-xl font-bold">{stats.pendingDebts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Banknote className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('invoices.totalProfit')}</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('invoices.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select
          value={filterType}
          onValueChange={(v: 'all' | InvoiceType) => setFilterType(v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t('invoices.invoiceType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="sale">{t('invoices.sales')}</SelectItem>
            <SelectItem value="maintenance">{t('invoices.maintenance')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterPayment}
          onValueChange={(v: 'all' | 'cash' | 'debt') => setFilterPayment(v)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t('invoices.paymentMethod')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="cash">{t('invoices.cash')}</SelectItem>
            <SelectItem value="debt">{t('invoices.credit')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 flex-shrink-0 sm:w-40">
          <DatePicker
            value={dateFilter}
            onChange={setDateFilter}
            placeholder="التاريخ"
            className="w-full"
            highlightedDates={salesInvoiceDates}
          />
          {dateFilter && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 flex-shrink-0"
              onClick={() => setDateFilter('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        {isLoading ? (
          // Skeleton loading state
          [1, 2, 3, 4, 5].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-10 w-10 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t('invoices.noInvoices')}</p>
            </CardContent>
          </Card>
        ) : (
          filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      invoice.type === 'sale' ? "bg-primary/10" : "bg-warning/10"
                    )}>
                      {invoice.type === 'sale' ? (
                        <ShoppingCart className="w-5 h-5 text-primary" />
                      ) : (
                        <Wrench className="w-5 h-5 text-warning" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{invoice.customerName}</span>
                        <Badge variant={invoice.paymentType === 'cash' ? 'default' : 'secondary'}>
                          {invoice.paymentType === 'cash' ? t('invoices.cash') : t('invoices.credit')}
                        </Badge>
                        {invoice.status === 'refunded' && (
                          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                            <Undo2 className="w-3 h-3 ml-1" />
                            مسترجعة
                          </Badge>
                        )}
                        {invoice.paymentType === 'debt' && invoice.status === 'pending' && (
                          invoice.debtPaid && invoice.debtPaid > 0 && invoice.debtRemaining && invoice.debtRemaining > 0 ? (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                              مدفوع جزئياً
                            </Badge>
                          ) : (
                            <Badge variant="destructive">{t('invoices.unpaid')}</Badge>
                          )
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                        <span>{invoice.id}</span>
                        <span>•</span>
                        <span>{formatDateTime(new Date(invoice.createdAt))}</span>
                        {invoice.cashierName && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                              👤 {invoice.cashierName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className="font-bold text-lg">
                        {formatCurrency(invoice.totalInCurrency)}
                      </p>
                      {invoice.paymentType === 'debt' && invoice.status === 'pending' && invoice.debtPaid !== undefined && invoice.debtPaid > 0 && (
                        <p className="text-xs text-muted-foreground">
                          المدفوع: {formatCurrency(invoice.debtPaid)} / المتبقي: {formatCurrency(invoice.debtRemaining || 0)}
                        </p>
                      )}
                      {invoice.profit !== undefined && invoice.profit > 0 && (
                        <p className="text-xs text-success">
                          ربح: {formatCurrency(invoice.profit)}
                        </p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 min-w-[40px]">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(invoice)}>
                          <Eye className="w-4 h-4 ml-2" />
                          {t('common.view')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrint(invoice)}>
                          <Printer className="w-4 h-4 ml-2" />
                          {t('common.print')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShare(invoice)}>
                          <Share2 className="w-4 h-4 ml-2 text-primary" />
                          {t('common.share') || 'مشاركة الفاتورة'}
                        </DropdownMenuItem>
                        {invoice.paymentType === 'debt' && invoice.status === 'pending' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handlePayDebt(invoice)}>
                              <DollarSign className="w-4 h-4 ml-2" />
                              تسديد دفعة
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMarkPaid(invoice)}>
                              <Check className="w-4 h-4 ml-2" />
                              {t('invoices.markAsPaid')}
                            </DropdownMenuItem>
                          </>
                        )}
                        {invoice.status !== 'refunded' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRefund(invoice)}
                              className="text-orange-600"
                            >
                              <Undo2 className="w-4 h-4 ml-2" />
                              استرداد الفاتورة
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </TabsContent>

    <TabsContent value="purchases" className="space-y-6 m-0">
      <PurchaseInvoicesListTab />
    </TabsContent>
  </Tabs>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t('invoices.details')}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('invoices.invoiceNumber')}:</span>
                  <p className="font-semibold">{selectedInvoice.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.date')}:</span>
                  <p className="font-semibold" dir="ltr">
                    {formatDateTime(new Date(selectedInvoice.createdAt))}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.customer')}:</span>
                  <p className="font-semibold">{selectedInvoice.customerName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.phone')}:</span>
                  <p className="font-semibold">{selectedInvoice.customerPhone || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.type')}:</span>
                  <Badge variant={selectedInvoice.type === 'sale' ? 'default' : 'secondary'}>
                    {selectedInvoice.type === 'sale' ? t('invoices.sales') : t('invoices.maintenance')}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('invoices.payment')}:</span>
                  <Badge variant={selectedInvoice.paymentType === 'cash' ? 'default' : 'destructive'}>
                    {selectedInvoice.paymentType === 'cash' ? t('invoices.cash') : t('invoices.credit')}
                  </Badge>
                </div>
              </div>

              {selectedInvoice.type === 'maintenance' && (
                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">تفاصيل الصيانة:</p>
                  {selectedInvoice.serviceDescription && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">الوصف / نوع العطل:</span>
                      <span className="font-medium text-right max-w-[60%]">{selectedInvoice.serviceDescription}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المبلغ المقبوض:</span>
                    <span className="font-medium">{formatCurrency(selectedInvoice.total)}</span>
                  </div>
                  {selectedInvoice.partsCost !== undefined && selectedInvoice.partsCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">تكلفة القطع علينا:</span>
                      <span className="font-medium text-destructive">{formatCurrency(selectedInvoice.partsCost)}</span>
                    </div>
                  )}
                  {selectedInvoice.profit !== undefined && selectedInvoice.profit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">صافي الربح:</span>
                      <span className="font-medium text-success">{formatCurrency(selectedInvoice.profit)}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedInvoice.items.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">{selectedInvoice.type === 'sale' ? t('invoices.products') : 'عناصر الفاتورة'}:</span>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">المنتج</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">الكمية</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">السعر</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">المجموع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.items.map((item, idx) => (
                          <tr key={idx} className="border-t border-muted/50">
                            <td className="px-3 py-2">{item.name}</td>
                            <td className="px-3 py-2 text-center">{item.quantity}</td>
                            <td className="px-3 py-2 text-center">{formatCurrency(item.price)}</td>
                            <td className="px-3 py-2 text-left font-medium">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>{t('invoices.discount')}{selectedInvoice.discountPercentage ? ` (${selectedInvoice.discountPercentage}%)` : ''}:</span>
                    <span className="text-destructive">-{formatCurrency(selectedInvoice.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>{t('invoices.total')}:</span>
                  <span className="text-primary">{formatCurrency(selectedInvoice.totalInCurrency)}</span>
                </div>
                {selectedInvoice.profit !== undefined && (
                  <div className="flex justify-between text-sm text-success">
                    <span>{t('invoices.profit')}:</span>
                    <span>{formatCurrency(selectedInvoice.profit)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handlePrint(selectedInvoice)}>
                  <Printer className="w-4 h-4 ml-2" />
                  {t('common.print')}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => handleShare(selectedInvoice)}>
                  <Share2 className="w-4 h-4 ml-2 text-primary" />
                  {t('common.share') || 'مشاركة'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 text-right">
            <DialogTitle className="text-orange-600 flex items-center justify-between gap-2 text-lg">
              <div className="flex items-center gap-2">
                <Undo2 className="w-5 h-5" />
                <span>استرداد الفاتورة {invoiceToRefund?.id}</span>
              </div>
              {invoiceToRefund && (
                <Badge variant={invoiceToRefund.paymentType === 'cash' ? 'default' : 'destructive'} className="text-xs">
                  {invoiceToRefund.paymentType === 'cash' ? 'نقدي' : 'دين / آجل'}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-right pt-1">
              إرجاع منتجات الفاتورة للمخزون وتسوية الحسابات المالية ووردية الكاشير.
            </DialogDescription>
          </DialogHeader>

          {/* Mode Switcher if Sale Invoice */}
          {invoiceToRefund?.type === 'sale' && invoiceToRefund.items && invoiceToRefund.items.length > 0 && (
            <div className="px-6 pt-1 pb-2">
              <Tabs value={refundMode} onValueChange={(v) => setRefundMode(v as 'full' | 'partial')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="full" className="flex items-center gap-2 text-xs">
                    <RotateCcw className="w-3.5 h-3.5" />
                    استرداد كلي للفاتورة
                  </TabsTrigger>
                  <TabsTrigger value="partial" className="flex items-center gap-2 text-xs">
                    <Layers className="w-3.5 h-3.5" />
                    استرداد جزئي (تحديد بنود)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
            {/* Debt specific alert */}
            {invoiceToRefund?.paymentType === 'debt' && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30 p-3.5 space-y-2 text-xs text-amber-900 dark:text-amber-200 text-right">
                <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>تنبيه مالي مهم لفواتير الديون / الآجل:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 py-1 bg-white/70 dark:bg-black/20 rounded p-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">المسدد سابقاً: </span>
                    <span className="font-bold text-success">{formatCurrency(invoiceToRefund.debtPaid || 0, invoiceToRefund.currency)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">المتبقي بذمة العميل: </span>
                    <span className="font-bold text-destructive">{formatCurrency(invoiceToRefund.debtRemaining ?? (invoiceToRefund.total - (invoiceToRefund.debtPaid || 0)), invoiceToRefund.currency)}</span>
                  </div>
                </div>
                <p className="leading-relaxed">
                  {refundMode === 'full' ? (
                    (invoiceToRefund.debtPaid || 0) > 0 ? (
                      <>
                        ⚠️ <strong>إرجاع نقدي للعميل:</strong> قام العميل بسداد <strong>{formatCurrency(invoiceToRefund.debtPaid || 0, invoiceToRefund.currency)}</strong> سابقاً. يجب تسليم هذا المبلغ للعميل نقداً، <strong>وسيتم خصمه تلقائياً من درج الكاشير / الوردية الحالية</strong>، وشطب باقي الدين بالكامل.
                      </>
                    ) : (
                      'سيتم إلغاء وشطب الدين المتبقي في ذمة العميل بالكامل دون التأثير على درج الكاشير.'
                    )
                  ) : (
                    partialRefundStats.cashToReturn > 0 ? (
                      <>
                        ⚠️ <strong>إرجاع نقدي للعميل:</strong> قيمة المرتجع ({formatCurrency(partialRefundStats.totalRefundAmount, invoiceToRefund.currency)}) تتجاوز الدين المتبقي. سيتم تصفية الدين بالكامل وإرجاع الفارق <strong>({formatCurrency(partialRefundStats.cashToReturn, invoiceToRefund.currency)}) نقداً للعميل وخصمه من الوردية الحالية</strong>.
                      </>
                    ) : (
                      `سيتم تخفيض ${formatCurrency(partialRefundStats.debtReduction, invoiceToRefund.currency)} من رصيد دين العميل المتبقي دون التأثير على درج الكاشير.`
                    )
                  )}
                </p>
              </div>
            )}

            {/* Cash specific notice */}
            {invoiceToRefund?.paymentType === 'cash' && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2 text-right">
                <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold">تسوية درج الكاشير والوردية النشطة:</span>
                  <p className="leading-relaxed text-muted-foreground dark:text-slate-300">
                    {refundMode === 'full'
                      ? `سيتم تسليم ${formatCurrency(invoiceToRefund.totalInCurrency || invoiceToRefund.total, invoiceToRefund.currency)} نقداً للعميل وخصمها فوراً من مبيعات ودرج الوردية الحالية لمنع حدوث عجز وهمي.`
                      : `سيتم تسليم ${formatCurrency(partialRefundStats.cashToReturn, invoiceToRefund.currency)} نقداً للعميل وخصمها فوراً من الوردية الحالية.`}
                  </p>
                </div>
              </div>
            )}

            {refundMode === 'full' ? (
              <div className="space-y-3 py-1 text-right">
                <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-2 border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">العميل:</span>
                    <span className="font-semibold">{invoiceToRefund?.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">إجمالي الفاتورة:</span>
                    <span className="font-bold">{formatCurrency(invoiceToRefund?.totalInCurrency || invoiceToRefund?.total || 0, invoiceToRefund?.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">عدد العناصر والقطع:</span>
                    <span>{invoiceToRefund?.items?.length || 0} صنف ({invoiceToRefund?.items?.reduce((s, i) => s + i.quantity, 0) || 0} قطعة)</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  سيتم استرداد كامل الفاتورة، وإعادة جميع المنتجات لمخزون المستودع، وعكس الأرباح في تقارير اليوم.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-right">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">حدد الكميات المراد إرجاعها للمخزون:</span>
                  <div className="flex items-center gap-1.5">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2 text-primary" onClick={setAllPartialQtyMax}>
                      تحديد الكل
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground" onClick={resetAllPartialQty}>
                      تصفير
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg divide-y max-h-56 overflow-y-auto bg-card">
                  {invoiceToRefund?.items?.map((item) => {
                    const key = item.productId || item.name;
                    const currentQty = partialRefundQuantities[key] || 0;
                    const isSelected = currentQty > 0;
                    return (
                      <div key={key} className={cn("p-2.5 flex items-center justify-between gap-3 text-sm transition-colors", isSelected && "bg-orange-50/60 dark:bg-orange-950/20")}>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>{formatCurrency(item.price, invoiceToRefund.currency)} للقطعة</span>
                            <span>•</span>
                            <span>الكمية بالفاتورة: <strong className="text-foreground">{item.quantity}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center border rounded-md overflow-hidden bg-background">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-none"
                              onClick={() => updatePartialQty(key, -1, item.quantity)}
                              disabled={currentQty <= 0}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center font-bold text-xs">{currentQty}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-none"
                              onClick={() => updatePartialQty(key, 1, item.quantity)}
                              disabled={currentQty >= item.quantity}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn("h-7 px-2 text-xs", currentQty === item.quantity && "bg-primary text-primary-foreground")}
                            onClick={() => updatePartialQty(key, item.quantity - currentQty, item.quantity)}
                          >
                            الكل
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Partial summary box */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs border">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">الأصناف المحددة:</span>
                    <span className="font-semibold">{partialRefundStats.itemsCount} صنف ({partialRefundStats.unitsCount} قطعة)</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold border-t pt-1.5">
                    <span>إجمالي قيمة المرتجع:</span>
                    <span className="text-orange-600">{formatCurrency(partialRefundStats.totalRefundAmount, invoiceToRefund?.currency)}</span>
                  </div>
                  {invoiceToRefund?.paymentType === 'debt' ? (
                    <>
                      {partialRefundStats.debtReduction > 0 && (
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>تخفيض من الدين المتبقي:</span>
                          <span className="font-semibold text-destructive">-{formatCurrency(partialRefundStats.debtReduction, invoiceToRefund.currency)}</span>
                        </div>
                      )}
                      {partialRefundStats.cashToReturn > 0 && (
                        <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span>يُعاد نقداً للعميل ومن الوردية:</span>
                          <span>{formatCurrency(partialRefundStats.cashToReturn, invoiceToRefund.currency)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span>يُعاد نقداً للعميل ومن الوردية:</span>
                      <span>{formatCurrency(partialRefundStats.cashToReturn, invoiceToRefund?.currency)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 gap-2 flex-row justify-end">
            <Button variant="outline" onClick={() => setShowRefundDialog(false)} disabled={refundGuard.isRunning}>
              {t('common.cancel')}
            </Button>
            {refundMode === 'full' ? (
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={confirmRefund}
                disabled={refundGuard.isRunning}
                aria-busy={refundGuard.isRunning}
              >
                <Undo2 className={cn('w-4 h-4 ml-2', refundGuard.isRunning && 'animate-spin')} />
                {refundGuard.isRunning ? 'جاري الاسترداد...' : 'تأكيد الاسترداد الكامل'}
              </Button>
            ) : (
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={confirmPartialRefund}
                disabled={refundGuard.isRunning || !partialRefundStats.isValid}
                aria-busy={refundGuard.isRunning}
              >
                <Layers className={cn('w-4 h-4 ml-2', refundGuard.isRunning && 'animate-spin')} />
                {refundGuard.isRunning
                  ? 'جاري الاسترداد...'
                  : `تأكيد الاسترداد الجزئي (${formatCurrency(partialRefundStats.totalRefundAmount, invoiceToRefund?.currency)})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
