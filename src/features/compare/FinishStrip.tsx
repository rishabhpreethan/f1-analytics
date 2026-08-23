import type { CSSProperties } from 'react';
import { ChartFrame } from '@/components/charts';
import { cssVar, plotToken } from '@/lib/entityColor';
import { STRIP_DOT_ATTR, useStripMount } from '@/lib/motion/chart';
import { finishStrip } from './seasonModel';
import type { CompareSeasonLens } from './types';

/**
 * **`FinishStrip` — what his Sundays actually looked like.** `DESIGN_SYSTEM.md` §6.6.6.14 D.
 *
 * The points chart above answers *who was winning the championship*. This answers a different
 * question that a cumulative line cannot: **where did he actually finish, race by race** — and in
 * particular whether a season was three wins and a lot of nothing, or fifteen quiet fourths.
 *
 * *Job*: distribution over a sequence. *Form*: a dot strip, one row per driver, **not a line** —
 * a line between two race results claims that something continuous happened in between, and
 * nothing did. *Marks*: an 8px dot per classified finish, a hollow ring in the lane below the axis
 * for a start with no classification, and **nothing at all** for a round he did not start.
 * *Interaction*: each mark carries its own round, circuit and result. *Colour*: the entity's plot
 * token; the vertical position is the measure, and colour carries identity only. *Accessibility*:
 * one row per driver with the name in the gutter, the table view carrying every round, and marks
 * that never rely on colour to say what they are — a ring and a dot differ in **form**.
 *
 * ---
 *
 * ⚠ **Three states per round, not two.** `finish === null` covers two different situations in the
 * payload — he started and was not classified, and he was not there at all — and `teamAt` is what
 * separates them. Drawing both the same would put a driver who was out of the sport that weekend
 * into the retirement lane, which is a claim about him rather than about the calendar.
 *
 * **The axis never runs shallower than P10.** Four front-runners whose worst result is fourth would
 * otherwise spread P1–P4 over the full height and draw a one-place difference as the height of the
 * chart. Ten carries no claim about points — the points-paying positions have changed many times
 * and this axis is not about them.
 *
 * **Motion is G-33**: each dot `scale: 0 → 1` about its own centre, staggered left to right so the
 * season arrives in the order it was raced. Not created at all under reduced motion.
 *
 * ⚠ **Untested by construction**: every position, whether 22 dots at 8px are distinguishable on one
 * row at 390px, whether the podium rule reads as a rule rather than as a mark, and whether the
 * out-lane reads as being *below* the axis rather than as its bottom row. jsdom performs no layout.
 */

export interface FinishStripProps {
  lens: CompareSeasonLens;
  principals: readonly string[];
  nameOf: (ref: string) => string;
  /** The car each principal plots as, by ref — the same colour the lines above him take. */
  teamFor: (ref: string) => string;
}

/** Enough height for one row's axis plus the out-lane, per driver, before the token's floor. */
const ROW_HEIGHT = 76;

export function FinishStrip({ lens, principals, nameOf, teamFor }: FinishStripProps) {
  const strip = finishStrip(lens, principals, nameOf);
  const { scope } = useStripMount<HTMLDivElement>([
    lens.year,
    strip.rows.map((row) => row.ref).join(','),
  ]);

  const anyUnclassified = strip.rows.some((row) => row.unclassified > 0);
  const anyMissed = strip.rows.some((row) => row.missed > 0);

  const notes = [
    ...(anyUnclassified
      ? [
          <span key="unclassified">
            <strong>A ring below the axis is a race he started and did not finish</strong> — or
            finished too far behind to be classified. It sits under the axis rather than at the
            bottom of it, because &ldquo;no result&rdquo; is not a position and drawing it as the
            last one would say he came last.
          </span>,
        ]
      : []),
    ...(anyMissed
      ? [
          <span key="missed">
            <strong>A round with no mark at all is one he did not start.</strong>{' '}
            {strip.rows
              .filter((row) => row.missed > 0)
              .map((row) => `${row.name} missed ${String(row.missed)}`)
              .join(', ')}
            . A gap is not a retirement.
          </span>,
        ]
      : []),
  ];

  return (
    <ChartFrame
      ariaLabel={`Finishing position at each round of ${String(lens.year)}, by driver`}
      caption={
        <>
          One dot per race, highest finish at the top. The rule across each row is{' '}
          <strong>the podium</strong>. This is the same season as the chart above and a different
          question about it: not who was ahead on points, but what each Sunday actually produced.
        </>
      }
      notes={notes}
      plotHeight={Math.max(1, strip.rows.length) * ROW_HEIGHT + 24}
      state={strip.rows.length === 0 ? 'empty' : 'ready'}
      stateCopy={{
        title: 'Nobody you picked raced this season',
        body: 'Choose another season on the rail above, or add a driver who was on the grid.',
      }}
      table={
        <table className="chart-table">
          <caption>Finishing position at each round of {lens.year}</caption>
          <thead>
            <tr>
              <th scope="col">Round</th>
              {strip.rows.map((row) => (
                <th key={row.ref} scope="col" data-numeric="true">
                  {row.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lens.rounds.map((round, index) => (
              <tr key={round.number}>
                <th scope="row">
                  R{round.number} · {round.name}
                </th>
                {strip.rows.map((row) => {
                  const cell = row.cells[index];
                  return (
                    <td key={row.ref} data-numeric="true">
                      {cell === undefined || !cell.started
                        ? '—'
                        : cell.finish === null
                          ? 'NC'
                          : `P${String(cell.finish)}`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      }
      title={`${String(lens.year)} — where each race finished`}
    >
      <div className="strip" ref={scope}>
        <ol className="strip-rows">
          {strip.rows.map((row) => (
            <li
              className="strip-row"
              key={row.ref}
              style={{ '--series': cssVar(plotToken(teamFor(row.ref))) } as CSSProperties}
            >
              <p className="strip-name">{row.name}</p>
              <div className="strip-field">
                <span
                  className="strip-podium"
                  aria-hidden="true"
                  style={{ '--y': `${String(strip.podium * 100)}%` } as CSSProperties}
                />
                {row.cells.map((cell) =>
                  cell.y === null ? null : (
                    <span
                      className="strip-dot"
                      data-motion={STRIP_DOT_ATTR}
                      key={cell.round}
                      style={
                        {
                          '--x': `${String(cell.x * 100)}%`,
                          '--y': `${String(cell.y * 100)}%`,
                        } as CSSProperties
                      }
                      title={`R${String(cell.round)} ${cell.name} — finished ${String(cell.finish)}`}
                    />
                  ),
                )}
              </div>
              <div className="strip-out">
                {row.cells.map((cell) =>
                  cell.started && cell.finish === null ? (
                    <span
                      className="strip-miss"
                      data-motion={STRIP_DOT_ATTR}
                      key={cell.round}
                      style={{ '--x': `${String(cell.x * 100)}%` } as CSSProperties}
                      title={`R${String(cell.round)} ${cell.name} — no classified finish`}
                    />
                  ) : null,
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="strip-axis" aria-hidden="true">
          <span>R{strip.first}</span>
          <span className="strip-depth">
            P1 to P{strip.deepest}, top to bottom · the rule is the podium
          </span>
          <span>R{strip.last}</span>
        </p>
      </div>
    </ChartFrame>
  );
}
