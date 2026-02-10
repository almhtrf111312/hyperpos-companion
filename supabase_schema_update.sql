-- Add void tracking columns to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided_by TEXT NULL;

-- Add status and void tracking columns to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voided_by TEXT NULL;

-- Optional: Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
