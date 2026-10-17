-- 1. Add telegram_chat_id column to public.profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Index on telegram_chat_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id 
ON public.profiles(telegram_chat_id);

-- Index on phone for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_phone 
ON public.profiles(phone);

-- 2. Create auth_recovery_codes table for secure OTP password recovery
CREATE TABLE IF NOT EXISTS public.auth_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INT DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on user_id and expires_at
CREATE INDEX IF NOT EXISTS idx_auth_recovery_codes_user_id 
ON public.auth_recovery_codes(user_id);

-- Enable RLS (only service role has access)
ALTER TABLE public.auth_recovery_codes ENABLE ROW LEVEL SECURITY;
