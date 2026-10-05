const fs = require('fs');
let c = fs.readFileSync('src/components/pos/CartPanel.tsx', 'utf8');
const start = c.indexOf('{/* Row 5: Pay Buttons + Action Icons */}');
const end = c.indexOf('{/* Add Customer Dialog */}');
if (start > -1 && end > -1) {
  const newContent = `{/* Row 5: Pay Buttons + Action Icons */}
          <div className="flex items-center gap-1.5">
            <Button
              data-tour="cash-btn"
              className="flex-1 h-11 bg-success hover:bg-success/90 text-sm font-bold shadow-md shadow-success/25 transition-all active:scale-95 rounded-xl"
              disabled={cart.length === 0}
              onClick={handleCashSale}
            >
              <Banknote className="w-4 h-4 ml-1.5" />
              {t('pos.cash')}
            </Button>

            <Button
              data-tour="debt-btn"
              variant="outline"
              className="flex-1 h-11 border-2 border-warning/70 text-warning hover:bg-warning/10 text-sm font-bold transition-all active:scale-95 rounded-xl"
              disabled={cart.length === 0}
              onClick={handleDebtSale}
            >
              <CreditCard className="w-4 h-4 ml-1.5" />
              {t('pos.debt')}
            </Button>
            {/* Share Invoice as Image Action */}
            <Button
              data-tour="action-btns"
              variant="ghost"
              size="icon"
              className="h-11 w-9 flex-shrink-0 text-primary hover:text-primary hover:bg-primary/10 rounded-xl"
              disabled={cart.length === 0 && !lastSale}
              onClick={() => handleWhatsApp()}
              title="مشاركة الفاتورة كصورة"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-9 flex-shrink-0 text-primary hover:text-primary hover:bg-primary/10 rounded-xl"
              onClick={() => setShowHoldDialog(true)}
              disabled={cart.length === 0}
              title={t('pos.holdOrder')}
            >
              <Clock className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
\n      `;
  fs.writeFileSync('src/components/pos/CartPanel.tsx', c.substring(0, start) + newContent + c.substring(end));
} else {
  console.log('Markers not found');
}
