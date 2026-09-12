/** The shape `scripts/fetch-imagery.mjs` writes. Asserted against the real file by `imagery.test.ts`. */
interface RawImage {
  ref: string;
  /**
   * Keyed by pixel width for a photograph — `'320'` and `'640'` are what the script emits — and by
   * the single key `'logo'` for a team mark, which ships as one file (an SVG for six of the seven).
   */
  src: Record<string, string>;
  /** The Commons file title, e.g. `Alex Albon at the Melbourne Walk … .jpg`. */
  title: string;
  artist: string;
  licence: string;
  /**
   * ⚠ **Nullable, and that is correct data rather than a gap.** A public-domain file has no licence
   * deed to link to, so Commons publishes no URL for it — 6 of the 7 team marks are in this case.
   * `undefined` is not possible; the script writes the key either way.
   */
  licenceUrl: string | null;
  sourceUrl: string;
}

/**
 * **`import.meta.glob`, not `import manifest from './imagery.json'`, and that is deliberate.**
 *
 * A direct JSON import needs `resolveJsonModule` in `tsconfig.app.json`, which is build
 * configuration and not this round's to change; the alternative — an ambient `.d.ts` — is not seen
 * by the ESLint project service in this solution-file setup and fails `npm run lint`. `glob` needs
 * neither: Vite and Vitest both resolve it, and the type parameter is the same claim the `.d.ts`
 * would have made, backed by the same test.
 *
 * `eager: true` because this is one small file that the surface below is a pure function of —
 * there is nothing to defer, and a promise here would make `photographFor` async for no gain.
 */
const loaded = import.meta.glob<{ drivers: RawImage[]; cars: RawImage[]; logos: RawImage[] }>(
  './imagery.json',
  { eager: true, import: 'default' },
);
const manifest = loaded['./imagery.json'] ?? { drivers: [], cars: [], logos: [] };

/**
 * **The imagery manifest, and the only source of an image URL in this product.**
 * `DESIGN_SYSTEM.md` §7.17, §7.19.
 *
 * Three sets, and the fill rate is the design problem in each: **22 of 881 drivers** have a
 * portrait, **11 of 214 teams** have a car, **7 of 214 teams** have a mark. *Nothing composes a
 * path from a reference* — `/assets/drivers/${ref}-320.webp` for one of the other 859 is a 404, and
 * on `/drivers` it would be 859 of them in one paint. A ref that is not in this manifest renders no
 * `<img>` at all.
 *
 * ---
 *
 * **Every entry is credited or it is not here.** The generating script publishes `artist`,
 * `licence` and `sourceUrl` for every file it writes — verified against the real manifest by
 * `imagery.test.ts`, which is what lets §7.18's surface treat them as present rather than defending
 * against nulls on a legal obligation.
 *
 * **`licenceUrl` is the one exception and it is deliberate.** A public-domain file has no deed, so
 * Commons records no URL; §7.19.4 renders that licence as text rather than as a link to nowhere.
 * "Credited" is not the same claim as "linkable", and conflating the two is what made the earlier
 * version of this comment false the moment marks arrived.
 *
 * ---
 *
 * **Weight.** This module is imported by `EntityPortrait`, by the team masthead's imagery and by
 * the credits panel. The images themselves are `public/assets/**` and are not in the bundle at all
 * (§7.17.7).
 */

/** Which set an image belongs to. Also the first segment of its plate id. */
export type ImageKind = 'driver' | 'car' | 'logo';

export interface CreditedImage {
  kind: ImageKind;
  /** `driver.reference` for a portrait, `team.reference` for a car or a mark. */
  ref: string;
  /**
   * The DOM id of this image's plate in §7.18's panel, and the value `useCredits().open()` takes.
   * Kind-qualified because `ferrari` now names both a car and (one day) a mark, and two plates with
   * one id is a deep link that lands on whichever rendered first.
   */
  plateId: string;
  /** Who or what the image is of — a driver's full name, or a team's. */
  subject: string;
  /** What the plates sort by within their section: a driver's surname, a team's name. */
  sortKey: string;
  /** What goes in `src`. The 320w candidate for a photograph; the only file for a mark. */
  src: string;
  /** The `srcSet` string, or `null` for a mark, which ships as one file at one size. */
  srcSet: string | null;
  /**
   * The Commons file title. It is **not decoration** — it is the disclosure of when and where the
   * photograph was taken (§7.17.4), which is how a reader resolves a Ferrari cap beside a Williams
   * identity bar. The `.jpg`/`.jpeg`/`.png`/`.svg` tail is stripped; nothing else is touched.
   */
  title: string;
  artist: string;
  licence: string;
  /** `null` for a public-domain file — there is no deed to link to (§7.19.4). */
  licenceUrl: string | null;
  sourceUrl: string;
}

