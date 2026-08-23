import { ShareChart, type ShareRow } from '@/components/charts';
import { resultMix } from './model';
import type { CompareEntity } from './types';

/**
 * **`ResultMix` — what a career is actually made of.** `DESIGN_SYSTEM.md` §6.6.6.14.
 *
 * Rishabh asked for *"comparison which can be represented using simple charts that anyone can read
 * and understand"*, and of everything this payload supports, this is the one that needs no
 * argument at all. Of the races a driver started, how many did he win, how many were podiums that
 * were not wins, how many were finishes that were not podiums, and how many produced no
 * classification?
 *
 * ---
 *
 * ## Why it is honest across eras without a single caveat
 *
 * Every other cross-era figure in this product needs a defence. A points total is not one quantity
 * (24 systems, six best-N eras). A win *count* measures opportunity first — 8.4 rounds a season in
 * the 1950s against 21.9 in the 2020s. Even the rate board's five rates need their denominators
 * printed before they can be checked.
 *
 * **This chart's denominator is the driver's own starts.** Nothing from any other era enters it.
 * Fangio's bar is 100% of 51 races and Hamilton's is 100% of 390, and neither figure is doing any
 * work in the other's bar. That is the whole of the argument, and it is why there is no
 * normalisation note above this plot — a caption that explained an honesty problem the chart does
 * not have would teach the reader to distrust it.
 *
 * **What the shares hide is the size, so the caption says the size.** A 100% bar deliberately
 * throws the denominator away; that is what makes it comparable and it is also what makes it
 * incomplete. The two figures are printed in the caption and every count is in the table view.
 *
 * ## Two facts about the data that the copy has to carry
 *
 * 1. **"Not classified" is not "retired".** Hamilton has 34 retirements and 32 unclassified starts:
 *    a car that covers enough of the race distance is still given a finishing position when it
 *    stops. The note appears only when a selected driver's two figures actually differ, with both
 *    numbers, rather than as a standing disclaimer nobody reads.
 * 2. **A driver who entered and never started** gets a row that sums to zero. `ShareChart` draws it
 *    as one labelled band rather than as `NaN` widths, and the label says which of the two things
 *    happened. 91 drivers in this archive are in that state.
 *
 * ⚠ **Untested by construction**: every width, whether four segments read as four steps of one
 * colour, and whether the hatch on the fourth is legible at a 10px band. jsdom performs no layout
 * and resolves no custom property, so the tones are `validate:palette tones` V-38's business and
 * the geometry is nobody's until someone looks at it.
 */

export interface ResultMixProps {
  entities: CompareEntity[];
}

export function ResultMix({ entities }: ResultMixProps) {
  const mix = resultMix(entities);

  /*
   * **Row order is the selection order, on this chart and on the rate board alike** (§6.2, and
   * §6.6.6.5's own correction). Sorting by win share would put the reader's own first pick in a
   * position that moved when they added a fourth driver, and reading one driver across the page
   * would stop being a vertical scan.
   */
  const rows: ShareRow[] = mix.map((row) => ({
    key: row.ref,
    label: row.surname,
    segments: row.parts.map((part) => ({
      reference: part.tone,
      teamReference: row.teamRef,
      label: part.label,
      value: part.value,
      tone: part.tone,
    })),
  }));

  /* "Fangio 51, Verstappen 243 and Hamilton 390" — the denominators the shares throw away. */
  const sizes = mix.map((row) => `${row.surname} ${String(row.starts)}`);
  const sizeSentence =
    sizes.length <= 1
      ? (sizes[0] ?? '')
      : `${sizes.slice(0, -1).join(', ')} and ${String(sizes.at(-1))}`;

  const mismatched = mix.filter(
    (row) => row.dnfs !== (row.parts.find((part) => part.tone === 'unclassified')?.value ?? 0),
  );

  const notes = mismatched.map((row) => {
    const unclassified = row.parts.find((part) => part.tone === 'unclassified')?.value ?? 0;
    return (
      <span key={row.ref}>
        <strong>
          {row.surname} retired from {row.dnfs} races and has {unclassified} starts with no
          classification.
        </strong>{' '}
        They are different figures on purpose: a car that has covered enough of the race distance is
        still given a finishing position when it stops, so a retirement is not automatically an
        unclassified result. The fourth band counts the second thing.
      </span>
    );
  });

  return (
    <ShareChart
      ariaLabel="Share of each driver's starts by result"
      caption={
        <>
          Each bar is <strong>100% of that driver&rsquo;s own starts</strong> — {sizeSentence} — so
          nothing from anyone else&rsquo;s era is in it. That is also what the bar throws away: a
          share cannot tell you how many races it is a share of, and the figures above are the whole
          of that difference.
        </>
      }
      categoryTitle="Driver"
      emptyRowLabel="Entered a Grand Prix but never started one"
      entityTitle="Result"
      formatValue={(value) => `${String(value)}`}
      measureTitle="Share of starts (%)"
      notes={notes}
      rows={rows}
      state={rows.length === 0 ? 'empty' : 'ready'}
      stateCopy={{
        title: 'Nobody to draw yet',
        body: 'Add a driver to the tray above and this fills in.',
      }}
      title="Every start, by result"
      valueTitle="Races"
    />
  );
}
