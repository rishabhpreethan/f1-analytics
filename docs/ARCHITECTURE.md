# Architecture

**Authoritative technical design.** The **senior software engineer** (`developer`) owns this document,
decides what goes in it, and implements against it — the roles that used to be split across a
`principal-engineer` who wrote it and a `reviewer` who enforced it were retired on 2026-08-06 (§10 #25).
A deviation is an amendment to this file **in the same commit as the code**, never an undocumented
exception. There is no review gate behind it, so nothing else will catch the drift.

Role names appearing in §10 entries 1–24 (`principal-engineer`, `reviewer`, `qa`, `orchestrator`) are
**historical** — they name who held the job when the decision was recorded. Read them as "whoever does
that job", which since 2026-08-06 is the senior engineer for everything non-visual and the `designer`
for the visual layer.

---

## 1. Shape of the system

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Browser — React SPA                                                     │
│                                                                          │
│  routes/            pages, one per feature surface                       │
│  components/        presentational + chart primitives                    │
│  features/          feature-scoped hooks, selectors, chart configs        │
│  lib/               design tokens, formatters, colour resolution         │
│                                                                          │
│         TanStack Query  ── caches every server response                  │
└───────────────────────────┬──────────────────────────────────────────────┘
                            │  HTTP  /api/*   (JSON, read-only, GET only)
┌───────────────────────────┴──────────────────────────────────────────────┐
│  API server — Hono on Node                                               │
│                                                                          │
│  routes/            one module per resource, thin                        │
│  queries/           ALL SQL lives here. Parameterised. Named exports.    │
│  schemas/           Zod response schemas, shared with the client         │
│  cache/             in-process memoisation for aggregates                │
└───────────────────────────┬──────────────────────────────────────────────┘
                            │  better-sqlite3, opened READONLY
┌───────────────────────────┴──────────────────────────────────────────────┐
│  data/f1.db — SQLite, 66 MB, pre-seeded, gitignored, never written       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Why a server at all

The database is 66 MB. Shipping it to the browser (sql.js / wa-sqlite) is not viable on mobile
data, and lap queries over 717k rows want a real query planner. The server exists solely to turn
SQL into JSON.

### Why the API is GET-only

The product is read-only (`REQUIREMENTS.md` §1.1). There is no auth, no session, no mutation, no
user data. This is a deliberate security posture, not an omission — see §7.

---

## 2. Stack — decided, not open

| Concern | Choice | Rationale |
|---|---|---|
| Language | **TypeScript**, `strict: true` | Non-negotiable. `@typescript-eslint/no-explicit-any` and `no-non-null-assertion` are `'error'`, so `any` fails `npm run lint` — mechanically, not by someone noticing. |
| Client | **React 19** + **Vite** | Required by the brief. Vite for dev speed and build output. |
| Runtime | **Node 22 LTS**, floor `>=22.22.0` | See §2.1. Set by `react-router@8`; keeps the toolchain on current majors and the audit clean. |
| Routing | **React Router v8** (declarative mode) | URL-addressable state is a hard requirement (NV-4). v8 is the audit-clean line; declarative mode is unchanged from v7, and all APIs used are exported from `react-router` itself. |
| Server data | **TanStack Query v5** | Cache, dedupe, background refetch, loading/error states. Server data is not app state — never mirror it into a store. |
| API server | **Hono** on Node 22+, with **`@hono/node-server`** | Tiny, TS-first, fast. No framework weight needed for GET-only JSON. Hono is runtime-agnostic, so the Node adapter is a required companion, not an optional extra; it also supplies the `conninfo` helper (S-13) and `serve-static`. |
| DB driver | **better-sqlite3**, `readonly: true` | Synchronous; for a local file this beats a pool. |
| Validation | **Zod** | One schema per response, shared client/server. Types derive from schemas. |
| Charts | **No charting library.** Maths primitives — `d3-scale`, `d3-shape`, `d3-array`, `d3-time-format` (all ISC, zero install scripts) — plus an in-repo SVG chart kit. **Recharts and visx are both rejected**, superseding §10 #3. | §10 #28, §4. Measured on this machine: our own Recharts import surface is **121.72 KB gz**, and even a five-component subset is **104.97 KB** against **89.75 KB** of remaining initial-JS headroom, because Recharts 3 has Redux Toolkit as a runtime dependency. visx is 29.96 KB and is `@visx/vendor` — the same d3 modules — plus React wrappers. The primitives are **16.33 KB**. Not installed until the first chart lands (F2). |
| Motion | **GSAP 3** (`gsap`) + **`@gsap/react`** for the `useGSAP()` hook. **`framer-motion` is removed.** | §10 #21 (CR-007). One animation library — shipping two would be an architectural defect. Every tween is created inside `src/lib/motion/`, never in a component; durations and eases come from `src/lib/motion/tokens.ts` and are **GSAP named eases only**, so no cubic-bézier literal exists in this product. |
| Looping / ambient motion | **CSS `@keyframes`**, never GSAP | §10 #22. A `requestAnimationFrame` loop that never ends competes with the chart-interaction budget (§8) on the main thread; a composited CSS animation on `transform`/`opacity` does not. This is a mechanism split, not a second library. |
| Styling | **Tailwind CSS** + CSS custom properties for tokens | Tokens in CSS vars so both Tailwind and chart libraries read the same values. |
| Fonts | **Vendored `woff2` in `public/fonts/`** — Archivo, Inter, Chivo Mono. **No npm font package, and a font CDN is forbidden.** | §10 #17. Stable preload URLs and `@font-face` family names that match the design tokens. Self-hosted is a hard requirement (DL-2, S-9) — `font-src 'self'` enforces it in the browser. |
| Icons | **Eleven inline SVGs** in `src/components/ui/icons.tsx`, Lucide geometry under ISC. **`lucide-react` is not a dependency.** | §10 #18. One icon set; a second one is a defect (`DESIGN_SYSTEM.md` §2.5). New glyphs are added to that file from the same source — never hand-drawn. |
| Client state | **URL first**, then `useState` | No Redux/Zustand. If it belongs in a link, it belongs in the URL. |
| Tests (unit) | **Vitest** | The only automated test layer in the project. |
| Tests (E2E) | **None.** No Playwright, no `e2e/`, no dependency. | §10 #25. The `qa` agent and its E2E gate were retired on 2026-08-06 and **nothing replaced them** — Rishabh reviews the running app himself. Do not add an E2E suite to fill the gap without a new §10 entry; a half-maintained browser suite is worse than a stated absence. |
| Lint/format | **ESLint** + **Prettier** | |

**Nothing else gets added without a decision recorded in §10** — by the senior engineer, who owns this
document. That includes a dependency the `designer` needs: it reports the need, the senior engineer
vets licence, install scripts, `npm audit` and measured gzipped cost, and records the outcome here.

### 2.1 Runtime floor — `node >= 22.22.0`

**One number, and it is enforced mechanically**, not by convention: `package.json` `engines` plus a
committed `.nvmrc`. The earlier per-package version-floor table is retired — on Node 22 the whole
toolchain sits on current majors, so there is nothing left to tabulate.

`22.22.0` is the highest floor any direct dependency declares (`react-router@8.3.0`), and it also
satisfies `eslint@10`'s `^22.13.0`. Recommended install: **v22.23.2** (Latest LTS "Jod").

Verified 2026-08-04 by resolving the full set: **320 packages · `npm audit` → 0 vulnerabilities · 0
of 320 packages exclude Node 22.22.0** (checked with `semver.satisfies` across every resolved
`engines.node`, not merely from `npm`'s warnings). Evidence in
`docs/archive/PLAN-F0-archive.md` → F0 Technical Spec §0.1.

**One exception to "current majors": `typescript` stays `~5.9.3`.** TypeScript 7 is a hard
`ERESOLVE` failure against `typescript-eslint@8.66.0`, whose peer range is `>=4.8.4 <6.1.0`; no v9 is
published and the canary caps identically. Type-aware lint rules are not optional here — §2 makes
`any` a **lint error**, and with no reviewer left that rule is the only thing catching it — so
TypeScript follows `typescript-eslint`, not the other way round. Revisit when `typescript-eslint`
ships TypeScript 7 support.

---

## 3. Layering rules

There is no review gate (§10 #25): these are enforced by the engineer making the change, and
mechanically wherever a rule can be — `no-restricted-imports` for the `gsap` chokepoint, the
`@schemas/*` alias for the zod-only rule, `npm run validate:palette` for colour. Each rule exists
because breaking it has a specific cost.

**Who writes which layer** is in `PLAN.md` §2 and is deliberately not duplicated here. The one
consequence worth stating in this file: the `designer` owns the presentational layer but **not** the
data reaching it, so a new selector, API field or route is the senior engineer's work even when the
`designer` is the one who needs it. That boundary sits exactly where a data trap gets violated
silently.

| Rule | Why |
|---|---|
| **SQL exists only in `server/queries/`.** | One place to audit for injection, performance, and the §7 traps in `DATABASE.md`. |
| **Every query is parameterised.** No string interpolation into SQL, ever. | Injection. Non-negotiable even though input is "just" a year. |
| **Route handlers contain no business logic.** | Handlers validate input, call a named query, return. Logic lives in queries or client selectors. |
| **Components never fetch.** | Fetching lives in feature hooks (`useSeasonStandings`). Components take props. |
| **Chart components never query.** | They take shaped, chart-ready data. Shaping lives in feature selectors, which are pure and unit-testable. |
| **No derived server data in client state.** | TanStack Query owns it. Mirroring causes staleness bugs. |
| **Colour resolution goes through one module** (`lib/teamColor.ts`). | 202 of 214 teams have no brand colour, and brand colours collide. See `DESIGN_SYSTEM.md` §3. |
| **Formatters are centralised** (`lib/format.ts`). | Lap times, gaps, dates, ordinals must be identical everywhere. |
| **`server/schemas/*` may import only `zod`.** No `node:*`, no `better-sqlite3`, no query modules. | These modules are shared with the client via the `@schemas/*` alias. One server-only import breaks the browser bundle. |
| **The canonical views are created once, in `server/db.ts`.** No feature re-derives a join path. | `DATABASE.md` §6.1 is the single definition; see §10 #7 for how it is created against a read-only connection. |
| **Client fetch paths are relative and typed `/api/${string}`.** | Makes a third-party call a **compile error** rather than something a reader has to spot (DL-2). |

---

## 4. Charting strategy

**One substrate, and it is not a charting library.** Scales, path generation, tick selection and
binary search come from four ISC d3 modules; everything that renders is ours, in
`src/components/charts/`. Decided 2026-08-07 on measurement and on constraint fit — §10 #28 has
the full vetting record and the alternatives rejected. This **supersedes** the Recharts/visx split
of §10 #3.

| Layer | What | Where it comes from |
|---|---|---|
| Scales, ticks, `nice()` | `d3-scale`, `d3-array` | dependency. The tick-step algorithm (`e10`/`e5`/`e2` step selection, and time-axis tick choice across day/month/year boundaries) is subtle, and an axis reading 1950–2026 with ugly ticks is a visible defect. Not worth reimplementing. |
| Path and symbol generation | `d3-shape` | dependency. Line, area, curve interpolation, and the symbol shapes that carry the mandatory secondary encoding. |
| Date tick formatting | `d3-time-format` | dependency. |
| Axes, grid, legend, tooltip, crosshair, hit-testing, responsive sizing, table view | **written here** | We have to author all of these anyway: `DESIGN_SYSTEM.md` §6 requires one tooltip component, tokens rather than library defaults, a table view for every chart, and dark mode designed rather than flipped. A library supplies versions of each that we would then override. |

**Why not the obvious middle ground.** visx *is* primitives — and `@visx/vendor` is a re-export of
the very same d3 modules, with the `@types/d3-*` packages as **runtime** dependencies. It costs
29.96 KB gz against the primitives' 16.33 KB for the same capability, brings `d3-geo` and
`d3-delaunay` we do not use, and reaches `reduce-css-calc@1.3.0` → `math-expression-evaluator@1.4.0`
through `@visx/axis` → `@visx/text`. The delta buys React wrappers over things we are writing
regardless. A single `@visx/*` package may still be adopted later for a specific, named need — that
is a §10 amendment, not a free choice.

**Rendering: SVG, until a browser measurement says otherwise for a specific chart.** The race
position chart is 20 drivers × ~70 laps ≈ 1,400 marks; if those are 1,400 DOM nodes with per-lap
hit-testing, SVG may not hold the §8 "< 100 ms interaction" budget. Two things follow, and the
second is the honest part: a line series renders as **one `<path>` per driver**, not one node per
point, which is what keeps the node count near 20 rather than 1,400; and **no Canvas threshold is
stated here, because paint cost is not observable in this pipeline** — jsdom performs no layout and
no compositing, so any number written here would be invented. Moving a chart to Canvas is a §10
amendment carrying the browser measurement that justified it.

**The invariants become type errors, not conventions.** This is the main reason the kit is worth
writing rather than configuring. The chart frame takes exactly **one** y-scale, so a dual-axis chart
is not expressible — where `<YAxis yAxisId="right">` is always one line away in Recharts. Series
colour is resolved from the entity's identity through `lib/teamColor.ts` and there is no
index-into-a-palette path, so colour cannot follow rank. Every series carries a required non-colour
channel (dash pattern or symbol), so an unencoded series does not compile. Each of these is a rule
in the list below that would otherwise depend on the person writing the chart remembering it, with
no review gate behind them (§10 #25).

**Ownership.** The kit in `src/components/charts/` is presentational, so the **`designer`** builds
it — with the cost stated plainly: choosing primitives moves roughly an axis, a legend, a tooltip
and a responsive wrapper from `node_modules` into this repository, and that work lands on the
`designer`, not on the senior engineer. The **selectors that shape data into chart-ready form** are
the senior engineer's (§3: chart components never query, selectors are pure and unit-testable), and
so is the dependency decision itself.

**Tokens.** The source of truth is **`src/styles/tokens.css`** (§2: tokens live in CSS custom
properties). Chart code needs JS values, so a **`src/lib/tokens.ts`** bridge that *reads* the
computed custom properties lands with the first chart — it must never carry its own copy of a hex
value, for the same reason `scripts/validate-palette.mjs` does not (§10 #19).

**Hard chart constraints** (from the visualization method; the engineer building the chart is the
only thing enforcing the ones the types cannot, so read them before starting rather than after):

- **Never a dual-axis chart.** Two measures of different scale → two charts, small multiples, or
  index both to a common base.
- **Colour follows the entity, never its rank.** Changing a filter must not repaint the survivors.
- **Categorical colours are assigned in fixed order, never cycled.**
- **Legend always present for ≥ 2 series**; ≤ 4 series are also directly labelled, so identity is
  never colour-alone.
- **Crosshair + tooltip on every line/area chart; per-mark tooltip on bar/dot/cell.**
- **A table view exists for every chart** (accessibility and the contrast-relief obligation).
- **Dark mode is designed, not flipped.**

**Hard chart constraints** (from the visualization method; the engineer building the chart is the only
thing enforcing them, so read them before starting rather than after):

- **Never a dual-axis chart.** Two measures of different scale → two charts, small multiples, or
  index both to a common base.
- **Colour follows the entity, never its rank.** Changing a filter must not repaint the survivors.
- **Categorical colours are assigned in fixed order, never cycled.**
- **Legend always present for ≥ 2 series**; ≤ 4 series are also directly labelled, so identity is
  never colour-alone.
- **Crosshair + tooltip on every line/area chart; per-mark tooltip on bar/dot/cell.**
- **A table view exists for every chart** (accessibility and the contrast-relief obligation).
- **Dark mode is designed, not flipped.**

---

## 5. Routing and URL contract

Every analytical state is addressable. Slugs, never internal ids (`DATABASE.md` §2.2).

| Route | Surface |
|---|---|
| `/` | **Landing** — the first surface a visitor sees (NV-3). Amended by CR-007, §10 #23 |
| `/seasons` | Season hub — current season by default. **Moved here from `/` by CR-007** |
| `/seasons/:year` | Season hub for a year |
| `/seasons/:year/races/:round` | Race deep dive |
| `/drivers` | Driver index |
| `/drivers/:driverRef` | Driver profile |
| `/teams` | Team index |
| `/teams/:teamRef` | Team profile |
| `/circuits` | Circuit index |
| `/circuits/:circuitRef` | Circuit profile |
| `/compare` | Comparison workspace |
| `/records` | Records & cross-era leaderboards |

**Twelve routes plus the `*` catch-all** (eleven before CR-007). There is **no redirect** from `/` to
`/seasons` and none from `/seasons` to `/`: `/` did not move, it changed meaning, and nothing outside
this repository has ever linked to it. A redirect would only hide the change from the one reader who
needs to see it. `/seasons` renders the same component as `/seasons/:year` with the year resolved from
`/api/meta`, so the two are one surface with two entry points, not two implementations.

**Comparison state lives entirely in the query string** so any comparison is shareable:

```
/compare?kind=driver&e=max_verstappen,lando_norris&from=2023&to=2026&metric=points&view=perRound
```

| Param | Meaning |
|---|---|
| `kind` | `driver` \| `team` |
| `e` | comma-separated slugs, **max 4** (§4 direct-label rule) |
| `from`, `to` | inclusive season range |
| `metric` | `points` \| `position` \| `wins` \| `podiums` \| `quali` \| `pace` \| `reliability` |
| `view` | `perRound` \| `perSeason` \| `cumulative` \| `h2h` |

Invalid params degrade to defaults with a visible notice — never a blank page, never a crash.

---

## 6. API surface

Read-only JSON. Every response Zod-validated on the way out; the client derives its types from the
same schemas.

| Endpoint | Returns |
|---|---|
| `GET /api/meta` | data vintage, latest completed round, available season range |
| `GET /api/seasons` | ✅ **F2** — all 77 seasons: numbered round count, completed, cancelled, whether a constructors' championship existed |
| `GET /api/seasons/:year` | ✅ **F2** — calendar (winners, sprint and lap-data flags per round), cancelled rounds as a separate list, current/final driver + team standings, and the season's championship-scoring rules |
| `GET /api/seasons/:year/standings` | ✅ **F2** — driver + team progression, **one point per round**, ordered by final standing |
| `GET /api/seasons/:year/races/:round` | classification, session list, weekend metadata |
| `GET /api/seasons/:year/races/:round/laps` | lap traces (positions + times), invalid laps excluded |
| `GET /api/seasons/:year/races/:round/stints` | pit stops + derived stint boundaries |
| `GET /api/drivers` | index with search fields |
| `GET /api/drivers/:ref` | profile, career totals, season-by-season |
| `GET /api/teams` , `GET /api/teams/:ref` | as above for teams |
| `GET /api/circuits` , `GET /api/circuits/:ref` | venue + race history |
| `GET /api/compare` | driver/team comparison for a metric over a season range |
| `GET /api/records/:metric` | normalized cross-era leaderboards |

**Conventions**
- Errors: `{ error: { code, message } }`. No stack traces, no SQL, no file paths (§7).
- `404` for unknown slug, `400` for invalid param, `500` only for genuine faults.
- Aggregate endpoints send `Cache-Control` — the dataset is immutable between refreshes.
- Lap endpoints support optional `?drivers=` and `?fromLap=&toLap=` narrowing.

**Four conventions settled in F2, when the first parameterised route landed.** They are written
here rather than left in one route file, because the next resource will copy whatever it finds.

1. **A path parameter is validated as the string it arrived as, then parsed. Never
   `z.coerce.*`.** `:year` is `z.string().regex(/^\d{4}$/).transform(Number).pipe(...)`. Coercion
   accepts `''` as 0, `' 1990 '`, `'1990.0'` and `'0x7c6'` as 1990 — four spellings of one
   resource and one soft 404 (S-4: reject, do not coerce). Slug parameters follow the same shape
   with their own pattern.
2. **`400` and `404` answer different questions and must stay different.** A malformed parameter
   is a 400; a *well-formed* one the dataset does not hold — year 2027, an unknown driver slug —
   is a 404. Collapsing them tells a reader who typed a real year that they made a syntax error.
   The range in the parameter schema is therefore the format's range (1950–2100), not the data's.
3. **An error body never echoes the value that caused it.** Every message comes from
   `ERROR_MESSAGES`, so `/api/seasons/1990'--` cannot put a SQL fragment on a page (S-6).
   `server/routes/seasons.test.ts` asserts this on the exact byte.
4. **In-process memoisation is for payloads that are global, small and requested on every
   navigation.** `/api/seasons` (8 KB) is memoised; `/api/seasons/:year` (13–23 KB) and
   `/api/seasons/:year/standings` (18–48 KB) are **not**, measured: 2.5–4.1 ms warm against a
   50 ms p95 budget, where caching them would retain up to ~15 MB of JSON across the parameter's
   bounded key space. The HTTP `Cache-Control` still covers the repeat-visit case. Revisit with a
   measurement, not an intuition.

---

## 7. Security posture

There is no auth, no user input persisted, no PII, and no mutation. That eliminates most of the
usual surface — which makes the remaining items the ones that actually matter.

**Who checks this, since the `reviewer` was retired (§10 #25):** the engineer making the change
self-checks **S-4** (input validation), **S-6** (error hygiene), **S-7** (`npm audit` / lockfile /
no unvetted dependency) and **S-10** (query-cost bounds) on **every** change, and states a verdict on
each in its hand-off. The remaining items cannot fail in a read-only app with no auth and are not
re-verified per change — **but a diff that genuinely touches one must check it and say so**: a new
query touches S-1, a header change touches S-9, a filesystem path touches S-2, a dependency touches
S-14.

| # | Control | Requirement |
|---|---|---|
| S-1 | **SQL injection** | Every query parameterised. No template-literal SQL. No dynamic column/table names from user input. Sort/filter params validated against an allowlist. |
| S-2 | **Path traversal** | The database path is a server constant. No user input reaches the filesystem. No static file serving from user-supplied paths. |
| S-3 | **Read-only enforcement** | Connection opened `readonly: true`. Any write attempt throws. |
| S-4 | **Input validation** | Every route param and query param Zod-parsed before use. Reject, don't coerce silently. Bound `limit`. |
| S-5 | **No secrets in the repo** | Nothing to leak, and it stays that way. `.env` gitignored. No API keys in client bundles. CI must fail on a committed secret. |
| S-6 | **Error hygiene** | No stack traces, SQL text, or absolute paths in any response. Generic messages to the client, detail to server logs only. |
| S-7 | **Dependency hygiene** | `npm audit` clean of high/critical. Lockfile committed. No unvetted transitive additions. |
| S-8 | **XSS** | No `dangerouslySetInnerHTML`. Any external string (Wikipedia URLs) validated as `https:` before becoming an `href`. `rel="noopener noreferrer"` on external links. |
| S-9 | **Headers** | CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`. CSP must not require `unsafe-inline` for scripts. |
| S-10 | **DoS via query cost** | Lap endpoints must bound the result set. An unbounded `lap` query is both a performance and availability defect. |
| S-11 | **CORS** | Same-origin only. No wildcard. |
| S-13 | **Rate limiting** | Basic per-IP limit on the API to protect the single-process server. |
| S-14 | **Supply chain** | Every new dependency vetted before it lands: licence permits commercial use, **zero install scripts**, measured gzipped cost, `npm audit` clean, and a §10 entry. Versions are pinned by the committed lockfile. (This item previously read "pin the Playwright and MCP tooling used by QA" — there is no Playwright dependency and no `qa` agent; §10 #25.) |

`S-12` was removed by **CR-005** (`docs/archive/PLAN-F0-archive.md` → §5.5 change-request log). Its
number is left as a gap rather than reused, so `S-13` and `S-14` keep their identifiers. The audit is
S-1…S-11 plus S-13…S-14.

### 7.1 S-7 — no exceptions

`npm audit` must report **`found 0 vulnerabilities`**. There is no permitted exception and no
allow-list, so any high/critical finding blocks a merge with no further discussion.

This is worth stating explicitly because it was nearly otherwise. On Node 20 there was no
audit-clean React Router: `≤7.17.0` carried 14 high advisories and `7.18.2` carried
`GHSA-qwww-vcr4-c8h2`, whose fix landed only in 8.3.0 — which needs Node `>=22.22.0`. A scoped,
justified exception was drafted (the advisory affects unstable RSC APIs this product does not use)
and then **discarded in favour of raising the runtime** (§10 #14). Deleting the finding beats
documenting it: an exception is a standing invitation to add a second one.

### 7.2 CORS is enforced by omission

No CORS middleware is registered, so no `Access-Control-Allow-Origin` header is ever sent and
browsers refuse cross-origin reads. That is S-11 satisfied. **Do not add `hono/cors`** — adding it
to "fix" a perceived gap would create the gap.

### 7.3 CSP forbids third-party origins outright

`connect-src 'self'` and `default-src 'self'` mean a stray third-party request fails loudly in the
browser instead of quietly violating DL-2. `script-src` never includes `'unsafe-inline'`; the
pre-paint theme script is therefore an external `public/theme-init.js`, not an inline block.

### 7.4 `style-src-attr 'unsafe-inline'` — the one allowance, and what it costs to remove

The policy in `server/app.ts` is `'self'` everywhere **except** `style-src-attr`, which is
`'unsafe-inline'`. That single allowance is deliberate and **may only be removed on one piece of
evidence: zero CSP violations observed in the production-preview browser console**
(`npm run build && npm run start`), re-verified after removal. A static argument is explicitly **not**
sufficient, because a static argument is what put the wrong reason in the code in the first place
(§10 #26).

Why it is not obviously unnecessary: `gsap/ScrollTrigger.js` calls `_body.setAttribute("style", "")`
on a path reached from `gsap.registerPlugin(ScrollTrigger)` — which runs at module evaluation, so on
**every** page load — and `setAttribute('style', …)` is precisely the form `style-src-attr` governs,
unlike `element.style.x = y`, which CSP does not see. Whether a browser reports a violation for an
**empty** value cannot be determined in Node: jsdom implements no CSP enforcement.

Scope discipline, so this stays one allowance rather than a habit:

- `script-src` and `style-src` must never gain `'unsafe-inline'`. `server/app.test.ts` asserts the
  whole header, so any widening fails the suite rather than passing review by inspection.
- The same file carries a **canary** on the GSAP source. When an upgrade removes that
  `setAttribute` call, the test fails and the message says to re-evaluate this directive — which is
  how the allowance gets revisited instead of inherited forever.
- Verified statically today, and asserted: neither the authored `index.html` nor the built
  `dist/index.html` has an inline `<style>`, an inline `<script>` body or a `style=` attribute, so
  nothing *we* author needs the allowance. The two tests that read `dist/` report as **skipped**
  when `dist/` is absent rather than passing quietly.

---

## 8. Performance budget

| Target | Budget | Enforced by |
|---|---|---|
| Season hub — first contentful paint | < 1.5 s | nothing automated — needs a browser |
| Race deep dive — interactive with lap chart | < 2.0 s | nothing automated — needs a browser |
| Chart interaction (hover, series toggle) | < 100 ms, no network | nothing automated — needs a browser |
| API p95 for any non-lap endpoint | < 50 ms | nothing automated |
| API p95 for a lap endpoint | < 200 ms | nothing automated |
| **Initial module JS, gzipped** | **≤ 250 KB** | `npm run check:budget` |
| **Render-blocking CSS, gzipped** | **≤ 25 KB** | `npm run check:budget` |
| **Parser-blocking `<script src>` in `<head>`, gzipped** | **≤ 2 KB** | `npm run check:budget` |

The first five rows are **aspirations with no mechanism**, and they are marked that way rather
than left to read as guarantees: none of them is observable without a browser, and there is no
browser in this pipeline (§10 #25). The last three are gated — see §8.1.

**Techniques**
- Route-level code splitting; the lap-scale chart kit loads only on the race deep dive.
- Server-side downsampling for the position chart when lap count is large.
- Precomputed aggregate tables for career/all-time surfaces, refreshed with the database.
- TanStack Query cache with a long `staleTime` — the data is immutable between refreshes.
- Virtualise long tables.

### 8.1 The three gated budgets — §10 #27

`npm run check:budget` runs as the last step of `npm run build`, so it fires on the machine
where a change was written and not only in CI. `npm run build:unchecked` skips it, and the
failure output names that hatch — otherwise the first person who needs a build while over
budget deletes the gate instead of using it. Exit codes match the palette validator: `0` pass,
`1` over budget, `2` nothing to measure.

**"Initial" is derived, never listed.** The gate reads the built `dist/index.html` and counts
what the browser must fetch before it can paint: the parser-blocking classic `<script src>`, the
`<script type="module">` entry plus every `<link rel="modulepreload">`, and every
`<link rel="stylesheet">`. Summing "every `.js` in `dist/`" would have been simpler and starts
over-counting the day route-level splitting lands — and a gate that fails for a reason that is
not a regression is a gate that gets switched off.

| Bucket | Budget | Ceiling its basis supports | Basis |
|---|---|---|---|
| `js-initial` | 250 KB | 250 KB | **Inherited, and its basis is written down here for the first time — honestly.** 250 KB is a conventional ceiling for initial JavaScript, **not** a derivation from the 1.5 s FCP row above: at the reference link below, 250 KB alone is 1.25 s of transfer, which does not fit inside 1.5 s. The two rows are reconciled by code splitting, which is also why the gate measures the initial set rather than all of `dist/`. If the initial set approaches 250 KB the honest fix is splitting, not a larger number. |
| `css-blocking` | **25 KB** | 25 KB | **New.** §8 carried no CSS budget at all before 2026-08-07; the 10 KB the `designer` was being held to was a remembered number with no basis, and it had 0.15 KB left. Set from two independent derivations that agree: **(A) proportion** — styling is a support layer, and if it costs more than a tenth of the shipped application it has stopped being one; 10 % of 250 KB = **25 KB**. The ratio is chosen policy, not measurement. **(B) render-blocking transfer time** — a stylesheet blocks first paint, so allot it ≤ 10 % of the 1.5 s FCP target in transfer: 0.15 s × 200 000 B/s = **30 KB**. The tighter is enforced. |
| `js-blocking` | 2 KB | 2 KB | **New**, and separate from `js-initial` on purpose: a synchronous script in `<head>` delays paint by its whole fetch + parse + execute, where a module chunk is deferred by specification. A byte here is worth more than a byte there, so one 250 KB bucket would hide the growth that matters. Holds `public/theme-init.js`, which sets one attribute before first paint. The cap sits close to the current figure deliberately — this is the bucket where growth is the signal. |

**Reference link, for the two derivations that price bytes in milliseconds: 1.6 Mbit/s
downlink = 200 000 bytes/s.** That is an assumption of the calculation, not a measurement of
anyone's connection. If it is wrong, every ceiling derived from it moves in proportion — which
is why the arithmetic is written out here and in `scripts/budget-core.mjs` rather than only the
answer.

**Changing a number.** Each bucket carries a `max` the gate enforces and a `ceiling` its
recorded basis supports. Raising `max` toward `ceiling` is a local edit in
`scripts/budget-core.mjs` plus a line in that bucket's `changes` array saying who asked and
why. Raising `max` **past** `ceiling` is not a local edit: the basis no longer supports the
number, so it needs a new §10 entry supplying a different one. The failure mode of a budget is
not being exceeded — it is being quietly raised until it constrains nothing.

**One gzip figure, and this gate owns it.** Five gzip encoders were measured on the same
497,715-byte chunk of one build and span 1.3 % — Node zlib level 9 160,247 · Node zlib level 6
160,584 · GNU `gzip -9` 159,904 · GNU `gzip -6` 160,252 · Rolldown's Rust deflate 162,060. A
budget therefore cannot usefully be specified to better than about a percent, and what a gate
needs is a number that does not move for reasons unrelated to the code. The gate uses Node zlib
at an explicit level 9; `build.reportCompressedSize` is **off** in `vite.config.ts` so
`npm run build` cannot print a second, different size for the same file. **KB means 1000 bytes
throughout**, matching Vite and DevTools — at this scale the other convention is worth 6 KB of
budget.

**What is measured but deliberately not gated**, each reported by the gate so the figure is
visible rather than forgotten:

- **Lazily loaded chunks** — any `.js`/`.css` in `dist/` the built HTML does not reference.
  Not on the first-paint path, so not gated; growth there is still worth seeing, and nothing
  else reports it now that Vite's size report is off.
- **Preloaded fonts — 163.02 KB today** (`inter-latin.woff2` 72.92 + `archivo-latin.woff2`
  90.10), which is 6.5× the whole CSS budget and the largest single item on the first-paint
  path after the JS. Not gated because `woff2` is already compressed and the set is fixed by
  §10 #17 rather than by code, so a budget could only ever fire on a deliberate addition. It is
  named here because a CSS-budget conversation that ignores 163 KB of fonts is looking at the
  wrong number; whether both faces need preloading is the `designer`'s call to make with the
  figure in front of it.

---

## 9. Repository layout

Marked **(planned)** where the path does not exist yet, so this section can be diffed against the tree
rather than believed.

```
f1-analytics/
├── .claude/agents/          designer + developer; four retired definitions kept behind banners
├── .github/workflows/ci.yml typecheck · lint · format · build (+ §8 budget gate) · test ·
│                            validate:palette, plus a separate `npm audit` job. Every action
│                            pinned to a full commit SHA, never a tag (S-14)
├── CLAUDE.md                session context
├── PLAN.md                  agents, flow, non-negotiables — short by design
├── TASKS.md                 Rishabh's tracker; a line moves to Done only when pushed
├── REQUIREMENTS.md
├── docs/
│   ├── ARCHITECTURE.md      this file — owned by the senior engineer
│   ├── DATABASE.md          schema reference
│   ├── DESIGN_SYSTEM.md     visual + motion language — owned by the designer
│   └── archive/
│       └── PLAN-F0-archive.md  the former 5285-line plan, verbatim (§10 #25). Read a
│                               section for one decision's history, never the whole file
├── db/schema.sql            DDL for the 18 application tables (database supplied separately).
│                            The supplied file carries 19 tables — the extra one is seed
│                            bookkeeping and is deliberately not in this DDL
├── server/
│   ├── index.ts             entry: startup probe, then serve()
│   ├── app.ts               Hono app, exported without listening (testable)
│   ├── config.ts            PORT, DB_PATH, rate-limit and cache constants
│   ├── db.ts                readonly connection + canonical view bootstrap
│   ├── views.ts             v_entry / v_race DDL constants (DATABASE.md §6.1)
│   ├── coverage.ts          coverage-window constants (DATABASE.md §4)
│   ├── errors.ts            ApiError, error codes, non-leaking handler
│   ├── middleware/          rate limit (S-13), cache headers
│   ├── routes/              one module per resource
│   ├── queries/             ALL SQL, plus the pure row→payload builders each query
│   │                        module exports so CI — which never has data/f1.db —
│   │                        exercises the shaping rather than skipping all of it
│   ├── schemas/             Zod response schemas — zod-only imports
│   └── cache/               in-process memoisation for aggregates
├── src/                     React client
│   ├── main.tsx
│   ├── routes/              one module per surface
│   ├── features/            feature hooks + pure selectors (meta, landing, season)
│   ├── components/
│   │   ├── layout/          shell: CommandDock, AtmosphereField
│   │   ├── ui/
│   │   │   └── icons.tsx    eleven inline SVGs (§10 #18) — the only icon module
│   │   └── charts/          (planned — F2) the chart kit: axes, grid, legend, tooltip,
│   │                        crosshair, table view. Built on d3 primitives, no charting
│   │                        library (§10 #28). Presentational → the designer's
│   ├── lib/                 api, format, theme, queryClient, hooks
│   │   ├── motion/          the only place `gsap` may be imported (§10 #22)
│   │   ├── teamColor.ts     (planned — F1)
│   │   └── tokens.ts        (planned — F2; reads computed CSS custom properties so chart
│   │                        code has JS values — never its own copy of a hex, §4)
│   └── styles/              tokens.css, index.css, motion.css, backdrop.css,
│                            fonts.css (the @font-face block, §10 #17)
├── scripts/                 repo tooling, zero-dependency ESM run by Node directly
│   ├── validate-palette.mjs colour-gate validator (§10 #19) — the designer's
│   ├── budget-core.mjs      §8 budget gate, pure half: what counts, and the arithmetic
│   └── check-budget.mjs     §8 budget gate, I/O half: reads dist/, gzips, exits 0/1/2
├── vite.config.ts           build + vitest config; `reportCompressedSize: false` (§8.1)
├── vitest.reporter.ts       prints what the run did **not** test — a conditionally skipped
│                            suite must not look like a green one
├── public/
│   ├── theme-init.js        pre-paint theme application (external — CSP, §7.3)
│   ├── favicon.svg          typographic placeholder until R3 lands
│   ├── fonts/               vendored woff2 + OFL.txt (§10 #17) — never a font CDN
│   ├── textures/grain.svg   static noise tile for the backdrop (§10 #24)
│   └── assets/              (planned)
│       ├── drivers/         supplied by Rishabh (R1)
│       └── teams/           supplied by Rishabh (R2)
├── data/f1.db               gitignored input, never an artefact — never committed
└── dist/                    build output, gitignored
```

**No `e2e/` directory, and no Playwright.** It appeared in this listing before 2026-08-06 and never
existed on disk. See the §2 "Tests (E2E)" row.

---

## 10. Decision log

Append-only. The **senior engineer** records every architectural decision here with its reason. Entries
1–24 were written under the five-agent workflow and name agents that no longer exist — see the note at
the top of this file. Nothing is deleted; a superseded entry is marked, not removed (see #11).

| # | Date | Decision | Rationale |
|---|---|---|---|
| 1 | 2026-08-04 | Server-side SQLite over browser-side | 66 MB database; unshippable to the client |
| 2 | 2026-08-04 | Hono over Express | TS-first, minimal, sufficient for GET-only JSON |
| 3 | 2026-08-04 | ~~Recharts + visx split at the lap-data boundary~~ — **superseded by #28, 2026-08-07** | Original reasoning: Recharts degrades past ~1k interactive points. Retained for the record; neither library is in the product. |
| 4 | 2026-08-04 | URL as the state container for comparisons | Shareability is a product requirement (NV-4) |
| 5 | 2026-08-04 | Comparison capped at 4 entities | Satisfies the direct-label rule and cuts colour-collision risk (`DESIGN_SYSTEM.md` §3) |
| 6 | 2026-08-04 | Team brand colours are **not** used as a bare categorical palette | Validator FAILs on CVD and normal-vision separation; secondary encoding mandatory |
| 7 | 2026-08-04 | `v_entry` / `v_race` are created as **`CREATE TEMP VIEW` at connection bootstrap**, then the connection latches `PRAGMA query_only = 1` | The connection is `readonly: true` (DL-1) and the database is an input supplied separately, so permanent views cannot be created and must not be assumed present in the file. Probed on this machine: temp DDL succeeds on a readonly connection while permanent DDL and `UPDATE` throw `SQLITE_READONLY`; `query_only = 1` afterwards blocks all further DDL including temp. The definition therefore lives in version control (`server/views.ts`, mirroring `DATABASE.md` §6.1) and the process can create exactly those two views and nothing else. `EXPLAIN QUERY PLAN` confirms the planner still uses `idx_lap_entry` and `idx_season_year` through the views — no `SCAN`. Cost ~2.7 ms once per process. Rejected: baking views into the shipped file (would depend on objects the repo cannot guarantee), composing SQL fragments per query (the shape S-1 forbids), opening read-write (flat DL-1 violation). |
| 8 | 2026-08-04 | `@hono/node-server` added as a dependency | Hono is runtime-agnostic and ships no Node adapter; decision 2 ("Hono on Node") is unimplementable without it. Also supplies the `conninfo` helper for the S-13 per-IP key and `serve-static` for production serving. Escalated to Rishabh. |
| 9 | 2026-08-04 | Per-IP rate limiting is a ~30-line in-process fixed-window counter, **not** a dependency | The threat model is protecting a single-process read-only server, not adversarial abuse. `hono-rate-limiter` would add supply-chain surface (S-7, S-14) for trivial logic. The bucket map is capped and evicts oldest, because an unbounded map is itself a DoS vector. `X-Forwarded-For` is never trusted — revisit with a new entry if ever deployed behind a proxy. |
| 10 | 2026-08-04 | Coverage windows are **constants** in `server/coverage.ts`, mirroring `DATABASE.md` §4 — never computed per request | Deriving the lap window at request time means scanning `lap` (717,764 rows), a trap-7 violation on the cheapest endpoint. `DATABASE.md` §9's post-refresh checklist is extended to re-verify the constant so it cannot drift. |
| 11 | 2026-08-04 | ~~Node's version floor, not "latest", sets the dependency ranges~~ — **superseded by #14 the same day** | Original reasoning: Node v20.18.2 is below the `^20.19.0` floor of Vite 7+, ESLint 10, `@vitejs/plugin-react` 5+ and `typescript-eslint` 8.56+, so the tree had to be pinned back. Retained for the record; the pinned-back set is no longer in force. |
| 12 | 2026-08-04 | The directory holding the database must be **writable** by the server process | The file is in WAL mode, and SQLite must create the `-shm`/`-wal` sidecars even to read. Probed: a WAL database in a `chmod 555` directory fails with `SQLITE_READONLY_DIRECTORY` even with `readonly: true`, and `file:…?immutable=1` does not help because `better-sqlite3` does not enable `SQLITE_OPEN_URI`. This is not a write to the data (DL-1 holds — `query_only` is latched); it is SQLite bookkeeping. Binding on any future deployment with a read-only filesystem. |
| 13 | 2026-08-04 | `reference` slugs are the only public identifiers; `api_id` is never used in a URL or a response | DL-3 and trap 11. `db/schema.sql` currently claims `api_id` is the public identifier; that comment is corrected in F0 (task T2). One rule, one place. |
| 14 | 2026-08-04 | **Runtime raised to Node 22 LTS, floor `>=22.22.0`** (supersedes #11). Approved by Rishabh. | Driven by security, not novelty. On Node 20 there was no audit-clean React Router: `≤7.17.0` carried 14 high advisories, `7.18.2` carried `GHSA-qwww-vcr4-c8h2`, and the fix exists only in `8.3.0`, which requires Node `>=22.22.0`. The alternative was a standing S-7 exception; raising the runtime **deletes** the finding instead. Verified by resolving the full set: 320 packages, `npm audit` → 0 vulnerabilities, and 0 of 320 packages exclude Node 22.22.0 (checked with `semver.satisfies` over every resolved `engines.node`). Also retires the §2.1 pin-back table: Vite 8, ESLint 10, `@vitejs/plugin-react` 6, `typescript-eslint` 8.66, `concurrently` 10 all become available. Enforced by `engines` + `.nvmrc`, not convention. |
| 15 | 2026-08-04 | `typescript` pinned to `~5.9.3`, **not** TypeScript 7, despite Node 22 | TypeScript 7 is a hard `ERESOLVE` failure against `typescript-eslint@8.66.0` (peer `typescript >=4.8.4 <6.1.0`); no v9 is published and the canary caps identically. Dropping `typescript-eslint` is not available because §2 makes `any` a review failure, which requires type-aware rules. TypeScript therefore follows `typescript-eslint`. Revisit when TypeScript 7 support ships. |
| 16 | 2026-08-04 | `better-sqlite3` remains the driver. **`node:sqlite` is recorded as a future consideration only — not acted on.** | Node 22 makes `node:sqlite` available, which removes the original reason for the choice (decision: `better-sqlite3` was selected because `node:sqlite` was unavailable on Node 20). It is now a legitimate option — dropping a native dependency would improve S-7/S-14 posture and remove a `prebuild-install` step. But it is **out of scope for F0**: `node:sqlite` is a different API surface, and F0's value is a working skeleton, not a driver migration. Revisit deliberately once the query layer is real (F2–F3), when the migration cost is measurable rather than guessed. |
| 17 | 2026-08-04 | **Fonts are vendored `woff2` files in `public/fonts/`; the `@fontsource-variable/*` packages are rejected.** A font CDN remains forbidden outright. | Three families (Archivo, Inter, Chivo Mono — `DESIGN_SYSTEM.md` §2.1), six files, `latin` + `latin-ext`, plus `public/fonts/OFL.txt`, which the SIL OFL 1.1 **requires** in a distribution and this repository is public. Decided on two grounds that a dependency cannot meet: (a) files in `public/` keep **literal, stable URLs**, so `<link rel="preload">` in `index.html` is a fixed string — imported from `node_modules`, Vite content-hashes the name and preloading needs the build manifest or a plugin, and avoiding a first-paint font flash is an F0 concern; (b) we author the `@font-face`, so the family name is `Archivo`, matching `DESIGN_SYSTEM.md` §2.2's `--font-display` token, where Fontsource would declare `'Archivo Variable'` and force a token change or an alias. "No dependency" (S-7/S-14) agrees but did not decide it: all three packages were checked and carry **no dependencies and no install scripts**, so the supply-chain delta was small either way. Acquisition is a pinned, integrity-checked `npm pack @fontsource-variable/<f>@5.3.0` plus a documented copy of six named files, with `sha256` values recorded in `docs/archive/PLAN-F0-archive.md` → F0 Technical Spec §3.9 so the `reviewer` can re-derive the binaries instead of trusting a copy step. **No axis instancing or re-subsetting**: pinning Archivo's `wdth 82` into the binary would need a Python `fonttools` step that is not part of this project and would be an unreviewable build stage — the axis stays in the file and is selected in CSS. |
| 18 | 2026-08-04 | **Icons are eleven inline SVGs in `src/components/ui/icons.tsx`; `lucide-react` is rejected.** | Eleven glyphs do not justify a dependency (S-7/S-14), and `lucide-react` is a barrel export over ~1,600 icon modules that the Vite dev server must resolve and transform on first request — a real cold-start cost for no shipped benefit at this size, since the production build tree-shakes it anyway. `DESIGN_SYSTEM.md` §2.5's "one set: Lucide" is **preserved rather than overridden**, because the path data is copied verbatim from `lucide-static@1.28.0` (ISC) with the licence notice retained in the file header; only the stroke width changes, from Lucide's source `2` to the design system's `1.5`. Consequences that are binding, not advisory: new glyphs are added to **this same file from this same source**, an icon is **never hand-drawn**, a second icon set stays a review failure, and the `size` prop is the union `16 \| 20` so an off-scale icon is a compile error. Full specification in `docs/archive/PLAN-F0-archive.md` → F0 Technical Spec §3.10. |
| 19 | 2026-08-04 | **`scripts/validate-palette.mjs` + `npm run validate:palette` — a zero-dependency colour gate in the repository. Lands in F1.** | `DESIGN_SYSTEM.md` §9.1 requires re-running the validator whenever a colour moves, and every figure in §9.2 — including the four measured brand-colour FAILs that decision #6 rests on — was produced by a validator that existed only in the `designer`'s working directory. Until it is in the repository the `reviewer` **cannot falsify a colour claim**, which makes §9.1 unenforceable and #6 unauditable: a governance gap, not a missing convenience. Zero dependencies is part of the decision, not an aspiration — §9.1 is pure arithmetic (matrix multiplies, a cube root, CIEDE2000's piecewise formula), and a colour library would create a second authority on what the numbers mean. Reads `src/styles/tokens.css` as the single source of truth and never carries its own copy of a hex value. Exit `0` pass / `1` regression, **including a recorded FAIL that silently became a PASS** / `2` input error. `DESIGN_SYSTEM.md` §9.2's calibration run **V-1** is the validator's own permanent regression test, and F1 must additionally assert the colour maths against published reference data (the Sharma/Wu/Dalal CIEDE2000 dataset) — reproducing §9.2 proves consistency with the `designer`'s implementation, not correctness. The two CVD models stay separately assertable and the reported figure names its model, because §9.1 mandates "the worse of the two" and they disagree materially on tritanopia. Technical shape in `docs/archive/PLAN-F0-archive.md` → F0 Technical Spec §9.6. |
| 20 | 2026-08-04 | **The upstream-attribution constraint is removed from this project, and with it `S-12` from the §7 security-audit item list** (CR-005, `docs/archive/PLAN-F0-archive.md` §5.5 change-request log). Forward-going only: the constraint stops applying from here on, and existing gate records, evidence entries and commit messages stand verbatim. Decided by Rishabh in session, 2026-08-04 (`docs/archive/PLAN-F0-archive.md` §5.5 change-request log → CR-005). | The repository is going private and he does not regard the exposure as a problem, so the control no longer protects anything — and a standing audit item that cannot fail is worse than none, because it consumes a gate and implies a guarantee the project is not making. **`S-12`'s number is retained as a gap, never reused**: `S-13` and `S-14` are cited by identifier across `PLAN.md`, the agent definitions and the review history, so renumbering would silently retarget every one of those citations. The audit list becomes S-1…S-11 plus S-13…S-14. `S-5` (no secrets) and the `.gitignore` entries for `private/` and `data/` are **unaffected** — those exist for a 66 MB binary and local-only tooling and are unrelated. No stack, layering, API-surface, routing or performance-budget consequence. |
| 21 | 2026-08-06 | **GSAP 3 replaces `framer-motion` as the animation library, and `@gsap/react` is approved alongside it** (CR-007, `docs/archive/PLAN-F0-archive.md` §5.5 change-request log). `framer-motion` is uninstalled, not kept. | Rishabh asked for GSAP; the engineering case holds independently, but **the bundle claim in the CR entry is wrong and is corrected here.** Measured on this machine (esbuild `--bundle --minify --format=esm`, `react` external, `gzip -9`) — a method calibrated against the real T13 build, where it reproduced `framer-motion` at 42.8 KB gz against the build's own 40.8 KB, i.e. ±2 KB: **`framer-motion` (our exact import surface) 128.8 KB raw / 42.8 KB gz · `gsap` alone 70.7 / 27.6 · `gsap` + `useGSAP` 71.8 / 28.1 · `gsap` + `ScrollTrigger` + `useGSAP` 116.3 / 45.5 · `SplitText` +3.0 · `Flip` +9.7.** So GSAP core is **~15 KB gz cheaper** than what it replaces, but **GSAP + ScrollTrigger is ~2.7 KB gz dearer** — the CR's "≈23 KB core, ≈33 KB with ScrollTrigger" understates both. The decision stands on those corrected figures because the 250 KB budget has ~100 KB of headroom either way. Licensing verified: GSAP has been free for commercial use including every formerly paid plugin since April 2025; `license` field is GreenSock's standard no-charge licence. Supply chain (S-7/S-14): **both packages have zero runtime dependencies and no install scripts**, `gsap` declares `sideEffects: false` and ships its own types, `@gsap/react` peers `react >=17` (satisfied by 19.2.8) and costs **0.4 KB gz**. `@gsap/react` is approved rather than hand-rolling `gsap.context()` in a `useLayoutEffect`, because incorrect cleanup is the single most common GSAP-in-React defect and `useGSAP()` is GreenSock's own answer to it. **Plugin allowlist: `ScrollTrigger`, `SplitText`, and `Flip` from F1 (it is the replacement for `layoutId` shared-element motion).** **Denylist, each for a stated reason: `ScrollSmoother` and `ScrollTrigger.normalizeScroll` (they hijack native scrolling, which breaks keyboard paging, anchor navigation and platform scroll behaviour), `CustomEase` (it exists to author bézier literals, which §2 forbids), `Draggable`/`InertiaPlugin`/`MorphSVG` (no requirement).** Any addition needs a new entry here. |
| 22 | 2026-08-06 | **Motion is split by mechanism, not by taste: looping motion is CSS `@keyframes`; one-shot and interaction motion is GSAP. There is no third mechanism.** Two structural chokepoints enforce `prefers-reduced-motion`. | GSAP's ticker sleeps when nothing is animating (verified in `gsap-core.js` — the global timeline calls `_ticker.sleep()` when it has no active child), so a *finite* GSAP animation costs nothing at rest. An *infinite* one never lets it sleep, and an always-running background is exactly that: a permanent `requestAnimationFrame` callback competing with the §8 "<100 ms chart interaction" budget on the same thread that runs React and the charts. A composited CSS animation on `transform`/`opacity` is handed to the compositor and costs the main thread nothing. **Chokepoint 1 (CSS):** one `@media (prefers-reduced-motion: reduce)` block in `src/styles/motion.css` sets `animation: none` and `transition: none` on `*, *::before, *::after` — global, so no loop can be added that escapes it. **Chokepoint 2 (GSAP):** no component may import `gsap`; an ESLint `no-restricted-imports` rule confines the import to `src/lib/motion/**`, and the only exported way to create a tween is the `useMotion` hook, whose `animate` builder is **never called** when `gsap.matchMedia()` reports `(prefers-reduced-motion: reduce)`. That yields a genuinely stopped state, not a slowed one, because no tween exists and the ticker stays asleep — and it is correct output rather than a broken one only because of the accompanying rule that **an element's CSS resting state is always its final, readable state, so all entrance motion is authored as `from`/`fromTo`.** State that must be applied in both modes goes in the hook's separate `settle` builder, which uses `gsap.set` and runs unconditionally. |
| 23 | 2026-08-06 | **The landing page occupies `/`; the season hub moves to `/seasons`** (§5 amended). No redirect either way. | NV-3 has always required a landing page; F0 shipped the season hub at `/` instead, which is why the F0 plan (now `docs/archive/PLAN-F0-archive.md`) had no landing surface to make attractive. A landing page that is not at `/` is not a landing page, so CR-007's "the first thing a visitor sees" forces the split rather than leaving it to taste. `/seasons` and `/seasons/:year` render one component with the year resolved from `/api/meta` when absent. No redirect: nothing outside this repository has linked to `/`, and a redirect would conceal the change from the only reader who needs to notice it. Route count goes 11 → 12 plus the catch-all; the `isActiveNavItem` rule becomes non-trivial (`/` must match exactly, everything else by path segment) and is therefore a pure, unit-tested function rather than inline JSX. |
| 24 | 2026-08-06 | **The moving background is CSS-composited gradient layers. Canvas 2D, WebGL and animated SVG filters are all rejected.** | Judged on bundle cost, main-thread cost and failure mode. **WebGL** — `three` is ≈150 KB gz and even a micro-renderer like `ogl` is ≈10 KB gz plus shader source, for decoration, on a page whose budget exists to protect charts; it also needs a context-loss path and a no-WebGL fallback, i.e. two implementations. **Canvas 2D** — cheap in bytes (~1 KB) but pays continuous main-thread CPU for every frame of an animation that runs for the entire session; `OffscreenCanvas` in a worker would fix the thread but adds a worker build target, a message protocol, and a fallback for the non-transferable case. **Animated `filter`/`backdrop-filter`** — forces a re-rasterisation per frame, which is the most expensive thing a decorative layer can do. **CSS gradient layers animated only on `transform` and `opacity`** cost **zero JavaScript**, are composited off the main thread, are paused by the browser when the tab is hidden, and degrade to a static gradient with one media query. Softness comes from wide `radial-gradient` colour stops, **not** `filter: blur()`, so nothing re-rasterises; grain comes from a static `data:image/svg+xml` `background-image`, which `img-src 'self' data:` already permits and which involves no network. Intensity is a pure function of the route (`full` on the landing, `muted` on data surfaces, `off` where dense charts land from F2/F3), and at `off` the animated layers are **removed from the DOM** rather than paused, because a paused compositor layer still holds memory. |
| 25 | 2026-08-06 | **The five-agent workflow is retired. Two agents remain — `designer` (the visual layer) and `developer`, a senior software engineer (everything else). Architecture ownership, and this document, move to the senior engineer.** The spec gate, the code-review gate, the security-audit gate and the E2E/QA gate are all removed. `PLAN.md` is cut from 5285 lines to ~107 and archived verbatim at `docs/archive/PLAN-F0-archive.md`. Decided by Rishabh in session. | Recorded here because it changes **who decides what this file says**, which is an architectural fact about the project, not a process preference. Two measured reasons. **(a) Handoff loss dominated defect count.** Of CR-007's five blocking defects, four were translation losses at an agent boundary rather than errors in anyone's own work — a spotlight authored in `%` where the spec meant `px`, a motion a comment claimed existed but nothing implemented, an indicator built in the wrong element so it snapped, a chart axis given `grid-column` inside a flex parent. Fewer boundaries, fewer of that class. **(b) Every dispatched agent paid for 5285 lines of plan** before doing any work, and the plan's growth was itself driven by the handoff format. **What is genuinely lost, stated rather than papered over:** the removed review gate is what *caught* those five defects, and 236 passing unit tests did not. jsdom performs no layout and no compositing, so position, size, timing and visual composition are **untested by construction** — the builder must name what it has not seen work, and Rishabh's eyes are now the acceptance criterion. **Consequences that are binding here:** the S-1…S-14 audit becomes a per-change self-check of S-4, S-6, S-7 and S-10 plus any item the diff genuinely touches (§7); a documentation edit named by a change ships in the same commit as the code, because no reviewer will notice a stale doc; and there is **no E2E layer at all** (§2), which is a stated absence, not an omission to be quietly filled. **Not changed:** every layering rule (§3), the chart constraints (§4), the URL contract (§5), the API conventions (§6), the security controls themselves (§7) and the performance budget (§8). Removing gates did not relax any of them — it moved who enforces them onto the person writing the code. |
| 26 | 2026-08-06 | **`style-src-attr 'unsafe-inline'` stays in the CSP, and the reason recorded in `server/app.ts` was wrong.** It is **not** merely a precaution against CSSOM writes; there is a concrete, reachable call in `gsap/ScrollTrigger.js` that uses the attribute form CSP governs. Removal still requires the one piece of evidence §7.4 names — zero CSP violations in a production-preview browser console — which nobody has yet gathered. | The previous comment read "React and GSAP both mutate styles through the CSSOM, which CSP does not govern, so this may well be unnecessary". The first clause is true and the conclusion does not follow. Read from the installed source: `ScrollTrigger.js` line ~2108, inside the block reached from `ScrollTrigger.enable()` ← `ScrollTrigger.register()` ← `gsap.registerPlugin(ScrollTrigger)`, executes `_body.setAttribute("style", "")` followed by `_body.removeAttribute("style")`, guarded by `if (!bodyHasStyle)`. Three facts make it load-bearing: `gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)` runs at **module evaluation** of `src/lib/motion/gsap.ts`, so the path is reached on **every page load** rather than only when a trigger is created; `setAttribute('style', …)` is the inline-style-attribute form that `style-src-attr` governs, unlike `element.style.x = y`; and our `<body>` carries no `style` attribute, so the guard is satisfied and the call runs. What is **verified statically** (and asserted by `server/app.test.ts`): the authored `index.html` and the built `dist/index.html` both contain no inline `<style>`, no inline `<script>` body and no `style=` attribute, so nothing *we* write needs the allowance; and the ScrollTrigger call **survives minification into `dist/assets/*.js`**, quoted with backticks and an empty value — the risk is in the shipped artefact, not only in `node_modules`. (`gsap/Flip.js` uses the same attribute form, but it is not imported: §10 #21 defers `Flip` to F4, and that is a reason to re-read this entry then rather than a current exposure.) What is **not** verifiable in Node: whether a browser reports a violation for an **empty** attribute value, since jsdom implements no CSP enforcement at all. Rejected alternatives — removing the directive on the static argument alone (exactly what §7.4 forbids, and it would break real behaviour if the violation is reported); forcing `<body>` to carry a `style` attribute so the guard short-circuits (an inline attribute in markup is itself governed, and a CSSOM trick to create the attribute relies on unspecified serialisation timing); dropping `ScrollTrigger` (four named motions depend on it). Instead the allowance is **narrowed to `style-src-attr` only** — `style-src` and `script-src` stay `'self'` — and `server/app.test.ts` pins the whole header so widening it is a test failure, with a canary that fails when the GSAP call disappears on upgrade so the directive is re-evaluated rather than inherited forever. |
| 27 | 2026-08-07 | **The performance budget becomes three enforced numbers with written derivations, gated by `npm run check:budget` at the end of every build. A render-blocking CSS budget of 25 KB gzipped is introduced; the unwritten 10 KB the `designer` was being held to is retired.** Vite's own compressed-size report is turned off in the same change. | Asked for by Rishabh, who noticed the 10 KB figure appears **nowhere in this document** — it was a remembered number, and the `designer` had 0.15 KB of room left with F1's chart CSS still to write. Three decisions, each for a stated reason. **(a) A basis, not a figure.** Each bucket carries the derivation that produced its number: `css-blocking` from two independent routes that agree — 10 % of the 250 KB JS budget (25 KB), and ≤ 10 % of the 1.5 s FCP target spent on transfer at a stated 1.6 Mbit/s reference link (30 KB) — with the tighter enforced. The 250 KB JS row's basis is written down for the first time and it is **not** a derivation from the FCP row: 250 KB is 1.25 s of transfer at that link, so the two rows are reconciled by code splitting and this is said out loud rather than left to look rigorous. **(b) `max` versus `ceiling`.** Every bucket declares both. Raising `max` toward `ceiling` is a local edit plus a logged reason; raising it past `ceiling` needs a new entry here, because the basis no longer supports the number. The failure mode of a budget is not being exceeded — it is being quietly raised until it constrains nothing — and this makes the quiet raise structurally impossible while keeping the deliberate raise cheap. **(c) "Initial" is derived from the built `index.html`, never a maintained list**: the parser-blocking classic script, the module entry plus every `modulepreload`, and every stylesheet. Rejected: summing every `.js` in `dist/`, which is simpler and begins over-counting the day route-level splitting lands (§8) — a gate that fails for something that is not a regression gets switched off, so the definition had to be right before the splitting rather than after. **Parser-blocking `<script src>` is its own 2 KB bucket** rather than part of the 250 KB, because a byte in front of first paint costs more than a byte in a deferred module and one bucket would hide the growth that matters. **The gate is inside `npm run build`**, not only a CI step, so it fires on the machine where the change was written; `npm run build:unchecked` is the hatch and the failure output names it, because an unnamed hatch gets replaced by deleting the gate. Exit `0` pass (a WARN at 80–85 % still passes) / `1` over budget / `2` nothing to measure — **`2` rather than `0` is load-bearing**: a gate that cannot find `dist/`, reports 0.00 KB and exits 0 is indistinguishable from a very small bundle, which is the exact shape of the `npx tsc --noEmit` false green this project already paid for. **One gzip authority.** Five encoders measured on the same 497,715-byte chunk span 1.3 % — Node zlib L9 160,247 · Node zlib L6 160,584 · GNU `gzip -9` 159,904 · GNU `gzip -6` 160,252 · **Rolldown's Rust deflate 162,060**, the outlier and the one `npm run build` was printing. So `build.reportCompressedSize` is off and the gate's Node-zlib-L9 figure is the only gzipped size the project reports; nothing is lost, because the gate prints a per-asset table including the lazy chunks Vite was reporting. A budget cannot usefully be specified to better than about a percent, which is also why the gate never compares against a stored measurement — an encoder change on a Node upgrade must not be able to produce a failure. **Not gated, and named in §8.1 rather than omitted: 163.02 KB of preloaded fonts** — 6.5× the entire CSS budget, and the largest first-paint item after the JS. Left ungated because `woff2` is already compressed and the set is fixed by #17 rather than by code, but recorded because a CSS-budget conversation that ignores it is looking at the wrong number. |
| 28 | 2026-08-07 | **No charting library. The substrate is four ISC d3 modules — `d3-scale`, `d3-shape`, `d3-array`, `d3-time-format` — plus a chart kit written in this repository. Recharts and visx are both rejected, superseding #3.** ~~Nothing is installed yet; the four land with the first chart in F2.~~ — **installed in F2, 2026-08-07; see #29 for the re-measurement and the lint chokepoint.** | Rishabh's steer was to prefer primitives, on the grounds that this product's constraints will fight an opinionated library. Vetted rather than assumed, in an isolated scratch project so the repository's `node_modules` and lockfile were untouched; every figure below is `esbuild --bundle --minify --format=esm` with `react`/`react-dom` external, gzipped with Node zlib level 9 — the same method and the same encoder the §8 budget gate uses (#27), so these numbers are comparable to the build's. **Measured cost.** Recharts 3.10.1, our realistic 13-component import surface: 420,511 raw / **121,723 gz**. A minimal five-component surface (`LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`) is still 353,961 / **104,971**, and Recharts declares `sideEffects: false`, so that is *after* tree-shaking — the floor is set by Recharts 3 having `@reduxjs/toolkit`, `react-redux`, `immer` and `reselect` as **runtime** dependencies. visx, a comparable surface across `@visx/{scale,shape,axis,group,tooltip,event,curve}`: 86,133 / **29,964**. The four d3 modules with a wide surface: 45,975 / **16,330**; `d3-scale` + `d3-shape` alone: 39,670 / **14,375**. Against the initial-JS budget the build stands at 160.25 KB of 250 KB, i.e. **89.75 KB of headroom** — so a minimal Recharts import exceeds the entire remaining budget before one chart is written. Charts will be route-split, so this is not literally a budget breach; it is ~105 KB gz per chart-bearing route, on the surface whose FCP target is 1.5 s, for capability we would then constrain heavily. **Supply chain (S-7/S-14).** d3 primitives: 10 packages, **all ISC**, **no install scripts anywhere in the tree**, all `sideEffects: false` bar two narrow locale entries, `npm audit` 0 vulnerabilities. They ship no types, so `@types/d3-{scale,shape,array,time-format}` (MIT, DefinitelyTyped, 6 packages, zero runtime cost) become devDependencies. Recharts: 42 packages, MIT, a `prepare: husky \|\| true` that npm does not run for a registry tarball, audit clean. visx: 47 packages, MIT, and `@visx/axis` → `@visx/text` → **`reduce-css-calc@1.3.0` → `math-expression-evaluator@1.4.0`** — a 2016-era expression evaluator reached for axis-label text measurement. **Why not visx, the obvious middle ground:** `@visx/vendor` is a re-export of the *same* d3 modules, with the `@types/d3-*` packages declared as **runtime** dependencies, and it pulls `d3-geo` and `d3-delaunay` we do not use. It costs 13.6 KB gz more than the primitives for React wrappers around components we must author anyway, because `DESIGN_SYSTEM.md` §6 requires one shared tooltip, token-driven colour rather than library defaults, a table view per chart and a designed dark mode. A single `@visx/*` package for a specific named need remains available as an amendment here. **Why not hand-rolled maths as well** (the most primitive option, 0 KB): `d3-array`'s tick-step selection and `d3-time`'s tick choice across day/month/year boundaries are the subtle part, and an axis spanning 1950–2026 with badly chosen ticks is a visible defect. The maths is not where this product's value is. Also rejected without measurement, each for a stated reason: **Chart.js / ECharts / Nivo / Observable Plot** — all more opinionated than Recharts and larger, and Chart.js and ECharts are dual-axis-first APIs, which is the one thing #6 and §4 forbid outright. **The decisive argument is not bytes, it is enforceability.** With no review gate (#25), §4's constraints otherwise rely on whoever writes the chart remembering them. Our own frame type takes exactly **one** y-scale, so a dual-axis chart is not expressible, where `<YAxis yAxisId="right">` is one line away in Recharts; series colour resolves from entity identity through `lib/teamColor.ts` with no index-into-a-palette path, so colour cannot follow rank; and a series without a non-colour channel does not compile, which is #6's mandatory secondary encoding turned into a type error. **Cost, stated rather than buried:** roughly an axis, a legend, a tooltip and a responsive wrapper move out of `node_modules` into this repository, and since they are presentational that work lands on the **`designer`** (§4). **What is not verified:** whether SVG at ~1,400 lap marks holds §8's <100 ms interaction budget. Paint and hit-test cost are not observable without a browser and there is none in this pipeline, so **no Canvas threshold is stated** — inventing one would be exactly the false precision #26 was written to correct. A line series renders one `<path>` per driver rather than one node per point, which is the reason to expect SVG to hold; moving a chart to Canvas is an amendment here carrying the measurement that justified it. |
| 29 | 2026-08-07 | **The four d3 primitives are installed (F2), and `DESIGN_SYSTEM.md` §6's forbidden list becomes an ESLint error rather than a convention.** `d3-scale@4.0.2`, `d3-shape@3.2.0`, `d3-array@3.2.4`, `d3-time-format@4.1.0` as dependencies; `@types/d3-{scale,shape,array,time-format}` as devDependencies. `d3`, `d3-axis`, `d3-selection`, `d3-transition` and `d3-format` are added to `no-restricted-imports` for all of `src/**`. | #28 decided this on figures measured in an isolated scratch project. **Re-measured here, against the tree that actually shipped**, with #28's own method (`esbuild --bundle --minify --format=esm`, Node zlib level 9 — the encoder #27 makes the single authority): the wide surface §6.6 names is **45,568 raw / 16,299 gz = 16.30 KB**, reproducing #28's recorded 16,330 bytes to within 31 bytes, so the decision rests on a figure that has now been produced twice by two routes. **F2's own import surface is smaller — `scaleLinear`, `scalePoint`, `line`, `area`, `curveMonotoneX`, `extent`, `max`, `bisector`: 29,555 raw / 11,198 gz = 11.20 KB** — and charts are route-split, so the initial-JS bucket does not pay for it at all until a chart is on the first-paint path. **Supply chain re-verified on the installed tree, not on the registry metadata:** 10 packages resolved, **all ISC**, `sideEffects: false` on eight with `./src/defaultLocale.js` on `d3-format` and `d3-time-format`, and **zero `preinstall`/`install`/`postinstall`/`prepare`/`prepack` scripts anywhere in the subtree** — the `prepublishOnly`/`postpublish` entries `d3-scale` carries are publish-time and npm never runs them for a registry tarball. Types: 6 packages, **all MIT**, no scripts, no runtime cost. `npm audit` → `found 0 vulnerabilities` at 337 packages. **Why the lint rule and not a note:** §6 forbids `d3-axis`, `d3-selection`, `d3-transition` and `d3-format`, and with no review gate (#25) a forbidden import would otherwise be caught only by someone remembering the list. `d3-format` is the sharp case — it is **already in `node_modules`** as a transitive of `d3-scale`, so it resolves, type-checks and works, and the only thing standing between it and `src/lib/format.ts` drifting on lap-time formatting is a rule that fires. The `d3` meta-package is restricted too, though §6 does not name it: one `import { scaleLinear } from 'd3'` pulls `d3-geo`, `d3-delaunay` and the rest into the graph and defeats every figure above. The `src/lib/motion/**` block that lifts the gsap chokepoint **re-states** these five rather than switching `no-restricted-imports` off, because ESLint replaces a rule's options wholesale. **Not verified:** nothing here says the primitives are *sufficient* for the kit — that is the `designer`'s to find out while building it, and a fifth module would be an amendment on this line. |
