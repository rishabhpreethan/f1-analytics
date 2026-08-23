/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntityPicker } from './EntityPicker';
import { COMPARE_DIRECTORY } from './lensFixture';

/**
 * `EntityPicker` — `DESIGN_SYSTEM.md` §7.16.
 *
 * **The directory is the real one**, 818 queried drivers, because two of the behaviours worth
 * asserting only exist at that size: the result list has to be capped and say so, and the
 * diacritic fold has to find Häkkinen from `hakkinen`. A three-item fake would assert neither.
 *
 * ⚠ jsdom performs no layout, so nothing here says the list is legible, that it does not cover the
 * bays, or that the active row is visibly distinct. What it does say is that the keyboard path
 * works end to end and that the cap is enforced by the control rather than by the caller.
 */

afterEach(cleanup);

const renderPicker = (filled = 0) => {
  const onAdd = vi.fn();
  render(
    <EntityPicker baysId="bays" candidates={COMPARE_DIRECTORY} filled={filled} onAdd={onAdd} />,
  );
  return { onAdd, input: screen.getByRole('combobox') };
};

describe('the directory this picker is built for', () => {
  it('is the 818 drivers who have started a Grand Prix, not all 881', () => {
    // The other 63 never raced, so there is nothing to compare — offering them would be a bay that
    // fills with an empty record.
    expect(COMPARE_DIRECTORY).toHaveLength(818);
    expect(COMPARE_DIRECTORY.every((driver) => (driver.races ?? 0) > 0)).toBe(true);
  });
});

describe('§7.16 — searching', () => {
  it('shows nothing until you type, so the page does not open with a wall of 818 rows', () => {
    renderPicker();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByText('818 drivers to choose from')).toBeTruthy();
  });

  it('folds diacritics, so `hakkinen` finds Häkkinen', async () => {
    const user = userEvent.setup();
    const { input } = renderPicker();
    await user.type(input, 'hakkinen');
    expect(within(screen.getByRole('listbox')).getByText(/Häkkinen/)).toBeTruthy();
  });

  it('matches every token in any order, so `ham lewis` finds Lewis Hamilton', async () => {
    const user = userEvent.setup();
    const { input } = renderPicker();
    await user.type(input, 'ham lewis');
    expect(within(screen.getByRole('listbox')).getByText('Lewis Hamilton')).toBeTruthy();
  });

  it('matches the three-letter code, which is how a fan refers to a current driver', async () => {
    const user = userEvent.setup();
    const { input } = renderPicker();
    await user.type(input, 'ver');
    expect(within(screen.getByRole('listbox')).getByText('Max Verstappen')).toBeTruthy();
  });

  it('caps the list and states the cap, rather than rendering every match', async () => {
    const user = userEvent.setup();
    const { input } = renderPicker();
    await user.type(input, 'a');
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(12);
    expect(screen.getByText(/^12 of \d+ matches$/)).toBeTruthy();
  });

  it('says so when nothing matches, instead of showing an empty box', async () => {
    const user = userEvent.setup();
    const { input } = renderPicker();
    await user.type(input, 'zzzz');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByText('No driver matches “zzzz”')).toBeTruthy();
  });
});

describe('§7.16 — the keyboard path, which is the whole reason it is a combobox', () => {
  it('takes the active option on Enter without focus ever leaving the field', async () => {
    const user = userEvent.setup();
    const { onAdd, input } = renderPicker();
    await user.type(input, 'senna');
    await user.keyboard('{Enter}');
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
  });

  it('moves the active option with the arrow keys and takes the one it lands on', async () => {
    const user = userEvent.setup();
    const { onAdd, input } = renderPicker();
    await user.type(input, 'schumacher');
    const first = within(screen.getByRole('listbox')).getAllByRole('option')[0];
    await user.keyboard('{ArrowDown}');
    const second = within(screen.getByRole('listbox')).getAllByRole('option')[1];
    expect(first?.getAttribute('aria-selected')).toBe('false');
    expect(second?.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Enter}');
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('wraps at the ends rather than sticking, so ↑ from the top reaches the bottom', async () => {
    const user = userEvent.setup();
    const { input } = renderPicker();
    await user.type(input, 'a');
    await user.keyboard('{ArrowUp}');
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.at(-1)?.getAttribute('aria-selected')).toBe('true');
  });

  it('clears on Escape and keeps focus, so a mistyped query costs one key', async () => {
    const user = userEvent.setup();
    const { input } = renderPicker();
    await user.type(input, 'senna');
    await user.keyboard('{Escape}');
    expect((input as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('points aria-activedescendant at the option a reader would take', async () => {
    const user = userEvent.setup();
    const { input } = renderPicker();
    await user.type(input, 'prost');
    const active = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((option) => option.getAttribute('aria-selected') === 'true');
    expect(input.getAttribute('aria-activedescendant')).toBe(active?.id);
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('§7.16 — the cap is drawn, not enforced silently', () => {
  it('disables the field at four and says why', () => {
    renderPicker(4);
    const input = screen.getByRole('combobox');
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Four is the ceiling. Remove a driver to add another.')).toBeTruthy();
  });

  it('is still usable at three, so the last bay is reachable', () => {
    renderPicker(3);
    expect(screen.getByRole('combobox')).toHaveProperty('disabled', false);
  });
});

describe('§7.16 — what a row tells you before you commit to it', () => {
  it('carries the span and the race count, which is how one Brabham is told from another', async () => {
    const user = userEvent.setup();
    const { input } = renderPicker();
    await user.type(input, 'jack brabham');
    const option = within(screen.getByRole('listbox')).getAllByRole('option')[0];
    expect(option?.textContent).toContain('1955–1970');
    /*
     * **128, not the 126 a reference book prints.** This product counts a race as a distinct round
     * holding a race classification row for the driver (`server/queries/directory.ts`), which
     * includes two rounds Brabham was classified in without taking the start. The number that
     * matters here is that the picker agrees with `/drivers` and the profile — a picker that
     * disagreed with the page it feeds would be worse than one that matched Wikipedia.
     */
    expect(option?.textContent).toContain('128 races');
  });

  it('paints the identity swatch from a token, never from a colour (§3.3a.3)', async () => {
    const user = userEvent.setup();
    const { input } = renderPicker();
    await user.type(input, 'hamilton');
    const option = within(screen.getByRole('listbox')).getAllByRole('option')[0];
    const style = option?.getAttribute('style') ?? '';
    expect(style).toMatch(/--identity:\s*var\(--/);
    expect(style).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});
