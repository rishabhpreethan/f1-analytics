# Design System

**Status: FOUNDATIONS COMPLETE (F0).** Owned by the `designer`.

Sections **§1, §2, §3.4, §3.5, §4, §5, §7.0–§7.4, §8, §9, §10** are authored and binding.
Sections still marked _TO BE COMPLETED IN F1_ are deliberately deferred: per-chart specifications,
the full component inventory, and the internals of team-colour resolution.

Everything in **§3.1–§3.3** and **§6.2** was **measured, not assumed** — do not re-litigate it, and do
not soften it. §9 records every validation run, including the run that reproduces the original
measurements with the validator described in §9.1.

---

## 1. Design intent

The product should feel like the sport: **technical, precise, fast, confident**. Data-dense without
being cold. Animation is purposeful — mechanical rather than playful, and never at the expense of
perceived speed.

**The overriding requirement is coherence.** One type scale, one spacing scale, one motion
vocabulary, one chart language. A page needing something new means the system gains a token — never
that a page gains an exception.

### 1.1 The three decisions that produce the character

Everything else follows from these.

**1. The chrome is achromatic. Colour in this product belongs to the sport.**

The interface — header, nav, buttons, tabs, selected states, links, focus rings — is built from
neutrals and ink only. There is no brand accent hue. This is not minimalism for its own sake; it is
forced by §3.1 and then exploited:

> Every usable hue on the wheel is already some team's identity. Blue is Williams, Red Bull, RB and
> Alpine. Red is Ferrari and Audi. Orange is McLaren. Teal is Mercedes. Green is Sauber and Aston
> Martin. Grey is Haas and Cadillac. Purple, green and yellow are reserved timing semantics (§3.4).
> A coloured interface accent would collide with an identity somewhere in the product, on some page,
> for some season.

So: neutral chrome, and a team's colour is the loudest thing on the screen wherever it appears.
A standings table is grey type with eleven coloured accent bars, and the eye goes exactly where it
should. Selection is expressed by **weight, ink, an inverse fill, and a 2px rule** — never by hue.

**2. Figures are set in a monospace and are always tabular.**

Lap times, gaps, points and positions are the product's subject matter. Setting them in a mono
(§2.2) separates *measured values* from *labels* at a glance and makes every column align by
construction. This is the single detail that makes the product read as an instrument rather than a
web page.

**3. Density is a feature, and elevation is rationed.**

This is an instrument panel, not a card gallery. One elevation level for content panels, one for
overlays. Dividers over shadows. 13–14px body text in tables, and the space budget spent on
alignment rather than air.

---

## 2. Typography

### 2.1 Families — three, all verified

| Role | Family | Weights used | Licence | Evidence |
|---|---|---|---|---|
| **Display** | **Archivo** (variable, `wght` 100–900, `wdth` 62–125) | 600, 700 at `wdth 82` | SIL OFL 1.1 | Read from the shipped binary `ofl/archivo/Archivo[wdth,wght].ttf` in the Google Fonts repository: axes `wght 100→900`, `wdth 62→125`; name-table licence field = "SIL Open Font License, Version 1.1"; OpenType features include `tnum`, `lnum`, `onum`, `zero`. Designer Héctor Gatti / Omnibus-Type. |
| **Text** | **Inter** (variable, `wght` 100–900, `opsz` 14–32) | 400, 500, 600 | SIL OFL 1.1 | Read from `ofl/inter/Inter[opsz,wght].ttf`: axes `opsz 14→32`, `wght 100→900`; features include `tnum`, `zero`, `cv01`–`cv14`, `ss01`–`ss08`. Designed by Rasmus Andersson explicitly for UI at small sizes. |
| **Figures** | **Chivo Mono** (variable, `wght` 100–900, `ital`) | 400, 500, 600 | SIL OFL 1.1 | Read from `ofl/chivomono/ChivoMono[wght].ttf`: axis `wght 100→900`; licence URL `https://scripts.sil.org/OFL`; designer **Héctor Gatti** — the same designer as Archivo. **Plain (unadorned) zero by default** — verified by outline inspection: the `zero` glyph has 2 contours, i.e. no dot and no slash. |

All three are on Google Fonts and available as `@fontsource-variable/{archivo,inter,chivo-mono}`
(v5.3.0, `OFL-1.1`) on npm.

**Why these three.** Archivo and Chivo Mono share a designer and a foundry, so the display voice and
the figure voice come from one drawing hand — that is the coherence lever. Inter carries the small
text because it was designed for exactly that job and measurably outperforms a grotesque display
face at 13px in a dense table. Three families, two foundries, one skeleton (all high x-height,
closed-aperture grotesques).

**Why not the obvious choices.**

- **The official F1 typefaces are not usable.** Formula 1's own brand guidelines state: *"Our header
  typefaces and fonts are protected by copyright which is owned by the Formula 1 companies, and
  cannot be used under any circumstances without an express written license."*
- **Titillium Web is a trap, not a shortcut.** It is the commonly recommended "free F1 font", but
  the same guidelines state: *"The Titillium font is a common font available for download via an
  open source licence. It should not be used in any manner to create an unauthorised association
  with the Championship or the Formula 1 companies."* Using it in an F1 analytics product is
  precisely that association. **Do not use Titillium.**
- **JetBrains Mono, IBM Plex Mono, Geist Mono, Roboto Mono and five others were evaluated for the
  figure role.** JetBrains Mono, Geist Mono, IBM Plex Mono, DM Mono, Martian Mono, Red Hat Mono,
  Sometype Mono and Space Mono all draw a **decorated zero** (dot or slash) by default — verified by
  outline inspection (3 contours in the `zero` glyph). A dotted zero in `1:32.608` reads as a code
  editor, not a timing screen. Only Chivo Mono, Azeret Mono and Roboto Mono draw a plain zero; Chivo
  Mono is the narrowest of the three (most digits per column) and shares Archivo's designer.

### 2.2 Delivery — self-hosted, never a font CDN

`ARCHITECTURE.md` §7 (S-1, DL-2) forbids third-party network calls on a request path, and the CSP in
S-9 must not need to whitelist a font host. Therefore:

- Fonts are **self-hosted**, served same-origin.
- Preferred: `woff2` variable files vendored into `public/fonts/`, with a `latin` + `latin-ext`
  subset only. Filenames: `archivo-var.woff2`, `inter-var.woff2`, `chivo-mono-var.woff2`.
- Alternative: the three `@fontsource-variable/*` npm packages. **This is a new dependency and needs
  a `principal-engineer` decision recorded in `ARCHITECTURE.md` §10** — the `designer` flags it, does
  not add it.
- `@font-face` uses `font-display: swap`, and the fallback stack is metric-tolerant:
  `--font-display: Archivo, "Arial Narrow", system-ui, sans-serif`
  `--font-text: Inter, system-ui, -apple-system, "Segoe UI", sans-serif`
  `--font-mono: "Chivo Mono", ui-monospace, "SF Mono", Menlo, monospace`
- Only the axes used are shipped. Archivo is instanced/limited to `wdth 82` plus `wght 600–700`;
  Inter to `opsz 14–20`, `wght 400–600`; Chivo Mono to `wght 400–600`.

