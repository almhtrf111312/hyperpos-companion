/**
 * Privacy Policy & Disclaimer Screen - Full page, shown once on first launch
 * User must scroll to bottom before checkbox is enabled, then check to enable button
 * Supports Arabic, English, Turkish, Persian, and Kurdish with instant switching & RTL/LTR adaptivity
 */
import { useState, useRef, useCallback } from 'react';
import { Shield, Check, ArrowDown, CheckCircle2, Globe } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/use-language';
import { Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';

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
      <p>يمنحك المطور ترخيصًا شخصيًا، محدودًا، غير حصري، وغير قابل للتحويل لاستخدام البرنامج لأغراضك المحاسبية والبيعية الداخلية فقط. لا يجوز لك إعادة ترخيص، بيع، تأجير، تعديل، توزيع، أو إنشاء أعمال مشتقة من البرنامج.</p>

      <h3>3. مسؤوليات المستخدم</h3>
      <p><strong>أ. دقة البيانات:</strong> أنت المسؤول الوحيد عن دقة وصحة واكتمال جميع البيانات والمعلومات التي تقوم بإدخالها أو معالجتها أو تخزينها في البرنامج. لا يتحمل المطور أي مسؤولية عن أي أخطاء أو عدم دقة في البيانات المدخلة من قبلك.</p>
      <p><strong>ب. النسخ الاحتياطي:</strong> تقع على عاتقك مسؤولية إجراء نسخ احتياطي منتظم لجميع بياناتك المخزنة في البرنامج. لا يتحمل المطور أي مسؤولية عن فقدان البيانات أو تلفها لأي سبب من الأسباب.</p>
      <p><strong>ج. الاستخدام القانوني:</strong> تلتزم باستخدام البرنامج بما يتوافق مع جميع القوانين واللوائح المعمول بها، بما في ذلك قوانين الضرائب والتجارة والمحاسبة.</p>
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
      <p>تخضع هذه الشروط وتفسر وفقًا للقوانين المعمول بها في النطاق القضائي التابع للمطور، ويتم الفصل في أي نزاع أمام المحاكم المختصة قانوناً.</p>

      <h3>10. أحكام عامة</h3>
      <p>إذا تم اعتبار أي بند من هذه الشروط غير صالح أو غير قابل للتنفيذ من قبل محكمة ذات اختصاص قضائي، فستظل البنود المتبقية سارية المفعول والتأثير الكامل.</p>

      <h3>للتواصل:</h3>
      <p>إذا كان لديك أي أسئلة حول شروط الاستخدام وإخلاء المسؤولية هذه، يرجى التواصل معنا عبر قنوات الدعم الرسمية للتطبيق.</p>
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
      <p>The developer grants you a personal, limited, non-exclusive, and non-transferable license to use the Software for your internal accounting and retail sales operations only. You may not sublicense, sell, lease, modify, distribute, or create derivative works from the Software.</p>

      <h3>3. User Responsibilities</h3>
      <p><strong>a. Data Accuracy:</strong> You are solely responsible for the accuracy, correctness, and completeness of all data and information you enter, process, or store in the Software. The developer assumes no responsibility for any errors or inaccuracies in data entered by you.</p>
      <p><strong>b. Backups:</strong> It is your responsibility to perform regular backups of all your data stored in the Software. The developer assumes no responsibility for data loss or corruption for any reason.</p>
      <p><strong>c. Legal Use:</strong> You agree to use the Software in compliance with all applicable laws and regulations, including tax, commerce, and accounting laws.</p>
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
      <p>These terms shall be governed by and construed in accordance with applicable laws, and any disputes shall be resolved in the competent courts having jurisdiction.</p>

      <h3>10. General Provisions</h3>
      <p>If any provision of these terms is found to be invalid or unenforceable by a court of competent jurisdiction, the remaining provisions shall remain in full force and effect.</p>

      <h3>Contact:</h3>
      <p>If you have any questions about these Terms of Use and Disclaimer, please contact us through the app's official support channels.</p>
    </>
  );
}

