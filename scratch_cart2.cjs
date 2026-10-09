const fs = require('fs');

let path = 'src/components/pos/CartPanel.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Red badge for deficit
const oldWarning = `{receivedAmount > 0 && !wholesaleMode && receivedUSD < total - 0.001 && (
                  <span className="bg-warning/10 text-warning px-1.5 py-0.5 rounded font-bold">
                    مقبوض: {activeReceivedCurrency.symbol}{formatNumber(receivedAmount)} — متبقٍ: {activeReceivedCurrency.symbol}{formatNumber(remainingInReceivedCurrency)}
                    {activeReceivedCurrency.code !== 'USD' && \` ($\${formatNumber(remainingUSD)})\`}
                  </span>
                )}`;

const newWarning = `{receivedAmount > 0 && !wholesaleMode && receivedUSD < total - 0.01 && (
                  <div className="flex flex-col gap-1 w-full mt-1 animate-in fade-in zoom-in-95 duration-200">
                    <span className="bg-destructive/15 text-destructive px-2 py-1.5 rounded-md text-xs font-bold text-center border border-destructive/30 shadow-sm flex items-center justify-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      المبلغ المقبوض أقل من الإجمالي - هل ترغب بالمتابعة؟
                    </span>
                    <span className="bg-warning/10 text-warning px-1.5 py-0.5 rounded font-bold text-center text-xs">
                      مقبوض: {activeReceivedCurrency.symbol}{formatNumber(receivedAmount)} — متبقٍ: {activeReceivedCurrency.symbol}{formatNumber(remainingInReceivedCurrency)}
                    </span>
                  </div>
                )}`;

code = code.replace(oldWarning, newWarning);

// 2. Adjust discount inputs height for touch targets
code = code.replace(/h-9 min-w-0 w-full items-center/g, 'h-10 min-w-0 w-full items-center');
code = code.replace(/<span className={cn\(\s*"flex items-center justify-center w-5 h-5 rounded-md text-\[10px\] font-bold flex-shrink-0 transition-colors"/g, 
  '<span className={cn(\n                    "flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold flex-shrink-0 transition-colors"');

// 3. Adjust currency pills
code = code.replace(/"flex-1 py-1 rounded-md text-\[10px\] font-semibold transition-all leading-none"/g, 
  '"flex-1 py-1.5 min-h-[36px] rounded-md text-[11px] font-bold transition-all flex items-center justify-center leading-none"');

fs.writeFileSync(path, code);
console.log('CartPanel.tsx UI updated!');
