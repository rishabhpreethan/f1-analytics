# F1 Analytics — Session Context

**Read this fully before doing anything.** Two agents build this project; the main session coordinates.

---

## 1. What this is

A Formula 1 analytics web application for enthusiasts — driver/team/race/circuit analysis, with
comparison across seasons and eras as its centre of gravity. React 19 + TypeScript + Vite, Hono API,
SQLite read-only, GSAP animation, accurate F1 team colours and timing conventions.

**F0 is built and unpushed** on `feat/foundation` — server, `/api/meta`, data layer, 12 routes, landing
page, `CommandDock`, theme, GSAP motion, 236 tests. `main` still holds only the original docs.

---

## 2. Canonical documents

| Doc | Governs |
|---|---|
| `TASKS.md` | **Rishabh's tracker.** A line moves to Done only when work is finished **and pushed**. Nothing else goes in it. |
| `PLAN.md` | Short by design. Agents, flow, non-negotiables, commands. **Start here.** |
| `REQUIREMENTS.md` | What the product must do; **§6 = what the data cannot support** |
| `docs/ARCHITECTURE.md` | Stack, layering, API surface, **§7 security**, budgets. Owned by the senior engineer. |
| `docs/DATABASE.md` | Schema, **§6 canonical queries**, **§7 the 14 traps** |
| `docs/DESIGN_SYSTEM.md` | Visual language, motion, chart conventions. Owned by the designer. |
| `docs/archive/PLAN-F0-archive.md` | The old 5285-line plan, verbatim. **Never read whole** — only to recover the reasoning behind one specific decision. |

If code and a document disagree, that is a **defect**, not a preference. Resolve which is wrong.

---

## 3. Two agents — that is the whole team

**Restructured 2026-08-06.** The project ran five agents passing documents between them. Most of its
worst defects were **translation losses at those boundaries** rather than errors in anyone's own work,
and `PLAN.md` had grown to 5285 lines that every dispatched agent paid to read. Both problems had the
same fix: fewer agents, fewer handoffs, less context.

| Agent | Owns |
|---|---|
| **`designer`** | Everything visual — `src/styles/**`, presentational components, feature surfaces, `src/lib/motion/**`, `docs/DESIGN_SYSTEM.md`. **Designs *and* builds it**, with tests. |
| **`developer`** — a **senior software engineer** | Everything else — `server/**`, `src/features/meta/**`, `src/lib/api.ts`, schemas, queries, routing, build config, `docs/ARCHITECTURE.md`. **Plans its own work, then implements it.** |

**⛔ RETIRED — do not dispatch:** `principal-engineer`, `orchestrator`, `reviewer`, `qa`. Their
definitions survive behind banners in `.claude/agents/` so they can be revived.

**The handle is still `developer`** even though the role is senior engineer — that is the dispatch name.

### How work flows

```
1. designer and/or developer  → plan + build on the feature branch, with tests
2. Rishabh                    → looks at the running app
3. main session               → verify, merge, push, tick TASKS.md
```

No spec gate, no review gate, no QA gate. **The builder is the last automated gate**, and Rishabh's eyes
are the acceptance criterion.

### What that trades away — do not paper over it

The removed review gate caught **five blocking defects that 236 passing tests missed**: a pointer
spotlight written in `%` instead of `px` so it rendered outside its card; an entrance animation replaying
on every hover; a motion a comment claimed existed but nothing implemented; an indicator that snapped
instead of travelling; a chart axis 130 px out of line with its bars.

**Green tests and clean types do not mean the screen is right.** jsdom performs no layout and no
compositing, so position, size, timing and visual composition are untested by construction. **Name what
you have not seen work.** Never report a visual behaviour as working on the strength of a passing test.

### Briefing rules — these control the credit burn

- **Name the exact sections to read.** "Read `PLAN.md`" is not an assignment.
- **Carry verified state into the brief** — HEAD, tree status, command output — so nothing is re-derived.
- **One agent with a precise brief** beats a chain each rebuilding the same context.
- Small doc edits are done by the main session, not delegated.

### Two traps that have already produced false greens

1. **Bare `npx tsc --noEmit` checks nothing.** The root `tsconfig.json` is a solution file with
   `"files": []` — it exits 0 always, and once hid 12 real errors. Use **`npm run typecheck`**.
2. **`cmd | tail` reports the pipe's exit status, not the command's.** When the result matters, use
   `if npm run typecheck > log 2>&1; then …`.

Also: **run the test suite 3 times.** It shipped flaky once — passing on one run, 4 failures the next.

---

## 4. Hard constraints — violating these blocks a merge

### 4.1 *(removed — number retained, never reused)*