function TurkishTerms() {
  return (
    <>
      <p className="text-muted-foreground">Son güncelleme tarihi: 15 Şubat 2026</p>
      <p>Flow POS Pro (bundan böyle "Yazılım" olarak anılacaktır) uygulamasını kullanmadan önce lütfen bu Kullanım Şartları ve Sorumluluk Reddini dikkatlice okuyunuz. Yazılımı kullanmanız, bu şart ve koşullarla bağlı olmayı kabul ettiğiniz anlamına gelir. Bu şartları kabul etmiyorsanız, Yazılımı kullanma yetkiniz yoktur.</p>

      <h3>1. Şartların Kabulü</h3>
      <p>Flow POS Pro uygulamasını kullanarak, bu sözleşmede belirtilen tüm şart ve koşulları okuduğunuzu, anladığınızı ve bunlara uymayı kabul ettiğinizi beyan edersiniz. Yazılımı bir tüzel kişilik veya şirket adına kullanıyorsanız, o tüzel kişiliği bu sözleşmeyle bağlama yetkisine sahip yetkili bir temsilci olduğunuzu beyan ve taahhüt edersiniz.</p>

      <h3>2. Kullanım Lisansı</h3>
      <p>Geliştirici, Yazılımı yalnızca dahili muhasebe ve satış işlemleriniz için kullanmanız üzere size kişisel, sınırlı, münhasır olmayan ve devredilemez bir lisans vermektedir. Yazılımı alt lisanslayamaz, satamaz, kiralayamaz, değiştiremez, dağıtamaz veya türev çalışmalarını oluşturamazsınız.</p>

      <h3>3. Kullanıcı Sorumlulukları</h3>
      <p><strong>a. Veri Doğruluğu:</strong> Yazılıma girdiğiniz, işlediğiniz veya depoladığınız tüm verilerin doğruluğu, eksiksizliği ve geçerliliğinden yalnızca siz sorumlusunuz. Geliştirici, tarafınızca girilen verilerdeki hiçbir hata veya yanlışlıktan sorumlu tutulamaz.</p>
      <p><strong>b. Yedekleme:</strong> Yazılımda saklanan tüm verilerinizin düzenli yedeklerini almak sizin sorumluluğunuzdadır. Geliştirici, herhangi bir nedenle oluşabilecek veri kaybı veya bozulmasından dolayı sorumluluk kabul etmez.</p>
      <p><strong>c. Yasal Kullanım:</strong> Yazılımı vergi, ticaret ve muhasebe mevzuatı dahil olmak üzere geçerli tüm yasa ve yönetmeliklere uygun olarak kullanmayı kabul edersiniz.</p>
      <p><strong>d. Giriş Güvenliği:</strong> Giriş bilgilerinizin (kullanıcı adı ve şifre) gizliliğini korumaktan ve hesabınız üzerinden gerçekleştirilen tüm faaliyetlerden siz sorumlusunuz.</p>

      <h3>4. Garanti Reddi</h3>
      <p>Yazılım, açık veya zımni hiçbir garanti olmaksızın "OLDUĞU GİBİ" ve "MEVCUT OLDUĞU ŞEKİLDE" sağlanmaktadır. Geliştirici, yasaların izin verdiği azami ölçüde, ticarete elverişlilik, belirli bir amaca uygunluk ve ihlal etmeme dahil tüm zımni garantileri reddeder.</p>
      <p>Geliştirici, Yazılımın kesintisiz veya hatasız çalışacağını, kusurların düzeltileceğini veya Yazılımın ve barındırıldığı sunucuların virüs veya zararlı bileşenlerden arınmış olduğunu garanti etmez. Yazılımın kullanımından ve elde edilen sonuçlardan doğan tüm sorumluluk size aittir.</p>

      <h3>5. Sorumluluğun Sınırlandırılması</h3>
      <p>Geliştirici, kâr kaybı, veri kaybı, kullanım kaybı veya itibar kaybı dahil olmak üzere doğrudan, dolaylı, arızi, özel veya cezai hiçbir zarardan hiçbir koşulda sorumlu tutulamaz.</p>

      <h3>6. Tazminat</h3>
      <p>Yazılımı kullanımınızdan doğabilecek her türlü talep, yükümlülük, zarar ve masrafa karşı geliştiriciyi, bağlı kuruluşlarını ve çalışanlarını tazmin etmeyi ve muaf tutmayı kabul edersiniz.</p>

      <h3>7. Fikri Mülkiyet</h3>
      <p>Telif hakları, ticari markalar ve ticari sırlar dahil olmak üzere Yazılımdaki tüm fikri mülkiyet hakları geliştiriciye aittir. Bu sözleşme size Yazılım üzerinde herhangi bir mülkiyet hakkı vermez, yalnızca belirtilen şartlar dahilinde sınırlı bir kullanım lisansı verir.</p>

      <h3>8. Şartlarda Değişiklik</h3>
      <p>Geliştirici bu şartları dilediği zaman güncelleme hakkını saklı tutar. Değişiklikler yayınlandıktan sonra Yazılımı kullanmaya devam etmeniz, güncellenmiş şartları kabul ettiğiniz anlamına gelir.</p>

      <h3>9. Geçerli Hukuk ve Yetki</h3>
      <p>Bu şartlar geliştiricinin tabi olduğu yargı alanının yasalarına göre yönetilir ve yorumlanır. Ortaya çıkabilecek uyuşmazlıklarda yetkili mahkemelerin münhasır yargı yetkisini kabul edersiniz.</p>

      <h3>10. Genel Hükümler</h3>
      <p>Bu şartların herhangi bir hükmü geçersiz sayılırsa, kalan hükümler tam olarak yürürlükte kalmaya devam edecektir.</p>

      <h3>İletişim:</h3>
      <p>Kullanım şartları ve sorumluluk reddi hakkında herhangi bir sorunuz varsa, lütfen uygulamanın resmi destek kanalları üzerinden bizimle iletişime geçin.</p>
    </>
  );
}

