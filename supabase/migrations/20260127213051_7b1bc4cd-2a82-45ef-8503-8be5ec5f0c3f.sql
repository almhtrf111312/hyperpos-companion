-- Drop the existing check constraint and add a new one that includes 'pos'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- Add new check constraint that allows cashier, distributor, and pos
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type IN ('cashier', 'distributor', 'pos'));