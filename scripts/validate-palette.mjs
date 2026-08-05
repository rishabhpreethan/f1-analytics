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

/* ================================================================ main */
if (mode === 'calibrate' || mode === 'all') calibration();
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
