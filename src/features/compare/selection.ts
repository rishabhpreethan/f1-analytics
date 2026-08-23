import { COMPARISON_CAP } from '@/components/charts/ladder';
import type { CompareCandidate } from './types';

/**
 * `/compare`'s URL state, as two pure functions.
 *
 * Beside the route rather than inside it because a route file may only export components — Fast
 * Refresh cannot reload a module that mixes them — and because these are the two rules on this
 * surface worth a unit test: what a shareable link is allowed to say, and what the page opens on
 * when it says nothing.
 *
 * `ARCHITECTURE.md` §5: *"comparison state lives entirely in the query string so any comparison is
 * shareable"*, and *"invalid params degrade to defaults with a visible notice — never a blank
 * page, never a crash"*. The endpoint refuses a malformed `?e=` because an API must; the page
 * repairs one, because a 400 **is** a blank page.
 */

/**
 * `^[A-Za-z0-9_-]{1,32}$` — `server/schemas/entity.ts`'s measured class, deliberately **not**
 * lowercase-only: three real driver references carry a capital (`scott_Brown`, `Changy`,
 * `Cannoc`) and hyphens are real too (`campbell-jones`).
 */
const REFERENCE = /^[A-Za-z0-9_-]{1,32}$/;

export interface Selection {
  refs: string[];
  /** True when `?e=` held something this page could not use. §5's "visible notice". */
  corrected: boolean;
}

/**
 * `?e=` → the references to compare.
 *
 * A malformed element is dropped rather than the whole parameter refused, a duplicate is dropped
 * rather than compared with itself, and a fifth entity is dropped rather than the page failing.
 * `corrected` is what turns that from a silent repair into a stated one.
 */
export function parseSelection(raw: string | null): Selection {
  if (raw === null || raw === '') return { refs: [], corrected: false };
  const parts = raw.split(',');
  const refs: string[] = [];
  for (const part of parts) {
    if (!REFERENCE.test(part) || refs.includes(part) || refs.length >= COMPARISON_CAP) continue;
    refs.push(part);
  }
  return { refs, corrected: refs.length !== parts.length };
}

/**
 * The comparison the page opens on when the URL names none — **derived, not chosen.**
 *
 * The two most-raced drivers whose last season is the archive's last: "still on the grid" without
 * asking `/api/meta` for a year, and without a hard-coded name that a database refresh would
 * quietly retire. On this data that is Alonso and Hamilton, who were also McLaren teammates in
 * 2007 — so the default lands on one of the richest comparisons the archive holds rather than on
 * an editorial favourite.
 *
 * `selectCandidates` has already sorted by races descending, so this only has to filter and take.
 */
export function defaultSelection(candidates: readonly CompareCandidate[]): string[] {
  const latest = candidates.reduce(
    (year, candidate) => Math.max(year, candidate.lastSeason ?? 0),
    0,
  );
  const pool =
    latest === 0 ? candidates : candidates.filter((candidate) => candidate.lastSeason === latest);
  return pool.slice(0, 2).map((candidate) => candidate.ref);
}
