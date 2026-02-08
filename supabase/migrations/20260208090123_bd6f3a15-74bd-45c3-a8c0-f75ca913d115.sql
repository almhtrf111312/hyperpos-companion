-- Add barcode2 and barcode3 columns to products table for multi-barcode support
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode2 text DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode3 text DEFAULT NULL;