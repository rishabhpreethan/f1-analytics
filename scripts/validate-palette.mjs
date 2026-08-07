/*
 * Palette validator — implements docs/DESIGN_SYSTEM.md §9.1 exactly.
 *
 * 1. sRGB -> linear -> CIEXYZ (D65) -> CIELab; separation = CIEDE2000
 * 2. Lightness / chroma gates in OkLCh
 * 3. Contrast = WCAG 2.1 relative luminance ratio
 * 4. CVD at severity 1.0 by TWO models, applied in LINEAR RGB:
 *      - Vienot, Brettel & Mollon (1999) LMS dichromat projection
 *      - Machado, Oliveira & Fernandes (2009) matrices
 *    The WORSE of the two is the reported figure.
 * 5. Floors: normal dE >= 15 | CVD dE >= 8 | text 4.5:1 | mark/boundary 3:1 | chroma >= 0.05
 * 6. Lightness bands for plotting marks: light 0.40-0.72, dark 0.55-0.88
 */

/* ---------------------------------------------------------------- basics */
const hex2rgb = (h) => {
  const s = h.replace('#', '');
  const n =
    s.length === 3
      ? s
          .split('')
          .map((c) => c + c)
          .join('')
      : s;
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ].map((v) => v / 255);
};
const rgb2hex = (rgb) =>
  '#' +
  rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase();
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const l2s = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const lin = (h) => hex2rgb(h).map(s2l);

