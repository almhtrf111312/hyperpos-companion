-- Update get_user_role to restrict access - only allow users to query their own role or admins to query any role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _caller_id uuid;
  _caller_is_admin boolean;
BEGIN
  -- Get the calling user's ID
  _caller_id := auth.uid();
  
  -- If no authenticated user, return null
  IF _caller_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Allow users to query their own role
  IF _caller_id = _user_id THEN
    SELECT role INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
    RETURN _role;
  END IF;
  
  -- Check if caller is admin (direct query to avoid recursion)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _caller_id AND role = 'admin'
  ) INTO _caller_is_admin;
  
  -- Only admins can query other users' roles
  IF _caller_is_admin THEN
    SELECT role INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
    RETURN _role;
  END IF;
  
  -- Non-admins cannot query other users' roles
  RETURN NULL;
END;
$$;

-- Update handle_new_user to sanitize input
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _full_name text;
BEGIN
  -- Sanitize full_name: trim, limit length, remove dangerous characters
  _full_name := NEW.raw_user_meta_data->>'full_name';
  IF _full_name IS NOT NULL THEN
    -- Trim whitespace
    _full_name := trim(_full_name);
    -- Limit to 100 characters
    _full_name := left(_full_name, 100);
    -- Remove any HTML/script tags (basic sanitization)
    _full_name := regexp_replace(_full_name, '<[^>]+>', '', 'g');
  END IF;
  
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, _full_name);
  
  RETURN NEW;
END;
$$;

-- Update has_role to validate UUID input
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate that _user_id is not null
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
END;
$$;