import type { CircuitListItem, DriverListItem, TeamListItem } from '@schemas/directory';
import {
  buildHaystack,
  driverSortKey,
  normalise,
  type FigureColumn,
  type IndexItem,
  type SortOption,
} from './indexModel';
import { asideCount, bandOf, type BandDefinition, type StratumDefinition } from './strata';

/**
 * **Payload → a page that is about something.** `DESIGN_SYSTEM.md` §6.6.5.
 *
 * The one place the three directory payloads meet the one surface that renders them, and the only
 * file that has to change if a field moves. Pure, so every decision below is asserted directly
 * rather than through a rendered list of 881 rows.
 *
 * ---
 *
 * ## Why this file was rewritten
 *
 * The first build of these pages was a search field over an alphabetical list, and it was rejected
 * (2026-08-23): *"i dont want a basic search bar page, please design it in a meaningful way based
 * on the data … that list has alot of drivers/teams that havent raced … i really like the way you
 * have designed the seasons page, like its different, it has meaningful data, its intuitive"*.
 *
 * **Half of that was this file's fault and half was the payload's**, and both halves are now fixed.
 * The directory endpoints carried `races`, `firstSeason` and `lastSeason` and nothing else, so
 * there was nothing to stratify by and `A–Z / Debut / Races` were three ways to reorder one
 * undifferentiated wall. `server/schemas/directory.ts` reversed its own "a directory, not a
 * dashboard" ruling in the same session — *"a directory with no achievement in it cannot be
 * designed, only listed"* — and now publishes `starts`, `wins`, `podiums`, `championships`,
 * `bestChampionshipPosition`, circuit coordinates and `lastScheduledYear`.
 *
 * So the design question changes completely. **F1 is a pyramid**, and this file is where the
 * pyramid is counted.
 *
 * ## The shape, measured from `data/f1.db` before the design was drawn
 *
 * | | |
 * |---|---|
 * | Drivers | 881 in the record · **818 started** · 219 reached a podium · **116 won** · **35 champions** |
 * | Drivers, by decade | 1950s **313** → 2020s **40**, an eight-fold collapse |
 * | Drivers, career length | **172 started exactly one Grand Prix**; 50 started 150 or more |
 * | Teams | 214 identities · 205 started · **47 won** · **17 took a Constructors' title** |
 * | Circuits | 78 venues · **22 on the 2026 calendar** · 3 last used in 2025 · **53 gone** |
 *
 * **Nothing above is hard-coded below.** Every figure the page prints is counted from the payload
 * it was handed, exactly as the masthead's already was — the table is here so the next reader can
 * tell at a glance whether a rendered number is plausible.
 *
 * ## Two field distinctions the schema makes and this file must not flatten
 *
 * 1. **`races` is not `starts`.** They differ for **241 drivers** (Alonso 438/435), and **28
 *    drivers entered a Grand Prix and never started one**. A column headed `Starts` therefore
 *    reads `starts`, and the *Never started* stratum is `starts === 0` — which is 91 drivers, not
 *    the 63 with no race entry at all. `raced` stays keyed on `races`, because that is what the
 *    schema guarantees `firstSeason`'s nullability against.
 * 2. **A title is not "led the championship once".** `championships` is **35**, not the 66 a naive
 *    `position = 1` over the per-round snapshots returns. That figure is the server's and is never
 *    recomputed here.
 */

/* ------------------------------------------------------------------------------- helpers */

/** The most recent season anything in the list reached. `null` when nothing did. */
function latestSeason(seasons: readonly (number | null)[]): number | null {
  let latest: number | null = null;
  for (const season of seasons) {
    if (season !== null && (latest === null || season > latest)) latest = season;
  }
  return latest;
}

/**
 * `bestChampionshipPosition` turned into a **higher-is-better** merit component.
 *
 * The field is a rank, so 1 beats 20 and `null` — *never placed*, 498 of 881 — beats nothing. A
 * raw copy into the rank vector would sort the field exactly backwards, which is the shape of bug
 * that reads as plausible for a long time: the list would still be ordered, just wrongly.
 *
 * `-1` for null keeps it below every real position, matching `compareRank`'s absent-is-lowest rule.
 */
function championshipMerit(best: number | null): number {
  return best === null ? -1 : 1000 - best;
}

function fact(label: string, value: string): IndexFact {
  return { label, value, mono: true };
}

