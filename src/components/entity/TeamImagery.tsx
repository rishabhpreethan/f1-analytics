import { useState } from 'react';
import { CreditLine } from '@/features/credits/CreditLine';
import { carFor, logoFor } from '@/features/credits/imagery';

/**
 * **The team imagery layer** — `DESIGN_SYSTEM.md` §7.19. The mark and the car, and the credit that
 * has to travel with them.
 *
 * ---
 *
 * **This layer has no placeholder, and that is the difference from §7.17.** `EntityPortrait` ships
 * a monogram because the portrait is *structural* — every row and every masthead needs a mark in
 * that slot, so the slot is always filled and the photograph is one of two fills of one shape. Here
 * nothing depends on the imagery: **11 of 214 teams have a car and 7 have a mark**, and a team page
 * is complete without either — it is exactly the page that shipped before this. So the layer is
 * **present or absent**, never a large empty letterbox reading `FER`. A 2:1 plate drawn for the
 * other 203 would announce a gap on 95% of the pages in order to decorate 5% of them.
 *
 * **Trademark, which copyright status does not settle.** Six of the seven marks are public domain
 * *for copyright*; none of them is free of trademark. A mark therefore appears **only beside the
 * name of the team it belongs to**, never as a generic badge, never in this product's own chrome,
 * and never recoloured. It is identification, which is the use trademark law leaves open.
 *
 * **The mark is height-constrained, not boxed, and the arithmetic is why.** The seven run from
 * 0.91:1 (the Mercedes star over its wordmark) to **14.3:1** (the Williams wordmark). In a 56px
 * square with `contain`, Williams would draw 56×3.9 — a sliver. A plate that caps the *height* at
 * 28px and the *width* at 160px lets the tall marks fill the height and the wide ones fill the
 * width, and every one of the seven lands between 25 and 160 px wide. That is also the reason
 * there is no mark in an index row: a row's mark slot is a square, and no cap makes a 14:1 wordmark
 * work in one.
 *
 * **The car is the opposite case — a set so uniform it needs no accommodation.** All 11 files are
 * exactly 2:1 (320×160 and 640×320), photographed at one event by one photographer from one angle,
 * so a `2 / 1` plate with `object-fit: cover` crops essentially nothing and every car is framed
 * identically. `--car-crop` is `center`, not the portrait layer's `top center`: a side-on car is
 * centred in its frame and a top anchor would cut the tyres off.
 *
 * **Nothing is set over either image** (§7.17.5). The caption and the credit sit underneath, on a
 * known surface, at a §9.2-measured pair.
 */

export interface TeamImageryProps {
  /** `team.reference`. `null` while the query is in flight — the layer then renders nothing. */
  reference: string | null;
}

/**
 * ⚠ **No accessible name is given to this block, deliberately.** The mark and the car are both
 * `aria-hidden`: the team's name is the `h1` immediately beside them, so announcing either would
 * read the same fact twice. What a non-sighted reader cannot otherwise get — *whose* car, at which
 * event, and who took the photograph — is real text underneath, in the caption and the credit.
 */
export function TeamImagery({ reference }: TeamImageryProps) {
  const car = carFor(reference);
  const mark = logoFor(reference);

  /*
   * Which reference's files failed — not a boolean, for the reason `EntityPortrait` gives: a
   * boolean survives React reusing this component for a different team and would blank imagery that
   * is perfectly fine. The manifest and the disk can disagree, and what that resolves to here is
   * *nothing*, never a broken-image glyph.
   */
  const [failed, setFailed] = useState<string | null>(null);
  const broken = failed === reference;

  if (broken || (car === undefined && mark === undefined)) return null;

  return (
    <div className="team-imagery">
      {mark !== undefined && (
        /*
         * `--mark-plate`, a fixed white ground in **both** themes. Every mark file uses fixed fills
         * rather than `currentColor` and several are solid black, so on a dark surface they would
         * be invisible; Red Bull's is a PNG with no alpha channel, so it carries its own opaque
         * white rectangle, which this ground absorbs. Recolouring is not an option — `invert()`
         * would turn Haas's red cyan, which alters a trademark.
         */
        <span className="mark-plate">
          <img
            src={mark.src}
            alt=""
            aria-hidden="true"
            decoding="async"
            loading="lazy"
            onError={() => {
              setFailed(reference);
            }}
          />
        </span>
      )}

      {car !== undefined && (
        <>
          {/*
           * `.portrait` verbatim — the same border, radius, ground and 3px identity bar the
           * portrait layer wears, at a third shape. A second plate component would be a second
           * convention for the same object.
           *
           * `aria-hidden`, and the caption below says in words what the picture shows. The team's
           * name is the `h1` beside it, so an `alt` naming the team would read the same fact twice;
           * the fact a reader actually cannot get from the picture — *whose* car, at which event —
           * is text.
           */}
          <span className="portrait" data-shape="plate" data-kind="team" aria-hidden="true">
            <img
              className="portrait-photo"
              src={car.src}
              srcSet={car.srcSet ?? undefined}
              sizes="(min-width: 64rem) 416px, (min-width: 48rem) 512px, 92vw"
              alt=""
              decoding="async"
              loading="lazy"
              onError={() => {
                setFailed(reference);
              }}
            />
          </span>

          {/*
           * §7.17.4's disclosure rule, applied to the cars. The Ferrari plate is Hamilton's car and
           * the Alpine one is Gasly's — a reader looking at a number 44 on a team page is owed the
           * fact rather than left to infer it, and the event dates the livery.
           */}
          <p className="t-2xs text-ink-tertiary">{car.title}</p>
        </>
      )}

      <CreditLine images={[car, mark]} />
    </div>
  );
}
