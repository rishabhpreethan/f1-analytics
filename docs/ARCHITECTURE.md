# Architecture

**Authoritative technical design.** The Principal Engineer owns this document; the Developer
implements against it; the Reviewer enforces it. Deviations require a Principal Engineer amendment
in the same PR, not an undocumented exception.

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
| Language | **TypeScript**, `strict: true` | Non-negotiable. `any` is a review failure. |
| Client | **React 19** + **Vite** | Required by the brief. Vite for dev speed and build output. |
| Runtime | **Node 22 LTS**, floor `>=22.22.0` | See §2.1. Set by `react-router@8`; keeps the toolchain on current majors and the audit clean. |
| Routing | **React Router v8** (declarative mode) | URL-addressable state is a hard requirement (NV-4). v8 is the audit-clean line; declarative mode is unchanged from v7, and all APIs used are exported from `react-router` itself. |
| Server data | **TanStack Query v5** | Cache, dedupe, background refetch, loading/error states. Server data is not app state — never mirror it into a store. |
| API server | **Hono** on Node 22+, with **`@hono/node-server`** | Tiny, TS-first, fast. No framework weight needed for GET-only JSON. Hono is runtime-agnostic, so the Node adapter is a required companion, not an optional extra; it also supplies the `conninfo` helper (S-13) and `serve-static`. |
| DB driver | **better-sqlite3**, `readonly: true` | Synchronous; for a local file this beats a pool. |
| Validation | **Zod** | One schema per response, shared client/server. Types derive from schemas. |
| Charts | **Recharts** (standard) + **visx** (lap-scale) | See §4. |
| Motion | **Framer Motion** | Required by the brief. Presets only — see `DESIGN_SYSTEM.md`. |
| Styling | **Tailwind CSS** + CSS custom properties for tokens | Tokens in CSS vars so both Tailwind and chart libraries read the same values. |
| Fonts | **Vendored `woff2` in `public/fonts/`** — Archivo, Inter, Chivo Mono. **No npm font package, and a font CDN is forbidden.** | §10 #17. Stable preload URLs and `@font-face` family names that match the design tokens. Self-hosted is a hard requirement (DL-2, S-9) — `font-src 'self'` enforces it in the browser. |
| Icons | **Eleven inline SVGs** in `src/components/ui/icons.tsx`, Lucide geometry under ISC. **`lucide-react` is not a dependency.** | §10 #18. One icon set, and `DESIGN_SYSTEM.md` §2.5 makes a second one a review failure. New glyphs are added to that file from the same source — never hand-drawn. |
| Client state | **URL first**, then `useState` | No Redux/Zustand. If it belongs in a link, it belongs in the URL. |
| Tests (unit) | **Vitest** | |
| Tests (E2E) | **Playwright**, driven via **Playwright MCP** | Owned by the QA agent. See §6. |
| Lint/format | **ESLint** + **Prettier** | |

**Nothing else gets added without a Principal Engineer decision recorded in §10.**

### 2.1 Runtime floor — `node >= 22.22.0`

**One number, and it is enforced mechanically**, not by convention: `package.json` `engines` plus a
committed `.nvmrc`. The earlier per-package version-floor table is retired — on Node 22 the whole
toolchain sits on current majors, so there is nothing left to tabulate.

`22.22.0` is the highest floor any direct dependency declares (`react-router@8.3.0`), and it also
satisfies `eslint@10`'s `^22.13.0`. Recommended install: **v22.23.2** (Latest LTS "Jod").

