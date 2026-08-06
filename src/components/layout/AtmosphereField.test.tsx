// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AtmosphereField } from './AtmosphereField';

/**
 * CT-18. Two properties, both invisible in a screenshot:
 *
 *   1. **At `off` the animated layers are not in the DOM.** Paused is not good enough — a
 *      paused compositor layer still holds its memory, and `off` is the state that shares a
 *      screen with F3's lap-time chart (§10 #24).
 *   2. **It is inert to assistive technology and to the pointer, in every mode.** It is
 *      decorative, it contains no text, and it must never be able to swallow a click.
 */

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AtmosphereField />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe('CT-18 — AtmosphereField', () => {
  it('renders the full field on the landing route', () => {
    const { container } = renderAt('/');
    expect(container.querySelectorAll('.atmosphere-layer').length).toBeGreaterThan(0);
    expect(container.querySelector('.atmosphere-dots')).not.toBeNull();
    expect(container.querySelector('.atmosphere-lamp')).not.toBeNull();
    expect(container.querySelector('.atmosphere-grain')).not.toBeNull();
    expect(container.querySelector('.atmosphere-vignette')).not.toBeNull();
    // The veil is the field's only attenuation control (§7.7.2). Without it every route would
    // render at hero intensity, including F2's data surfaces.
    expect(container.querySelector('.atmosphere-veil')).not.toBeNull();
    // Layer 3 is hero-only.
    expect(container.querySelector('.atmosphere-line')).not.toBeNull();
    expect(container.querySelectorAll('.atmosphere-comet').length).toBeGreaterThan(0);
    // The retired layers must not come back by copy-paste from the archive.
    expect(container.querySelector('.atmosphere-grid')).toBeNull();
    expect(container.querySelectorAll('.atmosphere-orb')).toHaveLength(0);
    expect(container.querySelector('.atmosphere-plate')).toBeNull();
  });

  it('paints the lamp above the veil, so the field still answers the pointer when attenuated', () => {
    /*
     * The reason there are two lattice layers rather than one masked one. The veil attenuates the
     * resting field per route; the lamp must survive it, or a data surface would have a background
     * that does not respond at all — and Rishabh asked for *the application* to feel alive, not the
     * landing page. Its ceiling there is `--bg-lamp-max`, not the veil.
     *
     * Both are in the same stacking context with no z-index, so **DOM order is the mechanism** and
     * this is the assertion that guards it. A tidy-up that grouped the two lattice layers together
     * would silently switch the lamp off everywhere except the hero.
     */
    const { container } = renderAt('/records');
    const layers = [...container.querySelectorAll('.atmosphere-layer')].map(
      (node) => node.className,
    );
    const veil = layers.findIndex((name) => name.includes('atmosphere-veil'));
    const lamp = layers.findIndex((name) => name.includes('atmosphere-lamp'));
    const dots = layers.findIndex((name) => name.includes('atmosphere-dots'));

    expect(dots).toBeGreaterThanOrEqual(0);
    expect(dots).toBeLessThan(veil);
    expect(lamp).toBeGreaterThan(veil);
  });

  it('drops the racing line on a calm route but keeps the composed field', () => {
    const { container } = renderAt('/records');
    expect(container.querySelector('.atmosphere-line')).toBeNull();
    expect(container.querySelector('.atmosphere-comet')).toBeNull();
    expect(container.querySelector('.atmosphere-dots')).not.toBeNull();
    expect(container.querySelector('.atmosphere-lamp')).not.toBeNull();
    expect(container.querySelector('.atmosphere-vignette')).not.toBeNull();
    expect(container.querySelector('.atmosphere-veil')).not.toBeNull();
  });

  it('renders no animated layer at all on the race deep dive', () => {
    const { container } = renderAt('/seasons/2024/races/3');
    expect(container.querySelectorAll('.atmosphere-layer')).toHaveLength(0);
    expect(container.querySelector('.atmosphere-dots')).toBeNull();
    expect(container.querySelector('.atmosphere-lamp')).toBeNull();
    expect(container.querySelector('.atmosphere-line')).toBeNull();
    // The container itself survives, carrying only the flat base surface.
    expect(container.querySelector('.atmosphere')).not.toBeNull();
  });

  it('is inert in every mode', () => {
    for (const pathname of ['/', '/records', '/seasons/2024/races/3']) {
      const { container } = renderAt(pathname);
      const root = container.querySelector('.atmosphere');
      expect(root?.getAttribute('aria-hidden'), pathname).toBe('true');
      expect(root?.getAttribute('role'), pathname).toBe('presentation');
      // No text, so nothing for a screen reader to read even if `aria-hidden` were lost.
      expect(root?.textContent, pathname).toBe('');
      // Nothing focusable, so it cannot appear in the tab order.
      expect(
        container.querySelectorAll('a, button, input, select, textarea, [tabindex]').length,
        pathname,
      ).toBe(0);
      cleanup();
    }
  });

  it('exposes exactly one lamp layer, and gives GSAP no transform to fight over', () => {
    /*
     * The contract between the markup and `useAtmosphereLamp`. Two properties, both invisible in a
     * screenshot:
     *
     *   1. **One lamp.** Two would double the light and beat against each other as they drifted.
     *   2. **GSAP writes only custom properties, on the root** — never a `transform` on a layer.
     *      Both lattice layers carry a CSS `transform` animation (G-18), and MR-1's whole point is
     *      that the two mechanisms never own the same property on the same element. The previous
     *      G-21 relied on a comment for this; this asserts it.
     */
    const { container } = renderAt('/');
    const hooks = container.querySelectorAll('[data-motion="lamp"]');
    expect(hooks).toHaveLength(1);
    expect(hooks[0]?.classList.contains('atmosphere-lamp')).toBe(true);
    expect(container.querySelectorAll('[data-motion="dots"]')).toHaveLength(1);
  });

  it('holds the racing-line geometry once, shared by the stroke and the comet path', () => {
    // One constant (Design Spec §11.1). If the stroke's `d` and the comet's `offset-path`
    // could diverge, the comet would leave the line — and only at some viewport sizes.
    const { container } = renderAt('/');
    const stroke = container.querySelector('.atmosphere-line-stroke')?.getAttribute('d');
    const layer = container.querySelector<HTMLElement>('.atmosphere-line')?.parentElement;
    const offsetPath = layer?.style.getPropertyValue('--atmosphere-line-path');

    expect(stroke).toBeTruthy();
    expect(offsetPath).toBe(`path("${String(stroke)}")`);
  });
});
