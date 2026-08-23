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

import { GAIN_BAR_ATTR, TIER_BAR_ATTR } from '@/lib/motion/scroll';
import { ComparePage } from './ComparePage';
import { COMPARE_FIXTURE } from './fixture';
import { COMPARE_DIRECTORY, SEASON_LENS_FIXTURE } from './lensFixture';

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
      available={COMPARE_DIRECTORY}
      data={COMPARE_FIXTURE}
      seasons={SEASON_LENS_FIXTURE}
    />,
  );

/** Switch to the season lens. The selection survives — that is the point of it not being a route. */
const openSeasonLens = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('radio', { name: /One season/ }));
};

describe('the tray', () => {
  it('draws four bays, because four is the cap and a cap that is hidden is not a cap', () => {
    render_();
    const tray = screen.getByRole('region', { name: 'Selected drivers' });
    expect(within(tray).getAllByRole('listitem')).toHaveLength(4);
  });

  it('removes a driver and frees the bay, leaving the picker to refill it', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(screen.getByRole('button', { name: /Remove Nico Rosberg/ }));
    expect(screen.queryByRole('button', { name: /Remove Nico Rosberg/ })).toBeNull();
    /*
     * The freed bay is a **slot**, not an add button (§7.16). Four buttons that all do the same
     * thing is four times the control for one job, and it made the bays look like the thing you
     * operate when the thing you operate is the field below them.
     */
    const tray = screen.getByRole('region', { name: 'Selected drivers' });
    expect(within(tray).getByText('Bay 4')).toBeTruthy();
    expect(screen.getByRole('combobox')).toBeTruthy();
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
    const pressed = (state: boolean) =>
      screen
        .getAllByRole('button', { pressed: state })
        .filter((cell) => cell.className === 'relation-cell');
    expect(pressed(false)).toHaveLength(5);
    /*
     * Scoped to `.relation-cell`, and the scope is the assertion's whole point: every `ChartFrame`
     * on the page carries an `aria-pressed` view toggle of its own, so a page-wide count of pressed
     * buttons measures how many charts are rendered rather than how many pairs are selected. It
     * counted 1 until §6.6.6.14 added a chart, and then failed for a reason that had nothing to do
     * with the matrix.
     */
    expect(pressed(true)).toHaveLength(1);
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

describe('the rate bars are actually wired to a mount motion', () => {
  /**
   * The first build wrote `data-motion="chart-bar"` on the rail track and called **no hook**, so
   * these marks never animated while the markup said they did — CR-007's "a motion a comment
   * claimed existed but nothing implemented", shipped a second time.
   *
   * The selector is now an exported constant consumed by both the hook and the markup, so the pair
   * cannot drift. This asserts the markup half; the hook half is `usePopulationMount`'s own test.
   * **Whether the growth looks right is untested by construction** — jsdom composites nothing.
   */
  it('gives every bar the exact attribute the hook queries', () => {
    render_();
    const rails = screen.getByRole('region', { name: /Five rates/ });
    const bars = rails.querySelectorAll('.rate-bar');
    expect(bars).toHaveLength(20);
    for (const bar of bars) expect(bar.getAttribute('data-motion')).toBe(TIER_BAR_ATTR);
  });
});

describe('the honesty rules the whole surface is built on', () => {
  it('publishes no career total anywhere — five rates, each with its denominator', () => {
    render_();
    const rails = screen.getByRole('region', { name: /Five rates/ });
    expect(rails.querySelectorAll('.rate-measure')).toHaveLength(5);
    /* One row per entity per measure — the form the board was rebuilt to, after four floating
     * labels on one shared rail collided 51 times at 1440 and overflowed the page at 390. */
    expect(rails.querySelectorAll('.rate-row')).toHaveLength(20);
    expect(
      within(rails).getByText(/The championship has run under 24 different points systems/),
    ).toBeTruthy();
  });

  it('keeps the rate rows in selection order on every measure, never sorted by value', () => {
    /* §6.2 — order follows the entity, never its rank. It is also what makes reading one driver
     * down the five measures a vertical scan rather than a search, which is the answer to the
     * "grouped bars need memory" objection the first build was designed around. */
    render_();
    const rails = screen.getByRole('region', { name: /Five rates/ });
    const measures = [...rails.querySelectorAll('.rate-measure')];
    const orders = measures.map((measure) =>
      [...measure.querySelectorAll('.rate-name')].map((node) => node.textContent),
    );
    expect(orders[0]).toEqual(['Hamilton', 'Rosberg', 'Verstappen', 'Fangio']);
    for (const order of orders) expect(order).toEqual(orders[0]);
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

describe('§7.16 — the picker, in place', () => {
  it('fills a freed bay from the search field', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(screen.getByRole('button', { name: /Remove Juan Fangio/ }));
    await user.type(screen.getByRole('combobox'), 'ayrton');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: /Remove Ayrton Senna/ })).toBeTruthy();
  });

  it('draws a chosen driver whose record has not arrived as pending, not as a blank', async () => {
    /*
     * The genuine loading state, and while `GET /api/compare` is being built it is every driver
     * outside the fixture's four. The bay still carries real queried identity — name, span, races,
     * team colour — and refuses only the figure it does not have (§1.0).
     */
    const user = userEvent.setup();
    render_();
    await user.click(screen.getByRole('button', { name: /Remove Juan Fangio/ }));
    await user.type(screen.getByRole('combobox'), 'ayrton');
    await user.keyboard('{Enter}');
    const tray = screen.getByRole('region', { name: 'Selected drivers' });
    const bay = within(tray)
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('Senna'));
    expect(bay?.getAttribute('data-pending')).toBe('true');
    expect(bay?.textContent).toContain('1984–1994');
    expect(bay?.textContent).toContain('record loading');
  });

  it('refuses a fifth driver at the control, not by discarding the click', () => {
    render_();
    expect(screen.getByRole('combobox')).toHaveProperty('disabled', true);
  });
});

describe('§6.6.6.10 — the season lens', () => {
  it('keeps the selection across the switch, which is why it is a lens and not a route', async () => {
    const user = userEvent.setup();
    render_();
    await openSeasonLens(user);
    const tray = screen.getByRole('region', { name: 'Selected drivers' });
    expect(within(tray).getByText('Hamilton')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Same car.', level: 2 })).toBeNull();
  });

  it('puts only seasons the payload carries on the rail, so there are no dead ends', async () => {
    const user = userEvent.setup();
    render_();
    await openSeasonLens(user);
    const rail = screen.getByRole('group', { name: 'Choose a season' });
    expect(
      within(rail)
        .getAllByRole('radio')
        .map((node) => node.getAttribute('value')),
    ).toEqual(['1957', '2016', '2021', '2026']);
  });

  it('opens on the most recent season it has data for, not blindly on the latest', async () => {
    const user = userEvent.setup();
    render_();
    await openSeasonLens(user);
    expect(screen.getByRole('radio', { name: '2026' })).toHaveProperty('checked', true);
    expect(
      screen.getByRole('img', { name: /Championship points after each round of 2026/ }),
    ).toBeTruthy();
  });

  it('says out loud why points are allowed here, since the career lens refuses them', async () => {
    const user = userEvent.setup();
    render_();
    await openSeasonLens(user);
    expect(screen.getByText(/Points are comparable here\./)).toBeTruthy();
  });

  it('explains an unfinished season rather than leaving half a chart unexplained', async () => {
    const user = userEvent.setup();
    render_();
    await openSeasonLens(user);
    expect(screen.getByText(/2026 is in progress: 10 of 22 rounds have been run\./)).toBeTruthy();
  });

  it('explains dropped scores in 1957, where a flat line is the truth', async () => {
    const user = userEvent.setup();
    render_();
    await openSeasonLens(user);
    await user.click(screen.getByRole('radio', { name: '1957' }));
    expect(
      screen.getByText(/Only the best 5 results of 8 counted toward the 1957 championship\./),
    ).toBeTruthy();
    expect(screen.getByText(/had no single team-mate in 1957/)).toBeTruthy();
  });

  it('names a driver who did not race that season instead of plotting a flat zero', async () => {
    const user = userEvent.setup();
    render_();
    await openSeasonLens(user);
    await user.click(screen.getByRole('radio', { name: '1957' }));
    expect(screen.getByText(/Lewis Hamilton did not start a race in 1957\./)).toBeTruthy();
  });

  it('draws four principals and their seats as pairs, never as eight unrelated lines', async () => {
    const user = userEvent.setup();
    render_();
    await openSeasonLens(user);
    await user.click(screen.getByRole('radio', { name: '2021' }));

    /*
     * 2021: Hamilton (Mercedes, Bottas beside him) and Verstappen (Red Bull, Pérez). Rosberg and
     * Fangio did not race. Four series, two cars — and the encoding is what makes them two pairs:
     * one colour and one marker shape per car, the seat carried by the dash (§6.4a).
     */
    const points = screen.getByRole('img', {
      name: /Championship points after each round of 2021/,
    });
    const lines = [...points.querySelectorAll('g.chart-marks path.chart-line')];
    expect(lines).toHaveLength(4);
    expect(lines.map((line) => line.getAttribute('data-role'))).toEqual([
      'principal',
      'shadow',
      'principal',
      'shadow',
    ]);
    // Two cars → two colours, each used twice.
    const colours = lines.map((line) => line.getAttribute('style'));
    expect(new Set(colours).size).toBe(2);
    // Solid for the principal, `6 3` for the seat beside him, in both pairs.
    expect(lines.map((line) => line.getAttribute('stroke-dasharray'))).toEqual([
      null,
      '6 3',
      null,
      '6 3',
    ]);

    /*
     * ⚠ **Whether that actually reads as two pairs on screen is untested by construction.** jsdom
     * performs no layout and no compositing, so nothing above says the shadow looks lighter, that
     * the direct labels do not collide, or that four lines are distinguishable at 1440px.
     */
  });

  it('suppresses a shadow that would duplicate a principal already on the chart', async () => {
    const user = userEvent.setup();
    render_();
    await openSeasonLens(user);
    await user.click(screen.getByRole('radio', { name: '2016' }));
    /*
     * 2016: Hamilton and Rosberg are each other's team-mate. Drawing both seats would put four
     * Mercedes lines on the chart carrying two drivers' data twice.
     */
    const points = screen.getByRole('img', {
      name: /Championship points after each round of 2016/,
    });
    const roles = [...points.querySelectorAll('g.chart-marks path.chart-line')].map((line) =>
      line.getAttribute('data-role'),
    );
    expect(roles.filter((role) => role === 'principal')).toHaveLength(3);
    // Only Verstappen's seat survives — and it is two series, because it changed hands at R5.
    expect(roles.filter((role) => role === 'shadow')).toHaveLength(2);
  });
});

describe('the selection is the caller’s, when the caller wants it', () => {
  /**
   * ⚠ **The defect this closes.** `selected` was local state with no way out, so the route could
   * not lift a picker choice into `?e=`, nothing refetched, and a driver added from the tray became
   * a pending bay that **never resolved**. Confirmed live before the fix: adding Senna left the URL
   * at `?e=alonso,hamilton` and the bay reading "record loading" indefinitely.
   */
  const renderControlled = (selected: string[]) => {
    const onSelect = vi.fn();
    const view = render(
      <ComparePage
        available={COMPARE_DIRECTORY}
        data={COMPARE_FIXTURE}
        onSelect={onSelect}
        seasons={SEASON_LENS_FIXTURE}
        selected={selected}
      />,
    );
    return { onSelect, view };
  };

  it('reports an addition to the caller instead of swallowing it into local state', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderControlled(['hamilton', 'rosberg']);
    await user.type(screen.getByRole('combobox'), 'ayrton');
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(['hamilton', 'rosberg', 'senna']);
  });

  it('reports a removal the same way', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderControlled(['hamilton', 'rosberg']);
    await user.click(screen.getByRole('button', { name: /Remove Nico Rosberg/ }));
    expect(onSelect).toHaveBeenCalledWith(['hamilton']);
  });

  it('does not move on its own — the caller decides what the next selection is', async () => {
    /*
     * A controlled page that also updated a private copy would show the addition before the URL
     * agreed, and then flicker when the payload for the *old* selection came back. The rendered
     * tray must be a function of the prop and nothing else.
     */
    const user = userEvent.setup();
    renderControlled(['hamilton', 'rosberg']);
    await user.click(screen.getByRole('button', { name: /Remove Nico Rosberg/ }));
    expect(screen.getByRole('button', { name: /Remove Nico Rosberg/ })).toBeTruthy();
  });

  it('still refuses a fifth, because the cap belongs to the palette and not to the caller', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderControlled(['hamilton', 'rosberg', 'max_verstappen', 'fangio']);
    expect(screen.getByRole('combobox')).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: /Remove Juan Fangio/ }));
    expect(onSelect).toHaveBeenCalledWith(['hamilton', 'rosberg', 'max_verstappen']);
  });

  it('keeps its own selection when the caller supplies no handler', async () => {
    /* The uncontrolled path is what lets this component be a pure function of a payload in a test
     * with no router and no network — it is not a convenience. */
    const user = userEvent.setup();
    render(<ComparePage available={COMPARE_DIRECTORY} data={COMPARE_FIXTURE} />);
    await user.click(screen.getByRole('button', { name: /Remove Nico Rosberg/ }));
    expect(screen.queryByRole('button', { name: /Remove Nico Rosberg/ })).toBeNull();
  });
});

