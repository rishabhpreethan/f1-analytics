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

**Standing rule — file ownership restricts who *edits*, never who *reports*.** Added 2026-08-04 after
an agent correctly declined to edit a file it did not own and then **also** withheld what it had
found there. Those are different obligations. If any agent notices a defect, a contradiction or a
stale fact in material it may not touch, it **reports it to the `orchestrator`** — file and line, and
what is wrong — and the `orchestrator` routes it to the owner. Silence about a finding is never the
correct response to not owning a file. This is the mechanism by which a defect gets caught by people
rather than by patterns.

### 2.4 — removed

Removed by **CR-005** (§5.5), 2026-08-04. Section number retained so existing cross-references do not
silently retarget. **The database and all raw seed artefacts are still never committed** — that rule
now lives in §2.5's Definition of Done and in `REQUIREMENTS.md` §7.2, and it is about a 66 MB binary
and local-only tooling, not about this removal.

### 2.5 Definition of Done

A feature is Done only when **all** hold:

- [ ] Every requirement ID in scope implemented, or deferred with a recorded reason
- [ ] Technical Spec and Design Spec both present in this file
- [ ] `DESIGN VERIFICATION: PASS`
- [ ] `CODE REVIEW: PASS`
- [ ] `SECURITY AUDIT: PASS` — a verdict on each of S-1 … S-11 and S-13 … S-14. **`S-12` was removed by CR-005** (§5.5) and is not renumbered, because the identifiers are cited by number across this file, the agent definitions and the review history
- [ ] `QA: PASS` with evidence
- [ ] Typecheck, lint, unit tests, build all clean
- [ ] No database, `.env`, or seed artefact staged for commit
- [ ] `orchestrator` approval recorded with a date

---

## 3. Master tracker

Status vocabulary: `Not started` · `Spec in progress` · `Design in progress` · `Ready for dev` ·
`In development` · `Design verification` · `In review` · `Security audit` ·
`Fixing findings` · `In QA` · `Awaiting approval` · `✅ Done`

| ID | Feature | Branch | Depends on | Status | Approved |
|---|---|---|---|---|---|
| R0 | Supply `data/f1.db` | — | — | ✅ Done | 2026-08-04 |
| R1 | Driver images | — | — | Not started | — |
| R2 | Team logos | — | — | Not started | — |
| R3 | App icons (favicon, touch, maskable) | — | — | Not started | — |
| F0 | Foundation & scaffold | `feat/foundation` | R0 | In development | — |
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

**✅ F0 gate 3 is running — all three preconditions cleared, re-verified by the `orchestrator`
2026-08-04** (§G.5): **P-1** Node **v22.23.2** installed; **P-2** `DESIGN_SYSTEM.md` §10 corrected to
the external `public/theme-init.js`; **P-3** all four stale task cross-references corrected. The
`developer` is implementing T1–T14 on `feat/foundation`. Gates 4–11 follow; nothing is Done until the
`orchestrator` records approval.

**R1 / R2 are not on F0's critical path.** F0 renders no driver, team or race content, so no
headshot, logo or placeholder-avatar surface exists in it. They first bind at F4 (R1) and F5 (R2).
**R3 does not block F0 either** — F0 ships the `designer`'s typographic `public/favicon.svg`
placeholder, built from a font the project is licensed to use and carrying no third-party mark.

### Per-feature agent log

Filled in by the `orchestrator` as gates complete.

| ID | Spec | Design | Dev | Design verify | Review | Security | QA | Approved |
|---|---|---|---|---|---|---|---|---|
| F0 | ✅ 2026-08-04 · `PLAN.md` F0 → Technical Spec (14 tasks, T1–T14) · verified by orchestrator | ✅ 2026-08-04 · `PLAN.md` F0 → Design Spec + `docs/DESIGN_SYSTEM.md` §1–§10 · verified by orchestrator | ⏳ 2026-08-04 · dispatched, T1–T14 on `feat/foundation` · brief §G.7 | | | | | |
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

**Assignment Briefs** — written 2026-08-04 by the orchestrator. Dispatch gates 1 and 2 in parallel.

> **Historical record — both gates are ✅ complete.** Kept verbatim as the record of what was actually
> asked for. **One constraint named in both briefs was later removed by CR-005** (§5.5) and no longer
> applies to any gate; nothing else in either brief changed, and neither delivered spec is affected.

<details>
<summary><b>Gate 1 — <code>principal-engineer</code> (Technical Spec)</b></summary>

**Scope IN:** Vite + React 19 + TS (`strict`), Tailwind, path aliases · Hono API on Node with
`better-sqlite3` opened `readonly: true` · the canonical views `v_entry` / `v_race` (DDL in
`docs/DATABASE.md` §6.1) — **decide and justify where/how they are created**, given the database is
read-only at runtime and not committed · `GET /api/meta` as the proving path (data vintage, latest
completed round, season range) · TanStack Query provider · React Router v8 with the route table from
`docs/ARCHITECTURE.md` §5 (placeholder components fine) · Zod pattern with types via `z.infer` ·
security headers, non-leaking error handler (S-6, S-9), per-IP rate limit (S-13) · ESLint, Prettier,
Vitest · `npm run dev` runs client + API together · app shell (header, nav, theme toggle, outlet) ·
data-vintage indicator (NV-9).

**Scope OUT:** any analytical feature, any chart, any driver/team/race page content.

**Read:** `PLAN.md` §2 + this F0 section + §5 · `REQUIREMENTS.md` §2, §7 (DL-1…DL-8), §8 ·
`docs/ARCHITECTURE.md` in full · `docs/DATABASE.md` §1, §6, §7, §8.

