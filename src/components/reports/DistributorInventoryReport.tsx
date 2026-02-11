import { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, TrendingDown, TrendingUp, AlertTriangle, User, Truck, RefreshCw, FileSpreadsheet, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { loadWarehousesCloud, loadWarehouseStockCloud, loadStockTransfersCloud, getStockTransferItemsCloud } from '@/lib/cloud/warehouses-cloud';
import { loadProductsCloud, Product } from '@/lib/cloud/products-cloud';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DistributorStock {
  productId: string;
  productName: string;
  receivedQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  variance: number;
  unit: string;
}

interface Warehouse {
  id: string;
  name: string;
  type: string;
  assigned_cashier_id?: string;
}

export function DistributorInventoryReport() {
  const { t } = useLanguage();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [stockData, setStockData] = useState<DistributorStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load warehouses on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const warehouseList = await loadWarehousesCloud();
        // Filter only vehicle/distributor warehouses
        const distributorWarehouses = warehouseList.filter(w => w.type === 'vehicle');
        setWarehouses(distributorWarehouses);
        if (distributorWarehouses.length > 0) {
          setSelectedWarehouse(distributorWarehouses[0].id);
        }
      } catch (error) {
        console.error('Error loading warehouses:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Load stock data when warehouse changes
  const loadStockData = useCallback(async () => {
    if (!selectedWarehouse) return;

    setIsRefreshing(true);
    try {
      // Load all required data in parallel
      const [products, warehouseStock, allTransfers] = await Promise.all([
        loadProductsCloud(),
        loadWarehouseStockCloud(selectedWarehouse),
        loadStockTransfersCloud()
      ]);

      // Load invoices with warehouse_id directly from database
      const { data: allInvoices } = await supabase
        .from('invoices')
        .select(`
          id,
          warehouse_id,
          status,
          invoice_items (
            product_id,
            product_name,
            quantity
          )
        `)
        .eq('warehouse_id', selectedWarehouse)
        .eq('status', 'completed');

      // Filter transfers TO this warehouse (completed only)
      const transfersToWarehouse = allTransfers.filter(
        t => t.to_warehouse_id === selectedWarehouse && t.status === 'completed'
      );

      // Get all transfer items for received quantities
      const receivedMap = new Map<string, number>();
      for (const transfer of transfersToWarehouse) {
        const items = await getStockTransferItemsCloud(transfer.id);
        for (const item of items) {
          const current = receivedMap.get(item.product_id) || 0;
          receivedMap.set(item.product_id, current + item.quantity_in_pieces);
        }
      }

      // Calculate sold quantities from invoices
      const soldMap = new Map<string, number>();
      if (allInvoices) {
        for (const invoice of allInvoices) {
          const items = (invoice as any).invoice_items || [];
          for (const item of items) {
            if (item.product_id) {
              const current = soldMap.get(item.product_id) || 0;
              soldMap.set(item.product_id, current + (item.quantity || 0));
            }
          }
        }
      }

      // Build report combining all data
      const stockReport: DistributorStock[] = [];
      const processedProducts = new Set<string>();

      // Process products with warehouse stock
      for (const stockItem of warehouseStock) {
        const product = products.find(p => p.id === stockItem.product_id);
        if (!product) continue;

        processedProducts.add(stockItem.product_id);

        const receivedQuantity = receivedMap.get(stockItem.product_id) || 0;
        const soldQuantity = soldMap.get(stockItem.product_id) || 0;
        const remainingQuantity = stockItem.quantity;
        // Variance: Expected = Received - Sold, Actual = Remaining
        const expectedRemaining = receivedQuantity - soldQuantity;
        const variance = remainingQuantity - expectedRemaining;

        stockReport.push({
          productId: stockItem.product_id,
          productName: product.name,
          receivedQuantity,
          soldQuantity,
          remainingQuantity,
          variance,
          unit: product.smallUnit || 'قطعة'
        });
      }

      // Add products that were received but might not be in current stock
      for (const [productId, received] of receivedMap.entries()) {
        if (processedProducts.has(productId)) continue;

        const product = products.find(p => p.id === productId);
        if (!product) continue;

        const soldQuantity = soldMap.get(productId) || 0;
        const remainingQuantity = 0; // Not in current stock
        const expectedRemaining = received - soldQuantity;
        const variance = remainingQuantity - expectedRemaining;

        stockReport.push({
          productId,
          productName: product.name,
          receivedQuantity: received,
          soldQuantity,
          remainingQuantity,
          variance,
          unit: product.smallUnit || 'قطعة'
        });
      }

      // Sort by product name
      stockReport.sort((a, b) => a.productName.localeCompare(b.productName, 'ar'));

      setStockData(stockReport);
    } catch (error) {
      console.error('Error loading stock data:', error);
      toast.error('خطأ في تحميل بيانات الجرد');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    loadStockData();
  }, [loadStockData]);

  // Summary statistics
  const summary = useMemo(() => {
    const totalReceived = stockData.reduce((sum, item) => sum + item.receivedQuantity, 0);
    const totalSold = stockData.reduce((sum, item) => sum + item.soldQuantity, 0);
    const totalRemaining = stockData.reduce((sum, item) => sum + item.remainingQuantity, 0);
    const totalVariance = stockData.reduce((sum, item) => sum + item.variance, 0);
    const productCount = stockData.length;
    const itemsWithVariance = stockData.filter(item => item.variance !== 0).length;

    return { totalReceived, totalSold, totalRemaining, totalVariance, productCount, itemsWithVariance };
  }, [stockData]);

  // Export to Excel
  const exportToExcel = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default;
      const { utils, writeFile } = XLSX;
      const selectedWh = warehouses.find(w => w.id === selectedWarehouse);

      const exportData = stockData.map(item => ({
        'المنتج': item.productName,
        'الوحدة': item.unit,
        'المستلم': item.receivedQuantity,
        'المباع': item.soldQuantity,
        'المتبقي': item.remainingQuantity,
        'العجز/الفائض': item.variance,
        'الحالة': item.variance > 0 ? 'فائض' : item.variance < 0 ? 'عجز' : 'مطابق'
      }));

      // Add summary row
      exportData.push({
        'المنتج': '--- الإجمالي ---',
        'الوحدة': '',
        'المستلم': summary.totalReceived,
        'المباع': summary.totalSold,
        'المتبقي': summary.totalRemaining,
        'العجز/الفائض': summary.totalVariance,
        'الحالة': summary.totalVariance > 0 ? 'فائض' : summary.totalVariance < 0 ? 'عجز' : 'مطابق'
      });

      const ws = utils.json_to_sheet(exportData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'جرد العهدة');

      const fileName = `جرد_العهدة_${selectedWh?.name || 'موزع'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      writeFile(wb, fileName);

      toast.success('تم تصدير التقرير بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('خطأ في تصدير التقرير');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (warehouses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Truck className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground">لا يوجد موزعين</h3>
        <p className="text-sm text-muted-foreground mt-2">
          قم بإضافة مستودعات من نوع "سيارة موزع" من صفحة المستودعات
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warehouse Selector & Actions */}
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <User className="w-5 h-5 text-muted-foreground" />
          <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="اختر الموزع" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map(warehouse => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStockData}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("w-4 h-4 ml-2", isRefreshing && "animate-spin")} />
            تحديث
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={stockData.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 ml-2" />
            تصدير Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4" />
              إجمالي المستلم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalReceived}</div>
            <p className="text-xs text-muted-foreground">{summary.productCount} منتج</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              إجمالي المباع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.totalSold}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalReceived > 0 ? ((summary.totalSold / summary.totalReceived) * 100).toFixed(1) : 0}% من المستلم
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              المتبقي في العهدة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{summary.totalRemaining}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalReceived > 0 ? ((summary.totalRemaining / summary.totalReceived) * 100).toFixed(1) : 0}% من المستلم
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              العجز/الفائض
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              summary.totalVariance > 0 ? "text-green-600" : summary.totalVariance < 0 ? "text-destructive" : ""
            )}>
              {summary.totalVariance > 0 ? '+' : ''}{summary.totalVariance}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.totalVariance === 0 ? 'مطابق' : summary.totalVariance > 0 ? 'فائض' : 'عجز'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              منتجات بفرق
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              summary.itemsWithVariance > 0 ? "text-amber-500" : "text-green-600"
            )}>
              {summary.itemsWithVariance}
            </div>
            <p className="text-xs text-muted-foreground">
              من أصل {summary.productCount} منتج
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileDown className="w-5 h-5" />
            تفاصيل جرد العهدة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stockData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>لا يوجد مخزون في عهدة هذا الموزع</p>
              <p className="text-sm mt-2">قم بنقل منتجات إلى هذا المستودع من صفحة نقل المخزون</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-center">الوحدة</TableHead>
                    <TableHead className="text-center">المستلم</TableHead>
                    <TableHead className="text-center">المباع</TableHead>
                    <TableHead className="text-center">المتبقي</TableHead>
                    <TableHead className="text-center">العجز/الفائض</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockData.map((item) => (
                    <TableRow key={item.productId} className={cn(
                      item.variance !== 0 && "bg-amber-50/50 dark:bg-amber-950/20"
                    )}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.unit}</TableCell>
                      <TableCell className="text-center">{item.receivedQuantity}</TableCell>
                      <TableCell className="text-center text-green-600 font-medium">{item.soldQuantity}</TableCell>
                      <TableCell className="text-center text-primary font-semibold">{item.remainingQuantity}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          item.variance > 0
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : item.variance < 0
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-muted text-muted-foreground"
                        )}>
                          {item.variance > 0 && <TrendingUp className="w-3 h-3" />}
                          {item.variance < 0 && <TrendingDown className="w-3 h-3" />}
                          {item.variance > 0 ? '+' : ''}{item.variance}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
