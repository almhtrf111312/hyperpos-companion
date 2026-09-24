import { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, MessageCircle, ChevronDown, ChevronUp, Send, Bot, User, 
  Barcode, Package, FileText, Shield, Warehouse, Users, CreditCard, 
  BarChart3, Receipt, Wrench, HelpCircle, Sparkles, ArrowRight
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/hooks/use-language';
import { useUserRole } from '@/hooks/use-user-role';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface FAQItem {
  question: string;
  answer: string;
  adminOnly?: boolean;
}

interface FeatureItem {
  icon: React.ElementType;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  adminOnly?: boolean;
}

const features: FeatureItem[] = [
  { icon: Barcode, titleAr: 'باركود متعدد', titleEn: 'Multi-Barcode', descAr: 'دعم حتى 3 باركودات لكل منتج لتسهيل الجرد والبيع', descEn: 'Support up to 3 barcodes per product for easy inventory and sales' },
  { icon: Package, titleAr: 'نظام الأصناف المرن', titleEn: 'Flexible Variants', descAr: 'إضافة خيارات متعددة (حجم، لون، نوع) بأسعار وكميات مختلفة', descEn: 'Add multiple options (size, color, type) with different prices and quantities' },
  { icon: Warehouse, titleAr: 'مستودعات متعددة', titleEn: 'Multi-Warehouse', descAr: 'إدارة مخازن رئيسية ومخازن موزعين مع تحويل العهدة', descEn: 'Manage main warehouses and distributor stores with stock transfers', adminOnly: true },
  { icon: BarChart3, titleAr: 'تقارير ذكية', titleEn: 'Smart Reports', descAr: 'تقارير جرد ومبيعات وأرباح تفصيلية مع فلترة متقدمة', descEn: 'Detailed inventory, sales, and profit reports with advanced filtering', adminOnly: true },
  { icon: Shield, titleAr: 'أمان البيانات', titleEn: 'Data Security', descAr: 'نسخ احتياطي محلي وسحابي مع تشفير وربط بالجهاز', descEn: 'Local and cloud backup with encryption and device binding' },
  { icon: Users, titleAr: 'إدارة العملاء', titleEn: 'Customer Management', descAr: 'سجل عملاء متكامل مع تتبع المشتريات والديون', descEn: 'Complete customer records with purchase and debt tracking' },
  { icon: CreditCard, titleAr: 'نظام الديون', titleEn: 'Debt System', descAr: 'تسجيل ديون نقدية وآجلة مع تتبع الأقساط والتنبيهات', descEn: 'Cash and credit debts with installment tracking and alerts' },
  { icon: Receipt, titleAr: 'الفوترة', titleEn: 'Invoicing', descAr: 'فواتير بيع وشراء مع طباعة ومشاركة عبر واتساب', descEn: 'Sales and purchase invoices with print and WhatsApp sharing' },
  { icon: Wrench, titleAr: 'خدمات الصيانة', titleEn: 'Maintenance', descAr: 'تسجيل ومتابعة أوامر الصيانة وحساب الأرباح', descEn: 'Track maintenance orders and calculate profits', adminOnly: true },
  { icon: FileText, titleAr: 'وحدات مزدوجة', titleEn: 'Dual Units', descAr: 'دعم وحدات القياس المتعددة (قطعة، كرتونة، كيلو، متر)', descEn: 'Support multiple units (piece, carton, kilo, meter)' },
];

const faqsAr: FAQItem[] = [
  { question: 'كيف أضيف منتج بباركودات متعددة؟', answer: 'من صفحة المنتجات، أضف منتج جديد واملأ حقل الباركود الأساسي، ثم أضف باركود 2 و3 في الحقول الإضافية. يمكن البحث بأي منها في نقطة البيع.' },
  { question: 'كيف أفرّق بين أصناف نفس المنتج؟', answer: 'استخدم حقل "المتغير/الوصف" لتمييز كل صنف (مثل: حجم كبير، لون أحمر). عند مسح باركود مشترك، ستظهر نافذة اختيار الصنف مع السعر والكمية.' },
  { question: 'كيف أصدّر تقارير المبيعات؟', answer: 'من صفحة التقارير، اختر نوع التقرير وحدد الفترة الزمنية، ثم اضغط "تصدير" لتحميل التقرير بصيغة Excel أو PDF.', adminOnly: true },
  { question: 'كيف أضمن سلامة النسخة الاحتياطية؟', answer: 'من الإعدادات > النسخ الاحتياطي، فعّل النسخ التلقائي السحابي. يتم تشفير البيانات قبل الرفع. يمكنك أيضاً عمل نسخة محلية.' },
  { question: 'كيف أدير مستودعات متعددة؟', answer: 'من صفحة المستودعات، أضف مستودعات رئيسية ومخازن موزعين. استخدم "تحويل العهدة" لنقل البضاعة بين المخازن مع إيصال استلام.', adminOnly: true },
  { question: 'كيف أسجّل دين على عميل؟', answer: 'عند البيع في نقطة البيع، اختر "دفع آجل" وأدخل بيانات العميل. أو من صفحة الديون، أضف "دين نقدي" بدون فاتورة.' },
  { question: 'كيف أغيّر لغة التطبيق؟', answer: 'من الإعدادات > اللغة، اختر بين العربية والإنجليزية. سيتم تغيير اتجاه الواجهة تلقائياً.' },
  { question: 'ما الفرق بين المشرف والكاشير؟', answer: 'المشرف يملك صلاحيات كاملة (منتجات، تقارير، إعدادات). الكاشير يقتصر على نقطة البيع والفواتير والعملاء.' },
];

const faqsEn: FAQItem[] = [
  { question: 'How do I add a product with multiple barcodes?', answer: 'From Products page, add a new product and fill the main barcode field, then add barcode 2 and 3 in the additional fields. You can search by any of them in POS.' },
  { question: 'How do I differentiate variants of the same product?', answer: 'Use the "Variant/Description" field to distinguish each variant (e.g., large size, red color). When scanning a shared barcode, a variant picker will appear with price and quantity.' },
  { question: 'How do I export sales reports?', answer: 'From Reports page, choose the report type and select the date range, then click "Export" to download as Excel or PDF.', adminOnly: true },
  { question: 'How do I ensure backup safety?', answer: 'From Settings > Backup, enable automatic cloud backup. Data is encrypted before upload. You can also create a local backup.' },
  { question: 'How do I manage multiple warehouses?', answer: 'From Warehouses page, add main warehouses and distributor stores. Use "Stock Transfer" to move goods between warehouses with a receipt.', adminOnly: true },
  { question: 'How do I record a customer debt?', answer: 'When selling in POS, choose "Credit" payment and enter customer details. Or from Debts page, add a "Cash Debt" without an invoice.' },
  { question: 'How do I change the app language?', answer: 'From Settings > Language, choose between Arabic and English. The interface direction will change automatically.' },
  { question: 'What\'s the difference between Admin and Cashier?', answer: 'Admin has full access (products, reports, settings). Cashier is limited to POS, invoices, and customers.' },
];

export default function HelpPage() {
  const { t, language, isRTL } = useLanguage();
  const { isOwner } = useUserRole();
  const isAr = language === 'ar';
  const allFaqs = isAr ? faqsAr : faqsEn;
  const faqs = allFaqs.filter(f => !f.adminOnly || isOwner);
  const displayFeatures = features.filter(f => !f.adminOnly || isOwner);

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    
    try {
      // ✅ لا بد من إرسال جلسة المستخدم الحالية وليس المفتاح العام
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('no-session');
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/help-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg], language }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error('Failed to start stream');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error('Help assistant error:', e);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: isAr ? 'عذراً، حدث خطأ. حاول مرة أخرى.' : 'Sorry, an error occurred. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'features' | 'faq' | 'ai'>('features');
  const [faqSearch, setFaqSearch] = useState('');

  const askFaqInChat = (question: string) => {
    setActiveTab('ai');
    setShowChat(true);
    setInput(question);
    setTimeout(() => {
      sendMessage();
    }, 100);
  };

  const filteredFaqs = faqs.filter(f => 
    !faqSearch.trim() || 
    f.question.toLowerCase().includes(faqSearch.toLowerCase()) || 
    f.answer.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4">
        {/* Compact Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-border p-4 md:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-foreground">
                  {isAr ? 'مركز التعليمات والمساعدة' : 'Help & Documentation Center'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {isAr ? 'دليل الاستخدام، الأسئلة الشائعة، والمساعد الذكي' : 'User guide, FAQs, and AI Assistant'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs shrink-0 self-start sm:self-auto gap-1.5"
              onClick={() => {
                try { localStorage.removeItem('hp_onboarding_complete'); } catch {}
                window.dispatchEvent(new CustomEvent('onboarding:replay'));
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>{isAr ? 'إعادة جولة الشرح' : 'Replay tour'}</span>
            </Button>
          </div>
        </div>

        {/* Modern 3-Button Segmented Navigation Tabs */}
        <div className="bg-card p-1 rounded-xl border border-border flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('features')}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 select-none",
              activeTab === 'features'
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? 'ميزات النظام' : 'Features'}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-background/30 text-current">{displayFeatures.length}</Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faq')}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 select-none",
              activeTab === 'faq'
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{isAr ? 'الأسئلة الشائعة' : 'FAQs'}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-background/30 text-current">{faqs.length}</Badge>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('ai'); setShowChat(true); }}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 select-none",
              activeTab === 'ai'
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>{isAr ? 'المساعد الذكي' : 'AI Assistant'}</span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </button>
        </div>

        {/* Tab 1: Features */}
        {activeTab === 'features' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {displayFeatures.map((f, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-3.5 hover:border-primary/40 transition-all hover:shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <f.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-foreground">{isAr ? f.titleAr : f.titleEn}</h3>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{isAr ? f.descAr : f.descEn}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: FAQ */}
        {activeTab === 'faq' && (
          <div className="space-y-3">
            <div className="relative">
              <Input
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                placeholder={isAr ? 'ابحث في الأسئلة الشائعة...' : 'Search FAQs...'}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              {filteredFaqs.map((faq, i) => (
                <div
                  key={i}
                  className={cn(
                    "bg-card rounded-xl border transition-all overflow-hidden",
                    expandedFaq === i ? "border-primary/40 shadow-sm" : "border-border hover:border-border/80"
                  )}
                >
                  <button
                    className="w-full p-3 flex items-center justify-between text-start"
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  >
                    <span className="font-semibold text-xs text-foreground">{faq.question}</span>
                    {expandedFaq === i ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {expandedFaq === i && (
                    <div className="px-3 pb-3 pt-0 border-t border-border/40 mt-1 pt-2">
                      <p className="text-xs text-muted-foreground leading-relaxed">{faq.answer}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-primary text-[11px] h-7 px-2"
                        onClick={(e) => { e.stopPropagation(); askFaqInChat(faq.question); }}
                      >
                        <MessageCircle className="w-3 h-3 me-1" />
                        {isAr ? 'اسأل المساعد الذكي عن هذا' : 'Ask AI Assistant'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {filteredFaqs.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-6">
                  {isAr ? 'لم يتم العثور على نتائج مطابقة' : 'No matching FAQs found'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: AI Assistant */}
        {activeTab === 'ai' && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="p-3 bg-muted/40 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-foreground">{isAr ? 'المساعد الذكي لـ HyperPOS' : 'HyperPOS AI Assistant'}</h3>
                  <p className="text-[10px] text-muted-foreground">{isAr ? 'إجابات فورية مدعومة بالذكاء الاصطناعي' : 'Instant AI-powered answers'}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                Online
              </Badge>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="h-96 overflow-y-auto p-3.5 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-8 space-y-3">
                  <Bot className="w-10 h-10 mx-auto opacity-30 text-primary" />
                  <p>{isAr ? 'مرحباً بك! تفضل بطرح أي سؤال وسأساعدك فوراً.' : 'Hello! Ask me any question and I will help you.'}</p>
                  <div className="flex flex-wrap gap-1.5 justify-center max-w-md mx-auto">
                    {[
                      isAr ? 'كيف أضيف منتج جديد؟' : 'How to add a product?',
                      isAr ? 'كيف أطبع فاتورة بيع؟' : 'How to print an invoice?',
                      isAr ? 'ما هي طريقة جرد المخزون؟' : 'How to do stock audit?',
                      isAr ? 'كيف أسجل ديون العملاء؟' : 'How to record customer debt?',
                    ].map((q, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7 px-2.5 rounded-lg"
                        onClick={() => { setInput(q); }}
                      >
                        {q}
                        <ArrowRight className="w-3 h-3 ms-1" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                    msg.role === 'user'
                      ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                      : "bg-muted text-foreground rounded-bl-sm border border-border/50"
                  )}>
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                      <User className="w-3.5 h-3.5 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary animate-pulse" />
                  </div>
                  <div className="bg-muted rounded-2xl px-3.5 py-2.5 rounded-bl-sm">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-2.5 border-t border-border flex gap-2 bg-muted/20">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={isAr ? 'اكتب سؤالك هنا...' : 'Type your question here...'}
                disabled={isLoading}
                className="text-xs h-9 bg-card"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                size="sm"
                className="h-9 px-3 gap-1 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isAr ? 'إرسال' : 'Send'}</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
