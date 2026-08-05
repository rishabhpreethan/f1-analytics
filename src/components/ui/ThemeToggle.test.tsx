// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '@/lib/theme';
import { Monitor, Moon, Sun } from './icons';
import { ThemeToggle } from './ThemeToggle';

/**
 * Tests 64 and 66–69 of the F0 unit-test list.
 *
 * They exist because ruling R-2 makes this a **composite widget** rather than a button: a
 * screenshot cannot show that `↑` moves within a radiogroup without committing, that
 * `Esc` leaves the preference untouched, or that focus comes back to the trigger. Those
 * are exactly the behaviours that break silently.
 */

function mockSystemTheme(prefersDark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: prefersDark && query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

/**
 * The rendered glyph of an icon, captured from a detached container. Asserting on the
 * geometry is deliberate: the icons carry no title, id or class (§3.10), so there is
 * nothing else to identify them by — and a test that matched on a label would not notice
 * the icons being swapped.
 */
function glyphOf(node: ReactElement): string {
  const host = document.createElement('div');
  render(node, { container: host });
  return host.querySelector('svg')?.innerHTML ?? '';
}

function triggerGlyph(): string {
  return screen.getByRole('button').querySelector('svg')?.innerHTML ?? '';
}

/**
 * `aria-expanded` is the authoritative state and flips at once; the panel itself lingers
 * for M-5's exit (`dur.fast`) before `AnimatePresence` removes it. Both are asserted, in
 * that order, so a test cannot pass on a panel that never leaves the DOM.
 */
async function expectClosed(trigger: HTMLElement): Promise<void> {
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  await waitFor(() => {
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset[THEME_ATTRIBUTE];
  mockSystemTheme(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ThemeToggle', () => {
  it('is a 3-option radiogroup popover, not a cycle (test 64)', async () => {
    render(<ThemeToggle />);

    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('radiogroup')).toBeNull();

    // The trigger discloses a radiogroup, which is not one of the popup container roles
    // `aria-haspopup` may name (menu / listbox / tree / grid / dialog), so the attribute
    // is deliberately absent and `aria-controls` carries the relationship instead.
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
    expect(trigger.getAttribute('aria-controls')).toBe('theme-preference-group');

    await userEvent.click(trigger);

    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(group).toBeDefined();
    expect(group.id).toBe('theme-preference-group');
    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(3);
    expect(options.map((option) => option.textContent)).toEqual(['System', 'Light', 'Dark']);

    const checked = options.filter((option) => option.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    // The default preference is `system`, so that is the option checked on open.
    expect(checked[0]?.textContent).toBe('System');

    // Activating the trigger again closes it, and neither activation mutates anything: a
    // click on the trigger is not a way to change the theme.
    await userEvent.click(trigger);
    await expectClosed(trigger);
    await userEvent.click(trigger);
    expect(screen.getByRole('radiogroup')).toBeDefined();

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBeUndefined();
  });

  it('moves selection with the arrows without committing, and commits on Enter (test 66)', async () => {
    mockSystemTheme(true);
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole('button'));
    await userEvent.keyboard('{ArrowDown}');

    // Focus and aria-checked have moved to "Light" — and nothing is committed yet.
    const light = screen.getByRole('radio', { name: 'Light' });
    expect(light.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(light);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBeUndefined();

    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'System' }).getAttribute('aria-checked')).toBe('true');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();

    await userEvent.keyboard('{Enter}');
    await expectClosed(screen.getByRole('button'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    // "System" must resolve through the system setting — the attribute is never the
    // literal preference, because the CSS has no such state.
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBe('dark');
  });

  it('commits on Space as well as Enter (test 66)', async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole('button'));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');

    await userEvent.keyboard(' ');
    await expectClosed(screen.getByRole('button'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBe('dark');
  });

  it('Esc closes, changes nothing, and returns focus to the trigger (test 67)', async () => {
    render(<ThemeToggle />);
    const trigger = screen.getByRole('button');

    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Escape}');

    await expectClosed(trigger);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBeUndefined();
    expect(document.activeElement).toBe(trigger);
  });

  it('trigger icon reflects the preference, not the resolved theme (test 68)', async () => {
    // The system setting is dark throughout, so a component that confused preference with
    // resolution would show a moon for `system` and fail here.
    mockSystemTheme(true);

    const monitor = glyphOf(<Monitor size={20} />);
    const sun = glyphOf(<Sun size={20} />);
    const moon = glyphOf(<Moon size={20} />);
    expect(new Set([monitor, sun, moon]).size).toBe(3);
    cleanup();

    render(<ThemeToggle />);
    expect(triggerGlyph()).toBe(monitor);

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(triggerGlyph()).toBe(sun);

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(triggerGlyph()).toBe(moon);

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('radio', { name: 'System' }));
    expect(triggerGlyph()).toBe(monitor);
  });

  it('accessible name reports the preference and the resolved theme (test 69)', async () => {
    mockSystemTheme(true);
    render(<ThemeToggle />);

    // Asserted on the accessible name, not on inner text — the trigger has no text.
    expect(
      screen.getByRole('button', { name: 'Theme: System (currently dark). Change theme.' }),
    ).toBeDefined();

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));

    expect(
      screen.getByRole('button', { name: 'Theme: Light (currently light). Change theme.' }),
    ).toBeDefined();
  });
});
