/**
 * Resolving a `:reference` route parameter — the client half of `S-4`.
 *
 * **The pattern mirrors `server/schemas/entity.ts` exactly, and that is the point rather
 * than duplication.** A client that accepted `max verstappen` or a 40-character slug would
 * send a request the server answers with a 400, turning a recoverable typo into a failed
 * fetch and a generic error card instead of a sentence naming the problem. The same
 * reasoning `resolveRaceRef` is written against.
 *
 * `[A-Za-z0-9_-]` and **not** `[a-z0-9_-]`: three driver references in the data carry an
 * uppercase letter — `scott_Brown`, `Changy`, `Cannoc` — so the pattern that reads as
 * obviously right would reject three real drivers. Measured across all 881 driver, 214
 * team and 78 circuit references; the longest is 20 characters and the bound here is the
 * format's 32, so a reference the dataset does not hold is a **404 from the server**
 * rather than a client-side rejection.
 *
 * There is no default to degrade to. Unlike the season hub — which can show the latest
 * season and a notice — there is no "some other driver" a reader who typed a bad slug
 * would have meant, so this reports the invalid value and the surface explains it.
 */

export type ResolvedEntityRef =
  { status: 'resolved'; reference: string } | { status: 'invalid'; value: string };

const REFERENCE = /^[A-Za-z0-9_-]{1,32}$/;

export function resolveEntityRef(param: string | undefined): ResolvedEntityRef {
  const value = param ?? '';
  if (!REFERENCE.test(value)) return { status: 'invalid', value };
  return { status: 'resolved', reference: value };
}

/**
 * Whole years between an ISO date of birth and an ISO date, or null when either is absent.
 *
 * **The clock lives here and never in a payload.** `GET /api/drivers/:reference` publishes
 * `ageAtFirstRace` and `ageAtLastRace`, which are derived from two dates the data holds and
 * are correct forever; a server-computed "age today" would bake the request time into a
 * response the server sends `Cache-Control` for.
 *
 * **And it must not be used to state a living driver's age**, because this dataset has no
 * date of death — `driver` carries `date_of_birth` and nothing else — so applying it to
 * today for Fangio would confidently report 114. It exists for the case where the surface
 * already knows the driver is active, and the caller supplies the reference date.
 *
 * Calendar arithmetic on the strings rather than `Date`: `new Date('1911-07-02')` is parsed
 * as UTC midnight while `new Date(1911, 6, 2)` is local, so a birthday on the boundary
 * would resolve differently depending on the reader's timezone. Both inputs are
 * `YYYY-MM-DD`, so comparing the month-day suffix lexicographically is exact.
 */
export function selectAgeYears(dateOfBirth: string | null, on: string | null): number | null {
  if (dateOfBirth === null || on === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !/^\d{4}-\d{2}-\d{2}$/.test(on)) return null;
  const born = Number(dateOfBirth.slice(0, 4));
  const year = Number(on.slice(0, 4));
  const hadBirthday = on.slice(5, 10) >= dateOfBirth.slice(5, 10);
  const age = year - born - (hadBirthday ? 0 : 1);
  return age < 0 ? null : age;
}
