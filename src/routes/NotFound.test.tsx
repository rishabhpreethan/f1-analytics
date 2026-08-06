// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { META_REAL } from '@schemas/meta.fixture';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';

/**
 * Test 65 of the F0 unit-test list: an unknown address renders `NotFound` **inside** the
 * shell, so the nav and the theme control keep working (E13). A wrong link is not a
 * reason to lose the chrome.
 *
 * The whole `App` is rendered rather than the route component alone, because the thing
 * under test is where `NotFound` lands in the tree — not what it looks like.
 */

function queryClientForTest(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(META_REAL), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  );
  window.history.pushState({}, '', '/nonsense');
});

describe('an unknown address', () => {
  it('renders NotFound inside AppShell, with the nav still present', async () => {
    render(
      <QueryClientProvider client={queryClientForTest()}>
        <App />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No page at this address' }),
    ).toBeDefined();

    // The shell is intact: one primary nav, one main landmark, and it is the skip
    // link's target.
    const navs = screen.getAllByRole('navigation', { name: 'Primary' });
    expect(navs).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Season' })).toBeDefined();

    const mains = screen.getAllByRole('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]?.getAttribute('id')).toBe('main');

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toBeDefined();
  });
});
