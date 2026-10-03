/**
 * SupportChat — In-App Live Support Chat
 * =======================================
 * - FAB (Floating Action Button) ثابت في أسفل الشاشة
 * - نافذة دردشة منبثقة مع Realtime عبر Supabase
 * - دعم دور Boss لعرض كل المحادثات والرد عليها
 * - دعم كامل للغة العربية (RTL)
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  ChevronDown,
  Headphones,
  Users,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string; // 'user' | 'boss' | 'admin'
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface SupportConversation {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  store_name: string | null;
  status: string;
  last_message_at: string | null;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

export function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// ─── Boss: list of all conversations ─────────────────────────────────────────

export function BossConversationList({
  onSelect,
}: {
  onSelect: (conv: SupportConversation) => void;
}) {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('support_conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .then(({ data }) => {
        setConversations((data as SupportConversation[]) || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-xs gap-2">
        <Users className="h-8 w-8 opacity-30" />
        <span>لا توجد محادثات حتى الآن</span>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1 divide-y divide-border">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          className="w-full text-start px-4 py-3 hover:bg-muted/60 transition-colors flex items-center justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {c.user_name || c.user_email || 'مجهول'}
            </p>
            {c.store_name && (
              <p className="text-[11px] text-muted-foreground truncate">{c.store_name}</p>
            )}
            {c.user_phone && (
              <p className="text-[11px] text-muted-foreground truncate dir-ltr">{c.user_phone}</p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {c.last_message_at && (
              <span className="text-[10px] text-muted-foreground">
                {formatTime(c.last_message_at)}
              </span>
            )}
            <Badge
              variant={c.status === 'open' ? 'default' : 'secondary'}
              className="text-[10px] px-1.5 py-0 h-4"
            >
              {c.status === 'open' ? 'مفتوحة' : 'مغلقة'}
            </Badge>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );
}

// ─── Chat Messages Panel ──────────────────────────────────────────────────────

export function ChatMessages({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages((data as SupportMessage[]) || []);
        setLoading(false);
      });
  }, [conversationId]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as SupportMessage;
          setMessages((prev) => {
            // prevent duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2 p-6 text-center">
        <MessageCircle className="h-10 w-10 opacity-20 text-primary" />
        <p>ابدأ محادثتك مع فريق الدعم الفني</p>
        <p className="opacity-60">سنرد عليك في أقرب وقت ممكن</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
      {messages.map((msg) => {
        const isMe = msg.sender_id === currentUserId;
        const isSupport = msg.sender_role === 'boss' || msg.sender_role === 'admin';

        return (
          <div
            key={msg.id}
            className={cn(
              'flex gap-2 items-end',
              isMe ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            {/* Avatar badge for support */}
            {!isMe && (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mb-0.5">
                <Headphones className="w-3.5 h-3.5 text-primary" />
              </div>
            )}

            <div
              className={cn(
                'max-w-[78%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words',
                isMe
                  ? 'bg-primary text-primary-foreground rounded-br-sm shadow-sm'
                  : 'bg-muted text-foreground rounded-bl-sm border border-border/50',
              )}
            >
              {/* Support label */}
              {isSupport && !isMe && (
                <p className="text-[10px] font-bold text-primary mb-0.5">
                  فريق الدعم الفني
                </p>
              )}
              <p>{msg.message}</p>
              <p
                className={cn(
                  'text-[10px] mt-1 select-none',
                  isMe ? 'text-primary-foreground/60 text-end' : 'text-muted-foreground',
                )}
              >
                {formatTime(msg.created_at)}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Input Bar ────────────────────────────────────────────────────────────────

