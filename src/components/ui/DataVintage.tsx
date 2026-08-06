import { useEffect, useRef, type CSSProperties } from 'react';
import type { CoverageDetail, DataVintage as DataVintageValue } from '@/features/meta/selectors';
import { LoadingState } from '@/components/ui/LoadingState';
import { ChevronDown } from '@/components/ui/icons';
import { usePressMotion } from '@/lib/motion/interactions';
import { contentEnter, popoverEnter, popoverExit } from '@/lib/motion/surfaces';
import { useDisclosure } from '@/lib/motion/useDisclosure';
import { useMotion } from '@/lib/motion/useMotion';

/**
 * The data-coverage indicator, NV-9 (`DESIGN_SYSTEM.md` §7.3). **Respecified 2026-08-06.**
 *
 * Rishabh: *"the button up here: 2026 it also seems broken and i dont really know what its
 * for."*
 *
 * **On "seems broken": it was not.** The popover opens — `DataVintage.test.tsx` clicks the
 * trigger, asserts `aria-expanded` becomes `true` and reads all four sentences out of the
 * panel, and it passed before any of this changed. **The defect was discoverability**, and
 * that is a design failure rather than a wiring one: the accessible name was already
 * excellent (*"Data coverage: 2026 season, 10 of 22 rounds complete. Show detail."*) and
 * **nothing visible carried any of it.** A `ghost` button has no boundary, so the chip did
 * not read as a control at all; the label was two numbers with no noun; and the 8px dot
 * beside them stated nothing. He never got a popover because nothing told him there was one.
 *
 * Four visible changes, each answering one part of "i dont really know what its for":
 *
 *   1. **A noun.** The eyebrow reads `COVERAGE` at `--text-2xs`, so the chip says what it is
 *      about before it says a number. Hidden below 768 with the year, per §2.2's compact form.
 *   2. **A meter.** 10 of 22 rounds, drawn — deliberately in `CoverageRuler`'s exact visual
 *      language (`--surface-sunken` track, `--accent-mark` fill, `--radius-full`) so anyone
 *      who has seen the landing page's coverage ruler recognises it instantly. **This
 *      replaces the static dot**, which occupied the same space and expressed nothing.
 *   3. **A boundary.** `--border-control`, the one border token measured to clear 3:1, so the
 *      chip reads as an interactive control rather than as a label.
 *   4. **A disclosure affordance.** A chevron that rotates 180° when the panel is open, so
 *      "this opens something" is legible without hovering it.
 *
 * **This is treated as a feature, not furniture**, because it is the one element that
 * expresses the product's honesty about what the data cannot support. `REQUIREMENTS.md` §6
 * and the six coverage boundaries of §7.4 are the substance of this product's integrity; the
 * chip is where a user first meets them.
 *
 * **Currency is expressed as coverage, never as a fetch event.** "Complete results through
 * Round 10 of 22" is a fact about the sport's calendar and is verifiable from the data
 * itself. "Updated 12 days ago" would be a fact about a process, and it is also the less
 * honest of the two: `REQUIREMENTS.md` §2.2 warns the newest round may lag reality, and
 * coverage phrasing states what is true without claiming to know today's calendar position.
 * The vocabulary is coverage / complete / scheduled / available, and nothing in this
 * component, its props, its tests or its comments names an origin for anything.
 *
 * **Pure and presentational: it does not call `useMeta`.** `Header` fetches, runs the
 * selectors and passes plain values down (`ARCHITECTURE.md` §3).
 *
 * **Nothing here animates on its own.** §4.5 puts this component on the "must never animate"
 * list, and the meter inherits that from the dot it replaces: in a header, motion reads as an
 * alert, and there is nothing here to be alarmed about. The only motion is **G-12** (the
 * resolved chip fades in as the skeleton is replaced), **G-6** on the popover, **G-7** on the
 * trigger, and the chevron's rotation — which is a state, not an entrance.
 *
 * **G-12's skeleton-exit half is not implemented, deliberately.** Cross-fading out an element
 * that has already been replaced means holding it in the DOM after the data it stood for has
 * arrived, and the retired library's `mode="popLayout"` is what used to take it out of flow
 * while the two overlapped. GSAP has no equivalent and this product does not build one for a
 * chip; the property that mattered — the header does not reflow — is carried by the skeleton
 * being **the chip's own box** with skeleton blocks inside it (§7.5), not by the fade.
 */

