const fs = require('fs');

// 1. Modifying src/lib/cloud/invoices-cloud.ts
let invoicesCloud = fs.readFileSync('src/lib/cloud/invoices-cloud.ts', 'utf8');

if (!invoicesCloud.includes('pending_sync?: boolean;')) {
  invoicesCloud = invoicesCloud.replace(
    /export interface Invoice \{/,
    `export interface Invoice {
  pending_sync?: boolean;
  sync_failed?: boolean;`
  );
}

// Intercept fetchInvoicesFromCloud return
if (!invoicesCloud.includes('getPendingOperations')) {
  invoicesCloud = `import { getPendingOperations } from '../sync-queue';\n` + invoicesCloud;
}

if (!invoicesCloud.includes('const mergeSyncQueueInvoices')) {
  const mergeLogic = `
function mergeSyncQueueInvoices(invoices: Invoice[]): Invoice[] {
  const pending = getPendingOperations();
  const queueInvoices: Invoice[] = [];
  
  for (const op of pending) {
    if (op.type === 'invoice_create' || op.type === 'debt_sale_bundle') {
      const bundle = op.data.bundle as any;
      if (!bundle) continue;
      
      const isFailed = op.status === 'failed';
      const isSyncing = op.status === 'processing';
      
      const inv: Invoice = {
        id: (op.data.operationId || op.data.localId || op.id) as string,
        type: 'sale',
        customerName: bundle.customerName || 'عميل نقدي',
        items: bundle.items || [],
        subtotal: bundle.subtotal || 0,
        discount: bundle.discount || 0,
        total: bundle.total || 0,
        totalInCurrency: bundle.totalInCurrency || bundle.total || 0,
        currency: bundle.currency || 'USD',
        currencySymbol: bundle.currencySymbol || '$',
        paymentType: op.type === 'debt_sale_bundle' ? 'debt' : 'cash',
        status: 'pending',
        createdAt: op.timestamp || op.createdAt || new Date().toISOString(),
        updatedAt: op.timestamp || op.createdAt || new Date().toISOString(),
        pending_sync: true,
        sync_failed: isFailed,
        cashierId: bundle.cashierId,
        debtPaid: bundle.downPayment || 0,
        debtRemaining: (bundle.total || 0) - (bundle.downPayment || 0)
      };
      
      queueInvoices.push(inv);
    }
  }
  
  // Filter out any duplicates if they exist
  const existingIds = new Set(invoices.map(i => i.id));
  const uniqueQueue = queueInvoices.filter(qi => !existingIds.has(qi.id));
  
  return [...uniqueQueue, ...invoices];
}
`;
  invoicesCloud = invoicesCloud + mergeLogic;
  
  // Replace all `return fetchInvoicesFromCloud` with `return fetchInvoicesFromCloud(userId).then(mergeSyncQueueInvoices)`
  // Also we need to wrap localInvoices return
  invoicesCloud = invoicesCloud.replace(
    /return fetchInvoicesFromCloud\(userId\);/g,
    `return fetchInvoicesFromCloud(userId).then(mergeSyncQueueInvoices);`
  );
  
  invoicesCloud = invoicesCloud.replace(
    /return localInvoices \|\| \[\];/g,
    `return mergeSyncQueueInvoices(localInvoices || []);`
  );
  
  invoicesCloud = invoicesCloud.replace(
    /return localInvoices;/g,
    `return mergeSyncQueueInvoices(localInvoices);`
  );
  
  invoicesCloud = invoicesCloud.replace(
    /return invoicesCache \|\| \[\];/g,
    `return mergeSyncQueueInvoices(invoicesCache || []);`
  );
}

fs.writeFileSync('src/lib/cloud/invoices-cloud.ts', invoicesCloud);


// 2. Modifying src/lib/cloud/debts-cloud.ts
let debtsCloud = fs.readFileSync('src/lib/cloud/debts-cloud.ts', 'utf8');

if (!debtsCloud.includes('pending_sync?: boolean;')) {
  debtsCloud = debtsCloud.replace(
    /export interface Debt \{/,
    `export interface Debt {
  pending_sync?: boolean;
  sync_failed?: boolean;`
  );
}

if (!debtsCloud.includes('getPendingOperations')) {
  debtsCloud = `import { getPendingOperations } from '../sync-queue';\n` + debtsCloud;
}

if (!debtsCloud.includes('const mergeSyncQueueDebts')) {
  const mergeDebtsLogic = `
function mergeSyncQueueDebts(debts: Debt[]): Debt[] {
  const pending = getPendingOperations();
  const queueDebts: Debt[] = [];
  
  for (const op of pending) {
    if (op.type === 'debt_sale_bundle') {
      const bundle = op.data.bundle as any;
      if (!bundle) continue;
      
      const isFailed = op.status === 'failed';
      
      const remaining = (bundle.total || 0) - (bundle.downPayment || 0);
      if (remaining <= 0) continue;
      
      const debt: Debt = {
        id: (op.data.operationId || op.data.localId || op.id) as string,
        invoiceId: (op.data.operationId || op.data.localId || op.id) as string,
        customerId: bundle.customerId,
        customerName: bundle.customerName || 'عميل',
        customerPhone: bundle.customerPhone || '',
        totalDebt: bundle.total || 0,
        totalPaid: bundle.downPayment || 0,
        remainingDebt: remaining,
        dueDate: bundle.dueDate || new Date().toISOString(),
        status: 'pending',
        createdAt: op.timestamp || op.createdAt || new Date().toISOString(),
        updatedAt: op.timestamp || op.createdAt || new Date().toISOString(),
        pending_sync: true,
        sync_failed: isFailed,
        isCashDebt: false,
      };
      
      queueDebts.push(debt);
    }
  }
  
  const existingIds = new Set(debts.map(d => d.invoiceId));
  const uniqueQueue = queueDebts.filter(qd => !existingIds.has(qd.invoiceId));
  
  return [...uniqueQueue, ...debts];
}
`;
  debtsCloud = debtsCloud + mergeDebtsLogic;
  
  debtsCloud = debtsCloud.replace(
    /return fetchFresh_loadDebtsCloud\(\);/g,
    `return fetchFresh_loadDebtsCloud().then(mergeSyncQueueDebts);`
  );
  
  debtsCloud = debtsCloud.replace(
    /return local;/g,
    `return mergeSyncQueueDebts(local);`
  );
}

fs.writeFileSync('src/lib/cloud/debts-cloud.ts', debtsCloud);

console.log("Modified clouds successfully.");
