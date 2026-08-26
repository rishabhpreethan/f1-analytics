/** The shape `scripts/fetch-imagery.mjs` writes. Asserted against the real file by `imagery.test.ts`. */
interface RawPhotograph {
  ref: string;
  /** Keyed by pixel width. `'320'` and `'640'` are what the script emits. */
  src: Record<string, string>;
  /** The Commons file title, e.g. `Alex Albon at the Melbourne Walk … .jpg`. */
  title: string;
  artist: string;
  licence: string;
  licenceUrl: string;
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
const loaded = import.meta.glob<{ drivers: RawPhotograph[] }>('./imagery.json', {
  eager: true,
  import: 'default',
});
const manifest = loaded['./imagery.json'] ?? { drivers: [] };

/**
 * **The photograph manifest, and the only source of an image URL in this product.**
 * `DESIGN_SYSTEM.md` §7.17.
 *
 * 22 of 881 drivers have a photograph. **Nothing composes a path from a reference**, and that is
 * the load-bearing rule here rather than a style preference: `/assets/drivers/${ref}-320.webp` for
 * one of the other 859 is a 404, and on `/drivers` it would be 859 of them in one paint. A ref that
 * is not in this manifest renders no `<img>` at all.
 *
 * ---
 *
 * **Every entry is credited or it is not here.** The generating script publishes `artist`,
 * `licenceUrl` and `sourceUrl` for every file it writes, and no file is written without them —
 * verified against the real manifest by `imagery.test.ts`, which is what lets §7.18's surface treat
 * all three as present rather than defending against nulls on a legal obligation.
 *
 * ---
 *
 * **Weight.** This module is imported by `EntityPortrait` and by the credits panel. The portrait is
 * reachable only from lazy route chunks and the panel is itself lazily imported, so the manifest
 * stays out of the initial chunk. The images themselves are `public/assets/**` and are not in the
 * bundle at all (§7.17.7).
 */

export interface Photograph {
  /** `driver.reference`. */
  ref: string;
  /** The 320px-wide WebP. Used by `srcSet` as the `320w` candidate. */
  src320: string;
  /** The 640px-wide WebP. The `640w` candidate, and what a 2× box resolves to. */
  src640: string;
  /**
   * The Commons file title. It is **not decoration** — it is the disclosure of when and where the
   * photograph was taken (§7.17.4), which is how a reader resolves a Ferrari cap beside a Williams
   * identity bar. The `.jpg`/`.jpeg`/`.png` tail is stripped; nothing else is touched.
   */
  title: string;
  artist: string;
  licence: string;
  licenceUrl: string;
  sourceUrl: string;
}

/**
 * The display name and surname behind each photographed reference.
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

/** The `.jpg` tail on a Commons title is filename plumbing, not part of the caption. */
function stripExtension(title: string): string {
  return title.replace(/\.(jpe?g|png|webp|tiff?)$/i, '');
}

const BY_REF = new Map<string, Photograph>(
  manifest.drivers.map((entry) => [
    entry.ref,
    {
      ref: entry.ref,
      src320: entry.src['320'] ?? '',
      src640: entry.src['640'] ?? entry.src['320'] ?? '',
      title: stripExtension(entry.title),
      artist: entry.artist,
      licence: entry.licence,
      licenceUrl: entry.licenceUrl,
      sourceUrl: entry.sourceUrl,
    },
  ]),
);

/**
 * The photograph for a driver reference, or `undefined` for the 859 who have none.
 *
 * Accepts `null` and `undefined` so a call site with an optional reference does not have to guard
 * before asking — the answer for "no reference" and "no photograph" is the same placeholder.
 */
export function photographFor(ref: string | null | undefined): Photograph | undefined {
  if (ref === null || ref === undefined || ref === '') return undefined;
  return BY_REF.get(ref);
}

/** The driver's full name for a photographed reference; the reference itself if it is unnamed. */
export function driverName(ref: string): string {
  return NAMES[ref]?.name ?? ref;
}

/** What §7.18's plates sort by. Falls back to the reference so an unnamed entry still sorts. */
export function driverSurname(ref: string): string {
  return NAMES[ref]?.surname ?? ref;
}

/**
 * Every photograph, **ordered by the driver's surname** — the order a reader of a list of people
 * expects, and stable, which matters for a surface whose whole job is to be checkable.
 *
 * `localeCompare` rather than `<`: `Hülkenberg` sorts with the H's under a collator and after every
 * `Z` under a code-point comparison.
 */
export const PHOTOGRAPHS: readonly Photograph[] = [...BY_REF.values()].sort((a, b) =>
  driverSurname(a.ref).localeCompare(driverSurname(b.ref), 'en'),
);

export interface LicenceTally {
  licence: string;
  licenceUrl: string;
  count: number;
  /** `count / PHOTOGRAPHS.length`, 0–1. The ladder's bar extent (§7.18.2). */
  share: number;
}

/**
 * The licence distribution — §7.18.2's ladder.
 *
 * Ordered by count descending, then by name, so the ladder reads as a ranking rather than as
 * whatever order the files happened to be fetched in. Ties are broken by name so the order is
 * deterministic and the test can assert it.
 */
export const LICENCE_TALLY: readonly LicenceTally[] = (() => {
  const byLicence = new Map<string, LicenceTally>();
  for (const photograph of PHOTOGRAPHS) {
    const existing = byLicence.get(photograph.licence);
    if (existing === undefined) {
      byLicence.set(photograph.licence, {
        licence: photograph.licence,
        licenceUrl: photograph.licenceUrl,
        count: 1,
        share: 0,
      });
    } else {
      existing.count += 1;
    }
  }
  const total = PHOTOGRAPHS.length;
  return [...byLicence.values()]
    .map((tally) => ({ ...tally, share: total === 0 ? 0 : tally.count / total }))
    .sort((a, b) => b.count - a.count || a.licence.localeCompare(b.licence, 'en'));
})();

/** How many distinct people took these photographs. One of §7.18.2's three figures. */
export const PHOTOGRAPHER_COUNT = new Set(PHOTOGRAPHS.map((p) => p.artist)).size;
