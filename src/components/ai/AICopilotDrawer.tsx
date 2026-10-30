import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';
import { toast } from '@/lib/sonner-bridge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Send,
  Square,
  Trash2,
  Copy,
  Check,
  Bot,
  User,
  Scale,
  TrendingUp,
  PackageSearch,
  DollarSign,
  Maximize2,
  Minimize2,
  X,
  MessageSquare,
  ArrowDownCircle,
  Lock,
  LogIn,
} from 'lucide-react';
import { getActiveShift } from '@/lib/cashbox-store';
import { getEnabledCurrencies } from '@/lib/money-engine';
import { getCurrentStoreType } from '@/lib/store-type-config';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  category?: 'shift_audit' | 'pricing_advisor' | 'inventory_forecast' | 'profit_analysis' | 'general';
  isAuthRequired?: boolean;
}

const STORAGE_KEY = 'flowpos_ai_copilot_messages_v1';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  role: 'assistant',
  content: `مرحباً بك! أنا **FlowPOS Copilot**، مستشارك المحاسبي والإداري الذكي لنظامك المتكامل 🧠

أنا متصل مباشرة ببيانات متجرك اللحظية (الوردية النشطة، حركات الخزينة متعددة العملات، وحالة المخزون والأرباح).

اختر إحدى المهام السريعة بنقرة واحدة، أو اكتب سؤالك المحاسبي مباشرة:
- 🔍 **تدقيق الصندوق والوردية**: فحص المبيعات والمصروفات بالعملات وكشف أي عجز أو فائض.
- 🏷️ **استشارة تسعير وهامش ربح WAC**: تحليل التكلفة المرجحة واقتراح أسعار بيع متوازنة.
- 📦 **رادار تنبؤ نواقص المخزون**: مراقبة الأصناف القريبة من النفاد والتنبؤ بالطلبيات.
- 💰 **تحليل صافي الربح الحقيقي**: التمييز الصارم بين مجمل الربح وصافي الربح بعد المصروفات.`,
  timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
};

