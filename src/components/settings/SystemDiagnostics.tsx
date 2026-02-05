import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Trash2,
  Wifi,
  Database,
  Smartphone,
  Wrench,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

interface DiagnosticIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  action?: {
    label: string;
    handler: () => Promise<void>;
  };
  dismissable?: boolean;
}

export function SystemDiagnostics() {
  const [issues, setIssues] = useState<DiagnosticIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setIsScanning(true);
    const foundIssues: DiagnosticIssue[] = [];

    // فحص الاتصال
    try {
      const { error } = await supabase.from('health_check').select('*').limit(1);
      if (error) {
        foundIssues.push({
          id: 'connection',
          type: 'error',
          title: 'مشكلة في الاتصال',
          description: 'لا يمكن الاتصال بقاعدة البيانات',
          action: {
            label: 'إعادة المحاولة',
            handler: async () => {
              await runDiagnostics();
            }
          }
        });
      }
    } catch (e) {
      foundIssues.push({
        id: 'connection',
        type: 'error',
        title: 'غير متصل',
        description: 'التطبيق يعمل في وضع عدم الاتصال',
        action: {
          label: 'فحص الاتصال',
          handler: async () => {
            window.location.reload();
          }
        }
      });
    }

    // فحص التخزين المحلي
    try {
      const localStorageSize = Object.keys(localStorage).reduce((total, key) => {
        return total + (localStorage.getItem(key)?.length || 0);
      }, 0);

      if (localStorageSize > 5 * 1024 * 1024) { // أكثر من 5 ميجا
        foundIssues.push({
          id: 'storage',
          type: 'warning',
          title: 'التخزين المحلي ممتلئ',
          description: `حجم البيانات المحفوظة: ${(localStorageSize / 1024 / 1024).toFixed(2)} ميجابايت`,
          action: {
            label: 'تنظيف الذاكرة',
            handler: async () => {
              // حذف البيانات القديمة
              const keysToRemove = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes('cache')) {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach(key => localStorage.removeItem(key));
              toast({ title: "تم التنظيف", description: `تم حذف ${keysToRemove.length} عنصر` });
              await runDiagnostics();
            }
          },
          dismissable: true
        });
      }
    } catch (e) {
      console.error('Storage check error:', e);
    }

    // فحص المزامنة
    const pendingSync = localStorage.getItem('pending_sync');
    if (pendingSync) {
      const pending = JSON.parse(pendingSync);
      if (pending.length > 0) {
        foundIssues.push({
          id: 'sync',
          type: 'warning',
          title: 'بيانات غير متزامنة',
          description: `${pending.length} عملية في انتظار المزامنة`,
          action: {
            label: 'مزامنة الآن',
            handler: async () => {
              // تنفيذ المزامنة
              toast({ title: "جاري المزامنة...", description: "يرجى الانتظار" });
              // ... منطق المزامنة
            }
          }
        });
      }
    }

    // فحص إصدار التطبيق
    if (Capacitor.isNativePlatform()) {
      const appVersion = localStorage.getItem('app_version');
      // يمكن إضافة فحص للإصدار الأحدث
    }

    // لا توجد مشاكل
    if (foundIssues.length === 0) {
      foundIssues.push({
        id: 'healthy',
        type: 'info',
        title: 'النظام يعمل بكفاءة',
        description: 'لم يتم العثور على مشاكل',
        dismissable: true
      });
    }

    setIssues(foundIssues);
    setIsScanning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const dismissIssue = (id: string) => {
    setIssues(issues.filter(i => i.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'info': return <CheckCircle className="h-5 w-5 text-green-500" />;
      default: return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'default';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            تشخيص النظام
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runDiagnostics}
            disabled={isScanning}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            فحص جديد
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="border rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 flex items-start gap-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
                >
                  {getIcon(issue.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{issue.title}</span>
                      <Badge variant={getBadgeVariant(issue.type) as any}>
                        {issue.type === 'error' ? 'خطأ' :
                          issue.type === 'warning' ? 'تحذير' : 'معلومة'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {issue.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {issue.dismissable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissIssue(issue.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    {expandedIssue === issue.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* أزرار الإجراءات */}
                {expandedIssue === issue.id && issue.action && (
                  <div className="px-4 pb-4 pt-2 bg-muted/30 border-t">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          await issue.action?.handler();
                        }}
                        className="gap-2"
                      >
                        <Wrench className="h-4 w-4" />
                        {issue.action.label}
                      </Button>

                      {issue.dismissable && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => dismissIssue(issue.id)}
                        >
                          تجاهل
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {issues.length === 0 && !isScanning && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>النظام يعمل بكفاءة</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ملخص سريع */}
        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-red-500">
              {issues.filter(i => i.type === 'error').length}
            </p>
            <p className="text-xs text-muted-foreground">أخطاء</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-500">
              {issues.filter(i => i.type === 'warning').length}
            </p>
            <p className="text-xs text-muted-foreground">تحذيرات</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-500">
              {issues.filter(i => i.type === 'info').length}
            </p>
            <p className="text-xs text-muted-foreground">معلومات</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
