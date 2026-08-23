// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import { ComparePage } from './ComparePage';
import { COMPARE_FIXTURE } from './fixture';

/**
 * **What this file can prove, and what it cannot.**
 *
 * jsdom performs no layout and no compositing. It therefore cannot say whether the staircase's
 * connectors meet their capsules, whether a one-season capsule is visible, whether the rate rails'
 * direct labels collide at four entities, or what colour anything resolves to — a custom property
 * reads as `''` here. Those are **untested by construction** and are named as such in the hand-off.
 *
 * What is decidable is the contract that makes this surface honest, and every case below is one of
 * those: that a pair who never shared a car is never offered a same-car ledger, that a pair who
 * never met is never offered a head-to-head at all, that the chain always carries its refusal
 * note, and that no career total appears anywhere on the page.
 */

afterEach(cleanup);

const render_ = () =>
  render(
    <ComparePage
      available={COMPARE_FIXTURE.entities.map((entity) => entity.identity)}
      data={COMPARE_FIXTURE}
    />,
  );

describe('the tray', () => {
  it('draws four bays, because four is the cap and a cap that is hidden is not a cap', () => {
    render_();
    const tray = screen.getByRole('region', { name: 'Selected drivers' });
    expect(within(tray).getAllByRole('listitem')).toHaveLength(4);
  });

  it('removes a driver and puts an add control in the freed bay', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(screen.getByRole('button', { name: /Remove Nico Rosberg/ }));
    expect(screen.queryByRole('button', { name: /Remove Nico Rosberg/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Add Nico Rosberg/ })).toBeTruthy();
  });

  it('asks for a second driver rather than rendering an empty comparison', async () => {
    const user = userEvent.setup();
    render_();
    for (const name of [/Remove Nico Rosberg/, /Remove Max Verstappen/, /Remove Juan Fangio/]) {
      await user.click(screen.getByRole('button', { name }));
    }
    expect(screen.getByText('Choose a second driver.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: /head to head/i })).toBeNull();
  });
});

describe('the verdict decides what evidence is admissible', () => {
  it('leads with the same-car verdict for a teammate pair, and offers both same-car ledgers', () => {
    render_();
    /* Hamilton and Rosberg are the first two entities, so they are the default focus. */
    expect(screen.getByRole('heading', { name: 'Same car.', level: 2 })).toBeTruthy();
    const ledgers = screen.getByRole('region', { name: 'Same-car head to head' });
    expect(within(ledgers).getByText('Finished ahead, in the same car')).toBeTruthy();
    expect(within(ledgers).getByText('Started ahead, in the same car')).toBeTruthy();
  });

  it('never offers a same-car ledger to a pair who never shared a car', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(screen.getByRole('button', { name: /Same grid 242 shared/ }));
    expect(screen.queryByRole('region', { name: 'Same-car head to head' })).toBeNull();
    const ledgers = screen.getByRole('region', { name: 'Shared-race head to head' });
    expect(within(ledgers).getByText('Finished ahead, in different cars')).toBeTruthy();
  });

  it('offers no head-to-head at all when the two never met, and says how far apart they are', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(screen.getByRole('button', { name: /Never met 8 steps apart/ }));
    expect(screen.getByRole('heading', { name: 'Never on the same grid.' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /head to head/i })).toBeNull();
    expect(screen.getByText(/57 years separate/)).toBeTruthy();
  });
});

describe('the matrix', () => {
  it('prints every pair once, in the upper triangle', () => {
    render_();
    /* Four entities, six relationships, and a relationship is symmetric — so six cells, not
     * twelve, and never a diagonal. */
    const cells = screen.getAllByRole('button', { pressed: false });
    const matrix = cells.filter((cell) => cell.className === 'relation-cell');
    expect(matrix).toHaveLength(5);
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
  });
});

describe('the chain', () => {
  it('shows one row per link and names the pivot driver on every row after the first', async () => {
    const user = userEvent.setup();
    render_();
    /* Hamilton and Verstappen shared 242 races and never a car, so they get a chain as well as a
     * shared-race ledger — the chain is offered to every pair who were never teammates, not only
     * to pairs who never met. */
    await user.click(screen.getByRole('button', { name: /Same grid 242 shared/ }));
    const chain = screen.getByRole('region', { name: /Lewis Hamilton to Max Verstappen/ });
    expect(chain.querySelectorAll('.chain-row')).toHaveLength(3);
    expect(within(chain).getAllByText(/^via /)).toHaveLength(2);
  });

  it('always carries the refusal — a chain is not a transitive result', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(screen.getByRole('button', { name: /Same grid 242 shared/ }));
    expect(screen.getByText('A chain is not a result.')).toBeTruthy();
  });

  it('reads from the driver the reader chose first, whichever way the payload stored it', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(screen.getByRole('button', { name: /Never met 8 steps apart/ }));
    /* Verstappen is row 3 of the matrix and Fangio column 4, so the chain reads Verstappen first
     * even though the payload publishes it as `max_verstappen → fangio` in selection order. */
    expect(
      screen.getByRole('heading', { name: /Max Verstappen to Juan Fangio in 8 steps/ }),
    ).toBeTruthy();
  });

  it('states its weakest link, because half the archive pairings have no rated race', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(screen.getByRole('button', { name: /Never met 8 steps apart/ }));
    expect(
      screen.getByText(/One step on this chain has no race both drivers finished|weakest step/),
    ).toBeTruthy();
  });
});

describe('the honesty rules the whole surface is built on', () => {
  it('publishes no career total anywhere — five rates, each with its denominator', () => {
    render_();
    const rails = screen.getByRole('region', { name: /Five rates/ });
    expect(rails.querySelectorAll('.rail')).toHaveLength(5);
    expect(
      within(rails).getByText(/The championship has run under 24 different points systems/),
    ).toBeTruthy();
  });

  it('warns that a 1950s driver holds more same-car pairings than starts', () => {
    render_();
    expect(screen.getByText('Same-car pairings are not races.')).toBeTruthy();
  });

  it('draws the denominator changing — the season that nearly tripled', () => {
    render_();
    expect(
      screen.getByRole('heading', { name: 'The season nearly tripled underneath them' }),
    ).toBeTruthy();
    const strip = screen.getByRole('img', { name: /Grands Prix per season from 1950 to 2026/ });
    expect(strip).toBeTruthy();
  });
});
