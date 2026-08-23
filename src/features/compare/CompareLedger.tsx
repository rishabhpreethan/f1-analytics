import type { CSSProperties } from 'react';
import { LegendKey } from '@/components/charts/MarkerGlyph';
import type { DashPattern, MarkerShape } from '@/components/charts/ladder';
import { cssVar } from '@/lib/entityColor';
import { balanceFractions } from './model';
import type { Ledger } from './types';

/**
 * **The balance bar** — `DESIGN_SYSTEM.md` §6.6.6.3, and the form every head-to-head on this page
 * takes, at two sizes.
 *
 * **The job** is polarity, not magnitude: *who was ahead, and by how much of the whole*. Neither a
 * pair of bars nor a diverging bar answers it as directly — a pair of bars makes the reader do the
 * subtraction, and a diverging bar puts the interesting quantity (the imbalance) at the ends where
 * it is hardest to compare. **One track, split once, is the only form where the answer is the
 * position of a single edge.**
 *
 * **The centre tick is not decoration and must never be removed.** Without a drawn 50% the reader
 * has no reference to judge the split against, and 39–27 looks like a rout instead of the 59% it
 * is. It is 1px `--border-strong`, the axis-line token, because that is exactly what it is: this
 * chart's one axis.
 *
 * **Colour is never the only channel** (§3.3, §6.4). Each side carries its `LegendKey` — colour,
 * dash and marker shape in one 34×14 sample — beside a name in ink, and the counts are printed.
 * A reader who cannot separate the two fills still has three other ways to read the bar.
 *
 * **`rated = 0` draws no track at all.** An undrawn bar and a 50/50 bar are opposite statements and
 * the second is a lie the reader cannot detect. Half of the archive's 4,637 teammate pairings have
 * no race both drivers finished, so this state is common rather than exotic.
 */

export interface BalanceSide {
  label: string;
  token: string;
  marker: MarkerShape;
  dash: DashPattern;
}

export interface BalanceBarProps {
  title: string;
  ledger: Ledger;
  a: BalanceSide;
  b: BalanceSide;
  /** What `rated` counted, in words. Printed under the track, always. */
  caption: string;
  /** What to say when nothing is rated. Never a blank space and never a zeroed bar. */
  emptyCopy: string;
  size?: 'full' | 'micro';
}

export function BalanceBar({
  title,
  ledger,
  a,
  b,
  caption,
  emptyCopy,
  size = 'full',
}: BalanceBarProps) {
  const split = balanceFractions(ledger);
  const style = {
    '--balance-a': cssVar(a.token),
    '--balance-b': cssVar(b.token),
  } as CSSProperties;

  if (split === null) {
    return (
      <div className="balance" data-size={size} style={style}>
        {size === 'full' && <p className="balance-title">{title}</p>}
        <p className="balance-empty">{emptyCopy}</p>
      </div>
    );
  }

  return (
    <div className="balance" data-size={size} style={style}>
      {size === 'full' && <p className="balance-title">{title}</p>}
      <div className="balance-heads">
        <span className="balance-head">
          {size === 'full' && <LegendKey shape={a.marker} dash={a.dash} token={a.token} />}
          <span className="balance-name">{a.label}</span>
          <span className="balance-count">{ledger.a}</span>
        </span>
        <span className="balance-head" data-side="b">
          <span className="balance-count">{ledger.b}</span>
          <span className="balance-name">{b.label}</span>
          {size === 'full' && <LegendKey shape={b.marker} dash={b.dash} token={b.token} />}
        </span>
      </div>
      <div
        className="balance-track"
        style={
          {
            '--balance-a-share': `${String(split.a * 100)}%`,
            '--balance-b-share': `${String(split.b * 100)}%`,
          } as CSSProperties
        }
      >
        <span className="balance-fill" data-side="a" />
        <span className="balance-fill" data-side="b" />
        {split.tied > 0 && <span className="balance-tied" />}
        <span className="balance-even" aria-hidden="true" />
      </div>
      <p className="balance-caption">{caption}</p>
    </div>
  );
}
