-- 1. Add 'boss' role to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'boss';

-- 2. Add owner_id to user_roles to link cashiers to their owners
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 3. Add max_cashiers and current_cashiers to activation_codes
ALTER TABLE public.activation_codes 
ADD COLUMN IF NOT EXISTS max_cashiers integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS license_tier text DEFAULT 'basic';

-- 4. Add owner_id to app_licenses to track which owner the license belongs to
ALTER TABLE public.app_licenses 
ADD COLUMN IF NOT EXISTS max_cashiers integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_cashiers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS license_tier text DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS is_revoked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS revoked_reason text;

-- 5. Create function to check if user is boss
CREATE OR REPLACE FUNCTION public.is_boss(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'boss'
  );
END;
$$;

-- 6. Create function to get owner_id for a user (returns self if owner, or owner_id if cashier)
CREATE OR REPLACE FUNCTION public.get_owner_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _owner_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT role, owner_id INTO _role, _owner_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
  
  -- If user is admin/boss, they are their own owner
  IF _role IN ('admin', 'boss') THEN
    RETURN _user_id;
  END IF;
  
  -- If user is cashier, return their owner_id
  IF _role = 'cashier' AND _owner_id IS NOT NULL THEN
    RETURN _owner_id;
  END IF;
  
  RETURN _user_id;
END;
$$;

-- 7. Create function to check if owner's license is valid
CREATE OR REPLACE FUNCTION public.is_license_valid(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _license_valid boolean;
BEGIN
  -- Get the owner id (self if owner, or owner_id if cashier)
  _owner_id := public.get_owner_id(_user_id);
  
  IF _owner_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if license exists and is valid
  SELECT EXISTS (
    SELECT 1
    FROM public.app_licenses
    WHERE user_id = _owner_id
      AND expires_at > now()
      AND is_revoked = false
  ) INTO _license_valid;
  
  RETURN _license_valid;
END;
$$;

-- 8. Create function to count current cashiers for an owner
CREATE OR REPLACE FUNCTION public.count_owner_cashiers(_owner_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  SELECT COUNT(*) INTO _count
  FROM public.user_roles
  WHERE owner_id = _owner_id
    AND role = 'cashier'
    AND is_active = true;
  
  RETURN _count;
END;
$$;

-- 9. Create function to check if owner can add more cashiers
CREATE OR REPLACE FUNCTION public.can_add_cashier(_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max_cashiers integer;
  _current_cashiers integer;
BEGIN
  -- Get max cashiers from license
  SELECT max_cashiers INTO _max_cashiers
  FROM public.app_licenses
  WHERE user_id = _owner_id
    AND expires_at > now()
    AND is_revoked = false
  LIMIT 1;
  
  IF _max_cashiers IS NULL THEN
    RETURN false;
  END IF;
  
  -- Count current cashiers
  _current_cashiers := public.count_owner_cashiers(_owner_id);
  
  RETURN _current_cashiers < _max_cashiers;
END;
$$;

-- 10. Update RLS policy for products to use owner_id
DROP POLICY IF EXISTS "Users manage own products" ON public.products;
CREATE POLICY "Users manage own products" ON public.products
FOR ALL USING (
  user_id = public.get_owner_id(auth.uid())
)
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
);

-- 11. Update RLS policy for invoices
DROP POLICY IF EXISTS "Users manage own invoices" ON public.invoices;
CREATE POLICY "Users manage own invoices" ON public.invoices
FOR ALL USING (
  user_id = public.get_owner_id(auth.uid())
)
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
);

-- 12. Update RLS policy for customers
DROP POLICY IF EXISTS "Users manage own customers" ON public.customers;
CREATE POLICY "Users manage own customers" ON public.customers
FOR ALL USING (
  user_id = public.get_owner_id(auth.uid())
)
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
);

-- 13. Update RLS policy for debts
DROP POLICY IF EXISTS "Users manage own debts" ON public.debts;
CREATE POLICY "Users manage own debts" ON public.debts
FOR ALL USING (
  user_id = public.get_owner_id(auth.uid())
)
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
);

-- 14. Update RLS policy for expenses
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
CREATE POLICY "Users manage own expenses" ON public.expenses
FOR ALL USING (
  user_id = public.get_owner_id(auth.uid())
)
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
);

-- 15. Update RLS policy for categories
DROP POLICY IF EXISTS "Users manage own categories" ON public.categories;
CREATE POLICY "Users manage own categories" ON public.categories
FOR ALL USING (
  user_id = public.get_owner_id(auth.uid())
)
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
);

