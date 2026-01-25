import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Package, Boxes, ArrowLeftRight, DollarSign } from 'lucide-react';

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
  quantity: number;
}

export function UnitSettingsTab({ data, onChange, quantity }: UnitSettingsTabProps) {
  // Calculate total pieces based on bulk quantity
  const totalPieces = data.trackByUnit === 'bulk' 
    ? quantity * data.conversionFactor 
    : quantity;
  
  // Calculate bulk quantity from pieces
  const bulkQuantity = data.trackByUnit === 'piece' 
    ? Math.floor(quantity / data.conversionFactor)
    : quantity;
  
  const remainingPieces = data.trackByUnit === 'piece'
    ? quantity % data.conversionFactor
    : 0;

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
            type="number"
            min="1"
            placeholder="مثال: 20 قطعة في الكرتونة"
            value={data.conversionFactor || ''}
            onChange={(e) => onChange({ conversionFactor: Math.max(1, Number(e.target.value)) })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            1 {data.bulkUnit || 'كرتونة'} = {data.conversionFactor || 1} {data.smallUnit || 'قطعة'}
          </p>
        </div>
        
        {/* Bulk Cost Price */}
        <div>
          <Label className="text-sm font-medium mb-1.5 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            سعر تكلفة {data.bulkUnit || 'الكرتونة'}
          </Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={data.bulkCostPrice || ''}
            onChange={(e) => onChange({ bulkCostPrice: Number(e.target.value) })}
          />
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
          <span className="text-sm">تتبع المخزون بـ:</span>
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
      
      {/* Stock Summary */}
      {quantity > 0 && (
        <div className="bg-primary/10 rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">إجمالي المخزون:</span>
            <span className="font-semibold text-foreground">
              {data.trackByUnit === 'bulk' ? (
                <>
                  {quantity} {data.bulkUnit || 'كرتونة'} = {totalPieces} {data.smallUnit || 'قطعة'}
                </>
              ) : (
                <>
                  {quantity} {data.smallUnit || 'قطعة'} = {bulkQuantity} {data.bulkUnit || 'كرتونة'}
                  {remainingPieces > 0 && ` + ${remainingPieces} ${data.smallUnit || 'قطعة'}`}
                </>
              )}
            </span>
          </div>
        </div>
      )}
      
      {/* Pricing Summary */}
      {data.bulkCostPrice > 0 && data.conversionFactor > 1 && (
        <div className="bg-success/10 rounded-lg p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">تكلفة القطعة الواحدة:</span>
            <span className="font-semibold text-foreground">
              ${(data.bulkCostPrice / data.conversionFactor).toFixed(2)}
            </span>
          </div>
          {data.bulkSalePrice > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">سعر بيع القطعة من الكرتونة:</span>
                <span className="font-semibold text-foreground">
                  ${(data.bulkSalePrice / data.conversionFactor).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-success/20 pt-1 mt-1">
                <span className="text-muted-foreground">ربح الكرتونة:</span>
                <span className="font-semibold text-success">
                  ${(data.bulkSalePrice - data.bulkCostPrice).toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
