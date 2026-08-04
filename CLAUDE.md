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

### 4.1 Provenance silence (release blocker)

**Never reference how the dataset was assembled** — not in code, comments, docs, test names,
fixtures, commit messages, branch names, or PR text. The repo is **public**.

The blocked terms live in `private/provenance-blocklist.txt` (gitignored, so the terms never appear
in the repo). Check with:

```bash
grep -rniE -f private/provenance-blocklist.txt . \
  --exclude-dir=node_modules --exclude-dir=private --exclude-dir=data --exclude-dir=.git \
  && echo "LEAK — BLOCKING" || echo "clean"
```

### 4.2 The database is an input, never an artefact

- `data/f1.db` (~66 MB) is **gitignored**. Never commit it or any raw seed file.
- A fresh clone has no database. The missing-DB case must give a clear actionable error.
- Opened **read-only**. The application never writes. Any write path is a defect.
- `private/` holds local-only seed tooling and provenance notes — **gitignored, never committed**.

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
| Node | v20.18.2 (`node:sqlite` unavailable — hence `better-sqlite3`) |
| Database | ✅ `data/f1.db` present — 19 tables, 717,764 laps, results through **2026 R10** |
| Git remote | `github.com/rishabhpreethan/f1-analytics` — **public** |
| GitHub auth | must be active as `rishabhpreethan`; the `rishabh-zupple` account has read-only access here |
| **Playwright MCP** | ⚠️ **check if registered.** Required by `designer` (gate 4) and `qa` (gate 9). Add with: `claude mcp add playwright -- npx -y @playwright/mcp@latest` |

If Playwright MCP is missing, `designer` and `qa` must **stop and report** — never work around it.

---

## 8. Where we are right now

- `main` — foundation docs + agent definitions, pushed
- **`feat/foundation` — current branch.** F0 is started; tracker says `Spec in progress`
- **Next action: the `orchestrator` dispatches F0 gates 1 and 2 in parallel** — the assignment
  briefs are already written in `PLAN.md`, F0 section, under **Assignment Briefs**
- R0 (database) ✅ done. **R1 (driver images) and R2 (team logos) are Rishabh's** — never fabricate,
  generate, or hotlink images

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
