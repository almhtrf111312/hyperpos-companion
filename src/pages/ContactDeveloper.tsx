import { useEffect, useState } from 'react';
import { MessageCircle, Phone, Globe, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';
import { ContactLinksSection } from '@/components/settings/ContactLinksSection';

interface DevInfo { name?: string; phone?: string; website?: string }

export default function ContactDeveloper() {
  const { t, direction } = useLanguage();
  const [info, setInfo] = useState<DevInfo>({});

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
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <ContactLinksSection />
      </div>
    </div>
  );
}
