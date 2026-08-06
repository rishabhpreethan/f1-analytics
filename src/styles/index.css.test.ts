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

/**
 * The whole `@media (min-width: 64rem)` rail block, brace-balanced. Module scope, because both
 * the collapsed and the expanded suite below read it — and the pin, which only exists in the rail.
 */
function railBlock(): string {
  const start = INDEX.indexOf('@media (min-width: 64rem) {\n    .dock {');
  if (start < 0) throw new Error('the rail media query is missing from index.css');
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

/**
 * The body of one rule inside the rail block, selected by a declaration it must contain. Selecting
 * by name alone is not enough: `.dock-item` appears twice in the rail — once on its own and once
 * grouped with `.dock-slot` — and matching the first is how a test ends up asserting against the
 * wrong rule and passing.
 */
function railRule(selector: string, contains: string): string {
  const pattern = new RegExp(`\\n {4}${selector.replace(/[.[\]']/g, '\\$&')} \\{([^}]*)\\}`, 'g');
  const bodies = [...RAIL.matchAll(pattern)].map((match) => match[1] ?? '');
  const body = bodies.find((candidate) => candidate.includes(contains));
  expect(body, `no \`${selector}\` rule in the rail block declaring \`${contains}\``).toBeDefined();
  return body ?? '';
}

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

describe('§7.8 — the collapsed rail: the faults Rishabh reported', () => {
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
     * Stated as arithmetic over the tokens involved, the error is not expressible. **The lane is
     * the only permitted divisor** — see the arithmetic test below for why 48 was still wrong.
     */
    expect(RAIL).toMatch(
      /padding-left:\s*calc\(\(var\(--size-dock-lane\) - var\(--size-dock-glyph\)\) \/ 2\)/,
    );
    expect(RAIL).not.toMatch(/padding-left:\s*\d+px/);
    // The superseded divisor, explicitly: `--size-dock` less only its padding is 48, which is 2px
    // too wide because `border-box` takes the dock's two 1px borders out of the width as well.
    expect(RAIL).not.toContain(
      'var(--size-dock) - var(--size-dock-pad) * 2 - var(--size-dock-glyph)',
    );
  });

  it('fault 5 — sizes the rail item by its LANE, not by its own hidden label', () => {
    /*
     * **The fault Rishabh saw as "the active pill's glyph is a few px right of the others".**
     *
     * `.dock-slot` is `justify-content: center` and `.dock-item` was `flex: none`, so the item's
     * width was `max-content` — and the collapsed label is `opacity: 0`, which paints nothing and
     * **lays out fully**. Every item was therefore as wide as its own text, overflowed the 46px
     * lane, and was centred in it: a different negative left offset per destination, so the glyph
     * column tracked label length. `Home` sat furthest right; `Compare` and `Records` furthest
     * left. The active pill, being the only visible box, was ~100px wide inside a 64px rail and
     * clipped by the dock's `overflow: hidden` to look edge-to-edge.
     *
     * Two declarations fix it and both are load-bearing: `width: 100%` takes the box off
     * `max-content`, and `min-width: 0` defeats the base rule's `min-width: --size-dock-item`
     * (48), which exceeds the 46px lane and would leave a 1px overflow on each side.
     */
    const item = railRule('.dock-item', 'padding-left');
    expect(item).toContain('width: 100%;');
    expect(item).toContain('min-width: 0;');
  });

  it('fault 5 — the glyph centre resolves to exactly half the rail, as numbers', () => {
    /*
     * The string assertions above prove the *shape* of the arithmetic; this one resolves it. If
     * any term of the lane changes — the rail width, its padding, its border, the glyph — this
     * fails, which is the point: the rail's horizontal centring has now been wrong three times
     * (a 22px literal, then a 48px lane, then a label-sized box) and each time nothing failed.
     */
    const len = (css: string, name: string): number => {
      const match = new RegExp(`${name}:\\s*([\\d.]+)(px|rem);`).exec(css);
      expect(match, `${name} is missing, or is not a plain px/rem length`).not.toBeNull();
      return Number(match?.[1]) * (match?.[2] === 'rem' ? 16 : 1);
    };

    const dock = len(TOKENS, '--size-dock'); // 64 — the collapsed rail's outer width
    const pad = len(TOKENS, '--size-dock-pad'); // 8
    const hairline = len(TOKENS, '--size-dock-hairline'); // 1
    const glyph = len(TOKENS, '--size-dock-glyph'); // 20
    const inset = len(TOKENS, '--size-dock-inset'); // 16 — the rail's own left offset

    // The lane must be declared as exactly this subtraction, so the numbers below describe what
    // ships rather than what this test wishes shipped.
    expect(TOKENS).toMatch(
      /--size-dock-lane:\s*calc\(\s*var\(--size-dock\) - var\(--size-dock-hairline\) \* 2 - var\(--size-dock-pad\) \* 2\s*\);/,
    );
    const lane = dock - hairline * 2 - pad * 2;
    expect(lane).toBe(46);

    // …and `.dock` must consume the same hairline token as its border-width, or the subtraction
    // is subtracting a number the rail does not actually have.
    expect(INDEX).toContain('border: var(--size-dock-hairline) solid var(--border-subtle);');

    const paddingLeft = (lane - glyph) / 2; // 13, and 14 under the superseded 48px lane
    const glyphCentre = inset + hairline + pad + paddingLeft + glyph / 2;
    const railCentre = inset + dock / 2;
    expect(glyphCentre).toBe(railCentre);
    expect(glyphCentre).toBe(48);
  });

  it('mirrors --size-dock-glyph in navItems.ts, because CSS centres what JSX renders', () => {
    // The glyph size is a JSX prop and the centring is CSS. If the two disagreed the glyph would
    // sit off-centre by half the difference and nothing would fail — the same shape of defect as
    // fault 2, one layer along.
    const match = /--size-dock-glyph:\s*(\d+)px;/.exec(TOKENS);
    expect(match, '--size-dock-glyph is missing from tokens.css').not.toBeNull();
    expect(Number(match?.[1])).toBe(DOCK_GLYPH_SIZE);
  });

  it('does not claim --size-dock less its padding equals --size-dock-item', () => {
    /*
     * This test used to assert `dock − 2×pad === item` (64 − 16 = 48) and pass, and the claim was
     * **false in the direction that matters**: under `box-sizing: border-box` the dock's own 1px
     * borders come out of its width too, so the inner lane is 46, not 48. A passing test asserting
     * a wrong invariant is worse than no test, so it is inverted rather than deleted — the two
     * figures must now differ by exactly the two borders.
     */
    const pad = Number(/--size-dock-pad:\s*(\d+)px;/.exec(TOKENS)?.[1] ?? '0');
    const hairline = Number(/--size-dock-hairline:\s*(\d+)px;/.exec(TOKENS)?.[1] ?? '0');
    const dock = Number(/--size-dock:\s*([\d.]+)rem;/.exec(TOKENS)?.[1] ?? '0') * 16;
    const item = Number(/--size-dock-item:\s*([\d.]+)rem;/.exec(TOKENS)?.[1] ?? '0') * 16;
    expect(dock - pad * 2).toBe(item);
    expect(dock - pad * 2 - hairline * 2).toBe(item - 2);
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
    // full-height nor centred. It is now inset by `--size-dock-inset` at the foot, starts below
    // the header at the top, and the `translateY(-50%)` that produced the accident is gone.
    const rail = /@media \(min-width: 64rem\) \{\s*\.dock \{([^}]*)\}/.exec(INDEX)?.[1] ?? '';
    expect(rail).toContain('bottom: var(--size-dock-inset);');
    expect(rail).toContain('height: auto;');
    expect(rail).not.toMatch(/translateY/);
    // And the pin is pushed to the foot of it, which is what makes the height deliberate.
    expect(INDEX).toMatch(/\.dock-pin-row\s*\{[^}]*margin-top:\s*auto;/);
  });

  it('fault 4 — starts the rail BELOW the header, so no rail width can cover the wordmark', () => {
    /*
     * **The reported break.** `top: var(--size-dock-inset)` put the rail 16px from the viewport's
     * top — inside the 56px header band — at `--z-dock` (40) over `--z-header` (30). Collapsed,
     * the header read "ANALYTICS" with the `F1` badge under the active pill; expanded, the whole
     * wordmark was gone. The earlier content-height box missed the header only by accident.
     *
     * `top` must therefore be **derived from `--size-header`**, not a literal and not the bare
     * inset. Derived is the whole requirement: the rail expands to `--size-dock-open` on hover, so
     * the alternative resolution (a full-height rail with the header padded left by the rail's
     * clearance) cannot keep the wordmark clear at *every* rail width — 96px of header padding
     * still loses it the moment the rail opens. Below the header holds structurally, and a token
     * drifting (a taller header) is the only way it can break, which is what this pins.
     */
    const rail = /@media \(min-width: 64rem\) \{\s*\.dock \{([^}]*)\}/.exec(INDEX)?.[1] ?? '';
    expect(rail).toContain('top: calc(var(--size-header) + var(--size-dock-inset));');
    expect(rail).not.toMatch(/top:\s*var\(--size-dock-inset\);/);
    expect(rail).not.toMatch(/top:\s*\d/);

    // And a z-index swap must NOT be substituted for the geometry: with the header above the rail
    // the 56px band would clip the rail's first destination instead — a truncated nav item traded
    // for a hidden wordmark. The rail stays above the header; it simply no longer reaches it.
    const z = (name: string) => Number(new RegExp(`${name}:\\s*(\\d+);`).exec(TOKENS)?.[1] ?? '-1');
    expect(z('--z-dock')).toBeGreaterThan(z('--z-header'));
  });

  it('fault 6 — gives the collapsed pin a resting ring, without moving it off the lane', () => {
    /*
     * At 64px wide with no label, a 20px outline glyph below a divider read as "an almost-empty
     * rounded box … a stray artefact rather than a control". Contrast was not the cause —
     * `--ink-secondary` over the glass composite is ~8.6:1 dark / ~7.4:1 light — so the box gets
     * the edge rather than the glyph getting louder ink.
     *
     * **`box-shadow: inset`, never `border`.** A border is drawn inside the box under `border-box`
     * and would shift this glyph 1px off the lane the seven destinations above it share, which is
     * the exact 1px drift `--size-dock-lane` exists to prevent.
     */
    const pin = railRule('.dock-pin', 'box-shadow');
    expect(pin).toContain(
      'box-shadow: inset 0 0 0 var(--size-dock-hairline) var(--border-subtle);',
    );
    expect(pin).not.toMatch(/\bborder(-width)?:/);

    // Pressed is `--accent-wash`, the "held" weight — never the active pill's inversion, which
    // means "the page you are on" and must stay the rail's only inverted object.
    const pressed = railRule(".dock-pin[aria-pressed='true']", 'background-color');
    expect(pressed).toContain('background-color: var(--accent-wash);');
    expect(pressed).not.toContain('var(--accent-fill)');
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
