import { useState, useEffect } from 'react';
import { Headphones, Users, ArrowRight, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  SupportConversation,
  BossConversationList,
  ChatMessages,
  InputBar
} from './SupportChat';

export function InlineSupportChatPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { isBoss } = useUserRole();

  const [conversationId, setConversationId] = useState<string | null>(null);
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

  // Mark as read when opened inline
  useEffect(() => {
    if (conversationId && user && !isBoss) {
      supabase
        .from('support_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .then(() => {});
    }
  }, [conversationId, user, isBoss]);

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
        'w-full max-w-2xl mx-auto rounded-2xl shadow-sm border border-border bg-card flex flex-col',
        'animate-in zoom-in-95 fade-in duration-200',
        'h-[500px] overflow-hidden'
      )}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
            {isBoss ? (
              <Users className="w-4 h-4 text-primary" />
            ) : (
              <Headphones className="w-4 h-4 text-primary" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">
              {isBoss
                ? bossView === 'list'
                  ? 'محادثات العملاء'
                  : selectedConv?.user_name || 'محادثة'
                : 'الدعم الفني'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
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
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => {
                setBossView('list');
                setSelectedConv(null);
              }}
              title="العودة للقائمة"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-destructive/10"
            onClick={onClose}
            title="إغلاق المحادثة"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
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
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2 p-6 text-center">
            <Headphones className="h-12 w-12 opacity-20 text-primary mb-2" />
            <p className="font-bold text-foreground text-base">مرحباً بك في الدعم الفني</p>
            <p className="opacity-70 max-w-sm">أرسل رسالتك الأولى وسيرد عليك المطور في أقرب وقت ممكن</p>
          </div>
          <InputBar
            conversationId={null}
            onConversationCreated={setConversationId}
          />
        </>
      )}
    </div>
  );
}