### 2.3 The scale — 11 steps, and nothing off it

Root font size is 16px. Values are px; `rem` in the token file.

| Token | px | Line-height | Family / weight | Tracking | Use |
|---|---|---|---|---|---|
| `--text-2xs` | 11 | 14 | Inter 500, uppercase | +0.06em | column headers, axis ticks, eyebrow labels, chip text |
| `--text-xs` | 12 | 16 | Inter 400/500 | 0 | meta, captions, footnotes, legend labels |
| `--text-sm` | 13 | 18 | Inter 400 | 0 | dense table body |
| `--text-base` | 14 | 20 | Inter 400 | 0 | body default |
| `--text-md` | 16 | 24 | Inter 400 | −0.005em | lead paragraph, state-card body |
| `--text-lg` | 18 | 26 | Inter 500 | −0.01em | card titles, section subheads |
| `--display-xs` | 20 | 24 | Archivo 600 · wdth 82 | +0.005em | panel titles, the wordmark |
| `--display-sm` | 24 | 28 | Archivo 600 · wdth 82 | 0 | section headings |
| `--display-md` | 32 | 34 | Archivo 700 · wdth 82 | −0.01em | sub-page headings, stat-tile figures |
| `--display-lg` | 44 | 44 | Archivo 700 · wdth 82 | −0.015em | page titles |
| `--display-xl` | 60 | 56 | Archivo 700 · wdth 82 | −0.02em | hero figures and driver names |

**The rule about the ramp.** The text region (11→18) steps by roughly 1.09–1.15 and is snapped to
whole pixels, because fractional sizes blur at 13px in a table of 20 rows. The display region
(20→60) steps by roughly 1.2–1.37, because large type needs visible jumps to establish hierarchy.
**The scale is the list above.** A size not in the list is a review failure — including "just this
once" values inside chart configs.

Uppercase is used only at `--text-2xs` and only for labels, never for sentences.
Maximum measure for prose is `68ch`.

### 2.4 Numerals — tabular everywhere, no exceptions

| Where | Family | Declaration |
|---|---|---|
| Table cells, chart labels and axis ticks, stat tiles, chips, timing values, positions, gaps, points, dates in tabular contexts | `--font-mono` (Chivo Mono) | monospaced by construction; also set `font-variant-numeric: tabular-nums` so a fallback font still aligns |
| Figures inline in prose | `--font-text` (Inter) | `font-variant-numeric: tabular-nums` — Inter's `tnum` is verified present |
| Figures inside display headings | `--font-display` (Archivo) | `font-variant-numeric: tabular-nums` — Archivo's `tnum` is verified present |

Rules:

- **Never mix a mono figure inline into an Inter sentence.** Mono lives in its own cell, chip or
  tile. Prose figures use Inter with `tnum`.
- **Slashed/dotted zero is off.** Do not enable the `zero` feature anywhere. Timing screens set
  plain zeros; a slash in `1:30.084` is noise.
- Negative and positive deltas use a **leading sign glyph** (`+` / `−`, U+2212 for minus so it
  matches digit width), never colour alone, and never a bare hyphen.
- Lap times format as `M:SS.mmm`; sub-minute times as `SS.mmm`; gaps as `+S.mmm` or `+N laps`.
  Formatting lives in `lib/format.ts` (`ARCHITECTURE.md` §3) — the design system only fixes the shape.
- **Icons and marks are never text glyphs.** Verified in the F0 specimen render: `◆` is absent from
  Chivo Mono and renders as a missing-glyph box. Every marker, arrow and status symbol is an inline
  SVG from the icon set.

### 2.5 Icons

One set: **Lucide** (ISC licence), 24×24 grid, 1.5px stroke, rendered at 16px or 20px, `currentColor`.
Icons never carry meaning alone; they always sit beside a label or have an accessible name.
Adding a second icon set is a review failure. (Lucide as a dependency is a `principal-engineer`
decision — flagged, not added.)

---

## 3. Colour

### 3.1 Team brand colours — verified

Twelve teams carry a brand colour in the data. Cross-checked against public sources; Ferrari,
Mercedes and McLaren were confirmed against independent references and matched exactly.

| Team | `reference` | Colour |
|---|---|---|
| Alpine | `alpine` | `#00A1E8` |
| Aston Martin | `aston_martin` | `#229971` |
| Audi | `audi` | `#FF2D00` |
| Cadillac | `cadillac` | `#AAAAAD` |
| Ferrari | `ferrari` | `#ED1131` |
| Haas | `haas` | `#9C9FA2` |
| McLaren | `mclaren` | `#F47600` |
| Mercedes | `mercedes` | `#00D7B6` |
| RB | `rb` | `#6C98FF` |
| Red Bull | `red_bull` | `#4781D7` |
| Sauber | `sauber` | `#01C00E` |
| Williams | `williams` | `#1868DB` |

**202 of 214 teams have no brand colour.** A deterministic fallback ramp is required — stable per
team, assigned by identity and never by rank. _Ramp designed in F1._

### 3.2 ⚠ Brand colours FAIL as a chart palette — measured

The 2026 grid's eleven colours were run through a categorical-palette validator. **Four checks
failed.** This is computed, not an opinion:

| Check | Result |
|---|---|
| **Normal-vision separation** | **FAIL** — Cadillac `#AAAAAD` ↔ Haas `#9C9FA2`, **ΔE 3.8**. Floor is 15. Indistinguishable *even with full colour vision*. |
| **CVD separation** | **FAIL** — RB `#6C98FF` ↔ Alpine `#00A1E8`, **ΔE 3.3** deuteranopic (tritan 1.6). Floor is 8. |
| **Chroma floor** | **FAIL** — Haas (0.006) and Cadillac (0.004) read as pure grey. |
| **Lightness band** | **FAIL** — light mode: Mercedes `#00D7B6` at 0.786. Dark mode: 6 of 11 outside the band. |
| **Contrast vs surface** | **WARN** light mode — 6 of 11 below 3:1 (McLaren 2.75, Mercedes 1.80, Alpine 2.82, RB 2.70, Haas 2.59, Cadillac 2.26). Dark mode passes. |

These figures were **independently reproduced in F0** against the validator now described in §9.1 —
see §9.2 run **V-1**. The contrast WARN was re-measured against the surfaces defined in §3.5 and is
unchanged in character: **6 of 11 fall below 3:1 in light mode, all 11 pass in dark mode** (§9.2 V-8).

### 3.3 The resolution — binding rules

1. **Identity surfaces use the true brand colour.** Driver cards, team headers, table row accents,
   badges, chips. Colour sits beside a name, so collisions are harmless and fans get the recognition
   they expect. This is why accurate colours matter.
2. **Charts always carry secondary encoding.** Brand colour is the fill or stroke, but never the
   only signal. Required alongside it:
   - direct labels (mandatory at ≤4 series)
   - distinct dash patterns
   - distinct marker shapes
   - a 2px surface gap between adjacent fills
   - a 2px surface ring where marks overlap
3. **Comparison is capped at 4 entities.** Satisfies the direct-label rule; collapses collision risk.
4. **Runtime collision detection is required.** Given the selected entities, compute pairwise
   perceptual distance and automatically assign a differentiator to any colliding pair. Implemented
   in `src/lib/teamColor.ts`. _Thresholds and the differentiator ladder are specified in F1; the
   distance metric and CVD models are already fixed by §9.1._
