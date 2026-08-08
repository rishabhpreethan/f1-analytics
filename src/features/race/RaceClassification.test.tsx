// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (media: string) => ({
      matches: media.includes('reduce'),
      media,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

import type { RaceClassificationRow, RaceOutcome } from '@schemas/race';
import { RaceClassification } from './RaceClassification';
import type { ClassificationRowView } from './selectors';

/**
 * **RD-10's rendering contract, and the state matrix §1.0b says to enumerate.**
 *
 * This file exists because the surface had none, and because the negative-gap defect showed that
 * per-era capture is not per-state coverage: 1988, 1996 and 2026 were each reviewed and the bug was on
 * all three and visible on none. `raceOutcomeSchema` has **eight** members and 2026 R6 exercises
 * three, so the fixtures below reach the ones no real page in the capture set did.
 *
 * **What this file does NOT test is the gap arithmetic.** `selectGapDisplay` lives in
 * `src/features/race/selectors.ts` — the `developer`'s file — and the tests for the six-row negative
 * defect belong beside it. This asserts the half that is mine: given a `GapDisplay`, the column renders
 * it faithfully and distinguishes the three kinds. That split is deliberate; duplicating the decision
 * here would recreate the two-sources-of-truth problem the ceiling deletion removed.
 *
 * Layout is untested by construction: jsdom has no layout, so the identity bar's position, the
 * `standings-optional` column drop below 768px and the sticky header are named as unverified.
 */

const row = (over: Partial<RaceClassificationRow> = {}): RaceClassificationRow => ({
  driverRef: 'antonelli',
  code: 'ANT',
  forename: 'Andrea Kimi',
  surname: 'Antonelli',
  teamRef: 'mercedes',
  teamName: 'Mercedes',
  carNumber: 12,
  position: 1,
  gridPosition: 1,
  gridStatus: 'grid',
  outcome: 'finished',
  detail: 'Finished',
  isClassified: true,
  isEligibleForPoints: true,
  points: 25,
  lapsCompleted: 78,
  totalTimeMs: 8_611_243,
  ...over,
});

const view = (
  r: RaceClassificationRow,
  gap: ClassificationRowView['gap'],
): ClassificationRowView => ({
  key: `${r.driverRef}#${String(r.carNumber)}`,
  row: r,
  label: r.code ?? r.surname,
  colorRef: r.teamRef,
  gap,
  isRetirement: r.outcome === 'accident' || r.outcome === 'mechanical',
});

/**
 * A router is part of the harness from F4 onwards: §1.0a made every driver and team name in this
 * table a link — RD-10 named 22 entities and linked to none of them — and a `<Link>` outside a
 * router throws.
 */
