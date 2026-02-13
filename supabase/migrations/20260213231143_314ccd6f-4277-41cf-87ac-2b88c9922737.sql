
-- =============================================
-- FIX 1: Restrict ALL RLS policies to 'authenticated' role only
-- This prevents anonymous users from accessing any data
-- =============================================

-- === activation_codes ===
DROP POLICY IF EXISTS "Boss can manage activation codes" ON public.activation_codes;
CREATE POLICY "Boss can manage activation codes" ON public.activation_codes
  FOR ALL TO authenticated
  USING (is_boss(auth.uid()))
  WITH CHECK (is_boss(auth.uid()));

-- === app_licenses ===
DROP POLICY IF EXISTS "Boss can delete licenses" ON public.app_licenses;
CREATE POLICY "Boss can delete licenses" ON public.app_licenses
  FOR DELETE TO authenticated
  USING (is_boss(auth.uid()));

DROP POLICY IF EXISTS "Only service role can insert licenses" ON public.app_licenses;
CREATE POLICY "Only service role can insert licenses" ON public.app_licenses
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Users can update own license" ON public.app_licenses;
CREATE POLICY "Users can update own license" ON public.app_licenses
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) OR is_boss(auth.uid()))
  WITH CHECK ((auth.uid() = user_id) OR is_boss(auth.uid()));

DROP POLICY IF EXISTS "Users can view own license" ON public.app_licenses;
CREATE POLICY "Users can view own license" ON public.app_licenses
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR is_boss(auth.uid()));

-- === app_settings ===
DROP POLICY IF EXISTS "Authenticated users can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Boss can manage app settings" ON public.app_settings;
CREATE POLICY "Boss can manage app settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (is_boss(auth.uid()))
  WITH CHECK (is_boss(auth.uid()));

-- === categories ===
DROP POLICY IF EXISTS "Users manage own categories" ON public.categories;
CREATE POLICY "Users manage own categories" ON public.categories
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- === customers ===
DROP POLICY IF EXISTS "Users manage own customers" ON public.customers;
CREATE POLICY "Users manage own customers" ON public.customers
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- === debts ===
DROP POLICY IF EXISTS "Users manage own debts" ON public.debts;
CREATE POLICY "Users manage own debts" ON public.debts
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- === expenses ===
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
CREATE POLICY "Users manage own expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- === invoice_items ===
DROP POLICY IF EXISTS "Users manage own invoice items" ON public.invoice_items;
CREATE POLICY "Users manage own invoice items" ON public.invoice_items
  FOR ALL TO authenticated
  USING (invoice_id IN (SELECT id FROM invoices WHERE user_id = get_owner_id(auth.uid())))
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE user_id = get_owner_id(auth.uid())));

-- === invoices ===
DROP POLICY IF EXISTS "Users manage own invoices" ON public.invoices;
CREATE POLICY "Users manage own invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- === maintenance_services ===
DROP POLICY IF EXISTS "Users manage own maintenance" ON public.maintenance_services;
CREATE POLICY "Users manage own maintenance" ON public.maintenance_services
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- === partners ===
DROP POLICY IF EXISTS "Owners can delete partners" ON public.partners;
CREATE POLICY "Owners can delete partners" ON public.partners
  FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) AND (has_role(auth.uid(), 'admin') OR is_boss(auth.uid())));

DROP POLICY IF EXISTS "Owners can insert partners" ON public.partners;
CREATE POLICY "Owners can insert partners" ON public.partners
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) AND (has_role(auth.uid(), 'admin') OR is_boss(auth.uid())));

DROP POLICY IF EXISTS "Owners can update partners" ON public.partners;
CREATE POLICY "Owners can update partners" ON public.partners
  FOR UPDATE TO authenticated
  USING ((user_id = get_owner_id(auth.uid())) AND (has_role(auth.uid(), 'admin') OR is_boss(auth.uid())))
  WITH CHECK ((user_id = get_owner_id(auth.uid())) AND (has_role(auth.uid(), 'admin') OR is_boss(auth.uid())));

DROP POLICY IF EXISTS "Owners can view partners" ON public.partners;
CREATE POLICY "Owners can view partners" ON public.partners
  FOR SELECT TO authenticated
  USING ((user_id = get_owner_id(auth.uid())) AND (has_role(auth.uid(), 'admin') OR is_boss(auth.uid())));

-- === products ===
DROP POLICY IF EXISTS "Users manage own products" ON public.products;
CREATE POLICY "Users manage own products" ON public.products
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- === profiles ===
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view owned profiles" ON public.profiles;
CREATE POLICY "Admins can view owned profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = profiles.user_id AND user_roles.owner_id = auth.uid())) AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update owned profiles" ON public.profiles;
CREATE POLICY "Admins can update owned profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = profiles.user_id AND user_roles.owner_id = auth.uid())) AND has_role(auth.uid(), 'admin'))
  WITH CHECK ((EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = profiles.user_id AND user_roles.owner_id = auth.uid())) AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Boss can view all profiles" ON public.profiles;
