-- Drop existing UPDATE policy on profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create new UPDATE policy that allows:
-- 1. Users to update their own profile
-- 2. Boss users to update any profile
-- 3. Admin users to update profiles of users in their tenant
CREATE POLICY "Users can update profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  OR is_boss(auth.uid()) 
  OR (
    has_role(auth.uid(), 'admin') 
    AND get_owner_id(user_id) = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id 
  OR is_boss(auth.uid()) 
  OR (
    has_role(auth.uid(), 'admin') 
    AND get_owner_id(user_id) = auth.uid()
  )
);