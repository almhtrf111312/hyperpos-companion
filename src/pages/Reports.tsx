import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package,
  TrendingUp,
  DollarSign,
  Layers,
  Download,
  FileText,
  ShoppingCart,
  Users,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { loadProductsCloud } from '@/lib/cloud/products-cloud';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface ProductReport {
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  categoriesCount: number;
}

export default function Reports() {
  const [productReport, setProductReport] = useState<ProductReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('products');

  const isMobile = useIsMobile();
  const { toast } = useToast();

  // حساب تقرير المنتجات
  const calculateProductReport = async () => {
    setIsLoading(true);
    try {
      const products = await loadProductsCloud();

      const totalItems = products.length;
      const totalQuantity = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const totalValue = products.reduce((sum, p) => sum + ((p.quantity || 0) * (p.salePrice || 0)), 0);
      const lowStockItems = products.filter(p => (p.quantity || 0) > 0 && (p.quantity || 0) <= 5).length;
      const outOfStockItems = products.filter(p => (p.quantity || 0) === 0).length;

      const categories = new Set(products.map(p => p.category).filter(Boolean));
      const categoriesCount = categories.size;

      setProductReport({
        totalItems,
        totalQuantity,
        totalValue,
        lowStockItems,
        outOfStockItems,
        categoriesCount
      });

      toast({
        title: "تم إنشاء التقرير",
        description: `تم حساب إحصائيات ${totalItems} منتج`
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل بيانات المنتجات",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // تصدير PDF
  const exportToPDF = async () => {
    if (!productReport) {
      toast({
        title: "تنبيه",
        description: "يرجى إنشاء التقرير أولاً"
      });
      return;
    }

    try {
      const products = await loadProductsCloud();
      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.text("تقرير المنتجات", 105, 20, { align: "center" });

      doc.setFontSize(12);
      doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`, 105, 30, { align: "center" });

      doc.setFontSize(14);
      doc.text("الإحصائيات العامة:", 190, 50, { align: "right" });

      const stats = [
        ["إجمالي الأصناف:", productReport.totalItems.toString()],
        ["إجمالي الكميات:", productReport.totalQuantity.toString()],
        ["القيمة الإجمالية:", `${productReport.totalValue.toFixed(2)} $`],
        ["عدد الفئات:", productReport.categoriesCount.toString()],
        ["منتجات منخفضة:", productReport.lowStockItems.toString()],
        ["منتجات نفذت:", productReport.outOfStockItems.toString()]
      ];

      let y = 60;
      stats.forEach(([label, value]) => {
        doc.text(`${label} ${value}`, 190, y, { align: "right" });
        y += 10;
      });

      const tableData = products.map(p => [
        p.name,
        p.category || "غير مصنف",
        (p.quantity || 0).toString(),
        `${(p.salePrice || 0).toFixed(2)} $`,
        `${((p.quantity || 0) * (p.salePrice || 0)).toFixed(2)} $`
      ]);

      (doc as any).autoTable({
        head: [["المنتج", "الفئة", "الكمية", "السعر", "الإجمالي"]],
        body: tableData,
        startY: y + 10,
        styles: { font: "helvetica", halign: "right" },
        headStyles: { fillColor: [22, 163, 74] }
      });

      doc.save(`products-report-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "تم التصدير",
        description: "تم حفظ التقرير بنجاح"
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تصدير PDF",
        variant: "destructive"
      });
    }
  };

  // تبويبات مع أسماء وأيقونات (متجاوبة)
  const tabs = [
    { id: 'sales', label: 'المبيعات', icon: ShoppingCart },
    { id: 'products', label: 'المنتجات', icon: Package },
    { id: 'customers', label: 'العملاء', icon: Users },
    { id: 'financial', label: 'المالية', icon: DollarSign },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">التقارير</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* التبويبات - تصميم متجاوب */}
        <TabsList className={`w-full ${isMobile ? 'grid grid-cols-2 gap-1 h-auto' : 'flex'} mb-4`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={`
                  flex items-center gap-2 
                  ${isMobile ? 'flex-col py-2 px-1 text-xs' : 'py-2 px-4'}
                  data-[state=active]:bg-primary data-[state=active]:text-primary-foreground
                `}
              >
                <Icon className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
                <span className={isMobile ? 'text-[10px]' : 'text-sm'}>{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                تقرير المنتجات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={calculateProductReport}
                  disabled={isLoading}
                  size={isMobile ? "sm" : "default"}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {isLoading ? "جاري..." : "إنشاء التقرير"}
                </Button>

                <Button
                  variant="outline"
                  onClick={exportToPDF}
                  disabled={!productReport}
                  size={isMobile ? "sm" : "default"}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              </div>

              {productReport && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                  <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
                    <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-muted-foreground`}>الأصناف</p>
                          <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>{productReport.totalItems}</p>
                        </div>
                        <Layers className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-blue-500`} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
                    <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-muted-foreground`}>الكميات</p>
                          <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>{productReport.totalQuantity}</p>
                        </div>
                        <TrendingUp className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-green-500`} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-500/20">
                    <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-muted-foreground`}>القيمة</p>
                          <p className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold`}>
                            {productReport.totalValue.toFixed(0)} $
                          </p>
                        </div>
                        <DollarSign className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-amber-500`} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
                    <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-muted-foreground`}>الفئات</p>
                          <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>{productReport.categoriesCount}</p>
                        </div>
                        <Package className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-purple-500`} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20">
                    <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-muted-foreground`}>منخفضة</p>
                          <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-orange-600`}>
                            {productReport.lowStockItems}
                          </p>
                        </div>
                        <AlertTriangle className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-orange-500`} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20">
                    <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-muted-foreground`}>نفذت</p>
                          <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-red-600`}>
                            {productReport.outOfStockItems}
                          </p>
                        </div>
                        <Package className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-red-500`} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              تقارير المبيعات قيد التطوير
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              تقارير العملاء قيد التطوير
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              التقارير المالية قيد التطوير
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
