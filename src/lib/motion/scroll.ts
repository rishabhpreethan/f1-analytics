import { ScrollTrigger } from './gsap';
import { dist, dur, ease, stagger } from './tokens';
import { useMotion, type MotionHandle } from './useMotion';

/**
 * The three scroll-linked motions — G-13, G-14, G-15 — as hooks, because each has to *create* a
 * `ScrollTrigger` and `gsap` may only be imported inside `src/lib/motion/**`
 * (`ARCHITECTURE.md` §10 #21).
 *
 * All three are built inside `useMotion`'s `animate` builder, which means **none of them exists
 * under reduced motion**: no trigger, no scroll listener, no tween. That is deliberate for each
 * of them and §4.6 states the reduced behaviour individually — G-13's border appears at the same
 * threshold via a CSS-driven attribute, G-14 is not rendered at all, and G-15's content is simply
 * already visible, because every reveal is authored `from` (MR-2).
 *
 * **`ScrollTrigger` instances are killed by the context**, not by hand: `useGSAP` reverts
 * everything created inside it, and a `ScrollTrigger` created in a context is included in that.
 * The one thing the context cannot know about is a trigger created *outside* it, which is why
 * nothing here creates one lazily in a handler.
 */

/**
 * **G-13 — the header hairline.** A 1px `--border-subtle` bottom edge fades in past 24px of
 * scroll, with a 96px `--accent-mark` segment growing `scaleX 0→1` from the left.
 *
 * `toggleActions: 'play none none reverse'` rather than `once: true`: scrolling back to the top
 * should remove the hairline again, because its whole job is to say "you are not at the top".
 *
 * The reduced variant is **not** this tween. `useScrollState` (`src/lib/useScrollState.ts`)
 * toggles `data-scrolled` on `<html>` at the same 24px threshold with no motion at all, and CSS
 * shows the border from it — which is why that hook is a plain listener rather than anything
 * built here: it has to work in the mode where nothing here is built.
 */
export function useHeaderHairline<T extends HTMLElement = HTMLElement>(): MotionHandle<T> {
  return useMotion<T>({
    animate: ({ q, tl }) => {
      tl.fromTo(
        q('[data-motion="hairline"]'),
        { opacity: 0 },
        { opacity: 1, duration: dur.fast, ease: ease.enter },
      ).fromTo(
        q('[data-motion="hairline-accent"]'),
        { scaleX: 0 },
        { scaleX: 1, duration: dur.base, ease: ease.enter },
        0,
      );

      /**
       * **The trigger is the document, not `root`.** `start: '24px top'` means "24px down the
       * trigger element has reached the top of the viewport", so it only reads as a scroll
       * threshold when the trigger is the document. `root` here is a 1px child of a
       * `position: sticky` header, which never leaves the top of the viewport — the threshold
       * then resolved against the header's own height instead of the scroll position, at some
       * value near 79px rather than 24px.
       *
       * `useScrollState` uses the same 24px figure for the reduced-motion path, and the two
       * must agree or the hairline appears at two different places depending on the
       * preference.
       */
      ScrollTrigger.create({
        trigger: document.documentElement,
        start: '24px top',
        animation: tl,
        toggleActions: 'play none none reverse',
      });
    },
  });
}

/**
 * **G-14 — the scroll progress bar.** `scaleX 0→1` scrubbed against the document, `ease.none`,
 * `transformOrigin: left`.
 *
 * **Not rendered at all under reduced motion** (§4.6) — a scroll-linked bar is inherently
 * motion, and document-level progress is not information the page needs. That decision is the
 * *caller's* to render, not this hook's to animate away: the caller checks `reduced` and returns
 * `null`, which is why `useMotion` exposes it.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>(): MotionHandle<T> {
  return useMotion<T>({
    animate: ({ root, tl }) => {
      tl.fromTo(root, { scaleX: 0 }, { scaleX: 1, ease: ease.none, duration: 1 });
      ScrollTrigger.create({
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        animation: tl,
      });
    },
  });
}

/**
 * **G-15 — reveal on scroll, once.** `opacity 0→1, y 16→0` at `dur.base`, children staggered
 * `stagger.card` and capped at `stagger.cap` — a 20-item stagger at 45ms would take 900ms and
 * break the 400ms interaction ceiling, so items past the twelfth get no delay.
 *
 * `once: true`: a section that re-animates every time it scrolls back into view is the single
 * most irritating scroll effect there is.
 *
 * Authored `from` (MR-2), so a section whose trigger never fires — reduced motion, a stalled
 * chunk, `ScrollTrigger` failing to measure — is simply *visible*. An `opacity: 0` resting state
 * here would mean an empty page.
 */
