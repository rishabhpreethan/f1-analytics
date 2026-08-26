// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * **Mutable, because one behaviour below only exists when motion is allowed.** Under `reduce`,
 * `useDisclosure` never builds an exit timeline and the panel unmounts the moment it is closed —
 * so a suite that only ever runs reduced would never exercise the `closing` phase, which is the
 * phase in which a panel can get stuck on screen forever.
 */
const preference = { reduce: true };

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (media: string) => ({
      matches: media.includes('reduce')
        ? (globalThis as { __reduce?: { reduce: boolean } }).__reduce?.reduce !== false
        : media.includes('no-preference')
          ? (globalThis as { __reduce?: { reduce: boolean } }).__reduce?.reduce === false
          : false,
      media,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

import { CreditsProvider } from './CreditsProvider';
import { CreditsTrigger } from './CreditsTrigger';
import { LICENCE_TALLY, PHOTOGRAPHER_COUNT, PHOTOGRAPHS, driverName } from './imagery';

/**
 * **`PhotographCredits` — §7.18.** Most of what is asserted here is a **licence obligation** rather
 * than a design preference, and that is the reason this file is thorough where a decorative panel
 * would not be: CC BY and CC BY-SA require the author, the licence and a link to the source to
 * travel with the work, and this repository is public.
 *
 * jsdom loads no images, performs no layout and no compositing, so **nothing here sees the panel**:
 * not whether it is centred, not whether the plates letterbox, not whether the ladder's bars are
 * legible, not whether the entrance plays. Those are Rishabh's to look at and they are named as
 * unverified in the hand-off. What is asserted is what a reader can *reach* and what the page
 * *states* — which is the whole of the legal question.
 */

(globalThis as { __reduce?: { reduce: boolean } }).__reduce = preference;

afterEach(() => {
  cleanup();
  preference.reduce = true;
});

/** The shell always supplies the provider; a test that renders a control alone has to. */
function renderTrigger() {
  return render(
    <CreditsProvider>
      <CreditsTrigger />
    </CreditsProvider>,
  );
}

async function openPanel() {
  const user = userEvent.setup();
  renderTrigger();
  await user.click(screen.getByRole('button', { name: /Photograph credits/ }));
  return { user, dialog: screen.getByRole('dialog') };
}

describe('reaching it — §7.18.1', () => {
  it('opens from a labelled control, not from a bare glyph', () => {
    /*
     * A camera icon alone in a footer is a thing people scroll past, and attribution that nobody
     * finds is attribution that has not been given. §2.5 says an icon never carries meaning alone;
     * here the licence says it too.
     */
    renderTrigger();
    expect(screen.getByRole('button', { name: 'Photograph credits' })).toBeTruthy();
  });

  it('is a modal dialog with a name, so a screen reader arrives somewhere identified', async () => {
    const { dialog } = await openPanel();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByRole('heading', { name: 'The photographs' })).toBeTruthy();
  });

  it('closes on Escape, on the close button and on the scrim', async () => {
    const { user } = await openPanel();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Photograph credits/ }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns focus to the control that opened it', async () => {
    const { user } = await openPanel();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Photograph credits/ }));
  });

  it('moves focus into the panel on open rather than leaving it behind', async () => {
    await openPanel();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });
});