function lens(
  id: string,
  label: string,
  by: SortOption['by'],
  group: SortOption['group'],
  figure: number | null,
  headings?: readonly { key: string; label: string }[],
): SortOption {
  const base: SortOption = { id, label, by, group, figure };
  /*
   * `headings` is **omitted** rather than set to `undefined` — `exactOptionalPropertyTypes` is on,
   * and the two are different types here.
   */
  if (headings === undefined) return base;
  return {
    ...base,
    headings: headings.map((heading) => ({ key: heading.key, label: heading.label })),
  };
}

/* ------------------------------------------------------------------------- the page model */

/** The masthead's fact line. Each entry is one `·`-separated clause. */
export interface IndexFact {
  label: string;
  value: string;
  mono?: boolean;
}

/** Everything one index page needs, built from one payload in one pass. */
export interface IndexModel {
  items: IndexItem[];
  strata: readonly StratumDefinition[];
  lenses: readonly SortOption[];
  columns: readonly FigureColumn[];
  facts: readonly IndexFact[];
  /** The board's headings and captions — §6.6.5.1. */
  board: {
    strataHeading: string;
    strataCaption: string;
    eraHeading: string;
    eraCaption: string;
  };
  /**
   * The footnote under the list, or `null` when the payload holds nothing to keep back. `count` is
   * counted from the payload, never written into the copy.
   */
  aside: { count: number; total: number; headline: string; explain: string } | null;
  /** The season the activity marks compare against — derived, never hard-coded. */
  latest: number | null;
}

/**
 * The four disjoint achievement tiers, shared by drivers and teams because the ladder is the same
 * idea for both: *how far did they get*.
 *
 * **Disjoint, and checked from the top.** A champion is not also counted as a winner, so every bar
 * reads exactly the number of rows a click on it produces (`strata.ts`). The nesting — 116 drivers
 * won a race, of whom 35 were champions — lives in the sublabels and the caption, where it is
 * unambiguous, rather than in a number that would contradict the list.
 */
function meritTier(started: boolean, wins: number, podiums: number, titles: number): string {
  if (titles > 0) return 'champion';
  if (wins > 0) return 'winner';
  if (podiums > 0) return 'podium';
  return started ? 'starter' : 'none';
}

/* ------------------------------------------------------------------------------- drivers */

const DRIVER_BANDS: readonly BandDefinition[] = [
  { key: 'starts-150', label: '150 starts or more', min: 150 },
  { key: 'starts-50', label: '50–149 starts', min: 50 },
  { key: 'starts-11', label: '11–49 starts', min: 11 },
  { key: 'starts-2', label: '2–10 starts', min: 2 },
  { key: 'starts-1', label: 'A single start', min: 1 },
  { key: 'starts-0', label: 'Never started', min: 0 },
];

const DRIVER_STRATA: readonly StratumDefinition[] = [
  { key: 'champion', label: 'Champions', sublabel: 'won a drivers’ title' },
  { key: 'winner', label: 'Race winners', sublabel: 'won a Grand Prix, never a title' },
  { key: 'podium', label: 'Podium finishers', sublabel: 'reached a podium, never won' },
  { key: 'starter', label: 'Grand Prix starters', sublabel: 'started, never a podium' },
  { key: 'none', label: 'Never started', sublabel: 'in the record, never on a grid', aside: true },
];

