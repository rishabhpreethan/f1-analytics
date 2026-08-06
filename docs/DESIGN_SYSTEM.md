# Design System

**Status: FOUNDATIONS COMPLETE (F0), REVISED BY CR-007.** Owned by the `designer`.

Sections **§1, §2, §3.4, §3.5, §3.6, §4, §5, §7.0–§7.4, §7.7, §8, §9, §10** are authored and binding.
Sections still marked _TO BE COMPLETED IN F1_ are deliberately deferred: per-chart specifications,
the full component inventory, and the internals of team-colour resolution.

Everything in **§3.1–§3.3** and **§6.2** was **measured, not assumed** — do not re-litigate it, and do
not soften it. §9 records every validation run, including the run that reproduces the original
measurements with the validator described in §9.1.

> ### ⚠ CR-007, 2026-08-06 — three reversals you must read before using this document
>
> Rishabh ran the F0 shell built to the pre-CR-007 version of this file and rejected it: *"too basic
> and too bland"*, *"too ew"*, *"it should look like wow what a website"*. Three of this document's
> decisions were the cause, and all three are now **reversed**:
>
> | Was | Now |
> |---|---|
> | §1.1 decision 1: **"The chrome is achromatic. There is no brand accent hue."** | **There is one accent hue — "Signal", OkLCh hue 350** — with a full validated ramp (**§3.6**) and mandated placement on every surface. Neutral-only chrome was measured to read as unfinished rather than restrained. |
> | §4: **Framer Motion**, its string easings and its `visualDuration` springs | **GSAP.** `framer-motion` is removed from the product. Specifying it, importing it, or naming a Framer Motion ease is a **defect**. §4 is rewritten. |
> | The shell was a **static top nav bar** with motion only on route change | A **`CommandDock`** (left rail ≥1024px, floating bottom dock below) plus a **fixed animated background** (`AtmosphereField`, §7.7) and **pointer-aware feedback on every interactive element** (§4.6 G-8/G-9/G-21). |
>
> Everything **§3.1–§3.5 measured** survives untouched: brand colours are still identity-only, the
> focus ring is still achromatic (re-measured against the new accent in §9.2 **V-11** — it still
> passes), the timing semantics are still purple/green/yellow and the accent is barred from all three.

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

**1. The chrome carries exactly one hue, and it is a hue the sport does not use.** _(Revised by
CR-007. The previous decision — achromatic chrome, no accent at all — is reversed.)_

The original argument was: every usable hue is already some team's identity, therefore the interface
should have no hue. The first half of that is true and stays true. The conclusion was wrong, and the
built result proved it: a shell with no accent read as **unfinished**, not as restrained. Restraint
without a focal point is just absence.

The correct resolution is not "no hue" but **one hue, chosen by measurement to be the one hue the
sport has not claimed**. That colour is **Signal** — OkLCh hue **350**, a hot magenta-rose (§3.6). It
was not picked by taste: every hue on the wheel was scanned against the twelve brand colours, the
three reserved timing semantics and the four status colours (§9.2 **V-10**), and hue 350 is inside
the only band that clears the **normal-vision ΔE ≥ 15 floor against all nineteen of them at once**.

So the hierarchy of colour in this product is now three-layered, and each layer has one job:

| Layer | Colour | Job | Never |
|---|---|---|---|
| **Identity** | the twelve brand colours (§3.1) | which team / which driver | never a chart palette on its own (§3.2) |
| **Semantics** | purple / green / yellow, plus four status colours (§3.4) | what a timing value or a system state *means* | never a series colour, never the accent |
| **Interface** | **Signal**, one hue (§3.6) | *this responds to you* — interactivity, focus of attention, brand presence | never meaning; never identity; never a series colour |

Signal marks **the interface's own voice**: the primary action, the active destination, the thing
under the pointer, the atmosphere behind the product. A team's colour is still the loudest thing in a
standings table, because Signal never appears inside one — it appears on the chrome around it.

**And the accent must be conspicuous, not homeopathic.** §3.6.4 lists the surfaces where it is
*required*. A build in which the accent appears only on a focus ring has failed this decision as
surely as the neutral build did.

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
| `--display-2xl` | 80 | 72 | Archivo 700 · wdth 82 | −0.025em | **CR-007** — landing headline, tablet |
| `--display-3xl` | 112 | 96 | Archivo 700 · wdth 82 | −0.032em | **CR-007** — landing headline, desktop. The one deliberate "moment" size in the product |

**The rule about the ramp.** The text region (11→18) steps by roughly 1.09–1.15 and is snapped to
whole pixels, because fractional sizes blur at 13px in a table of 20 rows. The display region
(20→112) steps by roughly 1.2–1.4, because large type needs visible jumps to establish hierarchy.
**The scale is the list above.** A size not in the list is a review failure — including "just this
once" values inside chart configs.

**The two CR-007 steps exist because the rejected build's largest type was 44px, and nothing on
screen was big enough to be a moment.** They are reserved for **one element**: the landing headline
(`PLAN.md` F0 Design Spec §3.2). They are not available to any other surface without a design-system
amendment.

**Responsive display sizing steps discretely, never fluidly.** `clamp()` and `vw` units are
**forbidden** for type, because they produce sizes that are not on the scale. The landing headline is
`--display-xl` below 768, `--display-2xl` at 768–1439, `--display-3xl` at 1440+ — three exact values,
switched at the §5.3 breakpoints.

Uppercase is used only at `--text-2xs` and at `--display-2xl` / `--display-3xl` (the landing headline
is set in caps), and only for labels and that headline — never for sentences.
Maximum measure for prose is `68ch`; for the landing sub-headline, `52ch`.

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
| Selected (nav, tabs, segmented) | `--ink-primary` label + a 2px `--ink-primary` rule (§4.6 G-3) |
| Selected (chip, toggle) | `--ink-primary` fill + `--ink-inverse` label |
| Link | `--accent-ink` with a 1px `currentColor` underline at `0.14em` offset; hover sweeps a 2px `--accent-mark` underline in from the left (G-10). _CR-007: was achromatic._ |
| Disabled | `--ink-tertiary` text, `--surface-sunken` fill, `--border-subtle`, `opacity: 1` (never faded — a disabled control must stay readable so its explanation can be read too), `cursor: not-allowed`, `aria-disabled="true"` |

**CR-007 amendment.** Rows 1–4 above are superseded where an accent expression exists in §3.6.4.
Hue is now *available* for the interface's own states; what remains forbidden is hue as the **only**
difference between two states, and hue on anything that carries identity or meaning.

| State | Expression (CR-007) |
|---|---|
| Hover | surface steps one level toward `--surface-overlay`, **plus** a pointer-tracked `--accent-glow` spotlight at 14% (G-8) on cards and dock items; `-1px` translateY on cards only |
| Active / pressed | `scale(0.985)`; surface steps back down |
| Selected (nav, dock, tabs, segmented) | `--accent-wash` fill + `--ink-primary` label + a **2px `--accent-mark` rule** (G-3) |
| Selected (chip, toggle) | `--accent-fill` + `--accent-on` label |

---

### 3.6 The interface accent — "Signal", OkLCh hue 350

**Added by CR-007.** Every value below was computed, not chosen; the runs are §9.2 **V-10 … V-17**.

### 3.6.1 Why hue 350, and why nothing else

The whole hue wheel was scanned in 5° steps (§9.2 **V-10**). At each hue the validator built the
maximum-chroma colour that still clears **4.5:1 as text on all three light surfaces**, then measured
its separation from the twelve brand colours and the seven reserved semantic colours.

| Candidate band | Verdict |
|---|---|
| **h 30–140** (orange → yellow → yellow-green) | **Rejected.** Normal-vision ΔE to the reserved yellow falls to **8.3** at h 90 and stays under 15 through h 140. This band *is* the reserved yellow/green. |
| **h 140–195** (green → teal) | **Rejected.** ΔE 1.74 to the reserved green at h 150; Sauber, Aston Martin and Mercedes all live here. |
| **h 195–215** (dark teal) | **Rejected on judgement, not measurement** — it clears the floors (ΔE 25–30 to semantics, 19–22 to brands) but a dark teal accent is the default of every SaaS dashboard, which is precisely the "looks like a template" failure CR-007 exists to fix. Recorded so the option is not re-discovered as new. |
| **h 220–265** (blue) | **Rejected.** ΔE 2.66 to Red Bull at h 255, 5.65 to Williams at h 250. Four of twelve teams are blue. |
| **h 265–340** (violet → orchid → magenta-violet) | **Rejected.** ΔE **1.10** to the reserved timing purple at h 305, and still only 13.19 at h 335 — under the floor. This is the band most dashboards default to, and it is the one band the F1 timing convention absolutely forbids. |
| **h 345–20** (magenta → rose → crimson) | **The only surviving band.** |
| **h 350** | **Chosen.** Normal-vision ΔE **20.09** (light) / **21.03** (dark) to the reserved purple, **25.59** / **24.66** to `status-critical`, **≥55** to green and yellow, and **26.0 to Ferrari** — the largest brand-separation figure available anywhere in the surviving band. h 0 scores marginally better against the semantics but drops to **19.5 against Ferrari**, and "reads a bit like Ferrari red" is the one confusion this product can least afford. |

**Signal is not a racing colour, on purpose.** It is the *instrument's* colour — the highlight on a
piece of test equipment. That is exactly why it can never be mistaken for a team or for a lap time.

### 3.6.2 The ramp — eleven steps, hue 350, theme-independent

Generated in OkLCh at hue 350 with chroma taken to the sRGB gamut boundary at each lightness.
`--signal-*` is the **raw scale**; components consume the semantic aliases in §3.6.3, never the raw
steps.

