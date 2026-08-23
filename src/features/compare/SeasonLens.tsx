import { useId } from 'react';
import { LineChart, type SeriesInput } from '@/components/charts';
import type { CompareIdentity, CompareSeasonLens } from './types';
import {
  absentFrom,
  nameFrom,
  racedRounds,
  seasonPairs,
  seatBreaks,
  seatGapSeries,
  teamChangeNote,
} from './seasonModel';

/**
 * **`SeasonLens` — one season, round by round.** `DESIGN_SYSTEM.md` §6.6.6.10.
 *
 * Rishabh's idea, and it unlocks the thing the career lens refuses. **Within one season, points
 * are legitimately comparable**: trap 4 forbids summing points *across* eras, not within a season,
 * because a season is one scoring system and one calendar. So this is the only lens in the product
 * that can honestly draw a points total — and because the career lens refuses totals loudly, this
 * one has to say out loud why the rule changed here, or a reader will assume it broke.
 *
 * ---
 *
 * ## The composition problem, and how it is solved
 *
 * Four principals, each optionally carrying **the other seat in his car**, is up to eight series.
 * They have to read as **four pairs**. Four channels do it, and none of them is a new colour:
 *
 * | | Principal | The other seat |
 * |---|---|---|
 * | Colour | the car | **the same** |
 * | Marker | the car's shape | **the same** |
 * | Dash | solid | `6 3` (§6.4a) |
 * | Stroke | 2px | 1.5px |
 * | Direct label | at the line's end | none — the legend, the tooltip and the table name it |
 *
 * ⚠ **Whether eight lines actually read as four pairs is the one thing no test here can reach.**
 * jsdom performs no layout and no compositing. The assertions below cover which series exist, what
 * role each carries and where a line breaks; they say nothing about legibility.
 *
 * ## The shadow is a seat, not a person
 *
 * Only **890 of 3,435 driver-seasons (26%) have exactly one team-mate all year**, so nominating a
 * primary team-mate would be wrong three times in four. The dashed series is *the other seat in the
 * principal's car*, carrying whoever held it at each round. Two consequences the surface draws
 * rather than hides: where the seat changed hands the line **breaks**, because joining two people's
 * cumulative totals would draw a fall in points that never happened; and where the car had no
 * single other seat there is **no line at all** — 1957's Maserati fielded between four and eleven
 * other cars at every round Fangio started, and the modern two-car team is a convention, not a law.
 */

export interface SeasonLensProps {
  lens: CompareSeasonLens | null;
  /** The refs the reader has chosen, in tray order. */
  principals: readonly string[];
  people: Record<string, CompareIdentity>;
  /** Every season any selected driver entered, ascending. */
  years: readonly number[];
  year: number;
  onYear: (year: number) => void;
}

export function SeasonLens({ lens, principals, people, years, year, onYear }: SeasonLensProps) {
  const railName = useId();
  const nameOf = (ref: string) => nameFrom(people[ref], ref);

  return (
    <section className="lens" aria-label="One season, round by round">
      <SeasonRail name={railName} onYear={onYear} year={year} years={years} />
      {lens === null ? (
        <p className="lens-pending">
          <strong>Loading {year}.</strong> Round-by-round data for this season has not arrived yet.
        </p>
      ) : (
        <SeasonPlots lens={lens} nameOf={nameOf} principals={principals} />
      )}
    </section>
  );
}

/**
 * The season chooser: **every season any selected driver entered**, on one rail.
 *
 * A real `<fieldset>` of radios, exactly as the index console's lens is (§7.13) — arrow-key roving,
 * `:checked`, the group's accessible name and form semantics all come from the platform, and the
 * alternative is thirty lines of keyboard code that has to be right. It is a rail rather than a
 * `<select>` because the set is the shape of the selection's overlap, and a closed menu hides that.
 */
