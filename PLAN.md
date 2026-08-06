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
4. reviewer            → ONE pass: code review + the S-checklist folded in
5. developer           → fix blocking findings                (loop 4–5)
6. Rishabh             → reviews the running frontend himself
7. orchestrator        → verify gates → approve → merge
```

**Reduced from eleven gates to seven by CR-006 (§5.5), 2026-08-05 — Rishabh's decision.** Development
was taking too long and consuming too many credits. What was removed, and what happens to its
concerns:

| Removed gate | Was | Now |
|---|---|---|
| `designer` visual verification | gates 4–5 | **Rishabh reviews the frontend himself** at gate 6. The `designer` still writes the Design Spec at gate 2 — only the after-the-fact screenshot pass is gone |
| `reviewer` separate security audit | gate 7 | **Folded into the single review pass at gate 4.** Not deleted — see below |
| `qa` E2E suite | gates 9–10 | **Dropped.** The `qa` agent is dormant, not deleted |

**Why the security concerns fold rather than vanish.** This is a read-only product with no auth, no
accounts, no mutations and no third-party calls (`ARCHITECTURE.md` §7), so most of S-1…S-14 cannot
fail by construction. Four can, and they stay as a checklist inside the gate-4 review because each
guards something a code change could actually break: **S-4** input validation, **S-6** error hygiene
(no stack traces, SQL or absolute paths in a response), **S-7** `npm audit` and the lockfile, and
**S-10** query-cost bounds on lap-scale data. A finding against any of them is blocking. The other
identifiers are not re-verified per feature. This is a deliberate, recorded reduction in assurance,
not an oversight.

**On dropping E2E.** Playwright MCP was in any case unreachable from subagents (recorded at CR-006),
so the E2E gate could not run as specified. Unit tests remain mandatory. The cost is that
browser-only behaviour — first-paint theme flash, `prefers-reduced-motion`, CSP console violations —
is now **verified by Rishabh's own review or not at all**, and any doc that claims otherwise is
stale.

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
- [ ] `CODE REVIEW: PASS` — including verdicts on **S-4, S-6, S-7, S-10** (§2.3)
- [ ] Typecheck, lint, format, unit tests, build all clean
- [ ] Bundle inside the gzipped budget, **measured**
- [ ] **Rishabh has reviewed the running frontend**
- [ ] No database, `.env`, or seed artefact staged for commit
- [ ] `orchestrator` approval recorded with a date

**Removed from this list by CR-006:** `DESIGN VERIFICATION: PASS`, `SECURITY AUDIT: PASS` and
`QA: PASS`. `S-12` remains retired from CR-005 and is still never renumbered.

---

## 3. Master tracker

Status vocabulary (CR-006 reduced this with the gate order): `Not started` · `Spec in progress` ·
`Design in progress` · `Ready for dev` · `In development` · `In review` · `Fixing findings` ·
`Rishabh review` · `Awaiting approval` · `✅ Done`

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
the external `public/theme-init.js`; **P-3** all four stale task cross-references corrected.
**T1–T9 are committed** on `feat/foundation`; the first gate-3 run was interrupted at T9 and **T10–T14
are re-dispatched** (§G.8). Gates 4–11 follow; nothing is Done until the `orchestrator` records
approval.

**R1 / R2 are not on F0's critical path.** F0 renders no driver, team or race content, so no
headshot, logo or placeholder-avatar surface exists in it. They first bind at F4 (R1) and F5 (R2).
**R3 does not block F0 either** — F0 ships the `designer`'s typographic `public/favicon.svg`
placeholder, built from a font the project is licensed to use and carrying no third-party mark.

### Per-feature agent log

Filled in by the `orchestrator` as gates complete.

| ID | Spec | Design | Dev | Design verify | Review | Security | QA | Approved |
|---|---|---|---|---|---|---|---|---|
| F0 | ✅ 2026-08-04 · `PLAN.md` F0 → Technical Spec (14 tasks, T1–T14) · verified by orchestrator | ✅ 2026-08-04 · `PLAN.md` F0 → Design Spec + `docs/DESIGN_SYSTEM.md` §1–§10 · verified by orchestrator | ⏳ 2026-08-04 · **T1–T9 landed** (`cb82c62`…`b860c38`); run interrupted; **T10–T14 re-dispatched** · briefs §G.7 + §G.8 | | | | | |
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
| ~~`framer-motion`~~ | ~~`^12.43.0`~~ | ~~12.43.0~~ | ⚠ **REMOVED BY CR-007. Replaced by `gsap@^3.15.0` + `@gsap/react@^2.1.2`** — see the **CR-007 supersession** spec §S.3.2 and `ARCHITECTURE.md` §10 #21. Everything below this table's `framer-motion` note is history |

> ⚠ **The rest of §1.1's motion material — the ten-motion table, the `src/lib/motion.ts` rule and the
> "`framer-motion` is in the initial chunk" note — is SUPERSEDED BY CR-007.** Read the **Technical Spec
> — CR-007 supersession** section (§S.0 for what dies, §S.3.3 for the GSAP/React pattern, §S.3.4 for
> reduced motion). It is retained below as the record of what was built at T8–T12. The
> `devDependencies` table and every non-motion row above are **unaffected and still binding**.

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

   > ⚠ **CR-007 update.** T13 could not produce the required browser evidence, so the allowance is
   > still present. **`CR-007 task C7-8` now owns closing this**, and the reasoning is stronger than it
   > was: `framer-motion` is gone, and — verified by grepping the shipped `gsap`, `ScrollTrigger` and
   > `SplitText` source — GSAP **injects no `<style>` element at all**. The two-console rule below is
   > unchanged and still not dischargeable by one screenshot.
   >
   > ⚠⚠ **Gate 5, 2026-08-06 — this note used to add "GSAP writes styles through `element.style`",
   > and that is imprecise in the one way `style-src-attr` cares about. See the correction in
   > §S.6.1a: CSSPlugin writes `style.cssText`, and `ScrollTrigger.js:2108` calls
   > `_body.setAttribute("style", "")` on a startup path that is reachable on `/`.** The static case
   > is therefore weaker than it reads and the allowance stays until a console says otherwise.

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
    motion.ts              ⚠ DELETED BY CR-007 — replaced by the src/lib/motion/ directory (§S.3.1)
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

> ⚠ **SUPERSEDED IN PART BY CR-007 §S.3.6.** `/` is now the **Landing** page and the season hub moves to
> `/seasons`, so the table is **12 routes plus `*`**, not 11; `PrimaryNav` is replaced; `AppShell` gains
> `Backdrop`; `RouteTransition` is extracted from `RootLayout`. The props table below is otherwise
> unchanged and still binding.

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

> ⚠ **SUPERSEDED BY CR-007 §S.6.** The `framer-motion` bullet and the measured baseline table below
> describe the bundle at `792b4c9`; they remain the **historical** T13 measurement and the baseline the
> CR-007 projection subtracts from, so they are not deleted. The **current** boundary, the projection and
> the `ScrollTrigger` decision rule are in §S.6.1–§S.6.3, and C7-8 records the new measured figures there.

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

**✅ Measured baseline — recorded by the `developer` at T13, 2026-08-05.** `npm run build` on Node
v22.23.2, Vite 8.2.0, at commit `dee4e1c` (T12 complete). These are the figures F10 measures against.

| Artefact | Raw | **Gzipped** | Share of the 250 KB budget |
|---|---|---|---|
| `dist/assets/index-*.js` — **the initial chunk** | 473.99 kB | **147.46 kB** | **59.0 %** — inside budget, 102.5 kB of headroom |
| `dist/assets/index-*.css` | 25.56 kB | 5.83 kB | outside the JS budget |
| `dist/index.html` | 1.42 kB | 0.72 kB | outside the JS budget |

**`framer-motion`'s share: 125.36 kB raw / ~40.8 kB gzipped — 26.5 % of the raw initial chunk and
~28 % of its gzipped weight.** Obtained from a **measurement-only** build (a throwaway config that
splits each dependency into its own chunk; not committed, since §6.4 deliberately keeps them in the
initial chunk). Full composition, isolated-chunk figures:

| Module group | Raw | Gzipped |
|---|---|---|
| `react-dom` + `react` | 181.71 kB | 57.16 kB |
| **`framer-motion`** | **125.36 kB** | **~40.84 kB** |
| `zod` | 64.59 kB | 17.36 kB |
| `@tanstack/react-query` | 41.23 kB | 12.68 kB |
| `react-router` | 35.95 kB | 13.00 kB |
| this project's own code | 23.78 kB | 7.60 kB |
| rolldown runtime | 0.90 kB | 0.51 kB |

Two honest caveats about the gzipped column: **gzip is context-dependent**, so a split chunk
compresses slightly worse than the same bytes inside one chunk — the parts sum to 149.15 kB against
the real 147.46 kB, a 1.1 % overhead, which is the accuracy of the per-module gzip figures. The raw
column has no such caveat and is exact. Second, **`zod` and `@tanstack/react-query` entered the
initial chunk at T12, not before**: until `Header` called `useMeta`, nothing in the render graph
imported `metaSchema`, so tree-shaking dropped both. A pre-T12 measurement of the same repository is
therefore not a regression baseline — it was measuring an app with no data path.

**Fonts — ✅ the built app references exactly the six vendored faces from this origin and nothing
else.** Verified mechanically in the built artefact rather than in a network panel (see the T13
evidence note below): all six `@font-face` `src` values are root-relative `url(/fonts/*.woff2)`, all
**six carry their `unicode-range`**, so the three `latin-ext` faces stay off the first-paint path, and
`dist/index.html` preloads exactly two faces, both `latin`. No font host, no CDN, no absolute URL.

**⛔ The `styleSrcAttr` allowance in §2.4 has NOT been removed, and this is not an omission.** The
spec permits its removal on **one** kind of evidence — zero CSP violations in the *production-preview
browser console* — and the `developer` at T13 had no browser automation available in its session, so
that evidence does not exist yet. What was verified mechanically on the real artefact: `dist/index.html`
contains **no inline `<style>` block, no inline `<script>` body and no `style=` attribute**, the
stylesheet is an external `/assets/*.css`, and `<script src="/theme-init.js"></script>` survives the
build with no `defer`, no `async` and no `type="module"`. That is consistent with the allowance being
unnecessary — React and Framer Motion both mutate style through the CSSOM, which CSP does not govern —
but it is **not** the specified evidence, so the allowance stays. **Open item for gate 4 or gate 9:**
load the production preview, confirm zero violations, then remove `styleSrcAttr` and re-verify **both**
consoles per the §2.4 table.

---

##### 7. Unit test list

> ⚠ **SUPERSEDED IN PART BY CR-007 §S.7.** Tests 1–48 and 56–63 are untouched. Tests 49–55, 64 and 66–69
> must keep passing. **Test 65 is rewritten** (the skeleton pulse becomes CSS) and any test asserting a
> `framer-motion` prop is deleted with its call site. The new tests are numbered `CT-1…CT-20` in §S.7.

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

> ⚠ **SUPERSEDED IN PART BY CR-007 §S.8.** **T10, T11 and T12 are dead**, and **T8's motion clauses**
> (`MotionConfig`, `src/lib/motion.ts`) are dead — T8's Vite/Tailwind/fonts half stands. **T1–T7, T9,
> T13 and T14 stand verbatim and are complete.** The replacement tasks are **C7-1…C7-8** in §S.8. Every
> task below is already landed; this table is the record of what was built, not a work list.

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

**⚠ HISTORICAL RECORD — not a standing check. Do not re-run this.** The constraint it evidenced was
removed by **CR-005** (§5.5); `CLAUDE.md` §4.1 is now a tombstone. This subsection is retained
verbatim because CR-005 is forward-going only and the checks already run stay on the record. Two
`developer` runs have re-run this grep after CR-005 closed, because the citation below reads as live
— it is not.

Run against the working tree with this spec in place, before the constraint was withdrawn:

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

#### **Technical Spec — CR-007 supersession** — `principal-engineer`, 2026-08-06

> **This section supersedes parts of the Technical Spec above. It does not replace it.** Everything
> server-side stands verbatim. Where the two disagree about the client, **this section wins**, and the
> superseded passages above carry a pointer to it. Read §S.0 first — it says exactly what is dead and
> what is still binding.
>
> Written at gate 1 of **CR-007** (§5.5). The `designer` writes the Design Spec for the same CR in
> parallel; **at the time of writing it does not exist yet**, so every visual value here is deferred to
> it by name. This section specifies structure, dependencies, boundaries, mechanism and tasks. Where a
> decision depends on the Design Spec it is written as a contract with a named fallback, never as an
> assumption.

##### S.0 What is superseded, what is retained

**Superseded — do not build from these any more:**

| Site | What dies |
|---|---|
| §1.1 `framer-motion` row + the ten-motion table under it | The whole dependency choice and the F0 motion subset table (`MotionConfig`, M-1…M-8, M-11 as Framer Motion constructs) |
| §3.1 file layout — `lib/motion.ts` | Replaced by the `src/lib/motion/` directory (§S.3.1) |
| §3.5 component tree — `PrimaryNav`, and "11 routes" | Nav is re-specified (§S.3.6); the route table becomes 12 routes plus `*` |
| §6.4 code-splitting boundary — the `framer-motion` bullet and the measured baseline table | Replaced by §S.6 |
| §7 unit test list — the tests that assert Framer Motion behaviour | Replaced by the `CT-*` list in §S.7 |
| §8 task breakdown — **T8 (motion root + `lib/motion.ts` only), T10, T11, T12** | Replaced by **C7-1 … C7-8** (§S.8). T8's Vite/Tailwind/fonts half is **retained** — only its `MotionConfig` and `src/lib/motion.ts` clauses die |

**Retained and still binding — this CR touches none of it:**

- **The entire server.** `server/**` is not edited by this CR. No new endpoint, no new query, no new
  schema, no change to `server/coverage.ts`, no change to the rate limiter or the error envelope.
  A diff that touches `server/` outside a comment is out of scope and a review finding.
- T1–T7, T9, T13's serving half, T14. §1.2–§1.8, §2.1–§2.7, §3.2–§3.4, §3.6–§3.10, §4, §6.1–§6.3,
  §9.1's `DATABASE.md` edits.
- **§2.4's CSP verbatim**, including `styleSrcAttr` still being present. See §S.2.
- The theme model (`src/lib/theme.ts`, `public/theme-init.js`) and the vendored fonts and icons.
- Every accessibility obligation already specified: the `:focus-visible` double ring, the skip link,
  the `ThemeToggle` 3-option radiogroup, 44 px coarse-pointer targets, `aria-current` on the active
  nav item. **A "wow" redesign that loses one of these is a regression, not a redesign.**

**Commits whose UI is superseded but whose history stands:** `4758f26` (T8 — the `MotionConfig` and
`src/lib/motion.ts` parts only), `0f786aa` (T10), `a2f3a6c` + `62985d0` (T11), `dee4e1c` (T12),
`a6dbafd`, `4083e8b`, `d823d50` (the gate-4 design corrections to T11/T12 components).
**Commits fully retained:** `cb82c62`…`b860c38` (T1–T7, T9), `aef40b2` (T13 serving), `a347d47` (T14),
`26efa77` (the theme/`ThemeToggle` tests — these survive, and C7-5/C7-7 must keep them passing or
justify each change in the commit message).

##### S.1 Data contract

**N/A — and the reason matters.** This CR adds no query, so there is no SQL, no view, no coverage
window and no trap to mitigate in it. Two data rules bind anyway, because a landing page is where
invented numbers get typed:

1. **The landing page may consume `useMeta()` and nothing else.** Every figure it renders comes from
   `GET /api/meta`'s existing response (§2.2): `seasons.firstYear/latestYear/count`,
   `latestSeason.{year,scheduledRounds,completedRounds,cancelledRounds,isComplete}`,
   `latestCompletedRound`, `nextScheduledRound`, `coverage.*`. Nothing else exists to render, and F0
   still renders **no driver, team or race analysis** (a round *name* is already shipped in
   `DataVintage` and is the one precedent).
2. **A hard-coded statistic is a defect, not a placeholder.** `77`, `1950`, `2026`, `22`, `10` must not
   appear as literals in `src/routes/Landing.tsx` or in any component it renders. They go stale on the
   next database refresh, silently, on the most visible surface in the product. CT-14 enforces this
   mechanically.

Traps from `DATABASE.md` §7 that could reach this surface *through* `/api/meta` and are **already
mitigated upstream, in queries this CR does not touch**: trap 15 (cancelled rounds carry
`number IS NULL`, so `scheduledRounds` is `max(number)` = 22 for 2026, not `count(*)` = 24) and trap 11
(slugs, never integer ids — `circuitRef`, and every route param stays a slug). The landing page must
**not** re-derive either: if it wants "Round 10 of 22" it reads `completedRounds` and
`scheduledRounds`, and if it wants a link it uses `circuitRef`.

##### S.2 API contract

**Unchanged. No endpoint is added, removed or altered.** Three consequences that are not "no change":

1. **Caching is unchanged and is now load-bearing for a first impression.** `/api/meta` is
   `Cache-Control: public, max-age=300` with a 5-minute client `staleTime`. The landing page's hero
   therefore paints from cache on every navigation back to `/`, and its loading state is seen once per
   session. Do not add a refetch-on-mount, do not lower `staleTime` to make the hero feel "live".
2. **The `styleSrcAttr: 'unsafe-inline'` allowance can now probably go, and this CR is where it gets
   settled.** §2.4 permits removal on exactly one evidence: zero CSP violations in the
   **production-preview** console. GSAP injects no stylesheet — **verified by grepping the shipped
   ESM source of `gsap`, `ScrollTrigger` and `SplitText`, where there is no
   `document.createElement("style")` at all**. So the policy should probably hold with `styleSrcAttr`
   removed. **C7-8 owns the check.** If removal breaks the *dev* console only, the dev server gets
   adjusted, not the policy.

   > ⚠ **Gate 5, 2026-08-06.** This item used to claim "GSAP writes styles through `element.style`
   > (CSSOM), which CSP does not govern". **Corrected in §S.6.1a** — CSSPlugin writes
   > `style.cssText`, and `ScrollTrigger.js:2108` calls `_body.setAttribute("style", "")`, which is
   > the attribute form `style-src-attr` actually governs, on a path reachable on `/`. The
   > conclusion is unchanged in direction and weaker in strength: removal still looks safe, and it
   > is still **not** dischargeable without a console.
3. **`script-src 'self'` / `style-src 'self'` are compatible with everything specified here, and this
   was checked rather than assumed.** No inline `<script>`, no inline `<style>`, no `blob:` worker (we
   ship no worker), no `unsafe-eval` (GSAP does not use `eval`; only `CustomEase` and GSDevTools go
   near string-compiled behaviour and both are denylisted, `ARCHITECTURE.md` §10 #21). The backdrop's
   grain is a `data:image/svg+xml` **`background-image`**, governed by `img-src 'self' data:`, which is
   already permitted. **The background makes no network request of any kind** — no image file, no font,
   no fetch, no `import()` of remote code.

##### S.3 Client structure

###### S.3.1 File layout — the delta only

```
src/
  lib/motion/
    tokens.ts          durations, GSAP named eases, distances, stagger, ambient periods
    gsap.ts            the ONLY module that imports 'gsap' — registers plugins, sets defaults, re-exports
    reducedMotion.ts   pure: MOTION_QUERY_REDUCE, prefersReducedMotion(), matchesReduce(mql)
    useMotion.ts       the one hook that creates tweens
    motion.test.ts  useMotion.test.ts  reducedMotion.test.ts  tokens.test.ts
  components/layout/
    AppShell.tsx       + mounts <Backdrop/>, owns the stacking context
    Backdrop.tsx       the moving background (§S.3.5)
    backdrop.ts        pure: backdropIntensityFor(pathname) → 'full' | 'muted' | 'off'
    Dock.tsx           replaces PrimaryNav.tsx  (name per Design Spec — see §S.3.6)
    navItems.ts        pure: NAV_ITEMS, isActiveNavItem(pathname, to), computeIndicatorGeometry(...)
    Header.tsx         retained, re-skinned
  routes/
    Landing.tsx        NEW — the '/' surface
    SeasonHub.tsx      unchanged component, now mounted at /seasons and /seasons/:year
    RouteTransition.tsx  extracted from RootLayout — owns the route-enter motion
  features/landing/
    selectors.ts       pure: selectHeroFigures(meta) and friends
    selectors.test.ts
  styles/
    motion.css         @keyframes + the two reduced-motion / visibility chokepoints
    backdrop.css       the backdrop layers
    motion.css.test.ts backdrop.css.test.ts   ← stylesheet assertions, see CT-9/CT-10

DELETED: src/lib/motion.ts · src/components/layout/PrimaryNav.tsx
```

`src/styles/index.css` imports `./motion.css` and `./backdrop.css` after `./tokens.css`. No new alias,
no new build plugin, no change to `vite.config.ts` other than nothing at all.

###### S.3.2 The dependency change

| Package | Action | Version | Notes |
|---|---|---|---|
| `framer-motion` | **remove** | — | `npm uninstall framer-motion`. Zero references may survive anywhere, including comments. |
| `gsap` | **add** to `dependencies` | `^3.15.0` (resolved 3.15.0) | Zero runtime deps · no install scripts · `sideEffects: false` · ships its own types, so **no `@types/gsap`** |
| `@gsap/react` | **add** to `dependencies` | `^2.1.2` (resolved 2.1.2) | Zero runtime deps · peers `gsap ^3.12.5` and `react >=17`, both satisfied · ships types · 0.4 KB gz |

Recorded as `ARCHITECTURE.md` §10 **#21**, with the measured figures and the plugin allow/denylist.
**Escalation:** two new dependencies — the `orchestrator` must put them to Rishabh before C7-1 lands,
per the standing rule that new dependencies go through the `principal-engineer` and are escalated. My
recommendation is approve; the reasoning is in #21.

###### S.3.3 How GSAP integrates with React 19 — the canonical pattern, verified

Verified against GreenSock's own React guidance (`gsap.com/resources/React/`, `gsap.com/docs/v3/React/tools/useGSAP/`,
`gsap.com/docs/v3/GSAP/gsap.matchMedia()/`) and against the shipped source of `@gsap/react@2.1.2`,
not from memory. Six rules; each one is a defect class if broken.

**R-G1 — `useGSAP()` is the only place an animation is created. Never `useEffect`.**
`useGSAP()` is GreenSock's drop-in replacement for `useEffect`/`useLayoutEffect` that "automatically
handles cleanup using `gsap.context()`". Its source uses `useLayoutEffect` whenever `document` is
defined (the `useIsomorphicLayoutEffect` technique). **That is not a stylistic preference: `gsap.from()`
applies its start values immediately on creation, so building in a layout effect means the start state
lands before paint. Building in `useEffect` paints the resting state first and then jumps — a visible
flash on every mount.** React 19 does not change `useLayoutEffect` semantics, and we never server-render,
so there is no SSR caveat to manage.

**R-G2 — every animation is scoped to a container ref, and the hook owns that ref.**
`useGSAP(cb, { scope })` confines all selector strings to descendants of `scope`. Our `useMotion`
wrapper **creates and returns the ref**, so a caller cannot forget to scope. This is the mechanism that
stops a route's animation reaching into the shell or the next route: a selector that matches nothing
outside the container cannot leak, and on unmount the context reverts every tween, timeline,
ScrollTrigger and event listener created inside it.

**R-G3 — a non-empty dependency array requires `revertOnUpdate: true`, so our wrapper always sets it.**
`useGSAP`'s default is `revertOnUpdate: false`, which reverts only on unmount. With dependencies, a
dep change then **adds** new tweens on top of the old ones, and their leftover inline transforms fight.
That is the classic GSAP-in-React leak, and it is exactly what a route-keyed animation on a
**persistent** shell component (the dock, the backdrop, the route-transition wrapper — none of which
unmount on navigation) would hit. `useMotion` hard-codes `revertOnUpdate: true`; there is no option to
turn it off.

**R-G4 — animations created after the hook has run must be context-safe.**
Hover, click and `setTimeout` handlers execute after the effect, so tweens they create are outside the
context and are never cleaned up. `useGSAP` returns `contextSafe()` for this. `useMotion` re-exports it
as `motionSafe()`, which additionally **returns a no-op under reduced motion** (§S.3.4).

**R-G5 — GSAP animates the DOM; React never re-renders on a frame.**
No `onUpdate` may call `setState`, and no animated value may be mirrored into React state. Sixty
re-renders a second on a page that will hold charts from F2 is a performance defect. Corollary: never
put a GSAP-controlled property into a component's `style` prop — React will overwrite it on the next
render.

**R-G6 — plugins are registered exactly once, in `src/lib/motion/gsap.ts`, and `useGSAP` is registered too.**
`gsap.registerPlugin(useGSAP)` is GreenSock's documented way to make the hook bind to the same core
instance. Registering in a component means registering per mount.

`src/lib/motion/gsap.ts` — the single choke point:

```ts
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { MOTION } from './tokens';
// ScrollTrigger is imported here, or not at all — see §S.6.3.

gsap.registerPlugin(useGSAP /*, ScrollTrigger */);
gsap.defaults({ duration: MOTION.dur.base, ease: MOTION.ease.enter, overwrite: 'auto' });
gsap.config({ nullTargetWarn: false });   // a scoped selector legitimately matches nothing
export { gsap, useGSAP };
```

`overwrite: 'auto'` is deliberate: it kills conflicting tweens of the same property on the same target,
which is what makes rapid hover-in/hover-out land on a correct final value instead of a race.

**ESLint, added in C7-2** — the rule that makes R-G1/R-G6 enforceable rather than aspirational:

```js
'no-restricted-imports': ['error', { paths: [
  { name: 'framer-motion', message: 'Removed by CR-007. Use @/lib/motion.' },
  { name: 'gsap',        message: 'Import from @/lib/motion/gsap — one registration site (ARCHITECTURE §10 #21).' },
  { name: '@gsap/react', message: 'Import from @/lib/motion/gsap.' },
], patterns: ['gsap/*'] }]
```
with an override permitting `gsap`, `gsap/*` and `@gsap/react` **only** inside `src/lib/motion/**`.

###### S.3.4 Reduced motion, structurally

The requirement is a **stopped** state, not a slowed one. Two chokepoints, both global, both testable.
Recorded as `ARCHITECTURE.md` §10 #22.

**Chokepoint 1 — CSS, for every loop and every transition.** One block, in `src/styles/motion.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
```
It is global on purpose: a per-component reduced variant is a thing you can forget, and CR-002-era
history in this file shows what forgetting costs. The existing per-component `@media` blocks in
`index.css` (`body`, `.btn`, `.option-row`) become redundant; C7-2 removes them so there is **one**
place, not four. **This is only correct because of MR-2 below.**

**Chokepoint 2 — GSAP, for every tween.** `useMotion` runs its builders inside
`gsap.matchMedia()`, which GreenSock documents as automatically reverting everything created under a
condition when that condition stops matching — so a user toggling the OS setting mid-session gets the
correct state without a reload, and without any listener code of ours.

```ts
const mm = gsap.matchMedia();
mm.add({ reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
  const reduced = ctx.conditions.reduce === true;
  settle?.({ root, q, gsap });          // ALWAYS — gsap.set only, instant, both modes
  if (reduced) return;                  // ← no tween is created. Nothing to slow down.
  const tl = gsap.timeline();
  animate({ tl, root, q, gsap });
  return () => { tl.kill(); };
}, scopeRef);
```

**Why this is genuinely stopped, and not merely fast:** under reduce **no tween object exists**, so
GSAP's ticker never has an active child and puts itself to sleep — verified in `gsap-core.js`, where
the global timeline calls `_ticker.sleep()` when it has no active child. Zero `requestAnimationFrame`
callbacks, zero property writes. A `duration: 0` tween, which GSAP's own reduced-motion example uses,
would still instantiate, render once and touch the ticker; we do not use it.

**MR-1 (binding):** looping motion is CSS `@keyframes`; one-shot and interaction motion is GSAP. There
is no third mechanism. The skeleton pulse (was M-7, was JS) becomes a CSS `@keyframes` and loses its
bespoke `useReducedMotion()` branch entirely.

**MR-2 (binding, and the reason chokepoint 1 is safe):** **an element's CSS resting state is always its
final, readable state.** Entrance motion is therefore authored as `from`/`fromTo`, never as
`to`-from-a-CSS-hidden-state. If a tween is never created — reduced motion, a JS error, a stalled
chunk — the content is *visible and correct*, not invisible. An element whose base CSS is
`opacity: 0` is a review failure.

**MR-3:** nothing animates while the tab is hidden (`DESIGN_SYSTEM.md` §4.5, already binding and
currently unimplemented). One implementation, in `AppShell`: a `useDocumentVisible()` hook toggles
`data-motion-paused` on `<html>`, and one CSS rule pauses every animation:

```css
html[data-motion-paused] *, html[data-motion-paused] *::before, html[data-motion-paused] *::after {
  animation-play-state: paused !important;
}
```
GSAP needs no equivalent: its animations here are short one-shots, and browsers throttle `rAF` on a
hidden tab anyway.

###### S.3.5 The backdrop

`src/components/layout/Backdrop.tsx` · `src/styles/backdrop.css` · `src/components/layout/backdrop.ts`

**Technology: CSS-composited gradient layers.** Canvas 2D, WebGL and animated filters are rejected;
the full justification is `ARCHITECTURE.md` §10 #24. Bundle cost: **0 KB of library, ~0.4 KB gz of
component, and a hard cap of +4 KB gz of CSS** (C7-4 measures it; over the cap, layers get cut).

**Mount point and stacking.** `AppShell` renders it as its **first child**, once, outside the router
outlet, so it never remounts on navigation:

```tsx
<div className="shell-root">     {/* position: relative; isolation: isolate */}
  <Backdrop />                   {/* position: fixed; inset: 0; z-index: var(--z-backdrop) */}
  <Header/> <Dock/> <main id="main">{children}</main>