| Token | Hex | OkLCh L | OkLCh C | Notes |
|---|---|---|---|---|
| `--signal-50` | `#FEF1F7` | 0.970 | 0.016 | |
| `--signal-100` | `#FFE2EE` | 0.940 | 0.035 | light-mode wash |
| `--signal-200` | `#FFC4DE` | 0.880 | 0.075 | |
| `--signal-300` | `#FF98CA` | 0.801 | 0.136 | dark-mode wash ink |
| `--signal-400` | `#FF61B7` | 0.720 | 0.210 | dark-mode hover |
| `--signal-500` | `#FE02A9` | 0.658 | 0.274 | **the hi-vis step.** Marks, borders, glow, dark-mode fill |
| `--signal-600` | `#D1018A` | 0.568 | 0.237 | light-mode ink and fill |
| `--signal-700` | `#A2006A` | 0.470 | 0.196 | light-mode hover and wash ink |
| `--signal-800` | `#700148` | 0.360 | 0.149 | |
| `--signal-850` | `#570036` | 0.300 | 0.125 | dark-mode wash |
| `--signal-900` | `#270016` | 0.180 | 0.075 | |

### 3.6.3 Semantic aliases — the only tokens a component may use

| Token | Light | Dark | Contract, and the measured figure (§9.2 V-11) |
|---|---|---|---|
| `--accent-ink` | `#D1018A` | `#FE02A9` | text / icon on any surface. **5.14 / 4.84 / 4.55** light on raised / canvas / sunken; **4.71 / 5.29 / 5.50** dark. Floor 4.5 — PASS |
| `--accent-ink-strong` | `#A2006A` | `#FF61B7` | hover state of accent text. 7.65 light / 6.21 dark on raised |
| `--accent-fill` | `#D1018A` | `#FE02A9` | primary button, selected chip, dock indicator pill |
| `--accent-on` | `#FFFFFF` | `#0E0F13` | the ink **on** `--accent-fill`. **5.14:1** light, **5.29:1** dark. Floor 4.5 — PASS |
| `--accent-fill-hover` | `#A2006A` | `#FF61B7` | with `--accent-on`: **7.65:1** light, **6.97:1** dark |
| `--accent-mark` | `#FE02A9` | `#FE02A9` | 2px rules, indicators, underlines, future chart marks. **3.62 / 3.41 / 3.20** light, **4.71 / 5.29 / 5.50** dark. Floor 3.0 — PASS. One value, both themes |
| `--accent-border` | `#FE02A9` | `#FE02A9` | interactive boundaries in accent. Same figures — floor 3.0 PASS in both themes |
| `--accent-wash` | `#FFE2EE` | `#570036` | tinted field: selected dock item, accent chip. **1.21:1** light / **1.18:1** dark against `--surface-raised` — i.e. a visible field, matched to the timing-wash precedent (1.15–1.25, §3.4.1) |
| `--accent-wash-ink` | `#A2006A` | `#FF98CA` | the ink **on** `--accent-wash`. **6.33:1** light, **7.27:1** dark. Floor 4.5 — PASS. `--ink-primary` on the wash also passes (13.81 / 13.41) |
| `--accent-glow` | `#FE02A9` | `#FE02A9` | the atmosphere orbs and the pointer spotlight. Always applied through an opacity — see §7.7 |
| `--accent-hairline` | `rgb(209 1 138 / 0.28)` | `rgb(254 2 169 / 0.34)` | 1px decorative accent rules (eyebrow rule, card top edge). Decorative — no contrast floor |

**`--accent-ink` is *not* usable as the focus ring.** The focus ring stays the achromatic double ring
of §3.5.1, and it was re-measured over the accent: **3.25:1 light / 3.37:1 dark** against
`--accent-fill`, floor 3.0 — PASS (§9.2 **V-11**). A focus ring must be visible over *every* surface
including team colours; an accent ring cannot promise that, and motion is never a focus indicator.

### 3.6.4 Where the accent is REQUIRED

This table is the answer to "the shell had no accent". A surface in the left column without its accent
expression is an incomplete implementation, not a stylistic choice.

| Surface | Accent expression |
|---|---|
| Primary button | `--accent-fill` + `--accent-on`; hover `--accent-fill-hover` plus a `0 0 0 4px` ring in `--accent-glow` at 18%, `dur.fast` |
| Secondary button | `--border-control` at rest; hover border → `--accent-border`, label → `--accent-ink` |
| Ghost button / icon button | hover: `--accent-wash` fill, `--accent-ink` glyph |
| Link | `--accent-ink` + underline sweep (G-10) |
| `CommandDock` — active item | `--accent-wash` pill + `--ink-primary` label + 2px `--accent-mark` edge rule (G-3) |
| `CommandDock` — hover item | pointer spotlight in `--accent-glow` at 14% (G-8), glyph → `--accent-ink` |
| Header wordmark | the terminal glyph (the `1` of "F1") set in `--accent-ink` |
| Header hairline | `--border-subtle`, with a 96px `--accent-mark` segment at the left, appearing on scroll (G-13) |
| Scroll progress bar | 2px `--accent-mark`, `scaleX` scrubbed (G-14) |
| Landing headline | the final word set in `--accent-ink` |
| Landing eyebrow | 24px `--accent-mark` rule preceding the label |
| Landing stat figures | figure in `--ink-primary`, unit/suffix in `--accent-ink` |
| `CapabilityCard` | 1px `--accent-hairline` top edge; index number in `--accent-ink`; hover spotlight (G-8) |
| `CoverageRuler` | the "available" span of each bar in `--accent-mark`; the unavailable span in `--surface-sunken` |
| Table row hover (F2+) | 2px `--accent-mark` leading edge, `scaleY 0→1` from the row's vertical centre, `dur.instant` |
| Skeletons | **no accent.** Skeletons stay `--surface-sunken` — an accent-coloured skeleton implies content that is not there |
| Timing chips, status chips, identity chips | **no accent, ever** (§3.4, §3.3) |
| Focus ring | **no accent** (§3.5.1) |
| Any chart series | **no accent** (§6.2). Signal is not a categorical colour |
| `AtmosphereField` | `--accent-glow` orbs and racing line (§7.7) |

### 3.6.5 The residual CVD failures, recorded and mitigated

Twenty colours now compete for hue space: 12 identity + 3 timing + 4 status + 1 accent. **No hue
exists that clears the §9.1 CVD floor of ΔE 8 against all nineteen others** — that is a combinatorial
limit, not a failure of search, and it was verified across the whole wheel (§9.2 V-10: the best
minimum-CVD-vs-status figure anywhere on the wheel is 14.7, and it occurs at hue 300, inside the
forbidden purple band).

Measured residuals for Signal (§9.2 **V-15 / V-16**), worse of the two CVD models:

| Pair | Worst CVD ΔE | Where |
|---|---|---|
| `--accent-ink` ↔ `status-info` | **0.46** protanopic | light mode |
| `--accent-ink` ↔ `status-critical` | **2.97** tritanopic light / **2.31** tritanopic dark | both |
| `--accent-mark` ↔ Audi `#FF2D00` | **0.80** tritanopic | both |
| `--accent-mark` ↔ McLaren `#F47600` | **2.18** tritanopic | both |
| `--accent-mark` ↔ Ferrari `#ED1131` | **3.46** tritanopic | both |
| `--accent-mark` ↔ Haas `#9C9FA2` | **6.63** deuteranopic | both |
| `--accent-ink` ↔ `timing-purple` | **11.05** tritanopic dark / 13.56 protanopic light | both — **PASS** |

**Normal-vision separation passes everywhere**: the minimum against any reserved semantic is
**20.09** and against any brand colour **26.00**, both above the floor of 15. So a user with full
colour vision can never mistake the accent for a lap-time semantic or for a team.

The mitigation is the one this system already runs on, and it is **structural, not optional**:

1. **The accent never carries meaning.** It marks *interactivity*. Interactivity is always
   simultaneously signalled by affordance — a button shape, a label, a `role`, a cursor, a focus
   ring. If a colour-blind user cannot tell the accent from `status-critical`, nothing is lost,
   because the critical state also carries an icon and a sentence (§3.4.3) and the button also
   carries a verb.
2. **The accent never carries identity.** Team colour always sits beside a team name (§3.3).
3. **The accent is never a series colour** (§6.2), so it never has to be told apart from a brand
   colour inside a plot.
4. **Tritanopia is the failing axis in five of the seven residuals.** §9.1 already records that
   tritan simulation is the least reliable part of either model, which is why the pessimistic value
   is reported; and tritanopia is the rarest of the three.

---

## 4. Motion — GSAP

> **CR-007 rewrote this entire section.** `framer-motion` has been **removed from the product**.
> Any `framer-motion` import, any Framer Motion ease string (`"easeOut"`, `"circOut"`, …), any
> `MotionConfig`, `AnimatePresence`, `layoutId`, `whileHover` or `visualDuration` spring anywhere in
> the codebase is a **defect**. One animation library.

### 4.1 The library, the plugins, and the measured cost

**GSAP 3.15.** Free for commercial use including every formerly paid plugin since April 2025.

Sizes below were **measured locally**, not quoted: `npm pack gsap@3.15.0`, then `gzip -9` of each
UMD `dist` file. These are upper bounds — the tree-shaken ESM build is smaller.