/**
 * The display name and surname behind each photographed driver reference.
 *
 * **Hand-written and verified by query against `driver` in `data/f1.db`**, because the generated
 * manifest carries a reference and not a name, and a name derived from a reference gets
 * `hulkenberg` wrong (Hülkenberg), `max_verstappen` wrong (Max Verstappen, and not Jos, who is
 * `verstappen`) and `arvid_lindblad` wrong. §6.5.4a's rule about not inventing what the sport owns
 * applies to a name at least as much as to a code.
 *
 * The surname is stored rather than taken as the last word: it is what the plates sort by, and a
 * two-word surname would silently reorder the list.
 *
 * ⚠ A manifest entry with no name here falls back to the reference. `imagery.test.ts` fails when
 * that happens, so a driver added by a later imagery run cannot ship unnamed.
 */
const NAMES: Readonly<Record<string, { readonly name: string; readonly surname: string }>> = {
  albon: { name: 'Alexander Albon', surname: 'Albon' },
  alonso: { name: 'Fernando Alonso', surname: 'Alonso' },
  antonelli: { name: 'Andrea Kimi Antonelli', surname: 'Antonelli' },
  arvid_lindblad: { name: 'Arvid Lindblad', surname: 'Lindblad' },
  bearman: { name: 'Oliver Bearman', surname: 'Bearman' },
  bortoleto: { name: 'Gabriel Bortoleto', surname: 'Bortoleto' },
  bottas: { name: 'Valtteri Bottas', surname: 'Bottas' },
  colapinto: { name: 'Franco Colapinto', surname: 'Colapinto' },
  gasly: { name: 'Pierre Gasly', surname: 'Gasly' },
  hadjar: { name: 'Isack Hadjar', surname: 'Hadjar' },
  hamilton: { name: 'Lewis Hamilton', surname: 'Hamilton' },
  hulkenberg: { name: 'Nico Hülkenberg', surname: 'Hülkenberg' },
  lawson: { name: 'Liam Lawson', surname: 'Lawson' },
  leclerc: { name: 'Charles Leclerc', surname: 'Leclerc' },
  max_verstappen: { name: 'Max Verstappen', surname: 'Verstappen' },
  norris: { name: 'Lando Norris', surname: 'Norris' },
  ocon: { name: 'Esteban Ocon', surname: 'Ocon' },
  perez: { name: 'Sergio Pérez', surname: 'Pérez' },
  piastri: { name: 'Oscar Piastri', surname: 'Piastri' },
  russell: { name: 'George Russell', surname: 'Russell' },
  sainz: { name: 'Carlos Sainz', surname: 'Sainz' },
  stroll: { name: 'Lance Stroll', surname: 'Stroll' },
};

/**
 * The team behind each car and mark reference, **verified by query against `team` in `data/f1.db`**
 * — `SELECT reference, name FROM team WHERE reference IN (…)`, 2026-09-12.
 *
 * Same rule as `NAMES` and the same reason: the manifest carries `rb`, and the team is
 * **RB F1 Team**, which no amount of string manipulation produces. `red_bull` → `Red Bull` and
 * `aston_martin` → `Aston Martin` would each be a different invented convention.
 *
 * ⚠ These names are the archive's own, not the teams' full entrant names. That is deliberate: the
 * rest of the product addresses a constructor by exactly this string, and a credits panel that
 * called it something else would read as a second source.
 */
const TEAM_NAMES: Readonly<Record<string, string>> = {
  alpine: 'Alpine F1 Team',
  aston_martin: 'Aston Martin',
  audi: 'Audi',
  cadillac: 'Cadillac F1 Team',
  ferrari: 'Ferrari',
  haas: 'Haas F1 Team',
  mclaren: 'McLaren',
  mercedes: 'Mercedes',
  rb: 'RB F1 Team',
  red_bull: 'Red Bull',
  williams: 'Williams',
};

/** The `.jpg` tail on a Commons title is filename plumbing, not part of the caption. */
function stripExtension(title: string): string {
  return title.replace(/\.(jpe?g|png|webp|tiff?|svg)$/i, '');
}

/** The driver's full name for a photographed reference; the reference itself if it is unnamed. */
export function driverName(ref: string): string {
  return NAMES[ref]?.name ?? ref;
}

/** What §7.18's driver plates sort by. Falls back to the reference so an unnamed entry still sorts. */
export function driverSurname(ref: string): string {
  return NAMES[ref]?.surname ?? ref;
}

/** The team's name for a car or mark reference; the reference itself if it is unnamed. */
export function teamName(ref: string): string {
  return TEAM_NAMES[ref] ?? ref;
}

