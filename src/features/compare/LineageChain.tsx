import type { CSSProperties } from 'react';
import { Info } from '@/components/ui/icons';
import { CHAIN_DROP_ATTR, CHAIN_LINK_ATTR, CHAIN_RUN_ATTR, useChainWalk } from '@/lib/motion/chart';
import {
  chainGeometry,
  chainPivots,
  chainWeakestLink,
  decadeTicks,
  fullName,
  scoreLabel,
  winShare,
  type Domain,
} from './model';
import type { Chain, CompareIdentity } from './types';

/**
 * **`LineageChain`** — `DESIGN_SYSTEM.md` §6.6.6.4, and the centre of this feature.
 *
 * ---
 *
 * **The problem it solves.** You cannot compare Fangio and Verstappen. No shared race, no shared
 * car, no comparable points system, and 57 years between one career ending and the other starting.
 * Every honest surface has to say so — and almost every surface then says nothing else, which is
 * why cross-era comparison is usually a table of rates and a disclaimer.
 *
 * There is one thing left that is not an opinion. **Teammates.** 3,435 of 3,627 driver-seasons
 * (94.7%) have one, across 861 drivers and every season from 1950 to 2026, and 846 of those
 * drivers sit in **one connected component** of the teammate graph. So although Fangio and
 * Verstappen never met, there is a path of real, measured, same-car head-to-heads that joins them,
 * and each step of it is evidence rather than a claim.
 *
 * **The form.** Not a node-link graph. A graph would put the drivers in arbitrary positions and
 * throw away the one dimension that makes the chain mean something: **when**. Each link is laid at
 * the seasons the two were actually teammates, on **the same 1950–2026 axis every other year-mark
 * on this page uses**, one row per link, reading downward from the present into the past. The
 * result is a staircase, and the width of each tread is a career.
 *
 * That turns three facts into geometry rather than prose:
 *
 * 1. **How far apart the two really are** is the horizontal distance the staircase travels.
 * 2. **Who did the connecting** is visible as the long treads — Barrichello, Trintignant, Brabham,
 *    the drivers whose careers bridged eras.
 * 3. **Where the chain is weak** is visible as a gap: the dashed run between two capsules is the
 *    years the pivot driver raced with neither of the teammates on the chain.
 *
 * **The refusal is the point.** A chain is emphatically **not** a transitive result, and the note
 * under it says so in the page's own voice rather than in a footnote. Verstappen beat Pérez and
 * Pérez beat Button; that says nothing whatever about Verstappen against Button. Each link is one
 * measured fact and the chain is only their sequence. A surface that let a reader believe otherwise
 * would be exactly the "silently indexed axis" failure §6.4a names — an incomparable comparison
 * made to look fine.
 *
 * **Its own honesty figure travels with it.** `chainWeakestLink` is printed in the header, because
 * 2,378 of the archive's 4,637 round-level teammate pairings produced **no race both drivers
 * finished** and a chain that runs through one is a chain with a hole in it. Saying that once,
 * loudly, is worth more than hiding it in sixteen tooltips.
 *
 * ---
 *
 * **What is untested here, by construction.** jsdom performs no layout, so the staircase's
 * *appearance* — whether the connectors meet the capsules, whether a one-season capsule is wide
 * enough to see, whether the readout column crowds the track at 1024px — cannot be asserted. Every
 * number that decides those positions is pure and is asserted in `model.test.ts`; the picture is
 * not, and has to be looked at.
 */

export interface LineageChainProps {
  chain: Chain;
  /** Every driver named on the chain. Missing names are a payload fault, not a render fault. */
  people: Record<string, CompareIdentity>;
  domain: Domain;
}

