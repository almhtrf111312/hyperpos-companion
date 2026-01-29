import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Package, Boxes, ArrowLeftRight, DollarSign, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UnitSettingsData {
  bulkUnit: string;
  smallUnit: string;
  conversionFactor: number;
  bulkCostPrice: number;
  bulkSalePrice: number;
  trackByUnit: 'piece' | 'bulk';
}

interface UnitSettingsTabProps {
  data: UnitSettingsData;
  onChange: (data: Partial<UnitSettingsData>) => void;
  /** الكمية الإجمالية بالقطع (الوحدة الصغرى) - دائماً بالقطع */
  quantityInPieces: number;
  /** سعر تكلفة القطعة الواحدة */
  pieceCostPrice: number;
}

export function UnitSettingsTab({ data, onChange, quantityInPieces, pieceCostPrice }: UnitSettingsTabProps) {
  const conversionFactor = data.conversionFactor || 1;
  
  // الكمية الإجمالية دائماً بالقطع - لا يتغير الحساب أبداً
  const totalPieces = quantityInPieces;
  
  // حساب عدد الكراتين الكاملة والقطع المتبقية
  const fullBulkUnits = Math.floor(totalPieces / conversionFactor);
  const remainingPieces = totalPieces % conversionFactor;

  // حساب سعر تكلفة الكرتونة تلقائياً من سعر القطعة × معامل التحويل
  const calculatedBulkCostPrice = pieceCostPrice * conversionFactor;

  // تحديد ما يعنيه التتبع
  const trackingExplanation = data.trackByUnit === 'bulk'
    ? `إدخال الكمية بالـ${data.bulkUnit || 'كرتونة'} (سيتم تحويلها تلقائياً للقطع)`
    : `إدخال الكمية بالـ${data.smallUnit || 'قطعة'}`;

  return (
    <div className="space-y-4 border border-border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Boxes className="w-4 h-4 text-primary" />
        إعدادات الوحدات (كرتونة / قطعة)
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Bulk Unit Name */}
        <div>
          <Label className="text-sm font-medium mb-1.5 block">الوحدة الكبرى</Label>
          <Input
            placeholder="كرتونة / طرد / شوال"
            value={data.bulkUnit}
            onChange={(e) => onChange({ bulkUnit: e.target.value })}
          />
        </div>
        
        {/* Small Unit Name */}
        <div>
          <Label className="text-sm font-medium mb-1.5 block">الوحدة الصغرى</Label>
          <Input
            placeholder="قطعة / حبة / علبة"
            value={data.smallUnit}
            onChange={(e) => onChange({ smallUnit: e.target.value })}
          />
        </div>
        
        {/* Conversion Factor */}
        <div className="sm:col-span-2">
          <Label className="text-sm font-medium mb-1.5 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
            معامل التحويل (عدد القطع في الوحدة الكبرى)
          </Label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="مثال: 20 قطعة في الكرتونة"
            value={data.conversionFactor === 0 ? '' : data.conversionFactor?.toString() || ''}
            onChange={(e) => {
              const value = e.target.value;
              // السماح بحقل فارغ أثناء الكتابة
              if (value === '') {
                onChange({ conversionFactor: 0 });
              } else {
                const num = parseInt(value, 10);
                if (!isNaN(num) && num >= 0) {
                  onChange({ conversionFactor: num });
                }
              }
            }}
            onBlur={(e) => {
              // عند مغادرة الحقل، تأكد من أن القيمة لا تقل عن 1
              const value = parseInt(e.target.value, 10);
              if (isNaN(value) || value < 1) {
                onChange({ conversionFactor: 1 });
              }
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            1 {data.bulkUnit || 'كرتونة'} = {data.conversionFactor || 1} {data.smallUnit || 'قطعة'}
          </p>
        </div>
        
        {/* Bulk Cost Price - calculated automatically */}
        <div>
          <Label className="text-sm font-medium mb-1.5 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            سعر تكلفة {data.bulkUnit || 'الكرتونة'} (محسوب تلقائياً)
          </Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={calculatedBulkCostPrice.toFixed(2)}
            readOnly
            className="bg-muted/50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            = سعر القطعة ({pieceCostPrice.toFixed(2)}$) × معامل التحويل ({conversionFactor})
          </p>
        </div>
        
        {/* Bulk Sale Price */}
        <div>
          <Label className="text-sm font-medium mb-1.5 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            سعر بيع {data.bulkUnit || 'الكرتونة'} (جملة)
          </Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={data.bulkSalePrice || ''}
            onChange={(e) => onChange({ bulkSalePrice: Number(e.target.value) })}
          />
        </div>
      </div>
      
      {/* Track by Unit Toggle */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">وحدة إدخال الكمية:</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${data.trackByUnit === 'piece' ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
            {data.smallUnit || 'قطعة'}
          </span>
          <Switch
            checked={data.trackByUnit === 'bulk'}
            onCheckedChange={(checked) => onChange({ trackByUnit: checked ? 'bulk' : 'piece' })}
          />
          <span className={`text-sm ${data.trackByUnit === 'bulk' ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
            {data.bulkUnit || 'كرتونة'}
          </span>
        </div>
      </div>
      
      {/* Tracking Explanation */}
      <Alert className="bg-blue-500/10 border-blue-500/30">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-muted-foreground">
          <strong>ملاحظة:</strong> {trackingExplanation}. 
          يتم تخزين الكمية دائماً بالقطع في قاعدة البيانات.
        </AlertDescription>
      </Alert>
      
      {/* Stock Summary - Always shows pieces as the base unit */}
      {totalPieces > 0 && (
        <div className="bg-primary/10 rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">إجمالي المخزون:</span>
            <span className="font-semibold text-foreground">
              {totalPieces} {data.smallUnit || 'قطعة'} = {fullBulkUnits} {data.bulkUnit || 'كرتونة'}
              {remainingPieces > 0 && ` + ${remainingPieces} ${data.smallUnit || 'قطعة'}`}
            </span>
          </div>
        </div>
      )}
      
      {/* Pricing Summary */}
      {pieceCostPrice > 0 && conversionFactor > 1 && (
        <div className="bg-success/10 rounded-lg p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">تكلفة القطعة الواحدة:</span>
            <span className="font-semibold text-foreground">
              ${pieceCostPrice.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">تكلفة {data.bulkUnit || 'الكرتونة'}:</span>
            <span className="font-semibold text-foreground">
              ${calculatedBulkCostPrice.toFixed(2)}
            </span>
          </div>
          {data.bulkSalePrice > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">سعر بيع القطعة من {data.bulkUnit || 'الكرتونة'}:</span>
                <span className="font-semibold text-foreground">
                  ${(data.bulkSalePrice / conversionFactor).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-success/20 pt-1 mt-1">
                <span className="text-muted-foreground">ربح {data.bulkUnit || 'الكرتونة'}:</span>
                <span className="font-semibold text-success">
                  ${(data.bulkSalePrice - calculatedBulkCostPrice).toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
