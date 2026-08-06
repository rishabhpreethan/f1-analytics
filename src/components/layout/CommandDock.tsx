import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { DockSheet } from '@/components/layout/DockSheet';
import {
  readDockPreference,
  writeDockPreference,
  type DockPreference,
} from '@/components/layout/dockPreference';
import {
  DOCK_GLYPH_SIZE,
  INDICATOR_LENGTH,
  computeIndicatorGeometry,
  isActiveNavItem,
  type IndicatorGeometry,
  type NavItem,
} from '@/components/layout/navItems';
import { ICONS } from '@/components/ui/iconRegistry';
import { MoreHorizontal, Pin, PinOff } from '@/components/ui/icons';
import { dockMount, indicatorTravel, sheetEnter, sheetExit } from '@/lib/motion/surfaces';
import { useDisclosure } from '@/lib/motion/useDisclosure';
import { useMotion } from '@/lib/motion/useMotion';
import { useMediaQuery } from '@/lib/useMediaQuery';

/**
 * Primary navigation — `DESIGN_SYSTEM.md` §7.8, and rewritten 2026-08-06.
 *
 * **One `<nav aria-label="Primary">`, one list, two orientations.** A full-height expanding overlay
 * rail at ≥1024px and a floating bottom dock below it, both driven from the same markup: the four
 * bottom-dock destinations are the ones flagged in `NAV_ITEMS`, the other three are `display: none`
 * below 1024 and reachable through the overflow sheet, and the "More" trigger and the pin row are
 * each hidden at the width where they make no sense. Rendering two trees would mean two `nav`
 * landmarks, or one that is duplicated to a screen reader.
 *
 * **The rail expands over content and never reflows `main`** (§5.3). `main` reserves a constant 96px
 * whether the rail is open or closed, because a chart that resized when a user hovered the nav would
 * be a defect — and that is the entire reason the design chose an overlay rail rather than a push
 * sidebar.
 *
 * ---
 *
 * **What this component deliberately no longer does: track its own hover and focus.**
 *
 * Rishabh reported the rail broken in both states. The collapsed fault was real and definite —
 * nothing hid `.dock-label`, so a 64px rail read `Hor`, `Seas`, `Driv` — and it is fixed in
 * `index.css`. The expanded fault was *reported* as "hovering did nothing", and it could not be
 * reproduced: the previous build's `onPointerEnter` → `setHovered(true)` → `data-expanded` path
 * flips the attribute correctly (asserted below), and the built cascade put
 * `.dock[data-expanded=true]{width:…}` inside the right media query at the right specificity. The
 * most likely explanation is capture timing against a 320ms width transition.
 *
 * **Not being able to name the cause is the reason the mechanism is gone rather than kept.**
 * `:hover` and `:focus-within` express exactly the same two conditions in CSS, with no React state,
 * no re-render, no attribute round-trip and no dependency array — so there is nothing left to fail
 * in the same unnameable way, and the rail cannot get stuck open or closed because there is no
 * state to get stuck. Three pieces of state became one, and the one that survived
 * (`preference`) is the only one that has to, because it persists.
 *
 * A cost, stated: `expanded` is no longer observable from JavaScript, so G-3's indicator can no
 * longer re-measure when the rail opens. That turns out to be free — expanding the rail changes its
 * *width*, and the rail's indicator travels on `y`, so no offset it measures can change.
 *
 * ---
 *
 * **G-4 is a CSS width transition, not a GSAP timeline** — a documented deviation from §4.6.
 * `width` is the one layout property §4.5 permits animating, and here CSS is the *safer* mechanism:
 * a GSAP width tween would leave an inline `width` that `revertOnUpdate` strips on the next
 * dependency change, snapping the rail mid-interaction. The label stagger is a per-item
 * `transition-delay` for the same reason: `:focus-within` has no reliable DOM event pair, so a
 * tween wired to `pointerenter` would never fire for the keyboard user it exists for.
 *
 * Every other motion is as specified: **G-1**'s dock half via `dockMount`, **G-3**'s measured
 * indicator, **G-5**'s sheet, and **G-7**'s colour half as a CSS transition. **G-8's pointer
 * spotlight is gone** — a low-opacity achromatic radial over glass reads as a smudge, which is the
 * same failure the atmosphere's orbs were removed for (§3.5.2).
 *
 * **G-1 and G-3 are two `useMotion` calls, on two nodes, and that separation is the fix for a real
 * defect rather than tidiness.** They shared one hook, and because R-G3 hard-codes
 * `revertOnUpdate: true`, G-3's dependency array made G-1's 460ms entrance replay on every
 * navigation. G-1 now has no dependencies at all, and G-3 lives on the indicator element itself.
 */

/** ≥1024px is the rail. The same figure as `--breakpoint-lg`; see `useMediaQuery` on why this is
 * the one place a breakpoint is also a JavaScript value. */
