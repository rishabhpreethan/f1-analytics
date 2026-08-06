import { describe, expect, it } from 'vitest';
import MOTION_CSS from './motion.css?raw';

/**
 * **CT-10, the `motion.css` half.** Read as text, because what is being asserted is that a
 * rule *exists* — and a rule nobody can delete by accident is worth more than a rule
 * somebody remembered to write once.
 *
 * These are cheap assertions guarding an expensive property. There is no E2E gate in this
 * project any more (CR-006), so nothing else in the pipeline would notice the global
 * reduced-motion block being dropped in a tidy-up pass; a reduced-motion user would just
 * silently start receiving animation again.
 *
 * CT-10's second half — every `animation-name` in `backdrop.css` has a matching
 * `@keyframes` — lives in `backdrop.css.test.ts`, beside the file it reads.
 */

/** Strips comments so a construct *named in prose* is never mistaken for a declaration. */
function code(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const CSS = code(MOTION_CSS);

describe('CT-10 — chokepoint 1: the global reduced-motion block', () => {
  it('exists, is universal, and stops both animation and transition', () => {
    const block = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(CSS);
    expect(block, 'motion.css has no @media (prefers-reduced-motion: reduce) block').not.toBeNull();

    const body = block?.[1] ?? '';
    // The selector must reach everything: a per-component reduced variant is a thing you
    // can forget, and §4.4 makes a *stopped* state a correctness requirement.
    expect(body).toMatch(/(^|[\s,])\*(\s|,|::)/);
    expect(body).toMatch(/animation:\s*none\s*!important/);
    expect(body).toMatch(/transition:\s*none\s*!important/);
  });

  it('is not inside a Tailwind @layer, so a component cannot outrank it', () => {
    // Unlayered declarations beat layered ones regardless of source order, which is the
    // whole mechanism. `@layer` anywhere in this file would put that at risk.
    expect(CSS).not.toContain('@layer');
  });
});

describe('CT-10 — chokepoint 2: MR-3, nothing animates in a hidden tab', () => {
  it('pauses rather than clears, so a returning user meets no jump', () => {
    expect(CSS).toMatch(/html\[data-motion-paused\][\s\S]*?animation-play-state:\s*paused/);
    // `animation: none` would restart every loop from 0% on return.
    expect(CSS).not.toMatch(/html\[data-motion-paused\][^{]*\{[^}]*animation:\s*none/);
  });
});

describe('CT-10 — G-11 is a CSS loop (MR-1), and its resting state is the reduced state', () => {
  it('pulses opacity only, from a token period, and rests at the specified value', () => {
    const keyframes = /@keyframes\s+skeleton-pulse\s*\{([\s\S]*?)\n\}/.exec(CSS);
    expect(keyframes, 'no @keyframes skeleton-pulse').not.toBeNull();

    // Opacity only — never `background-position`, never a transform (§4.6 G-11).
    const properties = [...(keyframes?.[1] ?? '').matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(properties.length).toBeGreaterThan(0);
    expect(new Set(properties)).toEqual(new Set(['opacity']));

    // The period is the token, so `MOTION.loop.skeleton` and the CSS cannot drift (CT-3).
    expect(CSS).toMatch(/\.skeleton\s*\{[\s\S]*?animation:[^;]*var\(--anim-skeleton\)/);
    // 0.7 is exactly the value G-11 specifies for the reduced state, so chokepoint 1
    // stopping the animation leaves the correct still image rather than an arbitrary frame.
    expect(CSS).toMatch(/\.skeleton\s*\{[\s\S]*?opacity:\s*0\.7/);
  });
});
