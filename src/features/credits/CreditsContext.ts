import { createContext, use } from 'react';

/**
 * **The opener for §7.18's panel**, and nothing else.
 *
 * Its own module rather than a second export from `CreditsProvider.tsx`, because a file that
 * exports both a component and a hook loses fast refresh (`react-refresh/only-export-components`)
 * — the same reason `iconRegistry.ts` is separate from `icons.tsx`.
 */
export interface CreditsApi {
  /**
   * Opens the panel. Passing a `CreditedImage.plateId` scrolls that plate into view and moves focus
   * to it, so a reader who clicked a credit line arrives at the credit they asked for rather than
   * at the top of a list of 40.
   *
   * **A plate id, not a bare reference, since the cars and marks arrived.** `ferrari` names a car
   * *and* a team mark, and a reference is only unique within its own set; two plates sharing one id
   * is a deep link that lands on whichever happened to render first.
   */
  open: (plateId?: string | null) => void;
}

export const CreditsContext = createContext<CreditsApi | null>(null);

/**
 * The opener, for any control anywhere below the provider.
 *
 * Throws rather than returning a no-op when the provider is missing: a credit button that silently
 * does nothing is a licence breach that looks like a working page.
 */
export function useCredits(): CreditsApi {
  const api = use(CreditsContext);
  if (api === null) throw new Error('useCredits used outside CreditsProvider');
  return api;
}
