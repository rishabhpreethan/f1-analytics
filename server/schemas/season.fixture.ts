import type { Season, SeasonList, StandingsProgression } from './season';

/**
 * Valid payloads, used by the schema tests and by the client selector tests.
 *
 * They are hand-written rather than captured from a response on purpose: a fixture
 * captured from the implementation asserts that the implementation agrees with itself.
 * The figures are real ones — 2026 through Round 10 — so a reader can check them against
 * `REQUIREMENTS.md` §2.5.
 */

export const seasonFixture: Season = {
  year: 2026,
  rounds: [
    {
      round: 1,
      name: 'Australian Grand Prix',
      date: '2026-03-08',
      circuitRef: 'albert_park',
      circuitName: 'Albert Park Grand Prix Circuit',
      hasResults: true,
      hasSprint: false,
      hasLapData: true,
      winner: {
        driverRef: 'russell',
        code: 'RUS',
        forename: 'George',
        surname: 'Russell',
        team: { ref: 'mercedes', name: 'Mercedes' },
      },
    },
    {
      round: 2,
      name: 'Chinese Grand Prix',
      date: '2026-03-15',
      circuitRef: 'shanghai',
      circuitName: 'Shanghai International Circuit',
      hasResults: true,
      hasSprint: true,
      hasLapData: true,
      winner: {
        driverRef: 'antonelli',
        code: 'ANT',
        forename: 'Andrea Kimi',
        surname: 'Antonelli',
        team: { ref: 'mercedes', name: 'Mercedes' },
      },
    },
    {
      round: 3,
      name: 'Hungarian Grand Prix',
      date: '2026-07-26',
      circuitRef: 'hungaroring',
      circuitName: 'Hungaroring',
      hasResults: false,
      hasSprint: false,
      hasLapData: false,
      winner: null,
    },
  ],
  cancelledRounds: [
    {
      name: 'Bahrain Grand Prix',
      date: '2026-04-12',
      circuitRef: 'bahrain',
      circuitName: 'Bahrain International Circuit',
    },
  ],
  scheduledRounds: 3,
  completedRounds: 2,
  isComplete: false,
  scoring: {
    systemRef: 's2026',
    systemName: '2026 - Present Championship',
    driverCounting: 'all',
    driverBestResults: null,
    teamCounting: 'all',
    teamBestResults: null,
  },
  standings: {
    asOfRound: 2,
    drivers: [
      {
        position: 1,
        driverRef: 'antonelli',
        code: 'ANT',
        forename: 'Andrea Kimi',
        surname: 'Antonelli',
        nationality: 'Italian',
        points: 43,
        wins: 1,
        bestFinish: 1,
        teams: [{ ref: 'mercedes', name: 'Mercedes', firstRound: 1, lastRound: 2, starts: 2 }],
        adjustment: 'none',
      },
      {
        position: 2,
        driverRef: 'russell',
        code: 'RUS',
        forename: 'George',
        surname: 'Russell',
        nationality: 'British',
        points: 33,
        wins: 1,
        bestFinish: 1,
        teams: [{ ref: 'mercedes', name: 'Mercedes', firstRound: 1, lastRound: 2, starts: 2 }],
        adjustment: 'none',
      },
      {
        position: null,
        driverRef: 'stroll',
        code: 'STR',
        forename: 'Lance',
        surname: 'Stroll',
        nationality: 'Canadian',
        points: 0,
        wins: 0,
        bestFinish: null,
        teams: [
          { ref: 'aston_martin', name: 'Aston Martin', firstRound: 1, lastRound: 2, starts: 2 },
        ],
        adjustment: 'none',
      },
    ],
    teams: [
      {
        position: 1,
        teamRef: 'mercedes',
        name: 'Mercedes',
        nationality: 'German',
        points: 76,
        wins: 2,
        bestFinish: 1,
        adjustment: 'none',
      },
    ],
  },
};

export const seasonListFixture: SeasonList = {
  seasons: [
    {
      year: 2026,
      rounds: 22,
      completedRounds: 10,
      cancelledRounds: 2,
      isComplete: false,
      hasTeamStandings: true,
    },
    {
      year: 1950,
      rounds: 7,
      completedRounds: 7,
      cancelledRounds: 0,
      isComplete: true,
      hasTeamStandings: false,
    },
  ],
};

export const progressionFixture: StandingsProgression = {
  year: 2026,
  rounds: [
    { round: 1, name: 'Australian Grand Prix', date: '2026-03-08', circuitRef: 'albert_park' },
    { round: 2, name: 'Chinese Grand Prix', date: '2026-03-15', circuitRef: 'shanghai' },
  ],
  drivers: [
    {
      driverRef: 'antonelli',
      code: 'ANT',
      forename: 'Andrea Kimi',
      surname: 'Antonelli',
      teams: [{ ref: 'mercedes', name: 'Mercedes', firstRound: 1, lastRound: 2, starts: 2 }],
      adjustment: 'none',
      progression: [
        { round: 1, points: 18, position: 2 },
        { round: 2, points: 43, position: 1 },
      ],
    },
    {
      driverRef: 'russell',
      code: 'RUS',
      forename: 'George',
      surname: 'Russell',
      teams: [{ ref: 'mercedes', name: 'Mercedes', firstRound: 1, lastRound: 2, starts: 2 }],
      adjustment: 'none',
      progression: [
        { round: 1, points: 25, position: 1 },
        { round: 2, points: 33, position: 2 },
      ],
    },
  ],
  teams: [
    {
      teamRef: 'mercedes',
      name: 'Mercedes',
      adjustment: 'none',
      progression: [
        { round: 1, points: 43, position: 1 },
        { round: 2, points: 76, position: 1 },
      ],
    },
  ],
  scoring: seasonFixture.scoring,
};
