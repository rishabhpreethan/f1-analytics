// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtmlSource from '../../index.html?raw';
import themeInitSource from '../../public/theme-init.js?raw';
import {
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  applyTheme,
  readThemePreference,
  resolveTheme,
  setThemePreference,
} from './theme';

/**
 * Tests 49–55 of the F0 unit-test list.
 *
 * The model is **three-valued** (`light | dark | system`) and every test below exercises
 * it as three values rather than as a binary with a modifier (ruling R-2). The two facts
 * worth defending mechanically: `system` is the default, which is what makes a first-time
 * visitor follow `prefers-color-scheme`; and the **resolved** theme is the only thing that
 * ever reaches the DOM, because the CSS has no `system` state.
 */

/*
 * The two repository files are pulled in with Vite's `?raw` import rather than read with
 * `node:fs`: the client TypeScript project deliberately carries no Node globals, and a
 * drift test should not be the reason to add them. The import also means a *renamed* or
 * deleted file fails the build instead of failing an assertion at runtime.
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

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset[THEME_ATTRIBUTE];
  mockSystemTheme(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('readThemePreference', () => {
  it('is "system" when nothing is stored — the reason first load follows the OS', () => {
    expect(readThemePreference()).toBe('system');
  });

  it('is "system" for anything that is not one of the three values', () => {
    // Near misses matter: a stored value that merely looks plausible must not be honoured.
    for (const stored of ['auto', 'Dark', '{}', '', 'light ', 'DARK', 'true', '0']) {
      window.localStorage.setItem(THEME_STORAGE_KEY, stored);
      expect(readThemePreference()).toBe('system');
    }
  });

  it('round-trips each of the three real values', () => {
    for (const preference of ['light', 'dark', 'system'] as const) {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
      expect(readThemePreference()).toBe(preference);
    }
  });
});

describe('resolveTheme', () => {
  it('maps all three preferences, and consults the system setting in both directions', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');

    mockSystemTheme(true);
    expect(resolveTheme('system')).toBe('dark');

    mockSystemTheme(false);
    expect(resolveTheme('system')).toBe('light');
  });

  it('resolves to light when matchMedia is unavailable (E19)', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveTheme('system')).toBe('light');
  });
});

describe('applyTheme', () => {
  it('writes the resolved theme to <html data-theme>, never the literal "system"', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBe('light');

    mockSystemTheme(true);
    setThemePreference('system');
    // The CSS has no `system` state, so writing the preference here would unstyle the
    // page. The attribute must carry what `system` resolved to.
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBe('dark');
  });
});

describe('setThemePreference', () => {
  it('persists each of the three values and applies the theme each one resolves to', () => {
    mockSystemTheme(true);

    setThemePreference('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBe('light');

    setThemePreference('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBe('dark');

    setThemePreference('system');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBe('dark');
  });

  it('survives storage that throws — the control still works without persistence', () => {
    // Safari private mode throws on both. Persistence is a nicety; applying the theme is
    // the job, and neither call may propagate.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage is not available');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage is not available');
    });

    expect(() => readThemePreference()).not.toThrow();
    expect(readThemePreference()).toBe('system');
    expect(() => {
      setThemePreference('dark');
    }).not.toThrow();
    expect(document.documentElement.dataset[THEME_ATTRIBUTE]).toBe('dark');
  });
});

describe('public/theme-init.js', () => {
  it('uses the same storage key and attribute as lib/theme.ts, so the two cannot drift', () => {
    // The pre-paint script duplicates the read-and-apply step by necessity — it must run
    // before the bundle to avoid a flash of the wrong theme. A drift between the two
    // would be invisible in code review and obvious to a user.
    const source = themeInitSource;

    expect(source).toContain(`'${THEME_STORAGE_KEY}'`);
    expect(source).toContain(`dataset.${THEME_ATTRIBUTE}`);
    expect(source).toContain('(prefers-color-scheme: dark)');
    // All three preference values are recognised, and the fallback is `system`.
    for (const preference of ['light', 'dark', 'system']) {
      expect(source).toContain(`'${preference}'`);
    }
  });

  it('is loaded synchronously from index.html — a deferred script would still flash', () => {
    const tag = /<script[^>]*src="\/theme-init\.js"[^>]*>/.exec(indexHtmlSource);
    expect(tag).not.toBeNull();
    expect(tag?.[0]).not.toContain('defer');
    expect(tag?.[0]).not.toContain('async');
    expect(tag?.[0]).not.toContain('type="module"');
  });
});
