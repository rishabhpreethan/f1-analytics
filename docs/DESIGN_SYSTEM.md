# Design System

**Status: FOUNDATIONS COMPLETE (F0), REVISED BY CR-007, THEN BY THE MONOCHROME SWITCH OF
2026-08-06.** Owned by the `designer`.

> ### ⚠ 2026-08-06 — seven changes Rishabh asked for, and what each one moved
>
> _The count was "five" against six rows before this revision: the "menu bar is still broken" row was
> appended without updating it. Seven rows, seven changes._
>
> | His words | What changed | Sections |
> |---|---|---|
> | *"lets switch back to monochrome theme and no purple accent, i want the accent to be a color of white/black"* | **The accent is now the pole of the neutral scale** — `#08090C` light, `#FFFFFF` dark. The `--signal-*` ramp is deleted. Emphasis moved to inversion, absolute contrast, typographic weight and motion, all of which measure **3.6–5.5× more separation** than the magenta they replace | **§1.1 decision 1**, **§3.5.2**, **§3.6** (rewritten), **§9.2.2** |
> | *"i didnt like the moving background … i want the application to feel alive"* | **`AtmosphereField` rebuilt.** The three gradient orbs, the 48px grid and the contrast plate are gone. A two-pitch dot lattice, a **pointer lamp** that lights the dots under the cursor, a vignette and a solved **luminance corridor** replace them | **§7.7** (rewritten), **§4.6 G-18…G-21**, **§9.2.2 V-21** |
> | *"the sidebar, its broken … when its closed and when its open both"* | **The rail is full-height with stated offsets, icon-only when collapsed, and expanded by CSS `:hover` / `:focus-within` rather than by React state.** Three defects fixed, one of them a glyph-centring arithmetic error that had been documented as correct | **§7.8**, **§4.6 G-4** |
> | *"the menu bar is still broken … please fix that side bar, its really broken"* | **Three more, all of them consequences of the full-height geometry above.** The rail started 16px from the viewport top — inside the header band — and hid the wordmark, so its `top` is now derived from `--size-header`; every collapsed glyph sat at an x set by the length of its own `opacity: 0` label, so a rail item now fills `--size-dock-lane` (**46**, not 48 — `border-box` eats the dock's own borders too); and the pin gained a resting ring so it reads as a control rather than an empty box | **§7.8.0 faults 4–6**, **§7.8.1**, **§7.8.3** (new), **§5.3** tokens |
> | *"in the collapsed rail, every nav glyph is now invisible"* | **A regression from the row above, and the most instructive entry in this table.** Fault 5's fix sized the rail item to its 46px lane, which created a flex deficit the previous `max-content` box had never had — and the deficit landed entirely on the glyph, because a nowrap label cannot shrink below its text width while an inline `<svg>` can shrink to **zero**. Measured in Chromium: `width: 0, height: 20` on every collapsed glyph. Fixed by `flex: none` on `.dock-item > svg` plus `min-width: 0` / `overflow: hidden` on the label, and **the tests changed shape**: they now assert the lane's *budget* — what cannot shrink must fit — rather than the glyph's offset, which was correct the whole time | **§7.8.0 faults 7–8**, **§7.8.1**, **§7.8.2**, **§7.8.4** (new) |
> | *"the button up here: 2026 … i dont really know what its for"* | **`DataVintage` states its purpose visibly** — a label, a completeness meter, a control boundary and a disclosure chevron | **§7.3** |
> | *"even the hover effects for these cards … i dont really like them either"* | **`CapabilityCard`'s four polite effects replaced by two committed ones**: a perspective tilt toward the pointer with real elevation, and a perimeter traced in one stroke. G-8's pointer spotlight is **retired from the product** | **§4.6 G-7 / G-25 / G-26**, **§3.5.2** |

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
> | The shell was a **static top nav bar** with motion only on route change | A **`CommandDock`** (left rail ≥1024px, floating bottom dock below) plus a **fixed animated background** (`AtmosphereField`, §7.7) and **pointer-aware feedback on every interactive element** (§4.6 G-9/G-21/G-25 — G-8, the spotlight CR-007 specified, is retired). |
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

### 1.0 ⚠ The default-vs-measured trap — the one bug class that has recurred _(added 2026-08-07)_

**A default value and a measured value are indistinguishable at the point of use, and treating the
default as real is the most repeated defect in this project.** Three instances, in three unrelated
subsystems, all found by looking at the screen rather than by a test:

| Where | The zero | What it was read as | What shipped |
|---|---|---|---|
| **Motion** (§4.6.1) | a `ScrollTrigger` that had not fired | an authored `opacity: 0` | the loading skeletons were invisible, so a cold load showed a heading and an empty page |
| **Charts** (§6.3) | `useChartSize` reporting width `0` before the `ResizeObserver` fires | a *measured* width of 0 px, therefore "too dense for markers" | every marker dropped on first paint, then popped in — and the marker layer absent in jsdom, where the test that a `null` reading draws as a gap counts markers |
| **Axes** (§6.3) | a domain of `[1, n]` | `1` being an interior value like any other | `d3.ticks` never labelled it, so **every completed season's progression axis started at round 2** |

The three look nothing alike and are the same bug: **something absent was given the meaning of
something present.** The mitigation generalises, and it is binding from here:

1. **Name the unmeasured case explicitly.** `if (axisLengthPx <= 0)` is a branch, not a coincidence.
   A function that cannot tell "not yet known" from "known to be zero" has to be given the
   distinction.
2. **Take the permissive branch.** Absent means *no constraint stated* — never the worst case. This is
   the same convention `prefersReducedMotion()` already uses for a missing `matchMedia`, and the same
   one `resolveSeasonYear` uses for a year it cannot range-check.
3. **Assert the permissive branch by name.** `it('DRAWS on an unmeasured plot — "not yet measured" is
   not "too dense"')` is the test that stops the next author from "tidying up" the guard.
4. **A resting CSS state is always the final, readable state** (MR-2). Entrance motion is authored
   `from`, never `to`-from-hidden, so a tween that never runs leaves content visible.

**On this evidence there will be a fourth.** The places to look are anywhere a measurement, a media
query, a query result or a route parameter can be *absent* rather than *empty* — and the tell is a
falsy check (`!width`, `?? 0`, `|| 1`) standing in for a three-state question.

### 1.0b ⚠ Validate by state, not by era _(added 2026-08-07)_

**The negative-gap defect above survived three rounds of review on the surface it was on.** 1988, 1996
and 2026 were each captured, measured and signed off; the bug is on all of them and was visible on
none, because it needs a row that is **both** a non-finisher **and** has a recorded elapsed time. 1988
renders correctly for the wrong reason: those rows carry no `totalTimeMs`, so the faulty branch is
unreachable there.

**We were sampling the wrong dimension.** Era is a proxy for state and a bad one — it happens to vary
coverage, so it feels like coverage is what is being tested. The states that mattered here were
`finished` · `lapped` · `retired-with-a-time` · `retired-without-one`, and one era can contain all four
while three eras can miss two.

So: **enumerate the states a surface can render and check that they are each reachable in the fixture
or the capture set.** For anything driven by a decoded enum — `outcome`, `gridStatus`, `adjustment`,
`GapDisplay` — the enum *is* the checklist, and a case with no example is untested however many pages
were opened. `raceOutcomeSchema` has eight members; 2026 R6 exercises three.

### 1.0a ⚠ The seam between two features is in nobody's scope _(added 2026-08-07)_

**Rishabh asked "how do I go to the race page?" and the answer was that he could not.** The race deep
dive — masthead, classification, four charts, the whole feature — was reachable only by typing a URL.
`SeasonCalendar` rendered twenty-two rows carrying a round number, a grand prix name, a circuit, a date
and a winner, and **not one of them was a link.**

**Neither feature was wrong.** F2 was specified, built and reviewed against its own spec and is good.
F3 was specified, built and reviewed against its own spec and is good. The path a reader takes *from one
to the other* belonged to neither, so nobody walked it. That is a different failure from §1.0's — not
"correct in the wrong space" but **"correct in isolation, unconnected in the whole"** — and it is the
failure mode a feature-by-feature process produces by construction.

**The rule, binding from here:**

1. **A surface that names an entity another surface owns must link to it, and the link is part of *this*
   surface's deliverable** — not the destination's. The calendar owes the race page its link; the race
   page does not owe the calendar its inbound traffic.
2. **Both directions are checked.** Here the back-link (`RaceMasthead` → `/seasons/:year`) existed and
   the forward one did not, which is why "we have navigation between them" was true and useless.
3. **A navigable element carries a visible affordance** (§7.3.0: *"it was not broken, it was
   undiscoverable, and that is worse"*). Reuse the product's existing "go here" gesture — the `x: 3`
   chevron nudge — rather than inventing a second one.
4. **Not everything that names an entity can be linked, and the exceptions are principled.** A
   cancelled round has no round number, so it has no address (trap 15) and is deliberately not a link.
   An *upcoming* round is linked, because its race page is a real destination and treating a scheduled
   race as unreachable would repeat `REQUIREMENTS.md` §2.2's mistake in the navigation.
5. **Assert it.** `SeasonCalendar.test.tsx` checks the `href`, the accessible name, the affordance and
   the cancelled exception. These are cheap tests and they are the ones that would have caught it.

**The seams still to build, so they are not rediscovered one question at a time:** driver → races,
driver → teams, team → seasons, team → drivers, circuit → races, **race → circuit**, **race → each of
the drivers in its classification** (RD-10 names 22 entities and links to none of them), and compare →
every entity it holds. Each is one feature's obligation to another, and each will be invisible
to a review that reads one feature at a time.

### 1.1 The three decisions that produce the character

Everything else follows from these.

**1. The chrome is monochrome. The only hue on screen belongs to a team.** _(Rishabh's decision,
2026-08-06. This supersedes CR-007's one-hue accent, which superseded the original no-accent chrome.
Read all three, because the reasoning is what stops the pendulum swinging again.)_

The sequence matters:

| Version | Decision | Outcome |
|---|---|---|
| Original F0 | **Achromatic chrome, no accent at all.** Every usable hue is already some team's identity, so the interface should have none. | **Rejected by Rishabh** — *"too basic and too bland"*. Correct diagnosis: it had no focal point, and restraint without a focal point is absence. |
| CR-007 | **One accent hue — "Signal", OkLCh 350**, a hot magenta-rose, chosen by scanning all 360° against 19 reserved colours. | Fixed the focal point. Rishabh then asked for monochrome: *"i want the accent to be a color of white/black which follows the monochrome theme."* |
| **Now** | **Monochrome chrome. The accent is the *pole* of the neutral scale** — `#08090C` on light, `#FFFFFF` on dark — and emphasis is carried by **contrast, inversion, weight, scale and motion** instead of hue. | — |

**The thing that makes this different from the rejected first version is not the colour, it is the
device.** The first build had no accent *and no substitute for one*: no inversion, no maximum-contrast
mark, no pointer response, no outlined display type, no texture, no layered field. It was flat grey
with grey text on it. This version removes the hue and **replaces it with the four emphasis devices a
monochrome system actually has**, each of which is stronger than the magenta it replaces:

| Device | Where | Measured |
|---|---|---|
| **Inversion** | primary and hero buttons, the `F1` wordmark badge, the active dock item | `--accent-on` on `--accent-fill`: **19.91:1** light, **19.91:1** dark. The single highest-contrast object available. |
| **Absolute contrast** | every 2px rule, indicator, underline, coverage bar, header segment | `--accent-mark` on `--surface-raised`: **19.91:1** light / **17.06:1** dark, against a floor of 3.0. The magenta reached **3.62 / 4.71**. So every accent mark in the product gained **3.6–5.5×** separation. |
| **Typographic weight** | the landing headline's final word, set as a **3px outline** rather than a fill (§2.3) | a second weight, not a second colour |
| **Motion and light** | the pointer lamp in the background field, the card tilt, the traced card edge (§7.7, §4.6) | in the dark theme, **the only light on screen comes from the cursor** |

So the hierarchy of colour is now two-layered plus a monochrome interface, and the top row got
*louder* rather than quieter:

| Layer | Colour | Job | Never |
|---|---|---|---|
| **Identity** | the twelve brand colours (§3.1) | which team / which driver | never a chart palette on its own (§3.2) |
| **Semantics** | purple / green / yellow, plus four status colours (§3.4) | what a timing value or a system state *means* | never a series colour |
| **Interface** | **the neutral scale, and its two poles** (§3.6) | *this responds to you* — interactivity, focus of attention | never meaning; never identity; never a series colour |

**And this is the feature, not the compromise: a team colour is now the only hue on screen.** With an
achromatic chrome, a Ferrari red or a McLaren orange beside a driver's name is the single chromatic
thing in the viewport. §3.2 measured that brand colours fail as a *palette*; §3.3 keeps them as
*identity*; and a monochrome chrome makes that identity read louder than it ever did next to a
magenta interface. It is a property of the system now, deliberately, rather than an accident.

**The accent must still be conspicuous, not homeopathic.** §3.6.4 lists the surfaces where it is
*required*. A build in which the accent appears only on a focus ring has failed this decision as
surely as the first neutral build did — and the specific way to fail it now is to use
`--accent-ink` where §3.6.4 calls for inversion, because near-black beside `--ink-primary` is
**ΔE ≈ 5** and reads as one flat block of type.

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
   perceptual distance and automatically assign a differentiator to any colliding pair. **Specified
   in §3.3a and §6.4; the ladder is in §6.4.** The distance metric and CVD models are fixed by §9.1.
5. **Teammate comparison always collides** — identical team colour — and is simultaneously the most
   valuable comparison in the product. **Resolved in §6.4a, and the resolution is not primarily a
   colour one:** for at least one team on the current grid, colour provably cannot separate two
   teammates at all (§9.2.3 G-27d), so marker shape, dash and direct label are mandatory for every
   teammate pair and the shade pair is a redundant fourth channel.
6. **Per-theme chart-safe variants.** Brand colours failing the lightness band need a derived
   plotting variant per theme (a darkened Mercedes for light mode, etc.). Brand colour for identity;
   derived variant for plotting. **Derived, validated and shipped** — `--team-<ref>-plot` in
   `src/styles/entity.css`, generated; figures in §9.2.3 V-26.
7. **Validate anything new.** Run the validator (§9.1); fix FAILs; record results in §9.2.

### 3.3a Entity colour encoding — the ramp is the norm, not the fallback

**214 teams exist and 12 carry a `primary_color`** (queried, not remembered). The ramp is therefore
**94% of the data**, and the brand colours are the enrichment. Designing the ramp as an afterthought
would be designing for 6% of the product.

Everything below is **generated** into `src/styles/entity.css` by
`node scripts/validate-palette.mjs tokens`. Do not hand-edit that file: `scripts/entity-tokens.test.mjs`
re-runs the emitter and diffs it, because a mistyped hex still renders, is still roughly the right
colour, and silently makes every figure in §9.2.3 stop describing what ships.

#### 3.3a.1 Three roles, and never mixing them up

| Role | Token | What it is for |
|---|---|---|
| **Identity** | `--team-<ref>` | The **true brand colour**, theme-invariant. Swatches, 3px accent bars, team header bands — always beside a name (§3.3). **Never a chart mark.** |
| **Plot** | `--team-<ref>-plot` · `--ramp-<n>-plot` | One series, one entity. Hue and chroma held from the brand; lightness moved the minimum distance into the theme's plotting band. |
| **Shade pair** | `--*-plot-deep` · `--*-plot-bright` | Two drivers of **one** team in one plot area (§6.4a). |

**Haas `#9C9FA2` and Cadillac `#AAAAAD` have an identity colour and no plotting colour.** Their OkLCh
chroma is 0.0056 and 0.0043 — they read as pure grey, and this product's chart furniture is achromatic
by design (grid `--border-subtle`, axis `--border-strong`, ticks `--ink-tertiary`). A grey series is
confusable with the chart's own structure, which is a worse failure than being confusable with another
team. **Both plot from the ramp, exactly like a colourless team.** This is not a downgrade and must not
be "completed for symmetry" later; `entity.css.test.ts` asserts the absence.

#### 3.3a.2 The ramp — 12 slots, two tiers of guarantee, one palette

| Tier | Slots | Guarantee |
|---|---|---|
| **A** | 1–6 | Mutually **ΔE ≥ 15 normal-vision *and* ≥ 8 CVD** in both themes, and ≥ 40° apart in OkLCh hue. **Colour alone separates these, for every viewer.** 6 > the comparison cap of 4, so any admissible 4-subset is fully separated. |
| **B** | 7–12 | Mutually, and against tier A, **ΔE ≥ 15 normal-vision** in both themes. CVD separation is measured and reported per pair, **not** gated — the 14 pairs below CVD 8 are precisely what §6.4's ladder exists to carry. |

**What tier B buys is collision *rate*, and that is a product property.** With 202 teams drawing from
the ramp, the probability that four randomly selected colourless teams land on four distinct slots is
**0.278 at N = 6** and **0.573 at N = 12**.

**What tier B must never buy is a near-miss.** Two entities in one plot are either the *same* slot — an
exact collision, which the ladder resolves explicitly and visibly — or they are ≥ 15 apart. There are
no near-misses by construction. Cadillac ↔ Haas at ΔE 3.8 is the failure this forbids, and it is worse
than either of the other two cases because it reads as *"probably different, possibly not"*.

**Lightness is a search dimension, and that single decision is what makes the ramp possible.** A
hue-only ramp — one entry per hue at maximum chroma — caps at **N = 3** under a CVD floor of 8,
measured. The reason is structural: a dichromat's colour space is essentially one chromatic axis
(blue ↔ yellow) plus lightness, the yellow half of that axis is reserved by the F1 timing convention,
and hue alone has almost nothing left to spend. Lightness is preserved *exactly* under every CVD
model. Spending it is how the ramp gets past three. Each slot is a **(hue, lightness-tier)** pair; the
hue is shared across themes so a slot is recognisably the same colour after a theme switch.

#### 3.3a.3 Assignment — deterministic, by identity, never by rank

A team without a `primary_color` takes slot `1 + (h mod 12)` where `h` is a stable hash of the team's
`reference` (not its `id`, which is an insertion artefact, and not its name, which is edited).

Three properties this must have, and each is a rule rather than an implementation note:

1. **Stable across sessions, filters and reloads.** The same team is the same colour tomorrow.
2. **Independent of the selection.** Adding a fourth entity must not repaint the first three (§6.2).
3. **Independent of rank.** A championship-order palette would encode standing in hue and change
   colour when the standings do.

**Built 2026-08-07 in `src/lib/entityColor.ts`.** The contract held: it maps an entity to a token
*name*, never to a literal hex, and `entityColor.test.ts` asserts that no hex can appear in any of
its outputs — so the theme keeps working and no colour is inlined into markup.

Three facts the build settled, each of which was open when this section was written:

| | |
|---|---|
| **The hash** | **FNV-1a, 32-bit**, over the UTF-16 code units of `reference`, with `Math.imul` keeping the multiply in 32-bit integer space. Deterministic across engines and sessions, depends on nothing ambient, eight lines. Its distribution over the **live 214-team list** is recorded in §9.2.4 and is consistent with uniform (χ² 12.88 against a 19.68 critical value at 11 df, α = 0.05). |
| **The only field required from the data layer is `team.reference`** | Not the brand colour, not a "has colour" flag, not the id. **Whether a plotting variant exists is a property of our generated palette, not of the row** — so no selector has to carry it and the two cannot disagree. This is the whole reason the module needs no new selector. |
| **Haas → ramp 3, Cadillac → ramp 7** | The pair that failed at ΔE 3.8 as raw brand colours — indistinguishable with full colour vision — lands on two different ramp slots with no collision. The measured failure that started §3.2 is closed by construction rather than by care, and `entityColor.test.ts` asserts it. |

#### 3.3a.4 CR-004 — team logos where colours collide

Rishabh's proposal: use a logo where two brand colours collide and colour where they do not. **The
slot is designed; the assets do not exist.**

| | |
|---|---|
| **Slot** | 16×16 logo mark in a legend row and in a tooltip header, replacing the colour swatch for the colliding entities only |
| **Assets** | `public/assets/teams/<reference>.svg` — square, 1:1, ≥ 64×64 viewBox, monochrome-capable (a single-path silhouette that can be filled with `currentColor`), named by `team.reference` |
| **Status** | ⛔ **BLOCKED — R2, assigned to Rishabh.** Never fabricate, generate or hotlink a team logo. |
| **Interim rendering** | The colour swatch plus the **ladder differentiator** (§6.4) — dash pattern and marker shape — and the team's name in `--ink-primary`. This is not a placeholder box; it is the full non-logo treatment and it is sufficient on its own. When a logo arrives it *adds* recognition, it does not fix a broken state. |
| **Why the interim is genuinely sufficient** | The ladder already guarantees a non-colour channel for every colliding pair. The logo's value is recognition speed for an F1 fan, not disambiguation. |

**Note for whoever picks CR-004 up:** a monochrome silhouette is required precisely *because* the
colliding case is the one where colour cannot be trusted. A full-colour logo would reintroduce the
collision inside the mark that exists to resolve it.

**Identity-surface rule added in F0.** Because 6 of 11 brand colours fall below 3:1 against a light
surface (§9.2 V-8), a brand colour is never the sole carrier of identity on an identity surface
either. The permitted identity forms are:

| Form | Spec |
|---|---|
| **Accent bar** | 3px full-bleed bar on the leading edge of a table row or card, brand colour, always beside the team or driver **name** in ink |
| **Colour chip** | 10×10px `--radius-xs` square, brand colour, `1px` inset ring in `--border-subtle`, always beside a text label |
| **Team header band** | brand colour band with the team name in a computed on-colour ink (`--ink-primary` or `--ink-inverse`, whichever reaches ≥4.5:1 against that specific colour — computed, not assumed) |
| **Not permitted** | brand colour as the background of a text-only element without a computed on-colour ink; brand colour as the only difference between two adjacent interactive elements |

#### 3.3a.5 An identity swatch may sit near a reserved timing colour — measured, and separated by **form**, not by hue _(added 2026-08-07)_

Raised against the season hub's calendar, where Mercedes' teal chip sits eleven rows above nothing in
particular but would, on a race page, sit on the same row as a purple fastest-lap time. The question
is whether a green-ish identity chip can be misread as the reserved timing green. **Measured with
`node scripts/validate-palette.mjs check`, both themes, recorded in §9.2.5:**

| Identity swatch ↔ `--timing-green-ink` | normal ΔE | worst CVD ΔE |
|---|---|---|
| Mercedes `#00D7B6` ↔ light `#087B30` | **31.53** | **23.29** |
| Mercedes `#00D7B6` ↔ dark `#47FF79` | **19.39** | **7.60** ✗ |
| Sauber `#00E700` ↔ light `#087B30` | **32.52** | **26.43** |
| Sauber `#00E700` ↔ dark `#47FF79` | **8.75** ✗ | **5.85** ✗ |

**Sauber in dark mode fails both floors, and Mercedes fails the CVD floor.** The hunch pointed at
Mercedes; the measurement says Sauber is nearly three times worse. That is the whole reason this is a
measured entry and not a paragraph of reasoning.

**The ruling: identity swatches are NOT gated against the timing set, and never will be.** Gating
them would mean altering a team's true brand colour, which is the one and only thing an identity
swatch exists to show — and §3.2 already permits identity collisions on the grounds that colour sits
*beside a name*. Changing Sauber's green to clear a timing green would be the tail wagging the dog.

**What carries the separation instead is form, and these three are binding:**

1. **A reserved timing colour is never a fill on a swatch, a bar or a band.** It is **ink on a
   numeral**, or a wash behind one, always attached to the value it qualifies. An identity colour is
   the opposite: a solid 3px bar or 10×10 chip that **never contains text**. A reader distinguishes
   "solid square with no text" from "coloured lap time" without needing the hues to be far apart.
2. **An identity colour is never applied to a numeral**, and a timing colour is never applied to a
   name. This is the same rule as §6.2's *"text wears text tokens, never the series colour"*, applied
   to the identity role.
3. **Any surface carrying both must carry the timing legend.** §3.4.2 already requires timing colours
   to ship with a label; this section makes the legend's presence the *discharge* of this collision,
   so a surface with timing colours and no legend is now a defect for two independent reasons.

**Consequence for F3, stated now so it is not discovered later:** a race-results row will hold an
identity chip and a timing-coloured lap time simultaneously. Rules 1–3 are what make that legible,
and the row must not additionally tint the driver's name or the row background with either.

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
**PASS** (§9.2 V-9). **Re-measured against the monochrome `--accent-fill` (§9.2.2 V-19): the outer
ring reaches only 1.19:1 light / 1.07:1 dark there, and the inner `--surface-raised` ring carries it
at 19.91 / 17.06:1.** That is the case the doubling exists for; see §3.6.3.

Applied via `:focus-visible` only. Never removed, never replaced per-component, never a `whileFocus`
motion substitute — motion is not a focus indicator.

##### 3.5.1a A control's pressed state is never carried by fill alone _(added 2026-08-07)_

`.chart-seg`'s pressed segment used `--accent-fill` + `--accent-on` and nothing else. That inverts
per theme — near-black on a pale container in light, **near-white on a near-black container in dark**
— and in dark it left pressed and unpressed reading as almost the same weight, because both resolved
to light content and only the fill distinguished them. Caught in Rishabh's dark-mode capture of the
segmented controls; invisible in light mode, which is where all previous review happened.

§3.4.2 already forbids colour as a sole carrier of meaning, and **a control's state is a meaning.**
The whole design system applies that rule to charts and then this one control did not. So a
segmented control's pressed state now carries **three** channels:

| Channel | Pressed | Unpressed |
|---|---|---|
| Fill | `--accent-fill` | none |
| Ink | `--accent-on` | **`--ink-tertiary`** |
| Weight | 500 | 400 |

**The unpressed recession is the one that actually fixes dark**, because it puts a real ink step
between the two segments regardless of which way the fill inverts. It costs light mode nothing —
`--ink-tertiary` still clears 4.5:1 there. This applies to every segmented control in the product,
including `Chart`/`Table`, `Colour`/`Patterns` and the season hub's metric and championship switches.

### 3.5.2 Interactive expression — the shipped set

_Rewritten 2026-08-06 for the monochrome accent. The two superseded tables (the original achromatic
set, and CR-007's hue-bearing set) are gone rather than stacked: three versions of one table is how a
reader ends up implementing the wrong one._

| State | Expression |
|---|---|
| Hover — surface | surface steps one level toward `--surface-overlay` |
| Hover — control (button, row, dock item) | plus the §3.6.4 accent expression for that control. **No pointer spotlight** — G-8 is retired (§4.6): a low-opacity achromatic radial over a glass or panel surface reads as a smudge, which is the exact failure the orb field was removed for |
| Hover — card | **tilt toward the pointer + lift + elevation + a traced perimeter** (G-25, G-26). Supersedes the `y: -1` of the original table, the `y: -2` §3.4 later specified, and the 2px lift that shipped |
| Active / pressed | `scale(0.985)`, `m.press`; surface steps back down |
| Selected (nav, dock) | **inverted** — `--accent-fill` + `--accent-on` — plus `aria-current` plus the 2px `--accent-mark` indicator (G-3) |
| Selected (tabs, segmented, chip, toggle) | `--accent-fill` + `--accent-on` label |
| Link | `--accent-ink` with a 1px `currentColor` underline at `0.14em` offset; hover sweeps a 2px `--accent-mark` underline in from the left (G-10) |
| Disabled | `--ink-tertiary` text, `--surface-sunken` fill, `--border-subtle`, `opacity: 1` (never faded — a disabled control must stay readable so its explanation can be read too), `cursor: not-allowed`, `aria-disabled="true"` |

**The binding rule that survives every revision:** hue is never the *only* difference between two
states, and hue never appears on anything that carries identity or meaning. With a monochrome chrome
the first half is now satisfied by construction.

---

### 3.6 The interface accent — monochrome, the poles of the neutral scale

**Rewritten 2026-08-06 at Rishabh's request** (*"lets switch back to monochrome theme and no purple
accent, i want the accent to be a color of white/black which follows the monochrome theme"*). It
replaces CR-007's "Signal", OkLCh hue 350. Every value below was measured by
`scripts/validate-palette.mjs`; the runs are §9.2.2 **V-18 … V-22**.

### 3.6.1 What replaced the hue, and why each replacement is stronger

An accent has one job: to say *the interface is speaking now, and it responds to you*. Hue is one way
to do that. It is not the only way, and in this product it was never the best one — every usable hue
is either a team's identity or a reserved timing semantic (§3.2, §3.4), which is why CR-007 needed a
full-wheel scan to find a single survivor.

A monochrome system has four devices instead, and they are used in this order of loudness:

1. **Inversion.** A fill at the *opposite pole* from the surface, with inverse ink. Nothing on a
   screen is louder. `--accent-on` on `--accent-fill` measures **19.91:1** in both themes.
2. **Absolute contrast.** Marks — 2px rules, indicators, underlines, bars — are set at the pole
   rather than at `--ink-primary`, so they read as *harder* than body ink. **19.91:1** light /
   **17.06:1** dark against `--surface-raised`.
3. **Typographic weight.** An outline instead of a fill (§2.3, the landing headline's final word), or
   600 where the surrounding text is 400.
4. **Light and motion.** The pointer lamp (§7.7 layer 2), the card tilt and traced edge (§4.6 G-25 /
   G-26). This is where "alive" now lives, because it can no longer live in a colour.

**The one thing that must not be done** is to reach for `--accent-ink` where §3.6.4 calls for
inversion. `--accent-ink` `#08090C` beside `--ink-primary` `#1B1E24` is **ΔE ≈ 5** — indistinguishable.
Two CR-007 placements failed exactly that way and were re-specified rather than kept:

| Surface | Was (CR-007) | Now |
|---|---|---|
| Header wordmark | the `1` of "F1" in `--accent-ink` | **`F1` as an inverted badge** — `--accent-fill` block, `--accent-on` type, `--radius-sm` |
| Landing headline | the final word in `--accent-ink` | **the final word outlined** — `color: transparent` + `-webkit-text-stroke` in `--accent-mark`, behind an `@supports` guard |

### 3.6.2 There is no ramp

CR-007's eleven `--signal-*` steps are **removed from the product**. A `var(--signal-…)` anywhere is
a defect and resolves to nothing, which paints `transparent` — a mark that is simply not there.

Nothing replaces them: the accent is two values per theme plus a wash, and the §3.5 neutral scale
already covers everything between. `tokens.css` therefore declares the semantic aliases of §3.6.3
**directly as hexes**, which also removes the "never consume a raw step" rule, because there is no
raw step to consume. That reclaimed 13 lines of the CSS artefact.

### 3.6.3 Semantic aliases — the only tokens a component may use

| Token | Light | Dark | Contract, and the measured figure (§9.2.2 V-18) |
|---|---|---|---|
| `--accent-ink` | `#08090C` | `#FFFFFF` | text / icon on any surface. **19.91 / 18.75 / 17.61** light on raised / canvas / sunken; **17.06 / 19.15 / 19.91** dark. Floor 4.5 — PASS |
| `--accent-ink-strong` | `#000000` | `#FFFFFF` | hover state of accent text. **21.00** light / **17.06** dark on raised |
| `--accent-fill` | `#08090C` | `#FFFFFF` | primary button, hero CTA, wordmark badge, active dock pill |
| `--accent-on` | `#FFFFFF` | `#08090C` | the ink **on** `--accent-fill`. **19.91:1** in both themes. Floor 4.5 — PASS |
| `--accent-fill-hover` | `#33373E` | `#C6CAD2` | with `--accent-on`: **11.95:1** light, **12.12:1** dark |
| `--accent-mark` | `#08090C` | `#FFFFFF` | 2px rules, indicators, underlines, coverage bars, future chart marks. Same figures as `--accent-ink`. Floor 3.0 — PASS by a factor of six |
| `--accent-border` | `#08090C` | `#FFFFFF` | interactive boundaries in accent. Same figures — PASS |
| `--accent-wash` | `#E4E7ED` | `#2C2F35` | tinted field: hover on a ghost control, an accent chip. **1.24:1** light / **1.27:1** dark against `--surface-raised` — a visible field, matched to the timing-wash precedent of 1.15–1.28 (§3.4.1) |
| `--accent-wash-ink` | `#08090C` | `#FFFFFF` | the ink **on** `--accent-wash`. **16.07:1** light, **13.42:1** dark. `--ink-primary` also passes (13.48 / 12.49) |
| `--accent-glow` | `#08090C` | `#FFFFFF` | the pointer lamp in the background field, and the primary button's hover halo. Always applied through an opacity |
| `--accent-hairline` | `rgb(8 9 12 / 0.20)` | `rgb(255 255 255 / 0.22)` | 1px decorative accent rules. Decorative — no contrast floor |

**Two properties of this set are deliberate and look like mistakes if you do not read them here.**

1. **`--accent-fill-hover` recedes rather than deepens.** `--accent-fill` is already the pole, so
   there is nowhere further to go; hover therefore steps *toward* the mid-scale, and the primary
   button additionally grows a 4px `--accent-glow` halo at 18%. That is the direction §7.1's original
   pre-CR-007 spec used, and it is the only one available.
2. **In dark mode `--accent-ink-strong` equals `--accent-ink`.** White is the pole. The link-hover
   signal is therefore carried entirely by **G-10's underline sweep**, not by an ink step. This is
   recorded rather than "fixed" because inventing an off-white for a hover state would make the ink
   step *less* legible than the rest state, which is worse than no ink step.

**`--accent-ink` is still not usable as the focus ring**, and the monochrome accent makes that
sharper, not softer. The ring stays §3.5.1's achromatic double ring, and it was re-measured over the
new fill (§9.2.2 **V-19**): the **outer** `--ink-primary` ring reaches only **1.19:1** light /
**1.07:1** dark against `--accent-fill` — it is essentially invisible there — and the **inner 2px
`--surface-raised` separator ring** carries the indicator at **19.91 / 17.06:1**. Floor 3.0, PASS.
**This is the case the doubled ring was designed for; a single-ring "simplification" would make focus
invisible on every primary button in the product.** `tokens.css.test.ts` asserts it.

### 3.6.4 Where the accent is REQUIRED

A surface in the left column without its accent expression is an incomplete implementation, not a
stylistic choice.

| Surface | Accent expression |
|---|---|
| Primary button | `--accent-fill` + `--accent-on`; hover `--accent-fill-hover` plus a `0 0 0 4px` halo in `--accent-glow` at 18%, `dur.fast` |
| Hero CTA (`hero` variant) | as primary, size `lg`, plus G-9's magnetic follow |
| Secondary button | `--border-control` at rest; hover border → `--accent-border`, label → `--accent-ink` |
| Ghost button / icon button | hover: `--accent-wash` fill, `--accent-ink` glyph |
| Link | `--accent-ink` + underline sweep (G-10) |
| `CommandDock` — active item | **inverted pill** — `--accent-fill` + `--accent-on` glyph and label — plus `aria-current="page"` plus the 2px `--accent-mark` indicator bar outside the pill (G-3). _Was an `--accent-wash` pill; a wash is not enough emphasis for "where you are" once hue is gone._ |
| `CommandDock` — hover item | `--accent-wash` fill, glyph → `--accent-ink` |
| Header wordmark | **`F1` as an inverted badge** (§3.6.1) |
| Header hairline | `--border-subtle`, with a 96px `--accent-mark` segment at the left, appearing on scroll (G-13) |
| Scroll progress bar | 2px `--accent-mark`, `scaleX` scrubbed (G-14) |
| Landing headline | **the final word outlined** in `--accent-mark` (§3.6.1) |
| Landing eyebrow | 24px `--accent-mark` rule preceding the label |
| `CapabilityCard` | 1px `--accent-hairline` perimeter at rest, traced in `--accent-mark` on hover and focus (G-26); index number `--ink-tertiary` → `--accent-ink` on hover |
| `CoverageRuler` | the "available" span of each bar in `--accent-mark`; the unavailable span in `--surface-sunken` |
| `DataVintage` | the completeness meter's filled span in `--accent-mark`; `--border-control` boundary on the trigger |
| Table row hover (F2+) | 2px `--accent-mark` leading edge, `scaleY 0→1` from the row's vertical centre, `dur.instant` |
| Skeletons | **no accent.** Skeletons stay `--surface-sunken` — an accent-coloured skeleton implies content that is not there |
| Timing chips, status chips, identity chips | **no accent, ever** (§3.4, §3.3) |
| Focus ring | **no accent** (§3.5.1) |
| Any chart series | **no accent** (§6.2). The accent is not a categorical colour |
| `AtmosphereField` | the pointer lamp's lit dots, and the racing line's comet (§7.7) |

### 3.6.5 The CVD position: there are no residuals left

This section used to record seven CVD failures and a structural mitigation for each. **All seven are
gone**, and not by tuning — by construction.

An achromatic colour cannot be confused with a chromatic one under any dichromatic simulation,
because every CVD model preserves lightness and the accent differs from every reserved colour by
lightness alone. Measured (§9.2.2 **V-20**), worse of the two §9.1 models:

| Comparison | Min normal-vision ΔE | Min CVD ΔE | Floor |
|---|---|---|---|
| `--accent-ink` ↔ the 7 reserved semantics, light | **28.37** | **24.96** (status-critical) | 15 / 8 |
| `--accent-ink` ↔ the 7 reserved semantics, dark | **28.11** | **15.05** (status-good) | 15 / 8 |
| `--accent-mark` ↔ the 12 brand colours, light | **40.23** | **29.41** (Ferrari) | 15 / 8 |
| `--accent-mark` ↔ the 12 brand colours, dark | **20.03** | **14.87** (Mercedes) | 15 / 8 |

Compare CR-007's worst figures: `--accent-ink` ↔ `status-info` at **0.46** protanopic, and
`--accent-mark` ↔ Audi at **0.80** tritanopic. **The monochrome accent is not an accessibility
compromise; it is a strict accessibility improvement**, and §9.2.1's "no hue exists that clears the
CVD floor against all nineteen" combinatorial limit no longer applies, because the accent stopped
competing for hue space.

The chroma floor of §9.1 step 5 (**≥ 0.05 for any colour expected to read as a hue**) is **not
applicable** here and is recorded as such: the accent is expected *not* to read as a hue. Its measured
chroma is 0.0069 (light) and 0.0000 (dark), and `tokens.css.test.ts` enforces **< 0.02** on every
alias — a tighter and more useful gate than the retired reserved-hue-band test, because it makes a
collision impossible rather than merely distant.

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

- **The timing / easing / stagger set is defined once** here and in `src/lib/motion/tokens.ts`. Ad-hoc
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

**Durations** — GSAP takes seconds. `src/lib/motion/tokens.ts` exports seconds; `tokens.css` mirrors the
same figures in ms for CSS transitions.

| Token | s / ms | Use |
|---|---|---|
| `dur.instant` | 0.08 / 80 | colour or ink change on a control, hover wash |
| `dur.fast` | 0.14 / 140 | tooltips, chips, small fades, press feedback |
| `dur.base` | 0.20 / 200 | content entering, popovers, route enter |
| `dur.slow` | 0.32 / 320 | sheets, trays, the dock rail, the dock indicator |
| `dur.chart` | 0.40 / 400 | chart mount only — never on data update |
| `dur.reveal` | 0.72 / 720 | the landing headline characters (entrance budget only) |
| `dur.pointer` | 0.60 / — | `quickTo` catch-up for pointer-following (G-9, G-21, G-25) |

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
| `loop.field` | 34 | the dot lattice's drift — one 22px cell per cycle → **0.65 px/s** |
| `loop.comet` | 11 | racing-line comet, one lap |
| `loop.skeleton` | 1.2 | skeleton pulse |

**Staggers** — GSAP's object form, so `from` is explicit (Codrops tip 2).

| Token | Value | Use |
|---|---|---|
| `stagger.char` | `{ each: 0.018, from: "start" }` | SplitText characters |
| `stagger.nav` | `{ each: 0.035, from: "start" }` | dock items on mount |
| `stagger.row` | `{ each: 0.024, from: "start" }` | **list and table rows** — G-23, and a leaderboard's bars |
| `stagger.card` | `{ each: 0.045, from: "start" }` | **card and tile grids** — G-23, G-15's children |
| `stagger.bar` | `{ each: 0.06, from: "start" }` | **data marks growing from an axis** — G-27. First instance is the coverage ruler's six bars; every bar chart inherits it |
| `stagger.cap` | 12 | items after the 12th get **zero** delay — a 20-row stagger at 24ms would take 480ms and break the 400ms interaction ceiling |

**`stagger.cap` is expressed to GSAP as `amount`, not `each`.** `amount` distributes a *total* delay
across however many targets there are, so `amount: min(count, 12) × each` caps the sequence length
without capping the count. Implemented once as `staggerAmount()` in `src/lib/motion/scroll.ts`; a
call site that passes `each` directly has reintroduced the 480ms bug.

**Distances** — px. Small on purpose: every entrance here is a settle, not an arrival from off-screen.

| Token | px | Use |
|---|---|---|
| `dist.nudge` | 6 | shell mount, dock item entrance |
| `dist.step` | 8 | rows, popover rows |
| `dist.rise` | 10 | route content enter |
| `dist.lift` | 12 | dock container, sheet panel |
| `dist.section` | 16 | G-15, a section revealing on scroll |
| `dist.sheet` | 24 | the bottom sheet's travel |
| `dist.magnet` | 6 | G-9's clamp |

**Gesture magnitudes** — neither a duration nor a distance.

| Token | Value | Use |
|---|---|---|
| `gesture.tilt` | 4 (degrees) | G-25's `rotationX` / `rotationY` clamp. Past ~6° a card stops reading as a plane responding and starts reading as a page rendering incorrectly |
| `gesture.lift` | 1.015 (scale) | G-25. Deliberately small — the elevation is carried by `--elev-2`, not by the size change |

> **Path correction, 2026-08-07.** §4.2 and this section previously said the token set lives in
> `src/lib/motion.ts`. It does not and never did: it is **`src/lib/motion/tokens.ts`**, with the named
> motions split across `surfaces.ts`, `scroll.ts`, `text.ts` and `interactions.ts` in the same
> directory. `stagger.bar`, `dist` and `gesture` existed in that file and were missing from this table
> — which is exactly the drift a "defined once" section is supposed to make impossible, so it is
> recorded rather than quietly fixed.

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
| **G-0** | Root reduced-motion guard | `gsap.matchMedia()` | app mount | one `gsap.matchMedia()` per scope, created inside `useMotion` (`src/lib/motion/useMotion.ts`); every ambient and spatial tween registers through it. `src/lib/motion/gsap.ts` is the single place the plugins are registered | — (this *is* the mechanism) |
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
| **G-4** | Dock rail expand / collapse (≥1024) | CSS `transition` + `transition-delay` | `:hover` / `:focus-within` on the rail; the pin toggle | rail `width` `--size-dock`→`--size-dock-open` via `--dock-width`, `dur.slow`, `ease.move`; labels `opacity 0→1` and `x −6→0` via `--dock-label` / `--dock-label-x`, `dur.fast`, `ease.enter`, staggered by `transition-delay: calc(var(--dock-index) * 18ms)` — 7 × 18 + 140 = **266ms**, inside the 400ms ceiling. Collapse carries **no** delay: a staggered disappearance reads as lag. **`width` is animated here and this is the one permitted case** — a discrete user-initiated transition, not a loop, on a `position: fixed` element that triggers no layout in `main`; `scaleX` would distort the glyphs. **CSS rather than GSAP, and rewritten 2026-08-06 to be CSS *throughout*:** `:focus-within` has no reliable DOM event pair, so a tween wired to `pointerenter` would never fire for the keyboard user the clause exists for; and the React state that used to drive it was reported broken, verified working, and removed rather than trusted twice (§7.8.0) | **not created**, and the state is overridden: under `reduce` the rail is **permanently expanded at 232px** and the pin control is hidden — a hover-to-reveal affordance is exactly what reduced-motion users should not have to chase. The override wins at equal specificity by source order, which is why every open-state value is a custom property |
| **G-5** | Dock overflow sheet (<1024) | `gsap.timeline` | "More" tap | scrim `opacity 0→1`, `dur.fast`, `ease.enter`; panel `y 24→0` + `opacity 0→1`, `dur.slow`, `ease.arrive`; rows `opacity 0→1, y 8→0`, `dur.fast`, `stagger.nav`. Close reverses at `dur.base`, `ease.exit` | opacity only on scrim and panel, `dur.fast`, no stagger |
| **G-6** | Popover open / close (theme, coverage) | `gsap.fromTo` | trigger click / `Esc` / outside click | `opacity 0→1`, `scale 0.96→1`, `dur.fast`, `ease.enter`, `transformOrigin` at the trigger corner. Close: `opacity→0`, `scale→0.98`, `dur.instant`, `ease.exit` | opacity only, `dur.fast`, no `scale` |
| **G-7** | Control hover / press | Eases; `gsap.to` | `pointerenter`, `pointerdown` | hover: the surface / border / ink step for that control's §3.6.4 accent expression, as a **CSS transition** at `m.control`. Press: `scale: 0.985`, `m.press`, released on `pointerup`, `pointerleave` and `pointercancel` — the last two because a pointer that leaves or is interrupted mid-press must not leave a control visually held down. The focus ring is **CSS `:focus-visible`**, never a tween (§3.5.1). **Cards are no longer part of G-7:** their hover is G-25 + G-26 | token / colour change only — no `y`, no `scale`. The colour half runs outside the guard as a CSS transition, so a reduced-motion user still gets feedback |
| ~~**G-8**~~ | ~~Pointer spotlight~~ | — | — | **RETIRED 2026-08-06.** Rishabh on the cards it decorated: *"i dont really like them either."* Two independent reasons it goes rather than gets tuned: (a) with a monochrome accent a 14%-opacity achromatic radial over a panel or a glass surface reads as a **smudge** — the identical failure the atmosphere's orbs were removed for the same day; (b) it was one of four simultaneous polite effects on one element, and one committed gesture beats four polite ones. Its replacements are **G-25** (perspective tilt) and **G-26** (traced perimeter). Its `--px`/`--py` plumbing survives in the atmosphere's lamp, which is what it was worth keeping for. The ID is not reused |
| **G-9** | **Magnetic CTA** | `gsap.quickTo` | `pointermove` within 96px of the hero's primary button | `quickTo(btn,"x")` / `("y")` to `(pointer − centre) × 0.14`, clamped to **±6px**, `m.pointer`. On `pointerleave`, both return to 0 at `dur.slow`, `ease.arrive`. Applied to **exactly one element in the product** — the hero CTA. A page of magnetic buttons is a toy | **not created** |
| **G-10** | Link underline sweep | `gsap.to` | `pointerenter` / `focus` on an inline link | a 2px `--accent-mark` pseudo-element, `transformOrigin: "left center"`, `scaleX 0→1`, `dur.fast`, `ease.enter`; reverses `ease.exit`, `dur.instant`. The 1px rest-state underline never disappears, so the link is underlined at all times | CSS-only: the rest underline thickens to 2px instantly. Not a tween |
| **G-11** | Skeleton pulse | `gsap.to` with `repeat: -1, yoyo: true` | skeleton mount | `opacity 0.55→1`, `loop.skeleton`, `ease.drift`, `repeat: -1`, `yoyo: true`. Opacity only — never `background-position`, never a transform | **not created.** Static `opacity: 0.7`. This is the one case a reader most often gets wrong: an opacity loop is exactly the kind of ambient motion `reduce` is asking to stop |
| **G-12** | Skeleton → content swap | `gsap.timeline` | query resolves | skeleton `opacity→0`, `dur.fast`, `ease.exit`; content `opacity 0→1`, `dur.base`, `ease.enter`, overlapping by 40ms. The container holds its height so nothing jumps | identical — opacity only |
| **G-13** | Header hairline on scroll | `ScrollTrigger` (`start`, `toggleActions`) | `window` scroll past 24px | `ScrollTrigger { start: "24px top", toggleActions: "play none none reverse" }` on a timeline: the header's 1px `--border-subtle` bottom border `opacity 0→1`, `dur.fast`; a 96px `--accent-mark` segment at the left `scaleX 0→1`, `transformOrigin: "left"`, `dur.base`, `ease.enter`; `--surface-glass` blur 6px→12px | border appears instantly at the same threshold via a `data-scrolled` attribute; no `scaleX`, no blur tween |
| **G-14** | Scroll progress bar | `ScrollTrigger` with `scrub: true` | scroll on `/` only | 2px `--accent-mark` bar fixed at `top: 0`, `transformOrigin: "left"`, `scaleX 0→1`, `ease.none`, `ScrollTrigger { trigger: "#main", start: "top top", end: "bottom bottom", scrub: true }`. Derives from the documentation's scrub-linked example | **not created.** The bar is not rendered at all under `reduce` — a scroll-linked bar is inherently motion, and `document`-level progress is not information the page needs |
| **G-15** | Section reveal on scroll | `ScrollTrigger` (`once: true`) | section enters the viewport | `opacity 0→1, y 16→0`, `dur.base`, `ease.enter`, `ScrollTrigger { start: "top 88%", once: true }`. Children stagger with `stagger.card`, capped at `stagger.cap`. Derives from the documentation's "reveal on scroll once" example | opacity only, `dur.fast`, `once: true`, no `y`, no stagger |
| **G-16** | **Landing headline reveal** | `SplitText.create` + `gsap.timeline` | `/` mount, once per hard load | `SplitText.create(h1, { type: "chars,lines", mask: "lines", aria: "auto", autoSplit: true })` — `mask` uses SplitText 3.13+'s built-in clip wrappers rather than hand-nested `overflow: hidden` divs (Codrops tip 1), and `aria: "auto"` puts an `aria-label` on the `h1` and `aria-hidden` on every char, which is why this is accessible. Then `gsap.from(split.chars, { yPercent: 118, opacity: 0, duration: dur.reveal, ease: "expo.out", stagger: stagger.char })`. 9 characters × 18ms + 720ms = **≈880ms**, inside the entrance budget | **not created — and no split is performed at all.** The `h1` renders as plain text and fades `opacity 0→1` at `dur.fast`. Splitting text under `reduce` is pointless DOM churn |
| **G-17** | Stat-figure count-up | `gsap.to` with `snap` | `/` mount, after G-16, once | `gsap.to(proxy, { value: target, duration: 0.9, ease: "power2.out", snap: { value: 1 }, onUpdate })`, staggered `{ each: 0.06 }` across the strip. Safe only because every figure is Chivo Mono tabular (§2.4) — a proportional font would reflow every frame | **not created.** The final value is written once with `gsap.set` |
| **G-18** | Atmosphere — lattice drift | CSS `@keyframes` (MR-1) | app mount | **both** lattice layers (`.atmosphere-dots` and `.atmosphere-lamp`), sized `calc(100% + 2 cells)` and offset one cell: `transform: translate3d(--size-field-cell, --size-field-cell, 0)`, `--anim-field` (34s), `linear`, `infinite`. Seamless because the translation is exactly one cell, so the loop has no visible seam and needs no `yoyo`. **0.65 px/s** — slower than the retired grid's 2 px/s, because a lattice with a visible pitch reports its own motion far more legibly than a wireframe did | **stopped by chokepoint 1.** Both layers rest at `transform: none`, which is their authored position (MR-2) |
| ~~**G-19**~~ | ~~Atmosphere — orb drift~~ | — | — | **RETIRED 2026-08-06 with the orbs it moved** (§7.7.0). A 720px ellipse behind an 80px blur drifting 64px over 18s is stationary to the eye; a soft gradient has no edge for motion to register against. The ID is not reused | — |
| **G-20** | Atmosphere — racing-line comet | CSS `@keyframes` on `offset-distance` (MR-1) | app mount, `/` only | the comet declares `offset-path: path("…")` and `offset-rotate: auto`; the loop runs `offset-distance: 0% → 100%`, `--anim-comet` (11s), `linear`, `infinite`. **Deliberately not `MotionPathPlugin`** — native CSS motion path has been baseline-supported since 2022, is composited, and saves 9.7 KB gzipped. `offset-distance` is the one documented exception to "transform and opacity only" (§4.2): it is composited and triggers no layout | **not created.** The comet is `display: none` by media query in `backdrop.css`, so it is absent even before hydration; the static racing-line stroke remains, which is the intended still image |
| **G-21** | **Atmosphere — pointer lamp** | `gsap.quickTo` (docs: *"cursor-following"*) | `pointermove` on `window`, every route except `off`, `(pointer: fine)` only | three `quickTo` setters write `--px`, `--py` (element-relative **px**, from `getBoundingClientRect()`) and `--lamp` (unitless 0→1) on the atmosphere **root**, at `m.pointer`; CSS masks a copy of the lattice drawn at `--bg-dot-lit` to a `--size-lamp` (340px) circle at those coordinates. **The dots under the cursor harden; nothing moves toward it.** No clamp — the position is absolute, and what bounds it is the mask radius, in CSS. Route intensity is `--bg-lamp-max`, not this trigger. **Replaces the orb parallax of the same ID**, which was the same idea applied to marks with no edge | **not created.** No setter, no listener, no tween; `--lamp` stays at its authored `0`, so the lamp is **absent rather than frozen** — a light with nobody holding it is decoration |
| **G-22** | Theme change | — CSS, not GSAP | `data-theme` change on `<html>` | `background-color` and `color` transition `dur.base` / `ease-in-out` on `:root` and on `[data-theme] *`; **no transition on the `--*` custom properties themselves**, none on `transform`, none on the atmosphere's opacity | transition removed entirely — instant swap |
| **G-23** | List / grid reveal _(defined here, first used F2)_ | `gsap.from` with `stagger` | list mount | `opacity 0→1, y 8→0`, `dur.base`, `ease.enter`, `stagger.row` (rows) or `stagger.card` (grids), capped at `stagger.cap` | opacity only, `dur.fast`, stagger `each: 0` |
| **G-24** | Shared element card → profile _(defined here, first used F4; `Flip` is NOT installed in F0)_ | `Flip.from` / `Flip.getState` | route change between a card and its profile page | `const state = Flip.getState(targets)` before the route commits, then `Flip.from(state, { duration: dur.slow, ease: "power2.inOut", absolute: true, scale: true })`. Still the highest-value animation in this product | **not created.** The card and the profile render independently |
| **G-25** | **Card perspective tilt** | `gsap.quickTo` (docs: *3D transforms*, `rotationX`/`rotationY`) | `pointermove` on a `CapabilityCard`, `(pointer: fine)` only | two `quickTo` setters drive `rotationY` and `rotationX` toward the pointer at `m.pointer`, clamped to **±`gesture.tilt` (4°)** by normalising the pointer's offset within the element to ±1; plus `scale → gesture.lift` (1.015) at `dur.fast` / `ease.enter`. `transformPerspective: 900` is set **on the element**, not as a CSS `perspective` on the grid — a shared vanishing point would skew a card at the edge of a three-column grid instead of tilting it. On `pointerleave` everything settles together at `dur.slow` / `ease.arrive`, the long deceleration §4.3 calls weight transfer; a card that snapped flat would undo the physicality the tilt buys. The arithmetic is the pure exported `tiltAngles`, unit-tested including the clamp, the sign of each axis and the degenerate zero-size rect | **not created.** No tween object and no inline transform ever exists, so — unlike the retired CSS lift — this needs no `transform: none` override. Toggling the OS preference mid-hover reverts the context and clears the inline transform with it |
| **G-26** | **Card traced brackets** | CSS `transition` on `clip-path` | `:hover` / `:focus-visible` on a `CapabilityCard` | two boxes inset 8px, each carrying only two borders in `--accent-mark` at `--size-rule` (2px), revealed by `clip-path: inset(0 100% 100% 0) → inset(0)` and `inset(100% 0 0 100%) → inset(0)` over `dur.slow` / `ease.enter` — so the pair closes on the card from **opposite corners**, like a viewfinder's crop marks. **CSS rather than a stroked SVG perimeter, for three reasons:** `pathLength` on an SVG *basic shape* is SVG 2 with uneven support and a `<path>` in a stretched `viewBox` would distort its own corner radii; `clip-path` is a paint operation, so it triggers no layout and needs no element per edge; and `:focus-visible` is a browser heuristic with no reliable DOM event pair, so a GSAP draw could never fire for the keyboard user the clause exists for | **stopped by chokepoint 1**, which leaves the brackets arriving instantly on hover — a **state change**, which is exactly what G-7's reduced column asks for. Their resting `clip-path` is the undrawn one, and that is the legitimate MR-2 exception a decorative mark carries: they hold no content, the same reason `.header-hairline-accent` rests at `scaleX(0)` |

#### 4.6.1 Motion by component — the table that was missing

§4.6 numbers the motions; it never listed which components carry which, and the gap had a
consequence: §4.6 G-7 said `y: -1` on a card, §3.5.2 said `-1`, §3.4 of the F0 Design Spec said
`-2`, **2px shipped**, and nothing reconciled the three. This table is the reconciliation, and it is
the authority when the prose disagrees.

| Component | Mount | Hover / focus | Press | Active state | Reduced |
|---|---|---|---|---|---|
| `AppShell` header | G-1 | — | — | — | opacity only |
| `AtmosphereField` | — | **G-21** (pointer lamp) | — | — | G-18 stopped, G-20 absent, G-21 not created |
| `CommandDock` container | G-1 | **G-4** (rail width + label stagger) | — | — | permanently expanded, pin hidden |
| `CommandDock` item | G-1 (staggered) | G-7 colour half — `--accent-wash` + `--accent-ink` | — | **inverted pill** + G-3 indicator | colour only |
| `Button` (`primary` / `secondary` / `ghost`) | — | G-7 colour half | G-7 press | — | colour only |
| `Button` (`hero`) | — | G-7 colour half + **G-9** magnet + arrow `x: 3` | G-7 press | — | colour only, no magnet |
| **`CapabilityCard`** | G-15 (staggered) | **G-25** tilt ±4° + `scale 1.015` · **G-26** brackets · `--elev-2` shadow · index → `--accent-ink` · arrow `x: 3` | — | — | tilt and brackets' *transitions* absent; the token and bracket states still arrive, instantly. Arrow nudge suppressed outright |
| `CoverageRuler` bar | `stagger.bar`, axis-anchored | row surface step | — | — | opacity only |
| `DataVintage` | G-12 | G-7 colour half; chevron rotates on `[data-open]` | G-7 press | `[data-open='true']` wash + border | colour only, chevron rotation instant |
| Popover (theme, coverage) | **G-6** | row surface step | — | selected row `--surface-sunken` | opacity only |
| `DockSheet` | **G-5** | row surface step | — | `--accent-wash` row | opacity only |
| Skeleton | **G-11** | — | — | — | static `opacity: 0.7` |
| Landing headline | **G-16** (SplitText) | — | — | — | no split; plain fade |
| Stat figure | **G-17** count-up | — | — | — | final value written once |
| Header hairline | — | **G-13** on scroll | — | — | border appears at the same threshold, no `scaleX` |
| Scroll progress | — | **G-14** scrubbed | — | — | not rendered |
| Link | — | **G-10** underline sweep | — | — | rest underline thickens instantly |
| `SeasonMasthead` · `SeasonCalendar` | **G-2 only — no G-15.** See the two rules below | row surface step (calendar) | — | — | opacity only, from G-2 |

##### Two rules G-15 was missing, and the capture that produced them _(2026-08-07)_

Rishabh captured `/seasons/1951` about a second into a cold load. It showed the year and both
section headings at low opacity and **nothing else** — no rows, no cards. It read as broken. The
skeletons were not missing: they were rendering and holding their exact height. **They were inside
G-15's stagger, so they started at `opacity: 0`.** Both rules below are binding from here.

1. **A loading state is never animated in.** A skeleton exists to say *"this box is coming"*; a
   skeleton fading in over `dur.base` says nothing for 200ms, which is most of the window a fast
   query is visible for at all. `data-motion="reveal-item"` therefore **never goes on a skeleton or
   on a container that holds one** — put it on resolved content, or leave the section unrevealed.
2. **G-15 is for sections below the initial viewport, and only those.** It is a *scroll* reveal; a
   section that is already on screen at first paint has nothing to reveal to, and gating its
   visibility on `from(opacity: 0)` makes the trigger load-bearing for content being visible at all.
   A section that can be in the first screen uses **G-2** — which already animates the whole route's
   content as one block — and nothing else. Three staggered entrances on one screen is what made the
   page look like it was assembling itself rather than arriving.

The audit that follows from rule 2: on `/`, `HeroSection` correctly has no G-15 and `CoverageRuler`
correctly has one. `CapabilityGrid` sits at the fold boundary and is left as it is, because its
content is static — there is no query and therefore no skeleton, so rule 1 cannot bite it.

#### 4.6.2 Chart motion — G-27 … G-30 _(specified 2026-08-07)_

This replaced a one-line forward reference that said chart entry was *"axis-anchored growth for bars,
left-to-right `strokeDasharray` draw for lines"* and deferred the rest. The dasharray half of that
sentence has been **withdrawn** — see G-28.

| ID | Motion | GSAP reference | Trigger | Spec | Reduced motion |
|---|---|---|---|---|---|
| **G-27** | **Chart mount — axis-anchored bar growth** | `gsap.from` + `stagger`, Eases | chart mount, once | each bar `scaleY: 0 → 1` with `transformOrigin` at **the baseline** — `"center bottom"` for columns, `"left center"` for horizontal bars — `dur.chart`, `ease.mech`, `stagger.bar` via `amount` (capped at `stagger.cap`). **The origin is the axis, never the mark's own centre**: a bar that grows from its middle is not reporting a magnitude, it is decorating one. `ease.mech` (`circ.out`) is the "mechanical" curve and this is what it exists for. Total for a 12-bar chart: 12 × 60 + 400 = **1120ms** — outside the interaction ceiling and **legal only because a chart mount is not an interaction path**; a chart re-entering on a filter change would not be | opacity only, `dur.fast`, **no stagger, no `scaleY`**. Bars are at full length in the DOM from frame one |
| **G-28** | **Chart mount — left-to-right reveal** for lines, areas, scatters and their markers | `gsap.to` on a transform, Eases | chart mount, once | **one tween for the whole mark layer.** The layer is wrapped in a `<g clip-path="url(#…)">`; the `<clipPath clipPathUnits="userSpaceOnUse">` holds a single `<rect>` covering the plot area, and the tween runs `scaleX: 0 → 1` on **that rect** with `transformOrigin` at the plot area's left edge. `dur.chart`, `ease.none` — a reveal that eased would imply the *time axis* was accelerating. Markers appear as the edge passes them, for free, with no per-marker tween | **not created.** The clip rect is at `scaleX: 1`, its authored state, so the chart is simply drawn |
| **G-29** | **Chart data update — deliberately no motion** | — | any query result replacing another | **Nothing animates.** Marks are re-rendered at their new positions in one frame. The exception, and the only one: a **deliberate user action** that changes the entity set or the scope may cross-fade the mark layer, `opacity`, `dur.fast`, `ease.enter` — never a re-run of G-27 or G-28. A chart that re-animates while someone is reading it is a defect (§4.2), and this row exists so §4.6.1 can cite it per component instead of relying on a rule nobody looks up | identical — there is nothing to reduce |
| **G-30** | **Crosshair and tooltip readout** | `gsap.quickSetter` (docs: *"quickSetter"*) | `pointermove` / arrow keys within a plot area | **the readout snaps; it never follows.** `quickSetter` writes the crosshair's `x` and the tooltip's `x`/`y` with **no tween at all** — `m.pointer`'s 600ms catch-up is for decoration (G-9, G-21, G-25), and a value readout that lags behind the cursor is misreporting which lap the reader is pointing at. The only motion is the tooltip's **arrival**: `opacity 0 → 1`, `dur.fast`, `ease.enter`, once per entry into the plot area, not per move | opacity kept (a 140ms crossfade is not what `reduce` protects against, §4.4 rule 1); position was never tweened, so nothing changes |

**Why not `DrawSVG`, and why not `strokeDashoffset`.** `DrawSVG` is 9.7 KB gzipped and is not
installed (§4.1). `strokeDashoffset` would need `getTotalLength()` per path and reveals at constant
*arc* speed, so a steep segment of a lap-time trace crawls while a flat one races — the reveal would
report gradient rather than time. It also animates a non-transform property, which would need a second
exception to §4.2 on top of `offset-distance`. The clip-rect transform needs neither: it is a
transform, it triggers no layout, it is exact against the **plot area** rather than the data's bounding
box, and one tween covers every mark type at once. `clip-path` as a reveal channel is already
precedented by G-26.

**`clipPathUnits="userSpaceOnUse"` is load-bearing.** The default, `objectBoundingBox`, resolves
against the *data's* bounding box, so a series that stops short of the right edge would finish its
reveal early and a chart with one short series would reveal at a visibly different rate from its
neighbour in a small-multiples grid.

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
| `--size-dock-item` | 48 | a rail row's **height**, and a bottom-dock slot's **min-width**. It is *not* the rail's inner width — see `--size-dock-lane` |
| `--size-dock-hairline` | 1 | the dock's own border width. A token because `.dock` consumes it as `border-width` **and** `--size-dock-lane` subtracts it, so the two cannot drift |
| `--size-dock-lane` | **46** | `calc(--size-dock − --size-dock-hairline × 2 − --size-dock-pad × 2)`. **The collapsed rail's inner width, and the only figure a glyph may be centred against.** Under `box-sizing: border-box` the dock's two 1px borders come out of its 64px width as well as its padding, so the lane is 46 and not 48 — see §7.8.0 fault 5 |
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

> **Superseded 2026-08-07.** This section previously read *"Recharts for standard charts, visx for
> lap-level charts"*. `ARCHITECTURE.md` §10 #28 replaced both with **d3 primitives plus an in-repo
> kit**, and **nothing is installed**. Any spec naming Recharts or visx is stale.

**One kit, no library.** Every chart in this product is drawn by a small in-repo component set over
d3's scale and shape primitives. The language below is specified so it is **buildable from those
primitives** — no chart-library feature is assumed anywhere in it.

**The d3 primitives the kit needs**, and nothing beyond them:

| Package | Used for | Notes |
|---|---|---|
| `d3-scale` | `scaleLinear`, `scaleTime`, `scaleBand`, `scalePoint` | the whole coordinate system |
| `d3-shape` | `line`, `area`, `curveLinear`, `curveMonotoneX`, `stack` | path generation |
| `d3-array` | `extent`, `max`, `bisector`, `group`, `rollup` | domains, and the crosshair's nearest-point lookup |
| `d3-time-format` | axis tick labels on a `scaleTime` | the one formatter d3 supplies that `src/lib/format.ts` does not; `ARCHITECTURE.md` §4 lists it |
| `d3-axis` | ✗ **not used** | it writes DOM imperatively; §6.3's ticks are React output from `scale.ticks()` |
| `d3-selection`, `d3-transition` | ✗ **not used** | React owns the DOM and GSAP owns motion. Two DOM writers in one subtree is the defect class this avoids |
| `d3-format` | ✗ **not used** | numerals go through `src/lib/format.ts`. A second number formatter would drift on lap times, which are the one quantity in this product with a non-obvious form |

**Cost, measured (`ARCHITECTURE.md` §4): the primitives are 16.33 KB gzipped** — against Recharts'
121.72 KB import surface and visx's 29.96 KB. That is the whole reason the kit exists.

**Everything is SVG, and every colour is a `var()`.** SVG presentation attributes are CSS properties,
so `stroke: var(--ramp-3-plot)` resolves through `[data-theme]` and a theme switch needs no re-render
and no JS colour table. **No component ever holds a literal hex.**

**The kit is built — F2, 2026-08-07.** The four primitives are installed and the in-repo kit lives in
`src/components/charts/`. The earlier flag asking whether any of it could move into F1 is closed by
events: it landed in F2 as planned.

| Module | What it is |
|---|---|
| `geometry.ts` | **Pure arithmetic**, no React and no d3: tick density, label striding, the horizontal-bar rule, computed margins, §6.5.2's direct-label de-collision, and the marker paths. This is where the layout is *tested*, because jsdom performs no layout and a rendered axis proves nothing. |
| `ladder.ts` | §6.4 and §6.4a — which non-colour channels the chart switches on, and which value each series takes. |
| `Axis.tsx` | `MeasureAxis`, `CategoryAxis`, `ReferenceLine`. They take **positions, not scales**: d3 owns the tick *values*, this owns where they are drawn. |
| `ChartFrame.tsx` | The header, the Chart/Table and Colour/Patterns toggles, the note slot, the five plot states, the caption, and the print copy of the table. **It takes exactly one measure axis, so a dual-axis chart is not expressible.** |
| `ChartLegend.tsx` · `ChartTable.tsx` · `MarkerGlyph.tsx` | §6.5.2, §6.5.5, and rung 2's shapes plus rung 4's hatch. |
| `LineChart.tsx` · `BarChart.tsx` | The two forms F2 needs. Both consume `SeriesInput` / `BarDatum` from `types.ts` — **fixture shapes, not an endpoint's**, because a chart component that only works against one response is that endpoint's renderer rather than a kit. |
| `useChartSize.ts` | Width is measured from the container; **height is a token**, because §6.5.3 requires the plot area to hold its exact height through all five states. |

Chart motion is `src/lib/motion/chart.ts` (G-27 … G-30), because `gsap` may only be imported inside
`src/lib/motion/**`.

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
  in §3.2. **Not optional, and not a link to somewhere else** — see §6.5.5.
- **Points are never summed across eras.** 24 point systems, and some eras counted only best-N
  results (`DATABASE.md` §7). A chart whose y-axis is "career points" is a defect, not a design
  choice. Read `driver_championship`, or use a rate metric, and say which in the axis label.

**One permitted repaint, and it is named rather than hidden.** §6.2 forbids repainting survivors when
the series count changes. Adding or removing a **teammate** re-shades that team's pair, because a
shade pair only exists relative to its other member (§6.4a). It is a change in *entity relationship*,
not in rank; it is always the result of a deliberate action in the compare tray; and it is the one
case §4.2 allows a chart to re-animate. Nothing else may repaint.

### 6.3 The chart furniture — one axis, one grid, everywhere

Every figure below is a token. A chart that sets a literal is a review failure.

| Element | Token | Geometry |
|---|---|---|
| Plot area | `--surface-sunken` | the plot area is **recessed**, so a mark's 3:1 floor is measured against it (§9.1) |
| Axis line | `--border-strong` | **1px**, and **only on the measure axis** — see below |
| Gridline | `--border-subtle` | **1px**, dashed `2 4`, perpendicular to the measure axis only |
| Tick label | `--ink-tertiary` | `--text-2xs`, `--font-mono` for any numeral (§2.4 — tabular, always) |
| Axis title | `--ink-secondary` | `--text-xs`, sentence case, **carries the unit** |
| Crosshair | `--border-strong` | 1px, dashed `2 3` |
| Mark stroke | entity token | **2px** |
| Marker | entity token | **≥ 8px** across, 1.5px `--surface-sunken` ring where marks overlap, **equal area across all four shapes** — see below |
| Bar / area fill | entity token | **2px `--surface-sunken` gap** between adjacent fills |
| Bar data-end | — | **4px** radius, **on the far end only**, square against the baseline |
| Reference line (e.g. a personal best) | `--border-strong` | 1px, dashed `4 4`, label at the right end in `--ink-tertiary` |

**One axis line, not two.** The category axis gets **no line** — the marks already sit on it and a
second rule is a box drawn around the data. This is the recessive-furniture rule made specific, and it
is the single most common way a competent chart still looks like a spreadsheet.

**The four marker shapes are equal *area*, not equal width** _(added 2026-08-07)_. A square and a
circle of the same bounding box are not the same size to the eye — the square is about 27% heavier —
so a marker set built on a shared width makes one series read as *more* than another, encoding
magnitude by accident on a channel that carries identity only. The circle at `--size-mark-marker` is
the reference and every other shape's dimension is derived to enclose the same area; the triangle is
additionally centred on its **centroid** rather than its bounding box, or it sits visibly low against
a circle at the same value. `geometry.test.ts` measures the emitted path by the shoelace formula.

**The measure axis's title is an occupant of the gutter, not a rounding allowance** _(added
2026-08-07)_. `computeMargin` reserved the widest tick label plus `4px` for the rotated title. 4px is
not a separation, and the rotated title occupies a full `AXIS_TITLE_LINE` of width — so on 1996 R1 the
rank chart's freed gutter put a surname straight into it: `Race position` × `Verstappen`. The band is
now `AXIS_TITLE_LINE + AXIS_GAP` and `Axis.tsx` draws the title centred at `AXIS_TITLE_LINE / 2`, so
the reservation and the glyphs cannot disagree.

**This was the fourth instance of §1.0's sibling pattern — "correct intent, wrong coordinate space" —
and it happened *inside the fix for the third*.** The generalisation, which is now the rule: **a
position is only correct relative to a space, so anything asserting a position must also account for
what else is in that space.** jsdom cannot see a bounding box, so this class is caught by measuring the
rendered DOM, not by the test suite. The four: a tooltip transform against the static flow position; a
`pointerenter` on a path under the hit rect; labels de-collided within their own set in a shared
gutter; and a title band sized by a rounding allowance.

**1px strokes are drawn on half-pixel coordinates.** An SVG line at an integer coordinate straddles
the pixel boundary and rasterises as two half-intensity rows, which is how a "1px" gridline comes out
looking like a 2px grey smear and the recessive furniture stops being recessive. Nothing in this
project can *see* that — there is no rasteriser in the pipeline — so it is applied by rule.

**Marker density is a rule too, and the ≥8px floor is what forces it** _(added 2026-08-07, F3)_. A
modern race is **58 laps over ~800px — 13.8px between adjacent points**, and an 8px marker with its
1.5px ring occupies 11px. So at race density the markers nearly touch, and at four series there are
232 of them hiding the lines they annotate. `geometry.shouldDrawMarkers` draws them only when adjacent
points are **≥ 2×** the marker's full width apart; below that the line is the signal and the crosshair
is the readout. Twice and not once, because touching and nearly-touching are both illegible — the same
reasoning §6.4's dash rung applies to its period.

**A lap-time axis has a mandatory ceiling, and this is measured, not stylistic** _(added 2026-08-07)_.
On 2026 R1 (one session, 1,003 lap rows): fastest **82.091s**, median 85.228s, p90 98.755s, p99
122.340s — and **maximum 1,168.144s**, a lap spent stationary under a red flag. That is not bad data;
it is what the lap took. But an axis that accommodates it compresses every racing lap into **7% of the
plot**, so an unclipped trace is a chart of one stoppage rather than of pace.

The ceiling is **`fastest × 1.5`** — 123.1s on that race, just above p99, so it holds 99% of laps
including pit and traffic laps while excluding the two stoppage laps. A multiple of the session's own
fastest lap rather than a percentile, because it is a **physical** bound (a lap 50% slower than the
best is not racing) and therefore means the same thing on a 90-second street circuit as on a 40-second
oval. **Laps above it are never silently dropped:** an off-scale caret at the ceiling in the series
colour, a count in a note above the plot, and their exact values in the table view — which every chart
has (§6.5.5), and which is what makes clipping honest rather than lossy.

**Tick density is a rule, not a judgement.** The kit computes ticks from `scale.ticks(n)` where `n`
comes from the axis length, so density is consistent across every chart in the product:

| Axis | Rule | Reason |
|---|---|---|
| Measure (usually y) | `max(3, min(6, round(px / 56)))` | 56px is comfortably more than `--text-2xs`'s 14px line-height plus breathing room; 6 is where a value axis starts reading as a ruler |
| Time / round (usually x) | `max(2, min(12, round(px / 72)))`, then **drop labels, never ticks**, until none collide | a dropped tick loses the position; a dropped label loses only the reading |
| Category (band) | **every band is labelled** | if they do not fit, the chart is horizontal instead — see below |

**A category axis that does not fit rotates the chart, it never rotates the label.** Angled tick
labels are ~20% slower to read and force a taller axis gutter. With more than ~7 categories, or any
label over ~12 characters, the bar chart is **horizontal**: categories run down the left in
`--text-xs`, the measure runs along the bottom.

> **And a rotated chart whose rows do not fit GROWS** _(added 2026-08-07, F3)_. The rule above was
> right and incomplete: **rotating moves the fitting problem from the x axis to the y axis, where the
> capacity is different — and nothing checked the new one.** Measured on 2026 R1's pit timeline: 32
> stops, each label 8 characters, so rotation fired correctly on *count* — and then 32 rows in a 360px
> plot gave an **11.3px pitch against a 14px line-height**, producing **31 overlaps across 40 text
> nodes**. `labelCapacity(360)` is 23; 32 fits in neither orientation.
>
> So a horizontal bar chart's plot height is **derived from its category count**
> (`geometry.categoryPlotHeight`), and `--size-plot-lg` is a **floor rather than the value**. A
> leaderboard grows and its panel scrolls; it does not crush its own labels. This also pre-answers F8's
> records charts, which are the same shape.
>
> §6.5.3's *"the plot keeps its exact height in every state"* is not weakened: the height is a function
> of data the caller already holds, so it is identical across loading, ready and empty for one dataset —
> which is the property that rule protects.
>
> **A note on how this was diagnosed, because both first guesses were wrong.** I predicted the failure
> would be the rotation heuristic not firing; the reviewer read the raster the same way. It *had*
> rotated. Only running the arithmetic showed the collision was vertical. **A prediction about where a
> defect is does not survive contact with the measurement of what it is.**

> **The rule above was right and its implementation was wrong twice** _(2026-08-08, found on
> `/teams/ferrari`)_. Both corrections are in the kit.
>
> **1. It applies to every band chart, not only to a rotated bar.** `SpanChart` and `ShareChart` lay
> rows out with the same `scaleBand` and label every one of them, and neither derived its height from
> its row count. Ferrari's lineup is **24 rows — a 13.0px band step against a 14px line-height** — and
> its points split is **77 seasons at 4.0px**, so the driver codes and the season labels rendered as an
> illegible stack. `geometry.bandPlotHeight(count, margin)` now serves all three, and it **counts the
> axis chrome** the bar chart's version omitted: rows live in `innerHeight`, which is 49px less than
> the plot height once the tick line, the axis gap and the axis title are taken out.
>
> **2. The floor is a `min-height`, not a `height`.** As an inline `height` the override *replaced* the
> responsive `--size-plot*` token, so the caller had to supply a figure in every case and could only
> get one by reading the measured height — **which is a feedback loop, and it oscillated**: the bar
> chart grew only `if (count > labelCapacity(measured))`, growing made that false, the override was
> withdrawn, the plot fell back to 360px, and the condition was true again. A figure derived from the
> **row count and the labels alone** has no fixed point to chase, and it is what §6.5.3 asked for in the
> first place — identical across loading, ready and empty for one dataset.

**A measure axis may never draw two ticks with the same label** _(added 2026-08-08)_.

A measure axis encodes value in **position**, so two ticks reading the same value at two positions is
not clutter — it is a false statement about the scale, of the same class as a truncated bar axis.

It shipped. The lineup chart's axis is seasons and its formatter is `String(Math.round(value))`, and
the placeholder `[0, 1]` domain a chart falls back to **while its payload is in flight** gave ticks at
`0, 0.2 … 1` and six labels reading `0, 0, 0, 1, 1, 1`. `SpanChart` keyed its gridlines and tick text
**by that label**, so React logged four duplicate keys — `grid-0`, `grid-1`, `tick-0`, `tick-1` — eight
warnings a render, **sixteen under `StrictMode`**.

- **Every axis in the kit keys its ticks by index.** A tick has no identity worth preserving across a
  render: nothing transitions one, and the entrance is a single clip wipe over the whole plot (G-28).
  A label is a value the caller's formatter is free to repeat, and it is therefore never a key.
- **`geometry.dedupeTickLabels` removes the duplicates themselves**, applied in `MeasureAxis` and in
  `SpanChart`. Keying by index alone would have silenced React and left the axis still drawing three
  ticks labelled `0`; the duplicate key was the symptom that surfaced, and the non-injective formatter
  is the defect.
- **The endpoint wins its run.** Labels off a monotonic scale duplicate in consecutive runs; the first
  of each run survives, except the final run, which keeps its **last** tick. That is `withEndpoints`'
  precedent applied a second time — keeping the first would draw the `1` of a `[0, 1]` axis at 60% of
  its width, a worse lie than the duplicate it removed.
- **Not applied to `CategoryAxis`.** There a label is a *name*, two categories may honestly share one,
  and dropping a band would delete a real reading.

> **The lesson, and it is the same one §1.0 keeps collecting: the loading state is a state.** Both
> defects on that page were reachable only through renders no test had ever performed — the axis fault
> needed the in-flight domain, the overlap needed a real entity's row count rather than a two-row
> fixture. **A chart's fixtures must include the shape of the largest real caller**, not a legible
> sample of it.

**Zero, and where the axis starts.**

- A **bar or area** measure axis **always includes zero**. Length is the encoding; truncating it lies.
- A **line** measure axis does not have to, because position is the encoding — but a non-zero
  baseline is **always** stated in the axis title (`"Gap to leader (s) — axis does not start at 0"`).
- A **position** axis (P1 … P20) is **inverted**, with P1 at the top. Never a numeric axis pointed the
  ordinary way: in F1, up means faster, and 1 is the best value. Ticks at 1, 5, 10, 15, 20.

> **Three gaps the first real surface exposed, 2026-08-07 — recorded rather than worked around.**
> Every one of them is a rule this section already stated that the kit had no way to express. That is
> the specific failure mode CR-010 exists to catch, so all three are fixed in the kit, not in the
> caller.
>
> **1. A position axis cannot be computed, and computing it produced a `P0`.** The tick rule above
> says 1/5/10/15/20; `LineChart` derived its ticks from `scale.ticks(n)` after `.nice()`. On a
> `[1, 22]` domain `.nice()` widens outward to a round boundary and emits **`0` — a championship
> position that does not exist.** `geometry.positionTicksWithin(min, max)` now supplies §6.3's fixed
> set clipped to the field, `LineChart` takes `yTickValues`, and **`.nice()` is skipped whenever ticks
> are pinned** — with explicit ticks, nicing also pushes P1 off the axis edge it should sit on.
>
> **2. The measure domain is sometimes a property of the selection, not of the data.** `LineChart`
> takes `yDomain`. This is the one permitted override and it does **not** relax the bar/area zero
> rule, which `BarChart` still enforces unconditionally.
>
> > **Reversed the same day, on seeing it render.** This first read *"the axis is the size of the
> > grid; four drivers who ran 1st–6th must not get an axis that stops at P6, because the reader's
> > question is how close to the front"* — and the season hub was built that way. Rishabh's capture
> > killed it: with four title contenders in P1–P4 against a P1–P20 axis, **about 80% of the plot was
> > empty** and it read as a chart that had failed to load its lower half.
> >
> > The argument was half wrong, and identifying which half is the useful part. *"How close to the
> > front"* is answered by **P1 being on the axis** — not by rendering fifteen positions nobody in
> > the selection ever held. So the rule is: **the minimum of a position axis is always P1, never
> > derived from the data**, and the maximum is the deepest position *in the selection*, snapped up
> > to the next position tick so the axis ends on a labelled gridline. A comparison including a
> > midfielder still gets a deep axis; a title fight gets a tight one.
> >
> > **This is not the truncation this section forbids.** That rule is about *length* being the
> > encoding — a bar or an area, where a short axis inflates a difference. A position is an ordinal
> > read off a labelled axis where every gridline says `P5`, `P10`; nothing is exaggerated by the
> > span. `snapToPositionTick` also does not clip a field deeper than the last tick, because 1989 had
> > 26 cars.
>
> **3. §6.5.1's tooltip and the axis ticks need different formatters.** One `formatX` served both, so
> a round axis read `R7` in the gutter *and* `R7` in the tooltip — but the reader at a crosshair is
> asking **which race**, and `R7 · Belgian Grand Prix` is the answer. Putting that on the ticks would
> collide every label on the axis. `LineChart` takes `formatXLong`, used by the tooltip title and by
> the `aria-live` readout — so the screen-reader reading gains the race name too, which is the larger
> of the two wins.

**A chart's mount animation is keyed by a *value*, never by an array or object identity**
_(added 2026-08-07)_. `useMotion` hard-codes `revertOnUpdate: true` and `useGSAP` compares deps by
identity, so a dep that is rebuilt each render tears G-27/G-28 down and re-creates them **on every
render**. `LineChart` sets state on `pointermove`, so this made dragging the pointer across a plot
restart the reveal continuously — a defect neither chart test could see, because both force
`prefers-reduced-motion: reduce` and therefore never create a tween at all. The key is
`geometry.mountKey(references, width, height)`: a string, so it compares by value, built only from
what legitimately re-mounts a chart. **`src/components/charts/charts.motion.test.tsx` runs with
motion enabled and counts timelines**; a chart test suite that never creates a tween is not testing
the charts' motion.

### 6.4 Runtime collision detection and the differentiator ladder

Given the entities the user selected, compute pairwise perceptual distance on **the colours actually
assigned** (§9.1 metric, both CVD models) and assign a differentiator to any pair that collides.
**This is a design requirement, not an optimisation** — it is what makes tier B of the ramp safe to
ship (§3.3a.2) and it is what carries every cross-source collision.

**Thresholds.** A pair collides when normal-vision ΔE < 15 **or** worst-model CVD ΔE < 8 — the same
two floors the palette is built on, so a collision is by definition a pair the palette did not
promise to separate.

> **Two corrections, made on building it, 2026-08-07.** Both are recorded rather than quietly
> applied, because each changes what ships.
>
> **1. "The theme in force" → *either* theme.** This section originally measured the collision in the
> current theme. That would let a theme switch **withdraw** a dash pattern — the exact thing §6.4a
> property 3 forbids for the shade pair, and for the identical reason: a reader who has learned that
> the dashed line is Norris must not have to unlearn it at sunset. The distance is now measured in
> **both** themes and the worse taken, so the encoding is a property of the entities and not of the
> time of day.
>
> **2. The detection is *precomputed*, not measured in the browser.** Doing it literally would mean
> shipping CIEDE2000, two CVD models and a `getComputedStyle` read of every `--*-plot` custom
> property into a chart component, on the main thread, on every render — and it would be
> **untestable**, because jsdom resolves no custom properties at all and every assertion about the
> ladder would have been vacuous. The palette is a **closed set of 64 plotting tokens**, so every
> pairwise distance is knowable at build time, by the same functions that gated the palette.
> `node scripts/validate-palette.mjs entity-data` emits one bit per pair into
> `src/lib/entityColorData.ts`; `scripts/entity-tokens.test.mjs` re-runs the emitter and diffs it.
> **No colour crosses into the client** — the emitted file contains no hex value at all, and a test
> asserts that.

**How often it fires — measured, and higher than this section implied** (§9.2.4):

| Set | Colliding pairs |
|---|---|
| The whole token universe | **663 of 2016** (32.9%) |
| The 2026 grid's twelve plotting colours | **31 of 66** |
| The twelve ramp base slots | **14 of 66** — and these are exactly the 14 CVD pairs §3.3a.2 said tier B hands to this ladder |
| Ramp tier A | **0 of 15** — colour alone separates those, for every viewer, as promised |

Red Bull ↔ Williams is one of the 31. So is Ferrari ↔ McLaren. **The ladder is not an edge-case
path**: about half of all real two-team comparisons reach it, which is what the brand colours being
deliberately ungated against one another (§9.2.3 V-26) actually costs at the point of use.

**The ladder.** Rungs are applied in order, and a colliding pair takes the lowest rung not already
used by either member. Every rung is a **non-colour** channel; that is the whole point.

| Rung | Channel | Applied as |
|---|---|---|
| **1** | **Direct label** | always present at ≤ 4 series, so rung 1 is free and already satisfied — a colliding pair is *never* unlabelled |
| **2** | **Marker shape** | circle → square → triangle → diamond, in that fixed order, ≥ 8px, 1.5px `--surface-sunken` ring |
| **3** | **Dash pattern** | solid → `6 3` → `2 3` → `9 3 2 3`, in that fixed order. **The period — dash + gap — is ≥ 2× the stroke width**, so the pattern survives at 2px |
| **4** | **Texture** | 45° hatch for area and bar fills, at `--border-subtle` over the entity colour. Also the print and CVD-preference rung — see §6.5.6 |

> **Correction, 2026-08-07.** Rung 3 previously said *"dash lengths are ≥ 2× stroke width"*, which
> its own `2 3` pattern fails: a 2px dash at a 2px stroke is 1×. The property that actually makes a
> pattern resolvable is the **period**, and `2 3` has a period of 5. It renders as a dotted line,
> which is the *most* distinguishable of the three rather than the weakest, so the values stayed and
> the rule was fixed. `ladder.test.ts` asserts the period, not the dash.

Three rules that make the ladder trustworthy rather than decorative:

1. **Rungs are assigned by entity identity, in the stable entity order — never by rank, never by
   z-order.** Two entities that collide today must get the same two rungs tomorrow.
2. **A rung is never withdrawn when a collision clears.** Removing the entity that caused a collision
   does not restore a plain solid line for the survivor; that would be the repaint §6.2 forbids.
   Implemented by carrying the previous ladder state forward, which is a state the chart holds and
   passes back in — never recomputed from the current selection alone.
3. **Comparison is capped at 4**, so the ladder never runs out: four rungs, four entities.

**Rung *activation* is chart-wide; the channel *value* is per series.** _(Resolved on building it,
2026-08-07.)_ The escalation above is decided pairwise, exactly as written. What is deliberately not
done is applying the resulting channel to the colliding pair **alone**: a chart where two of four
series carry a marker shape and two do not reads as an accident rather than as an encoding, and the
legend then has to explain a distinction that applies to half its rows. §6.5.6's Patterns toggle
already sets the precedent that a rung is a property of the chart. So when a rung fires, every
series takes its value from that rung's fixed order.

One consequence, stated so it is not mistaken for a bug: **at ≤ 4 series, rung 2 alone separates
every pair**, because four distinct shapes is four distinct series. Rung 3 therefore only ever fires
because a **teammate** comparison is present — where §6.4a makes marker *and* dash mandatory rather
than escalated.

#### 6.4a The teammate treatment — colour is not the channel

Two drivers of one team is the most valuable comparison in the sport and the only truly like-for-like
one. It is also the case where colour is **weakest**, and the measurement is unambiguous:

> **Sauber's brand hue is 143 — inside the reserved green timing band. In light mode, exactly ONE
> lightness in the whole plotting band clears ΔE 15 from `--timing-green-ink`: 109 of 161 candidates
> are blocked by the green ink and 51 by contrast. A two-shade split is impossible.** (§9.2.3 G-27d.)

So the treatment is **mandatory and non-colour first**, and it is identical for every team — including
the nine whose colour *would* have worked. Presenting one team differently because its hue is unlucky
would make the reader learn two conventions:

| Channel | Rule |
|---|---|
| **Marker shape** | **Mandatory.** The team's two drivers take marker rungs 2's first two shapes — circle and square — in driver order |
| **Dash pattern** | **Mandatory.** Solid and `6 3`, in driver order |
| **Direct label** | **Mandatory.** Always available: a teammate comparison is ≤ 4 entities |
| **Shade pair** | **When available.** `--*-plot-deep` and `--*-plot-bright` — two admissible plotting shades of the team's own hue and chroma, ≥ ΔE 15 normal and ≥ 8 CVD apart in both themes |

**Driver order is `driver.reference` ascending** among the selected drivers of that team; the lower
takes `deep`. `reference` is used because it is the only identifier with **100% coverage** —
`permanent_car_number` covers 63 of 881 drivers and `abbreviation` 107 of 881 (queried).

**Two teammate pairs on one chart** _(added on building it, 2026-08-07)_. Read literally, "circle
and square, in driver order" hands the second team's pair the **same** shape *and* the same dash as
the first team's, leaving colour as the only thing separating series 1 from series 3 — the exact
failure this section exists to prevent. The rule is therefore stated on indices rather than on
shapes: **a team's group keeps the set of rung indices its members hold in the stable order, and
redistributes them inside the group by `reference` ascending.** With one pair — the case this
section is written about, and the overwhelmingly common one — that is identical to circle-and-square
in driver order. With two pairs, all four series stay distinct on both channels.

**Four properties of the shade pair, each measured:**

1. **It is symmetric — neither driver "gets the team colour".** Both take a shade; the true brand
   colour stays on the identity swatch beside each name. An earlier draft anchored one driver on the
   team's plotting variant and derived the other from it, which failed twice over: measurably, because
   a mid-band anchor cannot reach the floor (Williams light reached 14.70 against a span ceiling of
   27.07), and editorially, because painting one driver in the true colour and the other in a
   derivative implies a number-one/number-two hierarchy the data does not support.
2. **The split spends lightness and nothing else.** Hue and chroma are held, so the pair reads as one
   colour family in two shades. Lightness is the one channel every dichromat keeps in full, which is
   why the worst measured CVD figure across all 22 entities is **14.18** — nearly twice the floor.
3. **It is a property of the entity, not of the theme.** Available in both themes or withheld from
   both. Sauber has an admissible pair in dark mode and it is **deliberately discarded**: an encoding
   that changed with the theme would make a reader who had learned "two lines of one colour are one
   team" unlearn it at sunset.
4. **The ladder caps at two shades, and light mode sets the cap.** One hue supplies at most 2 mutually
   separated shades in light mode (3 in dark, unusable per property 3), because light's band has its
   usable top cut by the 3:1-against-white requirement. **Beyond two drivers of one team in one plot,
   colour is exhausted outright** and rungs 1–3 carry the whole distinction. This happens for real —
   a mid-season replacement driver — and it is a designed state, not an edge case.

**Cross-era normalisation is made visible, never applied silently.** When a teammate comparison spans
a regulation change or a scoring change, the chart carries a `--status-info` note above the plot
naming what was normalised and what was not. A silently indexed axis is the same class of defect as a
dual axis: it makes an incomparable comparison look fine.

### 6.5 States, interaction and the table view

#### 6.5.1 Hover and the crosshair

| Form | Interaction |
|---|---|
| Line / area | **One crosshair, one tooltip, all series.** A vertical `--border-strong` 1px dashed `2 3` rule snapped to the nearest x via `d3-array`'s `bisector`; every series' value at that x in one tooltip, **sorted by value descending**, each row led by its entity swatch and marker glyph. Per-series hover tooltips on a multi-series line chart are the defect this replaces: they make the reader chase. |
| Bar / dot / cell | **Per-mark tooltip.** The hovered mark keeps full opacity; siblings drop to `opacity: 0.4` — *opacity only*, never a colour change, because a changed colour would break the identity the swatch just promised. |
| Hit target | **≥ 24px** on the cross-axis regardless of mark size — a transparent overlay rect per band, or a Voronoi for scattered points. A 2px line is not a hit target. |
| Keyboard | The plot area is one tab stop. `←` / `→` step the crosshair by one x; `Home` / `End` jump to the ends; `↑` / `↓` move between series on a bar chart. The tooltip content is mirrored into an `aria-live="polite"` region so the reading is announced, not just drawn. |
| Filters | One row **above** the chart, never inside the plot area, never floating over it. |

**The tooltip is `--surface-overlay` at `--radius-md`, `--elev-2`, `--text-xs`, numerals `--font-mono`,
and it never covers the mark it describes** — it flips side at the axis midpoint. It follows the
pointer at `m.pointer`; under `reduce` it is positioned with a single `gsap.set` and snaps.

> **Three tooltip rules added after it shipped wrong, 2026-08-07.** Rishabh captured the progression
> chart mid-hover and the tooltip rendered **below the plot area, over the legend, clipped by the
> panel edge**. Its content and its header were correct; only its position was wrong. Each rule below
> is the fix for one cause.
>
> **1. The transform's origin is explicit, and it is declared on the element.** G-30 moves the
> tooltip with `quickSetter(el, 'x'|'y', 'px')`, which writes a **transform** — measured from the
> element's own box. With `position: absolute` and no `left`/`top`, that box sits at its **static
> flow position**, after the `<svg>`, so every coordinate computed against `plot.top` was offset by
> the whole height of the chart. `BarChart` never had the bug because it writes `left: 0; top: 0`
> inline; `LineChart` relied on the stylesheet, and the stylesheet did not say it. **This is the same
> class of failure as a spotlight written in `%` where the spec meant px:** a correct coordinate
> resolved against the wrong origin.
>
> **2. It is flipped *and* clamped, on both axes.** The flip keeps the box off the mark; it says
> nothing about containment. `geometry.clampTooltip` clamps into the plot rectangle after flipping —
> in that order, because clamping first would undo the flip exactly at the edges where the flip
> matters. It is pure, and it is the part of tooltip placement a test **can** decide without layout.
>
> **3. The width is a fixed token, never a `min-width`.** The flip subtracts an exact constant, so a
> box wider than the constant overhangs the plot. It was `min-width: 8rem` (128px) against a box that
> rendered 193px wide with four driver names in it. `--size-tooltip` (200px) and `TOOLTIP_WIDTH` are
> tied together by `index.css.test.ts`.
>
> **Recorded limitation:** `charts.css` **cannot be read by any test in this repo.** The Tailwind Vite
> plugin claims `?raw` imports of it and returns an **empty string** — measured, `charts.css?raw` has
> length 0 while `tokens.css?raw` has 29310. Two assertions were written against its text and both
> passed vacuously before this was noticed. Anything in that file which must be guarded has to be
> guarded through a token, through a pure function, or through an inline style — which is the real
> reason rule 1 puts the origin on the element rather than in the stylesheet.

#### 6.5.2 Legend at ≥ 2 series, direct labels at ≤ 4 — and how they coexist

- **≤ 4 series: direct labels, and they are the primary identification.** Placed at the **end of the
  line**, vertically de-collided by pushing apart to a 16px minimum gap, in `--ink-primary` at
  `--text-xs` — **not** in the series colour (§6.2: text wears text tokens). A 12px leader line in the
  entity colour connects label to mark where the de-collision moved it more than 8px.
- **A legend is *also* present at ≥ 2 series**, above the plot, one row, each item = swatch + marker
  glyph + dash sample + name. It is the only place the dash and marker rungs are stated, so it is
  required even when direct labels make it redundant for identification.
- **> 4 series does not happen in a comparison** (capped at 4). It happens on a season-wide chart —
  and there the answer is not a bigger legend, it is **small multiples** (§6.5.4).

#### 6.5.3 Empty, loading, error, partial and no-coverage — five states, and only one is a fault

The five states are §7.4's; what follows is what each looks like *inside a plot area*. The plot area
keeps its exact height in every one of them, so nothing reflows as a query resolves.

| State | Rendering | Copy |
|---|---|---|
| **Loading** | Axes and gridlines render **immediately from the known domain**; the marks are a skeleton (G-11). The frame is never a spinner — the reader can already start reading the axes. | — |
| **Empty** (a valid query, no matching rows) | Plot area at `--surface-sunken`, axes present, centred `--ink-secondary` `--text-sm` | "No results match these filters." + a `secondary` button, "Clear filters" |
| **Error** | Plot area replaced by `ErrorState`; axes removed, because axes over an error imply the data is merely late | "This chart could not load." + "Try again" |
| **Partial** (some series have data in the window, some do not) | The chart renders. Series with no data in the window appear in the legend **struck through** at `--ink-tertiary`, and a note above the plot names them | "Lap data begins in 1996. Two of the four drivers selected have no laps before then." |
| **No coverage** (the whole window predates the data) | **Neutral, never a status colour.** `--ink-tertiary`, `--border-subtle`, `--surface-sunken`. The axes still render, with the coverage boundary drawn as a 1px dashed `--border-strong` vertical rule and a label | "Lap times begin in 1996. This race is from 1988, so there are no lap times to chart. Results, grid positions and championship standings are available for it." |

**A no-coverage state is not an error and must never be painted `caution` or `critical` (§3.4.3).**
Absent lap data before 1996 is a property of the sport's history. The copy always says three things:
**where the boundary is**, **which side this request falls on**, and **what *is* available instead** —
the third is the one that gets dropped, and it is the only one that helps.

The exact boundaries, which every one of these strings must be generated from and never hardcoded
(`GET /api/meta`): results **1950+** · qualifying **1994+** · Q1/Q2/Q3 **2006+** · lap times
**1996+** · pit stops **2011+** · sprint **2021+**. **Zero of the 484 races before 1990 have lap
data.**

#### 6.5.4 Small multiples, and the scope→form rule

The chart form is a function of the **time scope**, and it is not the user's choice to get wrong:

| Scope | Form | Never |
|---|---|---|
| One season, ≤ 4 entities | per-round line or slope chart | — |
| One season, > 4 entities | **small multiples**, one panel per entity, shared scales, 3 columns desktop / 2 tablet / 1 mobile | a 10-series spaghetti line |
| A season range (2–10 seasons) | per-season line, one point per season | per-round across a range |
| Full career / cross-era | per-season, and **always** with the normalisation note of §6.4a | per-round across 20 years |

**Shared scales are mandatory in small multiples**, and the shared domain is stated once above the
grid. Independent y-axes per panel is the same lie as a truncated bar axis.

#### 6.5.4a The rank chart — the one permitted many-series line _(added 2026-08-07, F3)_

**`REQUIREMENTS.md` RD-1 is a P0 that this document, as written, forbade.** It asks for a per-lap
position chart with *"every driver, one line each; the whole race as one picture"* — 22 lines. §6.5.2
caps a comparison at 4 and sends anything above it to small multiples, *"never a 10-series spaghetti
line"*. A requirement and a design rule cannot both simply win, so this resolves it rather than
letting whoever builds it choose.

**The rule was right and its scope was wrong.** §6.5.2 was written about series whose **values can
coincide** — ten cumulative-points lines genuinely occlude one another, and there is no reading to be
had. A **rank** chart is a different form:

1. **The domain is a bounded ordinal and every line occupies a distinct slot.** At any lap, 22 lines
   sit at 22 different y positions. There is no occlusion to resolve — the thing that makes ten value
   lines unreadable does not occur.
2. **The reader's task is not "read driver X at lap 30".** It is to see the *shape* of the race: where
   the order churned, where the pit windows fell, who climbed. That is a gestalt reading, and it is
   the one reading that **needs** the whole field — four lines out of twenty-two would show four
   drivers moving against an invisible background and would be actively misleading about why.
3. **Identification is by endpoint, not by legend.** The grid order runs down the left edge and the
   finishing order down the right, which is how every position chart in the sport is read.

So a rank chart may plot the whole field, **under all five of these conditions** — they are what keep
it a chart rather than a texture, and a rank chart missing any of them is a defect:

| Condition | Why |
|---|---|
| **The measure axis is a bounded rank**, inverted, P1 at the top | This is what makes the exemption sound. A rank chart of a continuous measure is not a rank chart. |
| **No markers** | 22 × 58 is 1,276 markers. `shouldDrawMarkers` already refuses at this density (§6.3) and this is the case it was written for. |
| **Direct labels at *both* ends** — grid on the left, finish on the right | Replaces a 22-row legend, which would be taller than the plot. The legend requirement of §6.5.2 is discharged by these, and **only** in this form. |
| **Hover isolates: the hovered line goes to full opacity, every other drops to `0.4`** | Opacity only, never a colour change (§6.5.1). This is what turns the texture back into a single readable line on demand. |
| **Selection still caps at 4** | Selecting up to four promotes them to the full marker-and-dash treatment and dims the field behind them. **The full field is context; analysis is still ≤ 4.** This is the sentence that reconciles the exemption with §6.2 rather than overriding it. |

**Colour does not carry 22 series and is not asked to.** The field is ~10 teams × 2 drivers, so the
teammate shade pair (§6.4a) is doing its ordinary job at scale; two cars of one team are two shades of
one hue, which is exactly the reading a race engineer wants. Beyond that, colour identifies the
*team* and position identifies the *driver* — and the endpoint labels close the gap.

**This exemption is for the rank chart and nothing else.** A lap-time trace is a continuous measure
and stays capped at 4 (RD-2 says "multi-select", which is the cap by another name). If a future
surface wants a many-series continuous chart, it goes to small multiples as §6.5.4 says.

##### Three refinements from building it _(2026-08-07, `RankChart.tsx`)_

The five conditions above were written before the component existed. Building it found that three of
them were underspecified at 22 series, and each is resolved here rather than in the code alone.

**1. The resting state must be legible; isolation is an aid, not a prerequisite.** A chart that only
resolves when you hover it has failed for anyone reading a screenshot, printing it, or using a
keyboard. So the foreground/background split is a **resting** attribute: the selected ≤4 are drawn at
`--size-mark-stroke` and full opacity with their dash rungs, and the field at **1px and `opacity:
0.35`**. That gives a readable foreground over a background that shows the race's churn as a shape,
which is condition 5 made visual rather than merely stated. Isolation then drops the field to `0.12`
and raises the hovered line — opacity only, never a colour change.

**2. Both-end labels are capacity-checked, not assumed.** Condition 3 made them a condition of the
exemption; at 22 series **the labels are the dense part, not the lines**. `geometry.labelCapacity`
settles it arithmetically at §6.5.2's 16px pitch:

| Plot height | Capacity | 22 series |
|---|---|---|
| `--size-plot-lg` 360 | 23 | **fits** |
| `--size-plot-md` 288 | 19 | does not fit |
| `--size-plot` 240 | 16 | does not fit |

So the full field is labelled at desktop and not below it. Where it does not fit, **the selection is
still always labelled**, plus P1 and the deepest classified runner — the two positions the eye goes to
first — and the rest are identified by hover, by the table view, and by the position axis, which
already states their rank. Labels come from `selectDriverShortLabel`: the driver's **code** where one exists
(`VER`, `HAM`), the sport's own timing convention and about a third the width of a surname —
otherwise the **surname**.

> **The fallback is the common case for early lap-data races, not an edge case.** `abbreviation`
> covers 107 of 881 drivers overall, and measured against the lap window specifically, **40 drivers
> who have race lap data carry no code at all** — Häkkinen, Damon Hill, Frentzen, Irvine, Panis and
> much of the 1996–2004 grid. So a label built from `code` alone would leave half a 1996 field
> unlabelled. The fallback is the **surname** and never a three-letter abbreviation derived from it,
> which would invent a convention the data does not carry. It widens the label gutter, which costs
> nothing: §6.5.2's capacity arithmetic is a *vertical* pitch and is unaffected by label width.

**3. The tooltip carries the analysis set, not the field.** §6.5.1 asks for *"every series' value at
that x, in ONE tooltip"* — which at 22 series is a tooltip taller than the plot it covers. That rule
exists so a reader does not have to chase per-series tooltips, and one tooltip carrying the selection
plus the hovered line satisfies it. The full field at that lap is in the table. **The rows sort
ascending**, not descending as §6.5.1 says: on a rank axis a lower number is better, and descending
would put last place at the top.

> **One defect worth recording, because the test was green while the feature was dead.** Isolation was
> first built as `onPointerEnter` on each `<path>`. It passed in jsdom — a test dispatches the event
> straight at the element — and **could never have fired in a browser**: §6.5.1's hit target covers the
> whole plot area and is painted *after* the marks, so it swallows every pointer event before a line
> sees one. Isolation is now derived from the pointer's proximity to a line at the active x, through
> the single hit target, via the pure `geometry.nearestByOffset` — which also made the choice testable,
> since a component-level proximity test in jsdom compares offsets that have all collapsed to 0.
>
> This is the same shape as the tooltip resolving its transform against the wrong origin: **the code
> was right about what it wanted and wrong about where it was.**

#### 6.5.5 The table view — in the same place, on every chart

Every chart has a **"Table" toggle in its header**, beside the title, as a two-segment control
(`Chart` / `Table`). Not a link, not a modal, not a separate route: the table replaces the plot **in
place**, keeping the header, the filters and the caption. Three reasons this location is specified
rather than left open:

1. It is the discharge of §3.2's contrast WARN, so it must be reachable in one action from any chart.
2. It is how a screen-reader user reads the data. A `<table>` with `<caption>`, `<th scope>` and
   `--font-mono` tabular numerals is a better rendering for them than any `aria` narration of an SVG.
3. Consistency is the point. A toggle that moves between surfaces is a toggle nobody finds twice.

The SVG itself carries `role="img"` and an `aria-label` giving the chart's job and its headline
reading — never a description of its appearance — plus `aria-describedby` pointing at the caption.

#### 6.5.6 Texture, print, and the CVD preference

Rung 4's 45° hatch is available on demand, not only on collision:

- A **"Patterns" toggle** sits beside the table toggle. It promotes every series to rung 4 at once.
  This is the CVD and print affordance, and it is a user control rather than a media query because
  colour-vision deficiency is not something a browser reports.
- `@media print`: patterns **on** unconditionally, plot area to `transparent`, gridlines to
  `--border-strong`, and the table view rendered **after** the chart rather than instead of it.

### 6.6 Per-chart specifications — the queue, and what each needs

Specified as each surface lands, in `PLAN.md`, through §6.1's six steps. Listed here so the kit's
scope is visible when the F1/F2 decision is made (⚑ Rishabh's call, §6):

| Chart | Job | Form | Primitives beyond `scaleLinear` |
|---|---|---|---|
| Championship progression | change over time | per-round cumulative line, **position axis inverted** | `scalePoint`, `d3-shape.line` |
| Points gap to leader | change over time, polarity | per-round line, zero baseline = the leader | `d3-shape.area` |
| Position chart (grid → finish) | change, per race | slope chart, 2 categorical positions | `scalePoint` |
| Lap-time trace | change over time, dense | per-lap line, **1996+ only** | `d3-array.bisector` |
| Pace degradation | change over time | per-lap scatter + a fitted trend line | none (fit is arithmetic) |
| Pit timeline | magnitude, sequence | horizontal bar per stop, **2011+ only** | `scaleBand` |
| Stint timeline | sequence | **span chart** — one row per entity, spans on a shared axis | `scaleBand` + `scaleLinear`. **Not `d3-shape.stack`** — see below |
| Records leaderboard | magnitude + identity | horizontal bar, direct-labelled | `scaleBand` |
| Head-to-head | polarity | single diverging bar, centred at 0 | `scaleBand` |
| Season heat map | magnitude across two categories | cell grid, per-mark tooltip | `scaleBand` × 2 |
| **Composition split** | part-to-whole within a category | **share bar** — one row per category, segments per entity, normalised to 1 | `scaleBand` + `scaleLinear`. **Built F5** as `ShareChart`, §6.6.3 |

**Not in this list, and not to be added:** anything requiring tyre compounds, weather, sector times,
telemetry or practice analysis. None of it exists in the data (`REQUIREMENTS.md` §6), and 423 FP1
sessions hold 698 entries with no times at all.

**Two rows above were wrong and are corrected here rather than edited silently.**

**Position chart.** *"Slope chart, 2 categorical positions"* describes a different chart from RD-1,
which asks for **per-lap** position for the whole field. The slope chart is still worth having as a
compact summary, but it is not RD-1 and does not discharge it. RD-1's form is the rank chart of
§6.5.4a.

**Stint timeline — `d3-shape.stack` was the wrong primitive.** `stack` sums sequential *values* to
derive cumulative positions. A stint's boundaries are **already known**: `DATABASE.md` §6.7 derives
them as `[1 … pit₁], (pit₁ … pit₂], … (pitₙ … end]`. Feeding spans through lengths, then cumulative
sums, then back to positions is a round trip whose only possible contribution is error. The form is a
**span chart** — `scaleBand` for the rows, `scaleLinear` for the measure — and `SpanChart.test.tsx`
asserts on the module's source that `d3-shape` is never imported, so the decision cannot be quietly
reversed. Two properties of it are design decisions rather than implementation:

- **§6.3's 4px radius is on the row's outer ends only.** An interior boundary between two adjacent
  spans is square, because a rounded interior edge implies a gap in the sequence that is not there —
  the same argument §6.3 makes for a bar being square against its baseline, applied twice.
- **Spans within a row are not differentiated by colour.** Alternating shades would spend the shade
  pair, which §3.3a.1 reserves for the teammate case; alternating opacity would imply a magnitude on
  a channel carrying sequence. The 2px surface gap and an in-span label carry it.
- **The entrance is G-28's clip wipe, not G-27's growth.** A span beginning at lap 30 must not grow
  from the plot's left edge: that animates its *start* moving, which is the one thing a sequence chart
  must not say. A left-to-right reveal uncovers the timeline in the order the race happened.

#### 6.6.1 F3 — the race page, specified _(2026-08-07)_

**The endpoints are `GET /api/seasons/:year/races/:round`** and its two companions,
`…/laps` and `…/stints`.

> **Correction, 2026-08-07.** This section first named a flat `/api/races/:year/:round`. That was
> wrong and it was mine: `ARCHITECTURE.md` §6 has specified the **hierarchical** form since F0, and it
> mirrors the client route `/seasons/:year/races/:round` — a race is addressed *through* its season
> because that is how the data is keyed and how a reader arrives. The engineer built the documented
> form and raised the conflict rather than silently satisfying one side, which is the right handling;
> a design document inventing an API path is not an authority, and this one was invented by analogy
> with `/api/seasons`.

The charts below were specified before the data layer existed, deliberately: a chart spec written
afterwards tends to accept whatever the data layer happened to return.

**The organising problem is that one page spans four coverage boundaries.** Measured, one race per
era, `session.type = 'R'`:

| Season | Drivers | Lap rows | Pit stops | What the page can show |
|---|---|---|---|---|
| 1988 R1 | 26 | **0** | **0** | classification and grid only |
| 1996 R1 | 20 | 812 | **0** | + every lap chart, no stops |
| 2011 R1 | 22 | 1,083 | 45 | everything |
| 2026 R1 | 22 | 1,003 | 32 | everything |

So **the majority of the archive is the reduced page, not the full one** — 484 races before 1990 have
no lap data at all. The page is therefore designed from the bottom up: the classification table is the
spine and every chart is an addition that may be absent, each carrying §6.5.3's three-part copy. A
race page that renders four empty plots for 1988 is the defect this ordering prevents.

**RD-10 · Race classification** — the spine, and not a chart. Job: identity, order and outcome.
Form: a `<table>`, same anatomy as the season hub's standings (§7). `status` decodes through
`DATABASE.md` §3 — **`detail` for display, `status` for grouping** — and a DNF is `status IN (10, 11)`,
never `position IS NULL`. Identity bar per row in the team colour. **Available 1950+, so it never has a
no-coverage state.**

##### The RESULT column is keyed on `outcome`, never on the presence of a time _(ruled 2026-08-07)_

This said only *"gaps come from the recorded time, and a lapped finisher shows `+1 Lap`"*, which was
right about the lapped case and silent about every other one — and the silence shipped a defect.
Measured on 2026 R6: **six rows rendered negative durations**, down to `−2:02:28.126` for Bottas.

**The mechanism.** A retiree's `totalTimeMs` is their elapsed time *when they stopped*, which is
**smaller** than the winner's — Bottas stopped on lap 15 at 1,263,117 ms against a winning
8,611,243 ms — so `driverTotal − winnerTotal` is negative. The gap was being computed for drivers who
never finished.

**The table, and it is exhaustive on `raceOutcomeSchema`:**

| `outcome` | RESULT shows | Why |
|---|---|---|
| `finished`, position 1 | the total time | The reference every other row is measured against |
| `finished`, not position 1 | `+gap` to the leader | Same distance, so a duration is comparable |
| `lapped` | **`+N Laps`**, never a duration | The result *is* a lap deficit. 7,450 of 7,814 carry no time — but **364 do**, and for those a gap of `+31.402s` would look entirely plausible and be meaningless |
| `accident` · `mechanical` · `disqualified` · `didNotStart` · `didNotQualify` · `unknown` | `detail` — "Retired", "Engine", "Collision" | They have no result relative to the winner. A time here is not a smaller number, it is a **different quantity** |

**Keying on `outcome` rather than guarding the subtraction is the point.** A guard (`if (delta < 0)`)
would have fixed the six visible rows and left the `lapped`-with-a-time case wrong *and invisible*,
because that one produces a plausible positive number. Deriving the branch from what the row **is**
makes both impossible rather than caught.

> **On the classified retiree, which is the interesting row and where I differ from the review.** Sainz
> is `isClassified: true` at 70 laps against 78 — he covered enough distance to keep P16 — and the
> suggestion was that he should therefore read `+8 Laps`. **He should read "Retired".** `outcome` is
> `mechanical`: he did not circulate eight laps down to the flag, he stopped on lap 70, and `+8 Laps`
> asserts something that did not happen. `outcome === 'lapped'` — status 1, *"classified, down laps"* —
> is precisely and only the `+N Laps` case. `isClassified` decides whether he **holds a position**, not
> what the result column says, and conflating the two is what made this look like a judgement call.
> This is `DATABASE.md` §3's own discipline: **`status` for grouping, `detail` for display.**

**RD-1 · Position by lap** — the flagship. Job: change over time, whole field. Form: the **rank
chart** of §6.5.4a, all five conditions binding. Marks: 2px lines, **no markers** (`shouldDrawMarkers`
refuses at 58 laps and this is the case it was written for). Interaction: crosshair with a
lap-indexed tooltip; hover isolates one line to full opacity and drops the field to `0.4`; selecting
≤4 promotes them to marker-and-dash. Colour: team, with the teammate shade pair doing its ordinary
job at scale. Accessibility: endpoint labels both ends, table view, `aria-live` readout. **1996+.**

**RD-2 · Lap-time trace** — Job: change over time, dense, ≤4 drivers. Form: per-lap line, capped at
4 by §6.5.2 (RD-2's "multi-select" is that cap by another name). Marks: no markers at race density.
**The measure axis carries the mandatory ceiling of §6.3** — `fastest × 1.5`, off-scale laps as a
caret at the ceiling plus a counted note, exact values in the table. The ceiling is a property of the
**session**, so toggling a fourth driver cannot move the axis. **1996+.**

> **Correction: the invalidated-lap note is withdrawn.** This said invalidated laps
> (`lap.is_deleted`) are *"excluded from the series and stated in the note"*. Trap 19 measures
> `is_deleted = 1` on **2,199 of 717,764 lap rows and on none of the 627,025 race lap rows** — every
> flagged row is practice or qualifying, 2023 onward. So the note would have been **permanently
> empty on every race page**, which is worse than absent: it implies a feature that is working and
> finding nothing. The trap-8 filter stays in every pace metric, because it is a no-op that one
> refresh can make load-bearing and a metric that must remember to add it later will not — but the
> *interface* promises nothing it cannot show.

**RD-7 · Pit stop timeline** — Job: magnitude and sequence. Form: horizontal bar per stop, `scaleBand`
by driver, x = lap. Marks: bar length is duration; §6.3's 4px data-end on the far end only. Durations
in 2026 R1 run 17.6 s to **1,081.6 s**, so the axis is clipped and the note counts what is above it.
Copy must carry the cross-era caveat — `DATABASE.md` §2.4: *"duration semantics vary across eras
(some stationary time, some pit-lane transit)"* — so **durations are never compared across decades
without it**. **2011+.**

> **Correction: the pit ceiling is `median × 2`, not the lap trace's `fastest × 1.5`.** I carried the
> 1.5 across by analogy and **the analogy does not hold**, which is measurable rather than arguable:
>
> | Ceiling | Stops clipped | Races affected | 2026 R1 |
> |---|---|---|---|
> | `fastest × 1.5` | **1,910 of 12,582 (15.2%)** | 217 of 319 | clips 7 of 32, five of them ordinary 27–36 s stops |
> | `median × 2` | **457 of 12,582 (3.6%)** | 79 of 319 | clips exactly the two red-flag stops, keeps the 34.6 s p90 on scale |
>
> **The references differ in kind.** A fastest *lap* is a capability — every other lap of that race is
> an attempt at the same thing, so 1.5× bounds the honest range. A fastest *stop* is one best case that
> legitimate stops exceed widely, because `duration_ms` mixes stationary time with pit-lane transit
> across eras: `p90 / fastest` has a median of 1.27 and a p90 of **1.95**. A ceiling anchored to the
> best case therefore clips normal work. The median is the centre of the distribution rather than its
> edge, so `× 2` bounds the same *shape* of range that `× 1.5` bounds for laps.
>
> Implemented once, as `PIT_CEILING_MEDIAN_MULTIPLE` in `src/features/race/series.ts`.

**RD-3 · Stint reconstruction** — Job: sequence. Form: stacked horizontal bar, one row per driver,
`d3-shape.stack`. **This is the one kit form F3 needs that does not exist**; `BarChart` does not stack.
2px surface gap between adjacent fills (§6.3) is what makes the stint boundaries legible without a
stroke. **2011+, because stints are derived from pit stops** — and a 1996 race therefore shows lap
charts with no stint layer, which is a designed state and not a gap.

**RD-4 · Pace degradation** — Job: change over time, within a stint. Form: per-lap scatter plus a
per-stint fitted trend (`ScatterChart`). **Available 1996+, not 2011+**: with no pit data there is still
one implicit stint — the whole race — and a fit over it is the honest reduced answer rather than an
absent section, so a 1996 race gets degradation without stint boundaries.

**Three honesty rules, and they are the feature rather than decoration:**

1. **The trend is dashed where the data is solid.** The points are what happened; a least-squares line
   is a *claim* about them. Dash is the channel that survives a screenshot, a printout and greyscale —
   the same reason §6.4's ladder spends dash rather than relying on colour. **A solid trend line through
   a scatter is the most common way a chart launders a model into a fact.** The trend also renders
   *before* the points, so the data sits on top of the model.
2. **A fit that explains nothing is not drawn.** `fitLinear` returns `r2` and its own comment calls it
   *"the honesty term"*: a four-lap stint will happily produce a confident-looking slope. So a trend is
   drawn only at `r² ≥ TREND_R2_FLOOR` (**0.5** — the conventional weak-but-real threshold, and **a
   judgement, not a measurement**, since there is no ground truth for tyre degradation here). **The r²
   and the slope are in the table regardless**, so a reader can see that the line they are not being
   shown would have explained 12% of the variation. A table stating the slope alone would launder the
   same model the missing line is qualifying.
3. **An inferred neutralisation is hatched, never filled, and named as inferred.** `REQUIREMENTS.md`
   RD-4 and `DATABASE.md` §6.9 agree: **there is no safety-car flag anywhere in the data.** Hatch is
   rung 4's channel and already means *"a different kind of thing"*, so it costs no new vocabulary; a
   solid band would read as recorded fact. Consecutive flagged laps **merge into one band** — five
   one-lap rects read as five incidents rather than one safety car.

**The copy says "likely safety car or red flag" and never "safety car."** The heuristic cannot separate
a safety car from a red flag, a virtual safety car, a wet restart or a lap behind a recovery vehicle;
all of them mean the field was not racing, which is the property that disqualifies a lap from a pace
metric, and none of them is in the data. The note states the **method** — laps ≥30% slower than the
race's typical lap across the whole field — rather than presenting its output as a finding.

**Excluded laps are counted, not silent.** Lap 1, every in-lap and every out-lap are dropped from the
fits (§6.9), and the note says how many of how many — the same discipline the off-scale caret follows.

> **The detection's accuracy is unverified by construction, not merely unmeasured.** There is no flag
> to compare `SAFETY_CAR_RATIO` against, so no false-positive rate can be computed — not now, and not
> after any amount of further work. The label is what carries that uncertainty, because nothing else
> can. This distinction matters in the copy too: "inferred" is honest, "detected" would not be.

##### Why the threshold is 1.3, and what it is a threshold *for* _(ruled 2026-08-07)_

**Measured: across all 578 races with lap data, the per-race maximum ratio distributes p25 1.028 ·
p50 1.270 · p75 1.600 · p95 4.987.** So **1.3 sits essentially at the median**, and it flags nine of ten
modern races — modern races skew above the all-era median because red-flag stoppages are recorded as
laps. A threshold at the 50th percentile is not detecting something unusual; it is splitting the
distribution in half, and it cannot be defended as an outlier definition.

**It is not an outlier definition, and reframing it is the resolution.** The purpose is not to detect a
rare event. It is to identify **laps that cannot inform a pace conclusion**, and a lap 30% slower than
the race's own typical lap is unfit for a degradation fit *regardless of why it was slow*. On that
framing the threshold is calibrated to the phenomenon's frequency — a safety car, red flag, VSC or wet
restart really does occur in roughly half of modern Grands Prix — rather than to a definition of
unusualness, and it is **deliberately loose**: a short VSC that inflates laps by 35% is exactly the case
a pace metric most needs excluded, and moving to p75 (1.600, flagging a quarter) would miss it.

So: **1.3 stays, and the copy leads with the property rather than the cause.** *"30% or more slower than
this race's typical lap"* is the finding; *"which usually means a likely safety car or red flag"* is the
explanation offered for why such laps cluster — not a claim to have identified one. Had the copy led
with the cause it would have been asserting a detection the data cannot support.

**Recording which kind of threshold this is matters more than its value**, because the next person to
look at nine-in-ten will otherwise reasonably conclude it is broken.

**Queued, not yet specified:** RD-5 gap to leader (P1), RD-6 position-change events (P1), RD-9
consistency (P1), RD-8 and RD-12 (P2). RD-11 weekend session times needs `session.timestamp` and
`session.timezone` and is a list, not a chart.

#### 6.6.2 F4 / F5 / F6 — the three entity pages, specified _(2026-08-08)_

Driver (`/drivers/:driverRef`), team (`/teams/:teamRef`) and circuit (`/circuits/:circuitRef`) are
specified **together and in one section**, because the single largest risk here is not any one page
being wrong — it is three pages that look like three products. They share a masthead, a career
strip, a stat-tile grid, a season table and a chart language, and every difference between them
below is a difference the *data* forces.

**Scope is P0 only.** DR-6…DR-9, CN-5…CN-7, CI-4…CI-6 are deferred and are **not** to be built as
"while we're here" additions: each needs a query nobody has written and half of them need a coverage
window this pass does not touch.

##### 6.6.2.0 The one thing that makes these pages not a dashboard

Every entity page opens with the same three-part masthead, and the third part is the moment:

1. **The name at `--display-lg` / `--display-xl`**, with the identity swatch and the code-or-fallback
   badge beside it.
2. **A meta line** in `--text-sm`: nationality, dates, span — facts, in mono where they are figures.
3. **The `CareerRibbon` (§7.9)** — one cell per season of the entity's whole existence, the cell's
   fill height encoding that season's championship position. **A forty-year career as one 900px
   strip.** It is the only element on any of these pages that is unique to it and it is deliberately
   large, because §1.1's brief is that a system needs one thing that arrests you.

The ribbon is *the same component* on all three pages with a different measure, which is precisely
the coherence lever: a reader who learns it on Hamilton's page reads Ferrari's and Monza's for free.

##### 6.6.2.1 The three mastheads, and what differs

| | Driver | Team | Circuit |
|---|---|---|---|
| Eyebrow | `Driver` | `Constructor` | `Circuit` |
| Headline | `{forename} {surname}` | `{name}` | `{name}` |
| Badge | the **code** (`VER`) where one exists; otherwise **no badge at all** — see below | — | — |
| Identity | 3px bar + swatch in the **most recent team's** colour | 3px bar + swatch in the team's own colour | none. A circuit has no identity colour and must not borrow one |
| Meta | nationality · born `{date}` (`{age}`) · `{first}–{last}` · car number where one exists | nationality · `{first}–{last}` · `{n} seasons` | locality, country · `{lat}, {lon}` · `{alt} m` |
| Third part | `CareerRibbon`, measure = drivers' championship position | `CareerRibbon`, measure = constructors' championship position | `CircuitLocator` (§7.11) **and** `CareerRibbon`, measure = *hosted / not hosted* |

**The missing code is the common case and gets no placeholder.** `abbreviation` covers **107 of 881
drivers** (queried). §6.5.4a already ruled that the fallback is the **surname** and never a
three-letter abbreviation derived from it, because that would invent a convention the data does not
carry. On a masthead the surname is *already* the headline, so the badge is simply **not rendered** —
an empty or `—` badge would state that a code is missing, which is a fact about our source and not
about the driver. Same rule for `permanent_car_number` (**63 of 881**) and `date_of_birth`
(**865 of 881** — the sixteen without one are reserve and test entrants).

**The meta line never shows a current age, and the reason is permanent rather than a gap.** There is
**no date of death anywhere in the schema**, so a "current age" would confidently report Fangio at
114. The payload therefore publishes `ageAtFirstRace` and `ageAtLastRace` — two figures derived from
dates the data holds, correct forever and carrying no clock — and the masthead reads
**`Born 1911-06-24 · debut at 38 · last race at 47`**. A living driver's age today is a presentation
concern with a clock in it and stays out of the payload; `selectAgeYears(dob, on)` exists for a
surface that genuinely wants one, and no surface in F4–F6 does.

_(This replaces an earlier draft that said the age renders "only when the payload marks the driver
as active". There is no such flag and there cannot be one — the dataset has no death column and no
retirement column, so "active" would have had to be inferred from the last season, which is exactly
the kind of inference §5.3 forbids presenting as fact.)_

##### 6.6.2.2 Career totals — the exhaustive per-metric table, in §6.6.1's discipline

The race page's RESULT column taught this: **a total that is silently zero is worse than a total that
is absent**, because zero is a plausible-looking claim. `DR-2` asks for eight figures and they do
**not** all share one coverage window. This table is exhaustive on the eight and is binding.

> **⚠ Two rows of this table were wrong when it was written, and the engineer's measurements
> corrected them the same day. Both are recorded rather than edited silently, because the version
> that was wrong is the version a reader would reasonably have assumed.**
>
> **Poles.** This said *"`grid = 1` in the race result · 1950+ · never absent — **not** derived from
> the qualifying session, which begins 1994; a pole is the grid slot, and the grid exists from
> 1950."* That reasoning is clean and the data does not support it: measured, **9 races carry more
> than one `grid = 1` row**, and 1952 R8 has two *different* cars there (Ascari's 12 and Moss's 32).
> `grid` is a **starting slot after penalties**, not a qualifying result, and it is not reliably one
> car. Poles therefore come from the **qualifying classification**, which exists from 1994 and is
> **holed rather than merely bounded**: rounds with any qualifying classification run 15/16 in 1994
> and 17/17 in 1995, then **7, 10, 7, 3, 4, 1 and 2** of ~16 for 1996–2002, then complete from 2003.
> Senna reads 0 poles. That is the data.
>
> **Fastest laps.** This said **2004+**, quoting §5.1. §5.1 is right about the modern boundary and
> silent about an island: the flag is present on **every race of 1958 and 1959** (20 races), on
> **none** from 1960 to 2003, and on every race from 2004 bar one. So a career total for Clark or
> Stewart reads 0 where the record says 28 and 15 — and it is **not** a shape any single window can
> express, which is why the fix below is a denominator rather than a boundary year.

| Figure | Derivation | Coverage | Rendering |
|---|---|---|---|
| **Starts** | races entered minus those where every entry was `didNotStart` / `didNotQualify` (`DATABASE.md` §3). **The `REQUIREMENTS.md` §5.1 / `DATABASE.md` §3 conflict was resolved in `DATABASE.md`'s favour** — a driver who withdrew did not start. It moves 368 rows, one of them Schumacher's | 1950+ | always a figure |
| **Wins** | `position = 1` on the driver's best row for that race | 1950+ | always a figure |
| **Podiums** | `position IN (1,2,3)` — §5.1 | 1950+ | always a figure |
| **Points finishes** | `points > 0` for that event, **never "top 10"** — the points-paying range moved repeatedly (§5.1) | 1950+ | always a figure |
| **Poles** | overall qualifying classification = P1. **Never `grid = 1`** — see above | 1994+, **holed** | the denominator rule below |
| **Fastest laps** | `fastest_lap_rank = 1` | 1958–59 **and** 2004+ | the denominator rule below |
| **DNFs** | `status IN (10, 11)` on the best row, **never `position IS NULL`** (trap 3) | 1950+ | always a figure |
| **Championships** | a **count of titles read from `driver_championship` / `team_championship`**, `position = 1` in a **complete** season's final snapshot. **Never derived here, never from a points threshold, and the completeness gate is not a formality** — the 2026 snapshot currently ranks Antonelli first with 12 of 22 rounds unrun | 1950+ | always a figure |

##### The denominator rule — three states, because two would be a lie

A coverage-limited count has **three** states and a boundary year can only express two. The payload
publishes the denominator beside every such figure (`racesWithQualifying`, `racesWithFastestLapData`),
and the tile reads it:

| Denominator | Tile | Why |
|---|---|---|
| `0` | **`—`** in `--ink-tertiary`, with a footnote marker | The figure cannot be computed at all. `0 poles` for Fangio is a **false statement**, not a low score |
| `> 0` but `< starts` | **the figure**, with a footnote marker | The count is real and partial. Häkkinen's poles are undercounted and the footnote says by how much |
| `= starts` | **the figure**, no marker | Complete. Nothing to explain |

The footnote is one sentence per distinct denominator, in §6.5.3's three-part form: *"Qualifying
results are recorded for 41 of this driver's 161 races, so the pole count covers only those. Race
results, grids and championship positions are complete."* **Never a `caution` colour** (§3.4.3) and
never a `title` attribute as the only carrier.

**`entries` and `races` are both shown when they differ**, and they differ for 45 drivers. Trap 17:
40 races between 1950 and 1964 classify one driver two or three times, because he took over a second
car mid-race. 1950 R7 counted naively is one start, one podium **and one retirement in a race Ascari
finished second**. The payload collapses to one row per race and publishes `entries` beside it so the
discrepancy is visible; the masthead states `{starts} starts` and the totals grid adds
`{entries} classifications` only when the two disagree.

**Points is deliberately not one of the eight, and that is the most important row in this table.**
A career points total is the defect `DATABASE.md` trap 4 and §6.2 both name: 24 point systems, and
several eras counted only a driver's best N results, so the sum of a 1950s driver's race points is
not their championship total and no arithmetic makes the two comparable. Where a reader wants
magnitude across a career the honest figures are the counts above and the **rates** (§5.2); per-season
points appear on the season table, where they are a fact about one season's own scoring system.

**A tile whose value is outside its window renders `—` in `--ink-tertiary`, carries a superscript
marker, and the section carries one sentence per distinct absent window.** Never a `0`, never a
`caution` colour (§3.4.3), and never a tooltip as the only carrier.

##### 6.6.2.3 The season table, and the 318 two-team seasons

**Measured: 318 driver-seasons involve more than one team.** Rendering only the first would delete
half of González's 1951 and every mid-season switch in the sport's history; rendering two rows would
say the driver had two championship positions in one year, which is false.

**One row per season. The team cell holds every team, in order, joined by `→`** — the exact
treatment `SeasonStandings`' `TeamLine` already ships for the same data (`teamLineage`), so this is
reuse, not a new pattern. Above three teams it collapses to `{first} → … → {last}` plus a
`{n} teams` chip, and the full list is in the row's accessible name. **The identity bar on the row
takes the team the driver scored the most points with that season** — the same non-arbitrary rule
`SeasonCalendar` uses for a shared drive, and it is stated rather than left to row order.

Columns, at every breakpoint: **Season · Team · Pos · Points · Wins · Starts**. `Best` is
`standings-optional` and drops below 768px, exactly as the standings table does. The season is a
**link to `/seasons/{year}`**; the team cell links to `/teams/{ref}`.

##### 6.6.2.4 DR-4 + DR-5 — one chart, two measures, and the 1994 boundary is a control

Two near-identical diverging bars would be the worst outcome here: *grid → finish* and
*qualifying → finish* differ only by grid penalties, and side by side they read as a rendering
mistake. **They are one chart with a two-segment control**, which makes the difference between them
*visible by toggling* rather than by comparing two plots.

1. **Job** — polarity, per season. Did this driver gain or lose places, and when in their career.
2. **Form** — a **diverging horizontal bar**, one row per season, zero at the centre; gains extend
   right, losses left. Horizontal because a career is 1–20 rows and reads top-down as a ledger,
   because §6.3 rotates any category axis above seven, and because `categoryPlotHeight` already grows
   the plot rather than crushing the labels.
3. **Marks** — §6.3's 4px data-end on the far end only, square against the zero line. 2px surface gap
   between rows from `paddingInner`.
4. **Interaction** — per-mark tooltip. The two-segment control sits in the **filter row above the
   plot**, never inside it.
5. **Colour** — the team the driver drove most for that season, so a career changes colour when the
   driver changed team, which is the reading an F1 fan wants. Zero-length rows keep their colour.
6. **Accessibility** — every band labelled with its season, table view, and the disabled segment's
   explanation is **text, not only a `title`**.

**The pre-1994 state is the segment, not the plot.** `Qualifying → finish` is **disabled** for a
driver whose career ended before 1994 and carries §7.4's exact sentence — *"Qualifying positions
aren't available for 1985. Qualifying data begins in 1994."* — rendered beside the control, which is
NV-8's "coverage-aware controls reuse the same sentences" made concrete. For a career that **straddles**
1994 the segment is enabled and the plot shows the covered seasons only, with §6.5.3's partial note
naming how many seasons are outside the window. **A blank plot is never the answer to a boundary.**

**Positions gained excludes DNFs and pit-lane starts (`grid = 0`)** — §5.1, and the caption says so,
because a mean that quietly included retirements would make every unreliable car look like a bad
racer.

##### 6.6.2.5 CN-4 — the intra-team points split, and why it needs a new form

1. **Job** — **composition**. Which driver carried the team, season by season. Not magnitude
   (a bar), not sequence (a span), not change (a line): part-to-whole.
2. **Form** — the **`ShareChart`** (new, §6.6.3). One row per season, segments = that season's
   drivers, each row normalised to **100% of that team's driver points in that season**.
3. **Marks** — full band height, 2px `--surface-sunken` gap between segments, 4px radius on the row's
   **outer** ends only (§6.6's span rule, same argument), in-segment label where it fits.
4. **Interaction** — per-segment tooltip carrying the driver, the points and the share.
5. **Colour** — **this is the teammate case, so §6.4a applies in full**: two drivers of one team take
   the shade pair; three or more exhaust it and take the team's single plot colour with rung 4's
   hatch alternating and every segment directly labelled. This is the documented exception to §6.6's
   *"spans within a row are not differentiated by colour"* — that rule exists **because** the shade
   pair is reserved for teammates, and here the segments *are* the teammates.
6. **Accessibility** — legend of that season's drivers on hover/focus is not enough; the table view
   carries driver, points and share per season, and every segment has an accessible name.

**Normalising to a share is what makes this legal at all.** Raw points are comparable **within** one
season and not across eras (§5.2, trap 4); a share is a ratio of two figures scored under one system,
so a 1961 row and a 2026 row are comparable *as shares* while their points never are. The axis title
says `Share of the team's driver points (%)` and the caption states the rule. **A `ShareChart` whose
rows are not normalised is a defect**, and the component enforces it rather than trusting the caller.

**A season in which the team scored zero points has no share**, and dividing renders `NaN` — which
would collapse every segment silently (§1.0's exact failure mode). Such a row draws as a single
full-width `--surface-sunken` band labelled `No points scored`, which is a fact rather than a gap.

##### 6.6.2.6 CN-3 — the driver lineup, as a span chart

The team's whole roster history: **one row per driver, spans across the seasons they drove**,
`SpanChart` with the measure axis in **seasons** rather than laps. Ferrari 1950–2026 in one picture
is the single most striking thing on the team page and it needs no new component.

- **The row colour is the team's**, for every driver, because on a team page the team *is* the
  identity and colouring drivers differently would imply an encoding that does not exist. Drivers are
  separated by their row labels, which is rung 1 and always present.
- **A driver with two separate spells gets two spans in one row** — Räikkönen at Ferrari, Alonso at
  Renault. That is exactly what a span chart is for and it is why this is not a bar per driver.
- **Rows sort by first season ascending, then by surname** — never by success, which would encode
  rank in position.
- **Above 24 drivers the plot grows** (`categoryPlotHeight`), and above 60 it is capped with an
  explicit `Showing the {n} drivers with the most starts` note plus the full list in the table view.
  Ferrari has raced far more than 24 drivers and a silently truncated roster would be a lie.

##### 6.6.2.7 CI-1 — the map question, ruled

**No embedded map, and this is a decision rather than an omission.** A tile map is a third-party
network call on a request path, which `ARCHITECTURE.md` §7 (S-1, DL-2) forbids and the CSP does not
whitelist; a vector basemap is a megabyte of geometry against a 250 KB budget; and a *track* outline
does not exist in the data at all — drawing one would be fabrication.

What ships instead is **`CircuitLocator` (§7.11)**: an SVG graticule in equirectangular projection
with the equator, both tropics and both polar circles drawn and labelled, meridians every 30°, and
the circuit marked with a crosshair and a pip. Beside it, the numbers: latitude and longitude in
both decimal and DMS, and **altitude**, which is the one coordinate that changes how an F1 car
behaves — Mexico City sits at **2,227 m** and Zandvoort at **−7 m** (queried; both extremes of the
78 circuits in the record).

It is honest — every mark is drawn from `latitude` / `longitude` / `altitude`, nothing is inferred,
and no coastline is implied — and it is a better fit for this product than a map would be: it reads
as an instrument, which is §1.1's whole brief.

##### 6.6.2.8 CI-2 / CI-3 — the venue's record

**CI-2 race history** is a table, not a chart: season · round · race · winner · pole · laps, newest
first, every row a link to `/seasons/{year}/races/{round}`. It is the calendar row's anatomy rotated
to a venue, and it reuses `standings-table`.

**CI-3 most successful here** is a **horizontal `BarChart`** — magnitude with identity attached,
which is the form's own job — with a two-segment `Drivers` / `Teams` control in the filter row.
**Capped at the top 8 with ties shown in full**, and the note states the cap. Value is **wins at this
circuit**; the caption states that a venue's race count varies from 1 to 70+ so a raw win count
favours long-running venues' regulars, and the table view carries starts and wins together so the
rate is checkable.

##### 6.6.2.9 The seams this feature owes _(§1.0a)_

Built as part of **this** feature, because §1.0a rule 1 says the link belongs to the surface that
names the entity:

| From | To | Status |
|---|---|---|
| `SeasonStandings` driver row → `/drivers/:ref` | driver page | **built** |
| `SeasonStandings` team row → `/teams/:ref` | team page | **built** |
| `RaceClassification` driver cell → `/drivers/:ref` | driver page | **built** — RD-10 named 22 entities and linked to none |
| `RaceClassification` team cell → `/teams/:ref` | team page | **built** |
| `RaceMasthead` circuit → `/circuits/:ref` | circuit page | **built** |
| Driver season row → `/seasons/:year`, `/teams/:ref` | season hub, team page | **built** |
| Team lineup row, team season row → `/drivers/:ref`, `/seasons/:year` | driver page, season hub | **built** |
| Circuit history row → `/seasons/:year/races/:round` | race page | **built** |
| `SeasonCalendar` winner name → `/drivers/:ref` | driver page | ⛔ **deliberately not built** — see below |

**The calendar's winner is the principled exception (§1.0a rule 4).** The whole round row is already
a `<Link>` to the race page — itself the fix for a shipped seam defect — and an anchor inside an
anchor is invalid HTML and an established screen-reader failure. Restructuring the row so the round
number alone is the link would trade a working primary affordance for a secondary one. The driver and
team are reachable **one click further on**, from the race page's classification, which now links
every entity it names. Recorded here so it is not rediscovered as a bug.

#### 6.6.3 `ShareChart` — the fourth kit form _(added 2026-08-08)_

| | |
|---|---|
| **Job** | composition — part-to-whole within a category |
| **Beats** | a stacked `BarChart` (the kit has no stack, and `d3-shape.stack`'s cumulative round-trip is the error source §6.6 already rejected); a pie (angles are unreadable at 2 slices × 70 rows); a grouped bar (which encodes magnitude, so it answers a different question) |
| **Primitives** | `scaleBand` for the rows, `scaleLinear` fixed to `[0, 1]` for the measure. **No `d3-shape`.** |
| **Invariant it enforces** | every row's segments sum to 1. The component normalises from raw values itself and **a row whose raw total is 0 renders as a single labelled empty band**, never as `NaN` widths |
| **Motion** | **G-27's axis-anchored growth is wrong here and G-28's clip wipe is right.** A segment starting at 62% must not grow from the axis — that animates its *start*, the same argument `SpanChart` makes. One clip-rect `scaleX 0→1`, `dur.chart`, `ease.none` |
| **Colour** | the entity's plot token per segment, via `assignEntityColours` on the row's members — so the teammate shade pair applies without the caller doing anything |
| **Table view** | category · entity · value · share, one row per segment |

Added to §6.6's queue table as: **Composition split · part-to-whole · share bar · `scaleBand` + `scaleLinear`.**

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

### 7.3 `DataVintage` — the coverage indicator (NV-9) _(respecified 2026-08-06)_

The design decision: **express currency as coverage, never as a fetch event.** "Complete through
Round 10 of 22" is a fact about the sport's calendar. "Updated 12 days ago" is a fact about a
process. Coverage phrasing is also the more honest of the two — `REQUIREMENTS.md` §2.2 warns the
newest round may lag reality, and coverage phrasing states exactly that without pretending to know
today's calendar position.

#### 7.3.0 It was not broken. It was undiscoverable — and that is worse

Rishabh: *"the button up here: 2026 it also seems broken and i dont really know what its for."*

**The popover works, and worked before any of this changed.** `DataVintage.test.tsx` clicks the
trigger, asserts `aria-expanded` flips to `true`, and reads all four coverage sentences out of the
panel. The wiring — `useDisclosure` with `popoverEnter` / `popoverExit`, `aria-expanded`,
`aria-controls`, the `Esc` and outside-click dismissals — was complete.

**So this was a pure design failure, and a specific one: the accessible name was excellent and
nothing visible carried any of it.**

| What existed | What it told a sighted user |
|---|---|
| `aria-label="Data coverage: 2026 season, 10 of 22 rounds complete. Show detail."` | nothing — it is not rendered |
| A `ghost` button: transparent, no border, no shadow | **nothing indicated a control at all.** This is the whole of "i dont really know what its for" |
| The label `2026 · R10` | two numbers and no noun |
| A static 8px `--ink-tertiary` dot | nothing. It occupied the space where the fact could have been |
| No chevron, no caret, no disclosure mark | nothing indicated it opened anything |

He never saw a popover because nothing told him there was one, and a chip that says
`2026 · R10` with no boundary reads as a status label, not a button. **"Seems broken" is the
correct reading of an interactive element with no affordance.**

**This element deserves the fix more than most, because it is the one place the product's honesty
about its own data becomes visible.** `REQUIREMENTS.md` §6 and the six coverage boundaries of §7.4
are the substance of that honesty; this chip is where a user first meets it.

#### 7.3.1 The four visible changes

| # | Change | Answering |
|---|---|---|
| 1 | **A noun.** The eyebrow reads `Coverage` at `--text-2xs` in `--ink-tertiary`, so the chip says what it is *about* before it says a number | "i dont really know what its for" |
| 2 | **A meter.** 10 of 22 rounds, drawn — a 32×6px track in `--surface-sunken` with a `--accent-mark` fill, deliberately in **`CoverageRuler`'s exact visual language** so the chip and the landing page's ruler are recognisably the same statement at two scales. **It replaces the static dot** | "seems broken" — the dot stated nothing, so the chip looked inert |
| 3 | **A boundary.** `1px --border-control`, which §3.5 defines as *"boundaries of interactive controls"* and is the one border token measured to clear 3:1. Hover and open add `--accent-wash` and `--accent-border` | "seems broken" — a ghost button is indistinguishable from a label |
| 4 | **A disclosure affordance.** A 16px `ChevronDown`, rotating 180° on `[data-open='true']` | nothing said it opened |

**Compact form (<768px):** the eyebrow and the year drop; the meter, `R10` and the chevron remain.
A 56px header beside the wordmark has no room for the noun, and the meter plus the chevron still say
*coverage, and it opens*.

**The meter is `aria-hidden`, and that is correct rather than lazy.** The button's own name already
states "10 of 22 rounds complete", so exposing the meter would announce the same fact twice. It is
redundant reinforcement for sighted users — exactly the role §3.4.2 assigns colour.

**Nothing here animates on its own.** §4.5 keeps this component on the "must never animate" list and
the meter inherits that from the dot it replaces: in a header, motion reads as an alert, and there is
nothing to be alarmed about. The chevron's rotation is a **state**, keyed on `[data-open]`, not an
entrance.

#### 7.3.2 Anatomy

| Element | Spec |
|---|---|
| Trigger (≥768px) | `button`, `--size-control-sm` (28) high, `--radius-md`, `1px --border-control`, `padding-inline` 8, `gap` 8. Contents in order: eyebrow `Coverage` (`--text-2xs`, `--ink-tertiary`) · meter · `--font-mono --text-xs` `2026 · R10` in `--ink-primary` · `ChevronDown` 16 in `--ink-tertiary` |
| Trigger (<768px) | meter · `R10` · chevron |
| Meter | 32×6, `--radius-full`, `--surface-sunken` track with a `1px --border-subtle` edge, fill `--accent-mark` at `calc(var(--coverage) * 100%)`. `--coverage` is a **unitless ratio** from `selectSeasonProgress`, whose `ratio` is 0 rather than `NaN` when nothing is scheduled — a `NaN` reaching a `width` would collapse the meter silently |
| Accessible name | `"Data coverage: {year} season, {n} of {total} rounds complete. Show detail."` — read from `GET /api/meta`, never hardcoded. **Unchanged**: the added visible text costs a screen-reader user nothing |
| Detail | popover, `--elev-2`, max-width 320, `--radius-xl`, **G-6**, dismiss on `Esc` / outside click, focus returns to the trigger |
| Loading | **the chip's own box** with skeleton blocks inside it, not a slab of a fixed width — see below |
| Unavailable | the quiet dot survives, and only here. There is no coverage to meter, and a 0%-filled meter would state "nothing is complete", which is a claim about the sport rather than about a failed request. No error colour: at header scale a red dot reads as a site-wide fault, and the real failure is already stated in `main` |
| Footer echo | the same facts as plain text, so the information is reachable without opening anything |

**The loading state is the chip's own box, and that is a correctness fix rather than a nicety.** §7.5
requires a skeleton to mirror the geometry of what is coming; here it is also the only way to
guarantee the header does not reflow on resolve. The chip's width depends on the rendered width of
"Coverage" and of a mono round label, **neither of which a token can know** — the previous build used
a single 92px slab with a comment claiming it was "exactly the width of the resolved chip", and with
an eyebrow, a meter and a chevron added that figure would now be wrong by more than 100px. Reusing
the box, the gaps and `ch`-sized text blocks makes the two agree **by construction**. The skeleton
box drops the border: a `--border-control` outline around a loading state reads as a control that is
present but dead.

#### 7.3.3 Copy — every value from `GET /api/meta`, nothing hardcoded

- Popover heading: **"Data coverage"** — authored in sentence case and uppercased by
  `--text-2xs`'s `text-transform`, so assistive technology reads it as a word rather than an
  initialism
- Line 1: **"Complete results through Round {n} of {total} — {roundName}, {date}."**
- Line 2: **"Rounds {n+1}–{total} are scheduled and have no results yet."** _(omitted when the
  season is complete)_ — when exactly one round remains, the singular form
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

### 7.7 `AtmosphereField` — the background _(rebuilt 2026-08-06)_

One component, rendered **once** in `AppShell`, `position: fixed; inset: 0; z-index: var(--z-atmosphere); pointer-events: none;`
with `aria-hidden="true"` and `role="presentation"`. It is decorative, it is never interactive, and it
is never read by assistive technology.

#### 7.7.0 What was removed, and why — read this before proposing a gradient

Rishabh: *"i didnt like the moving background you used here, can you please make sure that the
background is much better, like i want the application to feel alive."*

| Layer | Verdict | Reason |
|---|---|---|
| **Three gradient orbs** | **REMOVED** | A 720px ellipse behind an 80px blur, drifting 64px over 18s, is stationary to the eye. **A soft gradient has no edge for motion to register against**, so it cannot read as alive — it can only read as a smudge, and once the accent went monochrome (§3.6) it was literally a grey smudge. They were also the field's entire contrast problem (below) and the only `filter: blur()` in the product. |
| **48px grid** | **REPLACED** by a 22px two-density dot lattice | A 1px wireframe at 48px reads as an overlay on the page. A dot lattice reads as the *surface* of it, holds a second density for hierarchy, and gives the pointer lamp something with an edge to light. |
| **Racing line + comet** | **KEPT**, re-tuned | The one element in the field with genuine F1 character, and decisively the one that is **sharp**: a 1.5px stroke and a hard 30×3px pip. Monochrome suits it *better* — the comet is now the brightest mark in the field rather than a pink one. Stroke → `--bg-line`, halo 0.55 → 0.30. |
| **Grain** | **KEPT**, strengthened | Its original job was to kill orb banding, which no longer exists. Its better job: **a large flat neutral field is the thing most at risk of reading as unfinished**, and grain is what makes it read as a surface. Measured with `overlay` modelled correctly (§9.2.2 **V-21a**), it moves the field's mean luminance by **nothing** — texture at zero contrast cost. |
| **Contrast plate** | **REMOVED** | **It existed only to undo the orbs.** Text over the orb field measured `--border-control` **2.64:1** and `--ink-tertiary` **4.00:1** (§9.2.1 V-13), so a 0.86–0.92 opaque veil had to be laid back over the whole thing to restore the §3.5 figures — the product was paying for a background it then had to hide. Remove the orbs and the reason goes with them. What replaces it is a **veil at 0.18 on the hero**, which is an *intensity control*, not a rescue: the field clears every §3.5 floor **before** the veil is applied at all (§9.2.2 V-21). |

**The new field is measured, not tuned.** §9.2.2 V-21 solves a **luminance corridor** from the two
§3.5 tokens with the tightest floors, and every alpha in the field is bounded by it:

| Theme | Bound | Value | From |
|---|---|---|---|
| light | **floor** — the field may not get *darker* than this | relative luminance **0.8707** | `--border-control` at 3:1 (`--ink-tertiary` at 4.5:1 gives 0.8618, so it is not the binding one) |
| dark | **ceiling** — the field may not get *lighter* than this | relative luminance **0.0125** | `--border-control` at 3:1 |
| dark | **second, tighter ceiling** | relative luminance **0.0115** | `--surface-raised`. Above it a panel is *darker* than its background, the elevation model inverts, and a card reads as a hole |

That asymmetry is why the two themes' fields are **different shapes rather than inversions**: light
mode may darken only as far as `--surface-sunken`, so its vignette is 0.04 and is a whisper; dark mode
may darken to black, so its vignette is 0.72 and is the field's main event. It is also why, in dark
mode, **the only light on screen comes from the cursor.**

#### 7.7.1 The six layers, bottom to top

Each is a single element. There is no canvas, no WebGL and — for the first time — **no `filter`
anywhere in the file**, which `backdrop.css.test.ts` now asserts.

| # | Layer | Composition | Motion |
|---|---|---|---|
| 0 | **Base** | `--surface-canvas` on the container | static |
| 1 | **Dot lattice** (`.atmosphere-dots`) | two `radial-gradient` dots with **hard stops** — a soft-edged dot at this size is a blur, and blur is what this field exists to get away from. Minor: 1px at `--size-field-cell` (22px) in `--bg-dot`. Major: 1.2px at `--size-field-major` (132px = exactly six cells, so a major dot always lands on a minor one) in `--bg-dot-major`. Sized `calc(100% + 2 cells)`, offset one cell. `mask-image: radial-gradient(130% 104% at 50% 0%, #000 0%, #000 44%, transparent 92%)` so it fades toward the bottom and the corners and the footer sits on clean canvas | **G-18** — `translate3d(cell, cell, 0)`, `--anim-field` (34s), `linear`, `infinite`. **0.65 px/s** |
| 2 | **Pointer lamp** (`.atmosphere-lamp`) | the **same** lattice at `--bg-dot-lit` (0.42 — roughly 3× the resting alpha), masked to `radial-gradient(--size-lamp circle at --px --py, #000 0%, #000 18%, transparent 72%)`. Opacity `calc(var(--lamp) * var(--bg-lamp-max))`. **Painted last, above the veil** | **G-21** — `--px` / `--py` / `--lamp` by `gsap.quickTo` at `m.pointer`; plus the same **G-18** drift, in phase |
| 3 | **Racing line** (hero only) | one inline SVG, `viewBox="0 0 1440 900"`, `preserveAspectRatio="xMidYMid slice"`. One open path reading as a circuit sector. Stroke `--bg-line`, `stroke-width: 1.5`, round caps. Plus the comet: a 30×3 `--accent-mark` pip, a 40×2 trail at 0.45 three percent behind it, and a `26×14` radial halo at 0.30 — all three riding the same `offset-path`, all inside the same `<svg>` so they cannot separate | **G-20** — `offsetDistance 0%→100%`, `--anim-comet` (11s), `linear`, `infinite` |
| 4 | **Grain** | `url("/textures/grain.svg")`, 240×240 tile, `repeat`, `mix-blend-mode: overlay`, opacity light **0.024** / dark **0.05** | static, always |
| 5 | **Vignette** | `radial-gradient(128% 98% at 50% 6%, transparent 0%, transparent 30%, var(--bg-vignette) 100%)`. Light `rgb(27 30 36 / 0.04)`; dark `rgb(0 0 0 / 0.72)` | static, always |
| 6 | **Veil** | flat `var(--surface-canvas)` at `--bg-veil-alpha`. **The only attenuation control in the field** | opacity set by attribute, never tweened |

**Two elements carry the same lattice, and that is a deliberate cost of one extra layer.** They exist
at different depths: the resting lattice **below** the veil so a route can attenuate it, the lamp
**above** it so the pointer response survives on a data surface. They stay in phase by construction —
same animation name, same period, both created in the same React commit, so both start at the same
document time — and their geometry comes from one shared token, because a one-pixel pitch difference
would render as two lattices beating against each other and would look like a rendering fault rather
than a CSS mistake. `AtmosphereField.test.tsx` asserts the DOM order; `backdrop.css.test.ts` asserts
the shared pitch.

**The lamp's mask is offset by half a cell.** Its coordinates arrive in viewport space but the mask
resolves in the element's own space, which is displaced by one cell of inset less 0–22px of animated
translation. Half a cell centres the residual at **±11px** against a 340px lamp — 3%, and the
alternative (reading the animated transform back on every `pointermove`) would force a style flush
per frame.

#### 7.7.2 Intensity is route-scoped, by attribute

`<html data-bg="…">` takes exactly three values, set from the route by the shell. **`calm` is the
default and its values live on `:root`**, so a route that never thinks about its background gets a
recessive one; `hero` is the exception that raises it.

| Value | Where | `--bg-veil-alpha` | `--bg-lamp-max` | Layers |
|---|---|---|---|---|
| `hero` | `/` only | **0.18** | **1** | all six, plus the racing line and comet |
| `calm` | **every other route — the default** | **0.66** | **0.45** | all six except the racing line and comet |
| `off` | reserved — a full-screen chart or a print view. F2+ escalates to it | — | — | **none.** Only the flat base survives; `AtmosphereField` renders no layer at all, because a paused compositor layer still holds its memory |

**This is the binding answer to "motion must not compete with data", and it changed shape with the
rebuild.** The old answer was a 92%-opaque plate. The new one is two numbers: at `calm` the resting
lattice is attenuated to 34% of its alpha, and the pointer lamp — which is the only thing that moves
in response to anything — is capped at 45%. **The lamp deliberately survives on a data route**, because
a background that only answers the pointer on the landing page reads as a landing-page trick, and
Rishabh asked for *the application* to feel alive. Where that is still too much, F2 uses `off`.

#### 7.7.3 Reduced motion

Under `prefers-reduced-motion: reduce`:

- **G-18 stops** — chokepoint 1 in `motion.css` sets `animation: none`, and both lattice layers rest
  at `transform: none`, which is their authored position (MR-2).
- **G-20 is absent** — the comet is `display: none` via a `@media (prefers-reduced-motion: reduce)`
  rule in `backdrop.css`, not by JS, so it does not exist even before hydration.
- **G-21 is never created** — the hook builds its setters inside `animate`, so no `quickTo`, no
  listener and no tween exists, and `--lamp` stays at its authored `0`. **The lamp is therefore
  absent, not frozen at a position.** That is correct: a light with nobody holding it is decoration.
- **The lattice, the racing-line stroke, the grain, the vignette and the veil all remain.** The
  reduced state is a **composed still image** — a two-density lattice fading out toward the bottom,
  a circuit sector drawn across it, grain, and a vignette — not a blank page. Turning the background
  off under `reduce` would give reduced-motion users a visibly poorer product, and nothing about a
  static lattice is a vestibular trigger.
- Toggling the OS setting **while the app is open** stops the motion immediately: chokepoint 1 is a
  media query, and `gsap.matchMedia()` reverts G-21's handler when the condition starts matching.

#### 7.7.4 Cost and CSP

- **No new dependency, no canvas, no WebGL, no `filter`, and one 240×240 SVG noise tile.**
- Six elements, two composited transforms (the two lattice layers, `will-change: transform`), one
  composited `offset-distance`, and three static paints. `will-change` is on nothing else.
- **CSS reclaimed rather than spent.** Three orb rules, three orb `@keyframes`, the grid rule, the
  plate rule and two `data-bg` override blocks are gone; the lattice adds two rules and one
  `@keyframes`. Net effect on the artefact is reported with the build figures.
- **CSP-clean.** `script-src 'self'` / `style-src 'self'` with no `'unsafe-inline'`: the field needs
  no inline `<style>` and no inline `<script>`. All CSS ships in the stylesheet; the one runtime value
  React writes (the comet's `offset-path`) goes through the CSSOM, which CSP does not govern, and the
  three GSAP-driven properties likewise. The grain tile is `img-src 'self'`.
- **The comet's gradient stops are classed, not inline**, and no longer use `currentColor`: the
  element's `color` is `--bg-line`, which already carries a low alpha, so a `currentColor` halo would
  have been alpha-multiplied down to nothing.

#### 7.7.5 What it must never do

- Never sit above `main` (`--z-atmosphere` is 0 and `main` is 1).
- Never receive pointer events.
- Never animate its own `opacity` on route change — the veil's value changes by attribute, instantly.
  A cross-fading background on every navigation is perceptible by the fifth click.
- Never render layer 3 outside `data-bg="hero"`.
- Never reintroduce a `filter`. It is the one property that makes a decorative layer expensive
  (§10 #24), and its absence is now asserted.
- Never let GSAP own `transform` on a lattice layer, or CSS own the lamp's position. That is MR-1,
  and here it is enforced by construction: GSAP writes only custom properties, and only on the root.

### 7.8 `CommandDock` — primary navigation _(rewritten 2026-08-06)_

One component, two orientations, one `<nav aria-label="Primary">`.

#### 7.8.0 The faults, and what fixed each

Rishabh: *"the sidebar, its broken the way its layout is isnt great"* — and earlier, *"when its
closed and when its open both"*. Then, after the rebuild: *"the menu bar is still broken … please
fix that side bar, its really broken."*

**Faults 4–6 are all consequences of the full-height geometry fault 3 introduced, and fault 7 is a
consequence of fault 5's fix.** That progression is the point of recording all eight: each fix moved
the rail into a collision the previous accident had been hiding. Faults 1–3 were found by reading the
CSS; 4–6 by reading a screenshot of the built shell; **7 and 8 by measuring the resolved box model in
Chromium against the built stylesheet** — because 7's own predecessor was diagnosed correctly from
intent and still regressed. jsdom performs no layout, so none of these is visible to a unit test until
it is expressed as arithmetic over the tokens, which is what `index.css.test.ts` now does for each.

**The lesson fault 7 carries, and it is a general one.** The four tests written for fault 5 asserted
the glyph's *centre* and passed while the glyph was invisible: the arithmetic was right and the
outcome was wrong. **Assert what a change could destroy, not only what it positions.** The invariant
now under test is that the collapsed lane's *unshrinkable* content fits the lane, and that the glyph
is the rigid participant — a budget, not an offset. Against the regressed stylesheet it reports
`the collapsed lane is 46px and its unshrinkable content is 64px`.

| Fault | Diagnosis | Fix |
|---|---|---|
| **1. Collapsed, the labels clipped mid-word** — the 64px rail literally read `Hor`, `Seas`, `Driv`, `Tea`, `Circ`, `Com`, `Reco`, `Kee` | **Definite.** `index.css` held exactly two `.dock-label` rules — the base and a ≥1024 size override — and **neither hid anything**. The rail was specified icon-only and nothing implemented it | `--dock-label` / `--dock-label-x`, set on the rail's **collapsed state** and fallback-defaulted to the visible values, so the bottom dock needs no rule and a stylesheet failure cannot hide a label (MR-2) |
| **2. The collapsed glyph sat 8px off-centre** | **Definite, and previously documented as correct.** `padding-left: 22px` carried the comment *"32 − half of a 20px glyph = 22"*, which forgot the rail's own 8px padding: the item's box starts at x = 8, so the glyph centre was **40**, not 32 | `padding-left: calc((--size-dock-lane − --size-dock-glyph) / 2)` = **13px**. Stated as arithmetic over the tokens involved, the error is not expressible — and `index.css.test.ts` asserts the form, that no literal remains, **and that the resolved centre equals the rail's centre as a number** |
| **(unnumbered) Expanded, hover "did nothing"** | **Not reproduced, and that is why the mechanism is gone.** The React path *works* — `data-expanded` flipped to `true` on `pointerenter`, verified with a throwaway jsdom diagnostic — and the built cascade *was* correct: `.dock[data-expanded=true]{width:…}` sat inside the ≥64rem query at higher specificity than `.dock{width:…}`. The most likely explanation is a screenshot captured inside the 320ms width transition | **`:hover` and `:focus-within`, in CSS.** Three pieces of React state became one. Shipping something that had already failed once for a reason nobody could name would be the wrong call; expressing the same two conditions with no state, no re-render and no attribute round-trip removes the failure mode rather than betting against it |
| **3. The vertical geometry was an accident** — a content-height box floating at roughly 235→660px in a 900px viewport, neither full-height nor centred, with the active fill clipped by the container's corner | Its position was `top: 50% + translateY(-50%)` on a content-height box, so the geometry was whatever the item count happened to produce | **Full height, from below the header (fault 4) to `--size-dock-inset` above the viewport's foot.** Destinations at the top, the pin pushed to the foot by `margin-top: auto`, deliberate empty glass between. `padding-block` 12px so no item enters the `--radius-2xl` corner arc |
| **4. The rail painted over the header and hid the wordmark** — collapsed, the header read "ANALYTICS" with the `F1` badge buried under the active pill; expanded, the wordmark was gone entirely | **Definite, and a direct consequence of fault 3's fix.** `top: --size-dock-inset` puts the rail 16px from the viewport's top, i.e. *inside* the 56px header band, at `--z-dock` (40) over `--z-header` (30). The previous content-height box escaped this only by accident, because it happened to start at ~235px | **`top: calc(--size-header + --size-dock-inset)`** — the rail begins one inset below the header band and the header keeps its full width with the wordmark at the far left. See §7.8.3 for the alternative resolution and why it cannot hold |
| **5. Every collapsed glyph sat at a different x, set by the length of its own hidden label** — and the active pill was ~100px wide inside a 64px rail, clipped to look edge-to-edge with no inset. Reported as *"the active pill's glyph looks a few px right of the other icons' column"* | **Definite, and it made fault 2's fix inoperative.** `.dock-slot` is `justify-content: center` and `.dock-item` was `flex: none`, so the item's width was `max-content` = padding + glyph + gap + **label**. A collapsed label is `opacity: 0`, which paints nothing and **lays out fully**, so each item was as wide as its own text, overflowed the 46px lane, and was then centred in it: a different negative left offset per destination. `Home` sat furthest right, `Compare` and `Records` furthest left. Two silent consequences: expanded, every destination glyph sat at x ≈ 105 while `.dock-pin` (which does set `width: 100%`) sat correctly at 49, so the pin never lined up with the menu above it; and the G-3 indicator at x = 21 was *underneath* the overflowing pill, i.e. `--accent-mark` on `--accent-fill` — invisible, exactly the failure §7.8.1 claims putting it outside the pill prevents | **`width: 100%` + `min-width: 0`** on the rail item, and the centring divisor becomes **`--size-dock-lane` (46), not 48**: `border-box` takes the dock's two 1px borders out of `--size-dock` as well as its padding, so the previous divisor was 2px too wide and 1px off even before the label sizing. `min-width: 0` is load-bearing — the base rule's `min-width: --size-dock-item` (48) exceeds the lane and would leave a 1px overflow each side |
| **6. Collapsed, the pin read as an almost-empty rounded box** rather than a control | Contrast is **not** the cause, and raising the ink would have been the wrong fix: `--ink-secondary` over the glass composite is ~8.6:1 dark / ~7.4:1 light. What the compartment lacks is ink **area** — a 20px glyph at `stroke-width: 1.5` is ~60px² of mark in a 46 × 48 box, below a divider, with no label and nothing else near it | **The box becomes the affordance:** a resting `--border-subtle` hairline ring, so the target has an edge without adding a second loud object to the rail. `box-shadow: inset`, never `border` — a border is drawn *inside* the box under `border-box` and would push the glyph 1px off the lane the seven destinations share |
| **7. Collapsed, EVERY nav glyph was invisible** — the rail painted two empty rounded boxes, the active pill and the pin compartment, and nothing else. Reported as *"a regression, and it is the state Rishabh sees on load"* | **Fault 5's fix caused it.** Sizing the item to its 46px lane created a flex deficit where `max-content` had left none, and the algorithm resolved the whole deficit against the glyph. Measured in Chromium at 1440×900 against the built stylesheet: every collapsed `<svg>` was **`width: 0, height: 20`**, and an `<svg>` root carries a UA `overflow: hidden`, so a zero-width viewport paints none of its geometry. The distribution is forced: the collapsed item's content box is 46 − 13 = **33px** and its children want 20 + 12 + 39…110; `white-space: nowrap` floors the label's `min-width: auto` at its **entire text width** so it cannot yield, while an inline `<svg>` with a `viewBox` and no intrinsic dimensions has a min-content size of **0** and yields everything | **`flex: none` on the glyph**, declared as `.dock-item > svg` in the **base** block. It is the only fix that makes the glyph's size independent of the *label's content* — widening the item or shortening a label would leave the glyph a function of how long a destination happens to be called, which is fault 5's coupling again. Its second half is `min-width: 0` + `overflow: hidden` on the rail label, so the lane is genuinely self-consistent (13 + 20 + 12 = **45 ≤ 46**) rather than merely looking right because `opacity: 0` paints nothing over a clipped overflow |
| **8. The slot kept a 48px floor inside a 46px lane** — the active pill was 2px overwide, its right edge clipped, and 2px wider than the pin below it | **Found while measuring fault 7, never reported, because it is 2px.** Fault 5 put `min-width: 0` on `.dock-item` only, and the item is `width: 100%` of the **slot**, whose base `min-width: --size-dock-item` (48) still applied. Measured: the item resolved to **48** and ran x = 25…73 while the rail's content box ends at 71. `.dock-pin` is a plain `div` child, never subject to the slot's floor, and was correctly 46 — so the pill and the pin compartment were never the same width | **`min-width: 0` on the grouped `.dock-slot, .dock-item` rule**, i.e. on both. Both measure 46 now, and the pill's 9px inset is symmetric. **The glyph centre was unaffected** — `padding-left` derives from the lane *token*, not from the box — which is exactly why every centring assertion passed |

#### 7.8.1 The design-system-level rules

- **Exactly one `nav[aria-label="Primary"]` in the document**, and it is outside `main`. `AppShell`
  keeps the single `main#main` and the skip link that targets it (§8).
- **At ≥1024px:** a fixed vertical rail, `left` and `bottom` at `--size-dock-inset` and
  **`top: calc(--size-header + --size-dock-inset)`**, `--size-dock` (64) wide collapsed,
  `--size-dock-open` (232) expanded, `--radius-2xl`, `--surface-glass` + `--glass-blur` +
  `--elev-2`. It expands **over** content and never reflows `main` (§5.3).
- **The rail never reaches the header, and that is structural rather than a stacking choice.** The
  expanded rail may overlay page content — intended — but it must **never** obscure the wordmark or
  the coverage chip. Because it expands to 248px including its inset, the only geometry that holds
  that at *every* rail width is one that starts below the header band (§7.8.3). `top` is therefore
  **derived from `--size-header`**, never a literal and never the bare inset.
- **Below 1024px:** a fixed horizontal dock, `bottom: --size-dock-inset`, centred,
  `max-width: --size-dock-max` (480), `--size-dock` tall, `--radius-full`, same surface treatment.
  Five slots; the fifth opens the overflow sheet (G-5).
- **One padding in both orientations** — `--size-dock-pad` (8px) — so the active pill is inset by
  the same amount on every side and can never be clipped by the container's radius.
- **The collapsed rail's inner width is `--size-dock-lane` (46), not 48**, and it is the only
  figure a glyph may be centred against. `--size-dock` less twice the padding is 48, but
  `box-sizing: border-box` takes the dock's two `--size-dock-hairline` borders out of the width as
  well. The rail's horizontal centring has now been wrong three times — a 22px literal, then a 48px
  divisor, then a box the hidden label was silently sizing — so the whole subtraction lives in one
  token and `index.css.test.ts` resolves it to a number.
- **A rail item fills its lane**: `width: 100%`, and `min-width: 0` on **both the item and its slot**
  (the item is `width: 100%` *of the slot*, so resetting one without the other leaves the base 48px
  floor in force — §7.8.0 fault 8). Never `max-content`, because a collapsed label is `opacity: 0` —
  it paints nothing and lays out fully, so a `max-content` item is as wide as its own text (fault 5).
- **A glyph is never a flexible box: `flex: none` on `.dock-item > svg`, in the base block.** This is
  a system-level rule, not a rail patch. Sizing a container to a lane creates a flex deficit, and the
  deficit lands on whichever child *can* yield — which for an inline `<svg>` with a `viewBox` is its
  entire width, because its min-content size is 0 and `min-width: auto` therefore floors it at 0. A
  glyph squeezed to `width: 0` paints nothing at all (`<svg>` has a UA `overflow: hidden`) and throws
  no error. It is a structural selector rather than a `.dock-glyph` class deliberately: the invariant
  belongs to the lane, so it must hold for any glyph a later change drops in, including one whose
  author never reads this section.
- **Anything in a lane that carries `white-space: nowrap` must be able to yield it.** `nowrap` makes
  an element's automatic minimum size its full text width, so a nowrap label in a 46px lane is
  unshrinkable at 39–110px and evicts everything else. The rail label therefore declares
  `min-width: 0` **and** `overflow: hidden` — the second so a future long label *truncates* rather
  than pushing the glyph out. Relying on `opacity: 0` and the container's `overflow: hidden` to hide
  the overflow is not sufficient: that leaves the layout wrong and merely looking right, which is
  precisely the reasoning that shipped fault 7.
- **Active item:** an **inverted pill** — `--accent-fill` with `--accent-on` type, 19.91:1 — plus
  `aria-current="page"`, plus the 2px `--accent-mark` indicator (G-3). It was an `--accent-wash`
  pill; a wash is not enough emphasis for "where you are" once hue is gone (§3.6.4). It also solves
  the collapsed rail specifically: with labels hidden, the inverted pill is what tells you which of
  seven equal-weight glyphs is current.
- **The indicator sits half the dock's padding *outside* the pill**, and that is required by the
  inversion: a `--accent-mark` bar on an `--accent-fill` pill is the same colour as the pill.
- **Hover:** `--accent-wash` fill, `--accent-ink` glyph. **No pointer spotlight** — G-8 is retired
  (§3.5.2, §4.6): a low-opacity achromatic radial over a glass surface reads as a smudge, which is
  the same failure the atmosphere's orbs were removed for.
- **The pin control carries a resting `--border-subtle` ring**, as an `inset` box-shadow and never a
  `border` (§7.8.0 fault 6). Its pressed state is `--accent-wash` — the same "held, not current"
  weight as `.dock-sheet-row-active` — and deliberately **not** the active pill's inversion: that
  device means "the page you are on" and must remain the rail's only inverted object, or the
  collapsed rail's one wayfinding signal is diluted. Pinned implies expanded, so the pressed state is
  never seen without its label and needs no louder cue.
- **The rail's expansion is its tooltip.** No `title` attribute on any collapsed control: hovering
  anywhere on the rail reveals all seven labels plus the pin's, so a per-control tooltip would be a
  second, slower mechanism for the same job.
- `main` reserves `--size-rail-clearance` (≥1024) or `--size-dock-clearance` (below), so the dock
  never covers content and no page needs a bespoke offset.

#### 7.8.2 The collapsed ↔ expanded transition, specified

| Property | Collapsed | Expanded | How it gets there |
|---|---|---|---|
| rail width | `--size-dock` (64) | `--size-dock-open` (232) | `--dock-width`, CSS `transition: width --dur-slow --ease-move` (G-4) |
| label opacity | 0 | 1 | `--dock-label`, `--dur-fast` / `--ease-enter` |
| label x | `−--size-dock-label-shift` (−6px) | 0 | `--dock-label-x`, same duration and ease |
| label reveal order | — | staggered | `transition-delay: calc(var(--dock-index) * var(--stagger-dock-label))` — **18ms**, so 7 labels × 18 + 140 = **266ms**, inside §4.2's 400ms ceiling. `stagger.nav`'s 35ms would reach 490 and break it |
| label collapse order | simultaneous | — | `transition-delay: 0ms` on the collapsed state. **A staggered disappearance reads as lag rather than as sequence**, so only the reveal staggers |
| glyph position | centre **32px from the rail's own left edge** — x = 48 in viewport coordinates, at the rail's 16px inset | identical, 32px — **measured at x = 432 on a rail at x = 400** | **unchanged, deliberately.** A glyph that shifts as the rail expands makes the whole panel look like it is sliding — the single most noticeable detail if it is got wrong. It held only for `.dock-pin` until fault 5 was fixed. **The invariant is constancy, not centredness:** 32 is half of the collapsed rail's 64 and that coincidence is collapsed-only — expanded, the rail is 232 wide and the glyph is deliberately nowhere near its midpoint. This table and two code comments previously claimed "half the rail's width in both states", which measurement disproved |
| glyph size | **20 × 20, laid out** — not merely positioned | identical | `flex: none` on `.dock-item > svg`. Between `02d6568` and the fault 7 fix this measured **0 × 20** and the whole rail was blank; the position was right throughout |
| item width | `--size-dock-lane` (46) | the expanded lane (214) | `width: 100%` + `min-width: 0` **on the slot as well** (fault 8). **Never `max-content`** — see fault 5 |
| item gap / padding | `padding-left` **13px**, `gap` 12px | identical | nothing about the item's box changes except its width; the glyph's offset within it does not. 13 + 20 + 12 = **45 ≤ 46**, so the collapsed lane closes with 1px of slack |
| label width | **1px, clipped** (`min-width: 0` + `overflow: hidden`) at `opacity: 0` | its text width, 39–110px | the label is the lane's *yielding* participant, by design. It must never be the rigid one — fault 7 |

**Every open-state value routes through a custom property**, and that is the mechanism rather than a
style: G-4's reduced variant is "permanently expanded, pin hidden", and with the open state written
as declarations on a `:not(:hover):not(:focus-within)` chain the override would have to out-specify
four classes — `!important` or a longer chain, both worse. As three properties on `.dock`, the
reduce block wins at **equal specificity by source order**, which is the least surprising cascade
available. `index.css.test.ts` asserts the ordering.

#### 7.8.3 Rail vs header — the two resolutions, and why this one

Two coherent designs resolve fault 4, and they read very differently, so the rejected one is recorded
rather than left implicit.

| | **A — the rail begins below the header** *(chosen)* | **B — a genuinely full-height rail, header yields** |
|---|---|---|
| Mechanism | `top: calc(--size-header + --size-dock-inset)` | rail stays at `top: --size-dock-inset`; the header's inner container gains `padding-left` equal to the rail's clearance |
| Reading | Full-width header, wordmark at the far left, the rail owning everything beneath it | The rail as a true sidebar with visual primacy; the header becomes a bar *beside* it, and the wordmark aligns with page content |
| Wordmark, rail collapsed | clear | clear at 96px of padding |
| Wordmark, **rail expanded** | **clear** | **covered.** The rail expands to 232 + 16 = **248px** over content on hover, so 96px of header padding loses the wordmark every time the rail opens. Holding it would need ≥264px of padding — a third of the header empty, and the wordmark no longer aligned to anything |
| Double glass | none — the two surfaces never overlap | the rail's top overlaps the header band, so `--surface-glass` + `--glass-blur` composites twice in that corner and reads denser than either |

**B is the more striking composition and it still loses**, because "never obscure the wordmark or the
coverage chip" is a requirement and B can only satisfy it at a width that ruins the header. A is the
only one of the two that holds **structurally, at every rail width**, with nothing to re-check when
the expansion width changes.

**A z-index swap is not a third option.** Reordering `--z-header` and `--z-dock` would put the
header's 56px band over the rail's first row — a truncated destination traded for a hidden wordmark.
The rail stays above the header in the stacking order (`tokens.css.test.ts` still asserts
`--z-skip` > `--z-dock`); it simply no longer reaches it. `index.css.test.ts` pins the derivation from
`--size-header`, because a token drifting — a taller header — is now the only way this can break, and
nothing else would notice.

#### 7.8.4 Accepted limitation — the pin clips below ~530px of viewport height

**Rishabh's decision, 2026-08-06: leave it.** The rail is full-height between the header and the
viewport's foot, and its contents are a fixed 7 × 48 of destinations plus a 48px pin compartment with
its divider and padding. Below roughly 530px of viewport height that content exceeds the box and
`.dock-pin-row` is clipped by the rail's `overflow: hidden`.

No machinery is added for it, and the reasoning is recorded so it is not re-raised as a finding:
**1024 × 768 is the supported floor and the pin is fully visible there**, and a scrollbar inside the
glass — the obvious alternative — is a worse outcome than a clipped preference control at a viewport
height nobody uses. The pin is also the only *optional* control in the rail: every destination it
could displace stays reachable, and the preference it toggles has a persisted default.

### 7.9 `CareerRibbon` — a whole existence as one strip _(added 2026-08-08)_

The signature element of the three entity pages (§6.6.2.0). One cell per season from an entity's
first to its last, in year order, no gaps — a season the entity sat out is a cell in the **absent**
state, because the hole in a career is part of the career.

#### 7.9.1 Anatomy

| Element | Spec |
|---|---|
| Cell | `--size-ribbon-cell` **14px** wide, `--size-ribbon` **72px** tall, `--radius-xs`, gap `--size-ribbon-gap` **3px**. Below 768px the cell is **8px** and the gap **2px** |
| Fill | a bar **grown from the cell's foot**, height = `positionFill(position, fieldReference)`; token `--accent-mark` at 100% for a title, `--ink-primary` otherwise. The track behind it is `--surface-sunken` |
| Title season | the cell is **fully filled** and carries a 2px `--accent-mark` cap rule at its head. A championship is the one thing on the strip that must be findable without counting |
| Absent season | track only, no fill, plus a 1px `--border-subtle` baseline tick — visibly a cell that exists and holds nothing |
| Unranked season | the entity raced and finished with no championship position (1950 has 59 of them). A **2px `--ink-tertiary` foot rule**, never a zero-height fill: absent and zero are different (§1.0) |
| Year label | every 5th cell and both ends, `--text-2xs` `--font-mono` `--ink-tertiary`, below the strip. Never every cell — a 40-season career would collide at 14px |
| Overflow | the strip scrolls **inside its own container** above 76 cells (`--size-ribbon-max`), which is the widest 1440px can hold; it never shrinks the cell below 8px |

#### 7.9.2 The fill is a rank, and inverting it is the whole point

`positionFill` maps **P1 → 1.0** and the deepest position in the entity's own history → **0.12**,
linearly. Three properties, each a rule:

1. **P1 is the tallest.** In F1 up means faster and 1 is the best value — §6.3 already inverts every
   position axis in the product and a ribbon that grew with the number would read backwards to every
   fan.
2. **The reference is the entity's own worst season, not the field size.** A driver whose career ran
   P1–P4 gets a strip that uses its full height; scaling to P26 would flatten a title fight into four
   near-identical stubs. This is the same argument §6.3 records for the position axis's maximum, and
   it is the same reversal — reached the same way, by looking at what it renders as.
3. **A floor of 0.12, never 0.** A zero-height fill is indistinguishable from the absent state, which
   is the §1.0 collapse this whole document keeps finding. The floor makes "raced, finished last" and
   "did not race" different marks by construction.

#### 7.9.3 Interaction, motion and accessibility

| | |
|---|---|
| Hover / focus | the cell's fill steps to `--accent-mark`, `dur.instant`, CSS transition, plus a readout above the strip naming the season and its position. **The readout has a reserved line whether or not anything is hovered**, so nothing reflows |
| Keyboard | the strip is **one tab stop**; `←` / `→` move the cursor cell, `Home` / `End` jump to the ends, matching §6.5.1's plot-area convention exactly. A cell is not individually focusable — 76 tab stops is a trap |
| Mount | **G-27**, `scaleY 0→1` from `transformOrigin: "center bottom"`, `dur.chart`, `ease.mech`, `stagger.bar` through `staggerAmount` so a 76-cell strip stays inside its budget. This is a data mark growing from an axis and it takes the motion that exists for exactly that |
| Reduced motion | **not created.** Every cell is at full height in the DOM from frame one (MR-2) |
| Announcement | the strip carries one `aria-label` — *"Championship position by season, 2007 to 2026"* — and the full sequence is in the season table below it, which is the table view this element's chart cousins are required to have |

**It is not a chart and must not grow into one.** No axis, no gridlines, no tooltip, no table toggle:
its readings are exactly the season table's rows, one section below it. A ribbon that acquired a
measure axis would be a bar chart drawn small, and the product already has one.

### 7.10 `EntityPortrait` — the permanent placeholder _(added 2026-08-08, discharges §7.6)_

881 drivers and 214 teams will never all have images, so the placeholder is the **shipping** form
and the photograph is the enrichment (§7.6). It is designed as a component, not as a grey box.

| | Driver | Team |
|---|---|---|
| Box | 72×72 at ≥768px, 56×56 below, `--radius-lg`, `1px --border-subtle` | same |
| Ground | `--surface-sunken`, with a 3px full-height `--identity` bar on the leading edge | same |
| Mark | the **code** where one exists, `--display-xs` `--font-display`; otherwise the **surname's first two letters**, capitalised | the team name's **initials**, up to 3 |
| Ink | `--ink-primary`. **Never the identity colour** — §3.3a.5 rule 2: an identity colour is never applied to a numeral or a glyph that stands for a name |
| Accessible | `aria-hidden`; the name beside it is the accessible content. A placeholder is decoration for a fact already stated |

**Two initials from a surname is not the abbreviation trap.** §6.5.4a forbids *deriving a
three-letter code*, because a code is a convention the sport owns and inventing one misrepresents
the data. Two letters in a box is unmistakably a monogram — it does not look like `HAM` and cannot be
mistaken for one.

**When an asset arrives** (R1/R2, Rishabh's) the `<img>` replaces the mark and keeps the box, the
radius and the identity bar, so nothing around it moves.

### 7.11 `CircuitLocator` — coordinates, drawn _(added 2026-08-08)_

The answer to CI-1's "map" that does not need a map (§6.6.2.7). One inline SVG, `viewBox="0 0 360 180"`,
equirectangular — x = `longitude + 180`, y = `90 − latitude`, so the projection is the identity and
there is nothing to get wrong.

| Layer | Spec |
|---|---|
| Frame | 1px `--border-subtle` rect, `--surface-sunken` fill |
| Meridians | every 30°, 1px `--border-subtle`, dashed `2 4`. The **prime meridian** is solid `--border-strong` |
| Parallels | the equator solid `--border-strong`; the two tropics (±23.44°) and the two polar circles (±66.56°) dashed `2 4` in `--border-subtle`, each labelled at the left in `--text-2xs` `--ink-tertiary` |
| Mark | a full-width and full-height 1px `--accent-mark` crosshair through the point, plus a 7px `--accent-mark` pip with a 2px `--surface-sunken` ring — §6.3's marker ring rule, so the pip survives on a gridline |
| Readout | beside the SVG: `26.0325° N, 50.5106° E` and `26°01′57″ N, 50°30′38″ E` in `--font-mono`, plus `7 m above sea level` |
| Accessible | `role="img"` with `aria-label="Bahrain International Circuit, Sakhir, Bahrain — 26.03 degrees north, 50.51 degrees east"`; the numbers are also present as text, so the graphic is redundant |
| Motion | **none.** It is a static readout. `prefers-reduced-motion` has nothing to stop |

**It draws no coastline and implies none.** The graticule is stated as a graticule by its own labels;
a viewer reads latitude and longitude, not a country outline. Adding a landmass would need a
topojson asset that costs more than the whole chart kit and would be the only decorative geometry in
the product.

**Altitude is a figure, never a mark on this graphic.** A third dimension on a two-dimensional
projection is the dual-axis mistake in a different costume.

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

**⚠ V-10 … V-17 describe the RETIRED Signal palette and are kept for the record only.** The accent
they measure was replaced on 2026-08-06 (§3.6). They are not deleted because V-10's hue scan is the
evidence that *no* usable hue existed, which is half the argument for going monochrome — and because
V-13 and V-17 are the measurements that condemned the orb field. The **live** accent and background
runs are §9.2.2.

#### 9.2.2 The monochrome accent and the rebuilt field, 2026-08-06

Run by `npm run validate:palette`, which now executes `calibrate` **and** `mono` by default, so the
§9.2.1 calibration block above still gates every run before any new figure is reported. Result line:
**`PASS — every floor cleared, both themes, no residual CVD failure.`**

| ID | Palette | Mode | Result |
|---|---|---|---|
| **V-18** | **Monochrome accent aliases** (§3.6.3), 10 tokens | light | **PASS.** `--accent-ink` `#08090C` **19.91 / 18.75 / 17.61** on raised / canvas / sunken (floor 4.5) · `--accent-mark` the same figures (floor 3.0) · `--accent-on` on `--accent-fill` **19.91** · on `--accent-fill-hover` `#33373E` **11.95** · `--accent-ink-strong` `#000000` **21.00** on raised · `--accent-wash` `#E4E7ED` vs raised **1.24** (visible field, floor 1.10) · `--accent-wash-ink` on wash **16.07** · `--ink-primary` on wash **13.48** · `--ink-secondary` on wash **5.86** |
| **V-18** | Monochrome accent aliases (§3.6.3) | dark | **PASS.** `--accent-ink` `#FFFFFF` **17.06 / 19.15 / 19.91** · `--accent-mark` the same · `--accent-on` `#08090C` on `--accent-fill` **19.91** · on `--accent-fill-hover` `#C6CAD2` **12.12** · `--accent-wash` `#2C2F35` vs raised **1.27** · wash-ink on wash **13.42** · `--ink-primary` on wash **12.49** · `--ink-secondary` **6.59** |
| **V-19** | **Achromatic double focus ring over an accent fill** (§3.5.1) | both | **PASS, and it is the doubling that passes.** Outer `--ink-primary` ring vs `--accent-fill`: **1.19:1** light / **1.07:1** dark — effectively invisible. Inner `--surface-raised` separator ring: **19.91:1** / **17.06:1**. Better of the two, floor 3.0 — PASS. Outer ring on its outward side vs `--surface-canvas`: 15.72 / 17.84 |
| **V-20** | **The accent is achromatic**, and separated from every reserved colour | both | **PASS, with no residuals.** OkLCh chroma **0.0069** light / **0.0000** dark, against an enforced ceiling of 0.02. `--accent-ink` ↔ 7 reserved semantics: min normal ΔE **28.37** light / **28.11** dark, min CVD ΔE **24.96** / **15.05** (floors 15 / 8). `--accent-mark` ↔ 12 brand colours: min normal ΔE **40.23** / **20.03**, min CVD ΔE **29.41** (Ferrari) / **14.87** (Mercedes). **CR-007's seven CVD residuals are all eliminated** — its worst was 0.46 protanopic |
| **V-21** | **The rebuilt background field** (§7.7) — the luminance corridor, solved rather than tuned | light | **PASS, IN CORRIDOR at both intensities.** Corridor: field relative luminance must stay **≥ 0.8707** (the tighter of `--border-control` at 3:1 → 0.8707 and `--ink-tertiary` at 4.5:1 → 0.8618); canvas is 0.9387. `hero` (veil 0.18): centre **0.9387**, deepest vignette corner **0.8797** → ink-tertiary 4.59, border-control 3.03. `calm` (veil 0.66): centre 0.9387, corner 0.9132. Vignette therefore capped at **`rgb(27 30 36 / 0.04)`** — which lands the corner at almost exactly `--surface-sunken`, i.e. the field's own darkest point is a step the system already owns |
| **V-21** | The rebuilt background field (§7.7) | dark | **PASS, IN CORRIDOR at both intensities.** Corridor: luminance must stay **≤ 0.0125** (`--border-control`), and **≤ 0.0115** (`--surface-raised`) or the elevation model inverts and a card reads as a hole. `hero`: centre **0.0052**, corner **0.0019** → ink-tertiary 5.11–5.46, border-control 3.20–3.42. `calm`: 0.0048 / 0.0034. Vignette **`rgb(0 0 0 / 0.72)`** — dark mode can darken freely, which is why its depth is far more dramatic than light mode's, by measurement rather than by preference |
| **V-21a** | **`mix-blend-mode: overlay` modelled properly** — a correction to this validator, not to a colour | both | The first monochrome run modelled the grain tile as a straight-alpha tint at its own opacity and it consumed the **entire** light-mode luminance budget on its own, forcing the vignette down to 0.02. That was a modelling error: `overlay` is `multiply` on a dark backdrop and `screen` on a light one, and the tile is achromatic `feTurbulence` with a mean near 0.5, so it returns almost exactly the backdrop. Measured excursion at the field centre — light: darkest pixel, mean and lightest all round to **`#F7F8FB`**; dark: **`#0D0E12` / `#0E0F13` / `#0F1014`**. **Grain adds texture and moves the mean luminance by nothing.** Every V-21 figure is reported at the worst grain pixel for that theme's ink |
| **V-21b** | Dot lattice, recorded for the record — decorative, no floor (§3.5) | both | light: minor dot `#DADCDF` **1.29:1** vs canvas, major dot `#C7C8CC` **1.57:1**, lit dot (under the pointer lamp) `#939497` **2.86:1**. dark: `#2C2D31` **1.39**, `#45474A` **2.06**, lit `#737476` **4.09**. Comparable to `--border-subtle` (1.32 / 1.33), i.e. perceptible and recessive — and the lamp roughly doubles it, which is the whole effect |
| **V-22** | **Glass header / dock over the rebuilt field** (§5.2b) | both | **PASS.** Light composite `#FCFCFD` (field centre) / `#F8F8F9` (vignette corner): `--ink-primary` 16.28 / 15.73 · `--ink-tertiary` **5.05 / 4.88** (floor 4.5) · `--border-control` **3.34 / 3.22** (floor 3.0) · `--accent-ink` 19.42 / 18.76. Dark `#191A1E` / `#16181B`: 16.19 / 16.56 · **4.96 / 5.07** · **3.11 / 3.18** · 17.39 / 17.79. **Every figure improved on V-12's**, because the orb that tinted the composite is gone |

**Verdict on the monochrome palette: ACCEPTED, unconditionally.** Every contrast floor passes in both
themes, every separation floor passes, the background field is inside a corridor solved from the
tokens' own floors rather than chosen, and — unlike every previous palette in this document —
**there is not one residual CVD failure to mitigate.**

**Still to validate in F1:** ~~the derived per-theme chart-safe brand variants (§3.3 rule 6), the
deterministic fallback ramp for the 202 colourless teams (§3.1), and the collision-detection
thresholds (§3.3 rule 4)~~ — **all three closed by §9.2.3 below, 2026-08-07.** _The old constraint that
the fallback ramp must exclude the Signal hue band (h 340–360) is **withdrawn** — there is no Signal
hue any more. The replacement constraint is that a fallback ramp entry must clear OkLCh chroma
**0.05**, so a colourless team is never painted something that reads as the achromatic interface
accent._

#### 9.2.3 The entity palette — the ramp, the brand variants, the teammate pair, 2026-08-07

Run: `npm run validate:palette` → V-23 … V-28, after the V-1 calibration block passes. Gates the
entity colour layer of §3.3a and §6.4a; every figure in `src/styles/entity.css` is emitted by the same
script (`… tokens`) from the same search, so the record and the stylesheet cannot part company.

| Ref | What | Result |
|---|---|---|
| **V-23** | **Ramp search** — the pool under the per-entry gates | **158 admissible of 360** (hue, tier) candidates at 6° × 6 tiers. Rejected: **174** inside a reserved timing hue band (yellow 92 ± 30, green 148 ± 30, purple 305 ± 30), **20** with no in-gamut solution clearing C ≥ 0.05 and 3:1 on raised **and** sunken, **8** within ΔE 15 of a timing ink, **0** within ΔE 15 of chart furniture. **Tier A = 6, tier B = +6, total N = 12** |
| **V-24** | **Pairwise separation inside the ramp** (worse theme, worse CVD model) | **Tier A alone: min normal ΔE 21.87** (floor 15) **PASS**, **min CVD ΔE 9.12** (floor 8) **PASS**. **All 12: min normal ΔE 15.23 PASS**; min CVD ΔE 0.35 **REPORTED, ladder-carried** — **14 of 66 pairs** below CVD 8, which is precisely §6.4's remit. **No near-misses exist by construction**: two entities are the same slot or ≥ 15 apart |
| **V-25** | Ramp vs the reserved sets and the chart furniture | vs **timing ink** min normal ΔE **17.02** (floor 15) **PASS** · vs **chart furniture** min normal ΔE **19.40** (floor 15) **PASS** · vs **status ink** min normal ΔE 3.67 **REPORTED**, per §3.4.3's own posture: the status set fails CVD 7.5 against *itself* (`caution ↔ critical`), which is why a status colour never appears without an icon and a label, so it is not a floor a series colour can be held to |
| **V-26** | **Brand chart variants** (§3.3 rule 6) — hue and chroma held, lightness moved the minimum distance into band | **PASS** for all 10 chromatic brands, both themes, ≥ 3:1 on raised and sunken. Largest lightness move: **Mercedes light, L 0.786 → 0.624 (ΔL 0.162)**. Haas and Cadillac get **no variant**: OkLCh C 0.0056 / 0.0043, below the floor. **The ramp is deliberately NOT gated against these variants** — the brand set does not clear ΔE 15 against *itself* (min **4.71**, RB ↔ Red Bull; **8 of 45 pairs** below 15), and gating it was measured to cost the ramp two thirds of its size (N 6 → 3, below the comparison cap of 4). Cross-source worst case, ramp ↔ brand variant: normal ΔE **2.36** (ramp #11 ↔ Mercedes) — **REPORTED, ladder-carried** |
| **V-27 G-27a** | **Teammate shade pair** — the chosen pair clears both floors wherever two admissible shades exist | **PASS. 43 pairs.** Worst normal ΔE **17.27** (Sauber dark, floor 15) · worst CVD ΔE **14.18** (Sauber dark, floor 8) — **1.15× and 1.77× the floors**. This is the gate the previous construction failed at **13.63**; the fix was the construction, not the floor |
| **V-27** | **Ladder ceiling** — how many mutually separated shades one hue can supply | **REPORTED: light mode max 2, dark mode max 3.** Light sets the cap because its band's usable top is cut by the 3:1-against-white requirement. Dark's third shade is **unusable** — a colour assignment whose count changed with the theme would be incoherent. So the pair is **capped at 2** and beyond two drivers of one team colour is exhausted outright (§6.4a property 4) |
| **V-27 G-27b** | Every ramp entry is shade-pair-available in **both** themes | **PASS — 24 of 24 theme-slots paired.** Gated rather than reported because the ramp's hues are this design's own choice: **41 of the 60 hues** on the wheel are splittable, so shipping an unsplittable entry would be a self-inflicted limitation rather than a fact of the sport |
| **V-27 G-27c** | Every shade independently clears the full plotting gate set | **PASS.** chroma **0.057** (floor 0.05) · contrast **3.00:1** (floor 3.0) · vs timing ink ΔE **15.08** (floor 15, worst = Aston Martin dark `#79E4B9` ↔ green) · vs chart furniture ΔE **16.46** (floor 15). vs status ink ΔE 2.24 **REPORTED**, per V-25's reasoning. *Construction claims are exactly what rots, which is why these are asserted rather than assumed from how the shades were built* |
| **V-27 G-27e** | The pair is an **entity** property, not a per-theme one | **PASS — 0 entities ship lopsided.** The raw search splits **Sauber in dark only**; `pairBothThemes()` withholds it from both. **Found by `entity.css.test.ts`, not reasoned out in advance.** Emitting per-theme availability would mean a reader watched the *encoding* change at sunset |
| **V-27 G-27d** | **Attribution** — every impossibility must be caused by something we did not choose | **PASS — 1 of 1 attributable.** **Sauber light: exactly ONE admissible shade** (`#03A20C`, ΔE 15.13 from `--timing-green-ink`). Of 161 candidate lightnesses, **109 blocked by a timing ink**, 51 by contrast, 0 by chroma, 0 by furniture. With the timing gate lifted the pair reaches normal ΔE 25.75 / CVD 24.19 — so the cause is the **reserved timing convention**, which F1 fixed and this product cannot move. A pair lost to a contrast or gamut limit would be **our** defect and fails this gate |
| **V-28** | **Identity swatch** — every ramp entry as a 10×10 chip and a 3px accent bar | **PASS. Worst 3.05:1** (slot #10 on light sunken, floor 3.0). Worth stating plainly: **6 of the 12 brand colours fail this in light mode** (§9.2 V-8) and **every ramp entry clears it on all three surfaces in both themes** — so a colourless team needs no identity-form workaround at all, which is a strictly better position than the branded teams are in |

**Verdict: ACCEPTED.** No floor was moved. The one impossibility is measured, attributed to a
constraint outside this product's gift, and answered with a **non-colour** channel that is mandatory
for every team rather than a special case for the unlucky one.

**The finding worth carrying forward.** Sauber's brand hue is 143 — inside the reserved green band —
and in light mode a two-shade split is not merely tight but *impossible*. That is why §6.4a does not
treat colour as the teammate channel at all. The general form of the lesson: **a floor that a reserved
set cannot meet against itself cannot be imposed on everything that must coexist with it.** This
document now applies that same argument in four places — §3.4.2 (timing hues), §3.4.3 (status),
V-26 (brand variants) and V-27 G-27d — and it is the same argument each time.

#### 9.2.4 The collision table and the ramp hash — the chart kit's two build-time facts, 2026-08-07

Emitted by `node scripts/validate-palette.mjs entity-data` into `src/lib/entityColorData.ts`, and
diffed against a fresh run by `scripts/entity-tokens.test.mjs`. **No colour crosses into the client:
the emitted file contains no hex value, asserted.** See §6.4 for why this is precomputed rather than
measured in the browser.

**The collision table.** 64 plotting tokens — 10 brand `-plot`, 9 brand shade pairs, 12 ramp `-plot`
and 12 ramp shade pairs. Every unordered pair measured in **both** themes, normal-vision CIEDE2000
and the worse of the two CVD models, with the worse theme taken.

| Set | Colliding | Reading |
|---|---|---|
| Whole token universe | **663 / 2016** (32.9%) | The palette is dense in shade variants, and shades of nearby hues meet. This is the number the ladder exists for. |
| The 2026 grid's 12 plotting colours | **31 / 66** | About half of all real two-team comparisons reach the ladder. Red Bull ↔ Williams and Ferrari ↔ McLaren are both in it. |
| The 12 ramp base slots | **14 / 66** | **Exactly the 14 CVD pairs §3.3a.2 said tier B hands to the ladder.** The two sections agree without either being written from the other. |
| Ramp tier A | **0 / 15** | The tier A guarantee, confirmed against the shipped tokens rather than trusted from the search. |

**The ramp hash.** FNV-1a 32-bit over `team.reference`, slot = `1 + (h mod 12)`. Run against the
**live 214-team list** (`select reference from team`):

| Slot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Teams | 18 | 10 | 19 | 19 | 18 | 19 | 10 | 23 | 16 | 15 | 24 | 23 |

Expected 17.83 per slot; **χ² = 12.88 against a 19.68 critical value at 11 df, α = 0.05** — consistent
with uniform, so no slot is over-subscribed and the §3.3a.2 collision-rate arithmetic holds in
practice and not only in principle. `entityColor.test.ts` pins eight real references, so a future
"improved" hash repaints nothing silently.

**The validator lives at `scripts/validate-palette.mjs`, run by `npm run validate:palette`.** It is
pure arithmetic, needs no dependency, and **self-calibrates against the pre-CR-007 recorded figures on
every run** (§9.2.1), so a regression in the validator itself is caught rather than silently trusted.
It exits non-zero when any floor fails, so it is usable as a gate and not only as a report.

#### 9.2.5 Identity swatches against the reserved timing set — reported, not gated, 2026-08-07

Raised on Rishabh's review of the season hub: Mercedes' teal identity chip looked close to the
reserved timing green. **Measured rather than argued**, and the measurement disagreed with the hunch.

```
node scripts/validate-palette.mjs check \
  'mercedes-brand=#00D7B6,sauber-brand=#00E700,timing-green=#087B30,timing-purple=#9E08F6,timing-yellow=#6A5606'
node scripts/validate-palette.mjs check \
  'mercedes-brand=#00D7B6,sauber-brand=#00E700,timing-green=#47FF79,timing-purple=#BB79FD,timing-yellow=#EABF17' --dark
```

| V | Pair | normal ΔE | worst CVD ΔE | Verdict |
|---|---|---|---|---|
| **V-31** | Mercedes ↔ timing green, **light** | 31.53 | 23.29 | clear of both floors |
| **V-32** | Mercedes ↔ timing green, **dark** | 19.39 | **7.60** | below the CVD floor of 8 |
| **V-33** | Mercedes ↔ timing purple / yellow, both themes | ≥ 39.07 | ≥ 21.97 | clear |
| **V-34** | Sauber ↔ timing green, **light** | 32.52 | 26.43 | clear |
| **V-35** | Sauber ↔ timing green, **dark** | **8.75** | **5.85** | below **both** floors |
| **V-36** | Sauber ↔ timing yellow, **dark** | 32.66 | **2.25** | below the CVD floor |

**Sauber is the worst case by a wide margin, not Mercedes.** V-35 and V-36 are the two real ones, and
both are dark-mode-only — a consequence of the dark timing set being lifted into the same high-
lightness band the brand teals and greens already occupy.

**Not gated, deliberately** — §3.3a.5 gives the reasoning and the three form-level rules that carry
the separation instead. Recorded here so the figures are on file rather than rediscovered, and so a
future proposal to "fix" a brand colour meets the decision rather than the surprise.

**These are identity tokens.** Every **plotting** token is already gated against the three timing
inks at ΔE ≥ 15 / CVD ≥ 8 as a HARD check (§9.1 item 3) — which is exactly why Sauber has no
admissible shade pair in light mode (§9.2.3 G-27d). Nothing in this entry weakens that.

---

## 10. Theming mechanics

- Tokens are **CSS custom properties** on `:root`, overridden under `[data-theme="dark"]`, so
  Tailwind and the SVG chart kit read the same values (`ARCHITECTURE.md` §2). _Corrected 2026-08-07:
  this line named Recharts and visx, both rejected by `ARCHITECTURE.md` §10 #28._ SVG presentation
  attributes are CSS properties, so `stroke: var(--ramp-3-plot)` re-resolves on a theme switch with
  no re-render and no JS colour table — see §6.
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
| 2026-08-06 | **The five changes Rishabh asked for after running the CR-007 build.** (a) **§3.6 rewritten: the accent is monochrome** — the pole of the neutral scale, `#08090C` light / `#FFFFFF` dark. The eleven-step `--signal-*` hue-350 ramp is **deleted from the product**; the aliases are declared directly as hexes. Emphasis moved to inversion, absolute contrast, typographic weight and motion, and **every accent mark gained 3.6–5.5× separation** from its background (§9.2.2 V-18). Two CR-007 placements could not survive an achromatic accent and were re-specified rather than kept, because near-black beside `--ink-primary` is ΔE ≈ 5: the wordmark's `1` became an inverted `F1` badge, and the landing headline's final word became a 2–3px outline behind an `@supports (-webkit-text-stroke)` guard. **V-10 … V-17 are retained for the record but describe a retired palette.** (b) **§7.7 rebuilt.** The three gradient orbs, the 48px grid and the contrast plate are gone; a 22px two-density dot lattice, a **pointer lamp** that hardens the dots under the cursor, a vignette and a single attenuation veil replace them. Every alpha is bounded by a **luminance corridor solved from the tokens' own floors** (V-21), which is also why the two themes' fields are different shapes rather than inversions. Corrects a **validator modelling error**: `mix-blend-mode: overlay` was modelled as a straight-alpha tint and consumed the entire light-mode budget on its own (V-21a). **G-19 retired**; **G-21 repurposed** from orb parallax to the lamp. There is now **no `filter` anywhere** in `backdrop.css`, asserted. (c) **§7.8 rewritten.** Three definite dock faults fixed — labels that clipped mid-word because nothing hid `.dock-label`, a glyph 8px off-centre because `padding-left: 22px` forgot the rail's own padding while its comment claimed otherwise, and an accidental vertical geometry — plus one that could not be reproduced, whose mechanism was removed rather than trusted twice: hover and focus are now `:hover` / `:focus-within` in CSS. The active item became an **inverted pill**. (d) **§7.3 respecified.** The coverage chip was never broken; it was undiscoverable. It gains a noun, a completeness meter in `CoverageRuler`'s language, a `--border-control` boundary and a disclosure chevron, and its skeleton became the chip's own box. (e) **§4.6 G-7 rewritten, G-8 retired, G-25 / G-26 added**, and **§4.6.1 added** — a per-component motion table, which is the reconciliation of the `y: -1` / `-2` / 2px-shipped conflict the brief flagged. §3.5.2's three stacked interactive-expression tables collapsed to one. **§9.2.2: V-18 … V-22 recorded, all PASS, and for the first time in this document with no residual CVD failure at all** | designer |
| 2026-08-06 | **The rail again — *"the menu bar is still broken … please fix that side bar, its really broken."*** Three further faults, **all consequences of the full-height geometry the previous entry introduced**, all found by reading a screenshot of the built shell and each now expressed as arithmetic over tokens so a unit test can hold it (jsdom performs no layout, so none of the three is otherwise testable). (a) **Fault 4 — the rail painted over the header and hid the wordmark**: `top: --size-dock-inset` put it 16px from the viewport top, inside the 56px header band, at `--z-dock` 40 over `--z-header` 30, so the header read "ANALYTICS" collapsed and nothing expanded. `top` is now `calc(--size-header + --size-dock-inset)`. **New §7.8.3** records the resolution that was rejected — a full-height rail with the header padded left — and why it cannot hold: the rail expands to 248px, so any fixed header padding loses the wordmark the moment the rail opens. A z-index swap is not a third option; it trades a hidden wordmark for a clipped destination. (b) **Fault 5 — every collapsed glyph sat at an x set by the length of its own hidden label.** `flex: none` on an item inside a `justify-content: center` slot sized the box by `max-content`, and an `opacity: 0` label paints nothing but **lays out fully**. Two silent consequences: expanded, the seven destinations sat at x ≈ 105 while the pin sat correctly at 49; and the G-3 indicator was underneath the overflowing pill, i.e. `--accent-mark` on `--accent-fill`, invisible. Fixed by `width: 100%` + `min-width: 0`, and the centring divisor becomes the new **`--size-dock-lane` (46, not 48)** — `border-box` takes the dock's own two borders out of `--size-dock` as well as its padding, so the previous divisor was 2px wide even before the label sizing. **New tokens: `--size-dock-hairline`, `--size-dock-lane`**; `--size-dock-item`'s description corrected, and the test that asserted `--size-dock − 2 × pad === --size-dock-item` — a **passing assertion of a false invariant** — inverted rather than deleted. (c) **Fault 6 — the collapsed pin read as an empty box**: contrast was not the cause (~8.6:1 dark, ~7.4:1 light), ink *area* was, so the box gains a resting `--border-subtle` inset ring and a `--accent-wash` pressed state, deliberately not the active pill's inversion. **No colour token changed → §9's recorded figures stand; `validate:palette` re-run anyway and PASS.** CSS 9.75 → **9.83 KB gzipped** | designer |
| 2026-08-04 | **CR-005** (`PLAN.md` §5.5): the upstream-attribution constraint is removed from §7.3 as a forward obligation — both the release-blocker framing and the derived clause in the ban list. The §7.3 ban on refresh/update language is **retained on independent grounds** (`REQUIREMENTS.md` §2.2 — a currency surface must not assume today's calendar position). **No copy string changed**: the coverage phrasing survives on its own merits. No token, colour, typography, motion or component change → no §9 validation run | designer |
| 2026-08-07 | **The entity colour layer, the chart language and chart motion — F1's three open colour/chart items closed.** (a) **New §3.3a: entity colour encoding.** The ramp is stated as **94% of the data**, not a fallback — 214 teams, 12 with a `primary_color`. Three roles are separated and named (`--team-<ref>` identity, `--*-plot`, `--*-plot-deep`/`-bright`); the ramp is **12 slots in two tiers of guarantee** with the collision-rate arithmetic (0.278 at N = 6 → 0.573 at N = 12); assignment is a stable hash of `team.reference`, never rank; **Haas and Cadillac get identity and no plotting colour** because their OkLCh chroma is 0.0056 / 0.0043 and a grey series is confusable with this product's achromatic chart furniture. §3.3 rules 4–6 move from "specified in F1" to specified. **CR-004's logo slot is designed and its block is stated**: `public/assets/teams/<reference>.svg`, monochrome-capable, **R2, Rishabh's, undelivered**, with the ladder differentiator as a sufficient interim rather than a placeholder box. (b) **`src/styles/entity.css` is generated, not authored** — `node scripts/validate-palette.mjs tokens`, with `scripts/entity-tokens.test.mjs` diffing the emitter against the file and `src/styles/entity.css.test.ts` asserting the 16 things a stylesheet can be wrong about while still looking fine. The ramp search is extracted into `selectRamp()` so the validator and the emitter cannot disagree. (c) **§6 rewritten.** The Recharts + visx premise is **superseded** (`ARCHITECTURE.md` §10 #28): **d3 primitives plus an in-repo kit**, with the five packages the kit needs and the four it must not use named, and every colour a `var()` so a theme switch needs no re-render. New: **§6.3** the chart furniture with tick-density rules as arithmetic, one axis line not two, and the inverted position axis; **§6.4** the collision ladder — four rungs, all non-colour, assigned by identity and never withdrawn; **§6.4a** the teammate treatment; **§6.5** the five plot-area states with real copy, small multiples as the scope→form rule, the table view's exact location, and the patterns/print affordance; **§6.6** the per-chart queue with each chart's primitives. Whether the kit lands in F1 or F2 is **⚑ flagged for Rishabh**. (d) **§4.6.2: G-27 … G-30**, replacing a one-line forward reference. Axis-anchored bar growth; a **single-tween left-to-right reveal via a `scaleX` transform on a `userSpaceOnUse` clip rect** — the previously specified `strokeDasharray` draw is **withdrawn**, because it reveals at constant arc speed and so reports gradient rather than time, needs `getTotalLength()` per path, and would need a second exception to §4.2; **G-29 makes "no motion on data update" a citable named entry**; **G-30 states that a readout snaps and never follows** — `m.pointer`'s 600ms catch-up is for decoration, and a lagging crosshair misreports which lap the reader is pointing at. (e) **§4.3 drift corrected against `src/lib/motion/tokens.ts`**: `stagger.bar`, the whole `dist` table and the whole `gesture` table existed in code and were missing from a section that claims to define the set once; the `stagger.cap`-as-`amount` mechanism is now stated; and **four references to `src/lib/motion.ts`, a path that has never existed**, are corrected. (f) **§9.2.3 records V-23 … V-28.** **No floor was moved.** The teammate split's 13.63 failure was fixed by rebuilding the construction — a **symmetric shade pair** at two admissible shades of one hue, replacing an anchor-plus-derivative that could not reach the floor from mid-band — reaching worst-case **normal ΔE 17.27 / CVD 14.18** against floors of 15 / 8. **The measurement that changed the design: Sauber's brand hue 143 sits inside the reserved green band and in light mode exactly ONE lightness in the whole plotting band clears ΔE 15 from `--timing-green-ink` (109 of 161 candidates blocked by it), so a two-shade split is impossible.** Colour is therefore **not** the teammate channel: marker, dash and direct label are mandatory for every team, and the shade pair is a redundant fourth channel. G-27e — that the pair is an entity property and not a per-theme one — was **found by a test, not by reasoning**: Sauber had a dark pair and no light one, which would have changed the *encoding* at sunset, and the dark pair is now deliberately discarded. `vite.config.ts` gains `entity.css` in `test.css.include`; without it vitest blanks the import **silently, even for `?raw`**, and 14 of 16 assertions passed against `''`. **Measured cost: render-blocking CSS 9.79 → 10.86 KB gzipped, 43.4% of the 25 KB budget** — the entity layer's 144 declarations cost **1.07 KB**. Initial JS unchanged at 160.25 / 250 KB; no dependency was added, because the layer is CSS and the emitter is a dev-time script. Suite 339 → **358 tests**, 3 consecutive green runs | designer |
| 2026-08-07 | **F2 — the chart kit and `entityColor.ts` built.** (a) **§3.3a.3 closed**: `src/lib/entityColor.ts` exists, the hash is **FNV-1a 32-bit** over `team.reference`, and **the only field it needs from the data layer is `reference`** — whether a plotting variant exists is a property of our generated palette, not of the row, so no selector carries it and the two cannot disagree. Haas → ramp 3, Cadillac → ramp 7: the ΔE 3.8 pair that started §3.2 is separated by construction, asserted. (b) **§6.4 — two corrections, both changing what ships.** A pair now collides if it collides in **either** theme, because measuring in the theme in force would let a sunset withdraw a dash pattern — the thing §6.4a property 3 already forbids for the shade pair. And the detection is **precomputed** into `src/lib/entityColorData.ts` by a new `validate-palette.mjs entity-data` mode: the palette is a closed set of 64 tokens, so shipping CIEDE2000 plus two CVD models plus a `getComputedStyle` read into a chart component bought nothing and would have been **untestable**, since jsdom resolves no custom properties and every ladder assertion would have passed against `''`. **No colour crosses into the client**, asserted. (c) **§6.4 — the ladder fires chart-wide.** Escalation stays pairwise; application does not, because two of four series carrying a marker shape reads as an accident. Consequence stated: at ≤4 series rung 2 alone separates every pair, so rung 3 only ever fires for a **teammate** comparison. (d) **§6.4a — two teammate pairs on one chart.** Read literally, "circle and square in driver order" gives the second team's pair the same shape *and* dash as the first, leaving colour as the only separator. The rule is restated on **indices**: a team keeps the set of rung indices its members hold and redistributes them by `reference` ascending. (e) **§6.4 rung 3 — the dash rule was wrong.** "Dash lengths ≥ 2× stroke width" fails on its own `2 3` pattern; the binding property is the **period**, and `2 3` renders as a dotted line, the most distinguishable of the three. Values kept, rule fixed, test asserts the period. (f) **§6.3 — two additions**: markers are equal **area** across all four shapes (a square and a circle of the same width differ ~27% to the eye, which encodes magnitude on an identity channel), and 1px strokes sit on half-pixel coordinates or a "1px" gridline rasterises as a 2px smear. (g) **§6 — the kit is built** and its module inventory recorded: `geometry.ts` (pure, and where layout is *tested*, because jsdom performs none), `ladder.ts`, `Axis.tsx`, `ChartFrame.tsx` (**one measure axis, so a dual-axis chart is not expressible**), `ChartLegend`, `ChartTable`, `MarkerGlyph`, `LineChart`, `BarChart`, `useChartSize`; motion in `src/lib/motion/chart.ts`. Built against **fixture shapes, not an endpoint's**. (h) **§9.2.4 records the two build-time facts**: 663 of 2016 token pairs collide, **31 of 66** among the 2026 grid — about half of all real two-team comparisons reach the ladder — and **14 of 66** among the ramp base slots, which is exactly the 14 CVD pairs §3.3a.2 independently said tier B hands over. Tier A: 0 of 15. Hash distribution over the live 214 teams: **χ² 12.88 against 19.68 at 11 df**, consistent with uniform. **Measured cost: render-blocking CSS 10.86 → 12.09 KB gzipped, 48.4% of 25 KB** — the chart stylesheet costs 1.23 KB. **Initial JS unchanged at 160.27 / 250 KB, because no route imports the kit yet**; measured standalone with esbuild + Node zlib L9 it is **18.2 KB gzipped marginal** over the GSAP already in the bundle, d3 subset included. Suite: **106 tests added by this work** — entityColor 25, ladder 19, geometry 30, chart motion 8, the two charts 21, the emitter drift 3 — inside a suite that reads **629 passing across 44 files** with the season data layer landing in parallel. 3 consecutive green runs. **Untested by construction and named as such: everything about where a mark, axis, label or reveal actually lands** — jsdom has no layout, no `ResizeObserver` and no `getBBox` | designer |
| 2026-08-08 | **F4 / F5 / F6 — the three entity pages, specified and built.** (a) **New §6.6.2**, and the three pages are specified in **one** section on purpose: the largest risk in shipping driver, team and circuit together is three pages that look like three products, so they share a masthead, a career strip, a stat grid, a season table and a chart language, and every difference between them is one the *data* forces. (b) **Two rows of §6.6.2.2 were wrong when written and the engineer's measurements corrected them the same day, recorded rather than edited silently.** **Poles** was derived from `grid = 1` on the clean-sounding reasoning that the grid exists from 1950 while qualifying begins in 1994 — measured, **9 races carry more than one `grid = 1` row** and 1952 R8 has two *different* cars there, so a grid slot is not a qualifying result and is not reliably one car; poles come from the qualifying classification, which is 1994+ and **holed** (15/16 rounds in 1994, then **7, 10, 7, 3, 4, 1, 2** of ~16 across 1996–2002, complete from 2003). **Fastest laps** said 2004+, quoting `REQUIREMENTS.md` §5.1; the flag is also on **every race of 1958 and 1959**, so no single window expresses it. The fix is structural rather than a corrected year: **a coverage-limited count is a denominator with three states** — denominator `0` renders **`—`** (`0 poles` for Fangio is a false statement, not a low score), a partial denominator renders the figure **with a footnote marker**, a complete one renders the figure alone. (c) **No current age anywhere, and it is permanent rather than a gap**: the schema has **no date of death**, so an age against the clock would report Fangio at 114. `ageAtFirstRace` / `ageAtLastRace` instead, both clock-free. (d) **DR-4 and DR-5 are ONE chart with a segmented control** (§6.6.2.4). Two near-identical diverging bars would read as a rendering mistake; toggling makes the difference between them the thing you see, and the **1994 boundary is the disabled segment** carrying §7.4's sentence as *text beside the control* — never a `title`, which is unreachable by touch, unreachable by keyboard in most browsers and invisible in a screenshot. (e) **§6.6.2.7 rules the map question: there is no map.** A tile map is a third-party call on a request path (§7 S-1/DL-2, and the CSP does not whitelist it), a vector basemap costs more than the application, and **a track outline does not exist in the data at all** — `circuit` holds a name, a locality, a country and three numbers. **New §7.11 `CircuitLocator`** draws those three numbers on an equirectangular graticule, so the projection is the identity map and nothing is claimed the coordinates do not say. (f) **New §7.9 `CareerRibbon`** — the signature element, one cell per season across an entity's whole span, fill height = championship position **inverted** so P1 is tallest (§6.3's position-axis rule applied to a strip). **Three cell kinds that must never collapse into two**: `ranked`, `unranked` (contested, no position — 1950 has 59) and `absent` (a career's gap years are part of the career). `RIBBON_FILL_FLOOR` **0.12** exists so "finished last" and "did not race" cannot become the same mark, which is §1.0's failure by construction. Same component on all three pages with a different measure, which is the coherence lever. (g) **New §7.10 `EntityPortrait`, discharging §7.6** — the placeholder is the shipping form, since `abbreviation` covers 107 of 881 drivers; a **monogram**, never a derived three-letter code (§6.5.4a). (h) **New §6.6.3 `ShareChart`, the kit's fourth form** — composition, for CN-4. It **normalises rows itself** (a caller free to pre-normalise is free to ship a row summing to 0.9 and nothing on screen would look wrong) and a **zero-total row renders as one labelled band** rather than `NaN` widths, which is §1.0's collapse again. (i) **§6.6.2.9 — the seams §1.0a owed are built**: `RaceClassification` links all 22 entities it names (recorded as outstanding since F3), `SeasonStandings` links drivers, constructors and **both** teams of a two-team season, `RaceMasthead` links the circuit it names on all 1,173 race pages. The **calendar's winner is a principled exception** — the row is already a `<Link>`, and an anchor inside an anchor is invalid. (j) **Two defects found by tests rather than by reading**: `StatTiles` tied the footnote marker to the *absence* rather than to the note, so a partial figure rendered as a bare complete-looking number; and a ribbon test asserted a one-season P12 career should fill its strip, where the code was right. **Measured cost: initial JS 197 → 209.15 KB / 250 (83.7%), render-blocking CSS ~14.5 → 15.61 KB / 25 (62.4%)** — both figures include the engineer's data layer landing in the same session. **Palette re-validated: PASS, unchanged** — no colour token moved; the six new tokens are `--size-ribbon*` and `--size-portrait*`. Suite **1298 → 1678 tests across 78 files, 3 consecutive green runs**. **Untested by construction and named as such: every dimension, position and composition on all three pages** — jsdom performs no layout, so the ribbon's 72px track, the locator's on-screen projection, the share chart's segment widths and the diverging bars' geometry are unverified | designer |
| 2026-08-08 | **One defect on `/teams/ferrari`, and it was two.** (a) **Sixteen React `duplicate key` errors**, root cause reproduced rather than assumed: `SpanChart` keyed its gridlines and tick text by `tick.label`, and while the team payload is in flight the chart falls back to a `[0, 1]` domain which the team page's `String(Math.round(value))` formatter collapses to `0, 0, 0, 1, 1, 1` — eight warnings a render, sixteen under `StrictMode`. **The engineer's report attributed it to `ShareChart`; it is the sibling `SpanChart`, in its loading state.** Ticks are now keyed by index like every other axis in the kit, and **`geometry.dedupeTickLabels` removes the duplicate labels**, applied in `MeasureAxis` too — a key fix alone would have silenced React and left an axis drawing three ticks labelled `0`. `Axis.tsx` and `BarChart` were already index-keyed and so immune to the *key* collision; the duplicate *label* was latent in both. (b) **The overlapping driver codes are a separate layout defect**, and neither chart's fix touches the other: §6.3's growth rule was implemented only for a rotated `BarChart`, so `SpanChart` at Ferrari's 24 rows (**13.0px band step against a 14px line-height**) and `ShareChart` at its 77 seasons (**4.0px**) crushed every label. **New `geometry.bandPlotHeight`** serves all three and counts the 49px of axis chrome the bar chart's version omitted. (c) **`ChartFrameProps.plotHeight` is now applied as `min-height`**, which fixes a **latent oscillation** in `BarChart`: it grew only `if (count > labelCapacity(measured))`, growing satisfied that condition, the override was withdrawn and the plot fell back — a measurement-driven feedback loop with nothing to damp it. The figure is now a function of the row count and the labels alone. No token, colour, typography or motion change → **`validate:palette` re-run anyway: PASS, unchanged**. Suite **1678 → 1693 tests across 78 files**; the four new `SpanChart` assertions were **verified to fail against the pre-fix component** before being kept. **Untested by construction: that the grown plot renders legibly** — jsdom performs no layout, so the band-step property is asserted against the real `scaleBand` in `geometry.test.ts` and the on-screen result needs Rishabh's capture | designer |
