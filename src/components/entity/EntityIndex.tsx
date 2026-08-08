import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ChevronRight } from '@/components/ui/icons';
import { cssVar, identityToken } from '@/lib/entityColor';
import { useListReveal } from '@/lib/motion/scroll';
import { EntityPortrait } from './EntityPortrait';
import { IndexConsole } from './IndexConsole';
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

/**
 * **`EntityIndex`** — the one surface behind `/drivers`, `/teams` and `/circuits`.
 * `DESIGN_SYSTEM.md` §6.6.4.
 *
 * ---
 *
 * **Why it exists: the three profile pages had no front door.** F4–F6 built
 * `/drivers/:ref`, `/teams/:ref` and `/circuits/:ref` and nothing at the bare paths, so the dock's
 * "Drivers" item — the primary navigation, on every screen — led to an F0 placeholder. §6.6.2.9
 * audited the seams *between* surfaces and found none missing; it never asked whether the surfaces
 * had an entrance. A link in the primary nav is a seam too.
 *
 * **One component, three pages, for §6.6.2's reason.** The risk is not that one index is wrong, it
 * is that three indexes look like three products. What differs between them is a column set and a
 * noun; everything else — the masthead, the console, the panel, the rail, the row grid, the states
 * — is this file.
 *
 * **The signature is the `SpanRail` (§7.12)**: every row plots its entity against the same fixed
 * domain, so scrolling 881 drivers is scrolling the sport's history rather than reading 881 names.
 *
 * ---
 *
 * **Three decisions that are easy to get wrong and are made here once.**
 *
 * 1. **The whole row is the link.** This page's entire job is navigation, so a row that names an
 *    entity and does not go there has failed its only purpose. That rules out a `<table>` — an
 *    `<a>` cannot wrap `<td>`s — so it is an `<ul>` of `<li><Link>`, exactly as `SeasonCalendar`
 *    resolved the same tension.
 * 2. **The accessible name is one sentence, not eight fragments.** A per-cell `sr-only` label would
 *    be four extra nodes on every one of 881 rows, and would read as
 *    *"Hamilton British 2007 2026 19 372 105 7"*. `ariaLabel` is built by the page from the same
 *    values the cells show.
 * 3. **Nothing animates on a filter or a sort.** G-23 fires once per dataset; re-staggering 881
 *    rows on the fifth keystroke is G-29's defect moved from a chart to a list.
 */

export interface EntityIndexProps {
  /** `Drivers`. Also the `h1`. */
  title: string;
  /** `The archive`. */
  eyebrow: string;
  /** The masthead's fact line, already worded. Figures are set in mono by the caller's `mono` flag. */
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
  /** Rendered above the list, once, when the payload holds entities with nothing to plot. */
  notice?: ReactNode;
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
  notice,
  pending,
  error,
  onRetry,
}: EntityIndexProps) {
  const [query, setQuery] = useState('');
  const [sortId, setSortId] = useState(sorts[0]?.id ?? '');

  const sort = sorts.find((option) => option.id === sortId) ?? sorts[0];
  const source = items ?? EMPTY;

  /*
   * Filter, then sort, then group — and memoised on the three things that can change it. 881 rows
   * through three passes is cheap; doing it on every render while React re-renders the input on
   * every keystroke is not.
   */
  const visible = useMemo(() => filterItems(source, query), [source, query]);
  const ordered = useMemo(
    () => (sort === undefined ? visible : sortItems(visible, sort)),
    [visible, sort],
  );
  const groups = useMemo(
    () => (sort === undefined ? [] : groupItems(ordered, sort.group)),
    [ordered, sort],
  );

  /*
   * **The domain is the whole payload's, never the filtered set's.** If it followed the filter, a
   * search for "senna" would rescale the rail to 1984–1994 and the bracket would fill the column —
   * the same entity would say something different depending on what else was on screen, which is
   * the one thing a shared axis exists to prevent.
   */
  const domain = useMemo(() => railDomain(source), [source]);

  /* G-23 keyed on the dataset, deliberately not on the query or the sort (see the header). */
  const { scope } = useListReveal<HTMLDivElement>([source.length, kind]);

  const filtering = query.trim() !== '';
  const countLabel = filtering
    ? `${String(ordered.length)} of ${String(source.length)} ${noun}`
    : `${String(source.length)} ${noun}`;

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

      <IndexConsole
        label={`Search ${noun}`}
        placeholder={
          kind === 'circuit'
            ? 'Search a circuit, a country or a city'
            : `Search a name, a code or a nationality`
        }
        query={query}
        onQueryChange={setQuery}
        sorts={sorts}
        sortId={sort?.id ?? ''}
        onSortChange={setSortId}
        countLabel={pending ? `Loading ${noun}` : countLabel}
        listId={LIST_ID}
      />

      {notice}

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
            <p className="t-base text-ink-primary">{`No ${nounSingular} matches “${query.trim()}”.`}</p>
            <p className="t-sm text-ink-tertiary">
              {kind === 'circuit'
                ? 'Search matches a circuit name, a city, a country or the reference in the URL.'
                : 'Search matches a name, a three-letter code, a nationality or the reference in the URL.'}
            </p>
            {/*
             * `Show all drivers`, not `Clear search`: the console's own × already carries that
             * exact label, and two controls with one accessible name in one region is ambiguous
             * to a screen-reader user and to anyone driving by voice.
             */}
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
              }}
            >
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
    </div>
  );
}

const EMPTY: readonly IndexItem[] = [];

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

  return (
    <li>
      <Link
        className="index-row"
        data-kind={kind}
        data-raced={item.raced ? 'true' : 'false'}
        data-motion="index-row"
        style={identity}
        to={item.href}
        aria-label={item.ariaLabel}
      >
        {item.markKind !== null && (
          <span className="index-mark">
            <EntityPortrait
              teamReference={item.identityRef}
              code={item.code}
              name={item.title}
              kind={item.markKind}
            />
          </span>
        )}

        <span className="index-name">
          <span className="index-title-line">
            <span className="index-title">{item.title}</span>
            {item.code !== null && item.code !== '' && (
              <span className="index-code t-mono">{item.code}</span>
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