const RAIL_QUERY = '(min-width: 64rem)';

/**
 * Where a dock indicator is travelling **from** and **to**, keyed by the element. Written by
 * `settle`, which runs first and in both modes; read by `animate`, which runs second and only when
 * motion is allowed. `from: null` is first paint, and `from === to` means "did not move" — which
 * `animate` treats as nothing to build.
 *
 * **`settle` must write on every run, including the runs where it measures nothing.** If it returned
 * early and left the previous entry in place, `animate` would read a stale pair and replay the
 * flourish for a move that never happened — which is what navigating to `/teams` below 1024px does,
 * since that slot is `display: none` and cannot be measured.
 *
 * **A `WeakMap`, not a `useRef`.** This is written by a motion builder and read by another; a ref
 * written from a builder is exactly the pattern `react-hooks/refs` refuses, because it cannot prove
 * the builder is not called during render. Keying on the DOM node has no such ambiguity and holds
 * nothing alive after the node is collected.
 *
 * It cannot be an inline style read back off the element instead: `revertOnUpdate: true` (R-G3)
 * strips the previous run's inline transform *before* the next run measures.
 */
const INDICATOR_TRAVEL = new WeakMap<HTMLElement, { from: number | null; to: number | null }>();

export interface CommandDockProps {
  items: readonly NavItem[];
}

