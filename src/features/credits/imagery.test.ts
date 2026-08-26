import { describe, expect, it } from 'vitest';

import {
  LICENCE_TALLY,
  PHOTOGRAPHER_COUNT,
  PHOTOGRAPHS,
  driverName,
  driverSurname,
  photographFor,
} from './imagery';

/**
 * **The manifest is generated outside this feature, and these assertions are what make relying on
 * it safe.** `DESIGN_SYSTEM.md` §7.17, §7.18.
 *
 * `imagery.ts` states the manifest's shape as a type parameter to `import.meta.glob` rather than
 * checking it at runtime, so **the type is a claim and this file is the check**. A generated file
 * that grew a field, dropped one, or shipped an entry without a photographer would typecheck
 * cleanly and be wrong on a legal obligation.
 *
 * Two of these are about the licences rather than about the code, and they are the ones worth
 * keeping: an entry with no `artist`, or with no `sourceUrl`, is a **licence breach** the moment
 * this repository is public. Nothing else in the suite would catch it.
 *
 * The last describe enumerates `public/assets/drivers/` itself, which is the only way to catch the
 * manifest and the directory disagreeing. It does so with `import.meta.glob` and **not** with
 * `node:fs`: this project is browser code, `tsconfig.app.json` carries no node types, and
 * `index.css.test.ts` already records that a client test reaching the filesystem is the wrong fix.
 * Vite resolves the glob at transform time, so the keys below are the real directory listing.
 */

/**
 * Every converted file on disk, as root-relative URLs — the same form the manifest publishes.
 * `import.meta.glob` needs a **literal** pattern, so the two widths are enumerated separately.
 */
const ON_DISK = new Set(
  [
    ...Object.keys(import.meta.glob('../../../public/assets/drivers/*-320.webp')),
    ...Object.keys(import.meta.glob('../../../public/assets/drivers/*-640.webp')),
  ].map((key) => key.replace('../../../public', '')),
);

describe('the photograph manifest — §7.17', () => {
  it('resolves at all, which is what `import.meta.glob` has to be proved to do', () => {
    // If the glob specifier ever stops matching, every driver silently loses their photograph and
    // nothing else in the suite changes. This is that tripwire.
    expect(PHOTOGRAPHS.length).toBeGreaterThan(0);
  });

  it('credits every single entry — author, licence and a link to the source', () => {
    for (const photograph of PHOTOGRAPHS) {
      expect(photograph.artist, `${photograph.ref} has no artist`).not.toBe('');
      expect(photograph.licence, `${photograph.ref} has no licence`).not.toBe('');
      /*
       * `https?`, not `https`. The CC0 deed URL Wikimedia records is
       * `http://creativecommons.org/publicdomain/zero/1.0/deed.en`, and **the recorded URL is
       * provenance rather than ours to tidy** — rewriting a scheme in an attribution record is
       * editing the record. It is a link, not a subresource, so there is no mixed-content
       * consequence; creativecommons.org redirects it.
       */
      expect(photograph.licenceUrl, `${photograph.ref} has no licence URL`).toMatch(/^https?:\/\//);
      expect(photograph.sourceUrl, `${photograph.ref} has no source URL`).toMatch(/^https?:\/\//);
    }
  });

  it('publishes both widths for every entry, as root-relative WebP', () => {
    for (const photograph of PHOTOGRAPHS) {
      expect(photograph.src320).toMatch(/^\/assets\/drivers\/[\w-]+-320\.webp$/);
      expect(photograph.src640).toMatch(/^\/assets\/drivers\/[\w-]+-640\.webp$/);
    }
  });

  it('strips the file extension from a title, which is a caption and not a filename', () => {
    for (const photograph of PHOTOGRAPHS) {
      expect(photograph.title).not.toMatch(/\.(jpe?g|png|webp)$/i);
      expect(photograph.title).not.toBe('');
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

describe('lookup — the 859 without a photograph are the normal case', () => {
  it('answers undefined for a driver with no photograph', () => {
    expect(photographFor('senna')).toBeUndefined();
    expect(photographFor('fangio')).toBeUndefined();
  });

  it('answers undefined for no reference at all, so a call site need not guard', () => {
    expect(photographFor(null)).toBeUndefined();
    expect(photographFor(undefined)).toBeUndefined();
    expect(photographFor('')).toBeUndefined();
  });

  it('answers a photograph for a driver who has one', () => {
    const hamilton = photographFor('hamilton');
    expect(hamilton?.src320).toBe('/assets/drivers/hamilton-320.webp');
    expect(hamilton?.src640).toBe('/assets/drivers/hamilton-640.webp');
  });
});

describe('ordering and tallies — §7.18.2', () => {
  it('orders the plates by surname under a collator, not by code point', () => {
    /*
     * `'Hülkenberg' < 'Lawson'` is false under `<` — `ü` is U+00FC, past every ASCII letter — so a
     * naive sort files him after Stroll. The list is a list of people and has to read like one.
     */
    const surnames = PHOTOGRAPHS.map((p) => driverSurname(p.ref));
    const collated = [...surnames].sort((a, b) => a.localeCompare(b, 'en'));
    expect(surnames).toEqual(collated);
    expect(surnames.indexOf('Hülkenberg')).toBeLessThan(surnames.indexOf('Lawson'));
  });

  it('tallies every photograph exactly once across the licences', () => {
    const counted = LICENCE_TALLY.reduce((sum, tally) => sum + tally.count, 0);
    expect(counted).toBe(PHOTOGRAPHS.length);
  });

  it('gives each licence a share that is its count, so a bar cannot misreport it', () => {
    // §6.3b's rule applied to the ladder: a bar's extent *is* the datum.
    for (const tally of LICENCE_TALLY) {
      expect(tally.share).toBeCloseTo(tally.count / PHOTOGRAPHS.length, 10);
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

  it('carries a deed link on every licence row', () => {
    for (const tally of LICENCE_TALLY) {
      expect(tally.licenceUrl).toMatch(/^https?:\/\//);
    }
  });

  it('counts photographers as distinct people, never as photographs', () => {
    expect(PHOTOGRAPHER_COUNT).toBeGreaterThan(0);
    expect(PHOTOGRAPHER_COUNT).toBeLessThanOrEqual(PHOTOGRAPHS.length);
    expect(PHOTOGRAPHER_COUNT).toBe(new Set(PHOTOGRAPHS.map((p) => p.artist)).size);
  });
});

describe('the manifest and the disk agree — the check nothing else performs', () => {
  it('has a real file behind every path it publishes', () => {
    /*
     * `EntityPortrait`'s `onError` fallback exists for the case this catches, but a fallback is a
     * safety net rather than a plan: a manifest entry with no file on disk is a broken build, and
     * it is invisible in jsdom because jsdom loads no images at all.
     */
    for (const photograph of PHOTOGRAPHS) {
      for (const src of [photograph.src320, photograph.src640]) {
        expect(ON_DISK.has(src), `${src} is missing from disk`).toBe(true);
      }
    }
  });

  it('credits every file that ships — no photograph on disk without an entry', () => {
    /*
     * **This is the licence check, and it runs the other way round on purpose.** The test above
     * catches a manifest entry with no file, which is a broken image. This one catches a *file with
     * no entry* — an image shipping in a public repository with no photographer, no licence and no
     * link back, which is a breach rather than a defect. Nothing else in the suite looks at the
     * directory at all.
     */
    const credited = new Set(PHOTOGRAPHS.flatMap((p) => [p.src320, p.src640]));
    for (const file of ON_DISK) {
      expect(credited.has(file), `${file} ships with no attribution`).toBe(true);
    }
  });
});
