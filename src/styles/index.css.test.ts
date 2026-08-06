import { describe, expect, it } from 'vitest';
import { DOCK_GLYPH_SIZE, INDICATOR_LENGTH } from '@/components/layout/navItems';
import INDEX_CSS from './index.css?raw';
import TOKENS_CSS from './tokens.css?raw';

/**
 * The invariants that live **between** `index.css` and the JavaScript that writes into it.
 *
 * Every assertion here guards a value that exists in two places and must agree. None of them
 * is style: each one is a rule whose violation renders something in the wrong place while
 * throwing no error and logging nothing — and with no visual gate in this project (CR-006),
 * a source assertion is the only thing that catches it before Rishabh does.
 */

const CODE = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const INDEX = CODE(INDEX_CSS);
const TOKENS = CODE(TOKENS_CSS);

describe('G-3 — the indicator length agrees between tokens.css and navItems.ts', () => {
  /** A `--name: Npx;` declaration in `tokens.css`. */
  function token(name: string): number {
    const match = new RegExp(`${name}:\\s*(\\d+)px;`).exec(TOKENS);
    expect(match, `${name} is missing from tokens.css, or is not a px length`).not.toBeNull();
    return Number(match?.[1]);
  }

  it('mirrors INDICATOR_LENGTH in both orientations', () => {
    // The bar is centred on the active item by arithmetic in `CommandDock`, against a length
    // that CSS renders. If the two disagree the bar sits off-centre by half the difference —
    // wrong, and invisible in a diff.
    expect(token('--size-dock-indicator')).toBe(INDICATOR_LENGTH.dock);
    expect(token('--size-dock-indicator-rail')).toBe(INDICATOR_LENGTH.rail);
  });

  it('uses the tokens in `.dock-indicator` rather than a literal', () => {
    expect(INDEX).toContain('width: var(--size-dock-indicator);');
    expect(INDEX).toContain('height: var(--size-dock-indicator-rail);');
  });

  it('places the indicator OUTSIDE the active pill, now that the pill is an accent fill', () => {
    // The active item became an inverted `--accent-fill` pill with the monochrome switch (§3.6.4).
    // A `--accent-mark` bar at `left: 0` of the list would be the same colour as the pill and would
    // simply disappear. Half the dock's padding out from the pill's edge is clear of both.
    expect(INDEX).toContain('left: calc(-1 * var(--size-dock-pad) / 2);');
    expect(INDEX).toContain('top: calc(-1 * var(--size-dock-pad) / 2);');
  });
});

describe('§7.8 — the collapsed rail: the two faults Rishabh reported', () => {
  /** The whole `@media (min-width: 64rem)` rail block, brace-balanced. */
  function railBlock(): string {
    const start = INDEX.indexOf('@media (min-width: 64rem) {\n    .dock {');
    expect(start, 'the rail media query is missing').toBeGreaterThan(-1);
    let depth = 0;
    for (let i = INDEX.indexOf('{', start); i < INDEX.length; i += 1) {
      if (INDEX[i] === '{') depth += 1;
      else if (INDEX[i] === '}') {
        depth -= 1;
        if (depth === 0) return INDEX.slice(start, i + 1);
      }
    }
    throw new Error('unbalanced braces in the rail block');
  }

  const RAIL = railBlock();

  it('hides the label in the COLLAPSED state, not as a base `opacity: 0` (MR-2)', () => {
    /*
     * **Fault 1, and it was definite.** The rail was specified icon-only and nothing implemented
     * it: `index.css` had exactly two `.dock-label` rules, neither of which hid anything, so a
     * 64px rail with `overflow: hidden` and `white-space: nowrap` rendered `Hor`, `Seas`, `Driv`,
     * `Tea`, `Circ`, `Com`, `Reco`, `Kee`.
     *
     * MR-2 requires this to be keyed on the *state*: the base `.dock-label` resolves to the
     * **visible** values through `var(…, 1)` / `var(…, 0px)` fallbacks, and only the rail's
     * collapsed state sets them otherwise. A base `opacity: 0` would hide every label in the
     * bottom dock too if the rail block ever failed to load.
     */
    const base = /\.dock-label\s*\{([^}]*)\}/.exec(INDEX)?.[1] ?? '';
    expect(base).toContain('opacity: var(--dock-label, 1);');
    expect(base).toContain('transform: translateX(var(--dock-label-x, 0px));');
    expect(base).not.toMatch(/opacity:\s*0;/);

    // Collapsed is the rail's default; the three open states raise it.
    expect(RAIL).toMatch(/--dock-label:\s*0;/);
    expect(RAIL).toMatch(/--dock-label-x:\s*calc\(-1 \* var\(--size-dock-label-shift\)\);/);
  });

  it('centres the collapsed glyph by arithmetic over tokens, not by a literal', () => {
    /*
     * **Fault 2.** The rule read `padding-left: 22px` with a comment asserting it centred a 20px
     * glyph at x = 32 — "32 − half of a 20px glyph = 22" — which forgot the rail's own 8px
     * padding. The item's box starts 8px in, so the true glyph centre was **40**, not 32: 8px
     * off-centre in a 64px rail, in the state a user sees most.
     *
     * Stated as arithmetic over the three tokens involved, the error is not expressible.
     */
    expect(RAIL).toMatch(
      /padding-left:\s*calc\(\s*\(var\(--size-dock\) - var\(--size-dock-pad\) \* 2 - var\(--size-dock-glyph\)\) \/ 2\s*\)/,
    );
    expect(RAIL).not.toMatch(/padding-left:\s*\d+px/);
  });

  it('mirrors --size-dock-glyph in navItems.ts, because CSS centres what JSX renders', () => {
    // The glyph size is a JSX prop and the centring is CSS. If the two disagreed the glyph would
    // sit off-centre by half the difference and nothing would fail — the same shape of defect as
    // fault 2, one layer along.
    const match = /--size-dock-glyph:\s*(\d+)px;/.exec(TOKENS);
    expect(match, '--size-dock-glyph is missing from tokens.css').not.toBeNull();
    expect(Number(match?.[1])).toBe(DOCK_GLYPH_SIZE);
  });

  it('keeps --size-dock-pad the arithmetic that makes the slot exactly --size-dock-item', () => {
    // 64 − 2×8 = 48. One padding in both orientations, so the pill inset, the slot size and the
    // glyph centring are one piece of arithmetic rather than three that can disagree.
    const pad = Number(/--size-dock-pad:\s*(\d+)px;/.exec(TOKENS)?.[1] ?? '0');
    const dock = Number(/--size-dock:\s*([\d.]+)rem;/.exec(TOKENS)?.[1] ?? '0') * 16;
    const item = Number(/--size-dock-item:\s*([\d.]+)rem;/.exec(TOKENS)?.[1] ?? '0') * 16;
    expect(dock - pad * 2).toBe(item);
  });
});