/* ---------------------------------------------------------------- XYZ / Lab */
const M_RGB_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];
const mul = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const WP = [0.95047, 1.0, 1.08883];
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
function lab(hex) {
  const [X, Y, Z] = mul(M_RGB_XYZ, lin(hex));
  const [fx, fy, fz] = [f(X / WP[0]), f(Y / WP[1]), f(Z / WP[2])];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labFromLinear(rgbL) {
  const [X, Y, Z] = mul(M_RGB_XYZ, rgbL);
  const [fx, fy, fz] = [f(X / WP[0]), f(Y / WP[1]), f(Z / WP[2])];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/* ---------------------------------------------------------------- CIEDE2000 */
function de2000(l1, l2) {
  const [L1, a1, b1] = l1,
    [L2, a2, b2] = l2;
  const C1 = Math.hypot(a1, b1),
    C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
  const ap1 = (1 + G) * a1,
    ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1),
    Cp2 = Math.hypot(ap2, b2);
  const hp = (a, b) => {
    if (a === 0 && b === 0) return 0;
    let h = (Math.atan2(b, a) * 180) / Math.PI;
    return h < 0 ? h + 360 : h;
  };
  const hp1 = hp(ap1, b1),
    hp2 = hp(ap2, b2);
  const dLp = L2 - L1,
    dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * Math.PI) / 360);
  const Lbp = (L1 + L2) / 2,
    Cbp = (Cp1 + Cp2) / 2;
  let Hbp;
  if (Cp1 * Cp2 === 0) Hbp = hp1 + hp2;
  else {
    const d = Math.abs(hp1 - hp2);
    Hbp = d > 180 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2) / 2;
    if (d > 180 && hp1 + hp2 >= 360) Hbp -= 360;
  }
  const T =
    1 -
    0.17 * Math.cos(((Hbp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * Hbp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * Hbp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * Hbp - 63) * Math.PI) / 180);
  const dTh = 30 * Math.exp(-Math.pow((Hbp - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const Sc = 1 + 0.045 * Cbp,
    Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin((2 * dTh * Math.PI) / 180) * Rc;
  return Math.sqrt(
    Math.pow(dLp / Sl, 2) +
      Math.pow(dCp / Sc, 2) +
      Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh),
  );
}
const dE = (h1, h2) => de2000(lab(h1), lab(h2));

/* ---------------------------------------------------------------- OkLab / OkLCh */
function oklab(rgbL) {
  const [r, g, b] = rgbL;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklch(hex) {
  const [L, a, b] = oklab(lin(hex));
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(a, b), h };
}
function oklab2linear([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (rgbL) => rgbL.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
/** OkLCh -> hex with chroma reduction until in gamut. Returns {hex, C} */
function lch2hex(L, C, h) {
  let c = C;
  for (let i = 0; i < 400; i++) {
    const a = c * Math.cos((h * Math.PI) / 180),
      b = c * Math.sin((h * Math.PI) / 180);
    const rgbL = oklab2linear([L, a, b]);
    if (inGamut(rgbL)) return { hex: rgb2hex(rgbL.map(l2s)), C: c };
    c -= 0.0015;
    if (c <= 0) break;
  }
  const rgbL = oklab2linear([L, 0, 0]);
  return { hex: rgb2hex(rgbL.map(l2s)), C: 0 };
}

/* ---------------------------------------------------------------- WCAG contrast */
const relLum = (hex) => {
  const [r, g, b] = lin(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/* ---------------------------------------------------------------- CVD: Vienot 1999 */
const RGB2LMS = [
  [17.8824, 43.5161, 4.11935],
  [3.45565, 27.1554, 3.86714],
  [0.0299566, 0.184309, 1.46709],
];
// numeric inverse of the above
function inv3(M) {
  const [[a, b, c], [d, e, f2], [g, h, i]] = M;
  const A = e * i - f2 * h,
    B = -(d * i - f2 * g),
    C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f2 - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f2 - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}
const LMS2RGB = inv3(RGB2LMS);
function vienot(rgbL, kind) {
  let [L, M, S] = mul(RGB2LMS, rgbL);
  if (kind === 'protan') L = 2.02344 * M - 2.52581 * S;
  else if (kind === 'deutan') M = 0.494207 * L + 1.24827 * S;
  else S = -0.395913 * L + 0.801109 * M;
  return mul(LMS2RGB, [L, M, S]).map((v) => Math.min(1, Math.max(0, v)));
}

/* ---------------------------------------------------------------- CVD: Machado 2009 (severity 1.0) */
const MACHADO = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
const machado = (rgbL, kind) => mul(MACHADO[kind], rgbL).map((v) => Math.min(1, Math.max(0, v)));

/** worse (smaller) of the two models' CIEDE2000 for a pair under one CVD type */
function cvdDE(h1, h2, kind) {
  const a = lin(h1),
    b = lin(h2);
  const v = de2000(labFromLinear(vienot(a, kind)), labFromLinear(vienot(b, kind)));
  const m = de2000(labFromLinear(machado(a, kind)), labFromLinear(machado(b, kind)));
  return { vienot: v, machado: m, worse: Math.min(v, m) };
}
const minCVD = (h1, h2) =>
  Math.min(...['protan', 'deutan', 'tritan'].map((k) => cvdDE(h1, h2, k).worse));

/* ================================================================ DATA */
const BRAND = {
  alpine: '#00A1E8',
  aston_martin: '#229971',
  audi: '#FF2D00',
  cadillac: '#AAAAAD',
  ferrari: '#ED1131',
  haas: '#9C9FA2',
  mclaren: '#F47600',
  mercedes: '#00D7B6',
  rb: '#6C98FF',
  red_bull: '#4781D7',
  sauber: '#01C00E',
  williams: '#1868DB',
};
const SURF = {
  light: {
    sunken: '#EFF1F5',
    canvas: '#F7F8FB',
    raised: '#FFFFFF',
    overlay: '#FFFFFF',
    inkPrimary: '#1B1E24',
    inkInverse: '#FFFFFF',
  },
  dark: {
    sunken: '#08090C',
    canvas: '#0E0F13',
    raised: '#1A1C20',
    overlay: '#23252A',
    inkPrimary: '#F5F7F9',
    inkInverse: '#0E0F13',
  },
};
const TIMING = {
  light: { purple: '#9E08F6', green: '#087B30', yellow: '#6A5606' },
  dark: { purple: '#BB79FD', green: '#47FF79', yellow: '#EABF17' },
};
const TIMING_WASH = {
  light: { purple: '#F1E8FD', green: '#D5F8D9', yellow: '#FAECC4' },
  dark: { purple: '#352546', green: '#16361C', yellow: '#392C01' },
};
const STATUS = {
  light: { info: '#034F89', good: '#0A7554', caution: '#6F5306', critical: '#C50721' },
  dark: { info: '#2E9CFD', good: '#26F0B0', caution: '#FEC431', critical: '#FD5E5A' },
};

const args = process.argv.slice(2);
const mode = args[0] ?? 'all';
const n = (x, d = 2) => x.toFixed(d);

/* ================================================================ V-1 CALIBRATION */
function calibration() {
  console.log('\n=== V-1 CALIBRATION — reproduce the recorded §3.2 / §9.2 figures ===');
  console.log(
    `Cadillac<->Haas normal dE      : ${n(dE(BRAND.cadillac, BRAND.haas))}   (recorded 3.82)`,
  );
  console.log(`Haas OkLCh C                   : ${n(oklch(BRAND.haas).C, 4)}  (recorded 0.0056)`);
  console.log(
    `Cadillac OkLCh C               : ${n(oklch(BRAND.cadillac).C, 4)}  (recorded 0.0043)`,
  );
  console.log(
    `Mercedes OkLCh L               : ${n(oklch(BRAND.mercedes).L, 3)}   (recorded 0.786)`,
  );
  const rbAl = cvdDE(BRAND.rb, BRAND.alpine, 'deutan');
  console.log(
    `RB<->Alpine deutan dE          : Vienot ${n(rbAl.vienot)} / Machado ${n(rbAl.machado)}  (recorded 3.17 / 2.90)`,
  );
  const t = cvdDE(BRAND.rb, BRAND.alpine, 'tritan');
  console.log(
    `RB<->Alpine tritan dE          : Vienot ${n(t.vienot)} / Machado ${n(t.machado)}  (recorded 4.62 / 3.49)`,
  );
  console.log('\n-- V-3 spot check: timing semantics, light --');
  console.log(
    `green<->yellow deutan          : ${n(cvdDE(TIMING.light.green, TIMING.light.yellow, 'deutan').worse)}  (recorded 6.9)`,
  );
  console.log(
    `purple<->yellow tritan         : ${n(cvdDE(TIMING.light.purple, TIMING.light.yellow, 'tritan').worse)}  (recorded 7.2)`,
  );
  console.log(
    `min CVD dE, dark timing set    : ${n(Math.min(minCVD(TIMING.dark.green, TIMING.dark.yellow), minCVD(TIMING.dark.purple, TIMING.dark.yellow), minCVD(TIMING.dark.purple, TIMING.dark.green)))}  (recorded 9.2)`,
  );
  console.log('\n-- V-2 spot check: neutrals --');
  console.log(
    `ink-tertiary on sunken, light  : ${n(contrast('#6A6D74', SURF.light.sunken))}:1  (recorded 4.58)`,
  );
  console.log(
    `border-control on sunken, light: ${n(contrast('#878B92', SURF.light.sunken))}:1  (recorded 3.03)`,
  );
  console.log(
    `ink-tertiary on sunken, dark   : ${n(contrast('#86898F', SURF.dark.sunken))}:1  (recorded 5.68)`,
  );
}

/* ================================================================ HUE SCAN */
/**
 * For each hue, find the max-chroma colour that clears 4.5:1 as text on the mode's
 * lightest surface, then report its minimum CVD separation from every reserved
 * colour (3 timing inks + 4 status inks) and from the 12 brand colours.
 */
function hueScan(theme) {
  const S = SURF[theme];
  const bg = theme === 'light' ? S.raised : S.raised;
  const reserved = Object.values(TIMING[theme]);
  const statuses = Object.values(STATUS[theme]);
  const rows = [];
  for (let h = 0; h < 360; h += 5) {
    // walk L to find the extreme that just clears 4.5:1 vs raised, maximising chroma
    let best = null;
    for (let L = 0.2; L <= 0.95; L += 0.005) {
      const { hex, C } = lch2hex(L, 0.4, h);
      if (C < 0.05) continue;
      if (contrast(hex, bg) < 4.5) continue;
      if (contrast(hex, S.canvas) < 4.5 || contrast(hex, S.sunken) < 4.5) continue;
      if (!best || C > best.C) best = { hex, C, L };
    }
    if (!best) {
      rows.push({ h, hex: '—', C: 0, minRes: 0, minStat: 0, minBrand: 0 });
      continue;
    }
    const minRes = Math.min(...reserved.map((r) => minCVD(best.hex, r)));
    const minResNormal = Math.min(...reserved.map((r) => dE(best.hex, r)));
    const minStat = Math.min(...statuses.map((r) => minCVD(best.hex, r)));
    const minBrand = Math.min(...Object.values(BRAND).map((r) => dE(best.hex, r)));
    rows.push({ h, hex: best.hex, C: best.C, L: best.L, minRes, minResNormal, minStat, minBrand });
  }
  console.log(
    `\n=== HUE SCAN (${theme}) — max-chroma accent candidate per OkLCh hue, text-legible on all three surfaces ===`,
  );
  console.log(
    '  h   hex        L     C      minCVD-vs-timing  minNormal-vs-timing  minCVD-vs-status  minNormal-vs-brand',
  );
  for (const r of rows) {
    if (r.hex === '—') {
      console.log(` ${String(r.h).padStart(3)}  (no in-gamut candidate)`);
      continue;
    }
    console.log(
      ` ${String(r.h).padStart(3)}  ${r.hex}  ${n(r.L, 3)} ${n(r.C, 3)}   ` +
        `${n(r.minRes).padStart(6)}            ${n(r.minResNormal).padStart(6)}             ` +
        `${n(r.minStat).padStart(6)}            ${n(r.minBrand).padStart(6)}`,
    );
  }
}

/* ================================================================ RAMP BUILD */
/** Build a ramp at a fixed hue satisfying the role contracts, print the audit. */
function ramp(hue) {
  const H = Number(hue);
  console.log(`\n=== RAMP BUILD at OkLCh hue ${H} ===`);
  for (const theme of ['light', 'dark']) {
    const S = SURF[theme];
    console.log(`\n--- ${theme} ---`);
    // accent-strong: max chroma clearing 4.5:1 on ALL THREE surfaces
    let strong = null;
    for (let L = 0.2; L <= 0.95; L += 0.002) {
      const { hex, C } = lch2hex(L, 0.4, H);
      if (
        contrast(hex, S.raised) < 4.5 ||
        contrast(hex, S.canvas) < 4.5 ||
        contrast(hex, S.sunken) < 4.5
      )
        continue;
      if (!strong || C > strong.C) strong = { hex, C, L };
    }
    // accent-base: fill, needs an on-ink at >=4.5:1 (try white, then ink-primary/inverse), max chroma
    let base = null;
    for (let L = 0.2; L <= 0.95; L += 0.002) {
      const { hex, C } = lch2hex(L, 0.4, H);
      const onWhite = contrast(hex, '#FFFFFF');
      const onDark = contrast(hex, SURF.light.inkPrimary);
      const best = Math.max(onWhite, onDark);
      if (best < 4.5) continue;
      if (!base || C > base.C)
        base = {
          hex,
          C,
          L,
          on: onWhite >= onDark ? '#FFFFFF' : SURF.light.inkPrimary,
          onRatio: best,
        };
    }
    // accent-mark: >=3:1 on raised AND sunken, max chroma, inside the plotting band
    const band = theme === 'light' ? [0.4, 0.72] : [0.55, 0.88];
    let mark = null;
    for (let L = band[0]; L <= band[1]; L += 0.002) {
      const { hex, C } = lch2hex(L, 0.4, H);
      if (contrast(hex, S.raised) < 3 || contrast(hex, S.sunken) < 3) continue;
      if (!mark || C > mark.C) mark = { hex, C, L };
    }
    // accent-glow: maximum chroma at a pleasing L (vivid, no contrast contract)
    let glow = null;
    for (let L = 0.3; L <= 0.85; L += 0.002) {
      const { hex, C } = lch2hex(L, 0.4, H);
      if (!glow || C > glow.C) glow = { hex, C, L };
    }
    // accent-wash: tinted field; strong on it >= 4.5, and it must be distinguishable from the surface
    let wash = null;
    const washL = theme === 'light' ? [0.9, 0.985] : [0.16, 0.34];
    for (let L = washL[0]; L <= washL[1]; L += 0.002) {
      for (let C = 0.02; C <= 0.14; C += 0.004) {
        const { hex } = lch2hex(L, C, H);
        if (contrast(strong.hex, hex) < 4.5) continue;
        if (contrast(hex, S.raised) < 1.06) continue; // must be visibly a field
        if (!wash || C > wash.C) wash = { hex, C, L };
      }
    }
    const rows = { strong, base, mark, glow, wash };
    for (const [k, v] of Object.entries(rows)) {
      if (!v) {
        console.log(`${k.padEnd(8)} : NO SOLUTION`);
        continue;
      }
      console.log(
        `${k.padEnd(8)} : ${v.hex}  L ${n(v.L, 3)}  C ${n(v.C, 3)}  ` +
          `vs raised ${n(contrast(v.hex, S.raised))}:1  vs canvas ${n(contrast(v.hex, S.canvas))}:1  vs sunken ${n(contrast(v.hex, S.sunken))}:1` +
          (v.on ? `  on-ink ${v.on} ${n(v.onRatio)}:1` : ''),
      );
    }
    // separation audit for the two colours a user could confuse with a semantic
    console.log('  separation audit (accent-strong and accent-mark vs every reserved colour):');
    for (const [name, hex] of [
      ['timing-purple', TIMING[theme].purple],
      ['timing-green', TIMING[theme].green],
      ['timing-yellow', TIMING[theme].yellow],
      ['status-info', STATUS[theme].info],
      ['status-good', STATUS[theme].good],
      ['status-caution', STATUS[theme].caution],
      ['status-critical', STATUS[theme].critical],
    ]) {
      const a = rows.strong.hex,
        b = rows.mark.hex;
      console.log(
        `    ${name.padEnd(16)} strong: normal ${n(dE(a, hex)).padStart(6)}  minCVD ${n(minCVD(a, hex)).padStart(6)}   |   mark: normal ${n(dE(b, hex)).padStart(6)}  minCVD ${n(minCVD(b, hex)).padStart(6)}`,
      );
    }
    console.log('  separation audit (accent-mark vs the 12 brand colours, normal vision):');
    const bl = Object.entries(BRAND)
      .map(([t, hex]) => `${t} ${n(dE(rows.mark.hex, hex), 1)}`)
      .join('  ');
    console.log('    ' + bl);
    console.log(
      `    worst brand pair: ${Object.entries(BRAND)
        .map(([t, hex]) => [t, dE(rows.mark.hex, hex)])
        .sort((x, y) => x[1] - y[1])[0]
        .join(' = ')}`,
    );
  }
}

/* ================================================================ CHECK a supplied set */
function check(list) {
  // list: name=hex,name=hex  plus --theme
  const theme = args.includes('--dark') ? 'dark' : 'light';
  const S = SURF[theme];
  const set = list.split(',').map((p) => p.split('='));
  console.log(`\n=== CHECK (${theme}) ===`);
  for (const [name, hex] of set) {
    const o = oklch(hex);
    console.log(
      `${name.padEnd(20)} ${hex}  L ${n(o.L, 3)} C ${n(o.C, 3)} h ${n(o.h, 1)}  ` +
        `raised ${n(contrast(hex, S.raised))}:1  canvas ${n(contrast(hex, S.canvas))}:1  sunken ${n(contrast(hex, S.sunken))}:1  ` +
        `white ${n(contrast(hex, '#FFFFFF'))}:1  inkPrimary ${n(contrast(hex, S.inkPrimary))}:1`,
    );
  }
  console.log('\npairwise (normal dE / min CVD dE):');
  for (let i = 0; i < set.length; i++)
    for (let j = i + 1; j < set.length; j++) {
      console.log(
        `  ${set[i][0]} <-> ${set[j][0]}: ${n(dE(set[i][1], set[j][1]))} / ${n(minCVD(set[i][1], set[j][1]))}`,
      );
    }
}

/* ================================================================ ALPHA COMPOSITING
 * `src-over` of a straight-alpha colour onto an opaque backdrop. Every background layer in
 * `src/styles/backdrop.css` is one of these, so a field composite is a fold over this.
 */
const over = (fg, bg, a) => {
  const F = hex2rgb(fg),
    B = hex2rgb(bg);
  return rgb2hex([0, 1, 2].map((i) => a * F[i] + (1 - a) * B[i]));
};
const stack = (base, layers) => layers.reduce((acc, [hex, a]) => over(hex, acc, a), base);

/* ================================================================ V-18 … V-22
 * The MONOCHROME interface accent, and the rebuilt background field.
 *
 * This replaces the Signal (OkLCh 350) ramp. The whole §3.6.1 hue argument becomes moot: an
 * achromatic accent cannot collide with a hue it does not have, so the hue-scan floors are
 * not the question any more. The questions that ARE the question, and that this function
 * answers, are the ones a neutral-on-neutral system fails at:
 *
 *   1. every accent alias against its contrast floor, in both themes
 *   2. the achromatic focus ring against an accent fill that is now itself near-black /
 *      near-white — the case where a single-ring design would have failed
 *   3. the background field's large-area composite, which is where the previous orb field
 *      failed (V-13) and needed a rescue plate
 *   4. that the accent is genuinely achromatic, so no future edit can slide it toward a
 *      reserved hue and still pass
 */
const MONO = {
  light: {
    'accent-ink': '#08090C',
    'accent-ink-strong': '#000000',
    'accent-fill': '#08090C',
    'accent-fill-hover': '#33373E',
    'accent-on': '#FFFFFF',
    'accent-mark': '#08090C',
    'accent-border': '#08090C',
    'accent-wash': '#E4E7ED',
    'accent-wash-ink': '#08090C',
    'accent-glow': '#08090C',
  },
  dark: {
    'accent-ink': '#FFFFFF',
    'accent-ink-strong': '#FFFFFF',
    'accent-fill': '#FFFFFF',
    'accent-fill-hover': '#C6CAD2',
    'accent-on': '#08090C',
    'accent-mark': '#FFFFFF',
    'accent-border': '#FFFFFF',
    'accent-wash': '#2C2F35',
    'accent-wash-ink': '#FFFFFF',
    'accent-glow': '#FFFFFF',
  },
};

/** The §3.5 neutrals, by theme, so a composite can be judged against every one of them. */
const INK = {
  light: {
    'ink-primary': '#1B1E24',
    'ink-secondary': '#53575E',
    'ink-tertiary': '#6A6D74',
    'border-control': '#878B92',
  },
  dark: {
    'ink-primary': '#F5F7F9',
    'ink-secondary': '#B3B6BA',
    'ink-tertiary': '#86898F',
    'border-control': '#64686F',
  },
};
const FLOOR = {
  'ink-primary': 4.5,
  'ink-secondary': 4.5,
  'ink-tertiary': 4.5,
  'border-control': 3.0,
  'accent-ink': 4.5,
  'accent-mark': 3.0,
};

/**
 * The background field, layer by layer, exactly as `backdrop.css` composites it. The dot
 * lattice is deliberately **excluded from the large-area composite** and reported separately:
 * a 1px dot on a 22px pitch covers ~0.2% of the area, so it is a hairline, not a field — the
 * same reasoning §3.5 uses to put `--border-subtle` outside WCAG 1.4.11's scope.
 */
const FIELD = {
  light: {
    canvas: '#F7F8FB',
    // The vignette's darkest corner, as a straight-alpha layer.
    vignette: ['#1B1E24', 0.04],
    grainAlpha: 0.024,
    dot: 0.13,
    dotMajor: 0.22,
    dotInk: '#1B1E24',
  },
  dark: {
    canvas: '#0E0F13',
    vignette: ['#000000', 0.72],
    grainAlpha: 0.05,
    dot: 0.13,
    dotMajor: 0.24,
    dotInk: '#F5F7F9',
  },
};

/**
 * `mix-blend-mode: overlay`, per the CSS Compositing spec — and modelling it properly rather
 * than as a straight-alpha tint is load-bearing.
 *
 * The grain tile is achromatic `feTurbulence` noise: values spread across 0…1 with a mean near
 * 0.5. `overlay` is `multiply` where the backdrop is dark and `screen` where it is light, so a
 * mid-grey source over ANY backdrop returns almost exactly the backdrop — which is why grain
 * adds texture without moving a field's mean luminance. An earlier version of this validator
 * modelled it as a solid tint at the same alpha and it consumed the entire light-mode
 * luminance budget on its own, which is a modelling error and not a design constraint.
 *
 * `source` is the noise value being modelled. 0.5 is the tile's mean; 0 and 1 are its
 * extremes, and the spread between those two is the per-pixel excursion the texture actually
 * produces. That excursion is what has to be bounded, not the mean.
 */
function overlayBlend(backdropHex, source, alpha) {
  const B = hex2rgb(backdropHex);
  return rgb2hex(
    B.map((cb) => {
      const blended = cb <= 0.5 ? 2 * cb * source : 1 - 2 * (1 - cb) * (1 - source);
      return alpha * blended + (1 - alpha) * cb;
    }),
  );
}

/**
 * The field, composited in `backdrop.css`'s own layer order:
 * canvas -> vignette -> grain (overlay) -> veil.
 *
 * `grainSource` selects which point of the noise distribution is being modelled — 0.5 for the
 * mean, 0 for the darkest grain pixel (the pessimistic case for dark ink on a light field),
 * 1 for the lightest (the pessimistic case for light ink on a dark field).
 */
function fieldComposite(theme, veil, { vignetted, grainSource = 0.5 }) {
  const F = FIELD[theme];
  let c = F.canvas;
  if (vignetted) c = over(F.vignette[0], c, F.vignette[1]);
  c = overlayBlend(c, grainSource, F.grainAlpha);
  return over(SURF[theme].canvas, c, veil);
}

/**
 * The **luminance corridor** a background field may occupy, solved rather than guessed.
 *
 * Both bounds come from the §3.5 tokens that have the tightest floors, and they bound the
 * field from opposite directions in the two themes — which is why the two themes' fields are
 * different shapes rather than inversions of each other:
 *
 *   - light: `--border-control` (3:1) and `--ink-tertiary` (4.5:1) are *dark* on a *light*
 *     field, so darkening the field is what breaks them. The field therefore has a **floor**.
 *   - dark: the same two tokens are *light* on a *dark* field, so lightening is what breaks
 *     them. The field has a **ceiling** — and a second, tighter one: it must stay clearly
 *     below `--surface-raised`, or a panel disappears into the background.
 */
function fieldBound(theme) {
  const I = INK[theme];
  const need = (ink, floor) =>
    theme === 'light'
      ? floor * (relLum(ink) + 0.05) - 0.05 // minimum background luminance
      : (relLum(ink) + 0.05) / floor - 0.05; // maximum background luminance
  return {
    inkTertiary: need(I['ink-tertiary'], 4.5),
    borderControl: need(I['border-control'], 3.0),
    raised: relLum(SURF[theme].raised),
    canvas: relLum(SURF[theme].canvas),
  };
}

function verdict(ratio, floor) {
  return ratio >= floor ? 'PASS' : 'FAIL';
}

function mono() {
  let failures = 0;
  const report = (label, ratio, floor) => {
    const v = verdict(ratio, floor);
    if (v === 'FAIL') failures += 1;
    console.log(`  ${v}  ${n(ratio).padStart(6)}:1  (floor ${floor.toFixed(1)})  ${label}`);
  };

  console.log('\n================================================================');
  console.log('  V-18  MONOCHROME ACCENT ALIASES vs their contract floors');
  console.log('================================================================');
  for (const theme of ['light', 'dark']) {
    const S = SURF[theme];
    const A = MONO[theme];
    console.log(`\n--- ${theme} ---`);
    for (const [surface, hex] of [
      ['surface-raised', S.raised],
      ['surface-canvas', S.canvas],
      ['surface-sunken', S.sunken],
    ]) {
      report(`accent-ink ${A['accent-ink']} on ${surface}`, contrast(A['accent-ink'], hex), 4.5);
    }
    for (const [surface, hex] of [
      ['surface-raised', S.raised],
      ['surface-canvas', S.canvas],
      ['surface-sunken', S.sunken],
    ]) {
      report(`accent-mark ${A['accent-mark']} on ${surface}`, contrast(A['accent-mark'], hex), 3.0);
    }
    report(
      `accent-on on accent-fill ${A['accent-fill']}`,
      contrast(A['accent-on'], A['accent-fill']),
      4.5,
    );
    report(
      `accent-on on accent-fill-hover ${A['accent-fill-hover']}`,
      contrast(A['accent-on'], A['accent-fill-hover']),
      4.5,
    );
    report(
      `accent-ink-strong ${A['accent-ink-strong']} on surface-raised`,
      contrast(A['accent-ink-strong'], S.raised),
      4.5,
    );
    report(
      `accent-wash ${A['accent-wash']} vs surface-raised (visible field)`,
      contrast(A['accent-wash'], S.raised),
      1.06,
    );
    report(`accent-wash-ink on accent-wash`, contrast(A['accent-wash-ink'], A['accent-wash']), 4.5);
    report(
      `ink-primary on accent-wash`,
      contrast(INK[theme]['ink-primary'], A['accent-wash']),
      4.5,
    );
    report(
      `ink-secondary on accent-wash`,
      contrast(INK[theme]['ink-secondary'], A['accent-wash']),
      4.5,
    );
  }

  console.log('\n================================================================');
  console.log('  V-19  THE ACHROMATIC DOUBLE FOCUS RING over an accent fill');
  console.log('  (§3.5.1. The outer ring is --ink-primary, the inner separator ring is');
  console.log('   --surface-raised. The BETTER of the two must clear 3:1, which is exactly');
  console.log('   why the ring is doubled: against a near-black fill the ink-primary outline');
  console.log('   has almost no separation, and the surface ring carries it.)');
  console.log('================================================================');
  for (const theme of ['light', 'dark']) {
    const S = SURF[theme];
    const fill = MONO[theme]['accent-fill'];
    const outer = contrast(S.inkPrimary, fill);
    const inner = contrast(S.raised, fill);
    console.log(
      `\n--- ${theme} --- outer ring ink-primary ${S.inkPrimary} vs fill ${fill}: ${n(outer)}:1` +
        `   inner ring surface-raised ${S.raised} vs fill: ${n(inner)}:1`,
    );
    report(`better of the two rings vs accent-fill`, Math.max(outer, inner), 3.0);
    // The outer ring also has to read against the PAGE on its far side.
    report(
      `outer ring vs surface-canvas (its outward side)`,
      contrast(S.inkPrimary, S.canvas),
      3.0,
    );
  }

  console.log('\n================================================================');
  console.log('  V-20  THE ACCENT IS ACHROMATIC — so it cannot collide with a reserved hue');
  console.log('================================================================');
  for (const theme of ['light', 'dark']) {
    console.log(`\n--- ${theme} ---`);
    for (const alias of ['accent-ink', 'accent-mark', 'accent-fill', 'accent-wash']) {
      const o = oklch(MONO[theme][alias]);
      const ok = o.C < 0.02;
      if (!ok) failures += 1;
      console.log(
        `  ${ok ? 'PASS' : 'FAIL'}  ${alias.padEnd(16)} ${MONO[theme][alias]}  OkLCh L ${n(o.L, 3)}  C ${n(o.C, 4)}  (must be < 0.0200 — achromatic)`,
      );
    }
    const acc = MONO[theme]['accent-ink'];
    const semantics = [
      ...Object.entries(TIMING[theme]).map(([k, v]) => [`timing-${k}`, v]),
      ...Object.entries(STATUS[theme]).map(([k, v]) => [`status-${k}`, v]),
    ];
    let worstNormal = Infinity;
    let worstCVD = Infinity;
    let worstCVDName = '';
    for (const [nm, hx] of semantics) {
      const dn = dE(acc, hx);
      const dc = minCVD(acc, hx);
      if (dn < worstNormal) worstNormal = dn;
      if (dc < worstCVD) {
        worstCVD = dc;
        worstCVDName = nm;
      }
    }
    console.log(
      `  accent-ink vs the 7 reserved semantics : min normal dE ${n(worstNormal)} (floor 15)   min CVD dE ${n(worstCVD)} on ${worstCVDName} (floor 8)`,
    );
    if (worstNormal < 15 || worstCVD < 8) failures += 1;
    let bNormal = Infinity;
    let bCVD = Infinity;
    let bName = '';
    for (const [t, hx] of Object.entries(BRAND)) {
      const dn = dE(MONO[theme]['accent-mark'], hx);
      const dc = minCVD(MONO[theme]['accent-mark'], hx);
      if (dn < bNormal) bNormal = dn;
      if (dc < bCVD) {
        bCVD = dc;
        bName = t;
      }
    }
    console.log(
      `  accent-mark vs the 12 brand colours   : min normal dE ${n(bNormal)} (floor 15)   min CVD dE ${n(bCVD)} on ${bName} (floor 8)`,
    );
    if (bNormal < 15 || bCVD < 8) failures += 1;
  }

  console.log('\n================================================================');
  console.log('  V-21  THE REBUILT BACKGROUND FIELD — the luminance corridor, solved');
  console.log('  (canvas -> vignette -> grain -> veil. The dot lattice is a 1px mark on a');
  console.log('   22px pitch, ~0.2% of the area, so it is reported separately as a hairline');
  console.log('   rather than folded into a large-area field composite — the same treatment');
  console.log('   §3.5 gives --border-subtle.)');
  console.log('================================================================');
  for (const theme of ['light', 'dark']) {
    const F = FIELD[theme];
    const S = SURF[theme];
    const B = fieldBound(theme);
    console.log(
      `\n--- ${theme} corridor (WCAG relative luminance) ---` +
        `\n  canvas ${n(B.canvas, 4)}   surface-raised ${n(B.raised, 4)}` +
        `\n  ${theme === 'light' ? 'FLOOR' : 'CEILING'} from --ink-tertiary   (4.5:1): ${n(B.inkTertiary, 4)}` +
        `\n  ${theme === 'light' ? 'FLOOR' : 'CEILING'} from --border-control (3.0:1): ${n(B.borderControl, 4)}`,
    );

    for (const [state, veil] of [
      ['hero', 0.18],
      ['calm', 0.66],
    ]) {
      // Two extremes of one field: the untouched centre and the deepest corner of the
      // vignette, each at the grain excursion that is worst for that theme's ink.
      const grainSource = theme === 'light' ? 0 : 1;
      for (const [where, vignetted] of [
        ['centre (no vignette)', false],
        ['deepest corner', true],
      ]) {
        const composite = fieldComposite(theme, veil, { vignetted, grainSource });
        const lum = relLum(composite);
        const inCorridor =
          theme === 'light'
            ? lum >= Math.max(B.inkTertiary, B.borderControl)
            : lum <= Math.min(B.inkTertiary, B.borderControl);
        if (!inCorridor) failures += 1;
        console.log(
          `\n--- ${theme} / data-bg="${state}" / ${where} -> ${composite}` +
            `  lum ${n(lum, 4)}  ${inCorridor ? 'IN CORRIDOR' : 'OUT OF CORRIDOR'}` +
            `  (dE ${n(dE(composite, F.canvas))} from canvas, worst grain pixel) ---`,
        );
        for (const [name, hex] of Object.entries(INK[theme])) {
          report(`${name} on the field`, contrast(hex, composite), FLOOR[name]);
        }
        report(
          `accent-ink on the field`,
          contrast(MONO[theme]['accent-ink'], composite),
          FLOOR['accent-ink'],
        );
        report(
          `accent-mark on the field`,
          contrast(MONO[theme]['accent-mark'], composite),
          FLOOR['accent-mark'],
        );
        /*
         * A panel's delimiter is its 1px `--border-subtle` edge plus, in light mode, the
         * `--elev-1` shadow — §5.4 already accepts that `--surface-raised` on
         * `--surface-canvas` is only 1.06:1 in light mode. So this figure is RECORDED, not
         * gated. What IS gated is the sign: the field must never become *lighter* than
         * `--surface-raised`, because that inverts the elevation model and a card would then
         * read as a hole rather than as a panel.
         */
        console.log(
          `       ----   ${n(contrast(S.raised, composite)).padStart(5)}:1  (recorded)   surface-raised panel vs the field`,
        );
        const elevationHolds = lum <= B.raised + 1e-9;
        if (!elevationHolds) failures += 1;
        console.log(
          `  ${elevationHolds ? 'PASS' : 'FAIL'}  field lum ${n(lum, 4)} <= surface-raised lum ${n(B.raised, 4)}  (elevation model must not invert)`,
        );
      }
    }

    // The grain's per-pixel excursion, both ways, at the field centre — the figure that
    // matters for a texture, as opposed to the mean it does not move.
    const gMean = fieldComposite(theme, 0.18, { vignetted: false, grainSource: 0.5 });
    const gDark = fieldComposite(theme, 0.18, { vignetted: false, grainSource: 0 });
    const gLight = fieldComposite(theme, 0.18, { vignetted: false, grainSource: 1 });
    console.log(
      `\n  grain excursion at data-bg="hero", field centre (mix-blend-mode: overlay, alpha ${F.grainAlpha}):` +
        `\n    darkest pixel ${gDark} (lum ${n(relLum(gDark), 4)})  mean ${gMean} (lum ${n(relLum(gMean), 4)})  lightest ${gLight} (lum ${n(relLum(gLight), 4)})`,
    );

    const minor = over(F.dotInk, F.canvas, F.dot);
    const major = over(F.dotInk, F.canvas, F.dotMajor);
    const lit = over(MONO[theme]['accent-glow'], F.canvas, 0.42);
    console.log(
      `\n  dot lattice (decorative, no floor — cf. --border-subtle at 1.32 / 1.33):` +
        `\n    minor dot   -> ${minor}  ${n(contrast(minor, F.canvas))}:1` +
        `\n    major dot   -> ${major}  ${n(contrast(major, F.canvas))}:1` +
        `\n    lit dot     -> ${lit}  ${n(contrast(lit, F.canvas))}:1   (under the pointer lamp)`,
    );
  }

  console.log('\n================================================================');
  console.log('  V-22  GLASS HEADER / DOCK over the rebuilt field (§5.2b)');
  console.log('================================================================');
  for (const theme of ['light', 'dark']) {
    const F = FIELD[theme];
    const S = SURF[theme];
    const glass = theme === 'light' ? ['#FFFFFF', 0.72] : ['#1A1C20', 0.68];
    for (const [where, vignetted] of [
      ['over the field centre', false],
      ['over the deepest corner', true],
    ]) {
      const field = fieldComposite(theme, 0.18, {
        vignetted,
        grainSource: theme === 'light' ? 0 : 1,
      });
      const composite = over(glass[0], field, glass[1]);
      console.log(`\n--- ${theme} / ${where} -> ${composite} ---`);
      for (const [name, hex] of Object.entries(INK[theme])) {
        report(`${name} on the glass`, contrast(hex, composite), FLOOR[name]);
      }
      report(
        `accent-ink on the glass`,
        contrast(MONO[theme]['accent-ink'], composite),
        FLOOR['accent-ink'],
      );
      report(
        `accent-on on an accent-fill pill over the glass`,
        contrast(MONO[theme]['accent-on'], MONO[theme]['accent-fill']),
        4.5,
      );
    }
  }

  console.log('\n================================================================');
  console.log(
    failures === 0
      ? '  RESULT: PASS — every floor cleared, both themes, no residual CVD failure.'
      : `  RESULT: ${failures} FAILURE(S) — fix before shipping.`,
  );
  console.log('================================================================\n');
  if (failures > 0) process.exitCode = 1;
}

/* ================================================================ V-23 … V-26
 * THE CATEGORICAL PALETTE — the fallback ramp for the 202 teams with no brand colour,
 * and the chart-safe plotting variants for the 12 that have one.
 *
 * The headline fact inverts the assumption the rest of this file was written under:
 * **214 teams exist and 12 carry a `primary_color`** (queried, not remembered). The ramp
 * is therefore not an edge case at 94% of the data — it is the norm, and the brand
 * colours are the enrichment.
 *
 * What is gated here, and why each floor is the floor it is:
 *
 *   1. **Per entry, both themes.** OkLCh chroma >= 0.05 (§9.1 step 5 — a ramp entry that
 *      reads as grey is indistinguishable from this product's achromatic chart furniture),
 *      OkLCh L inside the plotting band (§9.1 step 6), and >= 3:1 against BOTH
 *      `--surface-raised` and `--surface-sunken` — sunken because that is the colour of a
 *      plot area.
 *   2. **Pairwise inside the ramp, both themes.** normal-vision CIEDE2000 >= 15 and CVD
 *      >= 8 under all three dichromacies, worse of the two §9.1 models. This is the gate
 *      that sizes the ramp, and it buys a property worth more than a larger palette: two
 *      entities in a chart are either the SAME ramp entry — an exact collision, which the
 *      differentiator ladder resolves explicitly — or they are >= 15 apart. **There are no
 *      near-misses by construction**, and a near-miss (Cadillac <-> Haas at 3.8) is the
 *      worst of the three cases because it reads as "probably different, possibly not".
 *   3. **Every entry against the three reserved F1 timing inks** (§3.4) at the same two
 *      floors. HARD, because timing colours and series colours co-occur constantly — a
 *      lap-time chart carries purple/green/yellow marks over the series' own strokes.
 *   4. **Every entry against the four status inks** — REPORTED, not gated, and the reason
 *      is the posture §3.4.3 already takes: the status set's own `caution <-> critical`
 *      pair fails CVD at 7.5, which is why a status colour never appears without an icon
 *      and a text label. A floor the reserved set itself cannot meet is not a floor a
 *      series colour can be held to.
 *   5. **Every entry against the achromatic chart furniture** — `--border-strong` (axis),
 *      `--border-subtle` (gridline), `--ink-tertiary` (ticks) and `--accent-mark` — at
 *      normal-vision ΔE >= 15. A series that reads as a gridline is a defect no legend
 *      fixes.
 */

/** The chart furniture a series must never be confusable with. §6.2. */
const FURNITURE = {
  light: {
    'border-subtle': '#DDE0E4',
    'border-strong': '#B9BCC3',
    'ink-tertiary': '#6A6D74',
    'accent-mark': '#08090C',
  },
  dark: {
    'border-subtle': '#2F3237',
    'border-strong': '#4F535A',
    'ink-tertiary': '#86898F',
    'accent-mark': '#FFFFFF',
  },
};

const PLOT_BAND = { light: [0.4, 0.72], dark: [0.55, 0.88] };

/**
 * The plotting colour at a given OkLCh hue **and lightness** for a theme: the maximum chroma
 * in gamut at that (L, h) that still clears 3:1 on both `--surface-raised` and
 * `--surface-sunken`, and C >= 0.05. `null` when there is no solution there.
 *
 * **Lightness is a search dimension and not a derived value, and that is the single decision
 * that makes this palette possible.** A hue-only ramp — max chroma per hue, one entry per hue
 * — caps at **N = 3** under a pairwise CVD floor of 8, measured. The reason is structural: a
 * dichromat's colour space is essentially one chromatic axis (blue <-> yellow) plus lightness,
 * the yellow half of that axis is reserved by the F1 timing convention, and so hue alone has
 * almost nothing left to spend. Lightness, by contrast, is preserved *exactly* under every CVD
 * model — it is the one channel a dichromat loses nothing of. Spending it is how the ramp gets
 * past three.
 */
function plotAt(theme, h, L) {
  const S = SURF[theme];
  const { hex, C } = lch2hex(L, 0.4, h);
  if (C < 0.05) return null;
  if (contrast(hex, S.raised) < 3 || contrast(hex, S.sunken) < 3) return null;
  return { hex, C, L };
}

/**
 * The three lightness tiers, per theme, inside each theme's plotting band (§9.1 step 6).
 *
 * Light mode's band is 0.40–0.72 but its *usable* upper end is lower than 0.72, because a
 * light colour has to clear 3:1 against white; dark mode's is 0.55–0.88 and usable throughout.
 * The tiers are therefore stated per theme rather than derived by one proportional mapping,
 * which is also what §3.5's "dark is designed, not flipped" already requires of every other
 * colour in this document.
 *
 * A ramp entry is a **(hue, tier)** pair: hue is shared across themes so the entry is
 * recognisably the same colour after a theme switch, and only the lightness differs.
 */
const TIER_SETS = {
  3: { light: [0.44, 0.54, 0.64], dark: [0.62, 0.72, 0.82] },
  4: { light: [0.42, 0.5, 0.58, 0.66], dark: [0.58, 0.68, 0.78, 0.88] },
  5: { light: [0.42, 0.48, 0.54, 0.6, 0.66], dark: [0.58, 0.65, 0.72, 0.79, 0.86] },
  6: {
    light: [0.4, 0.45, 0.5, 0.55, 0.6, 0.66],
    dark: [0.56, 0.62, 0.68, 0.74, 0.8, 0.86],
  },
};
let PLOT_TIERS = TIER_SETS[3];
let MIN_HUE_SEP = 40;
let GATE_BRAND = false;

/** Both themes' variants of one (hue, tier), or null if either theme has no solution. */
function hueEntry(h, tier = 1) {
  const light = plotAt('light', h, PLOT_TIERS.light[tier]);
  const dark = plotAt('dark', h, PLOT_TIERS.dark[tier]);
  if (!light || !dark) return null;
  return { h, tier, light: light.hex, dark: dark.hex, Cl: light.C, Cd: dark.C };
}

/** Worst pairwise figures for a set of ramp entries, across both themes. */
function setFigures(entries) {
  let minNormal = Infinity;
  let minCvd = Infinity;
  let worst = '';
  for (const theme of ['light', 'dark']) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i][theme];
        const b = entries[j][theme];
        const dn = dE(a, b);
        const dc = minCVD(a, b);
        if (dn < minNormal) minNormal = dn;
        if (dc < minCvd) {
          minCvd = dc;
          worst = `${theme} h${entries[i].h}/t${entries[i].tier} <-> h${entries[j].h}/t${entries[j].tier}`;
        }
      }
    }
  }
  return { minNormal, minCvd, worst };
}

/**
 * True when an entry clears **normal-vision** ΔE 15 against all three timing inks, in both
 * themes.
 *
 * **The CVD floor is deliberately NOT applied here, and the reason is measured.** Requiring
 * CVD ΔE >= 8 from all three timing inks in both themes rejects **117 of the 120 hues on the
 * wheel** — which is not a search failure but an impossibility, because the timing set does
 * not meet that floor *internally*: green <-> yellow is 6.88 deuteranopic and purple <->
 * yellow is 6.82 tritanopic (§9.2 V-3). A floor the reserved set cannot meet against itself
 * cannot be imposed on everything that has to coexist with it.
 *
 * What discharges it is the channel argument, and it is the same one §3.4.3 uses for status:
 * a series stroke and a timing chip are **different objects in different places**, and both
 * sides already carry a mandatory non-colour channel — the timing chip a marker glyph, a
 * visible value and an `aria-label` (§3.4.2), the series a direct label or legend entry plus
 * its ladder rung (§6.4). Two *series*, by contrast, are the same channel in the same plot
 * area, which is why the within-ramp pairwise CVD floor below IS hard.
 */
function clearsReserved(entry) {
  for (const theme of ['light', 'dark']) {
    for (const ink of Object.values(TIMING[theme])) {
      if (dE(entry[theme], ink) < 15) return false;
    }
  }
  return true;
}

/**
 * **The chart-safe plotting variant of a brand colour** (§3.3 rule 6), derived rather than
 * chosen, so the same function answers for a colour the data adds tomorrow.
 *
 * Hue is the identity and is never moved. Lightness is moved the *minimum* distance needed to
 * enter the theme's plotting band and clear 3:1 against both `--surface-raised` and
 * `--surface-sunken`. Chroma is held at the brand's own value where the gamut allows it and
 * only reduced when it does not — a brand colour that gained chroma would stop being the
 * brand's colour.
 *
 * Returns `null` when the colour cannot be a plotting colour at all, which happens for exactly
 * one reason: **OkLCh chroma below 0.05**, i.e. it reads as grey. Haas `#9C9FA2` (C 0.0056) and
 * Cadillac `#AAAAAD` (C 0.0043) are both in that case, and no lightness move fixes it because
 * chroma is what is missing. Those two teams therefore keep the brand grey as their *identity*
 * swatch and plot from the fallback ramp — see §3.3a. That is not a downgrade: this product's
 * chart furniture is achromatic by design (grid `--border-subtle`, axis `--border-strong`,
 * ticks `--ink-tertiary`), so a grey series is confusable with the chart's own structure, which
 * is a worse failure than being confusable with another team.
 */
function brandChartVariant(theme, hex) {
  const o = oklch(hex);
  if (o.C < 0.05) return null;
  const S = SURF[theme];
  const [lo, hi] = PLOT_BAND[theme];
  let best = null;
  for (let L = lo; L <= hi + 1e-9; L += 0.002) {
    const { hex: cand, C } = lch2hex(L, o.C, o.h);
    if (C < 0.05) continue;
    if (contrast(cand, S.raised) < 3 || contrast(cand, S.sunken) < 3) continue;
    const move = Math.abs(L - o.L);
    if (!best || move < best.move) best = { hex: cand, C, L, move };
  }
  return best;
}

/** True when an entry is >= 15 from every derived brand plotting variant, both themes. */
function clearsBrandVariants(entry) {
  for (const theme of ['light', 'dark']) {
    for (const hex of Object.values(BRAND)) {
      const v = brandChartVariant(theme, hex);
      if (v && dE(entry[theme], v.hex) < 15) return false;
    }
  }
  return true;
}

/** True when an entry is >= 15 from every piece of achromatic chart furniture. */
function clearsFurniture(entry) {
  for (const theme of ['light', 'dark']) {
    for (const hex of Object.values(FURNITURE[theme])) {
      if (dE(entry[theme], hex) < 15) return false;
    }
  }
  return true;
}

/**
 * The search that sized the ramp. Greedy from every admissible seed, adding the hue that
 * leaves the largest minimum CVD separation, stopping when no hue keeps every floor.
 * Reported so the chosen set is reproducible rather than asserted.
 */
/**
 * The reserved **hue bands**, in OkLCh degrees: ±30 around each F1 timing ink's own hue,
 * measured — purple **305**, green **148**, yellow **92** (both themes agree to within 1°).
 *
 * This is a *semantic* exclusion and it sits on top of the metric one, not instead of it. The
 * metric test (ΔE >= 15 from the ink) asks "could these two be confused?"; the band asks the
 * different and stricter question "would a viewer call these the same colour?" — because
 * `purple = session fastest` is a convention about a **hue family**, not about one hex, and a
 * lime series line beside green personal-best chips undermines the convention even at ΔE 26.
 *
 * 60° is one colour name's worth of wheel. Both tests are applied and the ramp clears both.
 */
const RESERVED_HUE_BANDS = [
  [62, 122], // yellow  92 ± 30
  [118, 178], // green  148 ± 30
  [275, 335], // purple 305 ± 30
];
const inReservedHueBand = (h) => RESERVED_HUE_BANDS.some(([lo, hi]) => h >= lo && h <= hi);

function catSearch(cvdFloor = 8) {
  const pool = [];
  const rejected = { hueband: 0, nosolution: 0, timing: 0, furniture: 0, brand: 0 };
  for (let h = 0; h < 360; h += 6) {
    if (inReservedHueBand(h)) {
      rejected.hueband += PLOT_TIERS.light.length;
      continue;
    }
    for (let tier = 0; tier < PLOT_TIERS.light.length; tier++) {
      const e = hueEntry(h, tier);
      if (!e) {
        rejected.nosolution += 1;
        continue;
      }
      if (!clearsReserved(e)) {
        rejected.timing += 1;
        continue;
      }
      if (!clearsFurniture(e)) {
        rejected.furniture += 1;
        continue;
      }
      if (GATE_BRAND && !clearsBrandVariants(e)) {
        rejected.brand += 1;
        continue;
      }
      pool.push(e);
    }
  }
  console.log(
    `\n=== CATEGORICAL RAMP SEARCH (pairwise CVD floor ${cvdFloor}) ===\n` +
      `  pool ${pool.length} of ${60 * PLOT_TIERS.light.length} (hue, tier) candidates.  rejected: ` +
      `${rejected.hueband} reserved hue band, ${rejected.nosolution} no in-gamut/contrast solution, ` +
      `${rejected.timing} within ΔE 15 of a timing ink, ${rejected.furniture} within ΔE 15 of chart furniture, ${rejected.brand} within ΔE 15 of a brand plotting variant`,
  );

  // Precomputed pairwise matrices, so the greedy search is table lookups rather than
  // hundreds of millions of CIEDE2000 evaluations.
  const N = pool.length;
  const normal = Array.from({ length: N }, () => new Float64Array(N));
  const cvd = Array.from({ length: N }, () => new Float64Array(N));
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dn = Math.min(dE(pool[i].light, pool[j].light), dE(pool[i].dark, pool[j].dark));
      const dc = Math.min(minCVD(pool[i].light, pool[j].light), minCVD(pool[i].dark, pool[j].dark));
      normal[i][j] = normal[j][i] = dn;
      cvd[i][j] = cvd[j][i] = dc;
    }
  }

  /*
   * **This is a maximum-clique problem, and solving it as one rather than greedily matters.**
   * Build the graph whose edge (i, j) means "this pair clears both floors in both themes";
   * the largest admissible palette is then the largest clique. A greedy walk from every seed
   * returns 4 on this graph; branch-and-bound returns the true maximum, and the difference is
   * not a rounding detail — it is how many teams can be told apart by colour.
   */
  /*
   * **A third edge condition, and it is a judgement rather than a measurement: entries must be
   * at least `MIN_HUE_SEP` degrees apart in OkLCh hue.** Two entries can clear every metric
   * floor and still be "dark blue and mid blue", which a reader describes as one colour with
   * two shades — the categorical channel then carries less than the count of colours suggests.
   * 40° is a colour-family's width, and it is the same reasoning as the 60° reserved band
   * above, applied between palette members instead of against a reserved hue.
   */
  const hueGap = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };
  const adj = Array.from({ length: N }, () => new Uint8Array(N));
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const ok =
        normal[i][j] >= 15 && cvd[i][j] >= cvdFloor && hueGap(pool[i].h, pool[j].h) >= MIN_HUE_SEP
          ? 1
          : 0;
      adj[i][j] = adj[j][i] = ok;
    }
  }
  let best = [];
  let bestScore = -Infinity;
  const expand = (clique, candidates) => {
    if (clique.length + candidates.length < best.length) return;
    if (clique.length >= best.length) {
      // Among equal-sized cliques prefer the one whose worst CVD pair is best.
      let worst = Infinity;
      for (let i = 0; i < clique.length; i++)
        for (let j = i + 1; j < clique.length; j++)
          if (cvd[clique[i]][clique[j]] < worst) worst = cvd[clique[i]][clique[j]];
      const score = clique.length * 1000 + (worst === Infinity ? 0 : worst);
      if (clique.length > best.length || score > bestScore) {
        best = [...clique];
        bestScore = score;
      }
    }
    for (let k = 0; k < candidates.length; k++) {
      if (clique.length + (candidates.length - k) < best.length) return;
      const v = candidates[k];
      expand(
        [...clique, v],
        candidates.slice(k + 1).filter((u) => adj[v][u] === 1),
      );
    }
  };
  expand(
    [],
    Array.from({ length: N }, (_, i) => i),
  );
  const overall = { entries: best.map((i) => pool[i]), f: setFigures(best.map((i) => pool[i])) };
  if (best.length === 0) {
    console.log('  no admissible set found');
    return;
  }
  console.log(
    `\n  BEST: N = ${overall.entries.length}   min normal ΔE ${n(overall.f.minNormal)}   min CVD ΔE ${n(overall.f.minCvd)}  (worst pair ${overall.f.worst})`,
  );
  for (const e of [...overall.entries].sort((a, b) => a.h - b.h)) {
    console.log(
      `    h ${String(e.h).padStart(3)} tier ${e.tier}   light ${e.light} (L ${n(PLOT_TIERS.light[e.tier], 2)} C ${n(e.Cl, 3)})   dark ${e.dark} (L ${n(PLOT_TIERS.dark[e.tier], 2)} C ${n(e.Cd, 3)})`,
    );
  }
}

