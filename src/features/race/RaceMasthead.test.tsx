// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import type { Race } from '@schemas/race';
import { RaceMasthead } from './RaceMasthead';

/**
 * **The race masthead's two seams** — §1.0a, both directions.
 *
 * The back-link to the season already existed and was the reason "we have navigation between them"
 * was true and useless: the calendar could not reach the race page, which is the defect §1.0a was
 * written after. The **forward** link to the circuit is new with F6, and this masthead is the
 * highest-traffic route into it — the venue is named on every one of 1,173 race pages.
 *
 * Nothing here asserts a position or a size; the masthead's layout is unverified by construction.
 */

const RACE = {
  year: 2026,
  round: 6,
  name: 'Monaco Grand Prix',
  date: '2026-05-24',
  circuit: {
    ref: 'monaco',
    name: 'Circuit de Monaco',
    locality: 'Monte-Carlo',
    country: 'Monaco',
    countryCode: 'MC',
  },
  raceLaps: 78,
} as unknown as Race;

function renderMasthead(race: Race | null = RACE) {
  return render(
    <MemoryRouter>
      <RaceMasthead race={race} counts={null} raceLaps={78} pending={false} />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('§1.0a — both directions are checked', () => {
  it('links back to the season the race belongs to', () => {
    renderMasthead();
    expect(screen.getByRole('link', { name: 'Back to the 2026 season' }).getAttribute('href')).toBe(
      '/seasons/2026',
    );
  });

  it('links forward to the circuit page', () => {
    renderMasthead();
    expect(screen.getByRole('link', { name: 'Circuit de Monaco' }).getAttribute('href')).toBe(
      '/circuits/monaco',
    );
  });

  it('carries the product’s visible link affordance on the circuit, not a bare href', () => {
    renderMasthead();
    expect(
      screen.getByRole('link', { name: 'Circuit de Monaco' }).classList.contains('entity-link'),
    ).toBe(true);
  });

  it('renders no link at all while the race is in flight, rather than one to nowhere', () => {
    const { container } = renderMasthead(null);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });
});
