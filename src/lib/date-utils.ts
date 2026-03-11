// Utilities for consistent local date handling and range checks

/**
 * Convert a Date object or ISO string to a local `YYYY-MM-DD` string.
 * Uses the local timezone so that the day reflects the user's environment.
 */
export function toLocalDateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check whether a `YYYY-MM-DD` date string lies between two other
 * `YYYY-MM-DD` dates (inclusive). Returns false if any of the inputs
 * are not valid dates.
 */
export function isDateInRange(
  dateStr: string,
  from: string,
  to: string
): boolean {
  if (!dateStr || !from || !to) return false;
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    if ([y, m, d].some(isNaN)) return NaN;
    return new Date(y, m - 1, d).getTime();
  };
  const d = parse(dateStr);
  const f = parse(from);
  const t = parse(to);
  if (isNaN(d) || isNaN(f) || isNaN(t)) return false;
  return d >= f && d <= t;
}