export function driverIndexModel(rows: readonly DriverListItem[]): IndexModel {
  const latest = latestSeason(rows.map((row) => row.lastSeason));

  const items = rows.map((row): IndexItem => {
    const title = `${row.forename} ${row.surname}`;
    /* `races`, not `starts` — this is what the schema guarantees `firstSeason`'s nullability
     * against, and it is what decides whether the rail has anything to plot. */
    const raced = row.races > 0;
    const started = row.starts > 0;

    return {
      ref: row.ref,
      href: `/drivers/${row.ref}`,
      title,
      sortKey: driverSortKey(row.forename, row.surname),
      /* The reference is in the haystack because it is what a URL carries and what a reader who
       * arrived from a link might type back. */
      haystack: buildHaystack([
        row.forename,
        row.surname,
        row.code,
        row.nationality,
        row.countryCode,
        row.ref,
      ]),
      code: row.code,
      subtitle: row.nationality,
      /*
       * **No identity colour on a driver row, and it is not an oversight.** A driver is not owned
       * by one team across a career — Hamilton is McLaren, Mercedes and Ferrari — so a single
       * swatch beside the name would be a claim the data does not support. The payload carries no
       * `teamRef` for exactly that reason. §3.3a would rather have no identity than an arbitrary
       * one.
       */
      identityRef: null,
      markKind: 'driver',
      firstSeason: row.firstSeason,
      lastSeason: row.lastSeason,
      isCurrent: latest !== null && row.lastSeason === latest,
      raced,
      /*
       * **`Never started`, keyed on `starts` rather than on `races`.** 28 drivers entered a Grand
       * Prix and did not start it, and to those 28 a chip reading "never raced" is false while no
       * chip at all is a silence. The two-line distinction the record makes is the one the chip
       * makes.
       */
      chip: started ? null : 'Never started',
      /*
       * **`starts`, `wins` and `podiums` render their measured `0`; `firstSeason` renders `—`.**
       * That is §1.0's distinction rather than an inconsistency: `0` is what the query counted,
       * while `firstSeason` is null *exactly* when `races` is 0, so printing `0` there would state
       * a season that never happened.
       */
      figures: [row.starts, row.wins, row.podiums, row.firstSeason],
      ariaLabel: driverAriaLabel(row, title),
      tier: meritTier(started, row.wins, row.podiums, row.championships),
      band: bandOf(row.starts, DRIVER_BANDS),
      /*
       * Titles, then wins, then podiums, then career-best championship position, then starts.
       *
       * **The fourth element is what stops the bottom of the list being flat.** 702 of the 818
       * drivers who raced never won a race and 599 never reached a podium, so on the first three
       * elements alone the largest stratum on the page is one enormous tie broken by surname.
       * `bestChampionshipPosition` orders 383 of them by how close they came, and the 435 who
       * never placed fall to career length — which is the right consolation ordering and not an
       * accident of the alphabet.
       */
      rank: [
        row.championships,
        row.wins,
        row.podiums,
        championshipMerit(row.bestChampionshipPosition),
        row.starts,
      ],
      titles: row.championships,
    };
  });

  const champions = items.filter((item) => (item.titles ?? 0) > 0).length;
  const winners = rows.filter((row) => row.wins > 0).length;
  const podiums = rows.filter((row) => row.podiums > 0).length;
  const started = rows.filter((row) => row.starts > 0).length;
  const held = asideCount(items, DRIVER_STRATA);

  return {
    items,
    strata: DRIVER_STRATA,
    lenses: [
      lens('tier', 'Achievement', 'tier', 'tier', 1, DRIVER_STRATA),
      lens('era', 'Era', 'debut', 'decade', 3),
      lens('career', 'Career', 'band', 'band', 0, DRIVER_BANDS),
      lens('az', 'A–Z', 'name', 'letter', null),
    ],
    columns: [
      { key: 'starts', label: 'Starts', priority: 1 },
      { key: 'wins', label: 'Wins', priority: 2 },
      { key: 'podiums', label: 'Podiums', priority: 3 },
      { key: 'debut', label: 'Debut', priority: 4 },
    ],
    facts: [
      fact('in the record', `${String(items.length)} in the record`),
      fact('started a Grand Prix', `${String(started)} started a Grand Prix`),
      fact('won one', `${String(winners)} won one`),
      fact('became champion', `${String(champions)} became champion`),
    ],
    board: {
      strataHeading: 'How far they got',
      strataCaption: `Every driver is in exactly one band. Read cumulatively: ${String(podiums)} of the ${String(started)} who started a Grand Prix reached a podium, ${String(winners)} won one, and ${String(champions)} took a title.`,
      eraHeading: 'The field, by decade',
      eraCaption:
        'A driver is counted in every decade between their first Grand Prix and their last. The grid has shrunk eight-fold since the 1950s.',
    },
    aside:
      held === 0
        ? null
        : {
            count: held,
            total: items.length,
            headline: `${String(held)} of the ${String(items.length)} drivers in the record never started a Grand Prix.`,
            explain:
              'Some entered and never qualified; some were entered and did not start; others appear only in a Friday practice session. They are kept out of the list above rather than out of the record — every one of their pages exists.',
          },
    latest,
  };
}