5. **Teammate comparison always collides** — identical team colour — and is simultaneously the most
   valuable comparison in the product. Its differentiation treatment must be explicit, not emergent.
   _Specified in F1/F7._
6. **Per-theme chart-safe variants.** Brand colours failing the lightness band need a derived
   plotting variant per theme (a darkened Mercedes for light mode, etc.). Brand colour for identity;
   derived variant for plotting. _Derived and validated in F1._
7. **Validate anything new.** Run the validator (§9.1); fix FAILs; record results in §9.2.

**Identity-surface rule added in F0.** Because 6 of 11 brand colours fall below 3:1 against a light
surface (§9.2 V-8), a brand colour is never the sole carrier of identity on an identity surface
either. The permitted identity forms are:

| Form | Spec |
|---|---|
| **Accent bar** | 3px full-bleed bar on the leading edge of a table row or card, brand colour, always beside the team or driver **name** in ink |
| **Colour chip** | 10×10px `--radius-xs` square, brand colour, `1px` inset ring in `--border-subtle`, always beside a text label |
| **Team header band** | brand colour band with the team name in a computed on-colour ink (`--ink-primary` or `--ink-inverse`, whichever reaches ≥4.5:1 against that specific colour — computed, not assumed) |
| **Not permitted** | brand colour as the background of a text-only element without a computed on-colour ink; brand colour as the only difference between two adjacent interactive elements |

### 3.4 Reserved semantic colours — F1 timing convention, verified

| Meaning | Colour | Rule |
|---|---|---|
| **Session fastest** | Purple | Never reused for anything else |
| **Personal best** | Green | " |
| **Below personal best** | Yellow | " |

These are the strongest recognition cues available with F1 fans. Use them exactly, and never as
series colours.

#### 3.4.1 The exact steps

Each semantic ships as a **wash** (tinted field) plus an **ink** (the type on it). Timing values
always render as a **wash chip**, in both themes:

| Token | Light | Dark |
|---|---|---|
| `--timing-purple-ink` | `#9E08F6` | `#BB79FD` |
| `--timing-purple-wash` | `#F1E8FD` | `#352546` |
| `--timing-green-ink` | `#087B30` | `#47FF79` |
| `--timing-green-wash` | `#D5F8D9` | `#16361C` |
| `--timing-yellow-ink` | `#6A5606` | `#EABF17` |
| `--timing-yellow-wash` | `#FAECC4` | `#392C01` |

Validated in §9.2 V-3 / V-4. Every ink clears 4.5:1 on its own wash **and** on `--surface-raised`
and `--surface-canvas` in its mode.

**Why the chip form rather than coloured text.** In light mode, a yellow that clears 4.5:1 as text
on near-white is necessarily a dark gold (`#6A5606`) and stops reading as "yellow". In the chip
form, the **wash carries the hue recognition** and the **ink carries the legibility** — so the cell
reads unmistakably yellow while the digits stay AA. One form, two colour sets, no compromise on
either axis.

#### 3.4.2 The residual CVD failure, and the mandatory mitigation

The hues are fixed by convention and cannot be moved. Within that constraint, L and C were
optimised for maximum dichromatic separation (§9.1 step 7). Two pairs still fail in light mode
(§9.2 V-3):

| Pair | Result |
|---|---|
| green ↔ yellow | deuteranopic ΔE **6.9** (floor 8) — FAIL. Protan 9.7 pass, tritan 40.3 pass. |
| purple ↔ yellow | tritanopic ΔE **7.2** (floor 8) — FAIL. Protan 61.5, deutan 59.2 pass. |

Dark mode passes every pair (minimum CVD ΔE 9.2).

This is unavoidable — green/amber discrimination is the defining deuteranopic difficulty — so the
mitigation is structural and **not optional**:

1. **The value is always visible.** The fastest time is the smallest number on screen; colour is
   redundant reinforcement, never the carrier.
2. **Every timing chip carries a marker glyph** (inline SVG, per §2.4): session fastest = filled
   diamond, personal best = filled upward triangle, below personal best = no glyph.
3. **Every timing chip has an accessible name**: `aria-label="session fastest lap"` /
   `"personal best"` / `"below personal best"`, in addition to the visible value.
4. **A legend appears once per surface** that uses timing colours, keyed glyph → meaning → colour.

#### 3.4.3 Status colours — the shipped set is four

`info` · `good` · `caution` · `critical`.

| Token | Light ink | Light wash | Dark ink | Dark wash |
|---|---|---|---|---|
| `--status-info-*` | `#034F89` | `#E1EEFC` | `#2E9CFD` | `#142F4B` |
| `--status-good-*` | `#0A7554` | `#D2F7E7` | `#26F0B0` | `#0F3830` |
| `--status-caution-*` | `#6F5306` | `#FEEBC4` | `#FEC431` | `#3C2B02` |
| `--status-critical-*` | `#C50721` | `#FDE7E5` | `#FD5E5A` | `#47211E` |

**The earlier draft's four-level `good / warning / serious / critical` set was reduced to a
three-severity ramp plus `info`, because it was measured to be undeliverable.** With `warning`
(amber) and `serious` (orange) both present, the validator returned **deuteranopic ΔE 0.4** and
**tritanopic ΔE 4.6** for that pair — two adjacent warm hues are one colour to a dichromat. `warning`
and `serious` are therefore a single level, `caution`, and severity beyond it escalates to
`critical`. Full results in §9.2 V-5 / V-6.

`--status-good-*` is a deliberately distinct value from `--timing-green-*` (measured ΔE 9.9 light /
11.4 dark, §9.2 V-7) so that the "never reused" rule in §3.4 holds at the token level.

Residual CVD failures, light mode: `caution ↔ critical` protan 7.5, deutan 7.8 (floor 8). Dark mode
passes all pairs. **Therefore: a status colour never appears without an icon and a text label.** That
was already the rule; it is now a measured requirement rather than a preference.

**A missing-coverage state is not a status.** Absent lap data before 1996 is a property of the sport's
history, not a fault, and it must never be painted `caution` or `critical`. The no-coverage state is
**neutral** — `--ink-tertiary`, `--border-subtle`, `--surface-sunken` (§7.4).

### 3.5 Surfaces, ink, borders

Light and dark are **designed separately**, each validated against its own surface (§9.2 V-2).
Dark mode is never an automatic inversion: the dark set changes the *elevation model* (§5.4), not
just the numbers.