-- 16. Update RLS policy for partners (owners only, not cashiers)
DROP POLICY IF EXISTS "Users manage own partners" ON public.partners;
CREATE POLICY "Owners manage own partners" ON public.partners
FOR ALL USING (
  user_id = auth.uid() AND has_role(auth.uid(), 'admin')
)
WITH CHECK (
  user_id = auth.uid() AND has_role(auth.uid(), 'admin')
);

-- 17. Update RLS policy for stores
DROP POLICY IF EXISTS "Users manage own store" ON public.stores;
CREATE POLICY "Users manage own store" ON public.stores
FOR ALL USING (
  user_id = public.get_owner_id(auth.uid())
)
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
);

-- 18. Update RLS policy for maintenance_services
DROP POLICY IF EXISTS "Users manage own maintenance" ON public.maintenance_services;
CREATE POLICY "Users manage own maintenance" ON public.maintenance_services
FOR ALL USING (
  user_id = public.get_owner_id(auth.uid())
)
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
);

-- 19. Update RLS policy for recurring_expenses (owners only)
DROP POLICY IF EXISTS "Users manage own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Owners manage recurring expenses" ON public.recurring_expenses
FOR ALL USING (
  user_id = auth.uid() AND has_role(auth.uid(), 'admin')
)
WITH CHECK (
  user_id = auth.uid() AND has_role(auth.uid(), 'admin')
);

-- 20. Add boss policies for full access
CREATE POLICY "Boss can view all licenses" ON public.app_licenses
FOR SELECT USING (is_boss(auth.uid()));

CREATE POLICY "Boss can manage all licenses" ON public.app_licenses
FOR ALL USING (is_boss(auth.uid()))
WITH CHECK (is_boss(auth.uid()));

CREATE POLICY "Boss can view all activation codes" ON public.activation_codes
FOR SELECT USING (is_boss(auth.uid()));

CREATE POLICY "Boss can manage all activation codes" ON public.activation_codes
FOR ALL USING (is_boss(auth.uid()))
WITH CHECK (is_boss(auth.uid()));

-- 21. Create admin_stats view for boss dashboard
CREATE OR REPLACE VIEW public.admin_stats AS
SELECT 
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin') as total_owners,
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'cashier') as total_cashiers,
  (SELECT COUNT(*) FROM public.app_licenses WHERE expires_at > now() AND is_revoked = false) as active_licenses,
  (SELECT COUNT(*) FROM public.app_licenses WHERE expires_at <= now() OR is_revoked = true) as expired_licenses,
  (SELECT COUNT(*) FROM public.activation_codes WHERE is_active = true) as active_codes;

-- 22. Create function to revoke license
CREATE OR REPLACE FUNCTION public.revoke_license(_license_id uuid, _reason text DEFAULT 'Revoked by admin')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only boss can revoke
  IF NOT is_boss(auth.uid()) THEN
    RETURN false;
  END IF;
  
  UPDATE public.app_licenses
  SET is_revoked = true,
      revoked_at = now(),
      revoked_reason = _reason
  WHERE id = _license_id;
  
  RETURN true;
END;
$$;

-- 23. Create function to delete owner and all their data
CREATE OR REPLACE FUNCTION public.delete_owner_cascade(_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only boss can delete owners
  IF NOT is_boss(auth.uid()) THEN
    RETURN false;
  END IF;
  
  -- Delete all cashiers linked to this owner
  DELETE FROM public.user_roles WHERE owner_id = _owner_id;
  
  -- Delete owner's license
  DELETE FROM public.app_licenses WHERE user_id = _owner_id;
  
  -- Delete owner's data (cascade will handle related records)
  DELETE FROM public.products WHERE user_id = _owner_id;
  DELETE FROM public.customers WHERE user_id = _owner_id;
  DELETE FROM public.invoices WHERE user_id = _owner_id;
  DELETE FROM public.debts WHERE user_id = _owner_id;
  DELETE FROM public.expenses WHERE user_id = _owner_id;
  DELETE FROM public.partners WHERE user_id = _owner_id;
  DELETE FROM public.categories WHERE user_id = _owner_id;
  DELETE FROM public.stores WHERE user_id = _owner_id;
  DELETE FROM public.maintenance_services WHERE user_id = _owner_id;
  DELETE FROM public.recurring_expenses WHERE user_id = _owner_id;
  DELETE FROM public.profiles WHERE user_id = _owner_id;
  DELETE FROM public.user_roles WHERE user_id = _owner_id;
  
  RETURN true;
END;
$$;