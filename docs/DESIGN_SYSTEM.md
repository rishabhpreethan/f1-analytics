# Design System

**Status: HANDOVER — awaiting the `designer` agent to complete.**

This document is owned by the `designer`. What follows is the **verified factual foundation** plus
the **binding constraints**. Sections marked _TO BE COMPLETED_ are the designer's creative decisions
and must be filled before F1 (`feat/design-system`) can be marked Done.

Everything in §3 and §4 was **measured, not assumed** — do not re-litigate it, and do not soften it.

---

## 1. Design intent

_TO BE COMPLETED BY `designer`_

The product should feel like the sport: **technical, precise, fast, confident**. Data-dense without
being cold. Animation is purposeful — mechanical rather than playful, and never at the expense of
perceived speed.

**The overriding requirement is coherence.** One type scale, one spacing scale, one motion
vocabulary, one chart language. A page needing something new means the system gains a token — never
that a page gains an exception.

---

## 2. Typography — _TO BE COMPLETED BY `designer`_

Constraints (binding):

- **Maximum three families.** Fewer is better.
  - One **display/heading** family — condensed, technical, confident at large sizes
  - One **text** family — deliberately unremarkable, readable at 13–14px in dense tables
  - One **tabular-numeral** family for all figures in tables and charts
- **All numerals must be tabular-figure aligned.** Digits that change width in a leaderboard read as
  broken. This applies to lap times, gaps, points, positions — everywhere.
- **One modular scale**, defined once. No off-scale sizes anywhere in the product.
- Verify the chosen fonts exist and are licensed for web use — **search, do not assume**.

Record: families, weights, the scale with named steps, line heights, letter-spacing rules.

---

## 3. Colour — measured facts, binding

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
team, assigned by identity and never by rank.

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
   in `src/lib/teamColor.ts`. _Designer: specify the exact behaviour and thresholds._
5. **Teammate comparison always collides** — identical team colour — and is simultaneously the most
   valuable comparison in the product. Its differentiation treatment must be explicit, not emergent.
6. **Per-theme chart-safe variants.** Brand colours failing the lightness band need a derived
   plotting variant per theme (a darkened Mercedes for light mode, etc.). Brand colour for identity;
   derived variant for plotting. _Designer: derive and validate these._
7. **Validate anything new.** Run the validator; fix FAILs; record results here.

### 3.4 Reserved semantic colours — F1 timing convention, verified

| Meaning | Colour | Rule |
|---|---|---|
| **Session fastest** | Purple | Never reused for anything else |
| **Personal best** | Green | " |
| **Below personal best** | Yellow | " |

These are the strongest recognition cues available with F1 fans. Use them exactly, and never as
series colours. _Designer: pick the exact steps and validate against both surfaces._

Status colours (good / warning / serious / critical) are likewise reserved, distinct from the
categorical set, and always ship with an icon or label — never colour alone.

### 3.5 Surfaces, ink, borders — _TO BE COMPLETED BY `designer`_

Light and dark are **designed separately**, each validated against its own surface. Dark mode is
never an automatic inversion.

---

## 4. Motion — constraints binding, specifics to complete

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
| Stagger | `staggerChildren`, `delayChildren` | Leaderboards and grids revealing in order |
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

_TO BE COMPLETED BY `designer`:_ the named timing tokens, spring configurations, stagger intervals,
and the reduced-motion variant for each.

---

## 5. Spacing, layout, elevation — _TO BE COMPLETED BY `designer`_

One spacing scale. Grid and breakpoint definitions for 390 / 768 / 1440. Elevation used sparingly —
this is an instrument panel, not a card gallery.

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
- **Recessive grid and axes.** The data is the subject.
- **A table view exists for every chart** — accessibility, and the discharge of the contrast WARN
  in §3.2.

### 6.3 Per-chart specifications — _TO BE COMPLETED BY `designer`_

One entry per chart type in the product: championship progression, points gap, position chart,
lap-time trace, stint timeline, pace degradation, pit timeline, grid-vs-finish, comparison views,
records leaderboards.

---

## 7. Components — _TO BE COMPLETED BY `designer`_

Inventory with states (default / hover / focus / active / disabled / loading / empty).

Required by the plan: button, select, tabs, card, table (tabular numerals, virtualisable), badge,
chip, tooltip, skeleton, empty state, **no-coverage state**, driver avatar, team crest, compare tray,
season selector, metric picker, normalization notice.

### 7.1 The no-coverage state deserves real design attention

The most visible data limit in the product: **lap-by-lap data begins in 1996**, and 0 of 484 races
before 1990 have any. Pit data begins 2011; qualifying 1994.

This state will be seen often. It must **explain**, not apologise — telling the user what exists and
from when, and ideally offering the nearest year that does have the data. A blank chart is a defect.

### 7.2 Placeholders are permanent infrastructure

881 drivers and 214 teams will never all have images. The driver placeholder (code on a
team-coloured field) and the team monogram are shipping components with the same design care as
everything else — not stopgaps.

---

## 8. Accessibility — binding

- Contrast: text meets WCAG AA. Chart marks below 3:1 (see §3.2) carry visible labels or a table view.
- Identity is **never colour-alone** — legend plus direct labels.
- Full keyboard operation; visible focus everywhere; sensible tab order.
- All imagery has meaningful alt text; decorative imagery is hidden from assistive tech.
- Ordered headings; landmarks present.
- `prefers-reduced-motion` and `prefers-color-scheme` both honoured.

---

## 9. Validation record — _TO BE COMPLETED BY `designer`_

Record every palette validation run: the palette, the mode, the surface, and the pass/fail per check.
Re-run whenever a colour changes.

| Date | Palette | Mode | Result |
|---|---|---|---|
| 2026-08-04 | 2026 grid brand colours (11) | light | **FAIL** — normal-vision, CVD, chroma, lightness (§3.2) |
| 2026-08-04 | 2026 grid brand colours (11) | dark | **FAIL** — lightness (6), chroma, CVD, normal-vision (§3.2) |
