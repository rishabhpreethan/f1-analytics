-- F1 Analytics — local SQLite schema
--
-- The 18 application tables. Authoritative reference: docs/DATABASE.md.
-- The application opens this database read-only and never writes to it.
--
--   season ── round ── session ── session_entry ── lap ── pit_stop
--                        │            └── round_entry ── team_driver ── driver
--                        └── point_system                             └── team
--
-- Column conventions:
--   * `id` is a stable integer surrogate key. Internal only — never in a URL.
--   * `reference` is the public identifier: a human-readable slug (`max_verstappen`).
--     URLs and API responses use `reference`, never `id` and never `api_id`.
--   * Booleans are stored as INTEGER 0/1.
--   * A duration is stored twice: verbatim text (`*_str`) and an integer
--     millisecond column (`*_ms`) for analytics.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- rule systems
-- These make cross-era normalization exact rather than hand-coded (docs/DATABASE.md §5).

CREATE TABLE IF NOT EXISTS championship_system (
  id                       INTEGER PRIMARY KEY,
  api_id                   TEXT,
  name                     TEXT,
  reference                TEXT,
  eligibility              INTEGER,
  driver_best_results      INTEGER,   -- >0 means only best N results count (1950-53 etc.)
  driver_season_split      INTEGER,
  team_best_results        INTEGER,
  team_points_per_session  INTEGER,
  team_season_split        INTEGER
);

CREATE TABLE IF NOT EXISTS point_system (
  id                      INTEGER PRIMARY KEY,
  api_id                  TEXT,
  name                    TEXT,
  reference               TEXT,
  driver_position_points  TEXT,       -- encoded per-position award table
  driver_fastest_lap      REAL,
  team_position_points    TEXT,
  team_fastest_lap        REAL,
  is_double_points        INTEGER,
  partial                 REAL,
  shared_drive            REAL
);

-- ---------------------------------------------------------------- dimensions