export interface DataVintageProps {
  vintage: DataVintageValue | null;
  /**
   * The popover sentences. Separate from `vintage` because the popover states season
   * coverage — scheduled, cancelled, the season range — and none of that is a property of
   * a single round. Non-null exactly when `vintage` is.
   */
  detail: CoverageDetail | null;
  /**
   * The completeness meter's fill, 0–1.
   *
   * It arrives as a prop rather than being derived here for the same reason `detail` does:
   * components never fetch and never compute over a payload (`ARCHITECTURE.md` §3). `Header`
   * runs `selectSeasonProgress`, which already guarantees `ratio` is 0 rather than `NaN` when
   * nothing is scheduled — a `NaN` would reach a `width` and silently collapse the meter.
   */
  progress: { ratio: number } | null;
  state: 'loading' | 'ready' | 'unavailable';
}

const PANEL_ID = 'data-coverage-detail';

export function DataVintage({ vintage, detail, progress, state }: DataVintageProps) {
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

  const resolved = state === 'ready' && vintage !== null && detail !== null && progress !== null;

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
          /*
           * **The skeleton is the chip's own box, with skeleton blocks inside it** — not a grey slab
           * of a guessed width. §7.5 requires a skeleton to mirror the geometry of what is coming,
           * and here that requirement is also the only way to guarantee the header does not reflow:
           * the chip's width depends on the rendered width of "Coverage" and of a mono round label,
           * neither of which is knowable from a token. Reusing the same box, the same gaps and the
           * same `ch`-sized text blocks makes the two widths agree **by construction** rather than
           * by a figure someone measured once in a browser.
           *
           * The busy region is on the wrapper (§7.5, "told busy once"); every block inside it is
           * `announce={false}` geometry.
           */
          <span role="status" aria-busy="true" aria-label="Data coverage" className="inline-flex">
            <span className="vintage-trigger vintage-trigger-skeleton" aria-hidden="true">
              <LoadingState announce={false} className="skeleton-vintage-eyebrow" />
              <span className="vintage-meter" />
              <LoadingState announce={false} className="skeleton-vintage-value" />
              <LoadingState announce={false} className="skeleton-vintage-chevron" />
            </span>
          </span>
        ) : (
          <>
            {resolved ? (
              <button
                ref={triggerRef}
                type="button"
                /*
                 * `vintage-trigger`, not `btn-ghost`. A ghost button has no boundary, which is
                 * precisely why this chip did not read as a control — the whole of "i dont really
                 * know what its for" starts there. It now carries `--border-control`, the one
                 * border token measured to clear 3:1 (§3.5).
                 */
                className="vintage-trigger"
                data-open={open ? 'true' : 'false'}
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
                {/*
                 * The noun, first. Two numbers with no label is what made this chip unreadable;
                 * §2.2's compact form drops it below 768 along with the year, where a 56px header
                 * beside a wordmark has no room for it.
                 */}
                <span className="vintage-eyebrow t-2xs" aria-hidden="true">
                  Coverage
                </span>

                {/*
                 * The completeness meter — 10 of 22 rounds, drawn. **`aria-hidden`, and that is
                 * correct rather than lazy**: the button's `aria-label` already states "10 of 22
                 * rounds complete", so exposing the meter as well would announce the same fact
                 * twice. It is redundant reinforcement for sighted users, which is exactly the role
                 * §3.4.2 gives colour.
                 *
                 * Deliberately in `CoverageRuler`'s visual language, so the two are recognisably
                 * the same statement at two scales.
                 */}
                <span
                  className="vintage-meter"
                  aria-hidden="true"
                  style={{ '--coverage': progress.ratio } as CSSProperties}
                >
                  <span className="vintage-meter-fill" />
                </span>

                <span className="vintage-value t-mono t-xs">
                  {/* At the base breakpoint the chip is the meter and the round only (§2.2). */}
                  <span className="hidden md:inline">{vintage.year} · </span>R{vintage.round}
                </span>

                {/* The disclosure affordance. Rotates 180° when open — a state, not an entrance. */}
                <ChevronDown size={16} className="vintage-chevron" />
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