CREATE POLICY "Boss can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (is_boss(auth.uid()));

DROP POLICY IF EXISTS "Boss can update all profiles" ON public.profiles;
CREATE POLICY "Boss can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_boss(auth.uid()))
  WITH CHECK (is_boss(auth.uid()));

-- === purchase_invoice_items ===
DROP POLICY IF EXISTS "Users manage own purchase invoice items" ON public.purchase_invoice_items;
CREATE POLICY "Users manage own purchase invoice items" ON public.purchase_invoice_items
  FOR ALL TO authenticated
  USING (invoice_id IN (SELECT id FROM purchase_invoices WHERE user_id = get_owner_id(auth.uid())))
  WITH CHECK (invoice_id IN (SELECT id FROM purchase_invoices WHERE user_id = get_owner_id(auth.uid())));

-- === purchase_invoices ===
DROP POLICY IF EXISTS "Users manage own purchase invoices" ON public.purchase_invoices;
CREATE POLICY "Users manage own purchase invoices" ON public.purchase_invoices
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- === recurring_expenses ===
DROP POLICY IF EXISTS "Owners manage recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Owners manage recurring expenses" ON public.recurring_expenses
  FOR ALL TO authenticated
  USING ((user_id = auth.uid()) AND (has_role(auth.uid(), 'admin') OR is_boss(auth.uid())))
  WITH CHECK ((user_id = auth.uid()) AND (has_role(auth.uid(), 'admin') OR is_boss(auth.uid())));

-- === stock_transfer_items ===
DROP POLICY IF EXISTS "Users see transfer items" ON public.stock_transfer_items;
CREATE POLICY "Users see transfer items" ON public.stock_transfer_items
  FOR ALL TO authenticated
  USING (transfer_id IN (SELECT id FROM stock_transfers WHERE user_id = get_owner_id(auth.uid())))
  WITH CHECK (transfer_id IN (SELECT id FROM stock_transfers WHERE user_id = get_owner_id(auth.uid())));

-- === stock_transfers ===
DROP POLICY IF EXISTS "Owners manage stock transfers" ON public.stock_transfers;
CREATE POLICY "Owners manage stock transfers" ON public.stock_transfers
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- === stores ===
DROP POLICY IF EXISTS "Users manage own store" ON public.stores;
CREATE POLICY "Users manage own store" ON public.stores
  FOR ALL TO authenticated
  USING (user_id = get_owner_id(auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- === user_roles ===
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Boss can view all roles" ON public.user_roles;
CREATE POLICY "Boss can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (is_boss(auth.uid()));

DROP POLICY IF EXISTS "Admins can view owned users" ON public.user_roles;
CREATE POLICY "Admins can view owned users" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((owner_id = auth.uid()) AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can create owned users" ON public.user_roles;
CREATE POLICY "Admins can create owned users" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin') AND (owner_id = auth.uid())) OR is_boss(auth.uid()));

DROP POLICY IF EXISTS "Admins can update owned users" ON public.user_roles;
CREATE POLICY "Admins can update owned users" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (((owner_id = auth.uid()) AND has_role(auth.uid(), 'admin')) OR is_boss(auth.uid()))
  WITH CHECK (((owner_id = auth.uid()) AND has_role(auth.uid(), 'admin')) OR is_boss(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete owned users" ON public.user_roles;
CREATE POLICY "Admins can delete owned users" ON public.user_roles
  FOR DELETE TO authenticated
  USING (((owner_id = auth.uid()) AND has_role(auth.uid(), 'admin')) OR is_boss(auth.uid()));

DROP POLICY IF EXISTS "Allow first user to create admin role" ON public.user_roles;
CREATE POLICY "Allow first user to create admin role" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND is_first_user());

-- === warehouse_stock ===
DROP POLICY IF EXISTS "Users see assigned warehouse stock" ON public.warehouse_stock;
CREATE POLICY "Users see assigned warehouse stock" ON public.warehouse_stock
  FOR ALL TO authenticated
  USING (warehouse_id IN (SELECT id FROM warehouses WHERE (user_id = get_owner_id(auth.uid())) OR (assigned_cashier_id = auth.uid())))
  WITH CHECK (warehouse_id IN (SELECT id FROM warehouses WHERE user_id = get_owner_id(auth.uid())));

-- === warehouses ===
DROP POLICY IF EXISTS "Owners manage warehouses" ON public.warehouses;
CREATE POLICY "Owners manage warehouses" ON public.warehouses
  FOR ALL TO authenticated
  USING ((user_id = get_owner_id(auth.uid())) OR (assigned_cashier_id = auth.uid()))
  WITH CHECK (user_id = get_owner_id(auth.uid()));

-- =============================================
-- FIX 2: Secure boss_owners_view with RLS
-- =============================================
ALTER VIEW public.boss_owners_view SET (security_invoker = true);

-- =============================================
-- FIX 3: Restrict storage policies to authenticated only
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view product images" ON storage.objects;
CREATE POLICY "Authenticated users can view product images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
CREATE POLICY "Users can delete own product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
