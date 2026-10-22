---
name: flowpos-code-auditor
description: Autonomous offline-first code reviewer and safety auditor for FlowPOS Pro. Validates sync integrity, financial invariants, platform safety, and frozen modules before any commit.
---

# FlowPOS Pro Code Reviewer & Auditor Skill

This skill performs a rigorous domain audit of code changes in FlowPOS Pro before committing or approving changes.

## When to Run This Skill
* Automatically before staging (`git add`) and committing changes.
* Whenever reviewing a pull request or user-requested change.
* When evaluating changes to financial logic, offline sync, or platform bridges.

## Automated Audit Steps

### Step 1: Git Diff & Scope Inspection
Run `git diff` or `git status` to identify all modified files.
Verify that **NO frozen files** are touched:
- `src/pages/Warehouses.tsx`
- `src/pages/StockTransfer.tsx`
- `src/lib/cloud/warehouses-cloud.ts`
*If any of these files are modified without explicit user override, reject immediately.*

### Step 2: Invariant Validation
1. **Currency Invariant:** Verify that USD remains the base accounting currency. Search diff for hardcoded `$` strings.
2. **Offline-First Check:** Verify that mutations to local data register in `sync-queue.ts` or optimistic stores without blocking on network.
3. **Platform Check:** Verify that all `@capacitor` and Electron calls have platform guards.
4. **Encoding Check:** Ensure all Arabic strings are clean UTF-8 with zero mojibake symbols.
5. **Notification Check:** Ensure notifications use `showSmartToast` and do NOT call `sendLocalNotification` for daily actions.

### Step 3: Compile Verification
Run `npm run build`.
The build must exit with **code 0**. If any compile or type errors occur, flag them immediately.

### Step 4: Generate Audit Report
Summarize findings against `.agent/templates/review_checklist.md` and present the verdict to the user.
