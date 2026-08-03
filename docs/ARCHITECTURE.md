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
| Routing | **React Router v7** (declarative mode) | URL-addressable state is a hard requirement (NV-4). |
| Server data | **TanStack Query v5** | Cache, dedupe, background refetch, loading/error states. Server data is not app state — never mirror it into a store. |
| API server | **Hono** on Node 20+ | Tiny, TS-first, fast. No framework weight needed for GET-only JSON. |
| DB driver | **better-sqlite3**, `readonly: true` | Synchronous; for a local file this beats a pool. |
| Validation | **Zod** | One schema per response, shared client/server. Types derive from schemas. |
| Charts | **Recharts** (standard) + **visx** (lap-scale) | See §4. |
| Motion | **Framer Motion** | Required by the brief. Presets only — see `DESIGN_SYSTEM.md`. |
| Styling | **Tailwind CSS** + CSS custom properties for tokens | Tokens in CSS vars so both Tailwind and chart libraries read the same values. |
| Client state | **URL first**, then `useState` | No Redux/Zustand. If it belongs in a link, it belongs in the URL. |
| Tests (unit) | **Vitest** | |
| Tests (E2E) | **Playwright**, driven via **Playwright MCP** | Owned by the QA agent. See §6. |
| Lint/format | **ESLint** + **Prettier** | |

**Nothing else gets added without a Principal Engineer decision recorded in §10.**

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
| S-12 | **Data provenance** | No provenance detail in code, comments, docs, commit messages, or branch names (`REQUIREMENTS.md` §7.2). The Reviewer greps for this every PR. |
| S-13 | **Rate limiting** | Basic per-IP limit on the API to protect the single-process server. |
| S-14 | **Supply chain** | Pin the Playwright and MCP tooling versions used by QA. |

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
├── db/schema.sql            DDL (reference; database supplied separately)
├── server/
│   ├── index.ts             Hono app, headers, error handler
│   ├── db.ts                readonly connection
│   ├── routes/              one module per resource
│   ├── queries/             ALL SQL
│   ├── schemas/             Zod response schemas
│   └── cache/
├── src/                     React client
│   ├── main.tsx
│   ├── routes/
│   ├── features/            feature hooks + pure selectors
│   ├── components/
│   │   ├── ui/
│   │   └── charts/
│   ├── lib/                 tokens, teamColor, format, motion presets
│   └── styles/
├── e2e/                     Playwright specs (QA-owned)
├── public/
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