</div>
```

`isolation: isolate` on `.shell-root` so no blend mode can escape the shell. The backdrop is
`position: fixed; inset: 0; pointer-events: none; contain: strict; aria-hidden="true"`, contains no
focusable element and no text, and is `display: none` in `@media print`. **A z-index token scale is
required** because `index.css` currently hard-codes 20/40/50; the `designer` owns the values, and the
layer order is: backdrop → content → sticky header → dock → scrim → popover/overlay.

**Intensity is a pure function of the route**, not context and not an effect — no provider, no ordering
bug, and unit-testable:

```ts
export type BackdropIntensity = 'full' | 'muted' | 'off';
export function backdropIntensityFor(pathname: string): BackdropIntensity;
```
`'/'` → `full`. `/seasons`, `/seasons/:year`, `/drivers*`, `/teams*`, `/circuits*`, `/compare`,
`/records` → `muted`. `/seasons/:year/races/:round` → **`off`** (the lap-chart surface from F3; an
animated field behind a lap-time chart is a legibility defect, and CR-007 says so explicitly). Any
unrecognised path → `muted`, never `full`: the safe default is the quiet one. `Backdrop` reads
`useLocation().pathname` and calls it — that is the component's only logic.

**Degradation, in order of severity:**

| Signal | Behaviour |
|---|---|
| `intensity === 'off'` | Animated layers are **removed from the DOM**, not paused. A paused compositor layer still holds memory, and this is the case that shares a screen with a lap chart. The static base gradient stays. |
| `intensity === 'muted'` | Fewer layers, lower opacity, longer periods — values from the Design Spec. Still composited-only. |
| `prefers-reduced-motion: reduce` | Chokepoint 1 stops every layer dead. The gradient remains visible and static — reduced *motion*, not reduced *design*. |
| tab hidden | MR-3 pauses it. |
| no CSS custom-property support / stylesheet fails | The shell renders on `--surface-canvas`; the backdrop simply is not there. There is nothing to fall back to because there is no JS involved. |

**Forbidden inside the backdrop, each for a measured reason:** any animated `filter` or
`backdrop-filter` (re-rasterises per frame — softness comes from wide `radial-gradient` stops instead);
animating anything other than `transform` and `opacity`; `background-position` loops; any `url(http…)`;
any image file; more than one static `data:` URI, capped at 2 KB; `will-change` on more than the
layers that actually move. CT-9 enforces most of this by reading the stylesheet.

###### S.3.6 Navigation, route transition and the component tree

**The nav form is the `designer`'s call** (CR-007 offers a floating dock or a collapsible sidebar).
Structurally, either shape satisfies the same contract, and the developer implements whichever the
Design Spec names — file `src/components/layout/Dock.tsx` if it is a dock, `SideNav.tsx` if it is a
sidebar. `PrimaryNav.tsx` is deleted either way.

The contract, which does not depend on the form:

| Concern | Specification |
|---|---|
| Items | `NAV_ITEMS` — a `readonly` array of `{ to: string; label: string; icon: IconName }` in `navItems.ts`. Slugs and literal paths only; **never an integer id**. |
| Active state | `isActiveNavItem(pathname, to)` — **pure, exported, unit-tested.** `to === '/'` matches **only** exactly `/`; every other `to` matches `pathname === to` or `pathname.startsWith(to + '/')`. Segment-boundary matching, so `/teams` does not light up on `/teamsomething`. `aria-current="page"` on the match — retained from the existing spec. |
| Active indicator | One element whose position is **measured, not laid out**: `computeIndicatorGeometry(activeRect, containerRect, indicatorLength)` → `{ offset } \| null`, applied as a translate along the dock's main axis. Pure and unit-tested. **See the resolution below — the indicator has a fixed length and is never scaled to the item.** Framer Motion's `layoutId` has no GSAP-core equivalent; `Flip` is the real equivalent and is deferred to F1 (§10 #21), because for one indicator a measured tween is fifteen lines and 9.7 KB gz cheaper. |
| Reduced motion | The indicator **snaps**: geometry is applied in `settle` (a `gsap.set`), and only the tween between positions lives in `animate`. This is the case §S.3.4's two-builder split exists for. |
| Keyboard / ARIA | Unchanged from the F0 Design Spec §8 and the tests in `26efa77`. A dock is a `<nav>` with links, not a widget with roving tabindex, unless the Design Spec argues otherwise **and** re-specifies the keyboard model. |
| Touch | 44 × 44 px minimum on `(pointer: coarse)` — retained. |

> ##### Resolution — the indicator's size. Decided at gate 5, 2026-08-06. **The Design Spec governs.**
>
> This section and the Design Spec **contradicted each other**, and the first implementation
> followed this one. The row above originally read "`{ x, scaleX }` against a fixed base width,
> applied with `transform-origin` at the start edge", which the developer implemented as
> `scaleX = itemSize / 20` — so the bar stretched to the full length of the active item and
> rendered as a **2 × 48** rule in the rail. Design Spec **§5.2** specifies "a **2×20px**
> `--accent-mark` bar at `left: 0`, **vertically centred**" and **§5.3** "a **2×16px**
> `--accent-mark` bar at the slot's **top** edge, moved on `x`".
>
> **On a purely visual matter the Design Spec governs.** The indicator's length is fixed —
> 20px in the rail, 16px in the bottom dock — and it is centred on the active item along the
> main axis. The only scale G-3 applies is `DESIGN_SYSTEM.md` §4.6's `0.4 → 1` growth of the
> rule about its own centre, which is a flourish on arrival and not a fit to the item.
>
> Consequences, all implemented:
>
> - `computeIndicatorGeometry` returns `{ offset } \| null` and no scale. `transform-origin` is
>   the element's centre, not the start edge.
> - The lengths live in `tokens.css` as `--size-dock-indicator` / `--size-dock-indicator-rail`,
>   in **px** rather than rem, and are mirrored by `INDICATOR_LENGTH` in `navItems.ts`. The
>   centring is JavaScript arithmetic against `getBoundingClientRect()`, so a rem length under a
>   non-16px root font size would put the bar off-centre by half the difference.
>   `styles/index.css.test.ts` asserts the two agree.
> - `null` replaces the old identity geometry, and it is **not only a degenerate-input guard**:
>   below 1024px the three overflow destinations are `display: none`, so on `/teams`,
>   `/circuits` and `/records` the active slot measures 0×0. The old code turned that into
>   `scaleX: 0` — an indicator that was invisible on three of the twelve routes.

**Route transition.** `RootLayout` currently owns it inline; extract `src/routes/RouteTransition.tsx`:
one `useMotion` with `deps: [pathname]` (hence `revertOnUpdate: true`, R-G3), animating `from` on the
outlet container. **There is still no exit animation** — that ruling is retained verbatim from T10: a
route change must never hold the outgoing view, and GSAP gives us no `AnimatePresence` to be tempted
by. Consequence: the incoming content is in the DOM immediately and readable even if the tween never
runs (MR-2).

**Component tree delta:**

```
<QueryClientProvider>
  <BrowserRouter>
    <Routes>
      <Route element={<RootLayout/>}>          ← AppShell(Backdrop, Header, Dock) + RouteTransition + <Outlet/>
        "/"                            <Landing/>          ← NEW
        "/seasons"                     <SeasonHub/>        ← NEW entry point, same component
        "/seasons/:year"               <SeasonHub/>
        "/seasons/:year/races/:round"  <RaceDeepDive/>
        … the eight unchanged routes …
        "*"                            <NotFound/>
