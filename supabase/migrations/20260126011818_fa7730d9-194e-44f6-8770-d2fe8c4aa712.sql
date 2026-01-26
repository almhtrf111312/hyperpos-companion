-- Fix categories RLS policy to support owner/cashier relationship
-- Drop existing policy
DROP POLICY IF EXISTS "Users manage own categories" ON public.categories;

-- Create new policy that uses get_owner_id() for proper owner/cashier access
CREATE POLICY "Users manage own categories" 
ON public.categories 
FOR ALL 
TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));