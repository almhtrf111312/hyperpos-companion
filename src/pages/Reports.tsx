import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Package,
  TrendingUp,
  DollarSign,
  Layers,
  Download,
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

      // حساب عدد الأصناف الفريدة
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
      console.error("Error calculating report:", error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل بيانات المنتجات",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // تصدير التقرير كـ PDF
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

      // عنوان التقرير
      doc.setFontSize(20);
      doc.text("تقرير المنتجات", 105, 20, { align: "center" });

      // التاريخ
      doc.setFontSize(12);
      doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`, 105, 30, { align: "center" });

      // الإحصائيات الرئيسية
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

      // جدول المنتجات
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
      console.error("Error exporting PDF:", error);
      toast({
        title: "خطأ",
        description: "فشل في تصدير PDF",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">التقارير</h1>
      </div>

      {/* قسم تقارير المنتجات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            تقرير المنتجات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={calculateProductReport}
              disabled={isLoading}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {isLoading ? "جاري الحساب..." : "إنشاء تقرير المنتجات"}
            </Button>

            <Button
              variant="outline"
              onClick={exportToPDF}
              disabled={!productReport}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              تصدير PDF
            </Button>
          </div>

          {productReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {/* إجمالي الأصناف */}
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي الأصناف</p>
                      <p className="text-2xl font-bold">{productReport.totalItems}</p>
                    </div>
                    <Layers className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              {/* إجمالي الكميات */}
              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي الكميات</p>
                      <p className="text-2xl font-bold">{productReport.totalQuantity}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              {/* القيمة الإجمالية */}
              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">القيمة الإجمالية</p>
                      <p className="text-2xl font-bold">{productReport.totalValue.toFixed(2)} $</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-amber-500" />
                  </div>
                </CardContent>
              </Card>

              {/* عدد الفئات */}
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">عدد الفئات</p>
                      <p className="text-2xl font-bold">{productReport.categoriesCount}</p>
                    </div>
                    <Package className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              {/* منتجات منخفضة */}
              <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">منتجات منخفضة</p>
                      <p className="text-2xl font-bold text-orange-600">{productReport.lowStockItems}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              {/* منتجات نفذت */}
              <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">منتجات نفذت</p>
                      <p className="text-2xl font-bold text-red-600">{productReport.outOfStockItems}</p>
                    </div>
                    <Package className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
