import { useState, type CSSProperties } from 'react';
import { useRibbonMount } from '@/lib/motion/chart';
import { buildRibbon, ribbonLabelYears, type RibbonSeason } from './ribbon';

/**
 * **`CareerRibbon`** — `DESIGN_SYSTEM.md` §7.9, and the signature element of the three entity
 * pages. One cell per season from an entity's first to its last, the fill height encoding that
 * season's championship position. A forty-year career as one strip.
 *
 * It is **the same component on all three pages** with a different measure — drivers' position,
 * constructors' position, hosted-or-not — which is the coherence lever §6.6.2.0 is built on: a
 * reader who learns it on a driver's page reads a team's and a circuit's for free.
 *
 * ---
 *
 * **It is not a chart and must not grow into one.** No axis, no gridlines, no table toggle: its
 * readings are exactly the season table's rows, one section below it on every page that uses it. A
 * ribbon that acquired a measure axis would be a bar chart drawn small, and the product has one.
 *
 * **Three cell kinds, and collapsing any two is the bug this component exists to avoid.** `ranked`
 * (a position), `unranked` (contested, no position — 1950 has 59 of them) and `absent` (did not
 * contest). A zero-height fill would make `unranked` and `absent` the same mark, which is §1.0's
 * recurring failure exactly; `ribbon.ts`'s `RIBBON_FILL_FLOOR` and the separate foot rule are what
 * keep them distinct **by construction** rather than by care.
 *
 * **One tab stop, not seventy-six.** Arrow keys move the cursor cell, matching §6.5.1's plot-area
 * convention precisely — a strip of individually focusable cells is a keyboard trap in a career
 * that ran twenty years.
 */

export interface CareerRibbonProps {
  seasons: readonly RibbonSeason[];
  /** The strip's accessible name. States the measure and the span. */
  ariaLabel: string;
  /** What a ranked cell's readout calls its value: "Championship position", "Hosted". */
  measureLabel: string;
  /** Renders a position as the reader sees it. Defaults to `P{n}`. */
  formatPosition?: (position: number) => string;
  /** What an `unranked` cell says. "Raced, no championship position." */
  unrankedCopy?: string;
  /** What an `absent` cell says. "Did not race." */
  absentCopy?: string;
  pending?: boolean;
}

const defaultFormat = (position: number) => `P${String(position)}`;

export function CareerRibbon({
  seasons,
  ariaLabel,
  measureLabel,
  formatPosition = defaultFormat,
  unrankedCopy = 'Raced, no championship position',
  absentCopy = 'Did not race',
  pending = false,
}: CareerRibbonProps) {
  const cells = buildRibbon(seasons);
  const labelled = ribbonLabelYears(cells);
  const [cursor, setCursor] = useState<number | null>(null);

  /*
   * G-27 through `useRibbonMount`, keyed by a **string** built from the span and the count. A dep
   * rebuilt each render tears the timeline down and recreates it on every render — the defect
   * `geometry.mountKey` exists for, and the ribbon is more exposed to it than a chart because it
   * sets state on every pointer move across it.
   */
  const { scope } = useRibbonMount<HTMLDivElement>([
    `${String(cells[0]?.year ?? 0)}:${String(cells.at(-1)?.year ?? 0)}:${String(cells.length)}`,
  ]);

  if (pending) {
    return (
      <div className="ribbon" aria-busy="true">
        <p className="ribbon-readout" aria-hidden="true">
          &nbsp;
        </p>
        <div className="ribbon-track ribbon-track-skeleton" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <span className="ribbon-cell" key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (cells.length === 0) return null;

  const active = cursor === null ? null : (cells[cursor] ?? null);

  const move = (delta: number) => {
    setCursor((current) => {
      const next = (current ?? 0) + delta;
      return Math.min(Math.max(next, 0), cells.length - 1);
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      move(1);
    } else if (event.key === 'ArrowLeft') {
      move(-1);
    } else if (event.key === 'Home') {
      setCursor(0);
    } else if (event.key === 'End') {
      setCursor(cells.length - 1);
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <div className="ribbon">
      {/*
       * §7.9.3 — **the readout's line is reserved whether or not anything is hovered**, so nothing
       * below the strip moves as the pointer crosses it. `&nbsp;` rather than an empty string,
       * because an empty inline box collapses to zero height and reintroduces the reflow.
       */}
      <p className="ribbon-readout" aria-hidden="true">
        {active === null ? (
          <>&nbsp;</>
        ) : (
          <>
            <b className="t-mono">{active.year}</b>
            <span>
              {active.kind === 'ranked'
                ? `${measureLabel} ${formatPosition(active.position ?? 0)}`
                : active.kind === 'unranked'
                  ? unrankedCopy
                  : absentCopy}
            </span>
            {active.detail !== null && (
              <span className="ribbon-readout-detail">{active.detail}</span>
            )}
          </>
        )}
      </p>

      <div
        ref={scope}
        className="ribbon-track"
        role="application"
        tabIndex={0}
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setCursor(null);
        }}
        onPointerLeave={() => {
          setCursor(null);
        }}
      >
        {cells.map((cell, index) => (
          <span
            key={cell.year}
            className="ribbon-cell"
            data-kind={cell.kind}
            data-champion={cell.champion ? 'true' : 'false'}
            data-active={cursor === index ? 'true' : 'false'}
            style={{ '--ribbon-fill': String(cell.fill) } as CSSProperties}
            onPointerEnter={() => {
              setCursor(index);
            }}
          >
            <span className="ribbon-fill" data-motion="ribbon-cell" />
          </span>
        ))}
      </div>

      <div className="ribbon-years" aria-hidden="true">
        {cells.map((cell) => (
          <span className="ribbon-year" key={cell.year}>
            {labelled.has(cell.year) ? cell.year : ''}
          </span>
        ))}
      </div>

      {/* The keyboard reader's channel. §6.5.1's `aria-live` convention, same words as the visible
       * readout — so the two cannot describe different cells. */}
      <p aria-live="polite" className="sr-only">
        {active === null
          ? ''
          : `${String(active.year)}: ${
              active.kind === 'ranked'
                ? `${measureLabel} ${formatPosition(active.position ?? 0)}`
                : active.kind === 'unranked'
                  ? unrankedCopy
                  : absentCopy
            }`}
      </p>
    </div>
  );
}
