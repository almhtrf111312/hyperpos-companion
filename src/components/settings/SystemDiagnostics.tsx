import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Users, 
  Shield, 
  Key,
  RefreshCw,
  Loader2,
  AlertCircle,
  UserX,
  UserCheck,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface DiagnosticUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  has_role: boolean;
  has_profile: boolean;
  has_license: boolean;
  license_expires: string | null;
  license_revoked: boolean;
  is_active: boolean;
  issues: string[];
}

interface DiagnosticStats {
  total_users: number;
  users_with_roles: number;
  users_without_roles: number;
  users_with_licenses: number;
  expired_licenses: number;
  revoked_licenses: number;
  active_admins: number;
  active_cashiers: number;
}

export function SystemDiagnostics() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<DiagnosticUser[]>([]);
  const [stats, setStats] = useState<DiagnosticStats | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDiagnostics = async () => {
    setIsLoading(true);
    try {
      // Fetch all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, is_active, owner_id, created_at');

      if (rolesError) throw rolesError;

      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (profilesError) throw profilesError;

      // Fetch all licenses
      const { data: licensesData, error: licensesError } = await supabase
        .from('app_licenses')
        .select('user_id, expires_at, is_revoked, is_trial, license_tier');

      if (licensesError) throw licensesError;

      // Fetch user emails via edge function
      const userIds = rolesData?.map(r => r.user_id) || [];
      let emailMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        try {
          const { data: emailsData, error: emailsError } = await supabase.functions.invoke('get-users-emails', {
            body: { userIds },
          });
          
          if (!emailsError && emailsData?.emails) {
            emailMap = emailsData.emails;
          }
        } catch (e) {
          console.error('Error fetching user emails:', e);
        }
      }

      // Build diagnostic users
      const diagnosticUsers: DiagnosticUser[] = [];
      const now = new Date();

      // Create a set of all user IDs from roles
      const roleUserIds = new Set(rolesData?.map(r => r.user_id) || []);
      const profileUserIds = new Set(profilesData?.map(p => p.user_id) || []);
      const licenseUserIds = new Set(licensesData?.map(l => l.user_id) || []);

      // Get all unique user IDs
      const allUserIds = new Set([...roleUserIds, ...profileUserIds, ...licenseUserIds]);

      for (const userId of allUserIds) {
        const role = rolesData?.find(r => r.user_id === userId);
        const profile = profilesData?.find(p => p.user_id === userId);
        const license = licensesData?.find(l => l.user_id === userId);
        
        const issues: string[] = [];
        
        // Check for missing role
        if (!role) {
          issues.push('دور مفقود');
        }
        
        // Check for missing profile
        if (!profile) {
          issues.push('ملف شخصي مفقود');
        }
        
        // Check license issues for admins
        if (role?.role === 'admin' || role?.role === 'boss') {
          if (!license) {
            issues.push('ترخيص مفقود');
          } else {
            const expiresAt = new Date(license.expires_at);
            if (expiresAt < now) {
              issues.push('ترخيص منتهي');
            }
            if (license.is_revoked) {
              issues.push('ترخيص ملغى');
            }
          }
        }
        
        // Check inactive role
        if (role && !role.is_active) {
          issues.push('دور غير نشط');
        }

        diagnosticUsers.push({
          user_id: userId,
          email: emailMap[userId] || 'غير معروف',
          full_name: profile?.full_name || null,
          role: role?.role || null,
          has_role: !!role,
          has_profile: !!profile,
          has_license: !!license,
          license_expires: license?.expires_at || null,
          license_revoked: license?.is_revoked || false,
          is_active: role?.is_active ?? false,
          issues,
        });
      }

      // Sort: users with issues first, then by role
      diagnosticUsers.sort((a, b) => {
        if (a.issues.length !== b.issues.length) {
          return b.issues.length - a.issues.length;
        }
        const roleOrder = { boss: 0, admin: 1, cashier: 2 };
        return (roleOrder[a.role as keyof typeof roleOrder] ?? 3) - (roleOrder[b.role as keyof typeof roleOrder] ?? 3);
      });

      // Calculate stats
      const statsData: DiagnosticStats = {
        total_users: allUserIds.size,
        users_with_roles: roleUserIds.size,
        users_without_roles: allUserIds.size - roleUserIds.size,
        users_with_licenses: licenseUserIds.size,
        expired_licenses: licensesData?.filter(l => new Date(l.expires_at) < now).length || 0,
        revoked_licenses: licensesData?.filter(l => l.is_revoked).length || 0,
        active_admins: rolesData?.filter(r => r.role === 'admin' && r.is_active).length || 0,
        active_cashiers: rolesData?.filter(r => r.role === 'cashier' && r.is_active).length || 0,
      };

      setUsers(diagnosticUsers);
      setStats(statsData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching diagnostics:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في جلب بيانات التشخيص',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const usersWithIssues = users.filter(u => u.issues.length > 0);
  const healthyUsers = users.filter(u => u.issues.length === 0);

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'boss':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">بوس</Badge>;
      case 'admin':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">مدير</Badge>;
      case 'cashier':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">كاشير</Badge>;
      default:
        return <Badge variant="destructive">بدون دور</Badge>;
    }
  };

  const getStatusIcon = (user: DiagnosticUser) => {
    if (user.issues.length === 0) {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    if (user.issues.some(i => i.includes('مفقود'))) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="mr-2 text-muted-foreground">جاري تحميل بيانات التشخيص...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            تشخيص النظام
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            آخر تحديث: {format(lastRefresh, 'PPpp', { locale: ar })}
          </p>
        </div>
        <Button onClick={fetchDiagnostics} variant="outline" disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total_users}</p>
                  <p className="text-xs text-muted-foreground">إجمالي المستخدمين</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.users_with_roles}</p>
                  <p className="text-xs text-muted-foreground">لديهم أدوار</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stats.users_without_roles > 0 ? 'bg-red-500/20' : 'bg-muted'}`}>
                  <UserX className={`w-5 h-5 ${stats.users_without_roles > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${stats.users_without_roles > 0 ? 'text-red-500' : ''}`}>
                    {stats.users_without_roles}
                  </p>
                  <p className="text-xs text-muted-foreground">بدون أدوار</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stats.expired_licenses > 0 ? 'bg-yellow-500/20' : 'bg-muted'}`}>
                  <Clock className={`w-5 h-5 ${stats.expired_licenses > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${stats.expired_licenses > 0 ? 'text-yellow-500' : ''}`}>
                    {stats.expired_licenses}
                  </p>
                  <p className="text-xs text-muted-foreground">تراخيص منتهية</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Issues Alert */}
      {usersWithIssues.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-500 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              مستخدمين لديهم مشاكل ({usersWithIssues.length})
            </CardTitle>
            <CardDescription>
              هؤلاء المستخدمين لديهم مشاكل تحتاج إلى إصلاح
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">البريد</TableHead>
                  <TableHead className="text-right">الدور</TableHead>
                  <TableHead className="text-right">المشاكل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersWithIssues.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>{getStatusIcon(user)}</TableCell>
                    <TableCell className="font-medium">
                      {user.full_name || 'بدون اسم'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {user.email}
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.issues.map((issue, idx) => (
                          <Badge key={idx} variant="destructive" className="text-xs">
                            {issue}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Healthy Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            مستخدمين بدون مشاكل ({healthyUsers.length})
          </CardTitle>
          <CardDescription>
            جميع هؤلاء المستخدمين لديهم إعدادات صحيحة
          </CardDescription>
        </CardHeader>
        <CardContent>
          {healthyUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">لا يوجد مستخدمين</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">البريد</TableHead>
                  <TableHead className="text-right">الدور</TableHead>
                  <TableHead className="text-right">انتهاء الترخيص</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthyUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>{getStatusIcon(user)}</TableCell>
                    <TableCell className="font-medium">
                      {user.full_name || 'بدون اسم'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {user.email}
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {user.license_expires ? (
                        <span className={`text-sm ${
                          new Date(user.license_expires) < new Date() 
                            ? 'text-red-500' 
                            : 'text-green-500'
                        }`}>
                          {format(new Date(user.license_expires), 'yyyy/MM/dd', { locale: ar })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* System Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            ملخص التراخيص
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">تراخيص نشطة</p>
              <p className="text-2xl font-bold text-green-500">{stats?.users_with_licenses || 0}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">تراخيص منتهية</p>
              <p className={`text-2xl font-bold ${(stats?.expired_licenses || 0) > 0 ? 'text-yellow-500' : ''}`}>
                {stats?.expired_licenses || 0}
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">تراخيص ملغاة</p>
              <p className={`text-2xl font-bold ${(stats?.revoked_licenses || 0) > 0 ? 'text-red-500' : ''}`}>
                {stats?.revoked_licenses || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