function PersianTerms() {
  return (
    <>
      <p className="text-muted-foreground">تاریخ آخرین به‌روزرسانی: ۱۵ فوریه ۲۰۲۶</p>
      <p>لطفاً پیش از استفاده از نرم‌افزار Flow POS Pro (که از این پس «نرم‌افزار» نامیده می‌شود)، این شرایط استفاده و سلب مسئولیت را با دقت مطالعه فرمایید. استفاده شما از نرم‌افزار به منزله پذیرش و تعهد کامل به رعایت کلیه مفاد و قوانین مندرج در این موافقت‌نامه است. در صورت عدم موافقت با این شرایط، مجاز به استفاده از نرم‌افزار نمی‌باشید.</p>

      <h3>۱. پذیرش شرایط</h3>
      <p>با استفاده از نرم‌افزار Flow POS Pro، شما تأیید و اقرار می‌نمایید که کلیه شرایط و ضوابط این موافقت‌نامه را مطالعه کرده، فهمیده و با آن موافقت نموده‌اید. چنانچه به نمایندگی از یک شرکت، فروشگاه یا شخصیت حقوقی از نرم‌افزار استفاده می‌کنید، تضمین می‌نمایید که نماینده قانونی دارای اختیار لازم جهت متعهد ساختن آن مجموعه به این شروط هستید.</p>

      <h3>۲. مجوز استفاده</h3>
      <p>توسعه‌دهنده به شما مجوزی شخصی، محدود، غیرانحصاری و غیرقابل انتقال جهت استفاده از نرم‌افزار صرفاً برای مقاصد حسابداری و مدیریت فروش داخلی اعطا می‌نماید. شما حق واگذاری مجوز، فروش، اجاره، مهندسی معکوس، تغییر، توزیع یا ایجاد نسخه‌های اشتقاقی از نرم‌افزار را نخواهید داشت.</p>

      <h3>۳. مسئولیت‌های کاربر</h3>
      <p><strong>الف. صحت اطلاعات:</strong> مسئولیت کامل صحت، دقت و کامل بودن کلیه اطلاعات، فاکتورها و داده‌هایی که در نرم‌افزار وارد، پردازش یا ذخیره می‌نمایید، بر عهده شماست. توسعه‌دهنده هیچ‌گونه مسئولیتی در قبال خطاهای ناشی از داده‌های نادرست وارد شده توسط کاربر نمی‌پذیرد.</p>
      <p><strong>ب. پشتیبان‌گیری منظم:</strong> مسئولیت تهیه مداوم نسخه‌های پشتیبان از داده‌های ذخیره‌شده بر عهده کاربر است. توسعه‌دهنده در قبال از دست رفتن اطلاعات به هر علتی مسئولیتی نخواهد داشت.</p>
      <p><strong>ج. استفاده قانونی:</strong> شما متعهد می‌شوید که از نرم‌افزار منطبق بر تمامی قوانین مالیاتی، صنفی و تجاری جاری استفاده نمایید.</p>
      <p><strong>د. امنیت حساب:</strong> حفظ محرمانگی نام کاربری و رمزهای عبور و همچنین کلیه اقدامات انجام‌شده از طریق حساب شما بر عهده خود شماست.</p>

      <h3>۴. سلب مسئولیت از ضمانت‌ها</h3>
      <p>این نرم‌افزار «به همان شکلی که هست» و «بر اساس دسترسی موجود» بدون هیچ‌گونه ضمانت صریح یا ضمنی ارائه می‌گردد. توسعه‌دهنده در حدود قانون از هرگونه ضمانت تجاری، تناسب برای مقاصد خاص یا عدم نقض حقوق، سلب مسئولیت می‌نماید.</p>
      <p>توسعه‌دهنده تضمین نمی‌کند که عملکرد برنامه همواره بدون وقفه یا عاری از خطا باشد. مسئولیت کامل انتخاب نرم‌افزار جهت نیل به اهداف تجاری و نتایج حاصل از آن بر عهده کاربر است.</p>

      <h3>۵. محدودیت مسئولیت</h3>
      <p>توسعه‌دهنده تحت هیچ شرایطی در قبال خسارات مستقیم، غیرمستقیم، اتفاقی، خاص یا تبعی از جمله از دست دادن سود، از دست رفتن داده‌ها، وقفه در کسب‌وکار یا سایر زیان‌های مادی و معنوی مسئولیتی نخواهد داشت.</p>

      <h3>۶. جبران خسارت</h3>
      <p>شما موافقت می‌نمایید که توسعه‌دهنده و همکاران وی را در برابر هرگونه ادعا، خسارت، هزینه و مسئولیت ناشی از استفاده نادرست یا نقض این شروط مصون نگه دارید.</p>

      <h3>۷. حقوق مالکیت معنوی</h3>
      <p>کلیه حقوق مالکیت فکری نرم‌افزار از جمله حق نشر، علائم تجاری و کدهای منبع متعلق به توسعه‌دهنده است و این موافقت‌نامه هیچ حق مالکیتی به کاربر واگذار نمی‌کند.</p>

      <h3>۸. تغییر در شرایط</h3>
      <p>توسعه‌دهنده این حق را برای خود محفوظ می‌دارد که در هر زمان این شرایط را به‌روزرسانی نماید. ادامه استفاده از نرم‌افزار پس از اعمال تغییرات، به منزله پذیرش شرایط جدید است.</p>

      <h3>۹. قانون حاکم</h3>
      <p>این شرایط بر اساس قوانین حاکم بر حوزه قضایی توسعه‌دهنده تفسیر و اجرا خواهد شد و مراجع ذی‌صلاح قانونی مرجع رسیدگی به اختلافات احتمالی خواهند بود.</p>

      <h3>۱۰. احکام عمومی</h3>
      <p>چنانچه بندی از این شروط غیرقابل اجرا تشخیص داده شود، سایر مفاد با قوت و اعتبار کامل به قوت خود باقی خواهند ماند.</p>

      <h3>ارتباط با ما:</h3>
      <p>در صورت وجود هرگونه سؤال درباره شرایط استفاده و سلب مسئولیت، می‌توانید از طریق راه‌های ارتباطی رسمی پشتیبانی با ما تماس حاصل فرمایید.</p>
    </>
  );
}

