import { describe, expect, it } from 'vitest';

import {
  ALL_IMAGES,
  CARS,
  CONTRIBUTOR_COUNT,
  LICENCE_TALLY,
  LOGOS,
  PHOTOGRAPHS,
  carFor,
  driverName,
  driverSurname,
  logoFor,
  photographFor,
  teamName,
  type CreditedImage,
} from './imagery';

/**
 * **The manifest is generated outside this feature, and these assertions are what make relying on
 * it safe.** `DESIGN_SYSTEM.md` §7.17, §7.18, §7.19.
 *
 * `imagery.ts` states the manifest's shape as a type parameter to `import.meta.glob` rather than
 * checking it at runtime, so **the type is a claim and this file is the check**. A generated file
 * that grew a field, dropped one, or shipped an entry without a photographer would typecheck
 * cleanly and be wrong on a legal obligation.
 *
 * Two of these are about the licences rather than about the code, and they are the ones worth
 * keeping: an entry with no `artist`, or with no `sourceUrl`, is a **licence breach** the moment
 * this repository is public. Nothing else in the suite would catch it. The 11 cars raise the stakes
 * on exactly that check: all 11 are CC BY-SA 4.0, which is the most demanding licence in the set.
 *
 * The last describe enumerates `public/assets/` itself, which is the only way to catch the manifest
 * and the directory disagreeing. It does so with `import.meta.glob` and **not** with `node:fs`:
 * this project is browser code, `tsconfig.app.json` carries no node types, and `index.css.test.ts`
 * already records that a client test reaching the filesystem is the wrong fix. Vite resolves the
 * glob at transform time, so the keys below are the real directory listing.
 */

/**
 * Every image file that ships, as root-relative URLs — the same form the manifest publishes.
 * `import.meta.glob` needs a **literal** pattern, so each directory and extension is enumerated.
 */
const ON_DISK = new Set(
  [
    ...Object.keys(import.meta.glob('../../../public/assets/drivers/*.webp')),
    ...Object.keys(import.meta.glob('../../../public/assets/teams/*.webp')),
    ...Object.keys(import.meta.glob('../../../public/assets/teams/*.svg')),
  ].map((key) => key.replace('../../../public', '')),
);

/** Every URL any set publishes, in both candidate widths. */
function urlsOf(image: CreditedImage): string[] {
  if (image.srcSet === null) return [image.src];
  return image.srcSet.split(',').map((candidate) => candidate.trim().split(' ')[0] ?? '');
}

