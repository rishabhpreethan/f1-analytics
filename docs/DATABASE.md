# Database Reference

**Authoritative schema reference for all agents.** If a query or feature contradicts this
document, this document wins — or the document is wrong and must be corrected in the same PR.

`data/f1.db` — SQLite, **66.4 MB**, 18 tables, seasons **1950–2026**.
DDL lives in `db/schema.sql`. The database is **read-only at runtime** and **never committed**.

---

## 1. Mental model

The schema is **session-centric**. There is no `race_results` table, no `qualifying_results` table,
no `sprint_results` table. Every on-track classification is one row in `session_entry`, and you
discriminate by `session.type`.

```
season ──┬── round ──┬── session ──── session_entry ──┬── lap ──── pit_stop
         │           │      │                         │
         │           │      └── point_system          └── (points, position, grid, status)
         │           │
         │           └── round_entry ──── team_driver ──┬── driver
         │                                              └── team
         └── championship_system

driver_championship / team_championship  ← standings snapshots (denormalized, query directly)
```

**The single most important consequence:** getting from a lap to a driver name is a five-join path.

```sql
lap → session_entry → round_entry → team_driver → driver
```

Do not rediscover this per feature. Use the canonical views in §6.

---

## 2. Table reference

### 2.1 Rule systems

These exist so cross-era comparison is *exact* rather than hand-coded. See §5.

#### `championship_system` — 11 rows
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `api_id`, `name`, `reference` | TEXT | |
| `driver_best_results` | INTEGER | **`> 0`** = only that many results counted. **`-1`** = all count. **`-2`** = split season. |
| `driver_season_split`, `team_best_results`, `team_points_per_session`, `team_season_split` | INTEGER | |
| `eligibility` | INTEGER | enum, meaning not in data |

Actual values — **required reading before writing any career aggregate**:

| Era | `driver_best_results` |
|---|---|
| 1950–1953 | 4 |
| 1954–1957 | 5 |
| 1958, 1960, 1963–65 | 6 |
| 1959, 1961, 1962, 1966 | 5 |
| 1967–1978 | `-2` (split season) |
| 1979 | 4 |
| 1980 | 5 |
| 1981–1990 | 11 |
| 1991–2001, 2002–2025, 2026– | `-1` (all count) |

#### `point_system` — 24 rows
Per-session scoring rules. `driver_position_points` is an encoded per-position award table;
`driver_fastest_lap` is the fastest-lap bonus; `is_double_points` covers the 2014 finale.
Joined via `session.point_system_id`.

### 2.2 Dimensions

#### `season` — 77 rows
`id`, `api_id`, `year` (unique), `championship_system_id`, `wikipedia`.

#### `circuit` — 78 rows
`id`, `api_id`, `reference` (slug), `name`, `locality`, `country`, `country_code`,
`latitude`, `longitude`, `altitude`, `wikipedia`.

#### `driver` — 881 rows
`id`, `api_id`, `reference` (slug — `max_verstappen`), `forename`, `surname`, `abbreviation`
(`VER`), `permanent_car_number`, `date_of_birth`, `nationality`, `country_code`, `wikipedia`.

> **`reference` is the URL slug.** Never put `driver.id` in a route.

#### `team` — 214 rows
`id`, `api_id`, `reference`, `name`, `base_team_id`, `nationality`, `country_code`,
`primary_color`, `wikipedia`.

- **`primary_color` is populated for only 12 of 214 teams** (current grid). Everything else is
  NULL — the design system supplies a fallback ramp. See `docs/DESIGN_SYSTEM.md`.
- **`base_team_id`** links successive identities of one organisation (Minardi → Toro Rosso →
  AlphaTauri → RB). `base_team` itself is **empty (0 rows)**, so the ids do not resolve — treat
  lineage as unavailable and do not build features on it.

#### `team_driver` — 3,627 rows
`id`, `api_id`, `season_id`, `team_id`, `driver_id`, `role`. Resolves driver↔team↔season,
including mid-season team changes. `role` is an undocumented enum — do not display it.

### 2.3 Events

#### `round` — 1,173 rows
`id`, `api_id`, `season_id`, `circuit_id`, `number`, `race_number`, `name`, `date`,
`is_cancelled`, `wikipedia`.

