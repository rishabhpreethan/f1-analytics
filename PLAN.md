# F1 Analytics — Delivery Plan & Tracker

**Single source of truth for status.** The `orchestrator` maintains this file. No other agent writes
`✅ Done` or `Approved for merge`.

| Doc | Purpose |
|---|---|
| `REQUIREMENTS.md` | What the product must do; what the data cannot support |
| `docs/ARCHITECTURE.md` | Technical design, stack, layering, security posture |
| `docs/DATABASE.md` | Schema, canonical queries, the 14 data traps |
| `docs/DESIGN_SYSTEM.md` | Visual language, motion vocabulary, chart conventions |

---

## 1. What we are building

A Formula 1 analytics application an enthusiast returns to in order to *understand* the sport, not
merely look up results. Driver and team identity front and centre — real photos, real logos, real
team colours — with charts that are intuitive enough that comparison feels obvious rather than
configured.

**The product's centre of gravity is comparison**: driver vs driver, team vs team, over one season,
a range of seasons, or a whole career — with the sport's history normalized honestly so a 1958
season and a 2026 season can sit side by side without lying.

**Non-negotiables**
- React, TypeScript, heavy but purposeful animation via Framer Motion
- Accurate F1 team colours; F1 timing colour conventions in charts (purple = session fastest,
  green = personal best, yellow = below personal best)
- Read-only. No accounts, no writes, no third-party calls at runtime
- **Data provenance is never mentioned anywhere in this repository** (§2.4)

---

## 2. Ground rules

### 2.1 Setup

```bash
npm install
npx playwright install          # QA + designer browser automation
npm run dev                     # client + API
```

**The database is supplied separately.** `data/f1.db` (~66 MB) is gitignored and produced by a local
offline tooling step outside this repository. A fresh clone has no database; the app will not run
without it. **Owner: Rishabh** (task `R0`).

**Playwright MCP must be configured** — both the `qa` and `designer` agents depend on it. If it is
not registered, those agents must stop and report rather than working around it.

```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest
```

### 2.2 Branch strategy

- **One main feature = one feature branch.** Every commit for that feature goes to that branch.
- Naming: `feat/<slug>` exactly as listed in §4.
- Branch from an up-to-date `main`. Never commit directly to `main`.
- **Merge to `main` only with `orchestrator` approval**, after all gates pass.
- Squash or rebase at merge; keep `main` history readable.

### 2.3 The gate order

```
1. principal-engineer  → Technical Spec into this file
2. designer            → Design Spec into this file          (1 ‖ 2 may run in parallel)
3. developer           → implement on feat/<slug> + unit tests
4. designer            → Visual verification (Playwright MCP screenshots)
5. developer           → fix design findings                  (loop 4–5)
6. reviewer            → code review vs all canonical docs
7. reviewer            → security audit, S-1 … S-14
8. developer           → fix blocking findings                (loop 6–8)
9. qa                  → E2E suite via Playwright MCP
10. developer          → fix QA findings                      (loop 9–10)
11. orchestrator       → verify every gate → approve → merge
```

Design verification precedes code review deliberately: the reviewer should read code that is
visually settled, not code about to change.

### 2.4 Provenance silence — release blocker

Nothing about how the dataset was assembled may appear in code, comments, documentation, test names,
fixtures, commit messages, branch names, or PR text. The `reviewer` greps for this every PR
(`S-12`) and the `orchestrator` re-checks it at approval. Any hit blocks the merge.

The database and all raw seed artefacts are never committed.

### 2.5 Definition of Done

A feature is Done only when **all** hold:

- [ ] Every requirement ID in scope implemented, or deferred with a recorded reason
- [ ] Technical Spec and Design Spec both present in this file
- [ ] `DESIGN VERIFICATION: PASS`
- [ ] `CODE REVIEW: PASS`
- [ ] `SECURITY AUDIT: PASS` (S-1 … S-14 each with a verdict)
- [ ] `QA: PASS` with evidence
- [ ] Typecheck, lint, unit tests, build all clean
- [ ] Provenance grep clean; no database, `.env`, or seed artefact staged
- [ ] `orchestrator` approval recorded with a date

---

## 3. Master tracker

Status vocabulary: `Not started` · `Spec in progress` · `Design in progress` · `Ready for dev` ·
`In development` · `Design verification` · `In review` · `Security audit` ·
`Fixing findings` · `In QA` · `Awaiting approval` · `✅ Done`

