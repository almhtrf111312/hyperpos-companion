# 🧠 FlowPOS Pro — Persistent Project Memory (Project State & Ledger)

**Last Updated:** 2026-10-28
**Current Version:** `v1.3.2 (Build 345)`
**Repository Branch:** `event-or-artifact` (latest published commit: `35745fd4`; mobile dialog/sidebar improvements in progress).
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
* **Phase 6 — Explicit Currency Activation & Display Modes:**
  * USD remains the base currency; non-USD currencies are not enabled from missing flags or exchange-rate metadata alone. Legacy TRY/SYP slots still resolve their stored currency identity, while setup and cash shifts require explicit enablement (or a deliberately selected primary currency).
  * Added per-currency `symbol` / `name` / `both` settings to unified local/cloud settings and the existing offline settings queue. The choice changes presentation only.
  * Applied mode-aware formatting to POS received amounts and USD equivalents, invoice details/refunds/print/share/canvas, cash-shift summaries, report screens, and PDF/Excel currency headers. Removed the redundant POS invoice-currency panel and fixed the received-amount field and total spacing.
  * No accounting, stored amount, historical exchange-rate, SQL/RPC, database, or IndexedDB changes. `npx tsc --noEmit`, `npm run build`, and `git diff --check` pass. No package test script is configured; ESLint still reports existing violations in touched legacy files.
* **Canonical Currency Symbols (Phase 5):**
  * Legacy Arabic currency symbols are displayed as their matching ISO code only when the currency identity is verified; intentional custom symbols and international glyphs remain unchanged.
  * Legacy TRY/SYP storage slots are interpreted from their currency symbol before runtime display, and invoice history keeps its saved exchange rate.
  * Updated currency catalog, settings, setup wizard, POS formatting, cash shifts, invoice currency cards, and the shared invoice symbol resolver used by print/share paths.
  * No automatic localStorage/Supabase migration and no accounting, rate, or amount changes. Focused symbol and POS currency tests and production build pass; TypeScript check remains blocked by the pre-existing `inert` typing error in `Sidebar.tsx`, and ESLint reports pre-existing violations.
* **2026-10-27:** Mobile Dialog, Invoice Actions & Sidebar:
  * Accounted for top and bottom safe areas in global dialog sizing; kept existing global overflow behavior to avoid clipping dialogs that rely on scrolling.
  * Separated invoice print/share/profit actions from the scrollable detail body and kept them in a safe-area-aware footer.
  * Limited bottom-sheet positioning/animations to phone widths and centered those dialogs on larger screens.
  * Added a mobile sidebar close button and made the closed sidebar inert and inaccessible to pointer and assistive-technology interaction.
  * Restored a distinct three-column dense POS layout on phones. No storage, sync, backend, or financial calculation changes.
  * Files: `src/components/ui/dialog.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/pos/ProductGrid.tsx`, `src/pages/Invoices.tsx`, `src/index.css`.
  * Production build and TypeScript check pass; 375px viewport smoke check has no horizontal overflow. ESLint still reports existing issues outside changed lines.
* **2026-10-28:** Invoice Currency Card Deduplication:
  * Invoice currency-equation cards now render only enabled currencies and suppress duplicate codes, symbols, and names, including legacy metadata aliases for the Qatari riyal.
  * Qatar currency aliases display the canonical `ر.ق` symbol and `الريال القطري` name while retaining the invoice's saved exchange rate when applicable.
  * Production build passes. No storage, sync, or backend changes.
* **2026-10-27:** POS Mobile Product Grid:
  * Changed the standard POS grid to two columns and later restored the dense POS mode to three columns on narrow screens, retaining responsive counts at larger breakpoints.
  * Expanded product imagery to square card areas and moved quantity badges below the image into the product details, improving product-name and price readability.
  * Production build passes. Targeted ESLint reports one pre-existing empty catch block at `ProductGrid.tsx:154`; no storage, sync, or backend changes.
* **2026-10-27:** Invoice Profit UI Privacy Polish:
  * Removed the per-invoice profit amount from every invoice list card, including admin/boss views; invoice profit remains available only through the protected analysis dialog.
  * Added RTL-safe end padding to the profit dialog header and replaced the raw currency-code exchange-rate suffix with the invoice's display symbol.
  * Rechecked customer print and share paths; no profit or cost is included in printable invoice content or `InvoiceShareData`.
  * Production build and focused profit/financial-precision tests pass. No storage, sync, or backend changes.
* **2026-10-27 (`4dcff8e1`):** Invoice Profit Privacy & Owner/Admin Analysis:
  * Removed profit and maintenance parts cost from the customer-facing invoice details and standard invoice printout. Invoice sharing text/image paths contain no profit or cost fields.
  * Restricted invoice profit KPIs, card-level profit figures, and the standalone invoice profit dialog to `boss` and `admin`; the dialog also checks the role before rendering.
  * Added USD-based profit metrics, historical invoice-currency formatting, product/parts cost, net sales margin, and collected-versus-pending debt profit.
  * Added four focused calculation tests. No storage, sync, Supabase schema, or RPC changes.
