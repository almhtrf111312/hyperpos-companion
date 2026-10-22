# 06 — FlowPOS Pro Domain Invariants & Guardrails

## 🎯 Purpose
This document enshrines the **non-negotiable domain rules** for the FlowPOS Pro codebase. Any agent modification violating these rules is considered a critical architectural regression.

---

## 💎 The 8 Immutable Invariants

### 1. The USD Base Currency Invariant
* **Rule:** The primary accounting base currency of FlowPOS Pro is ALWAYS `USD`.
* **Application:**
  * Product cost prices, ledger balances, and profit splits are recorded in USD.
  * Invoices store the historical `exchange_rate` and `currency_symbol` at the time of creation.
  * Never hardcode `$` or any currency symbol. Use dynamic symbol lookup via `resolveInvoiceCurrencySymbol` or `formatCurrency(val, currencyCode)`.

### 2. The Frozen Modules Guard
* **Rule:** The following modules are deliberately FROZEN and must NEVER be modified:
  * `src/pages/Warehouses.tsx`
  * `src/pages/StockTransfer.tsx`
  * `src/lib/cloud/warehouses-cloud.ts`
* **Reason:** Multi-warehouse and custody features are currently disabled to optimize operational complexity and cloud resources.
* **Exception:** `src/hooks/use-warehouse.tsx` remains active because POS modules have read-only fallback dependencies on default warehouse IDs.

### 3. The In-App Notification Protocol
* **Rule:** All daily business notifications (sales, debt sales, refunds, settings saves, stock alerts) MUST render in-app via the Dynamic Island `SmartToast` (`showSmartToast`).
* **Rule:** NEVER send routine financial notifications to Android system notification shades (`sendLocalNotification`).

### 4. Thermal & Native Printing Protocol
* **Rule:** Printing must support thermal receipt printers (ESC/POS 80mm/58mm, Bluetooth, network, USB) and Canvas-to-Image sharing.
* **Rule:** Do not call `window.print()` directly on Capacitor mobile builds; always route through `src/lib/native-print.ts`.

### 5. Offline Sync & Mutex Lock Protocol
* **Rule:** POS checkout operations must acquire `transaction-lock.ts` to prevent double-tap submissions.
* **Rule:** Offline operations must write to optimistic local state immediately and push a typed payload to `sync-queue.ts` with a unique idempotency UUID.

### 6. Strict Ban on Automated Production SQL Execution
* **Rule:** NO agent is permitted to execute, apply, or suggest executing migrations or SQL DDL/DML statements against the live/production Supabase database automatically.
* **Protocol:**
  * The agent must first inspect the existing schema definitions (`supabase/migrations/` and `src/integrations/supabase/types.ts`).
  * The agent must analyze downstream dependencies, potential lock contention, and RLS impacts.
  * The agent must present the SQL script as a proposed artifact and **require explicit, unequivocal user confirmation** before any database change is run.

### 7. Zero Auto-Purging of Local Storage & IndexedDB (Anti-Data-Loss Guard)
* **Rule:** AUTOMATED OR BACKGROUND WIPING OF LOCAL STORAGE IS STRICTLY FORBIDDEN.
* **Prohibition:**
  * No debug, repair, fallback, or maintenance code may execute `indexedDB.deleteDatabase('hyperpos_cache')`, `localStorage.clear()`, or bulk remove keys without a deliberate, physical UI action.
  * Any storage reset must be triggered exclusively via a dedicated manual button inside Settings/Data Management, guarded by a modal with explicit user confirmation and warnings.
* **Reason:** In an offline-first POS, clearing IndexedDB or localStorage destroys un-synced offline invoices, debt repayments, and mutation queues, leading to unrecoverable financial loss.

### 8. UI Consistency Lock (UCL) & Button Label Stability
* **Rule:** Never alter, rename, or re-translate established button labels, action text, or checkout button positions during surgical refactors.
* **Application:**
  * Stable cashier-facing terms (e.g., "فاتورة نقدية", "بيع آجل", "طباعة", "مشاركة", "إلغاء", "تسجيل دفعة", "حفظ") are locked to preserve cashier muscle memory and training.
  * Modifications to translation dictionaries (`i18n.ts`) must only add new missing keys and must never arbitrarily overwrite established keys without explicit user request.
