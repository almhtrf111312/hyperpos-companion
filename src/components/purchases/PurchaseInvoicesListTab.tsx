import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Search,
  Eye,
  Calendar,
  DollarSign,
  Plus,
  Truck,
  ShoppingBag,
  RotateCcw,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import {
  loadPurchaseInvoicesCloud,
  PurchaseInvoice
} from '@/lib/cloud/purchase-invoices-cloud';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { EVENTS } from '@/lib/events';
import { PurchaseInvoiceDialog } from '@/components/products/PurchaseInvoiceDialog';
import { PurchaseInvoiceViewDialog } from '@/components/purchases/PurchaseInvoiceViewDialog';

export function PurchaseInvoicesListTab() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await loadPurchaseInvoicesCloud();
      setInvoices(data);
    } catch (error) {
      console.error('Error loading purchase invoices:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener(EVENTS.PURCHASES_UPDATED, handler);
    window.addEventListener(EVENTS.PRODUCTS_UPDATED, handler);
    window.addEventListener('focus', loadData);
    return () => {
      window.removeEventListener(EVENTS.PURCHASES_UPDATED, handler);
      window.removeEventListener(EVENTS.PRODUCTS_UPDATED, handler);
      window.removeEventListener('focus', loadData);
    };
  }, [loadData]);

  const stats = useMemo(() => {
    const totalCount = invoices.length;
    const totalAmount = invoices.reduce(
      (sum, inv) => sum + (inv.actual_grand_total || inv.expected_grand_total || 0),
      0
    );
    const finalizedCount = invoices.filter((inv) => inv.status === 'finalized').length;
    const draftCount = invoices.filter((inv) => inv.status === 'draft').length;
    return { totalCount, totalAmount, finalizedCount, draftCount };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (inv) =>
          (inv.invoice_number && inv.invoice_number.toLowerCase().includes(q)) ||
          (inv.supplier_name && inv.supplier_name.toLowerCase().includes(q)) ||
          (inv.supplier_company && inv.supplier_company.toLowerCase().includes(q)) ||
          (inv.notes && inv.notes.toLowerCase().includes(q))
      );
    }
    if (dateFilter) {
      list = list.filter((inv) => inv.invoice_date && inv.invoice_date.startsWith(dateFilter));
    }
    return list;
  }, [invoices, search, dateFilter]);

  return (
    <div className="space-y-6">
      {/* Stats Cards for Purchases */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">عدد فواتير الشراء</p>
                <p className="text-xl font-bold">{stats.totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي المشتريات</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(stats.totalAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">مؤكدة بالمخزون</p>
                <p className="text-xl font-bold">{stats.finalizedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">مسودات</p>
                <p className="text-xl font-bold">{stats.draftCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Action */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث برقم الفاتورة، اسم المورد، أو اسم الشركة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 sm:w-48">
            <DatePicker
              value={dateFilter}
              onChange={setDateFilter}
              placeholder="تاريخ الشراء"
              className="w-full"
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

        <Button
          className="bg-primary hover:bg-primary/90 gap-1.5 h-10 shrink-0 shadow-sm"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="w-4 h-4" />
          <span>إضافة فاتورة مشتريات</span>
        </Button>
      </div>

      {/* Purchase Invoices List */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3].map((i) => (
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
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Truck className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-base font-medium text-foreground mb-1">
                لا توجد فواتير مشتريات مسجلة
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                يمكنك إضافة وتوثيق فواتير المشتريات لتسجيل البضاعة الموردة، أسعار التكلفة، وإدخالها
                للمخزون فوراً.
              </p>
              <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                إضافة فاتورة مشتريات جديدة
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredInvoices.map((inv) => (
            <Card
              key={inv.id}
              onClick={() => {
                setSelectedInvoiceId(inv.id);
                setShowViewDialog(true);
              }}
              className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group"
            >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {inv.supplier_name}
                        </span>
                        {inv.supplier_company && (
                          <span className="text-xs text-muted-foreground">
                            ({inv.supplier_company})
                          </span>
                        )}
                        <Badge
                          variant={inv.status === 'finalized' ? 'default' : 'secondary'}
                          className={
                            inv.status === 'finalized' ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                          }
                        >
                          {inv.status === 'finalized' ? 'مؤكدة بالمخزون' : 'مسودة'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span className="font-mono font-medium">#{inv.invoice_number}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {inv.invoice_date}
                        </span>
                        <span>•</span>
                        <span>
                          {inv.actual_items_count || inv.expected_items_count || 0} أصناف (
                          {formatNumber(
                            inv.actual_total_quantity || inv.expected_total_quantity || 0
                          )}{' '}
                          قطعة)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="text-right sm:text-left">
                      <p className="text-xs text-muted-foreground">إجمالي الفاتورة</p>
                      <p className="font-bold text-base sm:text-lg text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(inv.actual_grand_total || inv.expected_grand_total || 0)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-9 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedInvoiceId(inv.id);
                        setShowViewDialog(true);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>عرض الأصناف</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialogs */}
      <PurchaseInvoiceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={loadData}
      />
      <PurchaseInvoiceViewDialog
        invoiceId={selectedInvoiceId}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        onDeleted={loadData}
      />
    </div>
  );
}
