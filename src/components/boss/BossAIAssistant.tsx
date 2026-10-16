import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUserRole } from '@/hooks/use-user-role';
import { useLanguage } from '@/hooks/use-language';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/image-upload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Sparkles,
  Send,
  Image as ImageIcon,
  Mic,
  MicOff,
  Square,
  Trash2,
  Copy,
  Check,
  Bot,
  User,
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
  FileText,
  Activity,
  ShieldAlert,
  ChevronDown,
  Layers,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: string;
}

const STORAGE_KEY = 'hyperpos_boss_ai_messages';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  role: 'assistant',
  content: `مرحباً بك يا سيدي (Boss) في غرفة القيادة والمستشار التنفيذي الذكي لنظام **Flow POS Pro** 👑

أنا متصل مباشرة ببيانات النظام الحية (رادار الأخطاء، التراخيص، وإحصائيات المستخدمين)، وأستطيع:
- **تحليل الصور**: ارفع أي فاتورة، لقطة شاشة لخطأ واجه مستخدماً، أو صورة باركود.
- **التسجيلات الصوتية**: يمكنك التحدث معي مباشرة عبر زر المايكروفون بالفصحى أو العامية.
- **التقارير الفورية**: اطلب ملخصاً لأخطاء اليوم أو التراخيص المنتهية فورياً.

كيف أستطيع مساعدتك الآن في إدارة وتطوير نظامك؟`,
  timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
};

const QUICK_PROMPTS = [
  { label: 'أخطاء رادار الأخطاء اليوم', query: 'ما هي الأخطاء المسجلة اليوم في رادار الأخطاء؟ وما سببها الجذري المقترح؟', icon: ShieldAlert },
  { label: 'المستخدمين والتراخيص المنتهية', query: 'اعطني تقريراً بالمستخدمين المنتهية تراخيصهم أو القريبة من الانتهاء.', icon: FileText },
  { label: 'تحليل كفاءة وأداء النظام', query: 'حلل كفاءة النظام والنشاط العام واقترح خطة عمل لتطويره.', icon: Activity },
  { label: 'أفضل ممارسات أمان التراخيص', query: 'ما هي التوصيات لتأمين تراخيص نقاط البيع ومنع استخدامها غير المصرح؟', icon: Sparkles },
];

/**
 * مكوّن عرض الماركداون خفيف الوزن وبدون اعتماديات إضافية
 */
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  lines.forEach((line, idx) => {
    // Code block detection
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

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={idx} className="text-base font-bold text-primary mt-3 mb-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-4 bg-primary rounded-full inline-block" />
          {renderFormattedText(line.replace('### ', ''))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={idx} className="text-lg font-bold text-foreground mt-4 mb-2 border-b border-border/50 pb-1">
          {renderFormattedText(line.replace('## ', ''))}
        </h3>
      );
      return;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={idx} className="text-xl font-extrabold text-foreground mt-4 mb-2">
          {renderFormattedText(line.replace('# ', ''))}
        </h2>
      );
      return;
    }

    // Bullet points
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const cleanLine = line.trim().replace(/^[-*]\s+/, '');
      elements.push(
        <li key={idx} className="ms-4 list-disc text-sm text-foreground/90 my-1 leading-relaxed">
          {renderFormattedText(cleanLine)}
        </li>
      );
      return;
    }

    // Numbered lists
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div key={idx} className="flex items-start gap-2 text-sm text-foreground/90 my-1 ms-2">
          <span className="font-bold text-primary shrink-0">{numMatch[1]}.</span>
          <span className="leading-relaxed">{renderFormattedText(numMatch[2])}</span>
        </div>
      );
      return;
    }

    // Blockquote
    if (line.trim().startsWith('> ')) {
      elements.push(
        <blockquote key={idx} className="border-s-4 border-amber-500 bg-amber-500/10 px-3 py-1.5 my-2 rounded-e-md text-sm italic text-foreground">
          {renderFormattedText(line.trim().replace(/^>\s*/, ''))}
        </blockquote>
      );
      return;
    }

    // Empty lines
    if (line.trim() === '') {
      elements.push(<div key={idx} className="h-2" />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={idx} className="text-sm leading-relaxed text-foreground/90 my-1">
        {renderFormattedText(line)}
      </p>
    );
  });

  return <div className="space-y-1">{elements}</div>;
}

/**
 * تنسيق النصوص البسيطة: العريض والرموز
 */
