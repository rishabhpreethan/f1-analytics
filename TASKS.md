# Tasks

Rishabh's tracker. **A line moves to Done only when the work is finished _and pushed_.** Nothing else
gets written here — no specs, no findings, no discussion.

Status: `todo` · `doing` · `done`

---

## Now

_Nothing in flight._

## Next

| # | Task | Status | Pushed |
|---|---|---|---|
| 10 | F4 driver pages · F5 team pages · F6 circuits | todo | — |
| 11 | F7 compare — up to 4 entities across eras | todo | — |
| 12 | F8 records — cross-era leaderboards, normalised | todo | — |

## Waiting on Rishabh

| # | Task | Status |
|---|---|---|
| R1 | Driver images | todo |
| R2 | Team logos | todo |
| R3 | App icons / favicon (a typographic placeholder ships meanwhile) | todo |

## Blocked on Rishabh

| Item | Why |
|---|---|
| **CR-004 — team logos where brand colours collide** | Needs **R2**. The slot is fully specified: `public/assets/teams/<reference>.svg`, 1:1, ≥64 viewBox, **single monochrome-capable path**. Monochrome is not an aesthetic preference — the colliding case is exactly where colour cannot be trusted, so a full-colour logo would reintroduce the collision inside the mark meant to resolve it. |

---

## Done

| # | Task | Pushed |
|---|---|---|
| 1 | F0 foundation — server, data layer, `/api/meta`, routing, 285 tests | ✅ 2026-08-06 · `471c6a6` |
| 2 | F0 frontend — landing page, CommandDock, theme, GSAP motion | ✅ 2026-08-06 · `471c6a6` |
| 3 | Monochrome theme — accent at the neutral poles, no colour hue | ✅ 2026-08-06 · `471c6a6` |
| 4 | Background rebuilt — dot lattice + pointer lamp, CSS-composited | ✅ 2026-08-06 · `471c6a6` |
| 5 | Dock rail — header clearance, glyph lane, full-height geometry | ✅ 2026-08-06 · `471c6a6` |
| 6 | Coverage chip explains itself — noun, boundary, meter, chevron | ✅ 2026-08-06 · `471c6a6` |
| 7 | F1 design system — entity colour encoding, chart language, chart motion, palette validator, CI, enforced budgets | ✅ 2026-08-07 · `main` |
| 8 | F2 season hub — calendar, standings, championship progression; the chart kit and `entityColor` mounted for the first time | ✅ 2026-08-07 · `main` (`59cd4ac`) |
| 9 | F3 race page — classification (trap-16 shared drives), rank/lap/pit charts on the new d3 chart kit, pace degradation with inferred safety-car bands. **1298 tests** | ✅ 2026-08-08 · `main` (`341d7a5`) |
