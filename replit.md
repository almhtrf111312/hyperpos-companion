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
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID`: Supabase project ID

## Development
- Run: `npm run dev` (serves on port 5000)
- Build: `npm run build`
- Dependencies require `--legacy-peer-deps` flag due to Capacitor version conflicts

## Recent Changes
- **2026-02-11**: Migrated from Lovable to Replit
  - Configured Vite to serve on port 5000 with allowedHosts for Replit
  - Removed lovable-tagger plugin dependency
  - Added @zxing/library for barcode scanning
  - Set up environment variables for Supabase connection
  - Cleaned up unused server/db.ts

## User Preferences
- Arabic language interface
- RTL layout direction
