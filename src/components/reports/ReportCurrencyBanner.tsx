import { getActiveStoreCurrency } from '@/lib/currencies';
import { Banknote } from 'lucide-react';

export function ReportCurrencyBanner() {
  const active = getActiveStoreCurrency();
  return (
    <div className="flex items-center justify-between flex-wrap gap-2 px-3.5 py-2 bg-primary/5 border border-primary/20 rounded-xl text-xs text-muted-foreground mb-4">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <Banknote className="w-4 h-4 text-primary shrink-0" />
        <span>العملة المعتمدة للتقرير:</span>
        <span className="font-bold text-primary">{active.name} ({active.symbol})</span>
      </div>
      {!active.isUsd && (
        <div className="text-[11px] font-mono bg-background/80 px-2.5 py-0.5 rounded-lg border border-border/50 text-foreground">
          سعر الصرف: 1 $ = {active.rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} {active.symbol}
        </div>
      )}
    </div>
  );
}