All neutrals are generated in OkLCh at hue **264** with chroma 0.000–0.013 — enough cool cast to
read as an instrument, little enough not to fight McLaren orange or Ferrari red.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--surface-sunken` | `#EFF1F5` | `#08090C` | chart plot areas, input wells, table zebra, skeletons |
| `--surface-canvas` | `#F7F8FB` | `#0E0F13` | the page |
| `--surface-raised` | `#FFFFFF` | `#1A1C20` | panels, cards, table body, header bar |
| `--surface-overlay` | `#FFFFFF` | `#23252A` | popovers, menus, sheets, tooltips |
| `--border-subtle` | `#DDE0E4` | `#2F3237` | hairline dividers, table rules, panel edges |
| `--border-strong` | `#B9BCC3` | `#4F535A` | emphasis dividers, table header rule, chart axis lines |
| `--border-control` | `#878B92` | `#64686F` | **boundaries of interactive controls** — the only border token that must clear 3:1 |
| `--ink-primary` | `#1B1E24` | `#F5F7F9` | headings, values, primary labels |
| `--ink-secondary` | `#53575E` | `#B3B6BA` | body copy, secondary labels |
| `--ink-tertiary` | `#6A6D74` | `#86898F` | meta, axis ticks, placeholders, disabled-adjacent text |
| `--ink-inverse` | `#FFFFFF` | `#0E0F13` | type on an `--ink-primary` fill |

Every text pair clears 4.5:1 and every `--border-control` pair clears 3:1 in both modes (§9.2 V-2).
`--border-subtle` (1.32:1 light / 1.33:1 dark) and `--border-strong` (1.90 / 2.21) are **decorative
separators** and are outside WCAG 1.4.11's scope, which covers interactive-component boundaries and
meaningful graphics; anything interactive uses `--border-control`.

#### 3.5.1 Focus — one achromatic double ring, everywhere

Because focus can land on a control sitting on a team-coloured band, a coloured focus ring cannot be
guaranteed visible. The ring is therefore achromatic and doubled:

```
outline: 2px solid var(--ink-primary);
outline-offset: 2px;
box-shadow: 0 0 0 2px var(--surface-raised);   /* the inner separator ring */
```

Measured worst case across all neutral tokens **and** all eleven brand colours: the better of the two
rings reaches **4.28:1 (light)** and **4.14:1 (dark)** against the worst adjacent colour — floor 3.0,
**PASS** (§9.2 V-9).

Applied via `:focus-visible` only. Never removed, never replaced per-component, never a `whileFocus`
motion substitute — motion is not a focus indicator.

#### 3.5.2 Interactive expression without hue

| State | Expression |
|---|---|
| Hover | surface steps one level toward `--surface-overlay`; `-1px` translateY on cards only |
| Active / pressed | `scale(0.985)`; surface steps back down |
| Selected (nav, tabs, segmented) | `--ink-primary` label + a 2px `--ink-primary` rule (`layoutId`, §4.4 M-3) |
| Selected (chip, toggle) | `--ink-primary` fill + `--ink-inverse` label |
| Link | `--ink-primary` with a 1px `currentColor` underline at `0.14em` offset; hover thickens to 2px. No hue. |
| Disabled | `--ink-tertiary` text, `--surface-sunken` fill, `--border-subtle`, `opacity: 1` (never faded — a disabled control must stay readable so its explanation can be read too), `cursor: not-allowed`, `aria-disabled="true"` |

---

## 4. Motion

### 4.1 Do not hand-roll animation logic

Framer Motion documents an example per motion category. **Consult those examples and adapt them**
rather than writing animation logic from scratch. Cite the category/example each pattern derives
from so the developer can follow the same reference.

Categories, mapped to where they earn their place:

| Category | Framer Motion API | Use |
|---|---|---|
| Shared-element layout | `layout`, `layoutId` | Driver card → driver page. **The highest-value animation in this product.** |
| Enter / exit | `AnimatePresence` | Route changes, modals, the compare tray |
| Scroll-linked | `useScroll`, `useTransform` | Section reveals on long profile pages |
| Gesture | `whileHover`, `whileTap`, `whileFocus` | Cards, controls, table rows |
| Stagger | `delayChildren: stagger()` | Leaderboards and grids revealing in order |
| Springs vs tweens | `type: "spring"` / `"tween"` | Springs for spatial motion; tweens for opacity and colour |
| Chart entry | variants + custom | Axis-anchored growth for bars; left-to-right draw for lines |

### 4.2 Binding rules

- **The timing/easing/spring set is defined once** here and in `src/lib/motion.ts`. Ad-hoc durations
  are how a product starts feeling incoherent — they are a review failure.
- **`prefers-reduced-motion` must be honoured everywhere**, with a *specified* reduced variant, not
  merely "animation off".
- **Never animate a chart on data update.** Mount and deliberate user action only. A chart that
  re-animates while someone is reading it is a defect.
- Nothing on an interaction path exceeds ~400ms. Perceived speed is part of the F1 feel.
- Animate `transform` and `opacity`. Never animate layout-triggering properties in a loop.

### 4.3 The token set — defined once

**Easings are Framer Motion's own string presets.** No hand-authored cubic-béziers exist in this
product. Documented preset list (Motion → Transitions): `"linear"`, `"easeIn"`, `"easeOut"`,
`"easeInOut"`, `"circIn"`, `"circOut"`, `"circInOut"`, `"backIn"`, `"backOut"`, `"backInOut"`,
`"anticipate"`. Of those, four are adopted:

| Token | Value | Use |
|---|---|---|
| `ease.enter` | `"easeOut"` | anything appearing |
| `ease.exit` | `"easeIn"` | anything leaving |
| `ease.move` | `"easeInOut"` | anything repositioning without a spring |
| `ease.mech` | `"circOut"` | data marks growing; the one "mechanical" curve |

`"backIn/Out"` and `"anticipate"` overshoot playfully and are **not** adopted.

| Duration token | Value | Use |
|---|---|---|
| `dur.instant` | 80ms | colour/ink change on a control, checkbox, hover wash |
| `dur.fast` | 140ms | tooltips, chips, small fades, crossfades |
| `dur.base` | 200ms | content entering, popovers, tab rules |
| `dur.slow` | 320ms | sheets, trays, modals, shared-element transitions |
| `dur.chart` | 400ms | chart mount only — never on data update |

**Springs use Motion's documented duration-based spring API** (`visualDuration` + `bounce`), not
hand-tuned stiffness/damping, so the numbers stay legible:

| Spring token | Value | Use |
|---|---|---|
| `spring.control` | `{ type: "spring", visualDuration: 0.18, bounce: 0.08 }` | buttons, chips, rows, small gesture feedback |
| `spring.layout` | `{ type: "spring", visualDuration: 0.30, bounce: 0.12 }` | `layout` / `layoutId` shared-element motion |
| `spring.surface` | `{ type: "spring", visualDuration: 0.36, bounce: 0.16 }` | sheets, trays, drawers |

Bounce stays ≤0.16 throughout: this product decelerates like a mechanism, it does not wobble.

| Stagger token | Value | Use |
|---|---|---|
| `stagger.row` | `stagger(0.024)` | table rows |
| `stagger.card` | `stagger(0.04)` | card and tile grids |
| `stagger.cap` | 12 | items after the 12th get **zero** delay — a 20-row stagger at 24ms would take 480ms and break the ≤400ms rule |

Orchestration uses the documented form from Motion → Animation → Variants → Orchestration:
`transition: { when: "beforeChildren", delayChildren: stagger(0.024) }`.

### 4.4 Named motions — F0 shell