describe('§7.8 — the expanded rail: opened by CSS, and overridable under `reduce`', () => {
  it('opens on :hover, :focus-within and [data-pinned], with no React attribute', () => {
    /*
     * **Fault 3's other half.** Rishabh reported hover doing nothing at 1440px; the React state
     * path was verified to work and the built cascade was correct, so the cause was never named.
     * The mechanism is therefore gone rather than trusted twice: the same two conditions are now
     * `:hover` and `:focus-within`, which cannot get stuck because there is no state to stick.
     */
    expect(INDEX).toContain(".dock:is(:hover, :focus-within, [data-pinned='true'])");
    expect(INDEX).not.toContain("data-expanded='true'");
    expect(INDEX).not.toContain('data-expanded=');
  });

  it('routes every open-state value through a custom property, so `reduce` wins on source order', () => {
    /*
     * G-4's reduced variant is "permanently expanded, pin hidden". With the open state written as
     * declarations on a `:not()` chain, the override would need to out-specify a four-class
     * selector — `!important` or a longer chain, both worse. Expressed as three custom properties
     * on `.dock`, the reduce block wins at **equal specificity by source order**, which is the
     * least surprising cascade available.
     */
    expect(INDEX).toMatch(/--dock-width:\s*var\(--size-dock\);/);
    expect(INDEX).toContain('width: var(--dock-width);');

    const reduce =
      /@media \(min-width: 64rem\) and \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n {2}\}/.exec(
        INDEX,
      );
    expect(reduce, 'no reduced-motion override for the rail').not.toBeNull();
    expect(reduce?.[1]).toMatch(/--dock-width:\s*var\(--size-dock-open\);/);
    expect(reduce?.[1]).toMatch(/--dock-label:\s*1;/);
    expect(reduce?.[1]).toMatch(/\.dock-pin-row\s*\{\s*display:\s*none;/);

    // Source order is the mechanism, so it is what gets asserted.
    expect(INDEX.indexOf('--dock-width: var(--size-dock);')).toBeLessThan((reduce?.index ?? 0) + 1);
  });

  it('staggers the label reveal from a token, and does NOT stagger the collapse', () => {
    // A staggered disappearance reads as lag rather than as sequence, which is why the closed state
    // carries `transition-delay: 0ms` and only the open state carries the multiplier.
    expect(INDEX).toContain(
      'transition-delay: calc(var(--dock-index, 0) * var(--stagger-dock-label));',
    );
    expect(INDEX).toContain('transition-delay: 0ms;');

    // 7 labels × the stagger + `--dur-fast` must stay inside §4.2's 400ms interaction ceiling.
    const stagger = Number(/--stagger-dock-label:\s*(\d+)ms;/.exec(TOKENS)?.[1] ?? '0');
    const fast = Number(/--dur-fast:\s*(\d+)ms;/.exec(TOKENS)?.[1] ?? '0');
    expect(stagger).toBeGreaterThan(0);
    expect(7 * stagger + fast).toBeLessThanOrEqual(400);
  });

  it('gives the rail a stated full-height geometry rather than an arbitrary float', () => {
    // The complaint was that the rail sat at roughly 235→660px in a 900px viewport — neither
    // full-height nor centred. It is now inset by `--size-dock-inset` at the top and the bottom,
    // and the `translateY(-50%)` that produced the accidental position is gone.
    const rail = /@media \(min-width: 64rem\) \{\s*\.dock \{([^}]*)\}/.exec(INDEX)?.[1] ?? '';
    expect(rail).toContain('top: var(--size-dock-inset);');
    expect(rail).toContain('bottom: var(--size-dock-inset);');
    expect(rail).toContain('height: auto;');
    expect(rail).not.toMatch(/translateY/);
    // And the pin is pushed to the foot of it, which is what makes the height deliberate.
    expect(INDEX).toMatch(/\.dock-pin-row\s*\{[^}]*margin-top:\s*auto;/);
  });

  it('has retired G-8: no pointer spotlight on the dock', () => {
    // §3.5.2: a low-opacity achromatic radial over a glass surface reads as a smudge — the same
    // failure the atmosphere's orbs were removed for. The dock's `::before` gradient is gone.
    expect(INDEX).not.toContain('.dock-list::before');
  });
});

