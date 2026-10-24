import { useSyncExternalStore, useMemo } from 'react';
import {
  getMoneyState,
  subscribeMoneyState,
  getCurrencyDef,
  getEnabledCurrencies,
  toUsd,
  fromUsd,
  round8,
  roundForCurrency,
  formatAmount,
  formatActive,
  formatIn,
  formatSnapshot,
  createCurrencySnapshot,
  getSavedInputCurrency,
  saveInputCurrencyPref,
} from '@/lib/money-engine';

export function useMoney() {
  const state = useSyncExternalStore(subscribeMoneyState, getMoneyState, getMoneyState);

  return useMemo(() => {
    const active = getCurrencyDef(state.activeCode);
    const report = getCurrencyDef(state.reportCode);
    const enabledCurrencies = getEnabledCurrencies();

    return {
      active,
      activeCode: active.code,
      activeSymbol: active.symbol,
      activeRate: active.rate,
      report,
      reportCode: report.code,
      enabledCurrencies,
      currenciesMap: state.currencies,
      getCurrencyDef,
      toUsd,
      fromUsd,
      round8,
      roundForCurrency,
      formatAmount,
      fmt: formatActive,
      fmtIn: formatIn,
      fmtDoc: formatSnapshot,
      makeSnapshot: createCurrencySnapshot,
      getSavedInputCurrency,
      saveInputCurrencyPref,
    };
  }, [state]);
}
