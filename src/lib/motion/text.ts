import { SplitText } from './gsap';
import { dur, m, stagger } from './tokens';
import { useMotion, type MotionHandle } from './useMotion';

/**
 * The two entrance motions that operate on text — G-16 and G-17.
 *
 * Both belong to the **first-paint entrance budget** (§4.2: 1100ms total, 900ms per tween), not
 * the 400ms interaction ceiling. That exemption exists on one condition, and both satisfy it:
 * the content is present and readable in the DOM from frame one, so this is an entrance and never
 * a gate. Neither replays on a second visit to the route.
 */

/**
 * **G-16 — the landing headline.** `SplitText` by chars and lines, masked by line, then
 * `from({ yPercent: 118, opacity: 0 })` staggered per character.
 *
 * Four details that are correctness, not polish:
 *
 *   - **`aria: 'auto'`, never `'none'`.** Verified in the 3.15.0 source: `auto` puts the original
 *     text in an `aria-label` on the parent and `aria-hidden` on every fragment, which is the
 *     entire reason a split headline is still readable to a screen reader. `'none'` would leave
 *     nine `<div>`s of single characters as the accessible name of the page's `h1`.
 *   - **`autoSplit: true` is mandatory whenever `type` includes lines** — also verified in
 *     source: it is what registers the `document.fonts` `loadingdone` listener that re-splits.
 *     Without it a line split is measured against the fallback font and stays wrong once the
 *     vendored `woff2` faces arrive, which on this product is *always*, because the faces are
 *     self-hosted and arrive after first paint.
 *   - **`mask: 'lines'`** uses SplitText 3.13+'s own clip wrappers rather than hand-nested
 *     `overflow: hidden` divs. Fewer elements, and the wrappers are reverted with the split.
 *   - **No split is performed at all under reduced motion.** `animate` is where the split is
 *     created, so under `reduce` the `h1` is untouched plain text — which is both the correct
 *     reduced behaviour (§4.6) and the reason the DOM is not churned for nothing.
 *
 * The split is reverted by the GSAP context on unmount, so the `h1` returns to plain text and
 * cannot leak fragments into a later route.
 */
export function useHeadlineReveal<T extends HTMLElement = HTMLHeadingElement>(): MotionHandle<T> {
  return useMotion<T>({
    animate: ({ root, tl }) => {
      const split = SplitText.create(root, {
        type: 'chars,lines',
        mask: 'lines',
        aria: 'auto',
        autoSplit: true,
      });

      tl.from(split.chars, {
        yPercent: 118,
        opacity: 0,
        ...m.reveal,
        stagger: stagger.char,
      });

      // The context reverts the split on unmount, but `autoSplit` re-splits on a font load and a
      // revert while that listener is live would leave the tween pointing at dead nodes.
      return () => {
        split.revert();
      };
    },
  });
}

/**
 * **G-17 — the stat-figure count-up.** Each figure element carries `data-countup` and its target
 * in `data-countup-to`; the tween runs a proxy object and writes `textContent` on update.
 *
 * **The element's rendered text is already the final value**, so this is authored as a
 * count-*up-to-what-is-already-there* rather than a count-up-from-nothing (MR-2). Under reduced
 * motion, a thrown error, or a stalled chunk, the correct figure is simply on screen.
 *
 * **No `setState` in `onUpdate`** (R-G5). Sixty React renders a second on a page that will hold
 * charts from F2 is a performance defect; GSAP writes the DOM directly and React never learns.
 *
 * Safe only because every figure is Chivo Mono with `tabular-nums` (§2.4) — in a proportional
 * font the strip would reflow on every frame.
 */
export function useCountUp<T extends HTMLElement = HTMLDivElement>(
  deps: unknown[],
): MotionHandle<T> {
  return useMotion<T>({
    animate: ({ q, tl }) => {
      for (const [index, element] of q('[data-countup]').entries()) {
        const target = Number(element.dataset.countupTo);
        if (!Number.isFinite(target)) continue;

        const proxy = { value: 0 };
        tl.to(
          proxy,
          {
            value: target,
            duration: dur.reveal,
            ease: 'power2.out',
            snap: { value: 1 },
            onUpdate: () => {
              element.textContent = String(proxy.value);
            },
          },
          index * stagger.card.each,
        );
      }
    },
    deps,
  });
}
