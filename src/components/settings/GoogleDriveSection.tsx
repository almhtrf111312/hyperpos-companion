import { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudOff, 
  Download, 
  Trash2, 
  RefreshCw,
  CheckCircle2,
  FolderOpen,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { lovable } from '@/integrations/lovable/index';
import { supabase } from '@/integrations/supabase/client';
import {
  getStoredTokens,
  setStoredTokens,
  getStoredFolderId,
  setStoredFolderId,
  isTokenValid,
  getUserInfo,
  getOrCreateBackupFolder,
  listBackupFiles,
  uploadBackup,
  downloadBackup,
  deleteBackupFile,
  disconnectGoogleDrive,
  formatFileSize,
  GoogleDriveFile,
  GoogleDriveUserInfo,
  GoogleDriveTokens,
} from '@/lib/google-drive';

interface GoogleDriveSectionProps {
  getBackupData: () => object;
  onRestoreBackup: (data: object) => void;
}

export default function GoogleDriveSection({ getBackupData, onRestoreBackup }: GoogleDriveSectionProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  
  const [isConnected, setIsConnected] = useState(false);
  const [userInfo, setUserInfo] = useState<GoogleDriveUserInfo | null>(null);
  const [tokens, setTokens] = useState<GoogleDriveTokens | null>(getStoredTokens());
  const [folderId, setFolderId] = useState<string | null>(getStoredFolderId());
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [autoUpload, setAutoUpload] = useState(false);
  
  const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);

  const doDisconnect = () => {
    disconnectGoogleDrive();
    setIsConnected(false); setUserInfo(null); setTokens(null); setFolderId(null); setDriveFiles([]);
  };

  useEffect(() => {
    const handleAutoUpload = async () => {
      if (autoUpload && isConnected && tokens && folderId) {
        if (!isTokenValid(tokens)) {
          toast({ title: t('gdrive.sessionExpired'), description: t('gdrive.reconnectRequired'), variant: 'destructive' });
          doDisconnect();
          return;
        }
        setIsUploading(true);
        try {
          const backupData = getBackupData();
          const fileName = `hyperpos_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
          const uploadedFile = await uploadBackup(tokens.access_token, folderId, fileName, backupData);
          if (uploadedFile) {
            setDriveFiles(prev => [uploadedFile, ...prev]);
          } else { throw new Error('Upload failed'); }
        } catch {
          toast({ title: t('password.error'), description: t('gdrive.uploadFailed'), variant: 'destructive' });
        } finally { setIsUploading(false); }
      }
    };

    let intervalId: NodeJS.Timeout;
    if (autoUpload) {
      intervalId = setInterval(handleAutoUpload, 6 * 60 * 60 * 1000);
      handleAutoUpload();
    }

    return () => clearInterval(intervalId);
  }, [autoUpload, isConnected, tokens, folderId, getBackupData, t]);

  useEffect(() => {
    const storedTokens = getStoredTokens();
    if (storedTokens && isTokenValid(storedTokens)) {
      setTokens(storedTokens);
      initializeConnection(storedTokens);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.provider_token) {
        const newTokens: GoogleDriveTokens = {
          access_token: session.provider_token,
          expires_at: Date.now() + 3600 * 1000,
        };
        setStoredTokens(newTokens);
        setTokens(newTokens);
        await initializeConnection(newTokens);
        
        toast({ title: t('gdrive.linkedSuccess'), description: t('gdrive.linkedDesc') });
        setIsSigningIn(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const initializeConnection = async (authTokens: GoogleDriveTokens) => {
    setIsLoading(true);
    try {
      const info = await getUserInfo(authTokens.access_token);
      if (info) { setUserInfo(info); setIsConnected(true); }
      let folder = getStoredFolderId();
      if (!folder) {
        folder = await getOrCreateBackupFolder(authTokens.access_token);
        if (folder) { setStoredFolderId(folder); setFolderId(folder); }
      } else { setFolderId(folder); }
      if (folder) { const files = await listBackupFiles(authTokens.access_token, folder); setDriveFiles(files); }
    } catch (error) { console.error('Failed to initialize Google Drive connection:', error); }
    finally { setIsLoading(false); }
  };

  const handleSignInWithGoogle = async () => {
    setIsSigningIn(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "consent", access_type: "offline" },
      });
      if (error) {
        console.error('Google sign-in error:', error);
        toast({ title: t('password.error'), description: t('gdrive.signInFailed'), variant: 'destructive' });
        setIsSigningIn(false);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      toast({ title: t('password.error'), description: t('gdrive.signInFailed'), variant: 'destructive' });
      setIsSigningIn(false);
    }
  };

  const handleDisconnect = () => {
    doDisconnect();
    toast({ title: t('gdrive.unlinkSuccess'), description: t('gdrive.unlinkDesc') });
  };

  const handleRefreshFiles = async () => {
    if (!tokens || !folderId) return;
    setIsLoading(true);
    try {
      const files = await listBackupFiles(tokens.access_token, folderId);
      setDriveFiles(files);
      toast({ title: t('gdrive.refreshSuccess'), description: t('gdrive.refreshDesc') });
    } catch {
      toast({ title: t('password.error'), description: t('gdrive.refreshFailed'), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleUploadToDrive = async () => {
    if (!tokens || !folderId) return;
    if (!isTokenValid(tokens)) {
      toast({ title: t('gdrive.sessionExpired'), description: t('gdrive.reconnectRequired'), variant: 'destructive' });
      handleDisconnect(); return;
    }
    setIsUploading(true);
    try {
      const backupData = getBackupData();
      const fileName = `hyperpos_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
      const uploadedFile = await uploadBackup(tokens.access_token, folderId, fileName, backupData);
      if (uploadedFile) {
        setDriveFiles(prev => [uploadedFile, ...prev]);
        toast({ title: t('gdrive.backupSuccess'), description: t('gdrive.backupSuccessDesc') });
      } else { throw new Error('Upload failed'); }
    } catch {
      toast({ title: t('password.error'), description: t('gdrive.uploadFailed'), variant: 'destructive' });
    } finally { setIsUploading(false); }
  };

  const handleDownloadFromDrive = async (file: GoogleDriveFile) => {
    if (!tokens) return;
    setIsLoading(true);
    try {
      const data = await downloadBackup(tokens.access_token, file.id);
      if (data) {
        onRestoreBackup(data);
        toast({ title: t('gdrive.restoreSuccess'), description: `${t('gdrive.restoredFrom')} ${file.name}` });
      } else { throw new Error('Download failed'); }
    } catch {
      toast({ title: t('password.error'), description: t('gdrive.downloadFailed'), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleDeleteFromDrive = async () => {
    if (!tokens || !selectedFile) return;
    try {
      const success = await deleteBackupFile(tokens.access_token, selectedFile.id);
      if (success) {
        setDriveFiles(prev => prev.filter(f => f.id !== selectedFile.id));
        toast({ title: t('gdrive.deleteSuccess'), description: t('gdrive.deleteSuccessDesc') });
      } else { throw new Error('Delete failed'); }
    } catch {
      toast({ title: t('password.error'), description: t('gdrive.deleteFailed'), variant: 'destructive' });
    } finally { setDeleteFileDialogOpen(false); setSelectedFile(null); }
  };

  const openDeleteDialog = (file: GoogleDriveFile) => { setSelectedFile(file); setDeleteFileDialogOpen(true); };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isConnected ? "bg-success/20" : "bg-muted")}>
            {isConnected ? <Cloud className="w-5 h-5 text-success" /> : <CloudOff className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div>
            <h3 className="font-medium text-foreground">{t('gdrive.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {isConnected ? (<><CheckCircle2 className="w-3 h-3 inline ml-1 text-success" />{t('gdrive.connected')} {userInfo?.email}</>) : t('gdrive.notConnected')}
            </p>
          </div>
        </div>
        
        {isConnected ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshFiles} disabled={isLoading}>
              <RefreshCw className={cn("w-4 h-4 ml-1", isLoading && "animate-spin")} />
              {t('gdrive.refresh')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDisconnect}>{t('gdrive.disconnect')}</Button>
          </div>
        ) : (
          <Button size="sm" onClick={handleSignInWithGoogle} disabled={isSigningIn} className="bg-primary hover:bg-primary/90">
            {isSigningIn ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Cloud className="w-4 h-4 ml-1" />}
            {t('gdrive.signIn')}
          </Button>
        )}
      </div>

      {isConnected && (
        <>
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <div className="flex-1 ml-4">
              <p className="font-medium text-foreground">{t('gdrive.autoUpload')}</p>
              <p className="text-sm text-muted-foreground">{t('gdrive.autoUploadDesc')}</p>
            </div>
            <Switch checked={autoUpload} onCheckedChange={setAutoUpload} />
          </div>

          <Button onClick={handleUploadToDrive} disabled={isUploading} className="w-full bg-primary hover:bg-primary/90 h-12 text-base">
            {isUploading ? (<><Loader2 className="w-5 h-5 ml-2 animate-spin" />{t('gdrive.backingUp')}</>) : (<><Cloud className="w-5 h-5 ml-2" />{t('gdrive.cloudBackup')}</>)}
          </Button>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-foreground">{t('gdrive.savedInDrive')}</h4>
            </div>
            
            {driveFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Cloud className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('gdrive.noBackups')}</p>
              </div>
            ) : (
              driveFiles.map((file) => (
                <div key={file.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Cloud className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)} • {formatDate(file.createdTime)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => handleDownloadFromDrive(file)} disabled={isLoading}>
                      <Download className="w-4 h-4 ml-1" />{t('gdrive.restore')}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(file)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <Dialog open={deleteFileDialogOpen} onOpenChange={setDeleteFileDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('gdrive.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">{t('gdrive.deleteConfirmMsg')}</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteFileDialogOpen(false)} className="w-full sm:w-auto">{t('gdrive.cancel')}</Button>
            <Button variant="destructive" onClick={handleDeleteFromDrive} className="w-full sm:w-auto">{t('gdrive.deleteBackup')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
