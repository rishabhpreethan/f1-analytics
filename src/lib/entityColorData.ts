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
  '--team-aston_martin-plot',
  '--team-audi-plot',
  '--team-ferrari-plot',
  '--team-mclaren-plot',
  '--team-mercedes-plot',
  '--team-rb-plot',
  '--team-red_bull-plot',
  '--team-sauber-plot',
  '--team-williams-plot',
  '--ramp-1-plot',
  '--ramp-2-plot',
  '--ramp-3-plot',
  '--ramp-4-plot',
  '--ramp-5-plot',
  '--ramp-6-plot',
  '--ramp-7-plot',
  '--ramp-8-plot',
  '--ramp-9-plot',
  '--ramp-10-plot',
  '--ramp-11-plot',
  '--ramp-12-plot',
] as const;

/**
 * The collision adjacency of PLOT_TOKENS, as one bitmask per token.
 *
 * 87 of the 231 pairs collide. A pair collides when normal-vision CIEDE2000 is
 * below 15 **or** worst-model CVD CIEDE2000 is below 8 — the two floors the palette itself is
 * built on, so a colliding pair is by definition one the palette never promised to separate. It
 * is measured in BOTH themes and the worse taken, so the differentiator a pair earns does not
 * change when the theme does (§6.4a property 3).
 *
 * Mask `i`, read left to right, is 8-hex-character words; word `w` holds tokens `32w .. 32w+31`
 * with token `j` at bit `1 << (j & 31)`. `collides()` in `entityColor.ts` is the only reader.
 */
export const COLLISION_MASKS = [
  '003631e2', // --team-alpine-plot
  '001231e1', // --team-aston_martin-plot
  '000d0d18', // --team-audi-plot
  '000d0d14', // --team-ferrari-plot
  '000d0d0c', // --team-mclaren-plot
  '003821c3', // --team-mercedes-plot
  '003233a3', // --team-rb-plot
  '00367363', // --team-red_bull-plot
  '001928ff', // --team-sauber-plot
  '002260c0', // --team-williams-plot
  '0005001c', // --ramp-1-plot
  '000c011c', // --ramp-2-plot
  '000200c3', // --ramp-3-plot
  '003003e3', // --ramp-4-plot
  '00020280', // --ramp-5-plot
  '00010000', // --ramp-6-plot
  '0000851c', // --ramp-7-plot
  '000452c3', // --ramp-8-plot
  '001a0c9d', // --ramp-9-plot
  '0014093c', // --ramp-10-plot
  '002c21e3', // --ramp-11-plot
  '001022e1', // --ramp-12-plot
] as const;
