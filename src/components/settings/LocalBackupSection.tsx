/**
 * Local Backup Section - Shows recent auto-backups in Settings > Sync
 */
import { useState, useEffect } from 'react';
import { Database, Clock, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/use-language';
import {
  loadRecentBackups,
  restoreFromBackup,
  formatBackupSize,
  BACKUP_UPDATED_EVENT,
  LocalBackup,
} from '@/lib/local-auto-backup';
import { toast } from 'sonner';

export function LocalBackupSection() {
  const { t, language } = useLanguage();
  const [backups, setBackups] = useState<LocalBackup[]>(loadRecentBackups());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<LocalBackup[]>;
      setBackups(ce.detail || loadRecentBackups());
    };
    window.addEventListener(BACKUP_UPDATED_EVENT, handler);
    return () => window.removeEventListener(BACKUP_UPDATED_EVENT, handler);
  }, []);

  const handleRestore = (id: string) => {
    const success = restoreFromBackup(id);
    if (success) {
      toast.success(t('localBackup.restoreSuccess'));
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast.error(t('localBackup.restoreFailed'));
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString(language === 'ar' ? 'ar' : language === 'tr' ? 'tr' : 'en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-5 h-5 text-primary" />
        <h3 className="text-base font-semibold text-foreground">
          {t('localBackup.title')}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {t('localBackup.auto')}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {t('localBackup.description')}
      </p>

      {backups.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {t('localBackup.noBackups')}
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map((b) => (
            <div
              key={b.id}
              className="border border-border rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-start"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{b.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(b.timestamp)} · {formatBackupSize(b.size)}
                    </p>
                  </div>
                </div>
                {expandedId === b.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {expandedId === b.id && (
                <div className="px-3 pb-3 border-t border-border pt-2">
                  <div className="text-xs text-muted-foreground space-y-1 mb-3">
                    <p>{t('localBackup.reason')} {b.reason}</p>
                    <p>{t('localBackup.time')} {new Date(b.timestamp).toLocaleString(language === 'ar' ? 'ar' : language === 'tr' ? 'tr' : 'en')}</p>
                    <p>{t('localBackup.size')} {formatBackupSize(b.size)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(b.id)}
                    className="gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('localBackup.restore')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