export function InputBar({
  conversationId,
  onConversationCreated,
}: {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const send = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setText('');

    try {
      const { data, error } = await supabase.rpc('send_support_message', {
        _message: trimmed,
        _conversation_id: conversationId || null,
      } as Record<string, unknown>);

      if (error) {
        console.error('[SupportChat] RPC error:', error);
      } else if (!conversationId && data) {
        // first message — newly created conversation id returned
        const newId = typeof data === 'string' ? data : (data as Record<string, string>)?.conversation_id;
        if (newId) onConversationCreated(newId);
      }
    } catch (err) {
      console.error('[SupportChat] send error:', err);
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, conversationId, onConversationCreated]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="border-t border-border p-2.5 flex gap-2 bg-muted/20">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="اكتب رسالتك هنا..."
        disabled={submitting}
        className="text-xs h-9 bg-card flex-1"
        dir="rtl"
      />
      <Button
        onClick={send}
        disabled={submitting || !text.trim()}
        size="sm"
        className="h-9 px-3 gap-1 shrink-0"
        title="إرسال"
      >
        {submitting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Send className="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  );
}

// ─── Main Export: SupportChat ─────────────────────────────────────────────────

export function SupportChat() {
  const { user, profile } = useAuth();
  const { isBoss } = useUserRole();
  const { direction } = useLanguage();

  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  // Boss: selected conversation
  const [selectedConv, setSelectedConv] = useState<SupportConversation | null>(null);
  const [bossView, setBossView] = useState<'list' | 'chat'>('list');

  // Load existing user conversation
  useEffect(() => {
    if (!user || isBoss) return;
    supabase
      .from('support_conversations')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setConversationId(data.id);
      });
  }, [user, isBoss]);

  // Count unread for regular user (messages from boss/admin not yet read)
  useEffect(() => {
    if (!conversationId || !user) return;
    supabase
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('is_read', false)
      .neq('sender_id', user.id)
      .then(({ count }) => setUnread(count || 0));
  }, [conversationId, user, open]);

  // Mark as read when opening
  useEffect(() => {
    if (open && conversationId && user) {
      setUnread(0);
      supabase
        .from('support_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .then(() => {});
    }
  }, [open, conversationId, user]);

  if (!user) return null;

  const handleBossSelectConv = (conv: SupportConversation) => {
    setSelectedConv(conv);
    setBossView('chat');
  };

  const activeChatConvId = isBoss
    ? selectedConv?.id ?? null
    : conversationId;

  return (
    <div
      className={cn(
        'fixed z-[200] bottom-6',
        direction === 'rtl' ? 'left-5' : 'right-5',
      )}
    >
      {/* Chat Window */}
      {open && (
        <div
          className={cn(
            'mb-3 w-[340px] max-w-[calc(100vw-2.5rem)] rounded-2xl shadow-2xl border border-border bg-card flex flex-col',
            'animate-in slide-in-from-bottom-4 fade-in duration-200',
            'h-[500px] max-h-[calc(100vh-8rem)]',
          )}
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                {isBoss ? (
                  <Users className="w-4 h-4 text-primary" />
                ) : (
                  <Headphones className="w-4 h-4 text-primary" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-foreground leading-none">
                  {isBoss
                    ? bossView === 'list'
                      ? 'محادثات العملاء'
                      : selectedConv?.user_name || 'محادثة'
                    : 'الدعم الفني'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {isBoss
                    ? bossView === 'chat'
                      ? selectedConv?.store_name || selectedConv?.user_email || ''
                      : 'اختر محادثة للرد'
                    : 'سنرد عليك في أقرب وقت'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isBoss && bossView === 'chat' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-lg"
                  onClick={() => {
                    setBossView('list');
                    setSelectedConv(null);
                  }}
                  title="العودة للقائمة"
                >
                  <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg"
                onClick={() => setOpen(false)}
                title="تصغير"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-lg"
                onClick={() => setOpen(false)}
                title="إغلاق"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Boss: conversation list */}
          {isBoss && bossView === 'list' ? (
            <BossConversationList onSelect={handleBossSelectConv} />
          ) : activeChatConvId || !isBoss ? (
            <>
              <ChatMessages
                conversationId={activeChatConvId || ''}
                currentUserId={user.id}
              />
              <InputBar
                conversationId={activeChatConvId}
                onConversationCreated={(id) => {
                  if (!isBoss) setConversationId(id);
                  else if (selectedConv) setSelectedConv({ ...selectedConv, id });
                }}
              />
            </>
          ) : (
            <>
              {/* No existing conversation — start fresh */}
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2 p-6 text-center">
                <Headphones className="h-10 w-10 opacity-20 text-primary" />
                <p className="font-semibold text-foreground">مرحباً بك في الدعم الفني</p>
                <p className="opacity-70">أرسل رسالتك الأولى وسيرد عليك المطور في أقرب وقت ممكن</p>
              </div>
              <InputBar
                conversationId={null}
                onConversationCreated={setConversationId}
              />
            </>
          )}
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 active:scale-95',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          open && 'rotate-180 bg-muted text-foreground hover:bg-muted/80',
        )}
        title={open ? 'إغلاق المحادثة' : 'تواصل مع الدعم الفني'}
        aria-label="دعم فني"
      >
        {open ? (
          <ChevronDown className="w-6 h-6" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6" />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