- `number` is the round number within the season. `date` is the race date (ISO text).
- **`is_cancelled = 1` is not a data gap.** Never render it as "missing results".

#### `session` — 5,130 rows
`id`, `api_id`, `round_id`, `type`, `number`, `point_system_id`, `scheduled_laps`,
`timestamp`, `timezone`, `has_time_data`, `is_cancelled`.

`type` values:

| Type | Meaning | Sessions | Entries | With laps | Years |
|---|---|---|---|---|---|
| `R` | Race | 1,173 | 26,093 | **578** | 1950–2026 |
| `QB` | Legacy single qualifying | 1,325 | 2,488 | 112 | 1950–2005 |
| `Q1` `Q2` `Q3` | Modern qualifying segments | 423 each | 8,587 / 6,271 / 3,981 | 409 / 409 / 408 | 2006–2026 |
| `SR` | Sprint race | 30 | 568 | 28 | 2021–2026 |
| `SQ1` `SQ2` `SQ3` | Sprint qualifying | 24 each | 424 / 319 / 210 | 21 each | 2023–2026 |
| `QA` | 2005 aggregate qualifying | 12 | 223 | 12 | 2005 |
| `QO` | 2003–04 one-lap qualifying | 34 | **0** | 0 | 2003–2004 |
| `FP1` `FP2` `FP3` | Practice | 423 / 399 / 393 | **698 / 489 / 491** | **34 / 24 / 24** | 2006–2026 |

> ### ⚠ `has_time_data` IS UNRELIABLE
> It disagrees with reality in **both** directions: `R` is flagged on 442 sessions but **578**
> actually have lap rows; `FP1` is flagged on 116 but only **34** do.
>
> **Never gate a feature on this flag.** Test for the existence of `lap` rows instead
> (`EXISTS (SELECT 1 FROM lap …)`).

> ### ⚠ PRACTICE IS NOT A USABLE DATASET
> 423 FP1 sessions hold **698 entries between them**, and `session_entry.time_ms` is **NULL for
> every practice row**. Practice carries position, `laps_completed` and `fastest_lap_rank` only.
> **Do not build practice features.** Treat practice as schedule metadata.

#### `round_entry` — 27,522 rows
`id`, `api_id`, `round_id`, `team_driver_id`, `car_number`. A car's entry into a weekend.

#### `session_entry` — 50,842 rows — **the central fact table**
| Column | Notes |
|---|---|
| `id`, `api_id` | |
| `session_id` | → `session` |
| `round_entry_id` | → `round_entry` (the path to driver and team) |
| `position` | finishing/classified position; **NULL when not classified** |
| `grid` | starting position; `0` means pit-lane start |
| `points` | points from **this session** |
| `laps_completed` | |
| `status` | integer enum — decoded in §3 |
| `detail` | human-readable status (138 distinct values) — **use this for display** |
| `fastest_lap_rank` | `1` = fastest lap of the session |
| `is_classified` | **the canonical finisher flag** — do not infer from `position IS NULL` |
| `is_eligible_for_points` | some entries scored nothing by rule |
| `time_str`, `time_ms` | total session time; `time_ms` pre-parsed |

### 2.4 Lap level

#### `lap` — 717,764 rows — **the largest table**
| Column | Notes |
|---|---|
| `id`, `api_id` | |
| `session_entry_id` | → `session_entry` |
| `number` | lap number |
| `position` | position **on that lap** — the basis of the position chart |
| `time_str`, `time_ms` | lap time; `time_ms` pre-parsed integer |
| `average_speed` | per-lap average (not a telemetry trace) |
| `is_entry_fastest_lap` | this driver's own fastest lap in the session |
| `is_deleted` | **lap invalidated** — MUST be excluded from every pace metric |

> **Every query touching `lap` must be bounded** by session, driver, or lap range. Index is
> `(session_entry_id, number)`. An unbounded scan of 717k rows is a defect.

#### `pit_stop` — 12,700 rows
`id`, `api_id`, `session_entry_id`, `lap_id`, `number`, `duration_str`, `duration_ms`,
`local_timestamp`.

