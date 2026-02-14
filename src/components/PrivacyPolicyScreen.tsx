/**
 * Privacy Policy & Disclaimer Screen - Shown once on first launch
 */
import { useState } from 'react';
import { Shield, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/hooks/use-language';

const PRIVACY_KEY = 'hyperpos_privacy_accepted';

export function usePrivacyAccepted() {
  const [accepted, setAccepted] = useState(() => {
    return localStorage.getItem(PRIVACY_KEY) === 'true';
  });

  const accept = () => {
    localStorage.setItem(PRIVACY_KEY, 'true');
    setAccepted(true);
  };

  return { accepted, accept };
}

export function PrivacyPolicyScreen({ onAccept }: { onAccept: () => void }) {
  const { t, isRTL, language } = useLanguage();

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-7 h-7 text-primary" />
        </div>

        <h1 className="text-xl font-bold text-foreground text-center">
          {t('privacy.title')}
        </h1>

        <Tabs defaultValue="privacy" className="w-full" dir={isRTL ? 'rtl' : 'ltr'}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="privacy" className="gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5" />
              {t('privacy.privacyTab')}
            </TabsTrigger>
            <TabsTrigger value="disclaimer" className="gap-1.5 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              {t('privacy.disclaimerTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="privacy" className="mt-3">
            <ScrollArea className="h-[45vh] w-full border border-border rounded-xl p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed space-y-4">
                {(language === 'ar' || language === 'fa' || language === 'ku') ? (
                  <>
                    <h3>جمع البيانات</h3>
                    <p>يقوم FlowPOS Pro بتخزين بيانات المتجر والمنتجات والعملاء والفواتير والديون محلياً على جهازك. لا يتم مشاركة بياناتك مع أي طرف ثالث.</p>
                    <h3>التخزين المحلي</h3>
                    <p>يتم حفظ جميع البيانات على جهازك باستخدام التخزين المحلي (localStorage) وقاعدة البيانات المفهرسة (IndexedDB). يمكنك حذف بياناتك في أي وقت من الإعدادات.</p>
                    <h3>المزامنة السحابية</h3>
                    <p>عند تفعيل المزامنة، يتم تشفير بياناتك ونقلها بشكل آمن إلى خوادمنا السحابية لضمان الوصول من أجهزة متعددة والنسخ الاحتياطي.</p>
                    <h3>النسخ الاحتياطي التلقائي</h3>
                    <p>يقوم التطبيق بإنشاء نسخ احتياطية محلية تلقائياً بعد كل عملية لحماية بياناتك. يتم تخزين آخر 5 نسخ فقط.</p>
                    <h3>الأذونات المطلوبة</h3>
                    <ul>
                      <li><strong>الكاميرا:</strong> لمسح الباركود</li>
                      <li><strong>التخزين:</strong> لحفظ النسخ الاحتياطية والملفات المصدرة</li>
                    </ul>
                    <h3>حقوقك</h3>
                    <p>يمكنك في أي وقت حذف جميع بياناتك من خلال إعدادات التطبيق أو حذف التطبيق من جهازك.</p>
                  </>
                ) : (
                  <>
                    <h3>Data Collection</h3>
                    <p>FlowPOS Pro stores your store, product, customer, invoice, and debt data locally on your device. Your data is not shared with any third party.</p>
                    <h3>Local Storage</h3>
                    <p>All data is saved on your device using localStorage and IndexedDB. You can delete your data at any time from Settings.</p>
                    <h3>Cloud Sync</h3>
                    <p>When sync is enabled, your data is encrypted and securely transferred to our cloud servers for multi-device access and backup.</p>
                    <h3>Automatic Backups</h3>
                    <p>The app automatically creates local backups after every operation to protect your data. Only the last 5 backups are retained.</p>
                    <h3>Required Permissions</h3>
                    <ul>
                      <li><strong>Camera:</strong> For barcode scanning</li>
                      <li><strong>Storage:</strong> For saving backups and exported files</li>
                    </ul>
                    <h3>Your Rights</h3>
                    <p>You can delete all your data at any time through the app settings or by uninstalling the app.</p>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="disclaimer" className="mt-3">
            <ScrollArea className="h-[45vh] w-full border border-border rounded-xl p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed space-y-4">
                {(language === 'ar' || language === 'fa' || language === 'ku') ? (
                  <>
                    <h3>إخلاء المسؤولية العام</h3>
                    <p>يُقدَّم تطبيق FlowPOS Pro "كما هو" (AS IS) و"كما هو متاح" (AS AVAILABLE) دون أي ضمانات من أي نوع.</p>
                    <h3>تحديد المسؤولية</h3>
                    <p>لا يتحمل مطوّر التطبيق أو مالكه أي مسؤولية قانونية أو مالية تجاه أي أضرار ناتجة عن استخدام التطبيق.</p>
                    <h3>مسؤولية المستخدم</h3>
                    <p>يتحمل المستخدم المسؤولية الكاملة عن التحقق من صحة البيانات وإجراء النسخ الاحتياطي الدوري.</p>
                    <h3>الموافقة</h3>
                    <p className="font-semibold text-warning">باستخدامك لهذا التطبيق، فإنك تُقرّ بأنك قد قرأت وفهمت جميع بنود إخلاء المسؤولية وتوافق عليها بالكامل.</p>
                  </>
                ) : (
                  <>
                    <h3>General Disclaimer</h3>
                    <p>FlowPOS Pro is provided "AS IS" and "AS AVAILABLE" without warranties of any kind.</p>
                    <h3>Limitation of Liability</h3>
                    <p>The developer shall not be held liable for any damages arising from the use of the application.</p>
                    <h3>User Responsibility</h3>
                    <p>The user assumes full responsibility for verifying data accuracy and performing regular backups.</p>
                    <h3>Consent</h3>
                    <p className="font-semibold text-warning">By using this application, you acknowledge that you have read, understood, and fully agree to all disclaimer terms.</p>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Button size="lg" className="w-full gap-2" onClick={onAccept}>
          <Check className="w-5 h-5" />
          {t('privacy.accept')}
        </Button>
      </div>
    </div>
  );
}
