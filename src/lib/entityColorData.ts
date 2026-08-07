/*
 * ENTITY COLOUR DATA — generated. Do not hand-edit.
 *
 *   node scripts/validate-palette.mjs entity-data > src/lib/entityColorData.ts
 *
 * The closed set of facts `src/lib/entityColor.ts` needs, taken from the same search and the
 * same colour maths that produced `src/styles/entity.css` (§3.3a, §6.4). `entityColorData.
 * test.ts` re-runs the emitter and diffs it, so these cannot drift from the stylesheet.
 *
 * NOTHING HERE IS A COLOUR. Not one hex value crosses into the client: §3.3a.3 fixes the
 * contract as entity -> token NAME, so the theme keeps working and no colour is inlined into
 * markup. What crosses is the palette’s *structure* — which tokens exist, and which pairs
 * the palette did not promise to separate.
 */

/**
 * The team references carrying a `--team-<ref>` identity token: the true brand colour, used
 * beside a name and never as a chart mark (§3.3a.1). Every other team’s identity swatch is
 * its ramp slot, which V-28 gates at 3:1 on all three surfaces in both themes.
 */
export const IDENTITY_TEAMS = [
  'alpine',
  'aston_martin',
  'audi',
  'cadillac',
  'ferrari',
  'haas',
  'mclaren',
  'mercedes',
  'rb',
  'red_bull',
  'sauber',
  'williams',
] as const;

/**
 * The team references carrying a `--team-<ref>-plot` token. **Two fewer than IDENTITY_TEAMS**:
 * Haas and Cadillac are below the OkLCh chroma floor, read as pure grey, and would be
 * confusable with this product’s achromatic chart furniture — so they plot from the ramp
 * exactly like a colourless team (§3.3a.1). That absence is deliberate and must not be
 * "completed for symmetry".
 */
export const PLOT_TEAMS = [
  'alpine',
  'aston_martin',
  'audi',
  'ferrari',
  'mclaren',
  'mercedes',
  'rb',
  'red_bull',
  'sauber',
  'williams',
] as const;

/**
 * The team references carrying `--team-<ref>-plot-deep` and `-bright` — the symmetric teammate
 * shade pair (§6.4a). Sauber is absent: its brand hue sits inside the reserved green timing
 * band, and in light mode exactly one lightness in the whole plotting band clears dE 15 from
 * `--timing-green-ink`, so no pair exists there. A pair exists in dark mode and is withheld,
 * because an encoding that changed with the theme would be unlearned at sunset.
 *
 * This is why marker shape, dash and direct label are MANDATORY for every team rather than a
 * fallback for this one: the shade pair is a redundant fourth channel, never the channel.
 */
export const SHADE_PAIR_TEAMS = [
  'alpine',
  'aston_martin',
  'audi',
  'ferrari',
  'mclaren',
  'mercedes',
  'rb',
  'red_bull',
  'williams',
] as const;

/** Fallback ramp slots (§3.3a.2): tier A is 1-6, tier B is the rest. */
export const RAMP_SIZE = 12;

/** Slots separated by colour ALONE for every viewer — dE >= 15 normal AND >= 8 CVD, both themes. */
export const RAMP_TIER_A = 6;

/**
 * Every colour a chart mark may take, in canonical order. **An index into this array is the
 * key COLLISION_MASKS is written against**, so reordering it without regenerating the masks
 * silently mislabels every collision.
 */
export const PLOT_TOKENS = [
  '--team-alpine-plot',
  '--team-alpine-plot-deep',
  '--team-alpine-plot-bright',
  '--team-aston_martin-plot',
  '--team-aston_martin-plot-deep',
  '--team-aston_martin-plot-bright',
  '--team-audi-plot',
  '--team-audi-plot-deep',
  '--team-audi-plot-bright',
  '--team-ferrari-plot',
  '--team-ferrari-plot-deep',
  '--team-ferrari-plot-bright',
  '--team-mclaren-plot',
  '--team-mclaren-plot-deep',
  '--team-mclaren-plot-bright',
  '--team-mercedes-plot',
  '--team-mercedes-plot-deep',
  '--team-mercedes-plot-bright',
  '--team-rb-plot',
  '--team-rb-plot-deep',
  '--team-rb-plot-bright',
  '--team-red_bull-plot',
  '--team-red_bull-plot-deep',
  '--team-red_bull-plot-bright',
  '--team-sauber-plot',
  '--team-williams-plot',
  '--team-williams-plot-deep',
  '--team-williams-plot-bright',
  '--ramp-1-plot',
  '--ramp-1-plot-deep',
  '--ramp-1-plot-bright',
  '--ramp-2-plot',
  '--ramp-2-plot-deep',
  '--ramp-2-plot-bright',
  '--ramp-3-plot',
  '--ramp-3-plot-deep',
  '--ramp-3-plot-bright',
  '--ramp-4-plot',
  '--ramp-4-plot-deep',
  '--ramp-4-plot-bright',
  '--ramp-5-plot',
  '--ramp-5-plot-deep',
  '--ramp-5-plot-bright',
  '--ramp-6-plot',
  '--ramp-6-plot-deep',
  '--ramp-6-plot-bright',
  '--ramp-7-plot',
  '--ramp-7-plot-deep',
  '--ramp-7-plot-bright',
  '--ramp-8-plot',
  '--ramp-8-plot-deep',
  '--ramp-8-plot-bright',
  '--ramp-9-plot',
  '--ramp-9-plot-deep',
  '--ramp-9-plot-bright',
  '--ramp-10-plot',
  '--ramp-10-plot-deep',
  '--ramp-10-plot-bright',
  '--ramp-11-plot',
  '--ramp-11-plot-deep',
  '--ramp-11-plot-bright',
  '--ramp-12-plot',
  '--ramp-12-plot-deep',
  '--ramp-12-plot-bright',
] as const;

