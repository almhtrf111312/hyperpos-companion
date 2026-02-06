import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Package, FileX, Loader2 } from 'lucide-react';
import { loadInvoicesCloud } from '@/lib/cloud/invoices-cloud';
import { useLanguage } from '@/hooks/use-language';
import { formatNumber } from '@/lib/utils';
import { EVENTS } from '@/lib/events';

interface TopProduct {
  id: string;
  name: string;
  sales: number;
  revenue: number;
}

export function TopProducts() {
  const { t } = useLanguage();
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate top products from cloud invoices
  const loadData = useCallback(async () => {
    try {
      const invoices = await loadInvoicesCloud();
      const productSales: Record<string, { name: string; sales: number; revenue: number }> = {};

      // Aggregate sales from all invoices
      invoices.forEach(invoice => {
        if (invoice.status === 'cancelled') return;

        invoice.items?.forEach(item => {
          const itemName = item.name;
          if (!productSales[itemName]) {
            productSales[itemName] = { name: itemName, sales: 0, revenue: 0 };
          }
          productSales[itemName].sales += item.quantity || 0;
          productSales[itemName].revenue += item.total || 0;
        });
      });

      // Convert to array and sort by sales
      const sorted = Object.entries(productSales)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5); // Top 5 products

      setTopProducts(sorted);
    } catch (error) {
      console.error('Error loading top products:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    window.addEventListener(EVENTS.INVOICES_UPDATED, loadData);
    return () => window.removeEventListener(EVENTS.INVOICES_UPDATED, loadData);
  }, [loadData]);

  const maxSales = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.sales)) : 1;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">{t('topProducts.title')}</h3>
        <span className="text-sm text-muted-foreground">{t('topProducts.fromInvoices')}</span>
      </div>

      {topProducts.length === 0 ? (
        <div className="py-8 text-center">
          <FileX className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">{t('topProducts.noData')}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">{t('topProducts.willAppear')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topProducts.map((product, index) => (
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
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span className="text-success font-medium">
                      ${formatNumber(product.revenue)}
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
                    {product.sales} {t('topProducts.sold')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
