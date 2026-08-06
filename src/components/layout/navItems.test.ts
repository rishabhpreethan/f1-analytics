import { describe, expect, it } from 'vitest';
import { ICONS } from '@/components/ui/iconRegistry';
import { NAV_ITEMS, computeIndicatorGeometry, isActiveNavItem } from './navItems';

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

  it('positions the first and last item correctly', () => {
    expect(computeIndicatorGeometry({ start: 100, size: 20 }, container, 20)).toEqual({
      x: 0,
      scaleX: 1,
    });
    expect(computeIndicatorGeometry({ start: 340, size: 40 }, container, 20)).toEqual({
      x: 240,
      scaleX: 2,
    });
  });

  it('is unaffected by where the container sits in the viewport', () => {
    // Both rects come from `getBoundingClientRect()`, so both move together when the page
    // is scrolled. The difference is what matters, and it must be scroll-invariant.
    const unscrolled = computeIndicatorGeometry({ start: 148, size: 20 }, { start: 100 }, 20);
    const scrolled = computeIndicatorGeometry({ start: -352, size: 20 }, { start: -400 }, 20);
    expect(scrolled).toEqual(unscrolled);
    expect(unscrolled).toEqual({ x: 48, scaleX: 1 });
  });

  it('returns the identity geometry for a degenerate base width, never NaN or Infinity', () => {
    // `scaleX(Infinity)` renders nothing and logs nothing — the worst kind of failure.
    for (const baseWidth of [0, -20, Number.NaN, Number.POSITIVE_INFINITY]) {
      const geometry = computeIndicatorGeometry({ start: 340, size: 40 }, container, baseWidth);
      expect(geometry, `baseWidth ${String(baseWidth)}`).toEqual({ x: 0, scaleX: 1 });
    }
  });

  it('returns the identity geometry when a rect itself is degenerate', () => {
    // A rect measured before layout can carry NaN. It must not reach a transform.
    expect(computeIndicatorGeometry({ start: Number.NaN, size: 40 }, container, 20)).toEqual({
      x: 0,
      scaleX: 1,
    });
    expect(computeIndicatorGeometry({ start: 340, size: Number.NaN }, container, 20)).toEqual({
      x: 0,
      scaleX: 1,
    });
  });
});
