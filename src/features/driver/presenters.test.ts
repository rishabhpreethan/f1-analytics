import { describe, expect, it } from 'vitest';
import type { DriverRace, DriverSeason, DriverTotals } from '@schemas/driver';
import {
  FASTEST_LAP_NOTE,
  QUALIFYING_NOTE,
  driverCoverageNotes,
  driverRibbon,
  driverTiles,
  progressCoverage,
  seasonProgress,
} from './presenters';

/**
 * **The driver page's presentation arithmetic.**
 *
 * Every assertion here guards a value that would render as a **plausible number that is false** —
 * the class of defect §1.0 keeps finding. `0 poles` for a driver who raced before qualifying was
 * recorded, a season's mean computed over races the measure cannot be asked of, a two-team season
 * silently reduced to one team.
 *
 * The fixtures are real shapes: Häkkinen's partial qualifying coverage, Fangio's total absence of
 * it, and a season split across two teams.
 */

const TOTALS: DriverTotals = {
  entries: 165,
  races: 162,
  starts: 161,
  nonStarts: 1,
  wins: 20,
  podiums: 51,
  pointsFinishes: 87,
  poles: 26,
  racesWithQualifying: 41,
  fastestLaps: 25,
  racesWithFastestLapData: 0,
  dnfs: 61,
  mechanicalDnfs: 42,
  accidentDnfs: 19,
  disqualifications: 0,
  championships: 2,
};

function race(over: Partial<DriverRace>): DriverRace {
  return {
    year: 1998,
    round: 1,
    name: 'Australian Grand Prix',
    date: '1998-03-08',
    circuitRef: 'albert_park',
    circuitName: 'Albert Park Grand Prix Circuit',
    teamRef: 'mclaren',
    teamName: 'McLaren',
    carNumber: 8,
    entries: 1,
    gridPosition: 1,
    gridStatus: 'grid',
    position: 1,
    outcome: 'finished',
    detail: 'Finished',
    isClassified: true,
    points: 10,
    lapsCompleted: 58,
    qualifyingPosition: 1,
    qualifyingSession: 'QB',
    roundHasQualifying: true,
    hasFastestLap: false,
    roundHasFastestLapData: false,
    positionsGained: 0,
    ...over,
  };
}

describe('driverTiles — §6.6.2.2, the denominator rule has three states', () => {
  it('renders a dash when the denominator is zero, because 0 is a false statement there', () => {
    /*
     * The fastest-lap flag is present for 1958–59 and from 2004, and for **no season in between**.
     * A 1990s driver's `racesWithFastestLapData` is 0, and `0 fastest laps` would claim he never
     * set one — which the record contradicts.
     */
    const tiles = driverTiles(TOTALS);
    expect(tiles.find((t) => t.key === 'fastest-laps')?.value).toBeNull();
    expect(tiles.find((t) => t.key === 'fastest-laps')?.note).toBe(FASTEST_LAP_NOTE);
  });

  it('renders the figure with a marker when the denominator is real but partial', () => {
    // 26 poles over 41 races with qualifying, from 161 starts. The count is real and undercounted.
    const tiles = driverTiles(TOTALS);
    expect(tiles.find((t) => t.key === 'poles')?.value).toBe(26);
    expect(tiles.find((t) => t.key === 'poles')?.note).toBe(QUALIFYING_NOTE);
  });

  it('renders the figure alone when the coverage is complete', () => {
    const complete = { ...TOTALS, racesWithQualifying: 161, racesWithFastestLapData: 161 };
    const tiles = driverTiles(complete);
    expect(tiles.find((t) => t.key === 'poles')?.note).toBeUndefined();
    expect(tiles.find((t) => t.key === 'fastest-laps')?.note).toBeUndefined();
  });

  it('never publishes a career points total', () => {
    /*
     * Trap 4 and §6.2. 24 point systems and several best-N eras mean a career sum is not a
     * quantity — a 1950s driver's championship total is not the sum of his race points, and no
     * arithmetic makes the two comparable. This is the assertion that stops it being added back as
     * an obvious missing figure.
     */
    const keys = driverTiles(TOTALS).map((tile) => tile.key);
    expect(keys).not.toContain('points');
    expect(keys.some((key) => key.includes('point') && key !== 'points-finishes')).toBe(false);
  });

  it('publishes exactly DR-2’s eight figures', () => {
    expect(driverTiles(TOTALS).map((t) => t.key)).toEqual([
      'starts',
      'wins',
      'podiums',
      'points-finishes',
      'poles',
      'fastest-laps',
      'dnfs',
      'championships',
    ]);
  });
});