function adopt(kind: ImageKind, entry: RawImage): CreditedImage {
  const subject = kind === 'driver' ? driverName(entry.ref) : teamName(entry.ref);
  const single = entry.src['logo'];
  const w320 = entry.src['320'] ?? single ?? '';
  const w640 = entry.src['640'] ?? w320;
  return {
    kind,
    ref: entry.ref,
    plateId: `credit-${kind}-${entry.ref}`,
    subject,
    sortKey: kind === 'driver' ? driverSurname(entry.ref) : subject,
    src: w320,
    /*
     * A mark ships as one file, so it gets **no** `srcSet`. `"x 320w, x 640w"` naming one file
     * twice is not harmless: it tells the browser two candidates exist at two densities and lets it
     * pick either, which is a claim about the asset that is false.
     */
    srcSet: single === undefined ? `${w320} 320w, ${w640} 640w` : null,
    title: stripExtension(entry.title),
    artist: entry.artist,
    licence: entry.licence,
    licenceUrl: entry.licenceUrl,
    sourceUrl: entry.sourceUrl,
  };
}

/**
 * One set, ordered by `sortKey` — the order a reader of a list of people or teams expects, and
 * stable, which matters for a surface whose whole job is to be checkable.
 *
 * `localeCompare` rather than `<`: `Hülkenberg` sorts with the H's under a collator and after every
 * `Z` under a code-point comparison.
 */
function setOf(kind: ImageKind, entries: RawImage[]): readonly CreditedImage[] {
  return entries
    .map((entry) => adopt(kind, entry))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'en'));
}

/** The 22 driver portraits, by surname. */
export const PHOTOGRAPHS: readonly CreditedImage[] = setOf('driver', manifest.drivers);
/** The 11 cars, by team name. One event, one photographer, one framing (§7.19.1). */
export const CARS: readonly CreditedImage[] = setOf('car', manifest.cars);
/** The 7 team marks, by team name. */
export const LOGOS: readonly CreditedImage[] = setOf('logo', manifest.logos);

/**
 * Every credited image in the product, in the order §7.18's panel lists them.
 *
 * **This is the legal surface.** Anything that renders an image must be reachable from here, or the
 * file ships in a public repository with no attribution — which for the 11 cars, all CC BY-SA 4.0,
 * is a licence breach rather than an untidy detail. `imagery.test.ts` walks
 * `public/assets/**` and fails on any file this array does not name.
 */
export const ALL_IMAGES: readonly CreditedImage[] = [...PHOTOGRAPHS, ...CARS, ...LOGOS];

const BY_KEY = new Map<string, CreditedImage>(
  ALL_IMAGES.map((image) => [`${image.kind}:${image.ref}`, image]),
);

function lookup(kind: ImageKind, ref: string | null | undefined): CreditedImage | undefined {
  if (ref === null || ref === undefined || ref === '') return undefined;
  return BY_KEY.get(`${kind}:${ref}`);
}

/**
 * The portrait for a driver reference, or `undefined` for the 859 who have none.
 *
 * Accepts `null` and `undefined` so a call site with an optional reference does not have to guard
 * before asking — the answer for "no reference" and "no photograph" is the same placeholder.
 */
export function photographFor(ref: string | null | undefined): CreditedImage | undefined {
  return lookup('driver', ref);
}

/** The car photograph for a team reference, or `undefined` for the other 203. */
export function carFor(ref: string | null | undefined): CreditedImage | undefined {
  return lookup('car', ref);
}

/** The mark for a team reference, or `undefined` for the other 207. */
export function logoFor(ref: string | null | undefined): CreditedImage | undefined {
  return lookup('logo', ref);
}

export interface LicenceTally {
  licence: string;
  /** `null` for public domain — the ladder renders it as text, not as a dead link (§7.19.4). */
  licenceUrl: string | null;
  count: number;
  /** `count / ALL_IMAGES.length`, 0–1. The ladder's bar extent (§7.18.2). */
  share: number;
}

/**
 * The licence distribution across **every** set — §7.18.2's ladder.
 *
 * Ordered by count descending, then by name, so the ladder reads as a ranking rather than as
 * whatever order the files happened to be fetched in. Ties are broken by name so the order is
 * deterministic and the test can assert it.
 */
export const LICENCE_TALLY: readonly LicenceTally[] = (() => {
  const byLicence = new Map<string, LicenceTally>();
  for (const image of ALL_IMAGES) {
    const existing = byLicence.get(image.licence);
    if (existing === undefined) {
      byLicence.set(image.licence, {
        licence: image.licence,
        licenceUrl: image.licenceUrl,
        count: 1,
        share: 0,
      });
    } else {
      existing.count += 1;
    }
  }
  const total = ALL_IMAGES.length;
  return [...byLicence.values()]
    .map((tally) => ({ ...tally, share: total === 0 ? 0 : tally.count / total }))
    .sort((a, b) => b.count - a.count || a.licence.localeCompare(b.licence, 'en'));
})();

/**
 * How many distinct people and organisations these images came from. One of §7.18.2's three
 * figures.
 *
 * **`Contributors`, not `Photographers`, since the marks arrived.** Six of the seven credit a team
 * rather than a person, and counting `McLaren` as a photographer would be a false statement on the
 * one surface in the product whose entire job is to be accurate about provenance.
 */
export const CONTRIBUTOR_COUNT = new Set(ALL_IMAGES.map((image) => image.artist)).size;
