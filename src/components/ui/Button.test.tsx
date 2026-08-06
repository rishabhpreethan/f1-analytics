// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `ScrollTrigger.register()` reads `window.matchMedia` at module evaluation of `lib/motion/gsap`,
 * which happens before any `beforeEach`. `vi.hoisted` is the only place a stub lands early
 * enough. `matches: false` throughout means "no stated preference", so motion is permitted —
 * which is the mode these assertions are about.
 */
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (media: string) => ({
      matches: media.includes('pointer: fine'),
      media,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

import { gsap } from '@/lib/motion/gsap';
import { ButtonLink } from './Button';

/**
 * **G-7 must survive G-9.** `ButtonLink` used to *choose* between the two scope refs, so the one
 * magnetic element in the product — the landing hero's primary CTA, the most-clicked thing on
 * the page — had no press feedback at all. The stated reason was that `overwrite: 'auto'` would
 * make the two fight; that is wrong, because auto-overwrite only kills conflicting tweens of the
 * **same property**, and G-9 writes `x`/`y` while G-7 writes `scale`.
 *
 * Asserted through `gsap.getTweensOf`, not through a rendered transform: `gsap.to` registers its
 * tween synchronously but renders on the next tick, so the tween's existence is the deterministic
 * fact and the rendered value is not. A test that waited for a frame here would be exactly the
 * kind of flake this suite cannot afford.
 */

function renderLink(magnetic: boolean) {
  render(
    <MemoryRouter>
      <ButtonLink to="/seasons" magnetic={magnetic}>
        Explore
      </ButtonLink>
    </MemoryRouter>,
  );
  return screen.getByRole('link', { name: 'Explore' });
}

/** The properties GSAP is currently tweening on `element`. */
function tweeningProperties(element: HTMLElement): string[] {
  return gsap.getTweensOf(element).flatMap((tween) => Object.keys(tween.vars));
}

afterEach(() => {
  cleanup();
  gsap.globalTimeline.clear();
});

describe('ButtonLink — G-7’s press feedback', () => {
  it('presses on a plain link', () => {
    const link = renderLink(false);
    fireEvent.pointerDown(link);
    expect(tweeningProperties(link)).toContain('scale');
  });

  it('presses on the magnetic link too — G-9 does not replace G-7', () => {
    const link = renderLink(true);
    fireEvent.pointerDown(link);
    expect(tweeningProperties(link)).toContain('scale');
  });

  it('releases the press and returns the magnet on pointerleave', () => {
    // Both hooks define `onPointerLeave`, so a spread would silently drop one. The magnet must
    // go back to zero *and* the press must release — a pointer that leaves mid-press must not
    // leave the control visually held down, and must not leave it displaced either.
    const link = renderLink(true);
    fireEvent.pointerDown(link);
    fireEvent.pointerLeave(link);

    const properties = tweeningProperties(link);
    expect(properties).toContain('scale');
    expect(properties).toContain('x');
    expect(properties).toContain('y');
  });
});
