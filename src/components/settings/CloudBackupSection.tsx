import { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  FolderOpen,
  Loader2,
  CloudUpload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import {
  uploadCloudBackup,
  listCloudBackups,
  downloadCloudBackup,
  deleteCloudBackup,
  formatBackupSize,
  CloudBackupFile,
} from '@/lib/cloud-backup';

interface CloudBackupSectionProps {
  onRestoreBackup: (data: object) => void;
}

export default function CloudBackupSection({ onRestoreBackup }: CloudBackupSectionProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();

  const [backups, setBackups] = useState<CloudBackupFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [autoUpload, setAutoUpload] = useState(() => {
    try {
      return localStorage.getItem('hp_cloud_auto_backup') === 'true';
    } catch { return false; }
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<CloudBackupFile | null>(null);

  const loadBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const files = await listCloudBackups();
      setBackups(files);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  // Auto backup interval
  useEffect(() => {
    try {
      localStorage.setItem('hp_cloud_auto_backup', String(autoUpload));
    } catch { /* ignore */ }

    if (!autoUpload) return;

    const doAutoBackup = async () => {
      try {
        await uploadCloudBackup();
      } catch { /* silent */ }
    };

    // Backup every 6 hours
    const intervalId = setInterval(doAutoBackup, 6 * 60 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [autoUpload]);

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      const success = await uploadCloudBackup();
      if (success) {
        toast({ title: t('gdrive.backupSuccess') || 'تم النسخ الاحتياطي', description: t('gdrive.backupSuccessDesc') || 'تم رفع النسخة الاحتياطية بنجاح' });
        await loadBackups();
      } else {
        toast({ title: t('password.error') || 'خطأ', description: t('gdrive.uploadFailed') || 'فشل رفع النسخة الاحتياطية', variant: 'destructive' });
      }
    } catch {
      toast({ title: t('password.error') || 'خطأ', description: t('gdrive.uploadFailed') || 'فشل رفع النسخة الاحتياطية', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRestore = async (file: CloudBackupFile) => {
    setIsLoading(true);
    try {
      const data = await downloadCloudBackup(file.path);
      if (data) {
        onRestoreBackup(data);
        toast({ title: t('gdrive.restoreSuccess') || 'تم الاستعادة', description: `${t('gdrive.restoredFrom') || 'تمت الاستعادة من'} ${file.name}` });
      } else {
        toast({ title: t('password.error') || 'خطأ', description: t('gdrive.downloadFailed') || 'فشل تنزيل النسخة', variant: 'destructive' });
      }
    } catch {
      toast({ title: t('password.error') || 'خطأ', description: t('gdrive.downloadFailed') || 'فشل تنزيل النسخة', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;
    try {
      const success = await deleteCloudBackup(selectedFile.path);
      if (success) {
        setBackups(prev => prev.filter(f => f.path !== selectedFile.path));
        toast({ title: t('gdrive.deleteSuccess') || 'تم الحذف', description: t('gdrive.deleteSuccessDesc') || 'تم حذف النسخة الاحتياطية' });
      }
    } catch {
      toast({ title: t('password.error') || 'خطأ', description: t('gdrive.deleteFailed') || 'فشل الحذف', variant: 'destructive' });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedFile(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{t('gdrive.title') || 'النسخ الاحتياطي السحابي'}</h3>
            <p className="text-sm text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 inline ml-1 text-success" />
              {t('gdrive.connected') || 'متصل تلقائياً'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadBackups} disabled={isLoading}>
          <RefreshCw className={cn("w-4 h-4 ml-1", isLoading && "animate-spin")} />
          {t('gdrive.refresh') || 'تحديث'}
        </Button>
      </div>

      {/* Auto backup toggle */}
      <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
        <div className="flex-1 ml-4">
          <p className="font-medium text-foreground">{t('gdrive.autoUpload') || 'النسخ التلقائي'}</p>
          <p className="text-sm text-muted-foreground">{t('gdrive.autoUploadDesc') || 'نسخ احتياطي تلقائي كل 6 ساعات'}</p>
        </div>
        <Switch checked={autoUpload} onCheckedChange={setAutoUpload} />
      </div>

      {/* Upload button */}
      <Button onClick={handleUpload} disabled={isUploading} className="w-full bg-primary hover:bg-primary/90 h-12 text-base">
        {isUploading ? (
          <><Loader2 className="w-5 h-5 ml-2 animate-spin" />{t('gdrive.backingUp') || 'جاري النسخ...'}</>
        ) : (
          <><CloudUpload className="w-5 h-5 ml-2" />{t('gdrive.cloudBackup') || 'نسخ احتياطي الآن'}</>
        )}
      </Button>

      {/* Backups list */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">{t('gdrive.savedInDrive') || 'النسخ المحفوظة'}</h4>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Cloud className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('gdrive.noBackups') || 'لا توجد نسخ احتياطية'}</p>
          </div>
        ) : (
          backups.map((file) => (
            <div key={file.path} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Cloud className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBackupSize(file.size)} • {formatDate(file.createdAt)}</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => handleRestore(file)} disabled={isLoading}>
                  <Download className="w-4 h-4 ml-1" />{t('gdrive.restore') || 'استعادة'}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setSelectedFile(file); setDeleteDialogOpen(true); }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('gdrive.confirmDelete') || 'تأكيد الحذف'}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">{t('gdrive.deleteConfirmMsg') || 'هل أنت متأكد من حذف هذه النسخة الاحتياطية؟'}</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="w-full sm:w-auto">{t('gdrive.cancel') || 'إلغاء'}</Button>
            <Button variant="destructive" onClick={handleDelete} className="w-full sm:w-auto">{t('gdrive.deleteBackup') || 'حذف'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