Joins to a specific `lap` row, not a lap number. **Duration semantics vary across eras** (some
stationary time, some pit-lane transit) — never compare durations across decades without a caveat.

### 2.5 Championships

#### `driver_championship` — 36,091 rows · `team_championship` — 14,205 rows
`id`, `driver_id`|`team_id`, `season_id`, `round_id`, `session_id`, `year`, `round_number`,
`session_number`, `points`, `position`, `win_count`, `highest_finish`, `is_eligible`,
`adjustment_type`.

**Standings snapshot after each points-scoring session.** `year`, `round_number` and
`session_number` are denormalized, so championship progression needs **no joins** — this is the
cheapest table in the schema and the right source for any standings chart.

To get final standings for a season, take the max `(round_number, session_number)` pair — see §6.

#### `championship_adjustment` — 3 rows
Points penalties. Effectively unpopulated; do not build features on it.

### 2.6 Empty tables

`base_team` (0) and `penalty` (0) are defined but hold no rows. **No feature may depend on them.**

---

## 3. The `status` enum — decoded

Not documented in the data. Decoded here by grouping `status` against `detail` across all 50,842
entries. **Use `detail` for display; use `status` for grouping.**

| `status` | Meaning | Rows | Representative `detail` values |
|---|---|---|---|
| `0` | **Finished** (full distance) | 11,021 | `Finished` |
| `1` | **Lapped** (classified, down laps) | 7,822 | `+1 Lap`, `+2 Laps`, `+3 Laps` … |
| `10` | **Accident / collision** | 2,694 | `Accident`, `Collision`, `Spun off`, `Collision damage` |
| `11` | **Mechanical retirement** | 7,002 | `Engine`, `Gearbox`, `Suspension`, `Retired`, +86 more |
| `20` | **Disqualified** | 175 | `Disqualified`, `Excluded`, `Underweight` |
| `30` | **Did not start / withdrew** | 372 | `Withdrew`, `Did not start` |
| `40` | **Did not qualify** | 8 | `Did not qualify`, `107% Rule` |

Derived groupings the app should use:

- **Classified finish** → `status IN (0, 1)` (equivalently `is_classified = 1`)
- **DNF** → `status IN (10, 11)`
- **Mechanical DNF** (reliability metrics) → `status = 11`
- **Driver-error / incident DNF** → `status = 10`
- **Never started** → `status IN (30, 40)` — **exclude from "starts" counts**

> This table was reverse-engineered from data, not from a specification. Re-verify after any
> database refresh. `status = 20` contains 2 rows whose `detail` is `Finished` — disqualification
> after classification. Treat `status` as authoritative over `detail` for grouping.

---

## 4. Coverage — what exists, when

| Data | Usable from | Detail |
|---|---|---|
| Race results | **1950** | all rounds |
| Qualifying positions | **1994** | `QB` sessions exist from 1950 but hold **zero entries before 1990** |
| Q1/Q2/Q3 segments | **2006** | |
| **Lap times / positions** | **1996** | see below |
| **Pit stops** | **2011** | |
| Sprint | **2021** | |
| Sprint qualifying | **2023** | |
| Practice | *never* | present but unusable (§2.3) |

**Race lap coverage by decade** — the constraint on the flagship features:

| Decade | Races | With lap data |
|---|---|---|
| 1950s–1980s | 484 | **0** |
| 1990s | 162 | 65 (from 1996) |
| 2000s | 174 | **174** |
| 2010s | 198 | **198** |
| 2020s | 155 | 141 (remainder are future rounds) |

**Requirement:** every lap-dependent surface must detect absence and explain it, never render an
empty chart. See `REQUIREMENTS.md` NV-8.

---

## 5. Cross-era correctness — non-negotiable

**Summing `session_entry.points` across seasons is a defect, not an approximation.**

Three independent reasons:
1. **24 different point systems.** A 1960 win paid 8; a 2026 win pays 25.
2. **Best-N-results rules.** In 1950–53 only a driver's best 4 results counted toward the
   championship. Their championship total is *not* the sum of their race points.
3. **Season length varies 7 → 24 races.**

**Therefore:**
- For a **season** total, read `driver_championship` / `team_championship` — those already apply
  the era's rules.
