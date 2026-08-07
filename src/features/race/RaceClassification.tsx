import type { CSSProperties } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';
import { cssVar, identityToken } from '@/lib/entityColor';
import type { ClassificationRowView } from './selectors';

/**
 * **RD-10 — the race classification, and the spine of the page.**
 *
 * §6.6.1 designs this surface bottom-up: results exist **1950+**, so this is the one part of a race
 * page with no no-coverage state, and every chart is an addition that may be absent. That ordering is
 * not stylistic — 484 races predate 1990 and **none has a single lap row**, so the reduced page is the
 * majority case across the archive. A race page that leads with four empty plots for 1988 is the
 * defect the ordering prevents.
 *
 * Specified through §6.1's six steps:
 *
 * 1. **Job**: identity, order and outcome — who finished where, and what happened to everyone else.
 * 2. **Form**: a `<table>`. It is a matrix, and a table is the only form that gives a screen-reader
 *    user row/column association for free. Same anatomy as the season hub's standings, deliberately:
 *    a reader who has learned one table in this product has learned both.
 * 3. **Marks**: a 3px identity bar on the position cell, so the team colour sits at the start of the
 *    row and immediately before the name (§3.3a.1). Never a row background.
 * 4. **Interaction**: whole-row hover raises the surface. Nothing else — every value is on the row.
 * 5. **Colour**: last, and only in the bar.
 * 6. **Accessibility**: `<caption>`, `<th scope>`, tabular mono numerals, and every outcome stated in
 *    words as well as by position.
 *
 * ---
 *
 * ## Four data facts this component is built around
 *
 * **The React key is `(driverRef, carNumber)`, never `driverRef`** — trap 17. Forty races between
 * 1950 and 1964 classify the same driver twice or three times, because two drivers shared a car and
 * both were classified: 1951 R4 lists Fangio and Fagioli both at P1 in car 8. `key={row.driverRef}`
 * renders correctly on 1,133 race pages and duplicate-keys forty of them. `selectClassificationKey`
 * exists so the key is right by construction rather than by whoever writes the `.map()` remembering a
 * fact about 1951.
 *
 * **A null position is not a DNF** — trap 3. `outcome` says what happened, decoded from `status`
 * (`DATABASE.md` §3), and `detail` is the display string. A retirement is `accident` or `mechanical`;
 * a non-starter is neither and is counted separately, because §3 requires `status IN (30, 40)` to be
 * excluded from "starts".
 *
 * **A lapped finisher shows `+1 Lap`, not a duration.** 7,450 of 7,814 lapped finishers carry no
 * total time at all, because a lapped car's result *is* a lap deficit — so `selectGapDisplay` returns
 * one of three kinds and this renders whichever it gets rather than computing a gap it cannot have.
 *
 * **A shared drive shows the winning time twice, not `+0.000`.** The leader's time comes from the
 * first P1 row that carries one, and any row at P1 shows that total rather than a gap to itself.
 */

export interface RaceClassificationProps {
  rows: readonly ClassificationRowView[];
  year: number;
  raceName: string;
  /** `notRun` — a scheduled round with no classification yet. Not a data gap. */
  notice: string | null;
  pending: boolean;
}

export function RaceClassification({
  rows,
  year,
  raceName,
  notice,
  pending,
}: RaceClassificationProps) {
  return (
    <section className="season-section" aria-labelledby="race-classification-title">
      <div>
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          The result
        </p>
        <h2 id="race-classification-title" className="t-display-sm text-ink-primary mt-3">
          Classification
        </h2>
      </div>

      <div className="season-panel">
        {pending ? (
          <ClassificationSkeleton />
        ) : notice !== null ? (
          /* A round that has not been run is not missing data (REQUIREMENTS.md §2.2). */
          <p className="t-sm text-ink-tertiary p-4">{notice}</p>
        ) : (
          <div className="standings-scroll">
            <table className="standings-table">
              <caption className="sr-only">
                {`${String(year)} ${raceName} classification — position, driver, team, result, laps and points.`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Pos</th>
                  <th scope="col">Driver</th>
                  <th scope="col" className="standings-optional">
                    Grid
                  </th>
                  <th scope="col">Result</th>
                  <th scope="col" className="standings-num standings-optional">
                    Laps
                  </th>
                  <th scope="col" className="standings-num">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((view) => (
                  <ClassificationRow key={view.key} view={view} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function ClassificationRow({ view }: { view: ClassificationRowView }) {
  const { row } = view;

  return (
    <tr
      data-outcome={row.outcome}
      style={{ '--identity': cssVar(identityToken(view.colorRef)) } as CSSProperties}
    >
      {/*
       * A `<th scope="row">`, because the position *is* the row's identity in a classification and a
       * screen reader should announce it with every value. Where there is none, the outcome says so
       * in words rather than leaving a bare dash — `position === null` is not a DNF (trap 3).
       */}
      <th scope="row" className="standings-position">
        {row.position !== null ? String(row.position).padStart(2, '0') : '—'}
      </th>

      <td>
        <span className="standings-name">
          {row.forename} {row.surname}
        </span>
        {row.code !== null && <span className="standings-code">{row.code}</span>}
        <span className="standings-team">{row.teamName}</span>
      </td>

      {/*
       * `gridStatus` is a decoded enum, not a number: a car that started from the pit lane has no
       * grid slot, and printing `0` or `—` for it would lose the distinction between "started from
       * the pits" and "we do not know".
       */}
      <td className="standings-num standings-optional">
        {row.gridStatus === 'pitLane' ? (
          <span className="season-chip">Pit lane</span>
        ) : row.gridPosition !== null ? (
          `P${String(row.gridPosition)}`
        ) : (
          '—'
        )}
      </td>

      {/*
       * One of three kinds, and never a computed gap for a lapped car. `status` is the display
       * string for a retirement — "Engine", "Collision" — which is what `detail` carries.
       */}
      <td className="race-result" data-kind={view.gap.kind}>
        {view.gap.text}
      </td>

      <td className="standings-num standings-optional">{row.lapsCompleted}</td>

      <td className="standings-num" data-zero={row.points === 0 ? 'true' : 'false'}>
        {row.points}
      </td>
    </tr>
  );
}

/**
 * Ten rows of the table's real geometry (§7.5), so the panel holds its height and nothing below it
 * moves when the query resolves. **Outside any reveal** — §4.6.1 rule 1: a loading state is never
 * animated in.
 */
function ClassificationSkeleton() {
  return (
    <div className="standings-skeleton" role="status" aria-busy="true" aria-label="Classification">
      {Array.from({ length: 10 }, (_, index) => (
        <LoadingState announce={false} className="skeleton-standings-row" key={index} />
      ))}
    </div>
  );
}
