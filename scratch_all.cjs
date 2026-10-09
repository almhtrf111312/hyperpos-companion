const fs = require('fs');
let path = 'src/components/pos/CartPanel.tsx';
let code = fs.readFileSync(path, 'utf8');
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

const regexCashSale = /const handleCashSale = async \(\) => \{[\s\S]*?setShowCashDialog\(true\);\s*\};/;
code = code.replace(regexCashSale, newHandleCashSale);
const newTrash = `{/* زر حذف مكبّر ومريح للمس السريع */}
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id, item.unit)}
                    className="w-8 h-8 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0 transition-all active:scale-90"
                    title="حذف من السلة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>`;
const regexTrash = /<button[\s]*onClick=\{\(\) => onRemoveItem\(item\.id, item\.unit\)\}[\s\S]*?<Trash2 className="w-3 h-3" \/>[\s\S]*?<\/button>/;
code = code.replace(regexTrash, newTrash);
const regexPrice = /<span className=\{cn\("font-bold text-sm tabular-nums", wholesaleMode \? "text-orange-500" : "text-primary"\)\}>[\s\S]*?<\/span>/;
const newPrice = `{/* استبدال الـ $ الثابت برمز العملة المختارة ومعدل الصرف */}
                    <span className={cn("font-bold text-xs md:text-sm tabular-nums min-w-[48px] text-left", wholesaleMode ? "text-warning" : "text-primary")}>
                      {selectedCurrency.symbol}{formatNumber(getItemPrice(item) * item.quantity * (selectedCurrency.rate || 1))}
                    </span>`;
code = code.replace(regexPrice, newPrice);
fs.writeFileSync(path, code);

// ThemeSection
path = 'src/components/settings/ThemeSection.tsx';
code = fs.readFileSync(path, 'utf8');
const regexTheme = /<div className="grid grid-cols-2 gap-4 mb-6">[\s\S]*?<button[\s\S]*?handleModeChange\('dark'\)[\s\S]*?<\/button>\s*<\/div>/;
const newTheme = `<div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            type="button"
            onClick={() => handleModeChange('light')}
            className={cn(
              "flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all relative active:scale-95",
              pendingMode === 'light'
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/60 bg-muted/40 hover:bg-muted/70"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              pendingMode === 'light' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15 text-muted-foreground"
            )}>
              <Sun className="w-4 h-4" />
            </div>
            <span className="text-xs md:text-sm font-bold text-foreground">{t('settings.lightMode')}</span>
            {pendingMode === 'light' && (
              <Check className="w-4 h-4 text-primary absolute rtl:left-2.5 ltr:right-2.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('dark')}
            className={cn(
              "flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all relative active:scale-95",
              pendingMode === 'dark'
                ? "border-primary bg-primary/10 shadow-xs"
                : "border-border/60 bg-muted/40 hover:bg-muted/70"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              pendingMode === 'dark' ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15 text-muted-foreground"
            )}>
              <Moon className="w-4 h-4" />
            </div>
            <span className="text-xs md:text-sm font-bold text-foreground">{t('settings.darkMode')}</span>
            {pendingMode === 'dark' && (
              <Check className="w-4 h-4 text-primary absolute rtl:left-2.5 ltr:right-2.5" />
            )}
          </button>
        </div>`;
code = code.replace(regexTheme, newTheme);
fs.writeFileSync(path, code);

// ProductGrid
path = 'src/components/pos/ProductGrid.tsx';
code = fs.readFileSync(path, 'utf8');
const regexGridFooter = /<p className="text-primary font-bold text-\[10px\] sm:text-\[11px\] md:text-sm">\$[\s\S]*?<\/div>/;
const newGridFooter = `<div className="flex items-center justify-between text-[10px] gap-1 pt-1 border-t border-border/40 w-full mt-auto">
                  <span className="font-black text-primary truncate text-xs">
                    \${product.price}
                  </span>
                  <span className="text-muted-foreground font-bold text-[9px] bg-muted/80 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0 border border-border/30">
                    {product.quantity} {product.smallUnit || 'قطعة'}
                  </span>
                </div>`;
code = code.replace(regexGridFooter, newGridFooter);
fs.writeFileSync(path, code);
console.log('All files updated');
