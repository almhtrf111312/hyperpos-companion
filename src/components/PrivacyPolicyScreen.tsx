/**
 * Privacy Policy & Disclaimer Screen - Shown once on first launch
 */
import { useState } from 'react';
import { Shield, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const isRTL = document.documentElement.dir === 'rtl';

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-7 h-7 text-primary" />
        </div>

        <h1 className="text-xl font-bold text-foreground text-center">
          {isRTL ? 'سياسة الخصوصية وإخلاء المسؤولية' : 'Privacy Policy & Disclaimer'}
        </h1>

        <Tabs defaultValue="privacy" className="w-full" dir={isRTL ? 'rtl' : 'ltr'}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="privacy" className="gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5" />
              {isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </TabsTrigger>
            <TabsTrigger value="disclaimer" className="gap-1.5 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              {isRTL ? 'إخلاء المسؤولية' : 'Disclaimer'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="privacy" className="mt-3">
            <ScrollArea className="h-[45vh] w-full border border-border rounded-xl p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed space-y-4">
                {isRTL ? (
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
                {isRTL ? (
                  <>
                    <h3>إخلاء المسؤولية العام</h3>
                    <p>يُقدَّم تطبيق FlowPOS Pro "كما هو" (AS IS) و"كما هو متاح" (AS AVAILABLE) دون أي ضمانات من أي نوع، سواء كانت صريحة أو ضمنية، بما في ذلك على سبيل المثال لا الحصر ضمانات قابلية التسويق أو الملاءمة لغرض معين أو عدم الانتهاك.</p>

                    <h3>تحديد المسؤولية</h3>
                    <p>لا يتحمل مطوّر التطبيق أو مالكه أو أي من الأطراف المرتبطة به أي مسؤولية قانونية أو مالية تجاه أي أضرار مباشرة أو غير مباشرة أو عرضية أو تبعية أو خاصة أو عقابية ناتجة عن أو مرتبطة باستخدام التطبيق أو عدم القدرة على استخدامه، بما في ذلك ولكن لا يقتصر على:</p>
                    <ul>
                      <li>فقدان البيانات أو تلفها أو عدم دقتها</li>
                      <li>الأخطاء الحسابية أو المالية في العمليات والتقارير</li>
                      <li>أي خسائر مالية أو تجارية ناتجة عن الاعتماد على مخرجات التطبيق</li>
                      <li>انقطاع الخدمة أو توقف التطبيق عن العمل</li>
                      <li>أي اختراق أمني أو وصول غير مصرح به للبيانات</li>
                      <li>عدم التوافق مع الأنظمة الضريبية أو القانونية المحلية</li>
                    </ul>

                    <h3>مسؤولية المستخدم</h3>
                    <p>يتحمل المستخدم المسؤولية الكاملة والحصرية عن:</p>
                    <ul>
                      <li>التحقق من صحة ودقة جميع البيانات المُدخلة والمخرجات الناتجة</li>
                      <li>إجراء النسخ الاحتياطي الدوري لبياناته وحفظها في مكان آمن</li>
                      <li>الامتثال للقوانين واللوائح المحلية المتعلقة بالمحاسبة والضرائب والتجارة</li>
                      <li>الحفاظ على أمان بيانات تسجيل الدخول وعدم مشاركتها</li>
                      <li>مراجعة جميع الفواتير والتقارير المالية قبل اعتمادها</li>
                    </ul>

                    <h3>الاستخدام المهني</h3>
                    <p>هذا التطبيق أداة مساعدة وليس بديلاً عن المشورة المحاسبية أو القانونية المتخصصة. يُنصح بشدة باستشارة محاسب قانوني أو مستشار مالي معتمد للتأكد من دقة السجلات والامتثال للأنظمة المعمول بها.</p>

                    <h3>التعديلات والتحديثات</h3>
                    <p>يحتفظ المطوّر بالحق في تعديل أو تحديث أو إيقاف التطبيق أو أي من ميزاته في أي وقت ودون إشعار مسبق. لا يُعتبر ذلك إخلالاً بأي التزام تجاه المستخدم.</p>

                    <h3>القوة القاهرة</h3>
                    <p>لا يتحمل المطوّر أي مسؤولية عن أي تأخير أو فشل في الأداء ناتج عن ظروف خارجة عن السيطرة المعقولة، بما في ذلك الكوارث الطبيعية أو انقطاع الإنترنت أو أعطال الخوادم أو الهجمات الإلكترونية.</p>

                    <h3>الموافقة</h3>
                    <p className="font-semibold text-warning">باستخدامك لهذا التطبيق، فإنك تُقرّ بأنك قد قرأت وفهمت جميع بنود إخلاء المسؤولية أعلاه وتوافق عليها بالكامل. إذا كنت لا توافق على أي من هذه البنود، يُرجى عدم استخدام التطبيق.</p>
                  </>
                ) : (
                  <>
                    <h3>General Disclaimer</h3>
                    <p>FlowPOS Pro is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>

                    <h3>Limitation of Liability</h3>
                    <p>The developer, owner, or any associated parties shall not be held legally or financially liable for any direct, indirect, incidental, consequential, special, or punitive damages arising from or related to the use or inability to use the application, including but not limited to:</p>
                    <ul>
                      <li>Loss, corruption, or inaccuracy of data</li>
                      <li>Computational or financial errors in operations and reports</li>
                      <li>Any financial or business losses resulting from reliance on the app's output</li>
                      <li>Service interruption or application downtime</li>
                      <li>Any security breach or unauthorized access to data</li>
                      <li>Non-compliance with local tax or legal regulations</li>
                    </ul>

                    <h3>User Responsibility</h3>
                    <p>The user assumes full and exclusive responsibility for:</p>
                    <ul>
                      <li>Verifying the accuracy of all input data and generated outputs</li>
                      <li>Performing regular data backups and storing them securely</li>
                      <li>Complying with local accounting, tax, and trade laws and regulations</li>
                      <li>Maintaining the security of login credentials</li>
                      <li>Reviewing all invoices and financial reports before approval</li>
                    </ul>

                    <h3>Professional Use</h3>
                    <p>This application is a support tool and not a substitute for professional accounting or legal advice. It is strongly recommended to consult a certified accountant or financial advisor to ensure record accuracy and regulatory compliance.</p>

                    <h3>Modifications and Updates</h3>
                    <p>The developer reserves the right to modify, update, or discontinue the application or any of its features at any time without prior notice. This shall not constitute a breach of any obligation to the user.</p>

                    <h3>Force Majeure</h3>
                    <p>The developer shall not be liable for any delay or failure in performance resulting from circumstances beyond reasonable control, including natural disasters, internet outages, server failures, or cyberattacks.</p>

                    <h3>Consent</h3>
                    <p className="font-semibold text-warning">By using this application, you acknowledge that you have read, understood, and fully agree to all the disclaimer terms above. If you do not agree to any of these terms, please do not use the application.</p>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Button
          size="lg"
          className="w-full gap-2"
          onClick={onAccept}
        >
          <Check className="w-5 h-5" />
          {isRTL ? 'أوافق على سياسة الخصوصية وإخلاء المسؤولية' : 'I Accept the Privacy Policy & Disclaimer'}
        </Button>
      </div>
    </div>
  );
}