function KurdishTerms() {
  return (
    <>
      <p className="text-muted-foreground">ڕێکەوتی دوایین نوێکردنەوە: ١٥ی شوباتی ٢٠٢٦</p>
      <p>تکایە پێش بەکارهێنانی بەرنامەی Flow POS Pro (لەمەودوا پێی دەوترێت "بەرنامەکە")، ئەم مەرجانەی بەکارهێنان و ڕەتکردنەوەی بەرپرسیارێتییە بە وردی بخوێنەرەوە. بەکارهێنانی بەرنامەکە لەلایەن تۆوە بە واتای ڕەزامەندی تەواوە لەسەر پابەندبوون بەم مەرج و ڕێسایانە. ئەگەر بەم مەرجانە ڕازی نیت، مافی بەکارهێنانی بەرنامەکەت نییە.</p>

      <h3>١. قبوڵکردنی مەرجەکان</h3>
      <p>بە بەکارهێنانی Flow POS Pro، تۆ دان بەوەدا دەنێیت کە هەموو مەرج و ڕێساکانی ناو ئەم ڕێککەوتننامەیەت خوێندووەتەوە، تێگەیشتوویت و ڕازیت پێیان. ئەگەر بە ناوی کۆمپانیا یان لایەنێکەوە بەکاری دەهێنیت، دەبێت نوێنەری یاسایی و خاوەن دەسەڵاتی ئەو لایەنە بیت.</p>

      <h3>٢. مۆڵەتی بەکارهێنان</h3>
      <p>گەشەپێدەر مۆڵەتێکی کەسی، سنووردار، ناتایبەت و نەگوێزراوەت پێدەدات بۆ بەکارهێنانی بەرنامەکە تەنها بۆ مەبەستەکانی ژمێریاری و فرۆشتنی ناوخۆیی خۆت. بۆت نییە مۆڵەتەکە بفرۆشیتەوە، بەکرێی بدەیت، دەستکاری بکەیت، یان دابەشی بکەیت.</p>

      <h3>٣. بەرپرسیارێتییەکانی بەکارهێنەر</h3>
      <p><strong>أ. دروستی داتا:</strong> تۆ بەرپرسیاری تەواوی لە دروستی، ڕاستی و تەواوی ئەو داتا و زانیارییانەی کە تۆماریان دەکەیت لە بەرنامەکەدا. گەشەپێدەر هیچ بەرپرسیارێتییەک لە ئەستۆ ناگرێت لە بەرامبەر هەر هەڵەیەک لەو داتایانەی کە داخڵت کردوون.</p>
      <p><strong>ب. کۆپی یەدەگ (Backup):</strong> ئەوە ئەرکی تۆیە کە بە شێوەیەکی بەردەوام کۆپی یەدەگ لە داتاکانت وەربگریت. گەشەپێدەر بەرپرسیار نییە لە لەدەستچوونی داتاکان بە هەر هۆکارێک بێت.</p>
      <p><strong>ج. بەکارهێنانی یاسایی:</strong> تۆ پابەندیت کە بەرنامەکە بەپێی یاسا و ڕێساکانی باج و بازرگانی بەکاربهێنیت.</p>
      <p><strong>د. پاراستنی هەژمار:</strong> تۆ بەرپرسیاری لە پاراستنی نهێنی ناوی بەکارهێنەر و وشەی تێپەڕەکەت و هەموو ئەو چالاکییانەی لە ڕێگەی هەژمارەکەتەوە ئەنجام دەدرێن.</p>

      <h3>٤. ڕەتکردنەوەی گەرەنتییەکان</h3>
      <p>بەرنامەکە "وەک ئەوەی هەیە" و "بەپێی بەردەستبوون" دابین دەکرێت، بەبێ هیچ گەرەنتییەکی ڕوون یان ناڕوون. گەشەپێدەر بەرپرسیارێتی لە گەرەنتی کارکردنی بێ کێشە یان بێ وەستان هەڵناگرێت.</p>

      <h3>٥. سنووردارکردنی بەرپرسیارێتی</h3>
      <p>گەشەپێدەر لە ژێر هیچ بارودۆخێکدا بەرپرسیار نابێت لە هەر زیانێکی ڕاستەوخۆ، ناڕاستەوخۆ، لەدەستچوونی قازانج، یان لەدەستچوونی داتا بەهۆی بەکارهێنانی بەرنامەکەوە.</p>

      <h3>٦. قەرەبووکردنەوە</h3>
      <p>تۆ ڕازیت کە گەشەپێدەر و تیمەکەی بپارێزیت لە هەر داواکاری و زیانێک کە بەهۆی بەکارهێنانی نادروستی بەرنامەکەوە دروست دەبێت.</p>

      <h3>٧. مافی خاوەندارێتی هزری</h3>
      <p>هەموو مافەکانی خاوەندارێتی هزری بەرنامەکە، لەوانە کۆد، دیزاین و نیشانە بازرگانییەکان، موڵکی گەشەپێدەرە و ئەم ڕێککەوتننامەیە هیچ مافێکی خاوەندارێتیت پێ نادات جگە لە مۆڵەتی بەکارهێنان.</p>

      <h3>٨. گۆڕانکاری لە مەرجەکاندا</h3>
      <p>گەشەپێدەر مافی ئەوەی هەیە لە هەر کاتێکدا ئەم مەرجانە نوێ بکاتەوە. بەردەوامبوونت لە بەکارهێنانی بەرنامەکە دوای گۆڕانکارییەکان، بە واتای قبوڵکردنی مەرجە نوێیەکان دێت.</p>

      <h3>٩. یاسای حاکم</h3>
      <p>ئەم مەرجانە بەپێی یاساکانی دادگای تایبەتمەند لێکدەدرێنەوە و هەر ناکۆکییەک لە دادگای پەیوەندیدار یەکلا دەکرێتەوە.</p>

      <h3>١٠. بڕگەی گشتی</h3>
      <p>ئەگەر هەر بڕگەیەک لەم مەرجانە بە نادروست دابنرێت، بڕگەکانی دیکە بە تەواوی کاریگەری خۆیان دەمێننەوە.</p>

      <h3>پەیوەندی:</h3>
      <p>ئەگەر هەر پرسیارێکت هەیە دەربارەی مەرجەکانی بەکارهێنان، تکایە لە ڕێگەی کەناڵە فەرمییەکانی پشتیوانی پەیوەندیمان پێوە بکە.</p>
    </>
  );
}

