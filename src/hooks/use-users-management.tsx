import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserData {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'cashier';
}

export function useUsersManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch all user roles with profiles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        toast({
          title: 'خطأ',
          description: 'فشل في جلب بيانات المستخدمين',
          variant: 'destructive',
        });
        return;
      }

      // Fetch profiles for each user
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Combine data
      const combinedUsers: UserData[] = rolesData.map(role => {
        const profile = profilesData?.find(p => p.user_id === role.user_id);
        return {
          id: role.id,
          user_id: role.user_id,
          name: profile?.full_name || 'مستخدم',
          email: '', // We'll get this from auth if needed
          role: role.role as 'admin' | 'cashier',
        };
      });

      setUsers(combinedUsers);
    } catch (error) {
      console.error('Error in fetchUsers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const addUser = async (email: string, password: string, fullName: string, role: 'admin' | 'cashier') => {
    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) {
        toast({
          title: 'خطأ',
          description: authError.message,
          variant: 'destructive',
        });
        return false;
      }

      if (!authData.user) {
        toast({
          title: 'خطأ',
          description: 'فشل في إنشاء المستخدم',
          variant: 'destructive',
        });
        return false;
      }

      // Create role for the new user
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: role,
        });

      if (roleError) {
        console.error('Error creating role:', roleError);
        toast({
          title: 'تحذير',
          description: 'تم إنشاء المستخدم لكن فشل في تعيين الصلاحية',
          variant: 'destructive',
        });
      }

      toast({
        title: 'تمت الإضافة',
        description: `تم إضافة المستخدم ${fullName} بنجاح`,
      });

      await fetchUsers();
      return true;
    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إضافة المستخدم',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'cashier') => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) {
        toast({
          title: 'خطأ',
          description: 'فشل في تحديث صلاحية المستخدم',
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'تم التحديث',
        description: 'تم تحديث صلاحية المستخدم بنجاح',
      });

      await fetchUsers();
      return true;
    } catch (error) {
      console.error('Error updating role:', error);
      return false;
    }
  };

  const updateUserProfile = async (userId: string, fullName: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', userId);

      if (error) {
        toast({
          title: 'خطأ',
          description: 'فشل في تحديث بيانات المستخدم',
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'تم التحديث',
        description: 'تم تحديث بيانات المستخدم بنجاح',
      });

      await fetchUsers();
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

  const deleteUser = async (userId: string, roleId: string) => {
    try {
      // Delete the role first
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (roleError) {
        console.error('Error deleting role:', roleError);
        toast({
          title: 'خطأ',
          description: 'فشل في حذف المستخدم: ' + roleError.message,
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'تم الحذف',
        description: 'تم حذف المستخدم بنجاح',
      });

      await fetchUsers();
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حذف المستخدم',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    users,
    isLoading,
    fetchUsers,
    addUser,
    updateUserRole,
    updateUserProfile,
    deleteUser,
  };
}
