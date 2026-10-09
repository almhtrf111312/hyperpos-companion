const fs = require('fs');
let path = 'src/components/pos/CartPanel.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. handleCashSale
const oldHandleCashSale = `const handleCashSale = async () => {
    if (cart.length === 0) return;

    // 🛡️ فحص استباقي: التحقق من أن كل صنف في السلة معتمد وموجود في الكتالوج السحابي
    const validation = await validateCartProducts(cart);
    if (!validation.isValid) {
      showToast.error(
        \`تعذر المتابعة: الصنف "\${validation.invalidItems.join('، ')}" غير معتمد أو تم حذفه من السحابة. يرجى إزالته من السلة.\`,
        { persistent: false }
      );
      return;
    }

    // إذا كان هناك عجز في المقبوض وعميل مسجل، نفتح البيع المركب مباشرة
    if (!wholesaleMode && receivedAmount > 0 && receivedAmount < totalInReceivedCurrency) {
      showToast.error(
        \`المبلغ المقبوض (\${activeReceivedCurrency.symbol}\${formatNumber(receivedAmount)}) أقل من إجمالي الفاتورة (\${activeReceivedCurrency.symbol}\${formatNumber(totalInReceivedCurrency)}). يرجى إدخال المبلغ كاملاً أو استخدام 'بيع مؤجل'.\`
      );
      return;
    }

    setShowCashDialog(true);
  };`;
const oldHandleCashSaleClean = oldHandleCashSale.replace(/\r\n/g, '\n');

const newHandleCashSale = `const handleCashSale = async () => {
    if (cart.length === 0) return;

    const validation = await validateCartProducts(cart);
    if (!validation.isValid) {
      showToast.error(\`تعذر المتابعة: الصنف "\${validation.invalidItems.join('، ')}" غير متاح.\`);
      return;
    }

    // إذا كان هناك عجز في المقبوض، نعتمده تلقائياً كخصم فوري ونسأل المستخدم أو نتمم
    if (!wholesaleMode && receivedUSD > 0 && receivedUSD < roundCurrency(total) - 0.01) {
      const deficitInCurrency = roundCurrency(remainingInReceivedCurrency);
      const confirmDeficit = window.confirm(
        \`المبلغ المقبوض (\${activeReceivedCurrency.symbol}\${formatNumber(receivedAmount)}) أقل من الفاتورة.\\nهل تريد اعتماد العجز (\${activeReceivedCurrency.symbol}\${formatNumber(deficitInCurrency)}) كخصم فوري وإتمام البيع نقداً؟\`
      );
      if (confirmDeficit) {
        handleApplyDeficitAsDiscount();
        // فتح حوار التأكيد بعد تطبيق الخصم
        setTimeout(() => setShowCashDialog(true), 100);
        return;
      } else {
        // إذا رفض الخصم وكان هناك عميل، نفتح البيع الآجل
        if (isRealCustomerSelected(customerName)) {
          handleDebtSale();
          return;
        }
        showToast.info('يرجى استكمال المبلغ أو تحديد عميل لتسجيل الباقي كدين.');
        return;
      }
    }

    setShowCashDialog(true);
  };`;

let codeClean = code.replace(/\r\n/g, '\n');
codeClean = codeClean.replace(oldHandleCashSaleClean, newHandleCashSale);

// 2. Trash
const oldTrash = `<button
                  type="button"
                  onClick={() => onRemoveItem(item.id, item.unit)}
                  className="w-7 h-7 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0 transition-colors"
                  title="حذف من السلة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>`;

const newTrash = `{/* زر حذف مكبّر ومريح للمس السريع */}
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id, item.unit)}
                  className="w-8 h-8 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0 transition-all active:scale-90"
                  title="حذف من السلة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>`;

codeClean = codeClean.replace(oldTrash, newTrash);

// 3. Price
const oldPrice = `<span className={cn("font-bold text-xs md:text-sm tabular-nums min-w-[48px] text-left", wholesaleMode ? "text-orange-500" : "text-primary")}>
                    \${formatNumber(getItemPrice(item) * item.quantity)}
                  </span>`;

const newPrice = `{/* استبدال الـ $ الثابت برمز العملة المختارة ومعدل الصرف */}
                  <span className={cn("font-bold text-xs md:text-sm tabular-nums min-w-[48px] text-left", wholesaleMode ? "text-warning" : "text-primary")}>
                    {selectedCurrency.symbol}{formatNumber(getItemPrice(item) * item.quantity * (selectedCurrency.rate || 1))}
                  </span>`;

codeClean = codeClean.replace(oldPrice, newPrice);

if (!codeClean.includes('window.confirm')) console.log('ERROR handleCashSale');
if (!codeClean.includes('w-8 h-8 rounded-lg')) console.log('ERROR trash');
if (!codeClean.includes('selectedCurrency.symbol')) console.log('ERROR price');

fs.writeFileSync(path, codeClean);
console.log('CartPanel fully updated!');
