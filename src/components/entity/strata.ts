/**
 * **The population layer** — what an index page is *about* before it is a list of links.
 * `DESIGN_SYSTEM.md` §6.6.5.
 *
 * The first three index pages were a search field over an alphabetical wall, and Rishabh rejected
 * them for it: *"i dont want a basic search bar page, please design it in a meaningful way based on
 * the data"*. The diagnosis is not that the list was ugly. It is that **the alphabet is not a fact
 * about Formula 1**, so ordering by it makes a page that states nothing. The season hub works
 * because a season has a shape and the page draws it; an index has a shape too, and this module is
 * the arithmetic of that shape.
 *
 * Every figure below was verified against `data/f1.db` before the design was drawn (queries in the
 * §6.6.5 record), and **nothing here hard-codes one of them** — they are counted from the payload
 * at render time, exactly as `indexFacts` already counts the masthead's.
 *
 * | Shape | Measured |
 * |---|---|
 * | Drivers, by how far they got | 36 champions · 80 more race winners · 103 more podium finishers · 599 more starters · 63 never started |
 * | Drivers, on the grid per decade | 1950s **313** → 2020s **40**, an eight-fold collapse |
 * | Drivers, by career length | 172 started exactly one Grand Prix; 50 started 150 or more |
 * | Teams | 205 started · 47 ever won · 17 ever took a Constructors' title · 11 raced in 2026 |
 * | Circuits | 78 venues · 24 in current use · 1 joining · **53 gone** |
 *
 * Pure, and separate from the components for `indexModel.ts`'s reason: every interesting case here
 * is a *data* case that is invisible in a rendering test and wrong in a way that still looks like a
 * plausible page.
 */

import type { IndexItem } from './indexModel';

/* ------------------------------------------------------------------------------- strata */

/**
 * One bar of the ladder — a slice of the population that the reader can click.
 *
 * **Strata are disjoint, never nested, and that is a decision this file makes once so the page
 * cannot contradict itself.** *Race winners* is the natural nested reading (116 drivers have won a
 * Grand Prix, champions included), but a bar labelled 116 that filters the list to 80 rows is a
 * page arguing with itself. So every bar's count is **exactly the number of rows clicking it
 * produces**, and the nesting is stated in the sublabel — `won a Grand Prix, never a title` — where
 * it is unambiguous. The cumulative reading is in the board's caption.
 */
export interface StratumDefinition {
  /** Matches `IndexItem.tier`. */
  key: string;
  /** The bar's label. `Champions`. */
  label: string;
  /** One clause, `--text-2xs`, that makes a disjoint tier honest. `won a Grand Prix, never a title`. */
  sublabel: string;
  /**
   * Kept out of the default browse and revealed by the footnote toggle (§6.6.5.4).
   *
   * True for exactly one stratum per page — the entities with no race at all. 63 drivers, 9 teams,
   * 1 circuit. They stay reachable, because the index must enumerate what the profile endpoint
   * serves, but they are not what a reader browsing drivers came for.
   */
  aside?: boolean;
}

/** A stratum with its measured count and the two fractions the bar is drawn from. */
export interface Stratum extends StratumDefinition {
  count: number;
  /**
   * The bar's length, `count / max(count)`, **0 when every stratum is empty**.
   *
   * Never `count / total`: on the driver page the largest tier is 599 of 818, so a
   * fraction-of-total bar would top out at 73% and leave the widest bar looking arbitrarily
   * short of the track it sits in.
   */
  extent: number;
  /**
   * Ink weight, 1 at the top of the ladder and stepping down. **Assigned by position, never by
   * count** — the point of the ladder is that the rarest tier is the loudest, which is the
   * opposite of what a magnitude-driven opacity would produce.
   */
  emphasis: number;
}

/** The emphasis ramp, rarest first. Beyond five strata the last value repeats. */
const EMPHASIS = [1, 0.68, 0.46, 0.3, 0.22] as const;

/**
 * Count the population into its strata, in definition order.
 *
 * Items whose `tier` matches no definition are **dropped from the ladder and counted nowhere**,
 * which is deliberate: a silent `other` bucket is how a mis-assigned tier survives review. The
 * page's own total is on the masthead and will disagree visibly if that ever happens.
 */
export function buildStrata(
  items: readonly IndexItem[],
  definitions: readonly StratumDefinition[],
): Stratum[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.tier, (counts.get(item.tier) ?? 0) + 1);

  const withCounts = definitions.map((definition) => ({
    ...definition,
    count: counts.get(definition.key) ?? 0,
  }));

  const max = withCounts.reduce((largest, entry) => Math.max(largest, entry.count), 0);

  return withCounts.map((entry, position) => ({
    ...entry,
    extent: max === 0 ? 0 : entry.count / max,
    emphasis: EMPHASIS[Math.min(position, EMPHASIS.length - 1)] ?? 0.22,
  }));
}

/* --------------------------------------------------------------------------------- eras */

/** One column of the decade chart. */
export interface EraBucket {
  /** `1970`. The filter value and the React key. */
  decade: number;
  /** `70s` under the bar. */
  label: string;
  /** `1970s` — the accessible name and the group header. */
  longLabel: string;
  count: number;
  /** Bar height as a fraction of the tallest column. */
  extent: number;
  /**
   * The archive does not hold ten seasons of this decade. True for the 2020s today (seven of ten),
   * and it is why the last column is short for a reason that is not a decline.
   */
  partial: boolean;
}

