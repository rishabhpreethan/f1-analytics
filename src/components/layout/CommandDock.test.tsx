// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommandDock } from './CommandDock';
import { DOCK_STORAGE_KEY } from './dockPreference';
import { NAV_ITEMS } from './navItems';

/**
 * CT-19, plus the parts of Design Spec §5 and §10 that only exist in a tree: exactly one
 * `nav[aria-label="Primary"]`, exactly one `aria-current`, a real focus trap in the overflow
 * sheet, and a pin that persists.
 *
 * **What these tests cannot cover, and nothing else in this project can either:** whether the
 * rail's glyphs stay put as it expands, and whether the indicator lands on the right item.
 * jsdom has no layout, so `getBoundingClientRect()` is all zeroes and G-3's measured geometry is
 * degenerate by construction — which is exactly why `computeIndicatorGeometry` is tested
 * separately as arithmetic (CT-12) and why the degenerate case returns identity rather than
 * `NaN`. The visual result reaches Rishabh's review or nobody (CR-006).
 */

function renderDock(pathname = '/') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <CommandDock items={NAV_ITEMS} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('CT-19 — the dock renders one link per destination and one active item', () => {
  it('is a single named nav landmark', () => {
    renderDock();
    // §7.8 and §10: exactly one. Two would be reported twice by a screen reader's landmark
    // list, and the previous build's split-component nav was one refactor away from it.
    expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(1);
  });

  it('renders every destination, in order', () => {
    renderDock();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(NAV_ITEMS.length);
    expect(links.map((link) => link.textContent)).toEqual(NAV_ITEMS.map((item) => item.label));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      NAV_ITEMS.map((item) => item.to),
    );
  });

  it('marks exactly one item current, and marks the right one', () => {
    for (const [pathname, label] of [
      ['/', 'Home'],
      ['/seasons/2024', 'Season'],
      ['/drivers/max_verstappen', 'Drivers'],
      ['/records', 'Records'],
    ] as const) {
      renderDock(pathname);
      const current = screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page');
      expect(current, pathname).toHaveLength(1);
      expect(current[0]?.textContent, pathname).toBe(label);
      cleanup();
    }
  });

  it('carries aria-current as well as the accent wash — colour is never the only signal', () => {
    renderDock('/records');
    const active = screen.getByRole('link', { name: 'Records' });
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(active.className).toContain('dock-item-active');
  });

  it('has no dead control: every item resolves to a real href', () => {
    renderDock();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^\/[a-z]*$/);
      expect(link.hasAttribute('aria-disabled')).toBe(false);
    }
  });
});

describe('the overflow sheet (G-5)', () => {
  it('opens from More, lists all seven destinations, and closes on Escape', async () => {
    renderDock('/');
    const more = screen.getByRole('button', { name: 'More destinations' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');

    await userEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');

    const sheet = screen.getByRole('dialog', { name: 'Go to' });
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    // All seven, not just the three the dock had no room for: someone who opens "More" is
    // asking where they can go (Design Spec §5.3).
    expect(sheet.querySelectorAll('a')).toHaveLength(NAV_ITEMS.length);

    await userEvent.keyboard('{Escape}');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    // Focus returns to the trigger synchronously — a keyboard user does not wait for a tween.
    expect(document.activeElement).toBe(more);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('moves focus into the sheet and traps Tab inside it', async () => {
    renderDock('/');
    await userEvent.click(screen.getByRole('button', { name: 'More destinations' }));

    const sheet = screen.getByRole('dialog', { name: 'Go to' });
    const focusable = [...sheet.querySelectorAll<HTMLElement>('a, button')];
    expect(focusable.length).toBeGreaterThan(1);
    expect(document.activeElement).toBe(focusable[0]);

    // Backwards from the first lands on the last, not outside the dialog.
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(focusable.at(-1));

    // Forwards from the last comes back to the first.
    await userEvent.tab();
    expect(document.activeElement).toBe(focusable[0]);
  });

  it('closes when a destination is chosen, rather than staying open over the new page', async () => {
    renderDock('/');
    await userEvent.click(screen.getByRole('button', { name: 'More destinations' }));
    const sheet = screen.getByRole('dialog', { name: 'Go to' });

    await userEvent.click(sheet.querySelectorAll('a')[3] as HTMLElement);
    expect(
      screen.getByRole('button', { name: 'More destinations' }).getAttribute('aria-expanded'),
    ).toBe('false');
  });
});

describe('the pin (Design Spec §5.2)', () => {
  it('defaults to auto, reflects state in aria-pressed, and persists', async () => {
    renderDock('/');
    const pin = screen.getByRole('button', { name: 'Keep menu open' });
    expect(pin.getAttribute('aria-pressed')).toBe('false');
    expect(window.localStorage.getItem(DOCK_STORAGE_KEY)).toBeNull();

    await userEvent.click(pin);

    // The label describes the *action*, which is what a toggle's name should do.
    const unpin = screen.getByRole('button', { name: 'Collapse menu' });
    expect(unpin.getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem(DOCK_STORAGE_KEY)).toBe('pinned');
  });

  it('reads a stored preference on mount and ignores a corrupt one', () => {
    window.localStorage.setItem(DOCK_STORAGE_KEY, 'pinned');
    renderDock('/');
    expect(screen.getByRole('button', { name: 'Collapse menu' })).toBeDefined();
    cleanup();

    // A near-miss string must not be honoured by accident.
    window.localStorage.setItem(DOCK_STORAGE_KEY, 'true');
    renderDock('/');
    expect(screen.getByRole('button', { name: 'Keep menu open' })).toBeDefined();
  });

  it('expands the rail on focus, so a keyboard user always sees the labels', async () => {
    renderDock('/');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.getAttribute('data-expanded')).toBe('false');

    await userEvent.tab();
    expect(nav.getAttribute('data-expanded')).toBe('true');
  });
});
