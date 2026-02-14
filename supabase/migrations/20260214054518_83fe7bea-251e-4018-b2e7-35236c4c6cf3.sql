-- Fix defaults for new stores to be empty/neutral
ALTER TABLE public.stores ALTER COLUMN name SET DEFAULT '';
ALTER TABLE public.stores ALTER COLUMN store_type SET DEFAULT 'general';
ALTER TABLE public.stores ALTER COLUMN exchange_rates SET DEFAULT '{"SYP": 0, "TRY": 0, "USD": 1}'::jsonb;