describe('§4.6 G-25 / G-26 — the capability card’s rebuilt hover', () => {
  /**
   * **Rewritten 2026-08-06.** This block used to assert the 2px `y` lift and its
   * `--size-card-lift` token. Rishabh rejected the card hover outright — *"even the hover effects
   * for these cards … i dont really like them either"* — and the four polite effects it guarded
   * are gone: the pointer spotlight, the lift, the top-edge recolour as the only edge signal, and
   * the accent index at rest.
   *
   * What is guarded now is what replaced them. Every assertion below is a rule whose violation
   * looks like nothing in a diff and cannot be seen without a browser (CR-006).
   */
  it('has removed every trace of the four retired effects', () => {
    // A leftover `--px`/`--spotlight` on the card would paint a gradient nothing drives, and a
    // leftover `--size-card-lift` reference would resolve to nothing and silently do nothing.
    expect(INDEX).not.toContain('.capability-card::before');
    expect(INDEX).not.toContain('.capability-edge');
    expect(INDEX).not.toContain('--size-card-lift');
    expect(INDEX).not.toContain('--size-spotlight');
    expect(TOKENS).not.toMatch(/--size-card-lift:/);
    expect(TOKENS).not.toMatch(/--size-spotlight:/);
    // The card must not declare pointer coordinates any more; only the atmosphere does.
    const card = /\.capability-card\s*\{([^}]*)\}/.exec(INDEX)?.[1] ?? '';
    expect(card).not.toMatch(/--px:/);
    expect(card).not.toMatch(/--spotlight:/);
  });

  it('drops `overflow: hidden`, which would shear the near corner of a 3D tilt', () => {
    /*
     * A subtle one, and the reason it is asserted: `overflow: hidden` was on the card only to clip
     * the spotlight gradient. Left in place it would clip the tilted card against a *flattened*
     * plane, cutting off the corner nearest the viewer — which looks like a rendering fault rather
     * than like a mistake in CSS, and only at certain pointer positions.
     */
    const card = /\.capability-card\s*\{([^}]*)\}/.exec(INDEX)?.[1] ?? '';
    expect(card).not.toMatch(/overflow:\s*hidden/);
  });

  it('steps the elevation on hover AND on focus-visible, in one selector list', () => {
    // One selector list for both states is what makes "a keyboard user is not shown less"
    // structural rather than a thing two rules have to remember to agree on. The shadow is also
    // the part that makes G-25's ±4° read as *lift* rather than as skew.
    const rule = /\.capability-card:hover,\s*\.capability-card:focus-visible\s*\{([^}]*)\}/.exec(
      INDEX,
    );
    expect(rule, 'the hover/focus rule for .capability-card is missing').not.toBeNull();
    expect(rule?.[1]).toContain('box-shadow: var(--elev-2-shadow)');
    expect(rule?.[1]).toContain('border-color: var(--accent-border)');
    // A paint transition, so it is permitted (§4.5 forbids layout properties and loops).
    expect(INDEX).toContain('box-shadow var(--dur-fast) var(--ease-enter)');
  });

  it('G-26: two brackets, revealed from opposite corners by a clip-path transition', () => {
    /*
     * The brackets are the gesture a keyboard user gets, so they must be CSS and they must be
     * keyed on both states. Their *direction* is the design — opposite corners closing on the card
     * — and a copy-paste that gave both the same `clip-path` origin would still animate, still
     * look plausible in a diff, and read as one bracket appearing twice.
     */
    expect(INDEX).toMatch(/\.capability-bracket\s*\{[^}]*clip-path:\s*inset\(0 100% 100% 0\)/);
    expect(INDEX).toMatch(
      /\.capability-bracket::after\s*\{[^}]*clip-path:\s*inset\(100% 0 0 100%\)/,
    );
    expect(INDEX).toContain('transition: clip-path var(--dur-slow) var(--ease-enter);');

    // Both halves open on hover and on focus alike.
    const open =
      /\.capability-card:hover \.capability-bracket,\s*\.capability-card:focus-visible \.capability-bracket,\s*\.capability-card:hover \.capability-bracket::after,\s*\.capability-card:focus-visible \.capability-bracket::after\s*\{([^}]*)\}/.exec(
        INDEX,
      );
    expect(open, 'the brackets never open').not.toBeNull();
    expect(open?.[1]).toContain('clip-path: inset(0)');

    // 2px, from the token — the same rule thickness as every other accent mark (§3.6.4).
    expect(INDEX).toMatch(/border-top-width:\s*var\(--size-rule\)/);
    expect(INDEX).toMatch(/border-bottom-width:\s*var\(--size-rule\)/);

    /*
     * `content` belongs to the `::after` alone. In the shared rule it would also land on
     * `.capability-bracket`, which is a real `<span>` — and `content` on a non-pseudo element
     * *replaces its children* in Chrome. The span has none today, so the bug would be invisible
     * until someone put something inside it.
     */
    const shared = /\.capability-bracket,\s*\.capability-bracket::after\s*\{([^}]*)\}/.exec(INDEX);
    expect(shared, 'the shared bracket rule is missing').not.toBeNull();
    expect(shared?.[1]).not.toMatch(/content:/);

    /*
     * Anchored on the closing brace of the preceding rule, so the selector must *begin* a rule. A
     * bare `/\.capability-bracket::after\s*\{/` also matches the tail of the shared selector list
     * above — which is how this assertion first passed while reading the wrong block, twice.
     */
    const afterOnly = /\}\s*\.capability-bracket::after\s*\{([^}]*)\}/.exec(INDEX);
    expect(afterOnly, 'no rule targets .capability-bracket::after alone').not.toBeNull();
    expect(afterOnly?.[1]).toMatch(/content:\s*''/);
  });

  it('makes the index a STATE change rather than an accent at rest', () => {
    // `--accent-ink` at rest cannot work in monochrome: near-black beside `--ink-primary` is
    // ΔE ≈ 5, so the index and the title would read as one flat block of type (§3.6.1).
    expect(INDEX).toMatch(/\.capability-index\s*\{[^}]*color:\s*var\(--ink-tertiary\)/);
    expect(INDEX).toMatch(
      /\.capability-card:hover \.capability-index,\s*\.capability-card:focus-visible \.capability-index\s*\{\s*color:\s*var\(--accent-ink\)/,
    );
  });

  it('removes the arrow’s nudge under `reduce`, not merely its transition', () => {
    /*
     * §4.6 G-7's reduced column: "token/colour change only — no `y`, no `scale`".
     *
     * The **tilt** satisfies that by construction — it is GSAP, and `useMotion` never builds a
     * tween under `reduce`, so no inline transform ever exists and there is nothing for CSS to
     * override. The arrow's 3px nudge is CSS, and chokepoint 1 in `motion.css` kills only its
     * *transition*: it would still snap into place, which is movement without the softening.
     */
    const block =
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.capability-card:hover \.capability-arrow,\s*\.capability-card:focus-visible \.capability-arrow \{([^}]*)\}/.exec(
        INDEX,
      );
    expect(block, 'no reduced-motion override for the capability-card arrow').not.toBeNull();
    expect(block?.[1]).toContain('transform: none');
  });
});

describe('the coverage ruler’s axis shares its column template with its rows', () => {
  it('drives both from one custom property, and nothing relies on the dead grid-column', () => {
    // The bug this exists for: `.ruler-axis` carried `grid-column: 1 / -1` inside a flex
    // parent, where it does nothing. The axis then spanned the full row while the bars sat in
    // the middle column of the row's 3-column grid, so every tick landed ~130px left of the
    // year it labelled and 1950 sat under the row labels. One template, declared once, cannot
    // drift — and the responsive step now changes the property rather than two rules.
    expect(INDEX).toContain('--ruler-columns:');
    expect([...INDEX.matchAll(/grid-template-columns:\s*var\(--ruler-columns\)/g)]).toHaveLength(2);
    expect(INDEX).not.toContain('grid-column: 1 / -1');
  });
});