Each entry names the Framer Motion documentation page and example it derives from, and its
reduced-motion variant. **All of these are additionally covered by the global
`<MotionConfig reducedMotion="user">`** at the app root (Motion → Accessibility), which per the docs
*"automatically disable[s] transform and layout animations, while preserving the animation of other
values like `opacity` and `backgroundColor`"*. The explicit reduced variants below exist because
"transform off" is not always the right answer.

| ID | Motion | Derives from | Spec | Reduced-motion variant |
|---|---|---|---|---|
| **M-1** | App shell mount (header, nav) | Motion → Animation → **"Enter animation"** | `opacity 0→1`, `y −4→0`, `dur.base`, `ease.enter`; once per hard load, not per route | opacity only, `dur.fast`, no `y` |
| **M-2** | Route content enter | Motion → **AnimatePresence** → **"Exit animation"** and **"AnimatePresence modes"**; `mode="sync"` with **no exit variant** | `opacity 0→1`, `y 8→0`, `dur.base`, `ease.enter`, keyed on `location.pathname`. Exit is deliberately omitted: `mode="wait"` would add the exit duration to every perceived navigation | opacity only, `dur.fast` |
| **M-3** | Nav active-item rule | Motion → **Layout animations** → **"`layoutId` for shared element transitions"** | a single 2px `--ink-primary` rule with `layoutId="nav-rule"` slides between items, `spring.layout` | `MotionConfig` suppresses the layout animation; the rule snaps to the new item. Correct and intended |
| **M-4** | Mobile nav sheet | Motion → **AnimatePresence** → **"Exit animation"**, default `mode="sync"` | panel `y −8→0` + `opacity`, `spring.surface`; scrim `opacity 0→1`, `dur.fast`, `ease.enter`; exit reverses with `ease.exit`, `dur.fast` | opacity only on both panel and scrim, `dur.fast` |
| **M-5** | Popover / menu open (theme menu, data-currency detail) | Motion → **AnimatePresence** → **"Exit animation"** + Motion → **Gestures** → **`whileTap`** on the trigger | `opacity 0→1`, `scale 0.98→1`, `dur.fast`, `ease.enter`, `transform-origin` at the trigger corner | opacity only, `dur.fast` |
| **M-6** | Control gesture feedback | Motion → **Gestures** → **`whileHover`**, **`whileTap`**, **`whileFocus`** | `whileHover`: surface token step + `y −1` (cards only), `spring.control`. `whileTap`: `scale 0.985`. `whileFocus` is **not** used for the focus ring (§3.5.1) — the ring is CSS `:focus-visible` | surface/ink token change only; no `y`, no `scale`. `MotionConfig` handles this automatically |
| **M-7** | Skeleton pulse | Motion → **Animation** → **"Keyframes"** | `opacity: [0.55, 1, 0.55]`, 1200ms, `"linear"`, `repeat: Infinity`. Opacity only — never `background-position`, never a transform loop | **static `opacity: 0.7`, no repeat.** `MotionConfig` does not stop opacity loops, so this needs `useReducedMotion()` explicitly |
| **M-8** | Skeleton → content swap | Motion → **AnimatePresence** → **"AnimatePresence modes"** (`sync`) | skeleton exits `opacity→0` at `dur.fast`/`ease.exit`; content enters `opacity 0→1` at `dur.base`/`ease.enter`; the container holds its height so nothing jumps | identical (opacity only) |
| **M-9** | List / grid reveal (defined here, first used F2) | Motion → **Animation** → **Variants → Orchestration** (`delayChildren: stagger()`) | parent `when: "beforeChildren"`, `delayChildren: stagger.row` (rows) or `stagger.card` (grids); child `opacity 0→1`, `y 6→0`, `dur.base`, `ease.enter`; capped at `stagger.cap` | `stagger(0)`, opacity only |
| **M-10** | Long-page section reveal (defined here, first used F3/F4) | Motion → **Scroll animations** → **"Animate once on scroll"** (`whileInView` + `viewport={{ once: true }}`) | `opacity 0→1`, `y 12→0`, `dur.base`, `ease.enter`, `viewport={{ once: true, margin: "-64px" }}` | opacity only, `dur.fast` |
| **M-11** | Theme change | — (CSS, not Motion) | `background-color` and `color` transition `dur.base`/`ease.move` on `:root`; **no transition on `--*` custom properties themselves** and none on `transform` | transition removed entirely — instant swap |

**Chart entry motion** (`ease.mech`, `dur.chart`, axis-anchored growth for bars, left-to-right draw
for lines) is specified per-chart in §6.3 — F1.

### 4.5 What must never animate

- Any property that triggers layout (`width`, `height`, `top`, `margin`) inside a loop.
- Charts on data update (§4.2).
- Focus indicators.
- The data-currency indicator. It must not pulse, blink, or draw the eye — see §7.3.
- Anything at all while `document.visibilityState !== "visible"`.

---

## 5. Spacing, layout, elevation

### 5.1 Spacing — the allowed subset of the 4px scale

Tailwind's default 0.25rem scale is the scale; the design system restricts which steps exist.

| Token | px | Typical use |
|---|---|---|
| `0` | 0 | |
| `0.5` | 2 | icon-to-label nudge, chip inset |
| `1` | 4 | tight inline gaps |
| `1.5` | 6 | chip padding-x |
| `2` | 8 | control padding-x, table cell padding-y |
| `3` | 12 | table cell padding-x, control padding |
| `4` | 16 | mobile gutter, panel padding, stack gap |
| `5` | 20 | tablet gutter |
| `6` | 24 | desktop gutter, panel padding, grid gap |
| `8` | 32 | section gap |
| `10` | 40 | |
| `12` | 48 | major section gap |
| `16` | 64 | page top/bottom rhythm |
| `20` | 80 | |
| `24` | 96 | hero rhythm |

Any other step (`7`, `9`, `11`, `14`, arbitrary px, arbitrary `[13px]` escapes) is a review failure.

### 5.2 Radii

| Token | px | Use |
|---|---|---|
| `--radius-xs` | 2 | colour chips, dash swatches, small data marks |
| `--radius-sm` | 4 | badges, timing chips, **chart data-ends** (§6.1) |
| `--radius-md` | 6 | buttons, inputs, selects |
| `--radius-lg` | 8 | panels, cards, state cards |
| `--radius-xl` | 12 | overlays, sheets, modals |
| `--radius-full` | 9999 | avatars, dots |

### 5.3 Breakpoints and grid

Design and verification breakpoints are **390 / 768 / 1440**.

| Name | min-width | Columns | Gutter | Container |
|---|---|---|---|---|
| base (mobile) | 0 | 4 | 16 | fluid, 16 page padding |
| `md` (tablet) | 768 | 8 | 20 | fluid, 24 page padding |
| `lg` | 1024 | 12 | 24 | fluid, 24 page padding |
| `xl` (desktop) | 1440 | 12 | 24 | max 1440, centred, 32 page padding |

- Header height is **56px** at every breakpoint.
- No horizontal body scroll at any width ≥320px. Wide tables scroll **inside their own container**,
  with the leading identity column sticky and a `--border-strong` right edge on it.
- Charts are responsive by container query/measured width, never by breakpoint alone.

### 5.4 Elevation — two levels, and the dark model is different

