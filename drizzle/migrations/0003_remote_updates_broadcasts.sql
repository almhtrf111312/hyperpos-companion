CREATE TABLE public.app_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'info',
  link_url text,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_broadcasts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_broadcasts TO authenticated;
GRANT ALL ON public.app_broadcasts TO service_role;
ALTER TABLE public.app_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read active broadcasts" ON public.app_broadcasts FOR SELECT TO authenticated
  USING (is_active OR public.is_boss(auth.uid()));
CREATE POLICY "Boss manages broadcasts" ON public.app_broadcasts FOR ALL TO authenticated
  USING (public.is_boss(auth.uid())) WITH CHECK (public.is_boss(auth.uid()));

CREATE TABLE public.client_versions (
  user_id uuid PRIMARY KEY,
  version_name text NOT NULL,
  version_code integer NOT NULL DEFAULT 0,
  platform text,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.client_versions TO authenticated;
GRANT ALL ON public.client_versions TO service_role;
ALTER TABLE public.client_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users upsert own version" ON public.client_versions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own version" ON public.client_versions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Read own or boss reads all versions" ON public.client_versions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_boss(auth.uid()));

CREATE POLICY "Authenticated read release config" ON public.app_settings FOR SELECT TO authenticated
  USING (key = 'release_config');