/*
 * Pre-paint theme application.
 *
 * This is an EXTERNAL script on purpose. The CSP `script-src` is `'self'` with no
 * `'unsafe-inline'` (S-9), so an inline block in index.html would be a CSP violation,
 * not a shortcut. It is referenced from <head> synchronously — no defer, no async, no
 * type="module" — because a module script is deferred by specification and would still
 * flash the wrong theme. Do not "simplify" this back into index.html.
 *
 * It duplicates only the read-and-apply step. The storage key and the attribute name
 * are asserted identical to src/lib/theme.ts by a unit test, so the two cannot drift.
 */
(function () {
  var STORAGE_KEY = 'f1a.theme';
  var root = document.documentElement;
  var preference = 'system';

  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      preference = stored;
    }
  } catch (error) {
    // Storage can throw (Safari private mode). Fall through to 'system'.
    preference = 'system';
  }

  var resolved = preference;
  if (preference === 'system') {
    var query =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)');
    resolved = query && query.matches ? 'dark' : 'light';
  }

  root.dataset.theme = resolved;
})();
