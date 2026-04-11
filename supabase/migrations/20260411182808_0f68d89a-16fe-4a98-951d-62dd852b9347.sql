-- Add parent_transfer_id to link partial returns to original outgoing transfers
ALTER TABLE public.stock_transfers
ADD COLUMN parent_transfer_id uuid REFERENCES public.stock_transfers(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_stock_transfers_parent ON public.stock_transfers(parent_transfer_id) WHERE parent_transfer_id IS NOT NULL;