import { useState, useEffect, useMemo } from 'react';
import { Package, TrendingDown, TrendingUp, AlertTriangle, User, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { loadWarehousesCloud, loadWarehouseStockCloud } from '@/lib/cloud/warehouses-cloud';
import { loadProductsCloud, Product } from '@/lib/cloud/products-cloud';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';

interface DistributorStock {
  productId: string;
  productName: string;
  receivedQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  variance: number; // Positive = surplus, Negative = shortage
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
  useEffect(() => {
    if (!selectedWarehouse) return;

    const loadStockData = async () => {
      setIsLoading(true);
      try {
        const [products, warehouseStock] = await Promise.all([
          loadProductsCloud(),
          loadWarehouseStockCloud(selectedWarehouse)
        ]);

        // Calculate stock data for each product
        const stockReport: DistributorStock[] = [];

        for (const stockItem of warehouseStock) {
          const product = products.find(p => p.id === stockItem.product_id);
          if (!product) continue;

          // For now, we calculate based on current stock
          // In a full implementation, we would track transfers and sales by warehouse
          const remainingQuantity = stockItem.quantity;
          // Assume received = remaining (will be updated when tracking transfers)
          const receivedQuantity = remainingQuantity;
          const soldQuantity = 0; // Will be calculated from warehouse-specific sales
          const variance = 0;

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

        setStockData(stockReport);
      } catch (error) {
        console.error('Error loading stock data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStockData();
  }, [selectedWarehouse]);

  // Summary statistics
  const summary = useMemo(() => {
    const totalReceived = stockData.reduce((sum, item) => sum + item.receivedQuantity, 0);
    const totalSold = stockData.reduce((sum, item) => sum + item.soldQuantity, 0);
    const totalRemaining = stockData.reduce((sum, item) => sum + item.remainingQuantity, 0);
    const totalVariance = stockData.reduce((sum, item) => sum + item.variance, 0);
    const productCount = stockData.length;

    return { totalReceived, totalSold, totalRemaining, totalVariance, productCount };
  }, [stockData]);

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
      {/* Warehouse Selector */}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <TrendingUp className="w-4 h-4 text-success" />
              إجمالي المباع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{summary.totalSold}</div>
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
              <AlertTriangle className="w-4 h-4 text-warning" />
              العجز/الفائض
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              summary.totalVariance > 0 ? "text-success" : summary.totalVariance < 0 ? "text-destructive" : ""
            )}>
              {summary.totalVariance > 0 ? '+' : ''}{summary.totalVariance}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.totalVariance === 0 ? 'مطابق' : summary.totalVariance > 0 ? 'فائض' : 'عجز'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">تفاصيل جرد العهدة</CardTitle>
        </CardHeader>
        <CardContent>
          {stockData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>لا يوجد مخزون في عهدة هذا الموزع</p>
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
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.unit}</TableCell>
                      <TableCell className="text-center">{item.receivedQuantity}</TableCell>
                      <TableCell className="text-center text-success">{item.soldQuantity}</TableCell>
                      <TableCell className="text-center text-primary font-semibold">{item.remainingQuantity}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          item.variance > 0 
                            ? "bg-success/10 text-success" 
                            : item.variance < 0 
                              ? "bg-destructive/10 text-destructive"
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
