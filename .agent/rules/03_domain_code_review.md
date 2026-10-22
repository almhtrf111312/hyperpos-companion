# 03 — Domain-Specific Code Reviewer & Auditor

## 🎯 Core Directive
**Before committing any code or finalizing any task, an autonomous audit MUST be executed.**
The audit validates that all changes conform to FlowPOS Pro's offline-first architecture, financial invariants, and multi-platform constraints.

---

## 🔍 The 5-Point Domain Audit Checklist

```
+-----------------------------------------------------------------------+
|                       FLOWPOS PRO AUDIT MATRIX                        |
+-----------------------------------------------------------------------+
| 1. Offline-First & Sync Queue Integrity                               |
| 2. Financial & Base Currency (USD) Invariants                         |
| 3. Hardware & Platform Runtime Safety (Capacitor / Electron / Web)   |
| 4. Security & Supabase RLS Boundaries                                 |
| 5. Zero-Regression & Frozen Module Guard                              |
+-----------------------------------------------------------------------+
```

### 1. Offline-First & Sync Queue Integrity
* [ ] **Local DB / IndexedDB:** All writes to `hyperpos_cache` must be wrapped in error handlers (`QuotaExceededError` checks via `safe-storage.ts`).
* [ ] **Sync Queue Registration:** If an entity is created or modified offline, it must be enqueued via `addToSyncQueue(...)` with a unique UUID idempotency key.
* [ ] **Optimistic UI:** UI state must update immediately; never block user checkout on a network promise.
* [ ] **Transaction Atomicity:** POS sales must pass through `pos-sale-atomic.ts` and acquire `transaction-lock.ts` to prevent duplicate submissions or race conditions.

### 2. Financial & Base Currency Invariants
* [ ] **Base Currency Rule:** USD (`USD`) is the immutable system accounting base. All stored ledger records, profit distributions, and cost prices are pegged to USD.
* [ ] **Multi-Currency Display:** Never hardcode `$` or currency symbols in invoices or receipts. Always resolve dynamically via `resolveInvoiceCurrencySymbol` or `formatCurrency(amount, currency)`.
* [ ] **Exchange Rate Rounding:** Conversion calculations must respect decimal limits per currency (e.g. IQD has 0 decimals, USD has 2 decimals).

### 3. Hardware & Platform Runtime Safety
* [ ] **Capacitor Guards:** Every call to `@capacitor/*` (Camera, Barcode, Filesystem, Share) must be wrapped in `if (Capacitor.isNativePlatform())` or fallback gracefully to web alternatives.
* [ ] **Electron Guards:** Desktop-specific logic must be guarded by `getPlatformStoragePrefix() === 'desktop'`.
* [ ] **Thermal Printing:** Must support Bluetooth ESC/POS and Canvas-based image printing via `native-print.ts`. Never assume `window.print()` works on mobile WebViews.

### 4. Security & Supabase Boundaries
* [ ] **RLS Compliance:** No queries should bypass store/user multi-tenancy.
* [ ] **Credentials Safety:** Zero hardcoded API keys, tokens, or plaintext passwords.
* [ ] **Preview Auth Storage:** Supabase client must use `brokeredPreviewStorage()` to prevent session clobbering across preview windows.

### 5. Zero-Regression & Frozen Module Guard
* [ ] **Frozen Modules:** STRICTLY NO modifications to:
  * `src/pages/Warehouses.tsx`
  * `src/pages/StockTransfer.tsx`
  * `src/lib/cloud/warehouses-cloud.ts`
* [ ] **Build Validation:** Code must compile with zero errors: `npm run build` (Exit code: 0).
* [ ] **Notification Standard:** In-app only via Dynamic Island `SmartToast` (`showSmartToast`). No Android system notification spam.
