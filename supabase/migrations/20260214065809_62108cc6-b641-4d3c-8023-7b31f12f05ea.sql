
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _full_name text;
  _phone text;
BEGIN
  -- Sanitize full_name
  _full_name := NEW.raw_user_meta_data->>'full_name';
  IF _full_name IS NOT NULL THEN
    _full_name := trim(_full_name);
    _full_name := left(_full_name, 100);
    _full_name := regexp_replace(_full_name, '<[^>]+>', '', 'g');
  END IF;

  -- Extract phone
  _phone := NEW.raw_user_meta_data->>'phone';
  IF _phone IS NOT NULL THEN
    _phone := trim(_phone);
    _phone := left(_phone, 20);
    _phone := regexp_replace(_phone, '<[^>]+>', '', 'g');
  END IF;
  
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, _full_name, _phone);
  
  RETURN NEW;
END;
$function$;
