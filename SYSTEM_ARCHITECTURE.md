# FlowPOS Pro — System Architecture & Financial Operations Map
# خريطة النظام المعمارية وتدفق العمليات المالية

**Version:** 2.0 | **Date:** March 2026 | **Purpose:** Complete reference for debugging financial logic and user role hierarchy

---

## Table of Contents / فهرس المحتويات

1. [User Roles & Account Hierarchy / الأدوار وتسلسل الحسابات](#1-user-roles--account-hierarchy)
2. [Financial Operations Map / خريطة العمليات المالية](#2-financial-operations-map)
3. [Operation: Cash Sale / عملية البيع النقدي](#3-cash-sale)
4. [Operation: Debt Sale / عملية البيع بالدين](#4-debt-sale)
5. [Operation: Debt Payment / سداد الدين](#5-debt-payment)
6. [Operation: Refund / المرتجع](#6-refund)
7. [Operation: Expense / تسجيل مصروف](#7-expense)
8. [Operation: Delete Debt / حذف الدين](#8-delete-debt)
9. [Operation: Delete Invoice / حذف فاتورة](#9-delete-invoice)
10. [Operation: Delete Expense / حذف مصروف](#10-delete-expense)
11. [Partner Profit Distribution / توزيع أرباح الشركاء](#11-partner-profit-distribution)
12. [Data Storage Architecture / بنية تخزين البيانات](#12-data-storage)
13. [Known Issues & Risks / مشاكل معروفة](#13-known-issues)

---

## 1. User Roles & Account Hierarchy
## الأدوار وتسلسل الحسابات

### 1.1 Role Types / أنواع الأدوار

```
┌─────────────────────────────────────────────────────────────────┐
│                        BOSS (البوس)                             │
│  - Super Admin مسؤول عام                                        │
│  - يدير جميع الحسابات (Admins + Cashiers)                      │
│  - يمكنه إنشاء حسابات Admin مستقلة                             │
│  - يمكنه إلغاء التراخيص وإدارة أكواد التفعيل                  │
│  - لا يخضع لقيود الجهاز (Device Binding)                       │
│  - رخصة دائمة (∞)                                              │
│  File: src/hooks/use-user-role.tsx → role === 'boss'            │
├─────────────────────────────────────────────────────────────────┤
│                       ADMIN (المالك)                            │
│  - صاحب المتجر                                                  │
│  - يُنشأ تلقائياً عند التسجيل المباشر                          │
│  - يرى جميع البيانات (عبر RLS + get_owner_id())               │
│  - يمكنه إنشاء حسابات تابعة فقط (cashier/pos/distributor)     │
│  - لا يخضع لقيود الجهاز                                        │
│  File: src/hooks/use-user-role.tsx → role === 'admin'           │
├─────────────────────────────────────────────────────────────────┤
│                      CASHIER (الكاشير)                          │
│  - حساب تابع يُنشأ عبر Edge Function فقط                      │
│  - مرتبط بمالك عبر owner_id في جدول user_roles                │
│  - يرى فقط بياناته (الفواتير التي أنشأها، الديون التي سجلها)  │
│  - خاضع لقيود الجهاز (جهاز واحد فقط)                          │
│  - 3 أنواع فرعية (user_type في profiles):                      │
│    ├── cashier: وصول كامل للكتالوج الرئيسي                     │
│    ├── distributor: وصول للمستودع المعيّن فقط (متنقل)           │
│    └── pos: وصول للمستودع المعيّن فقط (ثابت)                   │
│  File: src/hooks/use-user-role.tsx → role === 'cashier'         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Account Creation Flow / تدفق إنشاء الحساب

#### A. Direct Signup (التسجيل المباشر → يصبح Admin)

```
المستخدم → شاشة التسجيل (src/pages/Signup.tsx)
  │
  ├─ supabase.auth.signUp({ email, password, fullName })
  │     │
  │     ├─ Trigger: handle_new_user() → creates profile in public.profiles
  │     │   File: DB Function handle_new_user()
  │     │   Fields: { user_id, full_name, phone }
  │     │
  │     └─ Trigger: handle_new_user_role() → creates role in public.user_roles
  │         File: DB Function handle_new_user_role()
  │         Logic: IF NOT EXISTS (role for user) → INSERT role='admin', is_active=true
  │         ⚠️ owner_id = NULL (because admin IS the owner)
  │
  └─ Result: New user with role='admin', sees all data under their user_id
```

#### B. Sub-account Creation (إنشاء حساب تابع بواسطة المالك)

```
المالك (Admin) → إعدادات → إدارة المستخدمين
  │
  ├─ src/hooks/use-users-management.tsx → addUser()
  │     │
  │     ├─ supabase.functions.invoke('create-user', {
  │     │     email, password, fullName, role, userType, phone, allowedPages
  │     │   })
  │     │
  │     └─ Edge Function: supabase/functions/create-user/index.ts
  │           │
  │           ├─ supabaseAdmin.auth.admin.createUser() ← uses SERVICE_ROLE_KEY
  │           │   ⚠️ This BYPASSES handle_new_user_role trigger!
  │           │
  │           ├─ INSERT into public.user_roles:
  │           │   { user_id: newUserId, role: 'cashier', owner_id: callerUserId }
  │           │   ⚠️ owner_id = the Admin who created this account
  │           │
  │           ├─ INSERT into public.profiles:
  │           │   { user_id: newUserId, full_name, phone, user_type, allowed_pages }
  │           │
  │           └─ Result: Cashier account linked to owner via owner_id
  │
  └─ The trigger handle_new_user_role checks IF NOT EXISTS → skips (already inserted by Edge Function)
```

### 1.3 Data Isolation via RLS / عزل البيانات عبر سياسات الأمان

```
┌─────────────────────────────────────────────────────────────────┐
│ KEY FUNCTION: get_owner_id(_user_id)                           │
│ File: DB Function get_owner_id()                               │
│                                                                 │
│ Logic:                                                          │
│   IF role IN ('admin', 'boss') → RETURN _user_id (self)        │
│   IF role = 'cashier' AND owner_id IS NOT NULL → RETURN owner_id│
│   ELSE → RETURN _user_id                                       │
│                                                                 │
│ Used in ALL RLS policies:                                       │
│   WHERE user_id = get_owner_id(auth.uid())                     │
│                                                                 │
│ Effect:                                                         │
│   - Admin queries: user_id = admin's own ID ✅                 │
│   - Cashier queries: user_id = owner's ID ✅ (sees owner data) │
│   - Cashier writes: user_id = owner's ID ✅ (writes to owner)  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Permission Matrix / مصفوفة الصلاحيات

| Page / الصفحة | Boss | Admin | Cashier | Cashier + allowed_pages |
|:---|:---:|:---:|:---:|:---:|
| POS (نقطة البيع) | ✅ | ✅ | ✅ | ✅ |
| Customers (الزبائن) | ✅ | ✅ | ✅ | ✅ |
| Debts (الديون) | ✅ | ✅ | ✅ | ✅ |
| Expenses (المصاريف) | ✅ | ✅ | ✅ | ✅ |
| Dashboard (لوحة التحكم) | ✅ | ✅ | ❌ | ✅ if 'dashboard' in allowed_pages |
| Products (المنتجات) | ✅ | ✅ | ❌ | ✅ if 'products' in allowed_pages |
| Reports (التقارير) | ✅ | ✅ | ❌ | ✅ if 'reports' in allowed_pages |
| Partners (الشركاء) | ✅ | ✅ | ❌ | ❌ (never) |
| Settings (الإعدادات) | ✅ | ✅ | ❌ | ✅ if 'settings' in allowed_pages |
| Warehouses (المستودعات) | ✅ | ✅ | ❌ | ✅ if 'warehouses' in allowed_pages |

**Implementation:**
- Route-level: `src/App.tsx` uses `<RoleGuard allowedRoles={['boss','admin']}>` 
- Component-level: `src/components/auth/RoleGuard.tsx`
- Sidebar filtering: `src/components/layout/Sidebar.tsx` checks `useUserRole()` hooks
- Granular permissions: `profiles.allowed_pages` (jsonb array) checked in `RoleGuard`

### 1.5 Device Binding / ربط الأجهزة

```
Login Flow:
  │
  ├─ src/hooks/use-device-binding.tsx
  │     │
  │     ├─ Generate device fingerprint (src/lib/device-fingerprint.ts)
  │     │   Based on: userAgent + screen + language + timezone + webGL
  │     │
  │     ├─ Check app_licenses.device_id:
  │     │   IF device_id IS NULL → bind this device (first login)
  │     │   IF device_id = current → allow ✅
  │     │   IF device_id ≠ current → BLOCK ❌
  │     │
  │     ├─ Exceptions (bypass binding):
  │     │   - role = 'boss' → always allowed
  │     │   - role = 'admin' → always allowed
  │     │   - app_licenses.allow_multi_device = true → allowed
  │     │
  │     └─ On logout → device_id is cleared
```

---

## 2. Financial Operations Map
## خريطة العمليات المالية

```
                    ┌──────────────────────┐
                    │     بيع نقدي         │
                    │    Cash Sale          │
                    └──────┬───────────────┘
                           │
              ┌────────────┼────────────────────────────┐
              │            │                             │
              ▼            ▼                             ▼
     ┌──────────────┐ ┌──────────┐              ┌──────────────┐
     │  المخزون     │ │ الصندوق  │              │ سجل الأرباح  │
     │  products    │ │ cashbox  │              │ profits-store│
     │  quantity-=N │ │ balance+=│              │ addGrossProfit│
     └──────────────┘ └──────────┘              └──────┬───────┘
              │                                        │
              │                                        ▼
              │                                ┌──────────────┐
              │                                │ توزيع الشركاء│
              │                                │ partners     │
              │                                │ distribute() │
              │                                └──────────────┘
              │
              ▼
     ┌──────────────┐
     │  العميل      │
     │  customers   │
     │  stats+=     │
     └──────────────┘


                    ┌──────────────────────┐
                    │     بيع بالدين       │
                    │    Debt Sale          │
                    └──────┬───────────────┘
                           │
         ┌─────────────────┼──────────────────────────────┐
         │                 │                               │
         ▼                 ▼                               ▼
  ┌──────────────┐  ┌──────────────┐              ┌──────────────┐
  │  المخزون     │  │  الديون      │              │ سجل الأرباح  │
  │  products    │  │  debts       │              │ profits-store│
  │  quantity-=N │  │  new debt    │              │ addGrossProfit│
  └──────────────┘  │  status=due  │              └──────┬───────┘
                    └──────┬───────┘                      │
                           │                              ▼
                           │                      ┌──────────────┐
                           ▼                      │ توزيع الشركاء│
                    ┌──────────────┐              │ partners     │
                    │  العميل      │              │ pendingProfit│ ← ربح معلق
                    │  customers   │              └──────────────┘
                    │  debt+=      │
                    └──────────────┘
  ⚠️ لا يُضاف للصندوق حتى السداد!


                    ┌──────────────────────┐
                    │     سداد دين         │
                    │   Debt Payment       │
                    └──────┬───────────────┘
                           │
         ┌─────────────────┼──────────────────────────────┐
         │                 │                               │
         ▼                 ▼                               ▼
  ┌──────────────┐  ┌──────────────┐              ┌──────────────┐
  │  الصندوق     │  │  الديون      │              │  الشركاء     │
  │  cashbox     │  │  debts       │              │  partners    │
  │  balance+=   │  │  paid+=      │              │  confirm     │
  │  (deposit)   │  │  remaining-= │              │  pending→    │
  └──────────────┘  │  status upd  │              │  confirmed   │
                    └──────┬───────┘              └──────────────┘
                           │                              
                           ▼                              
                    ┌──────────────┐              
                    │  الفاتورة    │              
                    │  invoices    │              
                    │  debt_paid+= │              
                    │  status upd  │              
                    └──────────────┘              
                           │
                           ▼
                    ┌──────────────┐
                    │  العميل      │
                    │  customers   │
                    │  totalDebt-= │
                    └──────────────┘
```

---

## 3. Cash Sale / عملية البيع النقدي

### Code Flow / تدفق الكود

```
CartPanel.tsx → handleCompleteSale()
  │
  ├─── [Cloud Path - PRIMARY]
  │    File: src/components/pos/CartPanel.tsx
  │    
  │    Step 1: addInvoiceCloud()
  │    File: src/lib/cloud/invoices-cloud.ts → addInvoiceCloud()
  │    DB Table: invoices (INSERT)
  │    Fields: { invoice_number, type:'sale', payment_type:'cash', status:'paid',
  │              subtotal, discount, taxRate, taxAmount, total, profit,
  │              cashier_id, cashier_name }
  │    DB Table: invoice_items (INSERT batch)
  │    Fields: { invoice_id, product_id, product_name, quantity, unit_price,
  │              cost_price, amount_original, profit }
  │    
  │    Step 2: deductStockBatchCloud() or deductWarehouseStockBatchCloud()
  │    File: src/lib/cloud/products-cloud.ts → deductStockBatchCloud()
  │    DB: RPC call deduct_product_quantity(_product_id, _amount)
  │    Effect: products.quantity -= sold_quantity (atomic, row-locked)
  │    
  │    Step 3: updateCustomerStatsCloud()
  │    File: src/lib/cloud/customers-cloud.ts → updateCustomerStatsCloud()
  │    DB Table: customers (UPDATE)
  │    Fields: { total_purchases += amount, invoice_count += 1, last_purchase = now }
  │    
  │    Step 4: addGrossProfit()
  │    File: src/lib/profits-store.ts → addGrossProfit()
  │    Storage: localStorage key 'hyperpos_profit_records_v1'
  │    ⚠️ LOCAL ONLY — NOT in Supabase!
  │    Fields: { saleId, grossProfit, cogs, saleTotal, date }
  │    
  │    Step 5: distributeDetailedProfitCloud()
  │    File: src/lib/cloud/partners-cloud.ts → distributeDetailedProfitCloud()
  │    DB Table: partners (UPDATE)
  │    Logic: For each category profit →
  │      - Specialized partners get their category % first
  │      - Full-access partners split remaining proportionally
  │      - For cash: confirmedProfit += share, currentBalance += share
  │      - profitHistory[] gets new record
  │    
  │    Step 6: addSalesToShift()
  │    File: src/lib/cashbox-store.ts → addSalesToShift()
  │    Storage: localStorage key 'hyperpos_cashbox_v1' / 'hyperpos_shifts_v1'
  │    ⚠️ LOCAL ONLY — NOT in Supabase!
  │    Effect: activeShift.salesTotal += amount, cashbox.currentBalance += amount
  │
  ├─── [Local Path - OFFLINE FALLBACK]
  │    File: src/lib/unified-transactions.ts → processCashSale()
  │    Same steps but uses local stores first, then queues for cloud sync
  │
  └─── [Sync Queue Path]
       File: src/lib/cloud/cash-sale-handler.ts → processCashSaleBundleFromQueue()
       Replays all cloud steps when connection restores
```

### Formula / المعادلة

```
COGS = Σ(item.costPrice × item.quantity)
GrossProfit = total - COGS
// Note: 'total' is AFTER discount and tax
// total = subtotal - discount + taxAmount
```

---

## 4. Debt Sale / عملية البيع بالدين

### Code Flow / تدفق الكود

```
CartPanel.tsx → handleCompleteSale() [paymentType === 'debt']
  │
  ├─── File: src/lib/cloud/debt-sale-handler.ts → processDebtSaleWithOfflineSupport()
  │
  │    Step 1: findOrCreateCustomerCloud()
  │    File: src/lib/cloud/customers-cloud.ts
  │    DB: SELECT from customers WHERE name = X → if not found → INSERT
  │    
  │    Step 2: addInvoiceCloud()
  │    File: src/lib/cloud/invoices-cloud.ts
  │    DB Table: invoices (INSERT)
  │    Fields: { payment_type:'debt', status:'pending',
  │              taxRate, taxAmount ← ✅ Fixed (was missing before) }
  │    
  │    Step 3: addDebtFromInvoiceCloud()
  │    File: src/lib/cloud/debts-cloud.ts → addDebtFromInvoiceCloud()
  │    DB Table: debts (INSERT)
  │    Fields: { invoice_id, customer_name, customer_phone,
  │              total_debt: amount, total_paid: 0, remaining_debt: amount,
  │              status: 'due', due_date: +30 days, cashier_id }
  │    
  │    ⚠️ ROLLBACK: If Step 3 fails → deleteInvoiceCloud(invoice.id)
  │    File: src/lib/cloud/invoices-cloud.ts → deleteInvoiceCloud()
  │    This prevents "orphan invoices" with no matching debt record
  │    
  │    Step 4: deductStockBatchCloud()
  │    Same as cash sale
  │    
  │    Step 5: updateCustomerStatsCloud(customerId, total, isDebt=TRUE)
  │    DB: customers.total_purchases += amount
  │    DB: customers.total_debt += amount ← ⚠️ isDebt flag adds to debt
  │    DB: customers.invoice_count += 1
  │    
  │    Step 6: addGrossProfit() — localStorage
  │    ⚠️ Profit is recorded at SALE TIME, not at payment time
  │    
  │    Step 7: distributeDetailedProfitCloud(profits, invoiceId, customerName, isDebt=TRUE)
  │    DB: partners.pendingProfit += share ← NOT confirmedProfit!
  │    DB: partners.pendingProfitDetails[] += { invoiceId, amount, customerName }
  │    ⚠️ Profit stays PENDING until debt is paid
  │
  └─── Offline: saves bundle to encrypted localStorage + sync queue
```

### Key Difference from Cash Sale / الفرق عن البيع النقدي

| Aspect | Cash Sale | Debt Sale |
|:---|:---|:---|
| Cashbox / الصندوق | ✅ balance += total | ❌ NO change until payment |
| Partner profit | confirmedProfit | pendingProfit |
| Invoice status | 'paid' | 'pending' |
| Customer debt | No change | totalDebt += amount |

---

## 5. Debt Payment / سداد الدين

### Code Flow / تدفق الكود

```
src/pages/Debts.tsx → handlePayment()
  │
  │    Step 1: recordPaymentWithInvoiceSyncCloud()
  │    File: src/lib/cloud/debts-cloud.ts
  │    DB Table: debts (UPDATE)
  │    Fields: { total_paid += amount, remaining_debt -= amount,
  │              status: remaining<=0 ? 'fully_paid' : 'partially_paid' }
  │    
  │    Step 1b: Sync with invoice
  │    DB Table: invoices (UPDATE) via invoice_number
  │    Fields: { debt_paid += amount, debt_remaining -= amount }
  │    If fully paid: { status: 'paid', payment_type: 'cash' }
  │    
  │    Step 2: processDebtPayment()
  │    File: src/lib/unified-transactions.ts
  │    Effect: addDepositToShift(amount) → cashbox.currentBalance += amount
  │    ⚠️ LOCAL ONLY (cashbox is localStorage)
  │    
  │    Step 3: confirmPendingProfitCloud()
  │    File: src/lib/cloud/partners-cloud.ts → confirmPendingProfitCloud()
  │    DB Table: partners (UPDATE) for each partner with pending profit for this invoiceId
  │    Fields: { pendingProfit -= confirmedAmount,
  │              confirmedProfit += confirmedAmount,
  │              currentBalance += confirmedAmount,
  │              totalProfitEarned += confirmedAmount,
  │              pendingProfitDetails: remove matched entries }
  │    ⚠️ ratio parameter: 1 = full payment, <1 = partial
  │    
  │    Step 4: updateCustomerStatsCloud(customerId, -amount, isDebt=TRUE)
  │    File: src/lib/cloud/customers-cloud.ts
  │    DB Table: customers (UPDATE)
  │    Fields: { totalDebt -= paymentAmount }
  │    ⚠️ Negative amount reduces the debt balance
  │
  └─── Activity log + event emission
```

### Payment Status Logic / منطق حالة السداد

```javascript
// File: src/lib/cloud/debts-cloud.ts → recordPaymentCloud()
newTotalPaid = debt.totalPaid + paymentAmount;
newRemainingDebt = debt.totalDebt - newTotalPaid;

if (newRemainingDebt <= 0) → status = 'fully_paid'
else if (newTotalPaid > 0)  → status = 'partially_paid'
else                         → status = 'due' (unchanged)
```

---

## 6. Refund / المرتجع (استرداد الفاتورة)

### Code Flow / تدفق الكود

```
src/pages/Invoices.tsx → handleRefund(invoiceId)
  │
  ├─── File: src/lib/cloud/invoices-cloud.ts → refundInvoiceCloud()
  │
  │    Step 1: Validate — prevent double refund
  │    IF cloudInvoice.status === 'refunded' → ABORT
  │    
  │    Step 2: Restore stock
  │    DB: SELECT invoice_items WHERE invoice_id = X
  │    For each item → RPC add_product_quantity(product_id, quantity)
  │    OR → updateWarehouseStockCloud() for assigned warehouse
  │    ⚠️ Skipped for bakery/repair modes (isNoInventoryMode)
  │    
  │    Step 3: Delete associated debts
  │    DB Table: debts → DELETE WHERE invoice_id = invoiceNumber
  │    Tries invoice_number first, then UUID fallback
  │    
  │    Step 4: Reverse customer statistics (DYNAMIC recalculation)
  │    DB: SELECT all active invoices for this customer (excluding refunded ones)
  │    Recalculate: total_purchases, total_debt, invoice_count from scratch
  │    DB Table: customers (UPDATE with recalculated values)
  │    ⚠️ This is more accurate than simple subtraction
  │    
  │    Step 5: Revert partner profit distribution
  │    File: src/lib/partners-store.ts → revertProfitDistribution()
  │    ⚠️ LOCAL ONLY — uses partners-store not partners-cloud!
  │    
  │    Step 5b: For maintenance invoices — delete parts cost expense
  │    DB Table: expenses → DELETE WHERE notes LIKE '%الفاتورة: {id}%'
  │    
  │    Step 6: Mark invoice as refunded
  │    DB Table: invoices (UPDATE)
  │    Fields: { status: 'refunded', notes: 'مسترجعة بتاريخ ...' }
  │
  ├─── [Local Path]
  │    File: src/lib/unified-transactions.ts → processRefund()
  │    
  │    Step A: Restore local stock → restoreStockBatch()
  │    Step B: Restore cloud stock → restoreStockBatchCloud()
  │    Step C: Withdraw from cashbox → addWithdrawalFromShift(total)
  │    Step D: Remove profit record:
  │      IF originalInvoiceId exists → removeGrossProfit(invoiceId)
  │      ELSE → addGrossProfit(refund_id, -grossProfit, cogs, -total) ← negative fallback
  │    Step E: Update customer cloud stats → updateCustomerStatsCloud(id, -total)
  │
  └─── Events: INVOICES_UPDATED, DEBTS_UPDATED, CUSTOMERS_UPDATED, REFUND_PROCESSED
```

### Refund Effects Summary / ملخص تأثيرات المرتجع

| Component | Effect |
|:---|:---|
| Invoice | status → 'refunded' (archived, hidden from active lists) |
| Stock | quantity += returned items |
| Debts | Associated debt records DELETED |
| Customer | Stats recalculated from remaining active invoices |
| Cashbox | balance -= refund total (local) |
| Profits | Record removed or negative entry added |
| Partners | Local revert only (⚠️ not cloud!) |

---

## 7. Expense / تسجيل مصروف

### Code Flow / تدفق الكود

```
src/pages/Expenses.tsx → handleAddExpense()
  │
  ├─── File: src/lib/cloud/expenses-cloud.ts → addExpenseCloud()
  │
  │    Step 1: Load partners who share expenses
  │    File: src/lib/cloud/partners-cloud.ts → loadPartnersCloud()
  │    Filter: partners WHERE sharesExpenses = true
  │    
  │    Step 2: Calculate distributions
  │    For each expense partner:
  │      partnerRatio = partnerExpenseShare / totalExpenseShares
  │      partnerAmount = expenseAmount × partnerRatio
  │    
  │    Step 3: Deduct from partner balances
  │    DB Table: partners (UPDATE)
  │    Fields: { currentBalance -= partnerAmount,
  │              expenseHistory[] += { expenseId, type, amount, date } }
  │    
  │    Step 4: Insert expense record
  │    DB Table: expenses (INSERT)
  │    Fields: { expense_type, amount, description, date, notes,
  │              distributions: [...], cashier_id }
  │    
  │    Step 5: Local profit tracking
  │    File: src/lib/unified-transactions.ts → processExpense()
  │    → addExpensesToShift(amount) → cashbox.currentBalance -= amount
  │    → addOperatingExpense(expenseId, amount, type) → localStorage
  │
  └─── Events: EXPENSES_UPDATED
```

---

## 8. Delete Debt / حذف الدين

### Code Flow / تدفق الكود

```
src/pages/Debts.tsx → handleDeleteDebt(debtId)
  │
  ├─── File: src/lib/cloud/debts-cloud.ts → deleteDebtCloud()
  │    DB Table: debts → DELETE WHERE id = debtId
  │    ⚠️ Does NOT delete the associated invoice!
  │    ⚠️ Does NOT restore customer stats!
  │    ⚠️ Does NOT revert partner pending profits!
  │
  └─── Events: DEBTS_UPDATED

  ⚠️ KNOWN GAP: Deleting a debt manually leaves:
     - The invoice still marked as 'pending' (not 'paid')
     - The customer's totalDebt unchanged
     - Partner's pendingProfit unchanged
     This is by design for manual debt deletion (admin override)
     vs refund which handles all cascading effects
```

---

## 9. Delete Invoice / حذف فاتورة

```
File: src/lib/cloud/invoices-cloud.ts → deleteInvoiceCloud()
  │
  ├─ DB: SELECT invoices WHERE invoice_number = id → get UUID
  ├─ DB: DELETE FROM invoices WHERE id = UUID
  │    ⚠️ CASCADE: invoice_items are auto-deleted (FK constraint)
  │    ⚠️ Does NOT restore stock!
  │    ⚠️ Does NOT delete debts!
  │    ⚠️ Does NOT update customer stats!
  │
  └─ Use refundInvoiceCloud() for proper cascading cleanup
```

---

## 10. Delete Expense / حذف مصروف

```
File: src/lib/cloud/expenses-cloud.ts → deleteExpenseCloud()
  │
  ├─ Step 1: Load expense to get distributions
  ├─ Step 2: Refund partners
  │    For each distribution:
  │      partner.currentBalance += distributedAmount
  │      partner.expenseHistory = filter out this expense
  │    DB Table: partners (UPDATE)
  │
  ├─ Step 3: Delete expense
  │    DB Table: expenses → DELETE WHERE id = expenseId
  │
  └─ ⚠️ Does NOT remove from localStorage profits-store
     (addOperatingExpense is local, but removeOperatingExpense exists and should be called)
```

---

## 11. Partner Profit Distribution / توزيع أرباح الشركاء

### Distribution Algorithm / خوارزمية التوزيع

```
File: src/lib/cloud/partners-cloud.ts → distributeDetailedProfitCloud()

Input: profits[] = [{ category: 'electronics', profit: 100 }, ...]

For each { category, profit }:
  │
  ├─── Phase 1: Specialized Partners (المتخصصون)
  │    Filter: partners WHERE accessAll=false AND categoryShares includes this category
  │    For each: partnerShare = profit × (categoryPercentage / 100)
  │    remainingProfit -= partnerShare
  │
  ├─── Phase 2: Full-Access Partners (الشاملون)
  │    Filter: partners WHERE accessAll=true
  │    totalFullShare = SUM(sharePercentage)
  │    For each: partnerShare = remainingProfit × (sharePercentage / totalFullShare)
  │
  └─── For each partner's share:
       IF isDebt:
         partner.pendingProfit += share
         partner.pendingProfitDetails[] += { invoiceId, amount, customerName }
       ELSE (cash):
         partner.confirmedProfit += share
         partner.currentBalance += share
         partner.totalProfitEarned += share
       
       partner.profitHistory[] += { invoiceId, amount, category, isDebt }
```

### Confirming Pending Profit / تأكيد الأرباح المعلقة

```
File: src/lib/cloud/partners-cloud.ts → confirmPendingProfitCloud()
Called when: debt is paid (from Debts.tsx)

Input: invoiceId, ratio (1 = full payment)

For each partner:
  pendingDetails = filter where invoiceId matches
  amountToConfirm = detail.amount × ratio
  
  partner.pendingProfit -= amountToConfirm
  partner.confirmedProfit += amountToConfirm
  partner.currentBalance += amountToConfirm
  partner.totalProfitEarned += amountToConfirm
  partner.pendingProfitDetails = remove confirmed entries
```

---

## 12. Data Storage Architecture / بنية تخزين البيانات

### Cloud (Supabase) — Persistent / سحابي دائم

| Table | Purpose | Key Operations |
|:---|:---|:---|
| `invoices` | All sale invoices | INSERT on sale, UPDATE on payment/refund |
| `invoice_items` | Line items per invoice | INSERT on sale, CASCADE delete |
| `debts` | Debt records | INSERT on debt sale, UPDATE on payment, DELETE on refund |
| `customers` | Customer profiles & stats | INSERT/UPDATE on sale, UPDATE on payment/refund |
| `products` | Product catalog & stock | UPDATE quantity via RPC (atomic) |
| `expenses` | Expense records | INSERT, DELETE (with partner refund) |
| `partners` | Partner financial data | UPDATE on profit/expense/capital |
| `categories` | Product categories | CRUD |
| `warehouses` | Warehouse definitions | CRUD |
| `warehouse_stock` | Stock per warehouse | UPDATE on transfers/sales |
| `user_roles` | Role + owner_id mapping | INSERT on account creation |
| `profiles` | User profile data | INSERT on signup, UPDATE |
| `app_licenses` | License + device binding | UPDATE on login/activation |
| `stores` | Store settings | CRUD |

### Local (localStorage) — Session/Volatile / محلي مؤقت

| Key | Purpose | ⚠️ Risk |
|:---|:---|:---|
| `hyperpos_profit_records_v1` | Profit records | **HIGH** — lost on cache clear |
| `hyperpos_expense_records_v1` | Operating expense records | **HIGH** — lost on cache clear |
| `hyperpos_cashbox_v1` | Cashbox balance | **MEDIUM** — dashboard uses cloud calc |
| `hyperpos_shifts_v1` | Shift history | **MEDIUM** — local only |
| `hyperpos_invoices_cache` | Offline invoice cache | LOW — cache only |
| `hyperpos_customers_cache` | Offline customers cache | LOW — cache only |
| `hyperpos_debts_cache` | Offline debts cache | LOW — cache only |
| `hyperpos_expenses_cache` | Offline expenses cache | LOW — cache only |
| `hyperpos_partners_cache` | Offline partners cache | LOW — cache only |

---

## 13. Known Issues & Risks / مشاكل معروفة

### 🔴 Critical / حرجة

| # | Issue | Impact | Location |
|:---|:---|:---|:---|
| 1 | `profits-store` uses localStorage only | Profit data lost on cache clear or device change | `src/lib/profits-store.ts` |
| 2 | `cashbox-store` uses localStorage only | Shift data not synced between devices | `src/lib/cashbox-store.ts` |
| 3 | Refund reverts partner profits locally only | Cloud partner data may retain reverted profits | `refundInvoiceCloud` calls `partners-store.revertProfitDistribution` instead of cloud version |
| 4 | Invoice numbering from localStorage counter | Risk of duplicate numbers with multiple devices | `invoices-cloud.ts → getNextInvoiceNumber()` counts existing invoices |

### 🟡 Medium / متوسطة

| # | Issue | Impact | Location |
|:---|:---|:---|:---|
| 5 | Manual debt deletion doesn't cascade | Customer stats and partner profits remain stale | `debts-cloud.ts → deleteDebtCloud()` |
| 6 | Two cashbox tracking systems | `cashbox-store` (shifts) and `capital-store` may show different balances | Architecture-level |
| 7 | Debt payment type in shifts | Recorded as generic 'deposit' instead of 'debt_payment' | `unified-transactions.ts → processDebtPayment()` uses `addDepositToShift()` |

### 🟢 Low / منخفضة

| # | Issue | Impact | Location |
|:---|:---|:---|:---|
| 8 | Cache TTL = 30 seconds | Stale data possible in multi-device scenarios | All cloud stores use 30s TTL |
| 9 | Offline debt sales use encrypted localStorage | Limited storage capacity | `debt-sale-handler.ts` |

---

## Appendix: Event System / نظام الأحداث

```
File: src/lib/events.ts

Events emitted by financial operations:
  TRANSACTION_COMPLETED  → { type, total, grossProfit, cogs }
  CASHBOX_UPDATED        → { balance } or { added/removed }
  INVOICES_UPDATED       → null (invalidate cache)
  DEBTS_UPDATED          → null (invalidate cache)
  CUSTOMERS_UPDATED      → null (invalidate cache)
  EXPENSES_UPDATED       → null (invalidate cache)
  PARTNERS_UPDATED       → null (invalidate cache)
  PROFITS_UPDATED        → records[]
  REFUND_PROCESSED       → { total, originalInvoiceId }
  CAPITAL_UPDATED        → capitalState
```

---

## Appendix: Database Functions / دوال قاعدة البيانات

| Function | Purpose | Security |
|:---|:---|:---|
| `get_owner_id(uuid)` | Returns owner ID (self for admin, owner_id for cashier) | SECURITY DEFINER |
| `has_role(uuid, role)` | Checks if user has specific role | SECURITY DEFINER |
| `is_boss(uuid)` | Checks if user is boss | SECURITY DEFINER |
| `is_first_user()` | Checks if no users exist yet (for first admin) | SECURITY DEFINER |
| `get_user_role(uuid)` | Returns user's role (with permission check) | SECURITY DEFINER |
| `deduct_product_quantity(uuid, int)` | Atomic stock deduction with row lock | SECURITY DEFINER |
| `add_product_quantity(uuid, int)` | Atomic stock addition | SECURITY DEFINER |
| `can_add_cashier(uuid)` | Checks license cashier limit | SECURITY DEFINER |
| `count_owner_cashiers(uuid)` | Counts active cashiers for owner | SECURITY DEFINER |
| `is_license_valid(uuid)` | Checks license expiry and revocation | SECURITY DEFINER |
| `delete_owner_cascade(uuid)` | Deletes owner + all related data | SECURITY DEFINER, boss only |
| `revoke_license(uuid, text)` | Revokes a license | SECURITY DEFINER, boss only |
| `reset_user_device(uuid)` | Clears device binding | SECURITY DEFINER, boss only |

---

*End of Document / نهاية المستند*
