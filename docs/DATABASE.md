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

> ⚠ **"After each points-scoring session" understates it.** From 2026 the table carries a snapshot
> after **Q1, Q2 and Q3 as well**, which change nothing: 962 rows for 2026 against ~484 round-ends.
> A per-round progression must take `max(session_number)` **within each round** — §6.5. Verified by
> query: `session_number → session.type` maps to `R` (34,347 rows), `SR` (597) and `Q1`/`Q2`/`Q3`
> (218 each, all 2026).

**`is_eligible = 0` means the entity holds no ranked position**, not that it was ineligible to
score. It is exactly co-extensive with `position IS NULL` on 13,701 of the 13,718 null-position
rows; the other 17 are 1997 Michael Schumacher, excluded by adjustment while `is_eligible` stayed 1.
Every `is_eligible = 0` row carries `points = 0`.

#### `championship_adjustment` — 3 rows
Points penalties and championship exclusions. Effectively unpopulated as a *table* — but the
adjustments it records **are already applied in the `driver_championship` / `team_championship`
snapshots**, and that is the load-bearing fact. Verified row by row:

| Season | Entity | `adjustment` | Effect visible in the snapshot |
|---|---|---|---|
| 1997 | `michael_schumacher` | `101` | 17 driver rows with `adjustment_type = 101`; keeps 78 points, `position` is NULL |
| 2007 | `mclaren` | `102` | 17 team rows with `adjustment_type = 102`; 0 points beside 8 wins, `position` is NULL |
| 2020 | `racing_point` | `1`, `points 15` | 17 team rows with `adjustment_type = 1`; reads **195**, the post-deduction figure in the record |

**Therefore: annotate, never re-apply.** Subtracting the penalty again would double-count it —
2020 Racing Point would read 180. Do not join this table to compute a standing; join it, if at
all, only to explain one. `adjustment_type` itself is an undocumented enum (trap 14) and must not
be displayed; derive `excluded` (adjusted **and** `position IS NULL`) versus `adjusted` from the
row instead. Note that `position IS NULL` **on its own is not an adjustment** — 13,701 rows have
one simply because the entity scored nothing.

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

Created as **`CREATE TEMP VIEW`** at connection bootstrap (`server/views.ts`), because the
connection is opened read-only. The DDL below is the authority; the code mirrors it verbatim.
After the views are created the connection latches `PRAGMA query_only = 1`. See
`ARCHITECTURE.md` §10 #7.

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

### 6.4a A session's fastest lap — from `lap`, never from `fastest_lap_rank`

**Trap 18.** The flag is absent on 133 race sessions that have lap rows and disagrees with the
lap table on 5 more, so it cannot be the source. The fastest lap is a **pace metric**, so
`is_deleted = 0` is mandatory (trap 8), and the tie-break is explicit so the answer does not
depend on row order.

```sql
SELECT ve.driver_ref, l.number AS lap, l.time_ms
FROM v_race ve
JOIN lap l ON l.session_entry_id = ve.entry_id
WHERE ve.year = ? AND ve.round_number = ?
  AND l.is_deleted = 0 AND l.time_ms IS NOT NULL
ORDER BY l.time_ms ASC, l.number ASC
LIMIT 1;
```

**This is a property of the session, not of a selection**, and the distinction is load-bearing
for any chart that scales an axis by it (`DESIGN_SYSTEM.md` §6.3 clips a lap-time axis at
`fastest × 1.5`). A ceiling derived from the four drivers a reader has selected moves when the
fourth is toggled, so the same race would show two different axes on its two lap charts. In
practice `server/queries/race.ts` computes this **in the same pass as the traces**, from one
query's rows, so the summary and the series cannot disagree — a stronger guarantee than two
statements agreeing by rule.

### 6.5 Championship progression for a season

