# 🛡️ FlowPOS Pro Code Review Checklist

**Review Date:** YYYY-MM-DD  
**Reviewer:** Automated Code Review Agent  
**Files Inspected:**  
- `path/to/file`

---

## 1. Offline-First & Storage Audit
- [ ] IndexedDB transactions are cleanly closed and handle errors.
- [ ] Mutation is queued in `sync-queue.ts` if offline.
- [ ] Idempotency key exists and prevents double execution.
- [ ] No unbounded memory allocations or IndexedDB bloat.

## 2. Anti-Data-Loss & Local Storage Protection (Critical)
- [ ] NO automatic or background invocation of `indexedDB.deleteDatabase()` or `localStorage.clear()`.
- [ ] Offline invoices, debts, and `sync_queue` records are protected from accidental wipe.
- [ ] Storage clearing is restricted exclusively to manual user actions with explicit confirmation dialogs.

## 3. SQL Safety & Production Schema Protection (Critical)
- [ ] NO automated execution of SQL migrations or RPC creation against live Supabase.
- [ ] Existing schema inspected against `supabase/migrations/` and `types.ts` before proposing changes.
- [ ] Any SQL proposal is presented as an artifact requiring explicit user confirmation.

## 4. UI Consistency Lock (UCL) & Label Stability
- [ ] Established cashier button labels, action text, and positions remain 100% stable.
- [ ] No arbitrary rewriting or re-translation of existing keys in `i18n.ts`.
- [ ] Cashier muscle memory and UX continuity are preserved.

## 5. Financial & Currency Accuracy
- [ ] Calculations use USD as base currency.
- [ ] Currency formatting uses `formatCurrency()` with correct decimal places.
- [ ] No hardcoded `$` symbols in receipts or reports.
- [ ] Profit & Partner equations remain mathematically invariant.

## 6. Platform & Hardware Safety
- [ ] Native mobile plugins guarded by `Capacitor.isNativePlatform()`.
- [ ] Electron/Desktop features guarded by platform check.
- [ ] Thermal printing logic tested against Canvas/ESC-POS standards.
- [ ] Touch targets are at least 44px on mobile screens.

## 7. UI & Notification Compliance
- [ ] Notification uses `showSmartToast` with proper category and tone.
- [ ] Arabic RTL layout is uncorrupted and responsive.
- [ ] No UTF-8 / Mojibake encoding corruptions in text strings.

## 8. Frozen Features Guard
- [ ] `Warehouses.tsx`, `StockTransfer.tsx`, `warehouses-cloud.ts` are 100% UNTOUCHED.

## 9. Build Verification
- [ ] `npm run build` exits with code 0.
- [ ] TypeScript types are clean with zero unhandled `any`.

---
**Verdict:** [ ] APPROVED / [ ] CHANGES REQUIRED
