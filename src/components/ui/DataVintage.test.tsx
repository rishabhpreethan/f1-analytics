// @vitest-environment jsdom
import { META_REAL } from '@schemas/meta.fixture';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { selectCoverageDetail, selectDataVintage } from '@/features/meta/selectors';
import { DataVintage } from './DataVintage';

/**
 * Test 63 of the F0 unit-test list. It covers the three variants and the ARIA that only
 * exists in a tree; appearance and motion are the `designer`'s gate (4) and QA's (9).
 */

const vintage = selectDataVintage(META_REAL);
const detail = selectCoverageDetail(META_REAL);

afterEach(() => {
  cleanup();
});

describe('DataVintage', () => {
  it('renders the resolved coverage chip for state="ready"', async () => {
    render(<DataVintage vintage={vintage} detail={detail} state="ready" />);

    const trigger = screen.getByRole('button', {
      name: 'Data coverage: 2026 season, 10 of 22 rounds complete. Show detail.',
    });
    expect(trigger.textContent).toBe('2026 · R10');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('status')).toBeNull();

    // A disclosure, not a menu button: `aria-haspopup` would promise a menu (ARIA 1.2
    // defines `"true"` as `"menu"`) that this static-prose panel never delivers.
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
    expect(trigger.getAttribute('aria-controls')).toBe('data-coverage-detail');

    // The label proper — the coverage sentence — is in the detail popover.
    await userEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByText(
        'Complete results through Round 10 of 22 — Belgian Grand Prix, 19 Jul 2026.',
      ),
    ).toBeDefined();
    expect(screen.getByText('Rounds 11–22 are scheduled and have no results yet.')).toBeDefined();
    expect(screen.getByText('2 rounds on the 2026 calendar were cancelled.')).toBeDefined();
    expect(screen.getByText('Seasons available: 1950–2026.')).toBeDefined();

    // Esc dismisses and focus returns to the trigger (§8).
    await userEvent.keyboard('{Escape}');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('renders a busy skeleton for state="loading", and no chip', () => {
    render(<DataVintage vintage={null} detail={null} state="loading" />);

    const busy = screen.getByRole('status', { name: 'Data coverage' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    // §7.5: the container announces busy, the skeleton block itself is hidden.
    expect(busy.querySelector('.skeleton')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the quiet dot for state="unavailable"', () => {
    render(<DataVintage vintage={null} detail={null} state="unavailable" />);

    expect(screen.getByRole('img', { name: 'Data coverage unavailable' })).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('falls back to the unavailable variant when the data holds no completed round (E6)', () => {
    render(<DataVintage vintage={null} detail={null} state="ready" />);
    expect(screen.getByRole('img', { name: 'Data coverage unavailable' })).toBeDefined();
  });
});
