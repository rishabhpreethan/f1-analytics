import type { IconName } from '@/components/ui/iconRegistry';

/**
 * The navigation model, and the two pieces of arithmetic the dock needs — all pure, all
 * unit-tested (CT-11, CT-12), and deliberately free of React and of JSX.
 *
 * **Why this is a module and not inline JSX.** Both functions below are the kind that fail
 * quietly. An active-state predicate that uses `startsWith` without a segment boundary
 * lights `Teams` up on `/teamsomething`; an indicator geometry computed from a `display: none`
 * slot's all-zero rect reaches a `transform` and makes the indicator vanish with no error
 * anywhere. Neither is visible in a screenshot, and there is no E2E gate in this project
 * (CR-006), so a unit test is the only thing that can catch them.
 *
 * Slugs and literal paths only — **never an internal integer id** (trap 11, DL-3).
 */

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /**
   * Whether the item appears in the five-slot bottom dock below 1024px, or only in its
   * overflow sheet (Design Spec §5.4). The rail shows all seven at every width ≥1024.
   */
  inBottomDock: boolean;
}

/**
 * Design Spec §5.4, in order. `/seasons` rather than `/season`: the Design Spec proposed
 * `/season` with a redirect, and the `principal-engineer` ruled against a redirect in either
 * direction — `ARCHITECTURE.md` §5 and §10 #23 make `/seasons` the canonical hub URL, and
 * routing is not design's to ratify (the Design Spec says so itself, §2). Reported at gate 3.
 *
 * **No dead controls.** Global search and the app-wide season selector are F9 and are simply
 * absent, not present-and-disabled. Every destination below resolves to a designed surface
 * today, even where that surface is a placeholder.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Home', icon: 'House', inBottomDock: true },
  { to: '/seasons', label: 'Season', icon: 'CalendarDays', inBottomDock: true },
  { to: '/drivers', label: 'Drivers', icon: 'UserRound', inBottomDock: true },
  { to: '/teams', label: 'Teams', icon: 'Users', inBottomDock: false },
  { to: '/circuits', label: 'Circuits', icon: 'MapPin', inBottomDock: false },
  { to: '/compare', label: 'Compare', icon: 'GitCompareArrows', inBottomDock: true },
  { to: '/records', label: 'Records', icon: 'Trophy', inBottomDock: false },
];

/**
 * Whether `to` is the destination the user is currently inside.
 *
 * Two rules, both load-bearing:
 *
 *   1. **`/` matches only `/`.** Before CR-007 the season hub lived at `/` and Home did not
 *      exist, so the old predicate deliberately let `/` also match `/seasons*`. Carrying
 *      that forward would light **Home** up on every season page — which is why §10 #23
 *      records that this predicate "becomes non-trivial" as a consequence of the route split.
 *   2. **Everything else matches on a segment boundary.** `pathname === to`, or
 *      `pathname` starts with `to + '/'`. `startsWith(to)` alone would make `/teams` active
 *      on `/teamsomething`.
 *
 * A trailing slash on `pathname` is normalised, because `/drivers/` and `/drivers` are the
 * same place and a router may hand over either.
 */
export function isActiveNavItem(pathname: string, to: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (to === '/') return path === '/';
  return path === to || path.startsWith(`${to}/`);
}

/**
 * The indicator's **fixed** length along the dock's main axis, in CSS px.
 *
 * Design Spec §5.2 specifies a **2×20px** bar in the rail, vertically centred, and §5.3 a
 * **2×16px** bar at the top edge of a bottom-dock slot. Both are 2px thick (`--size-rule`);
 * these are the *lengths*.
 *
 * **This resolves a contradiction between the two specs, in the Design Spec's favour** —
 * recorded in `PLAN.md` §S.3.6. Technical Spec §S.3.6 described the indicator as scaled "to
 * the active item" against a fixed base width, which the first implementation took literally
 * and rendered as a full-length 2×48 bar in the rail. On a purely visual matter the Design
 * Spec governs, so the indicator has a fixed length and only ever **translates**.
 *
 * **px, deliberately, and mirrored in `tokens.css` as `--size-dock-indicator*`.** The
 * centring arithmetic below is done in JavaScript against `getBoundingClientRect()`, so a
 * `rem` length under a non-16px root font size would not equal the rendered length and the
 * bar would sit off-centre by half the difference. `index.css.test.ts` proves the two agree.
 */
export const INDICATOR_LENGTH = { rail: 20, dock: 16 } as const;

export interface IndicatorGeometry {
  /**
   * px along the dock's main axis, relative to the container's leading edge — the offset
   * that centres a bar of `indicatorLength` on the active item.
   */
  offset: number;
}

/**
 * **G-3** — where the active-item indicator goes, from *measured* rectangles.
 *
 * The indicator is one element that moves, rather than one per item that appears: that is
 * what makes it read as a single object travelling. Its position therefore cannot come from
 * layout, and must be computed from `getBoundingClientRect()` of the active item and of the
 * container, then applied as a `transform`.
 *
 * Pure so it can be tested without a browser, and it takes rectangles rather than elements
 * for the same reason. Both axes use the same function: the caller passes the rects' `x`/
 * `width` for the bottom dock and `y`/`height` for the rail, so there is one piece of
 * arithmetic and not two that can disagree.
 *
 * **`null` means "leave the indicator where it is", and it is not an edge case** — it is the
 * common case below 1024px. The three overflow destinations are `display: none` there, so
 * their slots measure `0 × 0`; on `/teams`, `/circuits` and `/records` the active slot is one
 * of those, and an all-zero rect previously produced `scaleX: 0` and an invisible indicator.
 * A non-finite offset returns `null` for the same reason: `transform: translateY(NaN)` is
 * ignored silently, which is the worst kind of failure.
 */
export function computeIndicatorGeometry(
  activeRect: { start: number; size: number },
  containerRect: { start: number },
  indicatorLength: number,
): IndicatorGeometry | null {
  if (!Number.isFinite(indicatorLength) || indicatorLength <= 0) return null;
  // A hidden slot measures zero. There is nothing to centre on, and zero is not a position.
  if (!Number.isFinite(activeRect.size) || activeRect.size <= 0) return null;

  const offset = activeRect.start - containerRect.start + (activeRect.size - indicatorLength) / 2;

  if (!Number.isFinite(offset)) return null;
  return { offset };
}
