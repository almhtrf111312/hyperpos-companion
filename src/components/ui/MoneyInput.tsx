import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useMoney } from '@/hooks/use-money';
import { CurrencySnapshot, roundForCurrency } from '@/lib/money-engine';
import { cn } from '@/lib/utils';

export interface MoneyChangePayload {
  usd: number;
  originalAmount: number;
  currencyCode: string;
  exchangeRate: number;
  snapshot: CurrencySnapshot;
}

interface MoneyInputProps {
  valueUsd: number;
  onChange: (payload: MoneyChangePayload) => void;
  fieldKey?: string;
  defaultCurrencyCode?: string;
  allowedCurrencies?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  showEquivalent?: boolean;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  valueUsd,
  onChange,
  fieldKey,
  defaultCurrencyCode,
  allowedCurrencies,
  placeholder = '0',
  disabled = false,
  className,
  inputClassName,
  showEquivalent = true,
}) => {
  const m = useMoney();

  const availableCurrencies = allowedCurrencies?.length
    ? m.enabledCurrencies.filter((c) => allowedCurrencies.includes(c.code))
    : m.enabledCurrencies;

  const [selectedCode, setSelectedCode] = useState<string>(() =>
    fieldKey ? m.getSavedInputCurrency(fieldKey, defaultCurrencyCode) : defaultCurrencyCode || m.activeCode
  );

  const selectedDef = m.getCurrencyDef(selectedCode);

  const [rawText, setRawText] = useState<string>(() => {
    if (!valueUsd || valueUsd === 0) return '';
    const inSelected = m.fromUsd(valueUsd, selectedCode, selectedDef.rate);
    return String(roundForCurrency(inSelected, selectedCode));
  });

  useEffect(() => {
    const currentNumeric = parseFloat(rawText) || 0;
    const currentUsd = m.toUsd(currentNumeric, selectedCode, selectedDef.rate);
    if (Math.abs(currentUsd - (valueUsd || 0)) > 0.0001) {
      if (!valueUsd || valueUsd === 0) {
        setRawText('');
      } else {
        const converted = m.fromUsd(valueUsd, selectedCode, selectedDef.rate);
        setRawText(String(roundForCurrency(converted, selectedCode)));
      }
    }
  }, [valueUsd, selectedCode, selectedDef.rate]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalizedText = e.target.value
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(',', '.');
    setRawText(normalizedText);

    const num = parseFloat(normalizedText);
    const validNum = Number.isFinite(num) && num >= 0 ? num : 0;
    const usd = m.toUsd(validNum, selectedCode, selectedDef.rate);
    const snapshot = m.makeSnapshot(selectedCode, selectedDef.rate);

    onChange({
      usd,
      originalAmount: validNum,
      currencyCode: selectedDef.code,
      exchangeRate: snapshot.exchange_rate,
      snapshot,
    });
  };

  const handleCurrencySwitch = (newCode: string) => {
    setSelectedCode(newCode);
    if (fieldKey) {
      m.saveInputCurrencyPref(fieldKey, newCode);
    }
    const newDef = m.getCurrencyDef(newCode);
    const num = parseFloat(rawText);
    const validNum = Number.isFinite(num) && num >= 0 ? num : 0;
    const usd = m.toUsd(validNum, newCode, newDef.rate);
    const snapshot = m.makeSnapshot(newCode, newDef.rate);

    onChange({
      usd,
      originalAmount: validNum,
      currencyCode: newDef.code,
      exchangeRate: snapshot.exchange_rate,
      snapshot,
    });
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="relative flex items-center gap-1.5">
        <Input
          type="text"
          inputMode="decimal"
          value={rawText}
          onChange={handleTextChange}
          placeholder={placeholder}
          disabled={disabled}
          dir="ltr"
          className={cn('text-left font-mono', inputClassName)}
        />
        {availableCurrencies.length > 1 ? (
          <select
            disabled={disabled}
            value={selectedDef.code}
            onChange={(e) => handleCurrencySwitch(e.target.value)}
            className="h-10 shrink-0 rounded-md border border-input bg-muted/60 px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {availableCurrencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} ({c.code})
              </option>
            ))}
          </select>
        ) : (
          <span className="flex h-10 shrink-0 items-center rounded-md border border-input bg-muted/40 px-3 text-xs font-semibold text-muted-foreground">
            {selectedDef.symbol}
          </span>
        )}
      </div>
      {showEquivalent && valueUsd > 0 && selectedDef.code !== 'USD' && (
        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span>المعادل بالدولار: {m.fmtIn(valueUsd, 'USD')}</span>
          {selectedDef.code !== m.activeCode && <span>بعملة المتجر: {m.fmt(valueUsd)}</span>}
        </div>
      )}
    </div>
  );
};

export const MoneyDisplay: React.FC<{
  usd: number;
  currencyCode?: string;
  snapshot?: {
    currency_code?: string | null;
    currency_symbol?: string | null;
    exchange_rate?: number | null;
    total_in_currency?: number | null;
  } | null;
  className?: string;
}> = ({ usd, currencyCode, snapshot, className }) => {
  const m = useMoney();
  const text = snapshot
    ? m.fmtDoc(usd, snapshot)
    : currencyCode
    ? m.fmtIn(usd, currencyCode)
    : m.fmt(usd);
  return <span className={cn('font-mono tabular-nums', className)}>{text}</span>;
};
