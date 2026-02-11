# POS System - Point of Sale Application

## Overview
A comprehensive Arabic-language POS (Point of Sale) system built with React + Vite, using Supabase as the backend. Features multi-user management (admin/cashier/boss roles), licensing system, inventory management, invoicing, multi-warehouse support, barcode scanning, and cloud sync.

## Architecture
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions, Realtime, Storage)
- **Database**: Supabase (PostgreSQL) - hosted externally
- **State Management**: Local stores with cloud sync via Supabase
- **Language**: Arabic (RTL layout)

## Project Structure
```
src/
  components/     # UI components organized by feature
  hooks/          # Custom React hooks (auth, license, device binding, etc.)
  integrations/   # Supabase client and types
  lib/            # Business logic, stores, utilities
    cloud/        # Cloud sync modules per entity
  pages/          # Route pages (Dashboard, POS, Products, etc.)
  providers/      # Context providers (CloudSync, etc.)
  types/          # TypeScript type definitions
supabase/
  functions/      # Edge Functions (user mgmt, licensing, auth)
  migrations/     # Database migration files
```

## Key Features
- Multi-role authentication (Admin, Cashier, Boss)
- Device binding and license management
- Product/Inventory management with barcode scanning
- Multi-warehouse support with stock transfers
- Invoice creation and management
- Customer and partner management
- Expense tracking and debt management
- Cash shift management
- Cloud sync with offline support
- Arabic RTL interface
- Print and PDF export

## Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL (musckmmgmkgpfyycdupe)
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase anon/public key
- `SUPABASE_DB_URL`: Session pooler connection string (aws-1-eu-west-1)
- `SUPABASE_DB_PASSWORD`: Database password
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for Edge Functions

## Development
- Run: `npm run dev` (serves on port 5000)
- Build: `npm run build`
- Dependencies require `--legacy-peer-deps` flag due to Capacitor version conflicts

## Database
- **23 tables** created in Supabase via 37 migration files
- Tables: activation_codes, app_licenses, app_settings, boss_owners_view, categories, customers, debts, expenses, invoice_items, invoices, maintenance_services, partners, products, profiles, purchase_invoice_items, purchase_invoices, recurring_expenses, stock_transfer_items, stock_transfers, stores, user_roles, warehouse_stock, warehouses
- Migration script: `node scripts/apply-migrations.cjs` (uses SUPABASE_DB_URL + SUPABASE_DB_PASSWORD)

## Recent Changes
- **2026-02-11**: Restructured authentication system
  - Simplified signOut: clears all sb-* and hyperpos_* localStorage, uses `scope: 'local'`
  - Fixed onAuthStateChange deduplication: prevents multiple SIGNED_IN events from causing reload loops
  - Removed broken device auto-login edge function (CORS issues)
  - Made license check resilient: falls back to "allow access" when edge functions unavailable
  - Reduced all timeouts (auth: 4s, device: 3s, license: 5s)
  - Simplified LicenseGuard: sequential auth→license check, no skip button needed
  - Fixed device binding: tracks last-checked user to prevent redundant checks
  - Fixed user role detection: always fetches from Supabase with proper deduplication
- **2026-02-11**: Applied all database migrations to Supabase
  - Connected via Session Pooler (aws-1-eu-west-1)
  - 36/37 migrations applied successfully
  - 1 expected skip (user_roles data insert - users created at runtime)
- **2026-02-11**: Migrated from Lovable to Replit
  - Configured Vite to serve on port 5000 with allowedHosts for Replit
  - Removed lovable-tagger plugin dependency
  - Added @zxing/library for barcode scanning
  - Set up environment variables for Supabase connection
  - Cleaned up unused server/db.ts

## User Preferences
- Arabic language interface
- RTL layout direction
