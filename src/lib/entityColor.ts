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
 * | plot | `--*-plot` | one series, one entity |
 * | shade pair | `--*-plot-deep` / `-bright` | two drivers of one team in one plot area (§6.4a) |
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
}

export interface EntityColour {
  reference: string;
  teamReference: string;
  /** The token the mark is painted with. */
  plot: PlotToken;
  /** The token the swatch beside the name is painted with. Never the same role as `plot`. */
  identity: IdentityToken;
  /**
   * `true` when this entity shares its team with another entity in the same selection — the case
   * §6.4a calls the most valuable comparison in the sport and the one where colour is weakest.
   * A consumer must read this and apply the mandatory marker and dash channels; the shade pair,
   * when there is one, is a redundant fourth channel and never the channel.
   */
  teammate: boolean;
  /**
   * `true` when the pair was exhausted rather than applied — a team with no admissible pair, or
   * three or more drivers of one team in one plot area (a mid-season replacement, which happens
   * for real). Both entities then carry the team's single plot colour and rungs 1–3 carry the whole
   * distinction. A designed state, not an edge case.
   */
  colourExhausted: boolean;
}

/**
 * Colour a whole selection at once, because the teammate case cannot be decided one entity at a
 * time: a shade pair only exists relative to its other member.
 *
 * **The one permitted repaint, and it is named rather than hidden** (§6.2). Adding or removing a
 * teammate re-shades that team's pair. It is a change in entity *relationship*, not in rank; it is
 * always the result of a deliberate action in the compare tray; and it is the single case §4.2
 * allows a chart to re-animate. Nothing else in this function depends on the selection: remove a
 * driver from a different team and every survivor keeps its exact token.
 *
 * Order in equals order out, so a caller's stable entity order is preserved for the ladder, which
 * assigns rungs by that order (§6.4 rule 1).
 */
export function assignEntityColours(entities: readonly ChartEntity[]): EntityColour[] {
  const byTeam = new Map<string, ChartEntity[]>();
  for (const entity of entities) {
    const group = byTeam.get(entity.teamReference);
    if (group === undefined) byTeam.set(entity.teamReference, [entity]);
    else group.push(entity);
  }

  return entities.map((entity) => {
    const group = byTeam.get(entity.teamReference) ?? [entity];
    const identity = identityToken(entity.teamReference);
    const single = plotToken(entity.teamReference);

    if (group.length < 2) {
      return {
        reference: entity.reference,
        teamReference: entity.teamReference,
        plot: single,
        identity,
        teammate: false,
        colourExhausted: false,
      };
    }

    /*
     * Two drivers of one team take the pair; three or more exhaust it. §6.4a property 4: one hue
     * supplies at most two mutually separated shades, and **light mode sets that cap** because its
     * band has its usable top cut by the 3:1-against-white requirement. Taking the dark-mode third
     * shade would make the encoding theme-dependent, which property 3 forbids.
     */
    const pair = group.length === 2 ? shadePair(entity.teamReference) : null;
    if (pair === null) {
      return {
        reference: entity.reference,
        teamReference: entity.teamReference,
        plot: single,
        identity,
        teammate: true,
        colourExhausted: true,
      };
    }

    /*
     * Driver order is `reference` ascending among the selected drivers of that team, and the lower
     * takes `deep` (§6.4a). Symmetric on purpose: neither driver "gets the team colour". An earlier
     * draft anchored one driver on the team's plotting variant and derived the other, which implies
     * a number-one/number-two hierarchy the data does not support — and could not reach the ΔE
     * floor either.
     */
    const ordered = [...group].sort((a, b) => (a.reference < b.reference ? -1 : 1));
    const first = ordered[0]?.reference === entity.reference;
    return {
      reference: entity.reference,
      teamReference: entity.teamReference,
      plot: first ? pair.deep : pair.bright,
      identity,
      teammate: true,
      colourExhausted: false,
    };
  });
}
