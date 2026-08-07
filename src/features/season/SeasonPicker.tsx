import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronLeft, ChevronRight } from '@/components/ui/icons';
import { usePressMotion } from '@/lib/motion/interactions';
import { popoverEnter, popoverExit } from '@/lib/motion/surfaces';
import { useDisclosure } from '@/lib/motion/useDisclosure';
import { adjacentSeasons, decadeGroups } from './presenters';

/**
 * **The season year, which is also the navigation.**
 *
 * The year is the largest thing on the page, so making it the picker's trigger costs no space and
 * puts the control exactly where the eye already is. The alternative — a `<select>` beside a static
 * heading — is the default option and reads as a form on a page that is not one.
 *
 * **77 years is too many for a list and exactly right for a grid.** They are grouped by decade,
 * newest first, ten to a row on desktop: the shape of the grid is itself the shape of the sport's
 * history, and a reader looking for 1976 finds the 1970s row rather than scrolling a column of 77.
 *
 * Two arrows flank it for the common move, which is one season at a time. **They step to seasons
 * that exist**, derived from the season list rather than `year ± 1`, so an arrow is never a link
 * to a 404 and the two ends of the range disable instead of dead-ending.
 *
 * **It does not fetch.** `SeasonHub` owns the queries and passes the year list down
 * (`ARCHITECTURE.md` §3).
 */

export interface SeasonPickerProps {
  /**
   * `null` while a bare `/seasons` is still resolving its default year from `/api/meta` — the one
   * moment this surface genuinely does not know which season it is. It renders the noun and a
   * skeleton rather than a guess, because a year that flickered from a placeholder to the real one
   * would be the page telling the reader something untrue for two frames.
   */
  year: number | null;
  /** Every season in the data, in any order. Empty while `/api/seasons` is in flight. */
  years: readonly number[];
  /** The `h1`'s id, so the surface's `aria-labelledby` can point at it. */
  headingId: string;
}

const PANEL_ID = 'season-picker-panel';

export function SeasonPicker({ year, years, headingId }: SeasonPickerProps) {
  const {
    scope: panelScope,
    mounted,
    isOpen,
    open,
    close: closePanel,
  } = useDisclosure<HTMLDivElement>({ enter: popoverEnter, exit: popoverExit });

  const { scope: triggerRef, press } = usePressMotion<HTMLButtonElement>();
  const containerRef = useRef<HTMLDivElement>(null);

  const { previous, next } =
    year === null ? { previous: null, next: null } : adjacentSeasons(years, year);
  const groups = decadeGroups(years);

  // Outside click dismisses (§8). Registered only while open, so there is no document listener in
  // the ordinary case.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target) === true) return;
      closePanel();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen, closePanel]);

  /** Focus returns synchronously; only the panel's pixels wait for the exit tween. */
  function close() {
    closePanel();
    triggerRef.current?.focus();
  }

  /*
   * The resolving state. **"Season" and a skeleton, never a placeholder year.** A year that
   * changed from a guess to the real one after a frame would be the page stating something false
   * and then correcting it, which is worse than saying nothing for 80ms. The noun keeps the `h1`
   * that contains this with a stable accessible name in both states.
   */
  if (year === null) {
    return (
      <div className="season-picker season-year-group">
        <h1 id={headingId} className="season-year" aria-busy="true">
          Season
          <span className="skeleton skeleton-season-year" aria-hidden="true" />
        </h1>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="season-picker season-year-group"
      // Esc is handled on the container, not the panel: focus is on the trigger while the panel
      // is open, and a handler on the panel would never see the key (§8).
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !isOpen) return;
        event.preventDefault();
        close();
      }}
    >
      <StepLink
        to={previous}
        label={previous === null ? 'No earlier season' : `Go to the ${String(previous)} season`}
      >
        <ChevronLeft size={16} />
      </StepLink>

      {/*
       * **The `h1` wraps the trigger and nothing else**, and the arrows and the panel are its
       * siblings. Two reasons, and the second is the one that bites:
       *
       *   1. `<h1>` takes phrasing content. A `<button>` is phrasing; the panel's `<div>`s and
       *      `<p>`s are not, so a heading wrapped around the whole group is invalid HTML.
       *   2. A heading's accessible name is built from its descendants, so a heading containing
       *      the arrows would be named `"Go to the 2023 season 2024 season Go to the 2025 season"`.
       *      Scoped to the trigger it is exactly `"2024 season"`.
       */}
      <h1 id={headingId}>
        <button
          ref={triggerRef}
          type="button"
          className="season-year"
          aria-expanded={isOpen}
          /*
           * A disclosure, not a menu. ARIA 1.2 requires `aria-haspopup`'s value to match the popup
           * container's role and defines `"true"` as equivalent to `"menu"`; this panel is a grid
           * of links, so `aria-expanded` + `aria-controls` is the correct pairing — the same
           * reading `DataVintage` settled on.
           *
           * **Named from its content, not by an `aria-label`.** The label would replace the
           * heading's name with a sentence, and "2024 season, button, collapsed" is what a
           * disclosure is supposed to announce. The unit comes from a visually-hidden noun rather
           * than from a label, so the heading reads as a season and not as a bare number.
           */
          onClick={() => {
            if (isOpen) close();
            else open();
          }}
          {...press}
        >
          {year}
          <span className="sr-only"> season</span>
          <ChevronDown size={20} />
        </button>
      </h1>

      <StepLink
        to={next}
        label={next === null ? 'No later season' : `Go to the ${String(next)} season`}
      >
        <ChevronRight size={16} />
      </StepLink>

      {mounted && (
        <div ref={panelScope} id={PANEL_ID} className="season-picker-panel">
          {groups.map((group) => (
            <div className="season-decade" key={group.decade}>
              <p className="season-eyebrow">{group.label}</p>
              <div className="season-decade-years">
                {group.years.map((candidate) => (
                  <Link
                    key={candidate}
                    to={`/seasons/${String(candidate)}`}
                    className="season-decade-year"
                    aria-current={candidate === year ? 'page' : undefined}
                    onClick={close}
                  >
                    {candidate}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The step arrow. A `<span>` when there is nowhere to go, never a `<Link>` to `null` and never a
 * disabled anchor — a disabled link is not a thing the platform has, and an anchor with no `href`
 * is unreachable by keyboard while still looking like a control.
 */
function StepLink({
  to,
  label,
  children,
}: {
  to: number | null;
  label: string;
  children: React.ReactNode;
}) {
  if (to === null) {
    return (
      <span className="season-step" aria-hidden="true" data-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link to={`/seasons/${String(to)}`} className="season-step" aria-label={label}>
      {children}
    </Link>
  );
}
