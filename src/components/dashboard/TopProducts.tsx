import { TrendingUp, Package } from 'lucide-react';

interface TopProduct {
  id: string;
  name: string;
  sales: number;
  revenue: number;
  trend: number;
}

// Empty products - will be populated from real data
const mockProducts: TopProduct[] = [];

export function TopProducts() {
  const maxSales = Math.max(...mockProducts.map(p => p.sales));

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">المنتجات الأكثر مبيعاً</h3>
        <span className="text-sm text-muted-foreground">هذا الأسبوع</span>
      </div>
      <div className="space-y-4">
        {mockProducts.map((product, index) => (
          <div 
            key={product.id} 
            className="flex items-center gap-4 fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-foreground truncate">{product.name}</p>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className={`w-4 h-4 ${product.trend >= 0 ? 'text-success' : 'text-destructive'}`} />
                  <span className={product.trend >= 0 ? 'text-success' : 'text-destructive'}>
                    {product.trend}%
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-primary rounded-full transition-all duration-500"
                    style={{ width: `${(product.sales / maxSales) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {product.sales} مبيعة
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
