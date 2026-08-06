import { useEffect, useRef } from 'react';
import type { CoverageDetail, DataVintage as DataVintageValue } from '@/features/meta/selectors';
import { LoadingState } from '@/components/ui/LoadingState';
import { usePressMotion } from '@/lib/motion/interactions';
import { contentEnter, popoverEnter, popoverExit } from '@/lib/motion/surfaces';
import { useDisclosure } from '@/lib/motion/useDisclosure';
import { useMotion } from '@/lib/motion/useMotion';

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
 * about. The motion is **G-12** (the content half — the resolved chip fades in as the
 * skeleton is replaced), **G-6** on the popover and **G-7** on the trigger.
 *
 * **G-12's skeleton-exit half is not implemented, deliberately.** Cross-fading out an
 * element that has already been replaced means holding it in the DOM after the data it
 * stood for has arrived, and the retired library's `mode="popLayout"` is what used to take
 * it out of flow while the two overlapped. GSAP has no equivalent and this product does
 * not build one for a 20px chip; the property that mattered — the header does not reflow —
 * is carried by the skeleton being exactly the resolved chip's width
 * (`--size-skeleton-vintage-*`), not by the fade. Reported at gate 3.
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
  const {
    scope: panelScope,
    mounted: panelMounted,
    isOpen: open,
    open: openPanel,
    close: closePanel,
  } = useDisclosure<HTMLDivElement>({ enter: popoverEnter, exit: popoverExit });

  const { scope: triggerRef, press } = usePressMotion<HTMLButtonElement>();
  const containerRef = useRef<HTMLDivElement>(null);

  // G-12, content half. Keyed on `state` so the fade plays when the skeleton is replaced
  // and never again. Authored as `from` (MR-2): the resting CSS is the readable chip, so
  // under reduced motion — or if the tween is never built — the chip is simply there.
  const { scope: swapScope } = useMotion<HTMLSpanElement>({
    animate: ({ tl, root }) => {
      tl.from(root, { opacity: 0, ...contentEnter });
    },
    deps: [state],
  });

  // Outside click dismisses (§8). Registered only while open, so there is no document
  // listener in the ordinary case.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target) === true) return;
      closePanel();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, closePanel]);

  /** Focus returns synchronously; only the panel's pixels wait for the exit tween. */
  function close() {
    closePanel();
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
       * G-12. One wrapper span, always present, so the skeleton and the resolved chip
       * occupy the same slot and the header cannot reflow between them.
       */}
      <span ref={swapScope} className="inline-flex">
        {state === 'loading' ? (
          <LoadingState label="Data coverage" className="skeleton-vintage" />
        ) : (
          <>
            {resolved ? (
              <button
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
                  else openPanel();
                }}
                {...press}
              >
                <span className="vintage-dot" aria-hidden="true" />
                <span className="text-ink-secondary">
                  {/* At the base breakpoint the chip is the dot and the round only (§2.2). */}
                  <span className="hidden md:inline">{vintage.year} · </span>R{vintage.round}
                </span>
              </button>
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
          </>
        )}
      </span>

      {panelMounted && resolved && (
        <div
          ref={panelScope}
          id={PANEL_ID}
          className="popover-panel popover-coverage flex flex-col gap-3 p-4"
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
        </div>
      )}
    </div>
  );
}
