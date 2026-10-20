import { useEffect, useState } from 'react';
import { getActiveStoreCurrency, getReportCurrency, REPORT_CURRENCY_KEY } from '@/lib/currencies';
import { EVENTS } from '@/lib/events';
import { Banknote } from 'lucide-react';

export function ReportCurrencyBanner() {
  const [, setRev] = useState(0);
  useEffect(() => {
    const h = () => setRev(r => r + 1);
    window.addEventListener(EVENTS.SETTINGS_UPDATED, h as EventListener);
    return () => window.removeEventListener(EVENTS.SETTINGS_UPDATED, h as EventListener);
  }, []);
  const store = getActiveStoreCurrency();
  const active = getReportCurrency();
  const choose = (code: 'USD' | 'STORE') => {
    localStorage.setItem(REPORT_CURRENCY_KEY, code);
    window.dispatchEvent(new CustomEvent(EVENTS.SETTINGS_UPDATED));
  };
  return (
    <div className="flex items-center justify-between flex-wrap gap-2 px-3.5 py-2 bg-primary/5 border border-primary/20 rounded-xl text-xs text-muted-foreground mb-4">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <Banknote className="w-4 h-4 text-primary shrink-0" />
        <span>عملة التقرير:</span>
        {!store.isUsd ? (
          <div className="flex gap-1">
            <button type="button" onClick={() => choose('STORE')}
              className={`px-2 py-0.5 rounded-lg border ${!active.isUsd ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'}`}>
              {store.name} ({store.symbol})
            </button>
            <button type="button" onClick={() => choose('USD')}
              className={`px-2 py-0.5 rounded-lg border ${active.isUsd ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'}`}>
              USD ($)
            </button>
          </div>
        ) : (
          <span className="font-bold text-primary">{active.name} ({active.symbol})</span>
        )}
      </div>
      {!active.isUsd && (
        <div className="text-[11px] font-mono bg-background/80 px-2.5 py-0.5 rounded-lg border border-border/50 text-foreground">
          1 $ = {active.rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} {active.symbol}
        </div>
      )}
    </div>
  );
}
