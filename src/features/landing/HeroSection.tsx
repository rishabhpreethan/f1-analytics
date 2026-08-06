import { ButtonLink } from '@/components/ui/Button';
import { ArrowRight } from '@/components/ui/icons';
import { useHeadlineReveal } from '@/lib/motion/text';
import type { HeroFigures } from './selectors';
import { StatStrip } from './StatStrip';

/**
 * Section A — the hero (Design Spec §3.2).
 *
 * **Nothing above the stat strip depends on data.** The headline, the sub-headline and the two
 * CTAs need no API response, which is the rule §8 states as "no failure of `/api/meta` may blank
 * the landing page": `figures` is `null` while the request is in flight or has failed, and this
 * component renders in full either way. Only the strip below reacts.
 *
 * The headline is the **one** element allowed `--display-3xl` (§2.3): 112px at 1440+, 80px at
 * 768–1439, 60px below — three exact steps switched at breakpoints, never `clamp()`, because a
 * fluid size is a size that is not on the scale.
 *
 * "SETTLE / THE / ARGUMENT." is a claim about the product's *purpose*, not about its data, which
 * is why it cannot be falsified by a coverage boundary the way "every lap" could — and the
 * sub-headline immediately tells the truth about those boundaries.
 */

export interface HeroSectionProps {
  figures: HeroFigures | null;
  /** `true` while `/api/meta` is in flight; the strip holds its height. */
  pending: boolean;
  /** Set when the figures cannot be shown at all. The hero itself is unaffected. */
  failed: boolean;
}

export function HeroSection({ figures, pending, failed }: HeroSectionProps) {
  const { scope: headlineScope } = useHeadlineReveal<HTMLHeadingElement>();

  // The sub-headline's count is the one figure in the hero's prose. Until it resolves the
  // sentence reads without it rather than with a placeholder, because "— seasons of Formula 1"
  // is worse than a sentence that is simply shorter for one paint.
  const seasons = figures === null ? null : figures.seasonCount;

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-inner shell-container px-4 md:px-6 xl:px-8">
        <p className="t-2xs text-ink-tertiary flex items-center gap-2">
          <span className="accent-rule" aria-hidden="true" />
          <span>
            THE ARCHIVE
            {figures !== null && <span className="t-mono"> · {figures.seasonSpan}</span>}
          </span>
        </p>

        {/*
         * Three block spans rather than `<br>`: a `<br>` contributes no whitespace to the
         * accessible-name computation, so the `h1` would announce "Settlethe argument." — and the
         * explicit trailing spaces are what keep the name correct whether or not `SplitText` has
         * run. The line breaks are layout, and layout belongs to CSS.
         */}
        <h1 ref={headlineScope} id="hero-title" className="hero-headline">
          <span className="hero-line">{'Settle '}</span>
          <span className="hero-line">{'the '}</span>
          <span className="hero-line text-accent-ink">argument.</span>
        </h1>

        <p className="t-md text-ink-secondary hero-lead">
          {seasons === null ? 'Every' : `${String(seasons)} seasons of Formula 1 — every`} race
          result, every qualifying session, and every lap the record holds. Compared across eras,
          and honest about where the record stops.
        </p>

        <div className="hero-cta">
          {/*
           * The primary CTA is `hero` — **the only instance of that variant in the product**, and
           * the only magnetic element in it (G-9). A page of magnetic buttons is a toy.
           */}
          <ButtonLink to="/seasons" variant="hero" size="lg" magnetic>
            <span>Explore the {figures === null ? 'current' : figures.latestYear} season</span>
            <ArrowRight size={20} className="btn-arrow" />
          </ButtonLink>
          <ButtonLink to="/compare" variant="secondary" size="lg">
            Compare drivers
          </ButtonLink>
        </div>

        <StatStrip figures={figures} pending={pending} failed={failed} />
      </div>
    </section>
  );
}
