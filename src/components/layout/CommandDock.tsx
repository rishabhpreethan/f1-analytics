import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { DockSheet } from '@/components/layout/DockSheet';
import {
  readDockPreference,
  writeDockPreference,
  type DockPreference,
} from '@/components/layout/dockPreference';
import {
  computeIndicatorGeometry,
  isActiveNavItem,
  type NavItem,
} from '@/components/layout/navItems';
import { ICONS } from '@/components/ui/iconRegistry';
import { MoreHorizontal, Pin, PinOff } from '@/components/ui/icons';
import { useSpotlight } from '@/lib/motion/interactions';
import { dockMount, sheetEnter, sheetExit } from '@/lib/motion/surfaces';
import { useDisclosure } from '@/lib/motion/useDisclosure';
import { useMotion } from '@/lib/motion/useMotion';
import { useMediaQuery } from '@/lib/useMediaQuery';

/**
 * Primary navigation — `DESIGN_SYSTEM.md` §7.8, Design Spec §5. **Replaces `PrimaryNav`.**
 *
 * **One `<nav aria-label="Primary">`, one list, two orientations.** An expanding overlay rail
 * at ≥1024px and a floating bottom dock below it, both driven from the same markup: the four
 * bottom-dock destinations are the ones flagged in `NAV_ITEMS`, the other three are
 * `display: none` below 1024 and reachable through the overflow sheet, and the "More" trigger
 * and the pin row are each hidden at the width where they make no sense. Rendering two trees
 * would mean two `nav` landmarks, or one that is duplicated to a screen reader.
 *
 * **The rail expands over content and never reflows `main`** (§5.3). `main` reserves a constant
 * 96px whether the rail is open or closed, because a chart that resized when a user hovered the
 * nav would be a defect — and that is the entire reason the design chose an overlay rail rather
 * than a push sidebar.
 *
 * **G-4 is a CSS width transition, not a GSAP timeline** — a deliberate deviation from §4.6.
 * `width` is the one layout property §4.5 permits animating, and here CSS is the *safer*
 * mechanism: if GSAP tweened the width it would leave an inline `width` that `revertOnUpdate`
 * strips on the next dependency change, snapping the rail mid-interaction. CSS owns the width;
 * GSAP owns the labels' staggered entrance, which is the part with a stagger. The reduced-motion
 * outcome is unchanged either way — chokepoint 1 removes the transition, and the rail is
 * permanently expanded with the pin control hidden, per §4.6 G-4.
 *
 * Every other motion is as specified: **G-1**'s dock half via `dockMount`, **G-3**'s measured
 * indicator, **G-5**'s sheet, **G-7** and **G-8** on the items.
 */

/** ≥1024px is the rail. The same figure as `--breakpoint-lg`; see `useMediaQuery` on why
 * this is the one place a breakpoint is also a JavaScript value. */
const RAIL_QUERY = '(min-width: 64rem)';

/** The indicator is authored at this length and scaled to the active item (G-3). */
const INDICATOR_BASE = 20;

export interface CommandDockProps {
  items: readonly NavItem[];
}

