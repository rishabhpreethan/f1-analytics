# Plan

**Short on purpose.** The previous version reached 5285 lines, and every agent that opened it paid for
all of it. That cost credits and caused translation loss. It is archived verbatim at
`docs/archive/PLAN-F0-archive.md` — read it only when you need the history of a specific decision, and
never whole.

Rishabh's own tracker is **`TASKS.md`**. It is updated only when work is done **and pushed**.

---

## 1. What this is

A Formula 1 analytics web app for enthusiasts — driver, team, race and circuit analysis, with
cross-era comparison as its centre of gravity. React 19 + TypeScript + Vite, Hono API, SQLite
read-only, GSAP animation, Tailwind v4.

## 2. The two agents

| Agent | Owns |
|---|---|
| **`designer`** | Everything visual: `src/styles/**`, presentational components, feature surfaces, `src/lib/motion/**`, `docs/DESIGN_SYSTEM.md`. **Designs _and_ builds it**, and writes tests for it. |
| **`developer`** — a **senior software engineer** | Everything else: `server/**`, `src/features/meta/**`, `src/lib/api.ts`, schemas, queries, routing, build config, plus the architecture decisions the retired `principal-engineer` used to make. Owns `docs/ARCHITECTURE.md`. |

**Retired, dormant, do not dispatch:** `principal-engineer`, `reviewer`, `qa`, `orchestrator`. Their
definitions survive in `.claude/agents/` behind ⛔ banners so a CR can revive them.

**Coordination is the main session's job** — assigning scope, verifying evidence, merging, pushing.

## 3. How work flows

```
1. designer and/or developer  → build it on the feature branch, with tests
2. Rishabh                    → looks at the running app
3. main session               → verify, merge, push, tick TASKS.md
```

That is the whole process. There is no spec gate, no review gate, no QA gate. What replaced them:

- **The builder writes its own spec** only where a decision needs to outlive the session — a short
  note in the feature's own doc, not a chapter here.
- **The builder is the last automated gate.** Nothing catches its mistakes before a human sees them.
- **Rishabh's eyes are the acceptance criterion.**

**Known cost, stated plainly:** the removed review gate caught five blocking CR-007 defects that 236
passing tests missed — a pointer spotlight written in `%` instead of `px` so it rendered outside its
card, an entrance animation replaying on every hover, a motion a comment claimed existed but nothing
implemented, an indicator that snapped instead of travelling, and a chart axis 130 px out of line.
**Green tests and clean types do not mean the screen is right.** Say what you have not seen work.

## 4. Non-negotiables

Full detail lives in the docs named; this is the index, not the content.

| | |
|---|---|
| **Data traps** | `docs/DATABASE.md` §7 — 14 of them. Points are not summable across eras. `has_time_data` is unreliable. Practice data is empty. Lap data 1996+, pit stops 2011+, qualifying 1994+. Every `lap` query bounded. |
| **Charts** | `docs/DESIGN_SYSTEM.md` §3.2 — brand colours **fail** as a categorical palette (measured). Never a dual-axis chart. Comparison caps at 4. Purple/green/yellow are reserved timing semantics. |
| **Security** | `docs/ARCHITECTURE.md` §7. Read-only, no auth, no mutations, no third-party calls. The builder self-checks **S-4** input validation, **S-6** error hygiene, **S-7** `npm audit`, **S-10** query bounds. |
| **Database** | `data/f1.db` is gitignored, opened read-only, never committed. A fresh clone must fail with a clear actionable error. |
| **Budget** | Initial chunk **< 250 KB gzipped**, measured. Currently 161.86 KB. |
| **Motion** | GSAP only — `framer-motion` is removed and importing it is a defect. `useGSAP()` never `useEffect`. Reduced motion genuinely **stopped**, not slowed. No raw duration/ease/distance literals. |

## 5. Commands that matter

```bash
npm run dev              # api :8787 + web :5173
npm run typecheck        # tsc -b --noEmit  — NEVER bare `npx tsc --noEmit`, see below
npm run lint
npm run format:check
npm test                 # run it 3 times; the suite shipped flaky once
npm run build            # report the gzipped figure
npm run validate:palette # whenever colour moves
```

**Two traps that have already produced false greens:**

1. **Bare `npx tsc --noEmit` checks nothing.** The root `tsconfig.json` is a solution file with
   `"files": []`. It exits 0 always, and once hid 12 real errors. Use `npm run typecheck`.
2. **`cmd | tail` reports the pipe's exit code, not the command's.** Use
   `if npm run typecheck > log 2>&1; then …` when the result matters.

## 6. Features

`F0` foundation · `F1` design system · `F2` season hub · `F3` race page · `F4` drivers · `F5` teams ·
`F6` circuits · `F7` compare · `F8` records. One branch each, `feat/<slug>`. Status lives in
`TASKS.md`.

**F0 is built and unpushed** on `feat/foundation`: server, `/api/meta`, data layer, 12 routes, landing
page, `CommandDock`, theme, GSAP motion. **281 tests.** The background replacement, the coverage chip's
legibility, the capability-card hover and both rounds of the rail's formatting are all landed.
Outstanding: nothing from Rishabh's run of the CR-007 build. Not yet seen by him: the rail's second
round (header clearance, glyph lane, pin affordance) — see `DESIGN_SYSTEM.md` §7.8.0 faults 4–6.

## 7. Changes

Rishabh asks, we build. **No CR numbers, no impact assessments, no gate records** — that machinery is
what made the old plan 5285 lines. Record a decision only where code alone would not explain it, in the
doc that owns the subject.

Decisions worth remembering, with their reasoning archived:

| | |
|---|---|
| Provenance constraint | Removed. Do not reinstate. |
| GSAP replaced `framer-motion` | Measured: core+ScrollTrigger+SplitText 47.7 KB vs 40.8 KB, so **+6.9 KB** — the "smaller bundle" claim was wrong, and it was kept on ~90 KB of headroom, not on size. |
| `/` is the landing page | Season hub is `/seasons`, no redirect. |
| ~~Accent is magenta~~ **Accent is monochrome** | Superseded 2026-08-06 at Rishabh's request — *"no purple accent, i want the accent to be a color of white/black"*. It is now the pole of the neutral scale: `#08090C` light / `#FFFFFF` dark, and the whole `--signal-*` hue-350 ramp is deleted from the product. Emphasis is carried by inversion, absolute contrast, weight and motion, which measure 3.6–5.5× more separation than the magenta they replace (`DESIGN_SYSTEM.md` §3.6, §9.2.2 V-18). The magenta derivation is kept in §9 V-10…V-17 for the record only. |
| Background is CSS-composited | No canvas, no WebGL — the main thread must stay free for F2's charts. |
| The rail starts **below** the header | Not at the viewport top, and not fixed by a z-index swap. It expands to 248px over content, so a full-height rail with a padded header would lose the wordmark every time it opened; `top: calc(--size-header + --size-dock-inset)` is the only geometry that holds at every rail width. `DESIGN_SYSTEM.md` §7.8.3. |