| Token | Light | Dark |
|---|---|---|
| `--elev-0` | flat on `--surface-canvas` | flat on `--surface-canvas` |
| `--elev-1` (panels, cards, header) | `--surface-raised` + `0 1px 2px rgb(0 0 0 / 0.06)` + `1px --border-subtle` | `--surface-raised` + `1px --border-subtle`, **no shadow** |
| `--elev-2` (popovers, menus, sheets, tooltips) | `--surface-overlay` + `0 8px 24px rgb(0 0 0 / 0.10)` + `1px --border-subtle` | `--surface-overlay` + `0 12px 32px rgb(0 0 0 / 0.55)` + `1px --border-strong` |

Dark mode expresses elevation by **surface step plus border**, because a soft shadow on a near-black
canvas is invisible; overlays are the only dark-mode shadow, and it is deep enough to read. That is
what "dark mode is designed, not flipped" means in practice.

There is no `--elev-3`. If something needs to float above an overlay, the design is wrong.

---

## 6. Charts — form before colour

Two libraries, one visual language. Recharts for standard charts, visx for lap-level charts
(`ARCHITECTURE.md` §4). **They must be indistinguishable to a user** — shared axis, grid, legend and
tooltip components; shared tokens.

### 6.1 Specify every chart in this order

1. **The job** — magnitude, identity, polarity, change-over-time, or a single headline number.
   Sometimes the answer is a stat tile, not a chart.
2. **The form** — the type, and why it beats the alternatives for that job.
3. **Marks** — thin marks, 2px lines, ≥8px markers, 4px rounded data-ends anchored to the baseline,
   2px surface gaps between fills.
4. **Interaction** — crosshair + tooltip on line/area; per-mark tooltip on bar/dot/cell. Hit targets
   larger than the mark. Filters in one row above the chart.
5. **Colour** — last, per §3.
6. **Accessibility** — legend for ≥2 series; direct labels at ≤4; a table view for every chart;
   texture available for the CVD/print case.

### 6.2 Non-negotiables

- **Never a dual-axis chart.** Two measures of different scale → two charts, small multiples, or both
  indexed to a common base. This is the single most common serious charting defect.
- **Colour follows the entity, never its rank.** A filter that changes the series count must not
  repaint the survivors.
- **Categorical colours in fixed order, never cycled.** A 9th series is not a generated hue.
- **Text wears text tokens, never the series colour.** A coloured mark beside a label carries
  identity; the label itself stays in ink.
- **Recessive grid and axes.** The data is the subject. Grid lines `--border-subtle`, axis lines
  `--border-strong`, tick labels `--ink-tertiary` at `--text-2xs`, values `--font-mono`.
- **A table view exists for every chart** — accessibility, and the discharge of the contrast WARN
  in §3.2.

### 6.3 Per-chart specifications — _TO BE COMPLETED IN F1_

One entry per chart type in the product: championship progression, points gap, position chart,
lap-time trace, stint timeline, pace degradation, pit timeline, grid-vs-finish, comparison views,
records leaderboards.

---

## 7. Components

Full inventory with every state — button, select, tabs, card, table, badge, chip, tooltip, skeleton,
empty state, no-coverage state, driver avatar, team crest, compare tray, season selector, metric
picker, normalization notice — is **F1**. F0 specifies the shell subset below, completely.

### 7.0 State matrix

Every interactive component defines: `default` · `hover` · `active` · `focus-visible` · `disabled` ·
`loading`. Every data component defines: `loading` · `empty` · `error` · `partial` · `no-coverage`.
A component missing a state is incomplete, not "to be added later".

### 7.1 Button

| Variant | Rest | Hover | Active | Disabled |
|---|---|---|---|---|
| `primary` | `--ink-primary` fill, `--ink-inverse` label | fill lightens/darkens one ink step toward `--ink-secondary` | `scale(0.985)` | `--surface-sunken` fill, `--ink-tertiary` label, `1px --border-subtle` |
| `secondary` | `--surface-raised`, `1px --border-control`, `--ink-primary` label | `--surface-overlay` | `scale(0.985)` | as above |
| `ghost` | transparent, `--ink-secondary` label | `--surface-overlay` | `scale(0.985)` | `--ink-tertiary` label |
| `danger` | `--status-critical-wash` fill, `--status-critical-ink` label, `1px --status-critical-ink` at 24% | wash one step deeper | `scale(0.985)` | as `secondary` |

Sizes: `sm` 28px high / `--text-xs` / padding-x 8; `md` 36 / `--text-base` / 12; `lg` 44 /
`--text-md` / 16. Radius `--radius-md`. Icon-only buttons are square at the same heights, with a
**44×44 minimum hit area** on touch via padding, and always an `aria-label`.
Loading: label stays in place, a 14px spinner replaces the leading icon slot, `aria-busy="true"`,
width does not change. Motion: M-6.

### 7.2 Badge / chip

`--radius-sm`, 20px high, padding-x 6, `--text-2xs` uppercase (labels) or `--font-mono` `--text-xs`
(values). Forms: `neutral` (`--surface-sunken` + `--ink-secondary` + `--border-subtle`),
`status-*` (wash + ink + icon + label), `timing-*` (wash + ink + marker glyph, §3.4.2),
`identity` (colour chip + ink label, §3.3).

### 7.3 Data-currency indicator (NV-9)

The design decision: **express currency as coverage, never as a fetch event.** "Complete through
Round 10 of 24" is a fact about the sport's calendar. "Updated 12 days ago" is a fact about a
process. Coverage phrasing is also the more honest of the two — `REQUIREMENTS.md` §2.2 warns the
newest round may lag reality, and coverage phrasing states exactly that without pretending to know
today's calendar position.

| Element | Spec |
|---|---|
| Trigger (≥768px) | `ghost` button, 28px high, containing an 8px `--radius-full` dot in `--ink-tertiary` (**static** — never pulses, §4.5), then `--font-mono` `--text-xs`: `2026 · R10` |
| Trigger (<768px) | dot + `R10` only |
| Accessible name | `"Data coverage: 2026 season, 10 of 24 rounds complete. Show detail."` |
| Detail | popover, `--elev-2`, max-width 320, `--radius-xl`, M-5, dismiss on Esc / outside click, focus returns to the trigger |
| Footer echo | the same facts as plain text, so the information is reachable without opening anything |

Copy — every value comes from `GET /api/meta`, nothing hardcoded:

- Popover heading: **"Data coverage"**
- Line 1: **"Complete results through Round {n} of {total} — {roundName}, {date}."**
- Line 2: **"Rounds {n+1}–{total} are scheduled and have no results yet."** _(omitted when the season
  is complete)_
- Line 3: **"Seasons available: {minYear}–{maxYear}."**
- Footer echo: **"Complete results through {year} Round {n} · Seasons {minYear}–{maxYear}"**

Banned from this component and its tests, fixtures and comments: any word for a refresh or update
mechanism. The component states coverage of the sport's calendar, never an update event
(`REQUIREMENTS.md` §2.2).

### 7.4 The five states, designed

Shared anatomy — one `StateCard` primitive, so all five look like one family: 40px icon tile
(`--radius-md`), title, body, optional action row, optional mono code chip. `--elev-1`,
`--radius-lg`, padding 24 (16 on mobile), `text-align: start`, max-width 560 when standalone.
When a state replaces a chart, it fills the chart's box and **holds its height** (min 240px) so the
page does not reflow (M-8).

