# 🧠 FlowPOS Pro — Persistent Project Memory (Project State & Ledger)

**Last Updated:** 2026-10-22  
**Current Version:** v1.0.68  
**Repository Branch:** `main`  
**Base Accounting Currency:** `USD`  
**Primary Language / Direction:** Arabic (`ar`) RTL (with EN/TR support)

---

## 🏛️ System Architecture Summary
* **Frontend:** React 18, Vite 7 (SWC), Tailwind CSS, Radix UI primitives.
* **Platforms:**
  * **Web (PWA):** Vite PWA (`vite-plugin-pwa`) with Workbox service worker caching.
  * **Mobile:** Capacitor 8.1 (Android ID: `com.flowpos.pro`, plugins: MLKit barcode scanner, camera, filesystem, share).
  * **Desktop:** Electron (`electron/main.js` + `electron-builder` portable Windows bundle).
* **Storage & Data Layer:**
  * **Local DB:** IndexedDB (`hyperpos_cache` v2 for products, barcode lookup indices, pending stock deductions).
  * **Secure Local Storage:** Encrypted via device keys (`secure-storage.ts`, `safe-storage.ts`).
  * **Offline Sync Engine:** FIFO Queue (`sync-queue.ts`), 25+ atomic operation types (`sale`, `debt_sale_bundle`, `invoice_refund`, etc.), idempotency tracking, collision detection (`cancellation-registry.ts`), and mutex locking (`transaction-lock.ts`).
  * **Cloud Backend:** Supabase (PostgreSQL 15+ with RLS, atomic RPCs e.g., `process_pos_sale_atomic`, Realtime subscriptions).

---

## 🔒 Frozen & Protected Invariants
1. **USD Accounting Invariant:** USD is the system's immutable calculation base. All profits, partner distributions, debts, and ledger items are pegged to USD. Foreign currencies are calculated via real-time/saved exchange rates.
2. **Frozen Modules (DO NOT TOUCH):**
   * `src/pages/Warehouses.tsx`
   * `src/pages/StockTransfer.tsx`
   * `src/lib/cloud/warehouses-cloud.ts`
   *(Per project directive, warehouse transfers and custody are frozen to protect cloud credits).*
3. **In-App Notification Rule:** All notifications must render in-app through the Dynamic Island `SmartToast` (`showSmartToast`). Android system notifications (`sendLocalNotification`) are suppressed for daily retail sales to prevent blank/delayed notifications.
4. **SQL Safety & Schema Guard:** Automated or unilateral execution of SQL migrations/RPCs against production Supabase is strictly banned. Schema inspection and explicit user approval are mandatory.
5. **Anti-Data-Loss (Local Storage Guard):** Zero programmatic wiping of `IndexedDB` (`hyperpos_cache`) or `localStorage`. Resets require physical user button click with a confirmation modal to protect unsynced offline invoices.
6. **UI Consistency Lock (UCL):** Established cashier button names and labels (e.g., "فاتورة نقدية", "طباعة", "سداد") are locked to prevent disruption of cashier muscle memory.

---

## 🕒 Recent Implementations & Changelog Log
* **2026-10-22 (`b5dba73`):** Web notification compatibility update and `src/lib/sonner-bridge.ts` integration.
* **2026-10-22 (`5acefb3`):** Unified in-app Dynamic Island interactive toast system with tactile freeze & resume countdown physics on touch/hover, lateral shockwaves, multilingual keywords (AR/EN/TR), and explicit category bindings for cash sales, debt sales, refunds, settings, and stock alerts.
* **2026-10-21:** Appearance platform isolation (`getPlatformStoragePrefix`), barcode scanner daylight contrast fix, floating save bar in settings.

---

## ⚠️ Known Technical Debt & Edge Cases
1. **Large Bundle Size:** Main chunk exceeds 800KB gzipped. Dynamic code-splitting on heavy reports (`Reports.tsx`, `BossPanel.tsx`) is advised for future performance optimization.
2. **Offline Refund Currency Conversion:** Historical invoices refunded offline must resolve historical exchange rates from invoice snapshots to prevent currency drift.
3. **Capacitor Storage Quotas:** High-resolution product images must be saved to filesystem cache (`offline-image-store.ts`) rather than base64 strings in localStorage.

---

## 🎯 Next Logical Milestones
- [ ] Implement and test edge-case recovery for interrupted network connections during multi-item partial refunds.
- [ ] Add chunk code-splitting for reports to improve initial POS touch screen boot speed.
- [ ] Connect Obsidian knowledge base bridge for automated ADR documentation sync.
