// @vitest-environment jsdom
import { META_REAL } from '@schemas/meta.fixture';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  selectCoverageDetail,
  selectDataVintage,
  selectSeasonProgress,
} from '@/features/meta/selectors';
import { DataVintage } from './DataVintage';

/**
 * Test 63 of the F0 unit-test list. It covers the three variants and the ARIA that only
 * exists in a tree; appearance and motion are the `designer`'s gate (4) and QA's (9).
 */

const vintage = selectDataVintage(META_REAL);
const detail = selectCoverageDetail(META_REAL);
const progress = selectSeasonProgress(META_REAL);

afterEach(() => {
  cleanup();
});

describe('DataVintage', () => {
  it('renders the resolved coverage chip for state="ready"', async () => {
    render(<DataVintage vintage={vintage} detail={detail} progress={progress} state="ready" />);

    const trigger = screen.getByRole('button', {
      name: 'Data coverage: 2026 season, 10 of 22 rounds complete. Show detail.',
    });
    /*
     * **The chip now carries a visible noun**, which is the point of the 2026-08-06 respecification:
     * Rishabh said *"i dont really know what its for"*, and two numbers with no label is why. The
     * accessible name is unchanged and still comes from `aria-label`, so the added text costs a
     * screen-reader user nothing.
     */
    expect(trigger.textContent).toBe('Coverage2026 · R10');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('status')).toBeNull();

    // The affordances that make it discoverable, asserted so a tidy-up cannot quietly remove them
    // and return the chip to being an unreadable label.
    expect(trigger.querySelector('.vintage-meter')).not.toBeNull();
    expect(trigger.querySelector('.vintage-chevron')).not.toBeNull();
    expect(trigger.getAttribute('data-open')).toBe('false');
    // The meter is `aria-hidden`: the button's own name already says "10 of 22 rounds complete",
    // and announcing it twice is worse than not drawing it.
    expect(trigger.querySelector('.vintage-meter')?.getAttribute('aria-hidden')).toBe('true');
    // 10 of 22 = 0.4545…, written as a unitless ratio the CSS multiplies into a width.
    expect(
      trigger.querySelector<HTMLElement>('.vintage-meter')?.style.getPropertyValue('--coverage'),
    ).toBe(String(10 / 22));

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
    render(<DataVintage vintage={null} detail={null} progress={null} state="loading" />);

    const busy = screen.getByRole('status', { name: 'Data coverage' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    // §7.5: the container announces busy once, and every skeleton block inside it is hidden.
    const blocks = [...busy.querySelectorAll('.skeleton')];
    expect(blocks.length).toBeGreaterThan(1);
    for (const block of blocks) expect(block.getAttribute('aria-hidden')).toBe('true');
    // …and there is exactly one busy region, not one per block.
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('gives the skeleton the CHIP’s box, so the header cannot reflow on resolve', () => {
    /*
     * §7.5: a skeleton mirrors the geometry of what is coming. Here it is also the only way to
     * guarantee the header does not shift when `/api/meta` answers — the chip's width depends on the
     * rendered width of "Coverage" and of a mono round label, neither of which a token can know. The
     * previous build used a single 92px slab and a comment claiming it was "exactly the width of the
     * resolved chip"; with an eyebrow, a meter and a chevron added, that figure would be wrong by
     * more than 100px.
     *
     * **jsdom performs no layout, so this cannot assert the two widths are equal.** What it can
     * assert is that they are the same box with the same children, which is what makes them equal.
     */
    const { container } = render(
      <DataVintage vintage={null} detail={null} progress={null} state="loading" />,
    );
    const box = container.querySelector('.vintage-trigger');
    expect(box, 'the skeleton does not reuse the chip box').not.toBeNull();
    expect(box?.classList.contains('vintage-trigger-skeleton')).toBe(true);
    // One block per text slot, plus the real (empty) meter track.
    expect(box?.querySelector('.skeleton-vintage-eyebrow')).not.toBeNull();
    expect(box?.querySelector('.skeleton-vintage-value')).not.toBeNull();
    expect(box?.querySelector('.skeleton-vintage-chevron')).not.toBeNull();
    expect(box?.querySelector('.vintage-meter')).not.toBeNull();
  });

  it('renders the quiet dot for state="unavailable"', () => {
    render(<DataVintage vintage={null} detail={null} progress={null} state="unavailable" />);

    expect(screen.getByRole('img', { name: 'Data coverage unavailable' })).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('falls back to the unavailable variant when the data holds no completed round (E6)', () => {
    render(<DataVintage vintage={null} detail={null} progress={null} state="ready" />);
    expect(screen.getByRole('img', { name: 'Data coverage unavailable' })).toBeDefined();
  });
});