/* ================================================================ V-23 … V-28
 * THE SHIPPED ENTITY PALETTE. `catsearch` above is the exploration; this is the run that
 * records what ships, and it is the one wired into `npm run validate:palette`.
 *
 * The ramp is **two tiers of guarantee, not two palettes**, and the split is the whole design:
 *
 *   TIER A — the first 6 entries. Mutually normal-vision ΔE >= 15 **and** CVD ΔE >= 8 in both
 *            themes, and >= 40 deg apart in OkLCh hue. Colour alone separates these, for every
 *            viewer. 6 > the comparison cap of 4, so any admissible 4-subset is fully separated.
 *   TIER B — entries 7…12. Mutually and against tier A, normal-vision ΔE >= 15 in both themes.
 *            CVD separation is **measured and reported per pair, not gated** — the pairs that
 *            fall below 8 are precisely the pairs §6.4's differentiator ladder exists to carry.
 *
 * What tier B buys is collision *rate*, and that is a product property rather than a nicety:
 * 202 of 214 teams take their colour from this ramp, so the probability that four randomly
 * selected colourless teams all land on distinct entries is 0.278 at N = 6 and 0.573 at N = 12.
 * What tier B must never buy is a **near-miss**: two entities in one plot are either the SAME
 * entry — an exact collision, which the ladder resolves explicitly and visibly — or they are
 * >= 15 apart. Cadillac <-> Haas at 3.8 is the failure this forbids, and it is worse than either
 * of the other two cases because it reads as "probably different, possibly not".
 */

