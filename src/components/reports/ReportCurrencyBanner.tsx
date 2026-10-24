import { useEffect, useState } from 'react';
import { useMoney } from '@/hooks/use-money';
import { refreshMoneyState } from '@/lib/money-engine';
import { getReportCurrency, REPORT_CURRENCY_KEY } from '@/lib/currencies';
import { EVENTS } from '@/lib/events';
import { Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ReportCurrencyBanner() {
  const m = useMoney();
  const [, setRev] = useState(0);

  useEffect(() => {
    const h = () => setRev(r => r + 1);
    window.addEventListener(EVENTS.SETTINGS_UPDATED, h as EventListener);
    return () => window.removeEventListener(EVENTS.SETTINGS_UPDATED, h as EventListener);
  }, []);

  const active = getReportCurrency();

  const choose = (code: string) => {
    try {
      localStorage.setItem(REPORT_CURRENCY_KEY, code);
    } catch {
      // storage unavailable
    }
    refreshMoneyState();
    window.dispatchEvent(new CustomEvent(EVENTS.SETTINGS_UPDATED));
  };

  const enabledList = m.enabledCurrencies;

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 px-3.5 py-2 bg-primary/5 border border-primary/20 rounded-xl text-xs text-muted-foreground mb-4">
      <div className="flex items-center gap-2 font-medium text-foreground flex-wrap">
        <div className="flex items-center gap-1.5 shrink-0">
          <Banknote className="w-4 h-4 text-primary shrink-0" />
          <span>عملة التقرير:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {enabledList.map(curr => {
            const isSelected = active.code === curr.code;
            return (
              <button
                key={curr.code}
                type="button"
                onClick={() => choose(curr.code)}
                className={cn(
                  "px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-background border-border hover:bg-muted text-muted-foreground"
                )}
              >
                <span>{curr.name}</span>
                <span className="opacity-80 text-[10px]">({curr.symbol})</span>
              </button>
            );
          })}
        </div>
      </div>
      {!active.isUsd && (
        <div className="text-[11px] font-mono bg-background/80 px-2.5 py-1 rounded-lg border border-border/50 text-foreground shrink-0">
          1 $ = {active.rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} {active.symbol}
        </div>
      )}
    </div>
  );
}
