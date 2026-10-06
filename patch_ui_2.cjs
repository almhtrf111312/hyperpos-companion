const fs = require('fs');

let content = fs.readFileSync('src/pages/Invoices.tsx', 'utf8');
const search = `                          {invoice.status === 'refunded' && (`;
const replace = `                          {invoice.pending_sync && (
                            <Badge variant={invoice.sync_failed ? 'destructive' : 'outline'} className={!invoice.sync_failed ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : ''}>
                              {invoice.sync_failed ? 'فشل في المزامنة' : 'غير متزامنة'}
                            </Badge>
                          )}
` + search;
content = content.replace(search, replace);
fs.writeFileSync('src/pages/Invoices.tsx', content);

let debts = fs.readFileSync('src/pages/Debts.tsx', 'utf8');
const dsearch = `<span className="font-semibold truncate">{debt.customerName}</span>`;
const dreplace = dsearch + `
                            {debt.pending_sync && (
                              <Badge variant={debt.sync_failed ? 'destructive' : 'outline'} className={!debt.sync_failed ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : ''}>
                                {debt.sync_failed ? 'فشل في المزامنة' : 'غير متزامنة'}
                              </Badge>
                            )}`;
debts = debts.replace(dsearch, dreplace);
fs.writeFileSync('src/pages/Debts.tsx', debts);