function renderFormattedText(text: string): React.ReactNode {
  // Regex to match **bold** and `code`
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-primary font-medium" dir="ltr">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function BossAIAssistant() {
  const { role, isBoss } = useUserRole();
  const { direction } = useLanguage();

  // State
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [INITIAL_MESSAGE];
  });

  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Audio / Speech State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const recordingTimerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  // Persist messages in session
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Strict role check
  if (!isBoss && role !== 'boss') {
    return (
      <div className="p-8 text-center bg-destructive/10 border border-destructive/20 rounded-2xl space-y-3">
        <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
        <h3 className="text-lg font-bold text-destructive">صلاحية محظورة</h3>
        <p className="text-sm text-muted-foreground">
          هذه الميزة مخصصة حصرياً لمالك النظام (Boss) فقط.
        </p>
      </div>
    );
  }

  // Handle Image Selection & Compression
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح (JPEG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawBase64 = reader.result as string;
        // Compress image to ~100KB for fast API processing
        const compressed = await compressImage(rawBase64, 150, 1024, 1024);
        setSelectedImage(compressed);
        toast.success('تم إرفاق الصورة وجاهزة للتحليل');
      } catch (err) {
        console.error('Failed to compress image:', err);
        setSelectedImage(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Toggle Voice Recording with SpeechRecognition & MediaRecorder
  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording(true);
      return;
    }

    try {
      // 1. Check for MediaDevices
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200);

      // 2. Setup Speech Recognition if available in browser
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript.trim()) {
            setInput((prev) => {
              const base = prev.trim();
              return base ? `${base} ${currentTranscript.trim()}` : currentTranscript.trim();
            });
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('[VoiceRec] SpeechRecognition error:', e);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);

      toast.info('جاري الاستماع... تحدث بطلبك وسأقوم بتفريغه وتحليله');
    } catch (err) {
      console.error('[VoiceRec] Microphone access error:', err);
      toast.error('تعذر الوصول إلى المايكروفون. يرجى منح الإذن في المتصفح.');
    }
  };

  const stopRecording = (commit: boolean) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }

    setIsRecording(false);
    setRecordingSeconds(0);

    if (commit) {
      toast.success('تم إنهاء التسجيل الصوتي');
    }
  };

  // Send Message & Handle SSE Streaming
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend !== undefined ? textToSend : input).trim();
    const imageToSend = selectedImage;

    if (!messageContent && !imageToSend) return;
    if (isStreaming) return;

    if (isRecording) {
      stopRecording(true);
    }

    const userMessageId = `user_${Date.now()}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMessageId,
        role: 'user',
        content: messageContent || 'يرجى فحص الصورة المرفقة وتحليلها.',
        image: imageToSend || undefined,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      },
    ];

    setMessages(newMessages);
    setInput('');
    setSelectedImage(null);
    setIsStreaming(true);
    setStreamingText('');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('يرجى إعادة تسجيل الدخول لمتابعة المحادثة');
      }

      const supabaseUrl = (supabase as any).supabaseUrl || 'https://almhtrf.supabase.co';
      const endpoint = `${supabaseUrl}/functions/v1/boss-assistant`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          image: imageToSend,
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

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('فشل فتح قناة استلام الرد');
      }

      const decoder = new TextDecoder();
      let fullAssistantReply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.replace(/^data:\s*/, '').trim();
          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content || '';
            if (deltaContent) {
              fullAssistantReply += deltaContent;
              setStreamingText(fullAssistantReply);
            }
          } catch {
            // Partial chunk or non-json keep reading
          }
        }
      }

      // Commit completed assistant message
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
        console.error('[BossAI] Chat error:', err);
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

  // Stop Streaming
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Clear Chat History
  const handleClearHistory = () => {
    setMessages([INITIAL_MESSAGE]);
    sessionStorage.removeItem(STORAGE_KEY);
    toast.info('تم مسح سجل المحادثة والبدء من جديد');
  };

  // Copy message text
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('تم نسخ النص');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card className="border-border/60 shadow-xl bg-card/90 backdrop-blur-md overflow-hidden flex flex-col h-[750px] max-h-[85vh]">
      {/* Header */}
      <CardHeader className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/10 via-background to-amber-500/10 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-inner">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg font-bold">
                المستشار التنفيذي الذكي (Boss AI)
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30 text-primary">
                Gemini Vision & Live Context
              </Badge>
            </div>
            <CardDescription className="text-xs">
              غرفة القيادة التوليدية لمالك النظام • تحليل الصور والصوت والبيانات الحية
            </CardDescription>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearHistory}
          className="text-xs text-muted-foreground hover:text-destructive h-8 px-2.5 gap-1.5"
          title="مسح المحادثة"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">مسح المحادثة</span>
        </Button>
      </CardHeader>

      {/* Quick Prompts Bar */}
      <div className="p-2.5 bg-muted/30 border-b border-border/40 overflow-x-auto flex items-center gap-2 no-scrollbar">
        <span className="text-[11px] font-semibold text-muted-foreground shrink-0 ms-1">
          إجراءات سريعة:
        </span>
        {QUICK_PROMPTS.map((qp, idx) => {
          const Icon = qp.icon;
          return (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.query)}
              disabled={isStreaming}
              className="inline-flex items-center gap-1.5 text-xs bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/40 border border-border/80 px-2.5 py-1 rounded-full transition-all shrink-0 font-medium disabled:opacity-50"
            >
              <Icon className="w-3.5 h-3.5 text-primary" />
              <span>{qp.label}</span>
            </button>
          );
        })}
      </div>

      {/* Messages Feed */}
      <CardContent className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-4" dir={direction}>
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}

              <div
                className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-3 sm:p-4 shadow-sm space-y-2 ${
                  isUser
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-br-none'
                    : 'bg-muted/70 dark:bg-muted/40 border border-border/60 text-foreground rounded-bl-none'
                }`}
              >
                {/* Image attachment in message */}
                {msg.image && (
                  <div className="rounded-lg overflow-hidden border border-black/10 dark:border-white/10 max-w-[280px]">
                    <img
                      src={msg.image}
                      alt="مرفق صورة"
                      className="w-full h-auto object-cover max-h-56 cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => window.open(msg.image, '_blank')}
                    />
                  </div>
                )}

                {/* Message text with Markdown rendering */}
                {isUser ? (
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )}

                {/* Metadata & Copy action */}
                <div className={`flex items-center justify-between gap-3 text-[10px] pt-1.5 border-t ${
                  isUser ? 'border-white/20 text-white/80' : 'border-border/40 text-muted-foreground'
                }`}>
                  <span>{msg.timestamp}</span>
                  {!isUser && (
                    <button
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="hover:text-foreground flex items-center gap-1 transition-colors"
                      title="نسخ الرد"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500 font-bold">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming Message Box */}
        {isStreaming && (
          <div className="flex gap-2.5 sm:gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 animate-pulse mt-0.5">
              <Bot className="w-4 h-4 text-primary" />
            </div>

            <div className="max-w-[88%] sm:max-w-[78%] rounded-2xl p-3 sm:p-4 bg-muted/80 border border-primary/40 text-foreground rounded-bl-none shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-primary mb-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري التحليل وصياغة التقرير التنفيذي...</span>
              </div>
              {streamingText ? (
                <MarkdownRenderer content={streamingText} />
              ) : (
                <div className="flex items-center gap-1 py-1">
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      {/* Input & Multimodal Controls */}
      <div className="p-3 border-t border-border/50 bg-background/95 backdrop-blur-sm space-y-2">
        {/* Selected Image Preview Bar */}
        {selectedImage && (
          <div className="flex items-center gap-2 bg-muted/60 p-1.5 px-2 rounded-xl border border-border/70 max-w-fit animate-in fade-in">
            <img
              src={selectedImage}
              alt="معاينة"
              className="w-10 h-10 object-cover rounded-lg border border-border"
            />
            <div className="text-xs">
              <span className="font-semibold text-foreground block">صورة مرفقة للتحليل</span>
              <span className="text-[10px] text-muted-foreground">جاهزة للإرسال مع السؤال</span>
            </div>
            <button
              onClick={() => setSelectedImage(null)}
              className="w-5 h-5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center ms-2"
              title="إلغاء الصورة"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Audio Recording Status Indicator */}
        {isRecording && (
          <div className="flex items-center justify-between bg-destructive/10 border border-destructive/25 text-destructive p-2 rounded-xl animate-pulse text-xs font-semibold px-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-ping" />
              <span>جاري التسجيل الصوتي المباشر: {recordingSeconds} ثانية</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => stopRecording(true)}
              >
                اعتماد النص
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive px-1.5"
                onClick={() => stopRecording(false)}
              >
                إلغاء
              </Button>
            </div>
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-end gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />

          {/* Attach Image Button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className={`h-11 w-11 rounded-xl shrink-0 transition-all ${
              selectedImage ? 'border-primary text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
            }`}
            title="إرفاق صورة فاتورة أو شاشة خطأ أو باركود"
          >
            <ImageIcon className="w-5 h-5" />
          </Button>

          {/* Voice Microphone Button */}
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'outline'}
            size="icon"
            onClick={toggleRecording}
            disabled={isStreaming}
            className={`h-11 w-11 rounded-xl shrink-0 transition-all ${
              isRecording ? 'animate-pulse shadow-md shadow-destructive/30' : 'text-muted-foreground hover:text-foreground'
            }`}
            title={isRecording ? 'إيقاف التسجيل' : 'تسجيل رسالة صوتية (تفريغ صوتي لحظي)'}
          >
            {isRecording ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5" />}
          </Button>

          {/* Textarea */}
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={isRecording ? 'تحدث الآن... سيتم تحويل صوتك لنص تلقائياً...' : 'اكتب سؤالك، استفسارك، أو الصق طلبك هنا...'}
              disabled={isStreaming}
              rows={1}
              className="min-h-[44px] max-h-32 py-2.5 px-3.5 resize-none rounded-xl text-sm leading-relaxed border-border/80 focus-visible:ring-primary shadow-sm"
              dir="rtl"
            />
          </div>

          {/* Send / Stop Button */}
          {isStreaming ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={handleStopStreaming}
              className="h-11 w-11 rounded-xl shrink-0 shadow-md transition-all"
              title="إيقاف الرد"
            >
              <Square className="w-4 h-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={(!input.trim() && !selectedImage) || isStreaming}
              className="h-11 w-11 rounded-xl shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all disabled:opacity-40"
              title="إرسال"
            >
              <Send className="w-5 h-5 rtl:rotate-180" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
export default BossAIAssistant;