describe('driverCoverageNotes — §6.5.3’s three parts, and never a year alone', () => {
  it('says what IS available, which is the part that gets dropped and the only one that helps', () => {
    const notes = driverCoverageNotes(TOTALS);
    expect(notes.find((n) => n.key === QUALIFYING_NOTE)?.text).toContain(
      'Race results, grid positions and championship standings are complete',
    );
  });

  it('distinguishes “none recorded” from “partly recorded” in the wording', () => {
    const none = driverCoverageNotes({ ...TOTALS, racesWithQualifying: 0 });
    expect(none.find((n) => n.key === QUALIFYING_NOTE)?.text).toContain('cannot be given');

    const some = driverCoverageNotes(TOTALS);
    expect(some.find((n) => n.key === QUALIFYING_NOTE)?.text).toContain('41 of 161 starts');
  });

  it('emits no note at all when everything is covered', () => {
    expect(
      driverCoverageNotes({ ...TOTALS, racesWithQualifying: 161, racesWithFastestLapData: 161 }),
    ).toEqual([]);
  });

  it('names the 1958–59 island rather than only the 2004 boundary', () => {
    // §5.1 says "2004+ only" and is silent about 20 races in 1958 and 1959. A note that repeated
    // §5.1 would be wrong about Fangio's era in the same way the spec was.
    expect(driverCoverageNotes(TOTALS).find((n) => n.key === FASTEST_LAP_NOTE)?.text).toContain(
      '1958 and 1959',
    );
  });
});

describe('seasonProgress — a mean over the races the measure can be asked of', () => {
  const races = [
    race({ year: 1998, round: 1, positionsGained: 0, qualifyingPosition: 1, position: 1 }),
    race({ year: 1998, round: 2, positionsGained: 3, qualifyingPosition: 5, position: 2 }),
    /* A retirement: `positionsGained` is null and there is no finishing position either. */
    race({
      year: 1998,
      round: 3,
      positionsGained: null,
      position: null,
      outcome: 'mechanical',
      qualifyingPosition: 2,
    }),
  ];

  it('excludes the races the measure does not apply to rather than counting them as zero', () => {
    const [season] = seasonProgress(races, 'grid');
    expect(season?.counted).toBe(2);
    expect(season?.mean).toBeCloseTo(1.5, 12);
  });

  it('computes the qualifying measure from the pair, not from the grid', () => {
    /*
     * The grid is what the car started from **after penalties**; the qualifying classification is
     * what the driver earned. On a weekend with a grid drop the two differ, and that difference is
     * the entire reason both measures exist.
     */
    const [season] = seasonProgress(races, 'qualifying');
    expect(season?.counted).toBe(2);
    expect(season?.mean).toBeCloseTo(1.5, 12);
  });

  it('drops a season with no measurable race instead of drawing it at zero', () => {
    // A zero bar says "started and finished level all year", which is a different claim from
    // "this season is outside the measure's coverage".
    const rows = seasonProgress(
      [race({ year: 1991, positionsGained: null, position: null, qualifyingPosition: null })],
      'grid',
    );
    expect(rows).toEqual([]);
  });

  it('colours a season by the team the driver entered the most races with', () => {
    const split = [
      race({ year: 2001, teamRef: 'sauber', positionsGained: 1 }),
      race({ year: 2001, round: 2, teamRef: 'ferrari', positionsGained: 1 }),
      race({ year: 2001, round: 3, teamRef: 'ferrari', positionsGained: 1 }),
    ];
    expect(seasonProgress(split, 'grid')[0]?.teamRef).toBe('ferrari');
  });

  it('counts every race towards the team tally, not only the measurable ones', () => {
    /*
     * A season whose only measurable races were with the second of two teams must not be painted
     * as if the first team never happened — the bar's colour answers "who did he drive for", not
     * "who was he measurable for".
     */
    const split = [
      race({ year: 2001, teamRef: 'sauber', positionsGained: null, position: null }),
      race({ year: 2001, round: 2, teamRef: 'sauber', positionsGained: null, position: null }),
      race({ year: 2001, round: 3, teamRef: 'ferrari', positionsGained: 2 }),
    ];
    expect(seasonProgress(split, 'grid')[0]?.teamRef).toBe('sauber');
  });

  it('breaks a tie by reference, so a colour cannot change between reloads', () => {
    const even = [
      race({ year: 2001, teamRef: 'sauber', positionsGained: 1 }),
      race({ year: 2001, round: 2, teamRef: 'ferrari', positionsGained: 1 }),
    ];
    expect(seasonProgress(even, 'grid')[0]?.teamRef).toBe('ferrari');
    expect(seasonProgress([...even].reverse(), 'grid')[0]?.teamRef).toBe('ferrari');
  });

  it('returns seasons in ascending year order', () => {
    const spread = [
      race({ year: 2001, positionsGained: 1 }),
      race({ year: 1993, positionsGained: 1 }),
      race({ year: 1997, positionsGained: 1 }),
    ];
    expect(seasonProgress(spread, 'grid').map((r) => r.year)).toEqual([1993, 1997, 2001]);
  });
});

