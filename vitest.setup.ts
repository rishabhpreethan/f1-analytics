/**
 * Two test-environment prerequisites, in one place. **Neither changes product behaviour** —
 * both exist because jsdom implements less of the DOM than GSAP assumes, and the
 * alternative in each case would be to weaken a real assertion.
 *
 * **jsdom implements no media-query engine, so `window.matchMedia` does not exist**
 * (probed: `typeof window.matchMedia === 'undefined'` under `jsdom@26` / `vitest@4`).
 * Every module in `src/` copes with that on its own — `prefersReducedMotion()` treats an
 * absent `matchMedia` as "no stated preference", and `useMotion` falls through to the
 * permitted branch (Technical Spec §S.5) — but **`ScrollTrigger.register()` does not**: it
 * calls `gsap.matchMedia()` unconditionally, and registration happens at *module
 * evaluation* of `src/lib/motion/gsap.ts`, which is before any `beforeEach` in any test
 * file can run.
 *
 * So the stub has to exist before the first import, which is what a setup file is. The
 * alternative — making `gsap.ts` register `ScrollTrigger` conditionally — would mean the
 * production plugin set differed from the tested one, which is worse than a four-line
 * polyfill.
 *
 * It answers `false` to everything, i.e. **no stated preference**, which is the same
 * default the production code assumes when the API is missing. Tests that care replace it
 * with `vi.stubGlobal`.
 */

/*
 * ---------------------------------------------------------------------- 1. matchMedia
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (media: string) => ({
      matches: false,
      media,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

/*
 * ------------------------------------------------------- 2. offsetParent, and why focus
 *
 * **jsdom has no layout engine, and GSAP moves the DOM when it cannot measure.**
 *
 * `CSSPlugin._getMatrix` (gsap 3.15.0, `CSSPlugin.js` ~line 719) takes a documented
 * fallback path when the computed transform is the identity matrix **and** the target
 * reports no `offsetParent` **and** `getBoundingClientRect().width` is 0 — the case a real
 * browser only reaches for a `display: none` subtree. It then **appends the target to
 * `<html>`, reads the matrix, and puts it back**. In jsdom every element satisfies that
 * condition, always, because `offsetParent` is hard-coded `null` and every rect is empty.
 *
 * The visible consequence is not a wrong transform: it is that detaching and reattaching a
 * node resets `document.activeElement` to `<body>` — with no `blur` event, so nothing
 * observable explains it. Any test that presses a control (G-7 tweens `scale`, which is a
 * transform) and then asserts on focus or dispatches a key would fail, and it would look
 * exactly like a focus-management defect in the component. It is not one: in a real browser
 * `_getMatrix` reads `getComputedStyle` and never touches the DOM.
 *
 * Reporting a truthful `offsetParent` for a connected element is the smallest fix that
 * removes the cause rather than the symptom — and it is what a browser would report. Faking
 * `getBoundingClientRect` was rejected: it would silently supply geometry to code that is
 * supposed to measure real geometry (`computeIndicatorGeometry`), which would make a future
 * test pass for the wrong reason.
 */
if (typeof window !== 'undefined' && typeof HTMLElement !== 'undefined') {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
  if (descriptor?.get !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get(this: HTMLElement): Element | null {
        // `position: fixed` and detached elements genuinely have none, in a browser too.
        if (!this.isConnected) return null;
        return this === document.body ? null : document.body;
      },
    });
  }
}
