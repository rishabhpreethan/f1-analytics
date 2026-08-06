import { Link } from 'react-router';
import { selectCoverageDetail, selectDataVintage } from '@/features/meta/selectors';
import { useMeta } from '@/features/meta/useMeta';
import { DataVintage } from '@/components/ui/DataVintage';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/**
 * The header's inner bar (Design Spec §5.5): wordmark, then the right cluster.
 *
 * **The nav has left the header.** CR-007 replaced the inline nav and its mobile sheet with
 * `CommandDock`, which `AppShell` renders as a sibling — so this bar is now the wordmark, the
 * coverage indicator and the theme control, and nothing else. That is what makes 56px of chrome
 * enough at every width, and it is why the two focus orders §10 specifies now hold without a
 * split component: there is only one arrangement.
 *
 * **This is where `/api/meta` is read.** `Header` calls the feature hook, runs the pure
 * selectors and passes plain values down, so `DataVintage` stays presentational
 * (`ARCHITECTURE.md` §3). It is the only fetch in the shell.
 *
 * The wordmark sets **`F1` as an inverted badge** — `--accent-fill` with `--accent-on` type
 * (§3.6.4). It replaces the pre-monochrome "the `1` of F1 in `--accent-ink`", which an achromatic
 * accent cannot express: `#08090C` beside `--ink-primary` `#1B1E24` is ΔE ≈ 5. The split is purely
 * visual — the accessible name is on the link, so nothing depends on either half being read.
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
      <Link
        to="/"
        aria-label="F1 Analytics — home"
        className="shell-wordmark t-display-xs text-ink-primary font-bold"
      >
        <span className="wordmark-badge" aria-hidden="true">
          F1
        </span>
        <span aria-hidden="true">ANALYTICS</span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <DataVintage vintage={vintage} detail={detail} state={vintageState} />
        <ThemeToggle />
      </div>
    </div>
  );
}
