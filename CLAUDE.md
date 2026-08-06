# F1 Analytics — Session Context

**Read this fully before doing anything.** This project runs on a **gated multi-agent workflow**.
Do not start building on your own — that bypasses the process and is a review failure.

---

## 1. What this is

A Formula 1 analytics web application for enthusiasts — driver/team/race/circuit analysis, with
comparison across seasons and eras as its centre of gravity. React + TypeScript, heavy but purposeful
GSAP animation, accurate F1 team colours and timing conventions.

**Current phase: F0 (foundation scaffold). No application code exists yet.** Everything committed so
far is documentation and agent definitions.

---

## 2. Canonical documents — these are the contract

| Doc | Governs | Read when |
|---|---|---|
| `PLAN.md` | Features, branch strategy, gate order, **the tracker**, change-request process | Always. Start here. |
| `REQUIREMENTS.md` | What the product must do; **§6 = what the data cannot support** | Before specifying or building anything |
| `docs/ARCHITECTURE.md` | Stack, layering rules, API surface, **§7 security posture**, budgets | Before writing server or client code |
| `docs/DATABASE.md` | Schema, **§6 canonical queries**, **§7 the 14 traps** | Before writing any query |
| `docs/DESIGN_SYSTEM.md` | Visual language, motion, chart conventions | Before any UI work |

If code and a document disagree, that is a **defect**, not a preference. Resolve which is wrong.

---

## 3. The agent workflow — do not bypass it

Six agents in `.claude/agents/`. They register automatically when a session starts **in this
directory**.

| Agent | Owns |
|---|---|
| `orchestrator` | Assigns scope; **sole authority** to mark Done or approve a merge |
| `principal-engineer` | Per-feature technical specs; owns `ARCHITECTURE.md` |
| `designer` | Design specs, design system, **visual verification via Playwright MCP** |
| `developer` | Production code + unit tests only |
| `reviewer` | Code review **+ a separate full security audit** |
| `qa` | E2E suite via **Playwright MCP**, runs last |

**Gate order for every feature and every change** — reduced from eleven gates to seven by **CR-006**,
2026-08-05, because development was too slow and cost too many credits:

```
1. principal-engineer  → Technical Spec into PLAN.md
2. designer            → Design Spec into PLAN.md, AND builds the visual layer
3. developer           → builds everything non-visual: server, data layer, schemas, queries
4. Rishabh             → reviews the running frontend himself
5. orchestrator        → verify gates → approve → merge
```

**The `designer` implements its own work (CR-010, 2026-08-06).** It no longer hands a spec to the
`developer` — that handoff is where **most of CR-007's five blocking defects came from**: a spotlight
written in `%` where the spec meant px, a motion never implemented while a comment claimed it was, an
indicator built in the wrong place so it snapped, an axis given `grid-column` inside a flex parent. Those
are translation losses, not design or coding errors.

| Agent | Owns in code |
|---|---|
| `designer` | `src/styles/**`, presentational components, its own surfaces, `src/lib/motion/**`, `docs/DESIGN_SYSTEM.md` — **and tests for what it builds** |
| `developer` | `server/**`, `src/features/meta/**`, `src/lib/api.ts`, schemas, queries, routing structure |

A design need requiring a new selector or API field is **reported, not built** — that is where a data
trap gets violated silently. A Design Spec is still mandatory: it is how a decision outlives the session
that made it, not a handoff.

**Gone, across CR-006 and CR-009:** `designer` visual verification, the separate security audit, the
`qa` E2E gate, and — as of 2026-08-06 — **the `reviewer` gate itself.** `reviewer` and `qa` are both
**dormant: do not dispatch them.** The `designer` still writes the Design Spec; only its screenshot
pass is gone.

**The four S-items that a code change can actually break are now the `developer`'s own self-check**,
and it must state a verdict on each before hand-off: **S-4** input validation, **S-6** error hygiene,
**S-7** `npm audit`/lockfile/no unvetted dependency, **S-10** query-cost bounds. The rest cannot fail
in a read-only app with no auth.