/** Hue distance on the wheel, degrees. */
const hueGap = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * The pool of admissible (hue, tier) candidates under the **per-entry** gates only.
 * Shared by the tier-A clique search and the tier-B extension so both draw from one set.
 */
function entityPool() {
  const pool = [];
  const rejected = { hueband: 0, nosolution: 0, timing: 0, furniture: 0 };
  for (let h = 0; h < 360; h += 6) {
    if (inReservedHueBand(h)) {
      rejected.hueband += PLOT_TIERS.light.length;
      continue;
    }
    for (let tier = 0; tier < PLOT_TIERS.light.length; tier++) {
      const e = hueEntry(h, tier);
      if (!e) {
        rejected.nosolution += 1;
        continue;
      }
      if (!clearsReserved(e)) {
        rejected.timing += 1;
        continue;
      }
      if (!clearsFurniture(e)) {
        rejected.furniture += 1;
        continue;
      }
      pool.push(e);
    }
  }
  return { pool, rejected };
}

/** Worse-of-both-themes normal-vision and CVD separation for two pool entries. */
const pairNormal = (a, b) => Math.min(dE(a.light, b.light), dE(a.dark, b.dark));
const pairCvd = (a, b) => Math.min(minCVD(a.light, b.light), minCVD(a.dark, b.dark));

