import { useId, useMemo, useState, type ReactNode } from 'react';
import { assignLadder, COMPARISON_CAP } from '@/components/charts/ladder';
import { assignEntityColours } from '@/lib/entityColor';
import { BalanceBar } from './CompareLedger';
import { CareerArc } from './CareerArc';
import { CompareTray, type TrayBay } from './CompareTray';
import { EraStrip } from './EraStrip';
import { LineageChain } from './LineageChain';
import { RateRailBoard } from './RateRailBoard';
import { PlacesGained } from './PlacesGained';
import { RelationBand } from './RelationBand';
import { ResultMix } from './ResultMix';
import { SeasonLens } from './SeasonLens';
import { archiveDomain, chainFor, orientChain, orientLedger, pairFor, type Domain } from './model';
import type { CompareCandidate, CompareData, CompareSeasonLens, CompareIdentity } from './types';

/**
 * **`/compare` — the comparison workspace.** `DESIGN_SYSTEM.md` §6.6.6.
 *
 * A pure function of `CompareData` with local selection state and no fetching, so it renders
 * against a fixture with no network and no router — the same boundary `DriverIndexPage` holds.
 *
 * ---
 *
 * **The spine: one time axis, top to bottom.** Every year-bearing mark on the page — the chain's
 * capsules, the era strip's columns, each career band — is plotted against **the same 1950–2026
 * domain**, left-aligned to the same edge. A reader can drop their eye from a 1957 pairing on the
 * chain to the 1957 column in the era strip and it is the same 1957. That one decision is what
 * makes this a single instrument rather than a stack of panels, and it is the device `SpanRail`
 * already uses to turn 881 rows into one history (§7.12).
 *
 * **The order of the page is an argument, not a layout.**
 *
 * 1. **Who** — the tray, four bays, the cap drawn rather than implied.
 * 2. **What kind of comparison this is** — the verdict, computed and stated before any number.
 * 3. **The evidence, when it exists** — the same-car ledgers. Present only for a pair who shared a
 *    car; a pair who did not never sees an empty one.
 * 4. **The evidence, when it does not** — the chain. Present only for a pair who did not.
 * 5. **What can still be said** — the rates, every one normalised against opportunity.
 * 6. **Why that normalisation is necessary** — the era strip, which draws the denominator changing.
 *
 * Steps 3 and 4 are mutually exclusive **by construction**, which is the point: the page cannot
 * show a direct head-to-head for two drivers who never shared a car, because there is no branch in
 * which it does.
 */

/** Which question the page is answering. §6.6.6.10. */
export type Lens = 'career' | 'season';

export interface ComparePageProps {
  data: CompareData;
  /**
   * Every driver the reader may add — the picker's directory (§7.16).
   *
   * `CompareCandidate` is a superset of `CompareIdentity` with every extra field optional, so a
   * caller that has only identities is still a valid caller and the picker degrades to names.
   */
  available?: readonly CompareCandidate[];
  /**
   * Round-by-round data for the season lens, **every season the selection entered, in one
   * response**.
   *
   * Separate from `data` because it is a separate request — but not a per-year one. This surface
   * originally assumed the year rail would fetch; the engineer overruled it, correctly, because the
   * chosen year is local state this page never publishes, so a per-year endpoint could not be told
   * which year to ask for. Sending them all costs nothing and puts no network on the rail at all.
   */
  seasons?: readonly CompareSeasonLens[];
  /**
   * The selection, and how to change it. **Supply both to make the page controlled**; supply
   * neither and it keeps its own.
   *
   * ⚠ **This is the pair that makes the picker work.** Without it `selected` was local state with
   * no way out, so a driver added from the tray became a *pending* bay that never resolved: the
   * route could not lift the choice into `?e=`, so nothing refetched and the record never arrived.
   * `ARCHITECTURE.md` §5 makes the query string the whole of comparison state, and a page that
   * owns a private copy of it is a page that cannot be linked to.
   *
   * The uncontrolled fallback is not a convenience — it is what lets `ComparePage` stay a pure
   * function of a payload in tests, with no router and no network.
   */
  selected?: readonly string[];
  onSelect?: (refs: string[]) => void;
  /**
   * A card the route needs to show **about** this comparison — today, only the notice that part of
   * a hand-edited link could not be read.
   *
   * It is a slot rather than the route's own sibling because the route rendered it **above**
   * `ComparePage`, and `ComparePage` carries the page's `h1`. That put an `h2` before the `h1` and
   * left the document outline out of order. Rendered here it lands under the masthead, which is
   * also where it reads best: the sentence is about the comparison below it.
   */
  notice?: ReactNode;
}