describe('progressCoverage — the partial note counts seasons, never a boundary year', () => {
  it('reports covered against total, so a holed window is stated honestly', () => {
    /*
     * The qualifying window is **holed**: 15/16 rounds in 1994, 17/17 in 1995, then 7, 10, 7, 3,
     * 4, 1 and 2 of ~16 for 1996–2002. "Seasons before 1994" would understate that by six years
     * and would be the more confident-sounding wording.
     */
    const races = [
      race({ year: 1993, qualifyingPosition: null, position: 4 }),
      race({ year: 1994, qualifyingPosition: 3, position: 1 }),
      race({ year: 1995, qualifyingPosition: null, position: 2 }),
    ];
    expect(progressCoverage(races, 'qualifying')).toEqual({ seasonsCovered: 1, seasonsTotal: 3 });
  });
});

describe('driverRibbon — §7.9', () => {
  function season(over: Partial<DriverSeason>): DriverSeason {
    return {
      year: 1998,
      teams: [{ ref: 'mclaren', name: 'McLaren', firstRound: 1, lastRound: 16, entries: 16 }],
      entries: 16,
      starts: 16,
      wins: 8,
      podiums: 11,
      bestFinish: 1,
      points: 100,
      position: 1,
      championshipWins: 8,
      adjustment: 'none',
      isSeasonComplete: true,
      isChampion: true,
      ...over,
    };
  }

  it('carries `isChampion` from the payload and never infers it from position 1', () => {
    /*
     * The payload gates the title on the season being complete, and the gate is live: the 2026
     * snapshot in this data ranks Antonelli first with 12 of 22 rounds unrun. Deriving `position
     * === 1` here would award him a championship.
     */
    const cells = driverRibbon([
      season({ year: 2026, position: 1, isChampion: false, isSeasonComplete: false }),
    ]);
    expect(cells[0]?.champion).toBe(false);
  });

  it('passes an unranked season through as null, not as a deep position', () => {
    expect(driverRibbon([season({ position: null, isChampion: false })])[0]?.position).toBeNull();
  });

  it('omits the detail entirely for a season with no team rather than sending an empty string', () => {
    expect(driverRibbon([season({ teams: [] })])[0]?.detail).toBeUndefined();
  });
});
