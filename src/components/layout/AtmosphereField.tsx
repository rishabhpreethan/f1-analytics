import type { CSSProperties } from 'react';
import { useLocation } from 'react-router';
import { backdropIntensityFor } from '@/components/layout/backdrop';
import { useAtmosphereLamp } from '@/lib/motion/interactions';

/**
 * The background — `DESIGN_SYSTEM.md` §7.7.
 *
 * **Rebuilt 2026-08-06.** The three blurred gradient orbs, the 48px grid and the contrast plate
 * are gone; a two-density dot lattice, a pointer lamp, a vignette and a single attenuation veil
 * replace them. `backdrop.css` carries the reasoning at length — the short version is that a large
 * soft gradient has no edge for the eye to register motion against, so it cannot read as alive,
 * and the plate existed only to undo the contrast damage the orbs caused.
 *
 * **Rendered once, by `AppShell`, as its first child.** It is outside the router outlet, so it
 * never remounts on navigation and never cross-fades: an animated background that re-enters on
 * every click is a defect you feel on the fifth click (§7.7.5). What changes between routes is one
 * attribute on `<html>`, which the shell owns.
 *
 * **No JavaScript runs the loops.** Every layer is a CSS-composited gradient moving only
 * `transform`, `opacity` or `offset-distance`; `ARCHITECTURE.md` §10 #24 carries the reasoning.
 * This component takes no props, so which elements exist is decided from the URL alone and it
 * cannot be misconfigured.
 *
 * **The one exception is G-21**, and it is the MR-1 split working rather than a breach of it: a
 * pointer response is a one-shot reaction to input, not a loop, so it is GSAP's. `useAtmosphereLamp`
 * writes `--px`, `--py` and `--lamp` on **this root element**, and the lamp layer inherits them —
 * so GSAP touches no `transform` anywhere in this subtree and cannot collide with the CSS drift on
 * the two lattice layers.
 *
 * **At `off` the animated layers are removed from the DOM, not paused.** A paused compositor layer
 * still holds its memory, and `off` is the case that shares a screen with a lap-time chart (F3).
 * Only the flat base survives.
 *
 * It contains no text and no focusable element, is `aria-hidden` and `role="presentation"`, takes
 * no pointer events, and is `display: none` in print.
 */

/**
 * Layer 3's geometry — a circuit sector: a long left sweep, a hairpin, a short chute, a fast
 * right. Authored here rather than in an asset file so it can be themed with `currentColor`,
 * and held as **one constant** so the stroke and the comet's `offset-path` cannot drift apart
 * (Design Spec §11.1).
 *
 * The `offset-path` is handed to CSS as a custom property rather than written into the
 * stylesheet, for exactly that reason. React writes it through the CSSOM
 * (`style.setProperty`), which CSP does not govern — so this survives C7-8 removing the
 * `style-src-attr` allowance.
 */
const RACING_LINE =
  'M -60 610 C 220 640 300 430 470 360 C 620 298 700 350 690 430 C 682 494 596 508 560 470 C 520 428 566 366 700 330 C 900 276 1080 250 1200 176 C 1320 102 1420 60 1520 40';

/** The `<svg>` user space layer 3 is authored in. */
const LINE_VIEWBOX = { width: 1440, height: 900 } as const;

export function AtmosphereField() {
  const { pathname } = useLocation();
  const intensity = backdropIntensityFor(pathname);

  // G-21. Everywhere except `off`, because a background that only responds on the landing page
  // reads as a landing-page trick — and `--bg-lamp-max` (§7.7.2), not this flag, is what stops the
  // lamp competing on a data surface. The hook adds the `(pointer: fine)` and reduced-motion gates.
  const { scope } = useAtmosphereLamp<HTMLDivElement>(intensity !== 'off');

  // `off` keeps the base surface and nothing else. The veil is dropped too: with no lattice
  // behind it there is nothing left to attenuate.
  if (intensity === 'off') {
    return <div ref={scope} className="atmosphere" aria-hidden="true" role="presentation" />;
  }

  return (
    <div ref={scope} className="atmosphere" aria-hidden="true" role="presentation">
      {/* Layer 1 — the resting lattice, below the veil so a route can attenuate it. */}
      <div className="atmosphere-layer atmosphere-dots" data-motion="dots" />

      {/*
       * Layer 3 exists **only** under `hero` (§7.7.5). Not hidden there — absent, so the
       * comet's animation is never created and the SVG is never rasterised.
       */}
      {intensity === 'full' && (
        <div
          className="atmosphere-layer"
          style={{ '--atmosphere-line-path': `path("${RACING_LINE}")` } as CSSProperties}
        >
          <svg
            className="atmosphere-line"
            viewBox={`0 0 ${String(LINE_VIEWBOX.width)} ${String(LINE_VIEWBOX.height)}`}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              {/*
               * The comet's halo, as geometry rather than a `filter` — a filter on an element that
               * moves every frame re-rasterises every frame, which is the one cost §7.7.5 rules
               * out.
               *
               * The stop colours are **classed, not inline**, and they no longer use
               * `currentColor`: the element's `color` is now `--bg-line`, which already carries its
               * own low alpha, so a `currentColor` halo would have been alpha-multiplied down to
               * nothing. `backdrop.css` gives them `--accent-mark` explicitly.
               */}
              <radialGradient id="atmosphere-comet-glow">
                <stop className="atmosphere-comet-glow-in" offset="0%" />
                <stop className="atmosphere-comet-glow-out" offset="100%" />
              </radialGradient>
            </defs>

            <path className="atmosphere-line-stroke" d={RACING_LINE} />

            {/* All three ride the same path, so they cannot separate. Ordered back to front. */}
            <ellipse className="atmosphere-comet atmosphere-comet-glow" rx="26" ry="14" />
            <rect
              className="atmosphere-comet atmosphere-comet-trail"
              width="40"
              height="2"
              rx="1"
              x="-20"
              y="-1"
            />
            <rect
              className="atmosphere-comet atmosphere-comet-head"
              width="30"
              height="3"
              rx="1.5"
              x="-15"
              y="-1.5"
            />
          </svg>
        </div>
      )}

      <div className="atmosphere-layer atmosphere-grain" />
      <div className="atmosphere-layer atmosphere-vignette" />
      <div className="atmosphere-layer atmosphere-veil" />

      {/*
       * Layer 2 — the pointer lamp, **above the veil and therefore last in the DOM**. That is the
       * one thing about this markup that is a decision rather than an ordering: the lamp has to
       * survive the veil so the field still responds on a data route, and its ceiling there is
       * `--bg-lamp-max` (§7.7.2) rather than the veil.
       *
       * It carries the same drift as `.atmosphere-dots` and stays in phase with it by
       * construction — same animation name, same period, and both created in this commit, so both
       * start at the same document time.
       */}
      <div className="atmosphere-layer atmosphere-lamp" data-motion="lamp" />
    </div>
  );
}