**Constraints that bite:** fresh clone has no `data/f1.db` — the missing-DB case must give a clear
actionable error, never a stack trace · `better-sqlite3` is synchronous by design · DL-1 never write ·
DL-2 no third-party calls on a request path · DL-3 no internal integer ids in URLs · S-4 Zod-validate
every param · S-6 no stack traces/SQL/paths in responses · trap 1: `has_time_data` unreliable — test
for `lap` rows · **Node 22 LTS, floor `>=22.22.0`** — `better-sqlite3` remains the specced driver;
`node:sqlite` is available on Node 22 but is a recorded future consideration only and is deliberately
not acted on in F0 (`ARCHITECTURE.md` §10 #16) · **provenance silence**.

**Verify, don't assume:** query `data/f1.db` directly to confirm the real values `/api/meta` returns
and how "data vintage" is computed from the data itself.

**Evidence required:** spec location · task count · the `v_entry`/`v_race` decision + reasoning ·
verified `/api/meta` values · any dependency not already in `ARCHITECTURE.md` §2 (flag, don't add) ·
anything escalated.

</details>

<details>
<summary><b>Gate 2 — <code>designer</code> (Design Spec + design-system foundations)</b></summary>

**Scope IN — Design Spec:** app shell (header, nav, theme toggle, outlet) · **data-vintage
indicator** (NV-9) — honest and unobtrusive, and it must convey freshness **without naming or
hinting at a source** · theme foundation, light and dark designed separately · loading / error /
empty shell states including **"database not available"**, which a developer hits on a fresh clone ·
route transition motion and shell entry motion.

**Scope IN — `docs/DESIGN_SYSTEM.md`** (currently a handover with `_TO BE COMPLETED_` markers):
complete §2 Typography (actual families, weights, modular scale; max three families; **verify fonts
exist and are web-licensed by searching**) · §3.5 surfaces/ink/borders for both themes · §4 Motion
(named timing/easing/spring set + reduced-motion variant for each) · §5 spacing scale and breakpoints
390/768/1440 · §7 shell-relevant components (button, badge, skeleton, empty state, no-coverage state)
with all states.

**Defer to F1:** chart specifications, full component inventory, team-colour resolution internals.

**Read first:** all of `docs/DESIGN_SYSTEM.md` — **§3 and §4 contain MEASURED facts** (a palette
validation that failed four checks; verified F1 timing conventions). Build on them; do not
re-litigate or soften them. Then `PLAN.md` §2 + this section + §5 · `REQUIREMENTS.md` §1.1, §2, §8 ·
`docs/ARCHITECTURE.md` §5, §8.

**Overriding requirement:** coherence. One type scale, one spacing scale, one motion vocabulary. The
theme and typography must match the vibe — technical, precise, fast, confident — and must not be all
over the place.

**Motion:** do not hand-roll animation logic or invent easing curves. Use Framer Motion's own
documented examples per category (`WebFetch`/`WebSearch`) and **cite which example each pattern
derives from**. Define the timing set once. Honour `prefers-reduced-motion` everywhere.

**Validate colour, don't reason about it.** Run the validator for every palette introduced, both
modes, and record output in `DESIGN_SYSTEM.md` §9.

**Constraints that bite:** assets are **Rishabh's** — specify precisely (path, dimensions, format,
naming) and mark assigned to him, plus the shipping placeholder · **provenance silence** in all copy ·
design only what the data supports (`REQUIREMENTS.md` §6) · never a dual-axis chart.

**Evidence required:** spec location · which `DESIGN_SYSTEM.md` sections completed · typography choice
with evidence the fonts exist and are licensed · actual validator output per palette · Framer Motion
examples referenced by name · assets assigned to Rishabh · open questions for Rishabh.

</details>

#### **Technical Spec** — `principal-engineer`, 2026-08-04

> Everything asserted below was either read from a canonical document or **verified by executing a
> query / resolving the dependency tree** on this machine. Values marked ✅ were counted from
> `data/f1.db`; the producing query is given. The `developer` implements this without making design
> decisions — where a choice exists it has been made here.

---

##### 0. Verified facts this feature is built on

**0.1 Runtime: Node 22 LTS — approved by Rishabh 2026-08-04.** The first draft of this spec was
written against the machine's Node v20.18.2 and had to pin Vite 6 / ESLint 9 / React Router 7, and
to carry a documented `npm audit` exception. Rishabh approved raising the runtime specifically so
that exception could be **deleted rather than managed**. This section is the re-verification.

**Required floor: `node >= 22.22.0`.** That figure is not chosen for tidiness — it is the highest
floor any direct dependency declares (`react-router@8.3.0`), and it simultaneously satisfies
`eslint@10`'s `^22.13.0`. Recommended install: **v22.23.2** (Latest LTS "Jod").

**✅ Machine state: Node 22 is installed — gate-3 precondition P-1 is cleared.** Rishabh ran the
§9.3 command. ✅ Re-confirmed here: `node -v` → **v22.23.2**, `npm -v` → **10.9.8**, and
`nvm alias default` → `default -> 22.23.2`. The Homebrew keg at `/opt/homebrew/opt/node@22` remains
**mislabelled (it contains v23.7.0)** and must still not be used.

**⚠ A shell started before the install still resolves v20.18.2**, because `nvm alias default` cannot
change the PATH of an already-running process. Any agent needing Node must first run
`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22.23.2` — **a bare `node -v` in an
inherited shell is not evidence that Node 22 is absent.** T1's version assertion stands regardless,
because it must hold for a contributor's shell too, not only for ours.

**What was verified, and how, given Node 22 is not runnable here:**

1. **Resolution and audit — executed for real.** The §1.1 set was installed in a scratch directory:
   **320 packages**, and `npm audit` → **`found 0 vulnerabilities`**. Audit is a registry query over
   the resolved tree, so this result is independent of which Node executes it. The React Router
   advisory is **gone**, not suppressed.
2. **Engine compatibility — evaluated deterministically over the whole tree**, not inferred from the
   warnings of a single install. A script walked all 320 resolved `package.json` files and tested
   each `engines.node` range with `semver.satisfies`:

   ```
   packages inspected: 320
   Node 22.22.0: 0 package(s) whose engines.node excludes it
   Node 22.23.2: 0 package(s) whose engines.node excludes it
   ```

   This is stronger evidence than `EBADENGINE` output, because it covers every transitive package
   rather than only those npm chose to warn about.
3. **React Router 8's import surface — checked at runtime**, since the v7→v8 breaking change was the
   removal of `react-router-dom`. Every declarative API this spec uses is exported from
   `react-router` itself: ✅ `BrowserRouter`, `Routes`, `Route`, `Outlet`, `Link`, `NavLink`,
   `useParams`, `useSearchParams`, `useNavigate`, `useLocation`, `Navigate`. `react-router/dom`
   contains only framework/RSC APIs (`HydratedRouter`, `RouterProvider`, `unstable_RSC*`) which this
   product does not use. **§3.5 therefore needs no change** — the spec never imported from
   `react-router-dom`.

**✅ What was previously unverifiable is now partly discharged — on the target runtime.** This section
was originally written from a Node 20 machine, so it could prove resolution, audit and engine ranges
but not *execution*. Since then, reported by the `orchestrator` from a Node 22 shell: **`node -v`
v22.23.2, `better-sqlite3@12.11.1` builds and loads, and `npm audit` → `found 0 vulnerabilities`.**
That clears the **native-ABI** risk, which was the only item on this list that a resolution check
could not reach — a prebuilt or locally compiled native module either loads on a given ABI or does
not. Attribution matters: I did not run the native build myself, so it is recorded here as the
orchestrator's measurement, not mine.

**What is still the developer's to demonstrate:** a real `npm install && npm run build` of the whole
§1.1 set on Node 22 — **T1's first acceptance criterion**. A native module loading proves the ABI; it
does not prove that Vite 8, ESLint 10 and Vitest 4 all execute cleanly together.

**✅ The §10 #7 temp-view decision was re-probed on Node 22 / SQLite 3.53.2 and all four behaviours
hold** (orchestrator, 2026-08-04): `CREATE TEMP VIEW` succeeds under `readonly: true`; permanent
`CREATE VIEW` refuses with `SQLITE_READONLY`; reads through the temp view survive the
`PRAGMA query_only = 1` latch; and `CREATE TEMP VIEW` after the latch is refused. **§1.2 and
`ARCHITECTURE.md` §10 #7 stand unchanged**, now with evidence on the runtime that will actually run
them rather than on Node 20 alone.

**⚠ One correction to the approved list: TypeScript 7 cannot be used.** Requested, but it fails —
this is not a warning, it is a hard resolution error:

```
npm error ERESOLVE unable to resolve dependency tree
npm error Found: typescript@7.0.2
npm error Could not resolve dependency:
npm error peer typescript@">=4.8.4 <6.1.0" from typescript-eslint@8.66.0
```

`typescript-eslint@8.66.0` is the **latest published** version — `dist-tags` show no v9, and even the
`canary` (`8.66.1-alpha.4`) still caps at `<6.1.0`. Dropping `typescript-eslint` is not an option:
`ARCHITECTURE.md` §2 makes `any` a review failure, which requires type-aware lint rules. So
**`typescript` stays `~5.9.3`**, and is the one item in §1.1 that is not the current major. Revisit
when `typescript-eslint` publishes TypeScript 7 support.

Everything else on the approved list checks out: Vite 8, ESLint 10, `@vitejs/plugin-react` 6,
`typescript-eslint` 8.66, `concurrently` 10, React Router 8.3.0.

**0.2 The `/api/meta` values — ✅ verified, with the producing queries.**

| Field | Verified value | Query |
|---|---|---|
| `seasons.firstYear` / `latestYear` / `count` | **1950 / 2026 / 77** | `SELECT min(year), max(year), count(*) FROM season` |
| `latestCompletedRound` | **2026, round 10, "Belgian Grand Prix", 2026-07-19, `spa`, "Circuit de Spa-Francorchamps"** | `Q_LATEST_COMPLETED_ROUND` (§1.3) |
| `latestSeason.scheduledRounds` | **22** | `Q_LATEST_SEASON_PROGRESS` (§1.4) |
| `latestSeason.completedRounds` | **10** | ditto |
| `latestSeason.cancelledRounds` | **2** | ditto |
| `nextScheduledRound` | **2026, round 11, "Hungarian Grand Prix", 2026-07-26, `hungaroring`** | `Q_NEXT_SCHEDULED_ROUND` (§1.5) |

All four prepared statements together: **0.937 ms** warm. Budget is 50 ms (`ARCHITECTURE.md` §8).

**0.3 ⚠ NEW TRAP — cancelled rounds have `round.number IS NULL`.** ✅ Verified:

```
sqlite> SELECT count(*) FROM round WHERE number IS NULL;                        -- 2
sqlite> SELECT count(*) FROM round WHERE number IS NULL AND is_cancelled=1;     -- 2
sqlite> SELECT count(*) FROM round WHERE is_cancelled=1 AND number IS NOT NULL; -- 0
sqlite> SELECT count(*) FROM round WHERE is_cancelled=0 AND number IS NULL;     -- 0
sqlite> SELECT count(*) FROM round WHERE is_cancelled IS NULL;                  -- 0
sqlite> SELECT count(*) FROM round;                                            -- 1173
```

Both are 2026: Bahrain (2026-04-12) and Saudi Arabian (2026-04-19). Consequences, all binding:

- 2026 holds **24 `round` rows but only 22 numbered rounds** (`max(number)=22`).
- SQLite sorts `NULL` **first**, so any bare `ORDER BY r.number` puts cancelled rounds at the top.
- A cancelled round is **not addressable** by `/seasons/:year/races/:round` — it has no number.
- Every `round`-number query in this codebase must carry `AND r.number IS NOT NULL`.

**✅ The equivalence holds in both directions, and that is what makes the filter sufficient.** The
last three counts are the ones that license the rule above. `cancelled_but_numbered = 0` says every
cancelled round is unnumbered; `numbered_gap = 0` says every unnumbered round is cancelled; and
`is_cancelled IS NULL = 0` over all **1,173** rows says the two predicates *partition* the table, so
the second count is a real proof and not an artefact of `= 0` skipping NULLs. Therefore
**`AND r.number IS NOT NULL` excludes exactly the cancelled rounds and nothing else** — it is a
complete filter, not a partial one, and a query does **not** need a redundant `AND r.is_cancelled = 0`
alongside it.

**This is a property of the data as it stands, not a schema guarantee.** No constraint enforces it, so
a refreshed database could introduce a numbered cancelled round and quietly turn the number filter
from sufficient into merely necessary. That is why the §9.1 post-refresh check must test **both**
directions — a bare `count(*) WHERE number IS NULL` would not notice.

This is not in `DATABASE.md` §7. Task **T14** adds it as **trap 15**.

**0.4 Coverage windows — ✅ re-verified from the data**, agreeing with `DATABASE.md` §4:

| Window | First year with entries/rows | Query basis |
|---|---|---|
| Race results | **1950** (→2026) | `session.type='R'` joined to `session_entry` |
| Qualifying (any) | **1994** | `type IN ('QB','QA','QO','Q1','Q2','Q3')` — 392 entries in 1994, **0 before** |
| Q1/Q2/Q3 segments | **2006** (→2026), 18,839 entries | `type IN ('Q1','Q2','Q3')` |
| **Lap times / positions** | **1996** (→2026), **578** race sessions with `lap` rows | `lap → session_entry → session(type='R') → round → season` |
| **Pit stops** | **2011** (→2026), 12,700 rows | `pit_stop → session_entry → …` |
| Sprint race | **2021** (→2026), 568 entries | `type='SR'` |
| Sprint qualifying | **2023** (→2026), 953 entries | `type IN ('SQ1','SQ2','SQ3')` |
| Practice | **never usable** | 1,678 entries total, all 2025–2026, `time_ms` NULL — trap 2 |

**0.5 The only rounds in all history with no race entries are 2026 R11–R22 plus the two cancelled
rounds.** ✅ Verified — 1950–2025 is completely populated. This is what makes the
"latest completed" / "next scheduled" pair in §1.3–§1.5 sound rather than heuristic.

**0.6 `better-sqlite3` readonly behaviour — ✅ probed on this machine** (v12.11.1, SQLite 3.53.2):

| Probe | Result |
|---|---|
| `new Database(path, { readonly: true })` then `CREATE TEMP VIEW` | **✅ succeeds** |
| …then `CREATE VIEW` (permanent) | throws `SQLITE_READONLY` |
| …then `UPDATE` | throws `SQLITE_READONLY` |
| `PRAGMA query_only = 1` after temp views exist | reads still work; **all further DDL blocked** incl. temp |
| Missing file (`readonly` and `readonly + fileMustExist`) | `SQLITE_CANTOPEN` — `unable to open database file` |
| Non-SQLite file | `SQLITE_NOTADB` — `file is not a database` |
| Valid SQLite, wrong schema | `SQLITE_ERROR` — `no such table: season` |
| **WAL database in a non-writable directory** | **`SQLITE_READONLY_DIRECTORY`** — SQLite must create the `-shm`/`-wal` sidecars even to read |
| `file:…?immutable=1` | `SQLITE_CANTOPEN` — `better-sqlite3` does not enable `SQLITE_OPEN_URI` |

The last two rows are a **deployment constraint, not a bug**: the directory containing the database
must be writable by the server process. Recorded as `ARCHITECTURE.md` §10 decision 12.

**0.7 The application-facing model is the 18 tables documented in `DATABASE.md` §2.** The file
contains one further table that is internal bookkeeping. **The application must never query it or
name it**, and `db/schema.sql` must not describe it (T2). `DATABASE.md`'s "18 tables" is correct as
the application contract.

---

##### 1. Data contract

###### 1.1 Dependency set — ✅ resolved and audited on 2026-08-04

Every range below is what actually resolved, not what was hoped for. **320 packages ·
`npm audit` → `found 0 vulnerabilities` · 0 packages excluding Node 22.22.0.**

`"engines": { "node": ">=22.22.0" }` — enforced mechanically (T1), so a contributor on the wrong
Node is told by `npm`, not by a reviewer.

`dependencies`

| Package | Range | Resolved | Note |
|---|---|---|---|
| `better-sqlite3` | `^12.11.1` | 12.11.1 | ships **no** types → `@types/better-sqlite3` required |
| `hono` | `^4.13.0` | 4.13.0 | `hono/secure-headers` is built in — ✅ confirmed present |
| `@hono/node-server` | `^2.1.0` | 2.1.0 | **approved by Rishabh 2026-08-04** (`ARCHITECTURE.md` §2, §10 #8) |
| `zod` | `^4.4.3` | 4.4.3 | |
| `react` / `react-dom` | `^19.2.8` | 19.2.8 | satisfies `react-router@8`'s `>=19.2.7` peer |
| `react-router` | `^8.3.0` | **8.3.0** | audit-clean. Declarative mode; all APIs used come from `react-router` (§0.1) |
| `@tanstack/react-query` | `^5.101.4` | 5.101.4 | |
| `framer-motion` | `^12.43.0` | 12.43.0 | **F0 lands the shell/route motion subset** — see below |

**⚠ `framer-motion` in F0 — this supersedes the first draft of this row.** An earlier version of this
table read *"F1 uses it; F0 installs it and adds no animation."* That is **withdrawn** by ruling R-1
(Orchestrator Gate Record §G.2), and the ruling is correct: gate 4 is visual verification, and there
is nothing to verify in an inert shell. **F0 lands the subset the Design Spec §6 specifies, and only
that subset:**

| In F0 | Where | Task |
|---|---|---|
| `<MotionConfig reducedMotion="user">` wrapping the app | `src/main.tsx` | T8 |
| **M-1** shell mount | `AppShell` | T11 |
| **M-2** route content enter, keyed on `location.pathname`, **no exit variant** | `RootLayout` | T10 |
| **M-3** nav active rule (`layoutId`) | `PrimaryNav` | T11 |
| **M-4** mobile nav sheet + scrim | `PrimaryNav` | T11 |
| **M-5** theme popover | `ThemeToggle` | T11 |
| **M-6** hover / tap / focus on buttons, nav items, popover rows | shell components | T11 |
| **M-7** skeleton pulse — needs `useReducedMotion()` explicitly, because `MotionConfig` does not stop an opacity loop | `LoadingState` | T12 |
| **M-8** skeleton → content crossfade | `DataVintage` | T12 |
| **M-11** theme colour transition — **CSS, not Motion** | `src/styles/index.css` | T11 |

**Deferred, and not to be anticipated in F0:** M-9 (list/grid stagger, F2), M-10 (scroll reveal,
F3/F4).

Two consequences the developer must not miss:

1. **No duration, easing or spring literal is written by hand.** F0 lands a **minimal
   `src/lib/motion.ts`** holding exactly the tokens the ten motions above consume, copied from
   `DESIGN_SYSTEM.md` §4.3 — F1 completes the set (it is an F1 scope bullet). A numeric literal in a
   component is the same class of failure as an off-scale font size (`DESIGN_SYSTEM.md` §2.3).
   Easings are Motion's own string presets; springs use `visualDuration` + `bounce`. **No
   cubic-bézier literal exists anywhere in this product.**
2. **`framer-motion` is in the initial chunk** and is the largest single contributor to the F0 bundle
   baseline T13 records (§6.4). That baseline is *with* Motion, not without it.

`devDependencies` — resolved versions in brackets

| Package | Range | Resolved |
|---|---|---|
| `typescript` | `~5.9.3` | 5.9.3 — **not 7**, see §0.1 |
| `vite` | `^8.2.0` | 8.2.0 |
| `@vitejs/plugin-react` | `^6.0.5` | 6.0.5 — peer `vite ^8.0.0` |
| `tailwindcss` / `@tailwindcss/vite` | `^4.3.3` | 4.3.3 — peer accepts Vite 8 |
| `vitest` / `@vitest/coverage-v8` | `^4.1.10` | 4.1.10 — peer `vite ^6 \|\| ^7 \|\| ^8` |
| `eslint` | `^10.8.0` | 10.8.0 |
| `@eslint/js` | `^10.0.1` | 10.0.1 |
| `typescript-eslint` | `^8.66.0` | 8.66.0 — peer `eslint ^10` ✅ |
| `eslint-plugin-react-hooks` | `^7.1.1` | 7.1.1 — peer `eslint ^10` ✅ |
| `eslint-plugin-react-refresh` | `^0.5.3` | 0.5.3 — peer `eslint ^9 \|\| ^10` ✅ |
| `concurrently` | `^10.0.4` | 10.0.4 |
| `globals` | `^17.9.0` | 17.9.0 |
| `prettier` | `^3.9.6` | 3.9.6 |
| `tsx` | `^4.23.5` | 4.23.5 |
| `jsdom` | `^26.1.0` | 26.1.0 |
| `@testing-library/react` | `^16.3.2` | 16.3.2 |
| `@testing-library/user-event` | `^14.6.1` | 14.6.3 |
| `@types/node` | `^22.20.1` | 22.20.1 — tracks the runtime major |
| `@types/react` / `@types/react-dom` | `^19.2.18` / `^19.2.4` | 19.2.18 / 19.2.4 |
| `@types/better-sqlite3` | `^9.6.0` | 9.6.0 |

**Do not add anything else** — new deps go through the `principal-engineer` and are recorded in
`ARCHITECTURE.md` §10. Two are deliberately **absent**: `hono-rate-limiter` (§2.6 implements it in
~30 lines) and `@testing-library/jest-dom` (Vitest's `expect` suffices). Both rejections stand.

###### 1.2 Where `v_entry` / `v_race` live — the F0 architectural decision

The DDL in `DATABASE.md` §6.1 says `CREATE VIEW IF NOT EXISTS`. The connection is `readonly: true`
(DL-1) and the database is not committed, so four options exist. Reasoning, then the decision:

| Option | Verdict |
|---|---|
| **A. Bake the views into the shipped `.db`** | ❌ Rejected. The database is an *input supplied separately*. The app would silently depend on objects it cannot guarantee, and a refreshed file could arrive without them — a runtime `no such table: v_race` on a fresh machine. It also puts application concerns into the file rather than the repo, so the view definition would live outside version control. |
| **B. `CREATE TEMP VIEW` at connection bootstrap** | ✅ **Chosen.** ✅ Probed working on a `readonly: true` connection (§0.6). Temp objects live in SQLite's separate `temp` schema; `main` stays untouched. The DDL is a versioned constant in the repo, reviewable and diffable. Views are inlined by the planner — ✅ verified the plan stays index-driven (§1.6). Cost: ~2.7 ms once per process. |
| C. Inline the join path as a SQL string composed into each query | ❌ Rejected. Concatenating SQL fragments — even constant ones — into every statement is exactly the shape S-1 forbids, and every reviewer would have to re-establish that the fragment is constant. |
| D. Open read-write to create the views | ❌ Rejected outright — flat DL-1 / S-3 violation. |

**Decision: B.** Recorded as `ARCHITECTURE.md` §10 decision 7. Hardening that makes it airtight:
after the temp views are created, latch **`PRAGMA query_only = 1`** — ✅ probed to block *all*
subsequent DDL including temp objects, while leaving reads working. So the process can create
exactly the two views defined in the repo and nothing else, ever.

`server/views.ts`

```ts
/** Canonical flattened entry view. Mirrors docs/DATABASE.md §6.1 verbatim.
 *  Created as a TEMP view at connection bootstrap — see ARCHITECTURE.md §10 #7. */
export const V_ENTRY_DDL = `CREATE TEMP VIEW v_entry AS …`;   // §6.1 text, unmodified
export const V_RACE_DDL  = `CREATE TEMP VIEW v_race AS SELECT * FROM v_entry WHERE session_type = 'R'`;
export const CANONICAL_VIEWS = [V_ENTRY_DDL, V_RACE_DDL] as const;
```

✅ Verified: the §6.1 DDL compiles unmodified against the real schema; `v_race` returns **20 rows**
for 2024 R1 in 3.5 ms, and the lap-trace pattern (§6.3) returns **1,129 rows** in 2.8 ms.

`server/db.ts`

```ts
export class DatabaseUnavailableError extends Error {
  constructor(readonly reason: 'missing' | 'unreadable' | 'schema', cause?: unknown) { … }
}
/** Lazily opens the single readonly connection. Idempotent. */
export function getDb(): Database.Database;
/** Startup readiness probe. Returns null when ready, else the reason. Never throws. */
export function probeDatabase(): DatabaseUnavailableError | null;
/** Test-only: drop the cached handle. */
export function __resetDb(): void;
```

`getDb()` behaviour, in order:
1. Resolve `DB_PATH` **once, at module load** (§2.5). Never from a request (S-2).
2. `new Database(DB_PATH, { readonly: true, fileMustExist: true })`.
3. Map open failures: `SQLITE_CANTOPEN` → `'missing'`; `SQLITE_NOTADB` /
   `SQLITE_READONLY_DIRECTORY` → `'unreadable'`.
4. `for (const ddl of CANONICAL_VIEWS) db.exec(ddl)`.
5. Sentinel check `SELECT 1 FROM v_race LIMIT 1` — an `SQLITE_ERROR` here → `'schema'`.
6. `db.pragma('query_only = 1')`.
7. Cache and return the handle. On any failure, throw `DatabaseUnavailableError` — **never** let a
   raw `better-sqlite3` error escape, because its message carries the absolute path (S-6).

###### 1.3 `Q_LATEST_COMPLETED_ROUND` — `server/queries/meta.ts`

```sql
SELECT s.year        AS year,
       r.number      AS roundNumber,
       r.name        AS roundName,
       r.date        AS roundDate,
       c.reference   AS circuitRef,
       c.name        AS circuitName
FROM round r
JOIN season  s   ON s.id  = r.season_id
JOIN session ses ON ses.round_id = r.id AND ses.type = 'R'
LEFT JOIN circuit c ON c.id = r.circuit_id
WHERE r.is_cancelled = 0
  AND r.number IS NOT NULL
  AND EXISTS (SELECT 1 FROM session_entry se WHERE se.session_id = ses.id)
ORDER BY s.year DESC, r.number DESC
LIMIT 1;
```

- **Canonical view used: none.** Deliberate. `v_entry` fans out to one row *per car per session*
  (50,842 rows) purely to answer a round-level question. `EXISTS` over `session_entry` answers it
  without materialising entries. `v_race` is for entry-level features.
- **Traps handled:** **12** (`is_cancelled = 0`) · **0.3/new-15** (`r.number IS NOT NULL`) ·
  **13** (existence of entries, not a date-vs-today comparison — `REQUIREMENTS.md` §2.2 forbids
  assuming today's calendar position) · **1** (this asks about *results*, so it correctly tests for
  `session_entry` rows and never reads `has_time_data`) · **11** (returns `circuit.reference`, no ids).
- **Rows: exactly 1** (`LIMIT 1`), or 0 on an empty database.
- ✅ Returns `2026 / 10 / Belgian Grand Prix / 2026-07-19 / spa / Circuit de Spa-Francorchamps`.
- Ordering note: ✅ verified that `round.number` order never disagrees with `round.date` order in
  any season, and no `round.date` is NULL — so `ORDER BY (year, number)` is safe.

###### 1.4 `Q_LATEST_SEASON_PROGRESS`

```sql
SELECT s.year AS year,
  sum(CASE WHEN r.is_cancelled = 0 THEN 1 ELSE 0 END) AS scheduledRounds,
  sum(CASE WHEN r.is_cancelled = 1 THEN 1 ELSE 0 END) AS cancelledRounds,
  sum(CASE WHEN r.is_cancelled = 0 AND EXISTS (
        SELECT 1 FROM session ses
        JOIN session_entry se ON se.session_id = ses.id
        WHERE ses.round_id = r.id AND ses.type = 'R'
      ) THEN 1 ELSE 0 END) AS completedRounds
FROM round r
JOIN season s ON s.id = r.season_id
WHERE s.year = (SELECT max(year) FROM season)
GROUP BY s.year;
```

`sum(CASE …)` not `count(…) FILTER (…)`, so the SQL carries no assumption about the SQLite version
bundled with `better-sqlite3`. **Rows: 1.** Scan bounded to one season (≤24 `round` rows).
✅ Returns `2026 / 22 / 2 / 10`. Traps: **12**, **13**.

###### 1.5 `Q_NEXT_SCHEDULED_ROUND`

Identical shape to §1.3 with `NOT EXISTS` and ascending order. **Rows ≤ 1.** ✅ Returns
`2026 / 11 / Hungarian Grand Prix / 2026-07-26 / hungaroring`. Sound because of §0.5 — the only
entry-less rounds in the whole file are 2026 futures and the two cancelled rounds, and the latter
are excluded by `is_cancelled = 0 AND number IS NOT NULL`.

###### 1.6 `Q_SEASON_RANGE`

```sql
SELECT min(year) AS firstYear, max(year) AS latestYear, count(*) AS seasonCount FROM season;
```

Covering index `idx_season_year`; 77 rows. ✅ `1950 / 2026 / 77`. ✅ Verified the year sequence is
contiguous — no gap years to explain in the UI.

✅ **Query-plan evidence that the temp views do not defeat the planner** — `EXPLAIN QUERY PLAN` for
the §6.3 lap-trace pattern through `v_race`:

```
SEARCH s   USING COVERING INDEX idx_season_year (year=?)
SEARCH ses USING INDEX idx_session_type (type=?)
SEARCH r   USING INTEGER PRIMARY KEY (rowid=?)
SEARCH se  USING INDEX idx_se_session (session_id=?)
… re / td / d / t all USING INTEGER PRIMARY KEY …
SEARCH l   USING INDEX idx_lap_entry (session_entry_id=?)
```

Every access is an indexed `SEARCH`; no `SCAN`. Trap **7** is satisfied structurally for later
features, not just by convention.

###### 1.7 Coverage windows are constants, not queries — `server/coverage.ts`

Deriving §0.4 at request time would mean scanning `lap` (717,764 rows) — a trap-7 violation on the
cheapest endpoint in the app. Instead:

```ts
/** Data coverage windows. Mirrors docs/DATABASE.md §4, re-verified 2026-08-04.
 *  `to: null` means "open — through the latest season present". */
export const COVERAGE = {
  results:            { from: 1950, to: null },
  qualifying:         { from: 1994, to: null },
  qualifyingSegments: { from: 2006, to: null },
  laps:               { from: 1996, to: null },
  pitStops:           { from: 2011, to: null },
  sprint:             { from: 2021, to: null },
  sprintQualifying:   { from: 2023, to: null },
} as const;
```

`DATABASE.md` §9 already requires re-verifying §4 after a refresh; T14 adds "and
`server/coverage.ts`" to that checklist so the constant cannot drift unnoticed.

###### 1.8 What the UI does outside the window

F0 renders no data surface, so there is nothing to gate. F0's obligation is to **ship the window to
the client** so every later feature reads one authority instead of hard-coding years. NV-8's
disable-and-explain behaviour is F1+ scope.

---

##### 2. API contract

###### 2.1 `GET /api/meta`

- **Params:** none. Any query string is ignored (not an error).
- **Method:** `GET` only. The router registers `GET` alone; anything else falls to the 404 handler.
- **Success:** `200`, `application/json`, body per §2.2.
- **`Cache-Control: public, max-age=300`**, plus in-process memoisation, TTL 300,000 ms (§6.2).
- **Errors:** `503 DATABASE_UNAVAILABLE` · `429 RATE_LIMITED` · `500 INTERNAL`.

###### 2.2 Response schema — `server/schemas/meta.ts`

```ts
import { z } from 'zod';

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const seasonYearSchema = z.number().int().min(1950).max(2100);

export const seasonRangeSchema = z.object({
  firstYear:  seasonYearSchema,          // 1950
  latestYear: seasonYearSchema,          // 2026
  count:      z.number().int().positive(),// 77
});

export const roundRefSchema = z.object({
  year:        seasonYearSchema,
  round:       z.number().int().positive(),  // never 0, never null — §0.3
  roundName:   z.string().min(1),
  date:        isoDateSchema,
  circuitRef:  z.string().min(1).nullable(), // LEFT JOIN; null tolerated
  circuitName: z.string().min(1).nullable(),
});

export const coverageWindowSchema = z.object({
  from: seasonYearSchema,
  to:   seasonYearSchema.nullable(),     // null = open-ended
});

export const coverageSchema = z.object({
  results: coverageWindowSchema,            qualifying: coverageWindowSchema,
  qualifyingSegments: coverageWindowSchema, laps: coverageWindowSchema,
  pitStops: coverageWindowSchema,           sprint: coverageWindowSchema,
  sprintQualifying: coverageWindowSchema,
});

export const latestSeasonSchema = z.object({
  year:            seasonYearSchema,
  scheduledRounds: z.number().int().nonnegative(),  // excludes cancelled — §0.3
  completedRounds: z.number().int().nonnegative(),
  cancelledRounds: z.number().int().nonnegative(),
  isComplete:      z.boolean(),                     // completedRounds === scheduledRounds
});

export const metaSchema = z.object({
  seasons:              seasonRangeSchema,
  latestSeason:         latestSeasonSchema,
  latestCompletedRound: roundRefSchema.nullable(),
  nextScheduledRound:   roundRefSchema.nullable(),
  coverage:             coverageSchema,
});
export type Meta = z.infer<typeof metaSchema>;
```

**There is no `dataVintage` field.** The vintage *is* `latestCompletedRound`; a second
representation of the same fact would be a second thing to keep honest. The display string is
produced by the pure selector `selectDataVintage` (§3.4) — which is where it can be unit-tested.
There is also no field naming or describing where anything came from (§4.1 of `CLAUDE.md`).

The verified body:

```json
{ "seasons": { "firstYear": 1950, "latestYear": 2026, "count": 77 },
  "latestSeason": { "year": 2026, "scheduledRounds": 22, "completedRounds": 10,
                    "cancelledRounds": 2, "isComplete": false },
  "latestCompletedRound": { "year": 2026, "round": 10, "roundName": "Belgian Grand Prix",
                            "date": "2026-07-19", "circuitRef": "spa",
                            "circuitName": "Circuit de Spa-Francorchamps" },
  "nextScheduledRound": { "year": 2026, "round": 11, "roundName": "Hungarian Grand Prix",
                          "date": "2026-07-26", "circuitRef": "hungaroring",
                          "circuitName": "Hungaroring" },
  "coverage": { "results": { "from": 1950, "to": null }, … } }
```

**Zod is the outbound gate.** `metaSchema.parse(payload)` runs in the route handler before
responding. A parse failure is a `500 INTERNAL` with the Zod issue list logged server-side only —
never in the body (S-6). Establishing this now means every later endpoint inherits it.

**Schema modules are shared and must stay bundle-safe:** `server/schemas/*` may import **only**
`zod`. No `node:*`, no `better-sqlite3`, no query modules. The client imports them via the
`@schemas/*` alias. Added to `ARCHITECTURE.md` §3 as a layering rule.

###### 2.3 Error envelope — `server/errors.ts`

```ts
export const ERROR_CODES = ['INVALID_PARAM','NOT_FOUND','RATE_LIMITED',
                            'DATABASE_UNAVAILABLE','INTERNAL'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export const apiErrorSchema = z.object({
  error: z.object({ code: z.enum(ERROR_CODES), message: z.string().min(1) }),
});
export class ApiError extends Error {
  constructor(readonly code: ErrorCode, readonly status: ContentfulStatusCode, message: string) { … }
}
```

| Code | Status | Client-visible message (fixed strings — no interpolation) |
|---|---|---|
| `INVALID_PARAM` | 400 | `"One or more parameters were invalid."` |
| `NOT_FOUND` | 404 | `"Not found."` |
| `RATE_LIMITED` | 429 | `"Too many requests. Please slow down."` |
| `DATABASE_UNAVAILABLE` | 503 | `"The data is not available."` |
| `INTERNAL` | 500 | `"Something went wrong."` |

`app.onError` (S-6, S-9): `ApiError` → its code/status. `DatabaseUnavailableError` →
`503 DATABASE_UNAVAILABLE`. **Anything else → `500 INTERNAL` with the fixed message.** Detail
(`err.stack`, SQLite codes) goes to `console.error` only. `app.notFound` → `404 NOT_FOUND`.
No branch may put a path, a SQL string, a stack frame, or a `SQLITE_*` code into a response body.

The client-visible copy for `DATABASE_UNAVAILABLE` is deliberately about *availability* and says
nothing about a file, a location, or an origin.

###### 2.4 Security middleware — order is load-bearing

`server/app.ts`, applied in this order on the way in:

1. **`secureHeaders()`** (`hono/secure-headers`, ✅ confirmed present in `hono@4.13.0`) — applied to
   `*` so error and 404 responses carry headers too. Explicit options:

   ```ts
   secureHeaders({
     contentSecurityPolicy: {
       defaultSrc: ["'self'"], baseUri: ["'self'"],
       scriptSrc: ["'self'"],                 // S-9: no 'unsafe-inline' for scripts
       styleSrc:  ["'self'"], styleSrcAttr: ["'unsafe-inline'"],
       imgSrc: ["'self'", 'data:'], fontSrc: ["'self'"],
       connectSrc: ["'self'"],                // DL-2/S-1 enforced by the browser
       objectSrc: ["'none'"], frameAncestors: ["'none'"], formAction: ["'none'"],
       upgradeInsecureRequests: [],
     },
     xFrameOptions: 'DENY', xContentTypeOptions: true,
     referrerPolicy: 'no-referrer', crossOriginOpenerPolicy: true, removePoweredBy: true,
   })
   ```

   `connect-src 'self'` is the real prize: a future accidental third-party fetch fails **loudly** in
   the browser instead of silently violating DL-2.

   `styleSrcAttr: 'unsafe-inline'` is a **provisional** allowance. React and Framer Motion mutate
   styles through the CSSOM, which CSP does not govern, so it may well be unnecessary. **T13
   requires verifying zero CSP violations in the production preview console and removing the
   allowance if none appear.** Verify; do not reason about it.

   **The CSP is verified twice, in two different consoles, and neither discharges the other.**
   T11 and T13 both say "zero CSP violations"; they are not the same check:

   | Task | Console | What it proves | What it cannot prove |
   |---|---|---|---|
   | **T11** | **Vite dev server** (`npm run dev`, `localhost:5173`) | The shell, `public/theme-init.js` and the theme/nav/popover interactions raise no violation under the §2.4 policy | Nothing about the **built** app. In dev, Vite injects its HMR client and serves styles as `<style>` blocks the production build does not emit, so a dev-only violation can be a Vite artefact and a dev-only *pass* can hide a build-only failure |
   | **T13** | **Production preview** (`npm run build && npm run start`, single origin, `NODE_ENV=production`) | The **real** artefact — hashed asset URLs, extracted CSS, minified Framer Motion — raises no violation, and settles whether `styleSrcAttr` is needed at all | Nothing about dev ergonomics; a policy that only works in the build is still a broken `npm run dev` |

   Practical consequence for the developer: **the `styleSrcAttr` allowance may only be removed on
   T13's evidence**, and if removing it breaks the dev console, the dev server — not the policy — is
   what gets adjusted. Record both observations; a single screenshot of one console does not close
   the pair.

2. **No CORS middleware.** Omitting it means no `Access-Control-Allow-Origin` is ever sent, so
   browsers refuse cross-origin reads — that *is* same-origin-only (S-11). **Do not add
   `hono/cors`.** State this in a comment so a later reader does not "fix" it.

3. **`rateLimit()`** on `/api/*` — `server/middleware/rateLimit.ts` (§2.6).

4. **Route handlers.** They validate, call one named query, return. No logic (`ARCHITECTURE.md` §3).

###### 2.5 Configuration — `server/config.ts`

```ts
export const PORT = Number(process.env.PORT ?? 8787);
export const DB_PATH = path.resolve(process.env.F1_DB_PATH ?? path.join(REPO_ROOT, 'data/f1.db'));
export const RATE_LIMIT = { windowMs: 60_000, max: 120, maxTrackedClients: 10_000 };
export const META_CACHE_TTL_MS = 300_000;
export const IS_TEST = process.env.NODE_ENV === 'test';
```

Read from `process.env` **at module load only**, never per request (S-2). `F1_DB_PATH` is operator
configuration; it can never originate in an HTTP request. `.env.example` documents `PORT` and
`F1_DB_PATH` and contains **no secrets** (there are none — S-5).

###### 2.6 Rate limiting (S-13) — no new dependency

Fixed-window per-IP counter in one module. `hono-rate-limiter` would add a dependency and a
transitive surface for ~30 lines of logic; the threat model here is protecting a single-process
server, not adversarial abuse. Recorded as `ARCHITECTURE.md` §10 decision 9.

```ts
export function rateLimit(opts = RATE_LIMIT): MiddlewareHandler;
```

- Key: `getConnInfo(c).remote.address` (`@hono/node-server/conninfo`, ✅ confirmed exported).
  Falls back to the literal `'unknown'` when absent. **`X-Forwarded-For` is never trusted** — it is
  client-supplied and would let anyone mint unlimited buckets. If this is ever deployed behind a
  proxy, that needs a new decision-log entry.
- State: `Map<string, { count: number; resetAt: number }>`. Expired buckets are dropped lazily on
  touch, plus a sweep every 60 s. **When the map exceeds `maxTrackedClients` the oldest bucket is
  evicted** — an unbounded map is itself a DoS vector.
- Over limit → `429` via `ApiError('RATE_LIMITED', …)` with `Retry-After` in whole seconds.
- Always sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Disabled when `IS_TEST`, so tests are not order-dependent. There is an exported
  `__resetRateLimit()` for the one test that exercises the limiter directly.

###### 2.7 Missing-database behaviour (an F0 acceptance criterion)

Two channels, and both matter:

- **Server console, once at startup.** `probeDatabase()` runs before `serve()`; the server **still
  starts** — it must, or the client would get an opaque proxy failure instead of a designed state.
  On `'missing'`, print to `stderr` (no stack trace, and nothing about how the file is produced):

  ```
  [api] The database was not found.

        Expected at: /abs/path/data/f1.db

        data/f1.db is not part of this repository and is supplied separately.
        Place the file at the path above and restart:  npm run dev

        To use a different location, set F1_DB_PATH.
  ```

  `'unreadable'` → `"The database could not be opened. Check that <dir> is readable and writable by
  this process, then restart."` (this is the ✅ verified `SQLITE_READONLY_DIRECTORY` case — WAL needs
  to create its sidecar files). `'schema'` → `"The database is present but does not contain the
  expected tables."`

  The absolute path appears **only** in this console output. S-6 governs responses.

- **HTTP.** Every `/api/*` call returns `503 { "error": { "code": "DATABASE_UNAVAILABLE",
  "message": "The data is not available." } }`. The client maps this code to the designer's
  "database not available" state (T11).

---

##### 3. Client structure

###### 3.1 File layout — extends `ARCHITECTURE.md` §9, no invention

```
package.json  tsconfig.json  tsconfig.app.json  tsconfig.node.json
vite.config.ts  eslint.config.js  .prettierrc.json  .prettierignore
index.html  .env.example  README.md

server/
  index.ts               entry: probeDatabase() → serve()
  app.ts                 the Hono app, exported without listening (testable)
  config.ts  db.ts  views.ts  coverage.ts  errors.ts
  middleware/rateLimit.ts
  routes/meta.ts
  queries/meta.ts        ALL SQL for this feature
  schemas/meta.ts  schemas/error.ts
  cache/memo.ts

src/
  main.tsx  App.tsx
  routes/
    RootLayout.tsx  SeasonHub.tsx  RaceDeepDive.tsx
    DriverIndex.tsx  DriverProfile.tsx  TeamIndex.tsx  TeamProfile.tsx
    CircuitIndex.tsx  CircuitProfile.tsx  Compare.tsx  Records.tsx  NotFound.tsx
  features/meta/
    useMeta.ts  selectors.ts
  components/
    layout/AppShell.tsx  layout/Header.tsx  layout/PrimaryNav.tsx
    ui/ThemeToggle.tsx  ui/DataVintage.tsx
    ui/LoadingState.tsx  ui/ErrorState.tsx  ui/DataUnavailableState.tsx
    ui/icons.tsx           the eleven inline SVG icons — see §3.10
  lib/
    api.ts  queryClient.ts  theme.ts  format.ts
    motion.ts              minimal F0 motion tokens — see §1.1; F1 completes it
  styles/index.css  styles/fonts.css

public/
  theme-init.js          pre-paint theme application — see §3.6
  fonts/                 six vendored woff2 + OFL.txt — see §3.9
e2e/                     QA-owned, empty in F0
```

Path aliases in `tsconfig.*.json` **and** `vite.config.ts` `resolve.alias` (kept in sync manually —
no extra plugin): `@/*` → `src/*`, `@server/*` → `server/*`, `@schemas/*` → `server/schemas/*`.
Vitest inherits them by extending the Vite config (single `vite.config.ts` with a `test` block).

TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`,
`exactOptionalPropertyTypes: true`, `noUnusedLocals`, `noUnusedParameters`,
`verbatimModuleSyntax: true`. ESLint bans `any`
(`@typescript-eslint/no-explicit-any: error`) and non-null assertions
(`no-non-null-assertion: error`). `any` is a review failure (`ARCHITECTURE.md` §2).

###### 3.2 `src/lib/api.ts`

```ts
export async function apiGet<T>(path: `/api/${string}`, schema: z.ZodType<T>): Promise<T>;
export class ApiRequestError extends Error {
  constructor(readonly code: ErrorCode | 'NETWORK' | 'MALFORMED', readonly status: number | null,
              message: string) { … }
}
```

- `fetch(path, { headers: { Accept: 'application/json' } })` — same-origin relative URL only. The
  signature's template-literal type makes an absolute URL a **compile error**, so DL-2 is enforced
  by the type system rather than by review.
- `!res.ok` → parse the body with `apiErrorSchema`; on success throw `ApiRequestError(code, status,
  message)`; on failure throw `ApiRequestError('MALFORMED', status, …)`.
- `res.ok` → `schema.safeParse`; failure → `ApiRequestError('MALFORMED', …)`. **A server response
  that does not match its schema is an error, not something to render.**
- No retry logic here — TanStack Query owns retries.

###### 3.3 `src/features/meta/useMeta.ts`

```ts
export const metaQueryKey = ['meta'] as const;
export function useMeta(): UseQueryResult<Meta, ApiRequestError>;
// queryFn: () => apiGet('/api/meta', metaSchema)
// staleTime 5 min, gcTime 30 min, retry: (n, e) => e.code !== 'DATABASE_UNAVAILABLE' && n < 1
```

Never retry `DATABASE_UNAVAILABLE` — on a fresh clone it will not resolve, and retrying only delays
the designed state. `queryClient.ts` defaults: `refetchOnWindowFocus: false`,
`staleTime: 5 * 60_000`, `retry: 1`. Server data lives in TanStack Query and is **never** mirrored
into React state (`ARCHITECTURE.md` §3).

###### 3.4 Pure selectors — `src/features/meta/selectors.ts`

Where F0's logic lives. Every one is pure, synchronous, React-free, and unit-tested.

```ts
export interface DataVintage {
  /** e.g. "2026-07-19" */         isoDate: string;
  /** e.g. "Belgian Grand Prix" */ roundName: string;
  /** e.g. 2026 */                 year: number;
  /** e.g. 10 */                   round: number;
  /** e.g. "Results through 2026 round 10 — Belgian Grand Prix, 19 Jul 2026" */ label: string;
  /** e.g. "10 of 22 rounds complete" */ progressLabel: string;
}
/** null when the data holds no completed round at all. */
export function selectDataVintage(meta: Meta): DataVintage | null;

export function selectSeasonOptions(meta: Meta): number[];        // [2026, 2025, …, 1950], desc
export function selectDefaultSeason(meta: Meta): number;          // latestCompletedRound.year ?? seasons.latestYear
export function isSeasonInCoverage(meta: Meta, key: keyof Meta['coverage'], year: number): boolean;
export function selectCoverageNotice(meta: Meta, key: keyof Meta['coverage'], year: number): string | null;
export function selectSeasonProgress(meta: Meta): { completed: number; scheduled: number; ratio: number };
```

- `selectSeasonOptions` derives from `firstYear`/`latestYear` — ✅ safe because the year sequence was
  verified contiguous (§1.6).
- `isSeasonInCoverage` treats `to: null` as open-ended. This is the single function every later
  feature calls for NV-8; nobody hard-codes `1996`.
- `selectCoverageNotice` returns copy like `"Lap data is available from 1996 onwards."` — final
  wording is the designer's; the function signature is fixed here.
- `selectSeasonProgress` returns `ratio: 0` when `scheduled === 0` — **never `NaN`**.
- Date formatting goes through `lib/format.ts` (`formatIsoDate`, locale-stable, UTC — no
  `toLocaleDateString` without an explicit locale, or tests differ per machine).

###### 3.5 Component tree

```
<QueryClientProvider>
  <BrowserRouter>
    <Routes>
      <Route element={<RootLayout/>}>            ← AppShell + <Outlet/>
        "/"                       <SeasonHub/>
        "/seasons/:year"          <SeasonHub/>
        "/seasons/:year/races/:round"  <RaceDeepDive/>
        "/drivers"  "/drivers/:driverRef"
        "/teams"    "/teams/:teamRef"
        "/circuits" "/circuits/:circuitRef"
        "/compare"  "/records"
        "*"                       <NotFound/>
```

Route table is `ARCHITECTURE.md` §5 verbatim — 11 routes plus the catch-all. Every route component
in F0 is a placeholder that renders its name and its resolved params; **none fetches anything.**

| Component | Props |
|---|---|
| `AppShell` | `{ children: ReactNode }` |
| `Header` | `{}` — composes `PrimaryNav`, `ThemeToggle`, `DataVintage` |
| `PrimaryNav` | `{ items: ReadonlyArray<{ to: string; label: string }> }` |
| `ThemeToggle` | `{}` — owns theme via `lib/theme.ts` |
| `DataVintage` | `{ vintage: DataVintage \| null; state: 'loading' \| 'ready' \| 'unavailable' }` — **pure and presentational; it does not call `useMeta`.** `Header` calls `useMeta`, runs `selectDataVintage`, and passes the result down (`ARCHITECTURE.md` §3: components never fetch) |
| `LoadingState` | `{ label?: string }` |
| `ErrorState` | `{ title: string; detail?: string; onRetry?: () => void }` |
| `DataUnavailableState` | `{}` — the "database not available" state; fixed copy from the Design Spec |

Route-level code splitting is **not** introduced in F0 (nothing to split — no charts, no visx). The
boundary is specified in §6.4 so F1/F3 land it.

###### 3.6 Theme — `src/lib/theme.ts`

```ts
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'f1a.theme';
export function readThemePreference(): ThemePreference;        // invalid/absent → 'system'
export function resolveTheme(p: ThemePreference): ResolvedTheme;
export function applyTheme(t: ResolvedTheme): void;            // <html data-theme="…">
export function setThemePreference(p: ThemePreference): void;  // persist + apply
export function subscribeToSystemTheme(cb: (t: ResolvedTheme) => void): () => void;
```

- Applied as `document.documentElement.dataset.theme`. Tailwind v4 needs an explicit custom variant
  (✅ verified against the Tailwind v4 docs) — in `src/styles/index.css`:

  ```css
  @import "tailwindcss";
  @custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
  ```

- **First load respects `prefers-color-scheme`** because the default preference is `'system'`.
- `subscribeToSystemTheme` keeps `'system'` live while the tab is open; it is a no-op once the user
  picks explicitly.
- `localStorage` access is wrapped in `try/catch` (Safari private mode throws) and degrades to
  `'system'`. Corrupt stored values fall back to `'system'`, never crash.
- **Pre-paint application without violating CSP.** An inline `<script>` in `index.html` would be the
  usual trick, but `script-src 'self'` forbids it (S-9). So: `public/theme-init.js`, a few lines,
  loaded **synchronously** in `<head>` before the stylesheet — external, `'self'`, no FOUC, no CSP
  exception. It duplicates only the read-and-apply step; the storage key and attribute name are
  asserted identical by a unit test.

###### 3.7 URL params owned by F0

**None.** F0 introduces no query parameters. `:year`, `:round` and the `:*Ref` slugs belong to
F2–F6; F0's placeholders display them unvalidated. Slugs, never integer ids (DL-3, trap 11).

###### 3.8 Running client + API together

```json
"dev":        "concurrently -n api,web -c magenta,cyan \"npm:dev:api\" \"npm:dev:web\"",
"dev:api":    "tsx watch server/index.ts",
"dev:web":    "vite",
"build":      "tsc -b && vite build",
"start":      "NODE_ENV=production tsx server/index.ts",
"typecheck":  "tsc -b --noEmit",
"lint":       "eslint .",
"format":     "prettier --write .",
"format:check":"prettier --check .",
"test":       "vitest run",
"test:watch": "vitest"
```

Vite dev server proxies `/api` → `http://localhost:8787` (`server.proxy`), so the browser sees one
origin in dev and same-origin holds in production too. **No `--kill-others`**: if the API exits, the
client keeps serving and shows its designed state.

In production `server/index.ts` serves `dist/` via `@hono/node-server/serve-static` with an
SPA fallback to `index.html` for non-`/api` paths — from a **fixed** root, never a user-supplied
path (S-2).

###### 3.9 Fonts — ✅ DECIDED: vendored `woff2`, **no dependency**

**Verdict (routed to me as G.4 item 3 / ruling R-6): vendor the files. The three
`@fontsource-variable/*` packages are NOT added.** `ARCHITECTURE.md` §10 decision **#17**.

Three reasons, in order of weight:

1. **Stable, literal asset URLs.** Files in `public/` are served verbatim, so
   `<link rel="preload" href="/fonts/inter-latin.woff2">` is a fixed string in `index.html`. Imported
   from `node_modules`, Vite content-hashes the filename, and preloading it then requires reading the
   build manifest or adding a plugin. Avoiding a font flash on first paint is an F0 concern
   (`DataVintage` and the nav are text), so this is not a stylistic preference.
2. **The `@font-face` family names match the design tokens exactly.** `DESIGN_SYSTEM.md` §2.2 fixes
   `--font-display: Archivo, …`. Fontsource's CSS declares `'Archivo Variable'` / `'Inter Variable'`,
   which would force either a token change or a second alias. We author the `@font-face` block, so
   the family name is simply `Archivo`.
3. **No dependency at all** — S-7/S-14, and the orchestrator's stated preference. Worth being honest
   about how much this one is worth: all three packages carry **no `dependencies` and no install
   scripts** (✅ verified via `npm view`), so the supply-chain delta was small either way. Reasons 1
   and 2 are the decisive ones; this one confirms rather than drives.

**Acquisition — exact, re-runnable, and integrity-checked.** "Get them from upstream" is not
implementable, so this is the procedure. It uses `npm pack`, which fetches a **published, immutable
tarball whose integrity npm verifies**, and it adds nothing to `package.json`:

```bash
mkdir -p public/fonts && cd "$(mktemp -d)"
for p in archivo inter chivo-mono; do
  npm pack "@fontsource-variable/$p@5.3.0"
  tar xzf "fontsource-variable-$p-5.3.0.tgz"
  mv package "$p"
done
```

Then copy **exactly these six files**, renaming as shown, and verify:

| From the extracted package | → `public/fonts/` | Size | `sha256` |
|---|---|---|---|
| `archivo/files/archivo-latin-wdth-normal.woff2` | `archivo-latin.woff2` | 90.1 kB | `e3a28eade21a900c7155a247757f4b2834c07bb7ef07ad7efa55cebaac1e8f5e` |
| `archivo/files/archivo-latin-ext-wdth-normal.woff2` | `archivo-latin-ext.woff2` | 86.2 kB | `5717f37059660ca5c899bad6c48ee22c3ac55cb3c484055241689d0f905a1a86` |
| `inter/files/inter-latin-opsz-normal.woff2` | `inter-latin.woff2` | 72.9 kB | `2c295d99e26dcf357d4d01bcf270fd6924b600c9a13dd8c363ef114f4c6976fa` |
| `inter/files/inter-latin-ext-opsz-normal.woff2` | `inter-latin-ext.woff2` | 133.3 kB | `5e6d4fe9d9f4bff8b2a2469d25ab19576bb85331e22c6ed51398e16f95d56a9c` |
| `chivo-mono/files/chivo-mono-latin-wght-normal.woff2` | `chivo-mono-latin.woff2` | 26.3 kB | `c00775f8ecb034b6c193c7b253d698cfe882a1d6c0df67299a3d5382c2e82216` |
| `chivo-mono/files/chivo-mono-latin-ext-wght-normal.woff2` | `chivo-mono-latin-ext.woff2` | 22.9 kB | `479a6414d1d35c272018d9a6effde625afbac888bf75c48868652284cbb8b7d6` |

`shasum -a 256 public/fonts/*.woff2` must reproduce the six values above (T8). The hashes are the
point: they are what makes a vendored binary reviewable, and they let the `reviewer` re-derive the
files independently instead of trusting a copy step.

**Why those axis variants, and not the smaller ones.** Fontsource's suffix names the axis set it
ships, and the design needs more than `wght`:

- **Archivo `wdth`** (wdth + wght), not `wght`. `DESIGN_SYSTEM.md` §2.3 sets every display token at
  **`wdth 82`**; the `wght`-only file is instanced at `wdth 100` and cannot express it. Cost of the
  axis: 90.1 kB vs 34.9 kB for `latin`.
- **Inter `opsz`** (opsz + wght), not `wght`. §2.1 specifies `opsz 14–20`. Cost: 72.9 kB vs 48.3 kB.
- **Chivo Mono `wght`** — the family has only that axis, so this is the full variable font.

**No axis instancing or re-subsetting is performed, and the developer must not attempt it.** Pinning
Archivo to `wdth 82` in the *binary* would need `fonttools varLib.instancer` — a Python toolchain that
is not part of this project and would be an unreviewable build step. The axis stays in the file and is
selected in CSS, which is the supported mechanism.

**`src/styles/fonts.css`** — imported from `src/styles/index.css`. Six `@font-face` blocks, one per
file. The `unicode-range` values are **copied verbatim** from the source packages' CSS (✅ read from
all three; the `latin` and `latin-ext` ranges are byte-identical across the three families) and must
not be retyped from memory — a wrong range silently falls back to a system font:

```css
/* latin */     unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,
                               U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,
                               U+2212,U+2215,U+FEFF,U+FFFD;
/* latin-ext */ unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,
                               U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,
                               U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;
```

Per-face descriptors:

| `font-family` | Files | Descriptors |
|---|---|---|
| `Archivo` | `archivo-latin*.woff2` | `font-weight: 100 900; font-stretch: 62% 125%; font-style: normal; font-display: swap` |
| `Inter` | `inter-latin*.woff2` | `font-weight: 100 900; font-style: normal; font-display: swap` |
| `Chivo Mono` | `chivo-mono-latin*.woff2` | `font-weight: 100 900; font-style: normal; font-display: swap` |

- `src: url("/fonts/….woff2") format("woff2-variations")` — **root-relative, same-origin**. An
  absolute URL here is a DL-2/S-9 violation and the CSP (`font-src 'self'`) will block it.
- **The declared descriptor ranges are the file's real ranges, not the design's.** Narrowing
  `font-weight` to `600 700` would make the browser *synthesize* weights outside it. The design
  restricts usage; the `@font-face` describes the file.
- **`wdth 82` is applied at the use site**, in the display tokens: `font-stretch: 82%`. Never
  `font-variation-settings`, which bypasses the cascade for other axes.
- **`opsz` needs no declaration.** `font-optical-sizing: auto` is the default, and Inter is only used
  at 11–18px (§2.3), so the axis is exercised across roughly 14–18 with the axis minimum clamping the
  rest — which is what §2.1's "`opsz 14–20`" asks for. Do not add `font-variation-settings: "opsz" …`.
- **No `zero` feature anywhere** (§2.4) — Chivo Mono's plain zero is the default; enabling `zero`
  would break it.

**Preload exactly two faces** in `index.html`, both `latin`:
`<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>` and
the same for `/fonts/archivo-latin.woff2`. `crossorigin` is **required even same-origin** for font
preload; without it the browser fetches the file twice. **Chivo Mono is not preloaded** — figures
appear only once `/api/meta` resolves, so it is not on the first-paint path.

**Coverage note — `latin-ext` is real but almost never fetched.** ✅ Checked against the data: across
`driver`, `team`, `circuit` and `round` names, **exactly one** string in the whole dataset contains a
codepoint outside `latin` — one driver's forename (a Czech caron). Circuit, team and round names are
all within `latin`. So the three `latin-ext` faces (242.4 kB) exist so that **one driver's name is
spelled correctly**, and `unicode-range` means they are downloaded only on the pages that render it.
Shipping them is right, preloading them would be wrong, and dropping them would be a visible
misspelling — the fallback would substitute a system glyph mid-word.

**Licence — `public/fonts/OFL.txt` is mandatory, not a nicety.** The SIL OFL 1.1 requires the licence
and copyright notices to accompany the fonts in any distribution, and this repository is public. The
file contains the **full OFL 1.1 text once**, preceded by the three copyright lines exactly as they
appear in each source package's `LICENSE` (✅ read from all three):

```
Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo)
Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)
Copyright 2018 The Chivo Project Authors (https://github.com/Omnibus-Type/Chivo)
```

A reserved-font-name clause applies: **do not rename the families.** `Archivo`, `Inter` and
`Chivo Mono` are used unmodified, which keeps us clear of it.

**A font CDN remains forbidden outright** (DL-2, S-9) — including `fonts.googleapis.com`,
`fonts.gstatic.com`, jsDelivr and unpkg **at runtime**. The `npm pack` above is a one-off developer
action on a workstation, not a request path; nothing in the shipped application fetches a font from
anywhere but this origin, and `font-src 'self'` enforces it in the browser.

###### 3.10 Icons — ✅ DECIDED: eleven inline SVGs, **no dependency**

**Verdict (G.4 item 3 / ruling R-7): `lucide-react` is NOT added.** `ARCHITECTURE.md` §10 decision
**#18**.

- **No dependency** (S-7/S-14) for eleven glyphs.
- **`lucide-react` is a barrel export over ~1,600 icon modules.** In Vite dev, a barrel import forces
  the dev server to resolve and transform the whole set on first request — a well-known cold-start
  cost. The production build tree-shakes it, so this is a developer-experience cost rather than a
  shipped one, but it is a real cost for zero benefit at this size.
- **`DESIGN_SYSTEM.md` §2.5's "one set: Lucide" is preserved**, because the geometry *is* Lucide's —
  we copy the path data rather than redraw it. §2.5's ban on a second icon set is unaffected: new
  glyphs are added to this same file from this same source. **Never hand-draw an icon.**

**Acquisition — same mechanism as the fonts, no dependency:**

```bash
cd "$(mktemp -d)" && npm pack lucide-static@1.28.0 && tar xzf lucide-static-1.28.0.tgz
# glyph geometry is then in package/icons/<kebab-name>.svg
```

✅ All eleven verified present in `lucide-static@1.28.0` (ISC):

| Design Spec name | Source file |
|---|---|
| `Menu` | `icons/menu.svg` |
| `X` | `icons/x.svg` |
| `Sun` | `icons/sun.svg` |
| `Moon` | `icons/moon.svg` |
| `Monitor` | `icons/monitor.svg` |
| `Check` | `icons/check.svg` |
| `ChevronDown` | `icons/chevron-down.svg` |
| `Database` | `icons/database.svg` |
| `AlertTriangle` | `icons/alert-triangle.svg` |
| `RefreshCw` | `icons/refresh-cw.svg` |
| `ArrowRight` | `icons/arrow-right.svg` |

**`src/components/ui/icons.tsx`** — one shared wrapper, eleven bodies. Copy each source file's child
elements **verbatim**; change nothing about the geometry.

```tsx
// Icon geometry from Lucide (lucide-static@1.28.0) — ISC License.
// Copyright (c) 2026 Lucide Icons and Contributors. Full text: see the notice below.
export type IconProps = { size?: 16 | 20; className?: string; };
// <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
//      strokeLinecap="round" strokeLinejoin="round" width={size} height={size}
//      aria-hidden="true" focusable="false"> … </svg>
```

- **`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeLinecap`/`strokeLinejoin`
  `"round"`** — ✅ read from the source files, which are authored on that 24px grid.
- **`strokeWidth={1.5}`, overriding Lucide's source `2`.** `DESIGN_SYSTEM.md` §2.5 fixes 1.5px. This
  is the one intentional deviation from the source file and the only one permitted.
- **`size` is `16 | 20` only** — a union, not `number`, so an off-scale icon is a **compile error**
  (§2.5 allows exactly those two sizes).
- **`aria-hidden="true"` and `focusable="false"` on every icon, always.** Icons never carry meaning
  alone (§2.5); the accessible name lives on the parent control. An icon-only button therefore needs
  `aria-label` on the *button* — `ThemeToggle`'s name is specified in Design Spec §5.2.
- **The full ISC licence text goes in the file header comment**, not in a separate file: ISC requires
  the notice to accompany the copies, and eleven path strings inside one module are one file's worth
  of copying. Do not strip it in a "tidy-up" pass.
- **No `<title>`, no `id`, no `class` from the source files.** Lucide's static SVGs carry a
  `class="lucide lucide-<name>"` that must be dropped; styling comes from `className`.

---

##### 4. Derived metric definitions

F0 computes no F1 metric — no points, no positions, no pace. `REQUIREMENTS.md` §5.1 and §5.2 are
therefore not engaged, and **cross-era normalization cannot be got wrong here because nothing is
aggregated across seasons.** F0's job is to make later normalization possible by shipping
`coverage` and `latestSeason` from one authority.

Four definitions are nonetheless fixed here because later features inherit them:

| Term | Definition |
|---|---|
| **Completed round** | A non-cancelled round with `number IS NOT NULL` whose `type='R'` session has ≥1 `session_entry` row. **Never** "date is in the past" — `REQUIREMENTS.md` §2.2. |
| **Scheduled rounds** (a season) | `round` rows for that season with `is_cancelled = 0`. Cancelled rounds are counted separately and are never presented as missing results (trap 12). For 2026 this is **22**, not 24. |
| **Data vintage** | The `date` of the latest completed round — 2026-07-19 today. A property of the data, expressed only in terms of the sport's own calendar. |
| **Coverage window** | The inclusive `[from, to]` season range in which a data class exists; `to: null` = open through `seasons.latestYear`. Values in §1.7, mirroring `DATABASE.md` §4. |

---

##### 5. Edge cases — decided, not deferred

| # | Case | Required behaviour |
|---|---|---|
| E1 | **Database file absent** (fresh clone) | Server starts; console prints §2.7; every `/api/*` → `503 DATABASE_UNAVAILABLE`; client renders `DataUnavailableState`. No stack trace anywhere. |
| E2 | **Database present but directory not writable** | ✅ `SQLITE_READONLY_DIRECTORY`. Reason `'unreadable'`; console explains the directory must be readable **and writable**; HTTP `503`. |
| E3 | **File present but not a database** | ✅ `SQLITE_NOTADB` → `'unreadable'` → `503`. Never leak the SQLite message. |
| E4 | **Valid SQLite, missing tables** | ✅ `no such table: season` → `'schema'` → `503` with the schema-specific console line. |
| E5 | **Empty `season` table** | `Q_SEASON_RANGE` returns all-NULL → treat as `'schema'` → `503`. `metaSchema` must not be handed nulls. |
| E6 | **No completed round anywhere** | `latestCompletedRound: null`, `nextScheduledRound` = earliest scheduled. `selectDataVintage` → `null`; `DataVintage` renders its unavailable variant. Cannot occur with today's data; must not crash. |
| E7 | **Season fully complete** (e.g. 2025) | `isComplete: true`, `nextScheduledRound` points at the next season's R1 if present, else `null`. |
| E8 | **Partially complete current season** | ✅ The live case: 10 of 22. `isComplete: false`. Future rounds are *scheduled*, never *missing* (trap 13). |
| E9 | **Cancelled rounds** | ✅ `round.number IS NULL` (§0.3). Excluded from `scheduledRounds`/`completedRounds`, surfaced as `cancelledRounds: 2`, and never selectable as a "latest"/"next" round. Trap 12 + new trap 15. |
| E10 | **Pre-1996 / pre-2011 / pre-1994 season** | F0 ships the windows; it renders no gated surface. `isSeasonInCoverage(meta,'laps',1975)` must return `false` and is unit-tested. |
| E11 | **Practice** | Out of scope permanently (trap 2). No `coverage.practice` key exists — the schema makes the feature unrepresentable. |
| E12 | **`session.has_time_data`** | Never read. Not in any query, not in any schema. Trap 1. |
| E13 | **Unknown route** (`/nonsense`) | `<NotFound/>` inside the shell — header and nav still work. |
| E14 | **Unknown API path** | `404 { error: { code: 'NOT_FOUND', … } }` as JSON, not HTML. |
| E15 | **Non-GET on `/api/meta`** | Falls through to the 404 handler. No mutation route exists anywhere (DL-1). |
| E16 | **Rate limit exceeded** | `429` + `Retry-After`. Client surfaces `ErrorState` with a retry; TanStack Query does not hammer. |
| E17 | **Malformed response** (schema drift) | `apiGet` throws `MALFORMED`; `ErrorState`, never a half-rendered view. |
| E18 | **`localStorage` unavailable / corrupt theme value** | Falls back to `'system'`; toggle still works for the session. |
| E19 | **`prefers-color-scheme` unsupported** | `resolveTheme('system')` → `'light'`. |
| E20 | **Teams with no `primary_color`, 1/4-entity comparison, duplicate selection** | N/A to F0 — no entity selection, no charts, no colour resolution. F1 (`teamColor.ts`) and F7 own these. Listed so the omission is explicit, not accidental. |
| E21 | **Mid-season team change** (two `team_driver` rows) | N/A to F0 — no driver surface. F4/F5. |
| E22 | **Empty result set from a meta query** | Every meta query has a defined zero-row behaviour: E5, E6, E7. No `undefined` reaches Zod. |

---

##### 6. Performance plan

###### 6.1 Applicable budget

`ARCHITECTURE.md` §8: **API p95 < 50 ms for a non-lap endpoint** and **initial JS bundle
< 250 KB gzipped**. FCP budgets attach to F2/F3 surfaces, not to F0's shell — but the shell is on
the critical path of both, so the bundle number is the one that binds F0.

✅ Measured: all four meta queries together **0.937 ms** warm — ~2% of the budget. No risk.

**Two figures exist and they measure different things — do not treat either as a correction of the
other.**

| Figure | What it includes | Source |
|---|---|---|
| **0.937 ms** | The four **prepared** statements executing, warm — i.e. the steady state of every request after the first | mine, §0.2 |
| **18.01 ms** | **Cold start**: opening the connection, creating the two temp views, *preparing* the four statements, and executing them once | orchestrator, Node 22 |

Both are inside the 50 ms budget, and the second is the one a reader should have in mind for the
**first** request after a process start; it is paid once per process, not per request. The warm figure
is the one the p95 budget is measured against, because p95 over any realistic request volume is a warm
number. **The memo in §6.2 makes even the cold path a once-per-five-minutes event.** Neither figure
needs re-measuring for F0; T13's job is the bundle, not these.

###### 6.2 Cache strategy

Three layers, cheapest first:

1. **In-process memo** — `server/cache/memo.ts`:
   ```ts
   export function memoize<T>(key: string, ttlMs: number, produce: () => T): T;
   export function invalidateMemo(key?: string): void;   // test-only
   ```
   `/api/meta` memoised under `'meta'` for 300,000 ms. This is the DL-4 pattern every later
   aggregate endpoint reuses, established now on a trivial case.
2. **HTTP** — `Cache-Control: public, max-age=300`.
3. **Client** — TanStack Query `staleTime` 5 min, `gcTime` 30 min.

TTL rather than "cache forever": the database is immutable *between* refreshes, and a refresh
changes exactly what this endpoint reports. Five minutes keeps the vintage indicator honest at no
measurable cost.

###### 6.3 Downsampling

N/A — F0 touches no lap-scale data. The precedent it must **not** set is an unbounded `lap` query;
§1.6's query-plan evidence shows the canonical views keep `idx_lap_entry` in play for F3.

###### 6.4 Code-splitting boundary

F0 introduces none, and that is deliberate — splitting an app with two rendered components adds
waterfall for no gain. The boundary is fixed here so F1/F3 do not invent one:

- **Always in the initial chunk:** `AppShell`, `PrimaryNav`, `ThemeToggle`, `DataVintage`,
  `lib/*`, `features/meta/*`, router, TanStack Query, **and `framer-motion`** — the F0 motion subset
  (§1.1, ruling R-1) is in the shell and on the critical path of every route, so it cannot be split
  out. It is the single largest item in the baseline and the reason the baseline is worth measuring.
- **`React.lazy` per route from F1 onward**, one chunk per route module.
- **`recharts` must not appear in the initial chunk**; **`visx` must load only on the race deep
  dive** (`ARCHITECTURE.md` §8).
- T13 records the actual gzipped initial-chunk size in this section so F10 has a real baseline
  rather than an estimate. Record **`framer-motion`'s own share** of it separately (Vite's build
  output attributes it), because F1 adds the rest of the motion set against this number.
- **Fonts are not JS and sit outside the 250 KB budget, but they are on the same critical path.**
  T13 records the first-paint font weight too: **189.3 KB** across the three `latin` faces (§3.9),
  with the three `latin-ext` faces (242.4 KB) excluded from first paint by `unicode-range` and, on
  today's data, fetched by exactly one page in the product. Both figures are already known from the
  vendored files; T13's job is to confirm the built app requests only the `latin` three.

---

##### 7. Unit test list

Vitest. Server and pure-logic tests in the `node` environment; the three component tests in
`jsdom`. Named exactly as the developer must create them.

**`server/db.test.ts`** — needs `data/f1.db`; skip with a clear message via
`describe.skipIf(!existsSync(DB_PATH))` so the suite still passes on a machine without it.
1. opens read-only and answers `SELECT 1`
2. `getDb()` twice returns the identical handle
3. `v_entry` and `v_race` exist in `sqlite_temp_master` after bootstrap
4. `v_race` returns 20 rows for 2024 round 1
5. `INSERT`/`UPDATE` throws `SQLITE_READONLY`
6. `CREATE TEMP VIEW` after bootstrap throws (proves `query_only` latched)
7. a nonexistent path throws `DatabaseUnavailableError` with `reason === 'missing'`
8. **the thrown error's message contains no absolute path** (S-6 at the source)

**`server/queries/meta.test.ts`** — same skip guard; asserts the ✅ §0.2 values exactly.
9. season range is `1950 / 2026 / 77`
10. latest completed round is 2026 R10, `spa`, `2026-07-19`
11. latest season progress is `22 / 2 / 10`
12. next scheduled round is 2026 R11 `hungaroring`
13. **no returned row exposes an integer id** (DL-3) — assert the key sets
14. **cancelled rounds never appear** as latest or next
15. `metaSchema.parse` succeeds on the real payload — the outbound contract holds against real data

**`server/schemas/meta.test.ts`** — pure, no database.
16. accepts the §2.2 fixture
17. rejects `round: 0` and `round: null` inside `roundRefSchema`
18. rejects a non-`YYYY-MM-DD` date
19. accepts `latestCompletedRound: null`
20. accepts `coverage.*.to === null`
21. rejects an unknown `coverage` key / missing key
22. `apiErrorSchema` rejects an unknown error code

**`server/errors.test.ts`**
23. `ApiError` maps each code to the right status
24. the error handler turns an arbitrary `Error` into `500 INTERNAL` with the fixed message
25. **no handler output contains `'/'`-prefixed paths, `SQLITE_`, or the word `select`** — a
    mechanical S-6 guard over every branch
26. `DatabaseUnavailableError` → `503 DATABASE_UNAVAILABLE`

**`server/middleware/rateLimit.test.ts`** (fake timers)
27. allows exactly `max` requests in a window
28. request `max + 1` returns 429 with `Retry-After`
29. the window resets after `windowMs`
30. two different IPs get independent buckets
31. the map never exceeds `maxTrackedClients`

**`server/cache/memo.test.ts`**
32. `produce` runs once within the TTL
33. `produce` re-runs after the TTL
34. `invalidateMemo` forces a re-run

**`src/features/meta/selectors.test.ts`** — the correctness core. Fixtures: the real payload,
a complete season, an empty-data payload, a no-completed-round payload.
35. `selectDataVintage` returns round 10 / `2026-07-19` / "Belgian Grand Prix"
36. `selectDataVintage` label contains the round name and the formatted date
37. `selectDataVintage` returns `null` when `latestCompletedRound` is `null`
38. `selectSeasonOptions` returns 77 years, descending, `[0] === 2026`, last `=== 1950`
39. `selectDefaultSeason` is 2026 for the real payload
40. `selectDefaultSeason` falls back to `seasons.latestYear` when no round is completed
41. `isSeasonInCoverage('laps', 1995)` is `false`; `1996` is `true`; `2026` is `true`
42. `isSeasonInCoverage('pitStops', 2010)` `false`, `2011` `true`
43. `isSeasonInCoverage('qualifying', 1993)` `false`, `1994` `true`
44. `isSeasonInCoverage` honours a closed `to` window
45. `selectCoverageNotice` returns `null` inside the window and a string outside it
46. `selectSeasonProgress` is `{10, 22, 10/22}`
47. `selectSeasonProgress` returns `ratio: 0` — **not `NaN`** — when `scheduled === 0`
48. every selector is a no-op on repeated calls (no mutation of the input) — deep-freeze the fixture

**`src/lib/theme.test.ts`** — the model is **three-valued** (`light | dark | system`), and every test
below exercises it as three values, not as a binary with a modifier (ruling R-2).
49. absent storage → `'system'`, which is what makes a first-time visitor follow
    `prefers-color-scheme` (an F0 acceptance criterion)
50. an unknown or corrupt stored value → `'system'` — assert at least `'auto'`, `'Dark'`, `'{}'` and
    `''`, so a near-miss string is not silently honoured
51. `resolveTheme` maps **all three** preferences: `'light'` → `'light'`, `'dark'` → `'dark'`, and
    `'system'` → whatever the `matchMedia` mock reports, verified in **both** directions
52. `applyTheme` sets `data-theme` on `<html>` to the **resolved** theme — assert it is never set to
    the literal `'system'`, because the CSS has no such state
53. `setThemePreference` round-trips **each of the three values** through storage and applies the
    correct resolved theme for each
54. a throwing `localStorage` does not throw out of `readThemePreference` **or**
    `setThemePreference` — the control must still work when persistence cannot
55. **`public/theme-init.js` uses the same storage key and attribute as `lib/theme.ts`** — read the
    file and assert, so the two cannot drift

**`src/lib/api.test.ts`** (mocked `fetch`)
56. valid response → parsed, typed value
57. `503` with a valid error envelope → `ApiRequestError` with `code: 'DATABASE_UNAVAILABLE'`
58. `500` with an HTML body → `code: 'MALFORMED'`
59. a `200` that fails the schema → `code: 'MALFORMED'`
60. a network rejection → `code: 'NETWORK'`

**`src/lib/format.test.ts`**
61. `formatIsoDate('2026-07-19')` is stable and locale-independent
62. an invalid date string returns the input unchanged, never `"Invalid Date"`

**Component tests (jsdom) — seven, still deliberately few.** Rendering is the designer's gate (4)
and QA's (9); these cover branch logic and **ARIA semantics** that only exist in a tree. Four of the
seven are `ThemeToggle` keyboard tests, and they exist because ruling R-2 makes it a **composite
widget** rather than a button: a screenshot cannot show that `↑` moves within a radiogroup or that
focus returns to the trigger, and those are exactly the things that break silently.
63. `DataVintage` renders the label for `state='ready'`, a skeleton for `'loading'`, and the
    unavailable variant for `'unavailable'`
64. `ThemeToggle` is a **3-option radiogroup popover, not a cycle** (Design Spec §5.2): the trigger
    exposes `aria-expanded`, activating it renders an element with `role="radiogroup"` and
    `aria-label="Theme"` containing exactly **three** `role="radio"` options labelled "System",
    "Light", "Dark", with `aria-checked` true on **exactly one** — the current preference. Assert
    that repeated activation of the trigger **opens and closes** the popover and never mutates the
    preference; a click on the trigger must change nothing.
65. `NotFound` renders inside `AppShell` (nav still present) for an unknown path
66. `ThemeToggle` **selection**: with the popover open, `↑`/`↓` move `aria-checked`/focus within the
    group without committing, and `Enter` **and** `Space` each commit the focused option, close the
    popover and set `document.documentElement.dataset.theme` to the **resolved** theme — assert
    selecting "System" resolves through the `matchMedia` mock rather than writing `'system'` to the
    attribute
67. `ThemeToggle` **dismissal**: `Esc` closes the popover, leaves the preference **unchanged**, and
    returns focus to the trigger (`document.activeElement` is the trigger element)
68. `ThemeToggle` **trigger icon reflects the preference, not the resolved theme** — monitor for
    `system`, sun for `light`, moon for `dark`; assert across all three, with the `matchMedia` mock
    set to dark, so a test that confuses preference with resolution fails
69. `ThemeToggle` **accessible name reports both**, per Design Spec §5.2: the trigger's computed name
    contains the preference *and* the resolved theme (e.g. preference `system` + dark system setting
    → a name mentioning both "System" and "dark"). Assert on the accessible name, not on inner text.

**Total: 69 tests** (was 65; +4, all `ThemeToggle` keyboard/ARIA, added under ruling R-2 — recorded
explicitly rather than absorbed).

**Not unit-tested, by design:** chart rendering (none exists), visual appearance, **motion timing and
easing** — the F0 motion subset (§1.1) is verified at gate 4 by the `designer`, not asserted here,
because a jsdom assertion on a Motion transition tests the mock and not the product — plus
`npm run dev` orchestration and real HTTP round-trips. Those are gates 4 and 9. **One motion-adjacent
exception:** `MotionConfig reducedMotion="user"` and M-7's explicit `useReducedMotion()` are a
**correctness** requirement, not an aesthetic one, and QA asserts them at gate 9 with
`prefers-reduced-motion: reduce` emulation.

---

##### 8. Task breakdown

Ordered. Each is independently committable and sized ≤ half a day. Work down the list.

| # | Task | Acceptance |
|---|---|---|
| **T1** | **Toolchain baseline on Node 22.** `package.json` with the exact §1.1 ranges plus `"engines": { "node": ">=22.22.0" }`; `.nvmrc` containing `22.23.2`; `tsconfig.json` / `.app.json` / `.node.json` with §3.1 strictness and aliases; `eslint.config.js` (flat config, `typescript-eslint` recommended-type-checked, `no-explicit-any: error`, `no-non-null-assertion: error`); `.prettierrc.json`; `.prettierignore`; `.env.example`; all §3.8 scripts. | **`node -v` reports ≥ v22.22.0 before starting** — if not, stop and ask Rishabh to run the §9.3 command rather than working around it. `npm install` completes with **zero `EBADENGINE` warnings**; `npm audit` reports **`found 0 vulnerabilities`** — there is no permitted exception, so *any* high/critical finding blocks (S-7); `npm run typecheck`, `lint`, `format:check` and `test` all exit 0 on the empty project; lockfile committed. |
| **T2** | **Schema-reference hygiene.** `db/schema.sql` is committed and public, and currently overreaches its purpose. Reduce it to the **18 application tables of `DATABASE.md` §2 and nothing else**: remove the one table block that is not part of that contract, and remove every comment that describes anything other than the shape and meaning of a column. Correct the header note claiming the public identifier is `api_id` — the application uses **`reference` slugs**, never `api_id` or `id` (DL-3, trap 11, `ARCHITECTURE.md` §10 #13). Fix the `status` cross-reference to point at `docs/DATABASE.md` §3. | The file defines exactly the 18 tables in `DATABASE.md` §2 — no more, no fewer — verified with `sqlite3 :memory: < db/schema.sql` then `.tables`. **T2's substance is unchanged by CR-005** — the 18-table contract and the `api_id` → `reference` correction are DL-3 / trap-11 correctness matters (Technical Spec §0.7), not consequences of the removed rule; only the two check-based acceptance clauses were struck. |
| **T3** | **`server/db.ts`, `server/views.ts`, `server/config.ts`.** Readonly connection, `CREATE TEMP VIEW` bootstrap of the §6.1 DDL, sentinel check, `PRAGMA query_only = 1`, `DatabaseUnavailableError` mapping, `probeDatabase()`. | Tests 1–8 pass; `v_race` returns 20 rows for 2024 R1; a write throws; a `CREATE TEMP VIEW` after bootstrap throws; the thrown error message contains no absolute path. |
| **T4** | **`server/schemas/*` + `server/coverage.ts` + `server/errors.ts`.** The §2.2 Zod schemas with `z.infer` types, the §1.7 constants, the §2.3 error envelope and codes. | Tests 16–26 pass. `server/schemas/*` imports **only** `zod` — verify with `grep -n "^import" server/schemas/*.ts`. |
| **T5** | **`server/queries/meta.ts` + `server/cache/memo.ts`.** The four §1.3–§1.6 statements as named exports of prepared statements, plus the memo helper. | Tests 9–15 and 32–34 pass; the returned values equal §0.2 exactly. |
| **T6** | **`server/app.ts` + `server/routes/meta.ts` + `server/middleware/rateLimit.ts`.** `secureHeaders` per §2.4, no CORS middleware (with the explanatory comment), rate limiter, `onError`, `notFound`, the `GET /api/meta` handler with outbound `metaSchema.parse` and `Cache-Control`. | `curl -i localhost:8787/api/meta` returns the §2.2 JSON with `content-security-policy`, `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: no-referrer`, `cache-control: public, max-age=300` and **no** `access-control-allow-origin`; `curl /api/nope` → JSON 404; `curl -X POST /api/meta` → JSON 404; tests 27–31 pass. |
| **T7** | **`server/index.ts` + `npm run dev`.** Startup probe with the §2.7 console output, `serve()` on `PORT`, `concurrently` wiring, Vite `/api` proxy. | One `npm run dev` starts both; `/api/meta` is reachable from the client origin; with `F1_DB_PATH=/tmp/nope.db` the console prints the §2.7 block (no stack trace) and `/api/meta` returns `503 DATABASE_UNAVAILABLE`. |
| **T8** | **Vite + React 19 + Tailwind v4 shell boot, fonts, and the motion root.** `vite.config.ts` (React plugin, `@tailwindcss/vite`, aliases mirroring tsconfig, `/api` proxy, `test` block), `index.html`, `src/main.tsx` wrapping the tree in **`<MotionConfig reducedMotion="user">`**, `src/styles/index.css` with the §3.6 `@custom-variant`, plus **the six vendored `woff2` files, `public/fonts/OFL.txt` and `src/styles/fonts.css` exactly per §3.9**, and the minimal `src/lib/motion.ts` token set (§1.1). | `npm run dev:web` serves a page; a Tailwind utility class visibly applies; `@/`, `@server/`, `@schemas/` resolve in both `tsc` and Vite; `npm run build` succeeds. **Fonts:** the six `sha256` values in §3.9 match the committed files (`shasum -a 256 public/fonts/*.woff2`); `public/fonts/OFL.txt` is present with all three copyright lines; the network panel shows the **three `latin` faces only** on a page of ASCII text, all served from **this origin**; **no request to any font host appears in a hard-reloaded network panel filtered to `Font`** — that is the check, not a reading of the code. |
| **T9** | **Client data layer.** `lib/queryClient.ts`, `lib/api.ts`, `lib/format.ts`, `features/meta/useMeta.ts`, `features/meta/selectors.ts`. | Tests 35–48 and 56–62 pass; `apiGet` rejects an absolute URL **at compile time** (add a `// @ts-expect-error` case in the test file to prove it). |
| **T10** | **Router + placeholder routes.** `App.tsx` with all 11 `ARCHITECTURE.md` §5 routes plus `*`, `RootLayout` including **M-2** route-content enter keyed on `location.pathname` with **no exit variant**, and the placeholder route components echoing their params. | Every route in §5 renders on **direct entry** (not just client navigation); `/nonsense` renders `NotFound`; no placeholder issues a network request (verify: empty network tab beyond `/api/meta`); navigating between two routes plays M-2 once and **does not** hold the outgoing view (no exit variant means no `AnimatePresence` exit — a route change must never delay content). |
| **T11** | **App shell + theme + icons + shell motion.** `AppShell`, `Header`, `PrimaryNav`, `ThemeToggle`, `lib/theme.ts`, `public/theme-init.js`, **`src/components/ui/icons.tsx` exactly per §3.10**, and motions **M-1, M-3, M-4, M-5, M-6** plus **M-11** (CSS). `ThemeToggle` is a **3-option radiogroup popover** (Design Spec §5.2) — **not** a cycle. Visual treatment strictly per the Design Spec. | Toggle persists across reload; with no stored preference the OS setting is honoured **on first paint** (no flash) — and the `public/theme-init.js` tag in `<head>` carries **no `defer`, no `async` and no `type="module"`**, since a module script is deferred by specification and would still flash (`DESIGN_SYSTEM.md` §10); tests 49–55, 64 and 66–69 pass; **zero CSP violations in the Vite dev-server console** (`npm run dev`) — this is the **dev** half of the pair in §2.4, and it does **not** discharge T13; the eleven icons render at 16/20px in `currentColor` with a 1.5px stroke and `src/components/ui/icons.tsx` carries the ISC notice. |
| **T12** | **Data-vintage indicator (NV-9) + shell states.** `DataVintage`, `LoadingState`, `ErrorState`, `DataUnavailableState`, wired through `Header` → `useMeta` → `selectDataVintage`, with **M-7** (skeleton pulse, gated on an explicit `useReducedMotion()` — `MotionConfig` does not stop an opacity loop) and **M-8** (skeleton → content crossfade). | The indicator shows the ✅ verified vintage (2026 R10, Belgian Grand Prix, 19 Jul 2026); its copy names **no source of any kind**; pointing `F1_DB_PATH` at a missing file renders `DataUnavailableState` with a `503` in the network tab and no stack trace on screen; tests 63 and 65 pass; with `prefers-reduced-motion: reduce` emulated the skeleton pulse **stops** rather than merely slowing. |
| **T13** | **Production serving + measurement.** `serve-static` for `dist/` with SPA fallback from a fixed root, `NODE_ENV=production` path, CSP verified against the real build. | `npm run build && npm run start` serves the app on one origin; **zero CSP violations in the production-preview console** — the **build** half of the §2.4 pair, and the only evidence on which the `styleSrcAttr` allowance may be removed (remove it, re-verify both consoles, and if removal breaks **dev** only, adjust the dev server, not the policy); the gzipped initial-chunk size **and `framer-motion`'s share of it** are measured and written into §6.4; the network panel confirms the built app requests only the three `latin` font faces from this origin. |
| **T14** | **Documentation edits (ship in this PR).** `docs/DATABASE.md`: add **trap 15**, annotate §6.1 with how the views are created, extend §9 to cover `server/coverage.ts` **and the two-direction trap-15 check** (a NULL count alone cannot detect a numbered cancelled round). `README.md`: setup, the Node requirement, the scripts, and the fact that `data/f1.db` is supplied separately — stated in exactly that much detail and no more. Exact text in §9.1. | `docs/` and code agree. A reader can go from a fresh clone to a running app from the README alone. |

**14 tasks.** T1–T7 are server-side and unblock nothing visual; T8–T13 need the Design Spec (gate 2)
in place. T2 and T14 are doc hygiene and can be done at any point — T2 early, since `db/schema.sql`
is a committed file that later tasks read as the schema reference.

---

##### 9. Document impact, escalations, open questions

###### 9.1 Documentation edits the developer must make

**`docs/DATABASE.md` §7 — append trap 15:**

> | 15 | Cancelled rounds have `round.number IS NULL` | All `is_cancelled = 1` rounds (2 rows, both 2026) carry a NULL `number`, so `ORDER BY r.number` sorts them **first** and they are not addressable by round number. Every round-number query needs `AND r.number IS NOT NULL`. A season's numbered-round count is `max(number)`, not `count(*)` — 2026 has 24 `round` rows but 22 numbered rounds. **On the data as it stands the equivalence is exact in both directions** — 0 rounds are cancelled-and-numbered, 0 are uncancelled-and-unnumbered, and `is_cancelled` is non-NULL on all 1,173 rows — so `AND r.number IS NOT NULL` excludes **exactly** the cancelled rounds and a redundant `AND r.is_cancelled = 0` is unnecessary. **Nothing in the schema enforces this**, so verify it after every refresh (§9) before relying on the number filter alone. |

**`docs/DATABASE.md` §6.1 — replace "Create as SQL views (or as the single source-of-truth query
builders):" with:**

> Created as **`CREATE TEMP VIEW`** at connection bootstrap (`server/views.ts`), because the
> connection is opened read-only. The DDL below is the authority; the code mirrors it verbatim.
> After the views are created the connection latches `PRAGMA query_only = 1`. See
> `ARCHITECTURE.md` §10 #7.

**`docs/DATABASE.md` §9 — add to the post-refresh checklist:**

> 5. Re-verify `server/coverage.ts` against §4.
> 6. Re-verify **trap 15 in both directions** — a NULL count alone is not enough, because it cannot
>    detect a *numbered* cancelled round appearing, which would silently downgrade
>    `AND r.number IS NOT NULL` from a complete filter to a partial one:
>
>    ```sql
>    SELECT (SELECT count(*) FROM round WHERE is_cancelled = 1 AND number IS NOT NULL) AS cancelled_but_numbered,
>           (SELECT count(*) FROM round WHERE is_cancelled = 0 AND number IS NULL)      AS numbered_gap,
>           (SELECT count(*) FROM round WHERE is_cancelled IS NULL)                     AS cancelled_unknown;
>    ```
>
>    **All three must be 0.** The third is not optional: if `is_cancelled` were ever NULL, the second
>    count would skip those rows and appear to pass. If any is non-zero, every round-number query
>    must add `AND r.is_cancelled = 0` and trap 15's text must be corrected before shipping.

**`ARCHITECTURE.md`** — **I have already made these edits** (§2 stack table, §2.1 Node floor, §3 new
layering rules, §7 CORS/CSP notes, §9 layout, §10 decisions 7–16). The developer must not re-edit
them; the `reviewer` should check code against them.

###### 9.2 Dependencies — all resolved

| Package | Status |
|---|---|
| **`@hono/node-server` `^2.1.0`** | ✅ **Approved by Rishabh, 2026-08-04.** Now listed in `ARCHITECTURE.md` §2 as a first-class stack choice. Hono is runtime-agnostic and ships no Node adapter, so decision 2 ("Hono on Node") is unimplementable without it; it also supplies `conninfo` (the S-13 per-IP key) and `serve-static`. §10 #8. |
| `tsx` | Dev only — runs the TypeScript server in watch mode without a build step. |
| `concurrently@^10` | Dev only — `npm run dev` must start client + API together (an F0 acceptance criterion). |
| `@vitejs/plugin-react`, `@tailwindcss/vite`, `@types/*`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@vitest/coverage-v8` | First-party companions to choices already in §2. Listed for completeness. |
| ~~`hono-rate-limiter`~~ | **Rejected — stands.** ~30 lines in-process instead. §10 #9. |
| ~~`@testing-library/jest-dom`~~ | **Rejected — stands.** Vitest's `expect` covers F0's component tests. (The Node ≥22 engine objection no longer applies, but the dependency is still unnecessary, and S-7/S-14 favour the smaller tree.) |
| ~~`@fontsource-variable/{archivo,inter,chivo-mono}`~~ | **Rejected 2026-08-04 — decided, not deferred.** The three `woff2` pairs are **vendored** into `public/fonts/` instead, with the exact acquisition procedure and `sha256` values in **§3.9**. §10 #17. Decisive reasons were stable preload URLs and family names matching the design tokens, not tree size — the packages carry no dependencies and no install scripts. |
| ~~`lucide-react`~~ | **Rejected 2026-08-04.** Eleven inline SVGs in `src/components/ui/icons.tsx`, geometry copied from `lucide-static@1.28.0` under ISC with the notice retained — **§3.10**. §10 #18. `DESIGN_SYSTEM.md` §2.5's "one set, and never a second" is preserved because the geometry is still Lucide's. |

No dependency in this spec is now unapproved, **and F0 adds no dependency for fonts or icons.** Both
of the `designer`'s flagged items (Design Spec open question 6) are resolved as *no new dependency*,
so §1.1 is the complete and final F0 dependency set.

###### 9.3 ✅ RESOLVED — Node 22 LTS approved; the security exception is deleted, not managed

The React Router advisory `GHSA-qwww-vcr4-c8h2` was the reason to escalate. Rishabh approved raising
the runtime to fix it at the root. Evidence across all three configurations tested:

| Runtime | `react-router` | `npm audit` |
|---|---|---|
| Node 20.18.2 | `≤ 7.17.0` | **14 high** (range `6.0.0 – 7.17.0`) |
| Node 20.18.2 | `7.18.2` (latest v7) | **1 high** — `GHSA-qwww-vcr4-c8h2` |
| **Node ≥ 22.22.0** | **`8.3.0`** | ✅ **`found 0 vulnerabilities`** |

The dated S-7 exception previously drafted into `ARCHITECTURE.md` §7.1 has been **removed**, along
with the `7.18.2` pin. There is no security exception in this codebase, and S-7 now reads plainly:
`npm audit` must be clean of high/critical, full stop. That is a materially better position than
carrying a justified-but-live advisory — an exception is a thing future contributors must keep
re-reasoning about.

**The runtime floor is `>= 22.22.0`**, set by `react-router@8.3.0`'s own `engines`. It also satisfies
`eslint@10`'s `^22.13.0`. Verification of the whole tree against it is in §0.1.

**✅ Node 22 is now installed — Rishabh ran this, and precondition P-1 is cleared.**

```bash
nvm install 22.23.2 && nvm alias default 22.23.2 && node -v   # → v22.23.2 ✅
```

✅ Confirmed: **v22.23.2**, npm **10.9.8**, `default -> 22.23.2`. `/opt/homebrew/opt/node@22` is still
a mislabelled keg containing v23.7.0 and is still not to be used. **A shell started before the install
keeps v20.18.2** — see the warning in §0.1 before concluding Node 22 is missing.

A repo-local `.nvmrc` containing `22.23.2` is added by **T1** so the version is discoverable rather
than tribal, alongside `"engines": { "node": ">=22.22.0" }` so `npm` enforces it mechanically.

**One correction to the approved list — `typescript` stays `~5.9.3`, not 7.** TypeScript 7 is a hard
`ERESOLVE` failure against `typescript-eslint@8.66.0`, whose peer range is `>=4.8.4 <6.1.0`; there is
no published v9 and the canary caps identically. Full evidence in §0.1. Dropping `typescript-eslint`
is not an option because `ARCHITECTURE.md` §2 makes `any` a review failure, which needs type-aware
rules. Everything else on the approved list verified good: Vite 8, ESLint 10,
`@vitejs/plugin-react` 6, `typescript-eslint` 8.66, `concurrently` 10, React Router 8.3.0.

**`better-sqlite3` remains the driver.** `node:sqlite` becomes available on Node 22 and is now a
legitimate future option, but switching is **out of scope for F0** and is recorded as a future
consideration only — `ARCHITECTURE.md` §10 #16. Nothing in this spec acts on it.

###### 9.4 Open items

1. ✅ **Node version — CLOSED.** Approved, specced (§9.3) and **installed**: v22.23.2 / npm 10.9.8,
   `better-sqlite3` builds and loads on it, `npm audit` clean, and the §10 #7 temp-view behaviours
   re-probed on the target runtime (§0.1). Gate-3 precondition P-1 is cleared.
2. ✅ **`@hono/node-server`** — approved; now in `ARCHITECTURE.md` §2 (§9.2).
3. ✅ **CLOSED — no longer applicable.** Superseded by **CR-005** (§5.5), 2026-08-04. Nothing is
   outstanding on anyone for this item. **T2 is still unchanged** and still runs, for the reasons in
   its own acceptance cell.
4. **`REQUIREMENTS.md` §2.2 / §2.5 "24 rounds scheduled" for 2026** — a numbered **CR is being
   opened** for this; it is not mine to edit. ✅ The data holds 24 `round` rows but **22 numbered
   rounds**, 2 cancelled with NULL numbers (§0.3). §2.5's "results through R10" is correct. T14
   (trap 15) stays as specced and the CR will reference it.
5. **Deployment.** The database's directory must be **writable** by the server process (§0.6, E2) —
   SQLite needs to create its WAL sidecars even to read. Not an issue in dev; it will be on a
   read-only container filesystem. Recorded in §10 #12; no action until there is somewhere to deploy.

###### 9.5 Confirmed clean

Provenance grep (`CLAUDE.md` §4.1) run against the working tree with this spec in place:

```
$ grep -rniE -f private/provenance-blocklist.txt . \
    --exclude-dir=node_modules --exclude-dir=private --exclude-dir=data --exclude-dir=.git
clean
```

###### 9.6 Specified for **F1**, not F0 — `scripts/validate-palette.mjs`

**Verdict (G.4 item 4): accepted, and it belongs in F1.** `ARCHITECTURE.md` §10 decision **#19**.
The `orchestrator` has already added the F1 scope bullet and acceptance criterion; **this subsection
is the technical shape only** and F0 implements none of it. It lives here because it is a
`principal-engineer` decision and there is no F1 Technical Spec yet to hold it — **F1's
`principal-engineer` gate must lift it into that spec rather than rediscover it.**

**Why it is an architectural commitment and not a convenience script.** `DESIGN_SYSTEM.md` §9.1
requires a re-run whenever a colour moves, and every figure in §9.2 — including the four measured
brand-colour FAILs that `ARCHITECTURE.md` §10 #6 rests on — was produced by a validator that exists
only in the `designer`'s working directory. Until it is in the repository, **the `reviewer` cannot
falsify a colour claim**, which makes §9.1's requirement unenforceable and §10 #6 unauditable. That
is a governance gap, not a missing tool.

| Property | Specification |
|---|---|
| **Path** | `scripts/validate-palette.mjs` — plain ESM, run directly by Node ≥22 |
| **Dependencies** | **Zero.** §9.1 is pure arithmetic: matrix multiplies, a cube root, and CIEDE2000's piecewise formula. No `culori`, no `chroma-js`, no `colorjs.io` — a dependency here would mean the validator and the product disagree about which implementation is authoritative |
| **Network / writes** | None of either. It reads files and writes stdout. It must not write a report file, because a checked-in report drifts from the code that produced it |
| **Input — colours** | `src/styles/tokens.css`, parsed with a regex over `--name: <value>;` custom-property declarations. **No CSS parser**: the token file is a flat list by construction, and that constraint is cheaper to keep than a parser is to add. **One source of truth** — the validator must never carry its own copy of a hex value, or it will pass while the product is wrong |
| **Input — runs** | `scripts/palette-runs.json` — a declarative manifest, one entry per §9.2 run: `{ id, description, mode: 'light'\|'dark'\|'both', tokens: string[], gates: string[], expect: { … } }`. Adding a run is a data edit, not a code edit |
| **Args** | `--run=<id>` (default: all) · `--mode=light\|dark\|both` · `--json` · `--list` |
| **Output** | Human-readable table to stdout: per run, per pair — CIEDE2000 (normal + protan/deutan/tritan, **worse of the two models**), OkLCh L and C, WCAG ratio, and PASS/WARN/FAIL against the §9.1 floors. `--json` emits the same data machine-readably for the `reviewer` to diff |
| **Exit codes** | **`0`** every run matches its recorded `expect` · **`1`** a regression — a gate now fails that previously passed, **or** a recorded FAIL silently became a PASS (an unexplained improvement is also a drift and must be looked at, not swallowed) · **`2`** usage or input error: unknown run id, a token named in the manifest but absent from the CSS, an unparsable colour value |
| **Reproduction floor** | Must reproduce every §9.2 figure to **±0.01**. `DESIGN_SYSTEM.md` §9.2's calibration run **V-1** is the regression test for the validator itself, and it must stay in the manifest permanently |
| **Script** | `"validate:palette": "node scripts/validate-palette.mjs"`. **Not** wired into `npm test` — it asserts against design decisions, not code, and a token change should fail with a colour report, not a test stack trace. F1 decides whether CI runs it separately |

**Two correctness requirements F1 must not skip**, because a validator that is confidently wrong is
worse than none:

1. **Known-answer tests for the colour maths**, against published reference data rather than against
   itself: the **Sharma, Wu & Dalal CIEDE2000 test dataset** (34 pairs with published ΔE values) for
   CIEDE2000, and the trivial WCAG anchors (`#FFF`/`#000` = 21:1, identical colours = 1:1). Reproducing
   §9.2 proves consistency with the `designer`'s implementation; it does **not** prove either is right.
2. **The two CVD models must be separately assertable**, and the script must report which model
   produced the reported figure. §9.1 mandates "the worse of the two", and V-1 already records that
   Viénot and Machado disagree materially on tritanopia (4.62 vs 3.49 on one pair). A script that
   silently blends them, or reports the mean, breaks the recorded method.

**Not in scope for the script:** deciding tokens, generating palettes, or proposing fixes. It measures
and it exits non-zero. The `designer` owns what to do about a FAIL.

#### **Design Spec** — `designer`, 2026-08-04

> Every colour, contrast and CVD figure quoted here was **computed** with the validator described in
> `docs/DESIGN_SYSTEM.md` §9.1 and recorded run-by-run in §9.2 — including a calibration run that
> reproduces the original §3.2 measurements. Every font claim was read out of the shipped font
> binary. Every motion pattern names the Framer Motion documentation page and example it derives
> from. Nothing here is from memory.

**Companion:** `docs/DESIGN_SYSTEM.md` is now complete for everything F0 touches — §1 intent, §2
typography, §3.4 exact semantic steps, §3.5 surfaces/ink/borders/focus, §4 motion, §5
spacing/radii/breakpoints/elevation, §7.0–§7.6 shell components and states, §8 accessibility, §9
validation record, §10 theming mechanics. **This spec does not restate token values** — it says which
token goes where. If the two disagree, `DESIGN_SYSTEM.md` wins and this section is the defect.

---

##### 1. What F0 looks like, in one paragraph

Neutral, dense, quiet chrome — a 56px header rule, an achromatic nav, mono figures — so that when
team colour arrives in F2 it is the loudest thing on the screen. Display type is condensed Archivo;
body is Inter at 13–14px; every figure is Chivo Mono and tabular. Dark mode is the one that will get
screenshotted. Nothing in the shell is coloured except the four status washes, and the only one F0
uses is `critical`.

---

##### 2. Layout

###### 2.1 Shell anatomy

```
┌─ header ── 56px · --surface-raised · 1px --border-subtle bottom · --elev-1 ────────────┐
│ [skip link]  F1 ANALYTICS      Season Drivers Teams Circuits Compare Records   ● R10  ☾│
│                                ────────                                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌─ main#main ── --surface-canvas ── max-width 1440, centred ─────────────────────────────┐
│  <Outlet/>                                                                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌─ footer ── --surface-canvas · 1px --border-subtle top ─────────────────────────────────┐
│  Complete results through 2026 Round 10 · Seasons 1950–2026                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| Header | height **56px at every breakpoint**; `--surface-raised`; 1px `--border-subtle` bottom border; **no shadow in either theme** (`--elev-1`); `position: sticky; top: 0; z-index: 30` |
| Header inner | max-width 1440, centred, padding-x `4`/`6`/`8` (16 / 24 / 32) at base / `md` / `xl` |
| Wordmark | `--display-xs`, Archivo 700 `wdth 82`, `--ink-primary`, tracking +0.02em, links to `/` |
| Nav | `--text-sm` at `md`, `--text-base` at `lg`+; Inter 500; inactive `--ink-tertiary`, active `--ink-primary`; each item is 56px tall (full header height) so the hit area is generous; gap `3` at `md`, `6` at `lg`+ |
| Active rule | 2px `--ink-primary`, flush to the header's bottom edge, width = label width, moved by `layoutId` (M-3) |
| Right cluster | `DataVintage` then `ThemeToggle`, gap `2` |
| Main | `--surface-canvas`; max-width 1440, centred; padding-x as header; padding-y `6`/`8`/`12` |
| Footer | `--text-xs`, `--ink-tertiary`, padding-y `6`, 1px `--border-subtle` top, same max-width and padding-x |

###### 2.2 Responsive behaviour

| Breakpoint | Header | Nav | `DataVintage` | Main |
|---|---|---|---|---|
| **390 (base)** | wordmark · vintage dot · theme · menu button (all 44×44 hit areas) | **in a sheet** (M-4), full-width, drops from under the header, one item per row at `--text-md`, 48px rows, active item gets a 2px leading rule instead of an underline | dot + `R10` only; tapping opens the same popover, anchored to the trigger, `max-width: calc(100vw - 32px)` | single column, padding-x 16 |
| **768 (md)** | wordmark · full nav · vintage · theme | inline, `--text-sm`, gap `3` | dot + `2026 · R10` | padding-x 24 |
| **1440 (xl)** | as above, roomier | inline, `--text-base`, gap `6` | dot + `2026 · R10` | max-width 1440, padding-x 32 |

Nav order is the route order: **Season · Drivers · Teams · Circuits · Compare · Records** (`/`,
`/drivers`, `/teams`, `/circuits`, `/compare`, `/records`). No nav entry for `/seasons/:year` or
`/seasons/:year/races/:round` — those are reached from Season. No dead controls: the global search
and the app-wide season selector are **F9** and are simply absent in F0, not present-and-disabled.

###### 2.3 F0 route placeholders

Every route resolves to a designed placeholder, because QA and the design verification pass will
screenshot all eleven. Anatomy, left-aligned in `main`:

```
SEASON HUB                                   ← --text-2xs, uppercase, --ink-tertiary
2026 Season                                  ← --display-lg, --ink-primary
This surface ships in F2.                    ← --text-md, --ink-secondary
year 2026                                    ← mono chips: --surface-sunken, --radius-sm,
                                               --font-mono --text-xs, resolved params
```

`NotFound` uses the `404` StateCard from `DESIGN_SYSTEM.md` §7.4 rather than the placeholder shape.

---

##### 3. Component inventory

Names match the `principal-engineer`'s §3.5 component tree exactly.

| Component | New / reused | Design source | Notes |
|---|---|---|---|
| `AppShell` | new | §2.1 above | header + `main#main` + footer + skip link |
| `Header` | new | §2.1 | sticky, composes the three below |
| `PrimaryNav` | new | §2.1–2.2, motion M-3/M-4 | inline at `md`+, sheet at base |
| `ThemeToggle` | new | §4.2 below | **an icon button that opens a 3-option radio popover**, not a 2-state flip — `lib/theme.ts` already models `light \| dark \| system`, and a binary control cannot express `system` |
| `DataVintage` | new | §4.1 below, `DESIGN_SYSTEM.md` §7.3 | three variants, one per `state` prop |
| `LoadingState` | new | `DESIGN_SYSTEM.md` §7.4, §7.5 | skeleton geometry, never a bare spinner |
| `ErrorState` | new | `DESIGN_SYSTEM.md` §7.4 | `critical` icon tile, retry, mono code chip |
| `DataUnavailableState` | new | `DESIGN_SYSTEM.md` §7.4 | full copy in §5.3 below |
| `Button` | new | `DESIGN_SYSTEM.md` §7.1 | F0 needs `primary`, `secondary`, `ghost` only; `danger` may wait for F1 |
| `Badge` | new | `DESIGN_SYSTEM.md` §7.2 | F0 needs `neutral` and the mono value form only |
| `SkipLink` | new | §6 below | visually hidden until focused |
| `RoutePlaceholder` | new (F0-only) | §2.3 | deleted feature by feature as real surfaces land |

**Reused: nothing** — F0 is the first UI. **Deferred to F1 by design:** `EmptyState`,
`NoCoverageState`, `Select`, `Tabs`, `Card`, `Table`, `Tooltip`, driver/team avatars, chart
primitives. Their visual design is already written in `DESIGN_SYSTEM.md` §7 so F1 implements rather
than invents.

**Files the developer creates for tokens and motion:**

| File | Contents |
|---|---|
| `src/styles/tokens.css` | Tailwind v4 `@theme` block for the type scale, spacing subset, radii and durations; then `:root { … }` and `[data-theme="dark"] { … }` blocks for the semantic colour layer. Imported by `src/styles/index.css` after `@import "tailwindcss"`. |
| `src/lib/motion.ts` | `dur`, `ease`, `spring`, `stagger` exactly as `DESIGN_SYSTEM.md` §4.3, plus the F0 variants (`shellMount`, `routeEnter`, `popover`, `sheet`, `control`, `skeletonPulse`). Complete set lands in F1. |
| `public/fonts/*.woff2` + `public/fonts/OFL.txt` | §8 below |

**No hard-coded colour, duration, font-size or spacing value may appear outside these two files.**
That is a review criterion from F0 onward, not from F1.

---

##### 4. Charts

**None.** F0 ships no chart and no chart primitive. Any chart appearing in an F0 PR is out of scope.
Recharts and visx are not imported in F0.

---

##### 5. The two bespoke shell components

###### 5.1 `DataVintage` — the data-currency indicator (NV-9)

Full design in `docs/DESIGN_SYSTEM.md` §7.3. The binding decision, restated because it is a release
blocker if got wrong:

> **Currency is expressed as coverage, never as a fetch event.** "Complete results through Round 10
> of 22" is a fact about the sport's calendar. "Updated 12 days ago" is a fact about a process, and it
> invites exactly the question this repository must never answer (`CLAUDE.md` §4.1). Coverage phrasing
> is also the more honest one: `REQUIREMENTS.md` §2.2 warns the newest round may lag reality, and
> coverage phrasing states what is true without claiming to know today's calendar position.

| `state` | Rendering |
|---|---|
| `loading` | a 92×20 skeleton block (`--surface-sunken`, `--radius-sm`, M-7). The header must not reflow when it resolves, so the skeleton is the same width as the resolved chip. |
| `ready` | `ghost` trigger, 28px tall, `--radius-md`: an 8px `--radius-full` dot in `--ink-tertiary` — **static, never pulsing** (`DESIGN_SYSTEM.md` §4.5) — then `--font-mono` `--text-xs` `--ink-secondary`: `2026 · R10` |
| `unavailable` | the dot only, in `--border-control`, with `aria-label="Data coverage unavailable"`. No error colour: at header scale a red dot reads as a site-wide fault when the actual failure is already stated in `main`. |

Popover: `--elev-2`, `--surface-overlay`, `--radius-xl`, max-width 320, padding `4`, M-5, anchored to
the trigger's right edge, `Esc` and outside-click dismiss, focus returns to the trigger.

**Copy — every value from `GET /api/meta`, nothing hardcoded.** Verified values in parentheses.

| Slot | String |
|---|---|
| Trigger | `{year} · R{round}` → **"2026 · R10"** |
| Trigger accessible name | "Data coverage: {year} season, {completedRounds} of {scheduledRounds} rounds complete. Show detail." |
| Popover heading (`--text-2xs`, uppercase, `--ink-tertiary`) | "DATA COVERAGE" |
| Line 1 (`--text-sm`, `--ink-primary`) | "Complete results through Round {round} of {scheduledRounds} — {roundName}, {date}." → **"Complete results through Round 10 of 22 — Belgian Grand Prix, 19 Jul 2026."** |
| Line 2 (`--text-sm`, `--ink-secondary`) — omit when `isComplete` | "Rounds {round+1}–{scheduledRounds} are scheduled and have no results yet." → **"Rounds 11–22 are scheduled and have no results yet."** |
| Line 3 (`--text-sm`, `--ink-secondary`) — omit when `cancelledRounds === 0` | "{cancelledRounds} rounds on the {year} calendar were cancelled." → **"2 rounds on the 2026 calendar were cancelled."** _(trap 12, surfaced rather than hidden)_ |
| Line 4 (`--text-xs`, `--ink-tertiary`) | "Seasons available: {firstYear}–{latestYear}." → **"Seasons available: 1950–2026."** |
| Footer echo (plain text, no interaction) | "Complete results through {year} Round {round} · Seasons {firstYear}–{latestYear}" |

The selector strings in the technical spec §3.4 are adopted with final wording:

- `DataVintage.label` → **"Complete results through 2026 Round 10 — Belgian Grand Prix, 19 Jul 2026"**
- `DataVintage.progressLabel` → **"10 of 22 rounds complete"**

Dates render as `D MMM YYYY` (`19 Jul 2026`) through `lib/format.ts` — never a locale-dependent call.

**Banned from this component, its props, its tests, its fixtures and its comments:** any word naming
or describing where data came from, and any word for a refresh/import mechanism. "Coverage",
"complete", "scheduled", "available" are the vocabulary.

###### 5.2 `ThemeToggle`

| Part | Spec |
|---|---|
| Trigger | 32×32 icon button (`ghost`), 44×44 hit area on touch, `--radius-md`. Icon reflects the **preference**: monitor = `system`, sun = `light`, moon = `dark` |
| Accessible name | "Theme: {preference} (currently {resolved}). Change theme." → "Theme: System (currently dark). Change theme." |
| Popover | `--elev-2`, `--radius-xl`, width 200, padding `1.5`, M-5, `role="radiogroup"`, `aria-label="Theme"` |
| Options | three rows, 36px tall, `--radius-md`, `--text-base`: leading 16px icon, label, trailing 16px check on the selected one. Selected row = `--ink-primary` label + `--surface-sunken` fill (never a hue) |
| Labels | "System" · "Light" · "Dark" |
| Keyboard | `Enter`/`Space` opens; `↑`/`↓` move within the group; `Enter`/`Space` selects and closes; `Esc` closes; focus returns to the trigger |
| Theme change | M-11 only — a `dur.base`/`ease.move` transition on `background-color` and `color`. Nothing moves, nothing scales, no custom-property transition |

---

##### 6. Motion

The token set and all eleven named motions live in `docs/DESIGN_SYSTEM.md` §4.3–§4.5, each with the
Framer Motion page and example it derives from and its reduced-motion variant. F0 lands this subset:

| ID | Where | Framer Motion reference |
|---|---|---|
| — | `<MotionConfig reducedMotion="user">` wrapping the app at `main.tsx` | Motion → **Accessibility** (`reducedMotion` prop; docs: *"automatically disable transform and layout animations, while preserving the animation of other values like `opacity` and `backgroundColor`"*) |
| **M-1** | shell mount | Motion → Animation → **"Enter animation"** |
| **M-2** | route content enter, keyed on `location.pathname`, **no exit variant** | Motion → **AnimatePresence** → **"Exit animation"**, **"AnimatePresence modes"** (`mode="sync"`) |
| **M-3** | nav active rule | Motion → **Layout animations** → **"`layoutId` for shared element transitions"** |
| **M-4** | mobile nav sheet + scrim | Motion → **AnimatePresence** → **"Exit animation"** |
| **M-5** | theme popover, data-coverage popover | Motion → **AnimatePresence** → **"Exit animation"** + Motion → **Gestures** → **`whileTap`** |
| **M-6** | buttons, nav items, popover rows | Motion → **Gestures** → **`whileHover`**, **`whileTap`**, **`whileFocus`** |
| **M-7** | skeleton pulse — needs `useReducedMotion()` explicitly, because `MotionConfig` does not stop an opacity loop | Motion → Animation → **"Keyframes"**; Motion → **Accessibility** → `useReducedMotion` |
| **M-8** | skeleton → content crossfade | Motion → **AnimatePresence** → **"AnimatePresence modes"** |
| **M-11** | theme colour transition (CSS, not Motion) | — |

Deferred with the surfaces that need them: **M-9** (list/grid stagger, F2) and **M-10** (scroll
reveal, F3/F4). Both are fully specified now so neither gets invented later.

Easings are Motion's own string presets (`"easeOut"`, `"easeIn"`, `"easeInOut"`, `"circOut"`).
Springs use Motion's documented `visualDuration` + `bounce` API. **No cubic-bézier literal exists
anywhere in this product.**

> **⚠ Scope conflict to settle, `orchestrator`.** The gate-2 brief (this section, line ~269) puts
> "route transition motion and shell entry motion" in F0, while the technical spec's dependency table
> says of `framer-motion`: *"F1 uses it; F0 installs it and adds **no** animation."* My
> recommendation: **land the subset above in F0.** It is roughly thirty lines (a `MotionConfig`, two
> variant objects, one `layoutId`), it is what makes the design verification at gate 4 meaningful, and
> the alternative is shipping an inert shell and retrofitting motion into finished markup in F1. If the
> decision goes the other way, nothing in this spec changes except which feature lands it — M-11 (CSS)
> and the `:focus-visible` ring are not Framer Motion and land in F0 regardless.

---

##### 7. States

| State | Where it appears in F0 | Design |
|---|---|---|
| **loading** | `DataVintage` while `/api/meta` is in flight; route placeholders never load | skeleton at the resolved width, M-7, `aria-busy` on the container, `aria-hidden` on the skeleton |
| **error** (`/api/meta` failed, 500) | `main`, replacing the placeholder | `ErrorState`: "Something went wrong" / "This view couldn't be loaded." / "Try again" (`primary`) + mono `INTERNAL` chip |
| **rate-limited** (429) | `main` | `ErrorState`: "Too many requests" / "Wait a moment and try again." / "Try again" + mono `RATE_LIMITED` chip |
| **database unavailable** (503) | `main`, full width, `max-width: 560`, vertically centred with `min-height: 60vh` | `DataUnavailableState` — copy in §7.1 |
| **404** | `NotFound` route | `StateCard`: "No page at this address" / "The link may be wrong, or the season, driver or team may not exist." / "Go to the current season" (`primary`) |
| **empty** | not reachable in F0 | designed in `DESIGN_SYSTEM.md` §7.4, built in F1 |
| **no-coverage** | not reachable in F0 | designed in `DESIGN_SYSTEM.md` §7.4 with final copy for all six boundaries, built in F1. `selectCoverageNotice`'s return strings are those sentences. |

All five StateCard variants share one anatomy (40px icon tile, title at `--display-xs`, body at
`--text-base` `--ink-secondary`, action row, optional mono code chip, `--elev-1`, `--radius-lg`,
padding `6` / `4` on mobile) so they read as one family rather than five one-offs.

###### 7.1 "Database not available" — the state a developer meets on a fresh clone

This one gets real design attention because it is the first thing a new contributor sees, and because
it must instruct without leaking a filesystem path (S-6 — the path below is **static UI copy**, never
echoed from the server response).

| Slot | Content |
|---|---|
| Icon tile | 40px, `--radius-md`, `--status-critical-wash` field, `--status-critical-ink` database icon |
| Title (`--display-xs`) | **No database found** |
| Body (`--text-base`, `--ink-secondary`) | **This application reads a local SQLite database at `data/f1.db`. That file is supplied separately and is not part of the repository.** |
| Steps (`<ol>`, `--text-sm`, `--ink-secondary`, mono chips for code) | 1. **Put the database file at `data/f1.db`, relative to the project root.** 2. **Restart the dev server: `npm run dev`** |
| Footnote (`--text-xs`, `--ink-tertiary`) | **Seasons 1950–2026 are available once the database is in place.** |
| Code chip (`--font-mono` `--text-xs`, `--surface-sunken`) | `DATABASE_UNAVAILABLE` |
| Action | **Try again** (`primary`) — refetches `/api/meta`; honest, because it succeeds once the file is in place |

The header still renders (with `DataVintage` in its `unavailable` variant) so the theme control and
nav keep working — a broken data layer is not a reason to lose the chrome.

---

##### 8. Accessibility

| Concern | Spec |
|---|---|
| Skip link | first focusable element: "Skip to main content" → `#main`. Visually hidden until `:focus-visible`, then a `--surface-overlay` chip at top-left, `--elev-2` |
| Landmarks | `header` → `nav[aria-label="Primary"]` → `main#main` → `footer`. One `h1` per route (the placeholder title) |
| Focus order (≥768) | skip link → wordmark → nav 1–6 → `DataVintage` trigger → `ThemeToggle` → main content → footer |
| Focus order (<768) | skip link → wordmark → `DataVintage` trigger → `ThemeToggle` → menu button → (sheet, when open, traps focus and returns it to the menu button) → main → footer |
| Focus indicator | the single achromatic double ring, `DESIGN_SYSTEM.md` §3.5.1. Measured worst case against every neutral token **and** all eleven brand colours: **4.28:1 light / 4.14:1 dark**, floor 3.0 — PASS (§9.2 V-9). Never removed, never per-component, never replaced by motion |
| Current page | `aria-current="page"` on the active nav item — the 2px rule is not the only signal |
| Popovers | `aria-expanded` on the trigger, `Esc` closes, focus returns to the trigger, outside click closes |
| Contrast | every text token pair clears 4.5:1 in both themes and every `--border-control` pair clears 3:1 — measured, §9.2 V-2. Lowest text figure in the system: `--ink-tertiary` on `--surface-sunken`, **4.58:1 light / 5.68:1 dark** |
| Touch targets | ≥44×44 for every control at base breakpoint |
| Reduced motion | `MotionConfig reducedMotion="user"` plus the explicit variants in §6; the skeleton pulse needs `useReducedMotion()` because an opacity loop is not covered by `MotionConfig` |
| Colour scheme | `prefers-color-scheme` honoured on first paint and live while the preference is `system`; `<html>` carries `color-scheme` so scrollbars and form controls follow |
| Theme flash | pre-paint application via `public/theme-init.js` (already in the technical spec §3.6). A flash of the wrong theme is a defect |
| Table view | no chart in F0, so nothing to provide one for |

---

##### 9. Assets required

###### 9.1 Fonts — openly licensed, developer-vendored, **not** Rishabh's

Three variable `woff2` files, self-hosted. **A font CDN is forbidden** — S-1/DL-2 (no third-party
request on any path) and S-9 (the CSP must not whitelist a font host).

| File | Family | Upstream (SIL OFL 1.1) |
|---|---|---|
| `public/fonts/archivo-var.woff2` | Archivo, `wght 600–700` `wdth 82`, latin + latin-ext | `google/fonts` → `ofl/archivo/Archivo[wdth,wght].ttf` |
| `public/fonts/inter-var.woff2` | Inter, `wght 400–600` `opsz 14–20`, latin + latin-ext | `google/fonts` → `ofl/inter/Inter[opsz,wght].ttf` |
| `public/fonts/chivo-mono-var.woff2` | Chivo Mono, `wght 400–600`, latin | `google/fonts` → `ofl/chivomono/ChivoMono[wght].ttf` |
| `public/fonts/OFL.txt` | the SIL Open Font License 1.1 text | **required by the licence** — shipping the fonts without it is a licence violation |

Alternative: the three `@fontsource-variable/*` packages (v5.3.0, `OFL-1.1`). **New dependency →
`principal-engineer` decision + `ARCHITECTURE.md` §10 entry.** Flagged, not added.

###### 9.2 Icons

**Lucide** (ISC), used at 16px and 20px, `currentColor`, 1.5px stroke. F0 needs: `Menu`, `X`,
`Sun`, `Moon`, `Monitor`, `Check`, `ChevronDown`, `Database`, `AlertTriangle`, `RefreshCw`,
`ArrowRight`. New dependency → `principal-engineer` decision. If it is declined, the fallback is
eleven hand-authored inline SVGs in `src/components/ui/icons.tsx` on the same 24px grid — no second
icon set, ever.

###### 9.3 Assigned to **Rishabh** — suggested tracker task `R3`

| Item | Spec |
|---|---|
| Favicon | `public/favicon.svg` — square, legible at 16px, works on light and dark browser chrome (single-colour or `prefers-color-scheme`-aware SVG) |
| App icon | `public/apple-touch-icon.png` — 180×180, PNG, opaque background |
| Maskable icon | `public/icon-512.png` — 512×512, PNG, content inside an 80% safe area |

**Placeholder that ships until these arrive:** a typographic mark generated from the design system
itself — an `--ink-primary` rounded square (`--radius-md`) with the product initial set in Archivo
700 `wdth 82` in `--ink-inverse`, authored as a hand-written SVG in `public/favicon.svg`. It is built
from a font we are licensed to use and contains no third-party mark. **No F1 logo, no team logo, no
photograph is used anywhere in F0** — and none is needed, since F0 renders no driver, team or race
content. R1/R2 are therefore not on F0's critical path.

---

##### 10. Design-system work completed in this gate

| Section | Status |
|---|---|
| §1 Design intent | authored, including the three decisions that produce the character |
| §2 Typography | **complete** — Archivo / Inter / Chivo Mono with binary-level evidence, delivery rules, the 11-step scale, tabular-numeral rules, icon set |
| §3.4 Reserved semantics | **complete** — exact ink + wash steps per mode, the chip form and why, the residual CVD failure and its mandatory mitigation, status set reduced from five to four **with the measurement that forced it** |
| §3.5 Surfaces / ink / borders | **complete** for both themes, plus `--border-control`, the achromatic double focus ring, and hue-free interactive expression |
| §4 Motion | **complete** — easing/duration/spring/stagger tokens defined once, eleven named motions each citing its Framer Motion example, a reduced variant for every one, and a "never animates" list |
| §5 Spacing / radii / breakpoints / elevation | **complete**, including the different dark-mode elevation model |
| §7.0–§7.6 | shell components, the five states with final copy, skeleton rules, placeholder policy |
| §8 Accessibility | **complete** |
| §9 Validation record | validator **method** documented so any run is reproducible, plus **nine recorded runs** |
| §10 Theming mechanics | **complete** |
| §3.1–§3.3, §6.2 | untouched measured facts — extended with an identity-surface rule, never softened |
| §3.3 rules 4–6, §6.3, full §7 inventory | **deferred to F1** as instructed |

###### 10.1 Validation summary (full tables in `DESIGN_SYSTEM.md` §9.2)

| Run | Palette | Verdict |
|---|---|---|
| V-1 | calibration against the recorded §3.2 figures | **reproduced** — Cadillac↔Haas ΔE 3.82 (3.8), Haas C 0.0056 (0.006), Mercedes L 0.786 (0.786), RB↔Alpine deutan 3.17 (3.3) |
| V-2 | neutrals, light and dark | **PASS** both modes, all text ≥4.5:1, all `--border-control` ≥3:1 |
| V-3 / V-4 | F1 timing semantics | dark **PASS** (min CVD ΔE 9.2); light **PASS on contrast**, 2 CVD FAILs (green↔yellow deutan 6.9, purple↔yellow tritan 7.2) — hues are fixed by convention, mitigated structurally |
| V-5 / V-6 | status | dark **PASS** (min CVD ΔE 8.1); light 1 FAIL pair (caution↔critical protan 7.5 / deutan 7.8) — mitigated by mandatory icon + label |
| V-6b | the rejected 5-level status set | **FAIL** — warning↔serious deutan ΔE **0.4**. This is why the set is four |
| V-7 | timing-green vs status-good | **distinct** tokens (ΔE 9.9 / 11.4) |
| V-8 | brand colours vs the new surfaces | dark **PASS** all 11; light **WARN** 6 of 11 <3:1 — unchanged from §3.2, discharged by the identity-surface rule |
| V-9 | achromatic double focus ring | **PASS** — 4.28:1 light, 4.14:1 dark worst case over every token and brand colour |

---

##### 11. Open questions

For **Rishabh**:

1. **Product name and wordmark — a trademark question, not a design one.** "F1" is a registered trade
   mark, and Formula 1's published guidelines expressly forbid using their typefaces and warn against
   using Titillium *"in any manner to create an unauthorised association with the Championship or the
   Formula 1 companies."* The repository is public. The design system is deliberately built so the
   product does not lean on F1's visual identity, but the literal string "F1 Analytics" is a naming
   decision only Rishabh can make. F0 ships the name currently in `package.json`; say the word and it
   is a one-line token change.
2. **Interface accent — confirm achromatic.** My recommendation and the whole basis of §1.1 is a
   neutral interface with colour reserved for teams and timing, because every hue on the wheel is
   already an identity in this product. If a red (or any) brand accent is wanted for primary actions,
   it needs a validated exception and it will collide with a team somewhere.
3. **Favicon / app icon** (R3, §9.3) — with the typographic placeholder shipping until then.

For the **`orchestrator`**:

4. **The framer-motion scope conflict in §6** — brief says F0, technical spec says F1. Recommendation:
   F0.
5. **A new asset task `R3`** for the icon set above (tracker rows are the orchestrator's to write).

For the **`principal-engineer`**:

6. **Two dependencies flagged, not added:** the three `@fontsource-variable/*` packages (or vendored
   `woff2`, which needs none) and `lucide-react` (or eleven inline SVGs, which needs none).
   `ARCHITECTURE.md` §2 says nothing gets added without your decision in §10.
7. **`scripts/validate-palette.mjs` + `npm run validate:palette`.** The validator that produced every
   figure in §9.2 currently lives in the designer's working directory. `DESIGN_SYSTEM.md` §9 requires a
   re-run whenever a colour changes, and the `reviewer` cannot verify a colour change without it. It
   belongs in the repository in F1 — no dependencies needed, it is pure arithmetic.
8. **`ThemeToggle` is a 3-option popover, not a binary flip** (§5.2) — consistent with your
   `ThemePreference = 'light' | 'dark' | 'system'`, but worth confirming your test 49–55 expectations
   match a radiogroup rather than a toggle.

---

#### **Orchestrator Gate Record** — 2026-08-04

##### G.1 Gates 1 and 2 — verified and accepted

Both specs are **accepted**. Verification was independent: the claims below were re-executed or
re-read, not taken from the reporting agent.

| What I checked | How | Result |
|---|---|---|
| The `/api/meta` values the Technical Spec is built on | Re-ran the §1.3 and §1.6 statements against `data/f1.db` myself | ✅ `1950 / 2026 / 77`; latest completed `2026 · R10 · Belgian Grand Prix · 2026-07-19 · spa` — matches §0.2 exactly |
| New trap 15 (`round.number IS NULL`) | Re-ran the three §0.3 counts | ✅ `2 / 2 / 0`; 2026 holds **24 `round` rows, `max(number) = 22`** — the trap is real and correctly stated |
| `v_entry` / `v_race` decision | Read the four-option table (§1.2) and decision `ARCHITECTURE.md` §10 #7 | ✅ Arrived at by probing a real connection, not by reasoning; the `PRAGMA query_only = 1` latch is the part that makes it airtight |
| S-7 exception actually deleted | Read `ARCHITECTURE.md` §7.1 | ✅ Reads "no exceptions"; the drafted allow-list is gone, not softened |
| Decision log revised, not appended-over | Read `ARCHITECTURE.md` §10 | ✅ #11 struck through and marked superseded; #14 (Node 22), #15 (`typescript ~5.9.3`), #16 (`node:sqlite` future-only) present with evidence |
| Nothing implemented | `git status`; `package.json` diff | ✅ Only `PLAN.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md` modified. `package.json` is untouched (still the F0 placeholder), lockfile holds only `better-sqlite3` and its tree |
| Placeholders replaced, nothing clobbered | `git diff` hunk analysis on `PLAN.md` | ✅ One contiguous hunk at the two `_pending_` lines; no other line in `PLAN.md` altered by either agent |
| Measured facts preserved | Read `DESIGN_SYSTEM.md` §3.1–§3.3 | ✅ All twelve brand colours, all four FAIL rows and the WARN row verbatim. §3.3 **extended** with the identity-surface rule; no rule softened |
| Validator record | Read `DESIGN_SYSTEM.md` §9.1–§9.2 | ✅ Method documented; nine runs recorded with figures. V-1 is a genuine calibration against the pre-existing measurements (ΔE 3.82 vs 3.8; 3.17 vs 3.3) and **discloses** that the tritan model differs while the verdict does not — that disclosure is why the run is credible |
| Typography evidence | Read `DESIGN_SYSTEM.md` §2.1 | ✅ Axis ranges, name-table licence fields and `zero`-glyph contour counts — binary-level, not from memory. All three OFL 1.1 |
| Motion citation discipline | Read Design Spec §6 and `DESIGN_SYSTEM.md` §4 | ✅ Every named motion cites a Motion documentation page/example; easings are Motion's own string presets; **no cubic-bézier literal anywhere** |
| Provenance | `CLAUDE.md` §4.1 grep over the working tree | ✅ `provenance clean` |

**Scope coverage.** Every F0 scope bullet and every F0 acceptance criterion maps to specified work:

| F0 acceptance criterion | Covered by |
|---|---|
| `npm run dev` serves the app; `/api/meta` returns real values | Tech T7 (+ T5, T6); values verified in §0.2 |
| Typecheck, lint, build, tests clean | Tech T1 acceptance; scripts in §3.8 |
| Missing-database case gives a clear actionable error | Tech §2.7 + E1–E5 + T7; Design §7.1 `DataUnavailableState` |
| Every route resolves | Tech §3.5 + T10 (11 routes + catch-all, `ARCHITECTURE.md` §5 verbatim); Design §2.3 placeholder anatomy |
| Theme toggle persists; `prefers-color-scheme` on first load | Tech §3.6 + T11; Design §5.2 + §8 |
| Data-vintage indicator (NV-9) | Tech §3.4 `selectDataVintage` + T12; Design §5.1 with final copy |

**Cross-spec agreement.** Component names, props and file paths match between Tech §3.1/§3.5 and
Design §3 with no drift; both independently forbid a font/asset CDN; both put the vintage string in
`selectDataVintage` and the wording in the Design Spec. **Two contradictions were found — G.3.**

##### G.2 Rulings — binding, and they resolve the open questions put to me

| # | Question | Ruling |
|---|---|---|
| R-1 | **Framer Motion scope** — gate-2 brief says F0, Tech §1.1 says "F0 installs it and adds **no** animation" (Design Spec §6, open question 4) | **Resolved in the `designer`'s favour: the ~30-line route/shell motion subset lands in F0.** Gate 4 is visual verification; with zero animation there is nothing to verify, and retrofitting motion into finished markup in F1 is worse work. **Tech §1.1's `framer-motion` row is superseded by this ruling** and the `principal-engineer` corrects the line (G.4 item 1). In scope for F0: `MotionConfig reducedMotion="user"`, M-1, M-2, M-3, M-4, M-5, M-6, M-7, M-8, M-11. Deferred: M-9 (F2), M-10 (F3/F4) |
| R-2 | **`ThemeToggle` shape** (Design §5.2, open question 8) | **The 3-option radiogroup popover is binding.** `lib/theme.ts` models `light \| dark \| system`; a binary control cannot express `system`, and `prefers-color-scheme` on first load is an F0 acceptance criterion. Consequence: **unit tests 49–55 and 64 must expect a radiogroup, not a cycle** — test 64's "cycles preference" wording is now wrong and the `principal-engineer` corrects it (G.4 item 1) |
| R-3 | **Interface accent — achromatic?** (Design open question 2) | **Achromatic interface chrome stands for F0.** Unobjected, and the reasoning is sound: every hue is already an identity in this product. No brand accent, no validated exception needed |
| R-4 | **Product name "F1 Analytics"** (Design open question 1) | **Kept as a working name.** The trademark point is real — "F1" is a registered mark and Formula 1's guidelines forbid implying association — but it is a naming/legal decision, not a design one. **Logged as a release risk in §6, to be decided at F11.** Not now, and not by an agent |
| R-5 | **New asset task `R3`** (Design §9.3, open question 5) | **Added to the tracker, Owner: Rishabh** — `public/favicon.svg`, `public/apple-touch-icon.png` 180×180, `public/icon-512.png` 512×512 with content inside an 80% safe area. **R3 does not block F0**: the typographic placeholder ships until they arrive |
| R-6 | **Fonts — vendored `woff2` vs `@fontsource-variable/*`** | Routed to the `principal-engineer` (G.4 item 3), with my preference on record: **vendor the three `woff2` files**, because it needs no dependency at all and S-7/S-14 both favour the smaller tree. Their call, their decision-log entry |
| R-7 | **Icons — `lucide-react` vs eleven inline SVGs** | Routed to the `principal-engineer` (G.4 item 3), same preference and same reasoning: eleven inline SVGs need no dependency |

##### G.3 ⛔ Two document defects — blocking gate 3

Both are doc-vs-doc contradictions. Per §5.3, a document that disagrees with another is a **defect to
resolve**, not a preference. Neither is a criticism of the spec work; both are one-line corrections in
the document each agent owns, and **gate 3 does not start until both land.**

**D-1 — `docs/DESIGN_SYSTEM.md` §10 mandates an inline theme script, which the CSP forbids.**
Owner: `designer`. That line says the pre-paint theme is set by "a tiny blocking inline script in
`index.html`". Three places say otherwise, and they are right: Technical Spec §3.6 (`script-src
'self'` forbids it — S-9, so `public/theme-init.js`), `ARCHITECTURE.md` §7.3 ("an external
`public/theme-init.js`, not an inline block"), and the **Design Spec's own §8** ("pre-paint
application via `public/theme-init.js`"). A developer following §10 literally would ship a CSP
violation and fail T11's "zero CSP violations" criterion. **Ruling: `public/theme-init.js` wins.**
`DESIGN_SYSTEM.md` §10 is the stale text and the `designer` corrects it.

**D-2 — four stale task cross-references inside the Technical Spec.** Owner:
`principal-engineer`. The task table is right; the prose pointing at it is off by one, and a developer
working the list would look for the work under the wrong task:

| Location | Says | Should say |
|---|---|---|
| §0.3, "This is not in `DATABASE.md` §7." | Task **T13** adds trap 15 | **T14** — T13 is production serving |
| §1.7, coverage constants | **T13** extends the §9 checklist | **T14** |
| §2.4, the `styleSrcAttr` allowance | **T12** verifies zero CSP violations in the **production preview** | **T13** — T12 is the vintage indicator; T11 covers the dev console |
| §6.4, code-splitting boundary | **T12** records the gzipped initial-chunk size | **T13** |

##### G.4 Routed to the `principal-engineer` — assignment brief

Dispatch **after** D-2 is in hand; these are one revision, not four.

1. **Corrections to your own text** (G.3 D-2 and rulings R-1, R-2): fix the four task
   cross-references; replace the `framer-motion` dependency-table note so it states the F0 motion
   subset per R-1; re-word tests 49–55 and 64 for a **radiogroup**, not a cycle (test 64 currently
   says "cycles preference"). Nothing else in the spec changes.
2. **Confirm T11/T13 CSP division** while you are there — T11 asserts "zero CSP violations in the
   console" (dev) and T13 asserts it against the real build. Both are wanted; make it explicit which
   console each means so the developer does not treat one as the other.
3. **Two dependency decisions, both currently flagged-not-added by the `designer`** (Design §9.1,
   §9.2, open question 6). Each needs a verdict and, if accepted, an `ARCHITECTURE.md` §10 entry:
   - `@fontsource-variable/{archivo,inter,chivo-mono}` v5.3.0 (OFL-1.1) **or** vendored
     `public/fonts/*.woff2` + `public/fonts/OFL.txt`. Note the licence obliges shipping the OFL text
     either way. My preference: vendor (R-6).
   - `lucide-react` (ISC) **or** eleven inline SVGs in `src/components/ui/icons.tsx` on a 24px grid.
     Needed glyphs: `Menu`, `X`, `Sun`, `Moon`, `Monitor`, `Check`, `ChevronDown`, `Database`,
     `AlertTriangle`, `RefreshCw`, `ArrowRight`. My preference: inline (R-7).
4. **`scripts/validate-palette.mjs` + an `npm run validate:palette` script — specify it into F1.**
   Every figure in `DESIGN_SYSTEM.md` §9.2 was produced by a validator that lives only in the
   `designer`'s working directory, so **the `reviewer` currently cannot re-verify any colour change**,
   and §9.1 requires a re-run whenever a colour moves. It is pure arithmetic and needs no dependency.
   F1 scope, not F0.

##### G.5 Gate 3 preconditions — all three must clear

**✅ ALL THREE CLEARED — re-verified by the `orchestrator` 2026-08-04 before dispatching gate 3.**
This table previously read `⛔ Outstanding` on all three rows after the underlying work had landed; the
staleness is recorded rather than quietly overwritten, because the tracker's value depends on it not
drifting.

| # | Precondition | Owner | State | How I verified it |
|---|---|---|---|---|
| P-1 | **Node 22 installed** — T1's first acceptance criterion is `node -v ≥ v22.22.0` **before starting**. **`/opt/homebrew/opt/node@22` remains a mislabelled keg containing v23.7.0 and must not be used** | **Rishabh** | ✅ **Cleared** | `node -v` → **v22.23.2** in the session shell. Agent shells may still inherit a PATH pinning v20.18.2, so the `nvm use` step in `CLAUDE.md` §7 stays mandatory and T1's assertion is **not** waived |
| P-2 | **D-1** — `DESIGN_SYSTEM.md` §10 theme-script line corrected | `designer` | ✅ **Cleared** | `grep -n "theme-init\|inline script\|inline block" docs/DESIGN_SYSTEM.md` → §10 line 824 now specifies `public/theme-init.js` as **external**, line 829 records that an inline block is a CSP violation (S-9), and §11 logs the D-1 fix. No token, colour, type or motion change, so no re-validation was owed |
| P-3 | **D-2** — four task cross-references corrected, plus G.4 items 1–2 | `principal-engineer` | ✅ **Cleared** | Read all four sites: §0.3 → **T14** ✅, §1.7 → **T14** ✅, §2.4 `styleSrcAttr` → **T13** ✅, §6.4 bundle figure → **T13** ✅. G.4 item 1 also landed: the `framer-motion` row is explicitly superseded per R-1, and tests 49–55/64 now specify a **radiogroup** rather than a cycle. G.4 item 2 landed as the two-console table in §2.4. G.4 item 3 landed as §9.2 (fonts vendored, icons inline — **no new dependency**). G.4 item 4 landed as §9.6 (F1 scope) |

##### G.6 Gate 4 precondition — Playwright MCP · ✅ CLEARED

Registered 2026-08-04 (`claude mcp add playwright -- npx -y @playwright/mcp@latest`, local project
scope). It needed a Claude Code restart to appear in the tool list; **that has happened** —
`mcp__playwright__*` tools are present in the `orchestrator`'s session as of 2026-08-04, so gate 4
(`designer` visual verification) and gate 9 (`qa` E2E) are **unblocked**.

**The standing instruction is not waived.** Both agents must still check for `mcp__playwright__*` in
their **own** tool list at the moment they run, and **stop and report** if it is absent rather than
working around it (§2.1). Registration having happened is not the same as the tool being available in
a given agent's session.

##### G.7 Gate 3 — dispatched 2026-08-04

**Assignment:** `developer`, tasks **T1–T14** of the Technical Spec §8, on `feat/foundation`. Full
brief issued in the dispatch message; its load-bearing terms, recorded here so the gate can be audited
against what was actually asked for:

| Term | Value |
|---|---|
| Scope | T1–T14 in order. T1–T7 server, T8–T13 client/build, T2 + T14 doc hygiene. **Nothing outside the F0 scope list** — no analytical feature, no chart, no driver/team/race content |
| Inputs named | Technical Spec §0–§9 · Design Spec §1–§11 · §G.2 rulings R-1…R-7 · `ARCHITECTURE.md` §2, §3, §5, §7, §8, §9, §10 · `DATABASE.md` §1, §2, §3, §4, §6, §7, §9 · `DESIGN_SYSTEM.md` §1–§10 · `REQUIREMENTS.md` §2, §6, §7, §8 |
| Binding rulings restated | R-1 the Framer Motion shell/route subset **does** land in F0 (M-1…M-8, M-11, `MotionConfig`); R-2 `ThemeToggle` is a **3-option radiogroup popover**, not a cycle; R-3 achromatic chrome |
| Hard constraints restated | ~~the §2.4 rule~~ (struck mid-run — see below) · read-only connection, no write path ever · clear actionable missing-DB error (Tech §2.7 + Design §7.1) · no auth, no mutation, no third-party request on any path · initial JS **< 250 KB gzipped** · **no hand-written duration/easing/spring/colour/size literal** — tokens only · slugs never integer ids (DL-3) · typographic favicon placeholder only |
| Evidence demanded | file paths · real output for `npm install`, `audit`, `typecheck`, `lint`, `format:check`, `test`, `build` · the gzipped initial-chunk figure **and `framer-motion`'s share** · ~~the §4.1 check~~ (struck mid-run) · `curl -i` headers for `/api/meta` · the missing-DB console block and its `503` · **69 tests** accounted for · `git status` / `git log` showing no database, `.env` or seed artefact staged |

**⚠ Amended mid-run, 2026-08-04 — recorded rather than rewritten, because the dispatch actually
happened as first written.** **CR-005** (§5.5) landed while gate 3 was in flight. The `developer` was
sent the scope change directly and told, in these terms: stop treating the check as a gate, drop it
from the evidence it owes, **do not build it into any script, npm script, CI step, test, lint rule,
README section or comment**, and **do not over-delete** — T2's 18-table contract and `api_id` →
`reference` correction stand on DL-3 / trap-11 grounds, and T14's `docs/DATABASE.md` and `README.md`
edits stand in full. It was also told that removing a reference must be a **deletion, not a
replacement that describes what was formerly forbidden**, and to keep commit messages and branch names
free of any upstream source name. Two task acceptance cells (**T2**, **T14**) were edited in §8 to
match; no other F0 scope, task or acceptance criterion changed.
| Explicitly **not** the developer's to do | mark anything Done · approve a merge · edit `ARCHITECTURE.md` (Tech §9.1) · run gate 4 or 9 · act on CR-002/003/004 |

**Outcome: pending.** The `orchestrator` records the result here and updates the tracker on report-back.
Gate 3 completing does **not** make F0 Done — gates 4–11 follow.

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
- **`scripts/validate-palette.mjs` + `npm run validate:palette`** — the validator behind every figure
  in `DESIGN_SYSTEM.md` §9.2 currently lives only in the `designer`'s working directory, so the
  `reviewer` cannot re-verify a colour change. §9.1 documents the method; F1 lands the script. Pure
  arithmetic, no dependency. Added 2026-08-04 (orchestrator, F0 gate record G.4 item 4)
- **CR-004 — team identity encoding** (logo where colours clash, colour where they do not). Logged
  2026-08-04; §5.5 holds the request and its constraints. It lands here because team-colour resolution
  internals were already deferred to F1, and it amends `DESIGN_SYSTEM.md` §3.3, whose rules are
  **measured** — an amendment there needs validator evidence, not argument

**Acceptance**
- Design system doc complete; every token has a name and a defined use
- A rendered token/component gallery route (dev-only) exists
- Palette validation recorded, with secondary-encoding strategy for every failing pair
- `npm run validate:palette` runs from a clean clone and reproduces the §9.2 figures
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
- README and setup docs, stating that the database is supplied separately
- Confirm no database, seed artefact, or `.env` in the repository or its history
- Settle the product-name / trademark question (§6.1 A-3) — Rishabh's call, deferred to here

**Acceptance**
- Full E2E suite green
- Whole-repo security audit passed
- No database, seed artefact or `.env` anywhere in the tree or its history
- A fresh clone plus a supplied database runs the app from the README alone

**Technical Spec** — _pending_ · **Design Spec** — _pending_

---

## 5. Change requests

**Any change Rishabh requests — however small — enters here and travels the full agent order.**
There is no side door. A change that skips gates is how a documented system quietly stops matching
reality.

### 5.1 How a change enters

1. Rishabh states the change to the **`orchestrator`**.
2. The `orchestrator` opens a **CR entry** in §5.5 with an ID (`CR-001`, `CR-002`, …), the request
   verbatim, and the date.
3. The `orchestrator` performs **triage** and records:
   - **What surfaces are affected** — which features, routes, endpoints, components
   - **Document Impact Assessment** (§5.3) — mandatory, and stated before work begins
   - **Class** (§5.2) — which sets the *depth* of each gate, never whether a gate runs
4. Work is assigned. The gate order below is identical to a feature's.

### 5.2 Class — depth, not shortcuts

Every class passes through **every** agent. The class tells each agent how deep to go, so a copy
tweak does not receive a full architectural audit while a data-model change does.

| Class | Examples | Gate depth |
|---|---|---|
| **A — Copy / token** | wording, spacing, a colour step, an easing value | Each agent confirms *no wider impact*: spec confirms no data/API change; designer verifies visually; reviewer confirms no new surface; QA smoke-tests the affected route |
| **B — Behaviour** | a new chart, a changed metric, a new filter, altered interaction | Full spec, full design spec, full review, full security audit, full E2E for the affected feature |
| **C — Structural** | new route, new endpoint, schema/query change, new dependency, new data source | Everything in B **plus** an `ARCHITECTURE.md` §10 decision-log entry, and a re-verification pass on any affected `DATABASE.md` claim |

The `orchestrator` assigns the class and records it. If an agent believes the class is wrong, it says
so — under-classifying is a review failure.

### 5.3 Document Impact Assessment — mandatory

**Before implementation starts**, the `orchestrator` (with the `principal-engineer` for class B/C)
records which canonical documents the change alters. Every row gets an explicit verdict — `No change`
is a valid answer, silence is not.

| Document | Change it when |
|---|---|
| `REQUIREMENTS.md` | Product behaviour, scope, a requirement ID, a data-coverage claim, or something moving in/out of §6 (out of scope) |
| `docs/ARCHITECTURE.md` | Stack, layering, API surface, routing/URL contract, security posture, performance budget. **Class C also requires a §10 decision-log entry.** |
| `docs/DATABASE.md` | Query patterns, a new canonical view, a newly discovered trap, a corrected coverage figure, an enum decode |
| `docs/DESIGN_SYSTEM.md` | Tokens, typography, motion presets, chart conventions, component inventory. **A colour change requires a fresh palette validation recorded in §9.** |
| `PLAN.md` | Feature scope, acceptance criteria, the tracker, a new asset task for Rishabh |
| `.claude/agents/*.md` | An agent's responsibilities, gates, or constraints change |

**Rules that make this real:**

- **Documentation changes ship in the same PR as the code.** A PR that changes behaviour without
  updating the affected document is a blocking review finding.
- **If the docs and the code disagree, that is a defect** — not a matter of taste. Either the code is
  wrong or the document is stale; the CR must resolve which.
- A **new requirement gets a new requirement ID** so QA can trace a test to it.
- A **corrected data fact** must be re-verified against the database, and the old figure replaced
  everywhere it appears — including `REQUIREMENTS.md` Appendix A.
- The `reviewer` verifies the Document Impact Assessment was **honoured**, not merely written.

### 5.4 Gate order for a change request

Identical to a feature. Branch: `change/CR-<id>-<slug>`.

```
1.  orchestrator        → CR entry, triage, class, Document Impact Assessment
2.  principal-engineer  → technical spec + confirms/corrects the doc impact
3.  designer            → design spec (skip only if the CR touches no UI — recorded explicitly)
4.  developer           → implement on change/CR-<id>-<slug>, including doc updates
5.  designer            → visual verification via Playwright MCP
6.  developer           → fix design findings                       (loop 5–6)
7.  reviewer            → code review + verifies doc updates landed
8.  reviewer            → security audit, S-1 … S-14
9.  developer           → fix blocking findings                     (loop 7–9)
10. qa                  → E2E for affected surfaces + regression on neighbours
11. developer           → fix QA findings                           (loop 10–11)
12. orchestrator        → verify every gate → approve → merge
```

Step 3 may be skipped **only** when the CR provably touches no UI, and the `orchestrator` records
that decision and its reason in the CR entry.

### 5.5 Change request log

| ID | Date | Request | Class | Docs affected | Branch | Status | Approved |
|---|---|---|---|---|---|---|---|
| CR-001 | 2026-08-04 | Every requested change must traverse the full agent order, with document impact stated | C | `PLAN.md` §5 (new), `.claude/agents/*` (all six) | `main` (pre-F0 setup) | ✅ Done | 2026-08-04 |
| CR-002 | 2026-08-04 | Rewrite the passages of `REQUIREMENTS.md` that characterise where the dataset came from, so a fresh clone carries none of it. Fix `HEAD` only; accept the history exposure | C | ~~`REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `PLAN.md`, `.claude/agents/reviewer.md`~~ — none, withdrawn | ~~`change/CR-002-requirements-hygiene`~~ — never opened | **⛔ WITHDRAWN 2026-08-04 — Rishabh's decision** | — |
| CR-003 | 2026-08-04 | `REQUIREMENTS.md` §2.2 / §2.5 say 2026 has 24 rounds scheduled; the data holds 24 calendar rows but only 22 numbered rounds | C | `REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `PLAN.md` | `change/CR-003-numbered-rounds` | Not started (blocked on F0) | — |
| CR-004 | 2026-08-04 | "If multiple teams have the same colour, use the logos instead where necessary, and where the colours don't clash use the colours" | C | `REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `PLAN.md` | `change/CR-004-team-identity-encoding` | Logged — scheduled for F1 | — |
| CR-005 | 2026-08-04 | Remove the upstream-attribution constraint and its check from the gate order entirely — not downgrade it. Forward obligation only; the historical record stays. **Supersedes CR-002** | C | `PLAN.md`, `REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `CLAUDE.md`, `.claude/agents/*.md` | folded into `feat/foundation` (F0) — deviation recorded below | **In progress — partially blocked** | — |

---

#### CR-002 — `REQUIREMENTS.md` origin-characterisation removal · **Class C** · ⛔ **WITHDRAWN**

> ## ⛔ WITHDRAWN BY RISHABH, 2026-08-04 — do not implement, do not reopen
>
> **➡ Later that day this was overtaken entirely: see CR-005 (§5.5), which removes the underlying
> constraint rather than declining one remediation of it.** This banner is kept as the record of the
> withdrawal; CR-005 is the operative decision. Items 2 and 4 below have been corrected where they
> referred forward to a rule that no longer exists.
>
> **Rishabh withdrew this CR**, judging the exposure **"not that important"**. Everything below this
> banner is retained as the record of what was triaged and why, **not** as live work. No branch was
> ever opened; no gate beyond step 1 ever ran.
>
> **What this means concretely, so no agent re-derives it:**
>
> 1. **No agent implements any part of this CR.** `REQUIREMENTS.md` is not to be rewritten for origin
>    characterisation, and `.claude/agents/*.md` gains no S-12 amendment from this CR.
> 2. **`private/provenance-blocklist.txt` stays at its original 6 patterns**, and as of CR-005 is
>    referenced by nothing. It remains on disk, gitignored. Do not extend it, do not wire it into any
>    script, test or gate. §6.1 **A-2 is closed.**
> 3. **The related open items are declined, not deferred.** Nothing here is waiting on anyone.
> 4. **The doc-vs-action mismatch this item used to record is resolved by CR-005**, which removes the
>    rule from `PLAN.md` outright rather than leaving a policy stricter than the action taken. **One
>    part of that removal is still outstanding and a reviewer may legitimately flag it** — see
>    CR-005's gate ledger, step 4b: the copies in `CLAUDE.md` and `.claude/agents/*.md` need Rishabh's
>    own instruction before an agent may edit them, so until he gives it those files still carry the
>    obligation. That is a recorded, deliberate partial state, **not a new finding**.
> 5. **`db/schema.sql` hygiene is untouched by this withdrawal** — it was always **F0 task T2's**
>    work, with its own acceptance criteria and T14's line-by-line re-read, and T2 **stands and is in
>    the gate-3 dispatch**.
> 6. **CR-003 no longer rebases onto CR-002.** The §2.5 line-154 collision the sequencing note below
>    was written to avoid cannot happen now. CR-003's sequencing is simply **F0 merge → CR-003**.
>
> **Recording provenance of the withdrawal honestly:** the previous agent recording this decision was
> stopped before it wrote, which is why §5.5 and §6.1 showed CR-002 as open-and-highest-priority
> afterwards. This banner is that correction.

**Request (Rishabh, 2026-08-04).** The passages of `REQUIREMENTS.md` that characterise where the
dataset came from must be rewritten so no future clone carries them. **Fix `HEAD` only and accept the
history exposure**: do **not** rewrite history, do **not** force-push, do **not** touch the remote.

**Why this is the highest priority.** This is `CLAUDE.md` §4.1 / §2.4 release-blocker class, and it is
**already on public `main`** in commit `f18d2c4`. Rishabh has decided the remediation is forward-only.

**Triage — what is affected.** Documentation only. **No feature, no route, no endpoint, no component,
no query, no requirement ID.** Nothing in F0's Technical or Design Spec depends on any of it. Affected
locations, by line and item number so the offending wording is not restated here:

| File | Locations |
|---|---|
| `REQUIREMENTS.md` | §9.1 item 2 (five distinct characterisations in one paragraph: a form, a mechanism, a quantified access limit, and the consequence drawn from it) · §9.1 item 3 (trailing clause) · §9.2 item 5 (a quantified freshness delay, a paid tier, a licence consequence, and a pipeline property) · §9.2 item 9 · §9.2 item 11 · §2.2 line 82 and line 87 (a quantified delay) · §2.5 line 154 (parenthetical) · §6 line 450 (lead-in phrase) · Appendix A line 559 (trailing clause) |
| `.gitignore` | Add `.claude/settings.local.json`. It currently escapes commit only via Rishabh's **machine-global** ignore file, which protects this machine and nobody else's — and it holds the name of the one non-application table |

**One item needing an explicit verdict, not silence.** `REQUIREMENTS.md` §6 (line ~464) names a
third-party timing library as a *possible future addition* if telemetry features are ever required.
My reading is that it **stays**: it describes a hypothetical future source, not the origin of the
shipped dataset, and it is load-bearing for the §6 out-of-scope argument. The `principal-engineer`
must confirm or overturn that reading in writing at gate 2 of this CR, so a later reviewer does not
have to re-litigate it.

**Explicitly out of scope, and why.** `db/schema.sql` needs the same treatment (its header notes and
its trailing non-application table block describe an ingest pipeline) but is **already owned by F0 task
T2**, which has its own acceptance criteria and a T14 line-by-line re-read. Cross-referenced here so
neither CR-002 nor T2 assumes the other did it. **Do not duplicate T2 in this branch** — F0 merges
first and the branches would conflict.

**Rules for whoever implements this.** The replacement prose must preserve every *product* requirement
in the passages (the read-only posture, the currency requirement and NV-9, the enum-decode obligation,
the "confirm terms before public deployment" obligation) while stating nothing about origin.
**Do not reproduce the removed vocabulary in a commit message, a PR title, a code comment, a test
name, or in this document.** The behavioural requirement in §2.2 — that a "latest race" surface reads
the newest round *present in the database* and never assumes today's calendar position — is
**correct and must survive**; only its quantified justification goes.

##### Document Impact Assessment — CR-002

| Document | Verdict |
|---|---|
| `REQUIREMENTS.md` | **CHANGE — the substance of the CR.** Nine locations above. No requirement ID is added, removed or renumbered; no coverage figure changes; §7.2's existing prohibition already says the right thing and stands unedited. |
| `docs/ARCHITECTURE.md` | **CHANGE — a §10 decision-log entry, required by Class C.** Record: the repository characterises the dataset's origin nowhere; `REQUIREMENTS.md` was rewritten at `HEAD` on this date; the text remains in git history in `f18d2c4` and that is an **accepted, recorded risk**, not a remediated one. No stack, layering, API-surface, routing or performance-budget change. **S-12 needs no amendment** — it already forbids exactly this; the failure was one of enforcement, not of policy. |
| `docs/DATABASE.md` | **No change.** §1–§9 describe schema, canonical queries, traps, coverage and maintenance only. Re-read at CR open to confirm. |
| `docs/DESIGN_SYSTEM.md` | **No change to tokens, typography, motion or chart conventions. One verification obligation:** the `designer` must confirm that §7.3's data-currency copy and the Design Spec §5.1 copy do not derive from the §2.2 sentence being rewritten — and correct them in this CR if they do. Expected clean: the `designer` independently chose **coverage** phrasing over elapsed-time phrasing for exactly this reason. **No colour change → no fresh §9 validation run required.** |
| `PLAN.md` | **CHANGE.** This CR entry; two new §6 risk rows (history exposure; the blocklist's blind spot); a §7 change-log row. §2.4 stands unedited — it is already correct. |
| `.claude/agents/*.md` | **CHANGE — `reviewer.md` plus a one-line rule in all six.** (1) `.claude/agents/reviewer.md` §S-12 currently defines the check as four greps and says "Any hit is blocking". Verified 2026-08-04: **it never says the grep is a floor rather than the standard.** That is the **root cause, not the symptom** — the blocklist holds vendor names only, so the grep returns `clean` against both the affected passages and `db/schema.sql`, and a reviewer following S-12 literally would have passed this text too. The amendment must fix the **class**: the `reviewer` reads every prose, comment and documentation change in a PR for text that characterises where the data came from, and treats the grep as a floor beneath that read. A rule that only catches vendor names will keep missing paraphrase. (2) **All six agent files** gain the §2.3 standing rule — *file ownership restricts who edits, never who reports* — because an agent that finds this class of text in a file it does not own must escalate rather than move on. Scope extended 2026-08-04 by the `orchestrator`. |

**Gate plan (§5.4), with depth recorded.** Steps 1–2 and 7–9 run in full. Two deviations, recorded
here rather than taken silently, because **no application exists at this commit**:
step 3 (design spec) is **skipped — the CR provably touches no UI**, as §5.4 permits, and step 5
(visual verification) is replaced by the `designer`'s **copy-derivation check** named in the
assessment above; step 10 (QA) is a **documentation-conformance pass** — requirement-ID traceability
unbroken, blocklist grep clean, and a read-through of the rewritten passages — in place of E2E, which
has nothing to run against.

> **✅ Both deviations RULED ON and AUTHORISED, 2026-08-04.** They were escalated, not assumed.
> Stated reasoning: get the release-blocker text out of the working tree fastest.
>
> **Provenance of this authorisation, recorded precisely because this document's value depends on
> being honest about who decided what:** the ruling reached the `orchestrator` **relayed through the
> coordinating agent**, attributed to Rishabh. It was not received first-hand from him. It is a valid
> work instruction and the work proceeds on it; it is **not** recorded as Rishabh's personal
> countersignature. If he confirms it directly, this line gets replaced with a first-hand record.
>
> **A later reviewer must read this as an explicit ruling, not an omission** — the skipped design-spec
> gate and the two reduced gates are authorised for **CR-002 only**, on the stated grounds that no
> application exists at this commit. They set **no precedent**: every CR opened after F0 merges has a
> running application to test against and therefore gets steps 3, 5 and 10 in full.

**Gate ledger for CR-002 — CLOSED WITHOUT IMPLEMENTATION.**

| Step | Gate | Owner | State |
|---|---|---|---|
| 1 | CR entry, triage, class, Document Impact Assessment | `orchestrator` | ✅ 2026-08-04 — this entry |
| 2–12 | Everything after triage | — | ⛔ **Never ran — CR withdrawn by Rishabh 2026-08-04.** No branch opened, no code or document changed |

**The two gate deviations authorised above (skipped design spec; reduced gates 5 and 10) are moot** and
set no precedent, exactly as they said they did not.

---

#### CR-003 — 2026 has 22 numbered rounds, not 24 · **Class C**

**Request (Rishabh, 2026-08-04).** `REQUIREMENTS.md` §2.2 and §2.5 both state that 2026 has "24 rounds
scheduled". The data holds **24 `round` rows but only 22 numbered rounds** — 2 are cancelled, and a
cancelled round carries `round.number IS NULL`.

**✅ Re-verified by the orchestrator, 2026-08-04**, independently of the `principal-engineer`:

```
SELECT count(*) FROM round WHERE number IS NULL;                     -- 2
SELECT count(*) FROM round WHERE number IS NULL AND is_cancelled=1;  -- 2
SELECT count(*) FROM round WHERE is_cancelled=1 AND number IS NOT NULL; -- 0
SELECT count(*), max(number) FROM round r JOIN season s ON s.id=r.season_id
  WHERE s.year=2026;                                                 -- 24 | 22
```

**Cross-reference — this is the product-facing half of new trap 15.** The query-facing half is
`docs/DATABASE.md` trap 15, added by **F0 task T14**: SQLite sorts `NULL` **first**, so a bare
`ORDER BY r.number` silently puts both cancelled rounds at the top of every season list, and a
cancelled round is not addressable by `/seasons/:year/races/:round` because it has no number.

**⛔ Blocked on F0 — and that is now the *only* thing blocking it.** T14 adds trap 15; this CR
cross-references it. Opening this branch before F0 merges would either duplicate trap 15 or reference
something that does not exist. Sequence: **F0 merge → CR-003.**

**Updated 2026-08-04:** this previously read `CR-002 → F0 merge → CR-003`, because CR-002 was going to
rewrite §2.5 line 154 — the same line CR-003 corrects — and CR-003 was to rebase onto it. **CR-002 is
withdrawn**, so that collision cannot occur and there is no rebase dependency. CR-003 edits §2.5
line 154 directly.

**Class C, and the reason is the re-verification pass**, not the size of the edit: §5.3 requires a
corrected data fact to be re-verified against the database and replaced *everywhere it appears*,
including Appendix A. That sweep is the work.

##### Document Impact Assessment — CR-003

| Document | Verdict |
|---|---|
| `REQUIREMENTS.md` | **CHANGE.** §2.2 line 82 and §2.5 line 154: replace "24 rounds scheduled" with the calendar-rows-vs-numbered-rounds distinction (24 on the calendar, **22 numbered**, 2 cancelled) and state that a cancelled round is neither a scheduled round nor a data gap. **Appendix A must be swept, not assumed clean** — its "141/155 in the 2020s" lap-coverage row is a round-count-derived figure and must be re-verified against the database to establish whether cancelled rounds are inside or outside that denominator. |
| `docs/ARCHITECTURE.md` | **CHANGE — a §10 decision-log entry, required by Class C**, recording the addressability contract: `/seasons/:year/races/:round` resolves only numbered rounds, so a cancelled round has no URL. §5's routing table gains the same one-line qualification. The Technical Spec §1.3 already behaves this way; the URL contract does not yet say so. |
| `docs/DATABASE.md` | **CHANGE, but authored by F0 T14, not here.** Trap 15 and the §9 post-refresh check are T14's. This CR's obligation is the Class-C **re-verification pass** over any §4 coverage claim whose denominator counts rounds, and confirming trap 15 as merged reads correctly against the corrected `REQUIREMENTS.md` wording. If F0 has not merged, this CR does not start (see above). |
| `docs/DESIGN_SYSTEM.md` | **No change — and this is worth recording as evidence rather than an assumption.** §7.3 and Design Spec §5.1 already drive every number from `GET /api/meta` (`Round {round} of {scheduledRounds}`) and already carry a dedicated line surfacing cancelled rounds separately — "{cancelledRounds} rounds on the {year} calendar were cancelled." The design anticipated this correctly; nothing to amend. No colour change → no §9 run. |
| `PLAN.md` | **CHANGE.** This CR entry; a §7 change-log row. **F0's scope and acceptance criteria are unaffected** — the Technical Spec §0.2/§1.4 already return `scheduledRounds: 22, cancelledRounds: 2, completedRounds: 10`, so no F0 gate is reopened by this correction. |
| `.claude/agents/*.md` | **No change.** No agent's responsibilities, gates or constraints move. Trap 15 reaches the agents through `docs/DATABASE.md` §7, which they are already required to read. |

---

#### CR-004 — team identity encoding: logos where colours clash · **Class C** · scheduled for **F1**

**Request (Rishabh, 2026-08-04), recorded as his intent:** *"If multiple teams have the same colour,
use the logos instead where necessary, and where the colours don't clash use the colours."*

**Three constraints were put to Rishabh at the time the request was made, and are recorded with it so
the CR is not implemented against a rosier reading than he was given:**

1. **It makes R2 (team logos) a hard dependency** for F5, F7 and any two-team chart — today R2 is
   `Not started` and unowned by any feature's critical path.
2. **202 of 214 teams have no brand colour, and no logo either.** The deterministic fallback ramp
   (`DESIGN_SYSTEM.md` §3.1) is therefore **still required regardless**. Logos can only sit in front
   of it for the current era; they do not replace it and they do not shrink its scope.
3. **Logos degrade to mud at 8–12px**, which is chart-marker scale. The workable home for logo-based
   identity is **identity surfaces** — cards, headers, table rows, entity pickers — rather than chart
   series marks, where the existing secondary-encoding ladder (direct labels, dash patterns, marker
   shapes) remains the mechanism.

**Why F1.** Team-colour resolution internals (`src/lib/teamColor.ts`, the fallback ramp, the
collision-detection thresholds, the per-theme chart-safe variants) were **already deferred to F1**.
Landing this there means one design pass over colour resolution instead of two.

**The binding caveat.** `DESIGN_SYSTEM.md` §3.3's rules are **measured**, not stylistic — they exist
because a validator failed four checks on the 2026 brand palette (§3.2), reproduced in F0 as run V-1.
**An amendment to §3.3 needs validator evidence recorded in §9.2, not an argument.** Specifically: any
claim that a given pair "doesn't clash" and may therefore rely on colour alone must come from a
recorded run against the §9.1 floors, in **both** themes and under all three CVD models — which is
also why `scripts/validate-palette.mjs` must land in F1 (F0 gate record G.4 item 4) before this CR can
be reviewed at all.

##### Document Impact Assessment — CR-004

| Document | Verdict |
|---|---|
| `REQUIREMENTS.md` | **CHANGE.** A **new requirement ID** for logo-based identity encoding, so `qa` can trace a test to it, plus the statement that R2 becomes a hard dependency of the surfaces that use it. §6 (out of scope) is **not** touched — missing logos are an asset gap, not a data gap. |
| `docs/ARCHITECTURE.md` | **CHANGE.** A §10 decision-log entry (Class C). §3's layering rule "colour resolution goes through one module" must be restated to cover **identity resolution** (colour *or* logo *or* ramp) so the decision stays in one module rather than spreading into components. Check the asset-loading path against the §8 bundle budget — 214 potential SVGs must not reach the initial chunk. |
| `docs/DATABASE.md` | **No change.** No new query, no new trap, no coverage correction. `team.primary_color`'s 12-of-214 coverage is already recorded, and logos are files rather than columns. |
| `docs/DESIGN_SYSTEM.md` | **CHANGE — this is the substantive one.** §3.3 gains a resolution ladder (when a logo carries identity, when a colour does, when the ramp does), a minimum legible logo size, and an explicit restatement that the fallback ramp survives. §3.1–§3.2's measured facts are **not** re-litigated. **A fresh §9.2 validation run is required for any collision threshold or derived variant this introduces**, per §5.3's colour rule and §3.3 rule 7. |
| `PLAN.md` | **CHANGE.** This CR entry; F1's scope bullet (already added); F5 and F7's `Depends on` become hard on R2; the R2 tracker row gains the note that it now blocks feature work rather than only enriching it; a §6 risk row; a §7 change-log row. |
| `.claude/agents/*.md` | **No change.** The `designer` already owns `DESIGN_SYSTEM.md` and already may not soften a measured constraint; the `reviewer` already checks design conformance. No responsibility moves. |

---

#### CR-005 — remove the upstream-attribution constraint from the gate order · **Class C** · supersedes CR-002

**Request (Rishabh, in session, 2026-08-04 — stated across two messages: the decision, then a
clarification narrowing it to forward-going only).** The
upstream-attribution constraint and its accompanying check are **removed, not downgraded**. He will
make the repository private and does not consider the exposure a problem.

**Corrected scope, same day, same route:** the removal covers the **forward-going obligation only**.
The historical record is **not** scrubbed. Checks already run were correct at the time and stay on the
record verbatim.

| Removed — anything that could make a future gate fail | Kept — factual log of work already done |
|---|---|
| The rule as a standing constraint / release blocker | Gate records and evidence entries stating the check was run and came back clean, **verbatim** — `PLAN.md` Technical Spec §9.5, gate record §G.1 |
| The `reviewer`'s duty to run it, and its entry in the security-audit item list (`S-12`) | The CR log, **including CR-002 and its withdrawal** |
| The duty as it appears in the agent definitions | Every past commit message — nothing rewritten, nothing reverted |
| Its presence in any future gate checklist or required-evidence list (F0 §G.7, F11, §2.5 DoD) | The `.gitignore` entries for `private/` and `data/`, which exist for a 66 MB binary and local-only tooling and are unrelated |

So this CR reads **"the constraint stops applying from here on"**, never "the constraint never
existed".

**Class C, and the reason is structural reach, not edit size:** it changes the gate order, the
Definition of Done, the security-audit item list, and agent responsibilities.

**Triage — what is affected.** **No feature, no route, no endpoint, no component, no query, no
requirement ID, no token.** No application behaviour changes and no UI changes. F0's scope and
acceptance criteria are untouched except that **two acceptance cells** (T2, T14) lost check-based
clauses; **T2's and T14's substance both stand in full**, on DL-3 / trap-11 and documentation grounds
respectively.

**Three execution rules, binding on every agent touching this CR:**

1. **Delete; do not explain.** A removal that replaces the rule with a description of what it used to
   forbid — in particular one that writes a specific upstream source name into a tracked file — is
   **strictly worse than leaving the gate in place**. Neutral wording only.
2. **No upstream source name in any tracked file, commit message, or branch name.** Git history
   survives the repository going private and cannot be cleanly rewritten afterwards, so history is
   treated as append-only and permanent. The repository is public until Rishabh flips it, which is
   why neutral wording remains the cheap option in the meantime.
3. **`private/provenance-blocklist.txt` stays on disk, untouched, gitignored, and referenced by
   nothing.** Do not delete it, do not extend it, do not wire it into any script, test, npm script or
   CI step.

##### Document Impact Assessment — CR-005

Every canonical document gets an explicit verdict. Each hit was **individually read before editing** —
the raw grep over-reports, because several matches are incidental prose rather than the rule.

| Document | Verdict |
|---|---|
| `PLAN.md` | **CHANGE — done, by the `orchestrator`.** §1 non-negotiables bullet removed · §2.3 standing rule kept but its release-blocker clause and check reference removed · **§2.4 removed**, section number retained as a tombstone so existing cross-references do not silently retarget · §2.5 Definition of Done now reads "no database, `.env`, or seed artefact staged" · Technical Spec §3.5 component note, **T2 and T14 acceptance cells**, §8 task-ordering rationale, §9.4 open item 3 · **F11** scope and acceptance · §6 risk row removed · §6.1 **A-1 and A-2 closed** · §G.7 amended in place with the mid-run correction recorded · CR-002 banner items 2 and 4 corrected to point here · this entry · §7 change-log rows. **Deliberately left verbatim:** Technical Spec §9.5, gate record §G.1, the F0 gate-1/gate-2 assignment briefs, and all CR-002 history. |
| `REQUIREMENTS.md` | **CHANGE — routed to the `principal-engineer`, who owns it.** One forward obligation, **§7.2 line 495**. The other three bullets in §7.2 stay: never commit the database or a raw seed file; a fresh clone has no database; schema changes are mirrored in `db/schema.sql`. No requirement ID is added, removed or renumbered; no coverage figure moves; §6 (out of scope) is untouched. |
| `docs/ARCHITECTURE.md` | **CHANGE — routed to the `principal-engineer`.** Two edits: **§7 `S-12` removed from the security-posture table** (this is the security-audit item list, so the audit becomes S-1…S-11 + S-13…S-14 — renumbering is **not** wanted, the identifiers are load-bearing in review history), and a **§10 decision-log entry, required by Class C**. No stack, layering, API-surface, routing, or performance-budget change. |
| `docs/DATABASE.md` | **No change.** Re-read at CR open: §1–§9 describe schema, canonical queries, traps, coverage and maintenance only, and carry no reference to the rule. F0 **T14** still adds trap 15 and the §9 checklist items, unaffected. |
| `docs/DESIGN_SYSTEM.md` | **CHANGE — ✅ landed `713b760`** by the `designer`. **My assessment said "one line, §7.3 line 654" and was wrong — the obligation was carried in three places and the `designer` removed all three. Expansion reviewed and ACCEPTED** (ruling below). The `DataVintage` **copy is byte-identical**: coverage phrasing survives on independent grounds, confirmed in writing by the `designer` with a third ground I had not listed. **No token, colour, typography, motion or component change → no §9 palette validation run required, and none was run.** |
| `.gitignore` | **No change.** This row was **missing from my first assessment** — an omission, since §5.3 says silence is not a verdict, and both the `principal-engineer` and the `designer` independently reported the gap. Verdict on the merits: line 7 is a **comment describing what `private/` holds**, not an obligation about what may be committed. It names nothing and gates nothing. The `private/` and `data/` entries themselves are explicitly in CR-005's **Kept** column. Editing a comment here would be scrubbing the local picture for no gain. **No change, deliberately.** |
| `CLAUDE.md` | **CHANGE REQUIRED — ⛔ BLOCKED, needs Rishabh's own instruction.** Six hits, including §4.1 (the rule) and its appearances in §3, §5 and §8. See the escalation note below. |
| `.claude/agents/*.md` | **CHANGE REQUIRED — ⛔ BLOCKED, needs Rishabh's own instruction.** `reviewer.md` (7 hits, incl. the `S-12` duty), `orchestrator.md` (4), `developer.md` (3), `principal-engineer.md` (1), `designer.md` (1). `qa.md` carries none. See the escalation note below. |

##### ⛔ Escalation — the `CLAUDE.md` and `.claude/agents/*.md` half needs Rishabh directly

**The decision itself is not in question — it is Rishabh's, stated by him in session on 2026-08-04.**
This is a **channel** requirement, not a doubt about authority. The `orchestrator`'s operating rules
reserve edits to `CLAUDE.md` and to agent configuration to Rishabh's own message or the permission
system, and they do so **categorically** — the reservation applies to a *class of file*, however
well-attested the instruction is, precisely because "remove a guardrail from the files that define the
agents' own obligations" is the one request that must not be self-serviceable. A rule that yielded to
a sufficiently confident instruction would not be a rule.

So this is a formality with a real cost of exactly one line from Rishabh, and no judgement is implied
about the instruction, which is well-attested and which the `orchestrator` has otherwise implemented
in full.

**Consequence, stated plainly so no one is surprised at a later gate:** until Rishabh instructs it
himself, `CLAUDE.md` §4.1 and `.claude/agents/reviewer.md`'s `S-12` still carry the obligation, so
**the `reviewer` will still run the check at gate 7 and may still raise it as a finding.** That is a
recorded, deliberate partial state — not a defect and not a new finding. One line from Rishabh clears
it.

##### Gate order for CR-005 — deviation recorded, per §5.4

**Deviation: this CR is folded into `feat/foundation` rather than opening
`change/CR-005-<slug>`.** Instructed, and recorded here rather than taken silently. Grounds: gate 3 of
F0 was **already in flight** when the CR arrived, and two F0 task acceptance cells (T2, T14) gated
in-flight work on the removed check. A separate branch would either block gate 3 or merge after it,
leaving the `developer` working to superseded acceptance criteria in the meantime. **This sets no
precedent** — it rests on gate 3 being open at the moment the instruction landed.

| Step | Gate | Owner | State |
|---|---|---|---|
| 1 | CR entry, triage, class, Document Impact Assessment | `orchestrator` | ✅ 2026-08-04 — this entry |
| 2 | Technical spec + confirms/corrects the doc impact | `principal-engineer` | Folded into step 4a — the change is a documented removal with no technical design content; the `principal-engineer` confirms or corrects the assessment when it makes its own edits |
| 3 | Design spec | — | **Skipped — the CR provably touches no UI** (§5.4). No route, component, state, token or copy string changes. Recorded, not assumed |
| 4 | Implement | | |
| 4a | `PLAN.md` removals | `orchestrator` | ✅ 2026-08-04 |
| 4b | `CLAUDE.md` + `.claude/agents/*.md` | **Rishabh** | ⛔ **BLOCKED — needs his own instruction.** See the escalation above |
| 4c | `REQUIREMENTS.md` §7.2, `docs/ARCHITECTURE.md` §7 `S-12` + §10 entry | `principal-engineer` | ✅ **Landed `4a28b99`** 2026-08-04 · **verified by the `orchestrator`, not taken on report**: §7.2's other three bullets and lead-in byte-identical; `S-12` absent with `S-13`/`S-14` **unrenumbered and unchanged**; §10 entry 20 present; two files, 4 insertions / 3 deletions, nothing else swept in. **One amendment in flight** — see the attribution ruling below |
| 4d | `docs/DESIGN_SYSTEM.md` §7.3 | `designer` | ✅ **Landed `713b760`** 2026-08-04 · **verified**: one file, 9 insertions / 10 deletions, all prose inside §7.3 plus a §11 log row; **every `DataVintage` copy string byte-identical**; §9 untouched. **Scope expanded beyond my assessment — accepted, see ruling** |
| 5 | Visual verification | — | **Not applicable — no UI change.** Folded into F0's own gate 4, which runs regardless |
| 6 | Fix design findings | — | n/a |
| 7 | Code review + verifies doc updates landed | `reviewer` | Runs as part of F0 gate 6. **Must verify this assessment was honoured, not merely written** (§5.3) |
| 8 | Security audit | `reviewer` | Runs as part of F0 gate 7, minus `S-12` **once 4b lands**; with it until then |
| 9 | Fix blocking findings | `developer` | As part of F0 gate 8 |
| 10 | E2E | `qa` | **Not applicable — no behaviour change.** F0's own gate 9 covers the branch |
| 11 | Fix QA findings | `developer` | n/a |
| 12 | Verify every gate → approve → merge | `orchestrator` | Pending — **cannot approve while 4b is blocked**, since a merge would ship documents that disagree with each other |

##### CR-005 rulings — `orchestrator`, 2026-08-04

**Ruling 1 — the `designer`'s expanded scope in §7.3 is ACCEPTED, and my assessment was the thing at
fault.** I scoped 4d from a grep hit ("one line, line 654"). The `designer` read the section instead
and found the obligation carried in three places. It is right and I was wrong:

| Carrier | Why removing only line 654 would have been the wrong outcome |
|---|---|
| Line 653 — a bolded "hard constraint" sentence | This **is** the obligation; line 654 was only its enforcement citation. Deleting the citation alone would have left a live bolded constraint with its enforcement stripped — **the gate removed and the rule left standing**, which inverts the CR's intent |
| Line 658 — a subordinate rationale clause | Its only ground was the removed rule; left in place it re-asserts the obligation as design rationale |
| Lines 679–680 — "**Banned from this component and its tests, fixtures and comments…**" | The most operative carrier in the file. A `reviewer` or the `developer` would read it as binding |

**The lesson is procedural and worth keeping:** a Document Impact Assessment built from grep line
numbers under-reports, because a rule is often stated in one sentence and cited in another. The owning
agent reading its own section is the check that catches it. This is the second time in this CR that a
document owner corrected my assessment — the `.gitignore` row is the other.

**Ruling 2 — the lines 679–680 rewrite is ACCEPTED as a rewrite, not a deletion.** That sentence
banned two different things: origin language (removed) and refresh/update-mechanism language (**not
removed**). The `designer` kept the second and re-grounded it on `REQUIREMENTS.md` §2.2. That is
correct — deleting the whole sentence would have silently dropped a still-valid ban, and §2.2 makes
elapsed-time phrasing a **defect** rather than a preference, because it asserts a relationship between
the data and *now* that can be false on the day it renders. No restoration of the original wording is
wanted.

**Ruling 3 — the `DataVintage` copy stands, confirmed on three independent grounds.** Both mine (it
states a calendar fact; §2.2 forbids assuming today's calendar position) plus one the `designer` added
that neither of us had listed: the indicator shares **one coverage vocabulary** with §7.4's
no-coverage states, so switching it to freshness language would fork that vocabulary and leave the
indicator saying "recently updated" beside a chart saying "no lap data before 1996". Coherence, not
compliance. No copy string changed.

**Ruling 4 — the `principal-engineer`'s `S-12` gap note is ACCEPTED as necessary, not decorative.**
§7's table is the `reviewer`'s work list, read top to bottom; an unexplained numeric gap in a dense
sequence reads as a truncation bug. The note states only *that* the row was removed.

**Ruling 5 — WITHDRAWN, and it was wrong. Recorded rather than deleted, because the mistake is the
useful part.**

I originally ruled that `ARCHITECTURE.md` §10 entry 20's plain "Decided by Rishabh." overstated what
could be attested, and had the `principal-engineer` add a hedge saying the instruction was relayed, not
received first-hand, and was therefore "a work instruction and not his personal countersignature".
**That hedge was factually wrong and is reversed** (dispatched to the `principal-engineer`; entry 20
otherwise byte-identical).

**Corrected provenance: Rishabh stated this himself, in his own words, in session on 2026-08-04, across
two messages** — the decision, then a clarification narrowing it to forward-going only. The
coordinating session **relayed** his instruction; it did not originate, infer or reconstruct it. Entry
20 and this CR now read **"Decided by Rishabh in session, 2026-08-04."**

**The principle, recorded so it does not recur — this is the part worth keeping:**

> **Do not hedge or qualify the authority of an instruction on the grounds that it arrived through the
> coordinating session.** A relay is the normal path for every instruction every agent in this project
> receives; it is not a weakening of attribution. Writing a "may not really be his" qualifier into a
> canonical document is worse than saying nothing, because it **understates a real decision's
> authority** in the document a future reader will trust — and a decision log that hedges its own
> attributions is less useful, not more scrupulous. **If provenance is ever genuinely unclear, ask.**
> Do not resolve the doubt by writing the doubt into the record.

**What this does *not* change:** the §4.1 / `.claude/agents/*.md` block at step 4b **stands**. That
rests on a **categorical channel rule** about a class of file, not on any doubt about who decided this
— see the escalation note above, which has been reworded so it no longer implies otherwise.

**One item flagged, not silently changed.** The CR-002 authorisation note earlier in §5.5 carries the
same "relayed … not received first-hand … countersignature" formulation, about a **different**
instruction, received in an **earlier session** that this `orchestrator` did not witness. I have not
re-attributed it, because I have no first-hand knowledge of how that one arrived and the corrected
principle above says to ask rather than to write a guess into the record. It is also **moot** — the
gate deviations it authorised belong to a withdrawn CR and never ran. Raised for confirmation; it is a
two-word fix if the same correction applies.

**Ruling 6 — the `designer`'s proposed follow-up is NOT folded into CR-005, and is NOT an agent's
call.** With the compliance rule gone, coverage-over-freshness survives only as *rationale inside one
component spec*. The `designer` proposes re-seating it as a design-system non-negotiable (§6.2 or
§7.0) and, correctly, did not write it. **That would be a new design-system rule — a scope addition,
which is Rishabh's to approve.** Logged as a proposed follow-up in §6.1 **A-7**; not actioned.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Lap data absent before 1996 — the flagship feature's core limit | Designed no-coverage states are a first-class requirement, not an error path (F3) |
| Team brand colours fail perceptual separation | Runtime collision detection + mandatory secondary encoding (F1) |
| Cross-era points comparisons silently wrong | `championship_system` applied; normalization always visible; reviewer trap-4 check |
| Position chart performance at lap scale | visx + server-side downsampling; budget in `ARCHITECTURE.md` §8 |
| Images unavailable for 881 drivers / 214 teams | Placeholders are permanent infrastructure, not a stopgap |
| Playwright MCP not configured | `qa` and `designer` must stop and report, never work around it |
| Design incoherence across features | Design system lands before any feature (F1); nothing invents tokens after |

### 6.1 Accepted risks and open items — recorded 2026-08-04

These are **not** mitigated. They are decided, or they are waiting on someone. Recording them here is
the mitigation available.

| # | Item | Status |
|---|---|---|
| **A-1** | ~~Upstream-attribution text at `HEAD` and in git history~~ | ✅ **CLOSED 2026-08-04 by CR-005** (§5.5) — the constraint this risk was measured against no longer applies. Rishabh will make the repository private and does not consider the exposure a problem. Nothing outstanding; nothing to remediate, forward or backward. |
| **A-2** | ~~The blocked-terms list is narrower than the policy it enforced~~ | ✅ **CLOSED 2026-08-04 by CR-005** (§5.5) — the policy is withdrawn, so the list enforces nothing and is not a gap. `private/provenance-blocklist.txt` stays on disk, gitignored and unreferenced; **do not extend it and do not wire it into anything.** `db/schema.sql` hygiene is unaffected and still lands via **F0 T2**, on DL-3 / trap-11 grounds. |
| **A-3** | **Product name.** "F1" is a registered trade mark and Formula 1's published guidelines forbid using their typefaces and warn against using Titillium in any manner that implies association with the Championship. The repository is public. The design system deliberately leans on none of F1's visual identity (`DESIGN_SYSTEM.md` §2.1), but the literal string "F1 Analytics" is a naming and legal decision, not a design one. | **Working name kept. Decision deferred to F11.** Not an agent's call. A rename is a token change, so deferring costs little. |
| **A-4** | **Playwright MCP registration needed a restart to reach the tool list.** | ✅ **CLOSED 2026-08-04.** The restart has happened; `mcp__playwright__*` tools are present. Gates 4 and 9 are unblocked (G.6). The standing rule survives: each agent still checks its **own** tool list at run time and stops if the tools are absent. |
| **A-5** | **Node 22 was not installed** — the machine had only v20.18.2, and `/opt/homebrew/opt/node@22` is a **mislabelled keg containing v23.7.0**. | ✅ **CLOSED 2026-08-04 — Rishabh installed it.** `node -v` → **v22.23.2**, npm 10.9.8, `default -> 22.23.2`; `better-sqlite3@12.11.1` builds and loads; `npm audit` clean. **Residual, not a risk but a footgun:** an agent shell started before the install still resolves v20.18.2, so `CLAUDE.md` §7's `nvm use 22.23.2` step and **T1's own `node -v` assertion** both remain mandatory. The mislabelled keg must still never be used. |
| **A-7** | **Proposed follow-up, needs Rishabh: re-seat "coverage, never freshness" as a design-system non-negotiable.** CR-005 removed the compliance rule that backed the `DataVintage` copy, so the principle now survives only as **rationale inside one component spec** (`DESIGN_SYSTEM.md` §7.3) rather than as a rule. It rests on two independent grounds that have nothing to do with the removed constraint — `REQUIREMENTS.md` §2.2 makes elapsed-time phrasing a **defect**, and the coverage vocabulary is shared with §7.4's no-coverage states — so the principle is sound; only its *standing* dropped. The `designer` proposes a two-line entry in §6.2 or §7.0 and correctly did not write it. | **⛔ Open — on Rishabh.** A **new** design-system rule is a scope addition, not an agent's call. Deliberately **not** folded into CR-005, which is a removal. Cheap to do as a separate change if he wants it; the risk of skipping it is that a later feature reintroduces freshness phrasing with nothing binding to stop it. |
| **A-6** | **R2 becomes a blocking dependency if CR-004 is implemented** — team logos would gate F5, F7 and any two-team identity surface, and 202 of 214 teams will never have one. | Open — CR-004 is scheduled for F1; the fallback ramp remains mandatory regardless, so the risk is to *scope*, not to correctness. |

---

## 7. Document change log

| Date | Change | By |
|---|---|---|
| 2026-08-04 | Initial plan, architecture, database and agent definitions created | — |
| 2026-08-04 | CR-001: change-request workflow + document impact assessment added (§5) | orchestrator |
| 2026-08-04 | R0 satisfied — database verified present (19 tables, 717,764 laps, through 2026 R10) | orchestrator |
| 2026-08-04 | F0 started on `feat/foundation`; gates 1–2 dispatched in parallel | orchestrator |
| 2026-08-04 | F0 Technical Spec written — 14 tasks; `CREATE TEMP VIEW` + `PRAGMA query_only` decision; `/api/meta` values verified against the database; revised for Node 22 after approval (S-7 exception deleted, `ARCHITECTURE.md` §10 #11 superseded by #14, #15–#16 added) | principal-engineer |
| 2026-08-04 | F0 Design Spec written; `docs/DESIGN_SYSTEM.md` §1–§10 authored (typography verified from font binaries; nine validator runs recorded in §9.2 including a calibration against the pre-existing measurements) | designer |
| 2026-08-04 | **F0 gates 1–2 verified and accepted** (agent log filled, status → `Ready for dev`). Rulings recorded: Framer Motion subset lands in F0; `ThemeToggle` is a 3-option radiogroup; achromatic chrome stands. Two doc defects block gate 3 (`DESIGN_SYSTEM.md` §10 theme-script vs the CSP; four stale task cross-references in the Technical Spec) | orchestrator |
| 2026-08-04 | `R3` added (app icons, Owner: Rishabh) — does not block F0. Recorded that R1/R2 are not on F0's critical path | orchestrator |
| 2026-08-04 | Node 22 LTS and `@hono/node-server` `^2.1.0` approved by Rishabh; stale `PLAN.md` Assignment Brief references corrected (React Router v8; Node 22) | orchestrator |
| 2026-08-04 | **CR-002** opened (Class C) — `REQUIREMENTS.md` origin-characterisation removal at `HEAD`; history exposure accepted (§6.1 A-1) | orchestrator |
| 2026-08-04 | **CR-003** opened (Class C) — 2026 has 22 numbered rounds, not 24; blocked on F0 (trap 15 lands in T14) | orchestrator |
| 2026-08-04 | **CR-004** logged (Class C) — team identity encoding via logos where colours clash; scheduled for F1 | orchestrator |
| 2026-08-04 | §6.1 accepted-risk register added (A-1 … A-6): git-history exposure, blocklist blind spot, product-name trademark question, Playwright MCP restart, Node 22 install, R2 as a blocking dependency | orchestrator |
| 2026-08-04 | **CR-002 WITHDRAWN by Rishabh** — exposure judged "not that important". Withdrawal banner added; §5.5 row, gate ledger and CR-003's sequencing note corrected; **A-2 declined** (blocklist stays at 6 patterns — a 30-pattern extension was tried and reverted because it failed §4.1 by design); A-1 widened to cover `HEAD` as well as history. §2.4 / `CLAUDE.md` §4.1 deliberately **not** downgraded — the mismatch is recorded, not a new finding | orchestrator |
| 2026-08-04 | **F0 gate-3 preconditions all cleared and independently re-verified** (P-1 Node v22.23.2; P-2 `DESIGN_SYSTEM.md` §10 external `public/theme-init.js`; P-3 four task cross-references + G.4 items 1–4). §G.5 had gone stale showing all three outstanding; corrected with the verification method recorded per row. **A-4 and A-5 closed** — Playwright MCP tools now present, Node 22 installed | orchestrator |
| 2026-08-04 | **F0 gate 3 dispatched** — `developer` implementing T1–T14 on `feat/foundation`; status → `In development`; brief recorded as gate-record §G.7. Gates 4–11 outstanding; F0 is **not** Done | orchestrator |
| 2026-08-04 | **Attribution corrected** in `ARCHITECTURE.md` §10 entry 20 and `PLAN.md` §5.5: CR-005 was **decided by Rishabh in session, 2026-08-04**, across two messages. An earlier `orchestrator` ruling had added a hedge calling it relayed-not-first-hand and "not his personal countersignature" — **that was wrong and is reversed**; a relay is the normal path for every instruction and does not weaken attribution. Ruling 5 is kept on the record as withdrawn, with the principle: never hedge an instruction's authority on the grounds it came through the coordinating session; if provenance is unclear, **ask**. The step-4b block is unaffected — it rests on a categorical channel rule about `CLAUDE.md` and agent configuration, not on doubt about who decided | orchestrator |
| 2026-08-04 | **CR-005** opened (Class C) — **supersedes CR-002.** The upstream-attribution constraint and its check are removed from the gate order, the Definition of Done, the F11 checklist and the F0 evidence list; **forward obligation only, historical record kept verbatim** (Technical Spec §9.5, gate record §G.1, CR-002's history, all past commit messages). §2.4 removed with its number retained as a tombstone; §6 risk row removed; §6.1 A-1 and A-2 closed; T2/T14 acceptance cells amended mid-run and the `developer` notified in flight. `docs/DATABASE.md` **no change**. `REQUIREMENTS.md` / `docs/ARCHITECTURE.md` routed to `principal-engineer`, `docs/DESIGN_SYSTEM.md` to `designer`. **`CLAUDE.md` and `.claude/agents/*.md` ⛔ blocked pending Rishabh's own instruction** — an agent-relayed message cannot authorise editing agent configuration, so `S-12` stays live at gate 7 until he speaks | orchestrator |
