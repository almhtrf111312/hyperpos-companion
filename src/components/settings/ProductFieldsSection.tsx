import { useState, useEffect } from 'react';
import { Settings2, Package, RotateCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/use-language';
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
  const { t } = useLanguage();
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

  useEffect(() => {
    if (pendingConfig) {
      setConfig(pendingConfig);
    }
  }, [pendingConfig]);

  const handleToggle = (field: keyof ProductFieldsConfig) => {
    const newConfig = { ...config, [field]: !config[field] };
    setConfig(newConfig);
    if (onConfigChange) { onConfigChange(newConfig); }
  };

  const handleReset = async () => {
    const defaults = getDefaultFieldsByStoreType(storeType as StoreType);
    setConfig(defaults);
    if (onConfigChange) { onConfigChange(defaults); }
    else { await saveProductFieldsConfig(defaults); }
    toast.success(t('productFields.resetSuccess'));
  };

  const defaults = getDefaultFieldsByStoreType(storeType as StoreType);
  const fields = (Object.keys(FIELD_LABELS) as Array<keyof ProductFieldsConfig>)
    .filter(field => defaults[field]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 pb-4 border-b border-border">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 ml-2" />
          {t('productFields.resetDefault')}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Package className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">{t('productFields.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('productFields.description')}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs sm:text-sm text-muted-foreground">
            {t('productFields.autoNote')} ({getStoreTypeName(storeType, t)})
          </span>
        </div>

        {fields.length > 0 ? (
          <div className="space-y-2">
            {fields.map((field) => (
              <div
                key={field}
                onClick={() => handleToggle(field)}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/50 transition-colors cursor-pointer select-none"
              >
                <div className="flex-1 min-w-0 text-start">
                  <p className="text-sm font-semibold text-foreground">{FIELD_LABELS[field].name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{FIELD_LABELS[field].description}</p>
                </div>
                <div className="shrink-0 ms-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={config[field]}
                    onCheckedChange={() => handleToggle(field)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-xl">
            لا توجد حقول إضافية لهذا النوع من المتاجر
          </p>
        )}
      </div>

      <Separator className="my-6" />
      <CustomFieldsManager />
    </div>
  );
}

function getStoreTypeName(type: string, t: (key: any) => string): string {
  const names: Record<string, string> = {
    phones: t('productFields.storeType.phones'),
    grocery: t('productFields.storeType.grocery'),
    pharmacy: t('productFields.storeType.pharmacy'),
    clothing: t('productFields.storeType.clothing'),
    restaurant: t('productFields.storeType.restaurant'),
    repair: t('productFields.storeType.repair'),
    bookstore: t('productFields.storeType.bookstore'),
    general: t('productFields.storeType.general'),
    custom: t('productFields.storeType.custom'),
  };
  return names[type] || t('productFields.storeType.general');
}