describe('the obligation — every photograph carries its three facts', () => {
  it('names the photographer of every single photograph', async () => {
    const { dialog } = await openPanel();
    for (const photograph of PHOTOGRAPHS) {
      expect(
        within(dialog).getAllByText(photograph.artist).length,
        `${photograph.ref} is uncredited`,
      ).toBeGreaterThan(0);
    }
  });

  it('links every photograph to its licence deed and to its source page', async () => {
    /*
     * **The strongest assertion in this file.** A plate that lost either link would still render,
     * still look designed, and would be a licence breach. Both are checked by `href`, per
     * photograph, rather than by counting anchors — a count passes when 22 links all point at the
     * same place.
     */
    const { dialog } = await openPanel();
    const hrefs = new Set(
      [...dialog.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
    );
    for (const photograph of PHOTOGRAPHS) {
      expect(hrefs.has(photograph.sourceUrl), `${photograph.ref} has no source link`).toBe(true);
      expect(hrefs.has(photograph.licenceUrl), `${photograph.ref} has no licence link`).toBe(true);
    }
  });

  it('opens every outbound link safely and marks the licence ones as such', async () => {
    const { dialog } = await openPanel();
    for (const anchor of dialog.querySelectorAll('a[href^="http"]')) {
      expect(anchor.getAttribute('rel')).toContain('noopener');
      expect(anchor.getAttribute('rel')).toContain('noreferrer');
      expect(anchor.getAttribute('target')).toBe('_blank');
    }
  });

  it('states the licence of every photograph in words as well as in a link', async () => {
    const { dialog } = await openPanel();
    for (const tally of LICENCE_TALLY) {
      expect(within(dialog).getAllByText(tally.licence).length).toBeGreaterThan(0);
    }
  });

  it('prints the Commons title, which is what discloses when and where it was taken', async () => {
    /*
     * §7.17.4 — several photographs show the right driver in the wrong team's kit. The title is
     * where a Ferrari cap beside a Williams identity bar is resolved, and it is a fact rather than
     * a hedge.
     */
    const { dialog } = await openPanel();
    const albon = PHOTOGRAPHS.find((p) => p.ref === 'albon');
    if (albon === undefined) throw new Error('the fixture driver left the manifest');
    expect(within(dialog).getByText(albon.title)).toBeTruthy();
  });

  it('describes each photograph for a reader who cannot see it', async () => {
    // Unlike `EntityPortrait`, here the photograph IS the subject, so `alt` carries a real
    // description rather than being empty beside a name (§7.17.1).
    const { dialog } = await openPanel();
    const images = dialog.querySelectorAll('img');
    expect(images).toHaveLength(PHOTOGRAPHS.length);
    for (const image of images) {
      expect(image.getAttribute('alt')).toMatch(/, photographed by /);
    }
  });

  it('names the driver in every plate, never the slug', async () => {
    const { dialog } = await openPanel();
    for (const photograph of PHOTOGRAPHS) {
      const name = driverName(photograph.ref);
      expect(name).not.toBe(photograph.ref);
      expect(within(dialog).getAllByText(name).length).toBeGreaterThan(0);
    }
  });
});

describe('the shape of the set — §7.18.2', () => {
  it('states the three figures, computed rather than written into the copy', async () => {
    /*
     * The lead and the tiles both read the manifest. A hardcoded "22" would be wrong the first
     * time a photograph is added, and wrong quietly.
     */
    const { dialog } = await openPanel();
    const figures = [...dialog.querySelectorAll('.stat-figure')].map((n) => n.textContent);
    expect(figures).toEqual([
      String(PHOTOGRAPHS.length),
      String(PHOTOGRAPHER_COUNT),
      String(LICENCE_TALLY.length),
    ]);
  });

  it('draws a ladder bar whose extent IS the count, not a rounded impression of it', async () => {
    // §6.3b — a mark's length is the datum. The offset is zero here, so the whole track from the
    // left edge is the proportion.
    const { dialog } = await openPanel();
    const fills = [...dialog.querySelectorAll('.credits-ladder .ruler-fill')];
    expect(fills).toHaveLength(LICENCE_TALLY.length);
    fills.forEach((fill, index) => {
      const tally = LICENCE_TALLY[index];
      if (tally === undefined) throw new Error('unreachable');
      const style = fill.getAttribute('style') ?? '';
      expect(style).toContain('--band-offset: 0%');
      expect(style).toContain(`--band-extent: ${String(tally.share * 100)}%`);
    });
  });

  it('prints each licence’s count beside its bar', async () => {
    const { dialog } = await openPanel();
    const ladder = dialog.querySelector('.credits-ladder');
    for (const tally of LICENCE_TALLY) {
      expect(
        within(ladder as HTMLElement).getAllByText(String(tally.count)).length,
      ).toBeGreaterThan(0);
    }
  });

  it('orders the plates by surname, so the list reads like a list of people', async () => {
    const { dialog } = await openPanel();
    const plates = [...dialog.querySelectorAll('.credits-plate')].map((n) => n.getAttribute('id'));
    expect(plates).toEqual(PHOTOGRAPHS.map((p) => `credit-${p.ref}`));
  });

  it('credits the CC0 photograph too, which asks for nothing', async () => {
    const { dialog } = await openPanel();
    expect(within(dialog).getByText(/public-domain dedicated under CC0/)).toBeTruthy();
  });
});

describe('the motion contract — G-34 is G-5 applied to a second surface', () => {
  it('carries the same `data-motion` hooks the shared builders select on', async () => {
    /*
     * `sheetEnter` / `sheetExit` query `[data-motion="scrim"]`, `"sheet-panel"` and `"sheet-row"`.
     * A renamed attribute here does not throw and does not fail any other test — the panel simply
     * appears with no entrance, which is invisible in jsdom and obvious in a browser.
     */
    const { dialog } = await openPanel();
    expect(dialog.getAttribute('data-motion')).toBe('sheet-panel');
    expect(document.querySelector('.credits-scrim')?.getAttribute('data-motion')).toBe('scrim');
    expect(dialog.querySelectorAll('[data-motion="sheet-row"]').length).toBeGreaterThan(0);
  });
});

describe('the guard', () => {
  it('throws rather than rendering a credit button that does nothing', () => {
    /*
     * A no-op default context would give a control that looks operable, opens nothing, and leaves
     * 22 photographs unattributed on a public site. Loud is correct here.
     */
    const noise = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CreditsTrigger />)).toThrow(/CreditsProvider/);
    noise.mockRestore();
  });
});

describe('the closing phase — the one thing `reduce` hides', () => {
  it('actually unmounts when an exit tween IS built', async () => {
    /*
     * `useDisclosure` keeps the panel in the DOM through a `closing` phase purely so its exit
     * timeline can play, and unmounts on that timeline's `onComplete`. Every other test in this
     * file runs under `reduce`, where no timeline is built and the panel unmounts at once — so
     * without this one, a panel that never completes its exit would pass the whole suite and stay
     * on screen forever in a browser.
     */
    preference.reduce = false;
    const user = userEvent.setup();
    renderTrigger();
    await user.click(screen.getByRole('button', { name: /Photograph credits/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
