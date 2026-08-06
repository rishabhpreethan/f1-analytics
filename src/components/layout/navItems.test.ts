import { describe, expect, it } from 'vitest';
import { ICONS } from '@/components/ui/iconRegistry';
import { INDICATOR_LENGTH, NAV_ITEMS, computeIndicatorGeometry, isActiveNavItem } from './navItems';

/**
 * CT-11 and CT-12. Both functions fail *quietly* when they fail — a nav item lit on the
 * wrong route, or an indicator that has silently left the screen because a `transform`
 * received `Infinity`. Neither shows up in a screenshot, and there is no E2E gate in this
 * project any more (CR-006).
 */

describe('CT-11 — isActiveNavItem', () => {
  it('matches "/" on the landing route and nowhere else', () => {
    expect(isActiveNavItem('/', '/')).toBe(true);
    // The regression this test exists for: before CR-007 the hub was at `/`, and the old
    // predicate let `/` match `/seasons*` on purpose. Carrying that forward would light
    // **Home** up on every season page (§10 #23).
    expect(isActiveNavItem('/seasons', '/')).toBe(false);
    expect(isActiveNavItem('/seasons/2024', '/')).toBe(false);
    expect(isActiveNavItem('/drivers', '/')).toBe(false);
    expect(isActiveNavItem('/records', '/')).toBe(false);
  });

  it('matches a destination and everything nested inside it', () => {
    expect(isActiveNavItem('/seasons', '/seasons')).toBe(true);
    expect(isActiveNavItem('/seasons/2024', '/seasons')).toBe(true);
    expect(isActiveNavItem('/seasons/2024/races/3', '/seasons')).toBe(true);
  });

  it('respects the segment boundary', () => {
    // `startsWith(to)` without the boundary would return true for all of these.
    expect(isActiveNavItem('/seasonsomething', '/seasons')).toBe(false);
    expect(isActiveNavItem('/teamsomething', '/teams')).toBe(false);
    expect(isActiveNavItem('/driversomething', '/drivers')).toBe(false);
    expect(isActiveNavItem('/comparex', '/compare')).toBe(false);
  });

  it('treats a trailing slash as no trailing slash', () => {
    expect(isActiveNavItem('/drivers/', '/drivers')).toBe(true);
    expect(isActiveNavItem('/seasons/2024/', '/seasons')).toBe(true);
    expect(isActiveNavItem('/', '/')).toBe(true);
    expect(isActiveNavItem('/teamsomething/', '/teams')).toBe(false);
  });

  it('lights exactly one item for every route the product ships', () => {
    const routes = [
      '/',
      '/seasons',
      '/seasons/2024',
      '/seasons/2024/races/3',
      '/drivers',
      '/drivers/max_verstappen',
      '/teams',
      '/teams/ferrari',
      '/circuits',
      '/circuits/spa',
      '/compare',
      '/records',
    ];
    for (const route of routes) {
      const active = NAV_ITEMS.filter((item) => isActiveNavItem(route, item.to));
      expect(active.length, `${route} lit ${String(active.length)} nav items`).toBe(1);
    }
  });
});

describe('NAV_ITEMS', () => {
  it('names only glyphs that exist, and only slugs — never an integer id', () => {
    for (const item of NAV_ITEMS) {
      expect(Object.keys(ICONS)).toContain(item.icon);
      // Trap 11 / DL-3: a numeric path segment here would mean an internal id had leaked
      // into a URL. `:year` is a number but is never in a nav item's static href.
      expect(item.to).toMatch(/^\/[a-z]*$/);
    }
  });

  it('fills exactly five bottom-dock slots — four items plus "More"', () => {
    // Design Spec §5.3: five slots, the fifth of which is the overflow trigger.
    expect(NAV_ITEMS.filter((item) => item.inBottomDock)).toHaveLength(4);
    expect(NAV_ITEMS).toHaveLength(7);
  });
});

describe('CT-12 — computeIndicatorGeometry', () => {
  const container = { start: 100 };

  it('centres a fixed-length bar on the first and last item', () => {
    // A 48px rail row with a 20px bar: (48 − 20) / 2 = 14px of leading inset.
    expect(computeIndicatorGeometry({ start: 100, size: 48 }, container, 20)).toEqual({
      offset: 14,
    });
    expect(computeIndicatorGeometry({ start: 340, size: 48 }, container, 20)).toEqual({
      offset: 254,
    });
  });

  it('never scales the bar to the item — §S.3.6 resolves that in the Design Spec’s favour', () => {
    // The regression this exists for: the first implementation returned `scaleX = size / 20`,
    // which renders a 2×48 bar in a 48px rail row instead of the specified 2×20. Doubling the
    // item's size must move the bar by exactly half the extra length and change nothing else.
    const small = computeIndicatorGeometry({ start: 100, size: 40 }, container, 20);
    const large = computeIndicatorGeometry({ start: 100, size: 80 }, container, 20);
    expect(small).toEqual({ offset: 10 });
    expect(large).toEqual({ offset: 30 });
    expect(Object.keys(large ?? {})).toEqual(['offset']);
  });

  it('is unaffected by where the container sits in the viewport', () => {
    // Both rects come from `getBoundingClientRect()`, so both move together when the page
    // is scrolled. The difference is what matters, and it must be scroll-invariant.
    const unscrolled = computeIndicatorGeometry({ start: 148, size: 48 }, { start: 100 }, 20);
    const scrolled = computeIndicatorGeometry({ start: -352, size: 48 }, { start: -400 }, 20);
    expect(scrolled).toEqual(unscrolled);
    expect(unscrolled).toEqual({ offset: 62 });
  });

  it('returns null for a degenerate indicator length, never NaN or Infinity', () => {
    // `translateY(NaN)` is ignored silently — the worst kind of failure.
    for (const length of [0, -20, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        computeIndicatorGeometry({ start: 340, size: 48 }, container, length),
        `length ${String(length)}`,
      ).toBeNull();
    }
  });

  it('returns null for a hidden slot, so the indicator is left alone rather than parked at zero', () => {
    // Not an edge case: below 1024px the three overflow destinations are `display: none`, so
    // on `/teams`, `/circuits` and `/records` the active slot measures 0×0. The previous
    // implementation turned that into `scaleX: 0` and an invisible indicator.
    expect(computeIndicatorGeometry({ start: 0, size: 0 }, { start: 0 }, 16)).toBeNull();
    expect(computeIndicatorGeometry({ start: 340, size: 0 }, container, 16)).toBeNull();
  });

  it('returns null when a rect itself is degenerate', () => {
    // A rect measured before layout can carry NaN. It must not reach a transform.
    expect(computeIndicatorGeometry({ start: Number.NaN, size: 48 }, container, 20)).toBeNull();
    expect(computeIndicatorGeometry({ start: 340, size: Number.NaN }, container, 20)).toBeNull();
  });
});

describe('INDICATOR_LENGTH mirrors the Design Spec, and the stylesheet mirrors it', () => {
  it('is 20px in the rail and 16px in the bottom dock', () => {
    // Design Spec §5.2 and §5.3, verbatim. The CSS half of the same pair is checked by
    // `styles/index.css.test.ts`, which is where the drift would otherwise happen.
    expect(INDICATOR_LENGTH).toEqual({ rail: 20, dock: 16 });
  });
});
