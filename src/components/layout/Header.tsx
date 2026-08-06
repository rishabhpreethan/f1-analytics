import { Link } from 'react-router';
import { selectCoverageDetail, selectDataVintage } from '@/features/meta/selectors';
import { useMeta } from '@/features/meta/useMeta';
import { NAV_ITEMS } from '@/components/layout/navItems';
import { PrimaryNav, PrimaryNavSheet } from '@/components/layout/PrimaryNav';
import { DataVintage } from '@/components/ui/DataVintage';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/**
 * The header's inner bar (Design Spec §2.1): wordmark, nav, then the right cluster.
 *
 * **This is where `/api/meta` is read.** `Header` calls the feature hook, runs the pure
 * selectors and passes plain values down, so `DataVintage` stays presentational
 * (`ARCHITECTURE.md` §3). It is the only fetch in F0.
 *
 * DOM order is what makes Design §8's two focus orders hold. At ≥768 the menu button is
 * `display: none`, giving wordmark → nav → cluster; at <768 the inline nav is
 * `display: none`, giving wordmark → cluster → menu button. `AppShell` owns the `header`
 * landmark itself, and with it M-1.
 *
 * The item list is now `navItems.ts`'s `NAV_ITEMS` — the same array `CommandDock` consumes
 * from C7-5, so the two can never disagree about where a destination lives. There is no
 * entry for `/seasons/:year` or `/seasons/:year/races/:round`: those are reached from Season,
 * and `isActiveNavItem` keeps Season lit while you are inside them. There are no dead
 * controls: the global search and the app-wide season selector are F9, so they are
 * **absent** rather than present-and-disabled.
 */

export function Header() {
  const { data, isPending } = useMeta();

  const vintage = data === undefined ? null : selectDataVintage(data);
  const detail = data === undefined ? null : selectCoverageDetail(data);

  // Three states, and the third is not only the error case: a payload holding no
  // completed round at all (E6) has no coverage to state either, so it renders the same
  // quiet variant rather than an empty chip.
  const vintageState = isPending
    ? 'loading'
    : vintage === null || detail === null
      ? 'unavailable'
      : 'ready';

  return (
    <div className="shell-container shell-bar flex items-center gap-4 px-4 md:px-6 xl:px-8">
      <Link to="/" className="shell-wordmark t-display-xs text-ink-primary font-bold">
        F1 Analytics
      </Link>

      <PrimaryNav items={NAV_ITEMS} />

      <div className="ml-auto flex items-center gap-2">
        <DataVintage vintage={vintage} detail={detail} state={vintageState} />
        <ThemeToggle />
      </div>

      <PrimaryNavSheet items={NAV_ITEMS} />
    </div>
  );
}
