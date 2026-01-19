-- Fix app_licenses RLS policies: Convert RESTRICTIVE to PERMISSIVE
-- Current RESTRICTIVE policies use AND logic which blocks regular users

-- Drop existing restrictive policies on app_licenses
DROP POLICY IF EXISTS "Users can view own license" ON public.app_licenses;
DROP POLICY IF EXISTS "Users can insert own license" ON public.app_licenses;
DROP POLICY IF EXISTS "Users can update own license" ON public.app_licenses;
DROP POLICY IF EXISTS "Admins can view all licenses" ON public.app_licenses;
DROP POLICY IF EXISTS "Admins can manage all licenses" ON public.app_licenses;

-- Create PERMISSIVE policies (default behavior uses OR logic)
CREATE POLICY "Users can view own license"
  ON public.app_licenses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own license"
  ON public.app_licenses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own license"
  ON public.app_licenses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete licenses"
  ON public.app_licenses
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Also fix profiles table RESTRICTIVE policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix user_roles table RESTRICTIVE policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow first user to create admin role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Users can view own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Allow first user to create admin role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_first_user());

-- Fix activation_codes table RESTRICTIVE policies
DROP POLICY IF EXISTS "Admins can delete codes" ON public.activation_codes;
DROP POLICY IF EXISTS "Admins can insert codes" ON public.activation_codes;
DROP POLICY IF EXISTS "Admins can update codes" ON public.activation_codes;
DROP POLICY IF EXISTS "Admins can view all codes" ON public.activation_codes;

CREATE POLICY "Admins can manage codes"
  ON public.activation_codes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));