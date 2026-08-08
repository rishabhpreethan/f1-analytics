import type { CSSProperties } from 'react';
import { cssVar, identityToken } from '@/lib/entityColor';
import { monogram } from './format';

/**
 * **`EntityPortrait`** — `DESIGN_SYSTEM.md` §7.10, and the discharge of §7.6.
 *
 * 881 drivers and 214 teams will never all have photographs, so **the placeholder is the shipping
 * form and the image is the enrichment**. It is designed as a component with the same care as
 * everything else, not as a grey box waiting to be replaced.
 *
 * **The mark is never the identity colour** (§3.3a.5 rule 2: an identity colour is never applied to
 * a glyph that stands for a name). The colour is the 3px leading bar; the letters are
 * `--ink-primary`, which is the one value guaranteed to clear 4.5:1 on `--surface-sunken`.
 *
 * **Two letters from a surname is not the abbreviation trap.** §6.5.4a forbids *deriving a
 * three-letter code*, because a code is a convention the sport owns and inventing one
 * misrepresents the data. `HÄ` in a box is unmistakably a monogram; it does not look like `HAM`
 * and cannot be mistaken for one.
 */

export interface EntityPortraitProps {
  /** `team.reference` — what the leading bar is coloured from. */
  teamReference: string | null;
  /**
   * The **real** code where the entity has one (`abbreviation`, 107 of 881 drivers). Passing a
   * derived one would reintroduce exactly what §6.5.4a rules out.
   */
  code?: string | null;
  /** The full display name. The monogram is derived from it only when `code` is absent. */
  name: string;
  /** A driver's monogram is two letters; a team's is up to three initials. */
  kind: 'driver' | 'team';
}

export function EntityPortrait({ teamReference, code, name, kind }: EntityPortraitProps) {
  const mark = code !== null && code !== undefined && code !== '' ? code : monogram(name, kind);
  const style =
    teamReference === null
      ? undefined
      : ({ '--identity': cssVar(identityToken(teamReference)) } as CSSProperties);

  return (
    /*
     * `aria-hidden`, and that is correct rather than lazy: the name is beside it in the masthead,
     * so announcing the monogram would read the same fact twice — badly. A placeholder is
     * redundant reinforcement for sighted readers, which is exactly the role §3.4.2 gives colour.
     */
    <span className="portrait" data-kind={kind} style={style} aria-hidden="true">
      <span className="portrait-mark">{mark}</span>
    </span>
  );
}
