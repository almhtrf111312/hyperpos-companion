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
      {/* 4 تبويبات رئيسية في شريط كبسولي مقسم ومتناسق */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-muted/70 dark:bg-zinc-900/80 rounded-2xl border border-border/60 backdrop-blur-xl shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('theme')}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 select-none",
            activeTab === 'theme'
              ? "bg-card text-foreground shadow-sm border border-border/40"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <Palette className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">السمة والألوان</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fonts')}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 select-none",
            activeTab === 'fonts'
              ? "bg-card text-foreground shadow-sm border border-border/40"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <Type className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">الخطوط</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scale')}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 select-none",
            activeTab === 'scale'
              ? "bg-card text-foreground shadow-sm border border-border/40"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <Maximize2 className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">الحجم</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('layout')}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 select-none",
            activeTab === 'layout'
              ? "bg-card text-foreground shadow-sm border border-border/40"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
        >
          <LayoutGrid className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">المظهر العام</span>
        </button>
      </div>

      {/* محتوى التبويب النشط داخل بطاقة موحدة بتشطيب متناسق */}
      <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border/60 shadow-sm transition-all">
        {activeTab === 'theme' && (
          <ThemeSection
            onPendingChange={(pending, changed) => setPendingTheme(changed ? pending : null)}
          />
        )}

        {activeTab === 'fonts' && <FontSelector />}

        {activeTab === 'scale' && <UIScaleSelector />}

        {activeTab === 'layout' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">نمط لوحة التحكم والتقارير</h3>
              <p className="text-xs text-muted-foreground mt-0.5">اختر أسلوب عرض المؤشرات والرسوم البيانية في النظام</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDesignChange('classic')}
                className={cn(
                  "p-4 rounded-2xl border text-right transition-all duration-200 hover:border-primary/40",
                  dashboardDesign === 'classic'
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs"
                    : "border-border/60 bg-muted/20 hover:bg-muted/40"
                )}
              >
                <div className="font-bold text-sm text-foreground">الافتراضي (Classic)</div>
                <div className="text-xs text-muted-foreground mt-1">البطاقات القياسية السريعة والموجزة</div>
              </button>

              <button
                type="button"
                onClick={() => handleDesignChange('unified_pro')}
                className={cn(
                  "p-4 rounded-2xl border text-right transition-all duration-200 hover:border-primary/40",
                  dashboardDesign === 'unified_pro'
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs"
                    : "border-border/60 bg-muted/20 hover:bg-muted/40"
                )}
              >
                <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>الموحد (Pro)</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">الرسوم البيانية التفاعلية الموحدة</div>
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
            className="rounded-full shadow-lg h-11 px-5 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>حفظ السمة</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setPendingTheme(null)}
            className="rounded-full shadow-md h-11 w-11 p-0 border-border/80 bg-background hover:bg-muted"
            title="تراجع"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