function driverAriaLabel(row: DriverListItem, title: string): string {
  const parts = [title];
  if (row.nationality !== null) parts.push(row.nationality);

  if (row.starts === 0) {
    parts.push('never started a Grand Prix');
  } else {
    parts.push(row.starts === 1 ? '1 start' : `${String(row.starts)} starts`);
    parts.push(row.wins === 1 ? '1 win' : `${String(row.wins)} wins`);
    if (row.championships > 0) {
      parts.push(
        row.championships === 1
          ? 'world champion'
          : `${String(row.championships)}-time world champion`,
      );
    }
  }

  if (row.firstSeason !== null && row.lastSeason !== null) {
    parts.push(
      row.firstSeason === row.lastSeason
        ? String(row.firstSeason)
        : `${String(row.firstSeason)} to ${String(row.lastSeason)}`,
    );
  }
  return parts.join(', ');
}

/* --------------------------------------------------------------------------------- teams */

const TEAM_BANDS: readonly BandDefinition[] = [
  { key: 'races-400', label: '400 Grands Prix or more', min: 400 },
  { key: 'races-100', label: '100–399 Grands Prix', min: 100 },
  { key: 'races-20', label: '20–99 Grands Prix', min: 20 },
  { key: 'races-2', label: '2–19 Grands Prix', min: 2 },
  { key: 'races-1', label: 'A single Grand Prix', min: 1 },
  { key: 'races-0', label: 'Never started', min: 0 },
];

const TEAM_STRATA: readonly StratumDefinition[] = [
  { key: 'champion', label: 'Constructors’ champions', sublabel: 'won a Constructors’ title' },
  { key: 'winner', label: 'Race winners', sublabel: 'won a Grand Prix, never a title' },
  { key: 'podium', label: 'Podium finishers', sublabel: 'reached a podium, never won' },
  { key: 'starter', label: 'Grand Prix entrants', sublabel: 'started, never a podium' },
  { key: 'none', label: 'Never started', sublabel: 'entered, never made a grid', aside: true },
];

export function teamIndexModel(rows: readonly TeamListItem[]): IndexModel {
  const latest = latestSeason(rows.map((row) => row.lastSeason));

  const items = rows.map((row): IndexItem => {
    const raced = row.races > 0;
    return {
      ref: row.ref,
      href: `/teams/${row.ref}`,
      title: row.name,
      sortKey: normalise(row.name),
      haystack: buildHaystack([row.name, row.nationality, row.countryCode, row.ref]),
      code: null,
      subtitle: row.nationality,
      /* A team *is* its own identity, so unlike a driver row this one carries a colour — the
       * brand colour for 12 of 214, the deterministic ramp slot for the rest (§3.3a.3). */
      identityRef: row.ref,
      markKind: 'team',
      firstSeason: row.firstSeason,
      lastSeason: row.lastSeason,
      isCurrent: latest !== null && row.lastSeason === latest,
      raced,
      chip: raced ? null : 'Never started',
      figures: [row.races, row.wins, row.podiums, row.firstSeason],
      ariaLabel: teamAriaLabel(row),
      tier: meritTier(raced, row.wins, row.podiums, row.championships),
      band: bandOf(row.races, TEAM_BANDS),
      rank: [
        row.championships,
        row.wins,
        row.podiums,
        championshipMerit(row.bestChampionshipPosition),
        row.races,
      ],
      titles: row.championships,
    };
  });

  const champions = rows.filter((row) => row.championships > 0).length;
  const winners = rows.filter((row) => row.wins > 0).length;
  const started = rows.filter((row) => row.races > 0).length;
  const current = items.filter((item) => item.isCurrent).length;
  const held = asideCount(items, TEAM_STRATA);

  return {
    items,
    strata: TEAM_STRATA,
    lenses: [
      lens('tier', 'Achievement', 'tier', 'tier', 1, TEAM_STRATA),
      lens('era', 'Era', 'debut', 'decade', 3),
      lens('career', 'Longevity', 'band', 'band', 0, TEAM_BANDS),
      lens('az', 'A–Z', 'name', 'letter', null),
    ],
    columns: [
      { key: 'races', label: 'Grands Prix', priority: 1 },
      { key: 'wins', label: 'Wins', priority: 2 },
      { key: 'podiums', label: 'Podiums', priority: 3 },
      { key: 'debut', label: 'Debut', priority: 4 },
    ],
    facts: [
      fact('in the record', `${String(items.length)} in the record`),
      fact('started a Grand Prix', `${String(started)} started a Grand Prix`),
      fact('won one', `${String(winners)} won one`),
      ...(latest === null
        ? []
        : [fact('racing now', `${String(current)} raced in ${String(latest)}`)]),
    ],
    board: {
      strataHeading: 'How far they got',
      strataCaption: `A handful endure and most vanish: of the ${String(started)} constructors that started a Grand Prix, ${String(winners)} ever won one and ${String(champions)} ever took a title.`,
      eraHeading: 'Constructors, by decade',
      eraCaption:
        'A constructor is counted in every decade between its first Grand Prix and its last, so a name revived after a gap is counted through it. No lineage is implied — the record holds each identity separately.',
    },
    aside:
      held === 0
        ? null
        : {
            count: held,
            total: items.length,
            headline: `${String(held)} of the ${String(items.length)} teams in the record never started a Grand Prix.`,
            explain:
              'They entered and never made a grid. They are kept out of the list above rather than out of the record — every one of their pages exists.',
          },
    latest,
  };
}