/**
 * How many entities were around in each decade.
 *
 * **An entity is counted in every decade between its first and last season** — the only reading
 * available from a payload that carries a span and not a per-season list, and it is stated in the
 * board's caption rather than left for the reader to assume.
 *
 * For drivers it happens to be **exact**: the overlap count reproduces the measured
 * distinct-starters-per-decade figure for all eight decades (313 · 214 · 156 · 104 · 97 · 71 · 66 ·
 * 40), because no driver's career skips an entire decade. For teams it over-counts by at most five
 * in a decade — Lotus and Brabham both have revivals — which is why the caption states the rule
 * instead of claiming the measurement.
 *
 * @param latestSeason the most recent season in the archive, for the `partial` flag. Null skips it.
 */
export function eraBuckets(items: readonly IndexItem[], latestSeason: number | null): EraBucket[] {
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    if (item.firstSeason !== null) {
      earliest = Math.min(earliest, item.firstSeason);
      latest = Math.max(latest, item.lastSeason ?? item.firstSeason);
    }
  }
  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) return [];

  const first = decadeOf(earliest);
  const last = decadeOf(latest);

  const buckets: { decade: number; count: number }[] = [];
  for (let decade = first; decade <= last; decade += 10) buckets.push({ decade, count: 0 });

  for (const item of items) {
    if (item.firstSeason === null) continue;
    const from = item.firstSeason;
    const to = item.lastSeason ?? item.firstSeason;
    for (const bucket of buckets) {
      if (from <= bucket.decade + 9 && to >= bucket.decade) bucket.count += 1;
    }
  }

  const max = buckets.reduce((largest, bucket) => Math.max(largest, bucket.count), 0);

  return buckets.map((bucket) => ({
    decade: bucket.decade,
    label: `${String(bucket.decade).slice(2)}s`,
    longLabel: `${String(bucket.decade)}s`,
    count: bucket.count,
    extent: max === 0 ? 0 : bucket.count / max,
    partial: latestSeason !== null && latestSeason < bucket.decade + 9,
  }));
}

/** `Math.floor(year / 10) * 10`. 1959 is the 1950s; 1960 is the 1960s. */
export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

/**
 * Whether an item was around in a given decade — the same overlap test `eraBuckets` counts with,
 * so the bar's number and the filtered list can never disagree.
 */
export function inDecade(item: IndexItem, decade: number): boolean {
  if (item.firstSeason === null) return false;
  const to = item.lastSeason ?? item.firstSeason;
  return item.firstSeason <= decade + 9 && to >= decade;
}

/* -------------------------------------------------------------------------------- bands */

/** A longevity band — `50–149 starts`. Assigned from a count, in definition order. */
export interface BandDefinition {
  key: string;
  label: string;
  /** Inclusive floor. Bands are declared **descending**, and the first match wins. */
  min: number;
}

/**
 * Which band a count falls in. Returns the **last** definition when nothing matches, so an item
 * always has a band and the grouping can never produce an unlabelled bucket.
 *
 * Bands are declared descending (`150+`, `50+`, `11+`, `2+`, `1+`), which makes the first match the
 * right one and removes the `min`/`max` pair that is the usual way this goes wrong at a boundary.
 */
export function bandOf(count: number, bands: readonly BandDefinition[]): string {
  for (const band of bands) {
    if (count >= band.min) return band.key;
  }
  return bands[bands.length - 1]?.key ?? '';
}

/* ------------------------------------------------------------------------------ filters */

/** What the ladder and the decade chart have currently selected. Both may be off. */
export interface StrataSelection {
  /** A `StratumDefinition.key`, or null for the whole population. */
  tier: string | null;
  /** A decade's first year, or null. */
  decade: number | null;
  /** The footnote toggle — when false, `aside` strata are removed from the browse. */
  showAside: boolean;
}

export const NO_SELECTION: StrataSelection = { tier: null, decade: null, showAside: false };

/**
 * Apply the board's two filters and the aside rule, in that order.
 *
 * **The aside rule yields to an explicit selection.** Clicking `Never started a Grand Prix` on the
 * ladder must show those 63 drivers even though the toggle is off — a control that selects a
 * stratum and then returns nothing is broken, and the toggle's job is to keep them out of the
 * *default* browse, not to veto the reader.
 */
export function applySelection(
  items: readonly IndexItem[],
  selection: StrataSelection,
  definitions: readonly StratumDefinition[],
): readonly IndexItem[] {
  const asides = new Set(
    definitions
      .filter((definition) => definition.aside === true)
      .map((definition) => definition.key),
  );
  const tierSelected = selection.tier !== null;

  return items.filter((item) => {
    if (tierSelected && item.tier !== selection.tier) return false;
    if (!tierSelected && !selection.showAside && asides.has(item.tier)) return false;
    if (selection.decade !== null && !inDecade(item, selection.decade)) return false;
    return true;
  });
}

/** How many rows the aside rule is currently hiding — the number the footnote states. */
export function asideCount(
  items: readonly IndexItem[],
  definitions: readonly StratumDefinition[],
): number {
  const asides = new Set(
    definitions
      .filter((definition) => definition.aside === true)
      .map((definition) => definition.key),
  );
  return items.filter((item) => asides.has(item.tier)).length;
}
