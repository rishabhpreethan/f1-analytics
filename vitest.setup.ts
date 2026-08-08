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

/*
 * -------------------------------------------- 3. asyncUtilTimeout, the budget that binds
 *
 * **`testTimeout: 15_000` in `vite.config.ts` never applied to a `findBy*`.** Every
 * `findBy*` / `waitFor` is capped independently by `@testing-library/dom`'s
 * `asyncUtilTimeout`, whose default is **1000 ms** (`dist/config.js` line 15) and which
 * nothing in this repository had ever set. Whichever expires first wins, so the suite's
 * real per-assertion budget was 1 s while its configuration claimed 15 s — and the failure
 * it produces is *"Unable to find an element with the role…"*, which reads like a genuine
 * assertion failure rather than a timeout. That is why the earlier flake was diagnosed as
 * mount cost and answered by raising `testTimeout` from 5 s to 15 s: a change that, measured
 * now, could not have helped.
 *
 * **What is actually inside the bounded window, measured** — `render()` is synchronous, so
 * almost all of a mount's cost is outside it and covered by `testTimeout`. Instrumenting the
 * full `<App />` mount, under 16 busy processes on 8 cores (~3× oversubscription):
 *
 * ```
 *   landing, cold module graph   sync-render 319 ms   findBy 117 ms
 *   landing, warm                sync-render 207 ms   findBy  58 ms
 *   503, no retry                sync-render 200 ms   findBy 222 ms
 *   429, one retry               sync-render 618 ms   findBy 440 ms   ← the worst
 *   500, one retry               sync-render 204 ms   findBy 274 ms
 * ```
 *
 * The worst bounded window in the suite is therefore **440 ms against 1000 ms** — 2.3×
 * headroom on a machine at 3× load, which is the margin that was intermittently lost.
 *
 * The mechanism was confirmed rather than inferred: setting this to `1` fails
 * `RootLayout.test.tsx` with `TestingLibraryElementError: Unable to find role="heading"…`,
 * **not** a vitest timeout — which is what an intermittent CPU stall would have looked like,
 * and why it would not have been read as one. It fails **2 of 17 tests**, and those two are
 * exactly the failure-state tests above; the other 15, the whole route table included,
 * resolve on `findBy*`'s initial synchronous pass and never enter the wait at all.
 *
 * **5000 ms, and the two constraints that pick it.** It is ~11× the worst measurement, the
 * same kind of ratio `vite.config.ts` chose for `testTimeout`. And it stays *below*
 * `testTimeout`, deliberately: the inner budget must expire first, or a stuck assertion
 * surfaces as a bare test timeout instead of an error naming the element that never
 * appeared. Ordering these two numbers is most of the point of setting this at all.
 *
 * **Why this hides nothing** — the same argument `vite.config.ts` makes, applied to the knob
 * that was actually binding. No test in this suite asserts elapsed wall-clock time; the two
 * time-sensitive server suites drive `vi.useFakeTimers()`, the motion tests assert duration
 * *token values*, and `RootLayout.test.tsx` deliberately proves a retry happened via
 * `toHaveBeenCalledTimes` rather than by waiting. A genuinely stuck `waitFor` still fails,
 * 5 s later instead of 1 s. What this cannot do is turn a slow implementation green.
 *
 * **What was rejected, and why.** Cutting the number of `<App />` mounts in
 * `RootLayout.test.tsx` — the file mounts 19 times, not the 7 it looks like, since the route
 * table is 13 — does not address this: a warm mount contributes 58 ms to the bounded window,
 * so removing ten of them recovers ~0.6 s spread across ten separate assertions, none of
 * which was near the limit, while the three tests that *are* near it each already do the
 * minimum mounts their claim needs. Splitting the file is worse still: every additional
 * jsdom file pays its own environment (~334 ms) and import graph (~758 ms) and its own cold
 * mount. The cause is a 1 s cap, not a mount count, so those fix the wrong thing.
 *
 * Imported dynamically inside the `window` guard because this file is a setup file for
 * **every** test, and 50 of the 64 run in the `node` environment where a DOM library has no
 * business being loaded.
 */
if (typeof window !== 'undefined') {
  const { configure } = await import('@testing-library/dom');
  configure({ asyncUtilTimeout: 5_000 });
}
