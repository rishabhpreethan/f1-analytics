import type { CSSProperties } from 'react';
import type { SeriesChannels } from '@/components/charts/ladder';
import { cssVar } from '@/lib/entityColor';
import { decadeTicks, yearFraction, type Domain } from './model';
import type { ArchiveSeason, CompareEntity } from './types';

/**
 * **`EraStrip`** — `DESIGN_SYSTEM.md` §6.6.6.6.
 *
 * **The job**: change over time, of the *denominator*. Every rate on this page divides by
 * opportunity, and opportunity is not a constant — rounds per season by decade run **8.4, 10.0,
 * 14.4, 15.6, 16.2, 17.4, 19.8, 21.9**. A season nearly tripled in length inside one career's
 * reach, and that single fact is why a career total cannot be compared across eras.
 *
 * Most products state that in a footnote. This one **draws it, under the careers it applies to, on
 * the same axis** — so a reader can see Fangio's eight seasons sitting over columns of seven and
 * nine races, and Hamilton's twenty over columns of twenty-two, without being told.
 *
 * **The form**: a column per season, because the buckets are discrete and time reads left to
 * right; a line would claim a continuity between two seasons' race counts that the calendar does
 * not have. Under it, one **career band** per selected entity — a bracket, not a fill, for
 * `SpanRail`'s reason (§7.12): a career has gaps, and a solid bar from first season to last would
 * state that Räikkönen raced in 2010.
 *
 * ⚠ **Not a dual-axis chart, and it must never be turned into one.** The columns carry rounds and
 * the bands carry nothing but presence — they have no measure and therefore no second scale. Adding
 * a value to the bands is the change that would make this the defect §6.2 calls the most common
 * serious one in charting.
 */

export interface EraStripProps {
  archive: ArchiveSeason[];
  entities: CompareEntity[];
  channels: SeriesChannels[];
  domain: Domain;
}

export function EraStrip({ archive, entities, channels, domain }: EraStripProps) {
  const ceiling = archive.reduce((max, season) => Math.max(max, season.rounds), 1);
  const ticks = decadeTicks(domain);

  return (
    <section className="era" aria-labelledby="era-heading">
      <header className="era-header">
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          Why a total cannot be compared
        </p>
        <h2 className="era-heading" id="era-heading">
          The season nearly tripled underneath them
        </h2>
        <p className="era-lead">
          Grands Prix per championship season, 1950 to 2026 — {archive[0]?.rounds ?? 0} in the first
          and {archive[archive.length - 1]?.rounds ?? 0} in the last. Each driver&rsquo;s seasons
          are marked underneath, on the same axis.
        </p>
      </header>

      <div className="era-plot">
        <div
          className="era-columns"
          role="img"
          aria-label={`Grands Prix per season from ${String(domain.start)} to ${String(domain.end - 1)}, rising from ${String(archive[0]?.rounds ?? 0)} to ${String(ceiling)}`}
        >
          {archive.map((season) => (
            <span
              className="era-column"
              key={season.year}
              style={
                {
                  '--column-extent': `${String((season.rounds / ceiling) * 100)}%`,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <ol className="era-bands">
          {entities.map((entity, index) => {
            const offset = yearFraction(entity.firstSeason, domain);
            const end = yearFraction(entity.lastSeason + 1, domain);
            return (
              <li
                className="era-band"
                key={entity.identity.ref}
                style={
                  {
                    '--series': cssVar(channels[index]?.plot ?? '--ramp-1-plot'),
                    '--band-offset': `${String(offset * 100)}%`,
                    '--band-length': `${String((end - offset) * 100)}%`,
                  } as CSSProperties
                }
              >
                <span className="era-band-label">
                  {entity.identity.surname}
                  <span className="era-band-detail">
                    {entity.firstSeason}–{entity.lastSeason} · {entity.seasonsEntered} seasons ·{' '}
                    {entity.totals.starts} starts
                  </span>
                </span>
                <span className="era-band-track" aria-hidden="true">
                  <span className="era-band-bracket" />
                </span>
              </li>
            );
          })}
        </ol>

        <div className="era-axis" aria-hidden="true">
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
      </div>
    </section>
  );
}
