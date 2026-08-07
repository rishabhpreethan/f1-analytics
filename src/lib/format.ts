/**
 * Centralised formatting (ARCHITECTURE.md §3). Lap times, gaps, dates and ordinals
 * must be identical everywhere, so no component formats a value of its own.
 *
 * Every function here is locale-independent by construction. `toLocaleDateString`
 * without an explicit locale produces different output on different machines, which
 * makes a test pass locally and fail in CI, so it is not used.
 *
 * F0 needed dates only. The duration and gap formatters landed with F3, which is the
 * first surface that shows a lap time; `DESIGN_SYSTEM.md` §2.4 fixes their shape and this
 * file is the only place that shape exists.
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

/* ============================================================== timing, DESIGN_SYSTEM §2.4 */

const MS_PER_SECOND = 1000;

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * A millisecond duration in F1 timing form. `§2.4`: lap times are `M:SS.mmm` and
 * sub-minute times `SS.mmm`.
 *
 * **One escalating function rather than three, and that is the decision.** §2.4 names two
 * forms and the data needs a third — a full race distance is 1,596,857 ms up to
 * 5,766,857 ms — so `H:MM:SS.mmm` is added at the hour. Three separate exported
 * formatters would put the choice of form at every call site, which is how a lap time and
 * a race time end up written differently on one page.
 *
 * ```
 *      45_678 → "45.678"        a sub-minute lap
 *      82_091 → "1:22.091"      2026 R1's fastest lap
 *   1_168_144 → "19:28.144"     the red-flag lap on the same race
 *   5_766_857 → "1:36:06.857"   1988 R1's winning time
 * ```
 *
 * Seconds are zero-padded to two digits whenever a larger unit precedes them, so columns
 * align under `--font-mono` (§2.4: tabular everywhere). Sub-minute values are padded to
 * two as well: no Grand Prix lap is under 10 seconds, so `05.200` never arises, and the
 * padding keeps a pit-stop duration column aligned where it can.
 *
 * A negative or non-finite input returns `'—'` rather than a signed or `NaN:` string.
 * That is deliberate: every duration in this product is an elapsed time, so a negative
 * one is a defect upstream, and an em dash on screen is a visible question rather than a
 * plausible-looking wrong number. Signed values are `formatGap`'s job.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';

  const rounded = Math.round(ms);
  const millis = rounded % MS_PER_SECOND;
  const totalSeconds = Math.floor(rounded / MS_PER_SECOND);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${String(hours)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
  }
  if (totalMinutes > 0) {
    return `${String(minutes)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
  }
  return `${pad(seconds, 2)}.${pad(millis, 3)}`;
}

/**
 * A gap, with the sign glyph §2.4 requires. `+S.mmm`, escalating to `+M:SS.mmm` past a
 * minute and `+H:MM:SS.mmm` past an hour.
 *
 * Three things §2.4 fixes and this implements literally:
 *
 * - **A leading sign glyph, never colour alone and never a bare hyphen.** Negative gaps
 *   use `−` (U+2212, `−`) rather than `-`, because the ASCII hyphen is narrower than
 *   a digit in every one of the three families and breaks the tabular alignment §2.4
 *   exists to guarantee.
 * - **Seconds are not zero-padded here**, unlike `formatDuration`. A gap of 1.234 s reads
 *   `+1.234`, which is the form §2.4 gives and the form the sport uses; `+01.234` would
 *   imply a precision of position the number does not have.
 * - **Zero is `+0.000`, not an em dash.** A driver 0 ms behind is the leader's own row in
 *   some tables and a dead heat in others; either way it is a measurement.
 *
 * The escalation past a minute is an extension of §2.4 rather than a reading of it, and
 * it is needed: 1988 R1's fifth-placed car finished 74,556 ms behind, which `+74.556`
 * would render as a number nobody in the sport writes.
 */
export function formatGap(ms: number): string {
  if (!Number.isFinite(ms)) return '—';

  const sign = ms < 0 ? '−' : '+';
  const rounded = Math.round(Math.abs(ms));
  const millis = rounded % MS_PER_SECOND;
  const totalSeconds = Math.floor(rounded / MS_PER_SECOND);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${sign}${String(hours)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
  }
  if (totalMinutes > 0) {
    return `${sign}${String(minutes)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
  }
  return `${sign}${String(seconds)}.${pad(millis, 3)}`;
}
