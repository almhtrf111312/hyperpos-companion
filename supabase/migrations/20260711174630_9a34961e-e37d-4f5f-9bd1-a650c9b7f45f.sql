ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS conversion_factor numeric NOT NULL DEFAULT 1;