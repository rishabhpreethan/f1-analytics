import { useMemo, useState } from 'react';
import { assignLadder } from '@/components/charts/ladder';
import { assignEntityColours } from '@/lib/entityColor';
import { BalanceBar } from './CompareLedger';
import { CompareTray } from './CompareTray';
import { EraStrip } from './EraStrip';
import { LineageChain } from './LineageChain';
import { RateRailBoard } from './RateRailBoard';
import { RelationBand } from './RelationBand';
import { archiveDomain, chainFor, orientChain, orientLedger, pairFor, type Domain } from './model';
import type { CompareData, CompareIdentity } from './types';

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

export interface ComparePageProps {
  data: CompareData;
  /** Refs the reader may add. In the shipped page this is the driver directory. */
  available?: CompareIdentity[];
}

export function ComparePage({ data, available = [] }: ComparePageProps) {
  const allRefs = data.entities.map((entity) => entity.identity.ref);
  const [selected, setSelected] = useState<string[]>(allRefs);
  const [focus, setFocus] = useState<[string, string] | null>(null);

  const entities = useMemo(
    () => selected.flatMap((ref) => data.entities.filter((entity) => entity.identity.ref === ref)),
    [data.entities, selected],
  );

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

      <CompareTray
        available={available.filter((candidate) => !selected.includes(candidate.ref))}
        channels={ladder.series}
        entities={entities}
        onAdd={(ref) => {
          setSelected((current) => (current.includes(ref) ? current : [...current, ref]));
        }}
        onRemove={(ref) => {
          setSelected((current) => current.filter((item) => item !== ref));
        }}
      />

      {entities.length < 2 ? (
        <section className="compare-empty">
          <p className="compare-empty-title">Choose a second driver.</p>
          <p className="compare-empty-copy">
            A comparison needs two. Add up to four — the ceiling is the palette&rsquo;s, not an
            arbitrary limit: past four entities the colours available cannot be told apart by every
            reader, so the fourth bay is the last one.
          </p>
        </section>
      ) : (
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
            <LineageChain
              chain={orientChain(chain, active[0])}
              domain={domain}
              people={{
                ...data.people,
                ...Object.fromEntries(
                  data.entities.map((entity) => [entity.identity.ref, entity.identity]),
                ),
              }}
            />
          )}

          <RateRailBoard channels={ladder.series} entities={entities} />

          <EraStrip
            archive={data.archive}
            channels={ladder.series}
            domain={domain}
            entities={entities}
          />
        </>
      )}
    </div>
  );
}
