ALTER TABLE public.stock_transfers
  ADD COLUMN transfer_type text NOT NULL DEFAULT 'outgoing';