| Module | min | **gzip** | F0? | Why |
|---|---|---|---|---|
| `gsap` core (includes CSSPlugin and every core ease) | 72,927 | **28,314 B (27.7 KB)** | **yes** | everything |
| `ScrollTrigger` | 44,575 | **17,982 B (17.6 KB)** | **yes** | G-13 header hairline, G-14 scroll progress, G-15 section reveal |
| `SplitText` | 7,732 | **3,658 B (3.6 KB)** | **yes** | G-16 landing headline |
| `@gsap/react` (`useGSAP`) | — | ≈1 KB | **yes** | React 19 cleanup correctness — mandatory, see §4.4 |
| `MotionPathPlugin` | 22,002 | 9,706 B | **NO** | **avoided.** G-20 uses native CSS `offset-path` instead — same effect, 9.7 KB cheaper |
| `Flip` | 25,534 | 9,706 B | **NO** | deferred to **F4** (G-24, card → profile shared element) |
| `ScrollSmoother` | — | — | **NEVER** | hijacks native scrolling; an accessibility and perceived-performance regression on a data product |
| `Draggable`, `MorphSVG`, `DrawSVG`, `Inertia`, `GSDevTools` | — | — | **NO** | no surface needs them. Adding one is a `principal-engineer` decision |

**Honest correction to CR-007's premise.** CR-007 records that "GSAP is cheaper than what it
replaces". With ScrollTrigger included that is **false**: core + ScrollTrigger + SplitText =
**47.7 KB gzipped** against `framer-motion`'s measured **40.8 KB**, so the swap **costs ≈6.9 KB**.
The budget still holds comfortably — 147.46 − 40.8 + 47.7 ≈ **154.4 KB against a 250 KB ceiling**,
leaving ≈95 KB — but the claim in the CR is wrong and is corrected here rather than repeated.

**Do not hand-roll animation logic and do not invent easings.** Every named motion in §4.6 cites the
GSAP documentation page it derives from. Sources consulted for this section:
`gsap.com/docs/v3/Eases`, `gsap.com/docs/v3/GSAP/gsap.quickTo()`,
`gsap.com/docs/v3/GSAP/gsap.matchMedia()`, `gsap.com/docs/v3/Plugins/ScrollTrigger`,
`gsap.com/docs/v3/Plugins/SplitText`, `gsap.com/resources/React`, and Codrops,
*7 Must-Know GSAP Animation Tips for Creative Developers* (2025-09-03) for the `mask` and
`stagger.from` patterns.

### 4.2 Binding rules

- **The timing / easing / stagger set is defined once** here and in `src/lib/motion.ts`. Ad-hoc
  durations are how a product starts feeling incoherent — they are a review failure.
- **`prefers-reduced-motion` must be honoured everywhere**, with a *specified* reduced variant. For
  a looping animation the reduced variant is **stopped, not slowed** — see §4.4.
- **Never animate a chart on data update.** Mount and deliberate user action only. A chart that
  re-animates while someone is reading it is a defect.
- **Two budgets, not one** _(CR-007 amendment — the old single ~400ms rule contradicted a landing
  entrance and had to be split)_:
  - **Interaction path — 400ms hard ceiling.** Anything a hover, focus, tap, click or keystroke
    starts must be visually complete within 400ms. No exceptions.
  - **First-paint entrance — 1100ms total, 900ms for any single tween.** Applies only to a
    once-per-hard-load entrance sequence (G-16 and G-1) and only when nothing is waiting on it: the
    hero's content is present and readable in the DOM from frame one, so this is an entrance, never
    a gate. A second visit to the same route does not replay it.
  - **Ambient loops — unbounded duration, but see §4.5.** The atmosphere runs at 18–30s per cycle
    *because* slow reads as alive and fast reads as busy.
- Animate `transform` and `opacity`. **One documented exception:** `offset-distance` (G-20), which is
  composited and does not trigger layout — chosen specifically so the racing-line pulse costs nothing
  and needs no plugin.
- **Never animate a custom property that a colour token depends on.** Interpolating `--accent-ink`
  would repaint every consumer.

### 4.3 The token set — defined once, in GSAP's own vocabulary

**Easings are GSAP's named core eases.** No `cubic-bezier()` literal and no `CustomEase` exists in
this product. GSAP's default is `power1.out`; we never rely on the default, always naming the ease.

| Token | GSAP ease | Use |
|---|---|---|
| `ease.enter` | `"power2.out"` | anything appearing |
| `ease.exit` | `"power2.in"` | anything leaving |
| `ease.move` | `"power2.inOut"` | anything repositioning |
| `ease.mech` | `"circ.out"` | data marks growing — the one "mechanical" curve |
| `ease.arrive` | `"expo.out"` | long decelerations: the headline reveal, the dock indicator. Reads as weight transfer, which is the F1 feel |
| `ease.drift` | `"sine.inOut"` | **the only ease permitted in a `yoyo` loop** (the atmosphere) |
| `ease.none` | `"none"` | scrub-linked progress, and constant-rate loops (grid drift, comet) |

**Not adopted:** `back.*`, `elastic.*`, `bounce.*`, `rough`, `slow`, `steps`, `expoScale`,
`CustomEase`, `CustomBounce`, `CustomWiggle`. They overshoot or oscillate; this product decelerates
like a mechanism, it does not wobble. Using one is a review failure.

**Durations** — GSAP takes seconds. `src/lib/motion.ts` exports seconds; `tokens.css` mirrors the
same figures in ms for CSS transitions.

| Token | s / ms | Use |
|---|---|---|
| `dur.instant` | 0.08 / 80 | colour or ink change on a control, hover wash |
| `dur.fast` | 0.14 / 140 | tooltips, chips, small fades, press feedback |
| `dur.base` | 0.20 / 200 | content entering, popovers, route enter |
| `dur.slow` | 0.32 / 320 | sheets, trays, the dock rail, the dock indicator |
| `dur.chart` | 0.40 / 400 | chart mount only — never on data update |
| `dur.reveal` | 0.72 / 720 | the landing headline characters (entrance budget only) |
| `dur.pointer` | 0.60 / — | `quickTo` catch-up for pointer-following (G-8, G-9, G-21) |

**There is no spring token set any more.** Framer Motion's `visualDuration` + `bounce` API is gone
with the library. Its replacement is a **preset pair** — a duration and an ease, together:

| Preset | duration | ease | Use |
|---|---|---|---|
| `m.press` | `dur.instant` | `ease.enter` | `scale 0.985` on press |
| `m.control` | `dur.fast` | `ease.enter` | buttons, chips, rows, small feedback |
| `m.indicator` | `dur.slow` | `ease.arrive` | the dock's active-item indicator |
| `m.surface` | `dur.slow` | `ease.arrive` | sheets, trays, the dock rail expanding |
| `m.reveal` | `dur.reveal` | `ease.arrive` | headline characters |
| `m.pointer` | `dur.pointer` | `"power3.out"` | `quickTo` only — GSAP's own cursor-follow example uses `power3` at 0.4s; we run 0.6s for a heavier, more deliberate lag |

**Loop durations** — ambient only, never on an interaction path.

| Token | s | Target |
|---|---|---|
| `loop.grid` | 24 | grid layer drift (48px per cycle → 2 px/s) |
| `loop.orbA` | 18 | atmosphere orb A |
| `loop.orbB` | 24 | atmosphere orb B |
| `loop.orbC` | 30 | atmosphere orb C (neutral) |
| `loop.comet` | 11 | racing-line pulse, one lap |
| `loop.skeleton` | 1.2 | skeleton pulse |

**Staggers** — GSAP's object form, so `from` is explicit (Codrops tip 2).

| Token | Value | Use |
|---|---|---|
| `stagger.char` | `{ each: 0.018, from: "start" }` | SplitText characters |
| `stagger.nav` | `{ each: 0.035, from: "start" }` | dock items on mount |
| `stagger.row` | `{ each: 0.024, from: "start" }` | table rows |
| `stagger.card` | `{ each: 0.045, from: "start" }` | card and tile grids |
| `stagger.cap` | 12 | items after the 12th get **zero** delay — a 20-row stagger at 24ms would take 480ms and break the 400ms interaction ceiling |

### 4.4 Reduced motion is a `gsap.matchMedia()` condition, not an `if`

**Binding pattern.** Every non-essential animation is created inside a `gsap.matchMedia()` handler
gated on `"(prefers-reduced-motion: no-preference)"`. Per GSAP's own documentation, the handler's
animations are collected and **auto-reverted when the condition stops matching**, so:

- Under `reduce`, the tween is **never created**. There is nothing to slow down, nothing to pause,
  nothing left half-applied — the element sits at its authored CSS position. That is what "genuinely
  static" means, and it is the reason this is a `matchMedia` condition rather than a `duration: 0`.
- Toggling the OS preference **live** stops the atmosphere immediately, because `matchMedia` reverts.

```
const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => { /* ambient + spatial motion */ });
mm.add('(prefers-reduced-motion: reduce)',        () => { /* the reduced variant, if any */ });
```

Three rules follow:

1. **Opacity-only motion may live outside the guard**, and generally should — a 140ms crossfade is
   not what `reduce` is protecting against. Every §4.6 entry states which side of the line it is on.
2. **`useGSAP` from `@gsap/react` is mandatory** for anything created in a component. It wraps
   `gsap.context()` and reverts on unmount, which React 19 + StrictMode's double-invoked effects
   otherwise turn into duplicated conflicting tweens. Animations created *after* the hook runs — a
   click handler, a pointer handler — must be wrapped in the hook's `contextSafe()`.
3. **`gsap.matchMediaRefresh()`** is called by nothing in this product; the browser drives it.

### 4.5 What must never animate

- Any property that triggers layout (`width`, `height`, `top`, `margin`) — and **never** in a loop.
- Charts on data update (§4.2).
- Focus indicators.
- The data-currency indicator. It must not pulse, blink, or draw the eye — see §7.3.
- **Anything while the tab is hidden.** `requestAnimationFrame` does not fire in a hidden tab, so
  GSAP idles by construction; but the atmosphere timeline is **additionally** paused on
  `visibilitychange` and resumed on return, so a returning user does not meet a jump.
