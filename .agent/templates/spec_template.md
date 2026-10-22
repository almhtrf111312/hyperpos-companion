# [FEATURE/FIX]: <Title of the Specification>

**Document Status:** 🟡 Pending User Confirmation  
**Date:** YYYY-MM-DD  
**Target Files:**  
- `src/path/to/file1.ts`
- `src/path/to/file2.tsx`

---

## 1. 📌 Objective & Business Context
- **Problem Statement:** What problem does this change solve?
- **User Story:** As a cashier / store manager / system admin, I need...
- **Expected Outcome:** Clear success criteria.

---

## 2. 🗄️ Storage & Architecture Impact

### A. Local Storage & Offline Cache
- **IndexedDB (`hyperpos_cache`):** Are any stores or indexes modified?
- **Local Storage (`safe-storage` / `secure-storage`):** Storage keys added/modified.
- **In-Memory Store:** Updates to reactive state / CustomEvents.

### B. Remote Backend (Supabase)
- **Tables / Columns Affected:**
- **RLS Policies:** Any permission boundary adjustments?
- **Stored Procedures / RPCs:** (e.g., `process_pos_sale_atomic`)

### C. Offline-First Sync & Resilience
- **Operation Type in `sync-queue.ts`:** (e.g., `sale`, `debt_sale_bundle`, etc.)
- **Idempotency Guarantee:** How are duplicate submissions prevented?
- **Offline Behavior:** What happens if the device is disconnected during the action?
- **Sync Recovery / Conflict Resolution:** How conflicts are resolved when coming back online.

---

## 3. 💵 Financial & Currency Invariants
- **Base Accounting Currency:** USD must remain untouched as the calculation base.
- **Exchange Rate Application:** How foreign currencies are converted and rounded.
- **Profit / Capital Equations:** Confirm no distortion in partner shares or profit ledgers.

---

## 4. 📱 Multi-Platform Compatibility
- [ ] **Web (PWA):** Service worker precache integrity.
- [ ] **Android (Capacitor 8):** Proper use of `Capacitor.isNativePlatform()`. No breaking browser APIs.
- [ ] **Desktop (Electron):** Safe IPC and storage prefixing (`getPlatformStoragePrefix()`).

---

## 5. 🎨 UI / UX & Notification Standards
- **RTL Support:** Proper Arabic alignment, spacing, and typography.
- **In-App Toast:** Integrated with Dynamic Island `SmartToast` (`type`, `title`, `description`, `duration`).
- **Accessibility:** Touch target sizes for POS touchscreens (minimum 44x44px).

---

## 6. 🚀 Step-by-Step Implementation Plan
1. **Step 1:** Data layer & store updates.
2. **Step 2:** Sync queue & cloud handler integration.
3. **Step 3:** UI components & notification hooking.
4. **Step 4:** Build verification (`npm run build`) & smoke testing.

---

## 7. ⚠️ Risk Assessment & Rollback Plan
- **Potential Failure Modes:** What could go wrong?
- **Mitigation Strategy:** How errors are trapped and communicated.
- **Rollback Procedure:** How changes can be safely reverted without data loss.