**Know what this trades away.** The `reviewer` was removed straight after catching **five blocking
CR-007 defects that 210 passing tests missed** — a pointer spotlight rendering `%` instead of `px` so
it landed outside the card, the dock replaying its whole entrance on every hover, a motion a comment
claimed existed but nothing implemented, an indicator that snapped instead of travelling, and a chart
axis 130 px out of line. **Green tests plus clean types no longer imply the screen is right.** Gate 4
is a human looking at it, and it is the only thing standing where that gate stood. Do not tell Rishabh
something works on screen unless it has been seen working. Full record: `PLAN.md` §2.3.

Step 3 cannot start without specs from 1 and 2. Nobody but the `orchestrator` writes `✅ Done`.
**Evidence, not assertions** — reject any completion claim without file paths or command output.

**Efficiency rules (CR-006) — these bind you too.** `PLAN.md` is >200 KB; opening it whole is the
main credit sink. Every assignment brief **must name the exact sections to read**. Do not dispatch
the `orchestrator` for work one agent can do — spec, build and review go direct. Prefer one agent
with a precise brief over a chain each re-establishing context. Never make an agent re-verify state
the coordinating session has already verified and passed to it.

### Change requests

**Every change Rishabh requests is a numbered CR and traverses the full gate order** — see
`PLAN.md` §5. Before work starts, the orchestrator must produce a **Document Impact Assessment**
(§5.3) giving an explicit verdict for every canonical doc (`No change` is valid; silence is not),
and **tell Rishabh which documents the change touches up front**. Doc updates ship in the same PR
as the code.

---

## 4. Hard constraints — violating these blocks a merge

### 4.1 *(removed — number retained, never reused)*

The upstream-attribution constraint and its blocked-terms check were **removed on 2026-08-04**
(CR-005, `PLAN.md` §5.5; `ARCHITECTURE.md` §10 entry 20). Rishabh is making the repo private and
does not regard the exposure as a problem. **Forward-going only** — existing gate records, evidence
entries and commit messages stand verbatim, and the checks already run were correct at the time.
Do not reinstate this, and do not raise it at a gate.

### 4.2 The database is an input, never an artefact

- `data/f1.db` (~66 MB) is **gitignored**. Never commit it or any raw seed file.
- A fresh clone has no database. The missing-DB case must give a clear actionable error.
- Opened **read-only**. The application never writes. Any write path is a defect.
- `private/` holds local-only seed tooling and notes — **gitignored, never committed**.

### 4.3 Read-only product

No auth, no accounts, no mutations, no third-party network calls on any request path. This is a
deliberate security posture (`ARCHITECTURE.md` §7), not an omission.

---

## 5. Data traps that cause silent, shipped bugs

Full list: `docs/DATABASE.md` §7 (14 traps). The ones that bite hardest:

| Trap | Rule |
|---|---|
| `session.has_time_data` is **unreliable in both directions** | Test for the existence of `lap` rows instead — never gate on the flag |
| **Practice data is empty** | 423 FP1 sessions hold 698 entries total, no times. **Do not build practice features.** |
| **Points are not summable across eras** | 24 point systems; some eras counted only best-N results. Read `driver_championship`, or use rate metrics. Summing raw points is a **defect**. |
| `position IS NULL` ≠ DNF | Use `is_classified` / the `status` enum (decoded in `DATABASE.md` §3) |
| `lap` has **717,764 rows** | Every query bounded by session/driver/lap range |
| Invalidated laps | `AND l.is_deleted = 0` in every pace metric |
| `base_team` and `penalty` are **empty** | No lineage or penalty features |
| 202 of 214 teams have **no brand colour** | Fallback ramp required |

**Coverage windows** — the most visible product limits:
`results 1950+` · `qualifying 1994+` · `Q1/Q2/Q3 2006+` · **`lap times 1996+`** · **`pit stops 2011+`** ·
`sprint 2021+`. Zero of 484 races before 1990 have lap data. Every lap-dependent surface needs a
designed state that **explains** the boundary — a blank chart is a defect.

