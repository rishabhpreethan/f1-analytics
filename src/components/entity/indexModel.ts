/**
 * **The entity index's whole brain, and none of its rendering.** `DESIGN_SYSTEM.md` §6.6.4.
 *
 * Separated from the components for the reason `geometry.ts` and `ribbon.ts` are separated: every
 * interesting case here is a *data* case, invisible in a rendering test and wrong in a way that
 * still looks like a plausible list. A diacritic that stops `hakkinen` finding Häkkinen; a sort
 * that puts `null` first because `null < 1` in JavaScript; a decade bucket that rounds 1959 into
 * the 1960s; a search that reshuffles the list on the fifth keystroke.
 *
 * 881 drivers, 214 teams, 78 circuits — measured. Everything below is written for the 881 case and
 * is therefore allocation-conscious: the search haystack is built **once**, at map time, never per
 * keystroke.
 */

/** One row of any of the three indexes, already flattened for display. */
export interface IndexItem {
  /** `driver.reference` / `team.reference` / `circuit.reference`. The React key and the URL tail. */
  ref: string;
  href: string;
  /** What the row's headline reads. */
  title: string;
  /**
   * What `A–Z` orders by, **normalised** (lower-cased, diacritics folded). Surname-first for a
   * driver, the name itself for a team or a circuit. Held separately from `title` because
   * "Häkkinen, Mika" must sort with the H's and display with its umlaut.
   */
  sortKey: string;
  /** Everything the search matches, normalised and pre-joined. Built once (see the header). */
  haystack: string;
  /** The sport's own three-letter code, where the entity has one. 107 of 881 drivers. */
  code: string | null;
  /** The line under the name — a nationality, or `Monza, Italy`. */
  subtitle: string | null;
  /** `team.reference`, for the 3px identity bar. `null` for a circuit, which has no identity. */
  identityRef: string | null;
  /** Which monogram rule `EntityPortrait` applies. `null` renders no mark at all (circuits). */
  markKind: 'driver' | 'team' | null;
  firstSeason: number | null;
  lastSeason: number | null;
  /**
   * Still going in the archive's most recent season — what promotes the rail's bracket to
   * `--accent-mark` (§7.12).
   *
   * **It is not "champion", and that is the payload's ruling rather than a preference.** The
   * directory endpoints are deliberately not a dashboard: they carry no wins, no podiums and no
   * championships, because putting them there would mean aggregating 881 careers to answer *which
   * page do I want* (`server/schemas/directory.ts`). Activity is available, is what a browsing
   * reader actually wants — *who is racing now* — and is **redundantly encoded** anyway, since an
   * active entity's bracket is the one that reaches the right end of the domain. So the accent
   * reinforces a position rather than carrying a fact alone (§3.4.2).
   */
  isCurrent: boolean;
  /**
   * `false` when the entity exists in the record and never contested a race. Drives every one of
   * §6.6.4.3's four channels — the chip, the em-dashes, the empty rail and the panel notice.
   */
  raced: boolean;
  /** The chip beside the name. `Never raced`, `Not yet raced`, or nothing. */
  chip: string | null;
  /** Aligned with the page's `FigureColumn[]`. `null` renders `—`, never `0`. */
  figures: readonly (number | null)[];
  /** The link's accessible name. One sentence, not eight fragments — see `EntityIndex`. */
  ariaLabel: string;
}

/** How a column of figures is labelled and when it survives a narrowing viewport. */
export interface FigureColumn {
  key: string;
  /** The column header, and the word used in the row's accessible name. */
  label: string;
  /**
   * Drop order. `1` survives every width ≥768; `4` appears only at ≥1280. The page's most
   * important figure is always `1` (§6.6.4.1).
   */
  priority: 1 | 2 | 3 | 4;
}

export type GroupMode = 'letter' | 'decade' | 'none';

export interface SortOption {
  id: string;
  /** The segment's visible text. */
  label: string;
  /** `null` sorts alphabetically; otherwise the index into `IndexItem.figures`. */
  figure: number | null;
  /** `'debut'` sorts by `firstSeason` ascending. */
  by: 'name' | 'debut' | 'figure';
  group: GroupMode;
}

export interface IndexGroup {
  key: string;
  /** `A`, `1970s`, or `''` for the single unlabelled group a metric sort produces. */
  label: string;
  count: number;
  items: readonly IndexItem[];
}

/* ------------------------------------------------------------------------- normalisation */

