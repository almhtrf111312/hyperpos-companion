import { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, MessageCircle, ChevronDown, ChevronUp, Send, Bot, User, 
  Barcode, Package, FileText, Shield, Warehouse, Users, CreditCard, 
  BarChart3, Receipt, Wrench, HelpCircle, Sparkles, ArrowRight
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/hooks/use-language';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface FeatureItem {
  icon: React.ElementType;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

const features: FeatureItem[] = [
  { icon: Barcode, titleAr: 'باركود متعدد', titleEn: 'Multi-Barcode', descAr: 'دعم حتى 3 باركودات لكل منتج لتسهيل الجرد والبيع', descEn: 'Support up to 3 barcodes per product for easy inventory and sales' },
  { icon: Package, titleAr: 'نظام الأصناف المرن', titleEn: 'Flexible Variants', descAr: 'إضافة خيارات متعددة (حجم، لون، نوع) بأسعار وكميات مختلفة', descEn: 'Add multiple options (size, color, type) with different prices and quantities' },
  { icon: Warehouse, titleAr: 'مستودعات متعددة', titleEn: 'Multi-Warehouse', descAr: 'إدارة مخازن رئيسية ومخازن موزعين مع تحويل العهدة', descEn: 'Manage main warehouses and distributor stores with stock transfers' },
  { icon: BarChart3, titleAr: 'تقارير ذكية', titleEn: 'Smart Reports', descAr: 'تقارير جرد ومبيعات وأرباح تفصيلية مع فلترة متقدمة', descEn: 'Detailed inventory, sales, and profit reports with advanced filtering' },
  { icon: Shield, titleAr: 'أمان البيانات', titleEn: 'Data Security', descAr: 'نسخ احتياطي محلي وسحابي مع تشفير وربط بالجهاز', descEn: 'Local and cloud backup with encryption and device binding' },
  { icon: Users, titleAr: 'إدارة العملاء', titleEn: 'Customer Management', descAr: 'سجل عملاء متكامل مع تتبع المشتريات والديون', descEn: 'Complete customer records with purchase and debt tracking' },
  { icon: CreditCard, titleAr: 'نظام الديون', titleEn: 'Debt System', descAr: 'تسجيل ديون نقدية وآجلة مع تتبع الأقساط والتنبيهات', descEn: 'Cash and credit debts with installment tracking and alerts' },
  { icon: Receipt, titleAr: 'الفوترة', titleEn: 'Invoicing', descAr: 'فواتير بيع وشراء مع طباعة ومشاركة عبر واتساب', descEn: 'Sales and purchase invoices with print and WhatsApp sharing' },
  { icon: Wrench, titleAr: 'خدمات الصيانة', titleEn: 'Maintenance', descAr: 'تسجيل ومتابعة أوامر الصيانة وحساب الأرباح', descEn: 'Track maintenance orders and calculate profits' },
  { icon: FileText, titleAr: 'وحدات مزدوجة', titleEn: 'Dual Units', descAr: 'دعم وحدات القياس المتعددة (قطعة، كرتونة، كيلو، متر)', descEn: 'Support multiple units (piece, carton, kilo, meter)' },
];

const faqsAr: FAQItem[] = [
  { question: 'كيف أضيف منتج بباركودات متعددة؟', answer: 'من صفحة المنتجات، أضف منتج جديد واملأ حقل الباركود الأساسي، ثم أضف باركود 2 و3 في الحقول الإضافية. يمكن البحث بأي منها في نقطة البيع.' },
  { question: 'كيف أفرّق بين أصناف نفس المنتج؟', answer: 'استخدم حقل "المتغير/الوصف" لتمييز كل صنف (مثل: حجم كبير، لون أحمر). عند مسح باركود مشترك، ستظهر نافذة اختيار الصنف مع السعر والكمية.' },
  { question: 'كيف أصدّر تقارير المبيعات؟', answer: 'من صفحة التقارير، اختر نوع التقرير وحدد الفترة الزمنية، ثم اضغط "تصدير" لتحميل التقرير بصيغة Excel أو PDF.' },
  { question: 'كيف أضمن سلامة النسخة الاحتياطية؟', answer: 'من الإعدادات > النسخ الاحتياطي، فعّل النسخ التلقائي السحابي. يتم تشفير البيانات قبل الرفع. يمكنك أيضاً عمل نسخة محلية.' },
  { question: 'كيف أدير مستودعات متعددة؟', answer: 'من صفحة المستودعات، أضف مستودعات رئيسية ومخازن موزعين. استخدم "تحويل العهدة" لنقل البضاعة بين المخازن مع إيصال استلام.' },
  { question: 'كيف أسجّل دين على عميل؟', answer: 'عند البيع في نقطة البيع، اختر "دفع آجل" وأدخل بيانات العميل. أو من صفحة الديون، أضف "دين نقدي" بدون فاتورة.' },
  { question: 'كيف أغيّر لغة التطبيق؟', answer: 'من الإعدادات > اللغة، اختر بين العربية والإنجليزية. سيتم تغيير اتجاه الواجهة تلقائياً.' },
  { question: 'ما الفرق بين المشرف والكاشير؟', answer: 'المشرف يملك صلاحيات كاملة (منتجات، تقارير، إعدادات). الكاشير يقتصر على نقطة البيع والفواتير والعملاء.' },
];

const faqsEn: FAQItem[] = [
  { question: 'How do I add a product with multiple barcodes?', answer: 'From Products page, add a new product and fill the main barcode field, then add barcode 2 and 3 in the additional fields. You can search by any of them in POS.' },
  { question: 'How do I differentiate variants of the same product?', answer: 'Use the "Variant/Description" field to distinguish each variant (e.g., large size, red color). When scanning a shared barcode, a variant picker will appear with price and quantity.' },
  { question: 'How do I export sales reports?', answer: 'From Reports page, choose the report type and select the date range, then click "Export" to download as Excel or PDF.' },
  { question: 'How do I ensure backup safety?', answer: 'From Settings > Backup, enable automatic cloud backup. Data is encrypted before upload. You can also create a local backup.' },
  { question: 'How do I manage multiple warehouses?', answer: 'From Warehouses page, add main warehouses and distributor stores. Use "Stock Transfer" to move goods between warehouses with a receipt.' },
  { question: 'How do I record a customer debt?', answer: 'When selling in POS, choose "Credit" payment and enter customer details. Or from Debts page, add a "Cash Debt" without an invoice.' },
  { question: 'How do I change the app language?', answer: 'From Settings > Language, choose between Arabic and English. The interface direction will change automatically.' },
  { question: 'What\'s the difference between Admin and Cashier?', answer: 'Admin has full access (products, reports, settings). Cashier is limited to POS, invoices, and customers.' },
];

export default function HelpPage() {
  const { t, language, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const faqs = isAr ? faqsAr : faqsEn;

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
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/help-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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

  const askFaqInChat = (question: string) => {
    setShowChat(true);
    setInput(question);
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      sendMessage();
    }, 100);
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full">
            <BookOpen className="w-5 h-5" />
            <span className="font-semibold">{isAr ? 'التعليمات والميزات' : 'Help & Features'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {isAr ? 'دليل استخدام FlowPOS Pro' : 'FlowPOS Pro User Guide'}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {isAr ? 'نظام محاسبة شامل لجميع الأنشطة التجارية' : 'Comprehensive accounting system for all business types'}
          </p>
        </div>

        {/* AI Assistant Hint */}
        <Card 
          className="border-primary/20 bg-primary/5 cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => {
            setShowChat(true);
            document.getElementById('ai-chat-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground font-medium">
                {isAr 
                  ? 'لم تجد إجابة لسؤالك؟ اسأل المساعد الذكي مباشرة!' 
                  : "Can't find your answer? Ask the AI Assistant directly!"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr ? 'متاح على مدار الساعة للإجابة على جميع استفساراتك' : 'Available 24/7 to answer all your questions'}
              </p>
            </div>
            <ArrowRight className={cn("w-5 h-5 text-primary flex-shrink-0", isRTL && "rotate-180")} />
          </div>
        </Card>

        {/* Features Grid */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {isAr ? 'ميزات النظام' : 'System Features'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((f, i) => (
              <Card key={i} className="p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{isAr ? f.titleAr : f.titleEn}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{isAr ? f.descAr : f.descEn}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            {isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <Card 
                key={i} 
                className={cn(
                  "cursor-pointer transition-all",
                  expandedFaq === i ? "border-primary/30" : "hover:border-border/80"
                )}
              >
                <button
                  className="w-full p-4 flex items-center justify-between text-start"
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                >
                  <span className="font-medium text-sm text-foreground">{faq.question}</span>
                  {expandedFaq === i ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === i && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 text-primary text-xs"
                      onClick={(e) => { e.stopPropagation(); askFaqInChat(faq.question); }}
                    >
                      <MessageCircle className="w-3 h-3 me-1" />
                      {isAr ? 'اسأل المساعد الذكي' : 'Ask AI Assistant'}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* AI Chat Section */}
        <div id="ai-chat-section">
          <Card className="overflow-hidden">
            <button
              className="w-full p-4 flex items-center justify-between bg-primary/5"
              onClick={() => setShowChat(!showChat)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="text-start">
                  <h3 className="font-semibold text-foreground">{isAr ? 'المساعد الذكي' : 'AI Assistant'}</h3>
                  <p className="text-xs text-muted-foreground">{isAr ? 'اسأل أي سؤال عن النظام' : 'Ask any question about the system'}</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {isAr ? 'ذكاء اصطناعي' : 'AI'}
              </Badge>
            </button>

            {showChat && (
              <div className="border-t border-border">
                {/* Messages */}
                <div ref={scrollRef} className="h-80 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>{isAr ? 'مرحباً! كيف يمكنني مساعدتك؟' : 'Hello! How can I help you?'}</p>
                      <div className="flex flex-wrap gap-2 justify-center mt-4">
                        {[
                          isAr ? 'كيف أضيف منتج جديد؟' : 'How to add a product?',
                          isAr ? 'كيف أطبع فاتورة؟' : 'How to print an invoice?',
                          isAr ? 'ما هي التقارير المتاحة؟' : 'What reports are available?',
                        ].map((q, i) => (
                          <Button 
                            key={i} 
                            variant="outline" 
                            size="sm" 
                            className="text-xs"
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
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                        msg.role === 'user' 
                          ? "bg-primary text-primary-foreground rounded-br-sm" 
                          : "bg-muted text-foreground rounded-bl-sm"
                      )}>
                        {msg.content}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="w-4 h-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="flex gap-2 justify-start">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary animate-pulse" />
                      </div>
                      <div className="bg-muted rounded-2xl px-4 py-3 rounded-bl-sm">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-3 border-t border-border flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={isAr ? 'اكتب سؤالك هنا...' : 'Type your question here...'}
                    disabled={isLoading}
                    className="text-sm"
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={isLoading || !input.trim()} 
                    size="icon"
                    className="flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