---

## 6. Charts — measured constraints

**F1 team brand colours FAIL as a categorical chart palette.** This was computed with a validator,
not eyeballed. Four failures, detailed in `DESIGN_SYSTEM.md` §3.2 — worst cases: Cadillac `#AAAAAD`
↔ Haas `#9C9FA2` at ΔE 3.8 (indistinguishable even with full colour vision), and RB `#6C98FF` ↔
Alpine `#00A1E8` at ΔE 3.3 deuteranopic.

Therefore: **brand colours for identity** (cards, headers, badges — colour beside a name), but
**charts always carry secondary encoding** (direct labels, dash patterns, marker shapes), comparison
is **capped at 4 entities**, and runtime collision detection is required.

Also binding:
- **Never a dual-axis chart.** Two scales → two charts, small multiples, or a common index.
- Colour follows the **entity**, never its rank.
- Reserved F1 timing semantics, never reused as series colours: **purple = session fastest,
  green = personal best, yellow = below personal best**.
- Legend for ≥2 series; direct labels at ≤4; a table view for every chart.

---

## 7. Environment

| | |
|---|---|
| Node | ✅ **22 LTS installed — `v22.23.2`** (Latest LTS Jod), npm 10.9.8, `nvm alias default 22.23.2` set. Floor is `>=22.22.0` (`ARCHITECTURE.md` §2.1). `better-sqlite3@12.11.1` builds and loads on it; `npm audit` → **0 vulnerabilities**. Ignore `/opt/homebrew/opt/node@22` — that keg is **mislabelled and contains v23.7.0**. **`better-sqlite3` remains the specced driver**; `node:sqlite` is a recorded future consideration only, deliberately not acted on in F0 (§10 #16) |
| ⚠️ **Node in agent shells — CHECK, don't assume** | **Run `node -v` first.** If it reports `v22.x`, you are fine. If it reports `v20.18.2`, this session inherited a PATH pinning `~/.nvm/versions/node/v20.18.2/bin` from before the install, and **every agent touching `node`/`npm` must first run:** `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22.23.2`. Never conclude from a bare `node -v` that Node 22 is missing — it is installed (verified 2026-08-04). A Claude Code restart normally fixes this, since it re-inherits PATH from an interactive shell, where `default -> 22.23.2` applies. The `.nvmrc` that F0 T1 commits helps humans but does **not** auto-switch a non-interactive shell — which is why T1 asserting `node -v ≥ v22.22.0` and **stopping** is load-bearing, not ceremonial |
| Database | ✅ `data/f1.db` present — 19 tables, 717,764 laps, results through **2026 R10** |
| Git remote | `github.com/rishabhpreethan/f1-analytics` — **public** |
| GitHub auth | must be active as `rishabhpreethan`; the `rishabh-zupple` account has read-only access here |
| **Playwright MCP** | ✅ **registered** 2026-08-04 (local project scope). It only appears in the tool list after a Claude Code restart, so **check for `mcp__playwright__*` tools before gate 4 (`designer`) or gate 9 (`qa`)**. If absent, verify with `claude mcp list` — do not re-add it blindly, and do not work around its absence |

If Playwright MCP is not in the tool list, `designer` and `qa` must **stop and report** — never work
around it. Registration having happened does not waive this.

---

## 8. Where we are right now

*Last updated 2026-08-06. Correct this section whenever it drifts — a stale "next action" here has
already misled agents once.*

- `main` — foundation docs + agent definitions, pushed. **Nothing since has been pushed.**
- **`feat/foundation` — current branch.** F0 was **built end to end**: T1–T14 all landed and verified
  (typecheck, lint, `format:check`, **89 tests / 14 files**, build all clean; measured bundle
  **147.46 KB gzipped** = 59 % of the 250 KB budget; the missing-database path gives a clear console
  message and a `503` with no stack trace or filesystem path in the body)
- ⚠️ **The F0 frontend is being REDONE — CR-007.** Rishabh ran the built shell on 2026-08-05 and
  rejected it as *"too basic and too bland"*, *"too ew"*. Wanted: a landing page with a real wow
  factor, a moving background, an accent colour used throughout (the shell had **none** — that is the
  root cause), richer nav with strong animation, pervasive hover/pointer feedback, and **GSAP**.
  Design is delegated to Claude. **`PLAN.md` §5.5 → CR-007** is the contract
- **GSAP has replaced `framer-motion`.** Specifying or importing `framer-motion` is now a **defect**.
  Free for commercial use (all former Club plugins included) since April 2025. **Measured** sizes,
  gzipped: GSAP core **27.6 KB**, core + ScrollTrigger + `@gsap/react` **45.5 KB**, against
  `framer-motion`'s **40.8 KB**. So core alone is cheaper, but **with ScrollTrigger it is ~4.6 KB
  dearer** — the earlier "23/33 KB, the bundle goes down" claim came from a web search and was wrong.
  Projection: **≈140 KB** without ScrollTrigger, **≈157 KB** with. Either way ~100 KB of headroom
- **Gate order is now SEVEN gates, not eleven — CR-006, 2026-08-05.** Dropped: `designer` visual
  verification, the separate security audit, the `qa` E2E gate. **Gate 6 is Rishabh reviewing the
  running frontend himself, and no agent can discharge it.** S-4/S-6/S-7/S-10 fold into the single
  review pass. `qa` is **dormant — do not dispatch it.** Efficiency rules in §3 bind every brief
- ➡️ **NEXT ACTION:** CR-007 specs. **Technical Spec is done** — `PLAN.md` F0 →
  `Technical Spec — CR-007 supersession` (§S.0–§S.9), 8 tasks **C7-1…C7-8** and 20 unit tests
  CT-1…CT-20, plus `ARCHITECTURE.md` §2/§5/§10 (#21–#24). **Design Spec was in progress at last
  update.** Then gate 3 builds C7-1…C7-8. **T10, T11 and T12 are dead task rows**; T1–T7, T9, T13,
  T14 stand verbatim
- **`/` is the Landing; the season hub moved to `/seasons`**, no redirect either way
  (`ARCHITECTURE.md` §10 #23). If a spec merges hub and landing, go back to `principal-engineer`
- **CR-005 supersedes CR-002: the upstream-attribution constraint is GONE** — Rishabh's decision,
  2026-08-04; he is making the repo private and judged the exposure not a problem. §4.1 is a
  tombstone, `S-12` is retired and never renumbered. **Forward-going only — history stands verbatim.**
  Do not reinstate it, re-extend the blocklist, or raise it at a gate. Two `developer` runs re-ran the
  deleted grep anyway because `PLAN.md` §9.5 read as live; it is now banner-marked as historical
- **CR-003** (2026 has 22 numbered rounds, not 24) is blocked on F0. **CR-004** (team logos where brand
  colours collide) is scheduled for F1
- R0 (database) ✅ done. **R1 (driver images), R2 (team logos), R3 (app icons) are Rishabh's** — never
  fabricate, generate, or hotlink images. **None blocks F0**, which renders no driver, team or race
  content and ships a typographic favicon placeholder

---

## 9. How Rishabh likes to work

- **Verify, don't guess.** For facts like team colours, fonts, F1 conventions, or library behaviour —
  search the web or query the database. Assumption-based work has already been caught twice here.
- **One targeted check beats an exhaustive sweep** when verifying something works. Run the single
  check that discriminates the question, report, and offer the broader pass rather than doing it
  unprompted.
- **Read quota/rate-limit headers before fanning out** against any metered API.
- **Report honestly.** A partial result stated accurately is more useful than a complete-sounding
  claim that fails review. If something was skipped or couldn't be tested, say so explicitly.
- Corrections are welcome and expected — state them plainly and move on.