/** Exact maximum clique by branch and bound, over a boolean adjacency matrix. */
function maxClique(N, adj, score) {
  let best = [];
  let bestScore = -Infinity;
  const expand = (clique, candidates) => {
    if (clique.length + candidates.length < best.length) return;
    if (clique.length >= best.length) {
      const s = clique.length * 1000 + score(clique);
      if (clique.length > best.length || s > bestScore) {
        best = [...clique];
        bestScore = s;
      }
    }
    for (let k = 0; k < candidates.length; k++) {
      if (clique.length + (candidates.length - k) < best.length) return;
      const v = candidates[k];
      expand(
        [...clique, v],
        candidates.slice(k + 1).filter((u) => adj[v][u] === 1),
      );
    }
  };
  expand(
    [],
    Array.from({ length: N }, (_, i) => i),
  );
  return best;
}

/**
 * **Every lightness at (hue, chroma) that is admissible as a plotting colour in this system.**
 *
 * The gate set is deliberately the *same* one every other plotting colour carries, and stating it
 * in one place is the point: a teammate shade is not a special kind of colour with relaxed rules,
 * it is an ordinary series colour that happens to share a hue with another series colour.
 *
 *   chroma  >= 0.05                          — below it, it reads as grey (§9.1 step 5)
 *   L inside the theme's plotting band       — §9.1 step 6
 *   >= 3:1 on `--surface-raised` AND `--surface-sunken`
 *   >= dE 15 from all three reserved timing inks (§3.4) — a series that reads as the
 *           personal-best green is a defect no legend fixes
 *   >= dE 15 from the achromatic chart furniture (§6.2)
 *
 * Returns the admitted shades plus a **blocking census**, because when a hue has too few
 * admissible shades the useful question is not "how many" but "what took them".
 */
function plottableShades(theme, h, C) {
  const S = SURF[theme];
  const [lo, hi] = PLOT_BAND[theme];
  const shades = [];
  const blocked = { chroma: 0, contrast: 0, timing: 0, furniture: 0 };
  let considered = 0;
  for (let L = lo; L <= hi + 1e-9; L += 0.002) {
    considered += 1;
    const { hex, C: Cg } = lch2hex(L, C, h);
    if (Cg < 0.05) {
      blocked.chroma += 1;
      continue;
    }
    if (contrast(hex, S.raised) < 3 || contrast(hex, S.sunken) < 3) {
      blocked.contrast += 1;
      continue;
    }
    if (Object.values(TIMING[theme]).some((ink) => dE(hex, ink) < 15)) {
      blocked.timing += 1;
      continue;
    }
    if (Object.values(FURNITURE[theme]).some((fx) => dE(hex, fx) < 15)) {
      blocked.furniture += 1;
      continue;
    }
    shades.push({ hex, C: Cg, L });
  }
  return { shades, blocked, considered };
}

/**
 * **The teammate shade pair** (§6.4a): two admissible plotting shades of the *same* OkLCh hue and
 * chroma, so a teammate pair reads as one colour family in two shades — which is exactly what
 * "same team, two drivers" should look like.
 *
 * **Lightness is the channel, and that is not a stylistic preference.** It is the one channel every
 * dichromat keeps in full, so a split built on it survives colour-vision deficiency where a split
 * built on hue or chroma does not. The measured consequence is visible in the run: the worst CVD
 * figure across all 22 entities is nearly twice the CVD floor.
 *
 * **The pair is symmetric — neither driver "gets the team colour".** An earlier version of this
 * function anchored one driver on the team's own plotting variant and derived the other from it,
 * and that was wrong in two separate ways. Measurably: the anchor sits mid-band for several
 * entities, so the reach to the far end fell short of the ΔE floor even though the band's own
 * extremes clear it by 10 points — Williams light reached 14.70 against a span ceiling of 27.07,
 * and ramp #9 light reached 13.63 against 28.62. Editorially: painting one driver in the true team
 * colour and the other in a derivative implies a number-one/number-two hierarchy the data does not
 * support. Placing both on the pair fixes both faults at once.
 *
 * Returns `null` when fewer than two admissible shades exist — a real case, see the Sauber record
 * in V-27 — never a near-miss dressed as a pass.
 */
function shadePair(theme, h, C) {
  const { shades, blocked, considered } = plottableShades(theme, h, C);
  if (shades.length < 2) return { pair: null, shades, blocked, considered };
  let best = null;
  for (let i = 0; i < shades.length; i++) {
    for (let j = i + 1; j < shades.length; j++) {
      const dn = dE(shades[i].hex, shades[j].hex);
      // The margin is scored against BOTH floors at once, normalised, and the weaker of the two
      // is what is maximised — so the search cannot buy a comfortable normal-vision figure with
      // a CVD figure that scrapes the floor.
      //
      // The skip is only safe once a *passing* pair is in hand (m >= 1): below the normal floor a
      // pair's margin is capped at dn/15 < 1, so it cannot beat one. Skipping unconditionally
      // would corrupt the failing case, which is precisely the case whose figure must be honest.
      if (best && best.m >= 1 && dn < 15) continue;
      const dc = minCVD(shades[i].hex, shades[j].hex);
      const m = Math.min(dn / 15, dc / 8);
      if (!best || m > best.m) best = { m, dn, dc, deep: shades[i], bright: shades[j] };
    }
  }
  return { pair: best, shades, blocked, considered };
}

/**
 * The same search with the timing gate lifted. Its only job is **attribution**: when a hue has no
 * admissible pair, this says whether the reserved timing convention is what removed it — a
 * constraint the product did not choose and cannot move — or whether the cause is something in
 * this design system's own gift, which would be a finding rather than a fact of the sport.
 */
function shadePairIgnoringTiming(theme, h, C) {
  const S = SURF[theme];
  const [lo, hi] = PLOT_BAND[theme];
  const shades = [];
  for (let L = lo; L <= hi + 1e-9; L += 0.002) {
    const { hex, C: Cg } = lch2hex(L, C, h);
    if (Cg < 0.05) continue;
    if (contrast(hex, S.raised) < 3 || contrast(hex, S.sunken) < 3) continue;
    shades.push(hex);
  }
  let best = null;
  for (let i = 0; i < shades.length; i++)
    for (let j = i + 1; j < shades.length; j++) {
      const dn = dE(shades[i], shades[j]);
      if (!best || dn > best.dn) best = { dn, dc: minCVD(shades[i], shades[j]) };
    }
  return best;
}

