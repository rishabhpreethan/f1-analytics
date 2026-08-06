import type { CSSProperties } from 'react';
import { useLocation } from 'react-router';
import { backdropIntensityFor } from '@/components/layout/backdrop';

/**
 * The moving background — `DESIGN_SYSTEM.md` §7.7, Technical Spec §S.3.5.
 *
 * **Rendered once, by `AppShell`, as its first child.** It is outside the router outlet, so it
 * never remounts on navigation and never cross-fades: an animated background that re-enters
 * on every click is a defect you feel on the fifth click (§7.7.5). What changes between routes
 * is one attribute on `<html>`, which the shell owns.
 *
 * **There is no JavaScript in the animation.** Every layer is a CSS-composited gradient
 * moving only `transform`, `opacity` or `offset-distance`; `backdrop.css` carries the whole
 * of it and `ARCHITECTURE.md` §10 #24 carries the reasoning. This component's entire job is
 * to decide *which elements exist*, and it takes no props so it cannot be misconfigured.
 *
 * **At `off` the animated layers are removed from the DOM, not paused.** A paused compositor
 * layer still holds its memory, and `off` is the case that shares a screen with a lap-time
 * chart (F3). Only the flat base survives.
 *
 * It contains no text and no focusable element, is `aria-hidden` and `role="presentation"`,
 * takes no pointer events, and is `display: none` in print.
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

  // `off` keeps the base surface and nothing else. The plate is dropped too: with no orbs
  // and no grid behind it there is nothing left to attenuate.
  if (intensity === 'off') {
    return <div className="atmosphere" aria-hidden="true" role="presentation" />;
  }

  return (
    <div className="atmosphere" aria-hidden="true" role="presentation">
      <div className="atmosphere-layer atmosphere-grid" />

      <div className="atmosphere-layer atmosphere-orbs" data-motion="orbs">
        <span className="atmosphere-orb atmosphere-orb-a" />
        <span className="atmosphere-orb atmosphere-orb-b" />
        <span className="atmosphere-orb atmosphere-orb-c" />
      </div>

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
              {/* The comet's glow, as geometry rather than a `filter` — a filter on an element
               * that moves every frame re-rasterises every frame, which is the one cost
               * §7.7.5 rules out. */}
              <radialGradient id="atmosphere-comet-glow">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
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
      <div className="atmosphere-layer atmosphere-plate" />
    </div>
  );
}
