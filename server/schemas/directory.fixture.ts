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
 * scheduled-but-unrun venue and the Nürburgring the retired one; Räikkönen and Pérez are
 * the two names SQLite's BINARY collation misplaces, which is what the client-side
 * collator is tested against.
 *
 * The achievement fields are covered across their whole range on purpose, so a surface
 * built against this fixture meets every state it will meet in production: a champion
 * (Alonso 2, Räikkönen 1), a **runner-up who never won a title** (Pérez, best P2, which is
 * the state `championships` alone cannot express), a driver who raced once and never
 * placed (Ryan, `bestChampionshipPosition: null`), and two who never raced at all.
 *
 * Every number here was read from `data/f1.db` on 2026-08-23 and matches the profile
 * endpoint for the same entity. They are not round numbers and must not be "tidied".
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
      starts: 435,
      wins: 32,
      podiums: 106,
      championships: 2,
      bestChampionshipPosition: 1,
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
      starts: 0,
      wins: 0,
      podiums: 0,
      championships: 0,
      bestChampionshipPosition: null,
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
      starts: 0,
      wins: 0,
      podiums: 0,
      championships: 0,
      bestChampionshipPosition: null,
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
      starts: 291,
      wins: 6,
      podiums: 39,
      championships: 0,
      bestChampionshipPosition: 2,
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
      starts: 351,
      wins: 21,
      podiums: 103,
      championships: 1,
      bestChampionshipPosition: 1,
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
      starts: 1,
      wins: 0,
      podiums: 0,
      championships: 0,
      bestChampionshipPosition: null,
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
      wins: 250,
      podiums: 845,
      championships: 16,
      bestChampionshipPosition: 1,
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
      wins: 0,
      podiums: 0,
      championships: 0,
      bestChampionshipPosition: null,
      firstSeason: null,
      lastSeason: null,
    },
    {
      ref: 'mclaren',
      name: 'McLaren',
      nationality: 'British',
      countryCode: 'GBR',
      races: 962,
      wins: 199,
      podiums: 546,
      championships: 10,
      bestChampionshipPosition: 1,
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
      latitude: 45.6156,
      longitude: 9.28111,
      // 76 numbered rounds, 75 with results — the 76th is 2026's and has not been run.
      roundsHeld: 76,
      racesWithResults: 75,
      firstYear: 1950,
      lastYear: 2025,
      lastScheduledYear: 2026,
    },
    {
      // Scheduled for 2026 R14 and never yet raced. Trap 13, not a gap.
      ref: 'madring',
      name: 'Madring',
      locality: 'Madrid',
      country: 'Spain',
      countryCode: 'ESP',
      latitude: 40.46528,
      longitude: -3.61528,
      roundsHeld: 1,
      racesWithResults: 0,
      firstYear: null,
      lastYear: null,
      lastScheduledYear: 2026,
    },
    {
      ref: 'silverstone',
      name: 'Silverstone Circuit',
      locality: 'Silverstone',
      country: 'UK',
      countryCode: 'GBR',
      latitude: 52.0786,
      longitude: -1.01694,
      roundsHeld: 61,
      racesWithResults: 61,
      firstYear: 1950,
      lastYear: 2026,
      lastScheduledYear: 2026,
    },
    {
      // Retired: 41 rounds, the last of them run in 2020. 53 of 78 circuits are this case,
      // and `lastScheduledYear` is the only field that separates them from the 25 current
      // ones — `lastYear` cannot, because Madring's is null.
      ref: 'nurburgring',
      name: 'Nürburgring',
      locality: 'Nürburg',
      country: 'Germany',
      countryCode: 'DEU',
      latitude: 50.3356,
      longitude: 6.9475,
      roundsHeld: 41,
      racesWithResults: 41,
      firstYear: 1951,
      lastYear: 2020,
      lastScheduledYear: 2020,
    },
  ],
};