function catramp() {
  PLOT_TIERS = TIER_SETS[6];
  MIN_HUE_SEP = 40;
  let failures = 0;
  const V = (cond) => {
    if (!cond) failures += 1;
    return cond ? 'PASS' : 'FAIL';
  };

  const { pool, rejected } = entityPool();
  console.log(
    '\n=== V-23  ENTITY RAMP SEARCH — the pool under the per-entry gates ===\n' +
      `  ${pool.length} admissible of ${60 * PLOT_TIERS.light.length} (hue, tier) candidates at 6 deg x 6 tiers.\n` +
      `  rejected: ${rejected.hueband} inside a reserved timing hue band (yellow 92+-30, green 148+-30, purple 305+-30),\n` +
      `            ${rejected.nosolution} with no in-gamut solution clearing C >= 0.05 and 3:1 on raised AND sunken,\n` +
      `            ${rejected.timing} within normal-vision dE 15 of a timing ink,\n` +
      `            ${rejected.furniture} within normal-vision dE 15 of achromatic chart furniture.`,
  );

  /* ---- tier A: the CVD-hard clique ---- */
  const N = pool.length;
  const adjA = Array.from({ length: N }, () => new Uint8Array(N));
  const cvdM = Array.from({ length: N }, () => new Float64Array(N));
  const nrmM = Array.from({ length: N }, () => new Float64Array(N));
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dn = pairNormal(pool[i], pool[j]);
      const dc = pairCvd(pool[i], pool[j]);
      nrmM[i][j] = nrmM[j][i] = dn;
      cvdM[i][j] = cvdM[j][i] = dc;
      adjA[i][j] = adjA[j][i] =
        dn >= 15 && dc >= 8 && hueGap(pool[i].h, pool[j].h) >= MIN_HUE_SEP ? 1 : 0;
    }
  }
  const tierA = maxClique(N, adjA, (cl) => {
    let worst = Infinity;
    for (let i = 0; i < cl.length; i++)
      for (let j = i + 1; j < cl.length; j++)
        if (cvdM[cl[i]][cl[j]] < worst) worst = cvdM[cl[i]][cl[j]];
    return worst === Infinity ? 0 : worst;
  });

  /* ---- tier B: extend to 12 on the normal-vision floor alone ---- */
  const chosen = [...tierA];
  const TARGET = 12;
  while (chosen.length < TARGET) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let c = 0; c < N; c++) {
      if (chosen.includes(c)) continue;
      let minN = Infinity;
      let minC = Infinity;
      let minHue = Infinity;
      for (const s of chosen) {
        if (nrmM[c][s] < minN) minN = nrmM[c][s];
        if (cvdM[c][s] < minC) minC = cvdM[c][s];
        const g = hueGap(pool[c].h, pool[s].h);
        if (g < minHue) minHue = g;
      }
      if (minN < 15) continue;
      // Prefer the candidate that keeps CVD separation highest, then hue spread, then
      // normal-vision separation. Deterministic: ties break on pool order.
      const score = minC * 1000 + minHue * 10 + minN;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = c;
      }
    }
    if (bestIdx === -1) break;
    chosen.push(bestIdx);
  }

  const entries = chosen.map((i) => pool[i]);
  console.log(
    `\n  TIER A (colour alone separates, every viewer): N = ${tierA.length}` +
      `   TIER B extension: +${entries.length - tierA.length}   TOTAL N = ${entries.length}`,
  );
  console.log(
    '\n  #   tier  hue   LIGHT     L     C      c/raised c/sunken   DARK      L     C      c/raised c/sunken',
  );
  entries.forEach((e, i) => {
    const ol = oklch(e.light);
    const od = oklch(e.dark);
    const guard =
      V(ol.C >= 0.05 && od.C >= 0.05) === 'PASS' &&
      contrast(e.light, SURF.light.raised) >= 3 &&
      contrast(e.light, SURF.light.sunken) >= 3 &&
      contrast(e.dark, SURF.dark.raised) >= 3 &&
      contrast(e.dark, SURF.dark.sunken) >= 3;
    V(guard);
    console.log(
      `  ${String(i + 1).padStart(2)}  ${i < tierA.length ? 'A' : 'B'}     ${String(e.h).padStart(3)}   ` +
        `${e.light}  ${n(ol.L, 3)} ${n(ol.C, 3)}  ${n(contrast(e.light, SURF.light.raised)).padStart(6)}  ${n(contrast(e.light, SURF.light.sunken)).padStart(6)}   ` +
        `${e.dark}  ${n(od.L, 3)} ${n(od.C, 3)}  ${n(contrast(e.dark, SURF.dark.raised)).padStart(6)}  ${n(contrast(e.dark, SURF.dark.sunken)).padStart(6)}`,
    );
  });

  /* ---- V-24: pairwise ---- */
  console.log(
    '\n=== V-24  PAIRWISE SEPARATION inside the ramp (worse of the two themes, worse of the two CVD models) ===',
  );
  let minNA = Infinity;
  let minCA = Infinity;
  let minNAll = Infinity;
  let minCAll = Infinity;
  const ladderPairs = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const dn = pairNormal(entries[i], entries[j]);
      const dc = pairCvd(entries[i], entries[j]);
      if (dn < minNAll) minNAll = dn;
      if (dc < minCAll) minCAll = dc;
      if (i < tierA.length && j < tierA.length) {
        if (dn < minNA) minNA = dn;
        if (dc < minCA) minCA = dc;
      }
      if (dc < 8) ladderPairs.push([i + 1, j + 1, dn, dc]);
    }
  }
  console.log(
    `  TIER A only  — min normal dE ${n(minNA)} (floor 15) ${V(minNA >= 15)}   min CVD dE ${n(minCA)} (floor 8) ${V(minCA >= 8)}`,
  );
  console.log(
    `  ALL ${entries.length}       — min normal dE ${n(minNAll)} (floor 15) ${V(minNAll >= 15)}   min CVD dE ${n(minCAll)} (REPORTED, ladder-carried)`,
  );
  console.log(
    `  pairs below CVD 8, i.e. the ladder's remit: ${ladderPairs.length} of ${(entries.length * (entries.length - 1)) / 2}`,
  );
  for (const [a, b, dn, dc] of ladderPairs)
    console.log(`    #${a} <-> #${b}   normal ${n(dn).padStart(6)}   CVD ${n(dc).padStart(5)}`);

  /* ---- V-25: against the reserved sets and the furniture ---- */
  console.log('\n=== V-25  RAMP vs THE RESERVED SETS AND THE CHART FURNITURE ===');
  for (const [label, set, floor, gated] of [
    ['timing ink (§3.4)', TIMING, 15, true],
    ['status ink (§3.4.3)', STATUS, 15, false],
  ]) {
    let worst = Infinity;
    let worstWhat = '';
    let worstCvd = Infinity;
    for (const theme of ['light', 'dark'])
      for (const [nm, ink] of Object.entries(set[theme]))
        entries.forEach((e, i) => {
          const d = dE(e[theme], ink);
          const c = minCVD(e[theme], ink);
          if (d < worst) {
            worst = d;
            worstWhat = `#${i + 1} <-> ${theme} ${nm}`;
          }
          if (c < worstCvd) worstCvd = c;
        });
    console.log(
      `  vs ${label.padEnd(22)} min normal dE ${n(worst).padStart(6)} (floor ${floor}) ${gated ? V(worst >= floor) : 'REPORTED'}   worst pair ${worstWhat}   min CVD dE ${n(worstCvd)} (reported)`,
    );
  }
  {
    let worst = Infinity;
    let worstWhat = '';
    for (const theme of ['light', 'dark'])
      for (const [nm, hex] of Object.entries(FURNITURE[theme]))
        entries.forEach((e, i) => {
          const d = dE(e[theme], hex);
          if (d < worst) {
            worst = d;
            worstWhat = `#${i + 1} <-> ${theme} ${nm}`;
          }
        });
    console.log(
      `  vs ${'chart furniture (§6.2)'.padEnd(22)} min normal dE ${n(worst).padStart(6)} (floor 15) ${V(worst >= 15)}   worst pair ${worstWhat}`,
    );
  }

  /* ---- V-26: brand plotting variants, and why the ramp is NOT gated against them ---- */
  console.log(
    '\n=== V-26  BRAND CHART VARIANTS (§3.3 rule 6) — hue held, lightness moved the minimum distance into band ===',
  );
  const variants = {};
  for (const [team, hex] of Object.entries(BRAND)) {
    const o = oklch(hex);
    if (o.C < 0.05) {
      console.log(
        `  ${team.padEnd(13)} ${hex}  OkLCh C ${n(o.C, 4)}  -> NO PLOTTING VARIANT: below the 0.05 chroma floor, it reads as grey. Plots from the ramp; keeps the brand grey as its identity swatch.`,
      );
      continue;
    }
    const l = brandChartVariant('light', hex);
    const d = brandChartVariant('dark', hex);
    if (!l || !d) {
      console.log(`  ${team.padEnd(13)} ${hex}  -> no in-band solution in one theme`);
      continue;
    }
    variants[team] = { light: l.hex, dark: d.hex, h: o.h };
    V(contrast(l.hex, SURF.light.raised) >= 3 && contrast(l.hex, SURF.light.sunken) >= 3);
    V(contrast(d.hex, SURF.dark.raised) >= 3 && contrast(d.hex, SURF.dark.sunken) >= 3);
    console.log(
      `  ${team.padEnd(13)} ${hex}  h ${n(o.h, 0).padStart(3)}  light ${l.hex} (L ${n(o.L, 3)}->${n(l.L, 3)}, dL ${n(l.move, 3)}, c ${n(contrast(l.hex, SURF.light.raised))}/${n(contrast(l.hex, SURF.light.sunken))})  ` +
        `dark ${d.hex} (L ${n(o.L, 3)}->${n(d.L, 3)}, dL ${n(d.move, 3)}, c ${n(contrast(d.hex, SURF.dark.raised))}/${n(contrast(d.hex, SURF.dark.sunken))})`,
    );
  }
  {
    // The impossibility record: the brand set does not clear dE 15 against ITSELF, so it cannot
    // be imposed as a floor on the ramp. Same argument shape as §3.4.2 and §3.4.3.
    const names = Object.keys(variants);
    let worst = Infinity;
    let worstWhat = '';
    let under = 0;
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) {
        const dn = Math.min(
          dE(variants[names[i]].light, variants[names[j]].light),
          dE(variants[names[i]].dark, variants[names[j]].dark),
        );
        if (dn < 15) under += 1;
        if (dn < worst) {
          worst = dn;
          worstWhat = `${names[i]} <-> ${names[j]}`;
        }
      }
    console.log(
      `\n  INTERNAL separation of the ${names.length} brand plotting variants: min normal dE ${n(worst)} (${worstWhat}); ` +
        `${under} of ${(names.length * (names.length - 1)) / 2} pairs below 15.\n` +
        '  THEREFORE the ramp is deliberately NOT gated against the brand variants: a floor the brand set\n' +
        '  cannot meet against itself cannot be imposed on everything that must coexist with it. Gating it\n' +
        '  was measured and costs the ramp two thirds of its size (N = 6 -> N = 3 at the same floors, and\n' +
        '  N = 3 is below the comparison cap of 4). Cross-source collisions are carried by the runtime\n' +
        '  ladder (§6.4), which is the same posture §3.4.2 takes for the timing hues.',
    );
    let cross = Infinity;
    let crossWhat = '';
    for (const [team, v] of Object.entries(variants))
      entries.forEach((e, i) => {
        const dn = Math.min(dE(e.light, v.light), dE(e.dark, v.dark));
        if (dn < cross) {
          cross = dn;
          crossWhat = `ramp #${i + 1} <-> ${team}`;
        }
      });
    console.log(
      `  Cross-source worst case, ramp vs brand variant: normal dE ${n(cross)} (${crossWhat}) — REPORTED, ladder-carried.`,
    );
  }

  /* ---- V-27: the teammate shade pair ---- */
  console.log(
    '\n=== V-27  TEAMMATE SHADE PAIR (§6.4a) — two admissible shades of one hue, and the one case\n' +
      '           where colour provably cannot separate two teammates at all ===',
  );

  /**
   * Every entity that can be plotted, with the chroma policy each one plots under.
   *
   * A branded team holds its **brand chroma**: chroma is part of the identity, and a Ferrari that
   * gained saturation would stop being Ferrari's colour. A ramp entry requests 0.4 and takes the
   * maximum the gamut allows at that lightness — the same policy `plotAt` used to build it, so the
   * pair and the entry are made of the same material.
   */
  const plotEntities = [];
  for (const [team, hex] of Object.entries(BRAND)) {
    const o = oklch(hex);
    if (o.C < 0.05) continue; // achromatic: plots from the ramp, so it splits from the ramp
    plotEntities.push({ name: team, kind: 'brand', h: o.h, C: o.C });
  }
  entries.forEach((e, i) =>
    plotEntities.push({ name: `ramp#${i + 1}`, kind: 'ramp', h: e.h, C: 0.4 }),
  );

  const paired = [];
  const unavailable = [];
  for (const ent of plotEntities) {
    const row = [];
    for (const theme of ['light', 'dark']) {
      const r = shadePair(theme, ent.h, ent.C);
      if (!r.pair) {
        unavailable.push({ ...ent, theme, ...r });
        row.push(`${theme} NO PAIR (${r.shades.length} admissible shade(s))`);
        continue;
      }
      paired.push({ ...ent, theme, ...r.pair });
      row.push(
        `${theme} ${r.pair.deep.hex}/${r.pair.bright.hex} n ${n(r.pair.dn).padStart(6)} c ${n(r.pair.dc).padStart(6)} ${r.pair.dn >= 15 && r.pair.dc >= 8 ? 'OK  ' : 'FAIL'}`,
      );
    }
    console.log(`  ${ent.name.padEnd(13)} h ${n(ent.h, 0).padStart(3)}  ${row.join('   ')}`);
  }
  for (const [team, hex] of Object.entries(BRAND)) {
    if (oklch(hex).C >= 0.05) continue;
    console.log(
      `  ${team.padEnd(13)} ${hex} achromatic — plots from the ramp (§3.3a), so it splits from the ramp.`,
    );
  }

  /* G-27a — the gate that the previous construction failed. */
  {
    let wn = Infinity;
    let wc = Infinity;
    let wnw = '';
    let wcw = '';
    for (const p of paired) {
      if (p.dn < wn) {
        wn = p.dn;
        wnw = `${p.name} ${p.theme}`;
      }
      if (p.dc < wc) {
        wc = p.dc;
        wcw = `${p.name} ${p.theme}`;
      }
    }
    console.log(
      `\n  G-27a  wherever two admissible shades exist, the CHOSEN pair clears both floors.\n` +
        `         ${paired.length} pairs. worst normal dE ${n(wn)} (${wnw}, floor 15) ${V(wn >= 15)}` +
        `   worst CVD dE ${n(wc)} (${wcw}, floor 8) ${V(wc >= 8)}`,
    );
  }

  /* G-27b — the ramp is ours to choose, so every entry must be splittable in both themes. */
  {
    const rampPaired = paired.filter((p) => p.kind === 'ramp');
    const rampUnavail = unavailable.filter((p) => p.kind === 'ramp');
    console.log(
      `  G-27b  every ramp entry is shade-pair-available in BOTH themes: ${rampPaired.length} of ${entries.length * 2} ` +
        `theme-slots paired, ${rampUnavail.length} unavailable ${V(rampUnavail.length === 0)}\n` +
        `         This one is gated rather than reported because the ramp's hues are this design's own\n` +
        `         choice: 41 of the 60 hues on the wheel are splittable, so shipping an entry that\n` +
        `         cannot split would be a self-inflicted limitation, not a fact of the sport.`,
    );
  }

  /* G-27c — construction claims rot; assert the shades independently. */
  {
    let worstC = Infinity;
    let worstCtr = Infinity;
    let worstTim = Infinity;
    let worstFurn = Infinity;
    let worstTimW = '';
    let worstStatus = Infinity;
    let worstStatusW = '';
    for (const p of paired) {
      for (const s of [p.deep, p.bright]) {
        worstC = Math.min(worstC, oklch(s.hex).C);
        for (const surf of ['raised', 'sunken'])
          worstCtr = Math.min(worstCtr, contrast(s.hex, SURF[p.theme][surf]));
        for (const [nm, ink] of Object.entries(TIMING[p.theme])) {
          const d = dE(s.hex, ink);
          if (d < worstTim) {
            worstTim = d;
            worstTimW = `${p.name} ${p.theme} ${s.hex} <-> ${nm}`;
          }
        }
        for (const fx of Object.values(FURNITURE[p.theme]))
          worstFurn = Math.min(worstFurn, dE(s.hex, fx));
        for (const [nm, ink] of Object.entries(STATUS[p.theme])) {
          const d = dE(s.hex, ink);
          if (d < worstStatus) {
            worstStatus = d;
            worstStatusW = `${p.name} ${p.theme} ${s.hex} <-> ${nm}`;
          }
        }
      }
    }
    console.log(
      `  G-27c  every shade in every pair independently clears the full plotting gate set:\n` +
        `         chroma ${n(worstC, 3)} (floor 0.05) ${V(worstC >= 0.05)}` +
        `   contrast ${n(worstCtr)}:1 (floor 3) ${V(worstCtr >= 3)}\n` +
        `         vs timing ink dE ${n(worstTim)} (floor 15) ${V(worstTim >= 15)}  worst ${worstTimW}\n` +
        `         vs chart furniture dE ${n(worstFurn)} (floor 15) ${V(worstFurn >= 15)}\n` +
        `         vs status ink dE ${n(worstStatus)} REPORTED (§3.4.3 posture: a status colour never\n` +
        `         appears without an icon and a label, so it is not a floor a series is held to)  worst ${worstStatusW}`,
    );
  }

  /* G-27d — attribution. An impossibility is only acceptable if we did not cause it. */
  {
    console.log(
      `\n  G-27d  ATTRIBUTION — ${unavailable.length} entity/theme slot(s) have no admissible shade pair.\n` +
        `         Gated: each one must be caused by the reserved timing convention, which F1 fixed and this\n` +
        `         product cannot move. A slot that lost its pair to a contrast, gamut or chroma limit would\n` +
        `         be OUR defect and must fail here rather than be absorbed into a footnote.`,
    );
    let attributed = 0;
    for (const u of unavailable) {
      const nt = shadePairIgnoringTiming(u.theme, u.h, u.C);
      const causedByTiming = nt !== null && nt.dn >= 15 && nt.dc >= 8;
      if (causedByTiming) attributed += 1;
      console.log(
        `         ${u.name} ${u.theme}: ${u.shades.length} admissible shade(s)` +
          `${u.shades.length ? ` (${u.shades.map((s) => s.hex).join(', ')})` : ''}.\n` +
          `           of ${u.considered} candidate lightnesses — ${u.blocked.timing} blocked by a timing ink, ` +
          `${u.blocked.contrast} by contrast, ${u.blocked.chroma} by the chroma floor, ${u.blocked.furniture} by furniture.\n` +
          `           with the timing gate lifted the pair reaches normal dE ${nt ? n(nt.dn) : 'n/a'} / CVD dE ${nt ? n(nt.dc) : 'n/a'}` +
          ` -> caused by the timing convention: ${causedByTiming ? 'YES' : 'NO'}`,
      );
    }
    console.log(
      `         ${attributed} of ${unavailable.length} attributable to the reserved timing hues ${V(attributed === unavailable.length)}`,
    );
    console.log(
      `\n         WHAT THIS MEANS FOR THE DESIGN, and it is the whole reason V-27 exists:\n` +
        `         because at least one real team on the current grid provably cannot be split by colour,\n` +
        `         colour is NOT the teammate channel. §6.4a therefore makes marker shape, dash and the\n` +
        `         direct label MANDATORY for every teammate pair — always, not as a fallback — and the\n` +
        `         shade pair is the redundant fourth channel that most teams also get. Presenting one\n` +
        `         team differently from the rest because its hue is unlucky would make the reader learn\n` +
        `         two conventions; making the non-colour channels universal makes the unlucky team\n` +
        `         indistinguishable in TREATMENT from every other, which is the point.`,
    );
  }

  /* ---- V-28: identity swatches on identity surfaces ---- */
  console.log(
    '\n=== V-28  IDENTITY SWATCH — every ramp entry as a 10x10 chip and a 3px accent bar (§3.3, floor 3:1) ===',
  );
  {
    let worst = Infinity;
    let worstWhat = '';
    for (const theme of ['light', 'dark'])
      entries.forEach((e, i) => {
        for (const surf of ['raised', 'canvas', 'sunken']) {
          const c = contrast(e[theme], SURF[theme][surf]);
          if (c < worst) {
            worst = c;
            worstWhat = `#${i + 1} on ${theme} ${surf}`;
          }
        }
      });
    console.log(
      `  worst ramp entry vs any surface: ${n(worst)}:1 (${worstWhat}) — floor 3.0 ${V(worst >= 3)}\n` +
        '  Unlike the 12 brand colours, of which 6 fail this in light mode (§9.2 V-8), every ramp entry\n' +
        '  clears 3:1 on all three surfaces in both themes — so a colourless team needs no identity-form\n' +
        '  workaround at all, and that is a strictly better position than the branded teams are in.',
    );
  }

  console.log(
    failures === 0
      ? '\nPASS — every gated floor cleared, both themes. Reported-only figures listed above.\n'
      : `\nFAIL — ${failures} gated check(s) failed.\n`,
  );
  if (failures > 0) process.exitCode = 1;
  return entries;
}