/**
 * Lower-case and strip diacritics, so `hakkinen` finds *Häkkinen* and `perez` finds *Pérez*.
 *
 * `NFD` decomposes `ä` into `a` + U+0308, and `\p{Diacritic}` then removes the mark. The `u` flag
 * is mandatory for a Unicode property escape and its absence is a `SyntaxError`, not a silent
 * mismatch — which is the one way this could have failed quietly.
 *
 * **Not `localeCompare`-based folding.** That would make the result depend on the browser's locale,
 * and a search that finds a driver in Chrome and not in Safari is worse than one that never does.
 */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/* ------------------------------------------------------------------------------ filtering */

/**
 * All tokens must match, as substrings, in any order.
 *
 * `lewis ham` finds Lewis Hamilton; `ham lewis` finds him too. Substring rather than prefix because
 * an F1 reader types `schum` as often as `mich`, and because a prefix match on the *haystack* would
 * only ever match the first field in it.
 *
 * **The result is never re-ranked by match quality** (§6.6.4.2). A list that reshuffles as you type
 * is harder to use than one that only shrinks: the row you were reaching for moves out from under
 * the pointer. Order in equals order out.
 */
export function filterItems(items: readonly IndexItem[], query: string): readonly IndexItem[] {
  const tokens = normalise(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return items;
  return items.filter((item) => tokens.every((token) => item.haystack.includes(token)));
}

/* -------------------------------------------------------------------------------- sorting */

/**
 * A stable comparator for a value that can be absent.
 *
 * **`null` always sorts last, whichever direction is in force**, and that is the rule this function
 * exists to hold. JavaScript's `null < 1` is `true`, so a naive descending sort by wins puts the 63
 * drivers who never raced at the *top* of a wins ranking — a list whose first page is people with
 * no wins, presented as the winners. Absence is not a low score (§1.0).
 */
function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

/**
 * Order the list. **Never mutates the input** — the source array is the query cache's, and sorting
 * it in place would reorder every other reader of the same object.
 *
 * Every comparator falls back to `sortKey`, so the order is total and a re-sort of an already
 * sorted list cannot shuffle equal rows. 116 of 881 drivers have at least one win, so a wins sort
 * has 765 ties in it; without the fallback their order would depend on the engine's sort stability
 * across two different arrays.
 */
export function sortItems(items: readonly IndexItem[], option: SortOption): readonly IndexItem[] {
  const sorted = [...items];

  if (option.by === 'name') {
    sorted.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
    return sorted;
  }

  if (option.by === 'debut') {
    sorted.sort((a, b) => {
      const bySeason = compareNullable(a.firstSeason, b.firstSeason, 1);
      if (bySeason !== 0) return bySeason;
      return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
    });
    return sorted;
  }

  const index = option.figure ?? 0;
  sorted.sort((a, b) => {
    const byFigure = compareNullable(a.figures[index] ?? null, b.figures[index] ?? null, -1);
    if (byFigure !== 0) return byFigure;
    return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
  });
  return sorted;
}

/* ------------------------------------------------------------------------------- grouping */

/**
 * The decade an entity belongs to, from its **first** season.
 *
 * `Math.floor(year / 10) * 10` and not `year - (year % 10)`, which is the same arithmetic but reads
 * as if it might do something different for a negative year. 1959 is the 1950s; 1960 is the 1960s.
 */
function decadeOf(year: number): string {
  return `${String(Math.floor(year / 10) * 10)}s`;
}

/**
 * The initial letter, for the `A–Z` grouping.
 *
 * Anything that is not `a`–`z` after normalisation lands in `#`, which is a real bucket rather than
 * a fallback: `sortKey` is already diacritic-folded, so this catches a name that begins with a
 * digit or a punctuation mark, not a name with an accent.
 */
function letterOf(sortKey: string): string {
  const first = sortKey.charAt(0);
  return first >= 'a' && first <= 'z' ? first.toUpperCase() : '#';
}

/**
 * Bucket the sorted list. **The sort decides the grouping** (§6.6.4.2) — that is the device that
 * makes 881 rows browsable rather than merely searchable.
 *
 * A metric sort returns exactly one unlabelled group. It is not "no groups": the caller renders a
 * list either way, and returning zero groups would make an empty list and a metric sort the same
 * shape.
 *
 * `Map` preserves insertion order, so groups come out in the order the sorted list produced them —
 * `A, B, C…` under a name sort and `1950s, 1960s…` under a debut sort — with no second sort of the
 * keys, which is where an alphabetical `1950s, 1960s, … 2020s` would have gone wrong at `2000s`.
 */
export function groupItems(items: readonly IndexItem[], mode: GroupMode): readonly IndexGroup[] {
  if (mode === 'none') {
    return items.length === 0 ? [] : [{ key: 'all', label: '', count: items.length, items }];
  }

  const buckets = new Map<string, IndexItem[]>();
  for (const item of items) {
    const key =
      mode === 'letter'
        ? letterOf(item.sortKey)
        : item.firstSeason === null
          ? NO_SEASON_GROUP
          : decadeOf(item.firstSeason);
    const bucket = buckets.get(key);
    if (bucket === undefined) buckets.set(key, [item]);
    else bucket.push(item);
  }

  return [...buckets].map(([key, bucket]) => ({
    key,
    label: key,
    count: bucket.length,
    items: bucket,
  }));
}

/**
 * Where a decade grouping puts an entity with no season at all — the 47 drivers the record names
 * and holds no session entry for. **Its own bucket, at the end**, because `compareNullable` already
 * sorted them last; it is never folded into the 1950s, which would state a debut the data does not
 * carry.
 */
export const NO_SEASON_GROUP = 'No season recorded';

/* ---------------------------------------------------------------------------- the rail */

/** Where a bracket sits inside its column, as fractions of the column's width. */
export interface RailGeometry {
  /** 0–1 from the left edge. */
  offset: number;
  /** 0–1. Zero for a single-season entity; the component applies the minimum visible width. */
  length: number;
}

/**
 * `SpanRail`'s arithmetic (§7.12), pure so the cases that matter can be asserted — jsdom performs
 * no layout, so this is the *only* place the rail is testable at all.
 *
 * Returns `null` when there is nothing to plot, which the component renders as a bare baseline. It
 * does **not** return `{0, 0}`: a zero-length bracket at the left edge would be indistinguishable
 * from a 1950 debut, which is §1.0's collapse.
 *
 * Three guards, each for a real case:
 *
 * - **A degenerate domain** (`domainEnd <= domainStart`) would divide by zero and produce `NaN`
 *   percentages, which render as *no bracket at all* rather than as an error. Reachable while a
 *   payload is empty.
 * - **Out-of-domain years are clamped**, not dropped. The domain comes from the payload, so this is
 *   belt-and-braces; without it a 2027 season would place a bracket outside its own column.
 * - **An inverted span** (`last < first`) is treated as a single season at `first`. It cannot occur
 *   in the data and would otherwise produce a negative width, which CSS silently ignores.
 */
export function spanRailGeometry(
  first: number | null,
  last: number | null,
  domainStart: number,
  domainEnd: number,
): RailGeometry | null {
  if (first === null) return null;
  const span = domainEnd - domainStart;
  if (span <= 0) return null;

  const clamp = (year: number) => Math.min(Math.max(year, domainStart), domainEnd);
  const start = clamp(first);
  const end = Math.max(clamp(last ?? first), start);

  return { offset: (start - domainStart) / span, length: (end - start) / span };
}

/**
 * The rail's domain, from the data rather than from a literal (§7.12).
 *
 * A hardcoded `1950, 2026` would be correct today and silently wrong the first time the archive
 * gains a season — every rail would render at the same fraction of a column that no longer means
 * what it did. Falls back to the sport's own first season when nothing in the list has a year, so
 * the baseline is still drawn against something rather than collapsing.
 */
export function railDomain(items: readonly IndexItem[]): { start: number; end: number } {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    if (item.firstSeason !== null) start = Math.min(start, item.firstSeason);
    if (item.lastSeason !== null) end = Math.max(end, item.lastSeason);
    if (item.firstSeason !== null) end = Math.max(end, item.firstSeason);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { start: 1950, end: 2026 };
  }
  return { start, end };
}

/* ------------------------------------------------------------------------------- helpers */

/**
 * A driver's sort key: surname first, then forename, normalised.
 *
 * The comma is deliberate and load-bearing. Without a separator, `de la Rosa Pedro` and
 * `de la Rosap Edro` sort identically, and more usefully a separator that sorts **before** every
 * letter keeps `Hill, Damon` ahead of `Hilliard`. `,` is U+002C, below `a` in code-unit order.
 */
export function driverSortKey(forename: string, surname: string): string {
  return normalise(`${surname},${forename}`);
}

/**
 * Join the pieces a row's search should match, normalised once.
 *
 * Empty and `null` pieces are dropped rather than joined as blanks, so the haystack never contains
 * a double space that a two-token query could match against by accident.
 */
export function buildHaystack(pieces: readonly (string | null | undefined)[]): string {
  return normalise(
    pieces.filter((piece): piece is string => piece != null && piece !== '').join(' '),
  );
}