| State | Icon tile | Title (`--display-xs`) | Body (`--text-base`, `--ink-secondary`) | Action |
|---|---|---|---|---|
| **loading** | — | — | skeleton geometry only; never a spinner for a whole panel | — |
| **empty** | `--surface-sunken` + `--ink-tertiary` | "Nothing to show here" | "There are no {items} for this selection." | "Clear filters" (`secondary`) if filters are active |
| **no-coverage** | `--surface-sunken` + `--ink-tertiary`, **1px dashed `--border-subtle`** on the card | "{Metric} isn't available for {year}" | "{Metric} data begins in {firstYear}. {Year} has {whatDoesExist}." | "View {firstYear}" (`secondary`) when a nearest-year target exists |
| **error** | `--status-critical-wash` + `--status-critical-ink` + alert icon | "Something went wrong" | "This view couldn't be loaded." | "Try again" (`primary`) + mono code chip |
| **database unavailable** | `--status-critical-wash` + `--status-critical-ink` + database icon | "No database found" | see below | "Try again" (`primary`) |

**The no-coverage state is the most-seen state in the product** and must **explain, not apologise**.
It is neutral, not a warning (§3.4.3). Concrete copy per boundary:

| Boundary | Copy |
|---|---|
| Lap data (1996) | "Lap-by-lap timing isn't available for 1976. Lap data begins in 1996. 1976 has full race classifications, grids and championship standings." |
| Pit stops (2011) | "Pit stop data isn't available for 2005. Pit data begins in 2011, so stints, strategy and pit timings can't be shown for this race." |
| Qualifying (1994) | "Qualifying positions aren't available for 1985. Qualifying data begins in 1994." |
| Q1/Q2/Q3 (2006) | "Segment-by-segment qualifying isn't available for 2001. Q1, Q2 and Q3 times begin in 2006." |
| Sprint (2021) | "There was no sprint at this event. Sprint races begin in 2021." |
| Practice | "Practice sessions are listed for schedule only — no timing is available for them." |

Coverage-aware controls (NV-8) reuse the same sentences in a tooltip on the disabled control, so the
explanation is identical wherever the user meets the boundary.

**Database-unavailable copy in full.** A developer hits this on a fresh clone, so it is instructional
and it never leaks a filesystem path (S-6 — the path shown is static UI copy, not echoed from the
server):

> ### No database found
> This application reads a local SQLite database at `data/f1.db`. That file is supplied separately
> and is not part of the repository.
>
> 1. Put the database file at `data/f1.db`, relative to the project root.
> 2. Restart the dev server: `npm run dev`
>
> Seasons 1950–2026 are available once the database is in place.
>
> `DATABASE_UNAVAILABLE`   [ Try again ]

Also: **`404`** — "No page at this address" / "The link may be wrong, or the season, driver or team
may not exist." / "Go to the current season" (`primary`). F9 owns the searchable version.

### 7.5 Skeletons

Skeletons mirror the geometry of what is coming — a table skeleton is rows, not a grey slab. Built
from `--surface-sunken` blocks at `--radius-sm`, text-line skeletons at the line-height of the step
they replace and 40–70% width, varied per row. Motion M-7. Never more than 8 skeleton rows,
regardless of the eventual row count. Container carries `aria-busy="true"`; the skeleton itself is
`aria-hidden`.

### 7.6 Placeholders are permanent infrastructure

881 drivers and 214 teams will never all have images. The driver placeholder (code on a
team-coloured field) and the team monogram are shipping components with the same design care as
everything else — not stopgaps. _Full spec in F1 (F4/F5 consume them); the asset contract is
`PLAN.md` R1/R2._

---

## 8. Accessibility — binding

- Contrast: text meets WCAG AA (§9.2 V-2 — every text token pair PASSes in both modes). Chart marks
  below 3:1 (§3.2) carry visible labels or a table view.
- Identity is **never colour-alone** — legend plus direct labels. Timing and status colours carry a
  glyph and an accessible name (§3.4.2, §3.4.3).
- Full keyboard operation; the single focus ring of §3.5.1, never removed; sensible tab order.
- A skip link is the first focusable element on every page: "Skip to main content".
- Landmarks: `header` → `nav` → `main` (`id="main"`) → `footer`. One `h1` per route.
- All imagery has meaningful alt text; decorative imagery is `aria-hidden`.
- `prefers-reduced-motion` (§4.4) and `prefers-color-scheme` (§10) both honoured.
- Disabled controls stay legible and keep an accessible explanation (§3.5.2).
- Hit targets ≥44×44 on touch.

---

## 9. Validation record

### 9.1 The validator — method, so any run is reproducible

Colour is never argued about in this project; it is computed. Every palette introduced or changed is
run through this procedure, in **both** modes, against **that mode's own surfaces**.

1. sRGB → linear → CIEXYZ (D65) → **CIELab**; separation measured as **CIEDE2000**.
2. Lightness and chroma gates measured in **OkLCh**.
3. Contrast measured as **WCAG 2.1 relative luminance** ratio.
4. CVD simulated at severity 1.0 by **two** independent models — **Viénot, Brettel & Mollon (1999)**
   LMS dichromat projection and **Machado, Oliveira & Fernandes (2009)** matrices, both applied in
   linear RGB — for protanopia, deuteranopia and tritanopia. **The worse of the two models is the
   reported figure.** Tritan simulation is the least reliable part of either model, which is why the
   pessimistic value is used.
5. Floors: **normal-vision separation ΔE ≥ 15**; **CVD separation ΔE ≥ 8**; **text contrast ≥ 4.5:1**;
   **interactive-boundary and mark contrast ≥ 3:1**; **chroma ≥ 0.05** for any colour expected to
   read as a hue.
6. Lightness bands (OkLCh L) for plotting marks: **light mode 0.40–0.72**, **dark mode 0.55–0.88**.
7. Where hue is fixed by convention (§3.4) or by identity (§3.1), L and C are chosen by exhaustive
   search over the in-sRGB-gamut options that satisfy the contrast floors, maximising the **minimum**
   pairwise CVD separation. Residual failures are recorded and mitigated structurally — never hidden.

The F0 implementation lives in the designer's working directory, not the repository. **F1 must land
it as `scripts/validate-palette.mjs` with a `npm run validate:palette` script**, so the reviewer can
re-run it. Flagged for the `principal-engineer`.

### 9.2 Runs