/* ================================================================ main */
if (mode === 'calibrate' || mode === 'all') calibration();
if (mode === 'mono' || mode === 'all') mono();
if (mode === 'catramp' || mode === 'all') catramp();
if (mode === 'catsearch') {
  PLOT_TIERS = TIER_SETS[Number(args[2] ?? 3)] ?? TIER_SETS[3];
  MIN_HUE_SEP = Number(args[3] ?? 40);
  GATE_BRAND = args.includes('--brand');
  catSearch(Number(args[1] ?? 8));
}
if (mode === 'scan') hueScan(args[1] ?? 'light');
if (mode === 'ramp') ramp(args[1] ?? 0);
if (mode === 'check') check(args[1]);

/* ================================================================ STEPS */
function steps(hue) {
  const H = Number(hue);
  const Ls = [0.97, 0.94, 0.88, 0.8, 0.72, 0.658, 0.568, 0.47, 0.36, 0.26, 0.18];
  const names = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '850', '900'];
  console.log(`\n=== SIGNAL RAMP, OkLCh hue ${H} ===`);
  console.log(
    'step  hex       L      C      | LIGHT raised/canvas/sunken | DARK raised/canvas/sunken | vs #FFF | vs #1B1E24 | vs #0E0F13',
  );
  const out = {};
  Ls.forEach((L, i) => {
    const { hex, C } = lch2hex(L, 0.4, H);
    out[names[i]] = hex;
    const lp = [SURF.light.raised, SURF.light.canvas, SURF.light.sunken]
      .map((s) => n(contrast(hex, s)))
      .join('/');
    const dp = [SURF.dark.raised, SURF.dark.canvas, SURF.dark.sunken]
      .map((s) => n(contrast(hex, s)))
      .join('/');
    console.log(
      `${names[i].padEnd(5)} ${hex}  ${n(L, 3)}  ${n(C, 3)}  | ${lp.padEnd(26)} | ${dp.padEnd(25)} | ${n(contrast(hex, '#FFFFFF')).padStart(5)}   | ${n(contrast(hex, '#1B1E24')).padStart(5)}      | ${n(contrast(hex, '#0E0F13')).padStart(5)}`,
    );
  });
  console.log('\nCVD audit for the two load-bearing steps vs reds (the plausible confusion):');
  for (const step of ['500', '600']) {
    for (const [nm, hx] of [
      ['ferrari', BRAND.ferrari],
      ['audi', BRAND.audi],
      ['critical-light', STATUS.light.critical],
      ['critical-dark', STATUS.dark.critical],
    ]) {
      console.log(
        `  signal-${step} <-> ${nm.padEnd(14)} normal ${n(dE(out[step], hx)).padStart(6)}  protan ${n(cvdDE(out[step], hx, 'protan').worse).padStart(5)}  deutan ${n(cvdDE(out[step], hx, 'deutan').worse).padStart(5)}  tritan ${n(cvdDE(out[step], hx, 'tritan').worse).padStart(5)}`,
      );
    }
  }
  console.log(
    '\nnormal-vision separation of signal-500/600 from every reserved semantic (floor 15):',
  );
  for (const theme of ['light', 'dark']) {
    for (const [nm, hx] of [
      ...Object.entries(TIMING[theme]).map(([k, v]) => [`timing-${k}`, v]),
      ...Object.entries(STATUS[theme]).map(([k, v]) => [`status-${k}`, v]),
    ]) {
      console.log(
        `  ${theme} ${nm.padEnd(18)} vs 500 ${n(dE(out['500'], hx)).padStart(6)}   vs 600 ${n(dE(out['600'], hx)).padStart(6)}`,
      );
    }
  }
  console.log(
    '\nlightness band check (plot marks: light 0.40-0.72, dark 0.55-0.88), chroma floor 0.05:',
  );
  for (const s of ['400', '500', '600']) {
    const o = oklch(out[s]);
    console.log(`  signal-${s} L ${n(o.L, 3)} C ${n(o.C, 3)} h ${n(o.h, 1)}`);
  }
}
if (mode === 'steps') steps(args[1] ?? 350);