| ID | Feature | Branch | Depends on | Status | Approved |
|---|---|---|---|---|---|
| R0 | Supply `data/f1.db` | — | — | Not started | — |
| R1 | Driver images | — | — | Not started | — |
| R2 | Team logos | — | — | Not started | — |
| F0 | Foundation & scaffold | `feat/foundation` | R0 | Not started | — |
| F1 | Design system | `feat/design-system` | F0 | Not started | — |
| F2 | Season hub | `feat/season-hub` | F1 | Not started | — |
| F3 | Race deep dive | `feat/race-deep-dive` | F1 | Not started | — |
| F4 | Driver profiles | `feat/driver-profiles` | F1, R1 | Not started | — |
| F5 | Team profiles | `feat/team-profiles` | F1, R2 | Not started | — |
| F6 | Circuits | `feat/circuits` | F1 | Not started | — |
| F7 | Comparison workspace | `feat/compare` | F4, F5 | Not started | — |
| F8 | Records & cross-era | `feat/records` | F1 | Not started | — |
| F9 | Search & navigation | `feat/search-nav` | F2–F6 | Not started | — |
| F10 | Accessibility & performance | `feat/polish` | F2–F9 | Not started | — |
| F11 | Release hardening | `feat/release-hardening` | F10 | Not started | — |

### Per-feature agent log

Filled in by the `orchestrator` as gates complete.

| ID | Spec | Design | Dev | Design verify | Review | Security | QA | Approved |
|---|---|---|---|---|---|---|---|---|
| F0 | | | | | | | | |
| F1 | | | | | | | | |
| F2 | | | | | | | | |
| F3 | | | | | | | | |
| F4 | | | | | | | | |
| F5 | | | | | | | | |
| F6 | | | | | | | | |
| F7 | | | | | | | | |
| F8 | | | | | | | | |
| F9 | | | | | | | | |
| F10 | | | | | | | | |
| F11 | | | | | | | | |

---

## 4. Features

Each section below is the working area for that feature. The `principal-engineer` writes
**Technical Spec**; the `designer` writes **Design Spec**; both remain in place as the record.

---

### R0 — Supply the database · **Owner: Rishabh**

`data/f1.db` (~66 MB) must be present before anything runs. Gitignored; produced by the offline
tooling step outside this repository.

**Done when:** the file exists locally and `npm run dev` serves data.

---

### R1 — Driver images · **Owner: Rishabh**

Headshots for drivers, at minimum the current grid, ideally all notable historical drivers.

| Property | Value |
|---|---|
| Path | `public/assets/drivers/<driver_reference>.webp` |
| Naming | the `driver.reference` slug exactly — `max_verstappen.webp` |
| Dimensions | 400×400 minimum, square, transparent or neutral background |
| Format | WebP, with a JPEG fallback if needed |

**Until supplied:** the app renders a designed placeholder (driver code on a team-coloured field).
The placeholder is permanent infrastructure, not a stopgap — 881 drivers will never all have photos.

**Licensing is Rishabh's call.** Agents must never fabricate, generate, or hotlink images.

---

### R2 — Team logos · **Owner: Rishabh**

| Property | Value |
|---|---|
| Path | `public/assets/teams/<team_reference>.svg` |
| Naming | the `team.reference` slug — `red_bull.svg` |
| Format | SVG preferred; WebP ≥256×256 acceptable |
| Variants | one that works on both light and dark surfaces |

**Until supplied:** designed monogram placeholder using the team's colour.
Only 12 of 214 teams have a brand colour in the data — historical teams use the design-system
fallback ramp.

---

### F0 — Foundation & scaffold · `feat/foundation`

**Goal:** a running skeleton with the full stack wired, one trivial end-to-end data path proving
client → API → SQLite works, and all quality gates enforced from commit one.

**Scope**
- Vite + React 19 + TypeScript (`strict`), Tailwind, path aliases
- Hono API server; `better-sqlite3` opened `readonly: true`
- The canonical views `v_entry` and `v_race` (`docs/DATABASE.md` §6.1)
- `GET /api/meta` — data vintage, latest completed round, season range — as the proving path
- TanStack Query provider; React Router with the route table from `ARCHITECTURE.md` §5
- Zod schema pattern established, types derived via `z.infer`
- Security headers, error handler with no leakage (`S-6`, `S-9`), per-IP rate limit (`S-13`)
- ESLint, Prettier, Vitest, `npm run dev` running client + API together
- App shell: header, nav, theme toggle, route outlet
- **Data-vintage indicator** (NV-9) — reads `/api/meta`