- **Anything at all inside a chart's plot area** other than the chart's own marks. The atmosphere is
  attenuated behind content (§7.7.5) precisely so this holds.

### 4.6 Named motions — G-0 … G-24

Every entry names its GSAP documentation reference, its trigger, target, property, duration, ease
**by GSAP name**, stagger, and its reduced-motion behaviour. **`reduce: not created` means the tween
lives inside the `no-preference` branch of `gsap.matchMedia()` (§4.4) and therefore does not exist —
that is the strongest form of "stopped".**

The old `M-1 … M-11` identifiers are **retired**. Any code comment or spec citing `M-n` is stale.

| ID | Motion | GSAP reference | Trigger | Spec | Reduced motion |
|---|---|---|---|---|---|
| **G-0** | Root reduced-motion guard | `gsap.matchMedia()` | app mount | one `gsap.matchMedia()` created in `src/lib/motion.ts`, exported; every ambient and spatial tween registers through it | — (this *is* the mechanism) |
| **G-1** | Shell mount — header, dock | `gsap.timeline`, Eases | once per hard load | timeline: header `opacity 0→1, y −6→0`, `dur.base`, `ease.enter`; then dock container `opacity 0→1, x −12→0` (rail) / `y 12→0` (bottom dock) at `-=0.10`; then dock items `opacity 0→1, x −6→0`, `dur.fast`, `stagger.nav`. Total **≤460ms** | opacity only, `dur.fast`, no stagger, no transform |
| **G-2** | Route content enter | `gsap.fromTo`, Eases | `location.pathname` change | `main > *`: `opacity 0→1, y 10→0`, `dur.base`, `ease.enter`. **No exit tween** — an exit would add its duration to every perceived navigation | opacity only, `dur.fast` |
| **G-3** | Dock active-item indicator | `gsap.from` + Eases | active route change, and rail resize | one absolutely-positioned indicator element, a **fixed 2×20px** bar (2×16 in the bottom dock) **vertically centred** on the active item. Rail: tweens `y` to `offsetTop + (height − 20) / 2`, `dur.slow`, `ease.arrive`; the 2px `--accent-mark` edge rule tweens `scaleY 0.4→1` over `dur.fast`. Bottom dock: the same on `x`, same timing | **not created** — the indicator is positioned by a single `gsap.set()`. It snaps. Correct and intended |

> **G-3 — two corrections landed 2026-08-06, after the build (CR-007 gates 4–5).** This row
> previously read `quickTo(el,"y")` to the active item's bare `offsetTop`, and did not state a fixed
> indicator length.
>
> 1. **`gsap.from`, not `quickTo`.** `quickTo` reuses a single tween instance, and `useMotion`
>    hard-codes `revertOnUpdate: true`, so no instance survives a dependency change — the setter
>    would be rebuilt from the current position on every route change and the travel would be lost.
>    The previous offset is carried in a `WeakMap` keyed by the element instead, the same pattern
>    `POINTER_SETTERS` uses. Duration and ease are unchanged.
> 2. **A fixed 2×20 / 2×16 bar, centred** — resolving a conflict between this file and Technical
>    Spec §S.3.6, whose `computeIndicatorGeometry` returned a scale factor and produced a bar as
>    long as the item (2×48 in the rail). On a purely visual matter this file governs; the resolution
>    is recorded in `PLAN.md` §S.3.6 and the function now returns `{ offset } | null` with no scale.
>    The lengths live in `tokens.css` in **px** — a `rem` length would not equal the JS centring
>    arithmetic — mirrored by `INDICATOR_LENGTH` and tied together by `index.css.test.ts`.
>
> Recorded by the coordinating session rather than the `designer`, as a factual correction to bring
> this row in line with shipped, reviewed code; no design intent was changed.
| **G-4** | Dock rail expand / collapse (≥1024) | `gsap.timeline`, Eases | `pointerenter` / `pointerleave` on the rail; `focusin` / `focusout`; the pin toggle | rail `width 64→232`, `dur.slow`, `ease.arrive`; labels `opacity 0→1, x −8→0`, `dur.fast`, `ease.enter`, `stagger {each:0.02}`, starting at `+=0.06`. Collapse reverses at `dur.base`, `ease.exit`. **`width` is animated here and this is the one permitted case** — it is a discrete user-initiated transition, not a loop, the rail is `position: fixed` so it triggers no layout in `main`, and the alternative (`scaleX`) would distort the glyphs | **not created.** Under `reduce` the rail is **permanently expanded at 232px** and the pin control is hidden — a hover-to-reveal affordance is exactly what reduced-motion users should not have to chase |
| **G-5** | Dock overflow sheet (<1024) | `gsap.timeline` | "More" tap | scrim `opacity 0→1`, `dur.fast`, `ease.enter`; panel `y 24→0` + `opacity 0→1`, `dur.slow`, `ease.arrive`; rows `opacity 0→1, y 8→0`, `dur.fast`, `stagger.nav`. Close reverses at `dur.base`, `ease.exit` | opacity only on scrim and panel, `dur.fast`, no stagger |
| **G-6** | Popover open / close (theme, coverage) | `gsap.fromTo` | trigger click / `Esc` / outside click | `opacity 0→1`, `scale 0.96→1`, `dur.fast`, `ease.enter`, `transformOrigin` at the trigger corner. Close: `opacity→0`, `scale→0.98`, `dur.instant`, `ease.exit` | opacity only, `dur.fast`, no `scale` |
| **G-7** | Control hover / press | Eases; `gsap.to` | `pointerenter`, `pointerdown` | hover: surface token step + `y −1` (cards only), `m.control`. Press: `scale 0.985`, `m.press`, released on `pointerup`. The focus ring is **CSS `:focus-visible`**, never a tween (§3.5.1) | token/colour change only — no `y`, no `scale`. Runs outside the guard as a CSS transition |
| **G-8** | **Pointer spotlight** | `gsap.quickTo` (docs: *"cursor-following"* example) | `pointermove` on a `CapabilityCard`, dock item, or panel header | two `quickTo` setters write the CSS variables `--px` / `--py` (in px, element-relative) at `m.pointer`; CSS paints `radial-gradient(220px circle at var(--px) var(--py), var(--accent-glow) 0%, transparent 62%)` at **opacity 0.14** as a `::before` layer under the content. One listener per card, throttled by rAF via GSAP's ticker. Only under `(pointer: fine)` | **not created.** Hover falls back to the flat `--surface-overlay` step of G-7 |
| **G-9** | **Magnetic CTA** | `gsap.quickTo` | `pointermove` within 96px of the hero's primary button | `quickTo(btn,"x")` / `("y")` to `(pointer − centre) × 0.14`, clamped to **±6px**, `m.pointer`. On `pointerleave`, both return to 0 at `dur.slow`, `ease.arrive`. Applied to **exactly one element in the product** — the hero CTA. A page of magnetic buttons is a toy | **not created** |
| **G-10** | Link underline sweep | `gsap.to` | `pointerenter` / `focus` on an inline link | a 2px `--accent-mark` pseudo-element, `transformOrigin: "left center"`, `scaleX 0→1`, `dur.fast`, `ease.enter`; reverses `ease.exit`, `dur.instant`. The 1px rest-state underline never disappears, so the link is underlined at all times | CSS-only: the rest underline thickens to 2px instantly. Not a tween |
| **G-11** | Skeleton pulse | `gsap.to` with `repeat: -1, yoyo: true` | skeleton mount | `opacity 0.55→1`, `loop.skeleton`, `ease.drift`, `repeat: -1`, `yoyo: true`. Opacity only — never `background-position`, never a transform | **not created.** Static `opacity: 0.7`. This is the one case a reader most often gets wrong: an opacity loop is exactly the kind of ambient motion `reduce` is asking to stop |
| **G-12** | Skeleton → content swap | `gsap.timeline` | query resolves | skeleton `opacity→0`, `dur.fast`, `ease.exit`; content `opacity 0→1`, `dur.base`, `ease.enter`, overlapping by 40ms. The container holds its height so nothing jumps | identical — opacity only |
| **G-13** | Header hairline on scroll | `ScrollTrigger` (`start`, `toggleActions`) | `window` scroll past 24px | `ScrollTrigger { start: "24px top", toggleActions: "play none none reverse" }` on a timeline: the header's 1px `--border-subtle` bottom border `opacity 0→1`, `dur.fast`; a 96px `--accent-mark` segment at the left `scaleX 0→1`, `transformOrigin: "left"`, `dur.base`, `ease.enter`; `--surface-glass` blur 6px→12px | border appears instantly at the same threshold via a `data-scrolled` attribute; no `scaleX`, no blur tween |
| **G-14** | Scroll progress bar | `ScrollTrigger` with `scrub: true` | scroll on `/` only | 2px `--accent-mark` bar fixed at `top: 0`, `transformOrigin: "left"`, `scaleX 0→1`, `ease.none`, `ScrollTrigger { trigger: "#main", start: "top top", end: "bottom bottom", scrub: true }`. Derives from the documentation's scrub-linked example | **not created.** The bar is not rendered at all under `reduce` — a scroll-linked bar is inherently motion, and `document`-level progress is not information the page needs |
| **G-15** | Section reveal on scroll | `ScrollTrigger` (`once: true`) | section enters the viewport | `opacity 0→1, y 16→0`, `dur.base`, `ease.enter`, `ScrollTrigger { start: "top 88%", once: true }`. Children stagger with `stagger.card`, capped at `stagger.cap`. Derives from the documentation's "reveal on scroll once" example | opacity only, `dur.fast`, `once: true`, no `y`, no stagger |
| **G-16** | **Landing headline reveal** | `SplitText.create` + `gsap.timeline` | `/` mount, once per hard load | `SplitText.create(h1, { type: "chars,lines", mask: "lines", aria: "auto", autoSplit: true })` — `mask` uses SplitText 3.13+'s built-in clip wrappers rather than hand-nested `overflow: hidden` divs (Codrops tip 1), and `aria: "auto"` puts an `aria-label` on the `h1` and `aria-hidden` on every char, which is why this is accessible. Then `gsap.from(split.chars, { yPercent: 118, opacity: 0, duration: dur.reveal, ease: "expo.out", stagger: stagger.char })`. 9 characters × 18ms + 720ms = **≈880ms**, inside the entrance budget | **not created — and no split is performed at all.** The `h1` renders as plain text and fades `opacity 0→1` at `dur.fast`. Splitting text under `reduce` is pointless DOM churn |
| **G-17** | Stat-figure count-up | `gsap.to` with `snap` | `/` mount, after G-16, once | `gsap.to(proxy, { value: target, duration: 0.9, ease: "power2.out", snap: { value: 1 }, onUpdate })`, staggered `{ each: 0.06 }` across the strip. Safe only because every figure is Chivo Mono tabular (§2.4) — a proportional font would reflow every frame | **not created.** The final value is written once with `gsap.set` |
| **G-18** | Atmosphere — grid drift | `gsap.to`, `repeat: -1` | app mount | grid layer (sized `calc(100% + 96px)`, offset `-48px`): `x: 48, y: 48`, `duration: loop.grid` (24s), `ease: "none"`, `repeat: -1`. Seamless because the cell is exactly 48px, so the loop has no visible seam and needs no `yoyo` | **not created.** The layer rests at its authored `-48px / -48px` offset |
| **G-19** | Atmosphere — orb drift | `gsap.to`, `yoyo` | app mount | three tweens, all `ease.drift` (`sine.inOut`), `repeat: -1`, `yoyo: true`: **A** `x: -64, y: 44, duration: loop.orbA` (18s); **B** `x: 88, y: -56, duration: loop.orbB` (24s), `delay: -6`; **C** `x: -40, y: -72, duration: loop.orbC` (30s), `delay: -11`. The negative delays desynchronise the three so the field never pulses in unison | **not created.** All three orbs rest at their authored positions — which is a composed, deliberate arrangement, not a degraded one |
| **G-20** | Atmosphere — racing-line pulse | `gsap.to` on CSS `offset-distance` | app mount, `/` only | the comet element declares `offset-path: path("…")` and `offset-rotate: auto` in CSS; GSAP tweens `offsetDistance: "0%" → "100%"`, `duration: loop.comet` (11s), `ease: "none"`, `repeat: -1`, `repeatDelay: 1.8`. **Deliberately not `MotionPathPlugin`** — native CSS motion path has been baseline-supported since 2022, is composited, and saves 9.7 KB gzipped. If `offsetDistance` proves un-tweenable in any target browser, the fallback is tweening a registered CSS variable and referencing it from `offset-distance`, still without the plugin | **not created.** The comet is `display: none`; the static racing-line stroke remains, which is the intended still image |
| **G-21** | Atmosphere — pointer parallax | `gsap.quickTo` | `pointermove` on `window`, `/` only, `(pointer: fine)` only | `quickTo(orbLayer,"x")` / `("y")` to `(pointer − viewportCentre) / 48`, clamped **±14px**, `m.pointer`. The grid, grain and vignette layers do **not** parallax — only the orbs, so the effect reads as depth rather than as the page sliding | **not created** |
| **G-22** | Theme change | — CSS, not GSAP | `data-theme` change on `<html>` | `background-color` and `color` transition `dur.base` / `ease-in-out` on `:root` and on `[data-theme] *`; **no transition on the `--*` custom properties themselves**, none on `transform`, none on the atmosphere's opacity | transition removed entirely — instant swap |
| **G-23** | List / grid reveal _(defined here, first used F2)_ | `gsap.from` with `stagger` | list mount | `opacity 0→1, y 8→0`, `dur.base`, `ease.enter`, `stagger.row` (rows) or `stagger.card` (grids), capped at `stagger.cap` | opacity only, `dur.fast`, stagger `each: 0` |
| **G-24** | Shared element card → profile _(defined here, first used F4; `Flip` is NOT installed in F0)_ | `Flip.from` / `Flip.getState` | route change between a card and its profile page | `const state = Flip.getState(targets)` before the route commits, then `Flip.from(state, { duration: dur.slow, ease: "power2.inOut", absolute: true, scale: true })`. Still the highest-value animation in this product | **not created.** The card and the profile render independently |

