const fs = require('fs');

const pendingStr = "\\u063A\\u064A\\u0631 \\u0645\\u062A\\u0632\\u0627\\u0645\\u0646\\u0629";
const failedStr = "\\u0641\\u0634\\u0644 \\u0641\\u064A \\u0627\\u0644\\u0645\\u0632\\u0627\\u0645\\u0646\\u0629";

// 1. Invoices Cloud
let invoicesCloud = fs.readFileSync('src/lib/cloud/invoices-cloud.ts', 'utf8');
if (!invoicesCloud.includes('pending_sync?: boolean;')) {
  invoicesCloud = invoicesCloud.replace(
    /export interface Invoice \{/,
    "export interface Invoice {\n  pending_sync?: boolean;\n  sync_failed?: boolean;"
  );
  invoicesCloud = "import { getPendingOperations } from '../sync-queue';\n" + invoicesCloud;
  
  const mergeLogic = `
function mergeSyncQueueInvoices(invoices) {
  const pending = getPendingOperations();
  const queueInvoices = [];
  for (const op of pending) {
    if (op.type === 'invoice_create' || op.type === 'debt_sale_bundle') {
      const bundle = op.data.bundle || {};
      const isFailed = op.status === 'failed';
      queueInvoices.push({
        id: op.data.operationId || op.data.localId || op.id,
        type: 'sale',
        customerName: bundle.customerName || 'Customer',
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
      });
    }
  }
  const existingIds = new Set(invoices.map(i => i.id));
  const uniqueQueue = queueInvoices.filter(qi => !existingIds.has(qi.id));
  return [...uniqueQueue, ...invoices];
}
`;
  invoicesCloud += mergeLogic;
  invoicesCloud = invoicesCloud.replace(
    /return fetchInvoicesFromCloud\(userId\);/g,
    "return fetchInvoicesFromCloud(userId).then(mergeSyncQueueInvoices);"
  );
  invoicesCloud = invoicesCloud.replace(
    /return localInvoices \|\| \[\];/g,
    "return mergeSyncQueueInvoices(localInvoices || []);"
  );
  invoicesCloud = invoicesCloud.replace(
    /return localInvoices;/g,
    "return mergeSyncQueueInvoices(localInvoices);"
  );
  invoicesCloud = invoicesCloud.replace(
    /return invoicesCache \|\| \[\];/g,
    "return mergeSyncQueueInvoices(invoicesCache || []);"
  );
  fs.writeFileSync('src/lib/cloud/invoices-cloud.ts', invoicesCloud);
}

// 2. Debts Cloud
let debtsCloud = fs.readFileSync('src/lib/cloud/debts-cloud.ts', 'utf8');
if (!debtsCloud.includes('pending_sync?: boolean;')) {
  debtsCloud = debtsCloud.replace(
    /export interface Debt \{/,
    "export interface Debt {\n  pending_sync?: boolean;\n  sync_failed?: boolean;"
  );
  debtsCloud = "import { getPendingOperations } from '../sync-queue';\n" + debtsCloud;
  const mergeDebtsLogic = `
function mergeSyncQueueDebts(debts) {
  const pending = getPendingOperations();
  const queueDebts = [];
  for (const op of pending) {
    if (op.type === 'debt_sale_bundle') {
      const bundle = op.data.bundle || {};
      const remaining = (bundle.total || 0) - (bundle.downPayment || 0);
      if (remaining <= 0) continue;
      queueDebts.push({
        id: op.data.operationId || op.data.localId || op.id,
        invoiceId: op.data.operationId || op.data.localId || op.id,
        customerId: bundle.customerId,
        customerName: bundle.customerName || 'Customer',
        customerPhone: bundle.customerPhone || '',
        totalDebt: bundle.total || 0,
        totalPaid: bundle.downPayment || 0,
        remainingDebt: remaining,
        dueDate: bundle.dueDate || new Date().toISOString(),
        status: 'pending',
        createdAt: op.timestamp || op.createdAt || new Date().toISOString(),
        updatedAt: op.timestamp || op.createdAt || new Date().toISOString(),
        pending_sync: true,
        sync_failed: op.status === 'failed',
        isCashDebt: false,
      });
    }
  }
  const existingIds = new Set(debts.map(d => d.invoiceId));
  const uniqueQueue = queueDebts.filter(qd => !existingIds.has(qd.invoiceId));
  return [...uniqueQueue, ...debts];
}
`;
  debtsCloud += mergeDebtsLogic;
  debtsCloud = debtsCloud.replace(
    /return fetchFresh_loadDebtsCloud\(\);/g,
    "return fetchFresh_loadDebtsCloud().then(mergeSyncQueueDebts);"
  );
  debtsCloud = debtsCloud.replace(
    /return local;/g,
    "return mergeSyncQueueDebts(local);"
  );
  fs.writeFileSync('src/lib/cloud/debts-cloud.ts', debtsCloud);
}

// 3. UI Invoices
let invUi = fs.readFileSync('src/pages/Invoices.tsx', 'utf8');
const invSearch = "                        {invoice.status === 'refunded' && (";
const invReplace = `                          {invoice.pending_sync && (
                            <Badge variant={invoice.sync_failed ? 'destructive' : 'outline'} className={!invoice.sync_failed ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : ''}>
                              {invoice.sync_failed ? '${failedStr}' : '${pendingStr}'}
                            </Badge>
                          )}
` + invSearch;
if (!invUi.includes('invoice.pending_sync')) {
  invUi = invUi.replace(invSearch, invReplace);
  fs.writeFileSync('src/pages/Invoices.tsx', invUi);
}

// 4. UI Debts
let debtsUi = fs.readFileSync('src/pages/Debts.tsx', 'utf8');
const debtSearch = '<h3 className="font-semibold text-foreground text-sm md:text-base">{debt.customerName}</h3>';
const debtReplace = debtSearch + `
                            {debt.pending_sync && (
                              <Badge variant={debt.sync_failed ? 'destructive' : 'outline'} className={!debt.sync_failed ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : ''}>
                                {debt.sync_failed ? '${failedStr}' : '${pendingStr}'}
                              </Badge>
                            )}`;
if (!debtsUi.includes('debt.pending_sync')) {
  debtsUi = debtsUi.replace(debtSearch, debtReplace);
  fs.writeFileSync('src/pages/Debts.tsx', debtsUi);
}

console.log("Safe patch applied.");


