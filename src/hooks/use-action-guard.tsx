/**
 * useActionGuard
 * =================
 * Prevents duplicate execution of a sensitive async action (double-click / rapid taps).
 *
 * Returns:
 *  - run(fn): executes fn only if no other run is in-flight; otherwise no-ops.
 *  - isRunning: true while the guarded action executes (bind to `disabled` on buttons).
 *
 * Use for: confirm sale, refund, delete, mark-paid, pay-debt, save-invoice, etc.
 */
import { useCallback, useRef, useState } from 'react';

export function useActionGuard() {
  const [isRunning, setIsRunning] = useState(false);
  const lockRef = useRef(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lockRef.current) {
      // Silently ignore subsequent clicks while an action is in-flight
      return undefined;
    }
    lockRef.current = true;
    setIsRunning(true);
    try {
      return await fn();
    } finally {
      lockRef.current = false;
      setIsRunning(false);
    }
  }, []);

  return { run, isRunning };
}