**Out of scope:** any analytical feature, any chart.

**Acceptance**
- `npm run dev` serves the app; `/api/meta` returns real values from the database
- Typecheck, lint, build, tests all clean
- Missing-database case produces a clear actionable error, not a stack trace
- Every route resolves (placeholders acceptable)
- Theme toggle persists; `prefers-color-scheme` respected on first load

**Technical Spec** — _pending `principal-engineer`_

**Design Spec** — _pending `designer`_

---

### F1 — Design system · `feat/design-system`

**Goal:** the visual and motion foundation everything else composes from. Nothing after this
feature invents a token, a duration, or a chart colour.

**Scope**
- `docs/DESIGN_SYSTEM.md` authored in full by the `designer`
- Typography: display, text, and tabular-numeral families; one modular scale; **max three families**
- Colour tokens: surfaces, ink, borders, semantic/status — light and dark **designed separately**
- Team colour resolution (`src/lib/teamColor.ts`):
  - true brand colour for identity surfaces
  - per-theme chart-safe derived variants where brand colour fails the lightness band
  - deterministic fallback ramp for the 202 teams with no colour
  - **runtime collision detection** — pairwise perceptual distance across the selected entities,
    auto-assigning dash/marker differentiators
- Reserved semantics: purple = session fastest, green = personal best, yellow = below personal best.
  Never reused as series colours.
- Motion presets (`src/lib/motion.ts`) — the complete timing/easing/spring set, derived from Framer
  Motion's own documented examples, with `prefers-reduced-motion` variants
- Core components: button, select, tabs, card, table (tabular numerals, virtualisable), badge,
  tooltip, skeleton, empty state, **no-coverage state**, driver/team avatar with placeholder
- Chart primitives shared by Recharts and visx: axis, grid, legend, tooltip, table-view toggle
- Palette validation run and results recorded

**Acceptance**
- Design system doc complete; every token has a name and a defined use
- A rendered token/component gallery route (dev-only) exists
- Palette validation recorded, with secondary-encoding strategy for every failing pair
- No hard-coded colour, duration, or font size anywhere outside the token files
- Light and dark both verified by the `designer` via Playwright MCP

**Technical Spec** — _pending `principal-engineer`_

**Design Spec** — _pending `designer`_

---

### F2 — Season hub · `feat/season-hub`

**Goal:** the landing experience. "What is happening this season, and how did it get here."

**Requirement IDs:** SC-1, SC-2, SC-3, SC-4, SC-8, NV-2, NV-3

**Scope**
- Season selector (1950–2026) available app-wide
- Current standings — drivers and constructors, with team colours and logos
- **Championship progression** — cumulative points by round, from `driver_championship` /
  `team_championship` (denormalized; no joins needed)
- **Points gap to leader** across the season
- Season calendar with completed / upcoming split, linking into F3
- Landing view: current season state, last completed round, next scheduled round

**Data facts that bind this feature**
- Standings come from `driver_championship` — never re-aggregate `session_entry` points
- Final standings = max `(round_number, session_number)` — `DATABASE.md` §6.6
- The current season is **partial**: results through round 10 of 24 at time of writing. Future rounds
  are *scheduled*, not *missing* (trap 13)
- `round.is_cancelled` rounds render distinctly (trap 12)
- Within a single season raw points are valid; **across seasons they are not** (§5 of `DATABASE.md`)

**Acceptance**
- Any season 1950–2026 loads correctly, including 7-race and 24-race seasons
- Progression chart correct for a best-N-results era (verify 1950 against `championship_system`)
- Partial current season renders without a broken chart
- Cancelled round visually distinct
- Deep link to `/seasons/1976` works on direct entry

**Technical Spec** — _pending_ · **Design Spec** — _pending_

---

### F3 — Race deep dive · `feat/race-deep-dive`

**Goal:** the flagship. The reason someone chooses this product over a results table — the race
explained lap by lap.

