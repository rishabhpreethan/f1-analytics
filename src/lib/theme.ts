/**
 * The theme model is **three-valued**: `light | dark | system`, defaulting to `system`.
 * That is what makes a first-time visitor follow `prefers-color-scheme`, which is an F0
 * acceptance criterion — and it is why the control is a radiogroup rather than a flip
 * (ruling R-2). A binary toggle cannot express `system`.
 *
 * The **resolved** theme is what reaches the DOM. `<html data-theme>` is only ever
 * `light` or `dark`; the CSS has no `system` state, so writing the preference to the
 * attribute would silently unstyle the page.
 *
 * `public/theme-init.js` duplicates the read-and-apply step so it can run before first
 * paint (an inline block would violate `script-src 'self'` — S-9). It shares this
 * module's storage key and attribute name, and a unit test reads the file and asserts
 * that, so the two cannot drift.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'f1a.theme';

/**
 * The `dataset` key on `<html>` — i.e. the `data-theme` attribute. Named here so the
 * drift test has one thing to compare against.
 */
export const THEME_ATTRIBUTE = 'theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Radiogroup order (Design Spec §5.2): System, Light, Dark. */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * `matchMedia` is absent in some embedded webviews and in a bare jsdom, so it is never
 * assumed. Absent means "no opinion", which resolves to light (E19).
 */
function darkMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(DARK_QUERY);
  } catch {
    return null;
  }
}

/**
 * Absent, unreadable or corrupt storage all mean `system` — never a crash, and never a
 * near-miss string honoured by accident (`'auto'`, `'Dark'`, `'{}'` are all rejected).
 */
export function readThemePreference(): ThemePreference {
  try {
    const stored: unknown = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    // Storage throws in Safari private mode. The control still works for the session.
    return 'system';
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference;
  return darkMediaQuery()?.matches === true ? 'dark' : 'light';
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset[THEME_ATTRIBUTE] = theme;
}

/** Persist the preference and apply the theme it resolves to. */
export function setThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Persistence is a nicety; applying the theme is the job.
  }
  applyTheme(resolveTheme(preference));
}

/**
 * Keeps `system` live while the tab is open: changing the OS setting changes the app
 * (`DESIGN_SYSTEM.md` §10). Returns an unsubscribe function, and is a no-op when
 * `matchMedia` is unavailable.
 */
export function subscribeToSystemTheme(callback: (theme: ResolvedTheme) => void): () => void {
  const query = darkMediaQuery();
  if (query === null) return () => undefined;

  const listener = (event: MediaQueryListEvent) => {
    callback(event.matches ? 'dark' : 'light');
  };
  query.addEventListener('change', listener);
  return () => {
    query.removeEventListener('change', listener);
  };
}
