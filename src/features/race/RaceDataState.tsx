import { StateCard } from '@/components/ui/StateCard';
import { Info } from '@/components/ui/icons';
import type { RaceDataState as RaceDataStateValue } from './selectors';

/**
 * **The state a chart is replaced by when its data does not exist for this race.**
 *
 * §6.5.3, and §3.4.3's hard rule: **a no-coverage state is never painted `caution` or `critical`.**
 * Absent lap data before 1996 is a property of the sport's history, not a fault of the product or of
 * the reader, and a red panel says the opposite. `tone="neutral"` is the whole point of that prop
 * existing.
 *
 * **`noCoverage` and `absent` are different sentences because they are different facts**, and
 * confusing them is how a reader gets told "lap data begins in 1996" about a 2021 race. The selector
 * distinguishes them; this renders whichever it is handed and never composes copy of its own — every
 * boundary year comes from `GET /api/meta` (§6.5.3), which is why neither string is written here.
 *
 * The heading is the chart's own title, so the page reads as *"Position by lap — not available"*
 * rather than as a generic apology in the place a chart was expected.
 */

export interface RaceDataStateProps {
  /** The chart this replaces, e.g. `Position by lap`. */
  title: string;
  state: RaceDataStateValue;
}

export function RaceDataState({ title, state }: RaceDataStateProps) {
  if (state.kind === 'available') return null;

  return (
    <div className="season-subsection">
      <h3 className="t-display-xs text-ink-primary">{title}</h3>
      <StateCard icon={<Info />} tone="neutral" as="h4" title="Not available for this race">
        <p>{state.notice}</p>
      </StateCard>
    </div>
  );
}
