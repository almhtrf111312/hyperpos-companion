-- Create trigger to automatically assign admin role to new users who sign up directly
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user already has a role (e.g., created via edge function)
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    -- Anyone who signs up directly becomes an admin (owner)
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (NEW.id, 'admin', true);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();