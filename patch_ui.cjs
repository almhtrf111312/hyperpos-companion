const fs = require('fs');

// Invoices.tsx
let invoicesFile = fs.readFileSync('src/pages/Invoices.tsx', 'utf8');

const invoiceBadgeStr = `                          {invoice.status === 'refunded' && (`;
const invoiceBadgeNew = `                          {invoice.pending_sync && (
                            <Badge variant={invoice.sync_failed ? "destructive" : "outline"} className={!invoice.sync_failed ? "bg-blue-500/10 text-blue-500 border-blue-500/30" : ""}>
                              {invoice.sync_failed ? "فشل في المزامنة" : "غير متزامنة"}
                            </Badge>
                          )}
                          {invoice.status === 'refunded' && (`;

if (invoicesFile.includes(invoiceBadgeStr) && !invoicesFile.includes('invoice.pending_sync &&')) {
  invoicesFile = invoicesFile.replace(invoiceBadgeStr, invoiceBadgeNew);
  fs.writeFileSync('src/pages/Invoices.tsx', invoicesFile);
}

// Debts.tsx
let debtsFile = fs.readFileSync('src/pages/Debts.tsx', 'utf8');

const debtBadgeStr = `                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{debt.customerName}</span>`;

const debtBadgeNew = `                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{debt.customerName}</span>
                            {debt.pending_sync && (
                              <Badge variant={debt.sync_failed ? "destructive" : "outline"} className={!debt.sync_failed ? "bg-blue-500/10 text-blue-500 border-blue-500/30" : ""}>
                                {debt.sync_failed ? "فشل في المزامنة" : "غير متزامنة"}
                              </Badge>
                            )}`;

if (debtsFile.includes(debtBadgeStr) && !debtsFile.includes('debt.pending_sync &&')) {
  debtsFile = debtsFile.replace(debtBadgeStr, debtBadgeNew);
  fs.writeFileSync('src/pages/Debts.tsx', debtsFile);
}

console.log("Modified UI files.");
