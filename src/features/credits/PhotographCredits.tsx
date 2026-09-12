import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { X } from '@/components/ui/icons';
import {
  ALL_IMAGES,
  CARS,
  CONTRIBUTOR_COUNT,
  LICENCE_TALLY,
  LOGOS,
  PHOTOGRAPHS,
  type CreditedImage,
  type ImageKind,
} from './imagery';

/**
 * **The panel** — `DESIGN_SYSTEM.md` §7.18.2, extended to three sets by §7.19.5.
 *
 * A bare list of links would discharge the licence and be beneath the rest of this product. So the
 * panel opens the way an index page does — with the **shape** of the thing it is listing (§7.14's
 * argument, applied to 40 images): three figures, a licence ladder, then the plates, in three
 * sections.
 *
 * **Cars are the reason this had to be extended before anything rendered one.** All 11 are
 * CC BY-SA 4.0, which requires the author, the licence and a link back to travel with the work.
 * A car on a team page whose credit was unreachable would be a licence breach, not an untidy
 * detail, and the reader that fed this surface read `manifest.drivers` alone.
 *
 * **`object-fit: contain`, not `cover`** (§7.17.3). This is the one place the image is the subject
 * rather than an identity mark, so it is shown whole, as it was framed. Everywhere else it is
 * cropped to the shape the layout needs.
 *
 * **The Commons title is not decoration.** It is the disclosure of when and where each photograph
 * was taken — *"Alex Albon at the Melbourne Walk during the 2026 Australian Grand Prix"* — which is
 * how a reader resolves a Ferrari cap beside a Williams identity bar (§7.17.4). Several of these
 * are the right driver at the wrong moment, and this is where that is stated as a fact rather than
 * hedged.
 */

const TITLE_ID = 'credits-title';
const LADDER_ID = 'credits-ladder';

export interface PhotographCreditsProps {
  /** A `CreditedImage.plateId` to land on, or `null` for the top of the panel. */
  focusPlate: string | null;
  onClose: () => void;
}

export function PhotographCredits({ focusPlate, onClose }: PhotographCreditsProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    /*
     * Focus lands on the plate the reader asked for, and on the close button otherwise. The close
     * button rather than the first link, because unlike the dock's sheet this panel is a document:
     * there is no single destination in it, and the one thing a reader always wants to be able to
     * do is leave.
     */
    if (focusPlate !== null) {
      const plate = panelRef.current?.querySelector<HTMLElement>(`#${focusPlate}`);
      if (plate !== null && plate !== undefined) {
        plate.scrollIntoView({ block: 'center' });
        plate.focus();
        return;
      }
    }
    closeRef.current?.focus();
  }, [focusPlate]);

  /** Traps Tab inside the panel and closes on `Esc` — `DockSheet`'s handler, same product, same rules. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button');
    if (focusable === undefined || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div className="credits-scrim" data-motion="scrim" aria-hidden="true" onClick={onClose} />

      <div
        ref={panelRef}
        className="credits-panel"
        data-motion="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onKeyDown={onKeyDown}
      >
        <div className="credits-head">
          <div className="credits-head-row">
            <p className="season-eyebrow">
              <span className="accent-rule" aria-hidden="true" />
              Attribution
            </p>
            <button ref={closeRef} type="button" className="btn-icon" onClick={onClose}>
              <X size={16} />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <h2 id={TITLE_ID} className="credits-heading">
            The imagery
          </h2>

          {/*
           * **Every figure here is read from the manifest, never written into the copy.** A
           * hardcoded *twenty-two* is wrong the first time an image is added, and wrong quietly —
           * and `credits.test.tsx` asserts each against the manifest rather than against a literal.
           */}
          <p className="credits-lead t-sm text-ink-secondary">
            {ALL_IMAGES.length} images ship with this archive — {PHOTOGRAPHS.length} driver
            portraits, {CARS.length} cars and {LOGOS.length} team marks. Every one is free-licensed
            or in the public domain, and the licences that ask for a photographer, a licence and a
            link back get all three, here. The other 859 drivers and 203 teams carry a monogram, and
            that is the shipping form rather than a gap.
          </p>
        </div>

        <div className="credits-scroll">
          <div className="stat-strip credits-figures" data-motion="sheet-row">
            <Figure value={ALL_IMAGES.length} label="Images" />
            <Figure value={CONTRIBUTOR_COUNT} label="Contributors" />
            <Figure value={LICENCE_TALLY.length} label="Licences" />
          </div>

          <section aria-labelledby={LADDER_ID} data-motion="sheet-row">
            <h3 id={LADDER_ID} className="credits-subhead">
              Under which licence
            </h3>

            {/*
             * `.ruler` verbatim — label, track, figure, on the same three-column grid the coverage
             * ruler uses. The single override is `border-left: 0` on the fill: the coverage ruler's
             * 2px surface gap separates an available span from an unavailable one, and here there
             * is nothing to the left of the bar, so it would make every bar 2px short of the count
             * it encodes. §6.3b — a mark's length is the datum.
             */}
            <div className="ruler credits-ladder">
              {LICENCE_TALLY.map((tally) => (
                <div className="ruler-row" key={tally.licence}>
                  <Licence licence={tally.licence} licenceUrl={tally.licenceUrl} />
                  <span className="ruler-track">
                    <span
                      className="ruler-fill"
                      style={
                        {
                          '--band-offset': '0%',
                          '--band-extent': `${String(tally.share * 100)}%`,
                        } as CSSProperties
                      }
                    />
                  </span>
                  <span className="t-mono t-sm text-ink-secondary">{tally.count}</span>
                </div>
              ))}
            </div>
          </section>

          <PlateSet
            heading={`${String(PHOTOGRAPHS.length)} driver portraits`}
            images={PHOTOGRAPHS}
          />
          <PlateSet heading={`${String(CARS.length)} cars`} images={CARS} />
          <PlateSet heading={`${String(LOGOS.length)} team marks`} images={LOGOS} />

          <p className="credits-foot t-xs text-ink-tertiary" data-motion="sheet-row">
            Public-domain files ask for nothing at all. They are credited here anyway, because where
            a picture came from is worth more than the minimum a licence demands. A team mark is the
            property of the team it belongs to, is shown only beside that team’s name, and is never
            this product’s own branding. Anything wrong on this page is ours to fix — the record is
            in <span className="t-mono">src/features/credits/imagery.json</span>.
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * One section of plates. Three of them, and they differ **only** in the `data-kind` on the list —
 * which is what picks the frame's aspect and, for a mark, its ground (§7.19.4). The plate itself is
 * one component with one anatomy, for the same reason `EntityPortrait` is one shape with two fills:
 * three plate designs in one panel would read as three sources.
 */
