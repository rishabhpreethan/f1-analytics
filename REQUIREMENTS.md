# F1 Analytics — Requirements

**Status:** v2
**Last updated:** 2026-08-06 — §2.2/§2.5 round count corrected to 22 (was 24)

Defines *what* the product must do and *which data exists to do it with*. Every figure here was
counted from the loaded database, not estimated.

Companion documents:

| Doc | Purpose |
|---|---|
| `docs/ARCHITECTURE.md` | System architecture and technical decisions |
| `docs/DATABASE.md` | Full schema reference and query patterns |
| `docs/DESIGN_SYSTEM.md` | Visual language, motion vocabulary, chart conventions |
| `PLAN.md` | Feature breakdown, branch strategy, how work flows. **`TASKS.md` is the tracker.** |

**Data foundation.** The application reads a **local, pre-seeded read-only SQLite database**
(`data/f1.db`, ~66 MB) covering 1950–2026. It is populated offline by a separate local tooling step
that is **not part of this repository**; the application never fetches from any third party at
runtime. Treat the database as a fixed input: its contents and limits are catalogued in §2, and
`docs/DATABASE.md` is the authoritative schema reference.


---

## 1. Purpose & Scope

A web application for Formula 1 viewers that turns race data into explanations. The target user
watched the race (or didn't) and wants to understand **what happened and why** — not just look up
a results table.

The product differentiator is **lap-level analysis**. Aggregate season stats are commodity;
per-lap position and timing data is what supports strategy reconstruction, pace analysis, and
race narrative. That data exists from 1996 and is the core asset this app is built on.

**Audience:** F1 viewers with moderate-to-high interest. Assumes familiarity with terms like
pole, stint, undercut, DNF. Not a beginners' explainer, not a professional strategy tool.

### 1.1 Design principles

1. **Never show a chart the data can't honestly support.** Where a metric is unavailable for a
   season, the UI states so rather than rendering an empty or misleading chart.
2. **Cross-era comparisons must be normalized.** Raw points are not comparable across eras
   (see §5.2). Any all-time leaderboard must declare its normalization.
3. **Read-only.** No user accounts, no user-generated content in v1.
4. **The database is the source of truth at request time.** The app makes no third-party
   network calls on a user request path (§7).

---

## 2. Data Foundation

### 2.1 What is in the database

`data/f1.db` — SQLite, **66.4 MB**, 18 tables, seasons **1950–2026**. Full schema in
`docs/DATABASE.md`. Row counts, all verified:

| Table | Rows | Contents |
|---|---|---|
| `lap` | **717,764** | per-lap time, position, average speed |
| `session_entry` | 50,842 | one row per car per session — the central fact table |
| `driver_championship` | 36,091 | standings snapshot after each points session |
| `round_entry` | 27,522 | car entries per round |
| `team_championship` | 14,205 | constructor standings snapshots |
| `pit_stop` | 12,700 | stop number, lap, duration |
| `session` | 5,130 | race, qualifying, sprint and practice sessions |
| `team_driver` | 3,627 | driver ↔ team ↔ season |
| `round` | 1,173 | race weekends |
| `driver` | 881 | |
| `team` | 214 | |
| `circuit` | 78 | |
| `season` | 77 | |
| `point_system` | 24 | per-session scoring rules |
| `championship_system` | 11 | per-era championship rules |
| `championship_adjustment` | 3 | points penalties |
| `base_team`, `penalty` | 0 | defined but unpopulated |

### 2.2 Data currency

The database is a **point-in-time snapshot**, refreshed by the offline tooling step. At the time of
writing it holds results through **2026 round 10**, with **22 numbered rounds** scheduled.

**22, not 24 — and the difference is a data trap, not a typo.** The `round` table holds **24** rows
for 2026, but two of them are cancelled and carry `number IS NULL`: Bahrain (`2026-04-12`) and
Saudi Arabian (`2026-04-19`). A season's round count is therefore the count of **uncancelled**
rounds — equivalently `max(number)` — and **never `count(*)`** (`docs/DATABASE.md` §7 trap 15).
Verified by query on 2026-08-06: for 2026, `count(*) = 24`, `max(number) = 22`,
`sum(is_cancelled) = 2`, `sum(number IS NULL) = 2`; `GET /api/meta` reports
`scheduledRounds: 22`, `cancelledRounds: 2`, `completedRounds: 10`.

**Requirements:**
- The UI must render a **partially complete season** correctly, and must never present a scheduled
  future round as a missing result.
- Any round count shown to a user is the **uncancelled** count. A cancelled round is never
  addressable by round number and never counts toward "N of M rounds".
- The most recent completed round may lag reality by up to ~2 weeks. Any "latest race" surface must
  read the newest round *present in the database*, never assume today's calendar position.
- A visible data-vintage indicator is required (NV-9).

### 2.3 Read-only at runtime

The application performs **no writes** and **no third-party network calls** on any request path.
Refreshing the database is an operator action outside the app.


### 2.4 Coverage matrix — the single most important table here

Counted directly from the loaded database. **`sessions`** is how many exist; **`entries`** is how
many classification rows they hold; **`with laps`** is how many have actual lap rows.

| Type | Sessions | Entries | With laps | Years |
|---|---|---|---|---|
| `R` race | 1,173 | 26,093 | **578** | 1950–2026 |
| `QB` legacy quali | 1,325 | 2,488 | 112 | 1950–2005 |
| `Q1` / `Q2` / `Q3` | 423 each | 8,587 / 6,271 / 3,981 | 409 / 409 / 408 | 2006–2026 |
| `SR` sprint race | 30 | 568 | 28 | 2021–2026 |
| `SQ1`–`SQ3` | 24 each | 424 / 319 / 210 | 21 each | 2023–2026 |
| `QA` | 12 | 223 | 12 | 2005 |
| `QO` | 34 | **0** | 0 | 2003–2004 |
| `FP1` | 423 | **698** | **34** | 2006–2026 |
| `FP2` | 399 | **489** | **24** | 2006–2026 |
| `FP3` | 393 | **491** | **24** | 2006–2026 |

**Race lap coverage by decade** — the basis of the flagship features:

| Decade | Races | With lap data |
|---|---|---|
| 1950s–1980s | 484 | **0** |
| 1990s | 162 | 65 (from 1996) |
| 2000s | 174 | **174** |
| 2010s | 198 | **198** |
| 2020s | 155 | 141 (rest are future rounds) |

Derived data windows:

| Data | Usable from |
|---|---|
| Race results | **1950** |
| Qualifying positions | **1994**, and **holed until 2003** — see below |
| Q1/Q2/Q3 segments | **2006** |
| **Lap times** | **1996** |
| **Pit stops** | **2011** |
| Sprint | **2021** |
| Sprint qualifying | **2023** |

#### ⚠ Two traps in this data

1. **Practice is effectively unusable.** 423 FP1 sessions exist, but only **698 entries** across
   all of them (~35 sessions' worth) and only **34** have lap rows. `session_entry.time_ms` is
   **NULL for every practice entry** — practice rows carry position, `laps_completed` and
   `fastest_lap_rank` but no times. **Do not build practice features** (§6).

2. **`session.has_time_data` is not reliable.** It disagrees with reality in both directions:
   `R` is flagged 442 but 578 sessions actually have lap rows; `FP1` is flagged 116 but only 34 do.
   **Queries must test for the existence of `lap` rows**, not trust the flag.

3. **The qualifying window is a hole, not a boundary — added 2026-08-08 in F4.** "Usable from
   1994" is true of the first row and false of everything a career metric needs. Counted per
   year, rounds holding **any** qualifying classification against rounds with a race:

   | 1994 | 1995 | 1996 | 1997 | 1998 | 1999 | 2000 | 2001 | 2002 | 2003+ |
   |---|---|---|---|---|---|---|---|---|---|
   | 15/16 | 17/17 | 7/16 | 10/17 | 7/16 | 3/16 | 4/17 | **1/17** | 2/17 | complete |

   Nothing before 1994 has one at all — 0 of 484 races in the 1950s–80s, 0 of the first four
   1990s seasons. **Any pole or qualifying-delta figure must publish the number of races it
   could have been measured on**, or Senna reads 0 poles from 161 races and Häkkinen reads
   far fewer than the record shows. `docs/DATABASE.md` §7 trap 23 is the authority.

**Requirement:** every feature below declares its coverage window. The UI must degrade gracefully
outside it — disable the control and explain why, never render a blank chart.


### 2.5 Current-season liveness

2026 is in progress: **22 numbered rounds** scheduled — 24 `round` rows of which 2 are cancelled with
`number IS NULL`, see §2.2 — and results through **R10** (Belgian GP, `2026-07-19`) in the dump. The
next round with no results is **R11** (Hungarian GP, `2026-07-26`), whose real-world date has already
passed: that gap *is* the ~2-week lag §2.2 warns about, and it is why no surface may infer the latest
round from today's date. The app must handle a **partially complete season** as the default view, and
must not present a scheduled future round as a missing result.


## 3. Verified field inventory

Columns as loaded into SQLite (`db/schema.sql`). Feature specs reference these.

**Shape.** The schema normalizes around `session`: there is no separate results / qualifying /
sprint table. All three are one `session_entry` table discriminated by `session.type`. Every query for
"race results" therefore filters `session.type = 'R'`.

```
season ── round ── session ── session_entry ── lap ── pit_stop
                     │            └── round_entry ── team_driver ── driver
                     └── point_system                            └── team
```

**`session`** — `type` ∈ `R`, `Q1`/`Q2`/`Q3`, `SQ1`–`SQ3`, `SR` (sprint race), `FP1`–`FP3`,
and legacy `QB` (1950–2005), `QO` (2003–04), `QA` (2005).
```
id, api_id, round_id, type, number, point_system_id,
scheduled_laps, timestamp, timezone, has_time_data, is_cancelled
```
`has_time_data` flags whether lap-level timing exists — **check it before offering a lap chart.**

**`session_entry`** — one row per car per session; the central fact table.
```
id, api_id, session_id, round_entry_id, position, grid, points, laps_completed,
status, detail, fastest_lap_rank, is_classified, is_eligible_for_points, time_str, time_ms
```
- `status` is an **integer enum**; `detail` is the human-readable form (`Finished`, `Engine`,
  `Collision`, …). Prefer `detail` for display, `status` for grouping.
- `is_classified` is the canonical non-finisher flag — do not infer it from `position` being NULL.
- `is_eligible_for_points` matters for historical cases where a car scored nothing by rule.
- `time_ms` is parsed from `time_str` at load.

**`lap`** — 717,764 rows.
```
id, api_id, session_entry_id, number, position, time_str, time_ms,
average_speed, is_entry_fastest_lap, is_deleted
```
`is_deleted` marks laps invalidated (e.g. track limits) — **exclude from pace metrics.**
`average_speed` and `is_deleted` are not available from the REST API.

**`pit_stop`** — `id, api_id, session_entry_id, lap_id, number, duration_str, duration_ms, local_timestamp`.
Joins to `lap` directly, so a stop is tied to a specific lap row rather than a lap number.

**`round`** — `id, api_id, season_id, circuit_id, number, race_number, name, date, is_cancelled, wikipedia`.
`is_cancelled` exists — a cancelled round is not a data gap.

**`driver`** — `id, api_id, reference, forename, surname, abbreviation, permanent_car_number,
date_of_birth, nationality, country_code, wikipedia`. `reference` is the API slug
(`max_verstappen`) and is the join key to REST-API responses.

**`team`** — `id, api_id, reference, name, base_team_id, nationality, country_code,
primary_color, wikipedia`.
`primary_color` is populated for **12 of 214** teams (current grid only) — historical teams still
need a local palette (§6). `base_team_id` links successive identities of one organisation.

**`team_driver`** — `id, api_id, season_id, team_id, driver_id, role`. Resolves the
driver↔team↔season relationship properly, including mid-season changes.

**`round_entry`** — `id, api_id, round_id, team_driver_id, car_number`.

**`driver_championship` / `team_championship`** — standings snapshots after each points session.
```
id, driver_id|team_id, season_id, round_id, session_id, year, round_number, session_number,
points, position, win_count, highest_finish, is_eligible, adjustment_type
```
`year` / `round_number` / `session_number` are denormalized, so championship progression needs
no joins. `highest_finish` supports countback tie-breaks.

**`point_system`** — per-session scoring rules.
```
id, api_id, name, reference, driver_position_points, driver_fastest_lap,
team_position_points, team_fastest_lap, is_double_points, partial, shared_drive
```

**`championship_system`** — per-era championship rules. 11 rows spanning 1950–2026.
```
id, api_id, name, reference, eligibility, driver_best_results, driver_season_split,
team_best_results, team_points_per_session, team_season_split
```
`driver_best_results > 0` means only that many results counted that era (4 in 1950–53, 5 in
1954–57, 6 in 1958–65, 11 in 1981–90); `-1` means all results count. **This is the data that
makes §5.2 exact instead of hand-coded.**

**`championship_adjustment`** — `id, api_id, season_id, driver_id, team_id, adjustment, points`.
Points penalties (3 rows — e.g. constructor exclusions).

**Enum meanings** are not present in the data. A decode table must be maintained locally and
version-noted; see §9.2.
Any UI mapping of `status`, `role`, `adjustment_type`, or `eligibility` must cite the model
version it was read from.


## 4. Feature Requirements

Priorities: **P0** = v1 must ship · **P1** = v1 if time · **P2** = later.

### 4.1 Race Deep Dive — the flagship

The primary reason this app exists. Requires lap data (1996+) and pit data (2011+).

| ID | Feature | Data | Coverage | Pri |
|---|---|---|---|---|
| RD-1 | **Position chart** — per-lap position for every driver, one line each; the whole race as one picture | `laps` → position | 1996+ | **P0** |
| RD-2 | **Lap time traces** — lap time vs lap number per driver, multi-select | `laps` → time (parsed) | 1996+ | **P0** |
| RD-3 | **Stint reconstruction** — pit laps segment the race; show stint boundaries and length | `pitstops` + `laps` | 2011+ | **P0** |
| RD-4 | **Pace degradation** — per-stint linear fit of lap time vs lap; surfaces tyre wear | `laps` + `pitstops` | 2011+ | **P0** |
| RD-5 | **Gap to leader** — cumulative lap time delta vs leader, per lap | `laps` → time | 1996+ | **P1** |
| RD-6 | **Position-change events** — lap-by-lap position deltas, pit-stop-driven changes distinguished from on-track | `laps` + `pitstops` | 2011+ | **P1** |
| RD-7 | **Pit stop timeline** — every stop by lap and duration, team-coloured | `pitstops` | 2011+ | **P0** |
| RD-8 | **Undercut/overcut analysis** — compare lap times of two drivers either side of pit laps | `pitstops` + `laps` | 2011+ | **P2** |
| RD-9 | **Consistency** — stdev of lap times per driver, excluding pit/outlier laps | `laps` | 1996+ | **P1** |
| RD-10 | **Race results table** — full classification with `positionText`, gaps via `Time.millis`, status | `results` | 1950+ | **P0** |
| RD-11 | **Weekend session times** — FP1/2/3, Qualifying, Sprint with local-time conversion | `races` schedule | modern | **P1** |
| RD-12 | **Strategy comparison** — overlay two drivers' stint plans side by side | `pitstops` + `laps` | 2011+ | **P2** |

**RD-4 note:** pit laps and the lap immediately following must be excluded from degradation fits,
and safety-car laps distort results. There is no safety-car flag in the data (§6) — detect
candidate SC periods heuristically (field-wide simultaneous lap-time inflation) and label them
*inferred*, never as fact.

### 4.2 Season & Championship

| ID | Feature | Data | Coverage | Pri |
|---|---|---|---|---|
| SC-1 | **Championship progression** — cumulative points by round, driver and constructor | `driverstandings` / `constructorstandings` per round | 1950+ | **P0** |
| SC-2 | **Points gap to leader** over the season | standings per round | 1950+ | **P0** |
| SC-3 | **Current standings table** — position, points, wins | standings | 1950+ | **P0** |
| SC-4 | **Season calendar** with completed/upcoming split and results links | `races` + `results` | 1950+ | **P0** |
| SC-5 | **Title permutation calculator** — remaining rounds × max points; who is still mathematically alive | standings + `races` | 1950+ | **P1** |
| SC-6 | **Season summary** — winners per round, pole sitters, fastest laps | `results` + `qualifying` | 1950+ (FL 2004+) | **P1** |
| SC-7 | **Form guide** — rolling N-race average finish/points per driver | `results` | 1950+ | **P2** |
| SC-8 | **Partial-season handling** — 2026 shows 11 of 23 complete without breaking charts | all | — | **P0** |

### 4.3 Driver

| ID | Feature | Data | Coverage | Pri |
|---|---|---|---|---|
| DR-1 | **Profile** — name, code, number, nationality, DOB, computed age, career span | `drivers` | 1950+ | **P0** |
| DR-2 | **Career totals** — starts, wins, podiums, points finishes, poles, fastest laps, DNFs, championships | `results` + `qualifying` + `standings` | 1950+ | **P0** |
| DR-3 | **Season-by-season table** — one row per season: team, points, position, wins | `results` + `standings` | 1950+ | **P0** |
| DR-4 | **Grid vs finish** — positions gained/lost per race, and career mean | `results` → grid, position | 1950+ | **P0** |
| DR-5 | **Qualifying vs race delta** | `qualifying` + `results` | 1994+ | **P0** |
| DR-6 | **Team history** — every constructor driven for, with dates | `/drivers/{id}/constructors/` | 1950+ | **P1** |
| DR-7 | **Circuit form** — record per track, best/mean finish | `/drivers/{id}/circuits/` + results | 1950+ | **P1** |
| DR-8 | **Reliability** — DNF rate and cause breakdown from status codes | `results` → status | 1950+ | **P1** |
| DR-9 | **Pace profile** — lap time distribution across a season | `laps` | 1996+ | **P2** |

### 4.4 Constructor

| ID | Feature | Data | Coverage | Pri |
|---|---|---|---|---|
| CN-1 | **Profile + honours** — nationality, seasons active, titles | `constructors` + `standings` | 1950+ | **P0** |
| CN-2 | **Season performance** — points, position, wins by season | `constructorstandings` | 1958+¹ | **P0** |
| CN-3 | **Driver lineup by season** | `/constructors/{id}/drivers/` + results | 1950+ | **P0** |
| CN-4 | **Intra-team driver split** — points contribution per driver | `results` grouped | 1950+ | **P0** |
| CN-5 | **Reliability by season** — mechanical DNFs per race | `results` → status | 1950+ | **P1** |
| CN-6 | **Pit crew performance** — mean/median stop duration, season ranking | `pitstops` | 2011+ | **P1** |
| CN-7 | **Qualifying pace** — mean grid position by season | `qualifying` | 1994+ | **P1** |

¹ Constructors' Championship began 1958; driver results exist from 1950.

### 4.5 Head-to-Head

| ID | Feature | Data | Coverage | Pri |
|---|---|---|---|---|
| HH-1 | **Teammate comparison** — same car, same races: quali and race wins against each other | `results` + `qualifying` | 1994+ | **P0** |
| HH-2 | **Any two drivers, any seasons** — with an explicit "different car" caveat | `results` | 1950+ | **P1** |
| HH-3 | **Constructor vs constructor** by season | `constructorstandings` | 1958+ | **P1** |
| HH-4 | **Lap-time head-to-head** in a single race | `laps` | 1996+ | **P1** |
| HH-5 | **Qualifying gap** — Q3 time delta between teammates | `qualifying` Q3 | 2006+ | **P2** |

**HH-1 is the fairest comparison available in this dataset** — same machinery, same conditions —
and should be prominent.

### 4.6 Circuits

| ID | Feature | Data | Coverage | Pri |
|---|---|---|---|---|
| CI-1 | **Circuit profile** — name, locality, country, coordinates, map | `circuits` | 1950+ | **P0** |
| CI-2 | **Race history at venue** — every race, winner, pole | `/circuits/{id}/results/` | 1950+ | **P0** |
| CI-3 | **Most successful drivers/teams** at the circuit | results grouped | 1950+ | **P0** |
| CI-4 | **Overtaking index** — mean position changes per race, ranks circuits | `laps` | 1996+ | **P1** |
| CI-5 | **Pole conversion at venue** — how often P1 wins here | `/grid/1/results/` | 1950+ | **P1** |
| CI-6 | **Typical strategy** — modal stop count | `pitstops` | 2011+ | **P2** |

### 4.7 Records & Cross-Era

| ID | Feature | Data | Coverage | Pri |
|---|---|---|---|---|
| RC-1 | **All-time leaderboards** — wins, poles, podiums, starts, fastest laps | `results` + `qualifying` | 1950+ | **P0** |
| RC-2 | **Normalized cross-era comparison** — win rate, podium rate, % of available points (see §5.2) | results + season race counts | 1950+ | **P0** |
| RC-3 | **Grid-slot outcome distribution** — finish distribution by starting position | `/grid/{n}/results/` | 1950+ | **P1** |
| RC-4 | **Retirement-cause atlas** — 136 status codes over time; the reliability-improvement story | `status` + results | 1950+ | **P1** |
| RC-5 | **Streaks** — consecutive wins, podiums, points finishes, DNFs | `results` | 1950+ | **P2** |
| RC-6 | **Era dashboards** — group seasons by regulation era, compare | all | 1950+ | **P2** |

### 4.8 Navigation & Platform

| ID | Feature | Data | Coverage | Pri |
|---|---|---|---|---|
| NV-1 | **Global search** — drivers, constructors, circuits, races | all entities | — | **P0** |
| NV-2 | **Season/round selector** available app-wide | `seasons` + `races` | — | **P0** |
| NV-3 | **Landing page** at `/` — the entry surface. Current season state, last race, next race. The season hub is a separate surface at `/seasons` (`ARCHITECTURE.md` §5, §10 #23) | standings + races | — | **P0** |
| NV-4 | **Deep-linkable URLs** — every view addressable and shareable | — | — | **P0** |
| NV-5 | **Responsive** — charts usable on mobile | — | — | **P0** |
| NV-6 | **Light/dark theme** | — | — | **P1** |
| NV-7 | **Chart export** as PNG | — | — | **P2** |
| NV-8 | **Coverage-aware controls** — disable + explain when data is outside its window (§2.4) | — | — | **P0** |

**NV-3 is split across features.** F0 ships the landing *surface* — chrome, motion, and the
figures available from `GET /api/meta` (season span, round progress, last and next round). Its
standings and race-result content lands with F2. The landing page never renders a statistic that
is not in an API response.

---

## 5. Analytical requirements

### 5.1 Derived metric definitions

Every computed metric must have one documented definition, applied consistently:

- **Podium** — finishing position 1–3.
- **Points finish** — `points > 0` for that event. *Not* "top 10" — the points-paying range
  changed repeatedly across eras.
- **DNF** — `positionText` indicates retirement, or `status` is neither `Finished` nor a
  `+n Lap(s)` classification.
- **Start** — a race in which the driver's entry was **not** `status IN (30, 40)`
  (did-not-start / did-not-qualify, `docs/DATABASE.md` §3).
  **Corrected 2026-08-08 in F4.** This previously read *"appearing in race results,
  regardless of classification"*, which contradicted `DATABASE.md` §3's rule that those two
  status codes are excluded from starts counts. DR-2's career totals made the conflict
  load-bearing for the first time and it is resolved toward `DATABASE.md`: a driver who
  withdrew did not start, and that is what the status codes exist to encode. Measured: it
  moves **368 of 26,093** race entries, including one of Michael Schumacher's — his totals
  read 307 starts from 308 races entered.
  **A start is a race, not a classification row.** 83 (driver, race) pairs in the archive
  hold two or three rows because a driver took over a second car mid-race
  (`DATABASE.md` §7 trap 17), and counting rows would give Ascari two starts and a
  retirement in the 1950 Italian Grand Prix he finished second in.
- **Positions gained** — `grid - position`, excluding DNFs and pit-lane starts (`grid = 0`).
- **Fastest lap count** — `FastestLap.rank == 1`. **2004+ only** — and additionally present
  on **1958–59 alone** among earlier seasons, with nothing between 1960 and 2003
  (`DATABASE.md` §7 trap 24). A career total is therefore not comparable across the
  boundary and must be published with the count of races it could have been measured on.
- **Stint** — laps between pit stops (or race start/end). **2011+ only.**
- **Clean lap** — excludes lap 1, in/out laps around a stop, and inferred SC laps. Required for
  any pace metric.

### 5.2 Cross-era normalization — mandatory, and now exact

Raw points comparisons across eras are invalid and the app must not present them as valid:

- Points systems changed materially — the loaded `point_system` table has **24 distinct systems**.
- Season length ranges from **7 races (1950) to 24 (2024/2026)**.
- Several eras counted only a driver's **best N results**, verified from `championship_system`:

| Era | `driver_best_results` |
|---|---|
| 1950–1953 | 4 |
| 1954–1957 | 5 |
| 1958, 1960, 1963–65 | 6 |
| 1959, 1961, 1962, 1966 | 5 |
| 1967–1978 | split season (`-2`) |
| 1979 | 4 |
| 1980 | 5 |
| 1981–1990 | 11 |
| 1991–2001, 2002–2025, 2026– | all results (`-1`) |

**This is a data-driven requirement, not a hand-coded one.** Any career or cross-era aggregate
**must** join `season → championship_system` and apply the era's actual rule. Summing raw
`session_entry.points` across eras is a defect, not an approximation — a driver's 1950s championship
total is not the sum of their race points.

Cross-era views must additionally use rate- or share-based metrics — win rate, podium rate,
percentage of maximum available points, mean finishing position — and **display the normalization
used**. `SC-1` (within one season) may use raw points.


### 5.3 Honesty requirements

- Inferred quantities (safety car periods, on-track vs pit-driven overtakes) are labelled inferred.
- Pit stop durations are not compared across eras without a caveat (§3).
- Where a season lacks data for a chart, say which data is missing and from when it exists.

---

## 6. Explicitly out of scope — data does not exist

Recording these so they don't get promised. **None** of the following exists in the database:

| Not available | Consequence |
|---|---|
| **Tyre compounds / tyre age** | No compound-coloured stints. Stints are lap ranges only. |
| **Weather, track/air temperature** | No wet/dry context for pace analysis. |
| **Sector and mini-sector times** | No sector-level comparison. |
| **Telemetry** — speed, throttle, brake, gear, RPM, DRS | No driving-style or corner analysis. `lap.average_speed` is a per-lap aggregate, not a trace. |
| **Safety car / VSC / red flag flags** | Inferable heuristically at best (§4.1 note). |
| **Stewards' decisions and reasoning** | `championship_adjustment` and `penalty` exist but hold 3 and 0 rows respectively — effectively unpopulated. |
| **Gap-at-line per lap** | Computable cumulatively from `lap.time_ms`, but drift accumulates. |
| **Engine / chassis manufacturer** | Not in the dataset. Would require an additional source — see §9.2. |
| **Track length, scheduled race distance** | `session.scheduled_laps` exists; circuit length does not. |
| **Driver contracts, salaries, radio, images** | Out of scope entirely. |

**Practice sessions — present but not usable.** FP1/FP2/FP3 rows exist from 2006 (423/399/393
sessions) but hold only **698 / 489 / 491 entries** in total, with lap rows for just **34 / 24 / 24**
sessions and **no session times at all** (`time_ms` is NULL for every practice entry). This is
metadata, not a dataset. FP→Q→R progression analysis is **out of scope** — treat practice as
schedule information only.

**Corrected from v1** — the dump does provide these, which v1 wrongly listed as unavailable:

| Now available | Detail | Caveat |
|---|---|---|
| **Point & championship rule systems** | 24 point systems, 11 championship systems (§5.2) | Enum encodings must be maintained locally (§9.2) |
| **Invalidated laps** | `lap.is_deleted` — exclude from pace metrics | — |
| **Per-lap average speed** | `lap.average_speed` | Per-lap aggregate, not a telemetry trace |
| **Team colours** | `team.primary_color` | Only **12 of 214** teams (current grid); historical teams still need a local palette |
| **Circuit altitude** | `circuit.altitude` | — |
| **Cancelled-round flag** | `round.is_cancelled` | A cancelled round is not a data gap |
| **Classification flags** | `is_classified`, `is_eligible_for_points` | Explicit flags rather than inferred from a null position |


If tyre, weather, sector, or telemetry features become required, the data source must change —
**FastF1** (official F1 timing wrapper, 2018+) is the natural addition. That is a deliberate
future decision, not a v1 assumption.


## 7. Data layer requirements

### 7.1 Architecture

```
data/f1.db (read-only SQLite, pre-seeded)  ──▶  query layer  ──▶  React client
```

See `docs/ARCHITECTURE.md` for the full picture. Constraints that bind the application:

| ID | Requirement |
|---|---|
| DL-1 | **Open the database read-only.** No writes, ever. Any write is a defect. |
| DL-2 | **No third-party network calls on a request path.** All data comes from the local database. |
| DL-3 | **Never surface internal integer ids in URLs.** Use the stable public identifiers or the human-readable slugs (`driver.reference` = `max_verstappen`) — see `docs/DATABASE.md`. |
| DL-4 | **Aggregates must be precomputed or cached**, not recomputed per request (§8 NF-3). |
| DL-5 | **Every query touching `lap` must be bounded** by session, driver, or lap range. `lap` holds 717,764 rows; an unbounded scan is a defect. |
| DL-6 | **Exclude invalidated laps** (`lap.is_deleted`) from every pace metric. |
| DL-7 | **Test for the existence of lap rows** rather than trusting the `session.has_time_data` flag, which is unreliable in both directions (§2.4). |
| DL-8 | **Apply the era's championship rule** from `championship_system` for any career or cross-era aggregate (§5.2). Summing raw points across eras is a defect. |

### 7.2 Database is an input, not an artefact

`data/f1.db` is **gitignored** and produced by a separate local tooling step outside this
repository. Consequences the whole team must respect:

- **Never commit the database, or any raw seed file.**
- A fresh clone has **no database**. Setup instructions must say the file is supplied separately.
- Schema changes are documented in `docs/DATABASE.md` and mirrored in `db/schema.sql`.


## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NF-1 | Chart interactions (hover, series toggle) respond without a network round trip. |
| NF-2 | Race Deep Dive initial load under ~2 s on broadband, despite ~1,100 lap rows. Consider server-side downsampling for the position chart. |
| NF-3 | Aggregate career/all-time stats served from precomputed tables or materialized views, not computed per request. |
| NF-4 | Accessible charts — colour is never the sole differentiator; keyboard-navigable controls; readable in light and dark themes. |
| NF-5 | No secrets in the repository. `.env` and `data/` gitignored **and verified untracked** before first push. The only credential-free-by-construction benefit of local SQLite is real — keep it that way. |
| NF-6 | Graceful degradation when a data type is missing for the selected season (NV-8). |

---

## 9. Decisions

### 9.1 Settled

1. **Database — local SQLite** at `data/f1.db` via `better-sqlite3`. 66.4 MB loaded. No server, no
   container, no credentials. *Implication:* deployment is not serverless-ready as-is; deferred
   until there is something to deploy. *(Superseded an initial Postgres-in-Docker setup, removed.)*
2. **Data source — the CSV dump is primary**, the REST API secondary and optional (§2). Driven by
   the API's 500 req/hour ceiling, which made a full backfill infeasible.
3. **Schema — the normalized session-centric model** (§3). Chosen because it preserves the
   point/championship rule systems, `lap.is_deleted` and `lap.average_speed`. Cost: enum meanings
   are not carried in the data and must be maintained locally.
4. **Backfill depth — full history, 1950–2026, every table.** Achieved; §2.1 has the row counts.

### 9.2 Still open

5. **Live-round sync.** The free dump lags 14 days, so the newest 1–2 rounds are missing (§2.3).
   Options: (a) accept the lag and re-run the loader periodically — simplest, and the loader is
   idempotent; (b) build a slug→id mapping sync from the REST API, which needs surrogate-id
   allocation that will not collide with future dumps; (c) the supporter tier for same-day dumps,
   which also grants a commercial licence. **Recommendation: (a) until there is a product reason
   for live data.**
6. **Framework** — the feature set is chart-heavy and read-only, which suits server-side
   rendering with a good charting library.
7. **API layer shape** — how the web app queries SQLite (direct server-side queries vs a separate
   API service).
8. **Enum decoding.** `session_entry.status`, `team_driver.role`, `adjustment_type` and
   `eligibility` are integer enums with no in-data definitions. A decode table must
   be built and version-pinned before any UI displays them (`session_entry.detail` covers the
   common case for status display without decoding).
9. **Whether to add a supplementary source** for engine/chassis manufacturer and circuit length
   (§6). Evaluated options were either too rate-limited to seed a dataset or licensed unsuitably.
   Deferred; not required for any v1 feature.
10. **Whether to add a timing-telemetry source** for tyre/weather/sector data from 2018 onward.
    The single largest possible expansion of analytical capability; would change §6 substantially.
11. **Licensing.** Dataset redistribution terms are recorded outside this repository. The database
    is never committed (§7.2). Confirm terms before any public deployment.

---

## Appendix A — Verified data facts

Every figure below was counted from `data/f1.db`. Re-verify after any database refresh.

**Integrity**
- 18 tables, all row counts reconciled against source counts
- `PRAGMA foreign_key_check` → **zero violations**
- Zero rows where a duration string is present but its parsed millisecond value is NULL, across
  `lap`, `session_entry` and `pit_stop`

**Known-answer checks**
- 2026 final-round-to-date driver standings resolve correctly from `driver_championship`
- 2024 final standings: Verstappen 437 (9 wins), Norris 374, Leclerc 356, Piastri 292, Sainz 290
- 2024 Bahrain: Verstappen fastest lap = **92,608 ms → 1:32.608**; 57 laps recorded per classified
  finisher

**Coverage**
- Race lap data: **0** of 484 races in the 1950s–80s; 65/162 in the 1990s (from 1996); 174/174 in
  the 2000s; 198/198 in the 2010s; 141/155 in the 2020s (remainder are future rounds) — §2.4
- Pit stops from **2011**
- Qualifying positions usable from **1994** — legacy qualifying sessions exist back to 1950 but hold
  **zero entries before 1990** — §2.4
- Practice sessions exist from 2006 but are near-empty: 698/489/491 entries for FP1/FP2/FP3, only
  34/24/24 sessions with lap rows, and no session times at all — **out of scope** (§6)
- `session.has_time_data` is unreliable in both directions (races flagged 442 vs 578 actual; FP1
  flagged 116 vs 34 actual) — queries must test for `lap` rows (DL-7)
- 11 championship systems spanning 1950–2026, with per-era `driver_best_results` — §5.2
- 12 of 214 teams carry a brand colour; the rest need a local palette — §6
