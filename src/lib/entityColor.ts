/**
 * **Entity → colour token.** The contract is fixed in `DESIGN_SYSTEM.md` §3.3a.3 and it is one
 * sentence: this module maps an entity to a **token name**, never to a literal colour. Nothing
 * here returns a hex value, and `entityColor.test.ts` asserts that no hex can appear in its
 * output — so a theme switch is a CSS matter, no colour is inlined into markup, and there is no
 * second copy of the palette to drift from `src/styles/entity.css`.
 *
 * **Three roles, never mixed up** (§3.3a.1):
 *
 * | Role | Token | Where |
 * |---|---|---|
 * | identity | `--team-<ref>` or a ramp slot | a swatch, a 3px accent bar, a header band — always beside a name |
 * | plot | `--*-plot` | one series, **one car** — every driver of one team takes the same one |
 *
 * ⚠ **There is no longer a third role.** The teammate *shade pair* was withdrawn on 2026-08-23
 * (§6.4a, "the seat, not the shade"): colour identifies the machinery, and the seat inside it is
 * carried by the **dash**, which is a reserved semantic channel exactly as purple/green/yellow are
 * reserved in colour. `shadePair()` is retained below and is called by nothing — the generated
 * `--*-plot-deep` / `-bright` tokens are retired from use, not yet deleted (§6.4a, follow-up).
 *
 * **The ramp is 94% of the data, not a fallback.** 214 teams exist and 12 carry a brand colour
 * (queried). A team with no brand colour — and Haas and Cadillac, whose greys would be confusable
 * with the chart's own achromatic furniture — takes a deterministic ramp slot from a hash of its
 * `reference`.
 *
 * **What this module needs from the data layer is exactly one field: `reference`.** Not the brand
 * colour, not a flag, not the team id. Whether a plotting variant exists is a property of *our*
 * generated palette (`entityColorData.ts`), not of the row, so no selector has to carry it and
 * there is no way for the two to disagree.
 */

import {
  COLLISION_MASKS,
  IDENTITY_TEAMS,
  PLOT_TEAMS,
  PLOT_TOKENS,
  RAMP_SIZE,
  SHADE_PAIR_TEAMS,
} from './entityColorData';

/** Every colour a chart mark may take. A union of the 64 generated token names. */
export type PlotToken = (typeof PLOT_TOKENS)[number];

/** A token for an identity surface: a brand colour, or the entity's ramp slot. */
export type IdentityToken = `--team-${string}` | PlotToken;

const TOKEN_INDEX = new Map<string, number>(PLOT_TOKENS.map((token, i) => [token, i]));

/**
 * Assert a constructed token name is one the palette actually emits.
 *
 * Every call site below builds a name by string concatenation, which is the one place this module
 * could produce something that renders as *nothing* — an unknown custom property resolves to the
 * empty string and an SVG `stroke=""` is simply invisible. A thrown error is the correct failure:
 * it is not reachable with the generated data, so if it ever fires the data and this file have
 * come apart, and a silently unpainted chart is a far worse outcome than a stack trace.
 */
function token(name: string): PlotToken {
  const index = TOKEN_INDEX.get(name);
  if (index === undefined) throw new Error(`entityColor: ${name} is not a token in the palette`);
  return PLOT_TOKENS[index] as PlotToken;
}

const HAS_IDENTITY = new Set<string>(IDENTITY_TEAMS);
const HAS_PLOT = new Set<string>(PLOT_TEAMS);
const HAS_SHADE_PAIR = new Set<string>(SHADE_PAIR_TEAMS);

/**
 * FNV-1a, 32-bit. Chosen for three properties this specific use needs and nothing more: it is
 * deterministic across engines and sessions, it depends on nothing ambient, and it is eight lines.
 * `Math.imul` is what keeps the multiply in 32-bit integer space — a plain `*` overflows into a
 * double at the third character and the result stops being FNV at all.
 *
 * The distribution over the real 214 team references is recorded in `DESIGN_SYSTEM.md` §9.2.4.
 */
