/**
 * Fetch and process the free-licensed driver imagery from Wikimedia Commons.
 *
 * Run: `node scripts/fetch-imagery.mjs`
 *
 * ---
 *
 * ## Why a script and not a folder of files someone dropped in
 *
 * Every image here carries a licence obligation. CC BY and CC BY-SA require the
 * author, the licence and a link to the source to travel with the work. A folder
 * of JPEGs loses all three the moment someone renames a file, so the manifest is
 * generated beside the images from the same run that downloads them, and the
 * credits surface reads that manifest rather than a hand-kept list.
 *
 * ## Two things this script refuses to do
 *
 * **It will not download a file whose licence is not on the free allowlist.** The
 * allowlist is deliberately explicit rather than a "not obviously non-free" test.
 * OGL 3 is included because it is Open Definition compliant and compatible with
 * CC BY 4.0 (`commons.wikimedia.org/wiki/Commons:UK_Open_Government_Licence`);
 * it was wrongly excluded on the first pass and Hamilton's portrait was dropped.
 *
 * **It will not guess a subject.** Sources come from `imagery-sources.json`,
 * which records the Commons file chosen for each driver. An earlier pass searched
 * Commons by free text and returned correctly-licensed photographs of the WRONG
 * SUBJECT — a McLaren F1 GTR road car for "McLaren F1 car", the Aston Martin
 * safety car, and photographs of helmets for two drivers. Licence metadata is
 * reliable; free-text subject matching is not.
 *
 * ## Sizes
 *
 * Sources run to ~3 MB. Two widths are emitted, both WebP: 320px for the card and
 * tray bays, 640px for the profile masthead and for 2x displays at 320. Measured
 * at q78: 24 KB and 60 KB for a 1430x1907 source. Aspect ratio is preserved and
 * never cropped — a crop would have to guess where a face is, and getting that
 * wrong is worse than letting `object-fit` handle it in CSS.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public/assets/drivers');
const TEAM_DIR = join(ROOT, 'public/assets/teams');
const SOURCES = join(ROOT, 'scripts/imagery-sources.json');
const MANIFEST = join(ROOT, 'src/features/credits/imagery.json');

const UA = 'f1-analytics-dev/1.0 (personal project; github.com/rishabhpreethan/f1-analytics)';

/** Licences that permit redistribution. Attribution is still required by most of them. */
const FREE = [
  /^CC0/i,
  /^CC BY [0-9.]+$/i,
  /^CC BY-SA [0-9.]+$/i,
  /^Public domain$/i,
  /^PD/i,
  /^OGL/i,
];
const isFree = (name) => Boolean(name) && FREE.some((re) => re.test(name.trim()));

const WIDTHS = [320, 640];
const QUALITY = 78;