function renderRows(rows: ClassificationRowView[]) {
  return render(
    <MemoryRouter>
      <RaceClassification
        rows={rows}
        year={2026}
        raceName="Monaco Grand Prix"
        notice={null}
        pending={false}
      />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('the RESULT column renders each of the three kinds distinctly', () => {
  it('shows the winner’s total time', () => {
    renderRows([view(row(), { kind: 'total', text: '1:23:31.243' })]);
    const cell = screen.getByText('1:23:31.243');
    expect(cell.getAttribute('data-kind')).toBe('total');
  });

  it('shows a finisher’s gap', () => {
    renderRows([view(row({ position: 2 }), { kind: 'gap', text: '+6.271' })]);
    expect(screen.getByText('+6.271').getAttribute('data-kind')).toBe('gap');
  });

  it('shows a retiree’s detail as words, in the text face rather than the mono one', () => {
    // `status` is a word — "Engine", "Retired", "+1 Lap" — so it must not be set as a numeral.
    renderRows([
      view(row({ position: null, outcome: 'mechanical', detail: 'Engine' }), {
        kind: 'status',
        text: 'Engine',
      }),
    ]);
    expect(screen.getByText('Engine').getAttribute('data-kind')).toBe('status');
  });

  it('never renders a negative duration, whichever kind it is handed', () => {
    /*
     * The defect this file was written for: six rows on 2026 R6 read down to `−2:02:28.126`, because a
     * retiree's `totalTimeMs` is their elapsed time when they *stopped* and is therefore smaller than
     * the winner's. The arithmetic is the selector's, so this asserts the property at the boundary the
     * component owns — nothing it renders may read as a negative time.
     */
    renderRows([
      view(row(), { kind: 'total', text: '1:23:31.243' }),
      view(row({ position: 2 }), { kind: 'gap', text: '+6.271' }),
      view(row({ position: 16, outcome: 'mechanical', detail: 'Retired' }), {
        kind: 'status',
        text: 'Retired',
      }),
    ]);
    const results = [...document.querySelectorAll('.race-result')].map((n) => n.textContent ?? '');
    expect(results.filter((text) => text.startsWith('−') || text.startsWith('-'))).toEqual([]);
  });
});

/**
 * §1.0b — the enum is the checklist. Eight outcomes; 2026 R6 renders three of them, so these are the
 * five no page in the capture set reached.
 */
describe('every raceOutcome renders, including the five no captured page reached', () => {
  const OUTCOMES: readonly RaceOutcome[] = [
    'finished',
    'lapped',
    'accident',
    'mechanical',
    'disqualified',
    'didNotStart',
    'didNotQualify',
    'unknown',
  ];

  it.each(OUTCOMES)('renders an outcome of %s without throwing', (outcome) => {
    const r = row({ outcome, position: outcome === 'finished' ? 1 : null, detail: 'Detail' });
    renderRows([view(r, { kind: 'status', text: 'Detail' })]);
    expect(screen.getByText('Detail')).toBeTruthy();
  });

  it('carries the outcome on the row, so CSS can recede a non-starter', () => {
    const { container } = renderRows([
      view(row({ outcome: 'didNotStart', position: null }), { kind: 'status', text: 'Withdrew' }),
    ]);
    expect(container.querySelector('tr[data-outcome="didNotStart"]')).toBeTruthy();
  });
});

describe('the position cell', () => {
  it('is a row header, so every value is announced with the position', () => {
    const { container } = renderRows([view(row(), { kind: 'total', text: '1:23:31.243' })]);
    expect(container.querySelector('th.standings-position[scope="row"]')).toBeTruthy();
  });

  it('shows an em-dash for an unclassified entry — a null position is not a DNF', () => {
    renderRows([
      view(row({ position: null, outcome: 'mechanical' }), { kind: 'status', text: 'Retired' }),
    ]);
    const header = document.querySelector('th.standings-position');
    expect(header?.textContent).toBe('—');
  });
});

describe('the grid column distinguishes a pit-lane start from an unknown one', () => {
  it('names a pit-lane start rather than printing 0 or a dash', () => {
    renderRows([
      view(row({ gridStatus: 'pitLane', gridPosition: null }), { kind: 'gap', text: '+30.000' }),
    ]);
    expect(screen.getByText('Pit lane')).toBeTruthy();
  });

  it('shows an em-dash when the grid slot is genuinely unknown', () => {
    const { container } = renderRows([
      view(row({ gridStatus: 'unknown', gridPosition: null }), { kind: 'gap', text: '+30.000' }),
    ]);
    const cells = [...(container.querySelectorAll('tbody tr')[0]?.children ?? [])];
    expect(cells[2]?.textContent).toBe('—');
  });
});

describe('trap 17 — the key is (driverRef, carNumber)', () => {
  it('renders both rows of a shared drive rather than collapsing them', () => {
    /*
     * 1951 R4 lists Fangio and Fagioli both at P1 in car 8. Forty races between 1950 and 1964 classify
     * one driver twice or three times, so `driverRef` alone is not a key.
     */
    const fangio = row({ driverRef: 'fangio', surname: 'Fangio', carNumber: 8, code: null });
    const fagioli = row({ driverRef: 'fagioli', surname: 'Fagioli', carNumber: 8, code: null });
    const { container } = renderRows([
      view(fangio, { kind: 'total', text: '2:57:52.800' }),
      view(fagioli, { kind: 'total', text: '2:57:52.800' }),
    ]);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    // Both show the winning time — never `+0.000` for the second.
    const times = [...container.querySelectorAll('.race-result')].map((n) => n.textContent);
    expect(times).toEqual(['2:57:52.800', '2:57:52.800']);
  });
});

describe('a round that has not been run', () => {
  it('says so rather than rendering an empty table', () => {
    render(
      <MemoryRouter>
        <RaceClassification
          rows={[]}
          year={2026}
          raceName="Hungarian Grand Prix"
          notice="This round has not been run yet."
          pending={false}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('This round has not been run yet.')).toBeTruthy();
    expect(document.querySelector('table')).toBeNull();
  });

  it('holds its box while the query is in flight, and says busy once', () => {
    render(
      <MemoryRouter>
        <RaceClassification rows={[]} year={2026} raceName="—" notice={null} pending />
      </MemoryRouter>,
    );
    const busy = screen.getByRole('status', { name: 'Classification' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(within(busy).queryAllByRole('status')).toHaveLength(0);
  });
});

/**
 * **§1.0a — the seam, asserted.** These are the cheap tests the design system says would have
 * caught the original defect: RD-10 rendered 22 driver names and 22 team names, and not one of
 * them was a link, so the driver and team pages were reachable only by typing a URL.
 *
 * Both directions matter and both are checked elsewhere: the race page's masthead links **back**
 * to the season and **out** to the circuit (`RaceMasthead`), and this table links out to every
 * entity it names.
 */
describe('§1.0a — every entity this table names is a link', () => {
  it('links the driver’s name to their driver page', () => {
    renderRows([view(row(), { kind: 'total', text: '1:23:31.243' })]);
    const link = screen.getByRole('link', { name: /Kimi Antonelli/ });
    expect(link.getAttribute('href')).toBe('/drivers/antonelli');
  });

  it('links the team’s name to its team page', () => {
    renderRows([view(row(), { kind: 'total', text: '1:23:31.243' })]);
    expect(screen.getByRole('link', { name: 'Mercedes' }).getAttribute('href')).toBe(
      '/teams/mercedes',
    );
  });

  it('gives the driver and the team separate destinations rather than one row link', () => {
    /*
     * A whole-row link would give the points cell a destination about somebody rather than about
     * the number in it — and it would make the team unreachable, because an anchor cannot contain
     * another anchor.
     */
    renderRows([view(row(), { kind: 'total', text: '1:23:31.243' })]);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toContain('/drivers/antonelli');
    expect(hrefs).toContain('/teams/mercedes');
  });

  it('carries a visible affordance, not just an href', () => {
    // §1.0a rule 3, and §7.3.0's lesson: *it was not broken, it was undiscoverable, and that is
    // worse*. `entity-link` is the product's existing underlined inline-link treatment.
    renderRows([view(row(), { kind: 'total', text: '1:23:31.243' })]);
    expect(
      screen.getByRole('link', { name: /Kimi Antonelli/ }).classList.contains('entity-link'),
    ).toBe(true);
  });
});