describe('the notice slot keeps the document outline in order', () => {
  it('renders the route’s card BELOW the h1, not above it', () => {
    /*
     * The route used to render this as a sibling *before* `ComparePage`, and `ComparePage` carries
     * the page's `h1` — so an `h2` came first in the outline. Reachable only through a hand-edited
     * URL, and wrong on every one of them.
     */
    render(
      <ComparePage
        available={COMPARE_DIRECTORY}
        data={COMPARE_FIXTURE}
        notice={<h2>Part of that link could not be read</h2>}
        seasons={SEASON_LENS_FIXTURE}
      />,
    );
    const headings = screen.getAllByRole('heading');
    const levels = headings.map((node) => node.tagName);
    expect(levels.indexOf('H1')).toBeGreaterThanOrEqual(0);
    expect(levels.indexOf('H1')).toBeLessThan(levels.indexOf('H2'));
  });

  it('renders nothing at all when there is no notice', () => {
    render(<ComparePage available={COMPARE_DIRECTORY} data={COMPARE_FIXTURE} />);
    expect(screen.queryByText('Part of that link could not be read')).toBeNull();
  });
});

describe('the result mix (§6.6.6.14)', () => {
  it('draws one four-step row per selected driver, in selection order', () => {
    const { container } = render_();
    const marks = [...container.querySelectorAll('.chart-marks .chart-span')];
    expect(marks).toHaveLength(COMPARE_FIXTURE.entities.length * 4);
    expect(marks.slice(0, 4).map((mark) => mark.getAttribute('data-tone'))).toEqual([
      'win',
      'podium',
      'classified',
      'unclassified',
    ]);
  });

  it('prints the denominators the shares throw away', () => {
    /*
     * A 100% bar is comparable *because* it discards the size, which also makes it incomplete: a
     * reader cannot tell Fangio's 51 races from Hamilton's 390 by looking at two full-width bars.
     * The caption is where that difference lives, and it is generated from the same totals the
     * bars are, so it cannot drift from them.
     */
    render_();
    expect(screen.getByText(/Fangio 51/)).toBeTruthy();
    expect(screen.getByText(/Hamilton 390/)).toBeTruthy();
  });

  it('explains a retirement count that differs from the unclassified count', () => {
    // Hamilton: 34 retirements, 32 unclassified starts. The note appears because they differ, with
    // both figures in it — not as a standing disclaimer on every comparison.
    render_();
    expect(
      screen.getByText(/Hamilton retired from 34 races and has 32 starts with no classification/),
    ).toBeTruthy();
  });

  it('never draws a number inside a tone, whatever the fills resolve to', () => {
    /*
     * V-38: neither ink clears 4.5:1 across all 44 fills. The rule is enforced in `ShareChart`, and
     * this asserts the page actually gets it — a future caller adding a `shortLabel` for
     * "readability" is exactly the change that would put 3.40:1 text on a McLaren bar.
     */
    const { container } = render_();
    expect(container.querySelectorAll('.chart-span-label')).toHaveLength(0);
  });
});