/* ================================================================ PAIRS */
function pairs() {
  const P = [
    ['LIGHT  accent-ink #D1018A on surface-raised', '#D1018A', '#FFFFFF', 4.5],
    ['LIGHT  accent-ink #D1018A on surface-canvas', '#D1018A', '#F7F8FB', 4.5],
    ['LIGHT  accent-ink #D1018A on surface-sunken', '#D1018A', '#EFF1F5', 4.5],
    ['LIGHT  accent-ink #D1018A on accent-wash #FFE2EE', '#D1018A', '#FFE2EE', 4.5],
    ['LIGHT  accent-ink #D1018A on accent-wash #FEF1F7', '#D1018A', '#FEF1F7', 4.5],
    ['LIGHT  accent-on #FFFFFF on accent-fill #D1018A', '#FFFFFF', '#D1018A', 4.5],
    ['LIGHT  accent-on #FFFFFF on accent-fill-hov #A2006A', '#FFFFFF', '#A2006A', 4.5],
    ['LIGHT  accent-mark #FE02A9 on surface-raised', '#FE02A9', '#FFFFFF', 3.0],
    ['LIGHT  accent-mark #FE02A9 on surface-sunken', '#FE02A9', '#EFF1F5', 3.0],
    ['LIGHT  accent-wash #FFE2EE vs surface-raised (visible field)', '#FFE2EE', '#FFFFFF', 1.06],
    ['LIGHT  ink-primary #1B1E24 on accent-wash #FFE2EE', '#1B1E24', '#FFE2EE', 4.5],
    ['DARK   accent-ink #FE02A9 on surface-raised', '#FE02A9', '#1A1C20', 4.5],
    ['DARK   accent-ink #FE02A9 on surface-canvas', '#FE02A9', '#0E0F13', 4.5],
    ['DARK   accent-ink #FE02A9 on surface-sunken', '#FE02A9', '#08090C', 4.5],
    ['DARK   accent-on #0E0F13 on accent-fill #FE02A9', '#0E0F13', '#FE02A9', 4.5],
    ['DARK   accent-on #0E0F13 on accent-fill-hov #FF61B7', '#0E0F13', '#FF61B7', 4.5],
    ['DARK   accent-mark #FE02A9 on surface-raised', '#FE02A9', '#1A1C20', 3.0],
    ['DARK   wash-ink #FF98CA on accent-wash #46002B', '#FF98CA', '#46002B', 4.5],
    ['DARK   wash-ink #FF61B7 on accent-wash #46002B', '#FF61B7', '#46002B', 4.5],
    ['DARK   accent-ink #FE02A9 on accent-wash #46002B', '#FE02A9', '#46002B', 4.5],
    ['DARK   accent-ink #FE02A9 on accent-wash #370021', '#FE02A9', '#370021', 4.5],
    ['DARK   accent-wash #46002B vs surface-raised (visible field)', '#46002B', '#1A1C20', 1.1],
    ['DARK   accent-wash #370021 vs surface-raised (visible field)', '#370021', '#1A1C20', 1.1],
    ['DARK   ink-primary #F5F7F9 on accent-wash #46002B', '#F5F7F9', '#46002B', 4.5],
    ['LIGHT  focus ring ink-primary #1B1E24 vs accent-fill #D1018A', '#1B1E24', '#D1018A', 3.0],
    ['DARK   focus ring ink-primary #F5F7F9 vs accent-fill #FE02A9', '#F5F7F9', '#FE02A9', 3.0],
    ['LIGHT  grid line vs canvas (decorative, no floor)', '#1B1E24', '#F7F8FB', 0],
  ];
  console.log('\n=== TOKEN PAIR AUDIT ===');
  for (const [label, a, b, floor] of P) {
    const c = contrast(a, b);
    const verdict = floor === 0 ? '     ' : c >= floor ? 'PASS ' : 'FAIL ';
    console.log(`${verdict} ${n(c).padStart(6)}:1  (floor ${floor})  ${label}`);
  }
  console.log('\nOkLCh of every ramp step actually shipped:');
  for (const h of [
    '#FEF1F7',
    '#FFE2EE',
    '#FFC4DE',
    '#FF98CA',
    '#FF61B7',
    '#FE02A9',
    '#D1018A',
    '#A2006A',
    '#700148',
    '#46002B',
    '#370021',
    '#270016',
  ]) {
    const o = oklch(h);
    console.log(`  ${h}  L ${n(o.L, 3)}  C ${n(o.C, 3)}  h ${n(o.h, 1)}`);
  }
}
if (mode === 'pairs') pairs();

function fix() {
  console.log('\n=== WASH RESOLUTION ===');
  console.log('candidate dark washes at hue 350:');
  for (const L of [0.28, 0.3, 0.32, 0.34, 0.36]) {
    const { hex, C } = lch2hex(L, 0.4, 350);
    console.log(
      `  L ${n(L, 2)} ${hex} C ${n(C, 3)}  vs raised#1A1C20 ${n(contrast(hex, '#1A1C20'))}:1  vs canvas#0E0F13 ${n(contrast(hex, '#0E0F13'))}:1` +
        `  | ink #FF98CA ${n(contrast('#FF98CA', hex))}:1  ink #FF61B7 ${n(contrast('#FF61B7', hex))}:1  ink #FFC4DE ${n(contrast('#FFC4DE', hex))}:1  ink-primary#F5F7F9 ${n(contrast('#F5F7F9', hex))}:1`,
    );
  }
  console.log('\nprecedent — existing dark timing washes vs surface-raised:');
  for (const [k, v] of Object.entries(TIMING_WASH.dark))
    console.log(
      `  ${k.padEnd(7)} ${v}  vs raised ${n(contrast(v, '#1A1C20'))}:1   ink ${TIMING.dark[k]} on it ${n(contrast(TIMING.dark[k], v))}:1`,
    );
  console.log('\nprecedent — existing light timing washes vs surface-raised:');
  for (const [k, v] of Object.entries(TIMING_WASH.light))
    console.log(
      `  ${k.padEnd(7)} ${v}  vs raised ${n(contrast(v, '#FFFFFF'))}:1   ink ${TIMING.light[k]} on it ${n(contrast(TIMING.light[k], v))}:1`,
    );
  console.log('\nlight wash resolution: accent-wash #FFE2EE with wash-ink candidates');
  for (const ink of ['#D1018A', '#A2006A', '#700148'])
    console.log(`  ${ink} on #FFE2EE = ${n(contrast(ink, '#FFE2EE'))}:1`);
  console.log('\nborder token: is signal-500 usable as an interactive boundary (floor 3.0)?');
  for (const s of ['#FE02A9', '#D1018A'])
    console.log(
      `  ${s}: light vs raised ${n(contrast(s, '#FFFFFF'))} canvas ${n(contrast(s, '#F7F8FB'))} sunken ${n(contrast(s, '#EFF1F5'))} | dark vs raised ${n(contrast(s, '#1A1C20'))} canvas ${n(contrast(s, '#0E0F13'))} sunken ${n(contrast(s, '#08090C'))}`,
    );
}
if (mode === 'fix') fix();

function composite() {
  const over = (fg, bg, a) => {
    const F = hex2rgb(fg),
      B = hex2rgb(bg);
    return rgb2hex([0, 1, 2].map((i) => a * F[i] + (1 - a) * B[i]));
  };
  console.log('\n=== V-12  GLASS HEADER COMPOSITE (worst case over the animated background) ===');
  // light: canvas -> +accent orb 0.10 -> +grain 0.02 dark -> glass 0.72 white
  let l1 = over('#FE02A9', '#F7F8FB', 0.1);
  let l2 = over('#1B1E24', l1, 0.02);
  let lGlass = over('#FFFFFF', l2, 0.72);
  console.log(`light: canvas #F7F8FB -> orb ${l1} -> grain ${l2} -> glass ${lGlass}`);
  console.log(
    `       ink-primary #1B1E24 on ${lGlass} = ${n(contrast('#1B1E24', lGlass))}:1   ink-tertiary #6A6D74 = ${n(contrast('#6A6D74', lGlass))}:1   accent-ink #D1018A = ${n(contrast('#D1018A', lGlass))}:1`,
  );
  let d1 = over('#FE02A9', '#0E0F13', 0.17);
  let d2 = over('#F5F7F9', d1, 0.038);
  let dGlass = over('#1A1C20', d2, 0.68);
  console.log(`dark : canvas #0E0F13 -> orb ${d1} -> grain ${d2} -> glass ${dGlass}`);
  console.log(
    `       ink-primary #F5F7F9 on ${dGlass} = ${n(contrast('#F5F7F9', dGlass))}:1   ink-tertiary #86898F = ${n(contrast('#86898F', dGlass))}:1   accent-ink #FE02A9 = ${n(contrast('#FE02A9', dGlass))}:1`,
  );

  console.log('\n=== V-13  HERO TEXT OVER THE BACKGROUND FIELD (worst case) ===');
  console.log(
    `light: ink-primary on ${l2} = ${n(contrast('#1B1E24', l2))}:1   ink-secondary #53575E = ${n(contrast('#53575E', l2))}:1   accent-ink #D1018A = ${n(contrast('#D1018A', l2))}:1   accent-mark #FE02A9 = ${n(contrast('#FE02A9', l2))}:1`,
  );
  console.log(
    `dark : ink-primary on ${d2} = ${n(contrast('#F5F7F9', d2))}:1   ink-secondary #B3B6BA = ${n(contrast('#B3B6BA', d2))}:1   accent-ink #FE02A9 = ${n(contrast('#FE02A9', d2))}:1`,
  );
  console.log(
    '\n=== V-14  GRID LINE / HAIRLINE visibility (decorative, no floor — recorded for the record) ===',
  );
  console.log(
    `light grid rgb(27 30 36 / 0.05) over canvas = ${over('#1B1E24', '#F7F8FB', 0.05)}  ratio ${n(contrast(over('#1B1E24', '#F7F8FB', 0.05), '#F7F8FB'))}:1`,
  );
  console.log(
    `dark  grid rgb(245 247 249 / 0.055) over canvas = ${over('#F5F7F9', '#0E0F13', 0.055)}  ratio ${n(contrast(over('#F5F7F9', '#0E0F13', 0.055), '#0E0F13'))}:1`,
  );
  console.log(
    '\n=== V-15  ACCENT vs the 12 brand colours — full CVD table (accent-mark #FE02A9) ===',
  );
  for (const [t, hex] of Object.entries(BRAND)) {
    console.log(
      `  ${t.padEnd(13)} normal ${n(dE('#FE02A9', hex)).padStart(6)}  protan ${n(cvdDE('#FE02A9', hex, 'protan').worse).padStart(6)}  deutan ${n(cvdDE('#FE02A9', hex, 'deutan').worse).padStart(6)}  tritan ${n(cvdDE('#FE02A9', hex, 'tritan').worse).padStart(6)}`,
    );
  }
  console.log('\n=== V-16  ACCENT vs reserved semantics — full CVD table ===');
  for (const theme of ['light', 'dark']) {
    const acc = theme === 'light' ? '#D1018A' : '#FE02A9';
    console.log(` ${theme} (accent-ink ${acc}):`);
    for (const [nm, hx] of [
      ...Object.entries(TIMING[theme]).map(([k, v]) => [`timing-${k}`, v]),
      ...Object.entries(STATUS[theme]).map(([k, v]) => [`status-${k}`, v]),
    ]) {
      console.log(
        `   ${nm.padEnd(16)} normal ${n(dE(acc, hx)).padStart(6)}  protan ${n(cvdDE(acc, hx, 'protan').worse).padStart(6)}  deutan ${n(cvdDE(acc, hx, 'deutan').worse).padStart(6)}  tritan ${n(cvdDE(acc, hx, 'tritan').worse).padStart(6)}`,
      );
    }
  }
}
if (mode === 'composite') composite();

function orb() {
  const over = (fg, bg, a) => {
    const F = hex2rgb(fg),
      B = hex2rgb(bg);
    return rgb2hex([0, 1, 2].map((i) => a * F[i] + (1 - a) * B[i]));
  };
  console.log(
    '\n=== ORB OPACITY SOLVE — light mode, accent-mark #FE02A9 must clear 3.0:1 over the field ===',
  );
  for (const a of [0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.12]) {
    const f1 = over('#FE02A9', '#F7F8FB', a);
    const f2 = over('#1B1E24', f1, 0.02);
    console.log(
      `  orb ${a.toFixed(2)} -> field ${f2}   accent-mark ${n(contrast('#FE02A9', f2))}:1   accent-ink ${n(contrast('#D1018A', f2))}:1   ink-tertiary ${n(contrast('#6A6D74', f2))}:1   border-control ${n(contrast('#878B92', f2))}:1`,
    );
  }
  console.log('\n=== ORB OPACITY SOLVE — dark mode ===');
  for (const a of [0.14, 0.17, 0.2, 0.24]) {
    const f1 = over('#FE02A9', '#0E0F13', a);
    const f2 = over('#F5F7F9', f1, 0.038);
    console.log(
      `  orb ${a.toFixed(2)} -> field ${f2}   accent-mark ${n(contrast('#FE02A9', f2))}:1   ink-tertiary ${n(contrast('#86898F', f2))}:1   border-control ${n(contrast('#64686F', f2))}:1   ink-secondary ${n(contrast('#B3B6BA', f2))}:1`,
    );
  }
}
if (mode === 'orb') orb();

function plate() {
  const over = (fg, bg, a) => {
    const F = hex2rgb(fg),
      B = hex2rgb(bg);
    return rgb2hex([0, 1, 2].map((i) => a * F[i] + (1 - a) * B[i]));
  };
  console.log('\n=== V-17  CONTRAST PLATE — does it restore the measured surface? ===');
  for (const [theme, canvas, orbA, grainC, grainA, tert, bctl, mark, ink2] of [
    ['light', '#F7F8FB', 0.09, '#1B1E24', 0.02, '#6A6D74', '#878B92', '#FE02A9', '#53575E'],
    ['dark', '#0E0F13', 0.17, '#F5F7F9', 0.038, '#86898F', '#64686F', '#FE02A9', '#B3B6BA'],
  ]) {
    const f1 = over('#FE02A9', canvas, orbA);
    const field = over(grainC, f1, grainA);
    for (const pa of [0.86, 0.92]) {
      const plated = over(canvas, field, pa);
      console.log(
        ` ${theme} plate ${pa}: field ${field} -> plated ${plated}  (canvas ${canvas}, dE ${n(dE(plated, canvas))})`,
      );
      console.log(
        `   ink-primary ${n(contrast(theme === 'light' ? '#1B1E24' : '#F5F7F9', plated))}:1  ink-secondary ${n(contrast(ink2, plated))}:1  ink-tertiary ${n(contrast(tert, plated))}:1 (floor 4.5)  border-control ${n(contrast(bctl, plated))}:1 (floor 3.0)  accent-mark ${n(contrast(mark, plated))}:1 (floor 3.0)  accent-ink ${n(contrast(theme === 'light' ? '#D1018A' : '#FE02A9', plated))}:1 (floor 4.5)`,
      );
    }
  }
}
if (mode === 'plate') plate();