Verified 2026-08-04 by resolving the full set: **320 packages · `npm audit` → 0 vulnerabilities · 0
of 320 packages exclude Node 22.22.0** (checked with `semver.satisfies` across every resolved
`engines.node`, not merely from `npm`'s warnings). Evidence in `PLAN.md` F0 Technical Spec §0.1.

**One exception to "current majors": `typescript` stays `~5.9.3`.** TypeScript 7 is a hard
`ERESOLVE` failure against `typescript-eslint@8.66.0`, whose peer range is `>=4.8.4 <6.1.0`; no v9 is
published and the canary caps identically. Type-aware lint rules are not optional here — §2 makes
`any` a review failure — so TypeScript follows `typescript-eslint`, not the other way round. Revisit
when `typescript-eslint` ships TypeScript 7 support.

---

## 3. Layering rules

Enforced by review. Each rule exists because breaking it has a specific cost.

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
| **Client fetch paths are relative and typed `/api/${string}`.** | Makes a third-party call a compile error rather than a review finding (DL-2). |

---

## 4. Charting strategy

Two libraries, with a hard boundary. This is a deliberate trade, not indecision.

| Use | Library | Why |
|---|---|---|
| Standings, points progression, bars, comparison aggregates, stat tiles | **Recharts** | React-idiomatic, fast to build, good enough at ≤ a few hundred points. |
| Race position chart, lap-time traces, stint timelines | **visx** + SVG/Canvas | 20 drivers × 70 laps = 1,400+ points with per-lap hover. Recharts degrades here; visx gives control over rendering and hit-testing. |

**Boundary rule:** if a chart plots `lap`-level data, it is visx. Everything else is Recharts.
Both consume the same tokens from `lib/tokens` and the same tooltip component, so they must look
like one system — see `DESIGN_SYSTEM.md` §6.

**Hard chart constraints** (from the visualization method, enforced in review):

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
| `/` | Season hub — current season by default |
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
| `GET /api/seasons` | all seasons with round counts |
| `GET /api/seasons/:year` | calendar + final/current standings |
| `GET /api/seasons/:year/standings` | driver + team standings progression per round |
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

---

## 7. Security posture

There is no auth, no user input persisted, no PII, and no mutation. That eliminates most of the
usual surface — which makes the remaining items the ones that actually matter. The Reviewer runs a
full audit against this list before any merge.

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
| S-14 | **Supply chain** | Pin the Playwright and MCP tooling versions used by QA. |

`S-12` was removed by **CR-005** (`PLAN.md` §5.5). Its number is left as a gap rather than reused, so
`S-13` and `S-14` keep their identifiers. The audit is S-1…S-11 plus S-13…S-14.

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

---

## 8. Performance budget

| Target | Budget |
|---|---|
| Season hub — first contentful paint | < 1.5 s |
| Race deep dive — interactive with lap chart | < 2.0 s |
| Chart interaction (hover, series toggle) | < 100 ms, no network |
| API p95 for any non-lap endpoint | < 50 ms |
| API p95 for a lap endpoint | < 200 ms |
| Initial JS bundle (gzipped) | < 250 KB |

**Techniques**
- Route-level code splitting; visx and lap charts load only on the race deep dive.
- Server-side downsampling for the position chart when lap count is large.
- Precomputed aggregate tables for career/all-time surfaces, refreshed with the database.
- TanStack Query cache with a long `staleTime` — the data is immutable between refreshes.
- Virtualise long tables.

---

## 9. Repository layout

```
f1-analytics/
├── .claude/agents/          agent definitions
├── docs/
│   ├── ARCHITECTURE.md      this file
│   ├── DATABASE.md          schema reference
│   └── DESIGN_SYSTEM.md     visual + motion language
├── db/schema.sql            DDL for the 18 application tables (database supplied separately)
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
│   ├── queries/             ALL SQL
│   ├── schemas/             Zod response schemas — zod-only imports
│   └── cache/               in-process memoisation for aggregates
├── src/                     React client
│   ├── main.tsx
│   ├── routes/
│   ├── features/            feature hooks + pure selectors
│   ├── components/
│   │   ├── ui/
│   │   │   └── icons.tsx    eleven inline SVGs (§10 #18) — the only icon module
│   │   └── charts/
│   ├── lib/                 tokens, teamColor, format, motion presets, api, theme
│   └── styles/              index.css + fonts.css (the @font-face block, §10 #17)
├── scripts/                 repo tooling, zero-dependency ESM run by Node directly
│   └── validate-palette.mjs colour-gate validator (§10 #19) — lands in F1
├── e2e/                     Playwright specs (QA-owned)
├── public/
│   ├── theme-init.js        pre-paint theme application (external — CSP, §7.3)
│   ├── fonts/               vendored woff2 + OFL.txt (§10 #17) — never a font CDN
│   └── assets/
│       ├── drivers/         supplied by Rishabh
│       └── teams/           supplied by Rishabh
├── PLAN.md                  delivery plan + tracker
└── REQUIREMENTS.md
```

---

## 10. Decision log

Append-only. The Principal Engineer records every architectural decision here with its reason.

| # | Date | Decision | Rationale |
|---|---|---|---|
| 1 | 2026-08-04 | Server-side SQLite over browser-side | 66 MB database; unshippable to the client |
| 2 | 2026-08-04 | Hono over Express | TS-first, minimal, sufficient for GET-only JSON |
| 3 | 2026-08-04 | Recharts + visx split at the lap-data boundary | Recharts degrades past ~1k interactive points |
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
| 17 | 2026-08-04 | **Fonts are vendored `woff2` files in `public/fonts/`; the `@fontsource-variable/*` packages are rejected.** A font CDN remains forbidden outright. | Three families (Archivo, Inter, Chivo Mono — `DESIGN_SYSTEM.md` §2.1), six files, `latin` + `latin-ext`, plus `public/fonts/OFL.txt`, which the SIL OFL 1.1 **requires** in a distribution and this repository is public. Decided on two grounds that a dependency cannot meet: (a) files in `public/` keep **literal, stable URLs**, so `<link rel="preload">` in `index.html` is a fixed string — imported from `node_modules`, Vite content-hashes the name and preloading needs the build manifest or a plugin, and avoiding a first-paint font flash is an F0 concern; (b) we author the `@font-face`, so the family name is `Archivo`, matching `DESIGN_SYSTEM.md` §2.2's `--font-display` token, where Fontsource would declare `'Archivo Variable'` and force a token change or an alias. "No dependency" (S-7/S-14) agrees but did not decide it: all three packages were checked and carry **no dependencies and no install scripts**, so the supply-chain delta was small either way. Acquisition is a pinned, integrity-checked `npm pack @fontsource-variable/<f>@5.3.0` plus a documented copy of six named files, with `sha256` values recorded in `PLAN.md` F0 §3.9 so the `reviewer` can re-derive the binaries instead of trusting a copy step. **No axis instancing or re-subsetting**: pinning Archivo's `wdth 82` into the binary would need a Python `fonttools` step that is not part of this project and would be an unreviewable build stage — the axis stays in the file and is selected in CSS. |
| 18 | 2026-08-04 | **Icons are eleven inline SVGs in `src/components/ui/icons.tsx`; `lucide-react` is rejected.** | Eleven glyphs do not justify a dependency (S-7/S-14), and `lucide-react` is a barrel export over ~1,600 icon modules that the Vite dev server must resolve and transform on first request — a real cold-start cost for no shipped benefit at this size, since the production build tree-shakes it anyway. `DESIGN_SYSTEM.md` §2.5's "one set: Lucide" is **preserved rather than overridden**, because the path data is copied verbatim from `lucide-static@1.28.0` (ISC) with the licence notice retained in the file header; only the stroke width changes, from Lucide's source `2` to the design system's `1.5`. Consequences that are binding, not advisory: new glyphs are added to **this same file from this same source**, an icon is **never hand-drawn**, a second icon set stays a review failure, and the `size` prop is the union `16 \| 20` so an off-scale icon is a compile error. Full specification in `PLAN.md` F0 §3.10. |
| 19 | 2026-08-04 | **`scripts/validate-palette.mjs` + `npm run validate:palette` — a zero-dependency colour gate in the repository. Lands in F1.** | `DESIGN_SYSTEM.md` §9.1 requires re-running the validator whenever a colour moves, and every figure in §9.2 — including the four measured brand-colour FAILs that decision #6 rests on — was produced by a validator that existed only in the `designer`'s working directory. Until it is in the repository the `reviewer` **cannot falsify a colour claim**, which makes §9.1 unenforceable and #6 unauditable: a governance gap, not a missing convenience. Zero dependencies is part of the decision, not an aspiration — §9.1 is pure arithmetic (matrix multiplies, a cube root, CIEDE2000's piecewise formula), and a colour library would create a second authority on what the numbers mean. Reads `src/styles/tokens.css` as the single source of truth and never carries its own copy of a hex value. Exit `0` pass / `1` regression, **including a recorded FAIL that silently became a PASS** / `2` input error. `DESIGN_SYSTEM.md` §9.2's calibration run **V-1** is the validator's own permanent regression test, and F1 must additionally assert the colour maths against published reference data (the Sharma/Wu/Dalal CIEDE2000 dataset) — reproducing §9.2 proves consistency with the `designer`'s implementation, not correctness. The two CVD models stay separately assertable and the reported figure names its model, because §9.1 mandates "the worse of the two" and they disagree materially on tritanopia. Technical shape in `PLAN.md` F0 §9.6. |
| 20 | 2026-08-04 | **The upstream-attribution constraint is removed from this project, and with it `S-12` from the §7 security-audit item list** (CR-005, `PLAN.md` §5.5). Forward-going only: the constraint stops applying from here on, and existing gate records, evidence entries and commit messages stand verbatim. Decided by Rishabh in session, 2026-08-04 (`PLAN.md` §5.5 → CR-005). | The repository is going private and he does not regard the exposure as a problem, so the control no longer protects anything — and a standing audit item that cannot fail is worse than none, because it consumes a gate and implies a guarantee the project is not making. **`S-12`'s number is retained as a gap, never reused**: `S-13` and `S-14` are cited by identifier across `PLAN.md`, the agent definitions and the review history, so renumbering would silently retarget every one of those citations. The audit list becomes S-1…S-11 plus S-13…S-14. `S-5` (no secrets) and the `.gitignore` entries for `private/` and `data/` are **unaffected** — those exist for a 66 MB binary and local-only tooling and are unrelated. No stack, layering, API-surface, routing or performance-budget consequence. |