```

| Component | Props |
|---|---|
| `Backdrop` | `{}` — reads `useLocation()`, calls `backdropIntensityFor`. No props, so it cannot be misconfigured. |
| `Dock` / `SideNav` | `{ items: readonly NavItem[] }` |
| `RouteTransition` | `{ children: ReactNode }` |
| `Landing` | `{}` — calls `useMeta()`, passes shaped figures down. Presentational children take props (`ARCHITECTURE.md` §3: components never fetch, and `Landing` is the feature boundary here). |
| everything else | unchanged |

###### S.3.7 Hook signatures and pure selectors

```ts
// src/lib/motion/useMotion.ts
export interface MotionCtx<T extends HTMLElement> {
  root: T;                                     // the scoped container, non-null inside a builder
  q: (selector: string) => HTMLElement[];      // scoped query — gsap.utils.toArray within root
  gsap: typeof import('./gsap').gsap;
}
export interface MotionSpec<T extends HTMLElement> {
  /** Runs in BOTH modes, first. gsap.set only — no tween, no duration. */
  settle?: (ctx: MotionCtx<T>) => void;
  /** Runs ONLY when motion is allowed. Author as from()/fromTo() (MR-2). */
  animate?: (ctx: MotionCtx<T> & { tl: gsap.core.Timeline }) => void;
  deps?: React.DependencyList;
}
export interface MotionHandle<T extends HTMLElement> {
  scope: React.RefObject<T | null>;            // attach to the container — the hook owns it
  reduced: boolean;
  /** Context-safe, and a NO-OP under reduced motion. For hover/click tweens. */
  motionSafe: <F extends (...args: never[]) => void>(fn: F) => F;
}
export function useMotion<T extends HTMLElement = HTMLDivElement>(spec: MotionSpec<T>): MotionHandle<T>;
```

```ts
// src/lib/motion/reducedMotion.ts — pure, no GSAP import
export const MOTION_QUERY_REDUCE = '(prefers-reduced-motion: reduce)';
export function prefersReducedMotion(win?: Pick<Window, 'matchMedia'>): boolean;  // absent matchMedia → false
```

```ts
// src/lib/motion/tokens.ts — the ONE source for every timing value
export const MOTION = {
  dur:  { instant: 0.08, fast: 0.14, base: 0.2, slow: 0.32, chart: 0.4 },   // seconds; GSAP's unit
  ease: { enter: 'power2.out', exit: 'power2.in', move: 'power1.inOut', mech: 'circ.out', settle: 'back.out(1.2)' },
  dist: { …px offsets },
  stagger: { row: 0.024, card: 0.04, cap: 12 },
  ambient: { …periods for the CSS layers, mirrored as --anim-* tokens },
} as const;
```

**The exact `ease` and `dur` values are the `designer`'s to set in `DESIGN_SYSTEM.md` §4.3** — the
five names above are the structural slots, and the strings are placeholders until the Design Spec
lands. Two rules are mine and are not negotiable: **every ease is a GSAP named ease string** (CT-2
asserts each matches `/^(none|power[1-4]|circ|expo|sine|back|steps)(\.(in|out|inOut))?(\(.*\))?$/`),
and **`CustomEase` is denylisted** so a cubic-bézier literal cannot re-enter through it. The
Framer-Motion spring tokens (`visualDuration` + `bounce`) have **no GSAP-core equivalent and are
retired**; spatial "settle" is `back.out(n)` with a duration, and the `designer` must re-derive
§4.3's spring table on that basis. The CSS `--dur-*` / `--ease-*` tokens in `tokens.css` stay and must
keep the same values as `MOTION.dur` / a CSS-equivalent of `MOTION.ease`; CT-3 asserts they agree, so
the two mechanisms of MR-1 cannot drift apart.

**Pure selectors — where the logic and the tests live:**

| Function | File | Contract |
|---|---|---|
| `isActiveNavItem(pathname, to)` | `components/layout/navItems.ts` | §S.3.6 |
| `computeIndicatorGeometry(activeRect, containerRect, indicatorLength)` | `components/layout/navItems.ts` | `{ offset }`, centring a **fixed-length** bar on the active item (§S.3.6 resolution). `null` — never `NaN`/`Infinity`, never a scale — for a degenerate length, a degenerate rect, or a `display: none` slot measuring 0×0; `settle` then leaves the indicator alone |
| `backdropIntensityFor(pathname)` | `components/layout/backdrop.ts` | §S.3.5 |
| `selectHeroFigures(meta)` | `features/landing/selectors.ts` | §S.4 |
| `prefersReducedMotion(win?)` | `lib/motion/reducedMotion.ts` | §S.3.7 |

###### S.3.8 URL params owned by this CR

**None.** CR-007 introduces no query parameter and no new path param. `/seasons` takes no param and
resolves the year from `/api/meta`. The invalid-value question therefore does not arise; `:year` and
the `:*Ref` slugs still belong to F2–F6 and the placeholders still display them unvalidated.

##### S.4 Derived metric definitions

One derived value is added, and it is presentational arithmetic over `/api/meta`, not analysis.
`selectHeroFigures(meta: Meta): HeroFigures` in `src/features/landing/selectors.ts`:

| Field | Definition | Source |
|---|---|---|
| `seasonSpan` | `` `${seasons.firstYear}–${seasons.latestYear}` `` | `/api/meta` |
| `seasonCount` | `seasons.count` verbatim. **Never `latestYear − firstYear + 1`** — that assumes an unbroken run of seasons, which is an assumption about the data and not a fact we have checked. | `/api/meta` |
| `roundProgress` | `{ completed: latestSeason.completedRounds, scheduled: latestSeason.scheduledRounds }`, rendered as "Round *c* of *s*". `scheduledRounds` **already excludes cancelled rounds** (trap 15, mitigated in `Q_LATEST_SEASON_PROGRESS`); the landing must not add `cancelledRounds` back in. | `/api/meta` |
| `latestRound` | `latestCompletedRound` verbatim, or `null` | `/api/meta` |
| `nextRound` | `nextScheduledRound` verbatim, or `null` | `/api/meta` |
| `state` | `'preseason'` when `completedRounds === 0` · `'complete'` when `latestSeason.isComplete` · else `'inSeason'`. Drives which copy the hero shows. | derived |

**Cross-era normalisation (`REQUIREMENTS.md` §5.2): N/A, and deliberately so.** Nothing here sums or
compares points, positions or any per-era quantity. **A landing hero must not acquire an "all-time
points" or "most wins" figure in this CR** — that is precisely the class of number that is invalid to
sum across 24 point systems, and it would need `driver_championship` and a rate metric, i.e. a query,
i.e. out of scope. If the Design Spec asks for a headline statistic beyond the table above, the answer
is no until F2 specifies it properly.

##### S.5 Edge cases — decided

**Motion and preference:**

| Case | Behaviour |
|---|---|
| `prefers-reduced-motion: reduce` at load | No tween is created; every CSS animation is `none`; the backdrop is a static gradient; the nav indicator is positioned by `settle`. Content is fully readable. |
| Preference toggled mid-session | `gsap.matchMedia()` reverts and re-runs the affected builders; the CSS block re-evaluates. No reload, no listener code of ours. |
| `window.matchMedia` absent (jsdom without a stub) | `prefersReducedMotion()` returns `false`; `gsap.matchMedia()` degrades to running the non-reduce branch. Tests must stub it explicitly — CT-4 covers both. |
| Tab hidden mid-animation | Loops pause (MR-3); GSAP one-shots complete when the tab returns. Neither leaves a half-applied transform, because `revertOnUpdate`/context revert restores inline styles. |
| Route changed while an entrance tween is mid-flight | The context reverts on unmount and the tween is killed; the outgoing DOM is already gone. No orphan. |
| JS fails or a chunk stalls | MR-2 guarantees resting CSS is the readable state, so the page is usable without motion. |

**Data and route:**

| Case | Behaviour |
|---|---|
| `/api/meta` loading | Landing hero renders the existing `LoadingState` skeletons in the hero's exact geometry, so nothing reflows when the response lands (the `--size-skeleton-vintage-*` precedent). |
| `/api/meta` → 503 (no database — the fresh-clone case) | The landing renders `DataUnavailableState` **in place of the figures only**; the hero, the backdrop, the nav and the theme toggle all still work. A missing database must not produce a blank first impression, and it must not produce a stack trace or an absolute path (S-6). |
| `latestCompletedRound === null` (a season with no completed round) | `state: 'preseason'`; the "last race" figure is omitted, not rendered as "—" beside a label that promises a race. |
| `nextScheduledRound === null` (season over) | `state: 'complete'`; the "next race" figure is omitted. |
| `isComplete === true` | Round progress reads *c* of *c*; no "next" line. |
| `cancelledRounds > 0` (2026 has 2) | Not shown on the landing. It is already surfaced correctly by the coverage popover; repeating it in a hero would need a sentence the hero has no room for, and a bare "24" would contradict `scheduledRounds`. |
| Direct entry on `/seasons` | Renders the hub for the latest season from `/api/meta`. No redirect to `/seasons/2026` — the canonical URL for "current" is `/seasons`. |
| Direct entry on `/` | Landing. No redirect. |
| `/seasons/1954` (before lap/quali/pit coverage) | Unchanged from F0: the placeholder echoes its params. The coverage-boundary states are F2's. |
| Deep link to a route with `intensity: 'off'` | The backdrop mounts with no animated layer at all; it never animates and then stops. |
| Four-entity comparison / single-entity comparison / duplicate selection | N/A — `/compare` is still a placeholder in F0 and this CR adds no comparison logic. |
| No `primary_color` on a team (202 of 214) | N/A — F0 renders no team. The accent colour CR-007 asks for is a **product** accent from `tokens.css`, not a team colour, and it must not be sourced from `team.primary_color`. |
| Pre-1996 laps / pre-2011 pit stops / pre-1994 qualifying | N/A in F0; the coverage popover already states the windows and is retained. |

##### S.6 Performance plan

###### S.6.1 Budget and projection

The binding budget is `ARCHITECTURE.md` §8: **initial JS < 250 KB gzipped**. Baseline at `792b4c9`:
**147.46 KB gz JS + 5.84 KB CSS**, of which `framer-motion` is **40.84 KB gz** (T13, measured).

| Step | Δ gz | Running total | Basis |
|---|---|---|---|
| Baseline `792b4c9` | — | **147.5 KB** | measured, T13 |
| − `framer-motion` | −40.8 | 106.6 KB | measured, T13 |
| + `gsap` + `@gsap/react` | +28.1 | **134.7 KB** | measured here (esbuild, method calibrated to ±2 KB against T13) |
| + `Backdrop` component | +0.4 | 135.1 KB | estimate — it is one component with no logic beyond a lookup |
| + `Landing` + selectors + hero | +3.0 | 138.1 KB | estimate — the whole of `src/` is 7.6 KB gz today |
| + nav/indicator/`useMotion`/`RouteTransition` | +2.0 | **≈140 KB** | estimate |
| **Projected, without ScrollTrigger** | | **≈140 KB gz — 56 % of budget, 110 KB headroom** | |
| + `ScrollTrigger`, **if** the Design Spec needs scroll-driven motion | +17.4 | **≈157 KB gz — 63 % of budget, 93 KB headroom** | measured here |
| + `SplitText`, **if** the Design Spec needs a per-character headline | +3.0 | ≈160 KB gz | measured here |

**Verdict: the background does not put the budget at risk, because it contains no JavaScript** — that
is the main reason §10 #24 chose CSS. The one figure I will flag rather than bless: **`framer-motion`
out and `gsap` in is a ~13 KB gz saving, but `gsap` + `ScrollTrigger` in is a ~4.6 KB gz net *increase*
over today.** The CR entry claims "the bundle goes down"; that is true only without ScrollTrigger, and
the corrected numbers are in `ARCHITECTURE.md` §10 #21. Either outcome is comfortably inside budget, so
this changes documentation, not the decision.

**CSS is outside the JS budget but on the same critical path.** Cap: `backdrop.css` + `motion.css`
together add **no more than 4 KB gz**, taking the CSS artefact from 5.84 to ≤ 10 KB gz. C7-8 measures
and records both figures; over the cap, layers get cut rather than the cap raised.

###### S.6.1a Measured, C7-8 — `developer`, 2026-08-06

`npm run build`, `vite build`'s own gzip figures, at commit `63583f2` (C7-7 complete).

| Artefact | Measured gz | Budget | |
|---|---|---|---|
| **initial JS** | **161.33 KB** | 250 KB (§8) | **65 % of budget, 89 KB headroom — PASS** |
| **CSS** | **9.26 KB** | ≤ 10 KB (above) | **PASS.** Delta from the 5.84 KB baseline is **+3.42 KB**, inside the +4 KB cap |
| initial JS, raw | 495.17 KB | — | |
| `index.html` | 0.72 KB | — | |

**Against the projection: 161.33 KB measured versus ≈157 KB projected with ScrollTrigger — 2.8 %
over, inside the 10 % tolerance §S.8 sets.** The overshoot is accounted for: the projection had no
`SplitText` (+3.0) and estimated `Landing` + selectors at 3.0 KB for what became five components,
three sections and a coverage ruler.

**GSAP's share, broken out.** Measured with §10 #21's method — `esbuild --bundle --minify
--format=esm`, `react`/`react-dom` external, then `gzip -9`:

| Import surface | raw | **gzip** |
|---|---|---|
| `gsap` + `@gsap/react` | 71,773 B | **28,052 B (27.4 KB)** |
| + `ScrollTrigger` | 116,273 B | **45,508 B (44.4 KB)** |
| + `SplitText` — **what this product ships** | 124,643 B | **49,004 B (47.9 KB)** |

So the animation library is **47.9 KB gz of the 161.33 KB initial chunk — 30 % of it**, and the swap
from the retired library's measured 40.8 KB **costs ≈7.1 KB gz**. That reproduces the `designer`'s
figure (§4.1: 47.7 KB, "the swap costs ≈6.9 KB") to within 0.2 KB and confirms the correction in
§10 #21: the CR's "the bundle goes down" is **false** as shipped, and true only without ScrollTrigger.
The decision stands on the headroom, not on the claim.

**`npm audit` → `found 0 vulnerabilities`** (S-7, no exception).

> ⛔ **The `styleSrcAttr` half of C7-8 is NOT discharged, and `server/app.ts` is unchanged.**
> §2.4 permits removal on exactly one evidence: **zero CSP violations in the production-preview
> console**, re-verified in both consoles after removal. That evidence requires a browser, and the
> agent that ran C7-1…C7-8 has none — there is no QA gate any more (CR-006) and no Playwright step in
> this CR's gate order. Removing the allowance on a *static* argument would be exactly the
> reasoning §2.4 refuses ("T13 settles it against the production build, not by reasoning").
>
> What **was** checked statically, and is offered as input rather than as discharge: no inline
> `<script>` and no inline `<style>` exists in `index.html` or in the built output; the three places
> this CR sets a CSS custom property from JavaScript (`AtmosphereField`'s `--atmosphere-line-path`,
> `CoverageRuler`'s two band variables) go through React's `style` prop, which React applies via
> `style.setProperty` — CSSOM, which CSP does not govern; and there is no
> `document.createElement("style")` anywhere in the shipped ESM source of `gsap`, `ScrollTrigger` or
> `SplitText`, so nothing here needs `style-src` for an injected stylesheet.
>
> ⚠ **Corrected at gate 5, 2026-08-06.** The sentence that previously read "GSAP writes exclusively
> through `element.style`" was **imprecise in the one way that matters to `style-src-attr`**, and the
> imprecision made the static case read as stronger than it is. Two counts, both re-verified against
> the installed `gsap@3.15` rather than restated:
>
> - **`CSSPlugin.js` writes `style.cssText` wholesale**, not only individual `element.style.<prop>`
>   assignments — `cssText = ""` at line 575 on the style-saver's revert path (which R-G3's
>   `revertOnUpdate: true` reaches on **every** dependency change in this app) and again at line 678
>   for `className` tweens. This is still CSSOM, so it is the lesser of the two points, but "writes
>   exclusively through `element.style`" was simply not true.
> - **`ScrollTrigger.js:2108` calls `_body.setAttribute("style", "")`** on its startup path. This is
>   the load-bearing one: `setAttribute("style", …)` **is** the attribute form `style-src-attr`
>   governs, whereas a property assignment on `element.style` is not. The path is reachable on `/`,
>   because `ScrollTrigger` is registered there and G-13, G-14 and G-15 all run on the landing page.
>
> Whether a browser actually reports a violation for an *empty* attribute value is a separate
> question and **not answerable without a console** — which is precisely the point. The static
> argument is weaker than it read, so the two-console requirement stands rather than being softened.
> **`styleSrcAttr: 'unsafe-inline'` is deliberately NOT removed.** The observations belong to
> whoever next opens a browser.

###### S.6.1b Deferred out of CR-007 — `developer`, gate 5, 2026-08-06

**The coverage ruler's hover/focus tooltip (Design Spec §3.5, the `Interaction` row).** §3.5 asks
that hovering or focusing a ruler row show "a tooltip with that row's no-coverage sentence from
`DESIGN_SYSTEM.md` §7.4". Only the surface change is implemented: the row raises to
`--surface-raised` on `:hover` and `:focus-visible`.

**Declined for CR-007 by the orchestrator at gate 5, recorded rather than built.** Three reasons,
in order:

1. **The information is not hover-only, and §10 requires that.** Every row is
   `tabindex="0"` inside a `role="list"` and carries `aria-label="<label>: available from
   <year>"`, so the coverage boundary is already reachable by keyboard and by screen reader
   without the tooltip. No state the tooltip would express is expressed *only* by it.
2. **A tooltip is a component, not a detail.** Done properly it needs a positioned, dismissible,
   `aria-describedby`-wired surface with `Esc` handling and coarse-pointer behaviour — which is
   `Tooltip` in `DESIGN_SYSTEM.md` §7, a component F0 does not otherwise ship and F1 will.
   Improvising one inside a landing section is how a second, worse tooltip gets into the product.
3. **Scope.** It was not among the review's blocking findings and inventing it during a fix pass
   is exactly the scope creep gate 5 is not for.

**Carry it into F1 with the `Tooltip` component**, and the §7.4 sentences with it.

###### S.6.2 CPU cost of an always-running animation

