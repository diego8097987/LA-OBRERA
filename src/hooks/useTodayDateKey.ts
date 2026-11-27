import { useEffect, useState } from 'react';
import { getLocalDateKey } from '../utils/posCalculations';

/**
 * Returns the current local YYYY-MM-DD date key and automatically refreshes
 * when the clock crosses midnight (important for long-running desktop POS windows).
 */
export function useTodayDateKey(): string {
  const [dateKey, setDateKey] = useState<string>(() => getLocalDateKey());

  useEffect(() => {
    const syncDate = () => {
      const next = getLocalDateKey();
      setDateKey((prev) => (prev === next ? prev : next));
    };

    const interval = window.setInterval(syncDate, 30_000);
    window.addEventListener('focus', syncDate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncDate);
    };
  }, []);

  return dateKey;
}
