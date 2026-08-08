import type { CircuitList, DriverList, TeamList } from './directory';

/**
 * Valid payloads for the three index endpoints, used by the schema tests and by the client
 * hook and selector tests.
 *
 * Hand-written rather than captured from a response, for the reason `entity.fixture.ts`
 * gives: a fixture captured from the implementation asserts only that the implementation
 * agrees with itself.
 *
 * **Every row is a real one a reader can check, and the awkward cases are deliberate.**
 * Ecclestone and Life are the never-raced case the module ruling is about; Madring is the
 * scheduled-but-unrun venue; Räikkönen and Pérez are the two names SQLite's BINARY
 * collation misplaces, which is what the client-side collator is tested against.
 */

export const driverListFixture: DriverList = {
  drivers: [
    {
      ref: 'alonso',
      code: 'ALO',
      forename: 'Fernando',
      surname: 'Alonso',
      nationality: 'Spanish',
      countryCode: 'ESP',
      races: 438,
      firstSeason: 2001,
      lastSeason: 2026,
    },
    {
      // Entered a Grand Prix in 1958, never qualified. 47 drivers are this case.
      ref: 'ecclestone',
      code: null,
      forename: 'Bernie',
      surname: 'Ecclestone',
      nationality: 'British',
      countryCode: 'GBR',
      races: 0,
      firstSeason: null,
      lastSeason: null,
    },
    {
      // FP1 only, 2026. 16 drivers are this case, and any of them may start a race.
      ref: 'colton_herta',
      code: null,
      forename: 'Colton',
      surname: 'Herta',
      nationality: null,
      countryCode: 'USA',
      races: 0,
      firstSeason: null,
      lastSeason: null,
    },
    {
      ref: 'perez',
      code: 'PER',
      forename: 'Sergio',
      surname: 'Pérez',
      nationality: 'Mexican',
      countryCode: 'MEX',
      races: 293,
      firstSeason: 2011,
      lastSeason: 2026,
    },
    {
      ref: 'raikkonen',
      code: 'RAI',
      forename: 'Kimi',
      surname: 'Räikkönen',
      nationality: 'Finnish',
      countryCode: 'FIN',
      races: 352,
      firstSeason: 2001,
      lastSeason: 2021,
    },
    {
      ref: 'ryan',
      code: null,
      forename: 'Peter',
      surname: 'Ryan',
      nationality: 'Canadian',
      countryCode: 'CAN',
      races: 1,
      firstSeason: 1961,
      lastSeason: 1961,
    },
  ],
};

export const teamListFixture: TeamList = {
  teams: [
    {
      ref: 'ferrari',
      name: 'Ferrari',
      nationality: 'Italian',
      countryCode: 'ITA',
      races: 1134,
      firstSeason: 1950,
      lastSeason: 2026,
    },
    {
      // Entered 1990 and never started. 9 teams are this case.
      ref: 'life',
      name: 'Life',
      nationality: 'Italian',
      countryCode: 'ITA',
      races: 0,
      firstSeason: null,
      lastSeason: null,
    },
    {
      ref: 'mclaren',
      name: 'McLaren',
      nationality: 'British',
      countryCode: 'GBR',
      races: 962,
      firstSeason: 1968,
      lastSeason: 2026,
    },
  ],
};

export const circuitListFixture: CircuitList = {
  circuits: [
    {
      ref: 'monza',
      name: 'Autodromo Nazionale di Monza',
      locality: 'Monza',
      country: 'Italy',
      countryCode: 'ITA',
      // 76 numbered rounds, 75 with results — the 76th is 2026's and has not been run.
      roundsHeld: 76,
      racesWithResults: 75,
      firstYear: 1950,
      lastYear: 2025,
    },
    {
      // Scheduled for 2026 R14 and never yet raced. Trap 13, not a gap.
      ref: 'madring',
      name: 'Madring',
      locality: 'Madrid',
      country: 'Spain',
      countryCode: 'ESP',
      roundsHeld: 1,
      racesWithResults: 0,
      firstYear: null,
      lastYear: null,
    },
    {
      ref: 'silverstone',
      name: 'Silverstone Circuit',
      locality: 'Silverstone',
      country: 'UK',
      countryCode: 'GBR',
      roundsHeld: 61,
      racesWithResults: 61,
      firstYear: 1950,
      lastYear: 2026,
    },
  ],
};