CREATE TABLE IF NOT EXISTS season (
  id                     INTEGER PRIMARY KEY,
  api_id                 TEXT,
  year                   INTEGER NOT NULL,
  championship_system_id INTEGER REFERENCES championship_system(id),
  wikipedia              TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_season_year ON season(year);

CREATE TABLE IF NOT EXISTS circuit (
  id           INTEGER PRIMARY KEY,
  api_id       TEXT,
  reference    TEXT,          -- public slug
  name         TEXT,
  locality     TEXT,
  country      TEXT,
  country_code TEXT,
  latitude     REAL,
  longitude    REAL,
  altitude     REAL,
  wikipedia    TEXT
);

CREATE INDEX IF NOT EXISTS idx_circuit_ref ON circuit(reference);

CREATE TABLE IF NOT EXISTS driver (
  id                   INTEGER PRIMARY KEY,
  api_id               TEXT,
  reference            TEXT,   -- public slug
  forename             TEXT,
  surname              TEXT,
  abbreviation         TEXT,   -- three-letter code ('VER')
  permanent_car_number INTEGER,
  date_of_birth        TEXT,
  nationality          TEXT,
  country_code         TEXT,
  wikipedia            TEXT
);

CREATE INDEX IF NOT EXISTS idx_driver_ref     ON driver(reference);
CREATE INDEX IF NOT EXISTS idx_driver_surname ON driver(surname);

-- Successive identities of one organisation. Holds no rows; see docs/DATABASE.md §2.6.
CREATE TABLE IF NOT EXISTS base_team (
  id     INTEGER PRIMARY KEY,
  api_id TEXT,
  name   TEXT
);

CREATE TABLE IF NOT EXISTS team (
  id            INTEGER PRIMARY KEY,
  api_id        TEXT,
  reference     TEXT,          -- public slug
  name          TEXT,
  base_team_id  INTEGER REFERENCES base_team(id),
  nationality   TEXT,
  country_code  TEXT,
  primary_color TEXT,          -- brand colour; present for the current grid only
  wikipedia     TEXT
);

CREATE INDEX IF NOT EXISTS idx_team_ref ON team(reference);

-- Which drivers drove for which team in which season.
CREATE TABLE IF NOT EXISTS team_driver (
  id        INTEGER PRIMARY KEY,
  api_id    TEXT,
  season_id INTEGER REFERENCES season(id),
  team_id   INTEGER REFERENCES team(id),
  driver_id INTEGER REFERENCES driver(id),
  role      INTEGER            -- undocumented enum; never displayed
);

CREATE INDEX IF NOT EXISTS idx_td_season ON team_driver(season_id);
CREATE INDEX IF NOT EXISTS idx_td_driver ON team_driver(driver_id);
CREATE INDEX IF NOT EXISTS idx_td_team   ON team_driver(team_id);

-- ---------------------------------------------------------------- events

CREATE TABLE IF NOT EXISTS round (
  id           INTEGER PRIMARY KEY,
  api_id       TEXT,
  season_id    INTEGER REFERENCES season(id),
  circuit_id   INTEGER REFERENCES circuit(id),
  number       INTEGER,        -- round number within the season; NULL when cancelled
  race_number  INTEGER,
  name         TEXT,
  date         TEXT,           -- race date, ISO 8601
  is_cancelled INTEGER,        -- 1 is not a data gap; see docs/DATABASE.md §7 trap 12
  wikipedia    TEXT
);

CREATE INDEX IF NOT EXISTS idx_round_season  ON round(season_id, number);
CREATE INDEX IF NOT EXISTS idx_round_circuit ON round(circuit_id);
CREATE INDEX IF NOT EXISTS idx_round_date    ON round(date);

-- One row per session: R, Q1/Q2/Q3, SQ1-3, SR, FP1/FP2/FP3, and legacy QB/QO/QA.
CREATE TABLE IF NOT EXISTS session (
  id              INTEGER PRIMARY KEY,
  api_id          TEXT,
  round_id        INTEGER REFERENCES round(id),
  type            TEXT NOT NULL,
  number          INTEGER,
  point_system_id INTEGER REFERENCES point_system(id),
  scheduled_laps  INTEGER,
  timestamp       TEXT,
  timezone        TEXT,
  has_time_data   INTEGER,     -- unreliable in both directions; docs/DATABASE.md §7 trap 1
  is_cancelled    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_session_round ON session(round_id, type);
CREATE INDEX IF NOT EXISTS idx_session_type  ON session(type);

-- A car's entry into a round (driver + team + car number).
CREATE TABLE IF NOT EXISTS round_entry (
  id             INTEGER PRIMARY KEY,
  api_id         TEXT,
  round_id       INTEGER REFERENCES round(id),
  team_driver_id INTEGER REFERENCES team_driver(id),
  car_number     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_re_round ON round_entry(round_id);
CREATE INDEX IF NOT EXISTS idx_re_td    ON round_entry(team_driver_id);

-- One row per car per session — the central fact table. There are no separate
-- race / qualifying / sprint result tables; discriminate on session.type.
CREATE TABLE IF NOT EXISTS session_entry (
  id                     INTEGER PRIMARY KEY,
  api_id                 TEXT,
  session_id             INTEGER REFERENCES session(id),
  round_entry_id         INTEGER REFERENCES round_entry(id),
  position               INTEGER,     -- NULL when not classified
  grid                   INTEGER,     -- 0 means a pit-lane start
  points                 REAL,        -- points from this session only
  laps_completed         INTEGER,
  status                 INTEGER,     -- integer enum; see docs/DATABASE.md §3
  detail                 TEXT,        -- human-readable status ('Finished', 'Engine', ...)
  fastest_lap_rank       INTEGER,     -- 1 = fastest lap of the session
  is_classified          INTEGER,     -- the canonical finisher flag
  is_eligible_for_points INTEGER,
  time_str               TEXT,
  time_ms                INTEGER      -- millisecond form of time_str
);

CREATE INDEX IF NOT EXISTS idx_se_session  ON session_entry(session_id);
CREATE INDEX IF NOT EXISTS idx_se_re       ON session_entry(round_entry_id);
CREATE INDEX IF NOT EXISTS idx_se_position ON session_entry(position);
CREATE INDEX IF NOT EXISTS idx_se_status   ON session_entry(status);

-- ---------------------------------------------------------------- lap level

-- ~718k rows. The largest table and the basis of the flagship analytics.
CREATE TABLE IF NOT EXISTS lap (
  id                   INTEGER PRIMARY KEY,
  api_id               TEXT,
  session_entry_id     INTEGER REFERENCES session_entry(id),
  number               INTEGER,       -- lap number
  position             INTEGER,       -- position on that lap
  time_str             TEXT,
  time_ms              INTEGER,       -- millisecond form of time_str
  average_speed        REAL,          -- per-lap average, not a telemetry trace
  is_entry_fastest_lap INTEGER,
  is_deleted           INTEGER        -- lap invalidated; exclude from pace metrics
);

CREATE INDEX IF NOT EXISTS idx_lap_entry     ON lap(session_entry_id, number);
CREATE INDEX IF NOT EXISTS idx_lap_number    ON lap(number);

CREATE TABLE IF NOT EXISTS pit_stop (
  id               INTEGER PRIMARY KEY,
  api_id           TEXT,
  session_entry_id INTEGER REFERENCES session_entry(id),
  lap_id           INTEGER REFERENCES lap(id),
  number           INTEGER,
  duration_str     TEXT,
  duration_ms      INTEGER,           -- millisecond form of duration_str
  local_timestamp  TEXT
);

CREATE INDEX IF NOT EXISTS idx_ps_entry ON pit_stop(session_entry_id);
CREATE INDEX IF NOT EXISTS idx_ps_lap   ON pit_stop(lap_id);

-- Holds no rows; see docs/DATABASE.md §2.6.
CREATE TABLE IF NOT EXISTS penalty (
  id                     INTEGER PRIMARY KEY,
  api_id                 TEXT,
  earned_id              INTEGER,
  served_id              INTEGER,
  position               INTEGER,
  time_str               TEXT,
  time_ms                INTEGER,
  license_points         INTEGER,
  is_time_served_in_pit  INTEGER
);

-- ---------------------------------------------------------------- championships

-- Standings snapshots, one row per driver per session-with-points.
-- `year`, `round_number` and `session_number` are denormalized, so championship
-- progression needs no joins.
CREATE TABLE IF NOT EXISTS driver_championship (
  id              INTEGER PRIMARY KEY,
  driver_id       INTEGER REFERENCES driver(id),
  season_id       INTEGER REFERENCES season(id),
  round_id        INTEGER REFERENCES round(id),
  session_id      INTEGER REFERENCES session(id),
  year            INTEGER,
  round_number    INTEGER,
  session_number  INTEGER,
  points          REAL,
  position        INTEGER,
  win_count       INTEGER,
  highest_finish  INTEGER,
  is_eligible     INTEGER,
  adjustment_type INTEGER            -- undocumented enum; never displayed
);

CREATE INDEX IF NOT EXISTS idx_dc_driver ON driver_championship(driver_id, year);
CREATE INDEX IF NOT EXISTS idx_dc_year   ON driver_championship(year, round_number);

CREATE TABLE IF NOT EXISTS team_championship (
  id              INTEGER PRIMARY KEY,
  team_id         INTEGER REFERENCES team(id),
  season_id       INTEGER REFERENCES season(id),
  round_id        INTEGER REFERENCES round(id),
  session_id      INTEGER REFERENCES session(id),
  year            INTEGER,
  round_number    INTEGER,
  session_number  INTEGER,
  points          REAL,
  position        INTEGER,
  win_count       INTEGER,
  highest_finish  INTEGER,
  is_eligible     INTEGER,
  adjustment_type INTEGER            -- undocumented enum; never displayed
);

CREATE INDEX IF NOT EXISTS idx_tc_team ON team_championship(team_id, year);
CREATE INDEX IF NOT EXISTS idx_tc_year ON team_championship(year, round_number);

-- Points adjustments. Effectively unpopulated (3 rows); docs/DATABASE.md §2.5.
CREATE TABLE IF NOT EXISTS championship_adjustment (
  id         INTEGER PRIMARY KEY,
  api_id     TEXT,
  season_id  INTEGER REFERENCES season(id),
  driver_id  INTEGER REFERENCES driver(id),
  team_id    INTEGER REFERENCES team(id),
  adjustment INTEGER,
  points     REAL
);