/**
 * The collision adjacency of PLOT_TOKENS, as one bitmask per token.
 *
 * 663 of the 2016 pairs collide. A pair collides when normal-vision CIEDE2000 is
 * below 15 **or** worst-model CVD CIEDE2000 is below 8 — the two floors the palette itself is
 * built on, so a colliding pair is by definition one the palette never promised to separate. It
 * is measured in BOTH themes and the worse taken, so the differentiator a pair earns does not
 * change when the theme does (§6.4a property 3).
 *
 * Mask `i`, read left to right, is 8-hex-character words; word `w` holds tokens `32w .. 32w+31`
 * with token `j` at bit `1 << (j & 31)`. `collides()` in `entityColor.ts` is the only reader.
 */
export const COLLISION_MASKS = [
  '09b7803ebc1a24bc', // --team-alpine-plot
  '0669001148161b4c', // --team-alpine-plot-deep
  '09b68029b44824b0', // --team-alpine-plot-bright
  '09b780359c0a04fc', // --team-aston_martin-plot
  '1669020b4806034c', // --team-aston_martin-plot-deep
  '49b6c90db68904b2', // --team-aston_martin-plot-bright
  'f1007f8003d1e003', // --team-audi-plot
  '300026400120d801', // --team-audi-plot-deep
  'c102da6016d12012', // --team-audi-plot-bright
  'f1007dd003d1e003', // --team-ferrari-plot
  '300022c00120d801', // --team-ferrari-plot-deep
  'c102d36016d12012', // --team-ferrari-plot-bright
  'd1004b4002d16002', // --team-mclaren-plot
  '300006c00120d801', // --team-mclaren-plot-deep
  'c1029b6006d12002', // --team-mclaren-plot-bright
  '49b6492db68904b2', // --team-mercedes-plot
  '1668001b4826034c', // --team-mercedes-plot-deep
  '49b4c92db6c904b0', // --team-mercedes-plot-bright
  '0bb2802db40a04b4', // --team-rb-plot
  '066100124816034c', // --team-rb-plot-deep
  '0ba6802db44824b0', // --team-rb-plot-bright
  '0fdf803ffc1e27fc', // --team-red_bull-plot
  '062900124816134c', // --team-red_bull-plot-deep
  '0b36802db44824b0', // --team-red_bull-plot-bright
  '88b6db6d968944b2', // --team-sauber-plot
  '0cfd0012e8462768', // --team-williams-plot
  '026900124816034c', // --team-williams-plot-deep
  '03b6802db44824b0', // --team-williams-plot-bright
  '200136d00910c009', // --ramp-1-plot
  '100026c00120d801', // --ramp-1-plot-deep
  '8002db6016d12016', // --ramp-1-plot-bright
  '41005b4002d12003', // --ramp-2-plot
  'b00026c00120d800', // --ramp-2-plot-deep
  'c100db6002d12000', // --ramp-2-plot-bright
  '446d001b48260048', // --ramp-3-plot
  '1669001b48260344', // --ramp-3-plot-deep
  '49b6892db64824a0', // --ramp-3-plot-bright
  '0bb6802db4082490', // --ramp-4-plot
  '0669001a48261b0c', // --ramp-4-plot-deep
  '09b6802db4482430', // --ramp-4-plot-bright
  '0669001248060248', // --ramp-5-plot
  '0669001248060148', // --ramp-5-plot-deep
  '0bb6802db44820b0', // --ramp-5-plot-bright
  '200024820124d041', // --ramp-6-plot
  '204024820124c841', // --ramp-6-plot-deep
  'cab05b45b2d904b2', // --ramp-6-plot-bright
  '310036c001209801', // --ramp-7-plot
  '300026c001205801', // --ramp-7-plot-deep
  'c102db6006d02002', // --ramp-7-plot-bright
  '066d001b4854034c', // --ramp-8-plot
  '0669001248121b4c', // --ramp-8-plot-deep
  '09b6802db44024b0', // --ramp-8-plot-bright
  'd4685b4346e72002', // --ramp-9-plot
  '200124800910d84d', // --ramp-9-plot-deep
  'ca925b44969b2492', // --ramp-9-plot-bright
  'c102db6006512002', // --ramp-10-plot
  '300026c00020d801', // --ramp-10-plot-deep
  'c102db6014d12012', // --ramp-10-plot-bright
  '49b6c92db2d904b0', // --ramp-11-plot
  '1669001b4026034c', // --ramp-11-plot-deep
  '49b6892da64824b0', // --ramp-11-plot-bright
  '0ab68025940824b0', // --ramp-12-plot
  '066900120816034c', // --ramp-12-plot-deep
  '0bb6802d344824b0', // --ramp-12-plot-bright
] as const;