export function LineageChain({ chain, people, domain }: LineageChainProps) {
  const geometry = chainGeometry(chain.links, domain);
  const pivots = chainPivots(chain.links);
  const ticks = decadeTicks(domain);
  const weakest = chainWeakestLink(chain);
  /* Deps identify the chain, never a hovered row (G-29). The endpoints and the length are enough
   * to identify it: two drivers have exactly one strongest-shortest path between them. */
  const { scope } = useChainWalk<HTMLElement>([chain.a, chain.b, chain.length]);

  const name = (ref: string) => {
    const person = people[ref];
    return person === undefined ? ref : person.surname;
  };
  const long = (ref: string) => {
    const person = people[ref];
    return person === undefined ? ref : fullName(person);
  };

  return (
    <section className="chain" aria-labelledby="chain-heading" ref={scope}>
      <header className="chain-header">
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          The teammate chain
        </p>
        <h2 className="chain-heading" id="chain-heading">
          {long(chain.a)} to {long(chain.b)} in {chain.length}{' '}
          {chain.length === 1 ? 'step' : 'steps'}
        </h2>
        <p className="chain-lead">
          {long(chain.a)} and {long(chain.b)} were never teammates, so no like-for-like number
          exists for the two of them. This is the shortest path of drivers who <em>were</em> — every
          step a real head-to-head in the same car, in the seasons it happened.
        </p>
      </header>

      <ol className="chain-rows">
        {chain.links.map((link, index) => {
          const marks = geometry[index] ?? { offset: 0, length: 0, connector: null };
          const pivot = pivots[index] ?? null;
          const share = winShare(link.race, 'a');
          const rowStyle = {
            '--link-offset': `${String(marks.offset * 100)}%`,
            '--link-length': `${String(marks.length * 100)}%`,
            '--drop-x': `${String((marks.connector?.dropX ?? 0) * 100)}%`,
            '--run-start': `${String((marks.connector?.runStart ?? 0) * 100)}%`,
            '--run-length': `${String((marks.connector?.runLength ?? 0) * 100)}%`,
          } as CSSProperties;

          return (
            <li
              className="chain-row"
              key={`${link.from}-${link.to}-${String(link.firstYear)}`}
              style={rowStyle}
            >
              <span className="chain-years">
                {link.firstYear === link.lastYear
                  ? link.firstYear
                  : `${String(link.firstYear)}–${String(link.lastYear % 100).padStart(2, '0')}`}
              </span>

              <span className="chain-track">
                {marks.connector !== null && (
                  <>
                    <span className="chain-drop" data-motion={CHAIN_DROP_ATTR} aria-hidden="true" />
                    {marks.connector.runLength > 0 && (
                      <span className="chain-run" data-motion={CHAIN_RUN_ATTR} aria-hidden="true" />
                    )}
                  </>
                )}
                <span
                  className="chain-link"
                  data-motion={CHAIN_LINK_ATTR}
                  data-evidence={link.race.rated === 0 ? 'none' : 'measured'}
                  aria-hidden="true"
                />
              </span>

              <span className="chain-readout">
                <span className="chain-pair">
                  <span
                    className="chain-driver"
                    data-lead={share !== null && share > 0.5 ? 'true' : 'false'}
                  >
                    {name(link.from)}
                  </span>
                  <span className="chain-score">{scoreLabel(link.race)}</span>
                  <span
                    className="chain-driver"
                    data-lead={share !== null && share < 0.5 ? 'true' : 'false'}
                  >
                    {name(link.to)}
                  </span>
                </span>
                <span className="chain-where">
                  {[...new Set(link.teams.map((team) => team.teamName))].join(' · ')}
                </span>
                <span className="chain-evidence">
                  {link.race.rated === 0
                    ? `${String(link.race.pool)} races together, none both finished`
                    : `finished ahead in ${String(link.race.a)} of ${String(link.race.rated)} races both finished`}
                </span>
                {pivot !== null && <span className="chain-pivot">via {name(pivot)}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="chain-axis" aria-hidden="true">
        {ticks.map((tick) => (
          <span
            className="chain-tick"
            key={tick.year}
            style={{ '--tick-x': `${String(tick.offset * 100)}%` } as CSSProperties}
          >
            {tick.year}
          </span>
        ))}
      </div>

      <ul className="season-notes chain-notes">
        <li className="season-note">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>A chain is not a result.</strong> {name(chain.a)} beat their teammate and that
            teammate beat theirs, but the two ends of a chain never shared a car, a season or a
            rulebook. Each step is one measured fact; the chain is only their order.
          </span>
        </li>
        <li className="season-note">
          <Info size={16} aria-hidden="true" />
          <span>
            {weakest === 0
              ? 'One step on this chain has no race both drivers finished, so that link is a shared entry rather than a result.'
              : `The weakest step rests on ${String(weakest)} races both drivers finished.`}{' '}
            A step&rsquo;s bar covers only the seasons the pair actually drove together; the dashed
            run between two bars is the years the driver they share raced with neither.
          </span>
        </li>
      </ul>
    </section>
  );
}