**One point per round, and the `last_of_round` CTE is what makes it one.** A bare
`WHERE dc.year = ?` returns every snapshot the season wrote, and from 2026 that includes Q1, Q2
and Q3 rows that carry the same totals as each other — 962 rows for 2026 where the progression
has ~484. Plotting them produces flat repeats between rounds and a category axis with four entries
per race.

This is **not** §6.6's key. §6.6 takes the global maximum of `(round_number, session_number)` and
answers "where did the season end up"; this takes the maximum *within each round* and answers
"how did it get there".

```sql
WITH last_of_round AS (
  SELECT round_number, max(session_number) AS session_number
  FROM driver_championship WHERE year = ? GROUP BY round_number
)
SELECT dc.round_number, d.reference AS driver_ref, d.abbreviation,
       dc.points, dc.position, dc.adjustment_type
FROM driver_championship dc
JOIN last_of_round lr
  ON lr.round_number = dc.round_number AND lr.session_number = dc.session_number
JOIN driver d ON d.id = dc.driver_id
WHERE dc.year = ?
ORDER BY dc.round_number;
```

`team_championship` takes the identical shape. A round with no snapshot is a race that has not
happened — **absent from the axis, never a null point**, because a gap in a line reads as missing
data (`REQUIREMENTS.md` §2.2).

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

### 6.7a Season calendar, with winners and lap availability

The season hub's calendar. Two queries rather than one correlated subquery per column, because the
winner is **not one row** — trap 16.

```sql
-- Numbered rounds. `r.number IS NOT NULL` is the partition, not `is_cancelled` (trap 15):
-- it makes the numbered and unnumbered lists a *total* partition of the season's rounds,
-- so no round can be dropped from both if that equivalence ever stops holding.
SELECT r.number, r.name, r.date, c.reference AS circuit_ref, c.name AS circuit_name,
       EXISTS (SELECT 1 FROM session ses JOIN session_entry se ON se.session_id = ses.id
               WHERE ses.round_id = r.id AND ses.type = 'R')  AS has_results,
       EXISTS (SELECT 1 FROM session ses
               WHERE ses.round_id = r.id AND ses.type = 'SR') AS has_sprint,
       EXISTS (SELECT 1 FROM session ses JOIN session_entry se ON se.session_id = ses.id
               JOIN lap l ON l.session_entry_id = se.id
               WHERE ses.round_id = r.id AND ses.type = 'R')  AS has_lap_data
FROM round r
JOIN season s ON s.id = r.season_id
LEFT JOIN circuit c ON c.id = r.circuit_id
WHERE s.year = ? AND r.number IS NOT NULL
ORDER BY r.number;

-- Winners. One row per round, except the three shared drives (trap 16), which return two.
SELECT round_number, driver_ref, driver_code, forename, surname, team_ref, team_name, points
FROM v_race
WHERE year = ? AND round_number IS NOT NULL AND position = 1
ORDER BY round_number, points DESC, surname;
```

`has_results` is what "completed" means — **never a comparison of `r.date` against today**. The
dump can lag the real calendar by ~2 weeks, so a date test reports a race as run with nothing in
it (`REQUIREMENTS.md` §2.5). `has_lap_data` is §6.4's rule per round and is the only `lap` access
on this surface: bounded to one round's session entries, resolved through `idx_lap_entry`, and
short-circuited by `EXISTS` (trap 7).

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

