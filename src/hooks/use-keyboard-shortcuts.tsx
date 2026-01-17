import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  callback: () => void;
  description: string;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: ShortcutConfig[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInputField = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                        event.code.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : true;
        const shiftMatch = shortcut.shift ? event.shiftKey : true;
        const altMatch = shortcut.alt ? event.altKey : true;

        // For function keys (F1-F12), allow even in input fields
        const isFunctionKey = shortcut.key.startsWith('F') || shortcut.key.startsWith('f');

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          if (isInputField && !isFunctionKey && !shortcut.ctrl) {
            continue;
          }
          
          event.preventDefault();
          event.stopPropagation();
          shortcut.callback();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);

  return { shortcuts };
}

// Common POS shortcuts configuration
export const POS_SHORTCUTS = {
  CASH_SALE: 'F1',
  DEBT_SALE: 'F2',
  CLEAR_CART: 'F3',
  PRINT: 'F4',
  SCAN_BARCODE: 'F5',
  TOGGLE_MODE: 'F6',
} as const;

export function usePOSShortcuts({
  onCashSale,
  onDebtSale,
  onClearCart,
  onPrint,
  onScanBarcode,
  onToggleMode,
  enabled = true,
}: {
  onCashSale?: () => void;
  onDebtSale?: () => void;
  onClearCart?: () => void;
  onPrint?: () => void;
  onScanBarcode?: () => void;
  onToggleMode?: () => void;
  enabled?: boolean;
}) {
  const shortcuts: ShortcutConfig[] = [
    {
      key: POS_SHORTCUTS.CASH_SALE,
      callback: () => onCashSale?.(),
      description: 'بيع نقدي',
      enabled: !!onCashSale,
    },
    {
      key: POS_SHORTCUTS.DEBT_SALE,
      callback: () => onDebtSale?.(),
      description: 'بيع بالدين',
      enabled: !!onDebtSale,
    },
    {
      key: POS_SHORTCUTS.CLEAR_CART,
      callback: () => onClearCart?.(),
      description: 'مسح السلة',
      enabled: !!onClearCart,
    },
    {
      key: POS_SHORTCUTS.PRINT,
      callback: () => onPrint?.(),
      description: 'طباعة',
      enabled: !!onPrint,
    },
    {
      key: POS_SHORTCUTS.SCAN_BARCODE,
      callback: () => onScanBarcode?.(),
      description: 'مسح الباركود',
      enabled: !!onScanBarcode,
    },
    {
      key: POS_SHORTCUTS.TOGGLE_MODE,
      callback: () => onToggleMode?.(),
      description: 'تبديل الوضع',
      enabled: !!onToggleMode,
    },
  ];

  return useKeyboardShortcuts({ shortcuts, enabled });
}
