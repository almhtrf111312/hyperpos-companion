import { useEffect, useState } from 'react';
import { MessageCircle, Phone, Globe, User, Headphones } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';
import { useUserRole } from '@/hooks/use-user-role';
import { ContactLinksSection } from '@/components/settings/ContactLinksSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InlineSupportChatPanel } from '@/components/support/InlineSupportChatPanel';

interface DevInfo { name?: string; phone?: string; website?: string }

export default function ContactDeveloper() {
  const { t, direction } = useLanguage();
  const { isBoss } = useUserRole();
  const [info, setInfo] = useState<DevInfo>({});
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'contact_links').maybeSingle().then(({ data }) => {
      if (!data?.value) return;
      try {
        const p = JSON.parse(data.value);
        setInfo({ name: p._developer_name, phone: p._phone, website: p._website });
      } catch { /* ignore */ }
    });
  }, []);

  const site = info.website?.trim();
  const siteUrl = site ? (site.startsWith('http') ? site : `https://${site}`) : '';

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-5" dir={direction}>
      {/* Developer Info Card */}
      <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-3 shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <MessageCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">{t('license.contactDeveloper')}</h1>
        {info.name && (
          <p className="flex items-center justify-center gap-2 text-muted-foreground">
            <User className="w-4 h-4" /> {info.name}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {info.phone?.trim() && (
            <a href={`tel:${info.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm hover:bg-muted" dir="ltr">
              <Phone className="w-4 h-4 text-primary" /> {info.phone}
            </a>
          )}
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm hover:bg-muted" dir="ltr">
              <Globe className="w-4 h-4 text-primary" /> {site}
            </a>
          )}
        </div>
      </div>

      {/* Live Support Chat CTA */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Headphones className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-sm font-bold text-foreground">
              {isBoss ? 'محادثات العملاء' : 'الدعم الفني المباشر'}
            </h2>
            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-green-500/20 text-green-600 border-green-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse me-1 inline-block" />
              متصل
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {isBoss
              ? 'اعرض وتفاعل مع محادثات العملاء مباشرة'
              : 'تواصل مع المطور مباشرة — سنرد عليك في أقرب وقت ممكن'}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setChatOpen(true)}
          className="shrink-0 gap-1.5"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {isBoss ? 'عرض المحادثات' : 'ابدأ المحادثة'}
        </Button>
      </div>

      {/* Embedded Inline Chat (opens when button is clicked) */}
      {chatOpen && (
        <InlineSupportChatPanel onClose={() => setChatOpen(false)} />
      )}

      {/* Social / Contact Links */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <ContactLinksSection />
      </div>
    </div>
  );
}