function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={index} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-primary font-medium"
          dir="ltr"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  lines.forEach((line, idx) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${idx}`}
            className="p-3 my-2.5 bg-muted/90 rounded-xl text-xs font-mono overflow-x-auto text-foreground border border-border/80 shadow-inner"
            dir="ltr"
          >
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={idx} className="text-sm font-bold text-violet-600 dark:text-violet-400 mt-3 mb-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-3.5 bg-violet-500 rounded-full inline-block" />
          {renderFormattedText(line.replace('### ', ''))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={idx} className="text-base font-bold text-foreground mt-4 mb-2 border-b border-border/50 pb-1.5">
          {renderFormattedText(line.replace('## ', ''))}
        </h3>
      );
      return;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={idx} className="text-lg font-extrabold text-foreground mt-4 mb-2">
          {renderFormattedText(line.replace('# ', ''))}
        </h2>
      );
      return;
    }

    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <div key={idx} className="flex items-start gap-2.5 my-1.5 text-xs sm:text-sm text-foreground/90 leading-relaxed ps-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400 mt-2 shrink-0 shadow-sm" />
          <span className="flex-1">{renderFormattedText(line.replace(/^[-*]\s+/, ''))}</span>
        </div>
      );
      return;
    }

    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div key={idx} className="flex items-start gap-2 my-1.5 text-xs sm:text-sm text-foreground/90 leading-relaxed ps-1">
          <span className="font-bold text-violet-600 dark:text-violet-400 shrink-0 text-xs mt-0.5">{numMatch[1]}.</span>
          <span className="flex-1">{renderFormattedText(numMatch[2])}</span>
        </div>
      );
      return;
    }

    if (line.trim().startsWith('> ')) {
      elements.push(
        <blockquote key={idx} className="border-s-4 border-violet-500 bg-violet-500/10 px-3 py-2 my-2 rounded-e-lg text-xs sm:text-sm text-foreground/90 italic">
          {renderFormattedText(line.trim().replace(/^>\s*/, ''))}
        </blockquote>
      );
      return;
    }

    if (line.trim() === '') {
      elements.push(<div key={idx} className="h-2" />);
      return;
    }

    elements.push(
      <p key={idx} className="text-xs sm:text-sm leading-relaxed text-foreground/90 my-1">
        {renderFormattedText(line)}
      </p>
    );
  });

  return <div className="space-y-1">{elements}</div>;
}

export function AICopilotDrawer() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [INITIAL_MESSAGE];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { isRtl } = useLanguage();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    localStorage.removeItem(STORAGE_KEY);
    toast.success('تم مسح المحادثة بنجاح');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('تم نسخ النص');
  };

  // Collect live context for the AI
  const collectShopData = () => {
    try {
      const activeShift = getActiveShift();
      const enabledCurrencies = getEnabledCurrencies();
      const storeType = getCurrentStoreType();

      return {
        storeType: storeType || 'متجر عام',
        currencies: enabledCurrencies.map((c) => ({
          code: c.code,
          symbol: c.symbol,
          rate: c.rate,
        })),
        activeShift: activeShift
          ? {
              status: activeShift.status,
              openingCashUsd: activeShift.openingCash,
              salesByCurrency: activeShift.currencies || {},
              totalExpensesUsd: activeShift.totalExpenses || 0,
              expectedCashUsd: activeShift.expectedCash || 0,
              countedCashUsd: activeShift.actualCash,
              differenceUsd: activeShift.difference,
            }
          : null,
      };
    } catch (err) {
      console.warn('[AICopilot] Failed to collect shop context:', err);
      return null;
    }
  };

  const sendMessage = async (customPrompt?: string, contextType: string = 'general') => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || isStreaming) return;

    setInputPrompt('');

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      category: contextType as any,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsStreaming(true);
    setStreamingText('');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setIsStreaming(false);
        setStreamingText('');
        setMessages((prev) => [
          ...prev,
          {
            id: `auth_required_${Date.now()}`,
            role: 'assistant',
            content: 'تسجيل الدخول مطلوب للوصول إلى المساعد الذكي FlowPOS Copilot ومستشارك المحاسبي والإداري.',
            timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
            isAuthRequired: true,
          },
        ]);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (!supabaseUrl) {
        throw new Error('رابط Supabase غير مضبوط في إعدادات البيئة');
      }

      const endpoint = `${supabaseUrl}/functions/v1/flowpos-ai-copilot`;
      const shopData = collectShopData();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          contextType,
          shopData,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        let errJson: any;
        try {
          errJson = await response.json();
        } catch {
          errJson = { error: `خطأ في الخادم (${response.status})` };
        }
        throw new Error(errJson?.error || 'فشلت معالجة الطلب في الخادم');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('فشل فتح قناة استلام الرد');

      const decoder = new TextDecoder();
      let fullAssistantReply = '';
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.replace(/^data:\s*/, '').trim();
          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);
            let deltaContent = '';

            if (typeof parsed.choices?.[0]?.delta?.content === 'string') {
              deltaContent = parsed.choices[0].delta.content;
            } else if (typeof parsed.choices?.[0]?.message?.content === 'string') {
              deltaContent = parsed.choices[0].message.content;
            } else if (Array.isArray(parsed.candidates) && parsed.candidates[0]?.content?.parts) {
              for (const part of parsed.candidates[0].content.parts) {
                if (typeof part.text === 'string') deltaContent += part.text;
              }
            }

            if (deltaContent) {
              fullAssistantReply += deltaContent;
              setStreamingText(fullAssistantReply);
            }
          } catch {}
        }
      }

      if (fullAssistantReply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: fullAssistantReply,
            timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
            category: contextType as any,
          },
        ]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info('تم إيقاف الرد');
      } else {
        const isAuthErr =
          err?.status === 401 ||
          err?.message?.includes('تسجيل الدخول') ||
          err?.message?.includes('JWT') ||
          err?.message?.includes('Unauthorized') ||
          err?.message?.includes('401');

        if (isAuthErr) {
          setMessages((prev) => [
            ...prev,
            {
              id: `auth_err_${Date.now()}`,
              role: 'assistant',
              content: 'انتهت جلسة تسجيل الدخول أو يلزم تسجيل الدخول مجدداً للمتابعة بأمان.',
              timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
              isAuthRequired: true,
            },
          ]);
        } else {
          const errMsg = err?.message || 'تعذر الاتصال بالمساعد الذكي';
          toast.error(errMsg);
          setMessages((prev) => [
            ...prev,
            {
              id: `err_${Date.now()}`,
              role: 'assistant',
              content: `⚠️ **تنبيه:** ${errMsg}`,
              timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      }
    } finally {
      setIsStreaming(false);
      setStreamingText('');
      abortControllerRef.current = null;
    }
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <>
      {/* Floating Trigger Button: متناسق تماماً ومحمي من التداخل مع شريط الـ POS والهواتف */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[calc(5.2rem+env(safe-area-inset-bottom))] ltr:right-4 rtl:left-4 z-40 h-12 px-3.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-primary text-white rounded-full shadow-lg hover:shadow-violet-500/25 transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group focus:outline-none focus:ring-4 focus:ring-violet-400/40 border border-white/20 backdrop-blur-md"
        title="المساعد المحاسبي الذكي FlowPOS Copilot"
        aria-label="فتح المساعد الذكي FlowPOS Copilot"
      >
        <div className="relative flex items-center justify-center">
          <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
          <span className="absolute -top-1 -end-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-violet-700 animate-ping" />
        </div>
        <span className="text-xs font-bold tracking-wide">
          FlowPOS Copilot
        </span>
      </button>

      {/* Slide Drawer: أنيق وعصري يدعم RTL و Dark Mode والشاشات الموسعة */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side={isRtl ? 'left' : 'right'}
          className={`p-0 flex flex-col h-full bg-background border-border/70 shadow-2xl transition-all duration-300 ${
            isExpanded ? 'w-full sm:max-w-2xl md:max-w-3xl' : 'w-full sm:max-w-md md:max-w-lg'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-border bg-card/70 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-primary flex items-center justify-center text-white shadow-md shadow-violet-500/20">
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              </div>
              <div>
                <SheetTitle className="text-sm sm:text-base font-extrabold flex items-center gap-2 text-foreground">
                  <span>FlowPOS Copilot</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 px-2 py-0.5 rounded-full"
                  >
                    Claude 3.5 Sonnet
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
                  المستشار المحاسبي والإداري الذكي للمتجر والورديات
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-muted-foreground hover:text-foreground h-8 w-8 hidden sm:inline-flex"
                title={isExpanded ? 'تصغير العرض' : 'توسيع العرض'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearChat}
                className="text-muted-foreground hover:text-destructive h-8 w-8"
                title="مسح المحادثة"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Quick Actions Bar (كبسولات المهام السريعة بنقرة واحدة) */}
          <div className="p-2 sm:p-2.5 border-b border-border/50 bg-muted/20 overflow-x-auto flex items-center gap-1.5 scrollbar-none shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                sendMessage(
                  'قم بإجراء تدقيق تفصيلي للوردية الحالية والصندوق بالعملات المختلفة، وتحديد أي فروقات نقدية مع الأسباب المحتملة والحلول.',
                  'shift_audit'
                )
              }
              disabled={isStreaming}
              className="text-[11px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3 rounded-full shrink-0 gap-1.5 bg-card hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300 dark:hover:bg-violet-950/40 dark:hover:border-violet-700 border-border shadow-xs transition-colors"
            >
              <Scale className="w-3.5 h-3.5 text-violet-500" />
              <span>🔍 تدقيق الصندوق والوردية</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                sendMessage(
                  'حلل هوامش الربح الحالية للمنتجات وتأثير تقلب أسعار الصرف، واقترح استراتيجية تسعير مثالية وفق تكلفة WAC المرجحة.',
                  'pricing_advisor'
                )
              }
              disabled={isStreaming}
              className="text-[11px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3 rounded-full shrink-0 gap-1.5 bg-card hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:border-emerald-700 border-border shadow-xs transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>🏷️ استشارة تسعير وهامش WAC</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                sendMessage(
                  'حلل حالة المخزون والأصناف المعرضة للنفاد واقترح خطة طلبيات شراء ذكية للموردين لمنع الانقطاع وتفادي تجميد السيولة.',
                  'inventory_forecast'
                )
              }
              disabled={isStreaming}
              className="text-[11px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3 rounded-full shrink-0 gap-1.5 bg-card hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:hover:bg-amber-950/40 dark:hover:border-amber-700 border-border shadow-xs transition-colors"
            >
              <PackageSearch className="w-3.5 h-3.5 text-amber-500" />
              <span>📦 رادار تنبؤ نواقص المخزون</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                sendMessage(
                  'حلل صافي الربح الحقيقي بعد خصم كل المصاريف التشغيلية والدورية وقارنه بمجمل الربح، واستخرج الأداء المالي الحقيقي.',
                  'profit_analysis'
                )
              }
              disabled={isStreaming}
              className="text-[11px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3 rounded-full shrink-0 gap-1.5 bg-card hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-950/40 dark:hover:border-blue-700 border-border shadow-xs transition-colors"
            >
              <DollarSign className="w-3.5 h-3.5 text-blue-500" />
              <span>💰 تحليل صافي الربح الحقيقي</span>
            </Button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 sm:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-primary flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-3 sm:p-3.5 shadow-xs text-xs sm:text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-xs'
                      : msg.isAuthRequired
                      ? 'bg-amber-500/10 border border-amber-500/30 rounded-bl-xs text-foreground'
                      : 'bg-card border border-border/80 rounded-bl-xs text-foreground'
                  }`}
                >
                  {msg.isAuthRequired ? (
                    <div className="space-y-3 py-1">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs sm:text-sm">
                        <Lock className="w-4 h-4" />
                        <span>تسجيل الدخول مطلوب</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {msg.content}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => {
                          setIsOpen(false);
                          navigate('/login');
                        }}
                        className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium text-xs h-9 rounded-xl shadow-sm transition-all"
                      >
                        <LogIn className="w-4 h-4 rtl:rotate-180" />
                        <span>تسجيل الدخول الآن</span>
                      </Button>
                    </div>
                  ) : msg.role === 'assistant' ? (
                    <SimpleMarkdown content={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}

                  <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-border/20 text-[10px] text-muted-foreground">
                    <span className="font-mono">{msg.timestamp}</span>
                    {msg.role === 'assistant' && !msg.isAuthRequired && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50"
                        title="نسخ الرد"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Live Streaming Message Bubble */}
            {isStreaming && (
              <div className="flex gap-2.5 sm:gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm animate-pulse mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="max-w-[88%] sm:max-w-[82%] rounded-2xl p-3 sm:p-3.5 shadow-xs text-xs sm:text-sm bg-card border border-border/80 rounded-bl-xs text-foreground">
                  {streamingText ? (
                    <SimpleMarkdown content={streamingText} />
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground py-1">
                      <div className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                      <span className="text-[11px] font-medium mr-1 text-foreground/80">
                        جاري التفكير والتحليل المحاسبي عبر Claude...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 sm:p-3.5 border-t border-border bg-card/80 backdrop-blur-md shrink-0">
            <div className="relative flex items-end gap-1.5 bg-background border border-border/80 rounded-2xl p-1.5 shadow-xs focus-within:ring-2 focus-within:ring-violet-500/30 focus-within:border-violet-500 transition-all">
              <Textarea
                ref={textareaRef}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="اسأل المستشار المحاسبي عن الصندوق، الأسعار، أو الأرباح..."
                rows={1}
                className="resize-none min-h-[40px] max-h-32 border-0 shadow-none focus-visible:ring-0 p-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/70"
              />

              {isStreaming ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleStopStream}
                  className="h-9 w-9 rounded-xl shrink-0 p-0 shadow-xs"
                  title="إيقاف التوليد"
                >
                  <Square className="w-4 h-4 fill-current" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!inputPrompt.trim()}
                  onClick={() => sendMessage()}
                  className="h-9 w-9 rounded-xl shrink-0 p-0 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xs disabled:opacity-40 transition-all"
                  title="إرسال السؤال"
                >
                  <Send className="w-4 h-4 rtl:rotate-180" />
                </Button>
              )}
            </div>
            <div className="mt-1.5 px-1 flex items-center justify-between text-[10px] text-muted-foreground/70">
              <span>اضغط Enter للإرسال، Shift + Enter لسطر جديد</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                جاهز للمساعدة
              </span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
