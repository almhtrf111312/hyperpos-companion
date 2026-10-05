const fs = require('fs');
let c = fs.readFileSync('src/components/pos/CartPanel.tsx', 'utf8');

// Remove Split Payment button (and keep Debt Button)
c = c.replace(/\{\/\* زر بيع مركب صريح يظهر عند وجود مقبوض جزئي \*\/\}[\s\S]*?\{\/\* Share Invoice as Image Action \*\/\}/, `<Button
                data-tour="debt-btn"
                variant="outline"
                className="flex-1 h-11 border-2 border-warning/70 text-warning hover:bg-warning/10 text-sm font-bold transition-all active:scale-95 rounded-xl"
                disabled={cart.length === 0}
                onClick={handleDebtSale}
              >
                <CreditCard className="w-4 h-4 ml-1.5" />
                {t('pos.debt')}
              </Button>
              {/* Share Invoice as Image Action */}`);

// Remove Split Payment Dialog
c = c.replace(/\{\/\* Split Payment Dialog.*?<\/Dialog>/s, '');

// Remove isSplitEligible and handleSplitSale from code if they exist
c = c.replace(/const isSplitEligible = [^;]+;/s, '');
c = c.replace(/const handleSplitSale = \(\) => \{[\s\S]*?setShowSplitDialog\(true\);\n  \};/s, '');

// Remove showSplitDialog state
c = c.replace(/const \[showSplitDialog, setShowSplitDialog\] = useState\(false\);/, '');

// Fix success string for Debt sale to not mention Split explicitly if it was there
c = c.replace(/toast\.success\('تم حفظ البيع المركب/g, "toast.success('تم حفظ البيع المؤجل");
c = c.replace(/toast\.success\('تم حفظ البيع بالدين/g, "toast.success('تم حفظ البيع المؤجل");

fs.writeFileSync('src/components/pos/CartPanel.tsx', c);
