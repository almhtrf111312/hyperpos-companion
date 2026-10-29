import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
} from 'lucide-react';
import { getActiveShift } from '@/lib/cashbox-store';
import { getEnabledCurrencies } from '@/lib/money-engine';
import { getCurrentStoreType } from '@/lib/store-type-config';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const STORAGE_KEY = 'flowpos_ai_copilot_messages_v1';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  role: 'assistant',
  content: `مرحباً بك! أنا **FlowPOS Copilot**، مستشارك المحاسبي والإداري الذكي المدعوم بنموذج **Claude 3.5 Sonnet** 🧠

أنا متصل مباشرة ببيانات متجرك الحية (الوردية الحالية، حركات الصندوق متعددة العملات، وحالة المخزون والأرباح).

يمكنك سؤالي عن أي شيء، أو اختيار إحدى المهام السريعة أدناه:
- 🔍 **تدقيق الوردية والخزينة**: كشف أسباب العجز أو الزيادة بالعملات.
- 🏷️ **تحليل الهوامش والتسعير**: موازنة الأسعار وفق تكلفة WAC المرجحة.
- 📦 **رادار المخزون**: التنبؤ بنفاد البضائع واقتراح طلبيات الشراء.
- 💰 **تحليل صافي الربح**: استخراج الأرباح الحقيقية بعد خصم المصروفات.`,
  timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
};

function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
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
          className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-primary"
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
            className="p-3 my-2 bg-muted/80 rounded-lg text-xs font-mono overflow-x-auto text-foreground border border-border"
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
        <h4 key={idx} className="text-sm font-bold text-primary mt-3 mb-1">
          {renderFormattedText(line.replace('### ', ''))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={idx} className="text-base font-bold text-foreground mt-3 mb-1 border-b border-border/40 pb-1">
          {renderFormattedText(line.replace('## ', ''))}
        </h3>
      );
      return;
    }

    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <div key={idx} className="flex items-start gap-2 my-1 text-xs sm:text-sm text-foreground/90">
          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
          <span className="flex-1">{renderFormattedText(line.replace(/^[-*]\s+/, ''))}</span>
        </div>
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
  const [isOpen, setIsOpen] = useState(false);
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
        throw new Error('يرجى تسجيل الدخول لاستخدام المساعد الذكي');
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
          },
        ]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info('تم إيقاف الرد');
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
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 ltr:right-4 rtl:left-4 z-40 p-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-primary text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center group focus:outline-none focus:ring-4 focus:ring-violet-400/40"
        title="المساعد المحاسبي الذكي FlowPOS Copilot"
      >
        <Sparkles className="w-6 h-6 animate-pulse" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out text-xs font-bold px-0 group-hover:px-2">
          AI Copilot
        </span>
      </button>

      {/* Slide Drawer */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side={isRtl ? 'left' : 'right'}
          className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col h-full bg-background border-border"
        >
          {/* Header */}
          <div className="p-4 border-b border-border bg-card/60 backdrop-blur flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold flex items-center gap-2">
                  <span>FlowPOS Copilot</span>
                  <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30">
                    Claude 3.5 Sonnet
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  المستشار المحاسبي والإداري الذكي للمتجر والورديات
                </SheetDescription>
              </div>
            </div>
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

          {/* Quick Actions Bar */}
          <div className="p-2 border-b border-border/50 bg-muted/30 overflow-x-auto flex items-center gap-1.5 scrollbar-none">
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendMessage('قم بإجراء تدقيق تفصيلي للوردية الحالية والصندوق بالعملات المختلفة، وتحديد أي فروقات نقدية مع الأسباب المحتملة والحلول.', 'shift_audit')}
              disabled={isStreaming}
              className="text-[11px] h-7 px-2.5 rounded-full shrink-0 gap-1 bg-background/80 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40"
            >
              <Scale className="w-3.5 h-3.5 text-violet-500" />
              تدقيق الوردية
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendMessage('حلل هوامش الربح الحالية للمنتجات وتأثير تقلب أسعار الصرف، واقترح استراتيجية تسعير مثالية.', 'pricing_advisor')}
              disabled={isStreaming}
              className="text-[11px] h-7 px-2.5 rounded-full shrink-0 gap-1 bg-background/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              تحليل التسعير
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendMessage('حلل حالة المخزون والأصناف المعرضة للنفاد واقترح خطة طلبيات شراء ذكية للموردين.', 'inventory_forecast')}
              disabled={isStreaming}
              className="text-[11px] h-7 px-2.5 rounded-full shrink-0 gap-1 bg-background/80 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40"
            >
              <PackageSearch className="w-3.5 h-3.5 text-amber-500" />
              رادار المخزون
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendMessage('حلل صافي الربح الحقيقي بعد خصم كل المصاريف التشغيلية والدورية وقارنه بمجمل الربح.', 'profit_analysis')}
              disabled={isStreaming}
              className="text-[11px] h-7 px-2.5 rounded-full shrink-0 gap-1 bg-background/80 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40"
            >
              <DollarSign className="w-3.5 h-3.5 text-blue-500" />
              صافي الأرباح
            </Button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-3 shadow-sm text-xs sm:text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-card border border-border rounded-bl-none text-foreground'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <SimpleMarkdown content={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/20 text-[10px] text-muted-foreground">
                    <span>{msg.timestamp}</span>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="hover:text-foreground transition-colors p-0.5"
                        title="نسخ الرد"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Live Streaming Message Bubble */}
            {isStreaming && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm animate-pulse mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="max-w-[85%] rounded-2xl p-3 shadow-sm text-xs sm:text-sm bg-card border border-border rounded-bl-none text-foreground">
                  {streamingText ? (
                    <SimpleMarkdown content={streamingText} />
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground py-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" />
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                      <span className="text-[11px] mr-1">جاري التفكير والتحليل عبر Claude...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-border bg-card/80 backdrop-blur">
            <div className="relative flex items-end gap-1.5 bg-background border border-border rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-violet-500/40 focus-within:border-violet-500">
              <Textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="اكتب استشارتك المحاسبية أو طلب التحليل هنا..."
                rows={1}
                className="resize-none min-h-[38px] max-h-28 border-0 shadow-none focus-visible:ring-0 p-1.5 text-xs sm:text-sm"
              />
              {isStreaming ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleStopStream}
                  className="h-8 w-8 rounded-lg shrink-0 p-0"
                  title="إيقاف التوليد"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!inputPrompt.trim()}
                  onClick={() => sendMessage()}
                  className="h-8 w-8 rounded-lg shrink-0 p-0 bg-violet-600 hover:bg-violet-700 text-white"
                  title="إرسال"
                >
                  <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
