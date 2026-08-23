import { useId, type CSSProperties, type ReactNode } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';
import { usePopulationMount } from '@/lib/motion/scroll';
import type { EraBucket, Stratum } from './strata';

/**
 * **`PopulationBoard`** — the index pages' answer to *what is this page about?*
 * `DESIGN_SYSTEM.md` §6.6.5.1.
 *
 * The season hub is good because a season has a shape and the masthead draws it — the round dial,
 * the two title cards. **A population has a shape too**, and until this component existed the three
 * index pages threw it away: 881 rows sorted by an alphabet, which is not a fact about Formula 1.
 *
 * Two marks, side by side, both **filters rather than decoration**:
 *
 * 1. **The ladder** — how the population divides. `Champions 35 · Race winners 81 · Podium
 *    finishers 103 · Grand Prix starters 571`. Bars are proportional to the count they *filter to*,
 *    so a bar's number and the list it produces can never disagree (`strata.ts`).
 * 2. **The decade columns** — how many were around, decade by decade. For drivers this is the
 *    single most surprising thing the archive knows: **313 in the 1950s, 40 in the 2020s**, an
 *    eight-fold collapse that an A–Z list makes completely invisible.
 *
 * `/circuits` replaces the second column with a map (`children`), because a venue-per-decade count
 * runs 19 → 30 and barely moves while the venues underneath change completely — and because the
 * payload publishes coordinates precisely so a circuit index can be a map.
 *
 * ---
 *
 * **Both marks are charts and are specified as charts** (§6.1). Job: magnitude, and for the decades
 * magnitude over time. Form: a horizontal ladder, because the strata are named categories of very
 * different size and a horizontal bar gives the label room to be a sentence; vertical columns for
 * the decades, because time reads left to right and the buckets are discrete — a line would claim
 * a continuity between two decades that does not exist. Marks: 8px bars with `--radius-xs`
 * data-ends, anchored at the start of their track. Interaction: the whole row or column is the hit
 * target, always larger than the mark. Colour: **monochrome** — `--accent-mark` at a stepped
 * opacity that runs *rarest = loudest*, which is the opposite of a magnitude ramp and is the point.
 *
 * **No legend and no separate table view, and that is a discharge of §6.5 rather than an
 * exemption**: every mark carries its own count as text beside it, which is what a table would have
 * added. Thirteen marks, thirteen printed numbers.
 *
 * ---
 *
 * **`aria-pressed`, not `aria-selected` and not a radio group.** Each bar is an independent toggle:
 * a reader can hold *Champions* and *the 1970s* at once, and either can be released without the
 * other moving. That is a set of toggle buttons, and the platform has a role for it.
 */

export interface PopulationBoardProps {
  strata: readonly Stratum[];
  eras: readonly EraBucket[];
  strataHeading: string;
  strataCaption: string;
  eraHeading: string;
  eraCaption: string;
  /** The plural noun, for the marks' accessible names. `drivers`. */
  noun: string;
  /** The selected stratum key, or null. */
  activeTier: string | null;
  /** The selected decade's first year, or null. */
  activeDecade: number | null;
  onTierChange: (key: string | null) => void;
  onDecadeChange: (decade: number | null) => void;
  pending: boolean;
  /**
   * Replaces the decade chart in the board's second column. Only `/circuits` supplies one — see
   * `EntityIndex`'s `boardAside`.
   */
  children?: ReactNode;
}