* **2026-10-26 (v1.1.9 - Build 339 | Commit `a4c245c`):** Phase 1-6 Full POS & Reports Polish & Unified Export:
  * **POS Cart Currency Selector Isolation & Catalog Fixed Base:** Isolated `ProductGrid` currency display strictly to default store currency (`catalogCurrency`). Added elegant currency capsule buttons in `CartPanel.tsx` header for instant cart receipt currency selection and live total recalculation while preserving catalog prices.
  * **Reports Header Streamlining:** Merged financial reports title directly with Smart/Professional display mode capsule switcher on the same flex row (`whitespace-nowrap shrink-0`) to prevent wrapping and wasted space on mobile viewports.
  * **Unified Dynamic Report Currency & Export:** Converted `PartnerProfitDetailedReport.tsx` to `formatReportAmount` and `roundForCurrency`. Upgraded both `src/lib/excel-export.ts` and `src/lib/pdf-export.ts` to retrieve `getReportCurrency()` and convert all accounting numbers across sales, invoices, expenses, partners, cash shifts, and custody reports into active report currency with formal headers.
  * **Non-Scrolling Categorized Tab Matrix:** Eliminated horizontal scrolling (`overflow-x-auto`) for report categories. Organized all reports into vertical sections with responsive grids (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4`) for sales, inventory, debts, and admin operations.
  * **ProfitTrendChart Deduplication:** Stripped duplicate top summary stats cards appearing above average daily profit line; expanded clean chart height to 280px with neat footer KPI highlights.
  * **Production Build & Verification:** Zero TypeScript errors, 11/11 automated unit tests passed, production build passed in 12s, committed and pushed to `origin main` and `origin event-or-artifact`.
* **2026-10-26 (v1.1.8 - Build 338 | Commit `25002e9`):** Line-Level Price Entry Currency Scope in POS:
  * Isolated invoice currency (governed by store settings) from cart item price entry currency.
  * Added line-level currency dropdown adjacent to `EditablePrice` in `CartPanel.tsx` storing `item.priceEntryCurrencyCode` and `item.priceEntryRateSnapshot`.
  * Updated held-cart management (`HeldCart`) to store and restore `invoiceCurrencyCode` and `invoiceExchangeRateSnapshot`.
  * Added comprehensive test suite `pos-currency-scope.test.ts` (5/5 passed).
* **2026-10-26 (v1.1.7 - Build 337 | Commit `64c5022`):** Instant Native-Feel Page Navigation & Keep-Alive Lifecycle:
  * Implemented `PageActivityContext` and Keep-Alive tab system keeping heavy pages in memory with LRU eviction policy.
  * Added progressive batch pagination (20 items/page) with IntersectionObserver for `Products.tsx`.
  * Implemented user-scoped Stale-While-Revalidate caching (`native-swr-cache.ts`).
* **2026-10-26 (v1.1.6 - Build 336 | Commit `e474494`):** Smart & Professional Reports Hub:
  * Introduced dual display modes: Smart (visual KPI cards & charts) and Professional (dense tabular data).
  * Categorized reports into structured pills with single consolidated currency banner.
* **2026-10-26 (v1.1.5 - Build 335 | Commit `c8f5c60` & `ae0f888`):** High-Precision Financial Math Engine:
  * 8-decimal intermediate USD precision engine (`money-engine.ts`) preventing rounding drift across QAR, KWD, SYP, TRY, and USD.
  * Dynamic currency decimals (0, 2, 3) and unified cash shifts accounting with automated tests (`financial-precision.test.ts`).
* **2026-10-26 (v1.1.4 - Build 334 | Commit `4958f0f` & `e2516b3`):** Unified Capsule In-Page Tab Navigation:
  * Modern capsule styling across all tabs (`Tabs.tsx`, `BossPanel.tsx`, `Appearance.tsx`, etc.) matching reference product design.
* **2026-10-25 (v1.1.1 - v1.1.3 | Builds 331-333):** Full-Screen Views & Camera Isolation:
  * Full-screen responsive forms for Services (`Services.tsx`) and Purchase Invoices (`PurchaseInvoiceDialog.tsx`).
  * Isolated native camera barcode scanner portal (`NativeCameraPreview.tsx`) preventing inadvertent dialog dismissal or state loss.
  * Instant category synchronization for rapid item creation.
* **2026-10-24 (Branch: `event-or-artifact`):** Phase 2 - In-Memory Money Engine & Compatibility Layer:
  * Created `src/lib/money-engine.ts`: In-memory currency engine with zero-render-blocking localStorage calls, automatic `hyperpos_settings_v1_backup` safety guard, 8-decimal `round8` USD precision, dynamic currency decimal rules (0, 2, 3), and snapshot creation/formatting.
  * Created `src/hooks/use-money.tsx`: React hook powered by `useSyncExternalStore` for reactive currency updates.
  * Created `src/components/ui/MoneyInput.tsx`: `<MoneyInput />` and `<MoneyDisplay />` financial input and display components.
  * Updated `src/types/index.ts`: Expanded `CurrencyCode` to support any standard currency code.
  * Updated `src/lib/currencies.ts` & `src/hooks/use-currency.tsx`: Fixed BHR -> BHD and connected all display and formatting functions to the in-memory engine while preserving 100% backward compatibility.
  * Configured GitHub Actions CI workflows (`build-apk.yml`, `build-windows.yml`) to automatically build and upload APK/EXE testing artifacts for `event-or-artifact`.
* **2026-10-24:** Phase 1 - Feature Error Boundary, Lazy Loading & Manual Chunks:
  * Created `src/components/debug/FeatureErrorBoundary.tsx` with unified `captureError` integration (`source: 'react_boundary'`).
  * Converted 7 heavy pages in `src/App.tsx` (`Products`, `Customers`, `Services`, `Invoices`, `InvoiceTracking`, `Expenses`, `CashShifts`) to `React.lazy` with idle background preloading (`requestIdleCallback` after 2500ms).
  * Wrapped all application routes with `<FeatureErrorBoundary featureName="...">` while maintaining `ProtectedRoute`, `RoleGuard`, and frozen module integrity.
  * Configured `build.rollupOptions.output.manualChunks` in `vite.config.ts`, isolating heavy libraries into `vendor-charts`, `vendor-pdf`, `vendor-excel`, and `vendor-radix`.
  * Reduced `Reports` chunk from 2,035 kB down to 254 kB (8x smaller), stripped 735 kB from the main entry chunk, and accelerated build time from 68s to 21s.
* **2026-10-24 (`721b07c`):** v1.0.72 - Completed The 10 Improvements Plan & Dynamic Notification Theming:
  1. Default Weekly Invoices: Default filter in `Invoices.tsx` is 'week' for both listing and KPI cards.
  2. Fixed Products Tabs: 3-column fixed responsive grid with vertical icons on mobile, zero clipping.
  3. Default UI Scale: First-time scale set to 80% (11.2px) across config, HTML, and CSS.
  4. Purchases Layout & Atomic Edit: Responsive 2-column buttons, 42rem constrained dialogs, mobile vertical item cards, and atomic `edit_purchase_invoice_atomic` SQL migration with WAC recalculation, negative stock guard, and 'superseded' audit tracking.
  5. Debts & Multi-Currency Statements: All debt cards and reports formatted with `formatInCurrency` displaying `= X $`, expandable accordion invoice items in customer statements, and share canvas utilizing stored invoice exchange rates.
  6. Maintenance in Sales Cart: Integrated maintenance capsule trigger right inside `CartPanel.tsx` next to Shopping Cart, removing clutter from header and catalog.
  7. Services Capsule Buttons: Transformed dropdowns and radio buttons in `Services.tsx` into theme-colored `rounded-full h-9 px-4` capsule button groups.
  8. Cash Shifts Local Currency & Live USD: Live currency exchange conversion display on start/close dialogs ("يعادل X $"), shifts stored with currency and rate, while base storage remains USD.
  9. Default Reports Graphical Summary: Default `activeReport = 'sales'` and `viewTab = 'summary'`.
  10. Consolidated Appearance & Dynamic Toasts: Unified Theme, Fonts, Scale, and Layout under a single draft state with floating FAB save button, and dynamic `hsl(var(--primary))` theming for SmartToast borders, glow, actions, and progress countdown.
  11. BossPanel User Licenses: Added safe suspension and reactivation for active trial and purchased licenses with confirmation modals, without touching user records.
* **2026-10-22:** Refined Compact SmartToast & Purged Shockwave Burst Effects:
  * Removed explosion rings, edge flares, `@keyframes lateralShockwave`, and harsh impact audio (`playBurstSound()`) from `SmartToast.tsx` and `src/index.css`.
  * Reduced card footprint from `max-w-[29rem]` (~464px) to `max-w-[22.5rem] sm:max-w-[23.5rem]` (~360px-376px) with zero content or button clipping.
  * Harmonized text, background, and borders with CSS theme variables across Light, Dark, and Blur (`.blur-theme`) glassmorphism modes.
  * Preserved full swipe gestures (up, left, right), tactile countdown pause & resume physics on touch/cursor, multi-item details, and Print/Share buttons.
* **2026-10-22 (`0a72c01`):** Thermal Printing & Bluetooth Pairing Realism Protocol:
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
