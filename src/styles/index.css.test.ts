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
