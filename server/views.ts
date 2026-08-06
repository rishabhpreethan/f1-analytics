/**
 * The canonical flattened entry views.
 *
 * The DDL below mirrors `docs/DATABASE.md` §6.1 verbatim, changed only from
 * `CREATE VIEW IF NOT EXISTS` to `CREATE TEMP VIEW`: the connection is opened
 * read-only (DL-1), so a permanent view cannot be created, and the database is an
 * input supplied separately, so no view may be assumed present in the file.
 *
 * They are created once at connection bootstrap and the connection then latches
 * `PRAGMA query_only = 1`, which blocks all further DDL including temp objects.
 * See `ARCHITECTURE.md` §10 #7.
 *
 * `docs/DATABASE.md` §6.1 is the authority. If it changes, this file changes with it.
 */

/** v_entry: session_entry flattened to human-meaningful columns. */
export const V_ENTRY_DDL = `CREATE TEMP VIEW v_entry AS
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
JOIN team        t   ON t.id   = td.team_id`;

/** v_race: races only. Most features want this, not v_entry. */
export const V_RACE_DDL = `CREATE TEMP VIEW v_race AS
SELECT * FROM v_entry WHERE session_type = 'R'`;

/** Created in order — v_race depends on v_entry. */
export const CANONICAL_VIEWS = [V_ENTRY_DDL, V_RACE_DDL] as const;

/** The names the bootstrap creates, for the readiness sentinel and for tests. */
export const CANONICAL_VIEW_NAMES = ['v_entry', 'v_race'] as const;
