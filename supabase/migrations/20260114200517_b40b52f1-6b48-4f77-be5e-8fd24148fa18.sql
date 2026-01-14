-- Create activation_codes table for storing activation codes
CREATE TABLE public.activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  max_uses INTEGER DEFAULT 1 CHECK (max_uses > 0),
  current_uses INTEGER DEFAULT 0 CHECK (current_uses >= 0),
  is_active BOOLEAN DEFAULT true,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Create app_licenses table for storing user licenses
CREATE TABLE public.app_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  activation_code_id UUID REFERENCES public.activation_codes(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_trial BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_licenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activation_codes (admin only)
CREATE POLICY "Admins can view all codes"
  ON public.activation_codes
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert codes"
  ON public.activation_codes
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update codes"
  ON public.activation_codes
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete codes"
  ON public.activation_codes
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for app_licenses
CREATE POLICY "Users can view own license"
  ON public.app_licenses
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own license"
  ON public.app_licenses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own license"
  ON public.app_licenses
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all licenses"
  ON public.app_licenses
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all licenses"
  ON public.app_licenses
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create index for faster lookups
CREATE INDEX idx_activation_codes_code ON public.activation_codes(code);
CREATE INDEX idx_app_licenses_user_id ON public.app_licenses(user_id);
CREATE INDEX idx_app_licenses_expires_at ON public.app_licenses(expires_at);