**Chart entry motion** (`ease.mech`, `dur.chart`, axis-anchored growth for bars, left-to-right
`strokeDasharray` draw for lines) is specified per-chart in §6.3 — F1.

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
| `--radius-full` | 9999 | avatars, dots, **the bottom dock's outer shell** |
| `--radius-2xl` | 20 | **CR-007** — the `CommandDock` rail, the dock overflow sheet. The only radius above 12, reserved for the two floating chrome elements so they read as objects rather than as panels |

### 5.2a Layering — one z-index scale, and nothing off it _(CR-007)_

A fixed animated background makes stacking order load-bearing. These are the only permitted values.

| Token | z-index | Element |
|---|---|---|
| `--z-atmosphere` | 0 | `AtmosphereField` — `position: fixed; inset: 0; pointer-events: none` |
| `--z-content` | 1 | `main`, the footer, and everything a route renders |
| `--z-header` | 30 | the sticky glass header |
| `--z-dock` | 40 | `CommandDock` |
| `--z-overlay` | 50 | popovers, sheets, scrims, tooltips |
| `--z-skip` | 60 | the skip link, when focused — it must be able to appear over the dock |

`main` carries `position: relative; z-index: var(--z-content)` for exactly one reason: to sit above
the atmosphere. Nothing inside `main` sets a z-index above 1 except an overlay.

### 5.2b Glass surfaces _(CR-007)_

Two chrome elements are translucent, so the atmosphere is visible moving behind them. This is the
detail that makes the chrome read as floating over a living surface rather than sitting on a page.

| Token | Light | Dark |
|---|---|---|
| `--surface-glass` | `rgb(255 255 255 / 0.72)` | `rgb(26 28 32 / 0.68)` |
| `--glass-blur` | `blur(12px) saturate(118%)` | `blur(12px) saturate(118%)` |

Applied to the header and to `CommandDock` as `background: var(--surface-glass); backdrop-filter: var(--glass-blur)`.

- **Fallback is mandatory:** `@supports not (backdrop-filter: blur(1px)) { background: var(--surface-raised); }` — an unblurred 72% white over a moving field is unreadable.
- **Measured (§9.2 V-12).** The worst-case composite — canvas, plus the accent orb at its authored
  opacity, plus grain, then the glass — is `#FCF5FB` light / `#261A27` dark. On those:
  `--ink-primary` **15.58 / 15.53**, `--ink-tertiary` **4.83 / 4.75** (floor 4.5), `--accent-ink`
  **4.80 / 4.60** (floor 4.5). **All PASS.** Every §9.2 V-2 figure therefore survives the glass.
- **Never apply `backdrop-filter` to more than these two elements.** It is the one expensive property
  in the system.

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