describe('the career-relative arc (§6.6.6.14 B)', () => {
  it('is on the career lens, with the axis stated as a career and not a calendar', () => {
    render_();
    expect(screen.getByText('Season by season of a career')).toBeTruthy();
    expect(screen.getByText(/season 1 is his debut season, whenever it happened/)).toBeTruthy();
  });

  it('draws one line per selected driver', () => {
    const { container } = render_();
    expect(container.querySelectorAll('.chart-rank-line')).toHaveLength(
      COMPARE_FIXTURE.entities.length,
    );
  });

  it('states the field-size limit rather than implying a placing is a fixed fraction', () => {
    // An honesty caption, and the figure is queried: 77 seasons, 16 ranked at the fewest (1965,
    // 1996, 2000) and 29 at the most (1989).
    render_();
    expect(screen.getByText(/ranked between 16 and 29 drivers/)).toBeTruthy();
  });
});

describe('places gained from the grid (§6.6.6.14 C)', () => {
  it('anchors every bar at zero and points it by sign, never by colour', () => {
    /*
     * The origin is on the mark because the component that decides the sign is the thing that has
     * to state the anchor — `usePopulationMount` reads `data-origin` per target. A fixed `left`
     * would animate a negative bar sliding across the axis it is measured from.
     */
    const { container } = render_();
    const bars = [...container.querySelectorAll('.gain-bar')];
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      const direction = bar.getAttribute('data-direction');
      expect(direction === 'forward' || direction === 'back').toBe(true);
      expect(bar.getAttribute('data-origin')).toBe(direction === 'forward' ? 'left' : 'right');
      expect(bar.getAttribute('data-motion')).toBe(GAIN_BAR_ATTR);
    }
  });

  it('draws the zero line on every row — the chart’s one axis', () => {
    // §6.6.6.3's rule about the balance bar's even mark, in the other diverging form: without a
    // drawn zero a diverging bar is just a bar, and its sign is a guess about where the middle is.
    const { container } = render_();
    expect(container.querySelectorAll('.gain-zero')).toHaveLength(COMPARE_FIXTURE.entities.length);
  });

  it('prints the split beside every bar, because it can disagree with the average', () => {
    const { container } = render_();
    const splits = [...container.querySelectorAll('.gain-split')];
    expect(splits).toHaveLength(COMPARE_FIXTURE.entities.length);
    for (const split of splits) expect(split.textContent).toMatch(/ahead of his grid slot/);
    expect(
      screen.getByText(/one race lost by fifteen places outweighs ten gained by one/),
    ).toBeTruthy();
  });

  it('counts the races it could not measure rather than folding them in as no movement', () => {
    render_();
    expect(screen.getByText(/no place change to measure/)).toBeTruthy();
  });
});