function teamAriaLabel(row: TeamListItem): string {
  const parts = [row.name];
  if (row.nationality !== null) parts.push(row.nationality);

  if (row.races === 0) {
    parts.push('entered and never started a Grand Prix');
  } else {
    parts.push(row.races === 1 ? '1 Grand Prix' : `${String(row.races)} Grands Prix`);
    parts.push(row.wins === 1 ? '1 win' : `${String(row.wins)} wins`);
    if (row.championships > 0) {
      parts.push(
        row.championships === 1
          ? '1 Constructors’ title'
          : `${String(row.championships)} Constructors’ titles`,
      );
    }
  }

  if (row.firstSeason !== null && row.lastSeason !== null) {
    parts.push(
      row.firstSeason === row.lastSeason
        ? String(row.firstSeason)
        : `${String(row.firstSeason)} to ${String(row.lastSeason)}`,
    );
  }
  return parts.join(', ');
}

/* ------------------------------------------------------------------------------ circuits */

const CIRCUIT_BANDS: readonly BandDefinition[] = [
  { key: 'gp-30', label: '30 Grands Prix or more', min: 30 },
  { key: 'gp-10', label: '10–29 Grands Prix', min: 10 },
  { key: 'gp-2', label: '2–9 Grands Prix', min: 2 },
  { key: 'gp-1', label: 'One Grand Prix', min: 1 },
  { key: 'gp-0', label: 'None yet', min: 0 },
];

/**
 * Circuits stratify by **calendar standing**, not by achievement — a venue does not win anything,
 * and the striking fact about F1's geography is attrition: **53 of 78 venues are gone.**
 *
 * **The test is `lastScheduledYear`, and `lastYear` will not do.** The archive's latest season is in
 * progress — 10 of 22 rounds in 2026 — so half the current calendar has no result this year and a
 * `lastYear === latest` test files Monza, Spa, Baku and eleven more as retired. `lastScheduledYear`
 * is the last year a venue holds a **numbered round, run or not**, which is precisely "is it still
 * on the calendar"; the schema published it for this. Measured: **22 · 3 · 53**.
 */
function circuitStrata(latest: number | null): readonly StratumDefinition[] {
  return [
    {
      key: 'current',
      label: latest === null ? 'On the current calendar' : `On the ${String(latest)} calendar`,
      sublabel: 'a numbered round this season, run or still to come',
    },
    {
      key: 'recent',
      label: latest === null ? 'Used last season' : `Last used in ${String(latest - 1)}`,
      sublabel: 'on the previous calendar and not this one',
    },
    {
      key: 'retired',
      label: 'No longer used',
      sublabel:
        latest === null ? 'off the calendar' : `no round since ${String(latest - 2)} or earlier`,
    },
  ];
}

