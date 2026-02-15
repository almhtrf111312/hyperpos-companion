/**
 * Privacy Policy & Disclaimer Screen - Shown once on first launch
 */
import { useState } from 'react';
import { Shield, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg flex flex-col items-center gap-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-7 h-7 text-primary" />
        </div>

        <h1 className="text-xl font-bold text-foreground text-center">
          شروط الاستخدام والخصوصية
        </h1>

        {/* Big button to open terms dialog */}
        <Button
          variant="outline"
          size="lg"
          className="w-full h-14 text-base gap-2"
          onClick={() => setDialogOpen(true)}
        >
          <Shield className="w-5 h-5" />
          شروط الاستخدام وإخلاء المسؤولية
        </Button>

        {/* Terms Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-center">
                شروط الاستخدام وإخلاء المسؤولية لبرنامج Flow POS Pro
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh] w-full border border-border rounded-xl p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed space-y-4 pr-2" dir="rtl">
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
                <p>لن يكون المطور، تحت أي ظرف من الظروف، مسؤولاً عن أي أضرار مباشرة أو غير مباشرة أو عرضية أو خاصة أو تبعية أو تأديبية، بما في ذلك على سبيل المثال لا الحصر، الأضرار الناجمة عن خسارة الأرباح، أو البيانات، أو الاستخدام، أو الشهرة، أو غيرها من الخسائر غير الملموسة، الناتجة عن (أ) استخدام أو عدم القدرة على استخدام البرنامج؛ (ب) أي سلوك أو محتوى لأي طرف ثالث على البرنامج؛ (ج) أي محتوى تم الحصول عليه من البرنامج؛ و (د) الوصول غير المصرح به أو استخدام أو تغيير عمليات الإرسال أو المحتوى الخاص بك، سواء كان ذلك بناءً على ضمان، أو عقد، أو ضرر (بما في ذلك الإهمال) أو أي نظرية قانونية أخرى، سواء تم إبلاغ المطور باحتمالية حدوث مثل هذه الأضرار أم لا، وحتى إذا تبين أن العلاج المنصوص عليه هنا قد فشل في غرضه الأساسي.</p>

                <h3>6. التعويض</h3>
                <p>أنت توافق على تعويض وحماية المطور والشركات التابعة له والمسؤولين والوكلاء والموظفين من وضد أي وجميع المطالبات والمسؤوليات والأضرار والخسائر والتكاليف والنفقات، بما في ذلك أتعاب المحاماة المعقولة، الناشئة عن أو المتعلقة بـ (أ) استخدامك للبرنامج؛ (ب) خرقك لهذه الشروط؛ (ج) انتهاكك لأي حقوق لطرف ثالث، بما في ذلك على سبيل المثال لا الحصر، أي حقوق ملكية فكرية أو خصوصية؛ أو (د) أي مطالبة بأن بياناتك تسببت في ضرر لطرف ثالث.</p>

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
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Checkbox for agreement */}
        <div className="flex items-center gap-3 w-full" dir="rtl">
          <Checkbox
            id="terms-agree"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
          />
          <Label htmlFor="terms-agree" className="cursor-pointer text-sm">
            الموافقة على الشروط والأحكام
          </Label>
        </div>

        {/* Continue button */}
        <Button
          size="lg"
          className="w-full gap-2"
          disabled={!agreed}
          onClick={onAccept}
        >
          <Check className="w-5 h-5" />
          متابعة
        </Button>
      </div>
    </div>
  );
}