function PlateSet({ heading, images }: { heading: string; images: readonly CreditedImage[] }) {
  if (images.length === 0) return null;
  const headingId = `credits-set-${images[0]?.kind ?? 'none'}`;
  return (
    <section aria-labelledby={headingId} data-motion="sheet-row">
      <h3 id={headingId} className="credits-subhead">
        {heading}
      </h3>
      <ul className="credits-plates" data-kind={images[0]?.kind}>
        {images.map((image) => (
          <Plate image={image} key={image.plateId} />
        ))}
      </ul>
    </section>
  );
}

/**
 * What the browser is told each plate's rendered box will be, so it can pick a candidate before
 * layout. The panel is `max-width: 56rem` with 20px of padding, so a 3-up driver column is ~276px
 * and a 2-up car column ~420px — the car's `sizes` therefore has to be its own value, or an 840px
 * device-pixel car would be drawn from the 320w file. A mark ships as one file and gets neither
 * `srcSet` nor `sizes`.
 */
const PLATE_SIZES: Record<ImageKind, string | undefined> = {
  driver: '(min-width: 48rem) 280px, 44vw',
  car: '(min-width: 48rem) 420px, 88vw',
  logo: undefined,
};

function Plate({ image }: { image: CreditedImage }) {
  /*
   * Four of the seven marks record the team itself as the rights holder, so the subject line and
   * the artist line would print the same string twice. Suppressed rather than restyled: a plate
   * that says "Alpine F1 Team / Alpine F1 Team" reads as a rendering fault.
   */
  const showSubject = image.subject !== image.artist;

  return (
    <li className="credits-plate" id={image.plateId} tabIndex={-1}>
      <span className="credits-frame">
        <img
          className="credits-image"
          src={image.src}
          srcSet={image.srcSet ?? undefined}
          sizes={PLATE_SIZES[image.kind]}
          alt={
            image.kind === 'logo'
              ? `${image.subject} team mark`
              : `${image.subject}, photographed by ${image.artist}`
          }
          decoding="async"
          loading="lazy"
        />
      </span>

      {showSubject && <p className="credits-driver t-2xs text-ink-tertiary">{image.subject}</p>}
      <p className="credits-artist">{image.artist}</p>
      <p className="credits-caption t-2xs text-ink-tertiary">{image.title}</p>

      <p className="credits-links t-xs">
        <Licence licence={image.licence} licenceUrl={image.licenceUrl} />
        <a className="link" href={image.sourceUrl} rel="noreferrer noopener" target="_blank">
          Source
          <span className="sr-only"> for the image of {image.subject}</span>
        </a>
      </p>
    </li>
  );
}

/**
 * The licence, as a link to its deed where one exists and as **text** where one does not.
 *
 * §7.19.4 — public domain has no deed, so Commons publishes no URL for it, and six of the seven
 * marks are in that case. `<a href={null}>` renders an anchor with no `href`: not focusable, not
 * announced as a link, and indistinguishable from a link that is simply broken. The text form is
 * the accurate one, and *"Public domain"* is a complete statement on its own in a way that
 * *"CC BY-SA 4.0"* is not.
 */
function Licence({ licence, licenceUrl }: { licence: string; licenceUrl: string | null }) {
  if (licenceUrl === null) {
    return <span className="t-sm text-ink-secondary">{licence}</span>;
  }
  return (
    <a className="link t-sm" href={licenceUrl} rel="noreferrer noopener license" target="_blank">
      {licence}
    </a>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-figure t-mono">{value}</span>
      <span className="stat-label t-2xs text-ink-tertiary">{label}</span>
    </div>
  );
}
