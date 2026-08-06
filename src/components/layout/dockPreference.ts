/**
 * Whether the dock's rail stays open — the one persisted preference the nav has
 * (Design Spec §5.2).
 *
 * Same shape and the same failure posture as `lib/theme.ts`: a near-miss string is
 * **rejected** rather than honoured (`'pin'`, `'Pinned'`, `'true'`, `'{}'` all mean "no
 * preference"), and storage throwing — which it does in Safari private mode — is not a crash.
 * The control still works for the session; it just does not survive a reload.
 *
 * `'auto'` is the default, deliberately. A rail that is open on a first visit hides the
 * discovery that it *can* close, and 232px of permanent chrome is the push sidebar the design
 * rejected (§5.1).
 */

export type DockPreference = 'pinned' | 'auto';

export const DOCK_STORAGE_KEY = 'f1a.dock';

function isDockPreference(value: unknown): value is DockPreference {
  return value === 'pinned' || value === 'auto';
}

export function readDockPreference(): DockPreference {
  try {
    const stored: unknown = window.localStorage.getItem(DOCK_STORAGE_KEY);
    return isDockPreference(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeDockPreference(preference: DockPreference): void {
  try {
    window.localStorage.setItem(DOCK_STORAGE_KEY, preference);
  } catch {
    // Nothing to recover: the preference simply does not persist. Never a thrown error on a
    // decorative control.
  }
}
