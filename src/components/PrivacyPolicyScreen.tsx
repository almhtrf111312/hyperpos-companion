/**
 * Privacy Policy & Disclaimer Screen - Full page, shown once on first launch
 * User must scroll to bottom before checkbox is enabled, then check to enable button
 */
import { useState, useRef, useCallback } from 'react';
import { Shield, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/use-language';

const PRIVACY_KEY = 'hyperpos_privacy_accepted';
// Version 2: terms shown directly without button (v1 had a button)
const PRIVACY_VERSION = '2';
const PRIVACY_VERSION_KEY = 'hyperpos_privacy_version';

export function usePrivacyAccepted() {
  const [accepted, setAccepted] = useState(() => {
    const wasAccepted = localStorage.getItem(PRIVACY_KEY) === 'true';
    const savedVersion = localStorage.getItem(PRIVACY_VERSION_KEY) || '1';
    // Force re-acceptance if privacy screen version changed
    return wasAccepted && savedVersion === PRIVACY_VERSION;
  });

  const accept = () => {
    localStorage.setItem(PRIVACY_KEY, 'true');
    localStorage.setItem(PRIVACY_VERSION_KEY, PRIVACY_VERSION);
    setAccepted(true);
  };

  return { accepted, accept };
}

function ArabicTerms() {
  return (
    <>
      <p className="text-muted-foreground">تاريخ آخر تحديث: 15 فبراير 2026</p>
      <p>يرجى قراءة شروط الاستخدام وإخلاء المسؤولية هذه بعناية قبل استخدام برنامج Flow POS Pro (المشار إليه فيما بعد بـ "البرنامج"). يشكل استخدامك للبرنامج موافقة منك على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على هذه الشروط، فلا يحق لك استخدام البرنامج.</p>

      <h3>1. قبول الشروط</h3>
      <p>باستخدامك لبرنامج Flow POS Pro، فإنك تقر وتوافق على أنك قد قرأت وفهمت ووافقت على الالتزام بجميع الشروط والأحكام الواردة في هذه الاتفاقية. إذا كنت تستخدم البرنامج نيابةً عن كيان أو شركة، فإنك تقر وتضمن أنك ممثل مفوض لذلك الكيان وتمتلك السلطة لإلزام الكيان بهذه الاتفاقية.</p>

      <h3>2. ترخيص الاستخدام</h3>
      <p>يمنحك المطور ترخيصًا شخصيًا، محدودًا، غير حصري، وغير قابل للتحويل لاستخدام البرنامج لأغراضك المحاسبية الداخلية فقط. لا يجوز لك إعادة ترخيص، بيع، تأجير، تعديل، توزيع، أو إنشاء أعمال مشتقة من البرنامج.</p>

      <h3>3. مسؤوليات المستخدم</h3>
      <p><strong>أ. دقة البيانات:</strong> أنت المسؤول الوحيد عن دقة وصحة واكتمال جميع البيانات والمعلومات التي تقوم بإدخالها أو معالجتها أو تخزينها في البرنامج. لا يتحمل المطور أي مسؤولية عن أي أخطاء أو عدم دقة في البيانات المدخلة من قبلك.</p>
      <p><strong>ب. النسخ الاحتياطي:</strong> تقع على عاتقك مسؤولية إجراء نسخ احتياطي منتظم لجميع بياناتك المخزنة في البرنامج. لا يتحمل المطور أي مسؤولية عن فقدان البيانات أو تلفها لأي سبب من الأسباب.</p>
      <p><strong>ج. الاستخدام القانوني:</strong> تلتزم باستخدام البرنامج بما يتوافق مع جميع القوانين واللوائح المعمول بها، بما في ذلك قوانين الضرائب والمحاسبة.</p>
      <p><strong>د. أمان الوصول:</strong> أنت مسؤول عن الحفاظ على سرية معلومات تسجيل الدخول الخاصة بك (اسم المستخدم وكلمة المرور) وعن جميع الأنشطة التي تتم من خلال حسابك.</p>

      <h3>4. إخلاء المسؤولية من الضمانات</h3>
      <p>يتم توفير البرنامج "كما هو" و"كما هو متاح"، دون أي ضمانات من أي نوع، سواء كانت صريحة أو ضمنية. يتنصل المطور، إلى أقصى حد يسمح به القانون، من جميع الضمانات، بما في ذلك على سبيل المثال لا الحصر، الضمانات الضمنية لقابلية التسويق، والملاءمة لغرض معين، وعدم الانتهاك.</p>
      <p>لا يضمن المطور أن البرنامج سيعمل دون انقطاع أو خالٍ من الأخطاء، أو أن العيوب سيتم تصحيحها، أو أن البرنامج أو الخوادم التي تستضيفه خالية من الفيروسات أو المكونات الضارة الأخرى. أنت تتحمل المسؤولية الكاملة عن اختيار البرنامج لتحقيق النتائج المرجوة منك، وعن استخدام البرنامج والنتائج التي تحصل عليها منه.</p>

      <h3>5. حدود المسؤولية</h3>
      <p>لن يكون المطور، تحت أي ظرف من الظروف، مسؤولاً عن أي أضرار مباشرة أو غير مباشرة أو عرضية أو خاصة أو تبعية أو تأديبية، بما في ذلك على سبيل المثال لا الحصر، الأضرار الناجمة عن خسارة الأرباح، أو البيانات، أو الاستخدام، أو الشهرة، أو غيرها من الخسائر غير الملموسة.</p>

      <h3>6. التعويض</h3>
      <p>أنت توافق على تعويض وحماية المطور والشركات التابعة له والمسؤولين والوكلاء والموظفين من وضد أي وجميع المطالبات والمسؤوليات والأضرار والخسائر والتكاليف والنفقات، بما في ذلك أتعاب المحاماة المعقولة.</p>

      <h3>7. الملكية الفكرية</h3>
      <p>جميع حقوق الملكية الفكرية في البرنامج، بما في ذلك على سبيل المثال لا الحصر، حقوق الطبع والنشر، وبراءات الاختراع، والعلامات التجارية، والأسرار التجارية، هي ملك للمطور. لا تمنحك هذه الاتفاقية أي حقوق ملكية في البرنامج، بل ترخيصًا محدودًا للاستخدام وفقًا لهذه الشروط.</p>

      <h3>8. التعديلات على الشروط</h3>
      <p>يحتفظ المطور بالحق في تعديل أو تحديث هذه الشروط في أي وقت. سيتم نشر أي تغييرات على هذه الصفحة. يعتبر استمرارك في استخدام البرنامج بعد نشر التغييرات موافقة منك على الشروط المعدلة.</p>

      <h3>9. القانون الحاكم والاختصاص القضائي</h3>
      <p>تخضع هذه الشروط وتفسر وفقًا لقوانين [اسم الدولة/الولاية القضائية التي ينتمي إليها المطور]. أنت توافق بشكل لا رجعه فيه على الاختصاص القضائي الحصري لمحاكم [اسم المدينة/المنطقة] لأي نزاع ينشأ عن أو يتعلق بهذه الشروط أو استخدام البرنامج.</p>

      <h3>10. أحكام عامة</h3>
      <p>إذا تم اعتبار أي بند من هذه الشروط غير صالح أو غير قابل للتنفيذ من قبل محكمة ذات اختصاص قضائي، فسيتم تفسير البنود المتبقية بطريقة تعكس قدر الإمكان نية الأطراف الأصلية، وستظل البنود المتبقية سارية المفعول والتأثير الكامل.</p>

      <h3>للتواصل:</h3>
      <p>إذا كان لديك أي أسئلة حول شروط الاستخدام وإخلاء المسؤولية هذه، يرجى التواصل معنا عبر <strong>werzakaria3472@gmail.com</strong></p>
    </>
  );
}

function EnglishTerms() {
  return (
    <>
      <p className="text-muted-foreground">Last updated: February 15, 2026</p>
      <p>Please read these Terms of Use and Disclaimer carefully before using Flow POS Pro (hereinafter referred to as "the Software"). Your use of the Software constitutes your agreement to be bound by these terms and conditions. If you do not agree to these terms, you are not authorized to use the Software.</p>

      <h3>1. Acceptance of Terms</h3>
      <p>By using Flow POS Pro, you acknowledge and agree that you have read, understood, and agreed to be bound by all terms and conditions set forth in this agreement. If you are using the Software on behalf of an entity or company, you represent and warrant that you are an authorized representative of that entity and have the authority to bind the entity to this agreement.</p>

      <h3>2. License of Use</h3>
      <p>The developer grants you a personal, limited, non-exclusive, and non-transferable license to use the Software for your internal accounting purposes only. You may not sublicense, sell, lease, modify, distribute, or create derivative works from the Software.</p>

      <h3>3. User Responsibilities</h3>
      <p><strong>a. Data Accuracy:</strong> You are solely responsible for the accuracy, correctness, and completeness of all data and information you enter, process, or store in the Software. The developer assumes no responsibility for any errors or inaccuracies in data entered by you.</p>
      <p><strong>b. Backups:</strong> It is your responsibility to perform regular backups of all your data stored in the Software. The developer assumes no responsibility for data loss or corruption for any reason.</p>
      <p><strong>c. Legal Use:</strong> You agree to use the Software in compliance with all applicable laws and regulations, including tax and accounting laws.</p>
      <p><strong>d. Access Security:</strong> You are responsible for maintaining the confidentiality of your login credentials (username and password) and for all activities conducted through your account.</p>

      <h3>4. Disclaimer of Warranties</h3>
      <p>The Software is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, whether express or implied. The developer disclaims, to the fullest extent permitted by law, all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
      <p>The developer does not warrant that the Software will operate without interruption or be error-free, that defects will be corrected, or that the Software or servers hosting it are free of viruses or other harmful components. You assume full responsibility for selecting the Software to achieve your intended results, and for the use of the Software and the results obtained from it.</p>

      <h3>5. Limitation of Liability</h3>
      <p>Under no circumstances shall the developer be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to damages for loss of profits, data, use, goodwill, or other intangible losses.</p>

      <h3>6. Indemnification</h3>
      <p>You agree to indemnify and hold harmless the developer and its affiliates, officers, agents, and employees from and against any and all claims, liabilities, damages, losses, costs, and expenses, including reasonable attorney fees.</p>

      <h3>7. Intellectual Property</h3>
      <p>All intellectual property rights in the Software, including but not limited to copyrights, patents, trademarks, and trade secrets, are the property of the developer. This agreement does not grant you any ownership rights in the Software, only a limited license to use it in accordance with these terms.</p>

      <h3>8. Modifications to Terms</h3>
      <p>The developer reserves the right to modify or update these terms at any time. Any changes will be posted on this page. Your continued use of the Software after the posting of changes constitutes your acceptance of the modified terms.</p>

      <h3>9. Governing Law and Jurisdiction</h3>
      <p>These terms shall be governed by and construed in accordance with the laws of [Developer's Country/Jurisdiction]. You irrevocably consent to the exclusive jurisdiction of the courts of [City/Region] for any dispute arising out of or relating to these terms or the use of the Software.</p>

      <h3>10. General Provisions</h3>
      <p>If any provision of these terms is found to be invalid or unenforceable by a court of competent jurisdiction, the remaining provisions shall be interpreted to reflect the original intent of the parties as closely as possible, and shall remain in full force and effect.</p>

      <h3>Contact:</h3>
      <p>If you have any questions about these Terms of Use and Disclaimer, please contact us at <strong>werzakaria3472@gmail.com</strong></p>
    </>
  );
}

export function PrivacyPolicyScreen({ onAccept }: { onAccept: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const { t, isRTL, language } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isRTLLang = language === 'ar' || language === 'fa' || language === 'ku';

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Check if scrolled near bottom (within 30px)
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
      setScrolledToBottom(true);
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: '#0a0a0a', color: '#fafafa' }}
    >
      <div className="w-full max-w-2xl flex flex-col items-center gap-4 h-full max-h-[100dvh] py-4">
        {/* Header */}
        <div className="flex-shrink-0 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground text-center">
            {t('privacy.title')}
          </h1>
        </div>

        {/* Scrollable Terms Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 w-full overflow-y-auto border border-border rounded-xl p-4"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className={`prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed space-y-4 ${isRTLLang ? 'pr-2' : 'pl-2'}`}>
            {isRTLLang ? <ArabicTerms /> : <EnglishTerms />}
          </div>
        </div>

        {/* Scroll hint */}
        {!scrolledToBottom && (
          <p className="text-xs text-muted-foreground animate-pulse flex-shrink-0">
            {isRTLLang ? '⬇ قم بالتمرير للأسفل لقراءة جميع الشروط' : '⬇ Scroll down to read all terms'}
          </p>
        )}

        {/* Checkbox */}
        <div className="flex items-center gap-3 w-full flex-shrink-0" dir={isRTL ? 'rtl' : 'ltr'}>
          <Checkbox
            id="terms-agree"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            disabled={!scrolledToBottom}
            className={!scrolledToBottom ? 'opacity-40' : ''}
          />
          <Label
            htmlFor="terms-agree"
            className={`cursor-pointer text-sm ${!scrolledToBottom ? 'opacity-40' : ''}`}
          >
            {t('privacy.agreeCheckbox')}
          </Label>
        </div>

        {/* Continue button */}
        <Button
          size="lg"
          className="w-full gap-2 flex-shrink-0 transition-all duration-300"
          disabled={!agreed}
          onClick={onAccept}
        >
          <Check className="w-5 h-5" />
          {t('privacy.continue')}
        </Button>
      </div>
    </div>
  );
}
