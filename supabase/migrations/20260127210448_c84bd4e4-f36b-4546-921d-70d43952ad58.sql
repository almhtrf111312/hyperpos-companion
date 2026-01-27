-- Drop existing policies on user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Allow first user to create admin role" ON public.user_roles;

-- Policy 1: Users can view their own role
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id
);

-- Policy 2: Admins can view roles of users they own (created)
CREATE POLICY "Admins can view owned users"
ON public.user_roles
FOR SELECT
USING (
  owner_id = auth.uid()
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Policy 3: Boss can view all roles
CREATE POLICY "Boss can view all roles"
ON public.user_roles
FOR SELECT
USING (
  is_boss(auth.uid())
);

-- Policy 4: Admins can insert roles for users they will own
CREATE POLICY "Admins can create owned users"
ON public.user_roles
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) AND owner_id = auth.uid())
  OR is_boss(auth.uid())
);

-- Policy 5: Allow first user to create admin role (for initial signup)
CREATE POLICY "Allow first user to create admin role"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND is_first_user()
);

-- Policy 6: Admins can update roles of users they own
CREATE POLICY "Admins can update owned users"
ON public.user_roles
FOR UPDATE
USING (
  (owner_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role))
  OR is_boss(auth.uid())
)
WITH CHECK (
  (owner_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role))
  OR is_boss(auth.uid())
);

-- Policy 7: Admins can delete roles of users they own
CREATE POLICY "Admins can delete owned users"
ON public.user_roles
FOR DELETE
USING (
  (owner_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role))
  OR is_boss(auth.uid())
);

-- Also update profiles policies to scope to owned users
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
);

-- Admins can view profiles of users they own
CREATE POLICY "Admins can view owned profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = profiles.user_id 
    AND user_roles.owner_id = auth.uid()
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Boss can view all profiles
CREATE POLICY "Boss can view all profiles"
ON public.profiles
FOR SELECT
USING (
  is_boss(auth.uid())
);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can update profiles of users they own
CREATE POLICY "Admins can update owned profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = profiles.user_id 
    AND user_roles.owner_id = auth.uid()
  )
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = profiles.user_id 
    AND user_roles.owner_id = auth.uid()
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Boss can update all profiles
CREATE POLICY "Boss can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_boss(auth.uid()))
WITH CHECK (is_boss(auth.uid()));