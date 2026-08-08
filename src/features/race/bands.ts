import type { ScatterBand } from '@/components/charts';

/**
 * Pure presentation arithmetic for RD-4's inferred-neutralisation bands.
 *
 * Its own module rather than living beside the component, for the reason the `react-refresh` rule
 * gives: a file that exports both a component and a function is a file Fast Refresh cannot reload
 * safely. It is also the only part of that surface a test can decide, so separating it is what makes
 * it testable rather than merely tidy.
 */

/**
 * Collapse a sorted list of laps into contiguous bands.
 *
 * Pure and exported because it is the one part of this surface a test can decide, and because the
 * alternative — one hatched rect per flagged lap — draws a five-lap safety car as five separate
 * regions with hairline gaps between them, which reads as five incidents instead of one.
 */
export function mergeAdjacent(laps: readonly number[]): ScatterBand[] {
  const sorted = [...new Set(laps)].sort((a, b) => a - b);
  const bands: ScatterBand[] = [];

  for (const lap of sorted) {
    const last = bands[bands.length - 1];
    /*
     * A band covers `from` to `to + 1`, so a single flagged lap is a lap-wide region rather than a
     * zero-width line: the band marks the *interval* the lap occupies on the axis, not its start.
     */
    if (last !== undefined && lap === last.to) {
      last.to = lap + 1;
      continue;
    }
    bands.push({ key: `band-${String(lap)}`, from: lap, to: lap + 1 });
  }

  return bands;
}
