import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getLowStockProducts, getCriticalStockAlerts } from '@/lib/products-store';
import { useLanguage } from '@/hooks/use-language';

export function LowStockAlerts() {
  const { t, tDynamic } = useLanguage();
  
  const { lowStockProducts, criticalCount } = useMemo(() => {
    const products = getLowStockProducts();
    const critical = getCriticalStockAlerts();
    return {
      lowStockProducts: products.slice(0, 5), // Show max 5
      criticalCount: critical.length,
    };
  }, []);

  if (lowStockProducts.length === 0) {
    return null;
  }

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            {tDynamic('lowStockAlert')}
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} {t('lowStock.critical')}
              </Badge>
            )}
          </CardTitle>
          <Link to="/products">
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              {t('lowStock.viewAll')}
              <ArrowLeft className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {lowStockProducts.map((product) => {
          const isCritical = product.quantity === 0;
          const isVeryLow = product.quantity <= (product.minStockLevel || 5) / 2;
          
          return (
            <div
              key={product.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                isCritical 
                  ? 'bg-destructive/10 border-destructive/30' 
                  : isVeryLow 
                    ? 'bg-warning/10 border-warning/30'
                    : 'bg-muted/50 border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  isCritical 
                    ? 'bg-destructive/20' 
                    : isVeryLow 
                      ? 'bg-warning/20'
                      : 'bg-muted'
                }`}>
                  <Package className={`w-4 h-4 ${
                    isCritical 
                      ? 'text-destructive' 
                      : isVeryLow 
                        ? 'text-warning'
                        : 'text-muted-foreground'
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground line-clamp-1">
                    {product.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('lowStock.minLevel')}: {product.minStockLevel || 5}
                  </p>
                </div>
              </div>
              <div className="text-end">
                <Badge 
                  variant={isCritical ? 'destructive' : isVeryLow ? 'outline' : 'secondary'}
                  className={`font-bold ${
                    isVeryLow && !isCritical ? 'border-warning text-warning' : ''
                  }`}
                >
                  {product.quantity} {t('lowStock.remaining')}
                </Badge>
              </div>
            </div>
          );
        })}
        
        {lowStockProducts.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            {t('lowStock.totalLowStock')}: {getLowStockProducts().length}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
