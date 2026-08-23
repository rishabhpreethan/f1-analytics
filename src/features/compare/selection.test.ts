import { describe, expect, it } from 'vitest';
import { defaultSelection, parseSelection } from './selection';
import type { CompareCandidate } from './types';

/**
 * What a shareable link is allowed to say, and what the page opens on when it says nothing.
 *
 * These are the two rules `ARCHITECTURE.md` §5 states for this surface, and they are the half of
 * the URL contract the endpoint's own validation does **not** cover: the server refuses a malformed
 * `?e=`, which is right for an API and would be a blank page here.
 */

const candidate = (over: Partial<CompareCandidate> & { ref: string }): CompareCandidate => ({
  forename: 'A',
  surname: 'Driver',
  code: null,
  races: 10,
  ...over,
});

describe('parseSelection', () => {
  it('reads a list of references in the order the link gave them', () => {
    expect(parseSelection('hamilton,fangio')).toEqual({
      refs: ['hamilton', 'fangio'],
      corrected: false,
    });
  });

  /** Order is not normalised: colour and ladder position follow it, so it is part of the state. */
  it('does not sort, because the two orders are two different pages', () => {
    expect(parseSelection('fangio,hamilton').refs).toEqual(['fangio', 'hamilton']);
  });

  it.each(['scott_Brown', 'Changy', 'campbell-jones'])('accepts the real reference %s', (ref) => {
    expect(parseSelection(ref).refs).toEqual([ref]);
  });

  it('reports nothing at all for an absent or empty parameter, without calling it corrected', () => {
    expect(parseSelection(null)).toEqual({ refs: [], corrected: false });
    expect(parseSelection('')).toEqual({ refs: [], corrected: false });
  });

  it.each([
    ["hamilton'--", 'a SQL fragment'],
    ['hamilton lando', 'a space'],
    ['../etc/passwd', 'a traversal'],
    ['x'.repeat(33), 'a reference longer than the format allows'],
  ])('drops %s (%s) and says the link was corrected', (raw) => {
    expect(parseSelection(raw)).toEqual({ refs: [], corrected: true });
  });

  it('keeps the readable part of a partly broken link', () => {
    expect(parseSelection('hamilton,not a ref,fangio')).toEqual({
      refs: ['hamilton', 'fangio'],
      corrected: true,
    });
  });

  it('drops a duplicate rather than comparing a driver with themself', () => {
    expect(parseSelection('hamilton,hamilton')).toEqual({ refs: ['hamilton'], corrected: true });
  });

  /** Four is the palette's ceiling, and a fifth is dropped visibly rather than 400ing the page. */
  it('caps at four and says so', () => {
    expect(parseSelection('a,b,c,d,e')).toEqual({
      refs: ['a', 'b', 'c', 'd'],
      corrected: true,
    });
  });

  it('treats an empty element as a mistake, not as a reference', () => {
    expect(parseSelection('a,,b')).toEqual({ refs: ['a', 'b'], corrected: true });
    expect(parseSelection('hamilton,')).toEqual({ refs: ['hamilton'], corrected: true });
  });
});

describe('defaultSelection', () => {
  const grid: CompareCandidate[] = [
    candidate({ ref: 'alonso', races: 438, lastSeason: 2026 }),
    candidate({ ref: 'hamilton', races: 390, lastSeason: 2026 }),
    candidate({ ref: 'raikkonen', races: 352, lastSeason: 2021 }),
    candidate({ ref: 'perez', races: 293, lastSeason: 2026 }),
  ];

  /** Most races, among those still racing — not the most races overall, and not the alphabet. */
  it('opens on the two most-raced drivers of the latest season', () => {
    expect(defaultSelection(grid)).toEqual(['alonso', 'hamilton']);
  });

  it('ignores a longer career that has ended', () => {
    const retired = [candidate({ ref: 'legend', races: 999, lastSeason: 1990 }), ...grid];
    expect(defaultSelection(retired)).toEqual(['alonso', 'hamilton']);
  });

  it('falls back to the head of the list when no candidate carries a season', () => {
    const spanless = [candidate({ ref: 'a' }), candidate({ ref: 'b' }), candidate({ ref: 'c' })];
    expect(defaultSelection(spanless)).toEqual(['a', 'b']);
  });

  it('reports nothing for an empty directory rather than inventing a comparison', () => {
    expect(defaultSelection([])).toEqual([]);
  });

  it('reports one when the grid holds only one', () => {
    expect(defaultSelection([candidate({ ref: 'solo', lastSeason: 2026 })])).toEqual(['solo']);
  });
});
