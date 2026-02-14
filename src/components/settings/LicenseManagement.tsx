import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  Calendar,
  Users,
  Shield,
  Crown,
  ExternalLink,
  Ban,
  Mail
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useUserRole } from '@/hooks/use-user-role';
import { useNavigate } from 'react-router-dom';

interface ActivationCode {
  id: string;
  code: string;
  duration_days: number;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
  expires_at: string | null;
}

interface License {
  id: string;
  user_id: string;
  activated_at: string;
  expires_at: string;
  is_trial: boolean;
  is_revoked: boolean;
  license_tier: string | null;
  max_cashiers: number | null;
  profiles?: { full_name: string | null } | null;
  email?: string;
}

export function LicenseManagement() {
  const { toast } = useToast();
  const { t, isRTL, language } = useLanguage();
  const { isBoss } = useUserRole();
  const navigate = useNavigate();

  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCodeCreated, setNewCodeCreated] = useState<string | null>(null);
  const [deleteCodeTarget, setDeleteCodeTarget] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<License | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<License | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [newCodeForm, setNewCodeForm] = useState({
    durationDays: 180,
    maxUses: 1,
    note: '',
  });

  const getLocale = () => {
    if (language === 'ar') return 'ar-SA';
    if (language === 'tr') return 'tr-TR';
    if (language === 'fa') return 'fa-IR';
    return 'en-US';
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: codesData, error: codesError } = await supabase
        .from('activation_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (codesError) throw codesError;
      setCodes(codesData || []);

      const { data: licensesData, error: licensesError } = await supabase
        .from('app_licenses')
        .select('*')
        .order('created_at', { ascending: false });
      if (licensesError) throw licensesError;

      if (licensesData && licensesData.length > 0) {
        const userIds = licensesData.map(l => l.user_id);
        
        const [profilesResult, emailsResult] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
          supabase.functions.invoke('get-users-emails', { body: { userIds } }).catch(() => ({ data: null })),
        ]);

        const emailMap: Record<string, string> = emailsResult.data?.emails || {};

        const licensesWithDetails = licensesData.map(license => ({
          ...license,
          profiles: profilesResult.data?.find(p => p.user_id === license.user_id) || null,
          email: emailMap[license.user_id] || undefined,
        }));
        setLicenses(licensesWithDetails);
      } else {
        setLicenses([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: t('common.error'), description: t('licenseManagement.loadFailed'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const parts = [];
    for (let i = 0; i < 4; i++) {
      let part = '';
      for (let j = 0; j < 4; j++) {
        part += chars.charAt(array[i * 4 + j] % chars.length);
      }
      parts.push(part);
    }
    return `HYPER-${parts.join('-')}`;
  };

  const handleCreateCode = async () => {
    setIsCreating(true);
    try {
      const code = generateCode();
      const { error } = await supabase.from('activation_codes').insert({
        code, duration_days: newCodeForm.durationDays, max_uses: newCodeForm.maxUses, note: newCodeForm.note || null,
      });
      if (error) throw error;
      setNewCodeCreated(code);
      fetchData();
      toast({ title: t('licenseManagement.created'), description: t('licenseManagement.codeCreatedSuccess') });
    } catch (error) {
      console.error('Error creating code:', error);
      toast({ title: t('common.error'), description: t('licenseManagement.createFailed'), variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: t('licenseManagement.copied'), description: t('licenseManagement.codeCopied') });
    } catch {
      toast({ title: t('common.error'), description: t('licenseManagement.copyFailed'), variant: 'destructive' });
    }
  };

  const handleDeleteCode = async (id: string) => {
    try {
      const { error } = await supabase.from('activation_codes').delete().eq('id', id);
      if (error) throw error;
      setDeleteCodeTarget(null);
      fetchData();
      toast({ title: t('licenseManagement.deleted'), description: t('licenseManagement.codeDeleted') });
    } catch (error) {
      console.error('Error deleting code:', error);
      toast({ title: t('common.error'), description: t('licenseManagement.deleteFailed'), variant: 'destructive' });
    }
  };

  const handleRevokeLicense = async (license: License) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('revoke_license', { _license_id: license.id, _reason: 'Revoked by boss' });
      if (error) throw error;
      setRevokeTarget(null);
      fetchData();
      toast({ title: t('licenseManagement.revoked'), description: t('licenseManagement.licenseRevoked') });
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (license: License) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: license.user_id, deleteType: 'owner' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDeleteUserTarget(null);
      fetchData();
      toast({ title: t('licenseManagement.deleted'), description: t('licenseManagement.userDeleted') });
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(getLocale(), { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    setNewCodeCreated(null);
    setNewCodeForm({ durationDays: 180, maxUses: 1, note: '' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isBoss) {
    return (
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('licenseManagement.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('licenseManagement.bossOnly')}</p>
          </div>
        </div>
        <div className="bg-muted/50 rounded-xl p-6 text-center space-y-4">
          <Crown className="w-12 h-12 mx-auto text-amber-500" />
          <p className="text-muted-foreground">
            {t('licenseManagement.bossOnlyDesc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('licenseManagement.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('licenseManagement.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/boss')}>
            <ExternalLink className="w-4 h-4" />
            <span className="ms-2">{t('licenseManagement.bossPanel')}</span>
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            <span className="ms-2">{t('licenseManagement.createCode')}</span>
          </Button>
        </div>
      </div>

      {/* Activation Codes Section */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Key className="w-4 h-4" />
          {t('licenseManagement.activationCodes')} ({codes.length})
        </h3>
        
        {codes.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">{t('licenseManagement.noCodes')}</p>
        ) : (
          <div className="space-y-2">
            {codes.map((code) => (
              <div key={code.id} className="flex flex-col gap-2 p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <code className="text-sm font-mono truncate">{code.code}</code>
                  <Badge variant={code.is_active && code.current_uses < code.max_uses ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {code.current_uses}/{code.max_uses}
                  </Badge>
                  {!code.is_active && <Badge variant="destructive" className="text-xs">{t('licenseManagement.inactive')}</Badge>}
                  {code.note && <span className="text-xs text-muted-foreground truncate">{code.note}</span>}
                </div>
                <div className="flex items-center gap-1 border-t border-border/50 pt-2">
                  <span className="text-xs text-muted-foreground flex-1">{code.duration_days}{t('licenseManagement.days')}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyCode(code.code)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteCodeTarget(code.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Licenses */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" />
          {t('licenseManagement.licenses')} ({licenses.length})
        </h3>
        
        {licenses.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">{t('licenseManagement.noLicenses')}</p>
        ) : (
          <div className="space-y-2">
            {licenses.map((license) => {
              const isExpired = new Date(license.expires_at) < new Date();
              const isRevoked = license.is_revoked;
              return (
                <div 
                  key={license.id} 
                  className={`flex flex-col gap-2 p-3 rounded-lg ${
                    isRevoked ? 'bg-destructive/10' : isExpired ? 'bg-yellow-500/10' : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {license.profiles?.full_name || t('licenseManagement.user')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      isRevoked 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : license.is_trial 
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' 
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {isRevoked ? t('licenseManagement.revoked') : license.is_trial ? t('licenseManagement.trial') : t('licenseManagement.active')}
                    </span>
                  </div>
                  {license.email && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {license.email}
                    </span>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {license.license_tier && (
                      <Badge variant="outline" className="text-xs">{license.license_tier}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {t('licenseManagement.expires')} {formatDate(license.expires_at)}
                      {isExpired && <span className="text-destructive font-medium">({t('licenseManagement.expired')})</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 border-t border-border/50 pt-2">
                    {!isRevoked && (
                      <Button size="sm" variant="outline" className="text-xs gap-1 text-yellow-600 flex-1" onClick={() => setRevokeTarget(license)}>
                        <Ban className="w-3 h-3" /> {t('licenseManagement.revoke')}
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" className="text-xs gap-1 flex-1" onClick={() => setDeleteUserTarget(license)}>
                      <Trash2 className="w-3 h-3" /> {t('common.delete')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Code Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={closeCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newCodeCreated ? t('licenseManagement.codeCreated') : t('licenseManagement.createNewCode')}
            </DialogTitle>
          </DialogHeader>

          {newCodeCreated ? (
            <div className="py-6 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <code className="block text-lg font-mono bg-muted px-4 py-2 rounded-lg mb-4">{newCodeCreated}</code>
              <Button onClick={() => handleCopyCode(newCodeCreated)} className="w-full">
                <Copy className="w-4 h-4" />
                <span className="ms-2">{t('licenseManagement.copyCode')}</span>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('licenseManagement.duration')}</label>
                  <div className="flex gap-2">
                    <Button type="button" variant={newCodeForm.durationDays === 180 ? 'default' : 'outline'} className="flex-1" onClick={() => setNewCodeForm({ ...newCodeForm, durationDays: 180 })}>
                      {t('licenseManagement.sixMonths')}
                    </Button>
                    <Button type="button" variant={newCodeForm.durationDays === 365 ? 'default' : 'outline'} className="flex-1" onClick={() => setNewCodeForm({ ...newCodeForm, durationDays: 365 })}>
                      {t('licenseManagement.oneYear')}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('licenseManagement.maxUses')}</label>
                  <Input type="number" min={1} max={100} value={newCodeForm.maxUses} onChange={(e) => setNewCodeForm({ ...newCodeForm, maxUses: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('licenseManagement.noteOptional')}</label>
                  <Input placeholder={t('licenseManagement.notePlaceholder')} value={newCodeForm.note} onChange={(e) => setNewCodeForm({ ...newCodeForm, note: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCreateDialog}>{t('common.cancel')}</Button>
                <Button onClick={handleCreateCode} disabled={isCreating}>
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span className="ms-2">{t('licenseManagement.createCode')}</span>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Code Confirmation */}
      <AlertDialog open={!!deleteCodeTarget} onOpenChange={(open) => !open && setDeleteCodeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('licenseManagement.confirmDeleteCode')}</AlertDialogTitle>
            <AlertDialogDescription>{t('licenseManagement.confirmDeleteCodeDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteCodeTarget && handleDeleteCode(deleteCodeTarget)}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke License Confirmation */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('licenseManagement.confirmRevoke')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('licenseManagement.confirmRevokeDesc').replace('{name}', revokeTarget?.profiles?.full_name || revokeTarget?.email || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-yellow-600 text-white hover:bg-yellow-700"
              disabled={isProcessing}
              onClick={(e) => { e.preventDefault(); if (revokeTarget) handleRevokeLicense(revokeTarget); }}
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {t('licenseManagement.revokeLicense')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUserTarget} onOpenChange={(open) => !open && setDeleteUserTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('licenseManagement.confirmDeleteUser')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('licenseManagement.confirmDeleteUserDesc').replace('{name}', deleteUserTarget?.profiles?.full_name || deleteUserTarget?.email || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isProcessing}
              onClick={(e) => { e.preventDefault(); if (deleteUserTarget) handleDeleteUser(deleteUserTarget); }}
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {t('licenseManagement.deletePermanently')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}