The reason the mechanism split (§10 #22) is a performance decision and not a style one:

- **CSS `transform`/`opacity` keyframes** on 2–4 layers: main-thread cost at steady state is **zero**;
  the compositor interpolates. Paused by the browser on a hidden tab, and by MR-3 explicitly.
- **A GSAP `repeat: -1` tween** on the same layers: identical visual result, but a `rAF` callback every
  frame for the life of the session, on the thread that also has to service the §8 "<100 ms chart
  interaction" budget from F2 onward.
- **The compositor is not free either**, which is why layer count is capped by the Design Spec, why
  `intensity: 'off'` **unmounts** rather than pauses, and why `filter` is forbidden in the backdrop —
  a blurred layer re-rasterises per frame and is the one way to make a CSS background expensive.

###### S.6.3 Code splitting

Unchanged in principle from §6.4: **F0 still introduces no route-level splitting.** But the landing
page changes where the boundary will fall, so it is fixed here so F1 does not invent one:

- **Initial chunk, permanently:** `AppShell`, `Backdrop`, nav, `RouteTransition`, `lib/*`,
  `features/meta/*`, `features/landing/*`, router, TanStack Query, `gsap` core.
- **From F1, `React.lazy` per analytical route.** The landing stays eager: it *is* the first paint.
- **`ScrollTrigger` decision rule.** If the Design Spec uses scroll-driven motion **only** on the
  landing, it may still be statically imported in `lib/motion/gsap.ts` — the landing is eager, so a
  dynamic import would buy nothing but a waterfall. If it is used **only** on a route that is lazy from
  F1, it must be imported inside that route's module instead. Do not split it out of the initial chunk
  while the landing needs it, and do not add it "for later" if the Design Spec does not use it.
- **`recharts` must not appear in the initial chunk; `visx` loads only on the race deep dive** —
  unchanged.
- If `ScrollTrigger` lands: `ScrollTrigger.refresh()` once after the route transition commits, because
  route content changes document height. `ScrollSmoother` and `normalizeScroll` are denylisted.

##### S.7 Unit test list

Vitest. Numbered `CT-*` so they cannot be confused with tests 1–69 above, which stand except where
noted. **The priority is the pure functions and the reduced-motion mechanism** — visual result is
Rishabh's at gate 6, and this project has no E2E gate any more (CR-006), which makes the mechanical
assertions below the only automated guard on motion behaviour.

**`src/lib/motion/tokens.test.ts`**
1. **CT-1** — every `MOTION.dur` value is a finite number in seconds, `> 0`, and `<= 0.4` except the
   explicitly ambient entries (`DESIGN_SYSTEM.md` §4.2: nothing on an interaction path exceeds ~400 ms)
2. **CT-2** — every `MOTION.ease` value matches the GSAP named-ease pattern; **no `cubic-bezier(`, no
   `CustomEase`, no numeric array** appears anywhere in the module (read the file as text)
3. **CT-3** — `MOTION.dur` agrees with the `--dur-*` values in `tokens.css`, parsed from the file, so JS
   and CSS timings cannot drift apart

**`src/lib/motion/reducedMotion.test.ts`**
4. **CT-4** — `prefersReducedMotion()` is `true` when `matchMedia` reports a match, `false` when it does
   not, and `false` (not a throw) when `matchMedia` is absent

**`src/lib/motion/useMotion.test.ts`** (jsdom, `matchMedia` stubbed per test)
5. **CT-5** — under reduce, `settle` **is** called and `animate` is **never** called
6. **CT-6** — under no-preference, `settle` runs before `animate`, and both receive a `root` equal to the
   returned ref's element
7. **CT-7** — no leak across dependency changes: after three dep changes,
   `gsap.globalTimeline.getChildren().length` is back to its pre-mount value and the target carries no
   leftover inline `transform`. This is the R-G3 regression test and the most valuable test in the list
8. **CT-8** — `motionSafe(fn)` invokes `fn` under no-preference and is a **no-op** under reduce

**`src/styles/motion.css.test.ts` / `backdrop.css.test.ts`** — stylesheet assertions, read as text.
Cheap, and they are what makes "cannot be forgotten" true rather than hoped for.
9. **CT-9** — in `backdrop.css`: every property animated inside a `@keyframes` block is `transform` or
   `opacity` and nothing else; no `filter:` or `backdrop-filter:` occurs inside any `@keyframes`; no
   `url(http` occurs anywhere; at most one `data:` URI and it is under 2 KB
10. **CT-10** — `motion.css` contains a `@media (prefers-reduced-motion: reduce)` block whose selector
    includes `*` and which sets both `animation: none` and `transition: none`; and every
    `animation-name` identifier used in `backdrop.css` has a matching `@keyframes`

**`src/components/layout/navItems.test.ts`**
11. **CT-11** — `isActiveNavItem`: `/` matches `/` only, and **not** `/seasons`, `/drivers`, `/records`;
    `/seasons` matches `/seasons`, `/seasons/2024`, `/seasons/2024/races/3` and **not** `/seasonsomething`;
    trailing slash on `pathname` behaves like no trailing slash
12. **CT-12** — `computeIndicatorGeometry`: a correctly **centred** `offset` for the first and last
    item; the bar is never scaled to the item (the §S.3.6 resolution, asserted); a container
    scrolled or offset from the viewport origin; and `null` — never `NaN`, never `Infinity` — for a
    degenerate `indicatorLength`, a degenerate rect, or a `display: none` slot measuring 0×0

**`src/components/layout/backdrop.test.ts`**
13. **CT-13** — `backdropIntensityFor`: `/` → `full`; `/seasons` and `/seasons/2024` → `muted`;
    `/seasons/2024/races/3` → `off`; `/nonsense` → `muted` (never `full`)

**`src/features/landing/selectors.test.ts`**
14. **CT-14** — `selectHeroFigures` over the §2.2 verified body returns the expected strings/objects;
    **and `Landing.tsx` contains no digit sequence of three or more** (read the file as text) — the
    hard-coded-statistic guard from §S.1 rule 2
15. **CT-15** — `completedRounds === 0` → `state: 'preseason'` and no last-race figure
16. **CT-16** — `isComplete: true` with `nextScheduledRound: null` → `state: 'complete'` and no
    next-race figure
17. **CT-17** — `seasonCount` comes from `seasons.count` and is **not** recomputed from the year range
    (assert with a fixture where `count !== latestYear − firstYear + 1`)

**Component tests (jsdom)**
18. **CT-18** — `Backdrop` renders zero elements carrying an animated layer class when
    `backdropIntensityFor` returns `off`, and is `aria-hidden` with `pointer-events: none` in every mode
19. **CT-19** — the nav renders one link per `NAV_ITEMS` entry and exactly one `aria-current="page"`
20. **CT-20** — `Landing` renders the skeleton while `useMeta` is pending, `DataUnavailableState` on a
    503, and the figures on success — reusing the existing state components, not new ones

**Tests 1–69 above:** 1–48 and 56–63 are untouched (server + data layer). **49–55, 64, 66–69**
(`theme` + `ThemeToggle`) must keep passing; a change to any of them needs a justification in the
commit message. **65** (`LoadingState` pulse under reduced motion) is **rewritten** as part of CT-10,
because the pulse becomes CSS. Any test asserting a `framer-motion` prop is deleted with its call site.

##### S.8 Task breakdown — supersedes T8's motion clauses, T10, T11, T12

Eight tasks, ordered, each independently committable and ≤ half a day. **Every task ends green:**
`typecheck`, `lint`, `format:check`, `test`, `build`. A red intermediate state is not an acceptable
commit, which is why the dependency swap is split across C7-1 and C7-2.

| # | Task | Acceptance |
|---|---|---|
| **C7-1** | **Motion foundation, alongside `framer-motion`.** Add `gsap@^3.15.0` and `@gsap/react@^2.1.2`. Create `src/lib/motion/{tokens,gsap,reducedMotion,useMotion}.ts` and their tests. Nothing consumes them yet; `framer-motion` is still installed and still in use. | `npm audit` → **`found 0 vulnerabilities`** (S-7, no exception); zero `EBADENGINE`; CT-1…CT-8 pass; `gsap.ts` is the only file in the repo importing `gsap` or `@gsap/react` (`grep -rn "from 'gsap" src/`); all five checks green. |
| **C7-2** | **Migrate every call site and remove `framer-motion`.** Port `AppShell`, `Header`, `PrimaryNav`, `ThemeToggle`, `Button`, `DataVintage`, `LoadingState`, `RootLayout` to `useMotion`. Add `src/styles/motion.css` with the §S.3.4 chokepoint-1 block, the `@keyframes` for the skeleton pulse, and MR-3's pause rule; **delete** the four per-component `@media (prefers-reduced-motion)` blocks in `index.css` and `src/lib/motion.ts`. `npm uninstall framer-motion`. Add the §S.3.3 ESLint `no-restricted-imports` rule. | `grep -rniE "framer|motionconfig|animatepresence|layoutid" src/ server/ package.json package-lock.json` → **no match**; `npm ls framer-motion` → empty; test 65 rewritten; CT-10 passes; **an import of `gsap` added to any file outside `src/lib/motion/` fails `npm run lint`** — paste the failure output as evidence; bundle re-measured (expect ≈135 KB gz); all five checks green. |
| **C7-3** | **The route split.** `src/routes/Landing.tsx` (structure only — a heading and the hero slots, no motion yet) at `/`; `SeasonHub` at `/seasons` **and** `/seasons/:year`; `components/layout/navItems.ts` with `NAV_ITEMS`, `isActiveNavItem`, `computeIndicatorGeometry`. Amend `ARCHITECTURE.md` §5 (already done by me — **verify, do not re-edit**) and make the `REQUIREMENTS.md` §4.8 NV-3 edit in §S.9.1. | Direct entry (not just client navigation) on `/`, `/seasons` and `/seasons/2024` all render; the other nine routes and `*` unchanged; **no redirect exists** in either direction; CT-11, CT-12 pass; `RootLayout.test.tsx` updated for 12 routes. |
| **C7-4** | **The backdrop.** `Backdrop.tsx`, `backdrop.ts`, `src/styles/backdrop.css`, the z-index token scale, mounted as `AppShell`'s first child with `isolation: isolate` on the shell root. Visual values strictly per the Design Spec. | CT-9, CT-13, CT-18 pass; DevTools shows the backdrop below all content and above nothing focusable; `aria-hidden="true"`, `pointer-events: none`, `contain: strict`, hidden in print; **on `/seasons/2024/races/3` no animated layer exists in the DOM**; **zero network requests attributable to the backdrop** (network panel filtered to `Img`/`Fetch` after a hard reload); CSS gz delta measured and ≤ 4 KB. |
| **C7-5** | **The nav.** `Dock.tsx` (or `SideNav.tsx` per the Design Spec) replacing `PrimaryNav.tsx`: measured indicator, hover/press via `motionSafe`, the mobile form, `aria-current`, 44 px coarse targets. | CT-19 passes; tests 49–55, 64, 66–69 still pass (any change justified in the commit message); with reduced motion emulated the indicator **snaps** and no tween is created; keyboard traversal and the `:focus-visible` ring unchanged; `PrimaryNav.tsx` deleted. |
| **C7-6** | **The landing surface.** Hero content from `useMeta()` + `selectHeroFigures`, loading / 503 / preseason / complete states, hero entrance via `useMotion`. `ScrollTrigger` and/or `SplitText` **only if** the Design Spec requires them — if `SplitText` is used: `aria` must be left at its default `"auto"` and **never set to `"none"`** (verified in the 3.15.0 source — `auto` puts the original text in an `aria-label` on the parent and `aria-hidden` on every fragment, which is what keeps a split headline readable to a screen reader and selectable-looking to nobody), and `autoSplit: true` is mandatory **whenever `type` includes `lines`** (also verified in source: `autoSplit` is what registers the `document.fonts` `loadingdone` listener that re-splits, and without it a line split is measured against the fallback font and stays wrong once the vendored `woff2` faces arrive). | CT-14…CT-17, CT-20 pass; with `F1_DB_PATH=/tmp/nope.db` the landing renders `DataUnavailableState` with **no stack trace and no absolute path on screen** and the shell still works; **no three-digit literal in `Landing.tsx`**; if a plugin was added, the bundle figure is re-measured in the same commit. |
| **C7-7** | **The interaction pass.** Accent colour applied throughout per the Design Spec; hover/press feedback on `Button`, `ThemeToggle`, `StateCard`, `DataVintage`, nav items and any landing affordance, all through `motionSafe`. | No hue is introduced that the Design Spec has not specified, and **none of purple / green / yellow is used as the accent** (reserved F1 timing semantics, `DESIGN_SYSTEM.md` §3.1 — this is a correctness check, not taste); with reduced motion emulated, hover still gives non-motion feedback (the CSS colour/surface step) and no tween is created; all five checks green. |
| **C7-8** | **Re-measure, re-verify, re-document.** Record the real gzipped JS + CSS figures in §S.6.1 beside the projection. Verify zero CSP violations in **both** consoles (`npm run dev` and `npm run build && npm run start`), then **remove `styleSrcAttr: 'unsafe-inline'`** from `server/app.ts` and §2.4 and re-verify both — the §2.4 open item this CR is finally in a position to close. Confirm `ARCHITECTURE.md` §2/§5/§10 match the code. | Both console observations recorded (the pair is not discharged by one); the measured JS figure is inside 250 KB gz and inside 10 % of the §S.6.1 projection, or the discrepancy is explained; if `styleSrcAttr` removal breaks the dev console only, the **dev server** is adjusted and the policy is not; `npm audit` still `found 0 vulnerabilities`. |

**Ordering note.** C7-1 → C7-2 is a hard sequence (the app must never be red). C7-3 is independent of
C7-4/C7-5/C7-6 and can land at any point after C7-2. C7-4 → C7-6 is soft: the landing reads better
against the finished backdrop, but neither blocks the other. **C7-8 is last and is not optional** — the
Definition of Done (§2.5) requires a measured bundle figure, and half of this CR's risk is in numbers
nobody re-measured.

##### S.9 Document impact, escalations, and what I think is wrong in the brief

###### S.9.1 Documentation edits — mine already made, the developer's listed exactly

**Already made by me at this gate — verify, do not re-edit:**

| File | Edit |
|---|---|
| `docs/ARCHITECTURE.md` §2 | The `Motion` row now reads GSAP 3 + `@gsap/react`, `framer-motion` removed; a new `Looping / ambient motion` row records the CSS-keyframes rule |
| `docs/ARCHITECTURE.md` §5 | `/` → Landing; new `/seasons` row; a note that there are now **twelve** routes plus `*` and **no redirect** in either direction |
| `docs/ARCHITECTURE.md` §10 | New decisions **#21** (GSAP replaces Framer Motion, with the corrected measurements and the plugin allow/denylist), **#22** (mechanism split + the two reduced-motion chokepoints), **#23** (landing at `/`, hub at `/seasons`), **#24** (backdrop technology, with the rejected alternatives) |

**The developer makes exactly these, in the same PR as the code (C7-3 unless stated):**

1. **`REQUIREMENTS.md` §4.8, the NV-3 row** — replace its "Feature" cell text with:
   > **Landing page** at `/` — the entry surface. Current season state, last race, next race. The
   > season hub is a separate surface at `/seasons` (`ARCHITECTURE.md` §5, §10 #23)
   and append to the section, after the table:
   > **NV-3 is split across features.** F0 ships the landing *surface* — chrome, motion, and the
   > figures available from `GET /api/meta` (season span, round progress, last and next round). Its
   > standings and race-result content lands with F2. The landing page never renders a statistic that
   > is not in an API response.
   Nothing else in `REQUIREMENTS.md` changes. **I have re-read §4.8 and confirm NV-3 already exists at
   P0**, so the orchestrator's Document Impact verdict of "change — new landing surface" is
   **corrected: this is a clarification of an existing P0 requirement, not a new one.** That matters —
   a new requirement would need a priority and an owner; a clarification does not.
2. **`docs/DATABASE.md`** — **no change.** Confirmed: no query, no view, no coverage constant and no
   trap text is affected by a client-side redesign. The orchestrator's verdict was right.
3. **`PLAN.md`** — the superseding markers at §1.1, §3.1, §3.5, §6.4, §7 and §8 are **mine and are
   already placed**. The developer adds only the measured figures in §S.6.1 (C7-8).
4. **Not the developer's, and must be routed by the `orchestrator`** — reported here under the
   standing rule that file ownership restricts who edits, never who reports:

   | File · site | What is stale | Owner |
   |---|---|---|
   | `docs/DESIGN_SYSTEM.md` §4 (all of §4.1, §4.3, §4.4) | Every motion cites a Framer Motion page; the API table is Framer's; the **spring tokens have no GSAP-core equivalent and must be retired**; M-3's `layoutId` mechanism no longer exists (`Flip` is the equivalent, deferred to F1); M-7's pulse becomes CSS; `MotionConfig` is gone. §4 needs re-authoring against GSAP, plus a new subsection for the backdrop and the ambient/loop tokens. | `designer` |
   | `docs/DESIGN_SYSTEM.md` §3.5 line ~389 | "(`layoutId`, §4.4 M-3)" in the selected-state row | `designer` |
   | `CLAUDE.md` line 12 · line 179 | "heavy but purposeful Framer Motion animation"; the §G.2 R-1 ruling summary | Rishabh / `orchestrator` |
   | `PLAN.md` §1 line 27 · §2 lines 334, 346 | "animation via Framer Motion"; the gate-2 evidence rule naming Framer Motion citations | `orchestrator` |
   | `PLAN.md` F0 Design Spec §2.1, §3, §6, §7, §10, §11 and §G.2 ruling R-1 | The whole motion half of the F0 Design Spec, including the M-1…M-11 reference table | `designer` (the CR-007 Design Spec supersedes it; R-1 stays as history) |

###### S.9.2 Class confirmation

**The orchestrator's Class B is confirmed.** It is not Class C: it adds no layer, changes no data flow
and creates no new surface *type*. It is not Class A: it changes dependencies, a route table and the
architecture's motion choice, all of which need decision-log entries — which is exactly the B/C line.
The four §10 entries are what a B produces when it touches architecture; a C would additionally need a
review of §3's layering rules, and none of them moves.

###### S.9.3 Escalations

1. **Two new dependencies** — `gsap@^3.15.0`, `@gsap/react@^2.1.2`. Recommend approve; reasoning in
   §10 #21. Needs Rishabh via the `orchestrator` before C7-1 lands.
2. **The CR entry's bundle claim is wrong and I have corrected it in the decision log rather than
   quietly working around it.** "Core ≈23 KB gzipped, ≈33 KB with ScrollTrigger" understates both:
   measured here, core is **27.6 KB gz** and core + ScrollTrigger + hook is **45.5 KB gz**. The
   conclusion "GSAP replaces `framer-motion`" survives; the sub-claim "and the bundle goes down"
   survives **only if ScrollTrigger is not shipped**. Nobody needs to re-decide anything, but nobody
   should quote 23/33 again.
3. **A landing page changes what `/` means, and `REQUIREMENTS.md` NV-3 is the requirement it satisfies.**
   Flagged so it is scored against NV-3 at gate 7 rather than treated as unrequirement-ed polish.
4. **Not escalated, and deliberately declined:** I did **not** specify a Web Worker /
   `OffscreenCanvas` backdrop, a WebGL shader background, `ScrollSmoother`, or a "wow" hero statistic
   that would need a new query. Each is refused with a reason in §10 #21/#24, §S.3.5 or §S.4 — so if
   any of them appears in the Design Spec, the answer is a conversation with me, not an improvisation
   by the developer.

###### S.9.4 What I think is wrong in the assignment brief

Reported plainly rather than absorbed:

1. **"GSAP is cheaper than what we ship today" is only conditionally true** — see §S.9.3 item 2.
   Corrected in §10 #21 with measurements and a stated method.
2. **"Off the main thread where possible" cannot be satisfied by GSAP**, and the brief's instruction
   to use "GSAP animations wherever possible" (from the CR) pulls against it for the background
   specifically. I have resolved it against GSAP for the *looping* layer and recorded why (§10 #22,
   §S.6.2). GSAP still drives the backdrop's entrance and its intensity change; it does not drive its
   loop. If that reads as under-delivering on "GSAP wherever possible", the honest framing is: GSAP
   owns everything a user's action causes, and CSS owns the one thing that never stops.
3. **`ARCHITECTURE.md` §2.4 does not exist.** The brief names it for CSP; the CSP lives in
   `ARCHITECTURE.md` **§7.3** and, in full, in this Technical Spec **§2.4**. I have read both. No harm
   done, but a future reader following the brief's citation will not find it.
4. **The brief says "specify the redirect if any"** — I have specified **no redirect**, which is a
   decision rather than an omission (§10 #23).

---

#### **Design Spec** — `designer`, 2026-08-04 · ⛔ **SUPERSEDED BY CR-007**

> ## ⛔ SUPERSEDED 2026-08-06 by the **CR-007 Design Spec** below — read that one instead
>
> Rishabh ran the shell built to this spec and rejected it: *"too basic and too bland"*, *"too ew"*,
> *"it should look like wow what a website"*. The rejection is correct and its causes were in **this
> spec**, not only in the implementation: no accent colour anywhere, a plain full-width top nav bar,
> motion only on route change, flat unlayered surfaces, and type that stopped at 44px.
>
> **What is superseded:** §1 (character), §2 (shell anatomy, responsive, route placeholders), §3
> (component inventory), §6 (motion — every Framer Motion reference is now a defect), and §9.1's
> favicon placeholder.
>
> **What still stands and is carried forward unchanged:** §5.1 `DataVintage` (design, all four copy
> lines, pluralisation, the coverage-not-a-fetch-event decision), §5.2 `ThemeToggle`, §7 States and
> §7.1's database-unavailable copy, §8 Accessibility (except the focus-order rows, which the dock
> changes), §9.1 fonts and §9.2 icons. The CR-007 spec cites these rather than restating them.
>
> Kept in place as the record of what was built and why it was rejected. **Do not implement from it.**

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
| Line 2 (`--text-sm`, `--ink-secondary`) — omit when `isComplete` | "Rounds {round+1}–{scheduledRounds} are scheduled and have no results yet." → **"Rounds 11–22 are scheduled and have no results yet."** **Singular when one round remains:** "Round {scheduledRounds} is scheduled and has no results yet." _(gate-4 correction: the plural-only form renders "Rounds 22–22" after R21, which is a copy defect)_ |
| Line 3 (`--text-sm`, `--ink-secondary`) — omit when `cancelledRounds === 0` | "{cancelledRounds} rounds on the {year} calendar were cancelled." → **"2 rounds on the 2026 calendar were cancelled."** **Singular when one:** "1 round on the {year} calendar was cancelled." _(trap 12, surfaced rather than hidden; gate-4 correction — the plural-only form renders "1 rounds")_ |
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

#### **Design Spec — CR-007** · `designer`, 2026-08-06 · **SUPERSEDES the 2026-08-04 Design Spec**

> **This is the spec to build from.** It replaces §1, §2, §3, §6 and §9.1's favicon placeholder of the
> 2026-08-04 Design Spec above, and carries forward its §5.1 (`DataVintage`), §5.2 (`ThemeToggle`),
> §7 (States), §9.1 (fonts) and §9.2 (icons) **unchanged except where stated**.
>
> **Companion:** `docs/DESIGN_SYSTEM.md`, amended in the same pass — new **§3.6** (the accent),
> rewritten **§4** (GSAP, motions G-0…G-24), new **§5.2a/§5.2b** (layering, glass), extended **§5.3**
> (chrome geometry), new **§7.7** (`AtmosphereField`) and **§7.8** (`CommandDock`), extended **§2.3**
> (two display steps), and **§9.2.1** (validation runs V-10…V-17). **This spec does not restate token
> values** — it says which token goes where. If the two disagree, `DESIGN_SYSTEM.md` wins.
>
> **Nothing below is from memory.** Every colour figure was computed with the §9.1 validator, which
> was re-implemented for this CR and **calibrated against every previously recorded figure before it
> was trusted** (§9.2.1). Every GSAP size was measured by `npm pack` + `gzip -9`. Every GSAP API is
> cited to its documentation page. The `offset-path` support claim was checked, not assumed.

---

##### 1. The seven answers, up front

Rishabh asked for seven things. Here is what each one is, and why.

| # | Asked for | Decision | Where |
|---|---|---|---|
| 1 | A landing page with a wow factor | **`/` becomes a designed landing surface.** The season hub moves to `/seasons/:year`, with `/season` redirecting to the latest season | §2, §3 |
| 2 | A moving background | **`AtmosphereField`** — six layers: drifting 48px grid, three desynchronised accent orbs, a racing line with a comet running a lap along it, grain, and a contrast plate. `DESIGN_SYSTEM.md` §7.7 | §4 |
| 3 | A theme | **"Instrument"** — the existing measured neutrals at OkLCh hue 264, now with one accent hue, layered surfaces, glass chrome, and a live background. Dark mode is the designed default impression | §4, §6 |
| 4 | An accent used throughout | **Signal, OkLCh hue 350** — `#D1018A` light / `#FE02A9` dark, an 11-step ramp, 11 semantic aliases, and a table of surfaces where it is *required*. Chosen by scanning all 360° against 19 reserved colours | §6 |
| 5 | Richer navigation | **`CommandDock`** — an expanding vertical rail at ≥1024px, a floating bottom dock below. One `nav`, one `main`, working skip link | §5 |
| 6 | Pervasive interactivity | **G-3, G-7, G-8, G-9, G-10, G-13, G-21** — pointer-tracked spotlights on every card and dock item, a magnetic hero CTA, sweeping link underlines, a moving dock indicator, background parallax | §7 |
| 7 | GSAP throughout | **GSAP 3.15 replaces `framer-motion` entirely.** Core + ScrollTrigger + SplitText + `@gsap/react`. 23 named motions land in F0 | §7 |

---

##### 2. Decision 1 — the landing page, and where the season hub goes

**Decision: `/` is a new landing surface. The season hub lives at `/seasons/:year`, and `/season`
redirects to `/seasons/{latestYear}`.**

Four reasons, in order of weight:

1. **The season hub cannot be both the showpiece and the hub.** F2 puts a 22-round calendar, two
   standings tables and a championship-progression chart on that surface. A hero with 112px display
   type and a full-bleed animated field is in direct competition with a table of 22 rounds above the
   fold — and `DESIGN_SYSTEM.md` §7.7.2 requires the background to *attenuate* exactly where dense
   charts land. Making one surface do both jobs guarantees that one of them is done badly.
2. **`/` is the only route in the product with no data dependency.** F0 renders no driver, team or race
   content, so every other route is a placeholder. A landing page is the one surface that can be
   **genuinely finished in F0** — the wow can land now, from craft, not from content that does not
   exist. This is the single most important point: it is why this CR is deliverable at all.
3. **The URL contract already has a canonical home for the hub.** `ARCHITECTURE.md` §5 lists both `/`
   and `/seasons/:year` as the season hub. Two URLs rendering identical content is a defect waiting to
   be found; this CR resolves it rather than adding to it.
4. **A public repository's product needs a front door.** There is currently nothing that says what
   this is.

**Why `/season` as a redirect rather than the nav computing `/seasons/2026`.** The dock renders before
`/api/meta` resolves, so a computed href would be `undefined` on first paint and would change under
the user's pointer when the query lands. A stable year-free href that redirects server-agnostically is
one router line and removes the whole class of problem. It is also the link a person would type.

> **⚠ For the `principal-engineer`.** This changes `ARCHITECTURE.md` §5's route table (`/` → Landing;
> `+ /season` → redirect) and `REQUIREMENTS.md` (a new landing surface). Both are already listed in
> CR-007's Document Impact Assessment. **Design does not ratify a routing change** — please confirm,
> and decide whether `/season` is a `<Navigate replace>` or a loader-level redirect.

---

##### 3. The landing page — `/`

###### 3.1 Structure

```
┌ header ── 56px · --surface-glass + --glass-blur · sticky · z-30 ──────────────────────┐
│ [skip link]  F1 ANALYTICS                                          ● 2026 · R10   ☾   │
│              ↑ the "1" in --accent-ink        hairline + 96px accent segment on scroll │
└───────────────────────────────────────────────────────────────────────────────────────┘
  ┌ 2px --accent-mark scroll-progress bar, scaleX scrubbed (G-14), fixed top:0 ─────────┐

┌ main#main ── z-1 · padding-left 96 (≥1024) / padding-bottom 96 (<1024) ───────────────┐
│                                                                                       │
│  ╔═ SECTION A — HERO · min-height max(100svh, 640px) · full-bleed · data-bg="hero" ══╗ │
│  ║                                                              ╭─ orb A ─╮          ║ │
│  ║  ── THE ARCHIVE · 1950—2026            ← eyebrow             │         │          ║ │
│  ║                                                              ╰─────────╯          ║ │
│  ║  SETTLE                     ← --display-3xl, Archivo 700 wdth 82, caps            ║ │
│  ║  THE                          split by char, masked by line, revealed G-16        ║ │
│  ║  ARGUMENT.                  ← last line in --accent-ink                           ║ │
│  ║                                       ╭ racing line + comet (G-20) ╮              ║ │
│  ║  77 seasons of Formula 1 — every race result, every                               ║ │
│  ║  qualifying session, and every lap the record holds.                              ║ │
│  ║  Compared across eras, and honest about where the                                 ║ │
│  ║  record stops.                        ← --text-md, --ink-secondary, max 52ch      ║ │
│  ║                                                                                   ║ │
│  ║  [ Explore the 2026 season → ]   Compare drivers                                  ║ │
│  ║    ↑ hero button, magnetic (G-9)   ↑ secondary                                    ║ │
│  ║                                                                                   ║ │
│  ║  ─────────────────────────────────────────────────────────────────────            ║ │
│  ║   77          10          1996            1950–2026                               ║ │
│  ║   SEASONS     ROUNDS      LAP TIMING      RESULTS COVERAGE                        ║ │
│  ║               COMPLETE    FROM                                                    ║ │
│  ║               IN 2026     ↑ mono, --display-lg, count-up G-17                     ║ │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝ │
│                                                                                       │
│  ╔═ SECTION B — CAPABILITY GRID · .shell-container · reveal G-15 ════════════════════╗ │
│  ║  ── WHERE TO GO                                                                   ║ │
│  ║  Six ways into the record          ← --display-sm                                 ║ │
│  ║  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                                  ║ │
│  ║  │ 01  IN BUILD│ │ 02  IN BUILD│ │ 03  IN BUILD│  ← 1px --accent-hairline top     ║ │
│  ║  │ SEASON      │ │ DRIVERS     │ │ TEAMS       │    pointer spotlight G-8         ║ │
│  ║  │ one line …→ │ │ one line …→ │ │ one line …→ │                                  ║ │
│  ║  └─────────────┘ └─────────────┘ └─────────────┘                                  ║ │
│  ║  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                                  ║ │
│  ║  │ 04 CIRCUITS │ │ 05 COMPARE  │ │ 06 RECORDS  │                                  ║ │
│  ║  └─────────────┘ └─────────────┘ └─────────────┘                                  ║ │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝ │
│                                                                                       │
│  ╔═ SECTION C — COVERAGE RULER · .shell-container · reveal G-15 ═════════════════════╗ │
│  ║  ── THE HONEST PART                                                               ║ │
│  ║  What the record holds                                                            ║ │
│  ║  Results              ████████████████████████████████████████████  1950 →        ║ │
│  ║  Qualifying positions ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████████  1994 →       ║ │
│  ║  Lap-by-lap timing    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██████████████  1996 →      ║ │
│  ║  Q1 / Q2 / Q3         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████  2006 →      ║ │
│  ║  Pit stops            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█████  2011 →      ║ │
│  ║  Sprint races         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██  2021 →      ║ │
│  ║  1950      1970      1990      2010    2026    ← axis, --text-2xs --ink-tertiary  ║ │
│  ║  ▸ View as a table                                                                ║ │
│  ╚═══════════════════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────────────────┘
┌ footer ── .shell-container · 1px --border-subtle top ─────────────────────────────────┐
│  Complete results through 2026 Round 10 · Seasons 1950–2026                            │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

###### 3.2 Section A — the hero, specified exactly

| Element | Spec |
|---|---|
| Container | `min-height: max(100svh, var(--size-hero-min))`; full-bleed (no `.shell-container`); inner content in a column of `max-width: 720px`, aligned to the `.shell-container`'s left gutter; vertically centred; `padding-block: 24` (96px) |
| **Eyebrow** | a 24×2px `--accent-mark` rule, gap `2`, then `THE ARCHIVE · {firstYear}—{latestYear}` at `--text-2xs` uppercase `--ink-tertiary`; the years in `--font-mono`. Em dash (U+2014) between the years |
| **Headline** | three lines, `<h1>`, Archivo 700 `wdth 82`, uppercase, `--ink-primary`, last line `--accent-ink`. Sizes: `--display-xl` (60) below 768 · `--display-2xl` (80) at 768–1439 · `--display-3xl` (112) at 1440+. Discrete steps, never `clamp()` (`DESIGN_SYSTEM.md` §2.3). Lines: **`SETTLE`** / **`THE`** / **`ARGUMENT.`** Motion **G-16** |
| **Sub-headline** | `--text-md`, `--ink-secondary`, `max-width: 52ch`, margin-top `6` (24) |
| **CTA row** | margin-top `8` (32), gap `3`. Primary: `Button` variant **`hero`**, size `lg`, label **"Explore the {latestYear} season"** + trailing `ArrowRight`, href `/season`, motion **G-9** (the only magnetic element in the product). Secondary: `Button` variant `secondary`, size `lg`, label **"Compare drivers"**, href `/compare` |
| **Stat strip** | margin-top `12` (48); a 1px `--border-subtle` top rule; a 4-column grid at ≥768, 2×2 at <768; gap `6`. Each tile: figure in `--font-mono` `--display-lg` (44) at ≥768 / `--display-md` (32) below, `--ink-primary`, `font-variant-numeric: tabular-nums`; label beneath at `--text-2xs` uppercase `--ink-tertiary`, `max-width: 14ch`. Motion **G-17** |
| **Orb placement** | orb A anchors top-right, orb B far-left, orb C lower-right — all **outside the 720px text column** by construction, so the composition reads as designed rather than smeared. Contrast under the text is guaranteed by the plate, measured in §9.2 V-17, not by the orbs' placement |

**Why "SETTLE / THE / ARGUMENT."** The product's centre of gravity is cross-era comparison
(`CLAUDE.md` §1) — which is what F1 fans actually argue about. It is a claim about the product's
*purpose*, so unlike "every lap" it cannot be falsified by a coverage boundary, and the sub-headline
immediately tells the truth about those boundaries. Three short words also give a strong left rag at
112px, which 60px type cannot.

###### 3.3 The stat strip — exactly what it shows, from fields that already exist

Every figure comes from `GET /api/meta`, whose schema (`server/schemas/meta.ts`) already carries all
four. **No API change is required to ship this section.**

| Tile | Value | Source field | Count-up (G-17)? |
|---|---|---|---|
| 1 | `77` | `seasons.count` | yes |
| 2 | `10` | `latestSeason.completedRounds` | yes |
| 3 | `1996` | `coverage.laps.from` | **no** — `gsap.set`; counting up to a year is a gimmick and reads as a bug |
| 4 | `1950–2026` | `seasons.firstYear`–`seasons.latestYear` | no |

| Tile | Label |
|---|---|
| 1 | `SEASONS` |
| 2 | `ROUNDS COMPLETE IN {latestYear}` |
| 3 | `LAP TIMING FROM` |
| 4 | `RESULTS COVERAGE` |

> **Optional enhancement, flagged not assumed — `principal-engineer`'s call.** Two more figures would
> make this strip considerably stronger: **total races** and **total laps**. Both are single indexed
> `COUNT(*)`s and would be a new `archive: { races, laps }` object on `/api/meta`. If it lands, the
> strip becomes **six tiles** in a 3×2 grid at ≥768 (labels `RACES` and `LAPS TIMED`, both with
> count-up). **If it is declined, the four tiles above ship unchanged and nothing else moves.** This is
> deliberately not a dependency.

###### 3.4 Section B — the capability grid

| Element | Spec |
|---|---|
| Section header | eyebrow `WHERE TO GO` (accent rule + `--text-2xs`), then `<h2>` **"Six ways into the record"** at `--display-sm` |
| Grid | 3 columns at ≥1024, 2 at 768–1023, 1 below; gap `6` (24) |
| Card | `--surface-raised`, `--elev-1`, `--radius-lg`, padding `6` (16 below 768). A **1px `--accent-hairline` top edge**, inset 0. The whole card is one `<a>` |
| Card content | index `01`–`06` in `--font-mono` `--display-md` `--accent-ink`, top-left; an `IN BUILD` chip (`Badge` `neutral`, `--text-2xs`) top-right while the destination is a placeholder, **absent** once the feature lands; title at `--display-xs` Archivo `--ink-primary`; body at `--text-sm` `--ink-secondary`; a 16px `ArrowRight` bottom-right in `--ink-tertiary` |
| Card hover / focus | pointer spotlight **G-8** (`--accent-glow` at 14%), `y: -2` (`m.control`), top edge → `--accent-mark`, arrow → `--accent-ink` and `x: 0→3`. Focus-visible gets the achromatic double ring **and** the same non-pointer states, so a keyboard user is not shown less |
| Reveal | **G-15**, children staggered `stagger.card`, capped at `stagger.cap` |

Cards, in order, with final copy:

| # | Title | Body | href | Chip until |
|---|---|---|---|---|
| 01 | **SEASON** | "The calendar, the standings, and how the championship actually moved round by round." | `/season` | F2 |
| 02 | **DRIVERS** | "Careers, season-by-season form, and the teammate head-to-heads that decide reputations." | `/drivers` | F4 |
| 03 | **TEAMS** | "Constructor histories, driver line-ups, and the seasons that defined them." | `/teams` | F5 |
| 04 | **CIRCUITS** | "Every venue the championship has visited, and what tends to happen there." | `/circuits` | F6 |
| 05 | **COMPARE** | "Up to four drivers or teams, any season range, one chart that doesn't cheat." | `/compare` | F7 |
| 06 | **RECORDS** | "Cross-era leaderboards, normalised so a 1954 season and a 2024 season can be read side by side." | `/records` | F8 |

###### 3.5 Section C — the coverage ruler

**This is not a chart, and that is a deliberate, checkable claim.** No Recharts, no visx, no scale
function, no data fetch beyond `/api/meta`'s `coverage` object, no axis component. It is six
absolutely-positioned bars inside a CSS-grid row, with `left`/`width` computed by plain arithmetic over
the fixed domain `firstYear → latestYear`. F0's "no chart and no chart primitive" rule holds.

| Element | Spec |
|---|---|
| Section header | eyebrow `THE HONEST PART`; `<h2>` **"What the record holds"** at `--display-sm`; lead paragraph at `--text-md` `--ink-secondary`, `max-width: 68ch` |
| Row | label column `180px` (`120px` below 768) at `--text-sm` `--ink-primary`; track fills the rest; trailing "from" year at `--font-mono` `--text-xs` `--ink-tertiary`, 64px column |
| Track | height 10px, `--radius-sm`, `--surface-sunken` for the whole domain; the available span filled `--accent-mark`; **a 2px `--surface-raised` gap** between the unavailable and available spans, per `DESIGN_SYSTEM.md` §3.3 rule 2 |
| Rows | Results 1950 · Qualifying positions 1994 · Lap-by-lap timing 1996 · Q1 / Q2 / Q3 2006 · Pit stops 2011 · Sprint races 2021 — **all six years read from `meta.coverage`, never hardcoded** |
| Axis | ticks and labels at 1950, 1970, 1990, 2010, `latestYear`; `--text-2xs` `--ink-tertiary`, `--font-mono`; 1px `--border-subtle` gridlines |
| Interaction | hover/focus on a row raises it to `--surface-raised` and shows a tooltip with that row's no-coverage sentence from `DESIGN_SYSTEM.md` §7.4. Rows are focusable (`tabindex="0"`, `role="listitem"` inside a `role="list"`) |
| Table view | a `<details>` disclosure, summary **"View as a table"**, containing a 3-column `<table>`: *Data class* / *Available from* / *Not available before*. Present even though this is not a chart, because §6.2's table-view rule is the right habit and this is the surface that teaches it |
| Reveal | **G-15**; bars additionally grow `scaleX 0→1` from `transformOrigin: "right"` (they end at the right edge), `dur.chart`, `ease.mech`, `stagger {each: 0.06}` — the axis-anchored growth rule from §6.1, applied to its first real instance |

**Why this section exists on the landing page.** The most-seen state in this whole product is
"no coverage" (`DESIGN_SYSTEM.md` §7.4). Teaching the boundary once, at the front door, in a form
that is interesting rather than apologetic, means every later encounter with it is a reminder rather
than a surprise. It is also the most product-truthful thing we can show while F0 has no content.

###### 3.6 Responsive behaviour

| | 390 (base) | 768 (md) | 1440 (xl) |
|---|---|---|---|
| Hero height | `max(100svh, 640px)` | same | same |
| Headline | `--display-xl` (60) | `--display-2xl` (80) | `--display-3xl` (112) |
| CTA row | stacked, full-width buttons, gap `3` | inline | inline |
| Stat strip | 2×2 | 4 columns | 4 columns |
| Capability grid | 1 column | 2 columns | 3 columns |
| Coverage ruler | label column 120px, axis ticks 1950/1990/2026 only | 180px, all ticks | 180px, all ticks |
| Nav | bottom dock, `main` reserves 96px bottom | bottom dock | left rail, `main` reserves 96px left |
| Orbs | A and B only; C hidden (a 480px blur on a 390px viewport is just a wash) | all three | all three |
| Racing line | hidden below 768 — at that width it crosses the text column and the SVG's `slice` crop loses the corners that made it read as a circuit | visible | visible |
| Magnetic CTA (G-9) | not attached (`(pointer: fine)` only) | attached if a fine pointer | attached |
| `100svh` | **`svh`, not `vh`** — `vh` on iOS Safari is the *largest* viewport, so a `100vh` hero is cropped by the URL bar on first paint. This matters because it is the first thing anyone sees on a phone | | |

---

##### 4. Decision 2 — the moving background

Fully specified in **`docs/DESIGN_SYSTEM.md` §7.7**: six layers, every colour, size, blur radius,
opacity, anchor offset, loop duration and ease; the three `data-bg` intensity levels; the
reduced-motion behaviour; the CSP position; and the measurement (§9.2 V-13 / V-17) that forced the
contrast plate into the design. It is not restated here.

The four points that most often get lost in implementation:

1. **The contrast plate is not decoration.** Without it, `--border-control` measures **2.64:1** and
   `--ink-tertiary` **4.00:1** over the orb-tinted field — both below their floors (§9.2 V-13).
   Reducing orb opacity does not fix it. Removing the plate is an accessibility regression, not a
   simplification.
2. **`data-bg` defaults to `calm`.** Only `/` sets `hero`. The shell sets the attribute; a route never
   sets it itself, so a route that forgets still gets a correct, quiet background.
3. **Reduced motion leaves a composed still image**, not a blank page: grid, orbs, grain, plate and the
   static racing-line stroke all remain; only the four ambient tweens are never created and the comet
   is `display: none`.
4. **The atmosphere is rendered once, in `AppShell`**, at `z-index: 0`, `pointer-events: none`,
   `aria-hidden="true"`. It is never remounted on navigation and never cross-fades — an animated
   background that re-enters on every click is a defect you feel on the fifth click.

---

##### 5. Decision 3 — navigation: `CommandDock`

###### 5.1 Why a dock, and why it changes shape at 1024px

Rishabh offered two options: a floating bottom bar or a collapsible sidebar. **Both are right, at
different widths**, and the deciding constraint is what F1–F7 put on these pages.

| Option | Judged against F1–F7 |
|---|---|
| Full-width top nav (what shipped) | **Rejected.** Seven-plus destinations, and the most default chrome there is. Rishabh's diagnosis was correct on sight |
| Push sidebar (240–280px, always visible) | **Rejected.** F2's standings tables and F3's lap-time charts want horizontal room; charts are sized by *measured width*, so a sidebar permanently costs 260px of plot area, and a *collapsible* one **resizes every chart on the page when a user toggles it**. A chart that reflows because you touched the nav is a defect |
| Bottom dock at every width | **Rejected at ≥1024.** It wastes the widest axis, and it sits over the bottom of a chart — exactly where a tooltip or an x-axis label lives |
| **Expanding overlay rail (≥1024) + floating bottom dock (<1024)** | **Chosen.** The rail costs a constant **96px** of gutter whether collapsed or expanded, because it expands **over** content and never reflows `main`. Below 1024 the bottom dock is thumb-reachable, which a top bar never is, and costs zero horizontal width |

This is a collapsible sidebar in its best form and a floating bottom bar in its best form — both of
Rishabh's suggestions, each used where it actually wins.

###### 5.2 The rail — ≥1024px

| Property | Value |
|---|---|
| Position | `fixed; left: var(--size-dock-inset)` (16); `top: 50%; transform: translateY(-50%)`; `z-index: var(--z-dock)` (40) |
| Width | `var(--size-dock)` (64) collapsed → `var(--size-dock-open)` (232) expanded, **G-4** |
| Surface | `--surface-glass` + `--glass-blur`, `--radius-2xl` (20), `--elev-2`, 1px `--border-subtle`. `@supports` fallback to `--surface-raised` |
| Padding | `2` (8) |
| Item | 48px tall (`--size-dock-item`), `--radius-md`, icon 20px with its centre at x = 32 (so the glyph does not move when the rail expands — the single most noticeable detail if it is got wrong), label `--text-base` Inter 500, `--ink-secondary` |
| Active item | `--accent-wash` fill, `--ink-primary` label and icon, `aria-current="page"`, plus the indicator: a **2×20px `--accent-mark`** bar at `left: 0`, vertically centred, moved by **G-3** |
| Hover item | pointer spotlight **G-8** at 14%, icon → `--accent-ink`, label → `--ink-primary` |
| Expansion triggers | `pointerenter` / `pointerleave` on the rail; `focusin` / `focusout` on any child; the pin toggle |
| Pin | a 48px row below a 1px `--border-subtle` divider, `Pin` / `PinOff` glyph, `aria-pressed`, label "Keep menu open" / "Collapse menu". Persisted at `localStorage["f1a.dock"]` = `"pinned" \| "auto"`, default `"auto"` |
| Reduced motion | **permanently expanded at 232px, pin control hidden.** A hover-to-reveal affordance is precisely what a reduced-motion user should not have to chase |

###### 5.3 The bottom dock — <1024px

| Property | Value |
|---|---|
| Position | `fixed; bottom: 16px; left: 16px; right: 16px; max-width: 480px; margin-inline: auto; z-index: 40` |
| Height | `var(--size-dock)` (64) |
| Surface | as the rail, but `--radius-full` |
| Slots | **five**, `flex: 1`, each ≥48×48: `Home` · `Season` · `Drivers` · `Compare` · `More` |
| Slot content | 20px icon above an `--text-2xs` label, centred, gap `0.5` (2) |
| Active slot | `--accent-wash` pill inset `1` (4), `--radius-full`, `--ink-primary`; indicator = a **2×16px `--accent-mark`** bar at the slot's **top** edge, moved on `x` by **G-3** |
| `More` | opens the overflow sheet, **G-5**. `aria-expanded`, `aria-haspopup="dialog"` |
| Overflow sheet | bottom sheet, `left/right: 16`, `bottom: 16`, `--radius-2xl`, `--surface-overlay`, `--elev-2`, padding `2`. A `--text-2xs` uppercase `--ink-tertiary` heading **"Go to"**, then **all seven** destinations as 56px rows (not just the overflow — a user who opened "More" should see the whole map), then a 44px `Close` row. Scrim `rgb(0 0 0 / 0.4)` light / `0.6` dark — the `--scrim` token the previous build flagged as unspecified is hereby **specified**: `--scrim: rgb(0 0 0 / 0.44)` light, `rgb(0 0 0 / 0.62)` dark. Focus trapped; `Esc` closes; focus returns to `More` |

###### 5.4 Destinations, in order, with icons

Icon glyphs are **Lucide geometry** added to `src/components/ui/icons.tsx` (`ARCHITECTURE.md` §2 — one
inline set, `lucide-react` is not a dependency).

| # | Label | href | Glyph | In bottom dock? | Ships |
|---|---|---|---|---|---|
| 1 | Home | `/` | `House` | yes | **F0** |
| 2 | Season | `/season` | `CalendarDays` | yes | F2 |
| 3 | Drivers | `/drivers` | `UserRound` | yes | F4 |
| 4 | Teams | `/teams` | `Users` | sheet only | F5 |
| 5 | Circuits | `/circuits` | `MapPin` | sheet only | F6 |
| 6 | Compare | `/compare` | `GitCompareArrows` | yes | F7 |
| 7 | Records | `/records` | `Trophy` | sheet only | F8 |

**No dead controls.** Global search and the app-wide season selector are F9 and are simply absent, not
present-and-disabled. Every dock item above resolves to a designed placeholder today.

###### 5.5 The header, now that nav has left it

| Element | Spec |
|---|---|
| Header | 56px at every breakpoint; `--surface-glass` + `--glass-blur`; **no bottom border at rest**; `position: sticky; top: 0; z-index: 30`. Inner content in `.shell-container` |
| Wordmark | `F1 ANALYTICS`, `--display-xs`, Archivo 700 `wdth 82`, `--tracking-wordmark`, `--ink-primary`, **the `1` set in `--accent-ink`**; links to `/`; `aria-label="F1 Analytics — home"` |
| Right cluster | `DataVintage` then `ThemeToggle`, gap `2` — both **carried forward unchanged** from the 2026-08-04 spec §5.1 / §5.2, including all four copy lines and the pluralisation rules |
| Hairline | appears on scroll past 24px, **G-13**: 1px `--border-subtle` across the full width, plus a 96px `--accent-mark` segment at the left edge growing `scaleX 0→1` from the left |
| `main` | **loses its own padding and max-width.** It becomes `flex: 1; position: relative; z-index: var(--z-content)`, with `padding-left: var(--size-rail-clearance)` at ≥1024 and `padding-bottom: var(--size-dock-clearance)` below. Each route wraps its own content in `.shell-container`, which carries the max-width and the page gutters. This is what lets the hero be full-bleed without negative-margin hacks — **a structural change the developer must make in `AppShell`** |
| `main` still owns | the single `main` landmark and `id="main"`. The skip link still targets it. Nothing else renders a `main` |
| Footer | inside `.shell-container`; `--text-xs`, `--ink-tertiary`, padding-y `6`, 1px `--border-subtle` top; the coverage echo string, unchanged |

###### 5.6 Route placeholders, refreshed

The 2026-08-04 spec §2.3 anatomy stands, with three changes so a placeholder looks deliberate next to a
finished landing page:

```
── SEASON HUB                       ← 24×2px --accent-mark rule + --text-2xs uppercase --ink-tertiary
2026 Season                         ← <h1>, --display-lg, --ink-primary
This surface ships in F2.           ← --text-md, --ink-secondary
year 2026                           ← mono chips, --surface-sunken, --radius-sm, resolved params
```

1. The eyebrow gains the accent rule.
2. The placeholder sits on `--surface-raised` at `--elev-1`, `--radius-lg`, padding `6` — so it reads
   as a panel on the atmosphere rather than as loose text floating on a moving field.
3. `data-bg` is `calm` on every one of them.

`NotFound` keeps the `404` `StateCard` (`DESIGN_SYSTEM.md` §7.4), not the placeholder shape.

---

##### 6. Decisions 3 and 4 — the theme and the accent

###### 6.1 The theme: "Instrument"

The measured neutrals of `DESIGN_SYSTEM.md` §3.5 are **kept exactly** — every one of them passed
(§9.2 V-2) and re-passed over the animated background (§9.2 V-17). What changes is everything the
rejected build was missing around them:

| Ingredient | Was | Now |
|---|---|---|
| Accent | none | **Signal**, hue 350, on every surface in `DESIGN_SYSTEM.md` §3.6.4 |
| Depth | one flat canvas | six-layer atmosphere + glass chrome + a z-index scale |
| Chrome | opaque bar | translucent, blurred, floating; hairline appears on scroll |
| Type | topped out at 44px | tops out at **112px**, on one element |
| Motion | route change only | 23 named motions, seven of them pointer-driven |
| Texture | none | a 240px grain tile at 2–3.8% — the detail that stops an 80px-blurred orb banding |

**Dark mode is the designed default impression** and is where the accent, the glass and the orbs are
strongest (orbs at 0.17 vs 0.09; the primary button is hi-vis `#FE02A9` with near-black ink). Light
mode is designed separately, not inverted, exactly as §3.5 already requires — the accent flips from
`#FE02A9` to the deeper `#D1018A` precisely because the vivid step only reaches 3.62:1 on white.

###### 6.2 The accent: Signal, OkLCh hue 350

Full ramp, all eleven semantic aliases, every measured figure, and the required-placement table are in
**`DESIGN_SYSTEM.md` §3.6**. Headline values:

| | Light | Dark |
|---|---|---|
| `--accent-ink` / `--accent-fill` | **`#D1018A`** | **`#FE02A9`** |
| on `--surface-raised` / `canvas` / `sunken` | **5.14 / 4.84 / 4.55** :1 | **4.71 / 5.29 / 5.50** :1 |
| `--accent-on` (ink on the fill) | `#FFFFFF` at **5.14:1** | `#0E0F13` at **5.29:1** |
| `--accent-mark` (rules, marks, indicators) | `#FE02A9` at **3.62 / 3.41 / 3.20** :1 (floor 3.0) | `#FE02A9` at **4.71 / 5.29 / 5.50** :1 |
| `--accent-wash` + `--accent-wash-ink` | `#FFE2EE` + `#A2006A` at **6.33:1** | `#570036` + `#FF98CA` at **7.27:1** |
| Achromatic focus ring over the accent fill | **3.25:1** (floor 3.0) | **3.37:1** |

**Every contrast floor passes in both themes.** So does every normal-vision separation floor: the
minimum ΔE to any reserved semantic is **20.09** and to any brand colour **26.00**, against a floor of
15 (§9.2 V-11, V-15, V-16).

**Why hue 350 and not the obvious choices** — measured, in §9.2 **V-10**, all 360° scanned:
violet/indigo is **ΔE 1.10 from the reserved timing purple**; blue collides with Red Bull at **2.66**
and Williams at **5.65**; teal/green collides with the reserved green at **1.74**; amber collides with
the reserved yellow at **8.31**. Magenta-rose (h 345–20) is the **only** surviving band, and inside it
h 350 gives the largest separation from Ferrari (**26.0** vs 19.5 at h 0), which matters more than the
marginal semantic gain h 0 would buy.

**Residual CVD failures are recorded, not hidden** — `DESIGN_SYSTEM.md` §3.6.5 lists all seven with
figures, and shows that no hue anywhere on the wheel can clear the CVD floor against twenty colours
(the best is 14.7, at hue 300, inside the forbidden purple band). Mitigation is the structural one
this system already runs on: **the accent never carries meaning, never carries identity, and is never a
series colour** — and every status and timing colour it could be confused with already ships with a
mandatory icon and label.

**Also binding:** the F1 fallback ramp for the 202 colourless teams (§3.1) **must exclude hue
340–360**, so a colourless team is never painted the interface accent.

---

##### 7. Motion — GSAP, 23 motions in F0

Full specifications — trigger, target, property, duration, ease **by GSAP name**, stagger, reduced-motion
behaviour, and the GSAP documentation reference for each — are in **`DESIGN_SYSTEM.md` §4.6 (G-0…G-24)**
and the token set in **§4.3**. This table says only which land in F0 and where.

| ID | Where in F0 | Interaction or ambient? |
|---|---|---|
| **G-0** | the root `gsap.matchMedia()` in `src/lib/motion.ts` | mechanism |
| **G-1** | shell mount — header, then dock container, then dock items | entrance (≤460ms) |
| **G-2** | route content enter, keyed on `location.pathname`; **no exit tween** | interaction |
| **G-3** | dock active-item indicator, both orientations | interaction |
| **G-4** | rail expand / collapse | interaction |
| **G-5** | bottom-dock overflow sheet + scrim | interaction |
| **G-6** | `ThemeToggle` and `DataVintage` popovers | interaction |
| **G-7** | every button, dock item, card, popover row | interaction |
| **G-8** | pointer spotlight — capability cards, dock items | interaction |
| **G-9** | magnetic hero CTA — **one element in the product** | interaction |
| **G-10** | inline link underline sweep | interaction |
| **G-11** | skeleton pulse (`DataVintage`, stat strip, coverage ruler) | ambient |
| **G-12** | skeleton → content crossfade | interaction |
| **G-13** | header hairline + accent segment on scroll | scroll |
| **G-14** | scroll progress bar — **`/` only** | scroll |
| **G-15** | landing sections B and C reveal | scroll |
| **G-16** | landing headline, `SplitText` masked char reveal | entrance (≈880ms) |
| **G-17** | stat-figure count-up | entrance |
| **G-18** | atmosphere grid drift | ambient |
| **G-19** | atmosphere orb drift ×3 | ambient |
| **G-20** | atmosphere comet along the racing line (`offset-distance`, no plugin) | ambient |
| **G-21** | atmosphere pointer parallax | interaction |
| **G-22** | theme colour transition (CSS, not GSAP) | interaction |
| G-23 | list/grid stagger — **defined, first used F2** | — |
| G-24 | `Flip` shared element — **defined, first used F4; `Flip` is NOT installed in F0** | — |

**`M-n` → `G-n` mapping**, because the carried-forward `DataVintage` (§5.1) and `ThemeToggle` (§5.2)
specs above still cite the retired identifiers. Read the right-hand column:

| Retired | Now |
|---|---|
| M-1 shell mount | **G-1** |
| M-2 route enter | **G-2** |
| M-3 nav active rule | **G-3** (and it moves an accent indicator, not an ink rule) |
| M-4 mobile nav sheet | **G-5** (the dock overflow sheet) |
| M-5 popover open | **G-6** |
| M-6 control gesture | **G-7**, plus **G-8** where a spotlight applies |
| M-7 skeleton pulse | **G-11** |
| M-8 skeleton → content | **G-12** |
| M-9 list/grid reveal | **G-23** (still F2) |
| M-10 scroll reveal | **G-15** |
| M-11 theme change | **G-22** |

**Suggested build order**, because 23 motions in one gate needs staging and the value is very
unevenly distributed: **(a)** G-0, G-22, G-7 — the guard and the baseline feel; **(b)** G-1, G-2, G-3,
G-4, G-5, G-6 — the chrome; **(c)** G-18, G-19, G-20, G-21 — the atmosphere; **(d)** G-16, G-17, G-13,
G-14, G-15 — the landing page; **(e)** G-8, G-9, G-10, G-11, G-12 — the polish. Stopping after (d)
would still be a dramatic improvement on what was rejected; stopping before (c) would not.

**Three things that are defects, not preferences:**

1. **Any `framer-motion` import, `MotionConfig`, `AnimatePresence`, `layoutId`, `whileHover`, or
   Framer easing string** (`"easeOut"`, `"circOut"`, …). The library is removed. `src/lib/motion.ts` is
   rewritten, and `src/components/layout/PrimaryNav.tsx` is deleted.
2. **Any `cubic-bezier()` literal, or any of `back` / `elastic` / `bounce` / `CustomEase`.** Seven named
   GSAP eases exist in this product (§4.3) and no others.
3. **Any ambient tween created outside the `no-preference` branch of `gsap.matchMedia()`.** Reduced
   motion means the tween is never created, not that it runs at `duration: 0`.

**`useGSAP` from `@gsap/react` is mandatory** for anything created in a component: React 19 +
StrictMode double-invokes effects, and without the hook's `gsap.context()` revert that means duplicated
conflicting tweens. Handlers created after the hook runs (pointer, click) must be wrapped in its
`contextSafe()`.

**Bundle** — measured, `npm pack gsap@3.15.0` + `gzip -9` on each UMD `dist` file:
core **27.7 KB** + ScrollTrigger **17.6 KB** + SplitText **3.6 KB** + `@gsap/react` ≈1 KB =
**≈49 KB gzipped**, against `framer-motion`'s measured **40.8 KB**. Projected total
**≈154 KB against the 250 KB ceiling**. `MotionPathPlugin` (9.7 KB) is **avoided** by using native CSS
`offset-path`; `Flip` (9.7 KB) is deferred to F4; `ScrollSmoother` is **never** installed.

---

##### 8. States

The 2026-08-04 spec §7 and §7.1 are **carried forward**, including the full database-unavailable copy.
CR-007 adds one rule and the landing page's own states.

> **The hero never depends on data.** Its headline, sub-headline, CTAs and background need no API
> response, so **no failure of `/api/meta` may blank the landing page**. Loading, error and
> unavailable states are scoped to the stat strip and the coverage ruler.

| State | Where | Design |
|---|---|---|
| **loading** | `DataVintage` | 92×20 skeleton at the resolved chip width, **G-11**, `aria-busy` on the container |
| **loading** | landing stat strip | four skeleton pairs: a `--display-lg`-height block at 4ch width, plus a `--text-2xs`-height block at 10ch. **The strip holds its full height**, so the CTA row above it never moves when data lands |
| **loading** | coverage ruler | six full-width `--surface-sunken` tracks at 10px with no fill, labels rendered normally (they are static strings), years replaced by a 4ch skeleton |
| **loading** | route placeholders | none — they render synchronously |
| **error (500)** | stat strip | replaced by one line: **"Coverage figures aren't available right now."** at `--text-xs` `--ink-tertiary`. **No error card in a hero** — the failure is already stated below, and an alert tile in the hero is the ugliest possible first impression |
| **error (500)** | coverage ruler | `ErrorState` filling the section box, `min-height: 240`, holding its height (**G-12**) |
| **rate-limited (429)** | coverage ruler | `ErrorState`: "Too many requests" / "Wait a moment and try again." / "Try again" + mono `RATE_LIMITED` chip |
| **database unavailable (503)** | landing | hero renders in full (static); **both** lower sections are replaced by a single `DataUnavailableState` (copy unchanged from §7.1), `max-width: 560`, centred, `min-height: 60vh`. `data-bg` stays `hero`. The header still renders with `DataVintage` in its `unavailable` variant |
| **database unavailable (503)** | any other route | as the 2026-08-04 spec §7 |
| **404** | `NotFound` | `StateCard` per `DESIGN_SYSTEM.md` §7.4; `data-bg="calm"` |
| **empty** | not reachable in F0 | designed, built F1 |
| **no-coverage** | not reachable in F0 **as a state** — but §3.5's coverage ruler is its F0 *explanation*, and its tooltips use the exact §7.4 sentences, so the vocabulary is established before the first real boundary is met | |
| **partial data** | stat strip | if `latestSeason.completedRounds === 0`, tile 2 reads `0` with the label `ROUNDS COMPLETE IN {latestYear}` — correct, not empty. If `coverage.laps.from` is null, tile 3 is omitted and the strip renders three tiles |

---

##### 9. Copy — every new string

**Landing hero**

| Slot | String |
|---|---|
| Eyebrow | `THE ARCHIVE · {firstYear}—{latestYear}` → **"THE ARCHIVE · 1950—2026"** |
| Headline | **"SETTLE"** / **"THE"** / **"ARGUMENT."** |
| Headline accessible name (SplitText `aria: "auto"`) | **"Settle the argument."** |
| Sub-headline | **"{count} seasons of Formula 1 — every race result, every qualifying session, and every lap the record holds. Compared across eras, and honest about where the record stops."** → "77 seasons of Formula 1 — …" |
| Primary CTA | **"Explore the {latestYear} season"** → "Explore the 2026 season" |
| Secondary CTA | **"Compare drivers"** |
| Stat labels | **"SEASONS"** · **"ROUNDS COMPLETE IN {latestYear}"** · **"LAP TIMING FROM"** · **"RESULTS COVERAGE"** |
| Stat strip error | **"Coverage figures aren't available right now."** |

**Capability grid** — heading **"Six ways into the record"**, eyebrow **"WHERE TO GO"**, chip
**"IN BUILD"**, and the six card bodies in §3.4.

**Coverage ruler**

| Slot | String |
|---|---|
| Eyebrow | **"THE HONEST PART"** |
| Heading | **"What the record holds"** |
| Lead | **"Formula 1's record gets richer the closer you get to now. Rather than hide that, this product states it: wherever a surface depends on data that doesn't exist for the season you're looking at, it will say so — and say what does exist instead."** |
| Row labels | **"Results"** · **"Qualifying positions"** · **"Lap-by-lap timing"** · **"Q1 / Q2 / Q3"** · **"Pit stops"** · **"Sprint races"** |
| Trailing year | **"{from} →"** |
| Closing paragraph | **"Lap-by-lap timing begins in 1996. Before that the record holds full race classifications, starting grids and championship standings — but no lap times, so pace and stint analysis simply aren't available. No race before 1990 has any lap data at all."** _(The 1996 figure is read from `meta.coverage.laps.from`; only "1990" is a static string, and it is true — zero of the 484 races before 1990 carry lap rows.)_ |
| Table disclosure | **"View as a table"** |
| Table headers | **"Data class"** · **"Available from"** · **"Not available before"** |
| Row tooltips | the exact §7.4 no-coverage sentences, e.g. **"Lap-by-lap timing isn't available for 1976. Lap data begins in 1996. 1976 has full race classifications, grids and championship standings."** — with the year taken from the hovered position on the track |

**`CommandDock`**

| Slot | String |
|---|---|
| Nav accessible name | **"Primary"** |
| Item labels | **"Home"** · **"Season"** · **"Drivers"** · **"Teams"** · **"Circuits"** · **"Compare"** · **"Records"** |
| Pin toggle | label **"Keep menu open"** when unpinned, **"Collapse menu"** when pinned; `aria-pressed` reflects state |
| `More` trigger | visible label **"More"**, accessible name **"More destinations"** |
| Overflow sheet heading | **"Go to"** |
| Sheet close | **"Close"** |
| Wordmark accessible name | **"F1 Analytics — home"** |

**Route placeholders** — unchanged: `{FEATURE} HUB` eyebrow, `{Title}` `h1`,
**"This surface ships in F{n}."**, then resolved-param mono chips.

**Pluralisation is part of the copy spec.** Any counted noun ships both grammatical numbers — a string
that can render `1 seasons` is a copy defect even when the number is right. This applies to the
sub-headline (`{count} seasons`) and to every `DataVintage` line already specified in §5.1.

---

##### 10. Accessibility

| Concern | Spec |
|---|---|
| Skip link | first focusable element, **"Skip to main content"** → `#main`. `z-index: var(--z-skip)` (60) so it appears **above the dock** — at 40 it would be covered by the rail at ≥1024 |
| Landmarks | `header` → `nav[aria-label="Primary"]` → `main#main` → `footer`, in that **DOM order**, whatever the dock's visual position. Exactly one `main`, exactly one primary `nav` |
| Headings | one `<h1>` per route. On `/` it is the split headline; sections B and C are `<h2>` |
| Focus order (≥1024) | skip link → wordmark → `DataVintage` → `ThemeToggle` → dock items 1–7 → pin toggle → main content → footer |
| Focus order (<1024) | skip link → wordmark → `DataVintage` → `ThemeToggle` → dock slots 1–5 → *(sheet, when open: focus trapped, returns to `More`)* → main → footer |
| Rail and keyboard | `focusin` on any rail child expands it (**G-4**), so a keyboard user always sees labels; it collapses on `focusout` unless pinned |
| Focus indicator | the single achromatic double ring, `DESIGN_SYSTEM.md` §3.5.1, **re-measured over the accent: 3.25:1 light / 3.37:1 dark against `--accent-fill`**, floor 3.0 — PASS (§9.2 V-11). Never accent-coloured, never replaced by motion |
| Hover-only information | none. Every G-8 spotlight, G-9 magnet and G-21 parallax is decorative; every state they express is also expressed by a token change that `:focus-visible` triggers |
| Current page | `aria-current="page"` on the active dock item — the accent pill and the 2px rule are never the only signal |
| Split text | `SplitText` runs with its default `aria: "auto"`, which puts an `aria-label` carrying **"Settle the argument."** on the `<h1>` and `aria-hidden="true"` on every generated character |
| Coverage ruler | `role="list"` / `role="listitem"`, each row `tabindex="0"` with an accessible name combining label + availability; plus the `<details>` table view — the ruler is never the only route to the information |
| Background | `aria-hidden="true"` + `role="presentation"`, no text, `pointer-events: none` |
| Contrast | every accent pair measured and passing (§9.2 **V-11**); the glass composite measured and passing (**V-12**); the plated background composite measured and passing (**V-17**), which is what keeps §9.2 V-2's neutral figures true over a moving field |
| Touch targets | ≥44×44 everywhere; every dock slot ≥48×48 |
| Reduced motion | `gsap.matchMedia()` per **§4.4** — ambient tweens are **never created**. The reduced state is a **composed still image and a permanently expanded rail**, not a stripped-down page. The scroll progress bar (G-14) is not rendered at all |
| Colour scheme | `prefers-color-scheme` honoured on first paint and live while the preference is `system`; `theme-init.js` unchanged; `data-bg` is **not** written pre-paint |
| `100svh` | the hero uses `svh`, not `vh`, so iOS Safari does not crop the headline behind the URL bar |
| Table view | present for the coverage ruler even though it is not a chart. F0 still ships no chart |

---

##### 11. Assets required

###### 11.1 Developer-produced — not Rishabh's

| Item | Spec |
|---|---|
| `public/textures/grain.svg` | 240×240, an `feTurbulence` tile: `baseFrequency="0.82" numOctaves="3" stitchTiles="stitch" type="fractalNoise"`, desaturated with `feColorMatrix type="saturate" values="0"`, applied to a full-bleed `<rect>`. Referenced from CSS as `background-image` (`img-src 'self'` — no `data:` needed, no licence question, generated not sourced). **A CSS-only fallback must exist:** if the file is absent the grain layer is simply omitted and nothing else changes |
| `src/components/ui/icons.tsx` | ten new glyphs, Lucide geometry under ISC, same 24px grid / 1.5px stroke / `currentColor`: `House`, `CalendarDays`, `UserRound`, `Users`, `MapPin`, `GitCompareArrows`, `Trophy`, `MoreHorizontal`, `Pin`, `PinOff`. No second icon set, ever (`DESIGN_SYSTEM.md` §2.5) |
| Racing-line path | the `d` attribute of §7.7 layer 3 — authored geometry inside `AtmosphereField`, **not an asset file**, so it can be themed with `currentColor` and duplicated into the comet's `offset-path` from one constant |
| `public/fonts/*` | unchanged from the 2026-08-04 spec §9.1 — three variable `woff2` plus `OFL.txt` |
| `scripts/validate-palette.mjs` | see §12 |

###### 11.2 Assigned to **Rishabh** — tracker task `R3`, unchanged in substance

| Item | Spec |
|---|---|
| Favicon | `public/favicon.svg` — square, legible at 16px, works on light and dark browser chrome |
| App icon | `public/apple-touch-icon.png` — 180×180, PNG, opaque |
| Maskable icon | `public/icon-512.png` — 512×512, PNG, content inside an 80% safe area |

**Placeholder updated by CR-007.** The typographic mark now carries the accent: a `#D1018A`
(`--signal-600`) rounded square — `--radius-md` scaled to the viewBox — with **`F1`** set in Archivo
700 `wdth 82` in `#FFFFFF` (measured **5.14:1**, §9.2 V-11). Hand-authored SVG in `public/favicon.svg`.
`#D1018A` rather than `#FE02A9` because it must also be legible on a **light** browser tab strip.

**Still no F1 logo, no team logo, no photograph anywhere in F0**, and none is needed — F0 renders no
driver, team or race content. **R1 and R2 remain off F0's critical path.**

---

##### 12. Files the developer creates or rewrites

| File | Change |
|---|---|
| `src/styles/tokens.css` | **add** the 11 `--signal-*` steps, the 11 `--accent-*` aliases per theme, `--surface-glass`, `--glass-blur`, `--bg-grid-line`, `--bg-orb-neutral`, `--bg-grain-opacity`, `--bg-plate-alpha`, the `--z-*` scale, `--radius-2xl`, `--text-display-2xl`, `--text-display-3xl`, and the nine `--size-dock*` / `--size-grid-cell` / `--size-hero-min` / `--size-progress` tokens. **Specify `--scrim`** properly: `rgb(0 0 0 / 0.44)` light, `rgb(0 0 0 / 0.62)` dark — the previous build correctly flagged it as unspecified |
| `src/lib/motion.ts` | **rewritten.** Exports `dur`, `ease`, `m`, `loop`, `stagger` exactly as `DESIGN_SYSTEM.md` §4.3, plus the single shared `gsap.matchMedia()` instance (G-0). No `framer-motion` import, no `spring.*` |
| `src/lib/gsap.ts` | **new.** One module that imports `gsap`, `ScrollTrigger`, `SplitText`, `useGSAP` and calls `gsap.registerPlugin(...)` once. Nothing else registers plugins |
| `src/components/layout/AppShell.tsx` | rewritten — renders `AtmosphereField`, the glass header, `CommandDock`, `ScrollProgress`, and a `main` with no padding of its own |
| `src/components/layout/Header.tsx` | rewritten — glass, accent wordmark, scroll hairline (G-13) |
| `src/components/layout/PrimaryNav.tsx` | **deleted** |
| `src/components/layout/CommandDock.tsx`, `DockSheet.tsx` | new — §5 |
| `src/components/layout/AtmosphereField.tsx` | new — `DESIGN_SYSTEM.md` §7.7 |
| `src/components/ui/ScrollProgress.tsx` | new — G-14 |
| `src/components/ui/PageContainer.tsx` | new — the `.shell-container` wrapper each route applies |
| `src/routes/Landing.tsx` + `HeroSection`, `StatStrip`, `CapabilityGrid`, `CoverageRuler` | new — §3 |
| `src/routes/SeasonHub.tsx` | the former `/` placeholder, now at `/seasons/:year`; plus a `/season` redirect |
| `src/components/ui/Button.tsx` | accent recolour + the `hero` variant |
| `scripts/validate-palette.mjs` + `npm run validate:palette` | **new, and it must land in this PR.** It produced every figure in §9.2.1 and §9.1 requires a re-run on any colour change — which the `reviewer` cannot verify without it. Pure arithmetic, no dependency. It also self-calibrates against the recorded pre-CR-007 figures, so a future regression in the validator itself is caught |
| `package.json` | **remove** `framer-motion`; **add** `gsap` and `@gsap/react` |

**No hard-coded colour, duration, font-size or spacing value may appear outside `tokens.css` and
`motion.ts`.** That was already a review criterion; the accent makes it easier to violate, so it is
restated.

---

##### 13. Open questions, and where I disagree

For **Rishabh** — one real risk and one taste question:

1. **⚠ The accent is magenta, and BWT Alpine's 2026 livery is blue *and pink*.** I checked rather than
   assumed: Alpine's A526 launch is branded *"Driving Pink Change"*, with BWT's signature pink
   prominent on the car. So some F1 fans will read a magenta interface as an Alpine reference. My
   judgement is that it is acceptable — BWT pink is a pale pastel (~`#F596C8`), `--accent-mark` is a
   fully saturated `#FE02A9`, the accent appears as thin rules and small fills rather than large
   fields, and **this product renders Alpine as `#00A1E8` blue** because that is the colour in the
   data, so the two never appear as competing identity claims. But it is your call, and it is a
   **one-token change**: moving the ramp to hue 0 gives a crimson-rose (`#D50070` / `#FD0487`) with
   better separation from the timing semantics but worse separation from Ferrari (ΔE **19.5** vs
   **26.0**). I chose against it because "reads a bit like Ferrari red" is the worse of the two
   problems in an F1 product. Say the word and it is a re-run of the validator and a token swap.
2. **"SETTLE / THE / ARGUMENT."** — the headline is a voice decision, not a data one. The alternative I
   considered and rejected was three lines of huge figures (`77 SEASONS. / 1,127 RACES. / 717,764
   LAPS.`), which is more impressive and less memorable, needs an API change, and leaves the page with
   no human sentence anywhere. The composition as specified gets both: words at 112px, figures in the
   strip below.
3. Product name and wordmark remain the open trademark question from the 2026-08-04 spec §11.1 —
   unchanged, and F0 still ships the `package.json` name.

For the **`principal-engineer`**:

4. **Routing:** `/` → Landing, `/seasons/:year` → season hub, **new** `/season` → redirect to
   `/seasons/{latestYear}`. Changes `ARCHITECTURE.md` §5 and `REQUIREMENTS.md`. Design does not ratify
   routing — please confirm the shape and whether `/season` is `<Navigate replace>` or a loader
   redirect.
5. **`AppShell`'s `main` loses its own padding and max-width** (§5.5). This is a structural change and
   it touches the component tree, not just styles.
6. **Optional `/api/meta` addition:** `archive: { races, laps }` — two indexed `COUNT(*)`s — would take
   the stat strip from four tiles to six. **Explicitly not a dependency**; decline it and nothing in
   this spec moves.
7. **Two dependencies:** `gsap@3.15` and `@gsap/react`, and the **removal** of `framer-motion`.
   `ARCHITECTURE.md` §2's Motion row and §10 both need updating. `MotionPathPlugin`, `Flip` and
   `ScrollSmoother` are **not** installed in F0 and I would like that recorded as a decision, not left
   to a later import.
8. **`scripts/validate-palette.mjs` must land in this PR**, not F1 (§12).

Where I **disagree**, stated plainly:

9. **CR-007's claim that "GSAP is cheaper than what it replaces" is wrong.** Measured:
   core + ScrollTrigger + SplitText = **47.7 KB gzipped** against `framer-motion`'s measured
   **40.8 KB**. The swap **costs ≈6.9 KB**. The decision is still correct — the budget has ~95 KB of
   headroom and GSAP is what makes this design possible — but the CR should not carry a false premise,
   and `DESIGN_SYSTEM.md` §4.1 now records the correction.
10. **23 named motions in a single developer gate is a lot**, and if it is going to be cut, I would
    much rather it be cut deliberately along the build order in §7 than discovered half-done at
    review. Stopping after stage (d) is a defensible ship; skipping stage (c) is not, because the
    moving background is item 2 of seven on Rishabh's list.
11. **I think removing the designer's visual-verification gate (CR-006) was the wrong call for *this*
    CR specifically.** Everything at stake here — whether 112px type actually lands, whether the orbs
    read as depth or as smudge, whether the rail's icons stay put as it expands, whether the comet is
    charming or annoying — is a *perceptual* judgement that a written spec can only approximate. I have
    compensated by specifying exact values everywhere and by measuring what can be measured, but the
    honest position is that this spec's aesthetic outcome is unverified until Rishabh runs it. If
    anything looks wrong on his first look, the most likely causes in order are: the orb blur radii
    versus his display, the comet's speed, and the headline's line-height at 112px.

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

**Outcome: partial — T1–T9 landed, then the run was interrupted.** See §G.8.

##### G.8 Gate 3 — interrupted at T9, re-dispatched for T10–T14 · 2026-08-04

The gate-3 run of §G.7 was **stopped mid-flight** (accidental interruption of the `orchestrator`
session, not a defect and not a rejection). Nothing it produced is reverted: **T1–T9 are committed and
stand as delivered.** A second `orchestrator` took over and re-dispatched the remainder. Recorded
rather than rewritten, because the tracker's value depends on the interruption being visible.

**State verified by the incoming `orchestrator` before re-dispatch** — not taken from any agent's
report:

| What I checked | How | Result |
|---|---|---|
| Branch and tree | `git rev-parse`, `git status --porcelain` | `feat/foundation` at `b860c38`, working tree **clean**, nothing pushed to the remote |
| T1–T9 actually on disk | `git ls-files` over `server/`, `src/`, `public/`, config | ✅ Present, including the six vendored `woff2`, `public/theme-init.js`, `db/schema.sql` and 9 test files |
| Toolchain | `node -v` | `v22.23.2` — T1's floor holds |
| Typecheck | `npm run typecheck` | ✅ exit 0, no output |
| Lint | `npm run lint` | ✅ exit 0, no output |
| Unit tests | `npm test` | ✅ **58 passed / 9 files**, 498 ms — the T1–T9 baseline the remaining tasks must not regress |

| Term | Value |
|---|---|
| Scope | **T10, T11, T12, T13, T14** of Technical Spec §8, in order, on `feat/foundation`. T1–T9 are **not** to be redone or refactored beyond what T10–T14 genuinely require |
| Commits landed by the interrupted run | `cb82c62` T1 · `a8b1fc1` T2 · `c082cf2` T3 · `d42b439` T4 · `603810b` T5 · `4148131` T6+T7 · `4758f26` T8 · `b860c38` T9 |
| Binding rulings restated | R-1 the Framer Motion shell/route subset **does** land in F0 (M-1…M-8, M-11, `MotionConfig`); R-2 `ThemeToggle` is a **3-option radiogroup popover**, not a cycle; R-3 achromatic chrome; R-5 typographic favicon placeholder only |
| Hard constraints restated | read-only connection, no write path ever · no auth, no mutation, no third-party request on any path · initial JS **< 250 KB gzipped** · **no hand-written duration/easing/spring/colour/size literal** — tokens only (`src/styles/tokens.css`, `src/lib/motion.ts`) · slugs never integer ids (DL-3) · F0 renders no driver/team/race content |
| Evidence demanded | file paths · real output for `typecheck`, `lint`, `format:check`, `test`, `build` · **the measured gzipped initial-chunk figure against the 250 KB budget, and `framer-motion`'s share** · the **literal** missing-database console text (§2.7) and its `503` · `curl -i` for the T13 production-preview origin · the numbered tests 49–55 and 63–69 accounted for, with the final total reconciled against the spec's 69 · `git status` / `git log` showing no database, `.env` or seed artefact staged |
| Explicitly **not** the developer's to do | mark anything Done · approve, open, push or merge a PR · edit `ARCHITECTURE.md` (Tech §9.1) · run gate 4 or 9 · reopen CR-002 / CR-005 · act on CR-003 / CR-004 |

**CR-005 is closed** (§5.5) and the removed upstream-attribution constraint is not a gate at any
step of this dispatch. `S-12` stays retired and unreused.

**Outcome: pending.** Gate 3 completing does **not** make F0 Done — gates 4–11 follow.

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
1. orchestrator        → CR entry, triage, class, Document Impact Assessment
2. principal-engineer  → technical spec + confirms/corrects the doc impact
3. designer            → design spec (skip only if the CR touches no UI — recorded explicitly)
4. developer           → implement on change/CR-<id>-<slug>, including doc updates
5. reviewer            → code review + S-4/S-6/S-7/S-10 + verifies doc updates landed
6. developer           → fix blocking findings                     (loop 5–6)
7. Rishabh             → reviews the running frontend if the CR touched UI
8. orchestrator        → verify gates → approve → merge
```

Reduced from twelve steps to eight by **CR-006** (§5.5), in step with §2.3. Step 3 may be skipped
**only** when the CR provably touches no UI, and the `orchestrator` records that decision and its
reason in the CR entry.

**Efficiency rules, added by CR-006 — these bind every agent.** The gate reduction alone does not
control cost; re-reading this file does. This file is over 200 KB, and an agent that opens it whole
spends more than the work is worth.

- **Every assignment brief must name the exact sections to read.** "Read `PLAN.md`" is not an
  assignment. An agent given no section list reads §2, its own feature section, and nothing else.
- **The `orchestrator` is not dispatched for work a single agent can do.** Spec, build and review
  are dispatched directly; the `orchestrator` is for triage, gate verification and approval.
- **Prefer one agent with a precise brief over a chain of agents each re-establishing context.**
- **Never re-verify what the coordinating session already verified and stated.** Assignment briefs
  carry verified state (HEAD, tree status, command results); take them as given.

### 5.5 Change request log

| ID | Date | Request | Class | Docs affected | Branch | Status | Approved |
|---|---|---|---|---|---|---|---|
| CR-001 | 2026-08-04 | Every requested change must traverse the full agent order, with document impact stated | C | `PLAN.md` §5 (new), `.claude/agents/*` (all six) | `main` (pre-F0 setup) | ✅ Done | 2026-08-04 |
| CR-002 | 2026-08-04 | Rewrite the passages of `REQUIREMENTS.md` that characterise where the dataset came from, so a fresh clone carries none of it. Fix `HEAD` only; accept the history exposure | C | ~~`REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `PLAN.md`, `.claude/agents/reviewer.md`~~ — none, withdrawn | ~~`change/CR-002-requirements-hygiene`~~ — never opened | **⛔ WITHDRAWN 2026-08-04 — Rishabh's decision** | — |
| CR-003 | 2026-08-04 | `REQUIREMENTS.md` §2.2 / §2.5 say 2026 has 24 rounds scheduled; the data holds 24 calendar rows but only 22 numbered rounds | C | `REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `PLAN.md` | `change/CR-003-numbered-rounds` | Not started (blocked on F0) | — |
| CR-004 | 2026-08-04 | "If multiple teams have the same colour, use the logos instead where necessary, and where the colours don't clash use the colours" | C | `REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `PLAN.md` | `change/CR-004-team-identity-encoding` | Logged — scheduled for F1 | — |
| CR-005 | 2026-08-04 | Remove the upstream-attribution constraint and its check from the gate order entirely — not downgrade it. Forward obligation only; the historical record stays. **Supersedes CR-002** | C | `PLAN.md`, `REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `CLAUDE.md`, `.claude/agents/*.md` · **`docs/DATABASE.md` and `.gitignore`: no change** | folded into `feat/foundation` (F0) — deviation recorded below | **All doc changes landed** | — |
| CR-006 | 2026-08-05 | **Cut the gate count.** Drop `designer` visual verification, the separate security audit, and the `qa` E2E gate. The `reviewer` just reviews code; Rishabh reviews the frontend himself. Development was too slow and consumed too many credits | C | `PLAN.md` §2.3/§2.5/§3/§5.4, `CLAUDE.md` §3, `.claude/agents/reviewer.md`, `.claude/agents/qa.md`, `.claude/agents/designer.md`, `.claude/agents/orchestrator.md` · **`REQUIREMENTS.md`, `docs/DATABASE.md`: no change** | folded into `feat/foundation` (F0) | Doc changes landing now | — |
| CR-007 | 2026-08-05 | **Redo the F0 frontend.** The shell is "too basic, too bland, too ew". Wanted: a landing page with a wow factor, a moving background matching the vibe, a real accent colour used throughout, a richer nav (floating dock or collapsible sidebar) with strong animation, pervasive hover/interaction feedback, and **GSAP** as the animation library. Design delegated to Claude — "I want you to wow me" | **B** | `PLAN.md` (F0 Design Spec + Technical Spec), `docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md` (§2 dependencies, §10 decision log) · **`REQUIREMENTS.md`: change — new landing surface** · **`docs/DATABASE.md`: no change** | folded into `feat/foundation` (F0) | Specs in progress | — |

---

#### CR-007 — redo the F0 frontend · **Class B** · design delegated

**Rishabh's words, 2026-08-05, after running the built shell:** *"i dont really like this frontend
its too basic and too bland, i want more thump and a wow factor to it when its opened"*, *"it should
look like wow what a website"*, *"im leaving the design upto you i want you to wow me"*, and
*"if you need to start from scratch you can do that as well"*.

**What he asked for, itemised so nothing is quietly dropped:**

1. A **landing page** that is genuinely attractive — the first thing a visitor sees.
2. A **moving background** that matches the vibe.
3. A **good theme**, chosen by Claude.
4. An **accent colour used throughout** — the built shell had none, and that is the single biggest
   cause of the blandness. It rendered as near-monochrome greys.
5. **Richer navigation** — his suggestions were a floating bottom bar or a collapsible sidebar, with
   really good animations. Not the plain top bar that shipped.
6. **More interactivity** — hover effects and intuitive affordances throughout.
7. **GSAP** animations wherever possible.

**Verified before specifying, not assumed:**

- **GSAP licensing is not a blocker.** Free for commercial use since April 2025, including every
  formerly paid plugin — ScrollTrigger, SplitText, MorphSVG, ScrollSmoother, Inertia.
- **GSAP is cheaper than what we ship today.** Core ≈23 KB gzipped, ≈33 KB with ScrollTrigger,
  against `framer-motion`'s **measured 40.8 KB** in our own bundle. **GSAP therefore replaces
  `framer-motion` rather than joining it** — one animation system, and the bundle goes down. Two
  libraries for one job would be an architectural defect.

**Binding constraints the redo must respect — these are not negotiable by taste:**

- **The accent may not be purple, green or yellow.** Those are reserved F1 timing semantics
  (`DESIGN_SYSTEM.md` §3.1): purple = session fastest, green = personal best, yellow = below
  personal best. This rules out the violet/indigo accent that most modern dashboards reach for.
- **Brand colours stay identity-only, never a categorical chart palette** (§3.2 — measured, four
  collisions). The redo changes chrome and motion, not that finding.
- **Reduced motion is a correctness requirement, not a preference.** A moving background must have a
  genuinely static state under `prefers-reduced-motion: reduce` — stopped, not slowed.
- **The 250 KB gzipped budget still binds.** Current measured baseline: 147.46 KB.
- **The background must not compete with data.** F2 onward puts dense charts on these surfaces; an
  animated field behind a lap-time chart is a legibility defect, so its intensity is scoped.
- **F0 still renders no driver, team or race content.** The wow comes from craft, not from content
  that does not exist yet.

**Rework this reopens.** T8, T10, T11 and T12 are all affected: the motion token module, every
`framer-motion` call site, `AppShell`/`Header`/`PrimaryNav`, and M-1…M-11. `a2f3a6c`, `0f786aa`,
`dee4e1c` and their fixes stand as history but their UI is superseded. The server, the data layer,
the schemas and the query code are **untouched** by this CR.

**Gate 2 delivered, 2026-08-06.** The `designer`'s output is **F0 → "Design Spec — CR-007"** (§4, F0),
which supersedes the 2026-08-04 Design Spec, plus amendments to `docs/DESIGN_SYSTEM.md` (new §3.6,
rewritten §4, new §5.2a/§5.2b/§7.7/§7.8, extended §2.3/§5.3, new §9.2.1). Headline decisions, so they
are findable without reading the spec:

| Item | Decision |
|---|---|
| Landing | **`/` becomes a designed landing surface**; season hub moves to `/seasons/:year`; **new `/season` redirect**. Changes `ARCHITECTURE.md` §5 and `REQUIREMENTS.md` — needs the `principal-engineer`'s ratification |
| Accent | **"Signal", OkLCh hue 350** — `#D1018A` light / `#FE02A9` dark. Chosen by a 360° scan against 19 reserved colours (§9.2 V-10); every contrast floor passes both themes (V-11) |
| Background | **`AtmosphereField`** — six layers, no canvas, no WebGL, one 240px SVG noise tile. `DESIGN_SYSTEM.md` §7.7 |
| Nav | **`CommandDock`** — expanding overlay rail ≥1024px, floating bottom dock below. One `main`, one primary `nav`, skip link at `z-index: 60` |
| Motion | **23 of G-0…G-24 land in F0.** GSAP core + ScrollTrigger + SplitText + `@gsap/react`; `MotionPathPlugin`, `Flip` and `ScrollSmoother` **not** installed |
| **Correction to this CR's premise** | "GSAP is cheaper than what it replaces" is **false**, measured: **47.7 KB gzipped vs `framer-motion`'s 40.8 KB**, i.e. **+6.9 KB**. The decision still stands — projected total ≈154 KB against a 250 KB ceiling — but the premise is corrected in `DESIGN_SYSTEM.md` §4.1 rather than repeated |
| Open for Rishabh | the accent is magenta and **BWT Alpine's 2026 livery is blue and pink** (verified, not assumed). Judged acceptable with reasons; a one-token fallback to hue 0 is specified. See the spec's §13 |

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
> 4. **The doc-vs-action mismatch this item used to record is fully resolved by CR-005**, which removes
>    the rule outright rather than leaving a policy stricter than the action taken. **Nothing is
>    outstanding and there is nothing here for a `reviewer` to flag** — the removal is complete across
>    `PLAN.md`, `REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `CLAUDE.md` and all
>    six agent definitions. `S-12` is retired and carries no verdict.
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
| `CLAUDE.md` | **CHANGE — ✅ landed `c364739`.** §4.1 reduced to a tombstone with its number retained; **§4.2 and §4.3 deliberately not renumbered**, so existing cross-references still resolve. The stale §8 paragraph asserting §4.1 was live — and that a `reviewer` might flag it at gate 7 — is corrected. |
| `.claude/agents/*.md` | **CHANGE — ✅ landed `c364739`.** `reviewer.md` (the `S-12` row and its check section), `developer.md` (commit-message rule, pre-report check, checklist item), `orchestrator.md` (approval-checklist item, the command block, the standing-constraints bullet; its escalation line narrowed to data **licensing**), `designer.md` and `principal-engineer.md` (hard-constraint bullet). `qa.md` carried none. |

##### ✅ CLOSED — the `CLAUDE.md` and `.claude/agents/*.md` half, and how the channel rule resolved

**Landed in `c364739`, and the way it was resolved is the part worth keeping on the record.**

The `orchestrator` declined to make these two edits and held them at step 4b. **The decision was never
in question** — it is Rishabh's, stated by him in session on 2026-08-04. The hold was a **channel**
requirement: the `orchestrator`'s operating rules reserve edits to `CLAUDE.md` and to agent
configuration to Rishabh's own message or the permission system, **categorically** — the reservation
attaches to a *class of file*, however well-attested the instruction is, precisely because "remove a
guardrail from the files that define the agents' own obligations" is the one request that must not be
self-serviceable. A rule that yielded to a sufficiently confident instruction would not be a rule.

**It was resolved correctly rather than overridden.** The edits were made by the session that received
Rishabh's instruction **first-hand**, which is exactly what the rule points at — not by the
`orchestrator` acting on a relay, and not by lifting the rule. **The block was satisfied, not waived**,
and the distinction matters for the next time this shape of request appears: the answer to "an agent
may not edit configuration on relay" is "the session holding the first-hand instruction does it", never
"the rule bends if the instruction seems solid enough".

**Consequence now discharged:** `S-12` is **no longer live at gate 7**. The `reviewer` records no
verdict for it, and the earlier warning that it might be raised as a finding no longer applies.

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
| 4b | `CLAUDE.md` + `.claude/agents/*.md` | **Rishabh / the session holding his first-hand instruction** | ✅ **Landed `c364739`** 2026-08-04 · six files · **verified by the `orchestrator`**: `CLAUDE.md` §4.1 tombstoned with §4.2/§4.3 unrenumbered; `reviewer.md` `S-12` row and check section gone with `S-13`/`S-14` byte-identical and **both range citations annotated** (the "S-1 to S-14" instruction and the `SECURITY AUDIT: PASS` line) so no verdict is recorded for a retired item and the gap is not read as missing coverage; **zero** carriers left in any agent definition. See the closure note above |
| 4c | `REQUIREMENTS.md` §7.2, `docs/ARCHITECTURE.md` §7 `S-12` + §10 entry | `principal-engineer` | ✅ **Landed `4a28b99`** 2026-08-04 · **verified by the `orchestrator`, not taken on report**: §7.2's other three bullets and lead-in byte-identical; `S-12` absent with `S-13`/`S-14` **unrenumbered and unchanged**; §10 entry 20 present; two files, 4 insertions / 3 deletions, nothing else swept in. **One amendment in flight** — see the attribution ruling below |
| 4d | `docs/DESIGN_SYSTEM.md` §7.3 | `designer` | ✅ **Landed `713b760`** 2026-08-04 · **verified**: one file, 9 insertions / 10 deletions, all prose inside §7.3 plus a §11 log row; **every `DataVintage` copy string byte-identical**; §9 untouched. **Scope expanded beyond my assessment — accepted, see ruling** |
| 5 | Visual verification | — | **Not applicable — no UI change.** Folded into F0's own gate 4, which runs regardless |
| 6 | Fix design findings | — | n/a |
| 7 | Code review + verifies doc updates landed | `reviewer` | Runs as part of F0 gate 6. **Must verify this assessment was honoured, not merely written** (§5.3) |
| 8 | Security audit | `reviewer` | Runs as part of F0 gate 7 over **S-1…S-11 plus S-13…S-14**. `S-12` is retired and **no verdict is recorded for it** |
| 9 | Fix blocking findings | `developer` | As part of F0 gate 8 |
| 10 | E2E | `qa` | **Not applicable — no behaviour change.** F0's own gate 9 covers the branch |
| 11 | Fix QA findings | `developer` | n/a |
| 12 | Verify every gate → approve → merge | `orchestrator` | Pending. **All document changes are now landed and mutually consistent** — the earlier bar (no approval while 4b was open, because a merge would have shipped documents that disagree) is cleared. CR-005 now rides F0's own gates 6–11 |

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

**Ruling 7 — two things from step 4b that are worth more than the edits themselves.**

1. **A check was rescued from inside the removed block, and this is the "do not over-delete" rule
   working.** Buried in the deleted `S-12` section was
   `git diff main...HEAD --name-only | grep -E "^(data/|private/)"` — which guards against **staging the
   66 MB binary or the local-only tooling**. That is an `S-5` / gitignore concern with no relationship to
   the removed rule, and deleting the block wholesale would have taken it out as collateral damage. It
   now lives in the `reviewer`'s command block **relabelled under `S-5`**, and `.gitignore` is untouched.
   **Generalise it:** when removing a block, check what else was living inside it. A removal is not a
   `git rm` of everything the section happened to contain.
2. **⚠ A case-sensitive grep missed a carrier — use `-i`.** The first sweep of step 4b used
   `grep -n` without `-i` and missed `orchestrator.md`'s standing constraint, which begins with a
   **capital P**. It was caught only on an `-i` re-run. Combined with the §7.3 lesson in ruling 1 — that
   a rule stated in one sentence and cited in another will be under-reported by line-number scoping —
   the standing method for this class of sweep is: **`grep -rniE`, then have the file's owner read the
   section.** Neither step substitutes for the other. Any future audit of this removal must use `-i` or
   it will report a false clean.

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
| 2026-08-04 | **CR-005 step 4b landed (`c364739`) — all CR-005 document changes are now complete.** `CLAUDE.md` §4.1 tombstoned (§4.2/§4.3 unrenumbered) and its stale §8 status paragraph corrected; the obligation removed from all six agent definitions; `reviewer.md`'s `S-12` row and check section removed with `S-13`/`S-14` untouched and **both range citations annotated**. **`S-12` is retired — no verdict is recorded for it at gate 7**, and the earlier warning that a `reviewer` might raise it is discharged. Resolved by the session holding Rishabh's first-hand instruction, so the `orchestrator`'s channel rule was **satisfied, not waived**. Two lessons recorded as ruling 7: an `S-5` staging check was rescued from inside the removed block, and a **case-sensitive grep missed a carrier — use `-i`** | orchestrator |
| 2026-08-04 | **Attribution corrected** in `ARCHITECTURE.md` §10 entry 20 and `PLAN.md` §5.5: CR-005 was **decided by Rishabh in session, 2026-08-04**, across two messages. An earlier `orchestrator` ruling had added a hedge calling it relayed-not-first-hand and "not his personal countersignature" — **that was wrong and is reversed**; a relay is the normal path for every instruction and does not weaken attribution. Ruling 5 is kept on the record as withdrawn, with the principle: never hedge an instruction's authority on the grounds it came through the coordinating session; if provenance is unclear, **ask**. The step-4b block is unaffected — it rests on a categorical channel rule about `CLAUDE.md` and agent configuration, not on doubt about who decided | orchestrator |
| 2026-08-04 | **CR-005** opened (Class C) — **supersedes CR-002.** The upstream-attribution constraint and its check are removed from the gate order, the Definition of Done, the F11 checklist and the F0 evidence list; **forward obligation only, historical record kept verbatim** (Technical Spec §9.5, gate record §G.1, CR-002's history, all past commit messages). §2.4 removed with its number retained as a tombstone; §6 risk row removed; §6.1 A-1 and A-2 closed; T2/T14 acceptance cells amended mid-run and the `developer` notified in flight. `docs/DATABASE.md` **no change**. `REQUIREMENTS.md` / `docs/ARCHITECTURE.md` routed to `principal-engineer`, `docs/DESIGN_SYSTEM.md` to `designer`. **`CLAUDE.md` and `.claude/agents/*.md` ⛔ blocked pending Rishabh's own instruction** — an agent-relayed message cannot authorise editing agent configuration, so `S-12` stays live at gate 7 until he speaks | orchestrator |
| 2026-08-06 | **CR-007 gate 1 — Technical Spec written** into F0 as the **CR-007 supersession** section (§S.0–§S.9, 8 tasks C7-1…C7-8, 20 tests CT-1…CT-20). Superseding markers placed at F0 Technical Spec §1.1, §2.4, §3.1, §3.5, §6.4, §7, §8. `ARCHITECTURE.md` amended: §2 motion rows, §5 route table (12 routes, `/` → Landing, hub → `/seasons`, **no redirect**), §10 decisions **#21–#24**. **The CR entry's GSAP size claim is corrected** — measured here, core is 27.6 KB gz and core + ScrollTrigger + hook is 45.5 KB gz, not 23/33; projected bundle **≈140 KB gz** without ScrollTrigger (≈157 with), against 250 KB. Background specified as **CSS-composited gradient layers**, zero JS, because an always-running `rAF` loop competes with the §8 chart-interaction budget. Reduced motion made structural at two chokepoints. **Escalated: two new dependencies** (`gsap`, `@gsap/react`). **Reported for their owners:** `DESIGN_SYSTEM.md` §3.5/§4, `CLAUDE.md` lines 12/179, `PLAN.md` §1/§2 and the F0 Design Spec all still say Framer Motion | principal-engineer |
