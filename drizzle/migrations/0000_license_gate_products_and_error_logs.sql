CREATE POLICY "Products require active license"
ON public.products AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_license_valid(auth.uid()) OR public.is_boss(auth.uid()));

DROP POLICY IF EXISTS "Allow any device to insert error logs" ON public.error_logs;
CREATE POLICY "Signed-in users insert own error logs"
ON public.error_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());