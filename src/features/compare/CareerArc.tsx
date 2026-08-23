import { RankChart } from '@/components/charts';
import { careerArc } from './model';
import type { CompareEntity } from './types';

/**
 * **`CareerArc` — every career on one axis, because the axis is each career.**
 * `DESIGN_SYSTEM.md` §6.6.6.14 B.
 *
 * x is the **season of a career**: 1 is the debut season, whenever it happened. Fangio's first is
 * 1950 and Verstappen's is 2015, and they sit in the same column. That substitution is the whole
 * chart, and it is the only normalisation on this page that costs the reader nothing to
 * understand — no index, no rate, no denominator, just a different thing on the bottom.
 *
 * *Job*: change over time. *Form*: `RankChart`, §6.5.4a's one permitted many-series line, because
 * the measure is a **placing** — inverted, P1 at the top, labels at both ends. *Marks*: §6.3's 2px
 * line, no markers at this density. *Interaction*: one crosshair, one tooltip, every series.
 * *Colour*: last, per §6.4a. *Accessibility*: both-end direct labels, a table view, and the axis
 * itself states each rank.
 *
 * ---
 *
 * **Why championship position and not a count.** A win count per season is a season-length measure
 * before it is a driver measure — 8.4 rounds in the 1950s against 21.9 in the 2020s — and a rate
 * per season is too noisy over an eight-round year to draw as a line. A placing is the one figure
 * that means roughly the same thing in every season: first is champion.
 *
 * **Roughly, and the caption says so.** A championship has ranked between **16 and 29 drivers**
 * depending on the year (queried across all 77 seasons; 1965, 1996 and 2000 rank 16, 1989 ranks
 * 29), so a fifth place is not a fixed fraction of the field. That is an honesty caption and it
 * stays; it does not explain the chart, it limits it.
 *
 * **A gap in a line has two causes and the chart cannot tell them apart**, so the notes do, per
 * driver, with the years in them: a season he did not race, and a season he raced without being
 * ranked. Drawing them the same and explaining neither is how a reader concludes the data is
 * broken.
 *
 * ⚠ **Untested by construction**: whether four arcs of very different lengths read as four arcs,
 * whether the both-end labels collide when two careers end at the same placing, and where the
 * axis's deepest tick lands. jsdom performs no layout.
 */

export interface CareerArcProps {
  entities: CompareEntity[];
}

const yearList = (years: readonly number[]) =>
  years.length === 1
    ? String(years[0])
    : `${years.slice(0, -1).map(String).join(', ')} and ${String(years.at(-1))}`;

export function CareerArc({ entities }: CareerArcProps) {
  const { series, absences, unranked } = careerArc(entities);

  const notes = [
    ...absences.map((gap) => (
      <span key={`absent-${gap.ref}`}>
        <strong>
          {gap.surname} did not race in {yearList(gap.years)}.
        </strong>{' '}
        The line breaks there rather than dropping to the bottom of the axis, which would say he
        finished last in a championship he was not in.
      </span>
    )),
    ...unranked.map((gap) => (
      <span key={`unranked-${gap.ref}`}>
        <strong>
          {gap.surname} raced in {yearList(gap.years)} without being ranked in the championship.
        </strong>{' '}
        That is a different fact from not racing at all, and the chart draws them the same way — a
        break in the line — so it is worth saying which one this is.
      </span>
    )),
  ];

  return (
    <RankChart
      ariaLabel="Championship position by season of each driver's own career"
      caption={
        <>
          The bottom axis is <strong>each driver&rsquo;s own career</strong>, not the calendar:
          season 1 is his debut season, whenever it happened. Nothing is indexed, scaled or adjusted
          to make these lines share a chart — the axis is the whole of it. A championship has ranked
          between 16 and 29 drivers depending on the year, so a placing is not a fixed fraction of
          the field.
        </>
      }
      formatX={(x) => String(x)}
      formatXLong={(x) => (x === 1 ? 'Debut season' : `Season ${String(x)} of a career`)}
      notes={notes}
      selected={series.map((entry) => entry.reference)}
      series={series}
      state={series.length === 0 ? 'empty' : 'ready'}
      stateCopy={{
        title: 'No season-by-season record yet',
        body: 'Nobody in the tray has a season in the payload, so there is nothing to trace. Add a driver who raced.',
      }}
      subtitle="Championship placing at the end of each season — P1 is the title"
      title="Season by season of a career"
      xTitle="Season of a career"
    />
  );
}
