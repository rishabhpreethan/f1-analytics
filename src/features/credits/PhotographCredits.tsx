import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { X } from '@/components/ui/icons';
import { LICENCE_TALLY, PHOTOGRAPHER_COUNT, PHOTOGRAPHS, driverName } from './imagery';

/**
 * **The panel** — `DESIGN_SYSTEM.md` §7.18.2.
 *
 * A bare list of links would discharge the licence and be beneath the rest of this product. So the
 * panel opens the way an index page does — with the **shape** of the thing it is listing (§7.14's
 * argument, applied to 22 photographs): three figures, a licence ladder, then the plates.
 *
 * **Almost every class here already existed.** `.stat-strip`, `.stat-tile`, `.stat-figure`,
 * `.stat-label`, the whole `.ruler` family, `.chip`, `.link`, `.btn-icon`, `.season-eyebrow` and
 * the `.t-*` utilities are all reused. CSS is the binding budget at 83.4% of 25 KB — and the ladder
 * in particular is genuinely the same mark the coverage ruler is, *a labelled proportion of a whole
 * with its figure beside it*, rather than a shape borrowed to save bytes.
 *
 * **`object-fit: contain`, not `cover`** (§7.17.3). This is the one place the photograph is the
 * subject rather than an identity mark, so it is shown whole, as the photographer framed it,
 * letterboxed on `--surface-sunken`. Everywhere else it is cropped to the shape the layout needs.
 *
 * **The Commons title is not decoration.** It is the disclosure of when and where each photograph
 * was taken — *"Alex Albon at the Melbourne Walk during the 2026 Australian Grand Prix"* — which is
 * how a reader resolves a Ferrari cap beside a Williams identity bar (§7.17.4). Several of these
 * are the right driver at the wrong moment, and this is where that is stated as a fact rather than
 * hedged.
 */

const TITLE_ID = 'credits-title';
const LADDER_ID = 'credits-ladder';

const plateId = (reference: string) => `credit-${reference}`;

export interface PhotographCreditsProps {
  /** A `driver.reference` to land on, or `null` for the top of the panel. */
  focusReference: string | null;
  onClose: () => void;
}

export function PhotographCredits({ focusReference, onClose }: PhotographCreditsProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    /*
     * Focus lands on the plate the reader asked for, and on the close button otherwise. The close
     * button rather than the first link, because unlike the dock's sheet this panel is a document:
     * there is no single destination in it, and the one thing a reader always wants to be able to
     * do is leave.
     */
    if (focusReference !== null) {
      const plate = panelRef.current?.querySelector<HTMLElement>(`#${plateId(focusReference)}`);
      if (plate !== null && plate !== undefined) {
        plate.scrollIntoView({ block: 'center' });
        plate.focus();
        return;
      }
    }
    closeRef.current?.focus();
  }, [focusReference]);

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
            The photographs
          </h2>

          <p className="credits-lead t-sm text-ink-secondary">
            {PHOTOGRAPHS.length} drivers in this archive have a photograph. Every one of them is
            used under a free licence that asks for the photographer, the licence and a link back —
            so those travel with the picture, here. Everyone else carries a monogram, and that is
            the shipping form rather than a gap.
          </p>
        </div>

        <div className="credits-scroll">
          <div className="stat-strip credits-figures" data-motion="sheet-row">
            <Figure value={PHOTOGRAPHS.length} label="Photographs" />
            <Figure value={PHOTOGRAPHER_COUNT} label="Photographers" />
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
                  <a
                    className="link t-sm"
                    href={tally.licenceUrl}
                    rel="noreferrer noopener license"
                    target="_blank"
                  >
                    {tally.licence}
                  </a>
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

          <ul className="credits-plates" data-motion="sheet-row">
            {PHOTOGRAPHS.map((photograph) => (
              <li
                className="credits-plate"
                id={plateId(photograph.ref)}
                key={photograph.ref}
                tabIndex={-1}
              >
                <span className="credits-frame">
                  <img
                    className="credits-image"
                    src={photograph.src320}
                    srcSet={`${photograph.src320} 320w, ${photograph.src640} 640w`}
                    sizes="(min-width: 48rem) 220px, 44vw"
                    alt={`${driverName(photograph.ref)}, photographed by ${photograph.artist}`}
                    decoding="async"
                    loading="lazy"
                  />
                </span>

                <p className="credits-driver t-2xs text-ink-tertiary">
                  {driverName(photograph.ref)}
                </p>
                <p className="credits-artist">{photograph.artist}</p>
                <p className="credits-caption t-2xs text-ink-tertiary">{photograph.title}</p>

                <p className="credits-links t-xs">
                  <a
                    className="link"
                    href={photograph.licenceUrl}
                    rel="noreferrer noopener license"
                    target="_blank"
                  >
                    {photograph.licence}
                  </a>
                  <a
                    className="link"
                    href={photograph.sourceUrl}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    Source
                    <span className="sr-only">
                      {' '}
                      for the photograph of {driverName(photograph.ref)}
                    </span>
                  </a>
                </p>
              </li>
            ))}
          </ul>

          <p className="credits-foot t-xs text-ink-tertiary" data-motion="sheet-row">
            One photograph is public-domain dedicated under CC0, which asks for nothing. It is
            credited here anyway. Anything wrong on this page is ours to fix — the record is in{' '}
            <span className="t-mono">src/features/credits/imagery.json</span>.
          </p>
        </div>
      </div>
    </>
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
