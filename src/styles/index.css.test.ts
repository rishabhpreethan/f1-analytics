import { describe, expect, it } from 'vitest';
import { INDICATOR_LENGTH } from '@/components/layout/navItems';
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
});

describe('§3.4 — the capability card lifts on hover and on focus, and not under `reduce`', () => {
  /**
   * The gap this exists for: §3.4 specifies `y: -2` at `m.control` on card hover, it was never
   * implemented, and nothing failed. A lift is invisible in a diff and, with no visual gate
   * (CR-006), invisible until someone hovers the card in a browser.
   *
   * The lift is a CSS transition rather than a tween because §3.4 requires `:focus-visible` to
   * get the same states — see the reasoning in `index.css`. So this is where it is provable.
   */
  it('declares the distance as a token, at the 2px §3.4 specifies', () => {
    expect(TOKENS).toMatch(/--size-card-lift:\s*2px;/);
  });

  it('applies it on hover and on focus-visible alike, from the token', () => {
    const rule = /\.capability-card:hover,\s*\.capability-card:focus-visible\s*\{([^}]*)\}/.exec(
      INDEX,
    );
    expect(rule, 'the hover/focus rule for .capability-card is missing').not.toBeNull();
    // One selector list for both states is what makes "a keyboard user is not shown less"
    // structural rather than a thing two rules have to remember to agree on.
    expect(rule?.[1]).toContain('transform: translateY(calc(-1 * var(--size-card-lift)))');
  });

  it('transitions the transform at `m.control` — `dur.fast` and `ease.enter`', () => {
    // `m.control` is `{ duration: dur.fast, ease: ease.enter }`. A lift on `--ease-move`, the
    // ease the colour half uses, would be a different curve from the one §3.4 names.
    expect(INDEX).toContain('transform var(--dur-fast) var(--ease-enter);');
  });

  it('removes the lift under `prefers-reduced-motion: reduce`, not merely its transition', () => {
    // §4.6 G-7's reduced column: "token/colour change only — no `y`, no `scale`". The global
    // chokepoint in `motion.css` sets `transition: none`, which would leave the lift *snapping*
    // into place. Suppressing the transform is the only thing that satisfies the clause.
    const block =
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.capability-card:hover,\s*\.capability-card:focus-visible\s*\{([^}]*)\}/.exec(
        INDEX,
      );
    expect(block, 'no reduced-motion override for the capability-card lift').not.toBeNull();
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
