import { Info } from '@/components/ui/icons';
import type { SeasonNotice } from './selectors';

/**
 * **Everything a season says about itself, and none of it is an error.**
 *
 * `selectSeasonNotices` emits eight codes. A best-4 scoring rule, a season with no Constructors'
 * Championship, two cancelled rounds and lap timing that begins in 1996 are all facts about the
 * sport's history — so every one of them renders **neutral**: `--ink-tertiary` glyph,
 * `--ink-secondary` text, `--surface-sunken` panel. §3.4.3 reserves the status colours for states
 * that need action, and painting a 1950 season page amber would tell the reader something had
 * gone wrong when what actually happened is that the sport was different then.
 *
 * The glyph is `info` for the same reason, and it is `aria-hidden`: icons never carry meaning
 * alone (§2.5) and the sentence beside it already says everything.
 *
 * **The routing, not the rendering, is where the design is.** `presenters.noticeSlot` sends each
 * code to the one surface whose numbers it changes, so this component is only ever handed the two
 * or three notices that belong where it sits.
 */

export interface SeasonNotesProps {
  notices: readonly SeasonNotice[];
  /** `true` wraps the list in the sunken panel — used where the notes stand alone. */
  panel?: boolean;
}

export function SeasonNotes({ notices, panel = true }: SeasonNotesProps) {
  if (notices.length === 0) return null;

  return (
    <ul className={panel ? 'season-notes season-note-panel' : 'season-notes'}>
      {notices.map((notice) => (
        <li className="season-note" key={notice.code}>
          <Info size={16} />
          <span>{notice.text}</span>
        </li>
      ))}
    </ul>
  );
}