**CR-007 additions — chrome geometry.** These are fixed dimensions, named here so they are not
invented in a component. They are deliberately **not** on the 4px spacing scale's permitted subset,
which is why they are tokens (§5.1's restriction covers spacing utilities, not named dimensions).

| Token | px | Element |
|---|---|---|
| `--size-dock` | 64 | rail width when collapsed **and** bottom-dock height — the same number, so the two orientations feel like one object |
| `--size-dock-open` | 232 | rail width when expanded (G-4) |
| `--size-dock-inset` | 16 | the gap between the dock and the viewport edge, at every breakpoint |
| `--size-dock-item` | 48 | one dock row (rail) or one dock slot (bottom) |
| `--size-dock-clearance` | 96 | bottom padding added to `main` below 1024px, so the dock never covers content |
| `--size-rail-clearance` | 96 | left padding added to `main` at ≥1024px (`--size-dock` 64 + `--size-dock-inset` 16 × 2) |
| `--size-grid-cell` | 48 | the atmosphere grid cell (§7.7) |
| `--size-hero-min` | 640 | minimum hero height, so a short landscape viewport does not crush the headline |
| `--size-progress` | 2 | the scroll progress bar (G-14) |

**The rail expands over content, never beside it.** `--size-rail-clearance` is a constant 96px at all
widths ≥1024, whether the rail is collapsed or expanded. Expanding it must **not** reflow `main`,
because a chart that resizes when a user hovers the nav is a defect — and this is the single reason
the design chose a hover-expanding overlay rail rather than a conventional push sidebar.

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

**CR-007 supersedes the first three rows' colour:**

| Variant | Rest | Hover | Active | Disabled |
|---|---|---|---|---|
| `primary` | **`--accent-fill`** fill, **`--accent-on`** label (5.14:1 light / 5.29:1 dark) | `--accent-fill-hover` **plus** `box-shadow: 0 0 0 4px` in `--accent-glow` at 18%, `dur.fast`, `ease.enter` | `scale(0.985)`, `m.press` | `--surface-sunken` fill, `--ink-tertiary` label, `1px --border-subtle` |
| `secondary` | `--surface-raised`, `1px --border-control`, `--ink-primary` label | `--surface-overlay`, border → **`--accent-border`**, label → **`--accent-ink`** | `scale(0.985)` | as above |
| `ghost` | transparent, `--ink-secondary` label | **`--accent-wash`** fill, **`--accent-ink`** label | `scale(0.985)` | `--ink-tertiary` label |
| `hero` | **new, exactly one instance in the product** — the landing CTA. As `primary`, size `lg`, plus a trailing arrow glyph that tweens `x 0→3` on hover (`dur.fast`, `ease.enter`) and the magnetic pointer follow of **G-9** | | | n/a — never disabled |

Sizes: `sm` 28px high / `--text-xs` / padding-x 8; `md` 36 / `--text-base` / 12; `lg` 44 /
`--text-md` / 16. Radius `--radius-md`. Icon-only buttons are square at the same heights, with a
**44×44 minimum hit area** on touch via padding, and always an `aria-label`.
Loading: label stays in place, a 14px spinner replaces the leading icon slot, `aria-busy="true"`,
width does not change. Motion: G-7 (plus G-9 for `hero` only).

### 7.2 Badge / chip

`--radius-sm`, 20px high, padding-x 6, `--text-2xs` uppercase (labels) or `--font-mono` `--text-xs`
(values). Forms: `neutral` (`--surface-sunken` + `--ink-secondary` + `--border-subtle`),
`status-*` (wash + ink + icon + label), `timing-*` (wash + ink + marker glyph, §3.4.2),
`identity` (colour chip + ink label, §3.3).

### 7.3 Data-currency indicator (NV-9)

The design decision: **express currency as coverage, never as a fetch event.** "Complete through
Round 10 of 22" is a fact about the sport's calendar. "Updated 12 days ago" is a fact about a
process. Coverage phrasing is also the more honest of the two — `REQUIREMENTS.md` §2.2 warns the
newest round may lag reality, and coverage phrasing states exactly that without pretending to know
today's calendar position.

| Element | Spec |
|---|---|
| Trigger (≥768px) | `ghost` button, 28px high, containing an 8px `--radius-full` dot in `--ink-tertiary` (**static** — never pulses, §4.5), then `--font-mono` `--text-xs`: `2026 · R10` |
| Trigger (<768px) | dot + `R10` only |
| Accessible name | `"Data coverage: 2026 season, 10 of 22 rounds complete. Show detail."` — 22 is the verified 2026 figure (`round` rows with a non-null `number`); the value is read from `GET /api/meta` and never hardcoded |
| Detail | popover, `--elev-2`, max-width 320, `--radius-xl`, M-5, dismiss on Esc / outside click, focus returns to the trigger |
| Footer echo | the same facts as plain text, so the information is reachable without opening anything |

Copy — every value comes from `GET /api/meta`, nothing hardcoded:

- Popover heading: **"Data coverage"** — authored in sentence case and uppercased by `--text-2xs`'s
  `text-transform`, so assistive technology reads it as a word rather than an initialism
- Line 1: **"Complete results through Round {n} of {total} — {roundName}, {date}."**
- Line 2: **"Rounds {n+1}–{total} are scheduled and have no results yet."** _(omitted when the season
  is complete)_ — when exactly one round remains, the singular form
  **"Round {total} is scheduled and has no results yet."**
- Line 3: **"{cancelledRounds} rounds on the {year} calendar were cancelled."** _(omitted when
  `cancelledRounds === 0`)_ — when exactly one was cancelled, the singular form
  **"1 round on the {year} calendar was cancelled."** Trap 12, surfaced rather than hidden: 2026
  carries two cancelled rounds (Bahrain, Saudi Arabian), and they are the reason the round count and
  the calendar length disagree.
- Line 4: **"Seasons available: {minYear}–{maxYear}."**
- Footer echo: **"Complete results through {year} Round {n} · Seasons {minYear}–{maxYear}"**

**Pluralisation is part of the copy spec, not an implementation detail.** Any counted noun in this
component ships both grammatical numbers. A string that can render `1 rounds` or `Rounds 22–22` is a
copy defect even though the number is correct.

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

### 7.7 `AtmosphereField` — the moving background _(CR-007, new)_

One component, rendered **once** in `AppShell`, `position: fixed; inset: 0; z-index: var(--z-atmosphere); pointer-events: none;`
with `aria-hidden="true"` and `role="presentation"`. It is decorative, it is never interactive, and it
is never read by assistive technology.

**Six layers, bottom to top. Each is a single element; there is no canvas and no WebGL.**

| # | Layer | Composition | Motion |
|---|---|---|---|
| 0 | **Base** | `--surface-canvas` | static |
| 1 | **Grid** | `repeating-linear-gradient` in both axes, cell `--size-grid-cell` (48px), line width **1px**, colour `--bg-grid-line`: light `rgb(27 30 36 / 0.05)`, dark `rgb(245 247 249 / 0.055)`. Element is sized `calc(100% + 96px)` and offset `-48px / -48px`. `mask-image: radial-gradient(130% 100% at 50% 0%, #000 0%, #000 42%, transparent 88%)` so it fades out toward the bottom and the corners | **G-18** — `x: 48, y: 48`, 24s, `"none"`, `repeat: -1`. 2 px/s |
| 2 | **Orbs** | three absolutely-positioned divs, each `background: radial-gradient(circle at 50% 50%, <colour> 0%, transparent 70%)`, `filter: blur(<n>px)`, `border-radius: --radius-full`. **A**: 720×720, `--accent-glow`, `blur(80px)`, anchored `top: -180px; right: -140px`. **B**: 560×560, `--accent-glow`, `blur(100px)`, anchored `top: 34%; left: -160px`. **C**: 480×480, `--bg-orb-neutral` (light `#B9BCC3`, dark `#2F3237`), `blur(90px)`, anchored `top: 62%; right: 18%`. Layer opacity: **light 0.09, dark 0.17** for A and B; **light 0.28, dark 0.60** for C | **G-19** — three desynchronised `sine.inOut` yoyos at 18 / 24 / 30s; **G-21** pointer parallax ±14px on this layer only |
| 3 | **Racing line** | one inline SVG, `viewBox="0 0 1440 900"`, `preserveAspectRatio="xMidYMid slice"`, `width/height: 100%`. **One open path** reading as a circuit sector — a long left sweep, a hairpin, a short chute, a fast right. Stroke `--accent-mark`, `stroke-width: 1.5`, `opacity: 0.34`, `fill: none`, `stroke-linecap: round`, `stroke-linejoin: round`. Beside it: the **comet** — a 30×3px div, `--accent-mark`, `--radius-full`, `box-shadow: 0 0 18px 4px var(--accent-glow)`, declaring `offset-path: path("<the same d>")` and `offset-rotate: auto`, plus a 2px `--accent-mark` trail at `opacity: 0.5, filter: blur(4px)` following 40px behind via a second element at `offset-distance: calc(var(--offset) - 3%)`. **Rendered only when `data-bg="hero"`** | **G-20** — comet `offsetDistance 0%→100%`, 11s, `"none"`, `repeat: -1`, `repeatDelay: 1.8` |
| 4 | **Grain** | `background-image: url("/textures/grain.svg")`, 240×240 tile, `background-repeat: repeat`, `mix-blend-mode: overlay`, opacity **light 0.020 / dark 0.038**. Its only job is to kill the gradient banding that an 80px-blurred orb otherwise shows on a wide display | static, always |
| 5 | **Contrast plate** | `radial-gradient(120% 92% at 34% 44%, var(--surface-canvas) 0%, var(--surface-canvas) 36%, transparent 80%)` at alpha **0.86** under `data-bg="hero"`, and a flat `var(--surface-canvas)` at alpha **0.92** under `data-bg="calm"`. **This layer is not decoration — it is the mechanism that keeps every contrast figure in §9.2 V-2 true**, and it doubles as the attenuation control | opacity is set by attribute, never tweened |

#### 7.7.1 Why a contrast plate exists, with the measurement

Text placed directly on the orb-tinted field **loses its measured contrast**: over the brightest
light-mode composite, `--border-control` falls to **2.88:1** (floor 3.0), `--ink-tertiary` to
**4.35:1** (floor 4.5) and `--accent-mark` to **3.04:1** at the very edge of its floor (§9.2 **V-13**).
That is a real accessibility regression, and lowering the orb opacity does not fix it — it only makes
the background invisible before it makes the text legible.

The plate fixes it exactly. Measured (§9.2 **V-17**), the plated composite is within **ΔE 2.5** of
`--surface-canvas` in light and **ΔE 4.7** in dark, and every token clears its floor:

| Token | Light plated `#F7F4F9` | Dark plated `#151018` | Floor |
|---|---|---|---|
| `--ink-primary` | 15.32:1 | 17.47:1 | 4.5 |
| `--ink-secondary` | 6.66:1 | 9.22:1 | 4.5 |
| `--ink-tertiary` | **4.75:1** | **5.35:1** | 4.5 |
| `--border-control` | **3.14:1** | **3.35:1** | 3.0 |
| `--accent-mark` | **3.32:1** | 5.18:1 | 3.0 |
| `--accent-ink` | **4.72:1** | 5.18:1 | 4.5 |

#### 7.7.2 Intensity is route-scoped, by attribute

`<html data-bg="…">` takes exactly three values, set from the route by the shell.

| Value | Where | Effect |
|---|---|---|
| `hero` | `/` only | full field: grid drift, three orbs at authored opacity, racing line + comet, plate at 0.86, pointer parallax on |
| `calm` | **every other route — the default** | plate flat at 0.92; **orb opacity × 0.4**; **racing line and comet not rendered**; grid drift **continues** (2 px/s behind a 0.92 plate is barely perceptible and is what stops the page feeling dead); pointer parallax **off** |
| `off` | reserved — a full-screen chart or a print view | every layer above the base is `display: none`. No layer 1–5 exists. F2+ uses this |

**This is the binding answer to "motion must not compete with data".** Dense charts land on `calm`
routes, where the only surviving motion is a 2 px/s drift behind a 92%-opaque plate, and F2 may
escalate any chart-dominant surface to `off`.

#### 7.7.3 Reduced motion

Every tween in layers 1–3 is created inside the `no-preference` branch of §4.4's `gsap.matchMedia()`.
Under `prefers-reduced-motion: reduce`:

- **G-18, G-19, G-20, G-21 are never created.** The grid rests at `-48px / -48px`; the three orbs rest
  at their authored anchors; the pointer parallax listener is never attached.
- **The comet is `display: none`** via a `@media (prefers-reduced-motion: reduce)` rule, not by JS —
  so it is absent even before hydration.
- **The static racing-line stroke, the grid, the orbs, the grain and the plate all remain.** The
  reduced state is a **composed still image**, not a blank page. That is deliberate: turning the
  background off entirely under `reduce` would give reduced-motion users a visibly poorer product,
  and nothing about a static gradient is a vestibular trigger.
- Toggling the OS setting **while the app is open** stops the motion immediately, because
  `gsap.matchMedia()` reverts its handler's tweens when the condition stops matching.

#### 7.7.4 Cost and CSP

- **No new dependency, no canvas, no WebGL, no image asset except one 240×240 SVG noise tile.**
- Six elements, five composited transforms, one repeating `background-image`. `will-change: transform`
  is set on layers 1 and 2 **only** (`transform`), never on 4 or 5.
- **CSP-clean.** `script-src 'self'` / `style-src 'self'` with no `'unsafe-inline'`: the atmosphere
  needs no inline `<style>` and no inline `<script>`. All CSS ships in the stylesheet; all runtime
  values are written through the CSSOM (`element.style`, GSAP's setters), which CSP does not govern —
  the same reason `server/app.ts` already notes for React. The grain tile is `img-src 'self'`.
- The orbs' `filter: blur()` is applied to elements with **no text and no children**, so it never
  forces a text repaint.

#### 7.7.5 What it must never do

- Never sit above `main` (`--z-atmosphere` is 0 and `main` is 1).
- Never receive pointer events.
- Never animate its own `opacity` on route change — the plate's value changes by attribute, instantly.
  A cross-fading background on every navigation would be perceptible on every click.
- Never render layer 3 outside `data-bg="hero"`.
- Never run while the tab is hidden (§4.5).

### 7.8 `CommandDock` — primary navigation _(CR-007, new; replaces `PrimaryNav`)_

One component, two orientations, one `<nav aria-label="Primary">`. Full anatomy, states and copy are
in `PLAN.md` F0 Design Spec §5. The design-system-level rules:

- **Exactly one `nav[aria-label="Primary"]` in the document**, and it is outside `main`. `AppShell`
  keeps the single `main#main` and the skip link that targets it (§8).
- **At ≥1024px:** a fixed vertical rail, `left: --size-dock-inset`, vertically centred, `--size-dock`
  wide collapsed, `--size-dock-open` expanded (G-4), `--radius-2xl`, `--surface-glass` + `--glass-blur`
  + `--elev-2`. It expands **over** content and never reflows `main` (§5.3).
- **Below 1024px:** a fixed horizontal dock, `bottom: --size-dock-inset`, centred, `max-width: 480`,
  `--size-dock` tall, `--radius-full`, same surface treatment. Five slots; the fifth opens the
  overflow sheet (G-5).
- **Active item:** `--accent-wash` pill + `--ink-primary` label + 2px `--accent-mark` edge rule, moved
  by G-3, and `aria-current="page"` — colour is never the only signal.
- `main` reserves `--size-rail-clearance` (≥1024) or `--size-dock-clearance` (below), so the dock
  never covers content and no page needs a bespoke offset.

---

## 8. Accessibility — binding

- Contrast: text meets WCAG AA (§9.2 V-2 — every text token pair PASSes in both modes). Chart marks
  below 3:1 (§3.2) carry visible labels or a table view.
- Identity is **never colour-alone** — legend plus direct labels. Timing and status colours carry a
  glyph and an accessible name (§3.4.2, §3.4.3).
- Full keyboard operation; the single focus ring of §3.5.1, never removed; sensible tab order.
- A skip link is the first focusable element on every page: "Skip to main content". It renders at
  `--z-skip` (60) so it appears above the `CommandDock`.
- Landmarks: `header` → `nav[aria-label="Primary"]` → `main` (`id="main"`) → `footer`, in that **DOM
  order**, regardless of where the dock appears visually. **Exactly one `main` and exactly one
  `nav[aria-label="Primary"]` exist in the document** — `AppShell` owns both the `main` landmark and
  the `#main` id, and `CommandDock` is the sole primary nav.
- One `h1` per route.
- All imagery has meaningful alt text; decorative imagery is `aria-hidden`. **`AtmosphereField` is
  `aria-hidden="true"` + `role="presentation"` and contains no text** (§7.7).
- `prefers-reduced-motion` (§4.4, §7.7.3) and `prefers-color-scheme` (§10) both honoured. **A
  reduced-motion user still gets the full visual design** — a composed still background, an expanded
  dock rail, and every accent — never a stripped-down variant.
- Disabled controls stay legible and keep an accessible explanation (§3.5.2).
- Hit targets ≥44×44 on touch. Every `CommandDock` slot is ≥48×48.
- **Split text stays readable.** `SplitText` runs with `aria: "auto"` (its default), which puts an
  `aria-label` carrying the full string on the heading and `aria-hidden="true"` on every generated
  character. A split heading with per-character `aria` left on is a defect.

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

#### 9.2.1 CR-007 runs — the interface accent, 2026-08-06

The validator was **re-implemented from §9.1** for this CR (the F0 implementation was never committed)
and **calibrated against the recorded figures before being trusted**. Calibration output:

| Figure | Recorded | Re-implemented | |
|---|---|---|---|
| Cadillac ↔ Haas normal ΔE | 3.82 | **3.82** | exact |
| Haas OkLCh C | 0.0056 | **0.0056** | exact |
| Cadillac OkLCh C | 0.0043 | **0.0043** | exact |
| Mercedes OkLCh L | 0.786 | **0.786** | exact |
| RB ↔ Alpine deuteranopic ΔE | 3.17 Viénot / 2.90 Machado | **3.14 / 2.99** | within 0.09 |
| green ↔ yellow deuteranopic (light) | 6.9 | **6.88** | exact |
| purple ↔ yellow tritanopic (light) | 7.2 | **6.82** | within 0.4 (tritan, the model-sensitive axis) |
| dark timing set, min CVD ΔE | 9.2 | **9.20** | exact |
| `--ink-tertiary` on `--surface-sunken`, light | 4.58:1 | **4.58:1** | exact |
| `--border-control` on `--surface-sunken`, light | 3.03:1 | **3.03:1** | exact |
| `--ink-tertiary` on `--surface-sunken`, dark | 5.68:1 | **5.68:1** | exact |

CIEDE2000, OkLCh and WCAG reproduce **exactly**; the CVD figures differ by ≤0.4 from clamping order
inside the two models and **no verdict changes**. The implementation is therefore accepted as
conformant to §9.1.

| ID | Palette | Mode | Result |
|---|---|---|---|
| **V-10** | **Accent hue scan** — all 360° in 5° steps; at each hue, the max-chroma colour clearing 4.5:1 on all three surfaces, scored against 12 brand + 3 timing + 4 status colours | both | **h 350 SELECTED.** Only h ≈345–20 clears normal-vision ΔE ≥ 15 against all nineteen simultaneously. Rejections with figures: h 90 → ΔE **8.31** vs reserved yellow; h 150 → **1.74** vs reserved green; h 250 → **5.65** vs Williams; h 255 → **2.66** vs Red Bull; h 305 → **1.10** vs reserved purple; h 335 → **13.19** vs purple (still under floor). h 195–215 clears the floors but was rejected on judgement (§3.6.1). **No hue anywhere on the wheel clears CVD ΔE 8 against all four status inks** — best is 14.70 at h 300, inside the forbidden purple band; 20 colours will not fit the wheel, and this is recorded as a combinatorial limit, not a search failure |
| **V-11** | **Signal semantic aliases** (§3.6.3), 11 tokens | light | **PASS.** `--accent-ink` 5.14 / 4.84 / 4.55 on raised / canvas / sunken (floor 4.5) · `--accent-on` on `--accent-fill` **5.14** · on `--accent-fill-hover` **7.65** · `--accent-mark` 3.62 / 3.41 / 3.20 (floor 3.0) · `--accent-wash-ink` on `--accent-wash` **6.33** · `--ink-primary` on `--accent-wash` 13.81 · `--accent-wash` vs raised 1.21 (visible field; timing-wash precedent 1.15–1.19) · **focus ring vs `--accent-fill` 3.25** (floor 3.0) |
| **V-11** | **Signal semantic aliases** (§3.6.3) | dark | **PASS.** `--accent-ink` 4.71 / 5.29 / 5.50 · `--accent-on` on `--accent-fill` **5.29** · on hover **6.97** · `--accent-mark` 4.71 / 5.29 / 5.50 · `--accent-wash-ink` on `--accent-wash` **7.27** · `--ink-primary` on wash 13.41 · wash vs raised 1.18 (precedent 1.22–1.28) · **focus ring vs `--accent-fill` 3.37** |
| **V-11a** | Two candidate light-mode washes rejected | light | `--accent-ink` `#D1018A` on `#FFE2EE` = **4.25:1 FAIL** (floor 4.5). Resolved by giving the wash its own ink, `--accent-wash-ink` `#A2006A` at 6.33:1 — the same ink/wash pattern §3.4.1 already uses for timing. Also rejected: wash `#FEF1F7` (passes at 4.69 but is a barely-visible field at 1.10 vs raised) |
| **V-11b** | Three candidate dark-mode washes rejected | dark | `#46002B` → accent-ink 4.47 **FAIL**; `#370021` → passes ink at 4.89 but only **1.04:1** vs raised, i.e. not a visible field. Resolved at `--signal-850` `#570036` (L 0.300): 1.18:1 vs raised **and** 7.27:1 with `--signal-300` ink |
| **V-12** | **Glass header / dock composite** — worst case: canvas → accent orb at authored opacity → grain → `--surface-glass` | both | **PASS.** Composite `#FCF5FB` light / `#261A27` dark. `--ink-primary` 15.58 / 15.53 · `--ink-tertiary` **4.83 / 4.75** (floor 4.5) · `--accent-ink` **4.80 / 4.60** (floor 4.5) |
| **V-13** | **Unplated background field** — text and controls placed directly on the orb-tinted field | light | **FAIL, and this is why §7.7's contrast plate exists.** At orb opacity 0.10 the field is `#F4DBEF`: `--accent-mark` **2.80:1** (floor 3.0) · `--border-control` **2.64:1** (floor 3.0) · `--ink-tertiary` **4.00:1** (floor 4.5). Reducing the orb to 0.05 only reaches 3.04 / 2.88 / 4.35 — still failing two floors. Opacity is not the fix |
| **V-13** | Unplated background field | dark | **PASS on ink, FAIL on `--border-control`** — at orb 0.17 the field is `#3E1635`: `--ink-primary` 14.26 · `--ink-secondary` 7.53 · `--accent-ink` 4.23 (floor 4.5, marginal FAIL) · `--border-control` **2.74:1** (floor 3.0) |
| **V-17** | **Contrast plate** (§7.7 layer 5) at alpha 0.86 | both | **PASS, every token, both modes.** Light plated `#F7F4F9` (ΔE 2.48 from canvas): ink-primary 15.32 · ink-secondary 6.66 · ink-tertiary **4.75** · border-control **3.14** · accent-mark **3.32** · accent-ink **4.72**. Dark plated `#151018` (ΔE 4.65): 17.47 / 9.22 / **5.35** / **3.35** / 5.18 / 5.18. At the `calm` alpha of 0.92 every figure improves. **Therefore §9.2 V-2's neutral figures hold over the animated background, and no §3.5 token needs revising** |
| **V-14** | Atmosphere grid line visibility — decorative, recorded for the record | both | light `rgb(27 30 36 / 0.05)` over canvas → `#ECEDF0`, **1.10:1**; dark `rgb(245 247 249 / 0.055)` over canvas → `#1B1C20`, **1.13:1**. Comparable to `--border-subtle` (1.32 / 1.33), i.e. perceptible and recessive. No floor applies (§3.5) |
| **V-15** | **`--accent-mark` vs the 12 brand colours**, full CVD table | both | **Normal vision PASS** — minimum ΔE **26.00** (Ferrari), maximum 97.14 (Sauber); floor 15. **CVD residuals recorded:** Audi tritan **0.80**, McLaren tritan **2.18**, Ferrari tritan **3.46**, Haas deutan **6.63**, Cadillac deutan 9.20, Mercedes deutan 12.92, Williams protan 7.54, Red Bull protan 11.14. Mitigated structurally per §3.6.5 — the accent never carries identity, and identity always sits beside a name (§3.3) |
| **V-16** | **`--accent-ink` vs the 7 reserved semantics**, full CVD table | light | **Normal vision PASS** — min ΔE **20.09** (timing purple), then 25.59 (status critical), 41.68–81.02 for the rest; floor 15. **CVD residuals:** `status-info` protan **0.46**, `status-critical` tritan **2.97**, `status-good` deutan 16.48. Timing purple passes CVD at 13.56 protan / 14.18 tritan / 21.59 deutan |
| **V-16** | `--accent-ink` vs the 7 reserved semantics | dark | **Normal vision PASS** — min ΔE **21.03** (timing purple), 24.66 (status critical). **CVD residuals:** `status-critical` tritan **2.31**, `status-caution` tritan 10.33, timing yellow tritan 7.19. Timing purple 11.05 tritan — PASS |

**Verdict on CR-007's palette: ACCEPTED with recorded, structurally-mitigated CVD residuals.**
Every contrast floor passes in both themes. Every normal-vision separation floor passes. The residual
CVD failures are all against colours that already carry a mandatory icon and label (§3.4.2, §3.4.3) or
a mandatory adjacent name (§3.3), and the accent is barred from ever carrying meaning or identity
(§3.6.5). This is the same posture §3.4.2 takes for the timing hues, applied consistently.

**Still to validate in F1:** the derived per-theme chart-safe brand variants (§3.3 rule 6), the
deterministic fallback ramp for the 202 colourless teams (§3.1) — **which must exclude the Signal hue
band (h 340–360) so a colourless team is never painted the interface accent** — and the
collision-detection thresholds (§3.3 rule 4).

**The validator must land in the repository, in the CR-007 PR.** It produced every figure above, and
§9.1 requires a re-run on any colour change — which the `reviewer` cannot verify without it. It ships
as `scripts/validate-palette.mjs` with an `npm run validate:palette` script (`PLAN.md` F0 CR-007
Design Spec §12; the task number is the `principal-engineer`'s to assign). It is pure arithmetic and
needs no dependency, and it **self-calibrates against the pre-CR-007 recorded figures on every run**,
so a regression in the validator itself is caught rather than silently trusted.

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
- **`<html>` additionally carries `data-bg`** (`hero` | `calm` | `off`, §7.7.2), set from the route.
  Default is `calm`; the shell sets it, not the route's own markup, so a route that forgets still gets
  a correct background. It is **not** written by `theme-init.js` — the atmosphere is below the fold of
  first paint and needs no pre-paint pass.
- Theme changes animate per **G-22** and nothing else.

---

## 11. Document change log

| Date | Change | By |
|---|---|---|
| 2026-08-04 | Handover created with the measured §3 / §4 constraints | principal-engineer |
| 2026-08-04 | F0: §1 intent, §2 typography (Archivo / Inter / Chivo Mono, verified), §3.4 exact semantic steps + status set reduced to four with evidence, §3.5 surfaces / ink / borders / focus for both themes, §4 motion token set + 11 named motions with Framer Motion references, §5 spacing / radii / breakpoints / elevation, §7.0–§7.6 shell components and the five states, §8 accessibility, §9 validator method + 9 recorded runs, §10 theming mechanics | designer |
| 2026-08-04 | D-1 fix: §10 pre-paint theme script corrected from an inline `index.html` block to external `public/theme-init.js`, with the CSP (`script-src 'self'`, S-9) reason recorded. No token, colour, type, motion or component change; no re-validation required | designer |
| 2026-08-05 | **Gate 4 doc-conflict resolution (§7.3).** Three defects fixed, all in this file's favour of `PLAN.md` F0 Design Spec §5.1: (a) the cancelled-rounds line was **missing** from §7.3's copy list — restored as Line 3 and "Seasons available" renumbered to Line 4, so §7.3 and §5.1 now agree at 4 lines; (b) the accessible-name example and the §7.3 lead paragraph said **"of 24"** — corrected to **22**, verified by query (`round` rows for 2026 with a non-null `number` = 22; two rows carry `is_cancelled = 1`); (c) **pluralisation is now specified** for both counted sentences, including the previously unspecified single-remaining-round case. No token, colour, typography, motion or component change → no §9 validation run | designer |
| 2026-08-06 | **CR-007 — the frontend redo.** (a) **§1.1 decision 1 reversed**: the chrome now carries one accent hue, **Signal, OkLCh 350**, chosen by a full-wheel scan (§9.2 V-10) and specified as an 11-step ramp with 11 semantic aliases and a required-placement table (**new §3.6**). (b) **§4 rewritten for GSAP**; `framer-motion`, every Framer Motion ease and the whole `spring.*` token set are **removed from the product**; `M-1…M-11` retired and replaced by **G-0…G-24** (§4.6), each citing its GSAP doc reference; the single 400ms rule split into an interaction ceiling, an entrance budget and an ambient-loop class (§4.2); reduced motion is now a `gsap.matchMedia()` condition so ambient tweens are **never created** rather than slowed (§4.4). (c) **§2.3**: two display steps added, `--display-2xl` 80 and `--display-3xl` 112, reserved for the landing headline. (d) **§5.2a/§5.2b/§5.3**: a z-index scale, glass surfaces with a measured composite, `--radius-2xl`, and nine chrome-geometry tokens. (e) **§7.7 `AtmosphereField`** and **§7.8 `CommandDock`** specified in full; `PrimaryNav` retired. (f) **§7.1** primary/secondary/ghost recoloured and a `hero` variant added. (g) **§3.5.2** interactive expression now uses hue. (h) **§9.2.1**: validator re-implemented and **calibrated against every recorded figure before use**, then eight new runs V-10…V-17 recorded, including the two that forced the contrast plate. Bundle correction: GSAP+ScrollTrigger+SplitText measure **47.7 KB gzipped** against `framer-motion`'s 40.8 KB, so the swap **costs ≈6.9 KB** — CR-007's "cheaper" claim is wrong and is corrected in §4.1 | designer |
| 2026-08-04 | **CR-005** (`PLAN.md` §5.5): the upstream-attribution constraint is removed from §7.3 as a forward obligation — both the release-blocker framing and the derived clause in the ban list. The §7.3 ban on refresh/update language is **retained on independent grounds** (`REQUIREMENTS.md` §2.2 — a currency surface must not assume today's calendar position). **No copy string changed**: the coverage phrasing survives on its own merits. No token, colour, typography, motion or component change → no §9 validation run | designer |