export function CommandDock({ items }: CommandDockProps) {
  const { pathname } = useLocation();
  const isRail = useMediaQuery(RAIL_QUERY);

  const [preference, setPreference] = useState<DockPreference>(readDockPreference);

  const moreRef = useRef<HTMLButtonElement>(null);
  // The list is measured by G-3 and nothing else, so it is a plain ref. It used to be
  // `useSpotlight`'s scope; the spotlight is retired (§3.5.2).
  const listRef = useRef<HTMLUListElement>(null);

  const {
    scope: sheetScope,
    mounted: sheetMounted,
    isOpen: sheetOpen,
    open: openSheet,
    close: closeSheet,
  } = useDisclosure<HTMLDivElement>({ enter: sheetEnter, exit: sheetExit });

  const activeIndex = items.findIndex((item) => isActiveNavItem(pathname, item.to));

  /**
   * **G-1's dock half — and it has NO dependency array, deliberately.**
   *
   * §4.6 specifies G-1 as once per hard load. This and G-3 used to share one `useMotion`, and
   * because R-G3 hard-codes `revertOnUpdate: true`, every dependency change re-ran `animate` — so
   * the 460ms entrance replayed on every navigation. With no deps the entrance is built once.
   *
   * `isRail` is therefore read at mount. That is correct for an entrance: the axis a dock arrived
   * along is not something a later resize can retrospectively change.
   */
  const { scope: navScope } = useMotion<HTMLElement>({
    animate: (ctx) => {
      dockMount(ctx, isRail);
    },
  });

  /**
   * **G-3's indicator**, on its own node and its own dependency array — so it re-measures on every
   * navigation without dragging G-1 along with it.
   *
   * `settle` / `animate` is exactly the split G-3 needs: the *position* is applied in both modes
   * with a `gsap.set`, so under `reduce` the bar **snaps**, which §4.6 records as correct and
   * intended; only the *travel* between positions is a tween.
   *
   * **`expanded` is no longer a dependency, and cannot be** — the rail's open state is pure CSS
   * now. That is not a loss: expanding the rail changes its `width`, and the rail's indicator
   * travels on `y`, so nothing it measures moves. Removing it also removes a re-measure that fired
   * on every `pointerenter`.
   */
  const { scope: indicatorScope } = useMotion<HTMLLIElement>({
    settle: ({ root, gsap: g }) => {
      const geometry = measureIndicator(listRef.current, activeIndex, isRail);
      const previous = INDICATOR_TRAVEL.get(root)?.to ?? null;

      // `null` is "leave it alone" — nothing to measure, or a `display: none` slot below 1024px.
      // Writing zero would park the bar in the top-left corner; recording `from === to` is what
      // tells `animate` that nothing moved.
      if (geometry === null) {
        INDICATOR_TRAVEL.set(root, { from: previous, to: previous });
        return;
      }

      INDICATOR_TRAVEL.set(root, { from: previous, to: geometry.offset });
      g.set(root, { [isRail ? 'y' : 'x']: geometry.offset });
    },
    animate: (ctx) => {
      const travel = INDICATOR_TRAVEL.get(ctx.root);
      // Nothing measured, or a re-measure that landed on the same offset.
      if (travel === undefined || travel.to === null || travel.from === travel.to) return;
      indicatorTravel(ctx, { from: travel.from, to: travel.to }, isRail);
    },
    deps: [pathname, isRail, activeIndex],
  });

  function togglePin() {
    const next: DockPreference = preference === 'pinned' ? 'auto' : 'pinned';
    setPreference(next);
    writeDockPreference(next);
  }

  return (
    <nav
      ref={navScope}
      aria-label="Primary"
      className="dock"
      data-motion="dock"
      /*
       * The **only** state the rail's appearance still reads from React, because it is the only one
       * that persists. Hover and focus are `:hover` and `:focus-within` in `index.css`.
       */
      data-pinned={preference === 'pinned' ? 'true' : 'false'}
    >
      <ul ref={listRef} className="dock-list">
        {items.map((item, index) => {
          const active = isActiveNavItem(pathname, item.to);
          const Glyph = ICONS[item.icon];
          return (
            <li
              key={item.to}
              className="dock-slot"
              data-motion="dock-item"
              data-overflow={item.inBottomDock ? 'false' : 'true'}
              /*
               * The label reveal's stagger (G-4), as a per-item `transition-delay` multiplier. An
               * index is not a design value, which is why it may be an inline style where a
               * duration or a length may not — and `--stagger-dock-label`, the figure it
               * multiplies, is a token.
               */
              style={{ '--dock-index': index } as React.CSSProperties}
            >
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`dock-item ${active ? 'dock-item-active' : ''}`}
              >
                <Glyph size={DOCK_GLYPH_SIZE} />
                <span className="dock-label">{item.label}</span>
              </Link>
            </li>
          );
        })}

        {/*
         * The fifth bottom-dock slot. Hidden at ≥1024, where the rail shows all seven, so it is
         * never a control that does nothing. `aria-haspopup="dialog"` is correct here in a way it is
         * not on the two popovers: the sheet really is a modal dialog.
         */}
        <li className="dock-slot dock-slot-more">
          <button
            ref={moreRef}
            type="button"
            className={`dock-item ${sheetOpen ? 'dock-item-active' : ''}`}
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
            aria-label="More destinations"
            onClick={() => {
              if (sheetOpen) {
                closeSheet();
                moreRef.current?.focus();
              } else openSheet();
            }}
          >
            <MoreHorizontal size={DOCK_GLYPH_SIZE} />
            <span className="dock-label">More</span>
          </button>
        </li>

        {/* G-3. One element that travels, rather than one per item that appears — which is what
         * makes it read as a single object moving. Positioned by measurement, never by layout; a
         * **fixed** 20px (rail) / 16px (bottom dock) long, and half the dock's padding *outside*
         * the active pill, because the pill is now an accent fill and a mark on it would be
         * invisible. */}
        <li ref={indicatorScope} className="dock-indicator" aria-hidden="true" />
      </ul>

      {/*
       * The pin. Rail-only, pushed to the **bottom** of the full-height rail by `margin-top: auto`,
       * and hidden under reduced motion where the rail never collapses. `aria-pressed` carries the
       * state; the label changes to describe the *action*, which is what a toggle's name should do.
       */}
      <div className="dock-pin-row">
        <button
          type="button"
          className="dock-item dock-pin"
          aria-pressed={preference === 'pinned'}
          onClick={togglePin}
        >
          {preference === 'pinned' ? (
            <PinOff size={DOCK_GLYPH_SIZE} />
          ) : (
            <Pin size={DOCK_GLYPH_SIZE} />
          )}
          <span className="dock-label">
            {preference === 'pinned' ? 'Collapse menu' : 'Keep menu open'}
          </span>
        </button>
      </div>

      {sheetMounted && (
        <div ref={sheetScope} className="contents">
          <DockSheet
            items={items}
            pathname={pathname}
            onClose={() => {
              closeSheet();
              moreRef.current?.focus();
            }}
            onNavigate={closeSheet}
          />
        </div>
      )}
    </nav>
  );
}

/**
 * The active item's geometry along the dock's main axis, from `getBoundingClientRect()`.
 *
 * Kept out of the builder so the builder reads as a statement of what moves. Returns `null` when
 * there is nothing to measure — no active item, a list that has not laid out yet, or a slot that is
 * `display: none` (which is the case on `/teams`, `/circuits` and `/records` below 1024px, where
 * those three destinations live in the overflow sheet). `settle` must then leave the indicator alone
 * rather than move it to zero.
 */
function measureIndicator(
  list: HTMLUListElement | null,
  activeIndex: number,
  isRail: boolean,
): IndicatorGeometry | null {
  if (list === null || activeIndex < 0) return null;
  const slots = list.querySelectorAll<HTMLElement>('[data-motion="dock-item"]');
  const slot = slots[activeIndex];
  if (slot === undefined) return null;

  const item = slot.getBoundingClientRect();
  const container = list.getBoundingClientRect();

  return computeIndicatorGeometry(
    isRail ? { start: item.top, size: item.height } : { start: item.left, size: item.width },
    { start: isRail ? container.top : container.left },
    isRail ? INDICATOR_LENGTH.rail : INDICATOR_LENGTH.dock,
  );
}
