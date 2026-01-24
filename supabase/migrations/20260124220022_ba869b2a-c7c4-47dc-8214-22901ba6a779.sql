-- Fix security warnings: Update policies to require authentication

-- 1. Drop and recreate policies with authenticated role requirement
DROP POLICY IF EXISTS "Users manage own categories" ON public.categories;
CREATE POLICY "Users manage own categories" ON public.categories
FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users manage own customers" ON public.customers;
CREATE POLICY "Users manage own customers" ON public.customers
FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users manage own debts" ON public.debts;
CREATE POLICY "Users manage own debts" ON public.debts
FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
CREATE POLICY "Users manage own expenses" ON public.expenses
FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users manage own invoice items" ON public.invoice_items;
CREATE POLICY "Users manage own invoice items" ON public.invoice_items
FOR ALL TO authenticated
USING (invoice_id IN (SELECT id FROM invoices WHERE user_id = public.get_owner_id(auth.uid())))
WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE user_id = public.get_owner_id(auth.uid())));

DROP POLICY IF EXISTS "Users manage own invoices" ON public.invoices;
CREATE POLICY "Users manage own invoices" ON public.invoices
FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users manage own maintenance" ON public.maintenance_services;
CREATE POLICY "Users manage own maintenance" ON public.maintenance_services
FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Owners manage own partners" ON public.partners;
CREATE POLICY "Owners manage own partners" ON public.partners
FOR ALL TO authenticated
USING (user_id = auth.uid() AND has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users manage own products" ON public.products;
CREATE POLICY "Users manage own products" ON public.products
FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Owners manage recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Owners manage recurring expenses" ON public.recurring_expenses
FOR ALL TO authenticated
USING (user_id = auth.uid() AND has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users manage own store" ON public.stores;
CREATE POLICY "Users manage own store" ON public.stores
FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

-- 2. Fix activation_codes policies
DROP POLICY IF EXISTS "Admins can manage codes" ON public.activation_codes;
DROP POLICY IF EXISTS "Boss can manage all activation codes" ON public.activation_codes;
DROP POLICY IF EXISTS "Boss can view all activation codes" ON public.activation_codes;

CREATE POLICY "Boss can manage activation codes" ON public.activation_codes
FOR ALL TO authenticated
USING (is_boss(auth.uid()))
WITH CHECK (is_boss(auth.uid()));

-- 3. Fix app_licenses policies
DROP POLICY IF EXISTS "Users can view own license" ON public.app_licenses;
DROP POLICY IF EXISTS "Users can insert own license" ON public.app_licenses;
DROP POLICY IF EXISTS "Users can update own license" ON public.app_licenses;
DROP POLICY IF EXISTS "Admins can delete licenses" ON public.app_licenses;
DROP POLICY IF EXISTS "Boss can view all licenses" ON public.app_licenses;
DROP POLICY IF EXISTS "Boss can manage all licenses" ON public.app_licenses;

CREATE POLICY "Users can view own license" ON public.app_licenses
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_boss(auth.uid()));

CREATE POLICY "Users can insert own license" ON public.app_licenses
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own license" ON public.app_licenses
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR is_boss(auth.uid()))
WITH CHECK (auth.uid() = user_id OR is_boss(auth.uid()));

CREATE POLICY "Boss can delete licenses" ON public.app_licenses
FOR DELETE TO authenticated
USING (is_boss(auth.uid()));

-- 4. Fix profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR is_boss(auth.uid()));

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Fix user_roles policies
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow first user to create admin role" ON public.user_roles;

CREATE POLICY "Users can view own role" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR is_boss(auth.uid()));

CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_boss(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin') OR is_boss(auth.uid()));

CREATE POLICY "Allow first user to create admin role" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND is_first_user());

-- 6. Drop the security definer view and recreate as regular view
DROP VIEW IF EXISTS public.admin_stats;

-- 7. Create boss_users view to see all owners for boss panel
CREATE OR REPLACE VIEW public.boss_owners_view 
WITH (security_invoker = true) AS
SELECT 
  ur.user_id,
  ur.role,
  ur.created_at as role_created_at,
  ur.is_active,
  p.full_name,
  al.expires_at as license_expires,
  al.is_revoked as license_revoked,
  al.max_cashiers,
  al.license_tier,
  (SELECT COUNT(*) FROM public.user_roles WHERE owner_id = ur.user_id AND role = 'cashier') as cashier_count
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id
LEFT JOIN public.app_licenses al ON al.user_id = ur.user_id
WHERE ur.role = 'admin';