const AVAILABLE_LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
  { code: 'ku', label: 'کوردی', flag: '☀️' },
];

export function PrivacyPolicyScreen({ onAccept }: { onAccept: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const { t, isRTL, language, setLanguage } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Check if scrolled near bottom (within 40px)
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setScrolledToBottom(true);
    }
  }, []);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth'
      });
      // Small timeout to guarantee scrolledToBottom activates smoothly
      setTimeout(() => setScrolledToBottom(true), 350);
    }
  };

  const renderTerms = () => {
    switch (language) {
      case 'en':
        return <EnglishTerms />;
      case 'tr':
        return <TurkishTerms />;
      case 'fa':
        return <PersianTerms />;
      case 'ku':
        return <KurdishTerms />;
      case 'ar':
      default:
        return <ArabicTerms />;
    }
  };

  const subtitleText = {
    ar: 'يرجى قراءة شروط الاستخدام وإخلاء المسؤولية للمتابعة واستخدام التطبيق',
    en: 'Please review the terms of service and disclaimer to proceed',
    tr: 'Devam etmek ve uygulamayı kullanmak için lütfen kullanım şartlarını ve sorumluluk reddini inceleyin',
    fa: 'لطفاً شرایط استفاده و سلب مسئولیت را برای ادامه و استفاده از برنامه مطالعه فرمایید',
    ku: 'تکایە مەرجەکانی بەکارهێنان و ڕەتکردنەوەی بەرپرسیارێتی بخوێنەرەوە بۆ بەردەوامبوون'
  }[language] || 'يرجى قراءة شروط الاستخدام وإخلاء المسؤولية للمتابعة واستخدام التطبيق';

  const scrollDownText = {
    ar: 'انزل للأسفل لقراءة الشروط وتفعيل خيار الموافقة ⬇',
    en: 'Scroll down to read terms and enable agreement ⬇',
    tr: 'Şartları okumak ve onay seçeneğini etkinleştirmek için aşağı kaydırın ⬇',
    fa: 'برای مطالعه شرایط و فعال‌سازی گزینه موافقت به پایین بروید ⬇',
    ku: 'بڕۆ خوارەوە بۆ خوێندنەوەی مەرجەکان و چالاککردنی بژاردەی ڕەزامەندی ⬇'
  }[language] || 'انزل للأسفل لقراءة الشروط وتفعيل خيار الموافقة ⬇';

  const readCompleteText = {
    ar: 'تمت قراءة الشروط بنجاح — يمكنك الآن تأكيد الموافقة أدناه',
    en: 'Terms read — you may now confirm agreement below',
    tr: 'Şartlar okundu — şimdi aşağıdan onayı tamamlayabilirsiniz',
    fa: 'شرایط مطالعه شد — اکنون می‌توانید موافقت خود را در زیر تأیید کنید',
    ku: 'مەرجەکان خوێندرانەوە — ئێستا دەتوانیت لە خوارەوە ڕەزامەندی پەسەند بکەیت'
  }[language] || 'تمت قراءة الشروط بنجاح — يمكنك الآن تأكيد الموافقة أدناه';

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-3 sm:p-4"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ backgroundColor: '#ffffff', color: '#1a1a2e' }}
    >
      <div className="w-full max-w-2xl flex flex-col items-center gap-2.5 sm:gap-3.5 h-full max-h-[100dvh] py-2 sm:py-3">
        {/* Top Language Quick Selector Toolbar */}
        <div className="flex-shrink-0 flex items-center justify-center gap-1.5 p-1 bg-blue-50/90 rounded-2xl border border-blue-200/80 shadow-sm max-w-full overflow-x-auto">
          <div className="flex items-center gap-1 px-1.5 text-blue-700 text-xs font-semibold shrink-0">
            <Globe className="w-3.5 h-3.5" />
          </div>
          {AVAILABLE_LANGUAGES.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                setLanguage(item.code);
              }}
              className={cn(
                "px-2.5 py-1 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 flex items-center gap-1",
                language === item.code
                  ? "bg-blue-600 text-white shadow-sm scale-105"
                  : "text-blue-900/70 hover:text-blue-950 hover:bg-blue-100/70"
              )}
            >
              <span>{item.flag}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Header with circular icon badge */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1.5 text-center">
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0 aspect-square border border-blue-200 shadow-sm"
            style={{
              backgroundColor: '#eff6ff',
              width: '48px',
              height: '48px',
              minWidth: '48px',
              minHeight: '48px',
              aspectRatio: '1 / 1'
            }}
          >
            <Shield className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" style={{ color: '#2563eb' }} />
          </div>
          <h1 className="text-base sm:text-xl font-bold" style={{ color: '#1e3a8a' }}>
            {t('privacy.title')}
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground max-w-md px-2">
            {subtitleText}
          </p>
        </div>

        {/* Scrollable Terms Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 w-full overflow-y-auto rounded-xl p-3 sm:p-4 text-xs sm:text-sm shadow-inner"
          dir={isRTL ? 'rtl' : 'ltr'}
          style={{ border: '1px solid #bfdbfe', backgroundColor: '#f8faff' }}
        >
          <div
            className={`prose prose-sm max-w-none leading-relaxed space-y-3 sm:space-y-4 ${isRTL ? 'pr-1.5 text-right' : 'pl-1.5 text-left'}`}
            style={{ color: '#1e3a8a' }}
          >
            {renderTerms()}
          </div>
        </div>

        {/* Bouncing Scroll Down Indicator Bar */}
        {!scrolledToBottom ? (
          <button
            type="button"
            onClick={scrollToBottom}
            className="w-full flex-shrink-0 flex items-center justify-center gap-2 py-2 px-4 rounded-xl shadow-sm cursor-pointer transition-all duration-300 hover:opacity-95 active:scale-[0.99] border border-blue-300"
            style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white shrink-0 animate-bounce">
              <ArrowDown className="w-3 h-3" />
            </span>
            <span className="text-xs sm:text-sm font-semibold">
              {scrollDownText}
            </span>
          </button>
        ) : (
          <div
            className="w-full flex-shrink-0 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border border-green-200 text-xs font-medium text-green-700 animate-in fade-in duration-300"
            style={{ backgroundColor: '#f0fdf4' }}
          >
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span>
              {readCompleteText}
            </span>
          </div>
        )}

        {/* Checkbox Card */}
        <div
          onClick={() => {
            if (!scrolledToBottom) {
              scrollToBottom();
            } else {
              setAgreed(!agreed);
            }
          }}
          className={`flex items-center gap-3 w-full flex-shrink-0 p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${
            !scrolledToBottom
              ? 'opacity-50 border-gray-200 bg-gray-50'
              : agreed
              ? 'border-blue-500 bg-blue-50/60 shadow-sm'
              : 'border-blue-200 bg-white hover:border-blue-400'
          }`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <Checkbox
            id="terms-agree"
            checked={agreed}
            onCheckedChange={(checked) => {
              if (scrolledToBottom) setAgreed(checked === true);
            }}
            disabled={!scrolledToBottom}
            className="h-5 w-5 rounded-md data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 shrink-0"
          />
          <Label
            htmlFor="terms-agree"
            className="cursor-pointer text-xs sm:text-sm font-medium select-none flex-1"
            style={{ color: '#1e3a8a' }}
          >
            {t('privacy.agreeCheckbox')}
          </Label>
        </div>

        {/* Continue button */}
        <button
          className="w-full gap-2 flex-shrink-0 transition-all duration-300 flex items-center justify-center py-3 px-6 rounded-xl font-bold text-white shadow-md disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.99] min-h-[46px]"
          style={{ backgroundColor: agreed ? '#2563eb' : '#93c5fd', fontSize: '0.95rem' }}
          disabled={!agreed}
          onClick={onAccept}
        >
          <Check className="w-5 h-5 shrink-0" />
          <span>{t('privacy.continue')}</span>
        </button>
      </div>
    </div>
  );
}