describe('the imagery manifest — §7.17, §7.19', () => {
  it('resolves all three sets, which is what `import.meta.glob` has to be proved to do', () => {
    // If the glob specifier ever stops matching, every image silently disappears and nothing else
    // in the suite changes. This is that tripwire, and it now has three ways to fire.
    expect(PHOTOGRAPHS.length).toBeGreaterThan(0);
    expect(CARS.length).toBeGreaterThan(0);
    expect(LOGOS.length).toBeGreaterThan(0);
    expect(ALL_IMAGES.length).toBe(PHOTOGRAPHS.length + CARS.length + LOGOS.length);
  });

  it('credits every single entry — author, licence and a link to the source', () => {
    for (const image of ALL_IMAGES) {
      expect(image.artist, `${image.plateId} has no artist`).not.toBe('');
      expect(image.licence, `${image.plateId} has no licence`).not.toBe('');
      /*
       * `https?`, not `https`. The CC0 deed URL Wikimedia records is
       * `http://creativecommons.org/publicdomain/zero/1.0/deed.en`, and **the recorded URL is
       * provenance rather than ours to tidy** — rewriting a scheme in an attribution record is
       * editing the record. It is a link, not a subresource, so there is no mixed-content
       * consequence; creativecommons.org redirects it.
       */
      expect(image.sourceUrl, `${image.plateId} has no source URL`).toMatch(/^https?:\/\//);
    }
  });

  it('carries a deed URL wherever one exists, and null exactly where public domain is claimed', () => {
    /*
     * ⚠ **The doc comment on `imagery.ts` used to promise a `licenceUrl` on every entry, and the
     * marks made that false.** Public domain has no deed to link to, so Commons publishes no URL —
     * that is correct data, not a gap. What must stay true is the *implication*: a null URL only
     * ever accompanies a public-domain claim, and anything else must be a real link. A
     * `CC BY-SA 4.0` entry with a null URL would be an unlinked attribution, i.e. a breach.
     */
    for (const image of ALL_IMAGES) {
      if (image.licenceUrl === null) {
        expect(image.licence, `${image.plateId} has no URL and no PD claim`).toMatch(
          /public domain|^CC0/i,
        );
      } else {
        expect(image.licenceUrl, `${image.plateId} has a malformed licence URL`).toMatch(
          /^https?:\/\//,
        );
      }
    }
  });

  it('publishes two candidates for a photograph and exactly one file for a mark', () => {
    for (const image of [...PHOTOGRAPHS, ...CARS]) {
      expect(image.srcSet, `${image.plateId} has no srcSet`).toMatch(/ 320w, .* 640w$/);
      expect(image.src).toMatch(/^\/assets\/(drivers|teams)\/[\w-]+-320\.webp$/);
    }
    for (const mark of LOGOS) {
      /*
       * `null`, not `"x 320w, x 640w"`. Naming one file twice tells the browser two candidates
       * exist at two densities, which is a false claim about the asset — and for the six SVGs it is
       * meaningless, since a vector has no pixel width to choose between.
       */
      expect(mark.srcSet, `${mark.plateId} claims widths it does not have`).toBeNull();
      expect(mark.src).toMatch(/^\/assets\/teams\/[\w-]+\.(svg|webp)$/);
    }
  });

  it('gives every image a kind-qualified plate id, so a deep link cannot be ambiguous', () => {
    const ids = ALL_IMAGES.map((image) => image.plateId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const image of ALL_IMAGES) {
      expect(image.plateId).toBe(`credit-${image.kind}-${image.ref}`);
    }
    // The case the qualification exists for: one reference, two sets, two plates.
    expect(carFor('ferrari')?.plateId).not.toBe(photographFor('leclerc')?.plateId);
    expect(carFor('mclaren')?.plateId).not.toBe(logoFor('mclaren')?.plateId);
  });

  it('strips the file extension from a title, which is a caption and not a filename', () => {
    for (const image of ALL_IMAGES) {
      expect(image.title).not.toMatch(/\.(jpe?g|png|webp|svg)$/i);
      expect(image.title).not.toBe('');
    }
  });

  it('names every photographed driver, so no plate can ship labelled with a slug', () => {
    /*
     * The name map is hand-written and verified by query. A driver added by a later imagery run
     * would fall through to the reference — `arvid_lindblad` under a photograph — and this is what
     * makes that a failing build rather than a shipped defect.
     */
    for (const photograph of PHOTOGRAPHS) {
      expect(driverName(photograph.ref), `${photograph.ref} is unnamed`).not.toBe(photograph.ref);
    }
  });

  it('names every team with a car or a mark, by the same rule', () => {
    // `rb` is `RB F1 Team` in `team`; no string transformation of the reference produces it, and a
    // plate reading `rb` would be the slug leaking onto the one surface about being accurate.
    for (const image of [...CARS, ...LOGOS]) {
      expect(teamName(image.ref), `${image.ref} is unnamed`).not.toBe(image.ref);
    }
    expect(teamName('rb')).toBe('RB F1 Team');
    expect(teamName('red_bull')).toBe('Red Bull');
  });

  it('does not derive a name from a reference — Jos and Max are different people', () => {
    // `max_verstappen` is Max; `verstappen` is Jos, who has no photograph. A prettified slug would
    // have got this wrong in the one place an F1 reader would certainly notice.
    expect(driverName('max_verstappen')).toBe('Max Verstappen');
    expect(photographFor('verstappen')).toBeUndefined();
  });

  it('keeps the diacritics a derived name would have lost', () => {
    expect(driverName('hulkenberg')).toBe('Nico Hülkenberg');
    expect(driverName('perez')).toBe('Sergio Pérez');
  });
});

describe('lookup — the sets do not leak into each other', () => {
  it('answers undefined for a driver with no photograph', () => {
    expect(photographFor('senna')).toBeUndefined();
    expect(photographFor('fangio')).toBeUndefined();
  });

  it('answers undefined for no reference at all, so a call site need not guard', () => {
    for (const lookup of [photographFor, carFor, logoFor]) {
      expect(lookup(null)).toBeUndefined();
      expect(lookup(undefined)).toBeUndefined();
      expect(lookup('')).toBeUndefined();
    }
  });

  it('answers a photograph for a driver who has one', () => {
    const hamilton = photographFor('hamilton');
    expect(hamilton?.src).toBe('/assets/drivers/hamilton-320.webp');
    expect(hamilton?.srcSet).toBe(
      '/assets/drivers/hamilton-320.webp 320w, /assets/drivers/hamilton-640.webp 640w',
    );
  });

  it('answers a car for each of the eleven, and nothing for the other 203', () => {
    expect(CARS).toHaveLength(11);
    expect(carFor('ferrari')?.src).toBe('/assets/teams/ferrari-car-320.webp');
    expect(carFor('lotus_f1')).toBeUndefined();
    expect(carFor('brabham')).toBeUndefined();
  });

  it('answers a mark only for the seven that have one — the four missing are unavailable, not absent by mistake', () => {
    /*
     * Ferrari, Cadillac, Aston Martin and Racing Bulls have **no free file**: a prancing horse, a
     * crest and a winged badge are above the threshold of originality. This asserts the shape of
     * that gap rather than papering over it, and it is the reason §7.19.2 makes the mark pure
     * enrichment and never the shipping form.
     */
    expect(LOGOS).toHaveLength(7);
    for (const ref of ['ferrari', 'cadillac', 'aston_martin', 'rb']) {
      expect(logoFor(ref), `${ref} has gained a mark — §7.19 needs revisiting`).toBeUndefined();
    }
    expect(logoFor('mclaren')?.src).toBe('/assets/teams/mclaren.svg');
  });

  it('never answers a driver lookup with a team image, or the reverse', () => {
    // `haas` is a team reference *and* would be a plausible driver slug. The map is keyed by
    // `kind:ref` exactly so that one namespace cannot answer for another.
    expect(photographFor('haas')).toBeUndefined();
    expect(carFor('hamilton')).toBeUndefined();
    expect(logoFor('hamilton')).toBeUndefined();
  });
});

describe('ordering and tallies — §7.18.2', () => {
  it('orders the driver plates by surname under a collator, not by code point', () => {
    /*
     * `'Hülkenberg' < 'Lawson'` is false under `<` — `ü` is U+00FC, past every ASCII letter — so a
     * naive sort files him after Stroll. The list is a list of people and has to read like one.
     */
    const surnames = PHOTOGRAPHS.map((p) => driverSurname(p.ref));
    const collated = [...surnames].sort((a, b) => a.localeCompare(b, 'en'));
    expect(surnames).toEqual(collated);
    expect(surnames.indexOf('Hülkenberg')).toBeLessThan(surnames.indexOf('Lawson'));
  });

  it('orders the car and mark plates by team name', () => {
    for (const set of [CARS, LOGOS]) {
      const names = set.map((image) => image.subject);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    }
  });

  it('tallies every image exactly once across the licences', () => {
    const counted = LICENCE_TALLY.reduce((sum, tally) => sum + tally.count, 0);
    expect(counted).toBe(ALL_IMAGES.length);
  });

  it('gives each licence a share that is its count, so a bar cannot misreport it', () => {
    // §6.3b's rule applied to the ladder: a bar's extent *is* the datum.
    for (const tally of LICENCE_TALLY) {
      expect(tally.share).toBeCloseTo(tally.count / ALL_IMAGES.length, 10);
    }
    const total = LICENCE_TALLY.reduce((sum, tally) => sum + tally.share, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('ranks the ladder by count and breaks ties by name, so the order is deterministic', () => {
    for (let i = 1; i < LICENCE_TALLY.length; i += 1) {
      const previous = LICENCE_TALLY[i - 1];
      const current = LICENCE_TALLY[i];
      if (previous === undefined || current === undefined) throw new Error('unreachable');
      expect(previous.count).toBeGreaterThanOrEqual(current.count);
      if (previous.count === current.count) {
        expect(previous.licence.localeCompare(current.licence, 'en')).toBeLessThan(0);
      }
    }
  });

  it('carries a deed link on every licence row that has one, and null only for public domain', () => {
    for (const tally of LICENCE_TALLY) {
      if (tally.licenceUrl === null) {
        expect(tally.licence).toMatch(/public domain/i);
      } else {
        expect(tally.licenceUrl).toMatch(/^https?:\/\//);
      }
    }
  });

  it('counts contributors as distinct names, never as images', () => {
    expect(CONTRIBUTOR_COUNT).toBeGreaterThan(0);
    expect(CONTRIBUTOR_COUNT).toBeLessThanOrEqual(ALL_IMAGES.length);
    expect(CONTRIBUTOR_COUNT).toBe(new Set(ALL_IMAGES.map((image) => image.artist)).size);
  });
});

describe('the manifest and the disk agree — the check nothing else performs', () => {
  it('has a real file behind every path it publishes', () => {
    /*
     * `EntityPortrait`'s `onError` fallback exists for the case this catches, but a fallback is a
     * safety net rather than a plan: a manifest entry with no file on disk is a broken build, and
     * it is invisible in jsdom because jsdom loads no images at all.
     */
    for (const image of ALL_IMAGES) {
      for (const src of urlsOf(image)) {
        expect(ON_DISK.has(src), `${src} is missing from disk`).toBe(true);
      }
    }
  });

  it('credits every file that ships — no image on disk without an entry', () => {
    /*
     * **This is the licence check, and it runs the other way round on purpose.** The test above
     * catches a manifest entry with no file, which is a broken image. This one catches a *file with
     * no entry* — an image shipping in a public repository with no photographer, no licence and no
     * link back, which is a breach rather than a defect. Nothing else in the suite looks at the
     * directory at all.
     *
     * It is also the test that would have caught the state this round started in: 22 files credited
     * by a reader that knew about `manifest.drivers`, and 29 more on disk under
     * `public/assets/teams/` that it could not see.
     */
    const credited = new Set(ALL_IMAGES.flatMap(urlsOf));
    for (const file of ON_DISK) {
      expect(credited.has(file), `${file} ships with no attribution`).toBe(true);
    }
  });
});
