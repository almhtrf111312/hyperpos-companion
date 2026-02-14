import { useState, useEffect } from 'react';
import { Settings2, Package, RotateCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ProductFieldsConfig,
  loadProductFieldsConfig,
  saveProductFieldsConfig,
  syncProductFieldsFromCloud,
  getDefaultFieldsByStoreType,
  FIELD_LABELS,
  StoreType,
} from '@/lib/product-fields-config';
import { CustomFieldsManager } from './CustomFieldsManager';

interface ProductFieldsSectionProps {
  storeType: string;
  onConfigChange?: (config: ProductFieldsConfig) => void;
  pendingConfig?: ProductFieldsConfig | null;
}

export function ProductFieldsSection({ storeType, onConfigChange, pendingConfig }: ProductFieldsSectionProps) {
  const [config, setConfig] = useState<ProductFieldsConfig>(() => {
    const userConfig = loadProductFieldsConfig();
    if (userConfig) return userConfig;
    return getDefaultFieldsByStoreType(storeType as StoreType);
  });

  useEffect(() => {
    const syncFromCloud = async () => {
      const cloudConfig = await syncProductFieldsFromCloud();
      if (cloudConfig) {
        setConfig(cloudConfig);
      } else {
        const userConfig = loadProductFieldsConfig();
        if (!userConfig) {
          setConfig(getDefaultFieldsByStoreType(storeType as StoreType));
        }
      }
    };
    syncFromCloud();
  }, [storeType]);

  // Sync with pending config from parent (for revert)
  useEffect(() => {
    if (pendingConfig) {
      setConfig(pendingConfig);
    }
  }, [pendingConfig]);

  const handleToggle = (field: keyof ProductFieldsConfig) => {
    const newConfig = {
      ...config,
      [field]: !config[field],
    };
    setConfig(newConfig);
    // Notify parent instead of saving directly
    if (onConfigChange) {
      onConfigChange(newConfig);
    }
  };

  const handleReset = async () => {
    const defaults = getDefaultFieldsByStoreType(storeType as StoreType);
    setConfig(defaults);
    if (onConfigChange) {
      onConfigChange(defaults);
    } else {
      await saveProductFieldsConfig(defaults);
    }
    toast.success('تم استعادة الإعدادات الافتراضية');
  };

  const fields = Object.keys(FIELD_LABELS) as Array<keyof ProductFieldsConfig>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 pb-4 border-b border-border">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 ml-2" />
          استعادة الافتراضي
        </Button>
      </div>

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

      <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            يتم تحديد الحقول الافتراضية تلقائياً بناءً على نوع نشاطك ({getStoreTypeName(storeType)})
          </span>
        </div>

        <div className="space-y-1">
          {fields.map((field) => (
            <div
              key={field}
              className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">
                  {FIELD_LABELS[field].name}
                </span>
                <span className="text-xs text-muted-foreground mr-2">
                  — {FIELD_LABELS[field].description}
                </span>
              </div>
              <Switch
                checked={config[field]}
                onCheckedChange={() => handleToggle(field)}
                className="flex-shrink-0"
              />
            </div>
          ))}
        </div>
      </div>

      <Separator className="my-6" />

      <CustomFieldsManager />
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
