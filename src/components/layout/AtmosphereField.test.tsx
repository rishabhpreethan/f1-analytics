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
    expect(container.querySelector('.atmosphere-grid')).not.toBeNull();
    expect(container.querySelectorAll('.atmosphere-orb')).toHaveLength(3);
    expect(container.querySelector('.atmosphere-grain')).not.toBeNull();
    // The plate is what keeps every §9.2 V-2 contrast figure true over a moving field
    // (V-13 / V-17). Removing it is an accessibility regression, not a simplification.
    expect(container.querySelector('.atmosphere-plate')).not.toBeNull();
    // Layer 3 is hero-only.
    expect(container.querySelector('.atmosphere-line')).not.toBeNull();
    expect(container.querySelectorAll('.atmosphere-comet').length).toBeGreaterThan(0);
  });

  it('drops the racing line on a calm route but keeps the composed field', () => {
    const { container } = renderAt('/records');
    expect(container.querySelector('.atmosphere-line')).toBeNull();
    expect(container.querySelector('.atmosphere-comet')).toBeNull();
    expect(container.querySelectorAll('.atmosphere-orb')).toHaveLength(3);
    expect(container.querySelector('.atmosphere-grid')).not.toBeNull();
    expect(container.querySelector('.atmosphere-plate')).not.toBeNull();
  });

  it('renders no animated layer at all on the race deep dive', () => {
    const { container } = renderAt('/seasons/2024/races/3');
    expect(container.querySelectorAll('.atmosphere-layer')).toHaveLength(0);
    expect(container.querySelectorAll('.atmosphere-orb')).toHaveLength(0);
    expect(container.querySelector('.atmosphere-grid')).toBeNull();
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

  it('exposes the orb layer G-21 transforms, and only the orb layer', () => {
    // The contract between the markup and `useAtmosphereParallax`. If this attribute moves or
    // disappears the parallax silently stops existing — which is exactly how it came to be
    // missing in the first place. Only the orbs may carry it: the grid, the racing line, the
    // grain and the plate must not parallax, or the effect reads as the page sliding rather
    // than as depth (§7.7 layer 2).
    const { container } = renderAt('/');
    const hooks = container.querySelectorAll('[data-motion="orbs"]');
    expect(hooks).toHaveLength(1);
    expect(hooks[0]?.classList.contains('atmosphere-orbs')).toBe(true);
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
