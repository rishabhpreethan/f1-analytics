import { selectHeroFigures } from '@/features/landing/selectors';
import { useMeta } from '@/features/meta/useMeta';

/**
 * `/` — the landing surface (Design Spec §3, `ARCHITECTURE.md` §10 #23).
 *
 * **C7-3 lands the structure only.** The three sections, the single `h1`, and the data
 * states exist; the hero's exact composition, the capability grid, the coverage ruler and
 * every motion arrive with C7-6. This staging is the Technical Spec's (§S.8: C7-3 is "the
 * route split", and the landing is "structure only — a heading and the hero slots, no
 * motion yet").
 *
 * **This is the feature boundary, so this is where the fetch lives** (`ARCHITECTURE.md` §3):
 * `Landing` calls `useMeta()`, runs the pure selector, and passes plain values to
 * presentational children. No child of this route fetches anything.
 *
 * **The hero never depends on data** (Design Spec §8). Its headline, sub-headline and CTAs
 * need no API response, so no failure of `/api/meta` can blank this page — the loading,
 * error and unavailable states are scoped to the figures.
 *
 * **No figure is a literal here.** `77`, `1950`, `2026`, `22`, `10` all come from
 * `selectHeroFigures`; CT-14 greps this file for a three-digit sequence to keep it that way,
 * because those numbers are correct today and wrong after the next refresh.
 */
export function Landing() {
  const { data, error, isPending } = useMeta();
  const figures = data === undefined ? null : selectHeroFigures(data);

  return (
    <div className="flex flex-col">
      <section className="shell-container px-4 py-12 md:px-6 xl:px-8" aria-labelledby="hero-title">
        <p className="t-2xs text-ink-tertiary">THE ARCHIVE</p>
        <h1 id="hero-title" className="t-display-lg text-ink-primary mt-3">
          Settle the argument.
        </h1>
        <p className="t-md text-ink-secondary mt-4 max-w-[52ch]">
          Every race result, every qualifying session, and every lap the record holds. Compared
          across eras, and honest about where the record stops.
        </p>

        {/*
         * The figure slot. C7-6 replaces this with the stat strip, the capability grid and
         * the coverage ruler; the three states below are already the ones those sections
         * inherit, so the state handling is not rewritten with them.
         */}
        <div className="mt-8">
          {isPending && <p className="t-xs text-ink-tertiary">Loading coverage figures…</p>}
          {error !== null && (
            <p className="t-xs text-ink-tertiary">
              Coverage figures aren&apos;t available right now.
            </p>
          )}
          {figures !== null && (
            <dl className="t-mono t-sm text-ink-secondary flex flex-col gap-1">
              <div className="flex gap-2">
                <dt className="text-ink-tertiary">Seasons</dt>
                <dd className="text-ink-primary">{figures.seasonCount}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-tertiary">Coverage</dt>
                <dd className="text-ink-primary">{figures.seasonSpan}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-tertiary">Rounds complete</dt>
                <dd className="text-ink-primary">
                  {figures.roundProgress.completed} of {figures.roundProgress.scheduled}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>
    </div>
  );
}
