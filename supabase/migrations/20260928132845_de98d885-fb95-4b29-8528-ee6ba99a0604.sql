-- Activation codes: assign a code to a specific account and track who used it
ALTER TABLE public.activation_codes
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_email text,
  ADD COLUMN IF NOT EXISTS used_by uuid,
  ADD COLUMN IF NOT EXISTS used_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_activation_codes_assigned_user
  ON public.activation_codes (assigned_user_id);

-- Default trial period (days) applied to NEW trials only; existing licenses keep their expiry
INSERT INTO public.app_settings (key, value)
VALUES ('default_trial_days', '30')
ON CONFLICT (key) DO NOTHING;