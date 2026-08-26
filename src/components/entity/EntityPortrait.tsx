import { useState, type CSSProperties } from 'react';
import { photographFor } from '@/features/credits/imagery';
import { cssVar, identityToken } from '@/lib/entityColor';
import { monogram } from './format';

/**
 * **`EntityPortrait`** — `DESIGN_SYSTEM.md` §7.10, §7.17, and the discharge of §7.6.
 *
 * 881 drivers and 214 teams will never all have photographs, so **the placeholder is the shipping
 * form and the image is the enrichment**. It is designed as a component with the same care as
 * everything else, not as a grey box waiting to be replaced.
 *
 * **22 drivers have a photograph. 859 never will**, so the mixed state is the normal case rather
 * than an edge case, and the component is built for it: **one shape, two fills**. A bay with a face
 * and a bay with `SE` are the same rectangle, the same border, the same ground and the same
 * identity bar; only what is inside differs. Nothing in the layout tells a reader that a monogram
 * is a photograph that failed to arrive, because in this product it is not (§7.17.1).
 *
 * **The mark is never the identity colour** (§3.3a.5 rule 2: an identity colour is never applied to
 * a glyph that stands for a name). The colour is the 3px leading bar; the letters are
 * `--ink-primary`, which is the one value guaranteed to clear 4.5:1 on `--surface-sunken`.
 *
 * **Two letters from a surname is not the abbreviation trap.** §6.5.4a forbids *deriving a
 * three-letter code*, because a code is a convention the sport owns and inventing one
 * misrepresents the data. `HÄ` in a box is unmistakably a monogram; it does not look like `HAM`
 * and cannot be mistaken for one.
 *
 * ---
 *
 * **No `<img>` is rendered for a driver with no manifest entry.** The manifest is consulted first
 * and a path is never composed from a reference — 859 composed paths on `/drivers` would be 859
 * failed requests in one paint (§7.17.6). A file that goes missing *anyway* is caught by `onError`
 * and falls back to the monogram in place, never to a broken-image glyph.
 *
 * **`aria-hidden` survives the photograph.** The name is beside it in every call site, so
 * announcing either the monogram or "photograph of Lewis Hamilton" would read the same fact twice.
 * A portrait is redundant reinforcement for sighted readers, which is exactly the role §3.4.2 gives
 * colour. Attribution is a separate surface with its own accessible name (§7.18).
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
  /**
   * `driver.reference` — the photograph manifest's key. Omit it and the monogram always renders,
   * which is the correct behaviour for a team: there are no team photographs.
   */
  reference?: string | null;
  /**
   * `box` (default) is the square used by a masthead and an index row. `band` is the full-width
   * 16:9 shape a compare tray bay wears (§7.17.1).
   */
  shape?: 'box' | 'band';
  /**
   * `true` on the **driver profile masthead only**, where the portrait is likely the largest
   * element and therefore the LCP candidate: it loads eagerly at high priority. Everywhere else
   * the portrait is below the fold and lazy (§7.17.6).
   */
  priority?: boolean;
}

/**
 * What the browser is told the rendered box will be, so it can choose between the 320w and 640w
 * candidates before layout. A `box` is 56 or 72 CSS px — 144 at 2×, so it takes the 320. A `band`
 * is a grid cell, and the fractions below track `.tray-bays`' 1 / 2 / 4 columns closely enough for
 * a two-candidate set; at 2× it takes the 640.
 */
const SIZES: Record<'box' | 'band', string> = {
  box: '72px',
  band: '(min-width: 64rem) 320px, (min-width: 48rem) 46vw, 92vw',
};

export function EntityPortrait({
  teamReference,
  code,
  name,
  kind,
  reference = null,
  shape = 'box',
  priority = false,
}: EntityPortraitProps) {
  const mark = code !== null && code !== undefined && code !== '' ? code : monogram(name, kind);
  const photograph = photographFor(reference);

  /*
   * Which reference's file failed to load — not a boolean. A boolean would survive React reusing
   * this component for a different row of a list (same position, new props) and would blank a
   * photograph that is perfectly fine, which is a bug that only ever appears after a filter change.
   */
  const [failedRef, setFailedRef] = useState<string | null>(null);
  const showPhotograph = photograph !== undefined && failedRef !== photograph.ref;

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
    <span
      className="portrait"
      data-kind={kind}
      data-shape={shape}
      data-filled={showPhotograph ? 'photo' : 'mark'}
      style={style}
      aria-hidden="true"
    >
      {showPhotograph ? (
        <img
          className="portrait-photo"
          src={photograph.src320}
          srcSet={`${photograph.src320} 320w, ${photograph.src640} 640w`}
          sizes={SIZES[shape]}
          alt=""
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          onError={() => {
            setFailedRef(photograph.ref);
          }}
        />
      ) : (
        <span className="portrait-mark">{mark}</span>
      )}
    </span>
  );
}
