import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ChevronRight, Info, Trophy, X } from '@/components/ui/icons';
import { cssVar, identityToken } from '@/lib/entityColor';
import { useListReveal } from '@/lib/motion/scroll';
import { EntityPortrait } from './EntityPortrait';
import { IndexConsole } from './IndexConsole';
import { PopulationBoard } from './PopulationBoard';
import { SpanRail } from './SpanRail';
import {
  filterItems,
  groupItems,
  railDomain,
  sortItems,
  type FigureColumn,
  type IndexGroup,
  type IndexItem,
  type SortOption,
} from './indexModel';
import {
  applySelection,
  asideCount,
  buildStrata,
  eraBuckets,
  type StratumDefinition,
} from './strata';

/**
 * **`EntityIndex`** — the one surface behind `/drivers`, `/teams` and `/circuits`.
 * `DESIGN_SYSTEM.md` §6.6.4, §6.6.5.
 *
 * ---
 *
 * **Why it was rebuilt.** The first version was a search field over an alphabetical list, and
 * Rishabh rejected it: *"i dont want a basic search bar page, please design it in a meaningful way
 * based on the data … i really like the way you have designed the seasons page, like its different,
 * it has meaningful data, its intuitive"*.
 *
 * The season hub works because a season **has a shape** and the page draws it. An index has a shape
 * too — F1 is a pyramid and the field collapsed eight-fold since the 1950s — and the first build
 * threw all of it away, because the alphabet is not a fact about Formula 1. **The three sorts
 * `A–Z / Debut / Races` were three ways to reorder one undifferentiated wall.**
 *
 * So the page now opens on `PopulationBoard`: the ladder of how far they got, and the decade
 * columns of how many there were. Both are filters. **The default view is not alphabetical** — it
 * is the achievement ladder, so `/drivers` opens on Schumacher and Hamilton rather than on Carlo
 * Abate, and the reader who does not yet know which driver they want still learns something.
 *
 * ---
 *
 * **Five decisions that are easy to get wrong and are made here once.**
 *
 * 1. **The whole row is the link.** This page's job is navigation, so a row that names an entity
 *    and does not go there has failed its only purpose. That rules out a `<table>` — an `<a>`
 *    cannot wrap `<td>`s — so it is an `<ul>` of `<li><Link>`, exactly as `SeasonCalendar`
 *    resolved the same tension.
 * 2. **The accessible name is one sentence, not eight fragments.** A per-cell `sr-only` label
 *    would be four extra nodes on every one of 881 rows. `ariaLabel` is built by the presenter
 *    from the same values the cells show.
 * 3. **Nothing animates on a filter, a sort or a lens change.** G-23 and G-31 fire once per
 *    dataset; re-staggering 881 rows on the fifth keystroke is G-29's defect moved to a list.
 * 4. **The board's counts are of the whole payload, never of the current view** — the same rule
 *    the rail's domain follows. A ladder that rescaled as you filtered would make the same
 *    stratum say something different depending on what else was selected, which is the one thing
 *    a fixed reference exists to prevent. The console's live count carries the intersection.
 * 5. **The never-raced entities are reachable but not in the default browse.** 63 drivers and 9
 *    teams entered and never made a grid. The API serves them deliberately — the index must not
 *    disagree with the profile endpoint about who exists — so they sit behind a footnote that
 *    states the number and reveals them on demand, which is the move the coverage ruler already
 *    makes for a boundary the reader should know about but not trip over.
 */

