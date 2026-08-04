/**
 * Centralised formatting (ARCHITECTURE.md §3). Lap times, gaps, dates and ordinals
 * must be identical everywhere, so no component formats a value of its own.
 *
 * Every function here is locale-independent by construction. `toLocaleDateString`
 * without an explicit locale produces different output on different machines, which
 * makes a test pass locally and fail in CI, so it is not used.
 *
 * F0 needs dates only. Lap-time and gap formatters land with the surfaces that show
 * them; `DESIGN_SYSTEM.md` §2.4 already fixes their shape.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `2026-07-19` → `19 Jul 2026`.
 *
 * An unparseable input is returned unchanged. Never `"Invalid Date"`: a raw ISO string
 * on screen is a visible defect someone will report, whereas "Invalid Date" reads like
 * a data problem and sends the reader looking in the wrong place.
 */
export function formatIsoDate(iso: string): string {
  const match = ISO_DATE.exec(iso);
  if (match === null) return iso;

  const [, year, month, day] = match;
  if (year === undefined || month === undefined || day === undefined) return iso;

  const monthName = MONTHS[Number(month) - 1];
  const dayNumber = Number(day);
  if (monthName === undefined || dayNumber < 1 || dayNumber > 31) return iso;

  return `${String(dayNumber)} ${monthName} ${year}`;
}