export function hashReference(reference: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < reference.length; i += 1) {
    hash ^= reference.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The ramp slot for a team, **1-based**, per §3.3a.3: `1 + (h mod 12)` over a stable hash of
 * `team.reference`.
 *
 * `reference` and not `id` — an id is an insertion artefact — and not the name, which gets edited.
 * Three properties follow, and each is a rule rather than an implementation detail: the same team
 * is the same colour tomorrow; adding a fourth entity never repaints the first three; and nothing
 * about the colour encodes rank, so a championship reshuffle does not repaint the field.
 */
export function rampSlot(teamReference: string): number {
  return 1 + (hashReference(teamReference) % RAMP_SIZE);
}

const rampPlot = (slot: number) => token(`--ramp-${String(slot)}-plot`);

/**
 * The token for the entity's **identity** surface — the swatch beside a name, the 3px accent bar,
 * the team header band. The true brand colour where one exists; otherwise the team's ramp slot,
 * which V-28 gates at 3:1 against all three surfaces in both themes, so a colourless team needs no
 * workaround.
 *
 * Never a chart mark: identity and plot are different roles and a brand colour that fails the
 * plotting band is still the right swatch (§3.3a.1).
 */
export function identityToken(teamReference: string): IdentityToken {
  return HAS_IDENTITY.has(teamReference)
    ? (`--team-${teamReference}` as IdentityToken)
    : rampPlot(rampSlot(teamReference));
}

/**
 * The token a **single** series takes for this team. The brand plotting variant where one exists —
 * hue and chroma held from the brand, lightness moved the minimum distance into the theme's
 * plotting band — otherwise the ramp slot.
 *
 * Haas and Cadillac fall to the ramp here while keeping their brand identity swatch, because their
 * OkLCh chroma is 0.0056 and 0.0043: they read as pure grey, and a grey series is confusable with
 * this product's grey gridlines, which is a worse failure than being confusable with another team.
 */
export function plotToken(teamReference: string): PlotToken {
  return HAS_PLOT.has(teamReference)
    ? token(`--team-${teamReference}-plot`)
    : rampPlot(rampSlot(teamReference));
}

/**
 * ⚠ **RETIRED FROM USE, 2026-08-23 (§6.4a).** Nothing calls this. It is kept because the tokens it
 * names are still generated and still validated (§9.2.3 V-27, G-27a–e), and deleting the function
 * without deleting the emitter would leave the palette claiming a role no code could reach. The
 * deletion of both is a queued follow-up with a measured CSS saving, recorded in §6.4a.
 *
 * The symmetric shade pair for a team, or `null` when the palette has none for it.
 *
 * `null` is not an error state and must not be treated as one. Sauber's brand hue sits inside the
 * reserved green timing band; in light mode exactly one lightness in the whole plotting band clears
 * ΔE 15 from `--timing-green-ink`, so no pair exists, and the dark-mode pair that *does* exist is
 * deliberately withheld — an encoding that changed at sunset would have to be unlearned. §6.4a's
 * marker, dash and direct-label channels are mandatory for **every** team precisely so that this
 * team's teammate comparison is no worse off than any other's.
 */
export function shadePair(teamReference: string): { deep: PlotToken; bright: PlotToken } | null {
  if (HAS_SHADE_PAIR.has(teamReference)) {
    return {
      deep: token(`--team-${teamReference}-plot-deep`),
      bright: token(`--team-${teamReference}-plot-bright`),
    };
  }
  if (HAS_PLOT.has(teamReference)) return null; // a brand team whose hue has no admissible pair
  const slot = rampSlot(teamReference);
  return {
    deep: token(`--ramp-${String(slot)}-plot-deep`),
    bright: token(`--ramp-${String(slot)}-plot-bright`),
  };
}

/**
 * Do two assigned colours collide — i.e. is this a pair the palette never promised to separate?
 *
 * Normal-vision CIEDE2000 below 15, or worst-model CVD CIEDE2000 below 8, measured in **both**
 * themes with the worse taken. Precomputed by `scripts/validate-palette.mjs entity-data`: the
 * palette is a closed set, so no colour science and no `getComputedStyle` read ships to the client,
 * and the answer is available in jsdom — where a computed custom property resolves to `''` and any
 * runtime measurement would silently return nonsense.
 */
export function collides(a: PlotToken, b: PlotToken): boolean {
  if (a === b) return true;
  const i = TOKEN_INDEX.get(a);
  const j = TOKEN_INDEX.get(b);
  if (i === undefined || j === undefined) return true; // unknown: assume the worst, never the best
  const mask = COLLISION_MASKS[i];
  if (mask === undefined) return true;
  const word = Number.parseInt(mask.slice((j >> 5) * 8, (j >> 5) * 8 + 8), 16);
  return (word & (1 << (j & 31))) !== 0;
}

/** A `var()` reference. The only permitted way a token reaches a style attribute or an SVG paint. */
export function cssVar(name: string): string {
  return `var(${name})`;
}

/** What a caller must know about an entity to colour it. Exactly one field is about identity. */
export interface ChartEntity {
  /**
   * The entity's own stable identifier — `driver.reference` for a driver, `team.reference` for a
   * team. Used for ordering within a team, never for colour directly.
   *
   * `reference` because it is the only identifier with 100% coverage: `permanent_car_number` covers
   * 63 of 881 drivers and `abbreviation` 107 of 881 (queried).
   */
  reference: string;
  /** The team this entity plots as. For a team entity, its own `reference`. */
  teamReference: string;
  /**
   * §6.4a. **`'principal'` is a driver the reader chose; `'shadow'` is the other seat in that
   * principal's car**, added by the surface and not by the reader. It changes exactly one thing
   * here — seat order within a team, so a principal is never dashed while a shadow beside it is
   * solid — and nothing about colour. Defaults to `'principal'`.
   */
  role?: SeriesRole;
}

/** §6.4a. A chosen entity, or the other seat in a chosen entity's car. */
export type SeriesRole = 'principal' | 'shadow';

export interface EntityColour {
  reference: string;
  teamReference: string;
  role: SeriesRole;
  /**
   * The token the mark is painted with. **Every driver of one team takes the same one** — colour
   * identifies the car, and the seat inside it is the dash's job (§6.4a).
   */
  plot: PlotToken;
  /** The token the swatch beside the name is painted with. Never the same role as `plot`. */
  identity: IdentityToken;
  /**
   * `true` when this entity shares its team with another entity in the same selection — the case
   * §6.4a calls the most valuable comparison in the sport and the one where colour is weakest.
   * A consumer must read this and switch on the marker rung; the dash is applied unconditionally
   * from `seat`, because a dash now *means* something whether or not anything collides.
   */
  teammate: boolean;
  /**
   * **Which seat of this car the entity is**, 0-based, within the current selection (§6.4a).
   *
   * Principals come first in `reference` order, then shadows in `reference` order, so a chosen
   * driver is never dashed while the seat beside him is solid. `0` for a lone entity, which is
   * the overwhelmingly common case and draws solid.
   */
  seat: number;
  /**
   * `true` when the **dash ladder** is exhausted rather than applied — more than four drivers of
   * one team in one plot area. That is not hypothetical: 1957's Maserati fielded thirteen cars in
   * one Grand Prix. Beyond four the fifth seat wraps to `solid` and the surface must fall back to
   * a different form (§6.5.4, small multiples) or stop drawing seats.
   *
   * It replaces the shade pair's exhaustion flag, which fired at **three** — the dash ladder is
   * strictly deeper than the two shades light mode could supply, which is the second reason the
   * pair was withdrawn.
   */
  colourExhausted: boolean;
}

/**
 * Colour a whole selection at once, because the seat cannot be decided one entity at a time: a
 * seat index only exists relative to the other occupants of the same car.
 *
 * **Colour identifies the car. The dash identifies the seat** (§6.4a, ruled 2026-08-23). Every
 * driver of one team therefore takes the **same** plotting token, and what this function computes
 * for a team group is an *order*, not a second colour. That reverses the earlier shade pair, and
 * the reversal is the whole point: a reader who sees one colour is being told "same machinery",
 * which is the claim a teammate comparison actually rests on.
 *
 * **§6.2's one permitted repaint is now gone entirely.** Adding or removing a team-mate used to
 * re-shade that team's pair. It no longer changes any colour at all — only a `seat` index, and only
 * for the team the change touched. Nothing in a selection change repaints anything.
 *
 * Order in equals order out, so a caller's stable entity order is preserved for the ladder, which
 * assigns marker rungs by that order (§6.4 rule 1).
 */
export function assignEntityColours(entities: readonly ChartEntity[]): EntityColour[] {
  const byTeam = new Map<string, ChartEntity[]>();
  for (const entity of entities) {
    const group = byTeam.get(entity.teamReference);
    if (group === undefined) byTeam.set(entity.teamReference, [entity]);
    else group.push(entity);
  }

  /*
   * Seat order within a car: **principals first, then shadows, each by `reference` ascending**.
   *
   * Two rules in one comparator, and both matter. Role first, because a shadow is by definition
   * "the other seat" and drawing it solid while the driver the reader chose is dashed inverts the
   * sentence the encoding is making. `reference` second, because it is the only driver identifier
   * with 100% coverage (`permanent_car_number` covers 63 of 881, `abbreviation` 107 of 881,
   * queried) and because §6.4 rule 1 requires the assignment to be stable across renders — an
   * order taken from the tray would change when the tray did.
   */
  const seatOf = new Map<ChartEntity, number>();
  for (const group of byTeam.values()) {
    [...group]
      .sort((a, b) => {
        const ra = a.role ?? 'principal';
        const rb = b.role ?? 'principal';
        if (ra !== rb) return ra === 'principal' ? -1 : 1;
        return a.reference < b.reference ? -1 : 1;
      })
      .forEach((entity, seat) => seatOf.set(entity, seat));
  }

  return entities.map((entity) => {
    const group = byTeam.get(entity.teamReference) ?? [entity];
    return {
      reference: entity.reference,
      teamReference: entity.teamReference,
      role: entity.role ?? 'principal',
      plot: plotToken(entity.teamReference),
      identity: identityToken(entity.teamReference),
      teammate: group.length > 1,
      seat: seatOf.get(entity) ?? 0,
      colourExhausted: group.length > DASH_SEATS,
    };
  });
}

/**
 * How many seats of one car the dash ladder can tell apart — the length of `DASH_PATTERNS`,
 * restated here because `ladder.ts` imports *from* this module and not the other way round.
 *
 * Four, and it is a real ceiling rather than a theoretical one: a 1950s works team entered as many
 * as thirteen cars in a single Grand Prix.
 */
export const DASH_SEATS = 4;
