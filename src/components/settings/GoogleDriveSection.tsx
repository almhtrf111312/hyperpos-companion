import { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudOff, 
  Upload, 
  Download, 
  Trash2, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Settings,
  FolderOpen,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  getStoredClientId,
  setStoredClientId,
  getStoredTokens,
  setStoredTokens,
  getStoredFolderId,
  setStoredFolderId,
  isTokenValid,
  initiateGoogleAuth,
  parseAuthCallback,
  getUserInfo,
  getOrCreateBackupFolder,
  listBackupFiles,
  uploadBackup,
  downloadBackup,
  deleteBackupFile,
  disconnectGoogleDrive,
  formatFileSize,
  getGoogleClientId,
  hasBuiltInClientId,
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
  
  // Check if built-in Client ID exists
  const builtInClientId = hasBuiltInClientId();
  
  // State
  const [clientId, setClientId] = useState(getStoredClientId() || '');
  const [isConnected, setIsConnected] = useState(false);
  const [userInfo, setUserInfo] = useState<GoogleDriveUserInfo | null>(null);
  const [tokens, setTokens] = useState<GoogleDriveTokens | null>(getStoredTokens());
  const [folderId, setFolderId] = useState<string | null>(getStoredFolderId());
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [autoUpload, setAutoUpload] = useState(false);
  
  // Dialogs
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);

  // Check for OAuth callback on mount
  useEffect(() => {
    const callbackTokens = parseAuthCallback();
    if (callbackTokens) {
      handleAuthCallback(callbackTokens);
    }
  }, []);

  // Check connection status on mount
  useEffect(() => {
    const storedTokens = getStoredTokens();
    if (storedTokens && isTokenValid(storedTokens)) {
      setTokens(storedTokens);
      initializeConnection(storedTokens);
    }
  }, []);

  const handleAuthCallback = async (newTokens: GoogleDriveTokens) => {
    setTokens(newTokens);
    setStoredTokens(newTokens);
    await initializeConnection(newTokens);
    
    toast({
      title: 'تم الربط بنجاح',
      description: 'تم ربط حساب Google Drive بنجاح',
    });
  };

  const initializeConnection = async (authTokens: GoogleDriveTokens) => {
    setIsLoading(true);
    try {
      // Get user info
      const info = await getUserInfo(authTokens.access_token);
      if (info) {
        setUserInfo(info);
        setIsConnected(true);
      }

      // Get or create backup folder
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

      // List files
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

  const handleConnect = () => {
    // Use built-in Client ID if available, otherwise use manual input
    const clientIdToUse = getGoogleClientId() || clientId.trim();
    
    if (!clientIdToUse) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال معرف العميل (Client ID)',
        variant: 'destructive',
      });
      return;
    }
    
    // Store if using manual input
    if (!builtInClientId && clientId.trim()) {
      setStoredClientId(clientId.trim());
    }
    
    initiateGoogleAuth(clientIdToUse);
  };

  // Direct connect for built-in Client ID
  const handleDirectConnect = () => {
    const envClientId = getGoogleClientId();
    if (envClientId) {
      initiateGoogleAuth(envClientId);
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
            isConnected ? "bg-green-500/20" : "bg-muted"
          )}>
            {isConnected ? (
              <Cloud className="w-5 h-5 text-green-500" />
            ) : (
              <CloudOff className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-medium text-foreground">Google Drive</h3>
            <p className="text-sm text-muted-foreground">
              {isConnected ? (
                <>
                  <CheckCircle2 className="w-3 h-3 inline ml-1 text-green-500" />
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
        ) : builtInClientId ? (
          <Button size="sm" onClick={handleDirectConnect} className="bg-blue-600 hover:bg-blue-700">
            <Cloud className="w-4 h-4 ml-1" />
            ربط Google Drive
          </Button>
        ) : (
          <Button size="sm" onClick={() => setSetupDialogOpen(true)}>
            <Cloud className="w-4 h-4 ml-1" />
            إعداد Google Drive
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

          {/* Cloud Backup Button - Prominent */}
          <Button 
            onClick={handleUploadToDrive} 
            disabled={isUploading}
            className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base"
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
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Cloud className="w-5 h-5 text-blue-500" />
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

      {/* Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              إعداد Google Drive
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <div className="flex gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-500 mb-1">إعداد مطلوب</p>
                  <p className="text-muted-foreground">
                    لربط Google Drive، تحتاج إلى إنشاء مشروع في Google Cloud Console والحصول على Client ID.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-foreground">خطوات الإعداد:</h4>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>اذهب إلى <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="w-3 h-3" /></a></li>
                <li>أنشئ مشروع جديد أو اختر مشروع موجود</li>
                <li>فعّل Google Drive API من قسم APIs & Services</li>
                <li>اذهب إلى Credentials وأنشئ OAuth 2.0 Client ID</li>
                <li>اختر "Web application" وأضف النطاق: <code className="px-1 py-0.5 bg-muted rounded">{window.location.origin}</code></li>
                <li>انسخ Client ID والصقه أدناه</li>
              </ol>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">معرف العميل (Client ID)</label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxx.apps.googleusercontent.com"
                dir="ltr"
                className="font-mono text-sm"
              />
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSetupDialogOpen(false)} className="w-full sm:w-auto">
              إلغاء
            </Button>
            <Button onClick={handleConnect} className="w-full sm:w-auto">
              <Cloud className="w-4 h-4 ml-2" />
              ربط الآن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteFileDialogOpen} onOpenChange={setDeleteFileDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">
            هل أنت متأكد من حذف النسخة "{selectedFile?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
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