export interface EntityIndexProps {
  /** `Drivers`. Also the `h1`. */
  title: string;
  /** `The archive`. */
  eyebrow: string;
  /** The masthead's fact line, already worded. */
  facts: readonly { label: string; value: string; mono?: boolean }[];
  /** `driver` / `team` / `circuit` — drives the row grid and the plural noun in the copy. */
  kind: 'driver' | 'team' | 'circuit';
  /** The plural noun, for the count and the empty state. `drivers`. */
  noun: string;
  /** Singular, for `No driver matches …`. */
  nounSingular: string;
  items: readonly IndexItem[] | null;
  columns: readonly FigureColumn[];
  sorts: readonly SortOption[];
  /** The ladder's rows, in order. */
  strata: readonly StratumDefinition[];
  board: {
    strataHeading: string;
    strataCaption: string;
    eraHeading: string;
    eraCaption: string;
  };
  /** The footnote's copy, or null when nothing is held back. */
  aside: { count: number; total: number; headline: string; explain: string } | null;
  /**
   * What fills the board's second column instead of the decade chart.
   *
   * Only `/circuits` passes one: 78 venues with coordinates want a **map**, and a bar chart of
   * venues per decade is the least interesting thing that page knows — it runs 19 → 30 and barely
   * moves, while the names underneath change completely. The board's *form* is unchanged, which is
   * what keeps the three pages one product; only the right-hand mark differs.
   */
  boardAside?: React.ReactNode;
  /** `meta.latestSeason.year` equivalent, derived from the payload. For the partial-decade flag. */
  latest: number | null;
  pending: boolean;
  error: { code: string } | null;
  onRetry: () => void;
}

const LIST_ID = 'entity-index-list';