export function PopulationBoard({
  strata,
  eras,
  strataHeading,
  strataCaption,
  eraHeading,
  eraCaption,
  noun,
  activeTier,
  activeDecade,
  onTierChange,
  onDecadeChange,
  pending,
  children = null,
}: PopulationBoardProps) {
  const headingId = useId();
  /*
   * Keyed on the two lengths rather than on the selection: the bars grow **once**, when the payload
   * arrives. Re-running the growth every time a reader clicks a bar would re-animate a chart while
   * it is being read, which is §4.6.1's rule and the defect G-29 exists to name.
   */
  const { scope } = usePopulationMount<HTMLDivElement>([strata.length, eras.length, pending]);

  return (
    <section className="pop-board" aria-labelledby={headingId}>
      <h2 className="sr-only" id={headingId}>
        {`What the record holds — ${noun} by group`}
      </h2>

      <div className="pop-grid" ref={scope}>
        <div className="pop-col">
          <p className="season-eyebrow">
            <span className="accent-rule" aria-hidden="true" />
            {strataHeading}
          </p>

          {pending ? (
            <TierSkeleton />
          ) : (
            <div className="tier-ladder" role="group" aria-label={strataHeading}>
              {strata.map((stratum) => (
                <button
                  key={stratum.key}
                  type="button"
                  className="tier-row"
                  aria-pressed={stratum.key === activeTier}
                  aria-label={`${stratum.label}: ${String(stratum.count)} ${noun} — ${stratum.sublabel}`}
                  disabled={stratum.count === 0}
                  onClick={() => {
                    onTierChange(stratum.key === activeTier ? null : stratum.key);
                  }}
                  style={
                    {
                      '--tier-extent': `${String(stratum.extent * 100)}%`,
                      '--tier-emphasis': stratum.emphasis,
                    } as CSSProperties
                  }
                >
                  <span className="tier-label" aria-hidden="true">
                    {stratum.label}
                  </span>
                  <span className="tier-count t-mono" aria-hidden="true">
                    {stratum.count}
                  </span>
                  <span className="tier-track" aria-hidden="true">
                    <span className="tier-bar" data-motion="tier-bar" />
                  </span>
                  <span className="tier-sub" aria-hidden="true">
                    {stratum.sublabel}
                  </span>
                </button>
              ))}
            </div>
          )}

          <p className="pop-caption">{pending ? ' ' : strataCaption}</p>
        </div>

        {children === null ? (
          <div className="pop-col">
            <p className="season-eyebrow">
              <span className="accent-rule" aria-hidden="true" />
              {eraHeading}
            </p>

            {pending ? (
              <EraSkeleton />
            ) : (
              <EraBars
                eras={eras}
                heading={eraHeading}
                noun={noun}
                activeDecade={activeDecade}
                onDecadeChange={onDecadeChange}
              />
            )}

            <p className="pop-caption">
              {pending ? ' ' : eraCaption}
              {!pending && eras.some((era) => era.partial) && (
                <>
                  {' '}
                  {/*
                   * Stated rather than left to be misread: the last column is short because the
                   * decade is not over, not because the sport shrank again this year. It is the
                   * same duty §6.6.4.3 discharges for a zero — a number whose meaning depends on a
                   * boundary has to carry the boundary.
                   */}
                  <span className="pop-caption-note">
                    The last column covers a decade the record has not finished.
                  </span>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="pop-col">{children}</div>
        )}
      </div>
    </section>
  );
}

function EraBars({
  eras,
  heading,
  noun,
  activeDecade,
  onDecadeChange,
}: {
  eras: readonly EraBucket[];
  heading: string;
  noun: string;
  activeDecade: number | null;
  onDecadeChange: (decade: number | null) => void;
}) {
  return (
    <div className="era-bars" role="group" aria-label={heading}>
      {eras.map((era) => (
        <button
          key={era.decade}
          type="button"
          className="era-col"
          aria-pressed={era.decade === activeDecade}
          aria-label={`${era.longLabel}: ${String(era.count)} ${noun}${era.partial ? ', a decade the record has not finished' : ''}`}
          data-partial={era.partial ? 'true' : 'false'}
          onClick={() => {
            onDecadeChange(era.decade === activeDecade ? null : era.decade);
          }}
          style={{ '--era-extent': `${String(era.extent * 100)}%` } as CSSProperties}
        >
          <span className="era-value t-mono" aria-hidden="true">
            {era.count}
          </span>
          <span className="era-track" aria-hidden="true">
            <span className="era-bar" data-motion="era-bar" />
          </span>
          <span className="era-label" aria-hidden="true">
            {era.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Five rows of the real geometry (§7.5), so the board holds its height and the console below it
 * does not move when the payload resolves. **Not animated in** (§4.6.1 rule 1).
 */
function TierSkeleton() {
  return (
    <div className="tier-ladder" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 5 }, (_, row) => (
        <div className="tier-row" key={row} data-skeleton="true">
          <LoadingState announce={false} className="skeleton-tier-label" />
          <LoadingState announce={false} className="skeleton-tier-count" />
          <span className="tier-track" />
          <LoadingState announce={false} className="skeleton-tier-sub" />
        </div>
      ))}
    </div>
  );
}

function EraSkeleton() {
  return (
    <div className="era-bars" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 8 }, (_, column) => (
        <div className="era-col" key={column} data-skeleton="true">
          <span className="era-value" />
          <span className="era-track" />
          <span className="era-label" />
        </div>
      ))}
    </div>
  );
}