**Requirement IDs:** RD-1, RD-2, RD-3, RD-4, RD-5, RD-6, RD-7, RD-9, RD-10, RD-11

**Scope**
- Full classification table — position, `detail` status, gaps via `time_ms`, points, grid
- **Position chart** (RD-1) — per-lap position for every driver; the whole race in one image
- **Lap-time traces** (RD-2) — multi-select drivers, lap time vs lap number
- **Stint reconstruction** (RD-3) — pit stops segment the race; stint boundaries and lengths
- **Pace degradation** (RD-4) — per-stint trend over clean laps
- **Gap to leader** (RD-5) — cumulative delta per lap
- **Pit stop timeline** (RD-7) — every stop by lap and duration
- **Consistency** (RD-9) — clean-lap time distribution per driver
- Weekend session times (RD-11) with local-time conversion

**Data facts that bind this feature**
- Lap data exists **1996+**. 0 of 484 races before 1990 have it. Pre-1996 must show a designed
  no-coverage state explaining the boundary — this is the single most visible data limit in the product
- Pit data exists **2011+**; stints, degradation and pit timeline are unavailable before that
- `lap` holds 717,764 rows — **every query bounded** (trap 7)
- **`AND l.is_deleted = 0`** in every pace metric (trap 8)
- **Never gate on `has_time_data`** — test for `lap` rows (trap 1, `DATABASE.md` §6.4)
- Clean-lap definition in `DATABASE.md` §6.9 — excludes lap 1, in/out laps, invalidated laps
- **Safety-car periods have no flag.** Inferred periods must be labelled *inferred*, never as fact
- This is visx territory, not Recharts (`ARCHITECTURE.md` §4)

**Acceptance**
- A 2024 race renders every surface correctly
- A 2005 race renders lap surfaces and a no-coverage state for pit/stint surfaces
- A 1975 race renders classification plus a clear explanation that lap data begins in 1996
- Position chart interactive at 20 drivers × 70+ laps within the §8 budget
- Any inferred safety-car marking is visibly labelled as inferred
- Invalidated laps demonstrably excluded from pace metrics

**Technical Spec** — _pending_ · **Design Spec** — _pending_

---

### F4 — Driver profiles · `feat/driver-profiles`

**Goal:** a driver's whole career, honestly normalized.

**Requirement IDs:** DR-1 … DR-8

**Scope**
- Index with search/filter; profile page per driver (slug-routed)
- Identity block: photo (R1) or placeholder, code, number, nationality, age, career span
- Career totals: starts, wins, podiums, points finishes, poles, fastest laps, DNFs, championships
- Season-by-season table: team, points, championship position, wins
- Grid vs finish (DR-4), qualifying vs race delta (DR-5)
- Team history (DR-6), circuit form (DR-7)
- Reliability: DNF rate and cause breakdown from the decoded `status` enum (DR-8)

**Data facts that bind this feature**
- **Never sum points across seasons** — use `driver_championship`, or a rate metric (trap 4)
- `status` decode in `DATABASE.md` §3: DNF = `10, 11`; mechanical = `11`; **`30, 40` are not starts**
- Qualifying data from **1994**; fastest-lap data from **2004**
- `grid = 0` is a pit-lane start — exclude from positions-gained (trap 9)
- A driver may have two `team_driver` rows in one season (mid-season change)

**Acceptance**
- Fangio (1950s, best-N era) and Verstappen (modern) both render correctly
- Career totals never a naive points sum; normalization visible where relevant
- A mid-season team change renders both teams
- Missing photo renders the placeholder cleanly
- DNF breakdown maps to the decoded enum, not to `detail` string matching

**Technical Spec** — _pending_ · **Design Spec** — _pending_

---

### F5 — Team profiles · `feat/team-profiles`

**Requirement IDs:** CN-1 … CN-7

**Scope**
- Index and per-team profile (slug-routed), logo (R2) or placeholder, brand colour throughout
- Honours, seasons active, championship history
- Season performance from `team_championship`
- Driver lineup by season; intra-team points split per driver (CN-4)
- Reliability by season (CN-5); pit crew performance (CN-6); qualifying pace (CN-7)

**Data facts that bind this feature**
- Constructors' Championship begins **1958**; driver results exist from 1950. A team active in 1950
  has race results but no constructor standings