export function EntityIndex({
  title,
  eyebrow,
  facts,
  kind,
  noun,
  nounSingular,
  items,
  columns,
  sorts,
  strata,
  board,
  aside,
  boardAside = null,
  latest,
  pending,
  error,
  onRetry,
}: EntityIndexProps) {
  const [query, setQuery] = useState('');
  const [sortId, setSortId] = useState(sorts[0]?.id ?? '');
  const [tier, setTier] = useState<string | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const [showAside, setShowAside] = useState(false);

  const sort = sorts.find((option) => option.id === sortId) ?? sorts[0];
  const source = items ?? EMPTY;

  /* Rule 4 in the header: both marks are measured against the whole payload. */
  const ladder = useMemo(() => buildStrata(source, strata), [source, strata]);
  const eras = useMemo(() => eraBuckets(source, latest), [source, latest]);
  const held = useMemo(() => asideCount(source, strata), [source, strata]);

  /*
   * Select, then filter, then sort, then group — memoised on the things that can change each.
   * 881 rows through four passes is cheap; doing it on every render while React re-renders the
   * input on every keystroke is not.
   */
  const selection = useMemo(() => ({ tier, decade, showAside }), [tier, decade, showAside]);
  const selected = useMemo(
    () => applySelection(source, selection, strata),
    [source, selection, strata],
  );
  const visible = useMemo(() => filterItems(selected, query), [selected, query]);
  const ordered = useMemo(
    () => (sort === undefined ? visible : sortItems(visible, sort)),
    [visible, sort],
  );
  const groups = useMemo(
    () => (sort === undefined ? [] : groupItems(ordered, sort.group, sort.headings)),
    [ordered, sort],
  );

  /*
   * **The domain is the whole payload's, never the filtered set's.** If it followed the filter, a
   * search for "senna" would rescale the rail to 1984–1994 and the bracket would fill the column —
   * the same entity would say something different depending on what else was on screen, which is
   * the one thing a shared axis exists to prevent.
   */
  const domain = useMemo(() => railDomain(source), [source]);

  /* G-23 keyed on the dataset, deliberately not on the query, the lens or the selection. */
  const { scope } = useListReveal<HTMLDivElement>([source.length, kind]);

  const filtering = query.trim() !== '';
  const narrowed = filtering || tier !== null || decade !== null;
  const countLabel = narrowed
    ? `${String(ordered.length)} of ${String(source.length)} ${noun}`
    : `${String(source.length)} ${noun}`;

  const tierLabel = ladder.find((stratum) => stratum.key === tier)?.label ?? null;
  const decadeLabel = eras.find((era) => era.decade === decade)?.longLabel ?? null;

  const clearAll = () => {
    setTier(null);
    setDecade(null);
    setQuery('');
  };

  if (error !== null) {
    return (
      <div className="shell-container entity-index px-4 md:px-6 xl:px-8">
        <IndexMasthead eyebrow={eyebrow} title={title} facts={[]} pending={false} />
        <ErrorState
          title={`These ${noun} could not be loaded`}
          detail="Nothing was lost — the record is read-only. Try again."
          code={error.code}
          onRetry={onRetry}
        />
      </div>
    );
  }

  return (
    <div className="shell-container entity-index px-4 md:px-6 xl:px-8">
      <IndexMasthead eyebrow={eyebrow} title={title} facts={facts} pending={pending} />

      <PopulationBoard
        strata={ladder}
        eras={eras}
        strataHeading={board.strataHeading}
        strataCaption={board.strataCaption}
        eraHeading={board.eraHeading}
        eraCaption={board.eraCaption}
        noun={noun}
        activeTier={tier}
        activeDecade={decade}
        onTierChange={setTier}
        onDecadeChange={setDecade}
        pending={pending}
      >
        {boardAside}
      </PopulationBoard>

      <IndexConsole
        label={`Search ${noun}`}
        placeholder={SEARCH_PLACEHOLDER[kind]}
        query={query}
        onQueryChange={setQuery}
        sorts={sorts}
        sortId={sort?.id ?? ''}
        onSortChange={setSortId}
        countLabel={pending ? `Loading ${noun}` : countLabel}
        listId={LIST_ID}
        filters={
          tier === null && decade === null ? null : (
            <ActiveFilters
              tierLabel={tierLabel}
              decadeLabel={decadeLabel}
              onClearTier={() => {
                setTier(null);
              }}
              onClearDecade={() => {
                setDecade(null);
              }}
            />
          )
        }
      />

      {/*
       * `id` on the panel rather than on any one `<ul>`: the console's `aria-controls` has to point
       * at one element, and the list is several — one per group — plus a skeleton and two empty
       * states, all of which are what the field controls.
       */}
      <div className="season-panel" id={LIST_ID}>
        <ColumnHeader kind={kind} columns={columns} sortFigure={sort?.figure ?? null} />

        {pending ? (
          <IndexSkeleton kind={kind} columns={columns} />
        ) : source.length === 0 ? (
          <p className="index-empty t-sm text-ink-tertiary">{`The record holds no ${noun}.`}</p>
        ) : ordered.length === 0 ? (
          <div className="index-empty">
            {filtering ? (
              <>
                <p className="t-base text-ink-primary">{`No ${nounSingular} matches “${query.trim()}”.`}</p>
                <p className="t-sm text-ink-tertiary">{SEARCH_HELP[kind]}</p>
              </>
            ) : (
              <>
                <p className="t-base text-ink-primary">{`No ${nounSingular} is in every group you have selected.`}</p>
                <p className="t-sm text-ink-tertiary">
                  The ladder and the decades narrow the list together. Release one of them to widen
                  it.
                </p>
              </>
            )}
            {/*
             * `Show all drivers`, not `Clear search`: the console's own × already carries that
             * exact label, and two controls with one accessible name in one region is ambiguous
             * to a screen-reader user and to anyone driving by voice.
             */}
            <Button variant="secondary" onClick={clearAll}>
              {`Show all ${noun}`}
            </Button>
          </div>
        ) : (
          <div ref={scope}>
            {groups.map((group) => (
              <IndexGroupSection
                key={group.key}
                group={group}
                kind={kind}
                columns={columns}
                sortFigure={sort?.figure ?? null}
                domainStart={domain.start}
                domainEnd={domain.end}
              />
            ))}
          </div>
        )}
      </div>

      {/*
       * The footnote, **under the list rather than over it**. The first build put this notice above
       * the rows, which gave the 63 people the record holds nothing for the most prominent
       * paragraph on a page about the 818 who raced. It is honest either way; it is only correctly
       * weighted here.
       *
       * Suppressed while a stratum is selected: the ladder is already answering the question, and
       * a second control that silently disagrees with it would be worse than no control.
       */}
      {aside !== null && !pending && tier === null && (
        <div className="index-aside">
          <Info size={16} />
          <p className="index-aside-copy">
            <b>{aside.headline}</b> {aside.explain}
          </p>
          <Button
            variant="secondary"
            aria-pressed={showAside}
            onClick={() => {
              setShowAside((shown) => !shown);
            }}
          >
            {showAside ? 'Hide them' : 'Show them'}
          </Button>
          {/* The live region says what the button did, because the change happens 900px above it. */}
          <span className="sr-only" aria-live="polite">
            {showAside
              ? `${String(held)} ${noun} added to the list.`
              : `${String(held)} ${noun} hidden from the list.`}
          </span>
        </div>
      )}
    </div>
  );
}