export function ComparePage({
  data,
  available = [],
  seasons = [],
  selected: controlled,
  onSelect,
  notice,
}: ComparePageProps) {
  const allRefs = data.entities.map((entity) => entity.identity.ref);
  const [own, setOwn] = useState<string[]>(allRefs);

  /*
   * Controlled when the caller supplies both halves. `onSelect` alone would leave the page unable
   * to reflect its own change, and `selected` alone would leave it unable to make one — so the
   * pair is checked together rather than independently, and a caller that passes one gets the
   * uncontrolled page rather than a half-broken one.
   */
  const isControlled = controlled !== undefined && onSelect !== undefined;
  /* `readonly` and never copied: a fresh array on every render would invalidate the three `useMemo`
   * hooks below it on every render, which is the whole reason they are memoised. */
  const selected: readonly string[] = isControlled ? controlled : own;
  const setSelected = (next: (current: readonly string[]) => string[]) => {
    if (isControlled) onSelect(next(controlled));
    else setOwn((current) => next(current));
  };

  const [focus, setFocus] = useState<[string, string] | null>(null);
  const [lens, setLens] = useState<Lens>('career');
  const [year, setYear] = useState<number | null>(null);
  const lensName = useId();

  const entities = useMemo(
    () => selected.flatMap((ref) => data.entities.filter((entity) => entity.identity.ref === ref)),
    [data.entities, selected],
  );

  /**
   * The tray's four bays, in the order the reader added them.
   *
   * A ref the reader has chosen whose record has not arrived is a **pending** bay, drawn from the
   * directory. That is the genuine loading state — and while `GET /api/compare` is being built it
   * is also every driver outside the fixture's four, which is exactly the state the endpoint will
   * put a bay into for a moment anyway.
   */
  const bays: TrayBay[] = useMemo(
    () =>
      selected.flatMap<TrayBay>((ref) => {
        const entity = data.entities.find((candidate) => candidate.identity.ref === ref);
        if (entity !== undefined) return [{ kind: 'ready', entity }];
        const candidate = available.find((person) => person.ref === ref);
        return candidate === undefined ? [] : [{ kind: 'pending', candidate }];
      }),
    [available, data.entities, selected],
  );

  const candidates = useMemo(
    () => available.filter((candidate) => !selected.includes(candidate.ref)),
    [available, selected],
  );

  /**
   * The season rail's domain: **every season the selection entered *that the lens has data for***.
   *
   * Not simply every season anyone raced. `GET /api/compare/seasons` publishes the whole set in one
   * response — the engineer's ruling, and a better one than this surface's original assumption that
   * a year would be fetched on demand: the chosen year is local state the page never publishes, so
   * a per-year endpoint could not have been told which year to ask for, and sending them all costs
   * nothing and puts **no network on the year rail at all**. So a rail built from the payload has no
   * dead ends in it, which a rail built from the careers would have had one of for every year the
   * response happened not to carry.
   *
   * The fallback to the careers exists for the caller that passes no seasons at all; that caller
   * gets the loading state, which is correct rather than empty.
   */
  const years = useMemo(() => {
    const entered = new Set<number>();
    for (const entity of entities) for (const season of entity.seasons) entered.add(season.year);
    if (seasons.length === 0) return [...entered].sort((a, b) => a - b);
    return seasons
      .map((entry) => entry.year)
      .filter((candidate) => entered.has(candidate))
      .sort((a, b) => a - b);
  }, [entities, seasons]);

  /* The most recent season on the rail, so the lens opens on something worth looking at. */
  const activeYear = year !== null && years.includes(year) ? year : (years.at(-1) ?? 0);
  const activeLens = seasons.find((entry) => entry.year === activeYear) ?? null;

  /*
   * Colour and the ladder are decided for the **whole selection at once**, because the teammate
   * case cannot be decided one entity at a time — a shade pair only exists relative to its other
   * member (§6.4a). `assignEntityColours` is also where §6.2's one permitted repaint lives: adding
   * or removing a teammate re-shades that team's pair, and nothing else in a selection change
   * repaints anything.
   */
  const ladder = useMemo(
    () =>
      assignLadder(
        assignEntityColours(
          entities.map((entity) => ({
            reference: entity.identity.ref,
            teamReference: entity.colorTeamRef,
          })),
        ),
      ),
    [entities],
  );

  const domain: Domain = useMemo(() => archiveDomain(data.archive), [data.archive]);

  /** Every identity the page can name: the chain's cast, plus the selection itself. */
  const people: Record<string, CompareIdentity> = useMemo(
    () => ({
      ...data.people,
      ...Object.fromEntries(data.entities.map((entity) => [entity.identity.ref, entity.identity])),
      ...Object.fromEntries(available.map((candidate) => [candidate.ref, candidate])),
    }),
    [available, data.entities, data.people],
  );

  const firstEntity = entities[0];
  const secondEntity = entities[1];
  const defaultFocus: [string, string] | null =
    firstEntity !== undefined && secondEntity !== undefined
      ? [firstEntity.identity.ref, secondEntity.identity.ref]
      : null;
  const active =
    focus !== null && selected.includes(focus[0]) && selected.includes(focus[1])
      ? focus
      : defaultFocus;

  const pair = active === null ? null : pairFor(data.pairs, active[0], active[1]);
  const chain = active === null ? null : chainFor(data.chains, active[0], active[1]);
  const oriented = pair === null || active === null ? null : orientLedger(pair, active[0]);

  /**
   * A ledger side's four channels, resolved from the stable entity order. The fallback is
   * unreachable — `sideFor` is only called with a ref that is in `entities` — and exists because a
   * thrown error inside a render is a worse failure mode than a mark painted from ramp slot 1.
   */
  const sideFor = (ref: string) => {
    const index = entities.findIndex((entity) => entity.identity.ref === ref);
    const channel = ladder.series[index];
    const entity = entities[index];
    if (channel === undefined || entity === undefined) {
      return {
        label: ref,
        token: '--ramp-1-plot',
        marker: 'circle' as const,
        dash: 'solid' as const,
      };
    }
    return {
      label: entity.identity.surname,
      token: channel.plot,
      marker: channel.marker,
      dash: channel.dash,
    };
  };

  return (
    <div className="compare">
      <header className="compare-masthead">
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          Comparison workspace
        </p>
        <h1 className="compare-title">Compare</h1>
        <p className="compare-lead">
          Two drivers who shared a car can be compared directly. Two who never did cannot — and this
          page will not pretend otherwise. What it does instead is show you exactly what the record
          can support, and how the two are actually connected.
        </p>
      </header>

      {notice}

      <CompareTray
        bays={bays}
        candidates={candidates}
        channels={ladder.series}
        onAdd={(ref) => {
          setSelected((current) =>
            current.includes(ref) || current.length >= COMPARISON_CAP
              ? [...current]
              : [...current, ref],
          );
        }}
        onRemove={(ref) => {
          setSelected((current) => current.filter((item) => item !== ref));
        }}
      />

      {/*
       * §6.6.6.10 — the lens switch. A real `<fieldset>` of radios, like the index console's
       * (§7.13): arrow-key roving, `:checked` and the group's accessible name all come from the
       * platform. It sits under the tray because the tray answers "who", and the lens answers
       * "which question about them" — the selection survives the switch, which is the point of it
       * not being a second route.
       */}
      {entities.length >= 1 && (
        <fieldset className="lens-switch">
          <legend className="lens-switch-legend">What would you like to compare?</legend>
          {(
            [
              ['career', 'Whole careers', 'Every season, normalised against opportunity'],
              ['season', 'One season', 'Round by round, and the only place points are comparable'],
            ] as const
          ).map(([id, label, hint]) => (
            <label className="lens-switch-option" key={id}>
              <input
                type="radio"
                name={lensName}
                value={id}
                checked={lens === id}
                onChange={() => {
                  setLens(id);
                }}
              />
              <span className="lens-switch-label">{label}</span>
              <span className="lens-switch-hint">{hint}</span>
            </label>
          ))}
        </fieldset>
      )}

      {lens === 'season' && (
        <SeasonLens
          lens={activeLens}
          onYear={setYear}
          people={people}
          principals={entities.map((entity) => entity.identity.ref)}
          year={activeYear}
          years={years}
        />
      )}

      {lens === 'career' && entities.length < 2 ? (
        <section className="compare-empty">
          <p className="compare-empty-title">Choose a second driver.</p>
          <p className="compare-empty-copy">
            A comparison needs two. Add up to four — the ceiling is the palette&rsquo;s, not an
            arbitrary limit: past four entities the colours available cannot be told apart by every
            reader, so the fourth bay is the last one.
          </p>
        </section>
      ) : (
        lens === 'career' && (
          <>
            <RelationBand
              chains={data.chains}
              channels={ladder.series}
              entities={entities}
              focus={active ?? [firstEntity?.identity.ref ?? '', secondEntity?.identity.ref ?? '']}
              onFocus={setFocus}
              pairs={data.pairs}
            />

            {pair !== null && oriented !== null && active !== null && pair.sameTeamRaces > 0 && (
              <section className="ledgers" aria-label="Same-car head to head">
                <BalanceBar
                  a={sideFor(active[0])}
                  b={sideFor(active[1])}
                  caption={`of ${String(pair.sameTeamRaces)} races as teammates, both classified in ${String(oriented.race.rated)}`}
                  emptyCopy="They shared a car, but no race in which both were classified — so there is no result to report."
                  ledger={oriented.race}
                  title="Finished ahead, in the same car"
                />
                <BalanceBar
                  a={sideFor(active[0])}
                  b={sideFor(active[1])}
                  caption={`of ${String(pair.sameTeamRaces)} races as teammates, both on the grid in ${String(oriented.grid.rated)}`}
                  emptyCopy="No race as teammates has a starting slot recorded for both."
                  ledger={oriented.grid}
                  title="Started ahead, in the same car"
                />
              </section>
            )}

            {pair !== null &&
              oriented !== null &&
              active !== null &&
              pair.sameTeamRaces === 0 &&
              pair.sharedRaces > 0 && (
                <section className="ledgers" aria-label="Shared-race head to head">
                  <BalanceBar
                    a={sideFor(active[0])}
                    b={sideFor(active[1])}
                    caption={`of ${String(pair.sharedRaces)} shared races, both classified in ${String(oriented.race.rated)} — in different cars every time`}
                    emptyCopy="They shared a grid but never a race both finished."
                    ledger={oriented.race}
                    title="Finished ahead, in different cars"
                  />
                  <BalanceBar
                    a={sideFor(active[0])}
                    b={sideFor(active[1])}
                    caption={`of ${String(pair.sharedRaces)} shared races, both on the grid in ${String(oriented.grid.rated)} — in different cars every time`}
                    emptyCopy="No shared race has a starting slot recorded for both."
                    ledger={oriented.grid}
                    title="Started ahead, in different cars"
                  />
                </section>
              )}

            {chain !== null && active !== null && (
              <LineageChain chain={orientChain(chain, active[0])} domain={domain} people={people} />
            )}

            {/*
             * **The two readable pictures come before the five rates.** §6.6.6.14: the mix and the
             * arc are the instruments a reader needs nothing explained to understand, and the rate
             * board is a table of rates with a denominator under each. Picture, then figures, then
             * the era strip that says why the figures had to be rates at all.
             */}
            <ResultMix entities={entities} />

            <CareerArc entities={entities} />

            <PlacesGained channels={ladder.series} entities={entities} />

            <RateRailBoard channels={ladder.series} entities={entities} />

            <EraStrip
              archive={data.archive}
              channels={ladder.series}
              domain={domain}
              entities={entities}
            />
          </>
        )
      )}
    </div>
  );
}