**There are 22.** `CLAUDE.md` and `.claude/agents/*.md` still say "the 14 traps"; this table is the
authority. Trap 16 was found in F2 by querying rather than by reading, **traps 17–21 were found
in F3**, the first feature to touch `lap` and `pit_stop` in anger, and **trap 22 was found by a
shipped display defect** — every one of them by running a query rather than by reading this
document. The count in those other files is stale — flagged rather than edited, because they are not
this document's to change.

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
| 15 | Cancelled rounds have `round.number IS NULL` | All `is_cancelled = 1` rounds (2 rows, both 2026) carry a NULL `number`, so `ORDER BY r.number` sorts them **first** and they are not addressable by round number. Every round-number query needs `AND r.number IS NOT NULL`. A season's numbered-round count is `max(number)`, not `count(*)` — 2026 has 24 `round` rows but 22 numbered rounds. **On the data as it stands the equivalence is exact in both directions** — 0 rounds are cancelled-and-numbered, 0 are uncancelled-and-unnumbered, and `is_cancelled` is non-NULL on all 1,173 rows — so `AND r.number IS NOT NULL` excludes **exactly** the cancelled rounds and a redundant `AND r.is_cancelled = 0` is unnecessary. **Nothing in the schema enforces this**, so verify it after every refresh (§9) before relying on the number filter alone. |
| 16 | **`position = 1` is not unique within a race** | **Three races have two winners**, and a query written as `... AND position = 1` with `.get()` instead of `.all()` silently keeps whichever row the planner returned first. They are shared drives, where two drivers shared one car and both were classified P1 with the win's points split between them: **1951 R4 French GP** (Fangio 5, Fagioli 4), **1956 R1 Argentine GP** (Fangio 5, Musso 4), **1957 R5 British GP** (Moss 5, Brooks 4). Counted directly: `GROUP BY round_id HAVING count(*) > 1` over `position = 1` returns exactly three `round_id` values across all 1,173 races. Any "winner of this round" field is therefore a **list**, and any per-race win tally must decide explicitly whether a shared drive is one win or two. The same shape can apply to any position, so a "who finished Nth" lookup carries the same rule. |
| 17 | **`driver.reference` is not unique within a race either** | Trap 16's root cause with a different consequence, and it bites a **key** rather than a query. 40 races between 1950 and 1964 classify the same driver **twice or three times** — 1950 R7 lists Ascari twice, 1953 R2 lists Linden and Stevenson three times each — so `key={row.driverRef}` in a React list is wrong on 40 pages and renders fine on every other one. Counted directly, **`(driver_ref, car_number)` is unique in all 1,173 races** while `driver_ref` alone is not, so that pair is the identity of a classification row. **None of the 40 races has a `lap` row**, verified by query, which is what makes it safe for a lap-scale payload to key by `driver_ref` alone — and that safety is a fact about the dump, so re-verify it after a refresh rather than inferring it from the 1996 lap boundary. |
| 18 | **`fastest_lap_rank` is incomplete _and_ disagrees with `lap`** | Do not use it to find a session's fastest lap; take `min(l.time_ms)` over `l.is_deleted = 0`. Measured: **578** race sessions hold lap rows but only **465** carry an entry with `fastest_lap_rank = 1`, so **133 sessions with lap data have no flagged fastest lap at all**, and 20 carry the flag with no lap rows. Worse, on **5 of the 445** sessions where both exist, the flagged driver's own fastest lap is **not** the session minimum — 2011 R9 by 1.517 s, 2015 R9 by 0.483 s, 2025 R2 by 0.385 s, 2012 R9 by 0.053 s, 2021 R3 by 0.016 s. `lap.is_entry_fastest_lap` is likewise absent on 2,785 race entries that have lap rows. The `lap` table is the authority; the flags are not. |
| 19 | **`lap.is_deleted` is empty on every race lap — the filter is a no-op today** | `is_deleted = 1` on **2,199 of 717,764** lap rows and on **none of the 627,025 race lap rows**; all 2,199 are practice and qualifying, 2023 onward. So `AND l.is_deleted = 0` (trap 8) currently changes no race result, and **that is exactly why it must stay in every pace metric**: it is a no-op that one refresh can make load-bearing, and a metric that has to remember to add it later will not. It also means any UI that promises to mark invalidated laps will show nothing on a race page — state that rather than implying the feature works. |
| 20 | **`session.timestamp` carries a midnight-UTC placeholder, not a time** | Every one of the 5,130 `session` rows has a non-NULL `timestamp`, and **before 2005 every one is exactly `00:00:00+00:00`** — a date with a zero time. Through 2021 only the **race** carries a real time (2010: 19 of 19 races do, 0 of 19 FP1s do); **from 2022 all 860 sessions do.** So publishing the raw value prints "FP1 · 00:00" on every practice session before 2022. Test the time component (`substr(timestamp, 12, 8) = '00:00:00'` → unknown) rather than a year threshold, which would be wrong in the other direction for 2005–2021. The test is a heuristic: a session that genuinely began at midnight UTC would read as unknown, and none exists in the data (0 of 860 in 2022–2026, where every time is real). |
| 21 | **`laps_completed` and `scheduled_laps` are both unreliable for a lap count** | `session.scheduled_laps` is populated on **24 of 1,173** race sessions — unusable; the race distance is `max(laps_completed)` over the classification. And `session_entry.laps_completed` disagrees with `max(lap.number)` for that entry on **105 of 11,720** race entries with lap data, by up to **57 laps in either direction**; a **disqualified** entry reads `laps_completed = 0` while holding a pit stop on lap 29 (2024 R21 Hülkenberg, 2025 R2 Leclerc / Hamilton / Gasly, 2025 R4 Hülkenberg). So anything that must close a range at a driver's last lap — a stint, a trace's right edge — uses `max(lap.number)`, never `laps_completed`. Relatedly, **`pit_stop.number` disagrees with lap order on 3 race entries**, so order stops by the joined `lap.number` and treat `pit_stop.number` as a label. |
| 22 | **`session_entry.detail` changes wording mid-archive, and stops stating the lap deficit in 2023** | §3 says *"use `detail` for display"* and that stands — but **`detail` is not a stable vocabulary across eras**, so a surface that renders it verbatim renders two different things either side of a boundary that belongs to the dataset rather than to the sport. Measured on `status = 1` (classified, down laps) in race sessions: `detail` reads **`+N Laps` on 7,279 rows, every one of them 2022 or earlier**, and the bare word **`Lapped` on 363 rows, every one of them 2023–2026** — a clean split at 2023 with no overlap in either direction. A further 172 rows read `Not classified`, all 2009 or earlier. **The 363 are almost exactly the 364 lapped finishers that carry a `time_ms`**, which is what made this a defect rather than a curiosity: the modern rows are both the ones with a usable time *and* the ones whose `detail` no longer states the deficit, so code that fell back to `detail` for a lap-down car produced `+1 Lap` on 1988 and the word `Lapped` on eleven consecutive rows of 2026 R1. **If a deficit must be shown for those rows it has to be derived**, and the derivation is `max(laps_completed) − laps_completed`: verified against the `lap` table on the 363, where the winner's `laps_completed` equals their `max(lap.number)` on **363 of 363** and the deficit agrees both ways on **362 of 363** (the exception is 2026 R9 Sainz, `laps_completed = 51` against 52 lap rows — trap 21's unreliability, reaching one row). **Prefer the recorded wording over the derivation wherever `detail` states a figure**: the two disagree on **23 of the 7,279** rows that state one, and `laps_completed` is the unreliable half. Do not extend the derivation to a row with `is_classified = 0` — a deficit relative to the winner is a claim about a car that holds a position, and 171 of the 172 `Not classified` rows are unclassified. **And never render `detail` verbatim when it is silent on the figure**, which is the trap's sharpest edge: for `status = 1` the shapes are a closed set of three against two `is_classified` values, and one of the six pairs — `detail = 'Lapped'` with `is_classified = 0`, **2 rows, 2026 R1 Stroll and 2026 R7 Albon** — has no figure and no classified position, so a fallback to `detail` prints the **`status` category's own name** where a magnitude belongs. Those two are genuinely unclassified (43 of 58 laps = 74.1% and 55 of 66 = 83.3%, both under the sport's 90% threshold), so **`is_classified` is the field to trust where it disagrees with `status = 1`'s "classified, down laps"**, and the display for that state is the data's own older wording, `Not classified` — used verbatim on 171 rows from 1950 to 2004. The six pairs and their counts are pinned in `server/queries/race.test.ts`, so a refresh introducing a fourth shape fails a test instead of reaching a screen. |

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
5. Re-verify `server/coverage.ts` against §4.
6. Re-verify **trap 15 in both directions** — a NULL count alone is not enough, because it cannot
   detect a *numbered* cancelled round appearing, which would silently downgrade
   `AND r.number IS NOT NULL` from a complete filter to a partial one:

   ```sql
   SELECT (SELECT count(*) FROM round WHERE is_cancelled = 1 AND number IS NOT NULL) AS cancelled_but_numbered,
          (SELECT count(*) FROM round WHERE is_cancelled = 0 AND number IS NULL)      AS numbered_gap,
          (SELECT count(*) FROM round WHERE is_cancelled IS NULL)                     AS cancelled_unknown;
   ```

   **All three must be 0.** The third is not optional: if `is_cancelled` were ever NULL, the second
   count would skip those rows and appear to pass. If any is non-zero, every round-number query
   must add `AND r.is_cancelled = 0` and trap 15's text must be corrected before shipping.

7. **Re-verify traps 17–21**, which are all counts this document asserts and F3's code relies on.
   `server/queries/race.test.ts` asserts the first four against the live database, so running the
   suite with `data/f1.db` present is the check — but the query is written out here because a
   refresh may arrive before anyone runs it:

   ```sql
   SELECT
     -- trap 17: no race with a repeated driver_ref may have a lap row
     (SELECT count(*) FROM (SELECT session_id FROM v_race
        GROUP BY session_id, driver_ref HAVING count(*) > 1) d
      WHERE EXISTS (SELECT 1 FROM v_race ve JOIN lap l ON l.session_entry_id = ve.entry_id
                    WHERE ve.session_id = d.session_id))                AS dup_driver_with_laps,
     -- trap 19: race laps that are deleted, and race laps with no time
     (SELECT count(*) FROM lap l JOIN session_entry se ON se.id = l.session_entry_id
      JOIN session ses ON ses.id = se.session_id
      WHERE ses.type = 'R' AND l.is_deleted = 1)                        AS deleted_race_laps,
     (SELECT count(*) FROM lap l JOIN session_entry se ON se.id = l.session_entry_id
      JOIN session ses ON ses.id = se.session_id
      WHERE ses.type = 'R' AND l.time_ms IS NULL)                       AS untimed_race_laps,
     -- trap 9 / the three-state grid: a NULL grid would read as a pit-lane start
     (SELECT count(*) FROM session_entry se JOIN session ses ON ses.id = se.session_id
      WHERE ses.type = 'R' AND se.grid IS NULL)                         AS null_grid,
     -- trap 20: a session with a real time must never sit at exactly midnight UTC
     (SELECT count(*) FROM session ses JOIN round r ON r.id = ses.round_id
      JOIN season s ON s.id = r.season_id
      WHERE s.year >= 2022 AND substr(ses.timestamp, 12, 8) = '00:00:00') AS midnight_modern;
   ```

   **All five must be 0.** `deleted_race_laps` becoming non-zero is the good case — it means trap
   19's no-op has become load-bearing and the invalidated-lap states can finally render — but the
   figures quoted in trap 19 and in `server/schemas/race.ts` need correcting when it happens.
   `midnight_modern` becoming non-zero means trap 20's discriminator has a false positive and a
   real session time is being discarded.

8. Re-verify the percentile figures pinned in `server/queries/race.test.ts` (2026 R1's
   82,091 / 85,228 / 98,755 / 122,340 / 1,168,144 ms). They are what `DESIGN_SYSTEM.md` §6.3's
   axis-ceiling rule was derived from, so if they move, that section's arithmetic is stale.
