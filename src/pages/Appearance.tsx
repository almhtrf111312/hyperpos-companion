import { useState } from 'react';
import { Palette, Type, Maximize2, LayoutGrid, Save, Undo2, Loader2, Sparkles } from 'lucide-react';
import { ThemeSection, PendingTheme } from '@/components/settings/ThemeSection';
import { UIScaleSelector } from '@/components/settings/UIScaleSelector';
import { FontSelector } from '@/components/settings/FontSelector';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/hooks/use-toast';

type AppearanceTab = 'theme' | 'fonts' | 'scale' | 'layout';

export default function Appearance() {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<AppearanceTab>('theme');
  const { setFullTheme } = useTheme();

  const [pendingTheme, setPendingTheme] = useState<PendingTheme | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [dashboardDesign, setDashboardDesign] = useState<'classic' | 'unified_pro'>(() => {
    return (localStorage.getItem('hyperpos_dashboard_design_v1') as any) || 'classic';
  });

  const handleDesignChange = (design: 'classic' | 'unified_pro') => {
    setDashboardDesign(design);
    localStorage.setItem('hyperpos_dashboard_design_v1', design);
    window.dispatchEvent(new Event('hyperpos:design-changed'));
    toast({ title: t('common.saved'), description: isRTL ? 'تم تغيير نمط التصميم بنجاح' : 'Layout updated' });
  };

  const handleSaveTheme = async () => {
    if (!pendingTheme) return;
    setIsSaving(true);
    try {
      setFullTheme(pendingTheme.mode, pendingTheme.color, pendingTheme.blur, pendingTheme.transparency);
      setPendingTheme(null);
      toast({ title: t('common.saved'), description: isRTL ? 'تم حفظ السمة بنجاح' : 'Theme saved' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-3 md:p-6 max-w-2xl mx-auto pb-24 pt-14 md:pt-4 space-y-4">
      {/* 4 تبويبات رئيسية جنباً إلى جنب */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-muted/60 rounded-2xl border border-border/50">
        <button
          type="button"
          onClick={() => setActiveTab('theme')}
          className={cn(
            "flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-bold transition-all",
            activeTab === 'theme' ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>السمة والألوان</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fonts')}
          className={cn(
            "flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-bold transition-all",
            activeTab === 'fonts' ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Type className="w-3.5 h-3.5" />
          <span>الخطوط</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scale')}
          className={cn(
            "flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-bold transition-all",
            activeTab === 'scale' ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>الحجم</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('layout')}
          className={cn(
            "flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-bold transition-all",
            activeTab === 'layout' ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>المظهر العام</span>
        </button>
      </div>

      {/* محتوى التبويب النشط فقط */}
      <div className="bg-card/40 rounded-2xl p-4 border border-border/60">
        {activeTab === 'theme' && (
          <ThemeSection
            onPendingChange={(pending, changed) => setPendingTheme(changed ? pending : null)}
          />
        )}

        {activeTab === 'fonts' && <FontSelector />}

        {activeTab === 'scale' && <UIScaleSelector />}

        {activeTab === 'layout' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">نمط لوحة التحكم والتقارير</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDesignChange('classic')}
                className={cn(
                  "p-3 rounded-xl border text-right transition-all",
                  dashboardDesign === 'classic' ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-card"
                )}
              >
                <div className="font-bold text-xs text-foreground">الافتراضي (Classic)</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">البطاقات القياسية</div>
              </button>

              <button
                type="button"
                onClick={() => handleDesignChange('unified_pro')}
                className={cn(
                  "p-3 rounded-xl border text-right transition-all",
                  dashboardDesign === 'unified_pro' ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-card"
                )}
              >
                <div className="font-bold text-xs text-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  الموحد (Pro)
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">الرسوم البيانية الموحدة</div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* زر الحفظ العائم للسمة فقط عند تغييرها */}
      {pendingTheme && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
          <Button
            onClick={handleSaveTheme}
            disabled={isSaving}
            className="rounded-full shadow-lg h-12 px-6 gap-2 bg-primary text-primary-foreground"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>حفظ السمة</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => setPendingTheme(null)}
            className="rounded-full shadow-md h-12 w-12 p-0"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
