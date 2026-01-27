-- إضافة جدول الإعدادات العامة للتطبيق (يديره البوس فقط)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة للجميع
CREATE POLICY "Anyone can read app settings"
  ON public.app_settings
  FOR SELECT
  USING (true);

-- سياسة الإدارة للبوس فقط
CREATE POLICY "Boss can manage app settings"
  ON public.app_settings
  FOR ALL
  USING (is_boss(auth.uid()))
  WITH CHECK (is_boss(auth.uid()));

-- إضافة رقم المطور الافتراضي
INSERT INTO public.app_settings (key, value) 
VALUES ('developer_phone', '+970000000000')
ON CONFLICT (key) DO NOTHING;