export function useSectionReveal<T extends HTMLElement = HTMLElement>(): MotionHandle<T> {
  return useMotion<T>({
    animate: ({ root, q, tl }) => {
      const children = q('[data-motion="reveal-item"]');
      const targets = children.length > 0 ? children : [root];

      tl.from(targets, {
        opacity: 0,
        y: dist.section,
        duration: dur.base,
        ease: ease.enter,
        stagger: {
          each: stagger.card.each,
          from: stagger.card.from,
          amount: staggerAmount(targets.length, stagger.card.each),
        },
      });

      ScrollTrigger.create({
        trigger: root,
        start: 'top 88%',
        once: true,
        animation: tl,
      });
    },
  });
}

/**
 * **The axis-anchored growth rule (§6.1), on the bars of the coverage ruler** — Design Spec
 * §3.5's `Reveal` row, and the first real instance of a rule that every chart from F2 onward
 * inherits.
 *
 * `scaleX 0→1` from `transformOrigin: 'right'` at `dur.chart` / `ease.mech`, staggered
 * `stagger.bar`. **The origin is the right edge because that is where the bars are anchored**:
 * every coverage window is open-ended, so it ends at "now" and grows leftward into the past.
 * A bar that grew from the left would animate its *start year* moving, which is the opposite of
 * what it means.
 *
 * `transformOrigin` is in the tween rather than in CSS — unlike `.popover-panel`, where the
 * origin is a property of where the panel is anchored. Here it is a property of the rule, and
 * the rule is what F2 will reuse; the resting CSS needs no origin at all, because at `scaleX: 1`
 * it makes no difference.
 *
 * Its own `ScrollTrigger`, not G-15's: the bars only exist once `/api/meta` has resolved, and
 * G-15's trigger is `once: true` and has usually already fired by then. Mounting this with the
 * component that renders the bars is what makes the timing correct without giving G-15 a
 * dependency array that would replay the section's text.
 *
 * Authored `from` (MR-2), so a bar whose trigger never fires — reduced motion, a stalled chunk —
 * is simply at full width and correct.
 */
export function useAxisAnchoredBars<T extends HTMLElement = HTMLElement>(): MotionHandle<T> {
  return useMotion<T>({
    animate: ({ root, q, tl }) => {
      const bars = q('[data-motion="ruler-bar"]');
      if (bars.length === 0) return undefined;

      tl.from(bars, {
        scaleX: 0,
        transformOrigin: 'right',
        duration: dur.chart,
        ease: ease.mech,
        stagger: {
          each: stagger.bar.each,
          from: stagger.bar.from,
          amount: staggerAmount(bars.length, stagger.bar.each),
        },
      });

      ScrollTrigger.create({
        trigger: root,
        start: 'top 88%',
        once: true,
        animation: tl,
      });

      return undefined;
    },
  });
}

/**
 * The `stagger.cap` rule, expressed the way GSAP wants it. `amount` distributes a *total* delay
 * across the targets, so capping the total at `cap × each` gives items past the cap a shrinking
 * share rather than a growing queue — which is what keeps a long list inside the budget.
 */
export function staggerAmount(count: number, each: number): number {
  return Math.min(count, stagger.cap) * each;
}

/**
 * `ScrollTrigger.refresh()` — the one thing a route change requires, because route content
 * changes document height and every trigger's start/end is measured from it (§S.6.3).
 *
 * Called by the shell after the route transition commits. A no-op when no trigger exists, which
 * is the reduced-motion case.
 */
export function refreshScrollTriggers(): void {
  ScrollTrigger.refresh();
}