function SeasonRail({
  years,
  year,
  onYear,
  name,
}: {
  years: readonly number[];
  year: number;
  onYear: (year: number) => void;
  name: string;
}) {
  return (
    <fieldset className="lens-rail">
      <legend className="sr-only">Choose a season</legend>
      <div className="lens-rail-track">
        {years.map((candidate) => (
          <label className="lens-year" key={candidate}>
            <input
              type="radio"
              name={name}
              value={candidate}
              checked={candidate === year}
              onChange={() => {
                onYear(candidate);
              }}
            />
            <span className="t-mono">{candidate}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SeasonPlots({
  lens,
  principals,
  nameOf,
}: {
  lens: CompareSeasonLens;
  principals: readonly string[];
  nameOf: (ref: string) => string;
}) {
  const rounds = lens.rounds.map((round) => round.number);
  const roundName = new Map(lens.rounds.map((round) => [round.number, round.name]));

  const pairs = seasonPairs(lens, principals, nameOf);
  /* Principal, then its own shadow, then the next pair — so the legend reads in pairs too. */
  const series: SeriesInput[] = pairs.flatMap((pair) => [pair.principal, ...pair.shadows]);
  const gaps = seatGapSeries(lens, principals, nameOf);

  const absent = absentFrom(lens, principals);
  const raced = racedRounds(lens);
  const last = rounds.at(-1) ?? 0;

  const notes: React.ReactNode[] = [];

  /*
   * **The permission note, and it is not decoration.** The career lens refuses points totals
   * because 24 scoring systems make them incomparable (trap 4). A reader who has just been told
   * that and is now shown a points chart deserves the reason the rule changed, or they will
   * reasonably conclude one of the two screens is broken.
   */
  notes.push(
    <>
      <strong>Points are comparable here.</strong> Everyone on this chart scored under one system,
      the {lens.systemName.toLowerCase()}, over one calendar — which is why this is the only place
      in the product that draws a points total. Across seasons they are not comparable and are never
      summed.
    </>,
  );

  if (lens.bestResults !== null) {
    notes.push(
      <>
        <strong>
          Only the best {lens.bestResults} results of {rounds.length} counted toward the {lens.year}{' '}
          championship.
        </strong>{' '}
        These are the standings as they actually stood, dropped scores and all — so a line can stay
        flat through a podium. Fangio finished second at Monza and his total did not move.
      </>,
    );
  }

  if (raced < last) {
    notes.push(
      <>
        <strong>
          {lens.year} is in progress: {raced} of {last} rounds have been run.
        </strong>{' '}
        The axis is the full calendar, so the empty right-hand side is the season still to come and
        not missing data.
      </>,
    );
  }

  for (const { ref, entrant } of absent) {
    notes.push(
      <>
        <strong>
          {nameOf(ref)} did not start a race in {lens.year}.
        </strong>{' '}
        {entrant === undefined
          ? 'He has no entry for this season at all.'
          : 'He is left off the plot rather than drawn as a flat zero, which would say he scored nothing when he was not there.'}
      </>,
    );
  }

  for (const ref of principals) {
    const entrant = lens.entrants.find((candidate) => candidate.ref === ref);
    if (entrant === undefined || !entrant.entered) continue;
    const change = teamChangeNote(entrant, nameOf(ref));
    if (change !== null) notes.push(<>{change}</>);

    const breaks = seatBreaks(entrant, rounds);
    if (breaks.length > 0) {
      notes.push(
        <>
          <strong>
            The other seat in {nameOf(ref)}&rsquo;s car changed hands at{' '}
            {breaks.map((round) => `R${String(round)}`).join(', ')}.
          </strong>{' '}
          The dashed line breaks there rather than joining the two totals — they belong to different
          people, and a join would draw a fall in points that never happened.
        </>,
      );
    }

    if (entrant.seat.occupant.every((who) => who === null)) {
      const most = Math.max(0, ...entrant.seat.carsBeside.map((count) => count ?? 0));
      notes.push(
        <>
          <strong>
            {nameOf(ref)}&rsquo;s car had no single team-mate in {lens.year}.
          </strong>{' '}
          His team entered as many as {most} other cars in one Grand Prix, so there is no second
          seat to draw. The two-car team is a modern convention, not a rule of the sport.
        </>,
      );
    }
  }

  const formatRound = (round: number) => `R${String(round)}`;
  const formatRoundLong = (round: number) => {
    const label = roundName.get(round);
    return label === undefined ? formatRound(round) : `R${String(round)} · ${label}`;
  };

  const nobody = series.length === 0;

  return (
    <>
      <LineChart
        ariaLabel={`Championship points after each round of ${String(lens.year)}`}
        caption={
          <>
            Cumulative championship points after each round. A solid line is a driver you chose; a
            dashed line of the same colour is <strong>the other seat in his car</strong>, which
            costs no slot and carries whoever was in it.
          </>
        }
        formatX={formatRound}
        formatXLong={formatRoundLong}
        notes={notes}
        series={series}
        state={nobody ? 'empty' : 'ready'}
        stateCopy={{
          title: 'Nobody you picked raced this season',
          body: 'Choose another season on the rail above, or add a driver who was on the grid.',
        }}
        title={`${String(lens.year)} — championship points, round by round`}
        xTitle="Round"
        yTitle="Points"
        zeroBaseline
      />

      <LineChart
        ariaLabel={`Points ahead of or behind the other seat, after each round of ${String(lens.year)}`}
        caption={
          <>
            Your driver&rsquo;s points minus the points of the other seat in the same car. Above the
            line is ahead. Same machinery, same calendar, same scoring — so this needs no
            normalisation at all, which almost nothing else in this product can say.
          </>
        }
        formatX={formatRound}
        formatXLong={formatRoundLong}
        formatY={(value) => (value > 0 ? `+${String(value)}` : String(value))}
        series={gaps}
        state={gaps.length === 0 ? 'no-coverage' : 'ready'}
        stateCopy={{
          title: 'No second seat to measure against',
          body: 'None of your drivers had a single, identifiable team-mate through this season — either the team fielded one car, or it fielded several. There is nothing to take a difference from.',
        }}
        title={`${String(lens.year)} — points against the other seat`}
        xTitle="Round"
        yTitle="Points ahead of the other seat"
        zeroBaseline
      />
    </>
  );
}