| ID | Date | Palette | Mode | Result |
|---|---|---|---|---|
| — | 2026-08-04 | 2026 grid brand colours (11) | light | **FAIL** — normal-vision, CVD, chroma, lightness (§3.2) |
| — | 2026-08-04 | 2026 grid brand colours (11) | dark | **FAIL** — lightness (6), chroma, CVD, normal-vision (§3.2) |
| **V-1** | 2026-08-04 | **Calibration** — reproduce the two rows above with the §9.1 validator | both | **REPRODUCED.** Cadillac↔Haas ΔE **3.82** (recorded 3.8) · Haas OkLCh C **0.0056** (0.006) · Cadillac C **0.0043** (0.004) · Mercedes OkLCh L **0.786** (0.786) · RB↔Alpine deuteranopic ΔE **3.17** Viénot / 2.90 Machado (recorded 3.3). Tritan differs by model (4.62 Viénot / 3.49 Machado vs 1.6 recorded) — **verdict identical, both far below the floor of 8**; the earlier run used a different tritan model. Light-surface contrast figures reproduce exactly when the surface is set to the ≈`#FCFCFC` used in the original run. |
| **V-2** | 2026-08-04 | Neutrals — surfaces / ink / borders (§3.5), 11 tokens each mode | light | **PASS** — ink-primary 16.70 / 15.72 / 14.76 on raised / canvas / sunken; ink-secondary 7.26 / 6.84; ink-tertiary 5.18 / 4.88 / 4.58 (floor 4.5); border-control 3.42 / 3.22 / 3.03 (floor 3.0); ink-inverse on ink-primary 16.70 |
| **V-2** | 2026-08-04 | Neutrals (§3.5) | dark | **PASS** — ink-primary 15.89 / 17.84 / 18.54; ink-secondary 8.38 / 9.41; ink-tertiary 4.87 / 5.46 / 5.68; border-control 3.05 / 3.42 / 3.56 |
| **V-3** | 2026-08-04 | F1 timing semantics, 3 ink + 3 wash (§3.4.1) | light | **PASS on contrast** (ink/wash 4.63 / 4.70 / 6.06; ink/raised 5.50 / 5.40 / 7.13). **2 CVD FAILs:** green↔yellow deutan **6.9**, purple↔yellow tritan **7.2** (floor 8). Normal-vision separation 27.0–64.8, all PASS. Mitigated structurally per §3.4.2 |
| **V-4** | 2026-08-04 | F1 timing semantics (§3.4.1) | dark | **PASS** — min CVD ΔE **9.2** (green↔yellow deutan), min normal ΔE 35.0; ink/wash 4.83 / 10.04 / 7.80 |
| **V-5** | 2026-08-04 | Status, 4 ink + 4 wash (§3.4.3) | light | **PASS on contrast** (ink/wash 7.18 / 4.94 / 6.14 / 5.18). **1 CVD FAIL pair:** caution↔critical protan **7.5**, deutan **7.8** (floor 8). All other pairs PASS. Mitigated by mandatory icon + label |
| **V-6** | 2026-08-04 | Status (§3.4.3) | dark | **PASS** — min CVD ΔE **8.1** (caution↔critical tritan), min normal ΔE 38.2 |
| **V-6b** | 2026-08-04 | Rejected 5-level status set (`warning` + `serious` both present) | light | **FAIL** — warning↔serious deuteranopic ΔE **0.4**, tritanopic **4.6**, normal 18.0. Basis for collapsing to `caution` (§3.4.3) |
| **V-7** | 2026-08-04 | `--timing-green-ink` vs `--status-good-ink` — must be distinct tokens | both | **DISTINCT** — ΔE 9.9 light (`#087B30` vs `#0A7554`), 11.4 dark (`#47FF79` vs `#26F0B0`) |
| **V-8** | 2026-08-04 | 2026 brand colours vs the §3.5 surfaces — **identity use only** | light | **WARN, unchanged** — 6 of 11 below 3:1 vs `--surface-raised`: Mercedes 1.84, Cadillac 2.32, Haas 2.66, RB 2.77, McLaren 2.82, Alpine 2.89. Pass: Aston Martin 3.58, Audi 3.73, Red Bull 3.90, Ferrari 4.44, Williams 5.20. Discharged by the identity-surface rule in §3.3 |
| **V-8** | 2026-08-04 | 2026 brand colours vs the §3.5 surfaces | dark | **PASS** — all 11 ≥3:1 vs `--surface-raised` (lowest Williams 3.28, highest Mercedes 9.26) |
| **V-9** | 2026-08-04 | Focus ring — achromatic double ring (§3.5.1) | light | **PASS** — worst adjacent colour Red Bull `#4781D7`; better of the two rings **4.28:1** (floor 3.0) |
| **V-9** | 2026-08-04 | Focus ring (§3.5.1) | dark | **PASS** — worst adjacent colour Ferrari `#ED1131`; better of the two rings **4.14:1** |

**Still to validate in F1:** the derived per-theme chart-safe brand variants (§3.3 rule 6), the
deterministic fallback ramp for the 202 colourless teams (§3.1), and the collision-detection
thresholds (§3.3 rule 4).

---

## 10. Theming mechanics

- Tokens are **CSS custom properties** on `:root`, overridden under `[data-theme="dark"]`, so
  Tailwind, Recharts and visx all read the same values (`ARCHITECTURE.md` §2).
- Preference is `system | light | dark`, stored at `localStorage["f1a.theme"]`, default `system`.
- `prefers-color-scheme` is honoured on first load, and continues to be honoured — while the
  preference is `system`, changing the OS setting changes the app live (`matchMedia` listener).
- **No theme flash.** `public/theme-init.js` — a few lines, **external**, referenced from `<head>`
  **synchronously** (no `defer`, no `async`, no `type="module"`) and **before the stylesheet** — reads
  the stored preference and sets `data-theme` on `<html>` before first paint. A flash of the wrong
  theme is a defect, not a nuance.
  - It is **external and not an inline `<script>` on purpose**: the CSP `script-src` is `'self'` with
    no `'unsafe-inline'` (S-9), so an inline block is a CSP violation, not a shortcut. Do not
    "simplify" this back into `index.html`. Matches `PLAN.md` F0 Technical Spec §3.6 and
    `ARCHITECTURE.md` §7.3.
- `<html>` also carries `color-scheme: light` / `dark` so form controls, scrollbars and the
  browser's own surfaces match.
- Theme changes animate per M-11 and nothing else.

---

## 11. Document change log

| Date | Change | By |
|---|---|---|
| 2026-08-04 | Handover created with the measured §3 / §4 constraints | principal-engineer |
| 2026-08-04 | F0: §1 intent, §2 typography (Archivo / Inter / Chivo Mono, verified), §3.4 exact semantic steps + status set reduced to four with evidence, §3.5 surfaces / ink / borders / focus for both themes, §4 motion token set + 11 named motions with Framer Motion references, §5 spacing / radii / breakpoints / elevation, §7.0–§7.6 shell components and the five states, §8 accessibility, §9 validator method + 9 recorded runs, §10 theming mechanics | designer |
| 2026-08-04 | D-1 fix: §10 pre-paint theme script corrected from an inline `index.html` block to external `public/theme-init.js`, with the CSP (`script-src 'self'`, S-9) reason recorded. No token, colour, type, motion or component change; no re-validation required | designer |
| 2026-08-04 | **CR-005** (`PLAN.md` §5.5): the upstream-attribution constraint is removed from §7.3 as a forward obligation — both the release-blocker framing and the derived clause in the ban list. The §7.3 ban on refresh/update language is **retained on independent grounds** (`REQUIREMENTS.md` §2.2 — a currency surface must not assume today's calendar position). **No copy string changed**: the coverage phrasing survives on its own merits. No token, colour, typography, motion or component change → no §9 validation run | designer |
