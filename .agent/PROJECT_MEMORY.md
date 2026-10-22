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

## 🔒 The 8 Immutable Invariants
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
7. **Thermal Printing Protocol:** Must support thermal receipt printers (ESC/POS 80mm/58mm, Bluetooth, USB) and Canvas-to-Image sharing via `src/lib/native-print.ts`. Never use raw `window.print()` in mobile WebViews.
8. **Offline Mutex Lock Protocol:** POS checkout must acquire `transaction-lock.ts` to prevent duplicate submissions on cashier double-taps.

---

## 🛠️ Repository Skills Matrix & Standby Catalog

### 1. Active Autonomous FlowPOS Core Skills (`.agent/skills/`)
* **`flowpos-spec-planner`:** Enforces Spec-Driven planning protocol before multi-file refactors.
* **`flowpos-code-auditor`:** Domain auditor checking offline sync, USD invariants, and platform safety.
* **`flowpos-memory-sync`:** Synchronizes `.agent/PROJECT_MEMORY.md` at the end of every workflow.
* **`flowpos-obsidian-sync`:** Generates and updates ADR architecture markdown files in `.agent/docs/adr/`.

### 2. Standby Engine: UI/UX Pro Max (`.agent/skills/ui-ux-pro-max/`)
* **`ui-ux-pro-max` [STANDBY]:** Elite design engine for high-contrast, tactile cashier-speed UI, 48px touch targets, Arabic RTL typography, and 150-200ms snappy micro-interactions. Activated on-demand for redesign or styling requests.

### 3. User Execution Preferences (`.gemini/skills/user-workflow/`)
* **`user-workflow`:** Mandates direct production implementation without test scripts, direct git pushes, Arabic completion summaries, and frontend-focused scope boundaries.

### 4. Auxiliary Standby Design Skills (`.agents/skills/`)
*(Kept dormant / on standby; available to borrow rules if specialized creative tasks arise)*:
* `brandkit`: Brand guidelines and logo system generation.
* `design-taste-frontend` & `design-taste-frontend-v1`: Web landing and layout aesthetics.
* `full-output-enforcement`: Anti-truncation enforcement for legacy LLMs.
* `gpt-taste`: GSAP motion and creative layout variance.
* `high-end-visual-design`: Agency-style spacing, shadows, and card structures.
* `image-to-code`: Generates code from UI mockups.
* `imagegen-frontend-mobile` & `imagegen-frontend-web`: Conceptual visual image prompts.
* `industrial-brutalist-ui`: Mechanical, high-density terminal layouts.
* `minimalist-ui`: Editorial monochrome layouts.
* `redesign-existing-projects`: Generic AI UI cleanup auditor.
* `stitch-design-taste`: Google Stitch design system generator.

---

## 🕒 Recent Implementations & Changelog Log
* **2026-10-22:** Thermal Printing & Bluetooth Pairing Realism Protocol:
  * Cleaned `src/lib/native-print.ts`: purged the 4 static mock Bluetooth devices from discovery fallback. If no hardware is detected, `searchBluetoothPrinters` returns an empty array `[]` ("لم يتم العثور على طابعات").
  * Fixed `connectAndTestBluetoothPrinter`: removed mock success. System returns `success: false` if plugin is missing or connection fails, and only saves printer configuration after actual connection and test data transmission succeed.
  * Added `isBluetoothSupported` runtime detection for Cordova `BluetoothSerial`, Capacitor plugin, and Web Bluetooth.
  * Updated `src/pages/Settings.tsx` (`handleStartSearchBT`, `handleSelectBTDevice`, discovery dialog): distinguishes clearly between discovered devices, live connecting state, verified connected printers, and unsupported environments with strict UCL adherence.
* **2026-10-22 (`3ded844`):** Granular Notification Events Management & Muted Default Events.
  * Muted (disabled by default) 4 specific notifications without deleting code:
    1. Event 19: `invoices_share_image_generating` ("جاري إنشاء صورة الفاتورة للمشاركة...").
    2. Event 20: `invoices_copied_clipboard` ("تم نسخ تفاصيل الفاتورة بنجاح").
    3. Event 48: `sync_completed_success` ("تمت المزامنة بنجاح ✓" / "تم ترحيل بياناتك إلى السحابة").
    4. Event 49: `sync_offline_queued_warning` ("تم حفظ فاتورة البيع المؤجل أوفلاين...").
  * Categorized all system notifications in `Settings -> Notifications` into 7 organized groups matching the repository audit (POS & Sales, Invoices & Refunds, Debts & Customers, Products & Stock, Cashbox & Shifts, Sync & Backup, Settings & System).
  * Provided direct event titles with individual Switch toggles, count badges, and persistent state in `hyperpos_settings_v1` and Supabase JSONB settings.
  * Created transparent gatekeeper `isNotificationEventAllowed` and `resolveEventKeyFromText` in `src/lib/notification-events-config.ts` integrated directly into `use-smart-toast.ts`, `toast-config.ts`, and `BackgroundSyncIndicator.tsx`.
* **2026-10-22 (`3ad165e`):** Removed legacy test notification trigger card and native permission prompt from `Settings.tsx`.
* **2026-10-22:** Configured `UI/UX Pro Max` skill and rule (`07_ui_ux_pro_max_guidelines.md`) on standby mode. Established the 8 Immutable Invariants (SQL Safety, Anti-Data-Loss, UI Consistency Lock).
* **2026-10-22 (`f03e6b9`):** Autonomous Meta-Architect workflow initialization: Spec-Driven Planning, Ponytail surgical edits, Code Review Auditor, Persistent Memory, and Obsidian ADR documentation bridge.
* **2026-10-22 (`b5dba73`):** Web notification compatibility update and `src/lib/sonner-bridge.ts` integration.
* **2026-10-22 (`5acefb3`):** Unified in-app Dynamic Island interactive toast system with tactile freeze & resume countdown physics on touch/hover, lateral shockwaves, multilingual keywords (AR/EN/TR).

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