- **`base_team` is empty (0 rows)** — team lineage does not resolve. Do not build a lineage feature
  (trap 5)
- Only 12 of 214 teams have `primary_color` — fallback required (trap 6)
- Pit durations are **not comparable across eras** — CN-6 needs an explicit caveat (trap 10)

**Acceptance**
- Ferrari (1950–2026, longest history) and Cadillac (2026 debut) both render
- A pre-1958 season shows race results without implying missing constructor standings
- A colourless historical team renders with the fallback, no broken styling
- CN-6 displays its era caveat

**Technical Spec** — _pending_ · **Design Spec** — _pending_

---

### F6 — Circuits · `feat/circuits`

**Requirement IDs:** CI-1 … CI-5

**Scope**
- Index and profile: name, locality, country, coordinates, altitude, map
- Race history at the venue; most successful drivers and teams
- Overtaking index (CI-4) — mean position changes per race, **1996+ only**
- Pole conversion rate at the venue (CI-5)

**Data facts**
- 78 circuits. `circuit.altitude` available. No track length in the dataset (`REQUIREMENTS.md` §6)
- CI-4 depends on lap data → 1996+ only; state the window on the surface
- Circuits change layout over time; `currentTrackYear` is not in the schema — do not imply
  layout-aware comparison

**Acceptance**
- Monza (1950–present) and a one-off venue both render
- CI-4 shows its coverage window and is absent/explained for pre-1996 races
- Map renders without any third-party runtime request (`S-1`/`ARCHITECTURE.md` §7)

**Technical Spec** — _pending_ · **Design Spec** — _pending_

---

### F7 — Comparison workspace · `feat/compare`

**Goal:** the product's centrepiece. Comparing drivers or teams, across any time scope, should feel
obvious rather than configured — and must never quietly lie across eras.

**Requirement IDs:** HH-1 … HH-5, RC-2

**Interaction model** (the `designer` refines; this is the intended shape)

1. **Mode** — Drivers | Teams.
2. **Entity tray** — search-and-add, **maximum 4**. Each chip carries the entity's colour, its
   photo/logo, and a remove control. The cap is deliberate: it satisfies the direct-label rule and
   collapses colour-collision probability.
3. **Time scope** — the control that changes everything:

   | Scope | Chart granularity |
   |---|---|
   | Single season | per round |
   | Season range | per season |
   | Full career | career totals + normalized rates |

   Per-round across a 20-year range is never offered — it is unreadable, and offering it is a
   design failure.

4. **Metric**, grouped so the list stays legible:

   | Group | Metrics | Coverage |
   |---|---|---|
   | Championship | points, position, wins, podiums | 1950+ |
   | Race craft | avg finish, positions gained, DNF rate, finish rate | 1950+ |
   | Qualifying | avg grid, poles, quali-vs-race delta | 1994+ |
   | Pace | best lap, median clean lap, consistency | **1996+** |

   Metrics outside the selected window are **disabled with the reason shown**, never silently empty.

5. **View** — per-round · per-season · cumulative · head-to-head.
6. **Teammate mode** — if two selected drivers shared a team in the range, surface it prominently.
   Same car, same conditions: the only truly like-for-like comparison in the sport, and it deserves
   to be the hero of this page.
7. **Normalization notice** — whenever the range crosses point systems or best-N eras, a visible
   explanation of what was normalized and how. Never silent.

**Data facts that bind this feature**
- Cross-era raw points are **invalid** — `DATABASE.md` §5. Use `driver_championship` per season, or
  rate/share metrics across eras
- Teammate comparison **always collides on colour** (same team) — secondary encoding mandatory
- Cadillac/Haas and RB/Alpine collide perceptually even for full-colour vision — runtime collision
  detection required (F1 scope)
- Pace metrics need clean laps (`DATABASE.md` §6.9) and 1996+

**URL contract** (`ARCHITECTURE.md` §5) — every comparison is shareable:
```
/compare?kind=driver&e=max_verstappen,lando_norris&from=2023&to=2026&metric=points&view=perRound
```

**Acceptance**
- 1, 2, 3, 4 entities all render correctly; a 5th is prevented with an explanation
- Invalid params degrade to defaults with a visible notice, never a crash
- Cross-era selection always shows the normalization notice
- Teammate seasons detected and surfaced
- Colliding colour pairs visibly differentiated without relying on colour
- URL round-trips: state → URL → reload → same view → shareable in a fresh context
- A pace metric with a pre-1996 range is disabled with the reason shown

