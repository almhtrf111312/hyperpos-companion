import { useState, useEffect } from 'react';
import { Settings2, Package, Save, RotateCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ProductFieldsConfig,
  loadProductFieldsConfig,
  saveProductFieldsConfig,
  getDefaultFieldsByStoreType,
  FIELD_LABELS,
  StoreType,
} from '@/lib/product-fields-config';

interface ProductFieldsSectionProps {
  storeType: string;
}

export function ProductFieldsSection({ storeType }: ProductFieldsSectionProps) {
  const [config, setConfig] = useState<ProductFieldsConfig>(() => {
    const userConfig = loadProductFieldsConfig();
    if (userConfig) return userConfig;
    return getDefaultFieldsByStoreType(storeType as StoreType);
  });
  
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Check if user has custom config, otherwise use store type defaults
    const userConfig = loadProductFieldsConfig();
    if (!userConfig) {
      setConfig(getDefaultFieldsByStoreType(storeType as StoreType));
    }
  }, [storeType]);

  const handleToggle = (field: keyof ProductFieldsConfig) => {
    setConfig(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const success = saveProductFieldsConfig(config);
    if (success) {
      toast.success('تم حفظ إعدادات الحقول');
      setHasChanges(false);
    } else {
      toast.error('فشل في حفظ الإعدادات');
    }
  };

  const handleReset = () => {
    const defaults = getDefaultFieldsByStoreType(storeType as StoreType);
    setConfig(defaults);
    saveProductFieldsConfig(defaults);
    setHasChanges(false);
    toast.success('تم استعادة الإعدادات الافتراضية');
  };

  const fields = Object.keys(FIELD_LABELS) as Array<keyof ProductFieldsConfig>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">إدارة حقول المنتجات</h3>
            <p className="text-sm text-muted-foreground">
              تخصيص الحقول الظاهرة في نموذج إضافة/تعديل المنتج
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 ml-2" />
            استعادة الافتراضي
          </Button>
          {hasChanges && (
            <Button size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 ml-2" />
              حفظ
            </Button>
          )}
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            يتم تحديد الحقول الافتراضية تلقائياً بناءً على نوع نشاطك ({getStoreTypeName(storeType)})
          </span>
        </div>
        
        <div className="grid gap-4">
          {fields.map((field) => (
            <div
              key={field}
              className="flex items-center justify-between p-3 bg-card rounded-lg border border-border/50"
            >
              <div className="flex-1">
                <div className="font-medium text-foreground">
                  {FIELD_LABELS[field].name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {FIELD_LABELS[field].description}
                </div>
              </div>
              <Switch
                checked={config[field]}
                onCheckedChange={() => handleToggle(field)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getStoreTypeName(type: string): string {
  const names: Record<string, string> = {
    phones: 'هواتف وإلكترونيات',
    grocery: 'بقالة ومواد غذائية',
    pharmacy: 'صيدلية',
    clothing: 'ملابس وأزياء',
    restaurant: 'مطعم',
    repair: 'ورشة صيانة',
    bookstore: 'مكتبة',
    general: 'متجر عام',
    custom: 'مخصص',
  };
  return names[type] || 'متجر عام';
}
