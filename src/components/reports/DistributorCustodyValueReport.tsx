import { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, DollarSign, Truck, RefreshCw, FileSpreadsheet, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { loadWarehousesCloud, loadWarehouseStockCloud } from '@/lib/cloud/warehouses-cloud';
import { loadProductsCloud, Product } from '@/lib/cloud/products-cloud';
import { useLanguage } from '@/hooks/use-language';
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface DistributorCustodyValue {
  warehouseId: string;
  warehouseName: string;
  assignedCashierId?: string;
  totalProducts: number;
  totalQuantity: number;
  totalCostValue: number;
  totalSaleValue: number;
  potentialProfit: number;
  products: {
    productId: string;
    productName: string;
    quantity: number;
    costPrice: number;
    salePrice: number;
    costValue: number;
    saleValue: number;
    unit: string;
  }[];
}

interface Warehouse {
  id: string;
  name: string;
  type: string;
  assigned_cashier_id?: string;
}

export function DistributorCustodyValueReport() {
  const { t } = useLanguage();
  const [distributorData, setDistributorData] = useState<DistributorCustodyValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedWarehouse, setExpandedWarehouse] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [warehouses, products] = await Promise.all([
        loadWarehousesCloud(),
        loadProductsCloud()
      ]);

      // Filter only vehicle/distributor warehouses
      const distributorWarehouses = warehouses.filter(w => w.type === 'vehicle');

      // Load stock for each distributor warehouse
      const distributorValues: DistributorCustodyValue[] = [];

      for (const warehouse of distributorWarehouses) {
        const warehouseStock = await loadWarehouseStockCloud(warehouse.id);

        const productDetails: DistributorCustodyValue['products'] = [];
        let totalQuantity = 0;
        let totalCostValue = 0;
        let totalSaleValue = 0;

        for (const stockItem of warehouseStock) {
          const product = products.find(p => p.id === stockItem.product_id);
          if (!product || stockItem.quantity <= 0) continue;

          const quantity = stockItem.quantity;
          const costPrice = product.costPrice || 0;
          const salePrice = product.salePrice || 0;
          const costValue = quantity * costPrice;
          const saleValue = quantity * salePrice;

          totalQuantity += quantity;
          totalCostValue += costValue;
          totalSaleValue += saleValue;

          productDetails.push({
            productId: product.id,
            productName: product.name,
            quantity,
            costPrice,
            salePrice,
            costValue,
            saleValue,
            unit: product.smallUnit || 'قطعة'
          });
        }

        // Sort products by sale value (highest first)
        productDetails.sort((a, b) => b.saleValue - a.saleValue);

        distributorValues.push({
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          assignedCashierId: warehouse.assigned_cashier_id,
          totalProducts: productDetails.length,
          totalQuantity,
          totalCostValue,
          totalSaleValue,
          potentialProfit: totalSaleValue - totalCostValue,
          products: productDetails
        });
      }

      // Sort by total sale value (highest first)
      distributorValues.sort((a, b) => b.totalSaleValue - a.totalSaleValue);

      setDistributorData(distributorValues);
    } catch (error) {
      console.error('Error loading custody value data:', error);
      toast.error('خطأ في تحميل بيانات قيمة العهدة');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Summary statistics
  const summary = useMemo(() => {
    const totalDistributors = distributorData.length;
    const totalProducts = distributorData.reduce((sum, d) => sum + d.totalProducts, 0);
    const totalQuantity = distributorData.reduce((sum, d) => sum + d.totalQuantity, 0);
    const totalCostValue = distributorData.reduce((sum, d) => sum + d.totalCostValue, 0);
    const totalSaleValue = distributorData.reduce((sum, d) => sum + d.totalSaleValue, 0);
    const totalPotentialProfit = distributorData.reduce((sum, d) => sum + d.potentialProfit, 0);

    return {
      totalDistributors,
      totalProducts,
      totalQuantity,
      totalCostValue,
      totalSaleValue,
      totalPotentialProfit
    };
  }, [distributorData]);

  // Export to Excel
  const handleExportToExcel = async () => {
    try {
      const { exportCustodyReportToExcel } = await import('@/lib/excel-export');
      await exportCustodyReportToExcel(distributorData);
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

  if (distributorData.length === 0) {
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
      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("w-4 h-4 ml-2", isRefreshing && "animate-spin")} />
          تحديث
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportToExcel}
          disabled={distributorData.length === 0}
        >
          <FileSpreadsheet className="w-4 h-4 ml-2" />
          تصدير Excel
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="w-4 h-4" />
              عدد الموزعين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalDistributors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4" />
              إجمالي المنتجات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4" />
              إجمالي الكميات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalQuantity}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              قيمة التكلفة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(summary.totalCostValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              قيمة البيع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(summary.totalSaleValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              الربح المتوقع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalPotentialProfit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distributor Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="w-5 h-5" />
            قيمة العهدة لكل موزع
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموزع</TableHead>
                  <TableHead className="text-center">عدد المنتجات</TableHead>
                  <TableHead className="text-center">إجمالي الكميات</TableHead>
                  <TableHead className="text-center">قيمة التكلفة</TableHead>
                  <TableHead className="text-center">قيمة البيع</TableHead>
                  <TableHead className="text-center">الربح المتوقع</TableHead>
                  <TableHead className="text-center">التفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributorData.map((distributor) => (
                  <>
                    <TableRow key={distributor.warehouseId} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                          {distributor.warehouseName}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{distributor.totalProducts}</TableCell>
                      <TableCell className="text-center">{distributor.totalQuantity}</TableCell>
                      <TableCell className="text-center text-amber-600 font-medium">
                        {formatCurrency(distributor.totalCostValue)}
                      </TableCell>
                      <TableCell className="text-center text-primary font-semibold">
                        {formatCurrency(distributor.totalSaleValue)}
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-semibold">
                        {formatCurrency(distributor.potentialProfit)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedWarehouse(
                            expandedWarehouse === distributor.warehouseId ? null : distributor.warehouseId
                          )}
                        >
                          {expandedWarehouse === distributor.warehouseId ? 'إخفاء' : 'عرض'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {/* Expanded product details */}
                    {expandedWarehouse === distributor.warehouseId && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">المنتج</TableHead>
                                  <TableHead className="text-center">الوحدة</TableHead>
                                  <TableHead className="text-center">الكمية</TableHead>
                                  <TableHead className="text-center">سعر التكلفة</TableHead>
                                  <TableHead className="text-center">سعر البيع</TableHead>
                                  <TableHead className="text-center">قيمة التكلفة</TableHead>
                                  <TableHead className="text-center">قيمة البيع</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {distributor.products.map((product) => (
                                  <TableRow key={product.productId}>
                                    <TableCell className="font-medium">{product.productName}</TableCell>
                                    <TableCell className="text-center text-muted-foreground">{product.unit}</TableCell>
                                    <TableCell className="text-center">{product.quantity}</TableCell>
                                    <TableCell className="text-center">{formatCurrency(product.costPrice)}</TableCell>
                                    <TableCell className="text-center">{formatCurrency(product.salePrice)}</TableCell>
                                    <TableCell className="text-center text-amber-600">{formatCurrency(product.costValue)}</TableCell>
                                    <TableCell className="text-center text-primary">{formatCurrency(product.saleValue)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