- For **cross-era** comparison, use rate- or share-based metrics: win rate, podium rate, points as
  a share of the maximum available, mean finishing position.
- Any cross-era surface must **display the normalization it used**.
- Never present a raw all-time points leaderboard.

---

## 6. Canonical query patterns

Implement these **once** in the query layer. Feature code must not re-derive join paths.

### 6.1 Recommended views

Create as SQL views (or as the single source-of-truth query builders):

```sql
-- v_entry: session_entry flattened to human-meaningful columns.
-- The join path every feature needs; define it once.
CREATE VIEW IF NOT EXISTS v_entry AS
SELECT
  se.id            AS entry_id,
  se.session_id,
  ses.type         AS session_type,
  ses.round_id,
  r.number         AS round_number,
  r.name           AS round_name,
  r.date           AS round_date,
  s.year,
  s.id             AS season_id,
  c.id             AS circuit_id,
  c.reference      AS circuit_ref,
  c.name           AS circuit_name,
  d.id             AS driver_id,
  d.reference      AS driver_ref,
  d.abbreviation   AS driver_code,
  d.forename, d.surname,
  t.id             AS team_id,
  t.reference      AS team_ref,
  t.name           AS team_name,
  t.primary_color  AS team_color,
  re.car_number,
  se.position, se.grid, se.points, se.laps_completed,
  se.status, se.detail, se.fastest_lap_rank,
  se.is_classified, se.is_eligible_for_points,
  se.time_ms
FROM session_entry se
JOIN session     ses ON ses.id = se.session_id
JOIN round       r   ON r.id   = ses.round_id
JOIN season      s   ON s.id   = r.season_id
LEFT JOIN circuit c  ON c.id   = r.circuit_id
JOIN round_entry re  ON re.id  = se.round_entry_id
JOIN team_driver td  ON td.id  = re.team_driver_id
JOIN driver      d   ON d.id   = td.driver_id
JOIN team        t   ON t.id   = td.team_id;

-- v_race: races only. Most features want this, not v_entry.
CREATE VIEW IF NOT EXISTS v_race AS
SELECT * FROM v_entry WHERE session_type = 'R';
```

### 6.2 Race classification for one round

```sql
SELECT driver_code, surname, team_name, team_color, grid, position, detail, points, time_ms
FROM v_race
WHERE year = ? AND round_number = ?
ORDER BY (position IS NULL), position;   -- unclassified last
```

### 6.3 Lap traces for a race — bounded, invalid laps excluded

```sql
SELECT ve.driver_ref, ve.driver_code, ve.team_color, l.number AS lap, l.position, l.time_ms
FROM v_race ve
JOIN lap l ON l.session_entry_id = ve.entry_id
WHERE ve.year = ? AND ve.round_number = ?
  AND l.is_deleted = 0            -- DL-6
ORDER BY ve.driver_ref, l.number;
```

### 6.4 Does this race have lap data? (never trust `has_time_data`)

```sql
SELECT EXISTS (
  SELECT 1 FROM v_race ve
  JOIN lap l ON l.session_entry_id = ve.entry_id
  WHERE ve.year = ? AND ve.round_number = ?
) AS has_laps;
```

### 6.5 Championship progression for a season

```sql
SELECT dc.round_number, d.reference AS driver_ref, d.abbreviation, dc.points, dc.position
FROM driver_championship dc
JOIN driver d ON d.id = dc.driver_id
WHERE dc.year = ?
ORDER BY dc.round_number, dc.position;
```

### 6.6 Final standings for a season

```sql
WITH last_snapshot AS (
  SELECT max(round_number * 1000 + session_number) AS k
  FROM driver_championship WHERE year = ?
)
SELECT dc.position, d.reference, d.forename, d.surname, dc.points, dc.win_count
FROM driver_championship dc
JOIN driver d ON d.id = dc.driver_id
JOIN last_snapshot ls ON (dc.round_number * 1000 + dc.session_number) = ls.k
WHERE dc.year = ?
ORDER BY dc.position;
```

### 6.7 Stints from pit stops