const EMPTY: readonly IndexItem[] = [];

/**
 * **A team has no three-letter code, and the copy said it did.** The placeholder and the
 * empty-search help were branched `circuit` / everything-else, so `/teams` invited a reader to
 * search by "a code" — a driver concept the sport does not apply to constructors, and a promise the
 * haystack cannot keep (`teamItems` builds it from name, nationality, country code and the slug).
 * Caught in Rishabh's capture.
 *
 * One record keyed by kind rather than a nested ternary, because that is what stopped the third
 * case from being written the first time.
 */
const SEARCH_PLACEHOLDER: Record<EntityIndexProps['kind'], string> = {
  driver: 'Search a name, a code or a nationality',
  team: 'Search a team or a nationality',
  circuit: 'Search a circuit, a country or a city',
};

const SEARCH_HELP: Record<EntityIndexProps['kind'], string> = {
  driver: 'Search matches a name, a three-letter code, a nationality or the reference in the URL.',
  team: 'Search matches a team name, a nationality or the reference in the URL.',
  circuit: 'Search matches a circuit name, a city, a country or the reference in the URL.',
};

/**
 * The chips for whatever the board currently has selected.
 *
 * Inside the console, because the console is sticky: a reader 400 rows down has to be able to see
 * that a filter is on and release it without scrolling back to the board.
 */
