/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { assignLadder } from '@/components/charts/ladder';
import { assignEntityColours } from '@/lib/entityColor';
import { CompareTray, type TrayBay } from './CompareTray';
import { COMPARE_FIXTURE } from './fixture';
import { COMPARE_DIRECTORY } from './lensFixture';

/**
 * `CompareTray` — `DESIGN_SYSTEM.md` §6.6.6.2, §7.16.
 *
 * One thing here is worth a file of its own: **the tray holds two kinds of bay and only one of them
 * has a channel**, so the two orders can come apart. `ComparePage` cannot reach that state today —
 * a driver added from the picker is appended, so a pending bay is always last — which is precisely
 * why it needs asserting at this level. The bug it guards is silent: `ReadyBay` returns `null` when
 * its channel is missing, so a mis-indexed bay does not throw, it **vanishes**.
 */

afterEach(cleanup);

const entity = (ref: string) => {
  const found = COMPARE_FIXTURE.entities.find((candidate) => candidate.identity.ref === ref);
  if (found === undefined) throw new Error(ref);
  return found;
};
const candidate = (ref: string) => {
  const found = COMPARE_DIRECTORY.find((person) => person.ref === ref);
  if (found === undefined) throw new Error(ref);
  return found;
};

const renderTray = (bays: TrayBay[]) => {
  /* The ladder is computed over the entities that HAVE a record — never over the bays. */
  const ready = bays.flatMap((bay) => (bay.kind === 'ready' ? [bay.entity] : []));
  const ladder = assignLadder(
    assignEntityColours(
      ready.map((item) => ({
        reference: item.identity.ref,
        teamReference: item.colorTeamRef,
      })),
    ),
  );
  render(
    <CompareTray
      bays={bays}
      candidates={COMPARE_DIRECTORY}
      channels={ladder.series}
      onAdd={() => undefined}
      onRemove={() => undefined}
    />,
  );
};

describe('§6.6.6.2 — a pending bay must not push the bays after it off the screen', () => {
  it('draws every ready bay when a pending one sits in the middle', () => {
    /*
     * Indexing `channels` by bay position gives bay 0 channel 0, bay 1 (pending) nothing, and bay 2
     * channel 2 — which does not exist, because there are only two channels. Verstappen's bay would
     * disappear without a word. Looking the channel up by `reference` is what makes the two orders
     * independent.
     */
    renderTray([
      { kind: 'ready', entity: entity('hamilton') },
      { kind: 'pending', candidate: candidate('senna') },
      { kind: 'ready', entity: entity('max_verstappen') },
    ]);
    const tray = screen.getByRole('region', { name: 'Selected drivers' });
    expect(within(tray).getAllByRole('listitem')).toHaveLength(4); // three filled, one empty
    for (const surname of ['Hamilton', 'Senna', 'Verstappen']) {
      expect(within(tray).getByText(surname)).toBeTruthy();
    }
  });

  it('still draws four bays in total, because the cap is drawn rather than implied', () => {
    renderTray([{ kind: 'ready', entity: entity('hamilton') }]);
    const tray = screen.getByRole('region', { name: 'Selected drivers' });
    expect(within(tray).getAllByRole('listitem')).toHaveLength(4);
    expect(within(tray).getByText('Bay 4')).toBeTruthy();
  });
});

describe('§7.16 — the pending bay says what it has and refuses what it does not', () => {
  it('carries the driver’s real identity and marks the record as loading', () => {
    renderTray([{ kind: 'pending', candidate: candidate('senna') }]);
    const bay = within(screen.getByRole('region', { name: 'Selected drivers' })).getAllByRole(
      'listitem',
    )[0];
    expect(bay?.getAttribute('data-pending')).toBe('true');
    expect(bay?.textContent).toContain('Ayrton');
    expect(bay?.textContent).toContain('Senna');
    expect(bay?.textContent).toContain('1984–1994');
    expect(bay?.textContent).toContain('record loading');
    // Never a plausible zero where the figure it does not have would go (§1.0).
    expect(bay?.textContent).toContain('—');
  });

  it('is removable, so a mistaken pick is not a dead bay', () => {
    renderTray([{ kind: 'pending', candidate: candidate('senna') }]);
    expect(screen.getByRole('button', { name: /Remove Ayrton Senna/ })).toBeTruthy();
  });
});
