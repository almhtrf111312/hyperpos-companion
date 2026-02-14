import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';
import { Loader2 } from 'lucide-react';

interface ContactLinks {
  whatsapp?: string;
  facebook?: string;
  tiktok?: string;
  telegram?: string;
  youtube?: string;
  twitter?: string;
  email?: string;
  olx?: string;
}

interface ChannelConfig {
  key: keyof ContactLinks;
  label: string;
  labelEn: string;
  color: string;
  hoverColor: string;
  icon: string;
  openUrl: (value: string) => string;
}

const CHANNELS: ChannelConfig[] = [
  {
    key: 'whatsapp',
    label: 'واتساب',
    labelEn: 'WhatsApp',
    color: 'bg-green-500 hover:bg-green-600',
    hoverColor: 'hover:shadow-green-500/30',
    icon: '💬',
    openUrl: (v) => `https://wa.me/${v.replace(/[^0-9+]/g, '')}`,
  },
  {
    key: 'facebook',
    label: 'فيسبوك',
    labelEn: 'Facebook',
    color: 'bg-blue-600 hover:bg-blue-700',
    hoverColor: 'hover:shadow-blue-600/30',
    icon: '📘',
    openUrl: (v) => v.startsWith('http') ? v : `https://facebook.com/${v}`,
  },
  {
    key: 'tiktok',
    label: 'تيك توك',
    labelEn: 'TikTok',
    color: 'bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600',
    hoverColor: 'hover:shadow-gray-900/30',
    icon: '🎵',
    openUrl: (v) => v.startsWith('http') ? v : `https://tiktok.com/@${v}`,
  },
  {
    key: 'telegram',
    label: 'تليجرام',
    labelEn: 'Telegram',
    color: 'bg-sky-500 hover:bg-sky-600',
    hoverColor: 'hover:shadow-sky-500/30',
    icon: '✈️',
    openUrl: (v) => v.startsWith('http') ? v : `https://t.me/${v}`,
  },
  {
    key: 'youtube',
    label: 'يوتيوب',
    labelEn: 'YouTube',
    color: 'bg-red-600 hover:bg-red-700',
    hoverColor: 'hover:shadow-red-600/30',
    icon: '▶️',
    openUrl: (v) => v.startsWith('http') ? v : `https://youtube.com/@${v}`,
  },
  {
    key: 'twitter',
    label: 'تويتر / X',
    labelEn: 'X (Twitter)',
    color: 'bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500',
    hoverColor: 'hover:shadow-gray-700/30',
    icon: '𝕏',
    openUrl: (v) => v.startsWith('http') ? v : `https://x.com/${v}`,
  },
  {
    key: 'email',
    label: 'بريد إلكتروني',
    labelEn: 'Email',
    color: 'bg-orange-500 hover:bg-orange-600',
    hoverColor: 'hover:shadow-orange-500/30',
    icon: '📧',
    openUrl: (v) => `mailto:${v}`,
  },
  {
    key: 'olx',
    label: 'OLX',
    labelEn: 'OLX',
    color: 'bg-amber-500 hover:bg-amber-600',
    hoverColor: 'hover:shadow-amber-500/30',
    icon: '🛒',
    openUrl: (v) => v.startsWith('http') ? v : `https://olx.com/${v}`,
  },
];

export function ContactLinksSection() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [links, setLinks] = useState<ContactLinks | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        // Try new contact_links first
        const { data: linksData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'contact_links')
          .maybeSingle();

        if (linksData?.value) {
          setLinks(JSON.parse(linksData.value));
        } else {
          // Fallback to old developer_phone
          const { data: phoneData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'developer_phone')
            .maybeSingle();

          if (phoneData?.value) {
            setLinks({ whatsapp: phoneData.value });
          }
        }
      } catch (err) {
        console.error('Failed to fetch contact links:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLinks();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeChannels = CHANNELS.filter(ch => links?.[ch.key]?.trim());

  if (activeChannels.length === 0) return null;

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-2 gap-3">
        {activeChannels.map((ch) => (
          <button
            key={ch.key}
            onClick={() => window.open(ch.openUrl(links![ch.key]!), '_blank')}
            className={`${ch.color} ${ch.hoverColor} text-white rounded-xl px-4 py-3 flex items-center gap-3 transition-all duration-200 hover:shadow-lg active:scale-95`}
          >
            <span className="text-xl">{ch.icon}</span>
            <span className="font-medium text-sm">
              {isRTL ? ch.label : ch.labelEn}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export { CHANNELS, type ContactLinks };
