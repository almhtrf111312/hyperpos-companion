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
  
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [userInfo, setUserInfo] = useState<GoogleDriveUserInfo | null>(null);
  const [tokens, setTokens] = useState<GoogleDriveTokens | null>(getStoredTokens());
  const [folderId, setFolderId] = useState<string | null>(getStoredFolderId());
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [autoUpload, setAutoUpload] = useState(false);
  
  // Dialogs
  const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);

  // Check connection status on mount
  useEffect(() => {
    const storedTokens = getStoredTokens();
    if (storedTokens && isTokenValid(storedTokens)) {
      setTokens(storedTokens);
      initializeConnection(storedTokens);
    }
  }, []);

  // Listen for auth state changes to get Google provider token
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.provider_token) {
        // Got a Google provider token from OAuth sign-in
        const newTokens: GoogleDriveTokens = {
          access_token: session.provider_token,
          expires_at: Date.now() + 3600 * 1000, // 1 hour
        };
        setStoredTokens(newTokens);
        setTokens(newTokens);
        await initializeConnection(newTokens);
        
        toast({
          title: 'تم الربط بنجاح',
          description: 'تم ربط حساب Google Drive بنجاح',
        });
        setIsSigningIn(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const initializeConnection = async (authTokens: GoogleDriveTokens) => {
    setIsLoading(true);
    try {
      const info = await getUserInfo(authTokens.access_token);
      if (info) {
        setUserInfo(info);
        setIsConnected(true);
      }

      let folder = getStoredFolderId();
      if (!folder) {
        folder = await getOrCreateBackupFolder(authTokens.access_token);
        if (folder) {
          setStoredFolderId(folder);
          setFolderId(folder);
        }
      } else {
        setFolderId(folder);
      }

      if (folder) {
        const files = await listBackupFiles(authTokens.access_token, folder);
        setDriveFiles(files);
      }
    } catch (error) {
      console.error('Failed to initialize Google Drive connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInWithGoogle = async () => {
    setIsSigningIn(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: {
          prompt: "consent",
          access_type: "offline",
        },
      });
      
      if (error) {
        console.error('Google sign-in error:', error);
        toast({
          title: 'خطأ',
          description: 'فشل تسجيل الدخول بحساب Google',
          variant: 'destructive',
        });
        setIsSigningIn(false);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تسجيل الدخول بحساب Google',
        variant: 'destructive',
      });
      setIsSigningIn(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    setIsConnected(false);
    setUserInfo(null);
    setTokens(null);
    setFolderId(null);
    setDriveFiles([]);
    
    toast({
      title: 'تم إلغاء الربط',
      description: 'تم إلغاء ربط Google Drive',
    });
  };

  const handleRefreshFiles = async () => {
    if (!tokens || !folderId) return;
    
    setIsLoading(true);
    try {
      const files = await listBackupFiles(tokens.access_token, folderId);
      setDriveFiles(files);
      
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث قائمة الملفات',
      });
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل في تحديث قائمة الملفات',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadToDrive = async () => {
    if (!tokens || !folderId) return;
    
    if (!isTokenValid(tokens)) {
      toast({
        title: 'انتهت الجلسة',
        description: 'يرجى إعادة الربط مع Google Drive',
        variant: 'destructive',
      });
      handleDisconnect();
      return;
    }
    
    setIsUploading(true);
    try {
      const backupData = getBackupData();
      const fileName = `hyperpos_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
      
      const uploadedFile = await uploadBackup(tokens.access_token, folderId, fileName, backupData);
      
      if (uploadedFile) {
        setDriveFiles(prev => [uploadedFile, ...prev]);
        
        toast({
          title: '✅ تم النسخ الاحتياطي بنجاح',
          description: 'تم حفظ بياناتك في Google Drive',
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل في رفع النسخة الاحتياطية',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadFromDrive = async (file: GoogleDriveFile) => {
    if (!tokens) return;
    
    setIsLoading(true);
    try {
      const data = await downloadBackup(tokens.access_token, file.id);
      
      if (data) {
        onRestoreBackup(data);
        
        toast({
          title: 'تمت الاستعادة',
          description: `تم استعادة النسخة من ${file.name}`,
        });
      } else {
        throw new Error('Download failed');
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل في تنزيل النسخة الاحتياطية',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFromDrive = async () => {
    if (!tokens || !selectedFile) return;
    
    try {
      const success = await deleteBackupFile(tokens.access_token, selectedFile.id);
      
      if (success) {
        setDriveFiles(prev => prev.filter(f => f.id !== selectedFile.id));
        
        toast({
          title: 'تم الحذف',
          description: 'تم حذف النسخة من Google Drive',
        });
      } else {
        throw new Error('Delete failed');
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل في حذف النسخة',
        variant: 'destructive',
      });
    } finally {
      setDeleteFileDialogOpen(false);
      setSelectedFile(null);
    }
  };

  const openDeleteDialog = (file: GoogleDriveFile) => {
    setSelectedFile(file);
    setDeleteFileDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Google Drive Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            isConnected ? "bg-success/20" : "bg-muted"
          )}>
            {isConnected ? (
              <Cloud className="w-5 h-5 text-success" />
            ) : (
              <CloudOff className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-medium text-foreground">Google Drive</h3>
            <p className="text-sm text-muted-foreground">
              {isConnected ? (
                <>
                  <CheckCircle2 className="w-3 h-3 inline ml-1 text-success" />
                  متصل: {userInfo?.email}
                </>
              ) : (
                'غير متصل'
              )}
            </p>
          </div>
        </div>
        
        {isConnected ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshFiles} disabled={isLoading}>
              <RefreshCw className={cn("w-4 h-4 ml-1", isLoading && "animate-spin")} />
              تحديث
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDisconnect}>
              إلغاء الربط
            </Button>
          </div>
        ) : (
          <Button 
            size="sm" 
            onClick={handleSignInWithGoogle} 
            disabled={isSigningIn}
            className="bg-primary hover:bg-primary/90"
          >
            {isSigningIn ? (
              <Loader2 className="w-4 h-4 ml-1 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4 ml-1" />
            )}
            تسجيل الدخول بحساب Google
          </Button>
        )}
      </div>

      {/* Connected State */}
      {isConnected && (
        <>
          {/* Upload Options */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
            <div className="flex-1 ml-4">
              <p className="font-medium text-foreground">الرفع التلقائي</p>
              <p className="text-sm text-muted-foreground">رفع النسخ الاحتياطية تلقائياً عند إنشائها</p>
            </div>
            <Switch 
              checked={autoUpload}
              onCheckedChange={setAutoUpload}
            />
          </div>

          {/* Cloud Backup Button */}
          <Button 
            onClick={handleUploadToDrive} 
            disabled={isUploading}
            className="w-full bg-primary hover:bg-primary/90 h-12 text-base"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                جاري النسخ الاحتياطي...
              </>
            ) : (
              <>
                <Cloud className="w-5 h-5 ml-2" />
                نسخ احتياطي سحابي
              </>
            )}
          </Button>

          {/* Files List */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-foreground">النسخ المحفوظة في Drive</h4>
            </div>
            
            {driveFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Cloud className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>لا توجد نسخ احتياطية في Google Drive</p>
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
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} • {formatDate(file.createdTime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDownloadFromDrive(file)}
                      disabled={isLoading}
                    >
                      <Download className="w-4 h-4 ml-1" />
                      استعادة
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openDeleteDialog(file)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteFileDialogOpen} onOpenChange={setDeleteFileDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">
            هل أنت متأكد من حذف النسخة &quot;{selectedFile?.name}&quot;؟ لا يمكن التراجع عن هذا الإجراء.
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeleteFileDialogOpen(false)} className="w-full sm:w-auto">
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDeleteFromDrive} className="w-full sm:w-auto">
              حذف النسخة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
