CREATE OR REPLACE FUNCTION public.validate_activation_code_strength()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR length(regexp_replace(NEW.code, '[^A-Za-z0-9]', '', 'g')) < 12 THEN
    RAISE EXCEPTION 'Activation code must contain at least 12 letters or digits';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activation_code_strength ON public.activation_codes;
CREATE TRIGGER trg_activation_code_strength
BEFORE INSERT OR UPDATE OF code ON public.activation_codes
FOR EACH ROW EXECUTE FUNCTION public.validate_activation_code_strength();