The upstream-attribution constraint and its blocked-terms check were **removed on 2026-08-04**
(`ARCHITECTURE.md` §10 entry 20; reasoning archived in `docs/archive/PLAN-F0-archive.md`). Rishabh is making the repo private and
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
| **Playwright MCP** | ✅ registered (local project scope), and **available to the main session only.** Its tools are **not propagated into subagent tool sets** — a `designer` run confirmed this: its deferred-tool list held only `WebFetch`/`WebSearch`, and six `ToolSearch` variations returned nothing. So **an agent cannot screenshot anything.** If a visual check is needed, the main session drives the browser, or Rishabh looks. Do not re-add the server; it is registered and connected. |

**Consequence:** no agent can verify anything visual. jsdom performs no layout and no compositing, so
position, size, timing and composition are untested by construction. An agent must **name what it could
not see**, and never report a visual behaviour as working on the strength of a passing test.

---

## 8. Where we are right now

*Last updated 2026-08-06. Correct this whenever it drifts — a stale "next action" here has already
misled an agent once.*

- `main` — original foundation docs only. **Nothing since has been pushed.**
- **`feat/foundation` — current branch.** F0 is **built**: server, `/api/meta`, read-only SQLite, data
  layer, 12 routes, landing page, `CommandDock`, theme, GSAP motion. **236 tests / 29 files**,
  typecheck / lint / `format:check` / build clean, bundle **161.86 KB gzipped** (65% of the 250 KB
  budget). Missing-database gives a clear console message and a `503` with no stack trace or path in
  the body.
- **GSAP replaced `framer-motion`.** Importing `framer-motion` is a **defect**. Measured, gzipped:
  core+ScrollTrigger+SplitText **47.7 KB** vs `framer-motion`'s **40.8 KB** — so **+6.9 KB**. The
  earlier "the bundle goes down" claim came from a web search and was **wrong**; the swap was kept on
  ~90 KB of headroom, not on size.
- **`/` is the landing page; the season hub is `/seasons`**, no redirect either way.
- **Accent is magenta** — `#D1018A` light / `#FE02A9` dark, hue 350, derived by scanning all 360°
  against 12 brand + 3 timing + 4 status colours. Purple, green and yellow are **reserved timing
  semantics** and can never be the accent.

### ➡️ Open work — the three things Rishabh rejected

He ran the app and found these himself. All three are the `designer`'s, since it now builds what it
designs:

1. **The background.** He does not like it. Replacement delegated to Claude. The orbs are the prime
   suspect and were the `designer`'s own predicted risk. A tiled `radial-gradient` dot field is the
   steer — CSS-composited only, contrast **re-measured** with `scripts/validate-palette.mjs`, and note
   the contrast plate exists only because text over the orb field fell to 2.64:1.
2. **The dock rail, both states.** Root cause confirmed: **no rule hides `.dock-label` at
   `[data-expanded='false']`**, so full-size labels overflow a 64 px `overflow: hidden` box and clip
   mid-word — `Hor`, `Seas`, `Driv`. Separately, **hovering it did nothing** in a real browser test
   (before/after screenshots pixel-identical) — undiagnosed. Its vertical geometry is also an accident:
   a floating box at 235→660 px in a 900 px viewport, neither full-height nor centred.
3. **The `2026 · R10` coverage chip.** He could not tell what it was. Its accessible name is fine but
   nothing *visible* carries the meaning — no label, no icon, no hint it opens a popover. Whether the
   popover is also functionally broken is **unconfirmed**; he may simply never have discovered it was
   clickable.

A partial background rewrite was **discarded** on 2026-08-06 — it had removed `dist.parallax` while
`interactions.ts` still used it, leaving typecheck red. The tree is green at HEAD.

### Assets — Rishabh's, never fabricate

R1 driver images · R2 team logos · R3 app icons. **Never generate, fabricate or hotlink images.** None
blocks current work: no driver, team or race imagery renders yet, and a typographic favicon placeholder
ships meanwhile.

### Historical decisions

The upstream-attribution constraint was **removed** 2026-08-04 — §4.1 is a tombstone. Do not reinstate
it, re-extend the blocklist, or raise it. Reasoning for any older decision is in
`docs/archive/PLAN-F0-archive.md`; read a section, never the file.

**2026 has 22 numbered rounds, not 24** — 24 calendar rows, 2 cancelled carrying `number IS NULL`
(Bahrain 2026-04-12, Saudi Arabian 2026-04-19). A season's round count is `max(number)`, **never
`count(*)`** (`docs/DATABASE.md` trap 15). ✅ **Corrected in the docs 2026-08-06** and verified by query;
the code was always right. Do not "correct" it back.

Still open: team logos where brand colours collide is an accepted idea for F1.

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
