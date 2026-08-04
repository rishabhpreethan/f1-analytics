# F1 Analytics — Session Context

**Read this fully before doing anything.** This project runs on a **gated multi-agent workflow**.
Do not start building on your own — that bypasses the process and is a review failure.

---

## 1. What this is

A Formula 1 analytics web application for enthusiasts — driver/team/race/circuit analysis, with
comparison across seasons and eras as its centre of gravity. React + TypeScript, heavy but purposeful
Framer Motion animation, accurate F1 team colours and timing conventions.

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

**Gate order for every feature and every change:**

```
1. principal-engineer  → Technical Spec into PLAN.md
2. designer            → Design Spec into PLAN.md        (1 ‖ 2 in parallel)
3. developer           → implement on the feature branch
4. designer            → visual verification (Playwright MCP)
5. developer           → fix design findings              (loop 4–5)
6. reviewer            → code review
7. reviewer            → security audit (S-1 … S-14)
8. developer           → fix blocking findings            (loop 6–8)
9. qa                  → E2E via Playwright MCP
10. developer          → fix QA findings                  (loop 9–10)
11. orchestrator       → verify all gates → approve → merge
```

Steps 3 cannot start without specs from 1 and 2. Nobody but the `orchestrator` writes `✅ Done`.
**Evidence, not assertions** — reject any completion claim without file paths, command output, or
screenshots.

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

- `main` — foundation docs + agent definitions, pushed
- **`feat/foundation` — current branch.** **F0 gates 1 and 2 are complete and verified.** Tracker says
  `Ready for dev ⛔`. Technical Spec (14 tasks, T1–T14) and Design Spec both live in `PLAN.md` §4 F0;
  `docs/DESIGN_SYSTEM.md` is authored through §10
- **Gate 3 preconditions — ALL CLEARED.** `PLAN.md` F0 → **Orchestrator Gate Record** §G.5. **P-1
  Node 22 ✅** (`v22.23.2`, `better-sqlite3` builds, temp-view decision and `/api/meta` values
  re-probed on the target runtime). **P-2 ✅** — `DESIGN_SYSTEM.md` §10 now specifies the external
  `public/theme-init.js`. **P-3 ✅** — all four stale task cross-references corrected; verified by
  grep, the only surviving `T12`/`T13` mentions are the legitimate task rows and §G.3's record of
  what was fixed. **Read §G.2 before building — five rulings are binding**, including that the Framer
  Motion shell/route subset **does** land in F0
- ➡️ **NEXT ACTION: dispatch gate 3 (`developer`) to implement T1–T14** on `feat/foundation`. Nothing
  blocks it. T1 must still assert `node -v ≥ v22.22.0` and stop if not.
- **CR-005 supersedes CR-002: the upstream-attribution constraint is GONE — Rishabh's decision,
  2026-08-04.** He is making the repo private and judged the exposure not a problem. Removed from
  §4.1 (tombstoned above), `PLAN.md` §2.4, the gate order, the Definition of Done, the F11 checklist,
  the F0 evidence list, `S-12` in the security audit (number **retired**, S-13/S-14 unchanged), and
  every agent definition. **Forward-going only — history stands verbatim.** Do not reinstate it,
  re-extend the blocklist, or raise it at gate 7. CR-002's own withdrawal stays on the record.
  **CR-003** (2026 has 22 numbered rounds, not 24) is blocked on F0.
  **CR-004** (Rishabh's proposal: team logos where brand colours collide, colours where they don't) is
  scheduled for F1
- If the orchestrator's `PLAN.md` §5.5 still shows CR-002 as open and highest-priority, that is stale
  — the agent recording the withdrawal was stopped before it wrote. Correct it, don't act on it
- R0 (database) ✅ done. **R1 (driver images), R2 (team logos) and R3 (app icons) are Rishabh's** —
  never fabricate, generate, or hotlink images. **None of the three blocks F0**, which renders no
  driver, team or race content and ships a typographic favicon placeholder

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