```sql
SELECT ve.driver_ref, ps.number AS stop, l.number AS pit_lap, ps.duration_ms
FROM v_race ve
JOIN pit_stop ps ON ps.session_entry_id = ve.entry_id
LEFT JOIN lap l  ON l.id = ps.lap_id
WHERE ve.year = ? AND ve.round_number = ?
ORDER BY ve.driver_ref, ps.number;
```

Stint boundaries are derived in application code: `[1 … pit₁]`, `(pit₁ … pit₂]`, … `(pitₙ … end]`.

### 6.8 Teammate head-to-head — the fairest comparison available

```sql
SELECT a.year, a.round_number, a.driver_ref AS d1, b.driver_ref AS d2,
       a.position AS p1, b.position AS p2, a.grid AS g1, b.grid AS g2
FROM v_race a
JOIN v_race b
  ON a.session_id = b.session_id AND a.team_id = b.team_id AND a.driver_id < b.driver_id
WHERE a.year BETWEEN ? AND ?
ORDER BY a.year, a.round_number;
```

### 6.9 Clean laps for pace analysis

A "clean lap" excludes lap 1, in/out laps around a stop, invalidated laps, and inferred
safety-car laps.

```sql
WITH pit_laps AS (
  SELECT ps.session_entry_id, l.number AS n
  FROM pit_stop ps JOIN lap l ON l.id = ps.lap_id
)
SELECT l.session_entry_id, l.number, l.time_ms
FROM lap l
WHERE l.session_entry_id IN (SELECT entry_id FROM v_race WHERE year = ? AND round_number = ?)
  AND l.is_deleted = 0
  AND l.number > 1
  AND NOT EXISTS (
    SELECT 1 FROM pit_laps p
    WHERE p.session_entry_id = l.session_entry_id
      AND l.number BETWEEN p.n AND p.n + 1     -- in-lap and out-lap
  );
```

Safety-car laps have **no flag in the data**. Detect candidates as laps where the field-wide median
lap time inflates beyond a threshold, and **label them inferred** — never as fact.

---

## 7. Traps — read before writing any query

| # | Trap | Rule |
|---|---|---|
| 1 | `has_time_data` is wrong in both directions | Test for `lap` rows (§6.4) |
| 2 | Practice looks available but is empty | Do not build practice features |
| 3 | `position IS NULL` ≠ DNF | Use `is_classified` / `status` (§3) |
| 4 | Summing points across eras | Use `driver_championship`, or rate metrics (§5) |
| 5 | `base_team` and `penalty` are empty | No lineage or penalty features |
| 6 | `primary_color` NULL for 202 of 214 teams | Design-system fallback required |
| 7 | Unbounded `lap` scans | Always filter by session/driver/range |
| 8 | `is_deleted` laps in pace metrics | Always `AND l.is_deleted = 0` |
| 9 | `grid = 0` means pit-lane start | Exclude from "positions gained" |
| 10 | Pit durations not era-comparable | Caveat any cross-era comparison |
| 11 | Internal `id` in a URL | Use `reference` slugs |
| 12 | `is_cancelled` rounds | Not a data gap; render distinctly |
| 13 | Future rounds in the current season | Not missing data; render as scheduled |
| 14 | Undocumented enums (`role`, `eligibility`, `adjustment_type`) | Do not display |

---

## 8. Performance notes

- **`lap` dominates.** 717,764 rows of the 66 MB total. Every access path goes through
  `idx_lap_entry (session_entry_id, number)`.
- `driver_championship` is denormalized and cheap — prefer it over aggregating `session_entry`.
- Career and all-time aggregates must be **precomputed** (materialized tables refreshed with the
  database) or cached, never computed per request. See `REQUIREMENTS.md` NF-3.
- Open the connection **read-only** and reuse it; SQLite handles concurrent readers well.
- `PRAGMA journal_mode` is already WAL from the load step.

---

## 9. Maintenance

After any database refresh:

1. Re-run integrity checks — foreign keys, parse coverage, row-count reconciliation.
2. Re-verify the coverage tables in §2.3 and §4, and the `status` decode in §3.
3. Update the row counts in this document and `REQUIREMENTS.md` §2.1.
4. Confirm the data-vintage indicator (NV-9) reflects the new snapshot.