function cwebp(input, output, width) {
  execFileSync('cwebp', [
    '-quiet',
    '-resize',
    String(width),
    '0',
    '-q',
    String(QUALITY),
    input,
    '-o',
    output,
  ]);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Download one source, honouring `Retry-After`.
 *
 * upload.wikimedia.org throttles a run of this size and has asked for waits of up
 * to 51 seconds. Backing off is the difference between finishing and being cut
 * off six files in, so a 429 is waited out rather than counted as a failure.
 */
async function download(entry, attempt = 0) {
  const res = await fetch(entry.fileUrl, { headers: { 'User-Agent': UA } });
  if (res.status === 429) {
    if (attempt >= 4) return null;
    const wait = Math.max(
      (Number(res.headers.get('retry-after')) || 0) * 1000,
      8000 * (attempt + 1),
    );
    process.stderr.write(`  429 on ${entry.ref} — waiting ${Math.round(wait / 1000)}s\n`);
    await sleep(wait);
    return download(entry, attempt + 1);
  }
  if (!res.ok) {
    process.stderr.write(`  HTTP ${res.status} on ${entry.ref}\n`);
    return null;
  }
  return Buffer.from(await res.arrayBuffer());
}

const sources = JSON.parse(readFileSync(SOURCES, 'utf8'));
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
if (!existsSync(TEAM_DIR)) mkdirSync(TEAM_DIR, { recursive: true });
if (!existsSync(dirname(MANIFEST))) mkdirSync(dirname(MANIFEST), { recursive: true });

const credits = [];
const refused = [];

/**
 * Logos, which are a different shape of problem from photographs.
 *
 * **An SVG is copied verbatim, never converted.** `cwebp` cannot read SVG, and a
 * logo rasterised to a fixed width throws away the one property that makes it a
 * logo — it scales. Seven of the eleven are SVG and stay SVG; the rest are raster
 * and take the same WebP path as a photograph, at one width, because a logo is
 * never displayed large.
 *
 * **Four of eleven have no free logo, and that is correct rather than incomplete.**
 * Ferrari's prancing horse, the Cadillac crest and the Aston Martin wings are all
 * above the threshold of originality, so Commons holds them only under fair-use
 * claims that do not transfer to this project. Racing Bulls has no free file at
 * all. Those four keep the wordmark treatment; a logo is enrichment, exactly as a
 * photograph is.
 *
 * **Public domain for COPYRIGHT is not freedom from TRADEMARK.** These marks stay
 * beside the name of the team they belong to, which is nominative use. They are
 * never used as this project's own branding.
 */
const LOGO_WIDTH = 160;

for (const entry of sources.logos ?? []) {
  if (!isFree(entry.licence)) {
    refused.push({ ref: entry.ref, kind: 'logo', licence: entry.licence });
    process.stderr.write(`REFUSED logo ${entry.ref} — "${entry.licence}"\n`);
    continue;
  }
  const isSvg = /\.svg$/i.test(entry.title);
  const name = `${entry.ref}${isSvg ? '.svg' : `-${LOGO_WIDTH}.webp`}`;
  const target = join(TEAM_DIR, name);

  if (!existsSync(target)) {
    const bytes = await download(entry);
    if (bytes === null) {
      process.stderr.write(`FAIL logo ${entry.ref}\n`);
      continue;
    }
    if (isSvg) {
      writeFileSync(target, bytes);
    } else {
      const tmp = join(TEAM_DIR, `.${entry.ref}.src`);
      writeFileSync(tmp, bytes);
      cwebp(tmp, target, LOGO_WIDTH);
      execFileSync('rm', ['-f', tmp]);
    }
    await sleep(1500);
  }

  credits.push({
    ref: entry.ref,
    kind: 'logo',
    src: { logo: `/assets/teams/${name}` },
    title: entry.title.replace(/^File:/, ''),
    artist: entry.artist,
    licence: entry.licence,
    licenceUrl: entry.licenceUrl,
    sourceUrl: entry.descriptionUrl,
  });
  process.stderr.write(`ok  logo ${entry.ref}  ${entry.licence}\n`);
}

for (const entry of sources.cars ?? []) {
  if (!isFree(entry.licence)) {
    refused.push({ ref: entry.ref, kind: 'car', licence: entry.licence });
    process.stderr.write(`REFUSED car ${entry.ref} — "${entry.licence}"\n`);
    continue;
  }
  const done = WIDTHS.every((w) => existsSync(join(TEAM_DIR, `${entry.ref}-car-${w}.webp`)));
  let bytes = null;
  if (!done) {
    bytes = await download(entry);
    if (bytes === null) {
      process.stderr.write(`FAIL car ${entry.ref}\n`);
      continue;
    }
  }
  const emitted = {};
  if (bytes !== null) {
    const tmp = join(TEAM_DIR, `.${entry.ref}-car.src`);
    writeFileSync(tmp, bytes);
    for (const width of WIDTHS) {
      const name = `${entry.ref}-car-${width}.webp`;
      cwebp(tmp, join(TEAM_DIR, name), width);
      emitted[width] = `/assets/teams/${name}`;
    }
    execFileSync('rm', ['-f', tmp]);
    await sleep(1500);
  } else {
    for (const width of WIDTHS) emitted[width] = `/assets/teams/${entry.ref}-car-${width}.webp`;
  }

  credits.push({
    ref: entry.ref,
    kind: 'car',
    src: emitted,
    title: entry.title.replace(/^File:/, ''),
    artist: entry.artist,
    licence: entry.licence,
    licenceUrl: entry.licenceUrl,
    sourceUrl: entry.descriptionUrl,
  });
  process.stderr.write(`ok  car ${entry.ref}  ${entry.licence}\n`);
}

for (const entry of sources.drivers) {
  if (!isFree(entry.licence)) {
    refused.push({ ref: entry.ref, licence: entry.licence });
    process.stderr.write(
      `REFUSED ${entry.ref} — licence "${entry.licence}" is not on the allowlist\n`,
    );
    continue;
  }

  /*
   * Resumable, and that is not a convenience. upload.wikimedia.org answers 429
   * partway through a 22-file run, so a script that starts from scratch each time
   * re-requests everything it already has and gets throttled harder. If both
   * widths exist the entry is credited from the source record and not refetched.
   */
  const done = WIDTHS.every((w) => existsSync(join(OUT_DIR, `${entry.ref}-${w}.webp`)));

  let bytes = null;
  if (!done) {
    bytes = await download(entry);
    if (bytes === null) {
      process.stderr.write(`FAIL ${entry.ref} — gave up after retries\n`);
      continue;
    }
  }
  const emitted = {};
  if (bytes !== null) {
    const tmp = join(OUT_DIR, `.${entry.ref}.src`);
    writeFileSync(tmp, bytes);
    for (const width of WIDTHS) {
      const name = `${entry.ref}-${width}.webp`;
      cwebp(tmp, join(OUT_DIR, name), width);
      emitted[width] = `/assets/drivers/${name}`;
    }
    execFileSync('rm', ['-f', tmp]);
  } else {
    for (const width of WIDTHS) emitted[width] = `/assets/drivers/${entry.ref}-${width}.webp`;
  }

  credits.push({
    ref: entry.ref,
    src: emitted,
    title: entry.title.replace(/^File:/, ''),
    artist: entry.artist,
    licence: entry.licence,
    licenceUrl: entry.licenceUrl,
    sourceUrl: entry.descriptionUrl,
  });
  process.stderr.write(`ok  ${entry.ref}  ${entry.licence}\n`);
  await sleep(1500);
}

credits.sort((a, b) => (a.ref < b.ref ? -1 : 1));
const grouped = {
  drivers: credits.filter((c) => c.kind === undefined),
  cars: credits.filter((c) => c.kind === 'car'),
  logos: credits.filter((c) => c.kind === 'logo'),
};
writeFileSync(MANIFEST, `${JSON.stringify(grouped, null, 2)}\n`);

process.stderr.write(`\n${credits.length} images, ${refused.length} refused\n`);
if (refused.length > 0) process.exitCode = 1;