**Technical Spec** — _pending_ · **Design Spec** — _pending_

---

### F8 — Records & cross-era · `feat/records`

**Requirement IDs:** RC-1, RC-2, RC-3, RC-4

**Scope**
- All-time leaderboards: wins, poles, podiums, starts, fastest laps
- **Normalized** cross-era comparison: win rate, podium rate, share of available points
- Grid-slot outcome distribution (RC-3)
- Retirement-cause atlas (RC-4) — the reliability-improvement story across 76 years, from the
  decoded `status` enum

**Data facts**
- **Never a raw all-time points leaderboard.** 24 point systems; a 1960 win paid 8, a 2026 win 25
- Every leaderboard states its normalization
- Season length varies 7 → 24 races — count-based records inherently favour modern eras and must
  say so
- `status = 30, 40` are not starts

**Acceptance**
- No leaderboard presents raw cross-era points
- Every leaderboard displays its normalization
- Retirement atlas maps to the decoded enum groups
- Count-based records carry the era caveat

**Technical Spec** — _pending_ · **Design Spec** — _pending_

---

### F9 — Search & navigation · `feat/search-nav`

**Requirement IDs:** NV-1, NV-2, NV-4

**Scope**
- Global search across drivers, teams, circuits, races — keyboard-first
- App-wide season/round selector
- Deep-linkable URLs for every view; breadcrumbs; 404 handling for unknown slugs

**Acceptance**
- Search finds by full name, surname, and code (`VER`)
- Keyboard-only operation end to end
- Unknown slug → designed 404, not a crash
- Every route deep-links on direct entry

**Technical Spec** — _pending_ · **Design Spec** — _pending_

---

### F10 — Accessibility & performance · `feat/polish`

**Requirement IDs:** NF-1 … NF-6, NV-5, NV-6, NV-8

**Scope**
- Meet every budget in `ARCHITECTURE.md` §8; route-level code splitting; table virtualisation
- Precomputed aggregates for career/all-time surfaces
- Full accessibility pass: contrast, focus order, keyboard paths, chart table-views, screen reader
- `prefers-reduced-motion` verified on every animation
- Responsive verification at 390 / 768 / 1440
- Coverage-aware controls everywhere (NV-8) — disabled with a reason, never blank

**Acceptance**
- Every §8 budget met, measured and recorded
- No chart relies on colour alone; table view reachable for every chart
- Reduced motion honoured everywhere
- No horizontal body scroll at any breakpoint

**Technical Spec** — _pending_ · **Design Spec** — _pending_

---

### F11 — Release hardening · `feat/release-hardening`

**Scope**
- `qa` runs the **full-application regression suite** — every route, chart, state, breakpoint, theme
- `reviewer` runs a **whole-repository security audit**, not per-feature
- Final provenance sweep across all files, all history, all branch names
- README and setup docs (stating the database is supplied separately, with no provenance detail)
- Confirm no database, seed artefact, or `.env` in the repository or its history

**Acceptance**
- Full E2E suite green
- Whole-repo security audit passed
- `git log --all` and the full tree free of provenance references
- A fresh clone plus a supplied database runs the app from the README alone

**Technical Spec** — _pending_ · **Design Spec** — _pending_

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Lap data absent before 1996 — the flagship feature's core limit | Designed no-coverage states are a first-class requirement, not an error path (F3) |
| Team brand colours fail perceptual separation | Runtime collision detection + mandatory secondary encoding (F1) |
| Cross-era points comparisons silently wrong | `championship_system` applied; normalization always visible; reviewer trap-4 check |
| Position chart performance at lap scale | visx + server-side downsampling; budget in `ARCHITECTURE.md` §8 |
| Provenance leaking into the repository | Grep gate in review, in approval, and again at release |
| Images unavailable for 881 drivers / 214 teams | Placeholders are permanent infrastructure, not a stopgap |
| Playwright MCP not configured | `qa` and `designer` must stop and report, never work around it |
| Design incoherence across features | Design system lands before any feature (F1); nothing invents tokens after |

---

## 6. Change log

| Date | Change | By |
|---|---|---|
| 2026-08-04 | Initial plan, architecture, database and agent definitions created | — |
