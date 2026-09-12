import { useCredits } from './CreditsContext';
import type { CreditedImage, ImageKind } from './imagery';

/**
 * **The credit beside the image** — `DESIGN_SYSTEM.md` §7.18.1, §7.19.3.
 *
 * This is the entry point that actually discharges CC BY: **the contributor's name is visible text
 * next to the image**, not a fact buried in a panel you have to know exists. The panel is the full
 * record — the deed and the Commons page as real links — and it is one click from here and also
 * globally reachable from the footer, which is the "reasonable manner" the licences permit.
 *
 * **One control per image, not one per surface.** A team page can show a car *and* a mark, and
 * Williams' mark is CC BY-SA 4.0 in its own right; a single line crediting only the car would leave
 * the other uncredited beside it. Each control deep-links to its own plate, so a reader who clicks
 * the mark's credit lands on the mark's plate rather than at the top of forty.
 *
 * **Public-domain images are credited here too.** They ask for nothing; §7.19.4's argument is that
 * where a picture came from is worth more than the minimum a licence demands, and a line that
 * appeared for some images and not others would read as an inconsistency rather than as a legal
 * distinction nobody can see.
 *
 * Structurally it is a `button`, never a link, and it is never rendered inside one — an index row
 * *is* a `Link`, and a button inside an anchor is invalid markup. That is why §7.18.1's global
 * footer control is required rather than a convenience.
 */

/** What the line calls each kind. A mark is not a photograph and must not claim a photographer. */
const NOUN: Record<ImageKind, string> = {
  driver: 'Photograph',
  car: 'Car',
  logo: 'Mark',
};

export interface CreditLineProps {
  /**
   * The images actually rendered on this surface. Entries are skipped where `undefined`, so a call
   * site can pass the results of `carFor` / `logoFor` straight through without guarding — 203 of
   * 214 teams have neither.
   */
  images: readonly (CreditedImage | undefined)[];
  className?: string;
}

export function CreditLine({ images, className = '' }: CreditLineProps) {
  const { open } = useCredits();
  const present = images.filter((image): image is CreditedImage => image !== undefined);
  if (present.length === 0) return null;

  return (
    /* `.credits-links` verbatim — a wrapping row with the same gap the plates' own link row uses.
     * A second row class for the same shape is how a product starts having two of everything. */
    <p className={`credits-links ${className}`.trim()}>
      {present.map((image) => (
        <button
          key={image.plateId}
          type="button"
          className="credits-trigger t-2xs"
          onClick={() => {
            open(image.plateId);
          }}
        >
          {/*
           * The visible string is the credit; the `sr-only` half says whose image it is and what
           * the control does. Announcing "Photograph Lukas Raich CC BY-SA 4.0" alone would read as
           * three fragments with no verb.
           */}
          <span aria-hidden="true">{`${NOUN[image.kind]} ${image.artist} · ${image.licence}`}</span>
          <span className="sr-only">
            {`${NOUN[image.kind]} of ${image.subject} by ${image.artist}, ${image.licence}. Open the imagery credits.`}
          </span>
        </button>
      ))}
    </p>
  );
}