function ActiveFilters({
  tierLabel,
  decadeLabel,
  onClearTier,
  onClearDecade,
}: {
  tierLabel: string | null;
  decadeLabel: string | null;
  onClearTier: () => void;
  onClearDecade: () => void;
}) {
  return (
    <div className="index-filters">
      <span className="index-filters-legend">Showing</span>
      {tierLabel !== null && (
        <button
          type="button"
          className="index-filter-chip"
          onClick={onClearTier}
          aria-label={`Remove the ${tierLabel} filter`}
        >
          <span>{tierLabel}</span>
          <X size={16} />
        </button>
      )}
      {decadeLabel !== null && (
        <button
          type="button"
          className="index-filter-chip"
          onClick={onClearDecade}
          aria-label={`Remove the ${decadeLabel} filter`}
        >
          <span>{decadeLabel}</span>
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * The masthead. Deliberately the **same type and the same eyebrow rule** as an entity profile
 * (§6.6.4.1), because the index is the profile pages' entrance and the two must read as one
 * product rather than as a list page bolted onto a detail page.
 */
function IndexMasthead({
  eyebrow,
  title,
  facts,
  pending,
}: {
  eyebrow: string;
  title: string;
  facts: readonly { label: string; value: string; mono?: boolean }[];
  pending: boolean;
}) {
  return (
    <section className="entity-masthead" aria-labelledby="entity-index-title">
      <div className="entity-masthead-head">
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 id="entity-index-title" className="entity-name mt-3">
          {title}
        </h1>
        {pending ? (
          <p className="entity-meta mt-2" aria-hidden="true">
            <LoadingState announce={false} className="skeleton-title-detail" />
          </p>
        ) : (
          facts.length > 0 && (
            <p className="entity-meta t-sm text-ink-secondary mt-2">
              {facts.map((fact) => (
                <span key={fact.label} className={fact.mono === true ? 't-mono' : undefined}>
                  <span className="sr-only">{`${fact.label}: `}</span>
                  {fact.value}
                </span>
              ))}
            </p>
          )
        )}
      </div>
    </section>
  );
}

/**
 * The column header strip. `aria-hidden`, because every value it labels is already in the row's
 * accessible name — announcing the headers as well would make a screen reader read the table
 * twice, once as columns and once as sentences.
 */
function ColumnHeader({
  kind,
  columns,
  sortFigure,
}: {
  kind: 'driver' | 'team' | 'circuit';
  columns: readonly FigureColumn[];
  sortFigure: number | null;
}) {
  return (
    <div className="index-head" data-kind={kind} aria-hidden="true">
      {kind !== 'circuit' && <span />}
      <span className="index-head-label">Name</span>
      <span className="index-head-label">1950 — today</span>
      <span className="index-figures">
        {columns.map((column, position) => (
          <span
            key={column.key}
            className="index-figure index-head-label"
            data-priority={column.priority}
            data-sorted={position === sortFigure ? 'true' : 'false'}
          >
            {column.label}
          </span>
        ))}
      </span>
      <span />
    </div>
  );
}

function IndexGroupSection({
  group,
  kind,
  columns,
  sortFigure,
  domainStart,
  domainEnd,
}: {
  group: IndexGroup;
  kind: 'driver' | 'team' | 'circuit';
  columns: readonly FigureColumn[];
  sortFigure: number | null;
  domainStart: number;
  domainEnd: number;
}) {
  return (
    <section className="index-group" aria-label={group.label === '' ? undefined : group.label}>
      {group.label !== '' && (
        <p className="index-group-head">
          <span className="index-group-label">{group.label}</span>
          <span className="index-group-rule" aria-hidden="true" />
          <span className="index-group-count t-mono">{group.count}</span>
        </p>
      )}
      <ul className="index-list">
        {group.items.map((item) => (
          <IndexRow
            key={item.ref}
            item={item}
            kind={kind}
            columns={columns}
            sortFigure={sortFigure}
            domainStart={domainStart}
            domainEnd={domainEnd}
          />
        ))}
      </ul>
    </section>
  );
}

function IndexRow({
  item,
  kind,
  columns,
  sortFigure,
  domainStart,
  domainEnd,
}: {
  item: IndexItem;
  kind: 'driver' | 'team' | 'circuit';
  columns: readonly FigureColumn[];
  sortFigure: number | null;
  domainStart: number;
  domainEnd: number;
}) {
  const identity =
    item.identityRef === null
      ? undefined
      : ({ '--identity': cssVar(identityToken(item.identityRef)) } as CSSProperties);

  const titles = item.titles ?? 0;

  return (
    <li>
      <Link
        className="index-row"
        data-kind={kind}
        data-raced={item.raced ? 'true' : 'false'}
        data-tier={item.tier}
        data-motion="index-row"
        style={identity}
        to={item.href}
        aria-label={item.ariaLabel}
      >
        {item.markKind !== null && (
          <span className="index-mark">
            {/*
             * §7.17 — the photograph layer, wired for drivers only and **lazy**. 22 of 881 have
             * one, so 859 rows here render the monogram: the same box, the same border, the same
             * identity bar, the same ground. Nothing in the row says a monogram is a photograph
             * that failed to arrive.
             *
             * `reference` is passed only for a driver. A team's `ref` is a real key in the *car*
             * and *mark* sets (§7.19) and handing it to a driver lookup would be a namespace
             * collision waiting for a team called `hamilton`; `photographFor` is keyed
             * `driver:<ref>` precisely so that cannot resolve.
             *
             * There is **no credit line in a row**, and that is structural rather than an
             * omission: the row is a `Link`, and a button inside an anchor is invalid markup. The
             * footer's global control (§7.18.1) is what covers the index pages.
             */}
            <EntityPortrait
              teamReference={item.identityRef}
              code={item.code}
              name={item.title}
              kind={item.markKind}
              reference={item.markKind === 'driver' ? item.ref : null}
            />
          </span>
        )}

        <span className="index-name">
          <span className="index-title-line">
            <span className="index-title">{item.title}</span>
            {item.code !== null && item.code !== '' && (
              <span className="index-code t-mono">{item.code}</span>
            )}
            {/*
             * The title mark. `aria-hidden` because `ariaLabel` already says *seven-time world
             * champion* in words, and a trophy glyph announced beside it would read the same fact
             * twice, worse. It is never the only channel: the row is in the Champions group, its
             * accessible name states the count, and the wins column carries the number.
             */}
            {titles > 0 && (
              <span className="index-accolade" aria-hidden="true">
                <Trophy size={16} />
                {titles > 1 && <span className="t-mono">{`×${String(titles)}`}</span>}
              </span>
            )}
            {item.chip !== null && <span className="season-chip">{item.chip}</span>}
          </span>
          {item.subtitle !== null && <span className="index-subtitle">{item.subtitle}</span>}
        </span>

        <span className="index-rail">
          <SpanRail
            firstSeason={item.firstSeason}
            lastSeason={item.lastSeason}
            domainStart={domainStart}
            domainEnd={domainEnd}
            current={item.isCurrent}
          />
        </span>

        <span className="index-figures">
          {columns.map((column, position) => {
            const value = item.figures[position] ?? null;
            return (
              <span
                key={column.key}
                className="index-figure t-mono"
                data-priority={column.priority}
                data-sorted={position === sortFigure ? 'true' : 'false'}
                data-absent={value === null ? 'true' : 'false'}
              >
                <span className="index-figure-label" aria-hidden="true">
                  {column.label}
                </span>
                {/*
                 * §6.6.2.2's rule, and it matters more here than on a profile: `0 wins` for Jean
                 * Alesi (201 starts) and `0 wins` for a driver who never started are the same
                 * glyph and completely different claims. Absence renders `—`, never `0`.
                 */}
                <span className="index-figure-value">{value === null ? '—' : value}</span>
              </span>
            );
          })}
        </span>

        <ChevronRight size={16} className="index-arrow" />
      </Link>
    </li>
  );
}

/**
 * Twelve rows of the real geometry (§7.5), so the panel holds its height and nothing below it
 * moves when the query resolves. One busy region for the whole list, and **not animated in**
 * (§4.6.1 rule 1) — a skeleton that fades in says nothing for 200ms, which is most of the window a
 * fast query is visible for at all.
 */
function IndexSkeleton({
  kind,
  columns,
}: {
  kind: 'driver' | 'team' | 'circuit';
  columns: readonly FigureColumn[];
}) {
  return (
    <ul className="index-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 12 }, (_, row) => (
        <li key={row}>
          <span className="index-row" data-kind={kind}>
            {kind !== 'circuit' && (
              <span className="index-mark">
                <LoadingState announce={false} className="skeleton-index-mark" />
              </span>
            )}
            <span className="index-name">
              <LoadingState announce={false} className="skeleton-index-name" />
            </span>
            <span className="index-rail">
              <LoadingState announce={false} className="skeleton-index-rail" />
            </span>
            <span className="index-figures">
              {columns.map((column) => (
                <span key={column.key} className="index-figure" data-priority={column.priority}>
                  <LoadingState announce={false} className="skeleton-index-figure" />
                </span>
              ))}
            </span>
            <span />
          </span>
        </li>
      ))}
    </ul>
  );
}
