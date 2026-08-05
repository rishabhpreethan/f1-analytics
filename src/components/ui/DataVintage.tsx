import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { CoverageDetail, DataVintage as DataVintageValue } from '@/features/meta/selectors';
import { LoadingState } from '@/components/ui/LoadingState';
import { control, crossfade, popover } from '@/lib/motion';

/**
 * The data-currency indicator, NV-9 (Design Spec §5.1, `DESIGN_SYSTEM.md` §7.3).
 *
 * **Currency is expressed as coverage, never as a fetch event.** "Complete results through
 * Round 10 of 22" is a fact about the sport's calendar and is verifiable from the data
 * itself. "Updated 12 days ago" would be a fact about a process, and it is also the less
 * honest of the two: `REQUIREMENTS.md` §2.2 warns the newest round may lag reality, and
 * coverage phrasing states what is true without claiming to know today's calendar
 * position. The vocabulary is coverage / complete / scheduled / available, and nothing in
 * this component, its props, its tests or its comments names an origin for anything.
 *
 * **Pure and presentational: it does not call `useMeta`.** `Header` fetches, runs the
 * selectors and passes the result down (`ARCHITECTURE.md` §3).
 *
 * The dot is **static**. §4.5 puts this component on the "must never animate" list: a
 * pulsing dot in a header reads as an alert, and there is nothing here to be alarmed
 * about. The only motion is M-8's crossfade out of the skeleton, M-5 on the popover and
 * M-6 on the trigger.
 */

export interface DataVintageProps {
  vintage: DataVintageValue | null;
  /**
   * The popover sentences. Separate from `vintage` because the popover states season
   * coverage — scheduled, cancelled, the season range — and none of that is a property of
   * a single round. Non-null exactly when `vintage` is.
   */
  detail: CoverageDetail | null;
  state: 'loading' | 'ready' | 'unavailable';
}

const PANEL_ID = 'data-coverage-detail';

export function DataVintage({ vintage, detail, state }: DataVintageProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside click dismisses (§8). Registered only while open, so there is no document
  // listener in the ordinary case.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target) === true) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  const resolved = state === 'ready' && vintage !== null && detail !== null;

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      // Esc is handled on the container, not the panel: focus is on the trigger while
      // the popover is open, and a handler on the panel would never see the key (§8).
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.preventDefault();
        close();
      }}
    >
      {/*
       * M-8. `mode="popLayout"` takes the exiting skeleton out of flow, so the chip does
       * not shunt sideways while the two overlap — and the skeleton is the width of the
       * resolved chip, so the header holds its shape either way. `initial={false}`
       * because this is a swap, not an entrance: the shell's own mount is M-1.
       */}
      <AnimatePresence initial={false} mode="popLayout">
        {state === 'loading' ? (
          <motion.span key="loading" className="inline-flex" exit={crossfade.skeletonExit}>
            <LoadingState label="Data coverage" className="skeleton-vintage" />
          </motion.span>
        ) : (
          <motion.span
            key="resolved"
            className="inline-flex"
            initial={crossfade.contentEnter.initial}
            animate={crossfade.contentEnter.animate}
          >
            {resolved ? (
              <motion.button
                ref={triggerRef}
                type="button"
                className="btn btn-ghost btn-sm t-mono t-xs gap-2"
                aria-expanded={open}
                /*
                 * No `aria-haspopup`. ARIA 1.2 requires the popup container's role to be
                 * one of menu / listbox / tree / grid / dialog and the attribute's value
                 * to match it; `"true"` is defined as equivalent to `"menu"`, and this
                 * panel is static prose, not a menu. It is a **disclosure**, so
                 * `aria-expanded` states the state and `aria-controls` names what it
                 * controls — the presence of which is exactly what this button controls.
                 */
                aria-controls={PANEL_ID}
                aria-label={detail.triggerName}
                onClick={() => {
                  if (open) close();
                  else setOpen(true);
                }}
                whileTap={control.whileTap}
                transition={control.transition}
              >
                <span className="vintage-dot" aria-hidden="true" />
                <span className="text-ink-secondary">
                  {/* At the base breakpoint the chip is the dot and the round only (§2.2). */}
                  <span className="hidden md:inline">{vintage.year} · </span>R{vintage.round}
                </span>
              </motion.button>
            ) : (
              /*
               * Deliberately not an error colour: at header scale a red dot reads as a
               * site-wide fault, and the actual failure is already stated in `main`.
               */
              <span
                className="vintage-dot vintage-dot-unavailable"
                role="img"
                aria-label="Data coverage unavailable"
              />
            )}
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && resolved && (
          <motion.div
            id={PANEL_ID}
            className="popover-panel popover-coverage flex flex-col gap-3 p-4"
            variants={popover}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <p className="t-2xs text-ink-tertiary">Data coverage</p>
            <p className="t-sm text-ink-primary">{detail.coverageLine}</p>
            {detail.scheduledLine !== null && (
              <p className="t-sm text-ink-secondary">{detail.scheduledLine}</p>
            )}
            {detail.cancelledLine !== null && (
              <p className="t-sm text-ink-secondary">{detail.cancelledLine}</p>
            )}
            <p className="t-xs text-ink-tertiary">{detail.seasonsLine}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