export function circuitIndexModel(rows: readonly CircuitListItem[]): IndexModel {
  /*
   * The calendar's own latest year, from `lastScheduledYear` and **not** from `lastYear`: a venue
   * whose 2026 round has not been run yet still belongs to 2026, and taking the maximum of
   * `lastYear` would put the whole comparison one season behind whenever the season is young.
   */
  const latest = latestSeason(rows.map((row) => row.lastScheduledYear));

  const items = rows.map((row): IndexItem => {
    const raced = row.racesWithResults > 0;
    const place = [row.locality, row.country].filter((part) => part !== null).join(', ');
    const scheduled = row.lastScheduledYear;
    const tier =
      latest === null || scheduled === null
        ? 'retired'
        : scheduled >= latest
          ? 'current'
          : scheduled === latest - 1
            ? 'recent'
            : 'retired';

    return {
      ref: row.ref,
      href: `/circuits/${row.ref}`,
      title: row.name,
      sortKey: normalise(row.name),
      haystack: buildHaystack([row.name, row.locality, row.country, row.countryCode, row.ref]),
      code: null,
      subtitle: place === '' ? null : place,
      /* §6.6.2.1 — a circuit has no identity colour and must not borrow one, so it takes no
       * colour and no mark column at all. */
      identityRef: null,
      markKind: null,
      firstSeason: row.firstYear,
      lastSeason: row.lastYear,
      isCurrent: tier === 'current',
      raced,
      /*
       * **`Not yet raced`, never `Never raced`.** A venue with a numbered round and no
       * classification rows is on the calendar — Madring is 2026 R14 — and calling that a gap
       * would repeat the mistake `SeasonCalendar` fixed for an upcoming round.
       */
      chip: raced ? null : 'Not yet raced',
      figures: [row.racesWithResults, row.firstYear, row.lastYear, row.roundsHeld],
      ariaLabel: circuitAriaLabel(row, place),
      tier,
      band: bandOf(row.racesWithResults, CIRCUIT_BANDS),
      rank: [row.racesWithResults, row.roundsHeld],
      titles: null,
    };
  });

  const strata = circuitStrata(latest);
  const onCalendar = items.filter((item) => item.tier === 'current').length;
  const gone = items.filter((item) => item.tier === 'retired').length;
  const earliest = items.reduce<number | null>(
    (least, item) =>
      item.firstSeason === null
        ? least
        : least === null
          ? item.firstSeason
          : Math.min(least, item.firstSeason),
    null,
  );

  return {
    items,
    strata,
    lenses: [
      lens('tier', 'Calendar', 'tier', 'tier', null, strata),
      lens('era', 'Era', 'debut', 'decade', 1),
      lens('career', 'Grands Prix', 'band', 'band', 0, CIRCUIT_BANDS),
      lens('az', 'A–Z', 'name', 'letter', null),
    ],
    columns: [
      { key: 'races', label: 'Grands Prix', priority: 1 },
      { key: 'first', label: 'First', priority: 2 },
      { key: 'latest', label: 'Latest', priority: 3 },
      /*
       * `Rounds` last, and it earns its column only at ≥1280 because it differs from `Grands Prix`
       * on very few venues — Monza reads 76 and 75, the 76th being 2026's, not yet run. Two numbers
       * because they are two facts (`server/schemas/directory.ts`), never a date comparison.
       */
      { key: 'rounds', label: 'Rounds', priority: 4 },
    ],
    facts: [
      fact('in the record', `${String(items.length)} venues`),
      ...(earliest !== null && latest !== null
        ? [fact('Span', `${String(earliest)}–${String(latest)}`)]
        : []),
      fact('on the calendar', `${String(onCalendar)} on the calendar`),
      fact('no longer used', `${String(gone)} no longer used`),
    ],
    board: {
      strataHeading: 'Where they stand',
      strataCaption: `Formula 1 keeps moving: ${String(gone)} of the ${String(items.length)} venues it has visited are no longer on the calendar.`,
      eraHeading: 'Venues, by decade',
      eraCaption:
        'A circuit is counted in every decade between its first Grand Prix and its most recent.',
    },
    /* Madring is not an aside. A venue joining the calendar is the opposite of clutter. */
    aside: null,
    latest,
  };
}

function circuitAriaLabel(row: CircuitListItem, place: string): string {
  const parts = [row.name];
  if (place !== '') parts.push(place);
  if (row.racesWithResults === 0) {
    parts.push('no Grand Prix run here yet');
  } else {
    parts.push(
      row.racesWithResults === 1 ? '1 Grand Prix' : `${String(row.racesWithResults)} Grands Prix`,
    );
    if (row.firstYear !== null && row.lastYear !== null) {
      parts.push(
        row.firstYear === row.lastYear
          ? String(row.firstYear)
          : `${String(row.firstYear)} to ${String(row.lastYear)}`,
      );
    }
  }
  return parts.join(', ');
}