export function CommandDock({ items }: CommandDockProps) {
  const { pathname } = useLocation();
  const isRail = useMediaQuery(RAIL_QUERY);

  const [preference, setPreference] = useState<DockPreference>(readDockPreference);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const moreRef = useRef<HTMLButtonElement>(null);

  const {
    scope: sheetScope,
    mounted: sheetMounted,
    isOpen: sheetOpen,
    open: openSheet,
    close: closeSheet,
    reduced,
  } = useDisclosure<HTMLDivElement>({ enter: sheetEnter, exit: sheetExit });

  // The spotlight's scope **is** the list, so it doubles as the element G-3 measures against.
  // One ref on one node: merging two would mean a ref callback written during render.
  const { scope: listScope, handlers: spotlightHandlers } = useSpotlight<HTMLUListElement>();

  /**
   * The rail is expanded when pinned, hovered or focused — **and always under reduced motion**
   * (§4.6 G-4). A hover-to-reveal affordance is exactly what a reduced-motion user should not
   * have to chase, so they get the labels permanently and the pin control disappears, because
   * there is nothing left for it to toggle.
   */
  const expanded = reduced || preference === 'pinned' || hovered || focused;

  const activeIndex = items.findIndex((item) => isActiveNavItem(pathname, item.to));

  /**
   * **G-1's dock half, and G-3's indicator.** Both live here because both depend on the same
   * measured geometry, and `settle` / `animate` is exactly the split they need: the indicator's
   * *position* is applied in both modes with a `gsap.set` — under `reduce` it **snaps**, which
   * §4.6 records as correct and intended — while only the *travel* between positions is a tween.
   *
   * Deps include `expanded` because expanding the rail changes item widths, and `isRail` because
   * it changes which axis the indicator travels on.
   */
  const { scope: navScope } = useMotion<HTMLElement>({
    settle: ({ q, gsap: g }) => {
      const geometry = measureIndicator(listScope.current, activeIndex, isRail);
      if (geometry === null) return;
      const axis = isRail ? 'y' : 'x';
      const scaleAxis = isRail ? 'scaleY' : 'scaleX';
      g.set(q('[data-motion="dock-indicator"]'), {
        [axis]: geometry.x,
        [scaleAxis]: geometry.scaleX,
      });
    },
    animate: (ctx) => {
      dockMount(ctx, isRail);
    },
    deps: [pathname, isRail, expanded, activeIndex],
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
      data-expanded={expanded ? 'true' : 'false'}
      // Pointer and focus both expand the rail (§5.2). `focusin`/`focusout` rather than
      // `focus`/`blur` — React's `onFocus`/`onBlur` already bubble, which is what is wanted:
      // a keyboard user tabbing into any child must see the labels.
      onPointerEnter={() => {
        setHovered(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
      }}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
      }}
    >
      <ul ref={listScope} className="dock-list" {...spotlightHandlers}>
        {items.map((item) => {
          const active = isActiveNavItem(pathname, item.to);
          const Glyph = ICONS[item.icon];
          return (
            <li
              key={item.to}
              className="dock-slot"
              data-motion="dock-item"
              data-overflow={item.inBottomDock ? 'false' : 'true'}
            >
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`dock-item ${active ? 'dock-item-active' : ''}`}
              >
                <Glyph size={20} />
                <span className="dock-label">{item.label}</span>
              </Link>
            </li>
          );
        })}

        {/*
         * The fifth bottom-dock slot. Hidden at ≥1024, where the rail shows all seven, so it is
         * never a control that does nothing. `aria-haspopup="dialog"` is correct here in a way
         * it is not on the two popovers: the sheet really is a modal dialog.
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
            <MoreHorizontal size={20} />
            <span className="dock-label">More</span>
          </button>
        </li>

        {/* G-3. One element that travels, rather than one per item that appears — which is what
         * makes it read as a single object moving. Positioned by measurement, never by layout. */}
        <li className="dock-indicator" data-motion="dock-indicator" aria-hidden="true" />
      </ul>

      {/*
       * The pin. Rail-only, and hidden under reduced motion where the rail never collapses.
       * `aria-pressed` carries the state; the label changes to describe the *action*, which is
       * what a toggle's name should do.
       */}
      <div className="dock-pin-row">
        <button
          type="button"
          className="dock-item dock-pin"
          aria-pressed={preference === 'pinned'}
          onClick={togglePin}
        >
          {preference === 'pinned' ? <PinOff size={20} /> : <Pin size={20} />}
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
 * Kept out of the builder so the builder reads as a statement of what moves. Returns `null`
 * when there is nothing to measure — no active item, or a list that has not laid out yet —
 * because `settle` must then leave the indicator alone rather than move it to zero.
 */
function measureIndicator(
  list: HTMLUListElement | null,
  activeIndex: number,
  isRail: boolean,
): { x: number; scaleX: number } | null {
  if (list === null || activeIndex < 0) return null;
  const slots = list.querySelectorAll<HTMLElement>('[data-motion="dock-item"]');
  const slot = slots[activeIndex];
  if (slot === undefined) return null;

  const item = slot.getBoundingClientRect();
  const container = list.getBoundingClientRect();

  return computeIndicatorGeometry(
    isRail ? { start: item.top, size: item.height } : { start: item.left, size: item.width },
    { start: isRail ? container.top : container.left },
    INDICATOR_BASE,
  );
}
